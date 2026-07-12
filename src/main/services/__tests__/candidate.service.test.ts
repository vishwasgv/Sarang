import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listCandidates, getCandidate, createCandidate, updateCandidate } from '../candidate.service'

// Regression coverage for the Phase 34 re-audit finding: Candidate.
// totalExperience/expectedSalary/currentSalary are Prisma Decimal fields,
// returned unserialized by every function below. Electron's IPC can't
// serialize a Decimal instance and throws "An object could not be cloned".
// Live-verified: candidate.create with totalExperience=5.5 crashed (row
// silently written to the DB anyway). A FakeDecimal test double
// (toString/valueOf only, like a real Decimal.js instance) proves
// serializeCandidate actually converts all three fields to plain numbers.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cnd-1', candidateNumber: 'CND-00001', fullName: 'Ravi Shankar',
    email: null, phone: null, currentJobTitle: null, currentEmployer: null,
    totalExperience: new FakeDecimal(5.5) as unknown as number,
    skills: '[]', preferredLocations: '[]', educationSummary: null, resumeNotes: null,
    expectedSalary: new FakeDecimal(1200000) as unknown as number,
    currentSalary: new FakeDecimal(900000) as unknown as number,
    availableFrom: null, status: 'ACTIVE', source: 'WALKIN', notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeCandidate> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    candidate: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCandidate({ id: 'cnd-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCandidate({ ...existing, ...data }))
      ),
    },
    placement: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      updateMany: vi.fn(async ({ where, data }: { where: { settingValue: string }; data: { settingValue: string } }) => {
        if (!settingRow || settingRow.settingValue !== where.settingValue) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }
        return settingRow
      }),
    },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('candidate.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createCandidate returns totalExperience/expectedSalary/currentSalary as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCandidate({ fullName: 'Ravi Shankar', totalExperience: 5.5, expectedSalary: 1200000, currentSalary: 900000 })

    expect(res.success).toBe(true)
    const data = (res as { data: { totalExperience: unknown; expectedSalary: unknown; currentSalary: unknown } }).data
    expect(typeof data.totalExperience).toBe('number')
    expect(typeof data.expectedSalary).toBe('number')
    expect(typeof data.currentSalary).toBe('number')
  })

  it('listCandidates returns totalExperience as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeCandidate())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listCandidates({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ totalExperience: unknown }> }).data[0].totalExperience).toBe('number')
  })

  it('getCandidate returns expectedSalary as a plain number', async () => {
    const db = makeMockDb(makeCandidate())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCandidate('cnd-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { expectedSalary: unknown } }).data.expectedSalary).toBe('number')
  })

  it('updateCandidate returns currentSalary as a plain number', async () => {
    const db = makeMockDb(makeCandidate())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateCandidate({ id: 'cnd-1', currentSalary: 950000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { currentSalary: unknown } }).data.currentSalary).toBe('number')
  })

  it('getCandidate handles null totalExperience/expectedSalary/currentSalary without throwing', async () => {
    const db = makeMockDb(makeCandidate({ totalExperience: null, expectedSalary: null, currentSalary: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCandidate('cnd-1')

    expect(res.success).toBe(true)
    const data = (res as { data: { totalExperience: unknown; expectedSalary: unknown; currentSalary: unknown } }).data
    expect(data.totalExperience).toBeNull()
    expect(data.expectedSalary).toBeNull()
    expect(data.currentSalary).toBeNull()
  })
})
