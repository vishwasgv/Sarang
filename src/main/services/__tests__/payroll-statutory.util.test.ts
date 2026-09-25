import { describe, it, expect } from 'vitest'
import { expectedStatutory, splitDeductions } from '../payroll-statutory.util'

const cfg = { statutoryPfPercent: 12, statutoryEsiPercent: 0.75, statutoryEsiWageCeiling: 21000, statutoryProfessionalTax: 200 }

describe('expected statutory deductions from the configured rates', () => {
  it('works each head out from the basic pay', () => {
    expect(expectedStatutory(15000, cfg)).toEqual({ pf: 1800, esi: 112.5, professionalTax: 200 })
  })

  it('ESI is nil above the wage ceiling, not a smaller amount', () => {
    expect(expectedStatutory(25000, cfg).esi).toBe(0)
  })

  it('a head with no rate set is unknown, not zero', () => {
    expect(expectedStatutory(15000, { ...cfg, statutoryPfPercent: null, statutoryProfessionalTax: 0 })).toMatchObject({ pf: null, professionalTax: null })
  })
})

describe('splitting payslip deductions into heads', () => {
  it('recognises the usual names in any case and puts the rest in other', () => {
    expect(splitDeductions([{ name: 'PF', amount: 1800 }, { name: 'esi', amount: 112.5 }, { name: 'Professional Tax', amount: 200 }, { name: 'Advance recovery', amount: 500 }, { name: 'TDS', amount: 100 }]))
      .toEqual({ pf: 1800, esi: 112.5, professionalTax: 200, other: 600 })
  })

  it('adds repeated lines and ignores empty or negative ones', () => {
    expect(splitDeductions([{ name: 'PF', amount: 100 }, { name: 'pf', amount: 50.25 }, { name: 'ESI', amount: 0 }, { name: 'PT', amount: -5 }])).toEqual({ pf: 150.25, esi: 0, professionalTax: 0, other: 0 })
  })
})
