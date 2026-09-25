// India tax presentation: CGST + SGST, IGST or one GST line. The presentation only changes how the SAME
// tax amount is shown; the tax amount and the payable total never depend on it. Proven here with seeded
// random documents run through every mode, in exclusive and inclusive pricing, with every rounding rule:
//  1. the pure module (state matching, place of supply, tax head, exact halves, category rules),
//  2. the real billingService.createInvoice on a mocked database and the renderer cart util,
//  3. every other document service (quotation, sales order, purchase order, bill, credit and debit note),
//  4. the printed A4 invoice and the thermal receipt, and the renderer tax lines.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The property tests run thousands of documents; give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 120_000 })

vi.mock('../../utils/branding', () => ({
  aszurexFooterHtml: vi.fn().mockResolvedValue('footer'),
  aszurexBrandSuffixHtml: vi.fn().mockResolvedValue('suffix')
}))
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
import { printService } from '../print.service'
import { computeDocumentTotals, getCurrencyDecimals, roundMoney, sumMoney, splitTaxHalves, type RoundingRule } from '../../../shared/utils/money'
import {
  GST_TYPES, allocateGstHalves, classifyTaxHead, comparePlaceOfSupply, defaultGstTypeForPlaceOfSupply, gstPresentationLines,
  isNonTaxableCategory, normalizeGstType, normalizeState, normalizeTaxCategory, resolveLineTaxCategory, splitGstHalves, suggestTaxCategory,
  type GstType
} from '../../../shared/utils/gst-presentation'
import { computeCartTotals } from '../../../renderer/src/shared/utils/cart-totals.util'
import { splitTaxLines } from '../../../renderer/src/shared/utils/tax.util'
import { buildMoneyContext } from '../../../renderer/src/shared/utils/money-context.util'

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

// every India slab (current and withdrawn), the two special rates and a few odd ones
const RATES = [0, 0.25, 2.5, 3, 5, 12, 18, 20, 28, 40, 7.5] as const
const RULES: RoundingRule[] = ['NONE', '0.05', '0.10', '0.50', '1']
const CURRENCIES = ['INR', 'INR', 'USD', 'KWD', 'JPY'] as const

interface Line { quantity: number; unitPrice: number; discountAmount: number; taxRate: number }

function genLine(rng: Rng, decimals: number): Line {
  const quantity = pick(rng, [1, 1, 2, 3, 5, 10, 0.5, 1.25, 1.234, 2.5, int(rng, 1, 50), int(rng, 1, 9999)])
  const unitPrice = decimals === 0
    ? pick(rng, [0, 1, 99, 333.5, int(rng, 0, 50000)])
    : pick(rng, [0, 0.01, 0.99, 12.34, 99.99, int(rng, 0, 500000) / pick(rng, [1, 10, 100]), int(rng, 1, 9999999) / 1000])
  const gross = roundMoney(quantity * unitPrice, decimals)
  const mode = rng()
  let discountAmount = 0
  if (mode < 0.25) discountAmount = roundMoney(gross * rng(), decimals)
  else if (mode < 0.3) discountAmount = gross
  return { quantity, unitPrice, discountAmount, taxRate: pick(rng, RATES) }
}
function genCart(rng: Rng, decimals: number): { lines: Line[]; globalDiscount: number } {
  const lines = Array.from({ length: int(rng, 1, 6) }, () => genLine(rng, decimals))
  const taxable = lines.reduce((s, l) => s + Math.max(0, roundMoney(l.quantity * l.unitPrice, decimals) - l.discountAmount), 0)
  const globalDiscount = rng() < 0.35 ? roundMoney(taxable * rng() * 0.9, decimals) : 0
  return { lines, globalDiscount }
}

// Independent integer oracle for CGST and SGST: per rate, first = floor(tax / 2), second = the rest.
function oracleHalves(rows: Array<{ taxRate: number; taxAmount: number }>, decimals: number): { cgst: number; sgst: number } {
  const f = 10 ** decimals
  const byRate = new Map<number, number>()
  for (const r of rows) byRate.set(r.taxRate, (byRate.get(r.taxRate) ?? 0) + Math.round(r.taxAmount * f))
  let c = 0, s = 0
  for (const t of byRate.values()) { const first = Math.floor(t / 2); c += first; s += t - first }
  return { cgst: c / f, sgst: s / f }
}

// ------------------------------------------------------------------------------ 1. pure module
describe('state matching and place of supply', () => {
  it('matches a state written as a name, an abbreviation or a GST code', () => {
    const same = ['Maharashtra', 'maharashtra', ' MAHARASHTRA ', 'MH', 'mh', '27', '27-Maharashtra', '27 Maharashtra', 'Maharashtra (27)']
    const keys = new Set(same.map(normalizeState))
    expect(keys.size).toBe(1)
    expect(normalizeState('Tamil Nadu')).toBe(normalizeState('TN'))
    expect(normalizeState('Tamilnadu')).toBe(normalizeState('33'))
    expect(normalizeState('Jammu & Kashmir')).toBe(normalizeState('J&K'))
    expect(normalizeState('Orissa')).toBe(normalizeState('Odisha'))
    expect(normalizeState('Delhi')).not.toBe(normalizeState('Maharashtra'))
    expect(normalizeState('')).toBe('')
    expect(normalizeState(null)).toBe('')
    expect(normalizeState('   ')).toBe('')
  })

  it('same state CGST_SGST, other state IGST, unknown CGST_SGST', () => {
    const cases: Array<[string | null, string | null, GstType]> = [
      ['Maharashtra', 'Maharashtra', 'CGST_SGST'],
      ['Maharashtra', 'MH', 'CGST_SGST'],
      ['Maharashtra', 'Gujarat', 'IGST'],
      ['27', 'Delhi', 'IGST'],
      ['Maharashtra', null, 'CGST_SGST'],
      ['Maharashtra', '', 'CGST_SGST'],
      [null, 'Gujarat', 'CGST_SGST'],
      [undefined as never, undefined as never, 'CGST_SGST']
    ]
    for (const [biz, party, want] of cases) expect(defaultGstTypeForPlaceOfSupply(biz, party), `${biz} vs ${party}`).toBe(want)
    expect(comparePlaceOfSupply('Kerala', 'Kerala')).toEqual({ known: true, same: true })
    expect(comparePlaceOfSupply('Kerala', 'Goa')).toEqual({ known: true, same: false })
    expect(comparePlaceOfSupply('Kerala', null).known).toBe(false)
  })

  it('reports classify by tax head: stored heads win, a combined GST document goes by place of supply', () => {
    expect(classifyTaxHead('CGST_SGST', 'Kerala', 'Goa')).toEqual({ head: 'CGST_SGST', stateUnknown: false })
    expect(classifyTaxHead('IGST', 'Kerala', 'Kerala')).toEqual({ head: 'IGST', stateUnknown: false })
    expect(classifyTaxHead('GST', 'Kerala', 'Kerala')).toEqual({ head: 'CGST_SGST', stateUnknown: false })
    expect(classifyTaxHead('GST', 'Kerala', 'Goa')).toEqual({ head: 'IGST', stateUnknown: false })
    expect(classifyTaxHead('GST', 'Kerala', null)).toEqual({ head: 'CGST_SGST', stateUnknown: true })
    expect(classifyTaxHead('GST', null, 'Goa')).toEqual({ head: 'CGST_SGST', stateUnknown: true })
    // legacy or empty values behave as CGST_SGST
    expect(classifyTaxHead(undefined, 'Kerala', 'Goa')).toEqual({ head: 'CGST_SGST', stateUnknown: false })
    expect(normalizeGstType('nonsense')).toBe('CGST_SGST')
    expect(GST_TYPES).toEqual(['CGST_SGST', 'IGST', 'GST'])
  })
})

describe('tax categories', () => {
  it('a taxed line is never filed as exempt or nil-rated, an untaxed line is never standard', () => {
    expect(resolveLineTaxCategory('STANDARD', 18)).toBe('STANDARD')
    expect(resolveLineTaxCategory('REDUCED', 5)).toBe('REDUCED')
    expect(resolveLineTaxCategory('EXEMPT', 18)).toBe('STANDARD')
    expect(resolveLineTaxCategory('NIL_RATED', 5)).toBe('STANDARD')
    expect(resolveLineTaxCategory('ZERO_RATED', 5)).toBe('STANDARD')
    expect(resolveLineTaxCategory('STANDARD', 0)).toBe('NIL_RATED')
    expect(resolveLineTaxCategory('REDUCED', 0)).toBe('NIL_RATED')
    expect(resolveLineTaxCategory(undefined, 0)).toBe('NIL_RATED')
    expect(resolveLineTaxCategory('EXEMPT', 0)).toBe('EXEMPT')
    expect(resolveLineTaxCategory('ZERO_RATED', 0)).toBe('ZERO_RATED')
    expect(resolveLineTaxCategory('OUT_OF_SCOPE', 0)).toBe('OUT_OF_SCOPE')
    expect(resolveLineTaxCategory('bogus', 18)).toBe('STANDARD')
    expect(normalizeTaxCategory(null)).toBe('STANDARD')
  })
  it('suggests a category from a saved rate and knows which categories are not taxable supplies', () => {
    expect(suggestTaxCategory(0)).toBe('NIL_RATED')
    expect(suggestTaxCategory(0.25)).toBe('REDUCED')
    expect(suggestTaxCategory(3)).toBe('REDUCED')
    expect(suggestTaxCategory(5)).toBe('REDUCED')
    expect(suggestTaxCategory(18)).toBe('STANDARD')
    expect(suggestTaxCategory(40)).toBe('STANDARD')
    expect(isNonTaxableCategory('EXEMPT')).toBe(true)
    expect(isNonTaxableCategory('NIL_RATED')).toBe(true)
    expect(isNonTaxableCategory('OUT_OF_SCOPE')).toBe(true)
    expect(isNonTaxableCategory('ZERO_RATED')).toBe(false)
    expect(isNonTaxableCategory('STANDARD')).toBe(false)
  })
})

describe('presentation lines (table driven)', () => {
  const table: Array<{ tax: number; d: number; mode: GstType; want: Array<[string, number]> }> = [
    { tax: 180, d: 2, mode: 'CGST_SGST', want: [['CGST', 90], ['SGST', 90]] },
    { tax: 0.03, d: 2, mode: 'CGST_SGST', want: [['CGST', 0.01], ['SGST', 0.02]] },
    { tax: 0.01, d: 2, mode: 'CGST_SGST', want: [['CGST', 0], ['SGST', 0.01]] },
    { tax: 1.001, d: 3, mode: 'CGST_SGST', want: [['CGST', 0.5], ['SGST', 0.501]] },
    { tax: 7, d: 0, mode: 'CGST_SGST', want: [['CGST', 3], ['SGST', 4]] },
    { tax: 180, d: 2, mode: 'IGST', want: [['IGST', 180]] },
    { tax: 0.03, d: 2, mode: 'IGST', want: [['IGST', 0.03]] },
    { tax: 180, d: 2, mode: 'GST', want: [['GST', 180]] },
    { tax: 0.03, d: 2, mode: 'GST', want: [['GST', 0.03]] },
    { tax: 0, d: 2, mode: 'CGST_SGST', want: [] },
    { tax: 0, d: 2, mode: 'IGST', want: [] },
    { tax: 0, d: 2, mode: 'GST', want: [] }
  ]
  for (const c of table) {
    it(`${c.mode} on ${c.tax} (${c.d} decimals)`, () => {
      expect(gstPresentationLines(c.mode, c.tax, c.d).map(l => [l.label, l.amount])).toEqual(c.want)
      // the renderer util shows the same lines
      expect(splitTaxLines('GST', c.tax, c.mode, c.d).map(l => [l.label, l.amount])).toEqual(c.want)
    })
  }

  it('non-GST tax models show one line under their own name whatever the stored mode', () => {
    for (const mode of GST_TYPES) {
      expect(splitTaxLines('VAT', 20, mode)).toEqual([{ label: 'VAT', amount: 20 }])
      expect(splitTaxLines('SALES_TAX', 20, mode)).toEqual([{ label: 'Sales Tax', amount: 20 }])
    }
  })

  it('CGST and SGST are split per rate: 5% and 18% lines with odd paise', () => {
    // 5% tax 0.05, 18% tax 0.09: per rate 0.02+0.04 = 0.06 CGST and 0.03+0.05 = 0.08 SGST
    const split = splitGstHalves(0.14, 2, [{ taxRate: 5, taxAmount: 0.05 }, { taxRate: 18, taxAmount: 0.09 }])
    expect(split).toEqual({ cgst: 0.06, sgst: 0.08 })
    expect(roundMoney(split.cgst + split.sgst, 2)).toBe(0.14)
    // detail that does not add to the total is ignored, the total is split once
    expect(splitGstHalves(0.14, 2, [{ taxRate: 5, taxAmount: 0.05 }])).toEqual({ cgst: 0.07, sgst: 0.07 })
    // lines of one rate are added before the split
    expect(splitGstHalves(0.1, 2, [{ taxRate: 5, taxAmount: 0.05 }, { taxRate: 5, taxAmount: 0.05 }])).toEqual({ cgst: 0.05, sgst: 0.05 })
  })
})

describe('exact halves property tests', () => {
  it('CGST + SGST equals the tax to the last minor unit, and CGST is never more than SGST: 20000 random taxes', () => {
    const rng = mulberry32(31337)
    for (let n = 0; n < 20000; n++) {
      const decimals = pick(rng, [0, 2, 2, 2, 3])
      const minor = int(rng, 0, 99999999)
      const tax = minor / 10 ** decimals
      const h = splitTaxHalves(tax, decimals)
      expect(roundMoney(h.first + h.second, decimals)).toBe(tax)
      expect(h.first <= h.second).toBe(true)
      expect(h.second - h.first <= 1 / 10 ** decimals + 1e-9).toBe(true)
      const lines = gstPresentationLines('CGST_SGST', tax, decimals)
      if (tax > 0) expect(roundMoney(lines.reduce((s, l) => s + l.amount, 0), decimals)).toBe(tax)
    }
  })

  it('allocated per-line halves add to the per-rate halves of the document: 4000 random documents', () => {
    const rng = mulberry32(4242)
    for (let n = 0; n < 4000; n++) {
      const decimals = pick(rng, [2, 2, 3, 0])
      const rows = Array.from({ length: int(rng, 1, 8) }, () => ({ taxRate: pick(rng, RATES), taxAmount: int(rng, 0, 100000) / 10 ** decimals }))
      const alloc = allocateGstHalves(rows, decimals)
      const want = oracleHalves(rows, decimals)
      const ctx = JSON.stringify({ n, rows })
      expect(roundMoney(alloc.reduce((s, a) => s + a.cgst, 0), decimals), ctx).toBe(want.cgst)
      expect(roundMoney(alloc.reduce((s, a) => s + a.sgst, 0), decimals), ctx).toBe(want.sgst)
      alloc.forEach((a, i) => expect(roundMoney(a.cgst + a.sgst, decimals), ctx).toBe(rows[i].taxAmount))
      const doc = splitGstHalves(sumMoney(rows.map(r => r.taxAmount), decimals), decimals, rows)
      expect(doc, ctx).toEqual(want)
    }
  })
})

// ------------------------------------------------------------- 2. createInvoice, all three modes
function makeInvoiceDb(currencyCode: string, opts: { customerState?: string | null; businessState?: string | null } = {}) {
  const db: Record<string, any> = {
    setting: {
      findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Widget', sku: 'W', hsnCode: '1006', productType: 'SERVICE', taxRate: 0, taxCategory: 'STANDARD', isActive: true, inventory: null }), findMany: vi.fn().mockResolvedValue([]) },
    customer: { findUnique: vi.fn().mockResolvedValue(opts.customerState === undefined ? null : { taxExempt: false, taxExemptReason: null, state: opts.customerState }) },
    cropSeason: { findUnique: vi.fn().mockResolvedValue(null) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null, state: opts.businessState ?? null, taxModel: 'GST' }) },
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

interface Saved {
  invoice: Record<string, any>
  items: Array<Record<string, any>>
}

async function saveInvoice(currencyCode: string, lines: Line[], globalDiscount: number, inclusive: boolean, gstType: GstType | undefined, extra: { customerState?: string | null; businessState?: string | null; buyerState?: string } = {}): Promise<Saved | null> {
  const db = makeInvoiceDb(currencyCode, extra)
  vi.mocked(getPrisma).mockReturnValue(db as never)
  const res = await billingService.createInvoice({
    ...(extra.customerState !== undefined ? { customerId: 'c1' } : {}),
    items: lines.map(l => ({ productId: 'prod-1', quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: l.discountAmount, taxRate: l.taxRate })),
    paymentMethod: 'SPLIT' as const,
    globalDiscount,
    pricesIncludeTax: inclusive,
    gstType,
    buyerState: extra.buyerState
  } as never)
  if (!res.success) return null
  return { invoice: db.invoice.create.mock.calls[0][0].data, items: db.invoiceItem.create.mock.calls.map((c: any) => c[0].data) }
}

beforeEach(() => vi.clearAllMocks())

describe('billingService.createInvoice: the mode never changes an amount', () => {
  it('tax, subtotal, discount, rounding and total are identical in all three modes and equal the screen: 1500 documents x 3 modes, both pricing modes, every rounding rule', async () => {
    const rng = mulberry32(90210)
    let checked = 0
    for (let n = 0; n < 1500; n++) {
      const currencyCode = pick(rng, CURRENCIES)
      const decimals = getCurrencyDecimals(currencyCode)
      const inclusive = rng() < 0.5
      const rule = pick(rng, RULES)
      const { lines, globalDiscount } = genCart(rng, decimals)
      const ctx = JSON.stringify({ n, currencyCode, inclusive, rule, lines, globalDiscount })

      const saved: Record<string, Saved> = {}
      for (const mode of GST_TYPES) {
        const db = makeInvoiceDb(currencyCode)
        db.setting.findUnique = vi.fn(async ({ where }: { where: { settingKey: string } }) => where.settingKey === 'invoice_rounding_rule' ? { settingKey: where.settingKey, settingValue: rule } : null)
        vi.mocked(getPrisma).mockReturnValue(db as never)
        const res = await billingService.createInvoice({
          items: lines.map(l => ({ productId: 'prod-1', quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: l.discountAmount, taxRate: l.taxRate })),
          paymentMethod: 'SPLIT' as const, globalDiscount, pricesIncludeTax: inclusive, gstType: mode
        } as never)
        if (!res.success) break
        saved[mode] = { invoice: db.invoice.create.mock.calls[0][0].data, items: db.invoiceItem.create.mock.calls.map((c: any) => c[0].data) }
      }
      if (Object.keys(saved).length !== 3) continue // a business rule rejected the cart in every mode alike (e.g. negative total)

      const base = saved.CGST_SGST.invoice
      for (const mode of GST_TYPES) {
        const inv = saved[mode].invoice
        expect(inv.gstType, ctx).toBe(mode)
        expect([inv.subtotal, inv.discountAmount, inv.taxAmount, inv.roundingAmount, inv.totalAmount], ctx)
          .toEqual([base.subtotal, base.discountAmount, base.taxAmount, base.roundingAmount, base.totalAmount])
        // stored lines are the same in every mode
        expect(saved[mode].items.map(i => [i.taxRate, i.taxAmount, i.lineTotal]), ctx).toEqual(saved.CGST_SGST.items.map(i => [i.taxRate, i.taxAmount, i.lineTotal]))
      }

      // the screen shows the same amounts
      const moneyCtx = buildMoneyContext({ currencyCode, gstScheme: 'REGULAR' }, { invoice_rounding_rule: rule })
      const shown = computeCartTotals(lines.map(l => ({ ...l })), globalDiscount, moneyCtx, false, inclusive)
      expect([base.subtotal, base.discountAmount, base.taxAmount, base.roundingAmount, base.totalAmount], ctx)
        .toEqual([shown.subtotal, shown.discountAmount, shown.taxAmount, shown.roundingAmount, shown.totalAmount])

      // presented lines, from the stored lines and from the screen lines
      const rateTaxes = saved.CGST_SGST.items.map(i => ({ taxRate: i.taxRate as number, taxAmount: i.taxAmount as number }))
      const screenRates = shown.lines.map(l => ({ taxRate: l.taxRate, taxAmount: l.tax }))
      const tax = base.taxAmount as number
      const want = oracleHalves(rateTaxes, decimals)
      for (const rates of [rateTaxes, screenRates, undefined]) {
        const cg = splitTaxLines('GST', tax, 'CGST_SGST', decimals, rates)
        const ig = splitTaxLines('GST', tax, 'IGST', decimals, rates)
        const gs = splitTaxLines('GST', tax, 'GST', decimals, rates)
        if (tax > 0) {
          expect(cg.map(l => l.label), ctx).toEqual(['CGST', 'SGST'])
          expect(roundMoney(cg[0].amount + cg[1].amount, decimals), ctx).toBe(tax)
          expect(ig, ctx).toEqual([{ label: 'IGST', amount: tax }])
          expect(gs, ctx).toEqual([{ label: 'GST', amount: tax }])
          if (rates) { expect(cg[0].amount, ctx).toBe(want.cgst); expect(cg[1].amount, ctx).toBe(want.sgst) }
        } else {
          expect([cg, ig, gs], ctx).toEqual([[], [], []])
        }
      }
      checked++
    }
    expect(checked).toBeGreaterThan(1300)
  })

  it('the stored line categories agree with the tax charged', async () => {
    const saved = await saveInvoice('INR', [{ quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18 }, { quantity: 1, unitPrice: 50, discountAmount: 0, taxRate: 0 }], 0, false, 'GST')
    expect(saved!.items.map(i => i.taxCategory)).toEqual(['STANDARD', 'NIL_RATED'])
  })

  it('a product category and an explicit line category are kept when they agree with the rate', async () => {
    const db = makeInvoiceDb('INR')
    db.product.findUnique = vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Milk', sku: 'M', hsnCode: '0401', productType: 'SERVICE', taxRate: 0, taxCategory: 'EXEMPT', isActive: true, inventory: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await billingService.createInvoice({ items: [{ productId: 'prod-1', quantity: 1, unitPrice: 30, discountAmount: 0, taxRate: 0 }], paymentMethod: 'CASH', globalDiscount: 0 } as never)
    expect(db.invoiceItem.create.mock.calls[0][0].data.taxCategory).toBe('EXEMPT')
    const db2 = makeInvoiceDb('INR')
    vi.mocked(getPrisma).mockReturnValue(db2 as never)
    await billingService.createInvoice({ items: [{ productId: 'prod-1', quantity: 1, unitPrice: 30, discountAmount: 0, taxRate: 0, taxCategory: 'ZERO_RATED' }], paymentMethod: 'CASH', globalDiscount: 0 } as never)
    expect(db2.invoiceItem.create.mock.calls[0][0].data.taxCategory).toBe('ZERO_RATED')
  })
})

describe('the mode is chosen automatically from the place of supply and can be overridden', () => {
  const cart: Line[] = [{ quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18 }]
  const cases: Array<{ name: string; biz: string | null; customer: string | null | undefined; buyer?: string; explicit?: GstType; want: GstType }> = [
    { name: 'same state', biz: 'Maharashtra', customer: 'Maharashtra', want: 'CGST_SGST' },
    { name: 'same state, abbreviation', biz: 'Maharashtra', customer: 'MH', want: 'CGST_SGST' },
    { name: 'other state', biz: 'Maharashtra', customer: 'Gujarat', want: 'IGST' },
    { name: 'unknown customer state', biz: 'Maharashtra', customer: null, want: 'CGST_SGST' },
    { name: 'unknown business state', biz: null, customer: 'Gujarat', want: 'CGST_SGST' },
    { name: 'walk-in with a typed buyer state', biz: 'Maharashtra', customer: undefined, buyer: 'Kerala', want: 'IGST' },
    { name: 'typed buyer state beats the saved customer state', biz: 'Maharashtra', customer: 'Gujarat', buyer: 'Maharashtra', want: 'CGST_SGST' },
    { name: 'walk-in with nothing', biz: 'Maharashtra', customer: undefined, want: 'CGST_SGST' },
    { name: 'owner override to GST in the same state', biz: 'Maharashtra', customer: 'Maharashtra', explicit: 'GST', want: 'GST' },
    { name: 'owner override to CGST_SGST for another state', biz: 'Maharashtra', customer: 'Gujarat', explicit: 'CGST_SGST', want: 'CGST_SGST' },
    { name: 'owner override to IGST in the same state', biz: 'Maharashtra', customer: 'Maharashtra', explicit: 'IGST', want: 'IGST' }
  ]
  for (const c of cases) {
    it(c.name, async () => {
      const saved = await saveInvoice('INR', cart, 0, false, c.explicit, { customerState: c.customer, businessState: c.biz, buyerState: c.buyer })
      expect(saved!.invoice.gstType).toBe(c.want)
      expect(saved!.invoice.taxAmount).toBe(18)
    })
  }
})

// ------------------------------------------------------------------- 3. the other six documents
function tx(db: Record<string, any>) {
  db.$transaction = vi.fn(async (arg: unknown) => Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(db))
  return db
}
const seqSetting = () => ({
  findUnique: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 })
})

async function runDocument(kind: 'quotation' | 'salesOrder' | 'purchaseOrder' | 'bill' | 'creditNote' | 'debitNote', currencyCode: string, lines: Line[], inclusive: boolean, gstType: GstType | undefined, party: { biz?: string; party?: string } = {}) {
  const businessProfile = { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null, state: party.biz ?? null }) }
  if (kind === 'quotation') {
    const db = tx({
      businessProfile, customer: { findUnique: vi.fn().mockResolvedValue({ state: party.party ?? null }) },
      quotation: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'q', items: [], customer: null })) },
      setting: seqSetting()
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await quotationService.create({ customerId: party.party !== undefined ? 'c' : undefined, customerName: 'X', pricesIncludeTax: inclusive, gstType, items: lines.map(l => ({ productName: 'P', quantity: l.quantity, unitPrice: l.unitPrice, discount: 0, taxRate: l.taxRate })) }, 'u')
    expect(r.success).toBe(true)
    return db.quotation.create.mock.calls[0][0].data as Record<string, any>
  }
  if (kind === 'salesOrder') {
    const db = tx({
      businessProfile, customer: { findUnique: vi.fn().mockResolvedValue({ id: 'c', isActive: true, state: party.party ?? null }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', isActive: true, productName: 'P' }) },
      salesOrder: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'so', items: [], customer: null })) },
      setting: seqSetting()
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await salesOrderService.createSalesOrder({ customerId: 'c', pricesIncludeTax: inclusive, gstType, items: lines.map(l => ({ productId: 'p', quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate })) } as never, 'u')
    expect(r.success, JSON.stringify(r)).toBe(true)
    return db.salesOrder.create.mock.calls[0][0].data as Record<string, any>
  }
  if (kind === 'purchaseOrder') {
    const db = tx({
      businessProfile, supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's', isActive: true, state: party.party ?? null }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', isActive: true, productName: 'P', productType: 'STANDARD' }) },
      purchaseOrder: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'po', items: [], supplier: null })) },
      setting: seqSetting()
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await purchaseOrderService.createPO({ supplierId: 's', isReverseCharge: false, pricesIncludeTax: inclusive, gstType, items: lines.map(l => ({ productId: 'p', quantity: l.quantity, unitCost: l.unitPrice, taxRate: l.taxRate })) } as never, 'u')
    expect(r.success, JSON.stringify(r)).toBe(true)
    return db.purchaseOrder.create.mock.calls[0][0].data as Record<string, any>
  }
  if (kind === 'bill') {
    const db = tx({
      businessProfile,
      chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa', accountCode: '6000', accountName: 'Opex', accountType: 'EXPENSE', isActive: true }) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je', entryNumber: 'JE-1' }), findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      supplier: { findUnique: vi.fn().mockResolvedValue({ id: 's', isActive: true, supplierName: 'S', state: party.party ?? null }) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: 'p', productName: 'P', isActive: true }) },
      purchaseOrder: { findUnique: vi.fn().mockResolvedValue(null) },
      bill: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'b', items: [], supplier: { supplierName: 'S' } })) },
      supplierLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      productCostHistory: { create: vi.fn().mockResolvedValue({}) },
      setting: seqSetting()
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await billService.createBill({ supplierId: 's', isReverseCharge: false, pricesIncludeTax: inclusive, gstType, items: lines.map(l => ({ productId: 'p', quantity: l.quantity, unitCost: l.unitPrice, discountAmount: l.discountAmount, taxRate: l.taxRate })) } as never, 'u')
    expect(r.success, JSON.stringify(r)).toBe(true)
    const data = db.bill.create.mock.calls[0][0].data as Record<string, any>
    return data
  }
  const items = lines.map(l => ({ lineType: 'SERVICE', serviceDescription: 'x', quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate }))
  if (kind === 'creditNote') {
    const cnTx = {
      creditNote: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'cn', customer: null, invoice: null })) },
      chartOfAccounts: { findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => ({ id: `coa-${where.accountCode}`, accountCode: where.accountCode, accountName: where.accountCode, accountType: 'ASSET', isActive: true })) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
      setting: seqSetting(),
      customerLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }), create: vi.fn().mockResolvedValue({}) },
      customer: { update: vi.fn().mockResolvedValue({}) }, invoice: { findUniqueOrThrow: vi.fn(), update: vi.fn() }
    }
    const db = { businessProfile, customer: { findUnique: vi.fn().mockResolvedValue({ state: party.party ?? null }) }, invoice: { findUnique: vi.fn().mockResolvedValue(null) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(cnTx)) }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await creditNoteService.create({ reason: 'r', pricesIncludeTax: inclusive, gstType, customerId: party.party !== undefined ? 'c' : undefined, items } as never, 'u')
    expect(r.success, JSON.stringify(r)).toBe(true)
    return cnTx.creditNote.create.mock.calls[0][0].data as Record<string, any>
  }
  const dnTx = {
    debitNote: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'dn', supplier: null, purchaseOrder: null })) },
      chartOfAccounts: { findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => ({ id: `coa-${where.accountCode}`, accountCode: where.accountCode, accountName: where.accountCode, accountType: 'ASSET', isActive: true })) },
      journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-1' }), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
    setting: seqSetting(),
    supplierLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }), create: vi.fn().mockResolvedValue({}) },
    supplier: { update: vi.fn().mockResolvedValue({}) }
  }
  const db = { businessProfile, supplier: { findUnique: vi.fn().mockResolvedValue({ state: party.party ?? null }) }, purchaseOrder: { findUnique: vi.fn().mockResolvedValue(null) }, $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(dnTx)) }
  vi.mocked(getPrisma).mockReturnValue(db as never)
  const r = await debitNoteService.create({ supplierId: 's', reason: 'r', pricesIncludeTax: inclusive, gstType, items } as never, 'u')
  expect(r.success, JSON.stringify(r)).toBe(true)
  return dnTx.debitNote.create.mock.calls[0][0].data as Record<string, any>
}

describe('every document type stores the mode and never changes an amount because of it', () => {
  const kinds = ['quotation', 'salesOrder', 'purchaseOrder', 'bill', 'creditNote', 'debitNote'] as const
  for (const kind of kinds) {
    it(`${kind}: 250 documents x 3 modes, exclusive and inclusive`, async () => {
      const rng = mulberry32(kinds.indexOf(kind) + 500)
      for (let n = 0; n < 250; n++) {
        const currencyCode = pick(rng, CURRENCIES)
        const decimals = getCurrencyDecimals(currencyCode)
        const inclusive = rng() < 0.5
        const lines = Array.from({ length: int(rng, 1, 5) }, () => ({ ...genLine(rng, decimals), discountAmount: 0 }))
        const ctx = JSON.stringify({ kind, n, currencyCode, inclusive, lines })
        const saved: Record<string, Record<string, any>> = {}
        for (const mode of GST_TYPES) saved[mode] = await runDocument(kind, currencyCode, lines, inclusive, mode)
        const amountKey = kind === 'creditNote' || kind === 'debitNote' ? ['amount'] : ['subtotal', 'taxAmount', 'totalAmount']
        for (const mode of GST_TYPES) {
          expect(saved[mode].gstType, ctx).toBe(mode)
          expect(amountKey.map(k => saved[mode][k]), ctx).toEqual(amountKey.map(k => saved.CGST_SGST[k]))
        }
        // and against the shared module the screens run
        const form = computeDocumentTotals(lines.map(l => ({ quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: kind === 'bill' ? l.discountAmount : 0, taxRate: l.taxRate })), { decimals, pricesIncludeTax: inclusive })
        if (kind === 'creditNote' || kind === 'debitNote') expect(saved.GST.amount, ctx).toBe(form.totalAmount)
        else expect([saved.GST.subtotal, saved.GST.taxAmount, saved.GST.totalAmount], ctx).toEqual([form.subtotal, form.taxAmount, form.totalAmount])
      }
    })
  }

  it('the mode defaults from the party state on every document, and a note follows the document it corrects', async () => {
    const lines: Line[] = [{ quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18 }]
    for (const kind of kinds) {
      const same = await runDocument(kind, 'INR', lines, false, undefined, { biz: 'Kerala', party: 'Kerala' })
      const other = await runDocument(kind, 'INR', lines, false, undefined, { biz: 'Kerala', party: 'Goa' })
      const unknown = await runDocument(kind, 'INR', lines, false, undefined, { biz: 'Kerala' })
      expect([kind, same.gstType]).toEqual([kind, 'CGST_SGST'])
      expect([kind, other.gstType]).toEqual([kind, 'IGST'])
      expect([kind, unknown.gstType]).toEqual([kind, 'CGST_SGST'])
    }
  })
})

// ------------------------------------------------------------- 4. printed invoice and receipt
function parseAmount(s: string): number {
  return Number(s.replace(/[^0-9.]/g, ''))
}
function taxRowsFromInvoiceHtml(html: string): Array<[string, number]> {
  const out: Array<[string, number]> = []
  const re = /<div class="totals-row"><span>(CGST|SGST|IGST|GST|VAT|Tax)<\/span><span>([^<]*)<\/span><\/div>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push([m[1], parseAmount(m[2])])
  return out
}
function taxRowsFromReceiptHtml(html: string): Array<[string, number]> {
  const out: Array<[string, number]> = []
  const re = /<tr><td colspan="2">(CGST|SGST|IGST|GST|VAT|Tax)<\/td><td style="text-align:right">([^<]*)<\/td><\/tr>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push([m[1], parseAmount(m[2])])
  return out
}
function totalFromInvoiceHtml(html: string): number {
  const m = /<div class="totals-total"><span>Total<\/span><span>([^<]*)<\/span><\/div>/.exec(html)
  return parseAmount(m![1])
}

describe('printed A4 invoice and thermal receipt show the lines of the chosen mode', () => {
  it('600 documents x 3 modes: tax lines add to the tax, the total is identical, labels follow the mode', async () => {
    const rng = mulberry32(555)
    const settingsDb = { setting: { findMany: vi.fn().mockResolvedValue([]) } }
    let checked = 0
    for (let n = 0; n < 600; n++) {
      const currencyCode = pick(rng, ['INR', 'USD'] as const)
      const decimals = getCurrencyDecimals(currencyCode)
      const inclusive = rng() < 0.5
      const { lines, globalDiscount } = genCart(rng, decimals)
      const totals: number[] = []
      const ctx = JSON.stringify({ n, currencyCode, inclusive, lines, globalDiscount })
      for (const mode of GST_TYPES) {
        const saved = await saveInvoice(currencyCode, lines, globalDiscount, inclusive, mode)
        if (!saved) break
        vi.mocked(getPrisma).mockReturnValue(settingsDb as never)
        const inv = {
          invoiceNumber: 'INV-1', invoiceDate: '2026-09-25T00:00:00.000Z', status: 'ACTIVE', customer: null,
          items: saved.items.map(i => ({ ...i, productName: 'Widget', product: { unit: 'PCS' }, variantInfo: null })),
          subtotal: saved.invoice.subtotal, discountAmount: saved.invoice.discountAmount, taxAmount: saved.invoice.taxAmount,
          roundingAmount: saved.invoice.roundingAmount, totalAmount: saved.invoice.totalAmount, paidAmount: 0, balanceAmount: 0,
          paymentStatus: 'PAID', notes: null, gstType: saved.invoice.gstType, pricesIncludeTax: inclusive
        }
        const profile = { businessName: 'B', currencySymbol: currencyCode === 'INR' ? '₹' : '$', currencyCode, taxModel: 'GST' }
        const html = await printService.generateInvoiceHtml(inv as never, profile as never)
        const receipt = await printService.generateReceiptHtml(inv as never, profile as never)
        const tax = saved.invoice.taxAmount as number
        for (const rows of [taxRowsFromInvoiceHtml(html), taxRowsFromReceiptHtml(receipt)]) {
          if (tax > 0) {
            const labels = rows.map(r => r[0])
            expect(labels, ctx).toEqual(mode === 'CGST_SGST' ? ['CGST', 'SGST'] : mode === 'IGST' ? ['IGST'] : ['GST'])
            expect(roundMoney(rows.reduce((s, r) => s + r[1], 0), decimals), ctx).toBe(tax)
            if (mode === 'CGST_SGST') {
              const want = oracleHalves(saved.items.map(i => ({ taxRate: i.taxRate, taxAmount: i.taxAmount })), decimals)
              expect([rows[0][1], rows[1][1]], ctx).toEqual([want.cgst, want.sgst])
            }
          } else {
            expect(rows, ctx).toEqual([])
          }
        }
        totals.push(totalFromInvoiceHtml(html))
        expect(totals[totals.length - 1], ctx).toBe(Math.abs(saved.invoice.totalAmount))
      }
      if (totals.length === 3) {
        expect(new Set(totals).size, ctx).toBe(1)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(500)
  })

  it('other tax models keep one line under their own name', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findMany: vi.fn().mockResolvedValue([]) } } as never)
    const inv = {
      invoiceNumber: 'INV-1', invoiceDate: '2026-09-25', status: 'ACTIVE', customer: null,
      items: [{ productName: 'W', product: { unit: 'PCS' }, quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 20, taxAmount: 20, lineTotal: 120 }],
      subtotal: 100, discountAmount: 0, taxAmount: 20, roundingAmount: 0, totalAmount: 120, paidAmount: 120, balanceAmount: 0, paymentStatus: 'PAID', notes: null, gstType: 'IGST'
    }
    const html = await printService.generateInvoiceHtml(inv as never, { businessName: 'B', currencySymbol: '£', taxModel: 'VAT' } as never)
    expect(taxRowsFromInvoiceHtml(html)).toEqual([['VAT', 20]])
  })

  it('a quotation, purchase order and bill print the lines of their own mode and never change the total', async () => {
    const settingsDb = { setting: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(settingsDb as never)
    const profile = { businessName: 'B', currencySymbol: '₹', currencyCode: 'INR', taxModel: 'GST' }
    const po = { poNumber: 'PO-1', orderDate: '2026-09-25', status: 'DRAFT', supplier: { supplierName: 'S' }, items: [{ quantity: 1, unitCost: 100, taxRate: 5, taxAmount: 5, total: 105, product: { productName: 'A', unit: 'PCS' } }, { quantity: 1, unitCost: 50, taxRate: 18, taxAmount: 9, total: 59, product: { productName: 'B', unit: 'PCS' } }], subtotal: 150, taxAmount: 14, totalAmount: 164 }
    const seen: Record<string, Array<[string, number]>> = {}
    for (const mode of GST_TYPES) {
      const html = await printService.generatePurchaseOrderHtml({ ...po, gstType: mode } as never, profile as never)
      seen[mode] = taxRowsFromInvoiceHtml(html)
      expect(html).toContain('164.00')
    }
    // 5% tax 0.05 * 100 = 5.00 -> 2.50 / 2.50 ; 18% tax 9.00 -> 4.50 / 4.50
    expect(seen.CGST_SGST).toEqual([['CGST', 7], ['SGST', 7]])
    expect(seen.IGST).toEqual([['IGST', 14]])
    expect(seen.GST).toEqual([['GST', 14]])
    const q = { quotationNumber: 'QT-1', customer: null, items: [{ productName: 'A', quantity: 1, unitPrice: 100, discount: 0, taxRate: 5, lineTotal: 105 }, { productName: 'B', quantity: 1, unitPrice: 50, discount: 0, taxRate: 18, lineTotal: 59 }], subtotal: 150, discountAmount: 0, taxAmount: 14, totalAmount: 164 }
    for (const mode of GST_TYPES) {
      const html = await printService.generateQuotationHtml({ ...q, gstType: mode } as never, profile as never)
      expect(taxRowsFromInvoiceHtml(html).map(r => r[0])).toEqual(mode === 'CGST_SGST' ? ['CGST', 'SGST'] : [mode === 'IGST' ? 'IGST' : 'GST'])
      expect(roundMoney(taxRowsFromInvoiceHtml(html).reduce((s, r) => s + r[1], 0), 2)).toBe(14)
    }
    const bill = { billNumber: 'B-1', billDate: '2026-09-25', status: 'OPEN', supplier: { supplierName: 'S' }, items: po.items.map(i => ({ ...i })), subtotal: 150, taxAmount: 14, totalAmount: 164, balanceAmount: 164 }
    for (const mode of GST_TYPES) {
      const html = await printService.generateBillHtml({ ...bill, gstType: mode } as never, profile as never)
      expect(roundMoney(taxRowsFromInvoiceHtml(html).reduce((s, r) => s + r[1], 0), 2)).toBe(14)
      expect(taxRowsFromInvoiceHtml(html).map(r => r[0])).toEqual(mode === 'CGST_SGST' ? ['CGST', 'SGST'] : [mode === 'IGST' ? 'IGST' : 'GST'])
    }
  })
})
