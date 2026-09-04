import { getPrisma } from '../database/db'
import { inventoryService } from './inventory.service'
import { logAction } from './audit.service'
import { createNotification } from './notification.service'
import { toLocalISODate, parseLocalDateStart } from '../utils/date.util'
import { getProductCostsBatch } from './valuation.service'
import { roundCurrency } from './currency.service'

// ─── Tables ───────────────────────────────────────────────────────────────────

export async function listTables() {
  try {
    const db = getPrisma()
    const tables = await db.restaurantTable.findMany({
      orderBy: { tableNumber: 'asc' },
      include: {
        // 2026-09-02 — every un-invoiced, non-cancelled KOT, not just
        // PENDING/IN_PROGRESS ones. Under the deferred-billing model a KOT
        // can reach DONE (food served) while still unbilled, and the table
        // list needs to know that so it can offer checkout, not just show
        // "0 KOTs" and look free.
        kots: {
          where: { invoiceId: null, status: { not: 'CANCELLED' } },
          select: { id: true, status: true }
        },
        waiter: { select: { id: true, fullName: true } }
      }
    })
    return { success: true, data: tables }
  } catch (err) {
    return { success: false, error: { code: 'RST-001', message: err instanceof Error ? err.message : 'Could not list tables.' } }
  }
}

export async function createTable(tableNumber: string, tableName?: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.restaurantTable.findUnique({ where: { tableNumber } })
    if (existing) return { success: false, error: { code: 'RST-002', message: `Table "${tableNumber}" already exists.` } }

    const table = await db.restaurantTable.create({ data: { tableNumber, tableName } })
    await logAction(userId, 'TABLE_CREATED', 'RestaurantTable', table.id)
    return { success: true, data: table }
  } catch (err) {
    return { success: false, error: { code: 'RST-003', message: err instanceof Error ? err.message : 'Could not create table.' } }
  }
}

export async function updateTableStatus(tableId: string, status: string, userId?: string) {
  try {
    const db = getPrisma()
    const valid = ['AVAILABLE', 'OCCUPIED', 'RESERVED']
    if (!valid.includes(status)) return { success: false, error: { code: 'RST-004', message: `Invalid status "${status}".` } }

    const table = await db.restaurantTable.update({ where: { id: tableId }, data: { status } })
    await logAction(userId, 'TABLE_STATUS_UPDATED', 'RestaurantTable', tableId, undefined, status)
    return { success: true, data: table }
  } catch (err) {
    return { success: false, error: { code: 'RST-005', message: err instanceof Error ? err.message : 'Could not update table status.' } }
  }
}

// Phase 58 §2 (2026-07-17) — waiter/staff assignment per table for tip
// pooling. null clears the assignment (e.g. shift change).
export async function assignWaiter(tableId: string, waiterId: string | null, userId?: string) {
  try {
    const db = getPrisma()
    const table = await db.restaurantTable.update({
      where: { id: tableId },
      data: { waiterId },
      include: { waiter: { select: { id: true, fullName: true } } },
    })
    await logAction(userId, 'TABLE_WAITER_ASSIGNED', 'RestaurantTable', tableId, undefined, waiterId ?? 'unassigned')
    return { success: true, data: table }
  } catch (err) {
    return { success: false, error: { code: 'RST-013', message: err instanceof Error ? err.message : 'Could not assign waiter.' } }
  }
}

export async function deleteTable(tableId: string, userId?: string) {
  try {
    const db = getPrisma()
    const active = await db.kOT.count({ where: { tableId, status: { in: ['PENDING', 'IN_PROGRESS'] } } })
    if (active > 0) return { success: false, error: { code: 'RST-006', message: 'Cannot delete table with active KOTs.' } }

    const pendingOrderRequest = await db.tableOrderRequest.count({ where: { tableId, status: 'PENDING' } })
    if (pendingOrderRequest > 0) return { success: false, error: { code: 'RST-008', message: 'Cannot delete table with a pending customer order request — accept or reject it first.' } }

    // Real bug found live (2026-09-03): TableOrderRequest.tableId is a
    // required FK with no onDelete action (defaults to Restrict), unlike
    // KOT.tableId (nullable, defaults to SetNull) -- a table that ever had
    // so much as one QR order submitted and resolved (accepted/rejected)
    // could never be deleted again, failing with an unrelated generic
    // "Could not delete table" error instead of the intended active-KOT
    // message above. These are historical records with no use once their
    // table is gone; clear them explicitly rather than touch the schema's
    // default referential action.
    await db.$transaction(async (tx) => {
      const resolvedRequestIds = (await tx.tableOrderRequest.findMany({ where: { tableId }, select: { id: true } })).map((r) => r.id)
      if (resolvedRequestIds.length > 0) {
        await tx.tableOrderRequestItem.deleteMany({ where: { requestId: { in: resolvedRequestIds } } })
        await tx.tableOrderRequest.deleteMany({ where: { id: { in: resolvedRequestIds } } })
      }
      await tx.restaurantTable.delete({ where: { id: tableId } })
    })
    await logAction(userId, 'TABLE_DELETED', 'RestaurantTable', tableId)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RST-007', message: err instanceof Error ? err.message : 'Could not delete table.' } }
  }
}

// Phase 58 §2 (2026-07-21) — releases every table currently pointing at
// `invoiceId` back to AVAILABLE (clears currentInvoiceId). Called from
// INSIDE the same transaction that flips an invoice to a terminal state
// (payment.service.ts's recordPayment/recordSplitPayment reaching PAID,
// billing.service.ts's cancelInvoice, and the split-bill service's original
// invoice going to SPLIT) — never as a separate follow-up call, so a crash
// between "invoice settled" and "table released" can't happen. Accepts a tx
// client with the same shape decrementVariantStockTx/reduceStockTx already
// use for this exact reason.
// REAL BUG found+fixed 2026-07-30: this used to release on a single
// invoiceId reaching PAID/CANCELLED, unaware that billing.service.ts's
// splitInvoice() can turn one table's tab into N sibling invoices
// (id === original.id start, splitFromInvoiceId === original.id for each
// child) while re-pointing the table's currentInvoiceId at only the FIRST
// child. Releasing as soon as that first split check was paid freed the
// table for a new party while the other split checks were still fully
// unpaid and now had no table reference at all — easy to lose track of.
// Fixed by resolving the whole split group (this invoice + its
// splitFromInvoiceId original + every sibling sharing that same original)
// and only releasing once every invoice in that group is settled, matching
// on any invoice id in the group since the table's currentInvoiceId may
// point at any one of them.
export async function releaseTablesForInvoiceTx(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  invoiceId: string
): Promise<void> {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { splitFromInvoiceId: true } })
  const groupRootId = invoice?.splitFromInvoiceId ?? invoiceId

  const groupInvoices = await tx.invoice.findMany({
    where: { OR: [{ id: groupRootId }, { splitFromInvoiceId: groupRootId }] },
    select: { id: true, status: true, paymentStatus: true }
  })
  const groupIds = groupInvoices.map(i => i.id)
  const allSettled = groupInvoices.every(i => i.status === 'CANCELLED' || i.paymentStatus === 'PAID')
  if (!allSettled) return

  await tx.restaurantTable.updateMany({
    where: { currentInvoiceId: { in: groupIds } },
    data: { currentInvoiceId: null, status: 'AVAILABLE' }
  })
}

// Phase 58 §2 (2026-07-21) — ad-hoc merge: staff realizes mid-service that
// a second table needs to join an already-running order (rather than
// selecting both tables up front at order-open time, which
// billingService.createInvoice's tableIds already supports directly).
// Atomic claim — same shape as the createInvoice table claim — so a table
// that's already part of another running order can't be silently
// re-claimed.
export async function mergeTableIntoInvoice(tableId: string, invoiceId: string, userId?: string) {
  try {
    const db = getPrisma()
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return { success: false, error: { code: 'RST-040', message: 'Invoice not found.' } }
    if (invoice.status !== 'ACTIVE' || invoice.paymentStatus === 'PAID') {
      return { success: false, error: { code: 'RST-041', message: 'Can only merge into a running, unpaid order.' } }
    }

    // Real bug found 2026-09-02 (audit pass): a table with `currentInvoiceId:
    // null` used to always mean "genuinely free, nothing pending" — under
    // the deferred-billing model that's no longer true, a table can have
    // real open (un-invoiced) KOTs of its own with currentInvoiceId still
    // null. Merging such a table in here would silently orphan those KOTs:
    // they never get folded into the target invoice, and the table can no
    // longer be checked out on its own either (checkoutTable's own
    // createInvoice call would now find this table already claimed by the
    // invoice it was just merged into). No invoice-append capability
    // exists in this codebase to fold them in safely — block the merge
    // instead and tell staff to check the table out (or cancel its orders)
    // first.
    const hasOpenKot = await db.kOT.findFirst({ where: { tableId, invoiceId: null, status: { not: 'CANCELLED' } }, select: { id: true } })
    if (hasOpenKot) {
      return { success: false, error: { code: 'RST-044', message: 'This table has its own pending order — check it out (or cancel the order) before merging it into another bill.' } }
    }

    const claim = await db.restaurantTable.updateMany({
      where: { id: tableId, currentInvoiceId: null },
      data: { currentInvoiceId: invoiceId, status: 'OCCUPIED' }
    })
    if (claim.count === 0) {
      return { success: false, error: { code: 'RST-042', message: 'This table is already part of another running order (or does not exist).' } }
    }

    await logAction(userId, 'TABLE_MERGED_INTO_INVOICE', 'RestaurantTable', tableId, undefined, invoiceId)
    const table = await db.restaurantTable.findUnique({ where: { id: tableId } })
    return { success: true, data: table }
  } catch (err) {
    return { success: false, error: { code: 'RST-043', message: err instanceof Error ? err.message : 'Could not merge table.' } }
  }
}

// ─── KOT ──────────────────────────────────────────────────────────────────────

export async function listKOTs(filters?: { status?: string; tableId?: string }) {
  try {
    const db = getPrisma()
    // 2026-09-02 — items now come from the KOT's own KOTItem rows (its real
    // source of truth, present the moment an order is accepted, well
    // before any Invoice may exist) rather than invoice.items, which used
    // to require an Invoice to already exist before a KOT could show what
    // was actually ordered.
    const kots = await db.kOT.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.tableId ? { tableId: filters.tableId } : {}),
      },
      include: {
        table: { select: { tableNumber: true, tableName: true } },
        items: true,
        invoice: { select: { invoiceNumber: true, totalAmount: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    const productIds = [...new Set(kots.flatMap(k => k.items.map(i => i.productId)))]
    const products = productIds.length > 0 ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, productName: true, foodType: true } }) : []
    const infoById = new Map(products.map(p => [p.id, p]))
    const withItemNames = kots.map(k => ({
      ...k,
      items: k.items.map(i => ({ ...i, productName: infoById.get(i.productId)?.productName ?? 'Unknown item', foodType: infoById.get(i.productId)?.foodType ?? null }))
    }))
    return { success: true, data: withItemNames }
  } catch (err) {
    return { success: false, error: { code: 'RST-010', message: err instanceof Error ? err.message : 'Could not list KOTs.' } }
  }
}

// 2026-09-02 — a table's orders now accumulate across multiple rounds
// before any Invoice exists (mirrors Hotel/Lodge's HotelExtraCharge ->
// generateInvoice "accumulate then bill once" pattern) — a KOT is created
// the moment an order is accepted/sent to kitchen, independent of billing.
// `invoiceId` is only ever passed for a NON-table (counter/takeaway) sale
// that was already invoiced immediately (no running tab to defer against —
// InvoiceDetailScreen's "Send to Kitchen" button, the one caller that still
// creates a KOT from an existing invoice). A table order NEVER passes
// invoiceId here; it only ever gets one back-filled later by
// checkoutTable().
export async function createKOT(
  items: Array<{ productId: string; quantity: number; unitPrice: number; taxRate?: number }>,
  tableId?: string,
  userId?: string,
  invoiceId?: string
) {
  try {
    if (!items || items.length === 0) return { success: false, error: { code: 'RST-018', message: 'A KOT needs at least one item.' } }
    const db = getPrisma()

    if (invoiceId) {
      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
      if (!invoice) return { success: false, error: { code: 'RST-011', message: 'Invoice not found.' } }
      const existing = await db.kOT.findUnique({ where: { invoiceId } })
      if (existing) return { success: false, error: { code: 'RST-012', message: 'KOT already exists for this invoice.' } }
    }

    const kot = await db.$transaction(async (tx) => {
      if (tableId) {
        await tx.restaurantTable.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } })
      }

      // Counter/takeaway (no table) — assign the next daily "Token #N",
      // same MAX-within-today + 1 pattern as TokenQueue's own tokenNumber,
      // computed inside this same transaction so two near-simultaneous
      // counter sales can't both claim the same number.
      let tokenNumber: number | undefined
      if (!tableId) {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        const last = await tx.kOT.findFirst({
          where: { tableId: null, createdAt: { gte: todayStart, lt: todayEnd }, tokenNumber: { not: null } },
          orderBy: { tokenNumber: 'desc' },
          select: { tokenNumber: true },
        })
        tokenNumber = (last?.tokenNumber ?? 0) + 1
      }

      return tx.kOT.create({
        data: {
          invoiceId: invoiceId ?? null, tableId: tableId ?? null, status: 'PENDING', tokenNumber: tokenNumber ?? null,
          items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPriceSnapshot: i.unitPrice, taxRateSnapshot: i.taxRate ?? 0 })) }
        }
      })
    })
    await logAction(userId, 'KOT_CREATED', 'KOT', kot.id)
    return { success: true, data: kot }
  } catch (err) {
    return { success: false, error: { code: 'RST-013', message: err instanceof Error ? err.message : 'Could not create KOT.' } }
  }
}

// The one place table billing gets finalized, for orders sourced from the
// QR menu, staff "send another round" actions, or the manual dine-in
// opener alike — all of which now only ever create un-invoiced KOTs
// against a table (see createKOT above). Aggregates every un-invoiced
// KOT's items (summing duplicate products across rounds), bills them in
// ONE createInvoice call (reusing the existing atomic tableIds claim in
// billing.service.ts unchanged), then back-fills invoiceId on every
// included KOT so print/history/audit still correctly trace each ticket
// back to the final bill.
export async function checkoutTable(
  tableId: string,
  payload: { paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT'; customerId?: string },
  userId?: string
) {
  const db = getPrisma()
  try {
    const table = await db.restaurantTable.findUnique({ where: { id: tableId } })
    if (!table) return { success: false, error: { code: 'RST-050', message: 'Table not found.' } }

    const openKots = await db.kOT.findMany({ where: { tableId, invoiceId: null, status: { not: 'CANCELLED' } }, include: { items: true } })
    if (openKots.length === 0) return { success: false, error: { code: 'RST-051', message: 'This table has nothing to bill.' } }

    // Sum duplicate products across rounds into one line each — a customer
    // ordering the same dish twice across two scans shouldn't show as two
    // separate invoice lines.
    const merged = new Map<string, { productId: string; quantity: number; unitPrice: number; taxRate: number }>()
    for (const kot of openKots) {
      for (const item of kot.items) {
        const existing = merged.get(item.productId)
        if (existing) existing.quantity += item.quantity
        else merged.set(item.productId, { productId: item.productId, quantity: item.quantity, unitPrice: item.unitPriceSnapshot, taxRate: item.taxRateSnapshot })
      }
    }

    const { billingService } = await import('./billing.service')
    const invoiceResult = await billingService.createInvoice({
      customerId: payload.customerId,
      paymentMethod: payload.paymentMethod,
      items: Array.from(merged.values()).map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: 0, taxRate: i.taxRate })),
      globalDiscount: 0,
      tableIds: [tableId],
    }, userId)

    if (!invoiceResult.success || !invoiceResult.data) {
      return { success: false, error: (invoiceResult as { error?: { code: string; message: string } }).error ?? { code: 'RST-052', message: 'Could not generate the bill for this table.' } }
    }
    const invoice = invoiceResult.data as { id: string }

    await db.kOT.updateMany({ where: { id: { in: openKots.map(k => k.id) } }, data: { invoiceId: invoice.id } })
    await db.restaurantTable.update({ where: { id: tableId }, data: { checkoutRequestedAt: null } })
    await logAction(userId, 'TABLE_CHECKED_OUT', 'RestaurantTable', tableId, undefined, invoice.id)

    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    return { success: false, error: { code: 'RST-053', message: err instanceof Error ? err.message : 'Could not check out this table.' } }
  }
}

// Everything currently ordered for a table, before checkout — the "click
// table, see everything ordered" view the founder asked for. Aggregates
// un-invoiced KOTs the same way checkoutTable does, but read-only.
export async function getTableOrderSummary(tableId: string) {
  try {
    const db = getPrisma()
    const openKots = await db.kOT.findMany({
      where: { tableId, invoiceId: null, status: { not: 'CANCELLED' } },
      include: { items: true },
      orderBy: { createdAt: 'asc' }
    })
    const productIds = [...new Set(openKots.flatMap(k => k.items.map(i => i.productId)))]
    const products = productIds.length > 0 ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, productName: true } }) : []
    const nameById = new Map(products.map(p => [p.id, p.productName]))

    const merged = new Map<string, { productId: string; productName: string; quantity: number; unitPrice: number }>()
    let runningTotal = 0
    for (const kot of openKots) {
      for (const item of kot.items) {
        runningTotal += item.quantity * item.unitPriceSnapshot
        const existing = merged.get(item.productId)
        if (existing) existing.quantity += item.quantity
        else merged.set(item.productId, { productId: item.productId, productName: nameById.get(item.productId) ?? 'Unknown item', quantity: item.quantity, unitPrice: item.unitPriceSnapshot })
      }
    }

    return {
      success: true,
      data: {
        rounds: openKots.map(k => ({ kotId: k.id, status: k.status, createdAt: k.createdAt, items: k.items.map(i => ({ productId: i.productId, productName: nameById.get(i.productId) ?? 'Unknown item', quantity: i.quantity, unitPrice: i.unitPriceSnapshot })) })),
        aggregated: Array.from(merged.values()),
        estimatedTotal: roundCurrency(runningTotal),
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'RST-054', message: err instanceof Error ? err.message : 'Could not load the table order summary.' } }
  }
}

export async function updateKOTStatus(kotId: string, status: string, userId?: string) {
  try {
    const db = getPrisma()
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED']
    if (!validStatuses.includes(status)) return { success: false, error: { code: 'RST-014', message: `Invalid KOT status "${status}".` } }

    const kot = await db.kOT.findUnique({
      where: { id: kotId },
      include: { items: true }
    })
    if (!kot) return { success: false, error: { code: 'RST-015', message: 'KOT not found.' } }

    // DONE and CANCELLED are terminal states. The UI already only exposes
    // forward transitions (PENDING → IN_PROGRESS → DONE, or Cancel), but that
    // is not itself a safety guarantee — without this, a direct/malformed
    // call could take a KOT DONE → CANCELLED → DONE again and deduct the same
    // ingredients twice.
    if ((kot.status === 'DONE' || kot.status === 'CANCELLED') && status !== kot.status) {
      return { success: false, error: { code: 'RST-017', message: `Cannot change status of a ${kot.status.toLowerCase()} KOT.` } }
    }

    // When KOT is fulfilled (DONE), deduct ingredient stock — reads the
    // KOT's own item snapshot now (2026-09-02) rather than invoice.items,
    // since a table's KOTs are created well before any Invoice exists.
    if (status === 'DONE' && kot.status !== 'DONE') {
      await deductIngredients(kot.items.map(i => ({ productId: i.productId, quantity: i.quantity })), userId)
    }

    // 2026-09-02 — a table stays OCCUPIED for as long as it has a running,
    // un-checked-out tab, regardless of whether the kitchen has finished
    // cooking every round — the guests are still eating/haven't paid.
    // Table release now happens ONLY at actual payment settlement
    // (releaseTablesForInvoiceTx, triggered from checkoutTable's invoice),
    // EXCEPT one case: this specific KOT being CANCELLED with nothing else
    // left billable for the table (no other open round, nothing already
    // invoiced) — there's genuinely nothing to check out, so free it back
    // up rather than leaving it stuck OCCUPIED forever with no path to
    // AVAILABLE again.
    if (status === 'CANCELLED' && kot.tableId) {
      const table = await db.restaurantTable.findUnique({ where: { id: kot.tableId }, select: { currentInvoiceId: true } })
      const hasOtherBillable = await db.kOT.count({
        where: { tableId: kot.tableId, invoiceId: null, status: { not: 'CANCELLED' }, id: { not: kotId } }
      })
      if (hasOtherBillable === 0 && !table?.currentInvoiceId) {
        await db.restaurantTable.update({ where: { id: kot.tableId }, data: { status: 'AVAILABLE' } })
      }
    }

    const updated = await db.kOT.update({ where: { id: kotId }, data: { status } })
    await logAction(userId, 'KOT_STATUS_UPDATED', 'KOT', kotId, kot.status, status)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'RST-016', message: err instanceof Error ? err.message : 'Could not update KOT status.' } }
  }
}

// 2026-09-04 — Waiter view. "DONE" only ever meant "ready in the kitchen" —
// there was no way to know whether a ready ticket had actually reached the
// table yet. Deliberately requires DONE first (a waiter can't "serve"
// something that isn't ready) and is itself a one-way transition — no
// unmarking, matching updateKOTStatus's own DONE/CANCELLED-are-terminal
// reasoning just above.
export async function markKOTServed(kotId: string, userId?: string) {
  try {
    const db = getPrisma()
    const kot = await db.kOT.findUnique({ where: { id: kotId }, select: { status: true, servedAt: true } })
    if (!kot) return { success: false, error: { code: 'RST-060', message: 'KOT not found.' } }
    if (kot.status !== 'DONE') return { success: false, error: { code: 'RST-061', message: 'Only a ready (DONE) ticket can be marked served.' } }
    if (kot.servedAt) return { success: true, data: { id: kotId, servedAt: kot.servedAt } }
    const updated = await db.kOT.update({ where: { id: kotId }, data: { servedAt: new Date() } })
    await logAction(userId, 'KOT_MARKED_SERVED', 'KOT', kotId)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'RST-062', message: err instanceof Error ? err.message : 'Could not mark ticket served.' } }
  }
}

// 2026-09-04 — Waiter view. A waiter's own filtered slice of listKOTs():
// only tickets belonging to a table currently assigned to them
// (RestaurantTable.waiterId), so scanning their personal QR shows exactly
// their section, not the whole restaurant's queue. Excludes CANCELLED
// (nothing for a waiter to act on) and any ticket already served (the
// point of servedAt is to let a delivered ticket drop off this list).
export async function listKOTsForWaiter(waiterId: string) {
  try {
    const db = getPrisma()
    const kots = await db.kOT.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS', 'DONE'] },
        servedAt: null,
        table: { waiterId }
      },
      include: {
        table: { select: { tableNumber: true, tableName: true } },
        items: true
      },
      orderBy: { createdAt: 'asc' }
    })
    const productIds = [...new Set(kots.flatMap(k => k.items.map(i => i.productId)))]
    const products = productIds.length > 0 ? await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, productName: true, foodType: true } }) : []
    const infoById = new Map(products.map(p => [p.id, p]))
    const withItemNames = kots.map(k => ({
      ...k,
      items: k.items.map(i => ({ ...i, productName: infoById.get(i.productId)?.productName ?? 'Unknown item', foodType: infoById.get(i.productId)?.foodType ?? null }))
    }))
    return { success: true, data: withItemNames }
  } catch (err) {
    return { success: false, error: { code: 'RST-063', message: err instanceof Error ? err.message : 'Could not load your tables.' } }
  }
}

// 2026-09-04 — Waiter view "take order" table picker. Every table currently
// assigned to this waiter, regardless of whether it has an outstanding KOT
// right now — a waiter still needs to see (and order for) an OCCUPIED table
// with nothing currently cooking, not just tables already in listKOTsForWaiter.
export async function listWaiterTables(waiterId: string) {
  try {
    const db = getPrisma()
    const tables = await db.restaurantTable.findMany({
      where: { waiterId },
      select: { id: true, tableNumber: true, tableName: true, status: true },
      orderBy: { tableNumber: 'asc' }
    })
    return { success: true, data: tables }
  } catch (err) {
    return { success: false, error: { code: 'RST-064', message: err instanceof Error ? err.message : 'Could not load your tables.' } }
  }
}

// 2026-09-04 — Waiter view "take order" direct-to-kitchen flow. Mirrors
// sendTableOrder's own "staff order, no approval step needed" reasoning
// (unlike a customer's own QR self-order, which always lands as a
// TableOrderRequest for staff to accept first) — a waiter physically at the
// table taking the order down is already the human-in-the-loop, so this
// goes straight to createKOT. The one thing sendTableOrder does NOT itself
// check that this needs to: the tableId must actually belong to THIS
// waiter — never trust the client on that, same reasoning markKOTServed's
// caller-side ownership check follows.
export async function createWaiterTableOrder(
  waiterId: string,
  tableId: string,
  items: Array<{ productId: string; quantity: number }>,
  userId?: string
) {
  try {
    const db = getPrisma()
    const employee = await db.employee.findUnique({ where: { id: waiterId }, select: { id: true, isActive: true } })
    if (!employee || !employee.isActive) return { success: false, error: { code: 'RST-065', message: 'Waiter not found or inactive.' } }

    const table = await db.restaurantTable.findUnique({ where: { id: tableId }, select: { id: true, waiterId: true } })
    if (!table) return { success: false, error: { code: 'RST-066', message: 'Table not found.' } }
    if (table.waiterId !== waiterId) return { success: false, error: { code: 'RST-067', message: 'This table is not assigned to you.' } }

    if (!Array.isArray(items) || items.length === 0) return { success: false, error: { code: 'RST-068', message: 'Your order is empty.' } }
    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return { success: false, error: { code: 'RST-069', message: 'Invalid item in order.' } }
      }
    }

    // Never trust price/tax from the client — resolve fresh from the real
    // Product record, same as createOrderRequest's own reasoning for the
    // customer-facing QR flow.
    const productIds = items.map(i => i.productId)
    const validProducts = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, sellingPrice: true, taxRate: true }
    })
    const infoById = new Map(validProducts.map(p => [p.id, p]))
    if (items.some(i => !infoById.has(i.productId))) {
      return { success: false, error: { code: 'RST-070', message: 'One or more items are no longer available.' } }
    }
    const resolvedItems = items.map(i => {
      const info = infoById.get(i.productId)!
      return { productId: i.productId, quantity: i.quantity, unitPrice: info.sellingPrice, taxRate: info.taxRate }
    })

    return createKOT(resolvedItems, tableId, userId)
  } catch (err) {
    return { success: false, error: { code: 'RST-071', message: err instanceof Error ? err.message : 'Could not send the order to the kitchen.' } }
  }
}

// report.service.ts's generateFoodCostReport() identifies KOT-driven ingredient
// deductions by matching this exact remarks prefix against InventoryMovement
// records — exported (rather than duplicated as a literal in both files) so a
// future wording change can't silently break the report with zero compile-time
// warning or runtime error.
export const INGREDIENT_DEDUCTION_REMARKS_PREFIX = 'Ingredient deduction for KOT'

// Deduct ingredient stock when KOT is fulfilled. Exported (2026-09 §12) so
// Bakery — which has ingredient_tracking/recipes but deliberately no KOT
// (a bakery counter sale isn't a dine-in ticket flow) — can call this same,
// proven deduction logic directly at invoice-creation time instead of on a
// KOT status transition. Reuses the exact same remarks prefix, so both
// triggers are picked up identically by generateFoodCostReport/
// generateDishContributionMarginReport with no change to either.
export async function deductIngredients(
  invoiceItems: Array<{ productId: string; quantity: number }>,
  userId?: string
): Promise<void> {
  const db = getPrisma()
  for (const item of invoiceItems) {
    // Phase 67 §9.1 — Restaurant's "Combo/thali auto-pricing" signature win
    // surfaced a real, previously-undisclosed gap: a combo/thali is a kit
    // (Phase 64), and a kit has no Recipe of its own — recipes are per-dish
    // (e.g. "Butter Chicken" has one, a 3-dish thali kit does not). Selling
    // a combo already correctly deducts each dish's own top-level stock
    // (billing.service.ts's explodeKitComponentsTx, inside the invoice
    // transaction), but this function used to look up a Recipe keyed to
    // the combo's OWN productId and silently find nothing — skipping
    // ingredient-level deduction for every dish inside the combo. Expand
    // kit lines into their real component dishes first; a non-kit item has
    // zero KitComponent rows, so this falls through to the original
    // single-item behavior unchanged for the overwhelmingly common case.
    const kitComponents = await db.kitComponent.findMany({ where: { kitProductId: item.productId } })
    const resolvedItems = kitComponents.length > 0
      ? kitComponents.map(c => ({ productId: c.componentProductId, quantity: c.quantity * item.quantity }))
      : [item]

    for (const resolved of resolvedItems) {
      const recipe = await db.recipe.findUnique({
        where: { productId: resolved.productId },
        include: { items: true }
      })
      if (!recipe) continue

      for (const ri of recipe.items) {
        const needed = ri.quantity * resolved.quantity
        try {
          const inv = await db.inventory.findUnique({ where: { productId: ri.ingredientProductId } })
          if (!inv) continue
          const newQty = Math.max(0, inv.quantity - needed)
          // adjustStock expects new absolute quantity; movement created with negative delta for food cost report
          await inventoryService.adjustStock({
            productId: ri.ingredientProductId,
            quantity: newQty,
            reason: `${INGREDIENT_DEDUCTION_REMARKS_PREFIX} — recipe: ${recipe.recipeName}`
          }, userId)
        } catch (err) {
          // Do not abort KOT fulfillment if an ingredient stock adjustment
          // fails — but a swallowed failure here previously left inventory
          // silently wrong with zero trace. Surface it: log to console, record
          // an audit entry, and raise a visible notification so staff know
          // stock needs a manual recount for this ingredient.
          const message = err instanceof Error ? err.message : 'Unknown error'
          console.error(`[Restaurant] Ingredient deduction failed for recipe "${recipe.recipeName}" (ingredient ${ri.ingredientProductId}):`, message)
          await logAction(userId, 'INGREDIENT_DEDUCTION_FAILED', 'Inventory', ri.ingredientProductId, undefined, message).catch(() => {})
          await createNotification({
            title: 'Ingredient stock not deducted',
            message: `Recipe "${recipe.recipeName}" fulfilled, but stock for one ingredient could not be updated (${message}). Recount this ingredient's stock manually.`,
            notificationType: 'WARNING'
          }).catch(() => {})
        }
      }
    }
  }
}

// Phase 67 §9.1 item — Restaurant's "Dish-wise contribution margin report"
// signature win. Resolves each dish's THEORETICAL per-unit recipe cost (the
// standard "menu engineering" cost — recipe formula × ingredient cost),
// shared with deductIngredients()'s own kit-expansion so a combo/thali's
// margin correctly reflects the sum of its real component dishes' recipes,
// not the combo's own (nonexistent) recipe.
//
// Deliberately distinct from generateFoodCostReport() (report.service.ts),
// which totals ACTUAL ingredient consumption from InventoryMovement rows —
// that answers "how much did we really spend on food this period," while
// this answers "what should each dish be earning per unit sold," a
// per-DISH margin question the aggregate movement log can't answer since a
// movement's remarks carry only a recipe name, not which sale caused it.
// Products with no recipe configured (recipes are optional, see the
// Restaurant Manual chapter) simply cost 0 here — an honest "no ingredient
// data" rather than a fabricated estimate.
export async function getDishIngredientCostsBatch(productIds: string[]): Promise<Map<string, number>> {
  const db = getPrisma()
  const uniqueIds = [...new Set(productIds)]
  const result = new Map<string, number>()
  if (uniqueIds.length === 0) return result

  const kitComponents = await db.kitComponent.findMany({ where: { kitProductId: { in: uniqueIds } } })
  const componentsByKit = new Map<string, { componentProductId: string; quantity: number }[]>()
  for (const kc of kitComponents) {
    const arr = componentsByKit.get(kc.kitProductId) ?? []
    arr.push({ componentProductId: kc.componentProductId, quantity: kc.quantity })
    componentsByKit.set(kc.kitProductId, arr)
  }

  // Every distinct dish a recipe might be needed for: the product itself
  // (non-kit case) plus every kit's real component dishes.
  const recipeLookupIds = [...new Set([...uniqueIds, ...kitComponents.map(kc => kc.componentProductId)])]
  const recipes = await db.recipe.findMany({
    where: { productId: { in: recipeLookupIds } },
    include: { items: true }
  })
  const recipeByProduct = new Map(recipes.map(r => [r.productId, r]))

  const ingredientIds = [...new Set(recipes.flatMap(r => r.items.map(i => i.ingredientProductId)))]
  const ingredientCosts = await getProductCostsBatch(ingredientIds)

  function recipeCostPerUnit(productId: string): number {
    const recipe = recipeByProduct.get(productId)
    if (!recipe) return 0
    return roundCurrency(recipe.items.reduce((sum, ri) => sum + ri.quantity * (ingredientCosts.get(ri.ingredientProductId) ?? 0), 0))
  }

  for (const productId of uniqueIds) {
    const components = componentsByKit.get(productId)
    if (components && components.length > 0) {
      result.set(productId, roundCurrency(components.reduce((sum, c) => sum + c.quantity * recipeCostPerUnit(c.componentProductId), 0)))
    } else {
      result.set(productId, recipeCostPerUnit(productId))
    }
  }

  return result
}

// Phase 67 §9.1 item — Restaurant's "Recipe-vs-actual waste variance"
// signature win. The RECIPE-IMPLIED side of the comparison: given a set of
// dish sales, how much of each ingredient the recipes SAY should have been
// consumed — the same kit-expansion as getDishIngredientCostsBatch above
// (and deductIngredients()'s own original), but aggregating ingredient
// QUANTITY across every dish sold, not cost per dish. Report-side pairs
// this with the ACTUAL quantity drawn down (from the same InventoryMovement
// rows generateFoodCostReport already reads) to surface real variance —
// portion drift, spillage, or theft the recipe alone can't reveal.
export async function getRecipeImpliedIngredientUsageBatch(
  dishSales: { productId: string; quantity: number }[]
): Promise<Map<string, number>> {
  const db = getPrisma()
  const uniqueIds = [...new Set(dishSales.map(d => d.productId))]
  const result = new Map<string, number>()
  if (uniqueIds.length === 0) return result

  const kitComponents = await db.kitComponent.findMany({ where: { kitProductId: { in: uniqueIds } } })
  const componentsByKit = new Map<string, { componentProductId: string; quantity: number }[]>()
  for (const kc of kitComponents) {
    const arr = componentsByKit.get(kc.kitProductId) ?? []
    arr.push({ componentProductId: kc.componentProductId, quantity: kc.quantity })
    componentsByKit.set(kc.kitProductId, arr)
  }

  const recipeLookupIds = [...new Set([...uniqueIds, ...kitComponents.map(kc => kc.componentProductId)])]
  const recipes = await db.recipe.findMany({ where: { productId: { in: recipeLookupIds } }, include: { items: true } })
  const recipeByProduct = new Map(recipes.map(r => [r.productId, r]))

  function addUsage(productId: string, multiplier: number) {
    const recipe = recipeByProduct.get(productId)
    if (!recipe) return
    for (const ri of recipe.items) {
      result.set(ri.ingredientProductId, (result.get(ri.ingredientProductId) ?? 0) + ri.quantity * multiplier)
    }
  }

  for (const sale of dishSales) {
    const components = componentsByKit.get(sale.productId)
    if (components && components.length > 0) {
      for (const c of components) addUsage(c.componentProductId, c.quantity * sale.quantity)
    } else {
      addUsage(sale.productId, sale.quantity)
    }
  }

  return result
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export async function listRecipes() {
  try {
    const db = getPrisma()
    const recipes = await db.recipe.findMany({
      include: {
        items: {
          include: { ingredient: { select: { productName: true, unit: true } } }
        }
      },
      orderBy: { recipeName: 'asc' }
    })

    // Recipe.productId has no Prisma relation to Product (plain column, no
    // @relation) — fetch names for the menu products involved in one batched
    // query rather than adding a schema relation just for a display label.
    const products = await db.product.findMany({
      where: { id: { in: recipes.map(r => r.productId) } },
      select: { id: true, productName: true }
    })
    const productNameById = new Map(products.map(p => [p.id, p.productName]))

    const withProductName = recipes.map(r => ({
      ...r,
      product: { productName: productNameById.get(r.productId) ?? '(deleted product)' }
    }))

    return { success: true, data: withProductName }
  } catch (err) {
    return { success: false, error: { code: 'RST-020', message: err instanceof Error ? err.message : 'Could not list recipes.' } }
  }
}

export async function getRecipe(productId: string) {
  try {
    const db = getPrisma()
    const recipe = await db.recipe.findUnique({
      where: { productId },
      include: {
        items: {
          include: { ingredient: { select: { id: true, productName: true, unit: true } } }
        }
      }
    })
    return { success: true, data: recipe ?? null }
  } catch (err) {
    return { success: false, error: { code: 'RST-021', message: err instanceof Error ? err.message : 'Could not get recipe.' } }
  }
}

export async function upsertRecipe(
  productId: string,
  recipeName: string,
  items: Array<{ ingredientProductId: string; quantity: number }>,
  userId?: string
) {
  try {
    const db = getPrisma()

    if (!recipeName.trim()) return { success: false, error: { code: 'RST-022', message: 'Recipe name is required.' } }
    if (!items.length) return { success: false, error: { code: 'RST-023', message: 'At least one ingredient is required.' } }
    for (const item of items) {
      if (item.quantity <= 0) return { success: false, error: { code: 'RST-024', message: 'Ingredient quantity must be greater than zero.' } }
    }
    // Each ingredient must appear at most once — deductIngredients() processes
    // every item row independently, so a duplicated ingredient would silently
    // deduct stock multiple times per KOT instead of once at the combined
    // quantity.
    const seenIngredients = new Set<string>()
    for (const item of items) {
      if (seenIngredients.has(item.ingredientProductId)) {
        return { success: false, error: { code: 'RST-027', message: 'Each ingredient can only appear once in a recipe — combine duplicate rows into a single quantity instead.' } }
      }
      seenIngredients.add(item.ingredientProductId)
    }

    const existing = await db.recipe.findUnique({ where: { productId } })

    let recipe
    if (existing) {
      // Delete existing items and re-create (simplest safe update)
      await db.recipeItem.deleteMany({ where: { recipeId: existing.id } })
      recipe = await db.recipe.update({
        where: { id: existing.id },
        data: {
          recipeName,
          items: { create: items }
        },
        include: { items: { include: { ingredient: { select: { productName: true, unit: true } } } } }
      })
      await logAction(userId, 'RECIPE_UPDATED', 'Recipe', recipe.id)
    } else {
      recipe = await db.recipe.create({
        data: { productId, recipeName, items: { create: items } },
        include: { items: { include: { ingredient: { select: { productName: true, unit: true } } } } }
      })
      await logAction(userId, 'RECIPE_CREATED', 'Recipe', recipe.id)
    }

    return { success: true, data: recipe }
  } catch (err) {
    return { success: false, error: { code: 'RST-025', message: err instanceof Error ? err.message : 'Could not save recipe.' } }
  }
}

export async function deleteRecipe(recipeId: string, userId?: string) {
  try {
    const db = getPrisma()
    await db.recipe.delete({ where: { id: recipeId } })
    await logAction(userId, 'RECIPE_DELETED', 'Recipe', recipeId)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RST-026', message: err instanceof Error ? err.message : 'Could not delete recipe.' } }
  }
}

// ─── Daily Closing (GAP R22) ──────────────────────────────────────────────────

export async function getDailyClosingSummary(date?: string) {
  try {
    const db = getPrisma()
    // Real bug found 2026-07-23: `date ? new Date(date) : new Date()`
    // followed by setHours(0,0,0,0) parses an explicit "YYYY-MM-DD" input
    // as UTC midnight FIRST, then re-anchors it to LOCAL midnight of
    // whatever calendar day that UTC instant falls on — one day EARLIER
    // than intended in any negative-UTC-offset timezone (same root cause
    // already fixed in cash-close.service.ts's getDrawerSummary). The
    // `new Date()` "today" branch is unaffected (already real local "now").
    const dayStart = date ? parseLocalDateStart(date) : new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    // KOTs completed today
    const kots = await db.kOT.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      select: { status: true, id: true }
    })

    const kotsByStatus = {
      PENDING: kots.filter(k => k.status === 'PENDING').length,
      IN_PROGRESS: kots.filter(k => k.status === 'IN_PROGRESS').length,
      DONE: kots.filter(k => k.status === 'DONE').length,
      CANCELLED: kots.filter(k => k.status === 'CANCELLED').length,
    }

    // Revenue from invoices today
    const invoices = await db.invoice.findMany({
      where: { invoiceDate: { gte: dayStart, lte: dayEnd }, status: 'FINAL' },
      select: { totalAmount: true, paidAmount: true, paymentStatus: true }
    })

    const revenue = {
      total: invoices.reduce((s, i) => s + i.totalAmount, 0),
      collected: invoices.reduce((s, i) => s + i.paidAmount, 0),
      invoiceCount: invoices.length,
      pending: invoices.filter(i => i.paymentStatus !== 'PAID').length
    }

    // Tables currently occupied
    const occupiedTables = await db.restaurantTable.count({ where: { status: 'OCCUPIED' } })

    return {
      success: true,
      data: {
        date: toLocalISODate(dayStart),
        kots: kotsByStatus,
        revenue,
        openTables: occupiedTables
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'RST-030', message: err instanceof Error ? err.message : 'Could not fetch daily summary.' } }
  }
}

export async function performDailyClose(userId?: string) {
  try {
    const db = getPrisma()

    // Mark all DONE KOTs as closed (already counted in revenue)
    // Reset table statuses to AVAILABLE (close the shift)
    const openTables = await db.restaurantTable.findMany({ where: { status: 'OCCUPIED' } })

    // REAL BUG found+fixed 2026-07-30: this only reset `status`, never
    // `currentInvoiceId` — every table-claiming path (createInvoice's
    // tableClaim, mergeTableIntoInvoice) gates on currentInvoiceId being
    // null, not on status. A table left with a stale currentInvoiceId
    // showed AVAILABLE in the UI but silently failed to be re-seated
    // ("already part of another running order") until staff manually found
    // and settled the orphaned invoice. Clearing both together matches
    // every other release path in this file (releaseTablesForInvoiceTx,
    // mergeTableIntoInvoice's claim guard).
    // Real bug found 2026-09-02 (audit pass, post-deferred-billing rework):
    // a table can now be OCCUPIED with real, un-invoiced KOTs sitting on it
    // — billing only happens at explicit checkout under the new model, so
    // this is the normal state of a table mid-service, not an edge case.
    // Force-freeing it here (the pre-rework behavior, when every occupied
    // table always had a currentInvoiceId by construction) would silently
    // orphan that food: the table would show AVAILABLE, and checkoutTable()
    // for the NEXT party seated there would fold the PREVIOUS party's
    // unpaid order into their bill (its query only cares about tableId +
    // invoiceId:null, not "which seating"). Skip freeing any table with an
    // open KOT — staff must check it out first; everything else closes as
    // before.
    let skippedUnsettledTables = 0
    for (const table of openTables) {
      const hasOpenKot = await db.kOT.findFirst({ where: { tableId: table.id, invoiceId: null, status: { not: 'CANCELLED' } }, select: { id: true } })
      if (hasOpenKot) { skippedUnsettledTables++; continue }
      await db.restaurantTable.update({ where: { id: table.id }, data: { status: 'AVAILABLE', currentInvoiceId: null } })
    }

    const summary = await getDailyClosingSummary()
    const summaryData = summary.data ? { ...summary.data, skippedUnsettledTables } : summary.data

    await logAction(userId, 'RESTAURANT_DAILY_CLOSE', 'Restaurant', undefined, undefined, summaryData)

    return { success: true, data: summaryData }
  } catch (err) {
    return { success: false, error: { code: 'RST-031', message: err instanceof Error ? err.message : 'Daily close failed.' } }
  }
}
