import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getTemplateSuggestion } from '../template-suggestion.service'

const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 86400000)
const YESTERDAY = new Date(Date.now() - 1 * 86400000)

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessType: 'GENERAL', createdAt: EIGHT_DAYS_AGO }) },
    product: { count: vi.fn().mockResolvedValue(0) },
    kOT: { count: vi.fn().mockResolvedValue(0) },
    repairTicket: { count: vi.fn().mockResolvedValue(0) },
    jobCard: { count: vi.fn().mockResolvedValue(0) },
    appointment: { count: vi.fn().mockResolvedValue(0) },
    productVariant: { count: vi.fn().mockResolvedValue(0) },
    ...overrides
  } as Record<string, any>
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('getTemplateSuggestion', () => {
  it('returns null when the business is not GENERAL', async () => {
    const db = makeDb({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessType: 'RETAIL', createdAt: EIGHT_DAYS_AGO }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect(res.success).toBe(true)
    expect((res as { data: unknown }).data).toBeNull()
    expect(db.product.count).not.toHaveBeenCalled()
  })

  it('returns null when the business is less than a week old, even with strong signals', async () => {
    const db = makeDb({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessType: 'GENERAL', createdAt: YESTERDAY }) },
      product: { count: vi.fn().mockResolvedValue(50) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect((res as { data: unknown }).data).toBeNull()
  })

  it('returns null when no signal clears its threshold', async () => {
    const db = makeDb({ product: { count: vi.fn().mockResolvedValue(2) }, appointment: { count: vi.fn().mockResolvedValue(4) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect((res as { data: unknown }).data).toBeNull()
  })

  it('suggests HARDWARE when carton-pack products clear the threshold', async () => {
    const db = makeDb({
      product: { count: vi.fn(({ where }: { where: Record<string, unknown> }) => Promise.resolve(where.sellByPack ? 5 : 0)) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect(res.success).toBe(true)
    expect((res as { data: { businessType: string; matchedCount: number; signalKey: string } }).data).toMatchObject({ businessType: 'HARDWARE', matchedCount: 5, signalKey: 'cartonProducts' })
  })

  it('suggests JEWELLERY when metal-priced products clear the threshold', async () => {
    const db = makeDb({
      product: { count: vi.fn(({ where }: { where: Record<string, unknown> }) => Promise.resolve(where.metalType ? 4 : 0)) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect((res as { data: { businessType: string } }).data).toMatchObject({ businessType: 'JEWELLERY' })
  })

  it('suggests SERVICE when appointment count clears the threshold', async () => {
    const db = makeDb({ appointment: { count: vi.fn().mockResolvedValue(10) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect((res as { data: { businessType: string; matchedCount: number } }).data).toMatchObject({ businessType: 'SERVICE', matchedCount: 10 })
  })

  it('picks the strongest signal when multiple clear their thresholds, never returning more than one suggestion', async () => {
    const db = makeDb({
      appointment: { count: vi.fn().mockResolvedValue(6) }, // clears threshold of 5
      kOT: { count: vi.fn().mockResolvedValue(20) } // clears threshold of 3, much higher count
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    const data = (res as { data: { businessType: string; matchedCount: number } }).data
    expect(data.businessType).toBe('RESTAURANT')
    expect(data.matchedCount).toBe(20)
  })

  it('combines RepairTicket and JobCard counts into a single REPAIR signal', async () => {
    const db = makeDb({ repairTicket: { count: vi.fn().mockResolvedValue(2) }, jobCard: { count: vi.fn().mockResolvedValue(2) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect((res as { data: { businessType: string; matchedCount: number } }).data).toMatchObject({ businessType: 'REPAIR', matchedCount: 4 })
  })

  it('combines ProductVariant and sellByWeight-product counts into a single RETAIL signal', async () => {
    const db = makeDb({
      productVariant: { count: vi.fn().mockResolvedValue(3) },
      product: { count: vi.fn(({ where }: { where: Record<string, unknown> }) => Promise.resolve(where.sellByWeight ? 3 : 0)) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect((res as { data: { businessType: string; matchedCount: number } }).data).toMatchObject({ businessType: 'RETAIL', matchedCount: 6 })
  })

  it('returns an honest error result when the query fails, rather than a false suggestion', async () => {
    const db = makeDb({ businessProfile: { findFirst: vi.fn().mockRejectedValue(new Error('db down')) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getTemplateSuggestion()

    expect(res.success).toBe(false)
  })
})
