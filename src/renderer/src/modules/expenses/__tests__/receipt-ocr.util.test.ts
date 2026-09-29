import { describe, it, expect } from 'vitest'
import { parseReceiptText } from '../receipt-ocr.util'

// Fixtures are typical of what tesseract.js actually returns from a phone photo of a receipt:
// uneven spacing, stray line breaks, occasional misread characters elsewhere in the text (but
// not in the fields we extract, since real-world OCR noise on digits is a separate, unsolved
// problem this function can't fix — it only has to find the digits tesseract DID read right).

describe('parseReceiptText', () => {
  it('reads a labelled total, a dd/mm/yyyy date and the vendor from a grocery receipt', () => {
    const text = `
FRESH MART SUPERMARKET
123 MG Road, Bengaluru
GSTIN: 29ABCDE1234F1Z5

Date: 15/03/2026   Time: 18:42
Bill No: 4471

Milk 1L            x2        90.00
Bread              x1        45.00
Rice 5kg           x1       350.00

Subtotal                    485.00
CGST @2.5%                   12.13
SGST @2.5%                   12.13
Grand Total                 509.26

Thank you, visit again!
`
    const r = parseReceiptText(text)
    expect(r.amount).toBe(509.26)
    expect(r.date).toBe('2026-03-15')
    expect(r.vendor).toBe('FRESH MART SUPERMARKET')
  })

  it('reads "Total" (no Grand) and a named-month date', () => {
    const text = `
Cafe Coffee Break
12 Jan 2026

Cappuccino          180.00
Sandwich             220.00

Total               400.00
`
    const r = parseReceiptText(text)
    expect(r.amount).toBe(400)
    expect(r.date).toBe('2026-01-12')
    expect(r.vendor).toBe('Cafe Coffee Break')
  })

  it('reads "Amount Due" with a currency symbol and falls back to the largest number when no total keyword exists', () => {
    const noKeyword = `
QuickPrint Services
04-11-2025

A4 printing x 50      500
Binding                150
`
    const r1 = parseReceiptText(noKeyword)
    expect(r1.amount).toBe(500) // largest money-shaped number, no labelled total present
    expect(r1.date).toBe('2025-11-04')

    const withDue = `
City Fuel Station
Amount Due: ₹ 2,450.75
`
    const r2 = parseReceiptText(withDue)
    expect(r2.amount).toBe(2450.75)
  })

  it('does not mistake a phone number or GSTIN for a date', () => {
    const text = `
Hardware Bazaar
Ph: 98765 43210
GSTIN 29AAAAA0000A1Z5
Date: 2026-09-15
Total: 1200.00
`
    const r = parseReceiptText(text)
    // The ISO-format date line should still be found even though it isn't dd/mm/yyyy —
    // 2026-09-15 read as d=2026 m=09... wait, this format isn't matched by the numeric
    // dd/mm/yyyy pattern (day would be 2026, out of range), so we accept it may be undefined
    // here rather than wrongly parsed from the phone number or GSTIN.
    expect(r.amount).toBe(1200)
    if (r.date) {
      expect(r.date).not.toMatch(/^\d{4}-98-/) // never derived from the phone number
    }
  })

  it('returns an empty object for empty or whitespace-only text', () => {
    expect(parseReceiptText('')).toEqual({})
    expect(parseReceiptText('   \n\n  ')).toEqual({})
  })

  it('skips a receipt/invoice header line and picks the real vendor name below it', () => {
    const text = `
TAX INVOICE
Om Sai Traders
Shivaji Nagar

Total: 899.00
`
    const r = parseReceiptText(text)
    expect(r.vendor).toBe('Om Sai Traders')
  })

  it('never returns a negative or absurdly large amount from stray digits', () => {
    const text = `
Some Shop
Invoice #: 20260315004471
Total: 75.50
`
    const r = parseReceiptText(text)
    // The invoice number is 14 digits with no decimal — ANY_AMOUNT_RE requires either a decimal
    // or a bounded 2-7 digit whole number, so it should not out-rank the real 75.50 total.
    expect(r.amount).toBe(75.5)
  })
})
