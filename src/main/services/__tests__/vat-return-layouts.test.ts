import { describe, it, expect } from 'vitest'
import { buildReturn, type VatBase } from '../vat-return-layouts'

const base: VatBase = {
  decimals: 2,
  sales: { taxed: 10000, zero: 2000, exempt: 500, outOfScope: 100, tax: 2000 },
  purchases: { taxed: 4000, zero: 300, exempt: 0, outOfScope: 0, tax: 800 }
}
const amountOf = (layout: ReturnType<typeof buildReturn>, code: string) => layout.boxes.find((b) => b.code === code)!.amount

describe('return layouts', () => {
  it('UK: box 3 is box 1, box 5 is the difference, and boxes 6 and 7 are whole pounds excluding VAT', () => {
    const l = buildReturn('GB', { ...base, sales: { ...base.sales, taxed: 10000.75 } })
    expect(amountOf(l, '1')).toBe(2000)
    expect(amountOf(l, '3')).toBe(2000)
    expect(amountOf(l, '4')).toBe(800)
    expect(amountOf(l, '5')).toBe(1200)
    expect(amountOf(l, '6')).toBe(12600)
    expect(amountOf(l, '7')).toBe(4300)
  })

  it('Singapore: total supplies is the three kinds added, net GST is output minus input', () => {
    const l = buildReturn('SG', base)
    expect(amountOf(l, '4')).toBe(12500)
    expect(amountOf(l, '8')).toBe(1200)
  })

  it('Australia: G1 includes GST, 1A minus 1B is the amount payable', () => {
    const l = buildReturn('AU', base)
    expect(amountOf(l, 'G1')).toBe(14600)
    expect(amountOf(l, '9')).toBe(1200)
  })

  it('New Zealand and Canada follow the same net rule; a refund shows as a negative', () => {
    const refund: VatBase = { ...base, purchases: { ...base.purchases, tax: 3000 } }
    for (const c of ['NZ', 'CA']) {
      const l = buildReturn(c, refund)
      expect(amountOf(l, l.netCode), c).toBe(-1000)
    }
  })

  it('every listed country ends with a net figure equal to sales tax minus purchase tax', () => {
    for (const c of ['GB', 'AU', 'NZ', 'CA', 'SG', 'AE', 'SA', 'ZA', null, 'FR']) {
      const l = buildReturn(c, base)
      expect(amountOf(l, l.netCode), String(c)).toBe(1200)
    }
  })

  it('an unlisted country gets the generic summary with every treatment separated', () => {
    const l = buildReturn('FR', base)
    expect(l.title).toContain('summary')
    expect(amountOf(l, 'S2')).toBe(2000)
    expect(amountOf(l, 'S4')).toBe(100)
    expect(amountOf(l, 'P2')).toBe(300)
  })
})
