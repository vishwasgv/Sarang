import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import {
  listSeasonalCycles, createSeasonalCycle, updateSeasonalCycle, deleteSeasonalCycle, getSeasonalReorderCalendar
} from '../seasonal-cycle.service'

function makeCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cyc-1', name: 'Monsoon', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30,
    leadTimeDays: 30, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    ...overrides
  }
}

function makeMockDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    seasonalCycle: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  }
  return db
}

describe('seasonal-cycle.service — CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing name on create', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createSeasonalCycle({ name: '', startMonth: 1, startDay: 1, endMonth: 2, endDay: 1 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SEASON-002')
  })

  it('rejects an out-of-range month', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createSeasonalCycle({ name: 'Monsoon', startMonth: 13, startDay: 1, endMonth: 2, endDay: 1 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SEASON-002')
  })

  it('creates a cycle with a default leadTimeDays of 30 when omitted', async () => {
    const db = makeMockDb({ seasonalCycle: { create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(makeCycle(data))) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createSeasonalCycle({ name: 'Monsoon', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 })
    expect(res.success).toBe(true)
    expect(db.seasonalCycle.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadTimeDays: 30 }) }))
  })

  it('rejects updating a cycle that does not exist', async () => {
    const db = makeMockDb({ seasonalCycle: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateSeasonalCycle({ id: 'missing', name: 'Monsoon', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SEASON-005')
  })

  it('soft-deletes a cycle (isActive: false), never hard-deletes', async () => {
    const update = vi.fn().mockResolvedValue({})
    const db = makeMockDb({ seasonalCycle: { findUnique: vi.fn().mockResolvedValue(makeCycle()), update } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteSeasonalCycle('cyc-1')
    expect(res.success).toBe(true)
    expect(update).toHaveBeenCalledWith({ where: { id: 'cyc-1' }, data: { isActive: false } })
  })

  it('lists only active cycles, ordered by name', async () => {
    const findMany = vi.fn().mockResolvedValue([makeCycle()])
    const db = makeMockDb({ seasonalCycle: { findMany } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await listSeasonalCycles()
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { name: 'asc' } })
  })
})

describe('seasonal-cycle.service — getSeasonalReorderCalendar', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('returns an empty result when no cycles are defined', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getSeasonalReorderCalendar()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  it('marks a cycle IN_SEASON when today falls within its window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // July 15 — inside Jun 1 - Sep 30
    const db = makeMockDb({
      seasonalCycle: { findMany: vi.fn().mockResolvedValue([makeCycle()]) },
      product: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar()

    expect(res.data?.[0].status).toBe('IN_SEASON')
    expect(res.data?.[0].daysUntilStart).toBe(0)
  })

  it('marks a cycle REORDER_NOW when today is within the lead-time window before start', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15)) // May 15 — 17 days before Jun 1 start, leadTime=30
    const db = makeMockDb({
      seasonalCycle: { findMany: vi.fn().mockResolvedValue([makeCycle()]) },
      product: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar()

    expect(res.data?.[0].status).toBe('REORDER_NOW')
  })

  it('marks a cycle UPCOMING when today is well before its reorder window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1)) // Jan 1 — far before Jun 1 start
    const db = makeMockDb({
      seasonalCycle: { findMany: vi.fn().mockResolvedValue([makeCycle()]) },
      product: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar()

    expect(res.data?.[0].status).toBe('UPCOMING')
    expect(res.data?.[0].daysUntilStart).toBeGreaterThan(0)
  })

  it('correctly resolves a year-wrapping window (e.g. Nov 15 - Jan 15)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 20)) // Dec 20 — inside Nov 15 - Jan 15 (wraps into 2027)
    const db = makeMockDb({
      seasonalCycle: { findMany: vi.fn().mockResolvedValue([makeCycle({ startMonth: 11, startDay: 15, endMonth: 1, endDay: 15 })]) },
      product: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar()

    expect(res.data?.[0].status).toBe('IN_SEASON')
  })

  it('advances to next year once this year\'s window has fully passed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 1)) // Nov 1 — after Jun-Sep window already passed this year
    const db = makeMockDb({
      seasonalCycle: { findMany: vi.fn().mockResolvedValue([makeCycle()]) },
      product: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar()

    expect(res.data?.[0].status).toBe('UPCOMING')
    expect(res.data?.[0].nextStartDate.startsWith('2027-06-01')).toBe(true)
  })

  it('matches tagged products case-insensitively against Product.season', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15))
    const db = makeMockDb({
      seasonalCycle: { findMany: vi.fn().mockResolvedValue([makeCycle()]) },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', productName: 'Rain Boot', season: 'monsoon', inventory: { quantity: 2 }, variants: [] },
          { id: 'p2', productName: 'Sandal', season: 'Sports', inventory: { quantity: 40 }, variants: [] },
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar()

    expect(res.data?.[0].products).toHaveLength(1)
    expect(res.data?.[0].products[0].productName).toBe('Rain Boot')
  })

  it('sums stock across variants when the product is variant-tracked, falling back to Inventory.quantity otherwise', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15))
    const db = makeMockDb({
      seasonalCycle: { findMany: vi.fn().mockResolvedValue([makeCycle()]) },
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', productName: 'Rain Boot', season: 'Monsoon', inventory: { quantity: 999 }, variants: [{ stockQty: 2 }, { stockQty: 1 }] },
          { id: 'p2', productName: 'Umbrella', season: 'Monsoon', inventory: { quantity: 8 }, variants: [] },
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar(5)

    const boot = res.data?.[0].products.find(p => p.productName === 'Rain Boot')
    const umbrella = res.data?.[0].products.find(p => p.productName === 'Umbrella')
    expect(boot?.stockQty).toBe(3) // variants summed, NOT the stale inventory.quantity
    expect(boot?.lowOrOutOfStock).toBe(true)
    expect(umbrella?.stockQty).toBe(8)
    expect(umbrella?.lowOrOutOfStock).toBe(false)
    expect(res.data?.[0].lowOrOutOfStockCount).toBe(1)
  })

  it('sorts entries with REORDER_NOW first, then IN_SEASON, then UPCOMING', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // July 15
    const db = makeMockDb({
      seasonalCycle: {
        findMany: vi.fn().mockResolvedValue([
          makeCycle({ id: 'c-upcoming', name: 'Winter', startMonth: 12, startDay: 1, endMonth: 12, endDay: 31, leadTimeDays: 10 }),
          makeCycle({ id: 'c-inseason', name: 'Monsoon', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30 }),
          makeCycle({ id: 'c-reordernow', name: 'Sports', startMonth: 8, startDay: 1, endMonth: 10, endDay: 31, leadTimeDays: 45 }),
        ])
      },
      product: { findMany: vi.fn().mockResolvedValue([]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSeasonalReorderCalendar()

    expect(res.data?.map(e => e.id)).toEqual(['c-reordernow', 'c-inseason', 'c-upcoming'])
  })
})
