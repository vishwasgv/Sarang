import { describe, it, expect, vi } from 'vitest'
import { computeNoteTotals, computeDocumentTotals, getCurrencyDecimals, roundMoney, splitTaxHalves, sumMoney, type NoteTotalsInput } from '../money'
import { gstPresentationLines } from '../gst-presentation'

vi.setConfig({ testTimeout: 30000 }) // random-input property tests can pass the 5s default when the machine is busy

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 } }
const CURRENCIES = ['INR', 'USD', 'KWD', 'JPY']
const RATES = [0, 0.25, 2.5, 3, 5, 12, 18, 28, 40]
const MODES = ['CGST_SGST', 'IGST', 'GST']

// every amount is an exact multiple of the minor unit, with no floating-point residue
function clean(x: number, d: number): boolean {
  const scaled = x * 10 ** d
  // the exact-roundtrip check is strict at every magnitude; the scaled-residue check the brief suggested is scaled by
  // magnitude because x * 10**d itself carries a double rounding error that grows with x (132420.05 * 100)
  const tol = 1e-9 * Math.max(1, Math.abs(scaled) / 1e6)
  return Number.isFinite(x) && !Object.is(x, -0) && Number(x.toFixed(d)) === x && Math.abs(scaled - Math.round(scaled)) < tol
}
function decimalsPrinted(x: number): number { const s = String(x); return s.includes('.') ? s.split('.')[1].length : 0 }

function randomInput(r: () => number, d: number): NoteTotalsInput {
  const inclusive = r() < 0.5
  const taxApplied = r() < 0.6
  if (r() < 0.5) {
    return { amount: Math.round(r() * 9999999) / 10 ** d || 1 / 10 ** d, taxApplied, taxRate: RATES[Math.floor(r() * RATES.length)], pricesIncludeTax: inclusive, decimals: d }
  }
  return {
    items: Array.from({ length: 1 + Math.floor(r() * 4) }, () => ({ quantity: [1, 2, 3, 0.5, 1.25, 7][Math.floor(r() * 6)], unitPrice: Math.round(r() * 999999) / 10 ** d, taxRate: RATES[Math.floor(r() * RATES.length)] })),
    taxApplied, pricesIncludeTax: inclusive, decimals: d
  }
}

describe('computeNoteTotals: clean numbers, identity, stability', () => {
  it('worked examples: exclusive and inclusive, tax on and off', () => {
    expect(computeNoteTotals({ amount: 1000, taxApplied: true, taxRate: 18, pricesIncludeTax: false })).toMatchObject({ taxable: 1000, taxAmount: 180, totalAmount: 1180, taxRate: 18 })
    expect(computeNoteTotals({ amount: 1180, taxApplied: true, taxRate: 18, pricesIncludeTax: true })).toMatchObject({ taxable: 1000, taxAmount: 180, totalAmount: 1180 })
    expect(computeNoteTotals({ amount: 1000, taxApplied: false, taxRate: 18, pricesIncludeTax: false })).toMatchObject({ taxable: 1000, taxAmount: 0, totalAmount: 1000, taxRate: null })
    // no tax: an inclusive flag and a rate change nothing
    expect(computeNoteTotals({ amount: 1000, taxApplied: false, taxRate: 18, pricesIncludeTax: true })).toMatchObject({ taxable: 1000, taxAmount: 0, totalAmount: 1000 })
    expect(computeNoteTotals({ items: [{ quantity: 2, unitPrice: 500, taxRate: 18 }, { quantity: 1, unitPrice: 100, taxRate: 5 }], taxApplied: false, pricesIncludeTax: false })).toMatchObject({ taxAmount: 0, totalAmount: 1100 })
  })

  it('edge amounts: 0.01, rate 0.25, JPY whole units, KWD fils', () => {
    expect(computeNoteTotals({ amount: 0.01, taxApplied: true, taxRate: 18, pricesIncludeTax: false })).toMatchObject({ taxable: 0.01, taxAmount: 0, totalAmount: 0.01 })
    expect(computeNoteTotals({ amount: 0.01, taxApplied: true, taxRate: 18, pricesIncludeTax: true })).toMatchObject({ totalAmount: 0.01 })
    expect(computeNoteTotals({ amount: 1000, taxApplied: true, taxRate: 0.25, pricesIncludeTax: false })).toMatchObject({ taxAmount: 2.5, totalAmount: 1002.5 })
    expect(computeNoteTotals({ amount: 1000, taxApplied: true, taxRate: 0.25, pricesIncludeTax: true })).toMatchObject({ taxAmount: 2.49, totalAmount: 1000 })
    expect(computeNoteTotals({ amount: 999, taxApplied: true, taxRate: 10, pricesIncludeTax: false, decimals: 0 })).toMatchObject({ taxAmount: 100, totalAmount: 1099 })
    expect(computeNoteTotals({ amount: 12.345, taxApplied: true, taxRate: 5, pricesIncludeTax: false, decimals: 3 })).toMatchObject({ taxAmount: 0.617, totalAmount: 12.962 })
  })

  it('1 clean numbers: every amount is a multiple of the minor unit, never -0 or NaN, never more than d decimals (6000 random notes)', () => {
    const r = rng(11)
    for (let n = 0; n < 6000; n++) {
      const cur = CURRENCIES[n % 4]
      const d = getCurrencyDecimals(cur)
      const inp = randomInput(r, d)
      const t = computeNoteTotals(inp)
      const ctx = JSON.stringify({ n, cur, inp })
      for (const x of [t.taxable, t.taxAmount, t.totalAmount, ...t.lines.flatMap(l => [l.taxable, l.tax, l.total])]) {
        expect(clean(x, d), ctx + ' amount ' + x).toBe(true)
        expect(decimalsPrinted(x) <= d, ctx + ' printed ' + x).toBe(true)
        expect(Number.isNaN(x) || Object.is(x, -0), ctx).toBe(false)
      }
      for (const mode of MODES) {
        for (const l of gstPresentationLines(mode, t.taxAmount, d)) {
          expect(clean(l.amount, d), ctx + ' ' + mode).toBe(true)
          expect(decimalsPrinted(l.amount) <= d, ctx).toBe(true)
        }
      }
    }
  })

  it('2 identity: total = taxable + tax with tax on; total = taxable, tax = 0 and no tax lines with tax off; tax lines add to the tax in every mode', () => {
    const r = rng(12)
    for (let n = 0; n < 6000; n++) {
      const d = getCurrencyDecimals(CURRENCIES[n % 4])
      const inp = randomInput(r, d)
      const t = computeNoteTotals(inp)
      const ctx = JSON.stringify({ n, inp })
      expect(roundMoney(t.taxable + t.taxAmount, d), ctx).toBe(t.totalAmount)
      expect(sumMoney(t.lines.map(l => l.total), d), ctx).toBe(t.totalAmount)
      expect(sumMoney(t.lines.map(l => l.tax), d), ctx).toBe(t.taxAmount)
      if (!inp.taxApplied) {
        expect(t.taxAmount, ctx).toBe(0)
        expect(t.totalAmount, ctx).toBe(t.taxable)
        for (const mode of MODES) expect(gstPresentationLines(mode, t.taxAmount, d), ctx).toEqual([])
      } else if (t.taxAmount > 0) {
        for (const mode of MODES) {
          const lines = gstPresentationLines(mode, t.taxAmount, d)
          expect(sumMoney(lines.map(l => l.amount), d), ctx + mode).toBe(t.taxAmount)
        }
        const h = splitTaxHalves(t.taxAmount, d)
        expect(roundMoney(h.first + h.second, d), ctx).toBe(t.taxAmount)
      }
      // and it equals the shared document calculation for the same lines
      const direct = inp.items
        ? computeDocumentTotals(inp.items.map(i => ({ ...i, taxRate: inp.taxApplied ? i.taxRate : 0 })), { decimals: d, pricesIncludeTax: inp.taxApplied && inp.pricesIncludeTax })
        : computeDocumentTotals([{ quantity: 1, unitPrice: inp.amount, taxRate: inp.taxApplied ? inp.taxRate : 0 }], { decimals: d, pricesIncludeTax: inp.taxApplied && inp.pricesIncludeTax })
      expect(t.totalAmount, ctx).toBe(direct.totalAmount)
      expect(t.taxAmount, ctx).toBe(direct.taxAmount)
    }
  })

  it('3 toggling and switching modes leave no drift: any sequence of changes ends where a fresh calculation does (3000 sequences)', () => {
    const r = rng(13)
    for (let n = 0; n < 3000; n++) {
      const d = getCurrencyDecimals(CURRENCIES[n % 4])
      const base = randomInput(r, d)
      let cur: NoteTotalsInput = { ...base }
      let last = computeNoteTotals(cur)
      const steps = 2 + Math.floor(r() * 10)
      for (let k = 0; k < steps; k++) {
        const pick = r()
        if (pick < 0.4) cur = { ...cur, taxApplied: !cur.taxApplied }
        else if (pick < 0.7) cur = { ...cur, pricesIncludeTax: !cur.pricesIncludeTax }
        else cur = { ...cur } // presentation-mode changes never reach the calculation
        last = computeNoteTotals(cur)
      }
      const fresh = computeNoteTotals({ ...base, taxApplied: cur.taxApplied, pricesIncludeTax: cur.pricesIncludeTax })
      expect(last, JSON.stringify({ n, base })).toEqual(fresh)
      // returning to the original settings returns the original figures exactly
      expect(computeNoteTotals({ ...cur, taxApplied: base.taxApplied, pricesIncludeTax: base.pricesIncludeTax }), JSON.stringify({ n })).toEqual(computeNoteTotals(base))
    }
  })

  it('5 partial notes that add up to the original document: the parts stay within one minor unit per part of the whole', () => {
    const r = rng(14)
    for (let n = 0; n < 1500; n++) {
      const d = getCurrencyDecimals(CURRENCIES[n % 4])
      const inclusive = r() < 0.5
      const rate = RATES[Math.floor(r() * RATES.length)]
      const amount = Math.round((1 + r() * 999999)) / 10 ** d
      const whole = computeNoteTotals({ amount, taxApplied: true, taxRate: rate, pricesIncludeTax: inclusive, decimals: d })
      const pieces: number[] = []
      let left = amount
      for (let k = 0; k < 3 && left > 0; k++) {
        const take = k === 2 ? left : roundMoney(left * r(), d)
        pieces.push(take)
        left = roundMoney(left - take, d)
      }
      expect(sumMoney(pieces, d)).toBe(amount)
      const parts = pieces.filter(p => p > 0).map(p => computeNoteTotals({ amount: p, taxApplied: true, taxRate: rate, pricesIncludeTax: inclusive, decimals: d }))
      const tolerance = 10 ** -d * parts.length
      expect(Math.abs(sumMoney(parts.map(p => p.totalAmount), d) - whole.totalAmount), JSON.stringify({ n, amount, rate, inclusive })).toBeLessThanOrEqual(tolerance + 1e-9)
    }
  })
})
