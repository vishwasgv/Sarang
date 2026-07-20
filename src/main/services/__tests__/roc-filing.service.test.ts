import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listROCFilings, createROCFiling, updateROCFiling, getComplianceRollup } from '../roc-filing.service'

// Regression coverage for the Phase 29 re-audit finding: ROCFiling.govtFee is
// a Prisma Decimal field, returned unserialized by listROCFilings/
// createROCFiling/updateROCFiling. Electron's IPC can't serialize a Decimal
// instance and throws "An object could not be cloned". Live-verified:
// creating a filing with a real govt fee crashed, and the ROC Filings screen
// crashed the entire section on navigation once real data existed (its
// always-visible client filter renders clients.map, and the underlying list
// call itself also threw). A FakeDecimal test double proves serializeFiling
// actually converts govtFee to a plain number.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeFiling(overrides: Record<string, unknown> = {}) {
  return {
    id: 'filing-1', clientId: 'cust-1', staffId: null, formType: 'MGT-7',
    financialYear: '2025-26', purpose: null, dueDate: null, filedOn: null, srn: null,
    status: 'PENDING',
    govtFee: new FakeDecimal(500) as unknown as number,
    notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeFiling> | null = null) {
  const db: Record<string, any> = {
    rOCFiling: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeFiling({ id: 'filing-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeFiling({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('roc-filing.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createROCFiling returns govtFee as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createROCFiling({ clientId: 'cust-1', formType: 'mgt-7', govtFee: 500 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { govtFee: unknown } }).data.govtFee).toBe('number')
  })

  it('createROCFiling normalizes formType to uppercase', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createROCFiling({ clientId: 'cust-1', formType: ' mgt-7 ' })

    expect(db.rOCFiling.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ formType: 'MGT-7' }) })
    )
  })

  it('listROCFilings returns govtFee as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeFiling())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listROCFilings({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ govtFee: unknown }> }).data[0].govtFee).toBe('number')
  })

  it('updateROCFiling returns govtFee as a plain number', async () => {
    const db = makeMockDb(makeFiling())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateROCFiling({ id: 'filing-1', status: 'FILED', filedOn: '2026-07-02', srn: 'X12345' })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { govtFee: unknown } }).data.govtFee).toBe('number')
  })
})

// Phase 58 §2 — Company Secretary: per-company annual-compliance rollup
// (AGM held? MGT-7/AOC-4/ADT-1 filed?) at a glance.

function makeRollupDb(opts: {
  filingClientIds?: string[]
  meetingClientIds?: string[]
  clients?: Array<{ id: string; customerName: string }>
  filings?: Array<{ clientId: string; formType: string; status: string }>
  agmMeetings?: Array<{ clientId: string; meetingDate: Date }>
} = {}) {
  const db: Record<string, any> = {
    rOCFiling: {
      findMany: vi.fn().mockImplementation(({ where, distinct }: { where?: any; distinct?: string[] }) => {
        if (distinct) return Promise.resolve((opts.filingClientIds ?? []).map((clientId) => ({ clientId })))
        return Promise.resolve(opts.filings ?? [])
      }),
    },
    boardMeeting: {
      findMany: vi.fn().mockImplementation(({ where, distinct }: { where?: any; distinct?: string[] }) => {
        if (distinct) return Promise.resolve((opts.meetingClientIds ?? []).map((clientId) => ({ clientId })))
        return Promise.resolve(opts.agmMeetings ?? [])
      }),
    },
    customer: {
      findMany: vi.fn().mockResolvedValue(opts.clients ?? []),
    },
  }
  return db
}

describe('roc-filing.service.getComplianceRollup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty rollup when no client has ever had a ROC filing or board meeting', async () => {
    const db = makeRollupDb({})
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceRollup('2025-26')

    expect(res.success).toBe(true)
    expect((res as { data: unknown[] }).data).toHaveLength(0)
    expect(db.customer.findMany).not.toHaveBeenCalled()
  })

  it('reports NOT_STARTED for a form type with no filing row this FY, and correctly reflects a real one', async () => {
    const db = makeRollupDb({
      filingClientIds: ['cust-1'],
      meetingClientIds: [],
      clients: [{ id: 'cust-1', customerName: 'Alpha Pvt Ltd' }],
      filings: [{ clientId: 'cust-1', formType: 'MGT-7', status: 'FILED' }],
      agmMeetings: [],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceRollup('2025-26')

    expect(res.success).toBe(true)
    const row = (res as { data: any[] }).data[0]
    expect(row.mgt7Status).toBe('FILED')
    expect(row.aoc4Status).toBe('NOT_STARTED')
    expect(row.adt1Status).toBe('NOT_STARTED')
  })

  it('reports agmHeld true with the real meeting date when an AGM board meeting exists in the FY window', async () => {
    const agmDate = new Date('2026-08-15T00:00:00Z')
    const db = makeRollupDb({
      filingClientIds: [],
      meetingClientIds: ['cust-1'],
      clients: [{ id: 'cust-1', customerName: 'Alpha Pvt Ltd' }],
      filings: [],
      agmMeetings: [{ clientId: 'cust-1', meetingDate: agmDate }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceRollup('2025-26')

    expect(res.success).toBe(true)
    const row = (res as { data: any[] }).data[0]
    expect(row.agmHeld).toBe(true)
    expect(row.agmDate).toBe(agmDate.toISOString())
  })

  it('reports agmHeld false when no AGM meeting exists', async () => {
    const db = makeRollupDb({
      filingClientIds: ['cust-1'],
      meetingClientIds: [],
      clients: [{ id: 'cust-1', customerName: 'Alpha Pvt Ltd' }],
      filings: [],
      agmMeetings: [],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceRollup('2025-26')

    expect(res.success).toBe(true)
    expect((res as { data: any[] }).data[0].agmHeld).toBe(false)
  })

  it('rows are sorted by client name', async () => {
    const db = makeRollupDb({
      filingClientIds: ['cust-z', 'cust-a'],
      meetingClientIds: [],
      clients: [{ id: 'cust-z', customerName: 'Zed Ltd' }, { id: 'cust-a', customerName: 'Alpha Ltd' }],
      filings: [],
      agmMeetings: [],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceRollup('2025-26')

    expect((res as { data: any[] }).data.map((r) => r.clientName)).toEqual(['Alpha Ltd', 'Zed Ltd'])
  })
})
