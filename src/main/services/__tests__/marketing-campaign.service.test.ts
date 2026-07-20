import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import {
  listCampaignPerformanceEntries, addCampaignPerformanceEntry, updateCampaignPerformanceEntry, deleteCampaignPerformanceEntry,
  getCampaignPerformanceSummary,
  listContentCalendarItems, createContentCalendarItem, updateContentCalendarItem, deleteContentCalendarItem,
} from '../marketing-campaign.service'

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cpe-1', projectId: 'proj-1', periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-07'),
    impressions: 10000, clicks: 500, conversions: 25, actualSpend: 5000,
    notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeContentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cci-1', projectId: 'proj-1', scheduledDate: new Date('2026-08-01'), contentType: 'SOCIAL_POST',
    title: 'Diwali offer post', platform: 'Instagram', status: 'PLANNED', notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(entries: ReturnType<typeof makeEntry>[] = [makeEntry()], contentItems: ReturnType<typeof makeContentItem>[] = [makeContentItem()]) {
  const db: Record<string, any> = {
    serviceProject: { findUnique: vi.fn().mockResolvedValue({ id: 'proj-1' }) },
    campaignPerformanceEntry: {
      findMany: vi.fn().mockResolvedValue(entries),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeEntry({ id: 'cpe-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeEntry({ ...entries[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    contentCalendarItem: {
      findMany: vi.fn().mockResolvedValue(contentItems),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeContentItem({ id: 'cci-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeContentItem({ ...contentItems[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
  return db
}

describe('marketing-campaign.service — campaign performance entries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists performance entries with actualSpend serialized to a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listCampaignPerformanceEntries('proj-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ actualSpend: unknown }> }).data[0].actualSpend).toBe('number')
  })

  it('rejects a missing period start/end', async () => {
    const res = await addCampaignPerformanceEntry({ projectId: 'proj-1', periodStart: '', periodEnd: '' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CPE-002')
  })

  it('rejects periodEnd before periodStart', async () => {
    const res = await addCampaignPerformanceEntry({ projectId: 'proj-1', periodStart: '2026-07-10', periodEnd: '2026-07-01' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CPE-003')
  })

  it('rejects a missing campaign (project)', async () => {
    const db = makeMockDb()
    db.serviceProject.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addCampaignPerformanceEntry({ projectId: 'missing', periodStart: '2026-07-01', periodEnd: '2026-07-07' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CPE-004')
  })

  it('creates an entry with real logged numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addCampaignPerformanceEntry({ projectId: 'proj-1', periodStart: '2026-07-01', periodEnd: '2026-07-07', impressions: 10000, clicks: 500, conversions: 25, actualSpend: 5000 })

    expect(res.success).toBe(true)
    expect(db.campaignPerformanceEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ impressions: 10000, clicks: 500, conversions: 25, actualSpend: 5000 }),
    }))
  })

  it('deletes an entry', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteCampaignPerformanceEntry('cpe-1')
    expect(res.success).toBe(true)
  })

  it('updateCampaignPerformanceEntry returns actualSpend as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateCampaignPerformanceEntry({ id: 'cpe-1', clicks: 600 })
    expect(res.success).toBe(true)
    expect(typeof (res as { data: { actualSpend: unknown } }).data.actualSpend).toBe('number')
  })
})

describe('marketing-campaign.service.getCampaignPerformanceSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sums totals across all entries and computes CTR/conversion-rate/cost-per-conversion', async () => {
    const db = makeMockDb([
      makeEntry({ impressions: 10000, clicks: 500, conversions: 25, actualSpend: 5000 }),
      makeEntry({ id: 'cpe-2', impressions: 20000, clicks: 1000, conversions: 50, actualSpend: 10000 }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCampaignPerformanceSummary('proj-1')

    expect(res.success).toBe(true)
    const data = (res as { data: any }).data
    expect(data.totalImpressions).toBe(30000)
    expect(data.totalClicks).toBe(1500)
    expect(data.totalConversions).toBe(75)
    expect(data.totalActualSpend).toBe(15000)
    // CTR = 1500/30000 * 100 = 5%
    expect(data.ctrPercent).toBeCloseTo(5)
    // conversion rate = 75/1500 * 100 = 5%
    expect(data.conversionRatePercent).toBeCloseTo(5)
    // cost per conversion = 15000/75 = 200
    expect(data.costPerConversion).toBeCloseTo(200)
  })

  it('never divides by zero — leaves rates null when the denominator has no real logged data', async () => {
    const db = makeMockDb([makeEntry({ impressions: null, clicks: null, conversions: null, actualSpend: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCampaignPerformanceSummary('proj-1')

    expect(res.success).toBe(true)
    const data = (res as { data: any }).data
    expect(data.ctrPercent).toBeNull()
    expect(data.conversionRatePercent).toBeNull()
    expect(data.costPerConversion).toBeNull()
  })

  it('returns zeroed totals for a campaign with no entries yet', async () => {
    const db = makeMockDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCampaignPerformanceSummary('proj-1')

    expect(res.success).toBe(true)
    const data = (res as { data: any }).data
    expect(data.entryCount).toBe(0)
    expect(data.totalImpressions).toBe(0)
  })
})

describe('marketing-campaign.service — content calendar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a blank title', async () => {
    const res = await createContentCalendarItem({ projectId: 'proj-1', scheduledDate: '2026-08-01', title: '  ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CCI-002')
  })

  it('rejects a missing scheduled date', async () => {
    const res = await createContentCalendarItem({ projectId: 'proj-1', scheduledDate: '', title: 'Diwali offer post' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CCI-003')
  })

  it('rejects a missing campaign (project)', async () => {
    const db = makeMockDb()
    db.serviceProject.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createContentCalendarItem({ projectId: 'missing', scheduledDate: '2026-08-01', title: 'Post' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CCI-004')
  })

  it('creates a content item defaulting to PLANNED status', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createContentCalendarItem({ projectId: 'proj-1', scheduledDate: '2026-08-01', title: 'Diwali offer post', platform: 'Instagram' })

    expect(res.success).toBe(true)
    expect(db.contentCalendarItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'Diwali offer post', platform: 'Instagram', status: 'PLANNED' }),
    }))
  })

  it('lists content items for a project', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listContentCalendarItems('proj-1')
    expect(res.success).toBe(true)
  })

  it('updates status (e.g. to PUBLISHED)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateContentCalendarItem({ id: 'cci-1', status: 'PUBLISHED' })
    expect(res.success).toBe(true)
    expect(db.contentCalendarItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED' }) }))
  })

  it('deletes a content item', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteContentCalendarItem('cci-1')
    expect(res.success).toBe(true)
  })
})
