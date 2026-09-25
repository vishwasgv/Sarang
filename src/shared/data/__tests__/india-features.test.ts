import { describe, it, expect } from 'vitest'
import { showIndiaFeatures, TAX_COUNTRY_NAMES, TAX_PRESETS, resolveCountryCode } from '../tax-presets'

describe('showIndiaFeatures', () => {
  it('shows India-only features for India, for an unset country and for an unrecognised one', () => {
    for (const c of ['India', 'IN', 'india', '', null, undefined, 'Narnia']) expect(showIndiaFeatures(c), String(c)).toBe(true)
  })
  it('hides them for every other recognised country', () => {
    for (const c of ['United Kingdom', 'GB', 'Germany', 'Australia', 'United Arab Emirates', 'Singapore']) expect(showIndiaFeatures(c), c).toBe(false)
  })
})

describe('country picker names', () => {
  it('lists every preset country once, sorted, and each name resolves back to its code', () => {
    const presets = Object.values(TAX_PRESETS)
    expect(TAX_COUNTRY_NAMES).toHaveLength(presets.length)
    expect([...TAX_COUNTRY_NAMES]).toEqual([...TAX_COUNTRY_NAMES].sort((a, b) => a.localeCompare(b)))
    for (const p of presets) expect(resolveCountryCode(p.name), p.name).toBe(p.code)
  })
})
