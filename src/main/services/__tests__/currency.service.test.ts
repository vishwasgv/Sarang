import { describe, it, expect } from 'vitest'
import { allocateGlobalDiscount, calculateLineTotal } from '../currency.service'

// Fresh-audit fix (2026-08-11) — real GST compliance bug: a global/invoice-level
// discount used to be subtracted from the total only after tax was already
// summed from each line's own (correct) per-line tax, so GST was charged on
// the pre-discount subtotal. allocateGlobalDiscount closes that for the
// invoice-level case the same way calculateLineTotal already handles
// per-line discounts.
describe('allocateGlobalDiscount', () => {
  it('is a true no-op when there is no global discount — common case unchanged', () => {
    const items = [
      { lineTaxable: 1000, taxRate: 18 },
      { lineTaxable: 500, taxRate: 5 }
    ]
    const result = allocateGlobalDiscount(items, 0)
    expect(result).toEqual([
      { lineTaxable: 1000, lineTax: 180 },
      { lineTaxable: 500, lineTax: 25 }
    ])
  })

  it('reduces a single line\'s taxable base and recomputes tax on the discounted amount', () => {
    // ₹1000 taxable, 18% GST, ₹100 global discount → taxable becomes ₹900,
    // tax becomes ₹162 (18% of 900) — not ₹180 (18% of the original 1000).
    const items = [{ lineTaxable: 1000, taxRate: 18 }]
    const result = allocateGlobalDiscount(items, 100)
    expect(result[0].lineTaxable).toBe(900)
    expect(result[0].lineTax).toBe(162)
  })

  it('allocates proportionally across lines with different tax rates, not a flat split', () => {
    // Line A: ₹800 taxable @ 18%, Line B: ₹200 taxable @ 5%. Total taxable
    // ₹1000. A ₹100 global discount must split 80/20 by taxable share
    // (₹80 off A, ₹20 off B) — a naive 50/50 split would be wrong here.
    const items = [
      { lineTaxable: 800, taxRate: 18 },
      { lineTaxable: 200, taxRate: 5 }
    ]
    const result = allocateGlobalDiscount(items, 100)
    expect(result[0].lineTaxable).toBe(720) // 800 - 80
    expect(result[0].lineTax).toBe(129.6) // 720 * 18%
    expect(result[1].lineTaxable).toBe(180) // 200 - 20
    expect(result[1].lineTax).toBe(9) // 180 * 5%
  })

  it('the last line absorbs the rounding remainder so allocated shares sum exactly to the discount', () => {
    // Three equal-taxable lines splitting a discount that doesn't divide evenly.
    const items = [
      { lineTaxable: 100, taxRate: 18 },
      { lineTaxable: 100, taxRate: 18 },
      { lineTaxable: 100, taxRate: 18 }
    ]
    const result = allocateGlobalDiscount(items, 10) // 10/3 = 3.33... per line
    const totalTaxableAfter = result.reduce((s, r) => s + r.lineTaxable, 0)
    expect(totalTaxableAfter).toBe(290) // 300 - 10, exactly, no rounding drift lost or gained
  })

  it('never lets a line\'s taxable base go negative when the discount exceeds it', () => {
    const items = [
      { lineTaxable: 50, taxRate: 18 },
      { lineTaxable: 50, taxRate: 18 }
    ]
    const result = allocateGlobalDiscount(items, 500) // absurdly large discount
    for (const r of result) {
      expect(r.lineTaxable).toBeGreaterThanOrEqual(0)
      expect(r.lineTax).toBeGreaterThanOrEqual(0)
    }
  })

  it('handles a single-item cart (the common small-shop case) correctly', () => {
    const items = [{ lineTaxable: 250, taxRate: 12 }]
    const result = allocateGlobalDiscount(items, 50)
    expect(result[0].lineTaxable).toBe(200)
    expect(result[0].lineTax).toBe(24) // 12% of 200
  })
})

// Confirms the existing, already-correct per-line discount behavior this fix
// deliberately does not touch — GST on a per-line bargain was already
// computed on the discounted amount before this change.
describe('calculateLineTotal (existing per-line behavior, unchanged)', () => {
  it('computes tax on the discounted amount, not the original', () => {
    const result = calculateLineTotal(1, 1000, 100, 18)
    expect(result.taxAmount).toBe(162) // 18% of (1000 - 100), not of 1000
  })
})
