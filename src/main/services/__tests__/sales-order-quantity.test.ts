import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'user-1' }) }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../kit.service', () => ({ explodeKitComponentsTx: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../license.service', () => ({ getLicenseState: vi.fn() }))

import { getPrisma } from '../../database/db'
import { salesOrderService } from '../sales-order.service'
import { getLicenseState } from '../license.service'

interface Item { id: string; salesOrderId: string; productId: string; serviceDescription: null; quantity: number; invoicedQty: number; unitPrice: number; taxRate: number }

function makeDb(item: Item) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const so = { id: 'so-1', soNumber: 'SO-1', customerId: 'cust-1', status: 'CONFIRMED', pricesIncludeTax: false, gstType: 'CGST_SGST', items: [item] as Item[] }
  const invoices: Array<{ items: Array<{ quantity: number; lineTotal: number }> }> = []
  const db: Record<string, any> = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ lockDate: null, currencyCode: 'INR' }) },
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', creditLimit: 0, outstandingBalance: 0 }) },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Rice', sku: 'R', productType: 'STANDARD', isKit: false, taxCategory: 'STANDARD' }), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    salesOrder: {
      findUnique: vi.fn(async () => ({ ...so, items: so.items.map(i => ({ ...i })) })),
      update: vi.fn(async ({ data }: any) => { so.status = data.status; return so })
    },
    salesOrderItem: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        const it = so.items.find(i => i.id === where.id)!
        if (!(it.invoicedQty <= where.invoicedQty.lte)) return { count: 0 }
        it.invoicedQty += data.invoicedQty.increment
        return { count: 1 }
      }),
      findMany: vi.fn(async () => so.items.map(i => ({ ...i })))
    },
    invoice: { create: vi.fn(async ({ data }: any) => { const inv = { id: `inv-${invoices.length + 1}`, invoiceNumber: 'INV', ...data, items: [] as Array<{ quantity: number; lineTotal: number }> }; invoices.push(inv); return inv }) },
    invoiceItem: { create: vi.fn(async ({ data }: any) => { invoices[invoices.length - 1].items.push({ quantity: data.quantity, lineTotal: data.lineTotal }); return {} }) },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1100', accountName: 'AR', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(),
      create: vi.fn(async ({ data }: any) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
      updateMany: vi.fn(async ({ data }: any) => { if (settingRow) settingRow = { ...settingRow, settingValue: data.settingValue }; return { count: settingRow ? 1 : 0 } })
    }
  }
  db.$transaction = vi.fn((arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(db) : Promise.all(arg as unknown[])))
  return { db, so, invoices }
}

const line = (quantity: number): Item => ({ id: 'soi-1', salesOrderId: 'so-1', productId: 'prod-1', serviceDescription: null, quantity, invoicedQty: 0, unitPrice: 100, taxRate: 18 })

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getLicenseState).mockResolvedValue({ status: 'ACTIVE', tier: 'PAID', region: 'IN', daysSinceIssue: null, daysRemaining: null, machineMismatch: false } as never)
})

describe('sales order lines with 3-decimal quantities can be invoiced in full (row 3.13)', () => {
  it('invoices 1.072 kg in one go and reaches INVOICED', async () => {
    const { db, so } = makeDb(line(1.072))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 1.072 }] }, 'user-1')
    expect(r.success, JSON.stringify((r as { error?: unknown }).error)).toBe(true)
    expect(so.status).toBe('INVOICED')
  })

  it('invoices 1.072 kg in a first piece of 0.5 and the remaining 0.572', async () => {
    const { db, so } = makeDb(line(1.072))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const a = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 0.5 }] }, 'user-1')
    expect(a.success).toBe(true)
    expect(so.status).toBe('PARTIALLY_INVOICED')
    const b = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 0.572 }] }, 'user-1')
    expect(b.success, JSON.stringify((b as { error?: unknown }).error)).toBe(true)
    expect(so.status).toBe('INVOICED')
  })

  it('rejects more than what remains, to the third decimal', async () => {
    const { db } = makeDb({ ...line(1.072), invoicedQty: 0.5 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 0.573 }] }, 'user-1')
    expect(r.success).toBe(false)
    expect((r as { error: { code: string } }).error.code).toBe('SO-009')
  })

  it('random 3-decimal quantities split into random pieces always complete exactly, with float drift in the stored quantity', async () => {
    const rand = rng(1309)
    for (let iter = 0; iter < 300; iter++) {
      const totalMilli = 1 + Math.floor(rand() * 20000)
      const { db, so } = makeDb(line(totalMilli / 1000))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      let leftMilli = totalMilli
      let guard = 0
      while (leftMilli > 0 && guard++ < 12) {
        const take = guard >= 6 || rand() < 0.25 ? leftMilli : 1 + Math.floor(rand() * leftMilli)
        const r = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: take / 1000 }] }, 'user-1')
        expect(r.success, `qty ${totalMilli / 1000} take ${take / 1000} left ${leftMilli / 1000}: ${JSON.stringify((r as { error?: unknown }).error)}`).toBe(true)
        leftMilli -= take
      }
      expect(so.status).toBe('INVOICED')
    }
  })
})
