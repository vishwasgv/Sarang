import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { allProblems } from '../invariants'

let handle: RealDb

describe('cancelling an invoice that already had a return', () => {
  beforeAll(async () => { handle = await openRealDb() }, 120000)
  afterAll(async () => { await handle.close() })

  it('is refused, so returned goods are never put back twice', async () => {
    const { getPrisma } = await import('../../database/db')
    const { billingService } = await import('../../services/billing.service')
    const { createReturn } = await import('../../services/returns.service')
    const db = getPrisma()
    const p = await db.product.create({ data: { productName: 'Lamp', sellingPrice: 100, costPrice: 60, taxRate: 18 } })
    await db.inventory.create({ data: { productId: p.id, quantity: 100 } })
    const c = await db.customer.create({ data: { customerName: 'Buyer' } })
    const sale = await billingService.createInvoice({ customerId: c.id, paymentMethod: 'CASH', items: [{ productId: p.id, quantity: 5, unitPrice: 100, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 } as never) as { success: boolean; data: { id: string } }
    expect(sale.success).toBe(true)
    expect((await db.inventory.findUnique({ where: { productId: p.id } }))!.quantity).toBe(95)
    const ret = await createReturn(sale.data.id, [{ productId: p.id, quantity: 2 }], 'faulty')
    expect(ret.success).toBe(true)
    expect((await db.inventory.findUnique({ where: { productId: p.id } }))!.quantity).toBe(97)
    const cancel = await billingService.cancelInvoice({ invoiceId: sale.data.id, reason: 'mistake' } as never)
    // Refused: cancelling on top of a return would put the returned goods back a second time.
    expect(cancel).toMatchObject({ success: false, error: { code: 'INVOC-019' } })
    expect((await db.inventory.findUnique({ where: { productId: p.id } }))!.quantity).toBe(97)
    expect(await allProblems()).toEqual([])
  })
})
