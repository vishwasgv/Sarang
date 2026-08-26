import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import {
  listCropSeasons, createCropSeason, updateCropSeason, deleteCropSeason,
  resolveNextHarvestDate, resolveCropSeasonDueDate
} from '../crop-season.service'

function makeSeason(overrides: Record<string, unknown> = {}) {
  return { id: 'crop-1', name: 'Wheat Harvest', harvestMonth: 4, harvestDay: 15, isActive: true, ...overrides }
}

function makeMockDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    cropSeason: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    ...overrides
  }
  return db
}

describe('crop-season.service — CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing name on create', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createCropSeason({ name: '', harvestMonth: 4, harvestDay: 15 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CROP-002')
  })

  it('rejects an out-of-range harvest month', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createCropSeason({ name: 'Wheat', harvestMonth: 13, harvestDay: 1 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CROP-002')
  })

  it('rejects an out-of-range harvest day', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createCropSeason({ name: 'Wheat', harvestMonth: 4, harvestDay: 32 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CROP-002')
  })

  it('creates a crop season with a trimmed name', async () => {
    const create = vi.fn().mockImplementation(({ data }: any) => Promise.resolve(makeSeason(data)))
    const db = makeMockDb({ cropSeason: { create } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createCropSeason({ name: '  Wheat Harvest  ', harvestMonth: 4, harvestDay: 15 })
    expect(res.success).toBe(true)
    expect(create).toHaveBeenCalledWith({ data: { name: 'Wheat Harvest', harvestMonth: 4, harvestDay: 15 } })
  })

  it('rejects updating a crop season that does not exist', async () => {
    const db = makeMockDb({ cropSeason: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateCropSeason({ id: 'missing', name: 'Wheat', harvestMonth: 4, harvestDay: 15 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CROP-005')
  })

  it('soft-deletes a crop season (isActive: false), never hard-deletes', async () => {
    const update = vi.fn().mockResolvedValue({})
    const db = makeMockDb({ cropSeason: { findUnique: vi.fn().mockResolvedValue(makeSeason()), update } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteCropSeason('crop-1')
    expect(res.success).toBe(true)
    expect(update).toHaveBeenCalledWith({ where: { id: 'crop-1' }, data: { isActive: false } })
  })

  it('rejects deleting a crop season that does not exist', async () => {
    const db = makeMockDb({ cropSeason: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteCropSeason('missing')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CROP-007')
  })

  it('lists only active crop seasons, ordered by name', async () => {
    const findMany = vi.fn().mockResolvedValue([makeSeason()])
    const db = makeMockDb({ cropSeason: { findMany } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await listCropSeasons()
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { name: 'asc' } })
  })
})

describe('crop-season.service — resolveNextHarvestDate', () => {
  it('returns this year\'s occurrence when it has not yet passed', () => {
    const today = new Date(2026, 2, 1) // Mar 1
    const result = resolveNextHarvestDate({ harvestMonth: 4, harvestDay: 15 }, today)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(3)
    expect(result.getDate()).toBe(15)
  })

  it('rolls over to next year once this year\'s occurrence has already passed', () => {
    const today = new Date(2026, 5, 1) // Jun 1 — after Apr 15
    const result = resolveNextHarvestDate({ harvestMonth: 4, harvestDay: 15 }, today)
    expect(result.getFullYear()).toBe(2027)
    expect(result.getMonth()).toBe(3)
    expect(result.getDate()).toBe(15)
  })

  it('treats today itself, matching the harvest date, as still upcoming (not yet passed)', () => {
    const today = new Date(2026, 3, 15) // exactly Apr 15
    const result = resolveNextHarvestDate({ harvestMonth: 4, harvestDay: 15 }, today)
    expect(result.getFullYear()).toBe(2026)
  })
})

describe('crop-season.service — resolveCropSeasonDueDate', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('errors when the crop season does not exist', async () => {
    const db = makeMockDb({ cropSeason: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await resolveCropSeasonDueDate('missing')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CROP-009')
  })

  it('resolves a due date string from the linked season\'s next harvest occurrence', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 1)) // Mar 1
    const db = makeMockDb({ cropSeason: { findUnique: vi.fn().mockResolvedValue(makeSeason()) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await resolveCropSeasonDueDate('crop-1')
    expect(res.success).toBe(true)
    expect(res.data?.dueDate.startsWith('2026-04-15')).toBe(true)
  })
})
