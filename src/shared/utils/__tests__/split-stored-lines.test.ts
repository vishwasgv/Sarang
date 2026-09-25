import { describe, it, expect } from 'vitest'
import { computeDocumentTotals, splitStoredLines, sumMoney, getCurrencyDecimals, roundMoney } from '../money'

// Deterministic PRNG so a failure is reproducible.
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

const CURRENCIES = ['INR', 'USD', 'KWD', 'JPY']
const RATES = [0, 5, 18, 40, 3, 0.25, 7.5, 21]
const GST_MODES = ['CGST_SGST', 'IGST', 'GST'] as const

function randomCase(r: () => number, currency: string, inclusive: boolean) {
  const decimals = getCurrencyDecimals(currency)
  const nLines = 1 + Math.floor(r() * 5)
  const scale = Math.pow(10, decimals)
  const inputs = Array.from({ length: nLines }, () => {
    const quantity = 1 + Math.floor(r() * 9)
    const unitPrice = decimals === 0 ? 1 + Math.floor(r() * 5000) : roundMoney((1 + r() * 900), decimals)
    const gross = quantity * unitPrice
    const discountAmount = r() < 0.4 ? roundMoney(gross * r() * 0.3, decimals) : 0
    return { quantity, unitPrice, discountAmount, taxRate: RATES[Math.floor(r() * RATES.length)] }
  })
  const rawGross = inputs.reduce((a, i) => a + i.quantity * i.unitPrice - i.discountAmount, 0)
  const globalDiscount = r() < 0.6 ? Math.floor(rawGross * r() * 0.4 * scale) / scale : 0
  const t = computeDocumentTotals(inputs, { decimals, pricesIncludeTax: inclusive, globalDiscount })
  const lines = inputs.map((i, idx) => ({
    quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: t.lines[idx].discountAmount,
    taxRate: i.taxRate, taxAmount: t.lines[idx].tax, lineTotal: t.lines[idx].total
  }))
  // Random partition: each line's quantity is cut into 1..3 pieces dealt to random parts.
  const nParts = 2 + Math.floor(r() * 3)
  const parts: Array<Array<{ lineIndex: number; quantity: number }>> = Array.from({ length: nParts }, () => [])
  lines.forEach((l, lineIndex) => {
    let left = l.quantity
    const pieces = 1 + Math.floor(r() * 3)
    for (let k = 0; k < pieces && left > 0; k++) {
      const q = k === pieces - 1 ? left : Math.max(1, Math.floor(r() * left))
      const take = Math.min(q, left)
      parts[Math.floor(r() * nParts)].push({ lineIndex, quantity: take })
      left -= take
    }
    if (left > 0) parts[0].push({ lineIndex, quantity: left })
  })
  return { t, lines, parts: parts.filter(p => p.length > 0), decimals }
}

describe('splitStoredLines (gap 3.27)', () => {
  it('parts sum to the original exactly: subtotal, discount, tax, taxable and total (property test)', () => {
    let runs = 0
    for (const currency of CURRENCIES) {
      for (const inclusive of [false, true]) {
        for (const gst of GST_MODES) {
          const r = rng(1000 + runs)
          for (let n = 0; n < 170; n++) {
            const { t, lines, parts, decimals } = randomCase(r, currency, inclusive)
            const pieces = splitStoredLines(lines, parts, { decimals, pricesIncludeTax: inclusive })
            expect(pieces.length).toBe(parts.length)
            const sum = (f: (p: (typeof pieces)[number]) => number) => sumMoney(pieces.map(f), decimals)
            const ctx = `${currency} incl=${inclusive} ${gst} run ${n}`
            expect(sum(p => p.subtotal), ctx).toBe(t.subtotal)
            expect(sum(p => p.taxAmount), ctx).toBe(t.taxAmount)
            expect(sum(p => p.discountAmount), ctx).toBe(t.discountAmount)
            expect(sum(p => p.rawTotal), ctx).toBe(t.rawTotal)
            for (const p of pieces) {
              expect(roundMoney(p.subtotal - p.discountAmount + p.taxAmount, decimals), ctx).toBe(p.rawTotal)
              for (const l of p.lines) expect(l.lineTotal, ctx).toBeGreaterThanOrEqual(l.taxAmount)
            }
            // Per line, the pieces add back to the stored line.
            lines.forEach((l, idx) => {
              const taxOf = pieces.flatMap(p => p.lines).filter(x => x.lineIndex === idx)
              expect(sumMoney(taxOf.map(x => x.taxAmount), decimals), ctx).toBe(l.taxAmount)
              expect(sumMoney(taxOf.map(x => x.lineTotal), decimals), ctx).toBe(l.lineTotal)
              expect(sumMoney(taxOf.map(x => x.discountAmount), decimals), ctx).toBe(l.discountAmount)
            })
          }
          runs++
        }
      }
    }
    expect(runs).toBe(24)
  })

  it('an invoice-level discount share travels with the quantity', () => {
    const t = computeDocumentTotals([{ quantity: 2, unitPrice: 300, taxRate: 5 }, { quantity: 4, unitPrice: 40, taxRate: 5 }], { globalDiscount: 76 })
    const lines = [
      { quantity: 2, unitPrice: 300, discountAmount: 0, taxRate: 5, taxAmount: t.lines[0].tax, lineTotal: t.lines[0].total },
      { quantity: 4, unitPrice: 40, discountAmount: 0, taxRate: 5, taxAmount: t.lines[1].tax, lineTotal: t.lines[1].total }
    ]
    const [a, b] = splitStoredLines(lines, [[{ lineIndex: 0, quantity: 2 }], [{ lineIndex: 1, quantity: 4 }]])
    expect(a.discountAmount).toBe(60)
    expect(b.discountAmount).toBe(16)
    expect(a.rawTotal + b.rawTotal).toBeCloseTo(t.rawTotal, 10)
  })

  it('a part that only takes some of a line never exceeds what is left of it', () => {
    const lines = [{ quantity: 3, unitPrice: 33.33, discountAmount: 0, taxRate: 18, taxAmount: 18, lineTotal: 118 }]
    const pieces = splitStoredLines(lines, [[{ lineIndex: 0, quantity: 1 }], [{ lineIndex: 0, quantity: 1 }], [{ lineIndex: 0, quantity: 1 }]])
    expect(sumMoney(pieces.map(p => p.taxAmount))).toBe(18)
    expect(sumMoney(pieces.map(p => p.rawTotal))).toBe(118)
  })
})
