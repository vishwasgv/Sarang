import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listMetalRates, getMetalRate, upsertMetalRate, deleteMetalRate } from '../metal-rate.service'

function makeMockDb() {
  const db: Record<string, any> = {
    metalRate: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve({ id: 'mr-1', ...create })
      ),
      delete: vi.fn().mockResolvedValue({}),
    },
    // Phase 67 §9.1 — Jewellery item 4's own prerequisite.
    metalRateHistory: {
      create: vi.fn().mockResolvedValue({}),
    },
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('metal-rate.service', () => {
  it('lists rates ordered by metalType/purity', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listMetalRates()

    expect(res.success).toBe(true)
    expect(db.metalRate.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ metalType: 'asc' }, { purity: 'asc' }] }))
  })

  it('upserts a rate keyed by metalType+purity', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertMetalRate({ metalType: 'GOLD', purity: '22K', ratePerGram: 6500 })

    expect(res.success).toBe(true)
    expect(db.metalRate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { metalType_purity: { metalType: 'GOLD', purity: '22K' } },
    }))
  })

  // Phase 67 §9.1 — Jewellery item 4's own prerequisite: MetalRate itself
  // only ever holds today's rate (upsert overwrites in place) — every real
  // change must also append to MetalRateHistory, or the rate-vs-sales trend
  // report would have nothing to correlate against going forward.
  it('appends every real rate change to MetalRateHistory', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertMetalRate({ metalType: 'GOLD', purity: '22K', ratePerGram: 6500 })

    expect(db.metalRateHistory.create).toHaveBeenCalledWith({ data: { metalType: 'GOLD', purity: '22K', ratePerGram: 6500 } })
  })

  it('rejects a zero or negative rate', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertMetalRate({ metalType: 'GOLD', purity: '22K', ratePerGram: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MR-002')
    expect(db.metalRate.upsert).not.toHaveBeenCalled()
  })

  it('gets a rate by metalType+purity', async () => {
    const db = makeMockDb()
    db.metalRate.findUnique = vi.fn().mockResolvedValue({ id: 'mr-1', metalType: 'SILVER', purity: '999', ratePerGram: 85 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getMetalRate('SILVER', '999')

    expect(res.success).toBe(true)
    expect((res as { data: { ratePerGram: number } }).data.ratePerGram).toBe(85)
  })

  it('deletes a rate', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteMetalRate('mr-1')

    expect(res.success).toBe(true)
    expect(db.metalRate.delete).toHaveBeenCalledWith({ where: { id: 'mr-1' } })
  })
})
