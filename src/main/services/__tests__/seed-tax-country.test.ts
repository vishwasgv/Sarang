// The startup seed creates India's CGST/SGST rows only for a business whose country is India (gap row 3.23).
// Before this, every install got them, including Australia, New Zealand, Singapore and Canada.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn(), pruneOldAuditLogs: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { seedDefaultData } from '../../database/seed'

interface Row { taxName: string; taxType: string; rate: number; country?: string | null; isDefault?: boolean; isLegacy?: boolean; isActive?: boolean }

// Any model method answers "nothing found / created"; only the tax table and the business profile are real.
function makeDb(profile: { country: string; taxModel: string } | null) {
  const rows: Row[] = []
  const taxConfiguration = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => rows.find((r) => Object.entries(where).every(([k, v]) => (r as any)[k] === v)) ?? null),
    create: vi.fn(async ({ data }: { data: Row }) => { rows.push({ isLegacy: false, isActive: true, ...data }); return data }),
    updateMany: vi.fn(async () => ({ count: 0 }))
  }
  const model = (name: string) => new Proxy({}, {
    get: (_t, method: string) => {
      if (name === 'taxConfiguration' && method in taxConfiguration) return (taxConfiguration as any)[method]
      if (name === 'businessProfile' && method === 'findFirst') return vi.fn().mockResolvedValue(profile)
      if (method === 'findMany') return vi.fn().mockResolvedValue([])
      if (method === 'count') return vi.fn().mockResolvedValue(0)
      if (method === 'aggregate') return vi.fn().mockResolvedValue({ _sum: {}, _count: 0 })
      if (method === 'updateMany' || method === 'deleteMany' || method === 'createMany') return vi.fn().mockResolvedValue({ count: 0 })
      if (method === 'findUnique' || method === 'findFirst' || method === 'findFirstOrThrow') return vi.fn().mockResolvedValue(null)
      return vi.fn().mockResolvedValue({ id: 'x' })
    }
  })
  const db = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop: string) => {
      if (prop === '$transaction') return async (cb: (t: unknown) => unknown) => (typeof cb === 'function' ? cb(db) : Promise.all(cb as unknown as Promise<unknown>[]))
      if (prop === 'then') return undefined
      return model(prop)
    }
  })
  return { db, rows }
}

const split = (rows: Row[]) => rows.filter((r) => r.taxType === 'CGST' || r.taxType === 'SGST')

beforeEach(() => vi.clearAllMocks())

describe('startup seed and India tax rows', () => {
  it.each(['Australia', 'New Zealand', 'Singapore', 'Canada', 'United Kingdom', 'United States'])('creates no India rows for a %s business', async (country) => {
    const { db, rows } = makeDb({ country, taxModel: 'GST' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await seedDefaultData()
    expect(rows).toHaveLength(0)
  })

  it('creates no India rows before a business exists (fresh install, setup decides)', async () => {
    const { db, rows } = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await seedDefaultData()
    expect(rows).toHaveLength(0)
  })

  it.each(['India', 'IN', 'india'])('creates the CGST/SGST rows and the GST slabs for an India business typed as %s', async (country) => {
    const { db, rows } = makeDb({ country, taxModel: 'GST' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await seedDefaultData()
    expect(split(rows).length).toBeGreaterThan(0)
    expect(rows.filter((r) => r.taxType === 'GST' && r.rate === 18)).toHaveLength(1)
    expect(rows.every((r) => r.country === 'IN')).toBe(true)
  })

  it('is idempotent for India: a second run adds nothing', async () => {
    const { db, rows } = makeDb({ country: 'India', taxModel: 'GST' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await seedDefaultData()
    const count = rows.length
    await seedDefaultData()
    expect(rows).toHaveLength(count)
  })
})
