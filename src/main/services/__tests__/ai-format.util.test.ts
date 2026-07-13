import { describe, it, expect } from 'vitest'
import { formatAmountForSpeech } from '../ai-format.util'

describe('formatAmountForSpeech', () => {
  it('formats a positive amount with thousands separators, no sign', () => {
    expect(formatAmountForSpeech(18450, '₹')).toBe('₹18,450.00')
  })

  it('formats zero without a sign', () => {
    expect(formatAmountForSpeech(0, '₹')).toBe('₹0.00')
  })

  // Real bug (2026-07-13, found via a full live question battery): this
  // function used to Math.abs() every amount unconditionally, which is only
  // safe for values that are always non-negative (sales totals, outstanding
  // balances). finance.profitAndLoss's netProfit is a real loss when
  // expenses exceed revenue — stripping the sign silently turned a loss
  // into a same-magnitude "profit", the exact opposite of the true figure.
  it('preserves the negative sign for a real loss, does not silently make it positive', () => {
    expect(formatAmountForSpeech(-9876.54, '₹')).toBe('-₹9,876.54')
  })
})
