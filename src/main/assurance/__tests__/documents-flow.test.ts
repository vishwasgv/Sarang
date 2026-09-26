import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { allProblems, inventoryLedgerProblems } from '../invariants'

let handle: RealDb
let productId = ''
let supplierId = ''
let customerId = ''
const admin = { id: '' }

async function db() {
  const { getPrisma } = await import('../../database/db')
  return getPrisma()
}

async function nets(): Promise<Record<string, number>> {
  const lines = await (await db()).journalEntryLine.findMany({ include: { account: { select: { accountCode: true } } } })
  const out: Record<string, number> = {}
  for (const l of lines) out[l.account.accountCode] = Math.round(((out[l.account.accountCode] ?? 0) + l.debitAmount - l.creditAmount) * 100) / 100
  return out
}

describe('document flows against the real database', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const d = await db()
    productId = (await d.product.create({ data: { productName: 'Flow item', sellingPrice: 250, costPrice: 100, taxRate: 18 } })).id
    await d.inventory.create({ data: { productId, quantity: 0, averageCost: 0 } })
    supplierId = (await d.supplier.create({ data: { supplierName: 'Flow supplier' } })).id
    customerId = (await d.customer.create({ data: { customerName: 'Flow customer' } })).id
    const role = (await d.role.findFirst({ where: { roleName: 'Admin' } })) ?? (await d.role.findFirst())
    const u = (await d.user.findFirst()) ?? (await d.user.create({ data: { username: 'flow', fullName: 'Flow', passwordHash: 'x', roleId: role!.id, isActive: true } as never }))
    admin.id = u.id
  })
  afterAll(async () => { await handle.close() })

  it('a purchase order received puts goods into stock and Inventory, services into expense; a debit note on it stays with purchases', async () => {
    const { purchaseOrderService } = await import('../../services/purchase-order.service')
    const { debitNoteService } = await import('../../services/debit-note.service')
    const created = await purchaseOrderService.createPO({ supplierId, items: [{ productId, quantity: 20, unitCost: 100, taxRate: 18 }, { serviceDescription: 'Freight', quantity: 1, unitCost: 200, taxRate: 0 }], isReverseCharge: false } as never) as { success: boolean; data: { id: string } }
    expect(created.success, JSON.stringify(created)).toBe(true)
    const before = await nets()
    const approved = await purchaseOrderService.approvePO(created.data.id) as { success: boolean }
    expect(approved, JSON.stringify(approved)).toMatchObject({ success: true })
    const received = await purchaseOrderService.receivePO(created.data.id) as { success: boolean }
    expect(received, JSON.stringify(received)).toMatchObject({ success: true })
    const after = await nets()
    const stock = await (await db()).inventory.findUnique({ where: { productId } })
    expect(stock!.quantity).toBe(20)
    // goods 2000 to Inventory, freight 200 to expense, tax 360 to Input Tax Credit, everything owed to the supplier.
    expect(after['1200'] - (before['1200'] ?? 0)).toBe(2000)
    expect(after['6000'] - (before['6000'] ?? 0)).toBe(200)
    expect(after['1300'] - (before['1300'] ?? 0)).toBe(360)
    expect(after['2000'] - (before['2000'] ?? 0)).toBe(-2560)
    expect(await allProblems({ stockFromMovements: true })).toEqual([])
    expect(await inventoryLedgerProblems(0.01)).toEqual([])

    const note = await debitNoteService.create({ purchaseOrderId: created.data.id, supplierId, reason: 'damaged', amount: 236, taxApplied: true, taxRate: 18 } as never, admin.id) as { success: boolean }
    expect(note, JSON.stringify(note)).toMatchObject({ success: true })
    expect(await allProblems({ stockFromMovements: true })).toEqual([])
  })

  it('a quotation converted to an invoice, then sold out and paid, keeps stock, cost and books consistent', async () => {
    const { quotationService } = await import('../../services/quotation.service')
    const { paymentService } = await import('../../services/payment.service')
    const q = await quotationService.create({ customerId, items: [{ productId, productName: 'Flow item', quantity: 5, unitPrice: 250, taxRate: 18, discount: 0 }] } as never, admin.id) as { success: boolean; data: { id: string } }
    expect(q, JSON.stringify(q)).toMatchObject({ success: true })
    const conv = await quotationService.convertToInvoice(q.data.id, admin.id) as { success: boolean; data?: { id: string } }
    expect(conv, JSON.stringify(conv)).toMatchObject({ success: true })
    const inv = await (await db()).invoice.findFirst({ orderBy: { createdAt: 'desc' } })
    await paymentService.recordPayment({ invoiceId: inv!.id, paymentMethod: 'UPI', amount: inv!.totalAmount } as never)
    expect(await allProblems({ stockFromMovements: true })).toEqual([])
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
    const items = await (await db()).invoiceItem.findMany({ where: { invoiceId: inv!.id } })
    expect(items.every((i) => i.costAtSale > 0)).toBe(true)
  })

  it('a sales order invoiced in two parts leaves stock, cost and receivable consistent', async () => {
    const { salesOrderService } = await import('../../services/sales-order.service')
    const so = await salesOrderService.createSalesOrder({ customerId, items: [{ productId, quantity: 6, unitPrice: 250, taxRate: 18 }] } as never, admin.id) as { success: boolean; data: { id: string; items: Array<{ id: string }> } }
    expect(so, JSON.stringify(so)).toMatchObject({ success: true })
    const confirmed = await salesOrderService.confirmSalesOrder(so.data.id) as { success: boolean }
    expect(confirmed, JSON.stringify(confirmed)).toMatchObject({ success: true })
    const itemId = so.data.items[0].id
    const first = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: so.data.id, lines: [{ salesOrderItemId: itemId, quantity: 4 }] } as never, admin.id) as { success: boolean }
    expect(first, JSON.stringify(first)).toMatchObject({ success: true })
    const second = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: so.data.id, lines: [{ salesOrderItemId: itemId, quantity: 2 }] } as never, admin.id) as { success: boolean }
    expect(second, JSON.stringify(second)).toMatchObject({ success: true })
    expect(await allProblems({ stockFromMovements: true })).toEqual([])
    expect(await inventoryLedgerProblems(0.01)).toEqual([])
  })
})
