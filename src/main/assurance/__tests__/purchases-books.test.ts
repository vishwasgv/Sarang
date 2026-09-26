import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

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
let productIds: string[] = []
let supplierIds: string[] = []

async function services() {
  const { billService } = await import('../../services/bill.service')
  const { supplierPaymentService } = await import('../../services/supplier-payment.service')
  const { getPrisma } = await import('../../database/db')
  return { billService, supplierPaymentService, db: getPrisma() }
}

describe('purchases and books: real database, invariants after every step', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { db } = await services()
    for (const [name, cost] of [['Flour', 40.5], ['Sugar', 55.25], ['Oil', 130]] as const) {
      const p = await db.product.create({ data: { productName: name, sellingPrice: cost * 1.4, costPrice: cost, taxRate: 5 } })
      await db.inventory.create({ data: { productId: p.id, quantity: 0, averageCost: cost } })
      productIds.push(p.id)
    }
    for (const n of ['Mill Co', 'Trader Bros']) supplierIds.push((await db.supplier.create({ data: { supplierName: n } })).id)
  }, 120000)
  afterAll(async () => { await handle.close() })

  for (const seed of [11, 12, 13, 14, 15, 16]) {
    it(`random mix of bills, payments, TDS, bulk payments, reversals and voids (seed ${seed})`, async () => {
      const { billService, supplierPaymentService, db } = await services()
      const rand = rng(seed)
      const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]
      const log: string[] = []
      for (let step = 0; step < 40; step++) {
        const op = rand()
        if (op < 0.4) {
          const n = 1 + Math.floor(rand() * 3)
          const items = Array.from({ length: n }, () => (rand() < 0.75
            ? { productId: pick(productIds), quantity: Math.round((1 + rand() * 20) * 100) / 100, unitCost: Math.round((10 + rand() * 300) * 100) / 100, discountAmount: rand() < 0.3 ? Math.round(rand() * 15 * 100) / 100 : 0, taxRate: pick([0, 5, 12, 18] as const) }
            : { serviceDescription: 'Transport', quantity: 1, unitCost: Math.round((50 + rand() * 500) * 100) / 100, discountAmount: 0, taxRate: pick([0, 18] as const) }))
          const res = await billService.createBill({ supplierId: pick(supplierIds), items, isReverseCharge: false, pricesIncludeTax: rand() < 0.3 } as never)
          log.push(`bill ${JSON.stringify((res as { success: boolean }).success)}${(res as { success: boolean; error?: { code: string } }).success ? '' : ' ' + (res as { error?: { code: string } }).error?.code}`)
        } else if (op < 0.65) {
          const open = await db.bill.findMany({ where: { status: { not: 'VOID' }, balanceAmount: { gt: 0.01 } } })
          if (open.length) {
            const b = pick(open)
            const amount = Math.round(b.balanceAmount * (rand() < 0.5 ? 1 : rand()) * 100) / 100
            const tdsAmount = rand() < 0.3 ? Math.round(amount * 0.1 * 100) / 100 : 0
            if (amount > 0) {
              const res = await supplierPaymentService.recordSupplierPayment({ billId: b.id, paymentMethod: pick(['CASH', 'UPI', 'BANK_TRANSFER'] as const), amount, tdsAmount } as never)
              log.push(`pay ${b.billNumber} ${amount} tds ${tdsAmount} ${JSON.stringify((res as { success: boolean }).success)}`)
            }
          }
        } else if (op < 0.75) {
          const open = await db.bill.findMany({ where: { status: { not: 'VOID' }, balanceAmount: { gt: 1 } } })
          const bySupplier = new Map<string, typeof open>()
          for (const b of open) bySupplier.set(b.supplierId, [...(bySupplier.get(b.supplierId) ?? []), b])
          const group = [...bySupplier.values()].find((g) => g.length >= 2)
          if (group) {
            const allocations = group.slice(0, 2).map((b) => ({ billId: b.id, amount: Math.floor(b.balanceAmount * 60) / 100 })).filter((a) => a.amount > 0)
            if (allocations.length === 2) {
              const res = await supplierPaymentService.recordBulkPayment({ supplierId: group[0].supplierId, paymentMethod: 'BANK_TRANSFER', allocations } as never)
              log.push(`bulk ${JSON.stringify((res as { success: boolean }).success)}`)
            }
          }
        } else if (op < 0.88) {
          const live = await db.supplierPayment.findMany({ where: { isReversed: false, bill: { status: { not: 'VOID' } } } })
          if (live.length) {
            const p = pick(live)
            const res = await supplierPaymentService.reverseSupplierPayment({ paymentId: p.id, reason: 'assurance test' } as never)
            log.push(`reverse ${p.amount} ${JSON.stringify((res as { success: boolean }).success)}`)
          }
        } else {
          const live = await db.bill.findMany({ where: { status: { not: 'VOID' } } })
          if (live.length) {
            const b = pick(live)
            const res = await billService.voidBill(b.id, 'assurance test')
            log.push(`void ${b.billNumber} ${JSON.stringify((res as { success: boolean }).success)}`)
          }
        }
        const problems = await allProblems()
        if (problems.length) throw new Error(`after step ${step} (${log[log.length - 1]}):\n${problems.join('\n')}\nlog:\n${log.join('\n')}`)
      }
      const ok = (prefix: string) => log.filter((l) => l.startsWith(prefix) && l.endsWith('true')).length
      expect(ok('bill')).toBeGreaterThan(5)
      console.log(`seed ${seed}: bills ${ok('bill')}, pay ${ok('pay')}, bulk ${ok('bulk')}, reverse ${ok('reverse')}, void ${ok('void')} of ${log.length}; fails: ${log.filter((l) => l.endsWith('false') || /false [A-Z]/.test(l)).slice(0, 3).join(' | ')}`)
    }, 120000)
  }
})
