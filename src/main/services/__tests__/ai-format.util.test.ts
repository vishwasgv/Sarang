import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatAmountForSpeech, refreshAiNumberFormat } from '../ai-format.util'

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

// Regression for a real defect found 2026-07-22: formatAmountForSpeech used
// to hardcode 'en-US' grouping regardless of the business's configured
// number_format Setting — the AI Assistant always spoke amounts in
// 1,000,000-style grouping even for the app's stated primary Indian market
// (default 'IN', lakh/crore grouping: 12,34,567). A number under 100,000
// groups identically either way, so this needs a larger figure to actually
// distinguish the two — that's the whole point of this regression.
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
import { getPrisma } from '../../database/db'

describe('formatAmountForSpeech — locale-aware grouping', () => {
  afterEach(async () => {
    // Reset the module-level cache back to the 'IN' default so this
    // describe block's mutations don't leak into other test files.
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue(null) } } as never)
    await refreshAiNumberFormat()
  })

  it('uses Indian lakh/crore grouping by default (number_format not set -> falls back to IN)', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue(null) } } as never)
    await refreshAiNumberFormat()

    expect(formatAmountForSpeech(1234567, '₹')).toBe('₹12,34,567.00')
  })

  it('switches to US-style grouping when number_format is explicitly set to US', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: 'US' }) } } as never)
    await refreshAiNumberFormat()

    expect(formatAmountForSpeech(1234567, '₹')).toBe('₹1,234,567.00')
  })

  it('falls back to the IN default if the settings lookup throws', async () => {
    vi.mocked(getPrisma).mockReturnValue({ setting: { findUnique: vi.fn().mockRejectedValue(new Error('db unavailable')) } } as never)
    await refreshAiNumberFormat()

    expect(formatAmountForSpeech(1234567, '₹')).toBe('₹12,34,567.00')
  })
})
