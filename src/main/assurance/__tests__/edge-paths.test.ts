import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'
import { allProblems } from '../invariants'

let handle: RealDb
let productId = ''
let supplierId = ''
let customerId = ''

async function svc() {
  const { getPrisma } = await import('../../database/db')
  return { db: getPrisma() }
}

// Net movement per account code across the whole ledger.
async function accountNets(): Promise<Record<string, number>> {
  const { db } = await svc()
  const lines = await db.journalEntryLine.findMany({ include: { account: { select: { accountCode: true } } } })
  const nets: Record<string, number> = {}
  for (const l of lines) nets[l.account.accountCode] = Math.round(((nets[l.account.accountCode] ?? 0) + l.debitAmount - l.creditAmount) * 1000) / 1000
  return nets
}

function diff(after: Record<string, number>, before: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of new Set([...Object.keys(after), ...Object.keys(before)])) {
    const d = Math.round(((after[k] ?? 0) - (before[k] ?? 0)) * 1000) / 1000
    if (d !== 0) out[k] = d
  }
  return out
}

describe('edge paths', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { db } = await svc()
    productId = (await db.product.create({ data: { productName: 'Item', sellingPrice: 200, costPrice: 100, taxRate: 18 } })).id
    await db.inventory.create({ data: { productId, quantity: 1000 } })
    supplierId = (await db.supplier.create({ data: { supplierName: 'S' } })).id
    customerId = (await db.customer.create({ data: { customerName: 'C' } })).id
  })
  afterAll(async () => { await handle.close() })

  it('an edited bill leaves the books exactly as a fresh bill with the new figures would', async () => {
    const { billService } = await import('../../services/bill.service')
    const v1 = { supplierId, items: [{ productId, quantity: 4, unitCost: 100, discountAmount: 0, taxRate: 18 }], isReverseCharge: false }
    const v2 = { supplierId, items: [{ productId, quantity: 7, unitCost: 93.5, discountAmount: 5, taxRate: 18 }, { serviceDescription: 'Freight', quantity: 1, unitCost: 250, discountAmount: 0, taxRate: 5 }], isReverseCharge: false }

    const t0 = await accountNets()
    const created = await billService.createBill(v1 as never) as { success: boolean; data: { id: string } }
    expect(created.success).toBe(true)
    const edited = await billService.editBill(created.data.id, v2 as never) as { success: boolean }
    expect(edited.success).toBe(true)
    const t1 = await accountNets()

    const fresh = await billService.createBill(v2 as never) as { success: boolean }
    expect(fresh.success).toBe(true)
    const t2 = await accountNets()

    expect(diff(t1, t0)).toEqual(diff(t2, t1))
    expect(await allProblems()).toEqual([])
  })

  it('expenses (added, changed, deleted) keep the books balanced', async () => {
    const { db } = await svc()
    const { createExpense, updateExpense, deleteExpense } = await import('../../services/expense.service')
    const cat = await db.expenseCategory.upsert({ where: { categoryName: 'Rent' }, update: {}, create: { categoryName: 'Rent' } })
    const a = await createExpense({ categoryId: cat.id, expenseName: 'Shop rent', amount: 12345.67, paymentMethod: 'CASH', isReverseCharge: false } as never) as { success: boolean; data: { id: string } }
    expect(a, JSON.stringify(a)).toMatchObject({ success: true })
    expect(await allProblems()).toEqual([])
    const u = await updateExpense({ id: a.data.id, categoryId: cat.id, expenseName: 'Shop rent', amount: 9999.5, paymentMethod: 'CASH', isReverseCharge: false } as never) as { success: boolean }
    expect(u, JSON.stringify(u)).toMatchObject({ success: true })
    expect(await allProblems()).toEqual([])
    const before = await accountNets()
    const d = await deleteExpense(a.data.id) as { success: boolean }
    expect(d, JSON.stringify(d)).toMatchObject({ success: true })
    const after = await accountNets()
    // Deleting the expense takes its 9,999.50 out of Operating Expenses and puts it back in Cash.
    expect(diff(after, before)).toEqual({ '6000': -9999.5, '1000': 9999.5 })
    expect(await allProblems()).toEqual([])
  })

  it('credit notes (plain amount, with tax, then voided) keep receivable and customer balances equal', async () => {
    const { db } = await svc()
    const { billingService } = await import('../../services/billing.service')
    const { creditNoteService } = await import('../../services/credit-note.service')
    const sale = await billingService.createInvoice({ customerId, paymentMethod: 'CREDIT', items: [{ productId, quantity: 5, unitPrice: 200, discountAmount: 0, isFreeOfCost: false }], globalDiscount: 0 } as never) as { success: boolean; data: { id: string } }
    expect(sale.success).toBe(true)
    const admin = await db.user.findFirst()
    const uid = admin?.id ?? 'system'
    const n1 = await creditNoteService.create({ customerId, invoiceId: sale.data.id, reason: 'price fix', amount: 100 } as never, uid) as { success: boolean; data?: { id: string } }
    expect(n1).toMatchObject({ success: true })
    expect(await allProblems()).toEqual([])
    const n2 = await creditNoteService.create({ customerId, reason: 'goodwill', amount: 59, taxApplied: false } as never, uid) as { success: boolean; data?: { id: string } }
    expect(n2).toMatchObject({ success: true })
    expect(await allProblems()).toEqual([])
    const del = await creditNoteService.delete(n1.data!.id, uid) as { success: boolean }
    expect(del.success).toBe(true)
    expect(await allProblems()).toEqual([])
  })

  it('an archived customer and supplier keep their history and the books stay consistent', async () => {
    const { db } = await svc()
    await db.customer.update({ where: { id: customerId }, data: { isActive: false } })
    await db.supplier.update({ where: { id: supplierId }, data: { isActive: false } })
    expect(await allProblems()).toEqual([])
    const { reportService } = await import('../../services/report.service')
    const rep = await reportService.generateOutstandingReport()
    expect(Number.isFinite(rep.customers.totalOutstanding)).toBe(true)
  })
})
