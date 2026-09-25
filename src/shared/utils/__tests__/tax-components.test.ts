import { describe, it, expect } from 'vitest'
import { parseTaxComponents, validateTaxComponents, splitTaxByComponents } from '../tax-components'

const gstPst = [{ name: 'GST', rate: 5 }, { name: 'PST', rate: 7 }]

describe('tax components', () => {
  it('reads stored parts and ignores broken data', () => {
    expect(parseTaxComponents('[{"name":" GST ","rate":5},{"name":"PST","rate":7}]')).toEqual(gstPst)
    expect(parseTaxComponents('nope')).toEqual([])
    expect(parseTaxComponents('[{"name":"","rate":5},{"name":"X","rate":0}]')).toEqual([])
    expect(parseTaxComponents(null)).toEqual([])
  })

  it('checks the parts against the rate', () => {
    expect(validateTaxComponents(12, gstPst)).toBeNull()
    expect(validateTaxComponents(12, [])).toBeNull()
    expect(validateTaxComponents(13, gstPst)).toMatch(/add up to 12%/)
    expect(validateTaxComponents(12, [{ name: 'GST', rate: 12 }])).toMatch(/at least two/)
    expect(validateTaxComponents(12, [{ name: 'A', rate: 6 }, { name: 'a', rate: 6 }])).toMatch(/different name/)
  })

  it('splits an amount so the parts always add back exactly', () => {
    const parts = splitTaxByComponents(120, gstPst, 2)
    expect(parts.map((p) => p.amount)).toEqual([50, 70])
    for (const total of [0.01, 0.05, 1, 3.33, 99.99, 1234.57]) {
      const split = splitTaxByComponents(total, gstPst, 2)
      expect(Math.round(split.reduce((a, p) => a + p.amount, 0) * 100) / 100).toBe(total)
    }
  })

  it('works for zero-decimal and three-decimal currencies', () => {
    expect(splitTaxByComponents(101, gstPst, 0).reduce((a, p) => a + p.amount, 0)).toBe(101)
    const kwd = splitTaxByComponents(1.001, gstPst, 3)
    expect(Math.round(kwd.reduce((a, p) => a + p.amount, 0) * 1000) / 1000).toBe(1.001)
  })
})
