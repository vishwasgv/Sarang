// Tax-inclusive pricing, end to end at the service layer: the renderer's numbers, the saved rows and an
// independent oracle must agree to the last minor unit for invoices, quotations, sales orders, purchase orders,
// bills, credit notes and debit notes; conversions must preserve totals; returns must refund proportionally.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn().mockResolvedValue(undefined), addStockTx: vi.fn().mockResolvedValue(undefined) }, applyLocationDeltaTx: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../supplier-ledger.service', () => ({ supplierLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../notification.service', () => ({ createNotification: vi.fn() }))
vi.mock('../distributor-credit-risk.service', () => ({ getCustomerCreditRisk: vi.fn().mockResolvedValue({ success: true, data: { riskTier: 'UNRATED', riskMultiplier: 1 } }) }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'user-1' }) }))
vi.mock('../retainer.service', () => ({ createRetainer: vi.fn(), generateInvoiceForRetainer: vi.fn() }))
vi.mock('../kit.service', () => ({ explodeKitComponentsTx: vi.fn() }))
vi.mock('../license.service', () => ({ LICENSE_INTERNAL_SETTING_KEYS: new Set<string>(), getLicenseState: vi.fn().mockResolvedValue({ status: 'ACTIVE', tier: 'PAID', region: 'IN', daysSinceIssue: null, daysRemaining: null, machineMismatch: false }) }))
vi.mock('../restaurant.service', async () => {
  const actual = await vi.importActual<typeof import('../restaurant.service')>('../restaurant.service')
  return { ...actual, deductIngredients: vi.fn().mockResolvedValue(undefined) }
})

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { quotationService } from '../quotation.service'
import { salesOrderService } from '../sales-order.service'
import { purchaseOrderService } from '../purchase-order.service'
import { billService } from '../bill.service'
import { creditNoteService } from '../credit-note.service'
import { debitNoteService } from '../debit-note.service'
import { createReturn } from '../returns.service'
import { inventoryService } from '../inventory.service'
import { setSetting } from '../settings.service'
import { computeDocumentTotals, getCurrencyDecimals, roundMoney, sumMoney, type RoundingRule } from '../../../shared/utils/money'
import { computeCartTotals } from '../../../renderer/src/shared/utils/cart-totals.util'
import { buildMoneyContext } from '../../../renderer/src/shared/utils/money-context.util'

const D = Prisma.Decimal.clone({ precision: 60 })

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
type Rng = () => number
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

const RATES = [0, 0, 2.5, 5, 12, 18, 18, 20, 28, 40, 0.25, 3, 7.5] as const
const CURRENCIES = ['INR', 'USD', 'EUR', 'JPY', 'KWD', 'BHD', 'AED'] as const
const RULES: RoundingRule[] = ['NONE', '0.05', '0.10', '0.50', '1']

interface Line { quantity: number; unitPrice: number; discountAmount: number; taxRate: number }

function genLine(rng: Rng, decimals: number): Line {
  const quantity = pick(rng, [1, 1, 2, 3, 5, 10, 0.5, 0.25, 1.25, 1.234, 0.001, 2.5, int(rng, 1, 50), int(rng, 1, 1000)])
  const scale = pick(rng, [1, 10, 100, 1000])
  const unitPrice = decimals === 0
    ? pick(rng, [0, 1, 99, 100, 333.5, int(rng, 0, 50000)])
    : pick(rng, [0, 0.01, 0.99, 12.34, 99.99, 118, int(rng, 0, 500000) / scale, int(rng, 1, 9999999) / 1000])
  const gross = roundMoney(quantity * unitPrice, decimals)
  const mode = rng()
  let discountAmount = 0
  if (mode < 0.25) discountAmount = roundMoney(gross * rng(), decimals)
  else if (mode < 0.32) discountAmount = gross
  return { quantity, unitPrice, discountAmount, taxRate: pick(rng, RATES) }
}

function genCart(rng: Rng, decimals: number) {
  const lines = Array.from({ length: int(rng, 1, 6) }, () => genLine(rng, decimals))
  const base = lines.reduce((s, l) => s + Math.max(0, roundMoney(l.quantity * l.unitPrice, decimals) - l.discountAmount), 0)
  const globalDiscount = rng() < 0.4 ? roundMoney(base * rng() * 0.9, decimals) : 0
  return { lines, globalDiscount }
}

// Longhand inclusive oracle: independent Decimal implementation of the specified arithmetic.
function oracle(lines: Line[], opts: { decimals: number; rule: RoundingRule; globalDiscount?: number; excludeTax?: boolean }) {
  const dp = opts.decimals
  const r = (x: Prisma.Decimal.Value) => new D(x).toDecimalPlaces(dp, D.ROUND_HALF_UP)
  const rows = lines.map((l) => {
    const gross = r(new D(l.quantity).mul(l.unitPrice))
    const disc = D.min(r(l.discountAmount), gross)
    return { gross, base: gross.sub(disc), rate: new D(l.taxRate), taxable: new D(0), tax: new D(0), exGross: new D(0) }
  })
  const gd = r(opts.globalDiscount ?? 0)
  const total = rows.reduce((a, x) => a.add(x.base), new D(0))
  const finalBase = rows.map(x => x.base)
  let unapplied = gd
  if (gd.gt(0) && total.gt(0)) {
    let done = new D(0)
    const shares = rows.map((x, i) => {
      const last = i === rows.length - 1
      const share = last ? gd.sub(done) : r(gd.mul(x.base).div(total))
      if (!last) done = done.add(share)
      return D.min(share, x.base)
    })
    let deficit = gd.sub(shares.reduce((a, s) => a.add(s), new D(0)))
    for (let i = rows.length - 1; i >= 0 && deficit.gt(0); i--) {
      const add = D.min(deficit, rows[i].base.sub(shares[i]))
      if (add.gt(0)) { shares[i] = shares[i].add(add); deficit = deficit.sub(add) }
    }
    rows.forEach((x, i) => { finalBase[i] = x.base.sub(shares[i]) })
    unapplied = deficit
  }
  rows.forEach((x, i) => {
    const divisor = new D(1).add(x.rate.div(100))
    x.taxable = r(finalBase[i].div(divisor))
    x.tax = finalBase[i].sub(x.taxable)
    x.exGross = r(x.gross.div(divisor))
  })
  const subtotal = rows.reduce((a, x) => a.add(x.exGross), new D(0))
  const taxableSum = rows.reduce((a, x) => a.add(x.taxable), new D(0))
  const discount = subtotal.sub(taxableSum).add(unapplied)
  const tax = rows.reduce((a, x) => a.add(x.tax), new D(0))
  const raw = subtotal.sub(discount).add(opts.excludeTax ? 0 : tax)
  const stepValue = opts.rule === 'NONE' ? null : new D(opts.rule)
  const scaled = stepValue ? stepValue.mul(new D(10).pow(dp)) : null
  const stepUsable = scaled !== null && scaled.isInteger() && scaled.gt(1)
  const totalAmount = stepUsable ? raw.div(stepValue!).toDecimalPlaces(0, D.ROUND_HALF_UP).mul(stepValue!) : raw
  return {
    subtotal: subtotal.toNumber(), discountAmount: discount.toNumber(), taxAmount: tax.toNumber(),
    totalAmount: totalAmount.toDecimalPlaces(dp, D.ROUND_HALF_UP).toNumber(),
    roundingAmount: totalAmount.sub(raw).toDecimalPlaces(dp, D.ROUND_HALF_UP).toNumber() + 0,
    lineTotals: rows.map(x => x.taxable.add(x.tax).toNumber())
  }
}

beforeEach(() => vi.clearAllMocks())

// -------------------------------------------------------------------------------- invoices
function makeInvoiceDb(currencyCode: string, settings: Record<string, string>) {
  const db: Record<string, any> = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { settingKey: string } }) =>
        where.settingKey in settings ? { settingKey: where.settingKey, settingValue: settings[where.settingKey] } : null),
      create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Widget', sku: 'W', hsnCode: null, productType: 'SERVICE', taxRate: 0, isActive: true, inventory: null }) },
    customer: { findUnique: vi.fn().mockResolvedValue(null) },
    cropSeason: { findUnique: vi.fn().mockResolvedValue(null) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1000', accountName: 'Cash', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]) },
    invoice: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'inv-1', invoiceNumber: 'INV-1', paidAmount: 0, ...data })),
      findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0)
    },
    invoiceItem: { create: vi.fn() },
    payment: { create: vi.fn() },
    productBatch: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _sum: { quantityRemaining: null } }) },
    productSerial: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]) },
    metalExchange: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    furnitureTradeIn: { findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    restaurantTable: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
  }
  db.$transaction = vi.fn((arg: unknown) => Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db))
  return db
}

describe('inclusive invoices: billing screen == createInvoice == oracle (property test)', () => {
  it('2500 random inclusive carts save exactly what the screen shows, and every item row adds up', async () => {
    const rng = mulberry32(20260925)
    let checked = 0
    for (let n = 0; n < 2500; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const stored = pick(rng, [null, null, ...RULES])
      const { lines, globalDiscount } = genCart(rng, decimals)
      const db = makeInvoiceDb(currencyCode, stored === null ? {} : { invoice_rounding_rule: stored })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await billingService.createInvoice({
        items: lines.map(l => ({ productId: 'prod-1', ...l })),
        paymentMethod: 'SPLIT' as const, globalDiscount, pricesIncludeTax: true
      } as never)
      const ctx = JSON.stringify({ n, currencyCode, stored, lines, globalDiscount, res: res.success ? 'ok' : res })
      if (!res.success) {
        // the only legitimate rejection here is a negative total from an over-discount
        const rule0 = (stored ?? (currencyCode === 'INR' ? '1' : 'NONE')) as RoundingRule
        expect(oracle(lines, { decimals, rule: rule0, globalDiscount }).totalAmount < 0, ctx).toBe(true)
        continue
      }
      const saved = db.invoice.create.mock.calls[0][0].data as Record<string, number | boolean>
      expect(saved.pricesIncludeTax, ctx).toBe(true)

      const moneyCtx = buildMoneyContext({ currencyCode, gstScheme: 'REGULAR' }, stored === null ? {} : { invoice_rounding_rule: stored })
      const shown = computeCartTotals(lines.map(l => ({ ...l })), globalDiscount, moneyCtx, false, true)
      const shape = (o: Record<string, unknown>) => [o.subtotal, o.discountAmount, o.taxAmount, o.roundingAmount, o.totalAmount]
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(shown) })

      const rule = (stored ?? (currencyCode === 'INR' ? '1' : 'NONE')) as RoundingRule
      const want = oracle(lines, { decimals, rule, globalDiscount })
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(want) })

      const items: Array<{ unitPrice: number; taxAmount: number; lineTotal: number; quantity: number }> = db.invoiceItem.create.mock.calls.map((c: any[]) => c[0].data)
      expect(items.length, ctx).toBe(lines.length)
      // items keep the price exactly as entered and store the derived tax/total
      items.forEach((it, i) => {
        expect(it.unitPrice, ctx).toBe(lines[i].unitPrice)
        expect(it.lineTotal, ctx).toBe(want.lineTotals[i])
      })
      expect(roundMoney(sumMoney(items.map(i => i.lineTotal), decimals) + (saved.roundingAmount as number), decimals), ctx).toBe(saved.totalAmount)
      expect(roundMoney(sumMoney(items.map(i => i.taxAmount), decimals), decimals), ctx).toBe(saved.taxAmount)
      // subtotal - discount + tax = total - rounding, the header identity
      expect(roundMoney((saved.subtotal as number) - (saved.discountAmount as number) + (saved.taxAmount as number) + (saved.roundingAmount as number), decimals), ctx).toBe(saved.totalAmount)
      // a payment that adds up to the displayed total is exactly the balance
      expect(saved.balanceAmount, ctx).toBe(saved.totalAmount)
      checked++
    }
    expect(checked).toBeGreaterThan(2300)
  }, 60_000)

  it('the business default applies when a caller does not say: setting true -> inclusive, setting false/missing -> exclusive', async () => {
    const line = { productId: 'prod-1', quantity: 1, unitPrice: 118, discountAmount: 0, taxRate: 18 }
    let db = makeInvoiceDb('USD', { prices_include_tax: 'true' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: [line], paymentMethod: 'CASH', globalDiscount: 0 } as never)
    let saved = db.invoice.create.mock.calls[0][0].data
    expect([saved.pricesIncludeTax, saved.taxAmount, saved.totalAmount]).toEqual([true, 18, 118])

    db = makeInvoiceDb('USD', { prices_include_tax: 'false' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: [line], paymentMethod: 'CASH', globalDiscount: 0 } as never)
    saved = db.invoice.create.mock.calls[0][0].data
    expect([saved.pricesIncludeTax, saved.taxAmount, saved.totalAmount]).toEqual([false, 21.24, 139.24])

    // an explicit choice always beats the default
    db = makeInvoiceDb('USD', { prices_include_tax: 'true' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: [line], paymentMethod: 'CASH', globalDiscount: 0, pricesIncludeTax: false } as never)
    saved = db.invoice.create.mock.calls[0][0].data
    expect([saved.pricesIncludeTax, saved.totalAmount]).toEqual([false, 139.24])
  })

  it('tax-exempt customers, Composition businesses and free-of-cost lines stay tax-free in inclusive mode (taxable = entered amount)', async () => {
    const lines = [{ quantity: 2, unitPrice: 99.99, discountAmount: 0, taxRate: 18 }]
    let db = makeInvoiceDb('USD', {})
    db.customer.findUnique = vi.fn().mockResolvedValue({ taxExempt: true, taxExemptReason: 'SEZ' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ customerId: 'c1', items: lines.map(l => ({ productId: 'prod-1', ...l })), paymentMethod: 'CASH', globalDiscount: 0, pricesIncludeTax: true } as never)
    let saved = db.invoice.create.mock.calls[0][0].data
    const shown = computeCartTotals(lines, 0, buildMoneyContext({ currencyCode: 'USD' }, {}), true, true)
    expect([saved.taxAmount, saved.totalAmount]).toEqual([0, 199.98])
    expect([saved.taxAmount, saved.totalAmount]).toEqual([shown.taxAmount, shown.totalAmount])

    db = makeInvoiceDb('USD', {})
    db.businessProfile.findFirst = vi.fn().mockResolvedValue({ currencyCode: 'USD', gstScheme: 'COMPOSITION', lockDate: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: lines.map(l => ({ productId: 'prod-1', ...l })), paymentMethod: 'CASH', globalDiscount: 0, pricesIncludeTax: true } as never)
    saved = db.invoice.create.mock.calls[0][0].data
    expect([saved.taxAmount, saved.totalAmount]).toEqual([0, 199.98])

    db = makeInvoiceDb('USD', {})
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: [{ productId: 'prod-1', quantity: 2, unitPrice: 59, discountAmount: 0, taxRate: 18 }, { productId: 'prod-1', quantity: 1, unitPrice: 50, discountAmount: 0, taxRate: 18, isFreeOfCost: true }], paymentMethod: 'CASH', globalDiscount: 0, pricesIncludeTax: true } as never)
    saved = db.invoice.create.mock.calls[0][0].data
    expect([saved.totalAmount, saved.taxAmount]).toEqual([118, 18])
  })
})

// --------------------------------------------------------------------------- other documents
function shapeItems(rng: Rng, decimals: number, n: number, discount: 'amount' | 'percent' | 'none') {
  return Array.from({ length: n }, () => {
    const l = genLine(rng, decimals)
    return { ...l, discount: discount === 'percent' ? pick(rng, [0, 0, 5, 10, 12.5, 100, 33.33]) : 0, discountAmount: discount === 'amount' ? l.discountAmount : 0 }
  })
}
function tx(db: Record<string, any>) {
  db.$transaction = vi.fn(async (arg: unknown) => Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(db))
  return db
}
const seqSetting = () => ({
  findUnique: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 })
})

describe('inclusive quotations: form == saved == oracle', () => {
  it('1000 random quotations', async () => {
    const rng = mulberry32(11)
    for (let n = 0; n < 1000; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 6), 'percent')
      const db = tx({
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode }) },
        quotation: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'q', items: [], customer: null })) },
        setting: seqSetting()
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await quotationService.create({ customerName: 'X', pricesIncludeTax: true, items: items.map(i => ({ productName: 'P', quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate })) }, 'u')
      expect(res.success).toBe(true)
      const saved = db.quotation.create.mock.calls[0][0].data as Record<string, any>
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discount, taxRate: i.taxRate })), { decimals, pricesIncludeTax: true })
      // oracle: percent discount converted to an amount on the rounded inclusive gross
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: new D(new D(i.quantity).mul(i.unitPrice).toDecimalPlaces(decimals, D.ROUND_HALF_UP)).mul(i.discount).div(100).toDecimalPlaces(decimals, D.ROUND_HALF_UP).toNumber() })), { decimals, rule: 'NONE' })
      const ctx = JSON.stringify({ n, currencyCode, items })
      const shape = (o: Record<string, any>) => [o.subtotal, o.discountAmount, o.taxAmount, o.totalAmount]
      expect(saved.pricesIncludeTax).toBe(true)
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(form) })
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(want) })
      const created = saved.items.create as Array<{ lineTotal: number }>
      expect({ ctx, v: created.map(i => i.lineTotal) }).toEqual({ ctx, v: want.lineTotals })
    }
  }, 60_000)
})

describe('inclusive sales orders, purchase orders, bills, credit and debit notes: form == saved == oracle', () => {
  it('1000 sales orders', async () => {
    const rng = mulberry32(12)
    for (let n = 0; n < 1000; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 6), 'none')
      const db = tx({
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
        customer: { findUnique: vi.fn().mockResolvedValue({ id: 'c', isActive: true }) },
        product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', isActive: true, productName: 'P' }) },
        salesOrder: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'so', items: [], customer: null })) },
        setting: seqSetting()
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await salesOrderService.createSalesOrder({ customerId: 'c', pricesIncludeTax: true, items: items.map(i => ({ productId: 'p', quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })) } as never, 'u')
      expect(res.success, JSON.stringify(res)).toBe(true)
      const saved = db.salesOrder.create.mock.calls[0][0].data as Record<string, any>
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals, pricesIncludeTax: true })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: 0 })), { decimals, rule: 'NONE' })
      const ctx = JSON.stringify({ n, currencyCode, items })
      const shape = (o: Record<string, any>) => [o.subtotal, o.taxAmount, o.totalAmount]
      expect(saved.pricesIncludeTax).toBe(true)
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(form) })
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(want) })
      expect({ ctx, v: (saved.items.create as Array<{ total: number }>).map(i => i.total) }).toEqual({ ctx, v: want.lineTotals })
    }
  }, 60_000)

  it('1000 purchase orders (incl. reverse charge)', async () => {
    const rng = mulberry32(13)
    for (let n = 0; n < 1000; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const reverse = rng() < 0.25
      const items = shapeItems(rng, decimals, int(rng, 1, 6), 'none')
      const db = tx({
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
        supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's', isActive: true }) },
        product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', isActive: true, productName: 'P', productType: 'STANDARD' }) },
        purchaseOrder: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'po', items: [], supplier: null })) },
        setting: seqSetting()
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await purchaseOrderService.createPO({ supplierId: 's', isReverseCharge: reverse, pricesIncludeTax: true, items: items.map(i => ({ productId: 'p', quantity: i.quantity, unitCost: i.unitPrice, taxRate: i.taxRate })) } as never, 'u')
      expect(res.success, JSON.stringify(res)).toBe(true)
      const saved = db.purchaseOrder.create.mock.calls[0][0].data as Record<string, any>
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals, pricesIncludeTax: true, excludeTaxFromTotal: reverse })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: 0 })), { decimals, rule: 'NONE', excludeTax: reverse })
      const ctx = JSON.stringify({ n, currencyCode, reverse, items })
      const shape = (o: Record<string, any>) => [o.subtotal, o.taxAmount, o.totalAmount]
      expect(saved.pricesIncludeTax).toBe(true)
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(form) })
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(want) })
    }
  }, 60_000)

  it('1000 supplier bills (incl. reverse charge and line discounts)', async () => {
    const rng = mulberry32(14)
    for (let n = 0; n < 1000; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const reverse = rng() < 0.3
      const items = shapeItems(rng, decimals, int(rng, 1, 6), 'amount')
      const db = tx({
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
        chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa', accountCode: '6000', accountName: 'Opex', accountType: 'EXPENSE', isActive: true }) },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's', isActive: true, supplierName: 'S' }) },
        product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', productName: 'P', isActive: true }) },
        purchaseOrder: { findUnique: vi.fn().mockResolvedValue(null) },
        bill: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'b', items: [], supplier: { supplierName: 'S' } })) },
        supplierLedger: { findFirst: vi.fn().mockResolvedValue(null) },
        productCostHistory: { create: vi.fn().mockResolvedValue({}) },
        setting: seqSetting()
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await billService.createBill({ supplierId: 's', isReverseCharge: reverse, pricesIncludeTax: true, items: items.map(i => ({ productId: 'p', quantity: i.quantity, unitCost: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.taxRate })) } as never, 'u')
      expect(res.success, JSON.stringify(res)).toBe(true)
      const saved = db.bill.create.mock.calls[0][0].data as Record<string, any>
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.taxRate })), { decimals, excludeTaxFromTotal: reverse, pricesIncludeTax: true })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: i.discountAmount })), { decimals, rule: 'NONE', excludeTax: reverse })
      const ctx = JSON.stringify({ n, currencyCode, reverse, items })
      const shape = (o: Record<string, any>) => [o.subtotal, o.discountAmount, o.taxAmount, o.totalAmount]
      expect(saved.pricesIncludeTax).toBe(true)
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(form) })
      expect({ ctx, v: shape(saved) }).toEqual({ ctx, v: shape(want) })
    }
  }, 60_000)

  it('800 credit notes and 800 debit notes; a note against an inclusive document inherits its mode', async () => {
    const rng = mulberry32(15)
    for (let n = 0; n < 800; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 5), 'none').map(i => ({ lineType: 'SERVICE', serviceDescription: 'x', quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate }))
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals, pricesIncludeTax: true })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: 0 })), { decimals, rule: 'NONE' })
      const ctx = JSON.stringify({ n, currencyCode, items })
      const explicit = rng() < 0.5

      const cnTx = {
        creditNote: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'cn', customer: null, invoice: null })) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ gstScheme: 'REGULAR' }) },
      chartOfAccounts: { findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => ({ id: `coa-${where.accountCode}`, accountCode: where.accountCode, accountName: where.accountCode, accountType: 'ASSET', isActive: true })) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
        setting: seqSetting(),
        customerLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }), create: vi.fn().mockResolvedValue({}) },
        customer: { update: vi.fn().mockResolvedValue({}) },
        invoice: { findUniqueOrThrow: vi.fn().mockResolvedValue({ balanceAmount: 0, paymentStatus: 'PAID' }), update: vi.fn() }
      }
      const cnDb = {
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode }) },
        invoice: { findUnique: vi.fn().mockResolvedValue({ id: 'inv', pricesIncludeTax: true }) },
        $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(cnTx))
      }
      vi.mocked(getPrisma).mockReturnValue(cnDb as never)
      const cnRes = await creditNoteService.create({ reason: 'r', invoiceId: 'inv', items, ...(explicit ? { pricesIncludeTax: true } : {}) } as never, 'u')
      expect(cnRes.success, JSON.stringify(cnRes)).toBe(true)
      const cnSaved = cnTx.creditNote.create.mock.calls[0][0].data as { amount: number; pricesIncludeTax: boolean }
      expect(cnSaved.pricesIncludeTax).toBe(true)
      expect({ ctx, v: cnSaved.amount }).toEqual({ ctx, v: form.totalAmount })
      expect({ ctx, v: cnSaved.amount }).toEqual({ ctx, v: want.totalAmount })

      const dnTx = {
        debitNote: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'dn', supplier: null, purchaseOrder: null })) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ gstScheme: 'REGULAR' }) },
      chartOfAccounts: { findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => ({ id: `coa-${where.accountCode}`, accountCode: where.accountCode, accountName: where.accountCode, accountType: 'ASSET', isActive: true })) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
        setting: seqSetting(),
        supplierLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }), create: vi.fn().mockResolvedValue({}) },
        supplier: { update: vi.fn().mockResolvedValue({}) }
      }
      const dnDb = {
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode }) },
        purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po', pricesIncludeTax: true }) },
        $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(dnTx))
      }
      vi.mocked(getPrisma).mockReturnValue(dnDb as never)
      const dnRes = await debitNoteService.create({ supplierId: 's', purchaseOrderId: 'po', reason: 'r', items, ...(explicit ? { pricesIncludeTax: true } : {}) } as never, 'u')
      expect(dnRes.success, JSON.stringify(dnRes)).toBe(true)
      const dnSaved = dnTx.debitNote.create.mock.calls[0][0].data as { amount: number; pricesIncludeTax: boolean }
      expect(dnSaved.pricesIncludeTax).toBe(true)
      expect({ ctx, v: dnSaved.amount }).toEqual({ ctx, v: form.totalAmount })
      expect({ ctx, v: dnSaved.amount }).toEqual({ ctx, v: want.totalAmount })
    }
  }, 60_000)

  it('a plain-amount credit note never carries the flag; an exclusive linked invoice gives an exclusive note', async () => {
    const cnTx = {
      creditNote: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'cn', customer: null, invoice: null })) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ gstScheme: 'REGULAR' }) },
      chartOfAccounts: { findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => ({ id: `coa-${where.accountCode}`, accountCode: where.accountCode, accountName: where.accountCode, accountType: 'ASSET', isActive: true })) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
      setting: seqSetting(), customerLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }), create: vi.fn() }, customer: { update: vi.fn() },
      invoice: { findUniqueOrThrow: vi.fn().mockResolvedValue({ balanceAmount: 0, paymentStatus: 'PAID' }), update: vi.fn() }
    }
    const db = { businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'USD' }) }, invoice: { findUnique: vi.fn().mockResolvedValue({ id: 'inv', pricesIncludeTax: false }) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(cnTx)) }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await creditNoteService.create({ reason: 'r', amount: 50 } as never, 'u')
    expect(cnTx.creditNote.create.mock.calls[0][0].data.pricesIncludeTax).toBe(false)
    await creditNoteService.create({ reason: 'r', invoiceId: 'inv', items: [{ serviceDescription: 'x', quantity: 1, unitPrice: 100, taxRate: 18 }] } as never, 'u')
    expect(cnTx.creditNote.create.mock.calls[1][0].data.pricesIncludeTax).toBe(false)
    expect(cnTx.creditNote.create.mock.calls[1][0].data.amount).toBe(118)
  })
})

// ----------------------------------------------------------------------------------- conversions
describe('conversions keep totals identical to the source', () => {
  function convertDb(quotation: Record<string, unknown>, currencyCode: string) {
    const txClient: Record<string, any> = {
      invoice: { create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'inv-1', ...data })) },
      invoiceItem: { create: vi.fn().mockResolvedValue({}) },
      salesOrder: { create: vi.fn().mockImplementation(({ data }: { data: Record<string, any> }) => Promise.resolve({ id: 'so-1', ...data })), findMany: vi.fn().mockResolvedValue([]) },
      quotation: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ invoice: null, salesOrder: null }) },
      setting: seqSetting(),
      chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1100', accountName: 'AR', accountType: 'ASSET', isActive: true }) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]) }
    }
    const db: Record<string, any> = {
      quotation: { findUnique: vi.fn().mockResolvedValue(quotation) },
      product: { findUnique: vi.fn().mockResolvedValue({ productType: 'SERVICE' }), findFirst: vi.fn().mockResolvedValue(null) },
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'c1', isActive: true }) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
      // conversions apply the business rounding rule like a direct sale; these tests check the untouched maths
      setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'invoice_rounding_rule', settingValue: 'NONE' }) }
    }
    db.$transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(txClient))
    return { db, txClient }
  }

  it('quotation -> invoice and quotation -> sales order: 600 random inclusive quotations', async () => {
    const rng = mulberry32(21)
    for (let n = 0; n < 600; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 5), 'percent')
      const source = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discount, taxRate: i.taxRate })), { decimals, pricesIncludeTax: true })
      const quotation = {
        id: 'qt-1', quotationNumber: 'QT-1', customerId: 'c1', invoice: null, salesOrder: null, status: 'SENT', notes: null, pricesIncludeTax: true,
        subtotal: source.subtotal, discountAmount: source.discountAmount, taxAmount: source.taxAmount, totalAmount: source.totalAmount,
        items: items.map((i, k) => ({ id: `qi-${k}`, productId: 'p', productName: 'P', sku: null, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate, lineTotal: source.lines[k].total }))
      }
      const ctx = JSON.stringify({ n, currencyCode, items })

      let { db, txClient } = convertDb(quotation, currencyCode)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const inv = await quotationService.convertToInvoice('qt-1', 'u')
      expect(inv.success, ctx + JSON.stringify(inv)).toBe(true)
      const invData = txClient.invoice.create.mock.calls[0][0].data as Record<string, any>
      expect(invData.pricesIncludeTax, ctx).toBe(true)
      expect({ ctx, v: [invData.subtotal, invData.discountAmount, invData.taxAmount, invData.totalAmount] }).toEqual({ ctx, v: [source.subtotal, source.discountAmount, source.taxAmount, source.totalAmount] })
      const invLines = txClient.invoiceItem.create.mock.calls.map((c: any[]) => c[0].data.lineTotal)
      expect({ ctx, v: invLines }).toEqual({ ctx, v: source.lines.map(l => l.total) })

      ;({ db, txClient } = convertDb(quotation, currencyCode))
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const so = await quotationService.convertToSalesOrder('qt-1', 'u')
      expect(so.success, ctx + JSON.stringify(so)).toBe(true)
      const soData = txClient.salesOrder.create.mock.calls[0][0].data as Record<string, any>
      expect(soData.pricesIncludeTax, ctx).toBe(true)
      // the SO has no discount column: its subtotal is net of discount, tax and total are the quotation's own
      expect({ ctx, v: [soData.taxAmount, soData.totalAmount] }).toEqual({ ctx, v: [source.taxAmount, source.totalAmount] })
      expect({ ctx, v: roundMoney(soData.subtotal + soData.taxAmount, decimals) }).toEqual({ ctx, v: source.totalAmount })
      expect({ ctx, v: (soData.items.create as Array<{ total: number }>).map(i => i.total) }).toEqual({ ctx, v: source.lines.map(l => l.total) })
    }
  })

  it('sales order -> invoice: any split into partial invoices adds up to the order, a full invoice equals it (500 orders)', async () => {
    const rng = mulberry32(22)
    for (let n = 0; n < 500; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 4), 'none').map(i => ({ ...i, quantity: pick(rng, [2, 3, 4, 5, 7, 10, 1.5, 6]) }))
      const so = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals, pricesIncludeTax: true })
      // a random number of partial invoices per line, quantities that sum to the ordered quantity
      const chunkPlans = items.map(i => {
        const parts = int(rng, 1, 3)
        const cuts = Array.from({ length: parts - 1 }, () => roundMoney(rng() * i.quantity, 2)).sort((a, b) => a - b)
        const qtys = [...cuts, i.quantity].map((c, k) => roundMoney(c - (k === 0 ? 0 : [...cuts, i.quantity][k - 1]), 2)).filter(q => q > 0)
        return qtys
      })
      const rounds = Math.max(...chunkPlans.map(p => p.length))
      const soItems = items.map((i, k) => ({ id: `soi-${k}`, salesOrderId: 'so-1', productId: 'p', serviceDescription: null, quantity: i.quantity, invoicedQty: 0, unitPrice: i.unitPrice, taxRate: i.taxRate, taxAmount: so.lines[k].tax, total: so.lines[k].total }))
      const invoiced = { total: 0, tax: 0 }
      const perLine = items.map(() => ({ total: 0, tax: 0 }))
      for (let round = 0; round < rounds; round++) {
        const lines = chunkPlans.map((p, k) => ({ k, q: p[round] })).filter(x => x.q !== undefined)
        const txClient: Record<string, any> = {
          invoice: { create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'inv-1', ...data })) },
          invoiceItem: { create: vi.fn().mockResolvedValue({}) },
          salesOrderItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue(soItems.map(s => ({ ...s, invoicedQty: s.quantity }))) },
          salesOrder: { update: vi.fn().mockResolvedValue({}) },
          setting: seqSetting(),
          chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1100', accountName: 'AR', accountType: 'ASSET', isActive: true }) },
          journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]) }
        }
        const db: Record<string, any> = {
          salesOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'so-1', soNumber: 'SO-1', customerId: 'c1', status: 'CONFIRMED', pricesIncludeTax: true, items: soItems.map(s => ({ ...s })) }) },
          product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', productName: 'P', sku: null, productType: 'SERVICE', isKit: false }) },
          businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
          setting: { findUnique: vi.fn().mockResolvedValue({ settingKey: 'invoice_rounding_rule', settingValue: 'NONE' }) }
        }
        db.$transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(txClient))
        vi.mocked(getPrisma).mockReturnValue(db as never)
        const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: lines.map(l => ({ salesOrderItemId: `soi-${l.k}`, quantity: l.q })) }, 'u')
        expect(res.success, JSON.stringify({ n, res })).toBe(true)
        const inv = txClient.invoice.create.mock.calls[0][0].data as Record<string, any>
        const rows: Array<{ lineTotal: number; taxAmount: number }> = txClient.invoiceItem.create.mock.calls.map((c: any[]) => c[0].data)
        // header equals the sum of its own rows, tax-exclusive subtotal + tax = total
        expect(roundMoney(sumMoney(rows.map(r => r.lineTotal), decimals), decimals), JSON.stringify({ n, round })).toBe(inv.totalAmount)
        expect(roundMoney(inv.subtotal + inv.taxAmount, decimals), JSON.stringify({ n, round })).toBe(inv.totalAmount)
        expect(inv.pricesIncludeTax).toBe(true)
        lines.forEach((l, idx) => {
          perLine[l.k].total = roundMoney(perLine[l.k].total + rows[idx].lineTotal, decimals)
          perLine[l.k].tax = roundMoney(perLine[l.k].tax + rows[idx].taxAmount, decimals)
          soItems[l.k].invoicedQty = roundMoney(soItems[l.k].invoicedQty + l.q, 6)
        })
        invoiced.total = roundMoney(invoiced.total + inv.totalAmount, decimals)
        invoiced.tax = roundMoney(invoiced.tax + inv.taxAmount, decimals)
      }
      const ctx = JSON.stringify({ n, currencyCode, items, chunkPlans })
      expect({ ctx, v: perLine.map(p => [p.total, p.tax]) }).toEqual({ ctx, v: so.lines.map(l => [l.total, l.tax]) })
      expect({ ctx, v: [invoiced.total, invoiced.tax] }).toEqual({ ctx, v: [so.totalAmount, so.taxAmount] })
    }
  })

  it('purchase order -> bill: the bill inherits the flag and its totals equal the PO for the same lines', async () => {
    const rng = mulberry32(23)
    for (let n = 0; n < 300; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 5), 'none')
      const po = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals, pricesIncludeTax: true })
      const db = tx({
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
        chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa', accountCode: '6000', accountName: 'Opex', accountType: 'EXPENSE', isActive: true }) },
        journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
        supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's', isActive: true, supplierName: 'S' }) },
        product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', productName: 'P', isActive: true }) },
        purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po', supplierId: 's', pricesIncludeTax: true, status: 'APPROVED' }) },
        bill: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'b', items: [], supplier: { supplierName: 'S' } })) },
        supplierLedger: { findFirst: vi.fn().mockResolvedValue(null) },
        productCostHistory: { create: vi.fn().mockResolvedValue({}) },
        setting: seqSetting()
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      // the screen does not repeat the flag: it is inherited from the linked PO
      const res = await billService.createBill({ supplierId: 's', purchaseOrderId: 'po', isReverseCharge: false, items: items.map(i => ({ productId: 'p', quantity: i.quantity, unitCost: i.unitPrice, discountAmount: 0, taxRate: i.taxRate })) } as never, 'u')
      expect(res.success, JSON.stringify(res)).toBe(true)
      const saved = db.bill.create.mock.calls[0][0].data as Record<string, any>
      const ctx = JSON.stringify({ n, currencyCode, items })
      expect(saved.pricesIncludeTax, ctx).toBe(true)
      expect({ ctx, v: [saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [po.taxAmount, po.totalAmount] })
    }
  })
})

// ------------------------------------------------------------------------ purchase cost basis
describe('purchase cost basis is tax-exclusive for inclusive documents', () => {
  it('a bill of 10 x 118 at 18% inclusive records a stock cost of 100 per unit, not 118', async () => {
    const db = tx({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'USD', lockDate: null }) },
      chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa', accountCode: '6000', accountName: 'Opex', accountType: 'EXPENSE', isActive: true }) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's', isActive: true, supplierName: 'S' }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', productName: 'P', isActive: true }) },
      bill: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'b', items: (data.items.create as any[]).map((it, i) => ({ ...it, id: `bi-${i}` })), supplier: { supplierName: 'S' } })) },
      supplierLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      landedCostAllocation: { create: vi.fn().mockResolvedValue({}) },
      productCostHistory: { create: vi.fn().mockResolvedValue({}) },
      setting: seqSetting()
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await billService.createBill({ supplierId: 's', isReverseCharge: false, pricesIncludeTax: true, items: [{ productId: 'p', quantity: 10, unitCost: 118, discountAmount: 0, taxRate: 18 }] } as never, 'u')
    expect(res.success).toBe(true)
    expect(db.productCostHistory.create.mock.calls[0][0].data.unitCost).toBe(100)

    // landed cost is spread over the exclusive value: 100 of freight on 1000 -> +10 per unit
    db.productCostHistory.create.mockClear()
    await billService.createBill({ supplierId: 's', isReverseCharge: false, pricesIncludeTax: true, landedCosts: [{ costType: 'FREIGHT', amount: 100, allocationMethod: 'BY_VALUE' }], items: [{ productId: 'p', quantity: 10, unitCost: 118, discountAmount: 0, taxRate: 18 }] } as never, 'u')
    expect(db.productCostHistory.create.mock.calls[0][0].data.unitCost).toBe(110)

    // an exclusive bill is unchanged
    db.productCostHistory.create.mockClear()
    await billService.createBill({ supplierId: 's', isReverseCharge: false, pricesIncludeTax: false, items: [{ productId: 'p', quantity: 10, unitCost: 100, discountAmount: 0, taxRate: 18 }] } as never, 'u')
    expect(db.productCostHistory.create.mock.calls[0][0].data.unitCost).toBe(100)
  })

  it('receiving an inclusive PO adds stock at the tax-exclusive unit cost (and the supplier ledger owes the payable total)', async () => {
    const po = {
      id: 'po-1', poNumber: 'PO-1', supplierId: 's', status: 'APPROVED', pricesIncludeTax: true, isReverseCharge: false, dropShipToCustomerId: null,
      subtotal: 1000, taxAmount: 180, totalAmount: 1180,
      items: [{ id: 'poi-1', productId: 'p', quantity: 10, unitCost: 118, taxRate: 18, taxAmount: 180, total: 1180 }]
    }
    const db = tx({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ gstScheme: 'REGULAR' }) },
      purchaseOrder: { findUnique: vi.fn().mockResolvedValue(po), update: vi.fn().mockResolvedValue({ ...po, status: 'RECEIVED' }) },
      landedCostAllocation: { findMany: vi.fn().mockResolvedValue([]) },
      bill: { findFirst: vi.fn().mockResolvedValue(null) },
      chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '6000', accountName: 'Opex', accountType: 'EXPENSE', isActive: true }) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]) },
      setting: seqSetting(),
      productCostHistory: { create: vi.fn().mockResolvedValue({}) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await purchaseOrderService.receivePO('po-1', 'u')
    expect(res.success, JSON.stringify(res)).toBe(true)
    const args = vi.mocked(inventoryService.addStockTx).mock.calls[0]
    expect(args[2]).toBe(10)
    expect(args[3]).toBe(100)
    const { supplierLedgerService } = await import('../supplier-ledger.service')
    expect(vi.mocked(supplierLedgerService.addEntry).mock.calls[0][0]).toMatchObject({ debitAmount: 1180 })
  })
})

// ------------------------------------------------------------------------------------ returns
describe('returns against an inclusive invoice refund proportionally from the stored inclusive totals', () => {
  function returnsDb(original: Record<string, unknown>, prior: unknown[] = []) {
    const db: Record<string, any> = {
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'USD' }) },
      invoice: {
        findUnique: vi.fn().mockResolvedValue(original),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ balanceAmount: 0, paymentStatus: 'PAID' }),
        update: vi.fn(),
        findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => (where && 'originalInvoiceId' in where ? prior : [])),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'ret-1', ...data }))
      },
      inventoryMovement: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
      inventory: { upsert: vi.fn() },
      location: { findFirst: vi.fn().mockResolvedValue({ id: 'loc', isDefault: true }) },
      locationStock: { upsert: vi.fn() },
      productBatch: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
      productSerial: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
      productVariant: { findUnique: vi.fn(), update: vi.fn() },
      setting: seqSetting()
    }
    db.$transaction = vi.fn((fn: (t: unknown) => unknown) => fn(db))
    return db
  }
  const original = (qty: number, lineTotal: number, tax: number) => ({
    id: 'inv-o', invoiceNumber: 'INV-1', invoiceType: 'RETAIL', status: 'ACTIVE', customerId: 'c1', customer: { id: 'c1' }, pricesIncludeTax: true,
    items: [{ id: 'i1', productId: 'p1', quantity: qty, unitPrice: lineTotal / qty, discountAmount: 0, taxRate: 18, taxAmount: tax, lineTotal, variantId: null, variantInfo: null, product: { id: 'p1', productName: 'W', productType: 'SERVICE', isKit: false } }]
  })

  it('a full return refunds exactly the sold payable amount (299.97 with 45.76 tax)', async () => {
    const db = returnsDb(original(3, 299.97, 45.76))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createReturn('inv-o', [{ productId: 'p1', quantity: 3 }], 'r')
    expect(res.success, JSON.stringify(res)).toBe(true)
    const ret = db.invoice.create.mock.calls[0][0].data as Record<string, any>
    expect(ret.pricesIncludeTax).toBe(true)
    expect(ret.totalAmount).toBe(-299.97)
    expect(ret.taxAmount).toBe(45.76)
    expect(ret.items.create[0].lineTotal).toBe(-254.21) // negative tax-exclusive, the return-line convention
    expect(ret.items.create[0].unitPrice).toBeCloseTo(99.99, 8)
  })

  it('a partial return refunds its proportional share, and the last piece takes exactly what is left', async () => {
    // 3 units sold for 299.97 (tax 45.76): 1 unit = 99.99 (tax 15.25.33..)
    let db = returnsDb(original(3, 299.97, 45.76))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await createReturn('inv-o', [{ productId: 'p1', quantity: 1 }], 'r')
    const first = db.invoice.create.mock.calls[0][0].data as Record<string, any>
    expect(first.totalAmount).toBe(-99.99)
    expect(first.taxAmount).toBe(15.25)

    // one unit already refunded (99.99 incl / 15.25 tax): returning the remaining 2 refunds the exact remainder
    const priorReturn = { invoiceType: 'RETURN', items: [{ productId: 'p1', variantId: null, quantity: 1, lineTotal: -84.74, taxAmount: 15.25 }] }
    db = returnsDb(original(3, 299.97, 45.76), [priorReturn])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await createReturn('inv-o', [{ productId: 'p1', quantity: 2 }], 'r')
    const rest = db.invoice.create.mock.calls[0][0].data as Record<string, any>
    expect(rest.totalAmount).toBe(-199.98)
    expect(rest.taxAmount).toBe(30.51)
    // together the two refunds are exactly the sale
    expect(roundMoney(99.99 + 199.98, 2)).toBe(299.97)
    expect(roundMoney(15.25 + 30.51, 2)).toBe(45.76)
  })

  it('random original lines: any sequence of partial returns never refunds more than was sold and ends at exactly the sale (400 lines)', async () => {
    const rng = mulberry32(31)
    for (let n = 0; n < 400; n++) {
      const qty = pick(rng, [3, 4, 5, 7, 10, 12])
      const unit = roundMoney(rng() * pick(rng, [10, 500, 5000]), 2)
      const rate = pick(rng, [5, 12, 18, 28, 2.5, 3])
      const t = computeDocumentTotals([{ quantity: qty, unitPrice: unit, taxRate: rate }], { pricesIncludeTax: true })
      const lineTotal = t.lines[0].total
      const tax = t.lines[0].tax
      // random partition of qty into whole-unit returns
      let left = qty
      const parts: number[] = []
      while (left > 0) { const q = int(rng, 1, left); parts.push(q); left -= q }
      const prior: unknown[] = []
      let refunded = 0
      let refundedTax = 0
      for (const q of parts) {
        const db = returnsDb(original(qty, lineTotal, tax), prior)
        vi.mocked(getPrisma).mockReturnValue(db as never)
        const res = await createReturn('inv-o', [{ productId: 'p1', quantity: q }], 'r')
        expect(res.success, JSON.stringify({ n, parts, res })).toBe(true)
        const ret = db.invoice.create.mock.calls[0][0].data as Record<string, any>
        const line = ret.items.create[0]
        refunded = roundMoney(refunded + Math.abs(ret.totalAmount), 2)
        refundedTax = roundMoney(refundedTax + ret.taxAmount, 2)
        expect(refunded <= lineTotal + 1e-9, JSON.stringify({ n, parts, refunded, lineTotal })).toBe(true)
        prior.push({ invoiceType: 'RETURN', items: [{ productId: 'p1', variantId: null, quantity: q, lineTotal: line.lineTotal, taxAmount: line.taxAmount }] })
      }
      expect({ n, parts, v: [refunded, refundedTax] }).toEqual({ n, parts, v: [lineTotal, tax] })
    }
  })
})

// ------------------------------------------------------------------------------------ settings
describe('prices_include_tax setting', () => {
  it('accepts only true or false, like the rounding setting validates its own values', async () => {
    const setting = { upsert: vi.fn().mockResolvedValue({}) }
    vi.mocked(getPrisma).mockReturnValue({ setting } as never)
    expect((await setSetting('prices_include_tax', 'maybe')).success).toBe(false)
    expect((await setSetting('prices_include_tax', '')).success).toBe(false)
    expect(setting.upsert).not.toHaveBeenCalled()
    expect((await setSetting('prices_include_tax', 'true')).success).toBe(true)
    expect((await setSetting('prices_include_tax', 'false')).success).toBe(true)
    expect(setting.upsert).toHaveBeenCalledTimes(2)
  })

  it('the renderer money context reads the business default', () => {
    expect(buildMoneyContext({ currencyCode: 'GBP' }, {}).pricesIncludeTaxDefault).toBe(false)
    expect(buildMoneyContext({ currencyCode: 'GBP' }, { prices_include_tax: 'true' }).pricesIncludeTaxDefault).toBe(true)
    expect(buildMoneyContext({ currencyCode: 'GBP' }, { prices_include_tax: 'false' }).pricesIncludeTaxDefault).toBe(false)
  })
})
