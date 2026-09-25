import { describe, it, expect } from 'vitest'
import {
  TAX_PRESETS, TAX_RATE_CATEGORIES, INTERFACE_LANGUAGES, EXCLUDED_TAX_PRESET_COUNTRIES,
  resolveCountryCode, getTaxPreset, getTaxLanguageLock, taxTextLanguage, taxLabelForCountry, taxNumberLabelForCountry,
  isPlausibleTaxNumber, isIndiaCountry
} from '../tax-presets'
import { INDIA_GST_SLABS } from '../../../main/services/india-gst-slabs.service'
import { getCurrencyDecimals, isRoundingRule } from '../../utils/money'

const presets = Object.values(TAX_PRESETS)
const REQUIRED = ['IN', 'GB', 'IE', 'DE', 'FR', 'IT', 'ES', 'NL', 'PT', 'BE', 'AT', 'PL', 'SE', 'DK', 'CH', 'AE', 'SA', 'OM', 'BH', 'QA', 'KW', 'EG', 'TR', 'IL', 'AU', 'NZ', 'SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'JP', 'KR', 'CN', 'HK', 'PK', 'BD', 'LK', 'NP', 'ZA', 'KE', 'NG', 'GH', 'CA', 'US', 'MX', 'AR', 'CL', 'CO']

describe('tax preset data integrity', () => {
  it('covers every requested country except the ones excluded with a reason', () => {
    expect(Object.keys(TAX_PRESETS).sort()).toEqual([...REQUIRED].sort())
    expect(EXCLUDED_TAX_PRESET_COUNTRIES.map((c) => c.code)).toEqual(['BR'])
    for (const c of EXCLUDED_TAX_PRESET_COUNTRIES) expect(c.reason.length).toBeGreaterThan(20)
    expect(TAX_PRESETS['BR']).toBeUndefined()
  })

  it.each(presets.map((p) => [p.code, p] as const))('%s is complete and consistent', (_code, p) => {
    expect(p.code).toMatch(/^[A-Z]{2}$/)
    expect(TAX_PRESETS[p.code]).toBe(p)
    expect(p.name.length).toBeGreaterThan(1)
    expect(p.currency).toMatch(/^[A-Z]{3}$/)
    expect(['GST', 'VAT', 'SALES_TAX', 'CUSTOM', 'NONE']).toContain(p.taxModel)
    expect(p.taxLabel.length).toBeGreaterThan(0)
    expect(p.taxNumberLabel.length).toBeGreaterThan(0)
    expect(typeof p.pricesUsuallyIncludeTax).toBe('boolean')
    expect(p.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(p.asOf))).toBe(false)
    expect(p.sources.length).toBeGreaterThan(0)
    for (const s of p.sources) expect(s).toMatch(/^https:\/\/[^\s]+$/)

    if (p.taxModel === 'NONE') {
      expect(p.rates).toHaveLength(0)
    } else {
      expect(p.rates.length).toBeGreaterThan(0)
      expect(p.rates.filter((x) => x.isDefault === true)).toHaveLength(1)
    }
    const names = new Set<string>()
    for (const rate of p.rates) {
      expect(typeof rate.rate).toBe('number')
      expect(Number.isFinite(rate.rate)).toBe(true)
      expect(rate.rate).toBeGreaterThanOrEqual(0)
      expect(rate.rate).toBeLessThanOrEqual(100)
      expect(TAX_RATE_CATEGORIES).toContain(rate.category)
      expect(rate.name.length).toBeGreaterThan(0)
      expect(names.has(rate.name)).toBe(false)
      names.add(rate.name)
    }
    if (p.suggestedRounding !== undefined) expect(isRoundingRule(p.suggestedRounding)).toBe(true)
    expect(p.notes?.some((n) => /rates change/i.test(n))).toBe(true)
  })

  it('languageLock is en exactly when none of the country languages is an interface language', () => {
    expect(INTERFACE_LANGUAGES).toHaveLength(13)
    for (const p of presets) {
      const covered = p.languages.some((l) => INTERFACE_LANGUAGES.includes(l))
      expect(p.languageLock, p.code).toBe(covered ? null : 'en')
    }
  })

  it('locks the countries whose language is not covered, and leaves the covered ones open', () => {
    for (const code of ['DE', 'IT', 'NL', 'PL', 'SE', 'DK', 'TR', 'TH', 'VN', 'JP', 'KR', 'CN', 'BD', 'NP', 'IL']) expect(TAX_PRESETS[code].languageLock, code).toBe('en')
    for (const code of ['IN', 'ES', 'FR', 'PT', 'ID', 'AE', 'SA', 'EG', 'KW', 'QA', 'OM', 'BH', 'MX', 'AR', 'CL', 'CO', 'LK', 'BE', 'CH']) expect(TAX_PRESETS[code].languageLock, code).toBeNull()
  })

  it('India keeps exactly the current GST slabs', () => {
    const india = TAX_PRESETS['IN']
    expect(india.taxModel).toBe('GST')
    expect(india.rates.map((r) => [r.name, r.rate]).sort()).toEqual(INDIA_GST_SLABS.map((s) => [s.taxName, s.rate]).sort())
    expect(india.rates.find((r) => r.isDefault)?.rate).toBe(18)
  })

  it('only India runs as the GST model; countries that call the tax GST run as VAT with their own label', () => {
    for (const p of presets) if (p.code !== 'IN') expect(p.taxModel, p.code).not.toBe('GST')
    for (const code of ['AU', 'NZ', 'SG']) {
      expect(TAX_PRESETS[code].taxModel).toBe('VAT')
      expect(TAX_PRESETS[code].taxLabel).toBe('GST')
    }
  })

  it('spot-checks the verified rates', () => {
    const rates = (c: string) => TAX_PRESETS[c].rates.map((r) => r.rate).sort((a, b) => b - a)
    expect(rates('GB')).toEqual([20, 5, 0])
    expect(rates('DE')).toEqual([19, 7])
    expect(rates('FR')).toEqual([20, 10, 5.5, 2.1])
    expect(rates('IE')).toEqual([23, 13.5, 9, 4.8, 0])
    expect(rates('CH')).toEqual([8.1, 3.8, 2.6])
    expect(rates('AE')).toEqual([5, 0])
    expect(rates('SA')).toEqual([15, 0])
    expect(rates('AU')).toEqual([10, 0])
    expect(rates('TH')).toEqual([7])
    expect(TAX_PRESETS['QA'].taxModel).toBe('NONE')
    expect(TAX_PRESETS['KW'].taxModel).toBe('NONE')
    expect(TAX_PRESETS['HK'].taxModel).toBe('NONE')
    expect(TAX_PRESETS['US'].rates.every((r) => r.rate === 0)).toBe(true)
  })

  it('suggests cash rounding only where it is customary, in a valid step', () => {
    expect(TAX_PRESETS['CH'].suggestedRounding).toBe('0.05')
    expect(TAX_PRESETS['AU'].suggestedRounding).toBe('0.05')
    expect(TAX_PRESETS['NZ'].suggestedRounding).toBe('0.10')
    expect(TAX_PRESETS['SE'].suggestedRounding).toBe('1')
    expect(TAX_PRESETS['DK'].suggestedRounding).toBe('0.50')
    expect(TAX_PRESETS['GB'].suggestedRounding).toBeUndefined()
    expect(TAX_PRESETS['US'].suggestedRounding).toBeUndefined()
  })

  it('suggests tax-inclusive prices for the UK, EU, Gulf, Australia, New Zealand, Singapore, South Africa and Kenya', () => {
    for (const c of ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'AE', 'SA', 'OM', 'BH', 'AU', 'NZ', 'SG', 'ZA', 'KE']) expect(TAX_PRESETS[c].pricesUsuallyIncludeTax, c).toBe(true)
    expect(TAX_PRESETS['US'].pricesUsuallyIncludeTax).toBe(false)
    expect(TAX_PRESETS['CA'].pricesUsuallyIncludeTax).toBe(false)
  })

  it('currencies keep their own decimals (KWD 3, JPY 0)', () => {
    expect(getCurrencyDecimals(TAX_PRESETS['KW'].currency)).toBe(3)
    expect(getCurrencyDecimals(TAX_PRESETS['OM'].currency)).toBe(3)
    expect(getCurrencyDecimals(TAX_PRESETS['BH'].currency)).toBe(3)
    expect(getCurrencyDecimals(TAX_PRESETS['JP'].currency)).toBe(0)
  })
})

describe('country resolution', () => {
  it('matches names, short forms and ISO codes, ignoring case and spacing', () => {
    expect(resolveCountryCode('India')).toBe('IN')
    expect(resolveCountryCode('  india ')).toBe('IN')
    expect(resolveCountryCode('IN')).toBe('IN')
    expect(resolveCountryCode('in')).toBe('IN')
    expect(resolveCountryCode('UK')).toBe('GB')
    expect(resolveCountryCode('united   kingdom')).toBe('GB')
    expect(resolveCountryCode('USA')).toBe('US')
    expect(resolveCountryCode('U.A.E')).toBe('AE')
    expect(resolveCountryCode('Korea')).toBe('KR')
    expect(resolveCountryCode('Atlantis')).toBeNull()
    expect(resolveCountryCode('')).toBeNull()
    expect(resolveCountryCode(null)).toBeNull()
    expect(isIndiaCountry('India')).toBe(true)
    expect(isIndiaCountry('Indonesia')).toBe(false)
    expect(getTaxPreset('Australia')?.code).toBe('AU')
    expect(getTaxPreset('Brazil')).toBeNull()
    expect(getTaxPreset('Atlantis')).toBeNull()
  })
})

describe('language lock helper', () => {
  it('returns en for a country whose language is not covered and null for a covered one', () => {
    expect(getTaxLanguageLock('DE')).toBe('en')
    expect(getTaxLanguageLock('Germany')).toBe('en')
    expect(getTaxLanguageLock('JP')).toBe('en')
    expect(getTaxLanguageLock('ES')).toBeNull()
    expect(getTaxLanguageLock('France')).toBeNull()
    expect(getTaxLanguageLock('IN')).toBeNull()
    expect(getTaxLanguageLock('ID')).toBeNull()
  })

  it('has nothing to lock for an unknown country or none', () => {
    expect(getTaxLanguageLock('Atlantis')).toBeNull()
    expect(getTaxLanguageLock(undefined)).toBeNull()
  })

  it('renders locked text in English whatever the interface language, and follows the interface otherwise', () => {
    expect(taxTextLanguage('JP', 'hi')).toBe('en')
    expect(taxTextLanguage('DE', 'ar')).toBe('en')
    expect(taxTextLanguage('ES', 'es')).toBe('es')
    expect(taxTextLanguage('FR', 'fr')).toBe('fr')
    expect(taxTextLanguage('Atlantis', 'hi')).toBe('hi')
  })
})

describe('tax labels and numbers', () => {
  it('shows the local tax name for non-GST models only', () => {
    expect(taxLabelForCountry('Australia', 'VAT')).toBe('GST')
    expect(taxLabelForCountry('NL', 'VAT')).toBe('BTW')
    expect(taxLabelForCountry('GB', 'VAT')).toBe('VAT')
    expect(taxLabelForCountry('US', 'SALES_TAX')).toBe('Sales Tax')
    expect(taxLabelForCountry('IN', 'GST')).toBeNull()
    expect(taxLabelForCountry('AU', 'GST')).toBeNull()
    expect(taxLabelForCountry('AU', 'NONE')).toBeNull()
    expect(taxLabelForCountry('Atlantis', 'VAT')).toBeNull()
    expect(taxLabelForCountry(null, 'VAT')).toBeNull()
  })

  it('keeps the existing tax number label for India and uses the preset label elsewhere', () => {
    expect(taxNumberLabelForCountry('India')).toBeNull()
    expect(taxNumberLabelForCountry('UAE')).toBe('TRN (Tax Registration Number)')
    expect(taxNumberLabelForCountry('Australia')).toBe('ABN (Australian Business Number)')
    expect(taxNumberLabelForCountry('US')).toBe('EIN (Employer Identification Number)')
    expect(taxNumberLabelForCountry('Atlantis')).toBeNull()
  })

  it('validates a format only where one is known', () => {
    expect(isPlausibleTaxNumber('AE', '100123456700003')).toBe(true)
    expect(isPlausibleTaxNumber('AE', '1001 2345 6700 003')).toBe(true)
    expect(isPlausibleTaxNumber('AE', '12345')).toBe(false)
    expect(isPlausibleTaxNumber('AU', '51 824 753 556')).toBe(true)
    expect(isPlausibleTaxNumber('AU', '5182475355')).toBe(false)
    expect(isPlausibleTaxNumber('GB', 'GB 123 4567 89')).toBe(true)
    expect(isPlausibleTaxNumber('DE', 'DE123456789')).toBe(true)
    expect(isPlausibleTaxNumber('DE', 'DE12345')).toBe(false)
    expect(isPlausibleTaxNumber('SA', '300000000000003')).toBe(true)
    expect(isPlausibleTaxNumber('JP', 'T1234567890123')).toBe(true)
    expect(isPlausibleTaxNumber('KE', 'A123456789Z')).toBe(true)
    expect(isPlausibleTaxNumber('OM', 'anything goes')).toBe(true)
    expect(isPlausibleTaxNumber('IN', 'not checked here')).toBe(true)
    expect(isPlausibleTaxNumber('Atlantis', 'x')).toBe(true)
    expect(isPlausibleTaxNumber('AE', '')).toBe(true)
  })
})
