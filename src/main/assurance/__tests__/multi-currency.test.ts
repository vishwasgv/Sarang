import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { allProblems } from '../invariants'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

let handle: RealDb
let productId = ''
let customerId = ''

describe('multi-currency: rates that do not divide evenly, settled at a different rate', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { getPrisma } = await import('../../database/db')
    const db = getPrisma()
    productId = (await db.product.create({ data: { productName: 'Export item', sellingPrice: 1000, costPrice: 400, taxRate: 0 } })).id
    await db.inventory.create({ data: { productId, quantity: 100000 } })
    customerId = (await db.customer.create({ data: { customerName: 'Overseas buyer' } })).id
  })
  afterAll(async () => { await handle.close() })

  for (const seed of [31, 32, 33, 34]) {
    it(`invoices in USD settled at a moved rate, some reversed (seed ${seed})`, async () => {
      const { getPrisma } = await import('../../database/db')
      const { billingService } = await import('../../services/billing.service')
      const { paymentService } = await import('../../services/payment.service')
      const db = getPrisma()
      const rand = rng(seed)
      let settled = 0
      let gains = 0
      let losses = 0
      for (let i = 0; i < 12; i++) {
        const rate = Math.round((78 + rand() * 12) * 10000) / 10000
        const res = await billingService.createInvoice({
          customerId, paymentMethod: 'CREDIT',
          items: [{ productId, quantity: Math.round((1 + rand() * 9) * 100) / 100, unitPrice: Math.round((rate * (5 + rand() * 300)) * 100) / 100, discountAmount: 0, isFreeOfCost: false }],
          globalDiscount: 0, foreignCurrencyCode: 'USD', foreignExchangeRate: rate
        } as never) as { success: boolean; data?: { id: string } }
        expect(res.success).toBe(true)
        const inv = await db.invoice.findUnique({ where: { id: res.data!.id } })
        // The foreign total is kept to whole cents, so times the rate it lands on the base total within half a cent of the rate.
        expect(Math.abs((inv!.foreignTotalAmount ?? 0) * rate - inv!.totalAmount)).toBeLessThan(rate * 0.005 + 0.02)
        expect(await allProblems()).toEqual([])

        if (rand() < 0.75) {
          const settlementRate = Math.round((rate + (rand() * 6 - 3)) * 10000) / 10000
          const s = await paymentService.recordForeignCurrencySettlement({ invoiceId: inv!.id, foreignAmount: inv!.foreignTotalAmount!, settlementRate, paymentMethod: 'UPI' } as never) as { success: boolean; error?: { code: string } }
          expect(s, JSON.stringify(s)).toMatchObject({ success: true })
          settled++
          if (settlementRate > rate) gains++
          if (settlementRate < rate) losses++
          const after = await db.invoice.findUnique({ where: { id: inv!.id } })
          expect(after!.balanceAmount).toBe(0)
          expect(after!.paymentStatus).toBe('PAID')
          expect(await allProblems()).toEqual([])
          if (rand() < 0.4) {
            const pay = await db.payment.findFirst({ where: { invoiceId: inv!.id, isReversed: false } })
            const r = await paymentService.reversePayment({ paymentId: pay!.id, reason: 'assurance' } as never)
            expect(r).toMatchObject({ success: true })
            const back = await db.invoice.findUnique({ where: { id: inv!.id } })
            expect(Math.abs(back!.balanceAmount - back!.totalAmount)).toBeLessThan(0.02)
            expect(await allProblems()).toEqual([])
          }
        }
      }
      console.log(`seed ${seed}: settled ${settled} (gain ${gains}, loss ${losses})`)
      expect(settled).toBeGreaterThan(3)
    })
  }
})
