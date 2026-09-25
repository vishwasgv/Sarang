// Rows 3.21 (HSN kept through quotation -> order -> invoice) and follow-up C-2 (invoices created from
// another document apply the business rounding rule, so a converted invoice equals a direct sale).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn().mockResolvedValue(undefined), addStockTx: vi.fn().mockResolvedValue(undefined) }, applyLocationDeltaTx: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../notification.service', () => ({ createNotification: vi.fn() }))
vi.mock('../distributor-credit-risk.service', () => ({ getCustomerCreditRisk: vi.fn().mockResolvedValue({ success: true, data: { riskTier: 'UNRATED', riskMultiplier: 1 } }) }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'user-1' }) }))
vi.mock('../retainer.service', () => ({ createRetainer: vi.fn(), generateInvoiceForRetainer: vi.fn() }))
vi.mock('../kit.service', () => ({ explodeKitComponentsTx: vi.fn() }))
vi.mock('../license.service', () => ({ getLicenseState: vi.fn().mockResolvedValue({ status: 'ACTIVE', tier: 'PAID' }) }))
vi.mock('../restaurant.service', async () => {
  const actual = await vi.importActual<typeof import('../restaurant.service')>('../restaurant.service')
  return { ...actual, deductIngredients: vi.fn().mockResolvedValue(undefined) }
})

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { quotationService } from '../quotation.service'
import { salesOrderService } from '../sales-order.service'
import type { RoundingRule } from '../../../shared/utils/money'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRODUCT = { id: 'prod-1', productName: 'Rice', sku: 'R1', hsnCode: '1006', productType: 'SERVICE', isKit: false, taxRate: 0, taxCategory: 'STANDARD', isActive: true, inventory: null }

interface Captured { invoices: Array<Record<string, any>>; invoiceItems: Array<Record<string, any>>; quotations: Array<Record<string, any>>; quotationItems: Array<Record<string, any>>; salesOrders: Array<Record<string, any>> }

function makeDb(opts: { currencyCode?: string; rule?: string | null; quotation?: Record<string, any>; salesOrder?: Record<string, any> }) {
  const cap: Captured = { invoices: [], invoiceItems: [], quotations: [], quotationItems: [], salesOrders: [] }
  let seq: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    setting: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.settingKey === 'invoice_rounding_rule' && opts.rule) return { settingKey: where.settingKey, settingValue: opts.rule }
        if (where.settingKey === 'invoice_rounding_rule') return null
        return seq && where.settingKey === seq.settingKey ? seq : null
      }),
      create: vi.fn(async ({ data }: any) => { seq = { settingKey: data.settingKey, settingValue: data.settingValue }; return seq }),
      update: vi.fn(),
      updateMany: vi.fn(async ({ data }: any) => { if (seq) seq = { ...seq, settingValue: data.settingValue }; return { count: 1 } })
    },
    product: { findUnique: vi.fn().mockResolvedValue(PRODUCT), findFirst: vi.fn().mockResolvedValue(PRODUCT), findMany: vi.fn().mockResolvedValue([{ id: 'prod-1', taxCategory: 'STANDARD', hsnCode: '1006' }]), create: vi.fn() },
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', isActive: true, creditLimit: 0, outstandingBalance: 0, taxExempt: false, state: null, taxNumber: null }) },
    cropSeason: { findUnique: vi.fn().mockResolvedValue(null) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: opts.currencyCode ?? 'INR', lockDate: null, state: null, taxNumber: null }) },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1100', accountName: 'AR', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]) },
    invoice: {
      create: vi.fn(async ({ data }: any) => { const row = { id: `inv-${cap.invoices.length + 1}`, invoiceNumber: 'INV-1', paidAmount: 0, ...data }; cap.invoices.push(row); return row }),
      findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0)
    },
    invoiceItem: { create: vi.fn(async ({ data }: any) => { cap.invoiceItems.push(data); return data }) },
    payment: { create: vi.fn() },
    productBatch: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _sum: { quantityRemaining: null } }) },
    productSerial: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]) },
    metalExchange: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    furnitureTradeIn: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    restaurantTable: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    quotation: {
      findUnique: vi.fn(async () => opts.quotation ?? null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: any) => { const row = { id: 'q-1', ...data, items: data.items.create }; cap.quotations.push(row); cap.quotationItems.push(...data.items.create); return row }),
      update: vi.fn().mockResolvedValue({})
    },
    salesOrder: {
      findUnique: vi.fn(async () => opts.salesOrder ?? null),
      create: vi.fn(async ({ data }: any) => { const row = { id: 'so-1', soNumber: 'SO-1', ...data }; cap.salesOrders.push(row); return row }),
      findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({})
    },
    salesOrderItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]) }
  }
  db.$transaction = vi.fn((arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)))
  return { db, cap }
}

beforeEach(() => vi.clearAllMocks())

describe('HSN code travels quotation -> sales order -> invoice (row 3.21)', () => {
  it('a quotation line takes the HSN of its product when none is typed, and keeps a typed one', async () => {
    const { db, cap } = makeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await quotationService.create({ items: [{ productId: 'prod-1', productName: 'Rice', quantity: 1, unitPrice: 100, taxRate: 5 }, { productName: 'Service', quantity: 1, unitPrice: 50, taxRate: 18, hsnCode: '998311' }] } as never, 'user-1')
    expect(r.success).toBe(true)
    expect(cap.quotationItems.map(i => i.hsnCode)).toEqual(['1006', '998311'])
  })

  it('converting to an invoice keeps the HSN on the invoice lines', async () => {
    const quotation = { id: 'q-1', quotationNumber: 'QT-1', customerId: 'cust-1', status: 'SENT', pricesIncludeTax: false, gstType: 'CGST_SGST', invoice: null, salesOrder: null, validUntil: null, notes: null,
      items: [{ productId: 'prod-1', productName: 'Rice', sku: 'R1', quantity: 2, unitPrice: 100, discount: 0, taxRate: 5, hsnCode: '1006' }, { productId: null, productName: 'Old line', sku: null, quantity: 1, unitPrice: 10, discount: 0, taxRate: 0, hsnCode: null }] }
    const { db, cap } = makeDb({ quotation })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await quotationService.convertToInvoice('q-1', 'user-1')
    expect(r.success, JSON.stringify((r as { error?: unknown }).error)).toBe(true)
    expect(cap.invoiceItems[0].hsnCode).toBe('1006')
    // an older quotation line with no HSN falls back to the product it resolves to
    expect(cap.invoiceItems[1].hsnCode).toBe('1006')
  })

  it('converting to a sales order keeps the HSN, and invoicing the order keeps it again', async () => {
    const quotation = { id: 'q-1', quotationNumber: 'QT-1', customerId: 'cust-1', status: 'SENT', pricesIncludeTax: false, gstType: 'CGST_SGST', invoice: null, salesOrder: null, validUntil: null, notes: null,
      items: [{ productId: 'prod-1', productName: 'Rice', sku: 'R1', quantity: 2, unitPrice: 100, discount: 0, taxRate: 5, hsnCode: '1006' }] }
    const a = makeDb({ quotation })
    vi.mocked(getPrisma).mockReturnValue(a.db as never)
    const r = await quotationService.convertToSalesOrder('q-1', 'user-1')
    expect(r.success, JSON.stringify((r as { error?: unknown }).error)).toBe(true)
    const soItems = (a.cap.salesOrders[0].items as { create: Array<Record<string, any>> }).create
    expect(soItems[0].hsnCode).toBe('1006')

    const so = { id: 'so-1', soNumber: 'SO-1', customerId: 'cust-1', status: 'CONFIRMED', pricesIncludeTax: false, gstType: 'CGST_SGST', items: [{ id: 'soi-1', productId: 'prod-1', serviceDescription: null, quantity: 2, invoicedQty: 0, unitPrice: 100, taxRate: 5, taxAmount: 10, total: 210, hsnCode: '1006' }] }
    const b = makeDb({ salesOrder: so })
    b.db.salesOrderItem.findMany = vi.fn().mockResolvedValue([{ id: 'soi-1', quantity: 2, invoicedQty: 2 }])
    vi.mocked(getPrisma).mockReturnValue(b.db as never)
    const inv = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 2 }] }, 'user-1')
    expect(inv.success, JSON.stringify((inv as { error?: unknown }).error)).toBe(true)
    expect(b.cap.invoiceItems[0].hsnCode).toBe('1006')
  })

  it('a directly created sales order line takes the HSN of its product', async () => {
    const { db, cap } = makeDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await salesOrderService.createSalesOrder({ customerId: 'cust-1', items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, taxRate: 5 }] } as never, 'user-1')
    expect(r.success, JSON.stringify((r as { error?: unknown }).error)).toBe(true)
    expect((cap.salesOrders[0].items as { create: Array<Record<string, any>> }).create[0].hsnCode).toBe('1006')
  })
})

describe('an invoice made from another document applies the business rounding rule (follow-up C-2)', () => {
  const RULES: Array<RoundingRule | null> = [null, 'NONE', '0.05', '0.10', '0.50', '1']

  it('a converted quotation equals the direct sale of the same lines: INR, USD, every rule, both pricing modes', async () => {
    const rng = mulberry32(2509)
    for (let n = 0; n < 300; n++) {
      const currencyCode = ['INR', 'USD', 'KWD', 'JPY'][n % 4]
      const rule = RULES[Math.floor(rng() * RULES.length)]
      const inclusive = rng() < 0.5
      const dp = currencyCode === 'JPY' ? 0 : currencyCode === 'KWD' ? 3 : 2
      const lines2 = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({ quantity: 1 + Math.floor(rng() * 5), unitPrice: Math.round(rng() * 99999) / 10 ** dp, taxRate: [0, 5, 18, 40][Math.floor(rng() * 4)] }))

      const direct = makeDb({ currencyCode, rule })
      vi.mocked(getPrisma).mockReturnValue(direct.db as never)
      const d = await billingService.createInvoice({ customerId: 'cust-1', paymentMethod: 'CREDIT', pricesIncludeTax: inclusive, items: lines2.map(l => ({ productId: 'prod-1', ...l, discountAmount: 0 })) } as never)
      expect(d.success, JSON.stringify((d as { error?: unknown }).error)).toBe(true)

      const quotation = { id: 'q-1', quotationNumber: 'QT-1', customerId: 'cust-1', status: 'SENT', pricesIncludeTax: inclusive, gstType: 'CGST_SGST', invoice: null, salesOrder: null, validUntil: null, notes: null,
        items: lines2.map(l => ({ productId: 'prod-1', productName: 'Rice', sku: 'R1', discount: 0, hsnCode: '1006', ...l })) }
      const conv = makeDb({ currencyCode, rule, quotation })
      vi.mocked(getPrisma).mockReturnValue(conv.db as never)
      const c = await quotationService.convertToInvoice('q-1', 'user-1')
      expect(c.success, JSON.stringify((c as { error?: unknown }).error)).toBe(true)

      const pick = (i: Record<string, any>) => [i.subtotal, i.discountAmount, i.taxAmount, i.roundingAmount + 0, i.totalAmount, i.balanceAmount]
      const ctx = JSON.stringify({ n, currencyCode, rule, inclusive, lines2 })
      expect({ ctx, v: pick(conv.cap.invoices[0]) }).toEqual({ ctx, v: pick(direct.cap.invoices[0]) })
    }
  }, 60_000)

  it('an order invoiced in full (exclusive) equals the direct sale of the same lines, rounded the same way', async () => {
    const rng = mulberry32(77)
    for (let n = 0; n < 200; n++) {
      const currencyCode = ['INR', 'USD', 'KWD', 'JPY'][n % 4]
      const rule = RULES[Math.floor(rng() * RULES.length)]
      const dp = currencyCode === 'JPY' ? 0 : currencyCode === 'KWD' ? 3 : 2
      const lines = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({ quantity: 1 + Math.floor(rng() * 5), unitPrice: Math.round(rng() * 99999) / 10 ** dp, taxRate: [0, 5, 18, 40][Math.floor(rng() * 4)] }))

      const direct = makeDb({ currencyCode, rule })
      vi.mocked(getPrisma).mockReturnValue(direct.db as never)
      const d = await billingService.createInvoice({ customerId: 'cust-1', paymentMethod: 'CREDIT', items: lines.map(l => ({ productId: 'prod-1', ...l, discountAmount: 0 })) } as never)
      expect(d.success).toBe(true)

      const so = { id: 'so-1', soNumber: 'SO-1', customerId: 'cust-1', status: 'CONFIRMED', pricesIncludeTax: false, gstType: 'CGST_SGST', items: lines.map((l, i) => ({ id: `soi-${i}`, productId: 'prod-1', serviceDescription: null, quantity: l.quantity, invoicedQty: 0, unitPrice: l.unitPrice, taxRate: l.taxRate, taxAmount: 0, total: 0, hsnCode: '1006' })) }
      const conv = makeDb({ currencyCode, rule, salesOrder: so })
      conv.db.salesOrderItem.findMany = vi.fn().mockResolvedValue(so.items.map(i => ({ id: i.id, quantity: i.quantity, invoicedQty: i.quantity })))
      vi.mocked(getPrisma).mockReturnValue(conv.db as never)
      const c = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: so.items.map(i => ({ salesOrderItemId: i.id, quantity: i.quantity })) }, 'user-1')
      expect(c.success, JSON.stringify((c as { error?: unknown }).error)).toBe(true)

      const pick = (i: Record<string, any>) => [i.subtotal, i.taxAmount, (i.roundingAmount ?? 0) + 0, i.totalAmount, i.balanceAmount]
      const ctx = JSON.stringify({ n, currencyCode, rule, lines })
      expect({ ctx, v: pick(conv.cap.invoices[0]) }).toEqual({ ctx, v: pick(direct.cap.invoices[0]) })
    }
  }, 60_000)
})
