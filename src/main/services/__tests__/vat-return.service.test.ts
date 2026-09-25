import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { vatReturnService } from '../vat-return.service'

const line = (over: Record<string, unknown>) => ({ quantity: 1, unitPrice: 0, discountAmount: 0, taxAmount: 0, lineTotal: 0, taxRate: 0, taxCategory: 'STANDARD', ...over })

function makeDb(country: string) {
  return {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ country, currencyCode: 'GBP' }) },
    invoice: {
      findMany: vi.fn().mockResolvedValue([
        { invoiceType: 'RETAIL', pricesIncludeTax: false, items: [line({ taxRate: 20, taxAmount: 200, lineTotal: 1200 }), line({ taxRate: 0, taxCategory: 'ZERO_RATED', lineTotal: 300 }), line({ taxRate: 0, taxCategory: 'EXEMPT', lineTotal: 50 })] },
        { invoiceType: 'RETURN', pricesIncludeTax: false, items: [line({ taxRate: 20, taxAmount: 20, lineTotal: -120 })] }
      ])
    },
    creditNote: { findMany: vi.fn().mockResolvedValue([{ amount: 60, taxAmount: 10, taxRate: 20, items: [] }]) },
    bill: {
      findMany: vi.fn().mockResolvedValue([
        { isReverseCharge: false, items: [{ taxRate: 20, taxAmount: 80, total: 480, taxCategory: 'STANDARD' }, { taxRate: 0, taxAmount: 0, total: 100, taxCategory: 'ZERO_RATED' }] }
      ])
    },
    debitNote: { findMany: vi.fn().mockResolvedValue([{ amount: 24, taxAmount: 4, taxRate: 20, items: [] }]) }
  }
}

describe('VAT return aggregation', () => {
  it('nets returns and notes into the period and reports the country layout', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb('United Kingdom') as never)
    const r = await vatReturnService.generateVatReturn({ dateFrom: '2026-07-01', dateTo: '2026-09-30' })
    expect(r.countryCode).toBe('GB')
    expect(r.hasCountryLayout).toBe(true)
    // sales: 1000 taxed - 120 return - 50 credit note; tax 200 - 20 - 10
    expect(r.base.sales).toMatchObject({ taxed: 830, zero: 300, exempt: 50, tax: 170 })
    // purchases: 400 taxed - 20 debit note; tax 80 - 4
    expect(r.base.purchases).toMatchObject({ taxed: 380, zero: 100, tax: 76 })
    const box = (c: string) => r.layout.boxes.find((b) => b.code === c)!.amount
    expect(box('1')).toBe(170)
    expect(box('5')).toBe(94)
  })

  it('a country without its own layout gets the generic summary and a note', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb('France') as never)
    const r = await vatReturnService.generateVatReturn({ dateFrom: '2026-07-01', dateTo: '2026-09-30' })
    expect(r.hasCountryLayout).toBe(false)
    expect(r.notes).toContain('genericLayout')
    expect(r.layout.netCode).toBe('N')
  })
})
