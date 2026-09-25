import { describe, it, expect } from 'vitest'
import { taxExemptionActive } from '../tax-exemption.util'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('tax exemption certificate', () => {
  it('is off when the customer is not marked exempt', () => {
    expect(taxExemptionActive({ taxExempt: false, taxExemptExpiry: null })).toBe(false)
    expect(taxExemptionActive({ taxExempt: null })).toBe(false)
  })

  it('has no end date means it never runs out', () => {
    expect(taxExemptionActive({ taxExempt: true, taxExemptExpiry: null }, at(2030, 1, 1))).toBe(true)
  })

  it('counts through the whole expiry day and stops the next morning', () => {
    const expiry = at(2026, 9, 30, 0)
    expect(taxExemptionActive({ taxExempt: true, taxExemptExpiry: expiry }, at(2026, 9, 30, 23))).toBe(true)
    expect(taxExemptionActive({ taxExempt: true, taxExemptExpiry: expiry }, at(2026, 10, 1, 0))).toBe(false)
  })

  it('accepts the expiry as text too', () => {
    expect(taxExemptionActive({ taxExempt: true, taxExemptExpiry: '2020-01-01T00:00:00' }, at(2026, 9, 26))).toBe(false)
  })
})
