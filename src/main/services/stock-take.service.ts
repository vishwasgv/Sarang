import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { inventoryService } from './inventory.service'
import { getProductCostsBatch } from './valuation.service'
import { getCurrencyDecimals, prorateAmount, roundMoney, sumMoney } from '../../shared/utils/money'

// A physical stock count. Starting a count takes a snapshot of what the books say; the counted quantities are
// entered against it; posting turns every difference into a stock adjustment. The difference is applied to the
// stock as it is at posting time, so sales made while counting are not undone.

export interface StockTakeLineView {
  id: string
  productId: string
  productName: string
  sku: string | null
  systemQty: number
  countedQty: number | null
  variance: number | null
  varianceValue: number | null
  posted: boolean
}

async function decimalsOf(): Promise<number> {
  const profile = await getPrisma().businessProfile.findFirst({ select: { currencyCode: true } })
  return getCurrencyDecimals(profile?.currencyCode)
}

async function view(id: string) {
  const db = getPrisma()
  const take = await db.stockTake.findUnique({ where: { id }, include: { lines: { orderBy: { productName: 'asc' } } } })
  if (!take) throw new ServiceError('STK-001', 'Stock count not found.')
  const decimals = await decimalsOf()
  const costs = await getProductCostsBatch(take.lines.map((l) => l.productId))
  const lines: StockTakeLineView[] = take.lines.map((l) => {
    const variance = l.countedQty === null ? null : roundMoney(l.countedQty - l.systemQty, 3)
    return {
      id: l.id, productId: l.productId, productName: l.productName, sku: l.sku, systemQty: l.systemQty, countedQty: l.countedQty, variance,
      varianceValue: variance === null ? null : prorateAmount(costs.get(l.productId) ?? 0, variance, 1, decimals), posted: l.posted
    }
  })
  const counted = lines.filter((l) => l.countedQty !== null)
  return {
    id: take.id, takeNumber: take.takeNumber, status: take.status, notes: take.notes, createdAt: take.createdAt.toISOString(), postedAt: take.postedAt?.toISOString() ?? null,
    lines,
    summary: {
      lines: lines.length, counted: counted.length,
      withDifference: counted.filter((l) => l.variance !== 0).length,
      surplusValue: sumMoney(counted.filter((l) => (l.varianceValue ?? 0) > 0).map((l) => l.varianceValue ?? 0), decimals),
      shortageValue: sumMoney(counted.filter((l) => (l.varianceValue ?? 0) < 0).map((l) => -(l.varianceValue ?? 0)), decimals)
    }
  }
}

function fail(err: unknown, fallback: string) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : fallback } }
}

export const stockTakeService = {
  async start(p: { notes?: string; categoryId?: string }, userId?: string) {
    try {
      const db = getPrisma()
      const open = await db.stockTake.findFirst({ where: { status: 'IN_PROGRESS' }, select: { takeNumber: true } })
      if (open) throw new ServiceError('STK-002', `Finish or cancel ${open.takeNumber} before starting another count.`)
      const inventories = await db.inventory.findMany({
        where: { product: { isActive: true, productType: 'STANDARD', ...(p.categoryId ? { categoryId: p.categoryId } : {}) } },
        select: { productId: true, quantity: true, product: { select: { productName: true, sku: true } } }
      })
      if (inventories.length === 0) throw new ServiceError('STK-003', 'There is no stock to count.')
      const take = await db.$transaction(async (tx) => {
        const takeNumber = await generateSequenceNumber(tx, 'stock_take_sequence', 'ST', 5, async () => {
          const last = await tx.stockTake.findFirst({ orderBy: { createdAt: 'desc' }, select: { takeNumber: true } })
          return last ? parseInt(last.takeNumber.replace(/^ST-/, ''), 10) : 0
        })
        return tx.stockTake.create({
          data: {
            takeNumber, notes: p.notes?.trim() || null, createdById: userId ?? null,
            lines: { create: inventories.map((i) => ({ productId: i.productId, productName: i.product.productName, sku: i.product.sku ?? null, systemQty: i.quantity })) }
          }
        })
      })
      await logAction({ userId, action: 'STOCK_TAKE_STARTED', entityType: 'StockTake', entityId: take.id, newValue: { takeNumber: take.takeNumber, lines: inventories.length } })
      return { success: true, data: await view(take.id) }
    } catch (err) {
      return fail(err, 'Could not start the stock count.')
    }
  },

  async get(id: string) {
    try { return { success: true, data: await view(id) } } catch (err) { return fail(err, 'Could not load the stock count.') }
  },

  async list() {
    const rows = await getPrisma().stockTake.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { lines: true } } } })
    return { success: true, data: rows.map((r) => ({ id: r.id, takeNumber: r.takeNumber, status: r.status, createdAt: r.createdAt.toISOString(), postedAt: r.postedAt?.toISOString() ?? null, lines: r._count.lines, notes: r.notes })) }
  },

  /** Saves counted quantities. A null clears a count. Only while the count is still open. */
  async setCounts(id: string, counts: Array<{ lineId: string; countedQty: number | null }>) {
    try {
      const db = getPrisma()
      const take = await db.stockTake.findUnique({ where: { id }, select: { status: true } })
      if (!take) throw new ServiceError('STK-001', 'Stock count not found.')
      if (take.status !== 'IN_PROGRESS') throw new ServiceError('STK-004', 'This count is closed.')
      for (const c of counts) {
        if (c.countedQty !== null && (!Number.isFinite(c.countedQty) || c.countedQty < 0)) throw new ServiceError('STK-005', 'A counted quantity cannot be negative.')
      }
      await db.$transaction(async (tx) => {
        for (const c of counts) await tx.stockTakeLine.updateMany({ where: { id: c.lineId, stockTakeId: id, posted: false }, data: { countedQty: c.countedQty } })
      })
      return { success: true, data: await view(id) }
    } catch (err) {
      return fail(err, 'Could not save the counts.')
    }
  },

  async post(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const take = await db.stockTake.findUnique({ where: { id }, include: { lines: true } })
      if (!take) throw new ServiceError('STK-001', 'Stock count not found.')
      if (take.status !== 'IN_PROGRESS') throw new ServiceError('STK-004', 'This count is closed.')
      const counted = take.lines.filter((l) => l.countedQty !== null)
      if (counted.length === 0) throw new ServiceError('STK-006', 'Enter at least one counted quantity first.')

      let adjusted = 0
      const problems: Array<{ product: string; message: string }> = []
      for (const line of counted.filter((l) => !l.posted)) {
        const variance = roundMoney((line.countedQty as number) - line.systemQty, 3)
        if (variance !== 0) {
          const current = await db.inventory.findUnique({ where: { productId: line.productId }, select: { quantity: true } })
          if (!current) { problems.push({ product: line.productName, message: 'No stock record.' }); continue }
          const res = await inventoryService.adjustStock({ productId: line.productId, quantity: roundMoney(current.quantity + variance, 3), reason: `Stock count ${take.takeNumber}` } as never, userId)
          if (!res.success) { problems.push({ product: line.productName, message: (res as { error?: { message?: string } }).error?.message ?? 'Could not adjust.' }); continue }
          adjusted += 1
        }
        await db.stockTakeLine.update({ where: { id: line.id }, data: { posted: true } })
      }
      if (problems.length === 0) {
        await db.stockTake.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } })
        await logAction({ userId, action: 'STOCK_TAKE_POSTED', entityType: 'StockTake', entityId: id, newValue: { takeNumber: take.takeNumber, adjusted } })
      }
      return { success: true, data: { adjusted, problems, closed: problems.length === 0 } }
    } catch (err) {
      return fail(err, 'Could not post the stock count.')
    }
  },

  async cancel(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const take = await db.stockTake.findUnique({ where: { id }, include: { lines: { select: { posted: true } } } })
      if (!take) throw new ServiceError('STK-001', 'Stock count not found.')
      if (take.status !== 'IN_PROGRESS') throw new ServiceError('STK-004', 'This count is closed.')
      if (take.lines.some((l) => l.posted)) throw new ServiceError('STK-007', 'Some differences were already posted, so this count cannot be cancelled. Post the rest to close it.')
      await db.stockTake.update({ where: { id }, data: { status: 'CANCELLED' } })
      await logAction({ userId, action: 'STOCK_TAKE_CANCELLED', entityType: 'StockTake', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err, 'Could not cancel the stock count.')
    }
  }
}
