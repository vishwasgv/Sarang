import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { setTaxComponentsCache, taxLinesByComponents } from '../tax-components-cache'

const parts = JSON.stringify([{ name: 'GST', rate: 5 }, { name: 'PST', rate: 7 }])

describe('tax lines by parts', () => {
  beforeEach(() => setTaxComponentsCache([]))

  it('keeps the single line when no rate has parts', () => {
    expect(taxLinesByComponents([{ taxRate: 12, taxAmount: 12 }], 12, 2)).toBeNull()
  })

  it('splits the tax of a rate that has parts', () => {
    setTaxComponentsCache([{ rate: 12, components: parts }])
    expect(taxLinesByComponents([{ taxRate: 12, taxAmount: 12 }], 12, 2)).toEqual([
      { label: 'GST 5%', amount: 5 }, { label: 'PST 7%', amount: 7 }
    ])
  })

  it('adds up lines of the same rate and leaves other rates as Tax', () => {
    setTaxComponentsCache([{ rate: 12, components: parts }])
    const lines = taxLinesByComponents([{ taxRate: 12, taxAmount: 6 }, { taxRate: 12, taxAmount: 6 }, { taxRate: 5, taxAmount: 1 }], 13, 2)
    expect(lines).toEqual([{ label: 'GST 5%', amount: 5 }, { label: 'PST 7%', amount: 7 }, { label: 'Tax', amount: 1 }])
  })

  it('always adds back to the document tax to the last cent', () => {
    setTaxComponentsCache([{ rate: 12, components: parts }])
    const lines = taxLinesByComponents([{ taxRate: 12, taxAmount: 0.03 }], 0.03, 2)!
    expect(Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100).toBe(0.03)
  })

  it('gives up (null) when the lines do not match the document tax', () => {
    setTaxComponentsCache([{ rate: 12, components: parts }])
    expect(taxLinesByComponents([{ taxRate: 12, taxAmount: 12 }], 50, 2)).toBeNull()
  })

  it('a default rate wins when two rates share a value', () => {
    setTaxComponentsCache([
      { rate: 12, components: JSON.stringify([{ name: 'A', rate: 6 }, { name: 'B', rate: 6 }]), isDefault: false },
      { rate: 12, components: parts, isDefault: true }
    ])
    expect(taxLinesByComponents([{ taxRate: 12, taxAmount: 12 }], 12, 2)![0].label).toBe('GST 5%')
  })
})
