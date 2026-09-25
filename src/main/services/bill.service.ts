import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { supplierLedgerService } from './supplier-ledger.service'
import { calculateLineTotal, sumCurrency, roundCurrency } from './currency.service'
import { computeDocumentTotals, sumMoney, unitAmount } from '../../shared/utils/money'
import { getBusinessCurrencyDecimals } from './settings.service'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { generateSequenceNumber } from './sequence.service'
import { assertNotLocked, assertNotLockedOrThrow } from './transaction-lock.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService, reverseEntryBySourceTx } from './journal-entry.service'
import { allocateLandedCostAcrossLines } from './landed-cost.service'
import { ServiceError } from '../errors/service-error'
import { isInputTaxClaimable, loadPurchaseAccounts, purchaseJournalLines } from './purchase-tax-journal.util'
import { resolveDocumentGstType, lineTaxCategories } from './gst-type.util'
import type { CreateBillPayload } from '../validation/bill.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Phase 62 — GL auto-posting, same simplification as billing.service.ts's
// own postInvoiceJournalEntry: gross treatment (no separate GST input-
// credit line), COGS/inventory posting excluded (Bill never touches
// inventory — see this file's own header comment — so there's no cost side
// to post here at all, unlike a sale).
//
// Reverse Charge Mechanism (added same phase): under RCM the supplier does
// not charge GST at all — `bill.totalAmount` is already computed
// tax-exclusive for an RCM bill (see createBill below), so AP only ever
// reflects what's actually payable to the supplier. The tax the business
// self-assesses is a real liability owed directly to the government, not
// part of what the supplier is owed — posted as its own Tax Payable credit
// rather than silently folded into AP. Total debit (expense recognized)
// still equals totalAmount + taxAmount either way, so this balances by
// construction.
async function postBillJournalEntry(tx: TxClient, bill: { id: string; billNumber: string; totalAmount: number; taxAmount: number; isReverseCharge: boolean; costCentreId?: string | null }): Promise<void> {
  if (bill.totalAmount + (bill.isReverseCharge ? bill.taxAmount : 0) <= 0) return
  const claimable = await isInputTaxClaimable(tx)
  const accounts = await loadPurchaseAccounts(tx, bill.isReverseCharge && bill.taxAmount > 0, claimable && bill.taxAmount > 0)
  await journalEntryService.postSystemEntry(tx, {
    sourceType: 'BILL', sourceId: bill.id, narration: `Bill ${bill.billNumber}`,
    lines: purchaseJournalLines({ total: bill.totalAmount, tax: bill.taxAmount, isReverseCharge: bill.isReverseCharge, claimable, accounts, costCentreId: bill.costCentreId ?? null })
  })
}

// Same collision/race class already fixed for customerCode/supplierCode/
// poNumber — see purchase-order.service.ts's generatePONumber for the full
// reasoning. Must be called with a tx from inside the same $transaction that
// performs the create.
// Reverses everything a bill posted (supplier-ledger debit, journal entry,
// cost history) and marks it VOID. Shared by voidBill and by editBill (which
// replaces a bill atomically), so both stay identical.
async function reverseBillPostings(tx: TxClient, id: string, reason: string, userId?: string, renameTo?: string) {
  const bill = await tx.bill.findUnique({ where: { id } })
  if (!bill) throw new ServiceError('BILL-002', 'Bill not found.')
  if (bill.status === 'VOID') throw new ServiceError('BILL-003', 'This bill is already void.')
  await assertNotLockedOrThrow(tx, bill.billDate)
  if (bill.paidAmount > 0) {
    throw new ServiceError('BILL-004', 'Cannot void a bill with payments recorded. Reverse the payments first.')
  }

  // Only credit back a debit that really exists (a PO-linked bill raised
  // against an already-received PO never posted one).
  const originalDebit = await tx.supplierLedger.findFirst({ where: { referenceType: 'BILL', referenceId: bill.id } })
  if (originalDebit) {
    await supplierLedgerService.addEntry({
      supplierId: bill.supplierId,
      referenceType: 'BILL_VOID',
      referenceId: bill.id,
      debitAmount: 0,
      creditAmount: bill.totalAmount,
      remarks: `Void: ${reason} (Bill ${bill.billNumber})`
    }, tx)
  }

  await reverseEntryBySourceTx(tx, 'BILL', bill.id, `Bill ${bill.billNumber} voided: ${reason}`, userId)
  // A voided bill's purchase cost must not keep feeding cost history.
  await tx.productCostHistory.deleteMany({ where: { sourceType: 'BILL', sourceId: bill.id } })

  const noteText = bill.notes ? `${bill.notes}\nVoided: ${reason}` : `Voided: ${reason}`
  const updated = await tx.bill.update({
    where: { id },
    data: { status: 'VOID', balanceAmount: 0, notes: noteText, ...(renameTo ? { billNumber: renameTo } : {}) }
  })
  return { before: bill, after: updated }
}

async function generateBillNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'bill_number_sequence', 'BILL', 5,
    async () => {
      const rows = await tx.bill.findMany({ select: { billNumber: true } })
      let max = 0
      for (const row of rows) {
        const n = parseInt(row.billNumber.replace('BILL-', ''), 10)
        if (Number.isFinite(n) && n > max) max = n
      }
      return max
    }
  )
}

export const billService = {
  async createBill(payload: CreateBillPayload, userId?: string, opts?: { replaceBillId?: string }) {
    const db = getPrisma()

    const supplier = await db.supplier.findUnique({ where: { id: payload.supplierId } })
    if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
    if (!supplier.isActive) return { success: false, error: { code: 'SUP-004', message: 'Cannot bill an archived supplier.' } }

    let linkedPoIncludesTax = false
    let linkedPoGstType: string | undefined
    if (payload.purchaseOrderId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: payload.purchaseOrderId } })
      linkedPoIncludesTax = po?.pricesIncludeTax === true
      linkedPoGstType = po?.gstType
      if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }
      if (po.supplierId !== payload.supplierId) {
        return { success: false, error: { code: 'BILL-001', message: 'Purchase order belongs to a different supplier.' } }
      }
    }

    // Phase 61 — same product-vs-service-line shape as PO items. A Bill is a
    // pure AP/financial record (never touches inventory — receiving is
    // PurchaseOrder.receive/GRN's job), so no productType restriction is
    // needed for informational cost tracking.
    for (const item of payload.items) {
      if (item.productId) {
        const product = await db.product.findUnique({ where: { id: item.productId } })
        if (!product) return { success: false, error: { code: 'PRD-001', message: 'Product not found.' } }
      } else if (item.serviceCategoryId) {
        const cat = await db.expenseCategory.findUnique({ where: { id: item.serviceCategoryId } })
        if (!cat) return { success: false, error: { code: 'EXP-002', message: 'Expense category not found.' } }
      }
    }

    const pricesIncludeTax = payload.pricesIncludeTax ?? linkedPoIncludesTax
    // Presentation of the tax only: the chosen one, else the linked PO's, else from the supplier's state.
    const gstType = await resolveDocumentGstType(payload.gstType ?? linkedPoGstType, supplier.state)
    const lineCategories = await lineTaxCategories(payload.items.map(i => ({ productId: i.productId, taxRate: i.taxRate })))
    const decimals = await getBusinessCurrencyDecimals()
    const billTotals = computeDocumentTotals(
      payload.items.map(i => ({ quantity: i.quantity, unitPrice: i.unitCost, discountAmount: i.discountAmount ?? 0, taxRate: i.taxRate ?? 0 })),
      { decimals, excludeTaxFromTotal: payload.isReverseCharge === true, pricesIncludeTax }
    )
    const lineRows = payload.items.map((item, idx) => {
      const l = billTotals.lines[idx]
      return { item, discountAmount: l.discountAmount, taxAmount: l.tax, lineTotal: l.total }
    })
    const { subtotal, discountAmount, taxAmount } = billTotals
    // Reverse Charge Mechanism: under RCM the supplier's own invoice does not
    // include GST at all — the business self-assesses and owes that tax
    // directly to the government, not to the supplier. totalAmount (what's
    // actually payable to the supplier, and what AP/the supplier ledger
    // track) must exclude it; taxAmount is still computed and stored
    // separately for the self-assessed liability posting and GSTR-3B
    // Table 3.1(d) reporting.
    const totalAmount = billTotals.totalAmount

    const supplierInvoiceNumber = payload.supplierInvoiceNumber?.trim() || null
    if (supplierInvoiceNumber) {
      const duplicate = await db.bill.findFirst({
        where: {
          supplierId: payload.supplierId,
          supplierInvoiceNumber: { equals: supplierInvoiceNumber },
          status: { not: 'VOID' },
          ...(opts?.replaceBillId ? { id: { not: opts.replaceBillId } } : {})
        },
        select: { billNumber: true }
      })
      if (duplicate) return { success: false, error: { code: 'BILL-006', message: `This supplier invoice is already entered as ${duplicate.billNumber}.` } }
    }

    // Phase 62 — Transaction Locking.
    const resolvedBillDate = payload.billDate ? parseLocalDateStart(payload.billDate) : new Date()
    const lockError = await assertNotLocked(resolvedBillDate)
    if (lockError) return lockError

    // Phase 62 — MSME Samadhaan Act: a bill from an MSME-registered supplier
    // gets a statutory 45-day due date by default (from the bill date) if no
    // due date was explicitly set — an explicit dueDate always wins, since a
    // shorter buyer-agreed term is still valid, only the ABSENCE of one
    // should fall back to the statutory default rather than staying null.
    let resolvedDueDate: Date | null = payload.dueDate ? parseLocalDateStart(payload.dueDate) : null
    if (!resolvedDueDate && supplier.isMsmeRegistered) {
      resolvedDueDate = new Date(resolvedBillDate.getTime() + 45 * 24 * 60 * 60 * 1000)
    }

    try {
      const bill = await db.$transaction(async (tx) => {
        let billNumber: string
        if (opts?.replaceBillId) {
          // Edit = void the old copy (reversing every posting) and re-create it
          // under the SAME bill number, all in this one transaction. The old copy
          // stays visible as "<number>-R<n>" (VOID) for the audit trail.
          const old = await tx.bill.findUnique({ where: { id: opts.replaceBillId } })
          if (!old) throw new ServiceError('BILL-002', 'Bill not found.')
          if (old.status !== 'OPEN') throw new ServiceError('BILL-005', 'Only an open bill with no payments can be edited.')
          const revisions = await tx.bill.count({ where: { billNumber: { startsWith: `${old.billNumber}-R` } } })
          await reverseBillPostings(tx, old.id, 'Edited', userId, `${old.billNumber}-R${revisions + 1}`)
          billNumber = old.billNumber
        } else {
          billNumber = await generateBillNumber(tx)
        }
        const created = await tx.bill.create({
          data: {
            billNumber,
            supplierId: payload.supplierId,
            purchaseOrderId: payload.purchaseOrderId || null,
            billDate: resolvedBillDate,
            supplierInvoiceNumber,
            supplierInvoiceDate: payload.supplierInvoiceDate ? parseLocalDateStart(payload.supplierInvoiceDate) : null,
            dueDate: resolvedDueDate,
            status: 'OPEN',
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount,
            pricesIncludeTax,
            gstType,
            paidAmount: 0,
            balanceAmount: totalAmount,
            isReverseCharge: payload.isReverseCharge,
            // Phase 65 — Reporting Tags / Cost & Profit Centres.
            costCentreId: payload.costCentreId || null,
            notes: payload.notes || null,
            // 2026-09 — foreign-currency overlay, same "both fields required
            // together" reasoning as billing.service.ts's own createInvoice.
            foreignCurrencyCode: (payload.foreignCurrencyCode && payload.foreignExchangeRate) ? payload.foreignCurrencyCode : null,
            foreignExchangeRate: (payload.foreignCurrencyCode && payload.foreignExchangeRate) ? payload.foreignExchangeRate : null,
            foreignTotalAmount: (payload.foreignCurrencyCode && payload.foreignExchangeRate) ? roundCurrency(totalAmount / payload.foreignExchangeRate) : null,
            createdById: userId ?? null,
            items: {
              create: lineRows.map(({ item, discountAmount: lineDiscount, taxAmount: lineTax, lineTotal }, rowIdx) => ({
                productId: item.productId || null,
                serviceDescription: item.serviceDescription || null,
                serviceCategoryId: item.serviceCategoryId || null,
                quantity: item.quantity,
                unitCost: item.unitCost,
                discountAmount: lineDiscount,
                taxRate: item.taxRate ?? 0,
                taxCategory: lineCategories[rowIdx],
                taxAmount: lineTax,
                total: lineTotal
              }))
            }
          },
          include: {
            supplier: { select: { id: true, supplierName: true, supplierCode: true } },
            items: {
              include: {
                product: { select: { id: true, productName: true, sku: true, unit: true } },
                serviceCategory: { select: { id: true, categoryName: true } }
              }
            }
          }
        })

        // Phase 64 — landed cost, entered inline (see bill.validation.ts's
        // own comment for why a Bill can't add it after the fact the way a
        // PO can). Computed once per product line here, then folded into
        // that line's own ProductCostHistory unitCost below — never touches
        // Inventory (Bill still doesn't affect stock, unchanged).
        const productItems = created.items.filter(row => row.productId)
        // Tax paid on a purchase is not part of stock cost: an inclusive bill's cost basis per unit is the
        // stored line taxable value (total - tax) / quantity, never the entered tax-inclusive unitCost.
        const stockUnitCost = (row: { quantity: number; unitCost: number; total: number; taxAmount: number }) =>
          pricesIncludeTax && row.quantity > 0 ? unitAmount(sumMoney([row.total, -row.taxAmount], 3), row.quantity) : row.unitCost
        const landedCostPerItemId = new Map<string, number>()
        if (payload.landedCosts && payload.landedCosts.length > 0 && productItems.length > 0) {
          const perLineTotal = new Array(productItems.length).fill(0)
          for (const lc of payload.landedCosts) {
            const shares = allocateLandedCostAcrossLines(
              lc.amount, lc.allocationMethod,
              productItems.map(row => ({ value: row.quantity * stockUnitCost(row), quantity: row.quantity }))
            )
            shares.forEach((s, i) => { perLineTotal[i] += s })
            await tx.landedCostAllocation.create({
              data: { billId: created.id, costType: lc.costType, amount: lc.amount, allocationMethod: lc.allocationMethod }
            })
          }
          productItems.forEach((row, i) => {
            landedCostPerItemId.set(row.id, row.quantity > 0 ? perLineTotal[i] / row.quantity : 0)
          })
        }

        // "From where the goods are being bought, at what price" — one cost
        // history row per product line, the raw material for a future
        // Purchases-by-Item / cost-trend report. Purely additive: does not
        // touch Inventory.averageCost (that running average is
        // addStockTx's job, driven off PO receiving, not billing).
        for (const row of created.items) {
          if (!row.productId) continue
          const effectiveUnitCost = stockUnitCost(row) + (landedCostPerItemId.get(row.id) ?? 0)
          await tx.productCostHistory.create({
            data: {
              productId: row.productId,
              unitCost: effectiveUnitCost,
              quantity: row.quantity,
              sourceType: 'BILL',
              sourceId: created.id
            }
          })
        }

        // We now owe the supplier this bill's total — a debit on the
        // supplier ledger AND a GL posting (matches the same direction PO
        // receiving already uses: debitAmount = amount we owe). BUT if this
        // bill is linked to a PO that has already been received,
        // purchaseOrderService.receivePO already recorded that exact
        // obligation, in BOTH places — a SupplierLedger debit AND its own
        // mirrored GL entry (postPOJournalEntry) — at receiving time. Doing
        // either again here would double-count real money owed to the
        // supplier, once in the informal ledger and once in the real books.
        // Re-read the PO's status fresh inside this same transaction (not
        // the pre-transaction read above, which could be stale if the PO
        // was received concurrently) so this check can't race against a
        // concurrent receivePO() call the same way the documented
        // double-receive guard in receivePO() itself does.
        let skipFinancialPosting = false
        if (payload.purchaseOrderId) {
          const freshPo = await tx.purchaseOrder.findUnique({ where: { id: payload.purchaseOrderId }, select: { status: true } })
          skipFinancialPosting = freshPo?.status === 'RECEIVED'
        }
        if (!skipFinancialPosting) {
          await supplierLedgerService.addEntry({
            supplierId: payload.supplierId,
            referenceType: 'BILL',
            referenceId: created.id,
            debitAmount: totalAmount,
            creditAmount: 0,
            remarks: `Bill ${created.billNumber}`
          }, tx)
          // Phase 62 — GL auto-posting.
          await postBillJournalEntry(tx, created)
        }

        return created
      })

      await logAction({ userId: userId ?? getCurrentSession()?.userId, action: 'BILL_CREATED', entityType: 'Bill', entityId: bill.id, newValue: { billNumber: bill.billNumber, supplierId: bill.supplierId, totalAmount: bill.totalAmount } })
      return { success: true, data: bill }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  async getBill(id: string) {
    const db = getPrisma()
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, supplierName: true, supplierCode: true, phone: true, email: true, isMsmeRegistered: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        landedCosts: true,
        items: {
          include: {
            product: { select: { id: true, productName: true, sku: true, unit: true } },
            serviceCategory: { select: { id: true, categoryName: true } }
          }
        },
        payments: { where: { isReversed: false }, orderBy: { paymentDate: 'desc' } }
      }
    })
    if (!bill) return { success: false, error: { code: 'BILL-002', message: 'Bill not found.' } }
    return { success: true, data: bill }
  },

  async listBills(filters?: { supplierId?: string; status?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.supplierId) where.supplierId = filters.supplierId
    if (filters?.status === 'OVERDUE') {
      // Derived: still owing, and the due date has passed.
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      where.status = { in: ['OPEN', 'PARTIALLY_PAID'] }
      where.dueDate = { not: null, lt: startOfToday }
    } else if (filters?.status) {
      where.status = filters.status
    }

    const [bills, total] = await db.$transaction([
      db.bill.findMany({
        where,
        include: {
          supplier: { select: { id: true, supplierName: true, supplierCode: true } },
          items: { select: { id: true } }
        },
        orderBy: { billDate: 'desc' },
        skip,
        take: limit
      }),
      db.bill.count({ where })
    ])

    return { success: true, data: { bills, total } }
  },

  // Replaces an open, unpaid bill with corrected details, keeping its number.
  async editBill(id: string, payload: CreateBillPayload, userId?: string) {
    const result = await billService.createBill(payload, userId, { replaceBillId: id })
    if (result.success) {
      await logAction({ userId: userId ?? getCurrentSession()?.userId, action: 'BILL_EDITED', entityType: 'Bill', entityId: (result.data as { id: string }).id, newValue: { replacedBillId: id } })
    }
    return result
  },

  async voidBill(id: string, reason: string, userId?: string) {
    const db = getPrisma()
    try {
      const updated = await db.$transaction(async (tx) => (await reverseBillPostings(tx, id, reason, userId)).after)
      await logAction({ userId, action: 'BILL_VOIDED', entityType: 'Bill', entityId: id, newValue: { status: 'VOID', reason } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  }
}
