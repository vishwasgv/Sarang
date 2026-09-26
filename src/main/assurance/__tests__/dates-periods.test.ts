import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { allProblems } from '../invariants'

let handle: RealDb
let productId = ''
let customerId = ''

// Only Date is faked: the database driver still needs real timers.
function at(y: number, m: number, d: number, h = 12, min = 0, s = 0) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(y, m - 1, d, h, min, s))
}

async function sell(qty = 1) {
  const { billingService } = await import('../../services/billing.service')
  return billingService.createInvoice({ customerId, paymentMethod: 'CREDIT', items: [{ productId, quantity: qty, unitPrice: 100, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 } as never) as Promise<{ success: boolean; data?: { id: string }; error?: { code: string } }>
}

describe('dates and periods (fixed clock)', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { getPrisma } = await import('../../database/db')
    const db = getPrisma()
    productId = (await db.product.create({ data: { productName: 'Item', sellingPrice: 100, costPrice: 50, taxRate: 0 } })).id
    await db.inventory.create({ data: { productId, quantity: 100000 } })
    customerId = (await db.customer.create({ data: { customerName: 'C' } })).id
  })
  afterEach(() => { vi.useRealTimers() })
  afterAll(async () => { vi.useRealTimers(); await handle.close() })

  it('leap day and month/year boundaries land in the right day, month and financial year', async () => {
    const { reportService } = await import('../../services/report.service')
    const stamps: Array<[number, number, number, number, number, number]> = [
      [2028, 2, 29, 23, 59, 59], [2028, 3, 1, 0, 0, 1],
      [2027, 3, 31, 23, 59, 59], [2027, 4, 1, 0, 0, 1],
      [2026, 12, 31, 23, 59, 59], [2027, 1, 1, 0, 0, 1]
    ]
    for (const st of stamps) {
      at(...st)
      const r = await sell()
      expect(r.success, JSON.stringify(r)).toBe(true)
      // The database stamps rows with its own clock, so the invoice date is set to the fixed moment here.
      const { getPrisma } = await import('../../database/db')
      await getPrisma().invoice.update({ where: { id: r.data!.id }, data: { invoiceDate: new Date(...([st[0], st[1] - 1, st[2], st[3], st[4], st[5]] as [number, number, number, number, number, number])) } })
    }
    vi.useRealTimers()
    const count = async (from: string, to: string) => (await reportService.generateSalesReport({ dateFrom: from, dateTo: to })).summary.totalInvoices
    expect(await count('2028-02-29', '2028-02-29')).toBe(1)
    expect(await count('2028-03-01', '2028-03-01')).toBe(1)
    expect(await count('2027-03-31', '2027-03-31')).toBe(1)
    expect(await count('2027-04-01', '2027-04-01')).toBe(1)
    // Financial year 2026-27 (1 April to 31 March) holds the 31 March 2027 sale and the two 2026-12 / 2027-01 sales, not the 1 April one.
    expect(await count('2026-04-01', '2027-03-31')).toBe(3)
    expect(await count('2027-04-01', '2028-03-31')).toBe(3)
    const byMonth = await reportService.generateSalesReport({ dateFrom: '2026-12-01', dateTo: '2027-01-31', groupBy: 'month' })
    expect(byMonth.groups.map((g) => g.label).sort()).toEqual(['2026-12', '2027-01'])
    expect(byMonth.groups.every((g) => g.invoiceCount === 1)).toBe(true)
    expect(await allProblems()).toEqual([])
  })

  it('a lock date closes the whole day and every later stamp stays open', async () => {
    const { getPrisma } = await import('../../database/db')
    const { paymentService } = await import('../../services/payment.service')
    const db = getPrisma()
    at(2029, 5, 10, 9)
    const open = await sell()
    expect(open.success).toBe(true)
    const profile = (await db.businessProfile.findFirst()) ?? (await db.businessProfile.create({ data: { businessName: 'Test Shop', businessType: 'RETAIL' } }))
    expect(profile, 'a business profile is needed to hold the lock date').toBeTruthy()
    if (!profile) return
    await db.businessProfile.update({ where: { id: profile.id }, data: { lockDate: new Date(2029, 4, 10, 0, 0, 0) } })
    at(2029, 5, 10, 23, 59)
    const locked = await sell()
    expect(locked).toMatchObject({ success: false, error: { code: 'LOCK-001' } })
    const pay = await paymentService.recordPayment({ invoiceId: open.data!.id, paymentMethod: 'CASH', amount: 10 } as never)
    expect(pay).toMatchObject({ success: false, error: { code: 'LOCK-001' } })
    at(2029, 5, 11, 0, 0, 1)
    const next = await sell()
    expect(next.success).toBe(true)
    await db.businessProfile.update({ where: { id: profile.id }, data: { lockDate: null } })
    vi.useRealTimers()
    expect(await allProblems()).toEqual([])
  })

  it('a payment dated on the last second of a month is reported in that month', async () => {
    const { paymentService } = await import('../../services/payment.service')
    const { reportService } = await import('../../services/report.service')
    at(2030, 1, 31, 23, 59, 58)
    const inv = await sell(2)
    expect(inv.success).toBe(true)
    at(2030, 1, 31, 23, 59, 59)
    expect(await paymentService.recordPayment({ invoiceId: inv.data!.id, paymentMethod: 'CASH', amount: 50 } as never)).toMatchObject({ success: true })
    const { getPrisma } = await import('../../database/db')
    await getPrisma().invoice.update({ where: { id: inv.data!.id }, data: { invoiceDate: new Date(2030, 0, 31, 23, 59, 58) } })
    await getPrisma().payment.updateMany({ where: { invoiceId: inv.data!.id }, data: { paymentDate: new Date(2030, 0, 31, 23, 59, 59) } })
    vi.useRealTimers()
    const jan = await reportService.generateSalesReport({ dateFrom: '2030-01-01', dateTo: '2030-01-31', dateGroupBy: 'paymentDate' })
    const feb = await reportService.generateSalesReport({ dateFrom: '2030-02-01', dateTo: '2030-02-28', dateGroupBy: 'paymentDate' })
    expect(jan.summary.totalInvoices).toBe(1)
    expect(feb.summary.totalInvoices).toBe(0)
  })
})
