import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { inventoryLedgerProblems, allProblems } from '../invariants'

let handle: RealDb

describe('opening stock for an install that already holds goods', () => {
  beforeAll(async () => { handle = await openRealDb() })
  afterAll(async () => { await handle.close() })

  it('brings existing stock into the Inventory account once, then a sale leaves it at the right value', async () => {
    const { getPrisma } = await import('../../database/db')
    const { ensureOpeningStockPosted } = await import('../../services/stock-opening-ledger.service')
    const { billingService } = await import('../../services/billing.service')
    const db = getPrisma()
    const p = await db.product.create({ data: { productName: 'Old stock', sellingPrice: 150, costPrice: 90, taxRate: 0 } })
    await db.inventory.create({ data: { productId: p.id, quantity: 40, averageCost: 90 } })
    await db.setting.deleteMany({ where: { settingKey: 'stock_ledger_opening_posted' } })
    await ensureOpeningStockPosted()
    await ensureOpeningStockPosted()
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
    const sale = await billingService.createInvoice({ paymentMethod: 'CASH', items: [{ productId: p.id, quantity: 5, unitPrice: 150, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 } as never) as { success: boolean }
    expect(sale.success).toBe(true)
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
    expect(await allProblems({ stockFromMovements: false })).toEqual([])
    const n = await db.journalEntry.count({ where: { sourceType: 'STOCK_OPENING' } })
    expect(n).toBe(1)
  })
})
