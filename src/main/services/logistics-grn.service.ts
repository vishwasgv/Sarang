import { getPrisma } from '../database/db'
import { nextLogisticsNumber } from './logistics-counter.service'
import { scheduleGRNPostedNotification } from './logistics-notification.service'
import { inventoryService } from './inventory.service'
import { supplierLedgerService } from './supplier-ledger.service'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

const GRN_EDITABLE_STATUSES = ['DRAFT', 'VERIFIED']

function validateGrnItems(items: Array<{ receivedQty: number; unitCost?: number; itemName: string }>): string | null {
  for (const i of items) {
    if (i.receivedQty <= 0) return `Received qty for ${i.itemName} must be greater than 0.`
    if (i.unitCost !== undefined && i.unitCost < 0) return `Unit cost for ${i.itemName} cannot be negative.`
  }
  return null
}

function toRecord(r: any) {
  return {
    id: r.id, grnNumber: r.grnNumber,
    supplierId: r.supplierId, supplierName: r.supplierName,
    purchaseOrderId: r.purchaseOrderId, shipmentId: r.shipmentId,
    receivedDate: r.receivedDate.toISOString(),
    invoiceNumber: r.invoiceNumber, invoiceDate: r.invoiceDate?.toISOString() ?? null,
    totalValue: r.totalValue, status: r.status,
    postedAt: r.postedAt?.toISOString() ?? null,
    reversedAt: r.reversedAt?.toISOString() ?? null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    items: (r.items ?? []).map((i: any) => ({
      id: i.id, productId: i.productId, rawMaterialId: i.rawMaterialId,
      itemName: i.itemName, orderedQty: i.orderedQty, receivedQty: i.receivedQty,
      rejectedQty: i.rejectedQty, unit: i.unit, unitCost: i.unitCost, totalCost: i.totalCost,
      batchNumber: i.batchNumber, expiryDate: i.expiryDate?.toISOString() ?? null, notes: i.notes,
    })),
  }
}

export async function listGRNs(payload?: { status?: string; supplierId?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status && payload.status !== 'ALL') where.status = payload.status
    if (payload?.supplierId) where.supplierId = payload.supplierId
    if (payload?.fromDate || payload?.toDate) {
      where.receivedDate = {
        ...(payload.fromDate ? { gte: new Date(payload.fromDate + 'T00:00:00.000') } : {}),
        ...(payload.toDate ? { lte: new Date(payload.toDate + 'T23:59:59.999') } : {}),
      }
    }
    const take = Math.min(payload?.limit ?? 500, 500)
    const skip = payload?.offset ?? 0
    const [rows, total] = await Promise.all([
      db.goodsReceiptNote.findMany({ where, include: { items: true }, orderBy: { receivedDate: 'desc' }, skip, take }),
      db.goodsReceiptNote.count({ where }),
    ])
    return { success: true, data: rows.map(toRecord), total }
  } catch (err) {
    return { success: false, error: { code: 'LOG-030', message: err instanceof Error ? err.message : 'Failed to list GRNs.' } }
  }
}

export async function getGRN(id: string) {
  try {
    const db = getPrisma()
    const row = await db.goodsReceiptNote.findUnique({ where: { id }, include: { items: true } })
    if (!row) return { success: false, error: { code: 'NF-001', message: 'GRN not found.' } }
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-031', message: err instanceof Error ? err.message : 'Failed to get GRN.' } }
  }
}

export async function createGRN(payload: {
  supplierId?: string; supplierName: string; purchaseOrderId?: string; shipmentId?: string
  invoiceNumber?: string; invoiceDate?: string; receivedDate?: string; notes?: string
  items: Array<{ productId?: string; rawMaterialId?: string; itemName: string; orderedQty?: number; receivedQty: number; rejectedQty?: number; unit?: string; unitCost?: number; batchNumber?: string; expiryDate?: string; notes?: string }>
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.supplierName?.trim()) return { success: false, error: { code: 'VAL-001', message: 'Supplier name is required.' } }
    if (!payload.items?.length) return { success: false, error: { code: 'VAL-001', message: 'At least one item is required.' } }
    const overRejected = payload.items.find(i => (i.rejectedQty ?? 0) > i.receivedQty)
    if (overRejected) return { success: false, error: { code: 'VAL-004', message: `Rejected qty for ${overRejected.itemName} cannot exceed received qty.` } }
    const itemErr = validateGrnItems(payload.items)
    if (itemErr) return { success: false, error: { code: 'VAL-005', message: itemErr } }
    const totalValue = payload.items.reduce((s, i) => s + (i.receivedQty * (i.unitCost ?? 0)), 0)
    const row = await db.$transaction(async (tx) => {
      const grnNumber = await nextLogisticsNumber('GRN', tx)
      return tx.goodsReceiptNote.create({
        data: {
          grnNumber, supplierName: payload.supplierName.trim(),
          supplierId: payload.supplierId ?? null,
          purchaseOrderId: payload.purchaseOrderId ?? null,
          shipmentId: payload.shipmentId ?? null,
          invoiceNumber: payload.invoiceNumber?.trim() || null,
          invoiceDate: payload.invoiceDate ? new Date(payload.invoiceDate) : null,
          receivedDate: payload.receivedDate ? new Date(payload.receivedDate) : new Date(),
          totalValue, notes: payload.notes?.trim() || null,
          items: {
            create: payload.items.map(i => ({
              productId: i.productId ?? null, rawMaterialId: i.rawMaterialId ?? null,
              itemName: i.itemName, orderedQty: i.orderedQty ?? null,
              receivedQty: i.receivedQty, rejectedQty: i.rejectedQty ?? 0,
              unit: i.unit ?? 'PCS', unitCost: i.unitCost ?? 0,
              totalCost: i.receivedQty * (i.unitCost ?? 0),
              batchNumber: i.batchNumber ?? null,
              expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
              notes: i.notes ?? null,
            }))
          }
        },
        include: { items: true },
      })
    })
    await logAction({ userId, action: 'CREATE', entityType: 'GoodsReceiptNote', entityId: row.id, newValue: { grnNumber: row.grnNumber, supplierName: row.supplierName, totalValue: row.totalValue } })
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-032', message: err instanceof Error ? err.message : 'Failed to create GRN.' } }
  }
}

export async function updateGRN(payload: {
  id: string; status?: string; supplierName?: string; invoiceNumber?: string; invoiceDate?: string; receivedDate?: string; notes?: string
  items?: Array<{ productId?: string; rawMaterialId?: string; itemName: string; orderedQty?: number; receivedQty: number; rejectedQty?: number; unit?: string; unitCost?: number; batchNumber?: string; expiryDate?: string; notes?: string }>
}, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.goodsReceiptNote.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'GRN not found.' } }
    if (existing.status === 'POSTED') return { success: false, error: { code: 'VAL-002', message: 'Cannot edit a posted GRN.' } }
    if (payload.status !== undefined && !GRN_EDITABLE_STATUSES.includes(payload.status))
      return { success: false, error: { code: 'VAL-003', message: `Status must be one of: ${GRN_EDITABLE_STATUSES.join(', ')}.` } }
    if (payload.items !== undefined && payload.items.length === 0)
      return { success: false, error: { code: 'VAL-004', message: 'A GRN must have at least one item — remove the GRN instead of clearing all items.' } }
    if (payload.items?.length) {
      const overRejected = payload.items.find(i => (i.rejectedQty ?? 0) > i.receivedQty)
      if (overRejected) return { success: false, error: { code: 'VAL-004', message: `Rejected qty for ${overRejected.itemName} cannot exceed received qty.` } }
      const itemErr = validateGrnItems(payload.items)
      if (itemErr) return { success: false, error: { code: 'VAL-005', message: itemErr } }
    }
    // Editing a VERIFIED GRN auto-reverts it to DRAFT so it must be re-verified before posting
    const revertToDraft = existing.status === 'VERIFIED' && payload.status === undefined
    const totalValue = payload.items ? payload.items.reduce((s, i) => s + i.receivedQty * (i.unitCost ?? 0), 0) : undefined
    const row = await db.$transaction(async (tx) => {
      if (payload.items !== undefined) {
        await tx.gRNItem.deleteMany({ where: { grnId: payload.id } })
      }
      return tx.goodsReceiptNote.update({
        where: { id: payload.id },
        data: {
          ...(revertToDraft && { status: 'DRAFT' }),
          ...(payload.status && !revertToDraft && { status: payload.status }),
          ...(payload.supplierName && { supplierName: payload.supplierName.trim() }),
          ...(payload.invoiceNumber !== undefined && { invoiceNumber: payload.invoiceNumber?.trim() || null }),
          ...(payload.invoiceDate !== undefined && { invoiceDate: payload.invoiceDate ? new Date(payload.invoiceDate) : null }),
          ...(payload.receivedDate && { receivedDate: new Date(payload.receivedDate) }),
          ...(payload.notes !== undefined && { notes: payload.notes?.trim() || null }),
          ...(totalValue !== undefined && { totalValue }),
          ...(payload.items !== undefined && {
            items: {
              // Must carry productId/rawMaterialId through — these items replace
              // the deleted originals, and postGRN's stock-update branch keys off
              // exactly these two fields. Dropping them here silently turns
              // every edited line into a no-op at posting time (no error, no
              // inventory change, no movement record).
              create: payload.items.map(i => ({
                productId: i.productId ?? null, rawMaterialId: i.rawMaterialId ?? null,
                itemName: i.itemName, orderedQty: i.orderedQty ?? null,
                receivedQty: i.receivedQty, rejectedQty: i.rejectedQty ?? 0,
                unit: i.unit ?? 'PCS', unitCost: i.unitCost ?? 0,
                totalCost: i.receivedQty * (i.unitCost ?? 0),
                batchNumber: i.batchNumber ?? null,
                expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
                notes: i.notes ?? null,
              }))
            }
          }),
        },
        include: { items: true },
      })
    })
    await logAction({ userId, action: 'UPDATE', entityType: 'GoodsReceiptNote', entityId: payload.id })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'GRN not found.' } }
    return { success: false, error: { code: 'LOG-033', message: err instanceof Error ? err.message : 'Failed to update GRN.' } }
  }
}

export async function deleteGRN(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.goodsReceiptNote.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'GRN not found.' } }
    if (existing.status !== 'DRAFT') return { success: false, error: { code: 'VAL-002', message: 'Only DRAFT GRNs can be deleted.' } }
    await db.goodsReceiptNote.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE', entityType: 'GoodsReceiptNote', entityId: id, oldValue: { grnNumber: existing.grnNumber } })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'GRN not found.' } }
    return { success: false, error: { code: 'LOG-035', message: err instanceof Error ? err.message : 'Failed to delete GRN.' } }
  }
}

export async function postGRN(id: string, userId?: string) {
  const db = getPrisma()
  try {
    let postedGrnNumber = ''
    let postedSupplierName = ''

    await db.$transaction(async (tx) => {
      // Read inside transaction to prevent stale data race
      const grn = await tx.goodsReceiptNote.findUnique({ where: { id }, include: { items: true } })
      if (!grn) throw Object.assign(new Error('GRN not found.'), { _code: 'NF' })
      if (grn.status === 'POSTED') throw Object.assign(new Error('GRN is already posted.'), { _code: 'POSTED' })
      if (grn.status !== 'VERIFIED') throw Object.assign(new Error('GRN must be verified before posting.'), { _code: 'NOT_VERIFIED' })

      postedGrnNumber = grn.grnNumber
      postedSupplierName = grn.supplierName

      // If this GRN is against a PO, the PO must still be open to receive against
      // (not DRAFT/CANCELLED/already fully RECEIVED), and posting must not push any
      // line item past what was actually ordered. Previously neither was checked,
      // so a cancelled or fully-received PO could still be force-credited via GRN.
      let poItems: Array<{ id: string; productId: string; quantity: number; receivedQty: number }> = []
      if (grn.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({ where: { id: grn.purchaseOrderId } })
        if (!po) throw Object.assign(new Error('Linked purchase order not found.'), { _code: 'PO_NOT_FOUND' })
        if (po.status !== 'APPROVED' && po.status !== 'PARTIAL_RECEIVED') {
          throw Object.assign(
            new Error(`Cannot receive against a purchase order with status ${po.status}. It must be APPROVED or partially received.`),
            { _code: 'PO_NOT_RECEIVABLE' }
          )
        }
        poItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrderId } })
        for (const grnItem of grn.items) {
          if (!grnItem.productId) continue
          const poItem = poItems.find(p => p.productId === grnItem.productId)
          if (poItem && poItem.receivedQty + grnItem.receivedQty > poItem.quantity + 1e-6) {
            throw Object.assign(
              new Error(`Receiving ${grnItem.receivedQty} ${grnItem.itemName} would exceed the ordered quantity (ordered ${poItem.quantity}, already received ${poItem.receivedQty}).`),
              { _code: 'OVER_RECEIPT' }
            )
          }
        }
      }

      for (const item of grn.items) {
        // Only the accepted portion of a delivery becomes usable stock — units
        // that failed QC (rejectedQty) must not inflate on-hand inventory just
        // because they were physically received. Clamped to 0 defensively;
        // createGRN/updateGRN already reject rejectedQty > receivedQty at input time.
        const acceptedQty = Math.max(0, item.receivedQty - (item.rejectedQty ?? 0))
        if (item.rawMaterialId) {
          if (acceptedQty === 0) continue
          const mat = await tx.rawMaterial.findUnique({ where: { id: item.rawMaterialId } })
          // A missing raw material must abort the whole post (matching the productId
          // branch below, which throws via addStockTx) — silently skipping would still
          // debit the supplier ledger for this item's cost a few lines down while the
          // stock/movement side never happens, permanently diverging paid-for vs. received.
          if (!mat) throw Object.assign(new Error(`Raw material for "${item.itemName}" no longer exists — cannot post this GRN.`), { _code: 'RAW_MATERIAL_NOT_FOUND' })
          const newStock = mat.currentStock + acceptedQty
          await tx.rawMaterial.update({ where: { id: item.rawMaterialId }, data: { currentStock: newStock } })
          await tx.rawMaterialMovement.create({
            data: {
              rawMaterialId: item.rawMaterialId, type: 'PURCHASE',
              quantity: acceptedQty, balanceAfter: newStock,
              reference: grn.grnNumber, unitCost: item.unitCost, notes: `GRN: ${grn.grnNumber}`,
            }
          })
        } else if (item.productId) {
          if (acceptedQty === 0) continue
          // RULE I001/I007 — route through the same path PO receipt uses so a
          // movement record and a correct weighted average cost are always
          // produced, no matter which "receive stock" workflow was used.
          await inventoryService.addStockTx(
            tx, item.productId, acceptedQty, item.unitCost,
            `Received via GRN ${grn.grnNumber}`, 'GOODS_RECEIPT_NOTE', grn.id, userId
          )

          // A GRN line already captures batchNumber/expiryDate when the
          // receiving staff fills them in, but that data previously went
          // nowhere — Batch Tracking required entering the same batch a
          // second time, by hand, in a disconnected screen. Auto-create (or
          // top up, if this batch number for this product already exists —
          // e.g. a repeat order of the same manufacturer batch) the
          // ProductBatch row here instead. Gated on the data actually being
          // present, not on the batch_tracking module flag: if a product
          // isn't batch-tracked, staff simply won't fill these fields in, so
          // this naturally no-ops for every non-batch-tracked receipt.
          if (item.batchNumber && item.expiryDate) {
            const batchNumber = item.batchNumber.trim().toUpperCase()
            const existingBatch = await tx.productBatch.findUnique({
              where: { productId_batchNumber: { productId: item.productId, batchNumber } }
            })
            if (existingBatch) {
              await tx.productBatch.update({
                where: { id: existingBatch.id },
                data: { quantityReceived: { increment: acceptedQty }, quantityRemaining: { increment: acceptedQty } }
              })
            } else {
              await tx.productBatch.create({
                data: {
                  productId: item.productId, batchNumber, expiryDate: item.expiryDate,
                  quantityReceived: acceptedQty, quantityRemaining: acceptedQty,
                  unitCost: item.unitCost, supplierId: grn.supplierId ?? null
                }
              })
            }
          }
        }
      }

      // Supplier ledger debit — GRN posting previously never touched the ledger,
      // so the supplier outstanding balance silently diverged depending on whether
      // a PO was received via the old direct-receive path or via GRN.
      if (grn.supplierId && grn.totalValue > 0) {
        await supplierLedgerService.addEntry({
          supplierId: grn.supplierId,
          referenceType: 'GOODS_RECEIPT_NOTE',
          referenceId: grn.id,
          debitAmount: grn.totalValue,
          creditAmount: 0,
          remarks: `GRN ${grn.grnNumber} posted`
        }, tx)
      }

      // Update PO line items receivedQty and PO status
      if (grn.purchaseOrderId) {
        for (const grnItem of grn.items) {
          if (!grnItem.productId) continue
          const poItem = poItems.find(p => p.productId === grnItem.productId)
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { receivedQty: poItem.receivedQty + grnItem.receivedQty },
            })
          }
        }
        // Re-fetch updated PO items to determine status
        const updatedPoItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrderId } })
        const allReceived = updatedPoItems.every(p => p.receivedQty >= p.quantity)
        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: { status: allReceived ? 'RECEIVED' : 'PARTIAL_RECEIVED' },
        })
      }

      await tx.goodsReceiptNote.update({
        where: { id }, data: { status: 'POSTED', postedAt: new Date() },
      })
    })

    await logAction({ userId, action: 'POST', entityType: 'GoodsReceiptNote', entityId: id, newValue: { grnNumber: postedGrnNumber, supplierName: postedSupplierName } })
    await scheduleGRNPostedNotification(id, postedGrnNumber, postedSupplierName)
    return { success: true }
  } catch (err: any) {
    if (err?._code === 'NF') return { success: false, error: { code: 'NF-001', message: 'GRN not found.' } }
    if (err?._code === 'POSTED') return { success: false, error: { code: 'VAL-002', message: 'GRN is already posted.' } }
    if (err?._code === 'NOT_VERIFIED') return { success: false, error: { code: 'VAL-003', message: 'GRN must be verified before posting.' } }
    if (err?._code === 'PO_NOT_FOUND') return { success: false, error: { code: 'PO-001', message: err.message } }
    if (err?._code === 'PO_NOT_RECEIVABLE') return { success: false, error: { code: 'PO-006', message: err.message } }
    if (err?._code === 'OVER_RECEIPT') return { success: false, error: { code: 'GRN-001', message: err.message } }
    if (err?._code === 'RAW_MATERIAL_NOT_FOUND') return { success: false, error: { code: 'GRN-002', message: err.message } }
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'LOG-034', message: err instanceof Error ? err.message : 'Failed to post GRN.' } }
  }
}

// Undoes a POSTED GRN's stock, supplier-ledger and PO effects — the only way to
// correct a wrong posting today short of manual DB work. Every effect postGRN
// applied is unwound symmetrically: stock/raw-material quantities decremented
// back down, a supplier-ledger CREDIT offsets the original debit, and PO
// receivedQty/status are rolled back. Reversing a GRN with no linked PO or
// supplier simply skips those steps, same as posting does.
export async function reverseGRN(id: string, userId?: string) {
  const db = getPrisma()
  try {
    let reversedGrnNumber = ''

    await db.$transaction(async (tx) => {
      const grn = await tx.goodsReceiptNote.findUnique({ where: { id }, include: { items: true } })
      if (!grn) throw Object.assign(new Error('GRN not found.'), { _code: 'NF' })
      if (grn.status !== 'POSTED') throw Object.assign(new Error('Only a POSTED GRN can be reversed.'), { _code: 'NOT_POSTED' })
      reversedGrnNumber = grn.grnNumber

      let poItems: Array<{ id: string; productId: string; quantity: number; receivedQty: number }> = []
      if (grn.purchaseOrderId) {
        poItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrderId } })
      }

      for (const item of grn.items) {
        const acceptedQty = Math.max(0, item.receivedQty - (item.rejectedQty ?? 0))
        if (acceptedQty === 0) continue

        if (item.rawMaterialId) {
          const mat = await tx.rawMaterial.findUnique({ where: { id: item.rawMaterialId } })
          if (!mat) throw Object.assign(new Error(`Raw material for "${item.itemName}" no longer exists — cannot reverse this GRN.`), { _code: 'RAW_MATERIAL_NOT_FOUND' })
          if (mat.currentStock < acceptedQty) {
            throw Object.assign(
              new Error(`Cannot reverse: only ${mat.currentStock} of "${item.itemName}" remains in stock, but this GRN added ${acceptedQty} — some has already been used.`),
              { _code: 'INSUFFICIENT_STOCK' }
            )
          }
          const newStock = mat.currentStock - acceptedQty
          await tx.rawMaterial.update({ where: { id: item.rawMaterialId }, data: { currentStock: newStock } })
          await tx.rawMaterialMovement.create({
            data: {
              rawMaterialId: item.rawMaterialId, type: 'ADJUSTMENT',
              quantity: -acceptedQty, balanceAfter: newStock,
              reference: grn.grnNumber, unitCost: item.unitCost, notes: `Reversal of GRN: ${grn.grnNumber}`,
            }
          })
        } else if (item.productId) {
          // Same allow-negative-stock guard as any other stock reduction — surfaces
          // a clear error instead of silently corrupting inventory below zero.
          await inventoryService.reduceStockTx(
            tx, item.productId, acceptedQty,
            `Reversal of GRN ${grn.grnNumber}`, 'GOODS_RECEIPT_NOTE_REVERSAL', grn.id, userId
          )

          // Symmetric undo of the batch top-up postGRN performs above — if this
          // batch has already been partly (or fully) sold since posting, refuse
          // the reversal rather than let quantityRemaining go negative, same
          // guard the raw-material branch above already uses.
          if (item.batchNumber && item.expiryDate) {
            const batchNumber = item.batchNumber.trim().toUpperCase()
            const existingBatch = await tx.productBatch.findUnique({
              where: { productId_batchNumber: { productId: item.productId, batchNumber } }
            })
            if (existingBatch) {
              if (existingBatch.quantityRemaining < acceptedQty) {
                throw Object.assign(
                  new Error(`Cannot reverse: only ${existingBatch.quantityRemaining} of batch "${batchNumber}" remains, but this GRN added ${acceptedQty} — some has already been sold.`),
                  { _code: 'INSUFFICIENT_STOCK' }
                )
              }
              await tx.productBatch.update({
                where: { id: existingBatch.id },
                data: { quantityReceived: { decrement: acceptedQty }, quantityRemaining: { decrement: acceptedQty } }
              })
            }
          }
        }
      }

      if (grn.supplierId && grn.totalValue > 0) {
        await supplierLedgerService.addEntry({
          supplierId: grn.supplierId,
          referenceType: 'GOODS_RECEIPT_NOTE_REVERSAL',
          referenceId: grn.id,
          debitAmount: 0,
          creditAmount: grn.totalValue,
          remarks: `GRN ${grn.grnNumber} reversed`
        }, tx)
      }

      if (grn.purchaseOrderId) {
        for (const grnItem of grn.items) {
          if (!grnItem.productId) continue
          const poItem = poItems.find(p => p.productId === grnItem.productId)
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { receivedQty: Math.max(0, poItem.receivedQty - grnItem.receivedQty) },
            })
          }
        }
        const updatedPoItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrderId } })
        const allReceived = updatedPoItems.every(p => p.receivedQty >= p.quantity)
        const anyReceived = updatedPoItems.some(p => p.receivedQty > 0)
        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: { status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL_RECEIVED' : 'APPROVED' },
        })
      }

      await tx.goodsReceiptNote.update({
        where: { id }, data: { status: 'REVERSED', reversedAt: new Date() },
      })
    })

    await logAction({ userId, action: 'REVERSE', entityType: 'GoodsReceiptNote', entityId: id, newValue: { grnNumber: reversedGrnNumber } })
    return { success: true }
  } catch (err: any) {
    if (err?._code === 'NF') return { success: false, error: { code: 'NF-001', message: 'GRN not found.' } }
    if (err?._code === 'NOT_POSTED') return { success: false, error: { code: 'VAL-002', message: 'Only a POSTED GRN can be reversed.' } }
    if (err?._code === 'RAW_MATERIAL_NOT_FOUND') return { success: false, error: { code: 'GRN-002', message: err.message } }
    if (err?._code === 'INSUFFICIENT_STOCK') return { success: false, error: { code: 'GRN-003', message: err.message } }
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'LOG-036', message: err instanceof Error ? err.message : 'Failed to reverse GRN.' } }
  }
}
