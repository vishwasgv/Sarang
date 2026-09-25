import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { inventoryService } from './inventory.service'
import { getProductCostsBatch } from './valuation.service'
import { getCurrencyDecimals, prorateAmount, roundMoney, sumMoney } from '../../shared/utils/money'

// Stock journal: items taken out of stock and items brought into stock in one entry (repacking, assembling a
// kit by hand, converting one item into another). The value of what went out becomes the value of what came in,
// shared by quantity, so the stock value in the books does not change.

export interface StockJournalLineInput {
  kind: 'OUT' | 'IN'
  productId: string
  quantity: number
}

async function decimalsOf(): Promise<number> {
  const profile = await getPrisma().businessProfile.findFirst({ select: { currencyCode: true } })
  return getCurrencyDecimals(profile?.currencyCode)
}

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

async function view(id: string) {
  const journal = await getPrisma().stockJournal.findUnique({ where: { id }, include: { lines: { orderBy: [{ kind: 'asc' }, { productName: 'asc' }] } } })
  if (!journal) throw new ServiceError('SJ-001', 'Stock journal not found.')
  return {
    id: journal.id, journalNumber: journal.journalNumber, notes: journal.notes, createdAt: journal.createdAt.toISOString(),
    lines: journal.lines.map((l) => ({ id: l.id, kind: l.kind, productId: l.productId, productName: l.productName, quantity: l.quantity, unitCost: l.unitCost }))
  }
}

export const stockJournalService = {
  async create(p: { notes?: string; lines: StockJournalLineInput[] }, userId?: string) {
    try {
      const db = getPrisma()
      const outs = p.lines.filter((l) => l.kind === 'OUT')
      const ins = p.lines.filter((l) => l.kind === 'IN')
      if (outs.length === 0) throw new ServiceError('SJ-002', 'Add at least one item taken out of stock.')
      if (ins.length === 0) throw new ServiceError('SJ-003', 'Add at least one item brought into stock.')
      for (const l of p.lines) {
        if (!Number.isFinite(l.quantity) || l.quantity <= 0) throw new ServiceError('SJ-004', 'Every quantity must be more than zero.')
      }
      const ids = Array.from(new Set(p.lines.map((l) => l.productId)))
      const products = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, productName: true, productType: true, isActive: true } })
      const byId = new Map(products.map((x) => [x.id, x]))
      for (const id of ids) {
        const prod = byId.get(id)
        if (!prod || !prod.isActive) throw new ServiceError('SJ-005', 'One of the items was not found.')
        if (prod.productType !== 'STANDARD') throw new ServiceError('SJ-006', `${prod.productName} does not hold stock, so it cannot be used here.`)
      }
      if (outs.some((o) => ins.some((i) => i.productId === o.productId))) throw new ServiceError('SJ-007', 'An item cannot be both taken out and brought in.')

      const decimals = await decimalsOf()
      const costs = await getProductCostsBatch(ids)
      const outValue = sumMoney(outs.map((o) => prorateAmount(costs.get(o.productId) ?? 0, o.quantity, 1, decimals)), decimals)
      const inQuantity = sumMoney(ins.map((i) => i.quantity), 3)
      const inUnitCost = roundMoney(outValue / inQuantity, 4)

      const id = await db.$transaction(async (tx) => {
        const journalNumber = await generateSequenceNumber(tx, 'stock_journal_sequence', 'SJ', 5, async () => {
          const last = await tx.stockJournal.findFirst({ orderBy: { createdAt: 'desc' }, select: { journalNumber: true } })
          return last ? parseInt(last.journalNumber.replace(/^SJ-/, ''), 10) : 0
        })
        const journal = await tx.stockJournal.create({
          data: {
            journalNumber, notes: p.notes?.trim() || null, createdById: userId ?? null,
            lines: {
              create: p.lines.map((l) => ({
                kind: l.kind, productId: l.productId, productName: byId.get(l.productId)?.productName ?? '', quantity: l.quantity,
                unitCost: l.kind === 'OUT' ? (costs.get(l.productId) ?? 0) : inUnitCost
              }))
            }
          }
        })
        for (const o of outs) {
          await inventoryService.reduceStockTx(tx, o.productId, o.quantity, `Stock journal ${journalNumber} (taken out)`, 'STOCK_JOURNAL', journal.id, userId)
        }
        for (const i of ins) {
          await inventoryService.addStockTx(tx, i.productId, i.quantity, inUnitCost, `Stock journal ${journalNumber} (brought in)`, 'STOCK_JOURNAL', journal.id, userId, { sourceType: 'STOCK_JOURNAL', sourceId: journal.id })
        }
        return journal.id
      }, { timeout: 30000 })

      await logAction({ userId, action: 'STOCK_JOURNAL_CREATED', entityType: 'StockJournal', entityId: id, newValue: { outValue, lines: p.lines.length } })
      return { success: true, data: await view(id) }
    } catch (err) {
      return fail(err)
    }
  },

  async get(id: string) {
    try { return { success: true, data: await view(id) } } catch (err) { return fail(err) }
  },

  async list() {
    const rows = await getPrisma().stockJournal.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { lines: { select: { kind: true, productName: true, quantity: true } } } })
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id, journalNumber: r.journalNumber, notes: r.notes, createdAt: r.createdAt.toISOString(),
        out: r.lines.filter((l) => l.kind === 'OUT').map((l) => `${l.productName} × ${l.quantity}`),
        in: r.lines.filter((l) => l.kind === 'IN').map((l) => `${l.productName} × ${l.quantity}`)
      }))
    }
  }
}
