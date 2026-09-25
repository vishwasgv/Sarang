// The tax line on documents uses the business country's own tax name (GST for Australia, BTW for the Netherlands),
// while India's GST presentation (CGST + SGST, IGST) is untouched.
import { describe, it, expect, afterEach } from 'vitest'
import { getTaxLabel, splitTaxLines, setActiveTaxCountry } from '../../../renderer/src/shared/utils/tax.util'

afterEach(() => setActiveTaxCountry(null))

describe('tax label follows the business country', () => {
  it('uses the model name when no country is set', () => {
    expect(getTaxLabel('VAT')).toBe('VAT')
    expect(getTaxLabel('SALES_TAX')).toBe('Sales Tax')
  })

  it('shows the local tax name for the VAT model', () => {
    setActiveTaxCountry('Australia')
    expect(getTaxLabel('VAT')).toBe('GST')
    expect(splitTaxLines('VAT', 10, null, 2)).toEqual([{ label: 'GST', amount: 10 }])
    setActiveTaxCountry('Netherlands')
    expect(getTaxLabel('VAT')).toBe('BTW')
    setActiveTaxCountry('Japan')
    expect(getTaxLabel('VAT')).toBe('Consumption tax')
  })

  it('never changes India GST presentation', () => {
    setActiveTaxCountry('India')
    expect(getTaxLabel('GST')).toBe('GST')
    expect(splitTaxLines('GST', 18, 'CGST_SGST', 2).map(l => l.label)).toEqual(['CGST', 'SGST'])
    expect(splitTaxLines('GST', 18, 'IGST', 2).map(l => l.label)).toEqual(['IGST'])
  })

  it('a business that chose the GST model in another country keeps the GST presentation', () => {
    setActiveTaxCountry('Australia')
    expect(getTaxLabel('GST')).toBe('GST')
    expect(splitTaxLines('GST', 10, 'GST', 2).map(l => l.label)).toEqual(['GST'])
  })

  it('an unknown country keeps the model name', () => {
    setActiveTaxCountry('Atlantis')
    expect(getTaxLabel('VAT')).toBe('VAT')
  })
})
