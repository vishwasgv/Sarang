// Tax-inclusive pricing ("prices include tax") in the shared money module. Every case is checked against
// hand-derived numbers or against an independent longhand Decimal oracle, never against the module itself.
import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  computeDocumentTotals, convertPriceMode, getCurrencyDecimals, prorateAmount, resolvePricesIncludeTax,
  roundMoney, storedLineTaxable, sumMoney, unitAmount, type RoundingRule
} from '../money'

const DD = Prisma.Decimal.clone({ precision: 60 })
const D = DD

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
  const quantity = pick(rng, [1, 1, 2, 3, 5, 10, 0.5, 0.25, 1.25, 1.234, 0.001, 2.5, int(rng, 1, 50), int(rng, 1, 100000)])
  const scale = pick(rng, [1, 10, 100, 1000])
  const unitPrice = decimals === 0
    ? pick(rng, [0, 1, 99, 100, 333.5, int(rng, 0, 50000)])
    : pick(rng, [0, 0.01, 0.005, 0.99, 12.34, 99.99, 118, int(rng, 0, 500000) / scale, int(rng, 1, 9999999) / 1000])
  const gross = roundMoney(quantity * unitPrice, decimals)
  const mode = rng()
  let discountAmount = 0
  if (mode < 0.25) discountAmount = roundMoney(gross * rng(), decimals)
  else if (mode < 0.32) discountAmount = gross
  return { quantity, unitPrice, discountAmount, taxRate: pick(rng, RATES) }
}

function genCart(rng: Rng, decimals: number) {
  const lines = Array.from({ length: int(rng, 1, 7) }, () => genLine(rng, decimals))
  const base = lines.reduce((s, l) => s + Math.max(0, roundMoney(l.quantity * l.unitPrice, decimals) - l.discountAmount), 0)
  const globalDiscount = rng() < 0.4 ? roundMoney(base * rng() * 0.9, decimals) : 0
  return { lines, globalDiscount }
}

// Longhand inclusive oracle (independent of the module: Decimal, no BigInt).
function oracleInclusive(lines: Line[], opts: { decimals: number; rule: RoundingRule; globalDiscount?: number; excludeTax?: boolean }) {
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
  const stepUsable = stepValue !== null && stepValue.mul(new D(10).pow(dp)).gte(1) && stepValue.mul(new D(10).pow(dp)).isInteger() && stepValue.mul(new D(10).pow(dp)).gt(1)
  const totalAmount = stepUsable ? raw.div(stepValue!).toDecimalPlaces(0, D.ROUND_HALF_UP).mul(stepValue!) : raw
  return {
    subtotal: subtotal.toNumber(), discountAmount: discount.toNumber(), taxAmount: tax.toNumber(),
    totalAmount: totalAmount.toDecimalPlaces(dp, D.ROUND_HALF_UP).toNumber(),
    roundingAmount: totalAmount.sub(raw).toDecimalPlaces(dp, D.ROUND_HALF_UP).toNumber() + 0,
    lineTotals: rows.map(x => x.taxable.add(x.tax).toNumber()),
    taxables: rows.map(x => x.taxable.toNumber())
  }
}

describe('inclusive arithmetic: hand-derived cases', () => {
  const cases: Array<{ name: string; line: Line; decimals?: number; taxable: number; tax: number; total: number }> = [
    { name: '118 at 18%', line: { quantity: 1, unitPrice: 118, discountAmount: 0, taxRate: 18 }, taxable: 100, tax: 18, total: 118 },
    { name: '99.99 at 18% (taxable rounds half up: 84.7373 -> 84.74)', line: { quantity: 1, unitPrice: 99.99, discountAmount: 0, taxRate: 18 }, taxable: 84.74, tax: 15.25, total: 99.99 },
    { name: '0.01 at 18% (taxable 0.01, tax 0)', line: { quantity: 1, unitPrice: 0.01, discountAmount: 0, taxRate: 18 }, taxable: 0.01, tax: 0, total: 0.01 },
    { name: '105 at 5%', line: { quantity: 1, unitPrice: 105, discountAmount: 0, taxRate: 5 }, taxable: 100, tax: 5, total: 105 },
    { name: '105 at 2.5% (102.439 -> 102.44)', line: { quantity: 1, unitPrice: 105, discountAmount: 0, taxRate: 2.5 }, taxable: 102.44, tax: 2.56, total: 105 },
    { name: '120 at 20%', line: { quantity: 1, unitPrice: 120, discountAmount: 0, taxRate: 20 }, taxable: 100, tax: 20, total: 120 },
    { name: '128 at 28%', line: { quantity: 1, unitPrice: 128, discountAmount: 0, taxRate: 28 }, taxable: 100, tax: 28, total: 128 },
    { name: '140 at 40%', line: { quantity: 1, unitPrice: 140, discountAmount: 0, taxRate: 40 }, taxable: 100, tax: 40, total: 140 },
    { name: '100.25 at 0.25%', line: { quantity: 1, unitPrice: 100.25, discountAmount: 0, taxRate: 0.25 }, taxable: 100, tax: 0.25, total: 100.25 },
    { name: '103 at 3%', line: { quantity: 1, unitPrice: 103, discountAmount: 0, taxRate: 3 }, taxable: 100, tax: 3, total: 103 },
    { name: 'zero tax: taxable equals the inclusive amount', line: { quantity: 3, unitPrice: 33.33, discountAmount: 0, taxRate: 0 }, taxable: 99.99, tax: 0, total: 99.99 },
    { name: 'quantity 3 x 99.99 at 18%', line: { quantity: 3, unitPrice: 99.99, discountAmount: 0, taxRate: 18 }, taxable: 254.21, tax: 45.76, total: 299.97 },
    { name: 'partial discount is on the inclusive amount (118 - 18 = 100 -> 84.75 + 15.25)', line: { quantity: 1, unitPrice: 118, discountAmount: 18, taxRate: 18 }, taxable: 84.75, tax: 15.25, total: 100 },
    { name: '100 percent discount leaves nothing', line: { quantity: 2, unitPrice: 59, discountAmount: 118, taxRate: 18 }, taxable: 0, tax: 0, total: 0 },
    { name: 'JPY, no decimals: 1100 at 10%', line: { quantity: 1, unitPrice: 1100, discountAmount: 0, taxRate: 10 }, decimals: 0, taxable: 1000, tax: 100, total: 1100 },
    { name: 'JPY: 999 at 10% (908.18 -> 908)', line: { quantity: 1, unitPrice: 999, discountAmount: 0, taxRate: 10 }, decimals: 0, taxable: 908, tax: 91, total: 999 },
    { name: 'KWD, 3 decimals: 1.234 at 5% (1.17523 -> 1.175)', line: { quantity: 1, unitPrice: 1.234, discountAmount: 0, taxRate: 5 }, decimals: 3, taxable: 1.175, tax: 0.059, total: 1.234 }
  ]
  for (const c of cases) {
    it(c.name, () => {
      const decimals = c.decimals ?? 2
      const t = computeDocumentTotals([c.line], { decimals, pricesIncludeTax: true })
      expect(t.lines[0].taxable).toBe(c.taxable)
      expect(t.lines[0].tax).toBe(c.tax)
      expect(t.lines[0].total).toBe(c.total)
      expect(t.totalAmount).toBe(c.total)
      expect(t.taxAmount).toBe(c.tax)
      expect(roundMoney(t.subtotal - t.discountAmount + t.taxAmount, decimals)).toBe(t.rawTotal)
    })
  }

  it('the header keeps its exclusive meaning: subtotal before discount, discount exclusive of tax', () => {
    // 118 at 18% with a 18 inclusive discount: exclusive subtotal 100, exclusive discount 15.25, tax 15.25 -> 100 payable
    const t = computeDocumentTotals([{ quantity: 1, unitPrice: 118, discountAmount: 18, taxRate: 18 }], { pricesIncludeTax: true })
    expect(t.subtotal).toBe(100)
    expect(t.discountAmount).toBe(15.25)
    expect(t.taxAmount).toBe(15.25)
    expect(t.totalAmount).toBe(100)
    expect(t.lines[0].gross).toBe(100)
    expect(t.lines[0].grossEntered).toBe(118)
    expect(t.lines[0].discountAmount).toBe(18)
  })

  it('an invoice-level discount comes off the inclusive value and tax is re-derived per line', () => {
    const t = computeDocumentTotals(
      [{ quantity: 1, unitPrice: 118, taxRate: 18 }, { quantity: 1, unitPrice: 105, taxRate: 5 }],
      { pricesIncludeTax: true, globalDiscount: 22.3 }
    )
    // shares: 22.3 * 118/223 = 11.80, remainder 10.50 -> lines 106.20 and 94.50
    expect(t.lines.map(l => l.total)).toEqual([106.2, 94.5])
    expect(t.lines[0].taxable).toBe(90) // 106.20 / 1.18
    expect(t.lines[0].tax).toBe(16.2)
    expect(t.lines[1].taxable).toBe(90) // 94.50 / 1.05
    expect(t.lines[1].tax).toBe(4.5)
    expect(t.totalAmount).toBe(200.7)
    expect(t.subtotal).toBe(200) // 100 + 100 exclusive
    expect(t.discountAmount).toBe(20) // 200 - 180 taxable
    expect(t.taxAmount).toBe(20.7)
  })

  it('reverse charge: tax is computed but not added to the payable amount', () => {
    const t = computeDocumentTotals([{ quantity: 1, unitPrice: 118, taxRate: 18 }], { pricesIncludeTax: true, excludeTaxFromTotal: true })
    expect(t.taxAmount).toBe(18)
    expect(t.totalAmount).toBe(100)
  })

  it('an over-discount that no line can absorb still drives the total negative so it can be rejected', () => {
    const t = computeDocumentTotals([{ quantity: 1, unitPrice: 118, taxRate: 18 }], { pricesIncludeTax: true, globalDiscount: 200 })
    expect(t.totalAmount).toBeLessThan(0)
  })

  it('every rounding rule applies to the final payable total (99.99 at 18%, INR)', () => {
    const expected: Record<RoundingRule, [number, number]> = { NONE: [99.99, 0], '0.05': [100, 0.01], '0.10': [100, 0.01], '0.50': [100, 0.01], '1': [100, 0.01] }
    for (const rule of Object.keys(expected) as RoundingRule[]) {
      const t = computeDocumentTotals([{ quantity: 1, unitPrice: 99.99, taxRate: 18 }], { pricesIncludeTax: true, roundingRule: rule })
      expect([t.totalAmount, t.roundingAmount]).toEqual(expected[rule])
      expect(t.taxAmount).toBe(15.25) // rounding never touches the tax
    }
    const t = computeDocumentTotals([{ quantity: 1, unitPrice: 1234.56, taxRate: 0 }], { pricesIncludeTax: true, roundingRule: '0.50' })
    expect([t.totalAmount, t.roundingAmount]).toEqual([1234.5, -0.06])
  })

  it('exclusive documents are untouched by the new option', () => {
    const a = computeDocumentTotals([{ quantity: 3, unitPrice: 33.335, discountPercent: 50, taxRate: 18 }])
    const b = computeDocumentTotals([{ quantity: 3, unitPrice: 33.335, discountPercent: 50, taxRate: 18 }], { pricesIncludeTax: false })
    expect(b).toEqual(a)
  })
})

describe('inclusive arithmetic: property tests against an independent oracle', () => {
  it('matches on 6000 random carts across currencies, discounts, global discounts and every rounding rule', () => {
    const rng = mulberry32(20260925)
    for (let n = 0; n < 6000; n++) {
      const decimals = getCurrencyDecimals(pick(rng, CURRENCIES))
      const rule = pick(rng, RULES)
      const excludeTax = rng() < 0.1
      const { lines, globalDiscount } = genCart(rng, decimals)
      const got = computeDocumentTotals(lines, { decimals, roundingRule: rule, globalDiscount, pricesIncludeTax: true, excludeTaxFromTotal: excludeTax })
      const want = oracleInclusive(lines, { decimals, rule, globalDiscount, excludeTax })
      const ctx = JSON.stringify({ n, decimals, rule, lines, globalDiscount, excludeTax })
      expect({ ctx, v: [got.subtotal, got.discountAmount, got.taxAmount, got.roundingAmount, got.totalAmount, ...got.lines.map(l => l.total), ...got.lines.map(l => l.taxable)] })
        .toEqual({ ctx, v: [want.subtotal, want.discountAmount, want.taxAmount, want.roundingAmount, want.totalAmount, ...want.lineTotals, ...want.taxables] })
    }
  })

  it('invariants on 6000 random carts: taxable + tax = line total, lines + rounding = total, subtotal - discount + tax = raw total', () => {
    const rng = mulberry32(99)
    for (let n = 0; n < 6000; n++) {
      const decimals = getCurrencyDecimals(pick(rng, CURRENCIES))
      const rule = pick(rng, RULES)
      const { lines, globalDiscount } = genCart(rng, decimals)
      const t = computeDocumentTotals(lines, { decimals, roundingRule: rule, globalDiscount, pricesIncludeTax: true })
      const ctx = JSON.stringify({ n, decimals, rule, lines, globalDiscount })
      for (const l of t.lines) {
        expect(roundMoney(l.taxable + l.tax, decimals), ctx).toBe(l.total)
        expect(l.taxable >= 0 && l.tax >= 0, ctx).toBe(true)
      }
      expect(roundMoney(sumMoney(t.lines.map(l => l.total), decimals) + t.roundingAmount, decimals), ctx).toBe(t.totalAmount)
      expect(roundMoney(t.subtotal - t.discountAmount + t.taxAmount, decimals), ctx).toBe(t.rawTotal)
      expect(roundMoney(sumMoney(t.lines.map(l => l.tax), decimals), decimals), ctx).toBe(t.taxAmount)
      expect(t.discountAmount >= 0, ctx).toBe(true)
    }
  })

  it('an exclusive document and the equivalent inclusive document agree (qty 1, price x (1+rate) rounded to the currency)', () => {
    const rng = mulberry32(31337)
    for (let n = 0; n < 4000; n++) {
      const decimals = getCurrencyDecimals(pick(rng, CURRENCIES))
      const rate = pick(rng, RATES)
      const unit = 10 ** -decimals
      const ex = roundMoney(rng() * pick(rng, [1, 10, 1000, 100000]), decimals)
      const incl = convertPriceMode(ex, rate, true, decimals)
      const a = computeDocumentTotals([{ quantity: 1, unitPrice: ex, taxRate: rate }], { decimals })
      const b = computeDocumentTotals([{ quantity: 1, unitPrice: incl, taxRate: rate }], { decimals, pricesIncludeTax: true })
      const ctx = JSON.stringify({ n, decimals, rate, ex, incl })
      // the inclusive price is ex + round(ex x rate), so the payable totals are identical for a single unit
      expect(roundMoney(Math.abs(a.totalAmount - b.totalAmount), decimals) <= unit + 1e-12, ctx).toBe(true)
      expect(roundMoney(Math.abs(a.taxAmount - b.taxAmount), decimals) <= unit + 1e-12, ctx).toBe(true)
    }
  })

  it('across several lines the exclusive and inclusive totals differ by at most one minor unit per line', () => {
    const rng = mulberry32(555)
    for (let n = 0; n < 3000; n++) {
      const decimals = getCurrencyDecimals(pick(rng, CURRENCIES))
      const unit = 10 ** -decimals
      const count = int(rng, 1, 6)
      const lines = Array.from({ length: count }, () => ({ quantity: 1, price: roundMoney(rng() * pick(rng, [10, 500, 50000]), decimals), rate: pick(rng, RATES) }))
      const a = computeDocumentTotals(lines.map(l => ({ quantity: 1, unitPrice: l.price, taxRate: l.rate })), { decimals })
      const b = computeDocumentTotals(lines.map(l => ({ quantity: 1, unitPrice: convertPriceMode(l.price, l.rate, true, decimals), taxRate: l.rate })), { decimals, pricesIncludeTax: true })
      expect(Math.abs(a.totalAmount - b.totalAmount) <= count * unit + 1e-9, JSON.stringify({ n, lines })).toBe(true)
    }
  })

  it('tax never depends on how it is later presented: header tax equals the sum of line tax for any split', () => {
    const rng = mulberry32(8)
    for (let n = 0; n < 1500; n++) {
      const decimals = getCurrencyDecimals(pick(rng, CURRENCIES))
      const { lines, globalDiscount } = genCart(rng, decimals)
      const t = computeDocumentTotals(lines, { decimals, globalDiscount, pricesIncludeTax: true })
      const again = computeDocumentTotals(lines, { decimals, globalDiscount, pricesIncludeTax: true })
      expect(again.taxAmount).toBe(t.taxAmount)
      expect(roundMoney(sumMoney(t.lines.map(l => l.tax), decimals), decimals)).toBe(t.taxAmount)
    }
  })
})

describe('helpers', () => {
  it('convertPriceMode round-trips a sensible price and matches the hand values', () => {
    expect(convertPriceMode(100, 18, true)).toBe(118)
    expect(convertPriceMode(118, 18, false)).toBe(100)
    expect(convertPriceMode(99.99, 18, false)).toBe(84.74)
    expect(convertPriceMode(84.74, 18, true)).toBe(99.99)
    expect(convertPriceMode(1000, 10, true, 0)).toBe(1100)
    expect(convertPriceMode(50, 0, true)).toBe(50)
    expect(convertPriceMode(1.175, 5, true, 3)).toBe(1.234)
  })

  it('prorateAmount is exact and half-up', () => {
    expect(prorateAmount(100, 1, 3)).toBe(33.33)
    expect(prorateAmount(100, 2, 3)).toBe(66.67)
    expect(prorateAmount(0.05, 1, 2)).toBe(0.03)
    expect(prorateAmount(354, 1, 3)).toBe(118)
    expect(prorateAmount(10, 1.5, 3, 3)).toBe(5)
    expect(prorateAmount(10, 0, 0)).toBe(0)
    // cumulative differencing: three third-chunks always add back to the whole
    const chunks = [1, 2, 3].map(i => prorateAmount(100, i, 3) - prorateAmount(100, i - 1, 3))
    expect(roundMoney(sumMoney(chunks, 2), 2)).toBe(100)
  })

  it('unitAmount divides exactly', () => {
    expect(unitAmount(254.19, 3)).toBe(84.73)
    expect(unitAmount(100, 3)).toBe(33.333333)
    expect(unitAmount(100, 3, 2)).toBe(33.33)
  })

  it('resolvePricesIncludeTax only accepts true', () => {
    expect(resolvePricesIncludeTax('true')).toBe(true)
    expect(resolvePricesIncludeTax(true)).toBe(true)
    for (const v of ['false', '', undefined, null, 'yes', '1', 1]) expect(resolvePricesIncludeTax(v)).toBe(false)
  })

  it('storedLineTaxable reads stored values for inclusive documents and never unitPrice x quantity', () => {
    const line = { quantity: 3, unitPrice: 99.99, discountAmount: 0, taxAmount: 45.76, lineTotal: 299.97 }
    expect(storedLineTaxable(line, { pricesIncludeTax: true })).toBe(254.21)
    // an exclusive line: 3 x 99.99 = 299.97 at 18% is 53.99 tax, total 353.96; the stored values give the taxable value
    const exclusive = { quantity: 3, unitPrice: 99.99, discountAmount: 0, taxAmount: 53.99, lineTotal: 353.96 }
    expect(storedLineTaxable(exclusive, { pricesIncludeTax: false })).toBe(299.97)
    // an invoice-level discount share is already inside the stored line total: 299.97 less 30.00 share = 269.97 taxable
    const shared = { quantity: 3, unitPrice: 99.99, discountAmount: 0, taxAmount: 48.59, lineTotal: 318.56 }
    expect(storedLineTaxable(shared, { pricesIncludeTax: false })).toBe(269.97)
    expect(storedLineTaxable(shared, { pricesIncludeTax: undefined })).toBe(269.97)
    // return lines store lineTotal as the negative tax-exclusive value already
    expect(storedLineTaxable({ ...line, lineTotal: -254.21, taxAmount: 45.76 }, { pricesIncludeTax: true, isReturn: true })).toBe(254.21)
  })
})
