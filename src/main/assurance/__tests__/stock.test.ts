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
let productIds: string[] = []
let customerId = ''
let locationIds: string[] = []

async function services() {
  const { billingService } = await import('../../services/billing.service')
  const { inventoryService } = await import('../../services/inventory.service')
  const { getPrisma } = await import('../../database/db')
  return { billingService, inventoryService, db: getPrisma() }
}

describe('stock: quantity always equals the sum of movements and the sum over locations', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { db, inventoryService } = await services()
    const defaults = await db.location.findMany()
    if (!defaults.some((l) => l.isDefault)) await db.location.create({ data: { name: 'Main', isDefault: true } })
    await db.location.create({ data: { name: 'Godown' } })
    locationIds = (await db.location.findMany({ orderBy: { isDefault: 'desc' } })).map((l) => l.id)
    for (const [name, price] of [['Tea', 120], ['Biscuit', 25.5], ['Soap', 48]] as const) {
      const p = await db.product.create({ data: { productName: name, sellingPrice: price, costPrice: price * 0.6, taxRate: 12 } })
      await db.inventory.create({ data: { productId: p.id, quantity: 0, averageCost: price * 0.6 } })
      productIds.push(p.id)
      const r = await inventoryService.addStock({ productId: p.id, quantity: 200, reason: 'opening', unitCost: price * 0.6 } as never)
      expect(r).toMatchObject({ success: true })
    }
    customerId = (await db.customer.create({ data: { customerName: 'Stock Tester' } })).id
  }, 120000)
  afterAll(async () => { await handle.close() })

  it('starts consistent', async () => {
    expect(await allProblems({ stockFromMovements: true })).toEqual([])
  })

  for (const seed of [21, 22, 23, 24, 25, 26]) {
    it(`random sales, cancellations, returns, additions, recounts and transfers (seed ${seed})`, async () => {
      const { billingService, inventoryService, db } = await services()
      const { createReturn } = await import('../../services/returns.service')
      const rand = rng(seed)
      const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]
      const log: string[] = []
      for (let step = 0; step < 40; step++) {
        const op = rand()
        if (op < 0.35) {
          const res = await billingService.createInvoice({
            customerId, paymentMethod: pick(['CASH', 'CREDIT'] as const),
            items: [{ productId: pick(productIds), quantity: Math.floor(1 + rand() * 6), unitPrice: 50, discountAmount: 0, isFreeOfCost: false }],
            globalDiscount: 0
          } as never)
          log.push(`sale ${(res as { success: boolean }).success}`)
        } else if (op < 0.5) {
          const live = await db.invoice.findMany({ where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' } } })
          if (live.length) {
            const inv = pick(live)
            const res = await billingService.cancelInvoice({ invoiceId: inv.id, reason: 'assurance' } as never)
            log.push(`cancel ${(res as { success: boolean }).success}`)
          }
        } else if (op < 0.65) {
          const cands = await db.invoice.findMany({ where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' } }, include: { items: true } })
          if (cands.length) {
            const inv = pick(cands)
            const it = inv.items[0]
            const res = await createReturn(inv.id, [{ productId: it.productId, quantity: Math.max(1, Math.floor(it.quantity / 2)) }], 'assurance')
            log.push(`return ${res.success}`)
          }
        } else if (op < 0.75) {
          const res = await inventoryService.addStock({ productId: pick(productIds), quantity: Math.floor(1 + rand() * 50), reason: 'purchase', unitCost: 10 + rand() * 30 } as never)
          log.push(`add ${(res as { success: boolean }).success}`)
        } else if (op < 0.87) {
          const p = pick(productIds)
          const cur = await db.inventory.findUnique({ where: { productId: p } })
          const res = await inventoryService.adjustStock({ productId: p, quantity: Math.max(0, Math.round((cur!.quantity + (rand() * 20 - 10)) * 100) / 100), reason: 'recount' } as never)
          log.push(`adjust ${(res as { success: boolean }).success}`)
        } else {
          const p = pick(productIds)
          const [from, to] = rand() < 0.5 ? [locationIds[0], locationIds[1]] : [locationIds[1], locationIds[0]]
          const res = await inventoryService.transferStock({ productId: p, quantity: Math.floor(1 + rand() * 10), fromLocationId: from, toLocationId: to })
          log.push(`transfer ${(res as { success: boolean }).success}`)
        }
        const problems = await allProblems({ stockFromMovements: true })
        if (problems.length) throw new Error(`after step ${step} (${log[log.length - 1]}):\n${problems.join('\n')}\nlog:\n${log.join('\n')}`)
      }
      const ok = (p: string) => log.filter((l) => l.startsWith(p) && l.endsWith('true')).length
      expect(ok('sale')).toBeGreaterThan(3)
      console.log(`seed ${seed}: sale ${ok('sale')}, cancel ${ok('cancel')}, return ${ok('return')}, add ${ok('add')}, adjust ${ok('adjust')}, transfer ${ok('transfer')} of ${log.length}`)
    }, 120000)
  }
})
