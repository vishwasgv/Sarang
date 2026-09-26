import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { allProblems, inventoryLedgerProblems } from '../invariants'

let handle: RealDb
let kitId = ''
let partA = ''
let partB = ''
let customerId = ''

async function db() {
  const { getPrisma } = await import('../../database/db')
  return getPrisma()
}

describe('kits: selling a kit takes its parts out of stock and their cost out of Inventory', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const d = await db()
    const { inventoryService } = await import('../../services/inventory.service')
    partA = (await d.product.create({ data: { productName: 'Part A', sellingPrice: 60, costPrice: 40, taxRate: 0 } })).id
    partB = (await d.product.create({ data: { productName: 'Part B', sellingPrice: 30, costPrice: 20, taxRate: 0 } })).id
    kitId = (await d.product.create({ data: { productName: 'Kit AB', sellingPrice: 100, costPrice: 0, taxRate: 0, isKit: true } })).id
    for (const id of [partA, partB]) await d.inventory.create({ data: { productId: id, quantity: 0, averageCost: 0 } })
    await d.kitComponent.create({ data: { kitProductId: kitId, componentProductId: partA, quantity: 2 } })
    await d.kitComponent.create({ data: { kitProductId: kitId, componentProductId: partB, quantity: 1 } })
    expect(await inventoryService.addStock({ productId: partA, quantity: 100, reason: 'opening', unitCost: 40 } as never)).toMatchObject({ success: true })
    expect(await inventoryService.addStock({ productId: partB, quantity: 100, reason: 'opening', unitCost: 20 } as never)).toMatchObject({ success: true })
    customerId = (await d.customer.create({ data: { customerName: 'Kit buyer' } })).id
  })
  afterAll(async () => { await handle.close() })

  it('a kit sale, a part return and a cancellation keep stock and Inventory equal', async () => {
    const { billingService } = await import('../../services/billing.service')
    const { createReturn } = await import('../../services/returns.service')
    const d = await db()
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
    const sale = await billingService.createInvoice({ customerId, paymentMethod: 'CASH', items: [{ productId: kitId, quantity: 3, unitPrice: 100, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 } as never) as { success: boolean; data: { id: string } }
    expect(sale, JSON.stringify(sale)).toMatchObject({ success: true })
    // 3 kits = 6 of A and 3 of B; cost 3 x (2 x 40 + 20) = 300
    expect((await d.inventory.findUnique({ where: { productId: partA } }))!.quantity).toBe(94)
    expect((await d.inventory.findUnique({ where: { productId: partB } }))!.quantity).toBe(97)
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
    const ret = await createReturn(sale.data.id, [{ productId: kitId, quantity: 1 }], 'one back')
    expect(ret.success, JSON.stringify(ret)).toBe(true)
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
    const second = await billingService.createInvoice({ customerId, paymentMethod: 'CASH', items: [{ productId: kitId, quantity: 2, unitPrice: 100, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 } as never) as { success: boolean; data: { id: string } }
    expect(second.success).toBe(true)
    const cancelled = await billingService.cancelInvoice({ invoiceId: second.data.id, reason: 'test' } as never)
    expect(cancelled).toMatchObject({ success: true })
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
    expect(await allProblems({ stockFromMovements: true })).toEqual([])
  })

  it('a production order that uses stocked parts and labour keeps stock and Inventory equal', async () => {
    const d = await db()
    const { createProductionOrder, startProductionOrder, completeProductionOrder } = await import('../../services/production-order.service')
    const finished = (await d.product.create({ data: { productName: 'Finished', sellingPrice: 400, costPrice: 0, taxRate: 0 } })).id
    await d.inventory.create({ data: { productId: finished, quantity: 0, averageCost: 0 } })
    const bom = await d.billOfMaterial.create({ data: { productId: finished, outputQty: 1 } })
    await d.billOfMaterialItem.create({ data: { bomId: bom.id, componentProductId: partA, quantityNeeded: 2 } })
    const order = await createProductionOrder({ productId: finished, plannedQty: 5 } as never) as { success: boolean; data?: { id: string } }
    expect(order, JSON.stringify(order)).toMatchObject({ success: true })
    const started = await startProductionOrder(order.data!.id)
    expect(started, JSON.stringify(started)).toMatchObject({ success: true })
    const done = await completeProductionOrder({ id: order.data!.id, producedQty: 5, laborCost: 100 })
    expect(done, JSON.stringify(done)).toMatchObject({ success: true })
    // 10 of Part A (cost 400) plus labour 100 make 5 finished units at 100 each.
    expect((await d.inventory.findUnique({ where: { productId: finished } }))!.averageCost).toBe(100)
    expect(await inventoryLedgerProblems(0.5)).toEqual([])
    expect(await allProblems({ stockFromMovements: true })).toEqual([])
  })
})
