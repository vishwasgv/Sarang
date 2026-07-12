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
