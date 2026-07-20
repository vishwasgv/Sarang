import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listProviderSkillsForEmployee, setProviderSkills, listQualifiedProviders } from '../service-provider-skill.service'

// Phase 58 §2 — Beauty Salon: stylist skill-matching, replacing any-staff-
// any-service. A service with ZERO configured skill rows means "any
// provider can perform it" — that fallback is the CALLER's (the booking
// form's) responsibility, not this service's; these tests only cover the
// CRUD/query surface itself.

function makeMockDb() {
  const rows: Array<{ id: string; employeeId: string; serviceCatalogId: string }> = []
  let seq = 0
  const db: Record<string, any> = {
    employee: {
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(id === 'emp-missing' ? null : { id })
      ),
    },
    serviceProviderSkill: {
      findMany: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.filter((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)))
      ),
      deleteMany: vi.fn().mockImplementation(({ where }: { where: { employeeId: string } }) => {
        const before = rows.length
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].employeeId === where.employeeId) rows.splice(i, 1)
        }
        return Promise.resolve({ count: before - rows.length })
      }),
      createMany: vi.fn().mockImplementation(({ data }: { data: Array<{ employeeId: string; serviceCatalogId: string }> }) => {
        for (const d of data) rows.push({ id: `sps-${++seq}`, ...d })
        return Promise.resolve({ count: data.length })
      }),
    },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return { db, rows }
}

describe('service-provider-skill.service — setProviderSkills', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces the full skill set on save (delete-then-recreate)', async () => {
    const { db, rows } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await setProviderSkills('emp-1', ['svc-haircut', 'svc-color'])
    const res = await setProviderSkills('emp-1', ['svc-color']) // second save drops haircut

    expect(res.success).toBe(true)
    expect(rows.filter((r) => r.employeeId === 'emp-1').map((r) => r.serviceCatalogId)).toEqual(['svc-color'])
  })

  it('runs the delete and recreate inside the same transaction', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await setProviderSkills('emp-1', ['svc-haircut'])

    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })

  it('saving an empty list clears all skills without calling createMany', async () => {
    const { db, rows } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await setProviderSkills('emp-1', ['svc-haircut'])
    await setProviderSkills('emp-1', [])

    expect(rows.filter((r) => r.employeeId === 'emp-1')).toHaveLength(0)
    expect(db.serviceProviderSkill.createMany).toHaveBeenCalledTimes(1) // only the first save
  })

  it('returns not-found for a nonexistent employee', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await setProviderSkills('emp-missing', ['svc-haircut'])

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPS-002')
  })

  it('does not leak one employee\'s skills into another\'s deleteMany scope', async () => {
    const { db, rows } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await setProviderSkills('emp-1', ['svc-haircut'])
    await setProviderSkills('emp-2', ['svc-color'])

    expect(rows.filter((r) => r.employeeId === 'emp-1').map((r) => r.serviceCatalogId)).toEqual(['svc-haircut'])
    expect(rows.filter((r) => r.employeeId === 'emp-2').map((r) => r.serviceCatalogId)).toEqual(['svc-color'])
  })
})

describe('service-provider-skill.service — listProviderSkillsForEmployee / listQualifiedProviders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the serviceCatalogIds an employee is qualified for', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await setProviderSkills('emp-1', ['svc-haircut', 'svc-color'])

    const res = await listProviderSkillsForEmployee('emp-1')

    expect(res.success).toBe(true)
    expect(res.data).toEqual(['svc-haircut', 'svc-color'])
  })

  it('lists which employees are qualified for a given service', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await setProviderSkills('emp-1', ['svc-haircut'])
    await setProviderSkills('emp-2', ['svc-haircut', 'svc-color'])
    await setProviderSkills('emp-3', ['svc-color'])

    const res = await listQualifiedProviders('svc-haircut')

    expect(res.success).toBe(true)
    expect((res.data as string[]).sort()).toEqual(['emp-1', 'emp-2'])
  })

  it('returns an empty list for a service nobody has been configured for (caller treats this as "any provider")', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listQualifiedProviders('svc-never-configured')

    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })
})
