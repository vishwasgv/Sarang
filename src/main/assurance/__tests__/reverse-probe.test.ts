import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { receivableLedgerProblems } from '../invariants'

let handle: RealDb
let productId = ''
let customerId = ''

async function svc() {
  const { billingService } = await import('../../services/billing.service')
  const { paymentService } = await import('../../services/payment.service')
  const { getPrisma } = await import('../../database/db')
  return { billingService, paymentService, db: getPrisma() }
}

describe('reversing each kind of payment keeps the receivable ledger right', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { db } = await svc()
    const p = await db.product.create({ data: { productName: 'W', sellingPrice: 100, costPrice: 60, taxRate: 18 } })
    await db.inventory.create({ data: { productId: p.id, quantity: 1000, averageCost: 60 } })
    productId = p.id
    customerId = (await db.customer.create({ data: { customerName: 'C' } })).id
  }, 120000)
  afterAll(async () => { await handle.close() })

  async function sale(method: string) {
    const { billingService } = await svc()
    const r = await billingService.createInvoice({ customerId, paymentMethod: method, items: [{ productId, quantity: 2, unitPrice: 100, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 } as never)
    expect(r).toMatchObject({ success: true })
    return r as { data: { id: string } }
  }

  it('cash sale payment', async () => {
    const { paymentService, db } = await svc()
    const inv = await sale('CASH')
    const pay = await db.payment.findFirst({ where: { invoiceId: inv.data.id } })
    expect(pay).toBeTruthy()
    expect(await receivableLedgerProblems()).toEqual([])
    const r = await paymentService.reversePayment({ paymentId: pay!.id, reason: 'x' } as never)
    expect(r).toMatchObject({ success: true })
    expect(await receivableLedgerProblems()).toEqual([])
  })

  it('later single payment', async () => {
    const { paymentService, db } = await svc()
    const inv = await sale('CREDIT')
    await paymentService.recordPayment({ invoiceId: inv.data.id, paymentMethod: 'CASH', amount: 50 } as never)
    const pay = await db.payment.findFirst({ where: { invoiceId: inv.data.id } })
    await paymentService.reversePayment({ paymentId: pay!.id, reason: 'x' } as never)
    expect(await receivableLedgerProblems()).toEqual([])
  })

  it('split payment legs', async () => {
    const { paymentService, db } = await svc()
    const inv = await sale('CREDIT')
    await paymentService.recordSplitPayment({ invoiceId: inv.data.id, legs: [{ paymentMethod: 'CASH', amount: 50 }, { paymentMethod: 'UPI', amount: 50 }] } as never)
    expect(await receivableLedgerProblems()).toEqual([])
    const pays = await db.payment.findMany({ where: { invoiceId: inv.data.id } })
    for (const p of pays) {
      await paymentService.reversePayment({ paymentId: p.id, reason: 'x' } as never)
      expect(await receivableLedgerProblems()).toEqual([])
    }
  })
})
