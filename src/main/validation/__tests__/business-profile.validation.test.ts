import { describe, it, expect } from 'vitest'
import { BusinessProfileUpdateSchema } from '../business-profile.validation'

describe('BusinessProfileUpdateSchema', () => {
  it('accepts a valid partial update payload', () => {
    const result = BusinessProfileUpdateSchema.safeParse({
      businessName: 'Test Traders',
      logoPath: 'C:\\Users\\test\\AppData\\Roaming\\sarang-business-os\\logos\\logo_123.png',
      showLogoOnDashboard: true,
      enableDocumentWatermark: false
    })
    expect(result.success).toBe(true)
  })

  it('accepts null for nullable fields (clearing a value)', () => {
    const result = BusinessProfileUpdateSchema.safeParse({ logoPath: null, taxNumber: null })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid taxModel value', () => {
    const result = BusinessProfileUpdateSchema.safeParse({ taxModel: 'NOT_A_REAL_MODEL' })
    expect(result.success).toBe(false)
  })

  it('accepts a non-RFC email value (format not enforced on the update path, only length) — an existing business with legacy free-text email data must still be able to save unrelated fields', () => {
    const result = BusinessProfileUpdateSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(true)
  })

  it('rejects an email over the length cap', () => {
    const result = BusinessProfileUpdateSchema.safeParse({ email: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects a non-3-character currency code', () => {
    const result = BusinessProfileUpdateSchema.safeParse({ currencyCode: 'US' })
    expect(result.success).toBe(false)
  })

  it('rejects non-boolean values for the two new toggle fields', () => {
    const result = BusinessProfileUpdateSchema.safeParse({ showLogoOnDashboard: 'yes' })
    expect(result.success).toBe(false)
  })

  it('accepts an empty object (no-op update)', () => {
    const result = BusinessProfileUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
