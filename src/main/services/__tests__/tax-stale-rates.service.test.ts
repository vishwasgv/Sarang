import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u1' }) }))

import { getPrisma } from '../../database/db'
import { getTaxPreset } from '../../../shared/data/tax-presets'
import { deactivateStaleRates, isOldSeededRate, isStaleForCountry, listStaleSeededRates } from '../tax-stale-rates.service'

const row = (id: string, taxName: string, taxType: string, rate: number, isDefault = false) => ({ id, taxName, taxType, rate, isDefault, isActive: true })

const oldSeed = [
  row('a', 'CGST @ 9%', 'CGST', 9), row('b', 'SGST @ 9%', 'SGST', 9), row('c', 'GST 18%', 'GST', 18, true),
  row('d', 'VAT 20%', 'VAT', 20), row('e', 'Sales Tax', 'SALES_TAX', 8), row('f', 'My own rate', 'VAT', 12.5)
]

function makeDb(country: string, rows = oldSeed) {
  return {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ country }) },
    taxConfiguration: { findMany: vi.fn().mockResolvedValue(rows), updateMany: vi.fn().mockResolvedValue({ count: 2 }) }
  }
}

describe('isOldSeededRate', () => {
  it('recognises only the rows the app used to seed, never an owner-made one', () => {
    expect(isOldSeededRate({ taxName: 'CGST @ 2.5%', taxType: 'CGST', rate: 2.5 })).toBe(true)
    expect(isOldSeededRate({ taxName: 'GST 12%', taxType: 'GST', rate: 12 })).toBe(true)
    expect(isOldSeededRate({ taxName: 'VAT 20%', taxType: 'VAT', rate: 20 })).toBe(true)
    expect(isOldSeededRate({ taxName: 'VAT 20%', taxType: 'VAT', rate: 21 })).toBe(false)
    expect(isOldSeededRate({ taxName: 'My own rate', taxType: 'VAT', rate: 12.5 })).toBe(false)
  })
})

describe('isStaleForCountry', () => {
  it('India and unknown countries never have stale rows', () => {
    expect(isStaleForCountry({ taxName: 'CGST @ 9%', taxType: 'CGST', rate: 9 }, getTaxPreset('India'), 'IN')).toBe(false)
    expect(isStaleForCountry({ taxName: 'CGST @ 9%', taxType: 'CGST', rate: 9 }, null, null)).toBe(false)
  })
  it('the UK keeps a VAT 20% row because its own preset has 20% VAT, but loses India GST rows', () => {
    const uk = getTaxPreset('United Kingdom')
    expect(isStaleForCountry({ taxName: 'VAT 20%', taxType: 'VAT', rate: 20 }, uk, 'GB')).toBe(false)
    expect(isStaleForCountry({ taxName: 'CGST @ 9%', taxType: 'CGST', rate: 9 }, uk, 'GB')).toBe(true)
    expect(isStaleForCountry({ taxName: 'GST 18%', taxType: 'GST', rate: 18 }, uk, 'GB')).toBe(true)
  })
  it('Singapore loses GST 18% (its rate is different) and the generic Sales Tax row', () => {
    const sg = getTaxPreset('Singapore')
    expect(isStaleForCountry({ taxName: 'GST 18%', taxType: 'GST', rate: 18 }, sg, 'SG')).toBe(true)
    expect(isStaleForCountry({ taxName: 'Sales Tax', taxType: 'SALES_TAX', rate: 8 }, sg, 'SG')).toBe(true)
  })
})

describe('stale rate service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the stale rows for a French business and nothing for India', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb('France') as never)
    const fr = await listStaleSeededRates()
    expect(fr.data!.map((r) => r.id).sort()).toEqual(['a', 'b', 'c', 'e'])
    vi.mocked(getPrisma).mockReturnValue(makeDb('India') as never)
    expect((await listStaleSeededRates()).data).toEqual([])
  })

  it('turns off only the rows that are stale, ignoring any other id sent', async () => {
    const db = makeDb('France')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await deactivateStaleRates(['a', 'f', 'nonsense'])
    expect(db.taxConfiguration.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a'] } }, data: { isActive: false, isDefault: false } })
  })

  it('does nothing when nothing chosen is stale', async () => {
    const db = makeDb('France')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await deactivateStaleRates(['f'])
    expect(r.data).toEqual({ deactivated: 0 })
    expect(db.taxConfiguration.updateMany).not.toHaveBeenCalled()
  })
})
