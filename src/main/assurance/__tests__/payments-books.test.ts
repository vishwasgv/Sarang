import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { allProblems } from '../invariants'

// Small deterministic generator so a failing run can be replayed from its seed.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

let handle: RealDb
let productIds: string[] = []
let customerIds: string[] = []

async function services() {
  const { billingService } = await import('../../services/billing.service')
  const { paymentService } = await import('../../services/payment.service')
  const { getPrisma } = await import('../../database/db')
  return { billingService, paymentService, db: getPrisma() }
}

describe('payments and books: real database, invariants after every step', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { db } = await services()
    for (const [name, price, tax] of [['Widget', 333.33, 18], ['Gadget', 99.99, 5], ['Rice 1kg', 61.5, 0], ['Service', 1499, 18]] as const) {
      const p = await db.product.create({ data: { productName: name, sellingPrice: price, costPrice: price * 0.6, taxRate: tax } })
      await db.inventory.create({ data: { productId: p.id, quantity: 100000, averageCost: price * 0.6 } })
      productIds.push(p.id)
    }
    for (const n of ['Asha', 'Ravi', 'Meera']) customerIds.push((await db.customer.create({ data: { customerName: n } })).id)
  }, 120000)
  afterAll(async () => { await handle.close() })

  it('a credit sale leaves the books consistent', async () => {
    const { billingService } = await services()
    const res = await billingService.createInvoice({
      customerId: customerIds[0],
      paymentMethod: 'CREDIT',
      items: [{ productId: productIds[0], quantity: 3, unitPrice: 333.33, discountAmount: 0, isFreeOfCost: false }],
      globalDiscount: 0
    } as never)
    expect(res).toMatchObject({ success: true })
    expect(await allProblems()).toEqual([])
  })

  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`random mix of sales, part payments, split payments, reversals and cancellations (seed ${seed})`, async () => {
      const { billingService, paymentService, db } = await services()
      const rand = rng(seed)
      const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]
      const log: string[] = []
      for (let step = 0; step < 40; step++) {
        const op = rand()
        if (op < 0.4) {
          const n = 1 + Math.floor(rand() * 3)
          const items = Array.from({ length: n }, () => ({
            productId: pick(productIds),
            quantity: Math.round((0.25 + rand() * 6) * 100) / 100,
            unitPrice: Math.round((5 + rand() * 900) * 100) / 100,
            discountAmount: rand() < 0.3 ? Math.round(rand() * 20 * 100) / 100 : 0,
            isFreeOfCost: false
          }))
          const method = pick(['CASH', 'UPI', 'CARD', 'CREDIT', 'CREDIT'] as const)
          const res = await billingService.createInvoice({
            customerId: rand() < 0.85 ? pick(customerIds) : undefined,
            paymentMethod: method,
            items,
            globalDiscount: rand() < 0.25 ? Math.round(rand() * 30 * 100) / 100 : 0,
            pricesIncludeTax: rand() < 0.3
          } as never)
          log.push(`sale ${method} ${JSON.stringify((res as { success: boolean }).success)}`)
        } else if (op < 0.65) {
          const open = await db.invoice.findMany({ where: { status: { not: 'CANCELLED' }, balanceAmount: { gt: 0.01 } } })
          if (open.length) {
            const inv = pick(open)
            const amount = Math.round(inv.balanceAmount * (rand() < 0.5 ? 1 : rand()) * 100) / 100
            if (amount > 0) {
              const res = await paymentService.recordPayment({ invoiceId: inv.id, paymentMethod: pick(['CASH', 'UPI', 'CARD'] as const), amount } as never)
              log.push(`pay ${inv.invoiceNumber} ${amount} ${JSON.stringify((res as { success: boolean }).success)}`)
            }
          }
        } else if (op < 0.75) {
          const open = await db.invoice.findMany({ where: { status: { not: 'CANCELLED' }, balanceAmount: { gt: 1 } } })
          if (open.length) {
            const inv = pick(open)
            const half = Math.floor(inv.balanceAmount * 50) / 100
            if (half > 0) {
              const res = await paymentService.recordSplitPayment({ invoiceId: inv.id, legs: [{ paymentMethod: 'CASH', amount: half }, { paymentMethod: 'UPI', amount: half }] } as never)
              log.push(`split ${inv.invoiceNumber} ${half}x2 ${JSON.stringify((res as { success: boolean }).success)}`)
            }
          }
        } else if (op < 0.82) {
          const cands = await db.invoice.findMany({ where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' } }, include: { items: true } })
          if (cands.length) {
            const inv = pick(cands)
            const it = inv.items[0]
            if (it) {
              const { createReturn } = await import('../../services/returns.service')
              const qty = Math.round(it.quantity * (0.2 + rand() * 0.5) * 100) / 100
              const res = await createReturn(inv.id, [{ productId: it.productId, quantity: qty }], 'assurance test')
              log.push(`return ${inv.invoiceNumber} ${qty} ${JSON.stringify(res.success)}${res.success ? '' : ' ' + res.error?.code}`)
            }
          }
        } else if (op < 0.88) {
          const live = await db.payment.findMany({ where: { isReversed: false, invoice: { status: { not: 'CANCELLED' } } } })
          if (live.length) {
            const p = pick(live)
            const res = await paymentService.reversePayment({ paymentId: p.id, reason: 'assurance test' } as never)
            log.push(`reverse ${p.amount} ${JSON.stringify((res as { success: boolean }).success)}`)
          }
        } else {
          const live = await db.invoice.findMany({ where: { status: { not: 'CANCELLED' } } })
          if (live.length) {
            const inv = pick(live)
            const res = await billingService.cancelInvoice({ invoiceId: inv.id, reason: 'assurance test' } as never)
            log.push(`cancel ${inv.invoiceNumber} ${JSON.stringify((res as { success: boolean }).success)}`)
          }
        }
        const problems = await allProblems()
        if (problems.length && process.env.ASSURE_DEBUG) {
          const last = log[log.length - 1] ?? ''
          const m = /INV-\d{4}-\d+/.exec(last)
          if (m) {
            const inv = await db.invoice.findFirst({ where: { invoiceNumber: m[0] }, include: { payments: true } })
            const rets = await db.invoice.findMany({ where: { originalInvoiceId: inv!.id }, select: { id: true, invoiceNumber: true, totalAmount: true } })
            const ids = [inv!.id, ...inv!.payments.map((p) => p.id), ...rets.map((r) => r.id)]
            const je = await db.journalEntry.findMany({ where: { sourceId: { in: ids } }, include: { lines: { include: { account: true } } } })
            console.log('DEBUG invoice', JSON.stringify({ inv: { total: inv!.totalAmount, paid: inv!.paidAmount, bal: inv!.balanceAmount, status: inv!.status, customerId: inv!.customerId }, pays: inv!.payments.map((p) => [p.amount, p.isReversed]), rets }))
            console.log('DEBUG entries', JSON.stringify(je.map((e) => [e.sourceType, e.isReversed, e.lines.map((l) => `${l.account.accountCode} D${l.debitAmount} C${l.creditAmount}`)])))
            const led = await db.customerLedger.findMany({ where: { customerId: inv!.customerId ?? '' }, orderBy: { createdAt: 'asc' } })
            console.log('DEBUG ledger', JSON.stringify(led.map((l) => [l.referenceType, l.debitAmount, l.creditAmount])))
          }
        }
        if (problems.length) throw new Error(`after step ${step} (${log[log.length - 1]}):\n${problems.join('\n')}\nlog:\n${log.join('\n')}`)
      }
      const ok = (prefix: string) => log.filter((l) => l.startsWith(prefix) && l.endsWith('true')).length
      // Guard against a suite that passes only because every operation was rejected.
      expect(ok('sale')).toBeGreaterThan(5)
      expect(ok('pay') + ok('split')).toBeGreaterThan(2)
      console.log(`seed ${seed}: return ${ok('return')}, sales ${ok('sale')}, pay ${ok('pay')}, split ${ok('split')}, reverse ${ok('reverse')}, cancel ${ok('cancel')} of ${log.length}`)
    }, 120000)
  }
})
