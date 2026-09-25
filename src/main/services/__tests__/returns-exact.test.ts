import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) } }))

import { getPrisma } from '../../database/db'
import { createReturn } from '../returns.service'
import { computeDocumentTotals, getCurrencyDecimals, prorateAmount, roundMoney, sumMoney, type RoundingRule } from '../../../shared/utils/money'

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

interface OrigLine { id: string; productId: string; quantity: number; unitPrice: number; discountAmount: number; taxRate: number; taxAmount: number; lineTotal: number; taxCategory: string; variantId: null; variantInfo: null; product: { productName: string; productType: string; isKit: boolean } }

function buildDb(original: Record<string, unknown>, currencyCode: string) {
  const created: Array<Record<string, unknown>> = []
  let seq: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    invoice: {
      findUnique: vi.fn().mockResolvedValue(original),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ balanceAmount: 0, paymentStatus: 'PAID' }),
      update: vi.fn(),
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => (where && 'originalInvoiceId' in where ? created : [])),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => { const row = { id: `ret-${created.length + 1}`, ...data, items: data.items.create }; created.push(row); return row })
    },
    inventoryMovement: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    inventory: { upsert: vi.fn() },
    location: { findFirst: vi.fn().mockResolvedValue({ id: 'loc', isDefault: true }) },
    locationStock: { upsert: vi.fn() },
    productBatch: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    productSerial: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode }) },
    setting: {
      findUnique: vi.fn(async () => seq),
      updateMany: vi.fn(async ({ data }: any) => { if (seq) seq = { ...seq, settingValue: data.settingValue }; return { count: seq ? 1 : 0 } }),
      create: vi.fn(async ({ data }: any) => { seq = { settingKey: data.settingKey, settingValue: data.settingValue }; return seq })
    }
  }
  db.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(db))
  return { db, created }
}

const RATES = [0, 0.25, 2.5, 3, 5, 12, 18, 28, 40]
const CURRENCIES = ['INR', 'USD', 'KWD', 'JPY']
const RULES: RoundingRule[] = ['NONE', '0.05', '0.10', '0.50', '1']
const GST_TYPES = ['CGST_SGST', 'IGST', 'GST']

function randomInvoice(rand: () => number, currency: string) {
  const dp = getCurrencyDecimals(currency)
  const n = 1 + Math.floor(rand() * 4)
  const inputs = Array.from({ length: n }, () => {
    const quantity = [1, 2, 3, 5, 7, 12][Math.floor(rand() * 6)] + (rand() < 0.3 ? 0.5 : 0)
    const unitPrice = roundMoney(rand() * (dp === 0 ? 5000 : 900) + (dp === 0 ? 1 : 0.01), dp)
    const gross = roundMoney(quantity * unitPrice, dp)
    const discountAmount = rand() < 0.4 ? roundMoney(gross * rand() * 0.3, dp) : 0
    return { quantity, unitPrice, discountAmount, taxRate: RATES[Math.floor(rand() * RATES.length)] }
  })
  const inclusive = rand() < 0.5
  const globalDiscount = rand() < 0.6 ? roundMoney(rand() * 40 * (dp === 0 ? 20 : 1), dp) : 0
  const roundingRule = RULES[Math.floor(rand() * RULES.length)]
  const t = computeDocumentTotals(inputs, { decimals: dp, roundingRule, globalDiscount, pricesIncludeTax: inclusive })
  const items: OrigLine[] = inputs.map((li, i) => ({
    id: `it-${i}`, productId: `p-${i}`, quantity: li.quantity, unitPrice: li.unitPrice, discountAmount: t.lines[i].discountAmount, taxRate: li.taxRate,
    taxAmount: t.lines[i].tax, lineTotal: t.lines[i].total, taxCategory: 'STANDARD', variantId: null, variantInfo: null,
    product: { productName: `P${i}`, productType: 'STANDARD', isKit: false }
  }))
  return { items, inclusive, t, dp, gstType: GST_TYPES[Math.floor(rand() * 3)] }
}

describe('returns refund exactly the stored line total in proportion (row 3.18)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sequences of partial returns on random invoices never over-refund and full return equals the sold line', async () => {
    const rand = rng(20260925)
    let checked = 0
    for (let iter = 0; iter < 1200; iter++) {
      const currency = CURRENCIES[iter % CURRENCIES.length]
      const inv = randomInvoice(rand, currency)
      const original = { id: 'inv-1', invoiceNumber: 'INV-1', invoiceType: 'RETAIL', status: 'ACTIVE', customerId: 'c1', customer: { id: 'c1' }, items: inv.items, pricesIncludeTax: inv.inclusive, gstType: inv.gstType, buyerState: 'MH' }
      const { db, created } = buildDb(original, currency)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const remaining = new Map(inv.items.map((l) => [l.productId, l.quantity]))
      const refunded = new Map(inv.items.map((l) => [l.productId, { total: 0, tax: 0 }]))

      let guard = 0
      while ([...remaining.values()].some((q) => q > 0) && guard++ < 12) {
        const open = inv.items.filter((l) => (remaining.get(l.productId) ?? 0) > 0)
        const picks = open.filter(() => rand() < 0.7)
        const chosen = picks.length ? picks : open.slice(0, 1)
        const req = chosen.map((l) => {
          const rem = remaining.get(l.productId)!
          const last = guard >= 4 || rand() < 0.3
          const q = last ? rem : Math.max(0.5, Math.floor(rand() * rem * 2) / 2)
          return { productId: l.productId, quantity: Math.min(q, rem) }
        })
        const before = created.length
        const res = await createReturn('inv-1', req, 'test')
        expect(res.success, JSON.stringify(res.error)).toBe(true)
        const doc = created[before] as any
        let docTotal = 0
        let docTax = 0
        for (const r of req) {
          const orig = inv.items.find((l) => l.productId === r.productId)!
          const line = doc.items.find((x: any) => x.productId === r.productId)
          const tax = line.taxAmount
          const incl = roundMoney(Math.abs(line.lineTotal) + tax, inv.dp)
          const prev = refunded.get(r.productId)!
          const remQ = remaining.get(r.productId)!
          const isRest = r.quantity >= remQ - 1e-9
          const step = Math.pow(10, -inv.dp)
          if (isRest) {
            expect(roundMoney(prev.total + incl, inv.dp), 'full return must equal the sold line').toBe(orig.lineTotal)
            expect(roundMoney(prev.tax + tax, inv.dp)).toBe(orig.taxAmount)
          } else {
            const exact = prorateAmount(orig.lineTotal, r.quantity, orig.quantity, inv.dp)
            expect(Math.abs(incl - exact)).toBeLessThanOrEqual(step * 1.0001)
            expect(prev.total + incl).toBeLessThanOrEqual(orig.lineTotal + 1e-9)
          }
          expect(line.lineTotal).toBeLessThanOrEqual(0)
          refunded.set(r.productId, { total: roundMoney(prev.total + incl, inv.dp), tax: roundMoney(prev.tax + tax, inv.dp) })
          remaining.set(r.productId, roundMoney(remQ - r.quantity, 3))
          docTotal += incl
          docTax += tax
        }
        expect(doc.totalAmount + 0).toBe(-roundMoney(docTotal, inv.dp) + 0)
        expect(doc.taxAmount).toBe(roundMoney(docTax, inv.dp))
        expect(doc.gstType).toBe(inv.gstType)
        if (!inv.inclusive) {
          // subtotal - discount + tax = total on the return, like every exclusive document
          expect(roundMoney(doc.subtotal + doc.discountAmount - doc.taxAmount, inv.dp)).toBe(doc.totalAmount)
        }
        checked++
      }
      // Whole invoice returned: refunds equal the sum of the sold lines
      const soldTotal = sumMoney(inv.items.map((l) => l.lineTotal), inv.dp)
      const gotTotal = sumMoney([...refunded.values()].map((v) => v.total), inv.dp)
      expect(gotTotal).toBe(soldTotal)
    }
    expect(checked).toBeGreaterThan(1500)
  })

  it('worked example: exclusive invoice with a global discount refunds what was paid', async () => {
    // 2 x 100 at 18%, invoice discount 20 -> taxable 180, tax 32.40, paid 212.40
    const t = computeDocumentTotals([{ quantity: 2, unitPrice: 100, taxRate: 18 }], { decimals: 2, globalDiscount: 20 })
    const l = t.lines[0]
    expect(l.total).toBe(212.4)
    const original = {
      id: 'inv-1', invoiceNumber: 'INV-1', invoiceType: 'RETAIL', status: 'ACTIVE', customerId: 'c1', customer: { id: 'c1' }, pricesIncludeTax: false, gstType: 'CGST_SGST', buyerState: null,
      items: [{ id: 'i', productId: 'p', quantity: 2, unitPrice: 100, discountAmount: l.discountAmount, taxRate: 18, taxAmount: l.tax, lineTotal: l.total, taxCategory: 'STANDARD', variantId: null, variantInfo: null, product: { productName: 'W', productType: 'STANDARD', isKit: false } }]
    }
    const { db, created } = buildDb(original, 'INR')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await createReturn('inv-1', [{ productId: 'p', quantity: 2 }], 'x')
    expect((created[0] as any).totalAmount).toBe(-212.4)
    expect((created[0] as any).taxAmount).toBe(32.4)
  })
})
