import { describe, it, expect } from 'vitest'
import {
  applyRoundingRule,
  computeDocumentTotals,
  defaultRoundingRule,
  getCurrencyDecimals,
  resolveRoundingRule,
  roundMoney,
  splitTaxHalves,
  sumMoney,
  taxOnAmount,
  type RoundingRule
} from '../money'

describe('roundMoney (half away from zero, exact on decimal strings)', () => {
  const cases: Array<[number, number, number]> = [
    [0.005, 2, 0.01], [0.004, 2, 0], [0.0049999, 2, 0], [1.005, 2, 1.01], [2.675, 2, 2.68], [1.255, 2, 1.26],
    [-0.005, 2, -0.01], [-1.005, 2, -1.01], [0.5, 0, 1], [999.5, 0, 1000], [999.49, 0, 999],
    [1.2345, 3, 1.235], [1.2344, 3, 1.234], [0.0005, 3, 0.001], [1e-7, 2, 0], [12.34, 2, 12.34],
    [1e21, 2, 1e21], [0.1 + 0.2, 2, 0.3], [4999.999999999999, 2, 5000]
  ]
  it.each(cases)('roundMoney(%s, %i) = %s', (input, dp, expected) => {
    expect(roundMoney(input, dp)).toBe(expected)
  })
  it('never returns negative zero', () => {
    expect(Object.is(roundMoney(-0.001, 2), 0)).toBe(true)
  })
  it('treats NaN / Infinity / garbage as zero instead of poisoning a total', () => {
    expect(roundMoney(NaN)).toBe(0)
    expect(roundMoney(Infinity)).toBe(0)
    expect(roundMoney('abc')).toBe(0)
    expect(roundMoney(null)).toBe(0)
  })
})

describe('sumMoney / taxOnAmount', () => {
  it('sums without float drift', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney(Array(10).fill(0.1))).toBe(1)
    expect(sumMoney([0.005, 0.005], 2)).toBe(0.01)
  })
  const rates = [0, 2.5, 5, 18, 20, 28, 40, 0.25, 3]
  it.each(rates)('tax %s%% on 100.00 is exactly %s', (rate) => {
    expect(taxOnAmount(100, rate)).toBe(rate)
  })
  it('rounds tax half-up per call', () => {
    expect(taxOnAmount(0.5, 5)).toBe(0.03) // 0.025 -> 0.03
    expect(taxOnAmount(0.1, 5)).toBe(0.01) // 0.005 -> 0.01
    expect(taxOnAmount(33.33, 18)).toBe(6) // 5.9994
    expect(taxOnAmount(1, 0.25)).toBe(0) // 0.0025
  })
})

describe('applyRoundingRule', () => {
  const rawCases: Array<[number, RoundingRule, number, number]> = [
    [1234.56, 'NONE', 1234.56, 0],
    [1234.56, '0.05', 1234.55, -0.01],
    [1234.56, '0.10', 1234.6, 0.04],
    [1234.56, '0.50', 1234.5, -0.06],
    [1234.56, '1', 1235, 0.44],
    [100.05, '0.10', 100.1, 0.05], // exact tie rounds up
    [100.5, '1', 101, 0.5],
    [100.25, '0.50', 100.5, 0.25],
    [100.24, '0.50', 100, -0.24],
    [0.02, '0.05', 0, -0.02],
    [0.03, '0.05', 0.05, 0.02]
  ]
  it.each(rawCases)('%s under %s -> %s (rounding %s)', (raw, rule, total, rounding) => {
    expect(applyRoundingRule(raw, rule, 2)).toEqual({ total, rounding })
  })
  it('is a no-op when the step is finer than the currency minor unit (JPY)', () => {
    for (const r of ['0.05', '0.10', '0.50'] as RoundingRule[]) expect(applyRoundingRule(1234, r, 0)).toEqual({ total: 1234, rounding: 0 })
    expect(applyRoundingRule(1234, '1', 0)).toEqual({ total: 1234, rounding: 0 })
  })
  it('works on 3-decimal currencies (KWD/BHD)', () => {
    expect(applyRoundingRule(1.234, '0.05', 3)).toEqual({ total: 1.25, rounding: 0.016 })
    expect(applyRoundingRule(1.234, '1', 3)).toEqual({ total: 1, rounding: -0.234 })
  })
})

describe('defaults', () => {
  it('INR defaults to nearest 1, every other currency to NONE', () => {
    expect(defaultRoundingRule('INR')).toBe('1')
    expect(defaultRoundingRule(undefined)).toBe('1')
    for (const c of ['USD', 'EUR', 'JPY', 'KWD', 'AED']) expect(defaultRoundingRule(c)).toBe('NONE')
  })
  it('resolveRoundingRule keeps a valid stored value and ignores junk', () => {
    expect(resolveRoundingRule('0.05', 'INR')).toBe('0.05')
    expect(resolveRoundingRule('NONE', 'INR')).toBe('NONE')
    expect(resolveRoundingRule('garbage', 'USD')).toBe('NONE')
    expect(resolveRoundingRule(null, 'INR')).toBe('1')
  })
  it('currency decimals', () => {
    expect(getCurrencyDecimals('JPY')).toBe(0)
    expect(getCurrencyDecimals('USD')).toBe(2)
    expect(getCurrencyDecimals('KWD')).toBe(3)
    expect(getCurrencyDecimals('BHD')).toBe(3)
    expect(getCurrencyDecimals(null)).toBe(2)
  })
})

describe('splitTaxHalves (CGST + SGST always equals the tax)', () => {
  it.each([
    [0.03, 2, 0.01, 0.02], [0.05, 2, 0.02, 0.03], [0.01, 2, 0, 0.01], [18, 2, 9, 9], [5, 0, 2, 3], [0.001, 3, 0, 0.001], [1234.57, 2, 617.28, 617.29]
  ])('split %s at %i dp', (tax, dp, a, b) => {
    const r = splitTaxHalves(tax, dp)
    expect(r).toEqual({ first: a, second: b })
    expect(roundMoney(r.first + r.second, dp)).toBe(tax)
  })
})

describe('computeDocumentTotals - awkward single lines', () => {
  const one = (o: Parameters<typeof computeDocumentTotals>[0][number], opts = {}) => computeDocumentTotals([o], opts)

  it('USD 12.34 keeps its cents (the reported UI bug: screen used to show 12.00)', () => {
    const t = one({ quantity: 1, unitPrice: 12.34 }, { decimals: 2, roundingRule: 'NONE' })
    expect(t.totalAmount).toBe(12.34)
    expect(t.roundingAmount).toBe(0)
  })
  it('INR 12.34 rounds to 12 under the default rule', () => {
    const t = one({ quantity: 1, unitPrice: 12.34 }, { decimals: 2, roundingRule: '1' })
    expect(t.totalAmount).toBe(12)
    expect(t.roundingAmount).toBe(-0.34)
  })
  it('3-decimal quantity: 1.234 x 10.55 @ 18%', () => {
    const t = one({ quantity: 1.234, unitPrice: 10.55, taxRate: 18 })
    expect(t.lines[0].gross).toBe(13.02) // 13.0187
    expect(t.taxAmount).toBe(2.34) // 13.02 x 0.18 = 2.3436
    expect(t.totalAmount).toBe(15.36)
  })
  it('100 percent discount leaves a zero, tax-free line', () => {
    const t = one({ quantity: 3, unitPrice: 19.99, discountAmount: 59.97, taxRate: 18 })
    expect(t.lines[0].taxable).toBe(0)
    expect(t.taxAmount).toBe(0)
    expect(t.totalAmount).toBe(0)
  })
  it('a discount larger than the line is capped at the line value', () => {
    const t = one({ quantity: 1, unitPrice: 10, discountAmount: 50, taxRate: 18 })
    expect(t.lines[0].discountAmount).toBe(10)
    expect(t.totalAmount).toBe(0)
    expect(t.discountAmount).toBe(10)
  })
  it('percent discount rounds on the rounded gross (quotation style)', () => {
    const t = one({ quantity: 3, unitPrice: 3.33, discountPercent: 15, taxRate: 5 })
    // gross 9.99, discount 1.4985 -> 1.50, taxable 8.49, tax 0.4245 -> 0.42
    expect(t.lines[0].gross).toBe(9.99)
    expect(t.lines[0].discountAmount).toBe(1.5)
    expect(t.taxAmount).toBe(0.42)
    expect(t.totalAmount).toBe(8.91)
  })
  it('zero price and zero quantity are harmless', () => {
    expect(one({ quantity: 5, unitPrice: 0, taxRate: 18 }).totalAmount).toBe(0)
    expect(one({ quantity: 0, unitPrice: 5, taxRate: 18 }).totalAmount).toBe(0)
    expect(computeDocumentTotals([]).totalAmount).toBe(0)
  })
  it('huge quantities stay exact', () => {
    const t = one({ quantity: 1e9, unitPrice: 99999.99, taxRate: 18 })
    expect(t.subtotal).toBe(99999990000000)
    expect(t.taxAmount).toBe(17999998200000)
    expect(t.totalAmount).toBe(117999988200000)
  })
  it('JPY has no decimals', () => {
    const t = one({ quantity: 3, unitPrice: 333.5, taxRate: 10 }, { decimals: 0 })
    expect(t.subtotal).toBe(1001) // 1000.5 -> 1001
    expect(t.taxAmount).toBe(100) // 100.1
    expect(t.totalAmount).toBe(1101)
  })
  it('KWD keeps three decimals', () => {
    const t = one({ quantity: 1, unitPrice: 1.2345, taxRate: 5 }, { decimals: 3 })
    expect(t.subtotal).toBe(1.235)
    expect(t.taxAmount).toBe(0.062) // 0.06175
    expect(t.totalAmount).toBe(1.297)
  })
  it.each([0, 2.5, 5, 18, 20, 28, 40, 0.25, 3])('tax %s%% on 200.00 line', (rate) => {
    const t = one({ quantity: 2, unitPrice: 100, taxRate: rate })
    expect(t.taxAmount).toBe(roundMoney(2 * rate, 2))
    expect(t.totalAmount).toBe(roundMoney(200 + 2 * rate, 2))
  })
  it('reverse charge computes tax but leaves it out of the payable total', () => {
    const t = one({ quantity: 1, unitPrice: 1000, taxRate: 18 }, { excludeTaxFromTotal: true })
    expect(t.taxAmount).toBe(180)
    expect(t.totalAmount).toBe(1000)
  })
})

describe('computeDocumentTotals - global discount allocation', () => {
  it('splits proportionally across lines and re-taxes each line on its reduced base', () => {
    const t = computeDocumentTotals(
      [{ quantity: 1, unitPrice: 100, taxRate: 5 }, { quantity: 1, unitPrice: 200, taxRate: 18 }],
      { globalDiscount: 30 }
    )
    expect(t.lines.map(l => l.taxable)).toEqual([90, 180])
    expect(t.lines.map(l => l.tax)).toEqual([4.5, 32.4])
    expect(t.subtotal).toBe(300)
    expect(t.discountAmount).toBe(30)
    expect(t.taxAmount).toBe(36.9)
    expect(t.totalAmount).toBe(306.9)
  })
  it('the last line absorbs the rounding remainder so shares add up to the discount exactly', () => {
    const t = computeDocumentTotals(
      [{ quantity: 1, unitPrice: 10 }, { quantity: 1, unitPrice: 10 }, { quantity: 1, unitPrice: 10 }],
      { globalDiscount: 1 }
    )
    // 0.33 + 0.33 + 0.34
    expect(t.lines.map(l => l.taxable)).toEqual([9.67, 9.67, 9.66])
    expect(sumMoney(t.lines.map(l => l.taxable))).toBe(29)
  })
  it('a discount equal to the whole taxable value zeroes the document', () => {
    const t = computeDocumentTotals([{ quantity: 2, unitPrice: 50, taxRate: 18 }, { quantity: 1, unitPrice: 25, taxRate: 5 }], { globalDiscount: 125 })
    expect(t.totalAmount).toBe(0)
    expect(t.taxAmount).toBe(0)
  })
  it('ignores a non-positive global discount', () => {
    expect(computeDocumentTotals([{ quantity: 1, unitPrice: 10 }], { globalDiscount: -5 }).totalAmount).toBe(10)
  })
  it('applies the rounding rule after tax and discount', () => {
    const t = computeDocumentTotals([{ quantity: 1, unitPrice: 99.99, taxRate: 18 }], { roundingRule: '0.50' })
    // 99.99 + 18.00 (17.9982) = 117.99 -> 118.00
    expect(t.rawTotal).toBe(117.99)
    expect(t.totalAmount).toBe(118)
    expect(t.roundingAmount).toBe(0.01)
  })
})
