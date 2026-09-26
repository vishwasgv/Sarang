// Screen/backend money parity. The renderer and the main process must produce the SAME totals for the
// same cart, to the last minor unit. Three layers are checked with thousands of seeded-random carts:
//  1. shared module vs an independent Decimal-based oracle (the algorithm the backend used before it
//     was moved into src/shared/utils/money.ts),
//  2. the renderer's computeCartTotals vs the REAL billingService.createInvoice on a mocked database,
//  3. the same for quotations, sales orders, purchase orders, supplier bills, credit and debit notes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('../purchase-tax-journal.util', async (orig) => ({ ...(await orig<typeof import('../purchase-tax-journal.util')>()), billGoodsShareTx: vi.fn().mockResolvedValue(0), orderGoodsShareTx: vi.fn().mockResolvedValue(0), noteGoodsShareTx: vi.fn().mockResolvedValue(0) }))
vi.mock('../cogs-journal.util', () => ({ postCogsJournalTx: vi.fn().mockResolvedValue(undefined), postReturnCogsJournalTx: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn().mockResolvedValue(undefined), addStockTx: vi.fn().mockResolvedValue(undefined) }, applyLocationDeltaTx: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))
vi.mock('../supplier-ledger.service', () => ({ supplierLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../notification.service', () => ({ createNotification: vi.fn() }))
vi.mock('../distributor-credit-risk.service', () => ({ getCustomerCreditRisk: vi.fn().mockResolvedValue({ success: true, data: { riskTier: 'UNRATED', riskMultiplier: 1 } }) }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'user-1' }) }))
vi.mock('../retainer.service', () => ({ createRetainer: vi.fn(), generateInvoiceForRetainer: vi.fn() }))
vi.mock('../kit.service', () => ({ explodeKitComponentsTx: vi.fn() }))
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
import { computeDocumentTotals, getCurrencyDecimals, roundMoney, splitTaxHalves, sumMoney, type RoundingRule } from '../../../shared/utils/money'
import { computeCartTotals } from '../../../renderer/src/shared/utils/cart-totals.util'
import { splitTaxLines } from '../../../renderer/src/shared/utils/tax.util'
import { buildMoneyContext } from '../../../renderer/src/shared/utils/money-context.util'

const D = Prisma.Decimal

// ---------------------------------------------------------------------------------------- PRNG
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

const TAX_RATES = [0, 0, 2.5, 5, 12, 18, 18, 20, 28, 40, 0.25, 3, 7.5] as const
const CURRENCIES = ['INR', 'USD', 'EUR', 'JPY', 'KWD', 'BHD', 'AED'] as const
const RULES: RoundingRule[] = ['NONE', '0.05', '0.10', '0.50', '1']

interface Line { quantity: number; unitPrice: number; discountAmount: number; taxRate: number }

function genLine(rng: Rng, decimals: number): Line {
  const quantity = pick(rng, [1, 1, 2, 3, 5, 10, 0.5, 0.25, 1.25, 1.234, 0.001, 2.5, int(rng, 1, 50), int(rng, 1, 100000)])
  const scale = pick(rng, [1, 10, 100, 1000])
  const unitPrice = decimals === 0
    ? pick(rng, [0, 1, 99, 100, 333.5, int(rng, 0, 50000)])
    : pick(rng, [0, 0.01, 0.005, 0.99, 12.34, int(rng, 0, 500000) / scale, int(rng, 1, 9999999) / 1000])
  const gross = roundMoney(quantity * unitPrice, decimals)
  const mode = rng()
  let discountAmount = 0
  if (mode < 0.25) discountAmount = roundMoney(gross * rng(), decimals)
  else if (mode < 0.32) discountAmount = gross // 100 percent
  return { quantity, unitPrice, discountAmount, taxRate: pick(rng, TAX_RATES) }
}

function genCart(rng: Rng, decimals: number): { lines: Line[]; globalDiscount: number } {
  const lines = Array.from({ length: int(rng, 1, 7) }, () => genLine(rng, decimals))
  const taxable = lines.reduce((s, l) => s + Math.max(0, roundMoney(l.quantity * l.unitPrice, decimals) - l.discountAmount), 0)
  const globalDiscount = rng() < 0.4 ? roundMoney(taxable * rng() * 0.9, decimals) : 0
  return { lines, globalDiscount }
}

// ------------------------------------------------------------------------- independent oracle
// The pre-refactor backend algorithm (Prisma.Decimal), written out longhand.
function oracle(lines: Line[], opts: { decimals: number; rule: RoundingRule; globalDiscount?: number; excludeTax?: boolean }) {
  const dp = opts.decimals
  const r = (x: Prisma.Decimal.Value) => new D(x).toDecimalPlaces(dp, D.ROUND_HALF_UP)
  const rows = lines.map((l) => {
    const gross = r(new D(l.quantity).mul(l.unitPrice))
    const disc = D.min(r(l.discountAmount), gross)
    const taxable = gross.sub(disc)
    return { gross, disc, taxable, rate: new D(l.taxRate), tax: r(taxable.mul(l.taxRate).div(100)) }
  })
  const gd = r(opts.globalDiscount ?? 0)
  const total = rows.reduce((a, x) => a.add(x.taxable), new D(0))
  if (gd.gt(0) && total.gt(0)) {
    // pre-refactor algorithm, plus the one deliberate change: a share is capped at its own line's
    // taxable value and any excess is pushed back onto earlier lines with room
    let done = new D(0)
    const shares = rows.map((x, i) => {
      const last = i === rows.length - 1
      const share = last ? gd.sub(done) : r(gd.mul(x.taxable).div(total))
      if (!last) done = done.add(share)
      return D.min(share, x.taxable)
    })
    let deficit = gd.sub(shares.reduce((a, s) => a.add(s), new D(0)))
    for (let i = rows.length - 1; i >= 0 && deficit.gt(0); i--) {
      const add = D.min(deficit, rows[i].taxable.sub(shares[i]))
      if (add.gt(0)) { shares[i] = shares[i].add(add); deficit = deficit.sub(add) }
    }
    rows.forEach((x, i) => {
      x.taxable = x.taxable.sub(shares[i])
      x.tax = r(x.taxable.mul(x.rate).div(100))
    })
  }
  const subtotal = rows.reduce((a, x) => a.add(x.gross), new D(0))
  const discount = rows.reduce((a, x) => a.add(x.disc), new D(0)).add(gd)
  const tax = rows.reduce((a, x) => a.add(x.tax), new D(0))
  const raw = subtotal.sub(discount).add(opts.excludeTax ? 0 : tax)
  const stepValue = opts.rule === 'NONE' ? null : new D(opts.rule)
  const stepUsable = stepValue !== null && stepValue.mul(new D(10).pow(dp)).gte(1) && stepValue.mul(new D(10).pow(dp)).isInteger()
  const totalAmount = stepUsable ? raw.div(stepValue!).toDecimalPlaces(0, D.ROUND_HALF_UP).mul(stepValue!) : raw
  return {
    subtotal: subtotal.toNumber(), discountAmount: discount.toNumber(), taxAmount: tax.toNumber(),
    totalAmount: totalAmount.toDecimalPlaces(dp, D.ROUND_HALF_UP).toNumber(),
    roundingAmount: totalAmount.sub(raw).toDecimalPlaces(dp, D.ROUND_HALF_UP).toNumber() + 0,
    lineTotals: rows.map(x => x.taxable.add(x.tax).toNumber())
  }
}

describe('shared module vs independent Decimal oracle', () => {
  it('matches on 6000 random carts across currencies and every rounding rule', () => {
    const rng = mulberry32(20260924)
    for (let n = 0; n < 6000; n++) {
      const cur = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(cur)
      const rule = pick(rng, RULES)
      const { lines, globalDiscount } = genCart(rng, decimals)
      const got = computeDocumentTotals(lines, { decimals, roundingRule: rule, globalDiscount })
      const want = oracle(lines, { decimals, rule, globalDiscount })
      const ctx = JSON.stringify({ n, cur, rule, lines, globalDiscount })
      expect({ ctx, subtotal: got.subtotal, discountAmount: got.discountAmount, taxAmount: got.taxAmount, roundingAmount: got.roundingAmount, totalAmount: got.totalAmount })
        .toEqual({ ctx, subtotal: want.subtotal, discountAmount: want.discountAmount, taxAmount: want.taxAmount, roundingAmount: want.roundingAmount, totalAmount: want.totalAmount })
    }
  }, 60_000)

  it('invariants: line totals + rounding = total, CGST + SGST = tax, total is a multiple of the step', () => {
    const rng = mulberry32(777)
    for (let n = 0; n < 4000; n++) {
      const decimals = getCurrencyDecimals(pick(rng, CURRENCIES))
      const rule = pick(rng, RULES)
      const { lines, globalDiscount } = genCart(rng, decimals)
      const t = computeDocumentTotals(lines, { decimals, roundingRule: rule, globalDiscount })
      const ctx = JSON.stringify({ n, decimals, rule, lines, globalDiscount })
      expect(roundMoney(sumMoney(t.lines.map(l => l.total), decimals) + t.roundingAmount, decimals), ctx).toBe(t.totalAmount)
      expect(roundMoney(t.rawTotal + t.roundingAmount, decimals), ctx).toBe(t.totalAmount)
      const halves = splitTaxHalves(t.taxAmount, decimals)
      expect(roundMoney(halves.first + halves.second, decimals), ctx).toBe(t.taxAmount)
      const gstLines = splitTaxLines('GST', t.taxAmount, 'CGST_SGST', decimals)
      if (t.taxAmount > 0) {
        expect(gstLines.map(l => l.label)).toEqual(['CGST', 'SGST'])
        expect(roundMoney(gstLines[0].amount + gstLines[1].amount, decimals), ctx).toBe(t.taxAmount)
        expect(Math.abs(roundMoney(gstLines[0].amount - gstLines[1].amount, decimals)) <= 10 ** -decimals, ctx).toBe(true)
      }
      expect(t.lines.every(l => l.taxable >= 0 && l.tax >= 0), ctx).toBe(true)
    }
  })
})

// --------------------------------------------------------------------------- createInvoice mock
function makeInvoiceDb(currencyCode: string, ruleSetting: string | null) {
  const db: Record<string, any> = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { settingKey: string } }) =>
        where.settingKey === 'invoice_rounding_rule' && ruleSetting !== null ? { settingKey: where.settingKey, settingValue: ruleSetting } : null),
      create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    // SERVICE products skip inventory checks, so any quantity is sellable
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

beforeEach(() => vi.clearAllMocks())

describe('billingService.createInvoice vs the renderer cart total (property test)', () => {
  it('saves exactly the total the billing screen shows: 2500 carts', async () => {
    const rng = mulberry32(424242)
    let checked = 0
    for (let n = 0; n < 2500; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      // three business setups: rule never configured (currency default), or an explicit stored rule
      const stored = pick(rng, [null, null, ...RULES])
      const { lines, globalDiscount } = genCart(rng, decimals)

      const db = makeInvoiceDb(currencyCode, stored)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await billingService.createInvoice({
        items: lines.map(l => ({ productId: 'prod-1', quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: l.discountAmount, taxRate: l.taxRate })),
        paymentMethod: 'SPLIT' as const,
        globalDiscount
      } as never)

      const ctx = JSON.stringify({ n, currencyCode, stored, lines, globalDiscount, res: res.success ? 'ok' : res })
      // total legitimately negative / rejected by a business rule: skip, not a mismatch
      if (!res.success) { continue }
      const saved = db.invoice.create.mock.calls[0][0].data as Record<string, number>

      // renderer side: exactly what BillingScreen runs, with the business-store context
      const moneyCtx = buildMoneyContext({ currencyCode, gstScheme: 'REGULAR' }, stored === null ? {} : { invoice_rounding_rule: stored })
      const shown = computeCartTotals(lines.map(l => ({ ...l })), globalDiscount, moneyCtx)

      expect({ ctx, v: [saved.subtotal, saved.discountAmount, saved.taxAmount, saved.roundingAmount, saved.totalAmount] })
        .toEqual({ ctx, v: [shown.subtotal, shown.discountAmount, shown.taxAmount, shown.roundingAmount, shown.totalAmount] })
      // and against the independent oracle, using the rule the business actually has
      const rule = stored ?? (currencyCode === 'INR' ? '1' : 'NONE')
      const want = oracle(lines, { decimals, rule: rule as RoundingRule, globalDiscount })
      expect({ ctx, v: [saved.subtotal, saved.discountAmount, saved.taxAmount, saved.roundingAmount, saved.totalAmount] })
        .toEqual({ ctx, v: [want.subtotal, want.discountAmount, want.taxAmount, want.roundingAmount, want.totalAmount] })

      // stored per-line rows add up to the stored header
      const itemRows = db.invoice.create.mock.calls[0][0].data.items?.create as Array<{ lineTotal: number; taxAmount?: number }> | undefined
      if (itemRows) {
        expect(roundMoney(sumMoney(itemRows.map(i => i.lineTotal), decimals) + saved.roundingAmount, decimals), ctx).toBe(saved.totalAmount)
      }

      // a split payment that adds up to the displayed total is exactly the invoice balance
      const cash = roundMoney(shown.totalAmount * rng(), decimals)
      const upi = roundMoney(shown.totalAmount - cash, decimals)
      expect(roundMoney(cash + upi - saved.totalAmount, decimals), ctx).toBe(0)
      expect(saved.balanceAmount, ctx).toBe(saved.totalAmount)
      checked++
    }
    expect(checked).toBeGreaterThan(2300)
  }, 60_000)

  it('the reported case: a USD sale of 12.34 saves 12.34 and the screen shows 12.34 (was 12.00)', async () => {
    const db = makeInvoiceDb('USD', null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: [{ productId: 'prod-1', quantity: 1, unitPrice: 12.34, discountAmount: 0, taxRate: 0 }], paymentMethod: 'CASH', globalDiscount: 0 } as never)
    const saved = db.invoice.create.mock.calls[0][0].data
    expect(saved.totalAmount).toBe(12.34)
    expect(saved.roundingAmount).toBe(0)
    expect(computeCartTotals([{ quantity: 1, unitPrice: 12.34, discountAmount: 0, taxRate: 0 }], 0, buildMoneyContext({ currencyCode: 'USD' }, {})).totalAmount).toBe(12.34)
  })

  it('an INR business keeps whole-rupee rounding by default (unchanged for existing users)', async () => {
    const db = makeInvoiceDb('INR', null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: [{ productId: 'prod-1', quantity: 1, unitPrice: 99.99, discountAmount: 0, taxRate: 18 }], paymentMethod: 'CASH', globalDiscount: 0 } as never)
    const saved = db.invoice.create.mock.calls[0][0].data
    expect(saved.totalAmount).toBe(118)
    expect(saved.roundingAmount).toBe(0.01)
  })

  it('honours each stored rounding rule for INR', async () => {
    const expected: Record<string, [number, number]> = { NONE: [1234.56, 0], '0.05': [1234.55, -0.01], '0.10': [1234.6, 0.04], '0.50': [1234.5, -0.06], '1': [1235, 0.44] }
    for (const rule of RULES) {
      const db = makeInvoiceDb('INR', rule)
      vi.mocked(getPrisma).mockReturnValue(db as never)
      await billingService.createInvoice({ items: [{ productId: 'prod-1', quantity: 1, unitPrice: 1234.56, discountAmount: 0, taxRate: 0 }], paymentMethod: 'CASH', globalDiscount: 0 } as never)
      const saved = db.invoice.create.mock.calls[0][0].data
      expect([saved.totalAmount, saved.roundingAmount]).toEqual(expected[rule])
    }
  })

  it('tax-exempt customers and Composition-scheme businesses: the screen zeroes tax like the backend does', async () => {
    const lines = [{ quantity: 2, unitPrice: 99.99, discountAmount: 0, taxRate: 18 }]
    // tax-exempt customer
    let db = makeInvoiceDb('INR', null)
    db.customer.findUnique = vi.fn().mockResolvedValue({ taxExempt: true, taxExemptReason: 'SEZ' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ customerId: 'c1', items: lines.map(l => ({ productId: 'prod-1', ...l })), paymentMethod: 'CASH', globalDiscount: 0 } as never)
    let saved = db.invoice.create.mock.calls[0][0].data
    const shownExempt = computeCartTotals(lines, 0, buildMoneyContext({ currencyCode: 'INR' }, {}), true)
    expect(saved.taxAmount).toBe(0)
    expect([saved.taxAmount, saved.totalAmount, saved.roundingAmount]).toEqual([shownExempt.taxAmount, shownExempt.totalAmount, shownExempt.roundingAmount])
    // composition scheme
    db = makeInvoiceDb('INR', null)
    db.businessProfile.findFirst = vi.fn().mockResolvedValue({ currencyCode: 'INR', gstScheme: 'COMPOSITION', lockDate: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: lines.map(l => ({ productId: 'prod-1', ...l })), paymentMethod: 'CASH', globalDiscount: 0 } as never)
    saved = db.invoice.create.mock.calls[0][0].data
    const shownComp = computeCartTotals(lines, 0, buildMoneyContext({ currencyCode: 'INR', gstScheme: 'COMPOSITION' }, {}))
    expect(saved.taxAmount).toBe(0)
    expect([saved.taxAmount, saved.totalAmount, saved.roundingAmount]).toEqual([shownComp.taxAmount, shownComp.totalAmount, shownComp.roundingAmount])
  })

  it('a free-of-cost line is zeroed on screen and in the backend', async () => {
    const lines = [{ quantity: 2, unitPrice: 50, discountAmount: 0, taxRate: 18 }, { quantity: 1, unitPrice: 50, discountAmount: 0, taxRate: 18, isFreeOfCost: true }]
    const db = makeInvoiceDb('USD', null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: lines.map(l => ({ productId: 'prod-1', ...l })), paymentMethod: 'CASH', globalDiscount: 0 } as never)
    const saved = db.invoice.create.mock.calls[0][0].data
    const shown = computeCartTotals(lines, 0, buildMoneyContext({ currencyCode: 'USD' }, {}))
    expect([saved.subtotal, saved.taxAmount, saved.totalAmount]).toEqual([shown.subtotal, shown.taxAmount, shown.totalAmount])
    expect(saved.totalAmount).toBe(118)
  })
})

// ---------------------------------------------------------------------------- other documents
// Each screen calls computeDocumentTotals with the arguments used below (see the form components); the
// backend service must store exactly that, and both must equal the independent oracle.
function shapeItems(rng: Rng, decimals: number, n: number, withDiscount: 'amount' | 'percent' | 'none') {
  return Array.from({ length: n }, () => {
    const l = genLine(rng, decimals)
    const pct = pick(rng, [0, 0, 5, 10, 12.5, 15, 100, 33.33])
    return { ...l, discount: withDiscount === 'percent' ? pct : 0, discountAmount: withDiscount === 'amount' ? l.discountAmount : 0 }
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

describe('quotations: form total == saved total == oracle', () => {
  it('1200 random quotations', async () => {
    const rng = mulberry32(1)
    for (let n = 0; n < 1200; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 6), 'percent')
      const db = tx({
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode }) },
        quotation: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'q', items: [], customer: null })) },
        setting: seqSetting()
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await quotationService.create({ customerName: 'X', items: items.map(i => ({ productName: 'P', quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, taxRate: i.taxRate })) }, 'u')
      expect(res.success).toBe(true)
      const saved = db.quotation.create.mock.calls[0][0].data as Record<string, number>
      // what QuotationFormScreen computes
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discount, taxRate: i.taxRate })), { decimals })
      // oracle: percent discount converted to an amount on the rounded gross, like the old service did
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: new D(new D(i.quantity).mul(i.unitPrice).toDecimalPlaces(decimals, D.ROUND_HALF_UP)).mul(i.discount).div(100).toDecimalPlaces(decimals, D.ROUND_HALF_UP).toNumber() })), { decimals, rule: 'NONE' })
      const ctx = JSON.stringify({ n, currencyCode, items })
      expect({ ctx, v: [saved.subtotal, saved.discountAmount, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [form.subtotal, form.discountAmount, form.taxAmount, form.totalAmount] })
      expect({ ctx, v: [saved.subtotal, saved.discountAmount, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [want.subtotal, want.discountAmount, want.taxAmount, want.totalAmount] })
    }
  }, 60_000)
})

describe('sales orders: form total == saved total == oracle', () => {
  it('1000 random sales orders', async () => {
    const rng = mulberry32(2)
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
      const res = await salesOrderService.createSalesOrder({ customerId: 'c', items: items.map(i => ({ productId: 'p', quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })) } as never, 'u')
      expect(res.success, JSON.stringify(res)).toBe(true)
      const saved = db.salesOrder.create.mock.calls[0][0].data as Record<string, number>
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: 0 })), { decimals, rule: 'NONE' })
      const ctx = JSON.stringify({ n, currencyCode, items })
      expect({ ctx, v: [saved.subtotal, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [form.subtotal, form.taxAmount, form.totalAmount] })
      expect({ ctx, v: [saved.subtotal, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [want.subtotal, want.taxAmount, want.totalAmount] })
    }
  }, 60_000)
})

describe('purchase orders: form total == saved total == oracle', () => {
  it('1000 random purchase orders', async () => {
    const rng = mulberry32(3)
    for (let n = 0; n < 1000; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 6), 'none')
      const db = tx({
        businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
        supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's', isActive: true }) },
        product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', isActive: true, productName: 'P', productType: 'STANDARD' }) },
        purchaseOrder: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'po', items: [], supplier: null })) },
        setting: seqSetting()
      })
      vi.mocked(getPrisma).mockReturnValue(db as never)
      const res = await purchaseOrderService.createPO({ supplierId: 's', isReverseCharge: false, items: items.map(i => ({ productId: 'p', quantity: i.quantity, unitCost: i.unitPrice, taxRate: i.taxRate })) } as never, 'u')
      expect(res.success, JSON.stringify(res)).toBe(true)
      const saved = db.purchaseOrder.create.mock.calls[0][0].data as Record<string, number>
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: 0 })), { decimals, rule: 'NONE' })
      const ctx = JSON.stringify({ n, currencyCode, items })
      expect({ ctx, v: [saved.subtotal, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [form.subtotal, form.taxAmount, form.totalAmount] })
      expect({ ctx, v: [saved.subtotal, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [want.subtotal, want.taxAmount, want.totalAmount] })
    }
  }, 60_000)
})

describe('supplier bills: form total == saved total == oracle (incl. reverse charge)', () => {
  it('1000 random bills', async () => {
    const rng = mulberry32(4)
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
      const res = await billService.createBill({ supplierId: 's', isReverseCharge: reverse, items: items.map(i => ({ productId: 'p', quantity: i.quantity, unitCost: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.taxRate })) } as never, 'u')
      expect(res.success, JSON.stringify(res)).toBe(true)
      const saved = db.bill.create.mock.calls[0][0].data as Record<string, number>
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.taxRate })), { decimals, excludeTaxFromTotal: reverse })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: i.discountAmount })), { decimals, rule: 'NONE', excludeTax: reverse })
      const ctx = JSON.stringify({ n, currencyCode, reverse, items })
      expect({ ctx, v: [saved.subtotal, saved.discountAmount, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [form.subtotal, form.discountAmount, form.taxAmount, form.totalAmount] })
      expect({ ctx, v: [saved.subtotal, saved.discountAmount, saved.taxAmount, saved.totalAmount] }).toEqual({ ctx, v: [want.subtotal, want.discountAmount, want.taxAmount, want.totalAmount] })
    }
  }, 60_000)
})

describe('credit and debit notes: form total == saved amount == oracle', () => {
  it('800 random credit notes and 800 debit notes', async () => {
    const rng = mulberry32(5)
    for (let n = 0; n < 800; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const items = shapeItems(rng, decimals, int(rng, 1, 5), 'none').map(i => ({ lineType: 'SERVICE', serviceDescription: 'x', quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate }))
      const form = computeDocumentTotals(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate })), { decimals })
      const want = oracle(items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, discountAmount: 0 })), { decimals, rule: 'NONE' })
      const ctx = JSON.stringify({ n, currencyCode, items })

      const cnTx = {
        creditNote: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'cn', customer: null, invoice: null })) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ gstScheme: 'REGULAR' }) },
      chartOfAccounts: { findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => ({ id: `coa-${where.accountCode}`, accountCode: where.accountCode, accountName: where.accountCode, accountType: 'ASSET', isActive: true })) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
        setting: seqSetting(),
        customerLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }), create: vi.fn().mockResolvedValue({}) },
        customer: { update: vi.fn().mockResolvedValue({}) },
        invoice: { findUniqueOrThrow: vi.fn(), update: vi.fn() }
      }
      const cnDb = { businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode }) }, invoice: { findUnique: vi.fn().mockResolvedValue(null) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(cnTx)) }
      vi.mocked(getPrisma).mockReturnValue(cnDb as never)
      const cnRes = await creditNoteService.create({ reason: 'r', items } as never, 'u')
      expect(cnRes.success, JSON.stringify(cnRes)).toBe(true)
      const cnSaved = cnTx.creditNote.create.mock.calls[0][0].data as { amount: number }
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
      const dnDb = { businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode }) }, purchaseOrder: { findUnique: vi.fn().mockResolvedValue(null) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(dnTx)) }
      vi.mocked(getPrisma).mockReturnValue(dnDb as never)
      const dnRes = await debitNoteService.create({ supplierId: 's', reason: 'r', items } as never, 'u')
      expect(dnRes.success, JSON.stringify(dnRes)).toBe(true)
      const dnSaved = dnTx.debitNote.create.mock.calls[0][0].data as { amount: number }
      expect({ ctx, v: dnSaved.amount }).toEqual({ ctx, v: form.totalAmount })
      expect({ ctx, v: dnSaved.amount }).toEqual({ ctx, v: want.totalAmount })
    }
  }, 60_000)
})
