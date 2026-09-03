import { describe, it, expect } from 'vitest'
import { UpdateChallanSchema } from '../logistics-challan.validation'

// Real bug found live (2026-09-03 E2E audit): ChallanScreen.tsx's saveEdit()
// explicitly sends `expectedReturn: null` whenever the edited challan's type
// is anything but RETURNABLE — i.e. on every edit of a DELIVERY or
// BRANCH_TRANSFER challan, the vast majority — to clear a field that's
// meaningless for those types. Without .nullable() on this schema field,
// that legitimate null was rejected with "Expected string, received null",
// silently failing the ENTIRE edit (every other field included), every time.
describe('UpdateChallanSchema', () => {
  it('accepts expectedReturn: null (clearing the field on a non-RETURNABLE challan)', () => {
    const result = UpdateChallanSchema.safeParse({ id: 'ch-1', challanType: 'DELIVERY', expectedReturn: null })
    expect(result.success).toBe(true)
  })

  it('still accepts a real expectedReturn date string', () => {
    const result = UpdateChallanSchema.safeParse({ id: 'ch-1', challanType: 'RETURNABLE', expectedReturn: '2026-09-10' })
    expect(result.success).toBe(true)
  })

  it('still accepts expectedReturn being omitted entirely', () => {
    const result = UpdateChallanSchema.safeParse({ id: 'ch-1', driverName: 'Ramesh' })
    expect(result.success).toBe(true)
  })

  it('rejects a missing id', () => {
    const result = UpdateChallanSchema.safeParse({ driverName: 'Ramesh' })
    expect(result.success).toBe(false)
  })
})
