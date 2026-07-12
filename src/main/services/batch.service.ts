import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface BatchRecord {
  id: string
  productId: string
  productName: string
  batchNumber: string
  mfgDate: string | null
  expiryDate: string
  quantityReceived: number
  quantityRemaining: number
  unitCost: number
  supplierId: string | null
  supplierName: string | null
  isActive: boolean
  daysToExpiry: number
  createdAt: string
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000)
}

export async function listBatches(payload?: {
  productId?: string
  expiringSoonDays?: number
  expired?: boolean
  page?: number
  limit?: number
}): Promise<{ success: boolean; data?: { batches: BatchRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const page = payload?.page ?? 1
    const limit = payload?.limit ?? 50
    const skip = (page - 1) * limit
    const now = new Date()

    const where: Record<string, unknown> = { isActive: true }
    if (payload?.productId) where.productId = payload.productId

    if (payload?.expired === true) {
      where.expiryDate = { lt: now }
    } else if (payload?.expiringSoonDays) {
      const cutoff = new Date(now.getTime() + payload.expiringSoonDays * 86400000)
      where.expiryDate = { gte: now, lte: cutoff }
    }

    const [rows, total] = await Promise.all([
      db.productBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expiryDate: 'asc' },
        include: {
          product: { select: { productName: true } },
          supplier: { select: { supplierName: true } }
        }
      }),
      db.productBatch.count({ where })
    ])

    const batches: BatchRecord[] = rows.map(b => ({
      id: b.id,
      productId: b.productId,
      productName: b.product.productName,
      batchNumber: b.batchNumber,
      mfgDate: b.mfgDate ? b.mfgDate.toISOString() : null,
      expiryDate: b.expiryDate.toISOString(),
      quantityReceived: b.quantityReceived,
      quantityRemaining: b.quantityRemaining,
      unitCost: b.unitCost,
      supplierId: b.supplierId,
      supplierName: b.supplier?.supplierName ?? null,
      isActive: b.isActive,
      daysToExpiry: daysUntil(b.expiryDate),
      createdAt: b.createdAt.toISOString()
    }))

    return { success: true, data: { batches, total } }
  } catch (err) {
    return { success: false, error: { code: 'BAT-001', message: err instanceof Error ? err.message : 'Failed to list batches.' } }
  }
}

export async function createBatch(payload: {
  productId: string
  batchNumber: string
  expiryDate: string
  mfgDate?: string
  quantityReceived: number
  unitCost?: number
  supplierId?: string
}, userId?: string): Promise<{ success: boolean; data?: BatchRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { productName: true } })
    if (!product) return { success: false, error: { code: 'BAT-002', message: 'Product not found.' } }
    if (payload.quantityReceived <= 0) return { success: false, error: { code: 'BAT-004', message: 'Quantity received must be greater than zero.' } }
    if (payload.mfgDate && new Date(payload.mfgDate) >= new Date(payload.expiryDate)) {
      return { success: false, error: { code: 'BAT-008', message: 'Manufacturing date must be before expiry date.' } }
    }

    const batch = await db.$transaction(async (tx) => {
      const created = await tx.productBatch.create({
        data: {
          productId: payload.productId,
          batchNumber: payload.batchNumber.trim().toUpperCase(),
          expiryDate: new Date(payload.expiryDate),
          mfgDate: payload.mfgDate ? new Date(payload.mfgDate) : null,
          quantityReceived: payload.quantityReceived,
          quantityRemaining: payload.quantityReceived,
          unitCost: payload.unitCost ?? 0,
          supplierId: payload.supplierId ?? null
        },
        include: {
          product: { select: { productName: true } },
          supplier: { select: { supplierName: true } }
        }
      })
      await tx.inventory.upsert({
        where: { productId: payload.productId },
        create: { productId: payload.productId, quantity: payload.quantityReceived },
        update: { quantity: { increment: payload.quantityReceived } }
      })
      return created
    })

    await logAction(userId, 'BATCH_CREATED', 'ProductBatch', batch.id, undefined, { batchNumber: batch.batchNumber, productId: payload.productId })

    return {
      success: true,
      data: {
        id: batch.id,
        productId: batch.productId,
        productName: batch.product.productName,
        batchNumber: batch.batchNumber,
        mfgDate: batch.mfgDate ? batch.mfgDate.toISOString() : null,
        expiryDate: batch.expiryDate.toISOString(),
        quantityReceived: batch.quantityReceived,
        quantityRemaining: batch.quantityRemaining,
        unitCost: batch.unitCost,
        supplierId: batch.supplierId,
        supplierName: batch.supplier?.supplierName ?? null,
        isActive: batch.isActive,
        daysToExpiry: daysUntil(batch.expiryDate),
        createdAt: batch.createdAt.toISOString()
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create batch.'
    if (msg.includes('Unique constraint')) {
      return { success: false, error: { code: 'BAT-003', message: 'Batch number already exists for this product.' } }
    }
    return { success: false, error: { code: 'BAT-004', message: msg } }
  }
}

export async function updateBatch(payload: {
  id: string
  expiryDate?: string
  mfgDate?: string
  quantityRemaining?: number
  unitCost?: number
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const existing = await db.productBatch.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'BAT-005', message: 'Batch not found.' } }

    const resolvedExpiry = payload.expiryDate ? new Date(payload.expiryDate) : existing.expiryDate
    const resolvedMfg = payload.mfgDate ? new Date(payload.mfgDate) : existing.mfgDate
    if (resolvedMfg && resolvedMfg >= resolvedExpiry) {
      return { success: false, error: { code: 'BAT-008', message: 'Manufacturing date must be before expiry date.' } }
    }

    await db.$transaction(async (tx) => {
      await tx.productBatch.update({
        where: { id: payload.id },
        data: {
          ...(payload.expiryDate ? { expiryDate: new Date(payload.expiryDate) } : {}),
          ...(payload.mfgDate ? { mfgDate: new Date(payload.mfgDate) } : {}),
          ...(payload.quantityRemaining !== undefined ? { quantityRemaining: payload.quantityRemaining } : {}),
          ...(payload.unitCost !== undefined ? { unitCost: payload.unitCost } : {})
        }
      })

      if (payload.quantityRemaining !== undefined) {
        const delta = payload.quantityRemaining - existing.quantityRemaining
        if (delta !== 0) {
          await tx.inventory.upsert({
            where: { productId: existing.productId },
            create: { productId: existing.productId, quantity: Math.max(0, delta) },
            update: { quantity: { increment: delta } }
          })
        }
      }
    })

    await logAction(userId, 'BATCH_UPDATED', 'ProductBatch', payload.id, { quantityRemaining: existing.quantityRemaining }, { quantityRemaining: payload.quantityRemaining })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BAT-006', message: err instanceof Error ? err.message : 'Failed to update batch.' } }
  }
}

export async function deleteBatch(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const batch = await db.productBatch.findUnique({ where: { id } })
    if (!batch) return { success: false, error: { code: 'BAT-005', message: 'Batch not found.' } }

    await db.$transaction(async (tx) => {
      await tx.productBatch.update({ where: { id }, data: { isActive: false } })
      if (batch.quantityRemaining > 0) {
        await tx.inventory.upsert({
          where: { productId: batch.productId },
          create: { productId: batch.productId, quantity: 0 },
          update: { quantity: { decrement: batch.quantityRemaining } }
        })
      }
    })
    await logAction(userId, 'BATCH_DELETED', 'ProductBatch', id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BAT-007', message: err instanceof Error ? err.message : 'Failed to delete batch.' } }
  }
}

export async function getExpiryAlerts(withinDays = 30): Promise<{ success: boolean; data?: { expiring: BatchRecord[]; expired: BatchRecord[] } }> {
  try {
    const db = getPrisma()
    const now = new Date()
    const cutoff = new Date(now.getTime() + withinDays * 86400000)

    const [expiring, expired] = await Promise.all([
      db.productBatch.findMany({
        where: { isActive: true, quantityRemaining: { gt: 0 }, expiryDate: { gte: now, lte: cutoff } },
        orderBy: { expiryDate: 'asc' },
        include: { product: { select: { productName: true } }, supplier: { select: { supplierName: true } } }
      }),
      db.productBatch.findMany({
        where: { isActive: true, quantityRemaining: { gt: 0 }, expiryDate: { lt: now } },
        orderBy: { expiryDate: 'desc' },
        include: { product: { select: { productName: true } }, supplier: { select: { supplierName: true } } }
      })
    ])

    const toRecord = (b: typeof expiring[0]): BatchRecord => ({
      id: b.id, productId: b.productId, productName: b.product.productName,
      batchNumber: b.batchNumber, mfgDate: b.mfgDate?.toISOString() ?? null,
      expiryDate: b.expiryDate.toISOString(), quantityReceived: b.quantityReceived,
      quantityRemaining: b.quantityRemaining, unitCost: b.unitCost, supplierId: b.supplierId,
      supplierName: b.supplier?.supplierName ?? null, isActive: b.isActive,
      daysToExpiry: daysUntil(b.expiryDate), createdAt: b.createdAt.toISOString()
    })

    return { success: true, data: { expiring: expiring.map(toRecord), expired: expired.map(toRecord) } }
  } catch {
    return { success: true, data: { expiring: [], expired: [] } }
  }
}

// Dispenses a sale FIFO — earliest-expiry batch first, but never an already-
// expired one — so quantityRemaining actually tracks reality (previously
// batches only ever moved on manual edit/delete, never on an actual sale, so
// this table drifted from true remaining stock with every invoice and "FIFO
// dispensing" was just a label with no logic behind it). A product with no
// batches is a cheap no-op.
// If combined NON-EXPIRED batch quantityRemaining is short of what's being
// sold (e.g. stock was added without ever creating a batch record, or the
// only remaining batches have expired), inventory.quantity — already
// validated as the authoritative stock figure before this runs — is not
// blocked over a secondary tracking table being incomplete; this simply
// deducts as much as the non-expired batch records can account for. The
// caller (billing.service.ts) is responsible for blocking/warning BEFORE the
// sale is committed when fulfilling it would require reaching into expired
// stock — see hasEnoughNonExpiredBatchStock below — this function is the
// structural backstop that guarantees expired batches are never silently
// drawn down even if that earlier check is ever bypassed.
export async function deductBatchStockFIFO(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  productId: string,
  quantity: number
): Promise<void> {
  let remaining = quantity
  const batches = await tx.productBatch.findMany({
    where: { productId, isActive: true, quantityRemaining: { gt: 0 }, expiryDate: { gte: new Date() } },
    orderBy: { expiryDate: 'asc' }
  })

  for (const batch of batches) {
    if (remaining <= 0) break
    const deduct = Math.min(batch.quantityRemaining, remaining)
    await tx.productBatch.update({
      where: { id: batch.id },
      data: { quantityRemaining: { decrement: deduct } }
    })
    remaining -= deduct
  }
}

// Returns true if this product's tracked batch stock can fully cover the
// requested quantity WITHOUT drawing from any batch already past its
// expiryDate. A product with zero active batch records returns true —
// nothing to check, batch tracking isn't in use for it and
// inventory.quantity is the sole authority. Used by billing.service.ts to
// block (or, if the owner has explicitly opted in via the
// allow_expired_batch_sale setting, warn on) a sale that would otherwise
// silently sell expired stock first, since FIFO-by-expiry-date always
// surfaces the oldest — and therefore most likely expired — batch first.
export async function hasEnoughNonExpiredBatchStock(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0] | ReturnType<typeof getPrisma>,
  productId: string,
  quantity: number
): Promise<boolean> {
  const totalActive = await tx.productBatch.aggregate({
    where: { productId, isActive: true, quantityRemaining: { gt: 0 } },
    _sum: { quantityRemaining: true }
  })
  if ((totalActive._sum.quantityRemaining ?? 0) === 0) return true

  const nonExpired = await tx.productBatch.aggregate({
    where: { productId, isActive: true, quantityRemaining: { gt: 0 }, expiryDate: { gte: new Date() } },
    _sum: { quantityRemaining: true }
  })
  return (nonExpired._sum.quantityRemaining ?? 0) >= quantity
}

// Invoice cancellation counterpart to deductBatchStockFIFO. A FIFO deduction
// can spread across several batches and nothing records exactly which ones a
// given sale drew from, so an exact per-batch reversal isn't possible without
// new tracking — instead the full returned quantity goes back onto the
// earliest-expiry active batch (the one FIFO would hand out next anyway), so
// aggregate quantityRemaining across the product's batches stays correct even
// though it may not land back on the literal original batch. No-op if the
// product has no active batches left to receive it.
export async function restoreBatchStockFIFO(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  productId: string,
  quantity: number
): Promise<void> {
  const batch = await tx.productBatch.findFirst({
    where: { productId, isActive: true },
    orderBy: { expiryDate: 'asc' }
  })
  if (!batch) return
  await tx.productBatch.update({
    where: { id: batch.id },
    data: { quantityRemaining: { increment: quantity } }
  })
}
