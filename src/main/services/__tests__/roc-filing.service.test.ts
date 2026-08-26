import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listROCFilings, createROCFiling, updateROCFiling, getComplianceRollup, generateFilingsFromAGM, getComplianceCompletionSummary } from '../roc-filing.service'

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

  // Real bug found live (2026-07-28 service-vertical audit): dueDate/filedOn
  // used to be constructed via a bare `new Date('YYYY-MM-DD')` (UTC
  // midnight), inconsistent with this app's own local-date convention used
  // for overdue comparisons elsewhere.
  it('createROCFiling stores dueDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createROCFiling({ clientId: 'cust-1', formType: 'mgt-7', dueDate: '2026-08-15' })

    expect(res.success).toBe(true)
    const createCall = db.rOCFiling.create.mock.calls[0][0] as { data: { dueDate: Date } }
    expect(createCall.data.dueDate).toEqual(new Date(2026, 7, 15))
  })

  it('updateROCFiling stores filedOn at local midnight, not UTC midnight', async () => {
    const db = makeMockDb(makeFiling())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateROCFiling({ id: 'filing-1', filedOn: '2026-07-02' })

    expect(res.success).toBe(true)
    const updateCall = db.rOCFiling.update.mock.calls[0][0] as { data: { filedOn: Date } }
    expect(updateCall.data.filedOn).toEqual(new Date(2026, 6, 2))
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

  // Real bug found live (2026-08-27 Phase 68 audit): serializeFiling used a
  // plain `.toISOString()` instead of toLocalDateOnlyIso (the fix every
  // sibling service in this family already applies) — a dueDate stored at
  // LOCAL midnight (Date(2026, 7, 15)) shifts to the PREVIOUS calendar day
  // in UTC for any positive-offset timezone, so the renderer's own
  // `.slice(0, 10)` displayed every due/filed date one day early in IST.
  it('listROCFilings returns dueDate/filedOn on the correct LOCAL calendar day, not shifted back a day via UTC', async () => {
    const db = makeMockDb(makeFiling({ dueDate: new Date(2026, 7, 15), filedOn: new Date(2026, 6, 2) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listROCFilings({})

    expect(res.success).toBe(true)
    const row = (res as unknown as { data: Array<{ dueDate: string; filedOn: string }> }).data[0]
    expect(row.dueDate.slice(0, 10)).toBe('2026-08-15')
    expect(row.filedOn.slice(0, 10)).toBe('2026-07-02')
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
    // A real BoardMeeting.meetingDate is stored at LOCAL midnight (via
    // parseLocalDateStart), not UTC midnight — this fixture matches that.
    const agmDate = new Date(2026, 7, 15)
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
    expect(row.agmDate).toBe('2026-08-15T00:00:00.000Z')
  })

  // Real bug found live (2026-08-27 Phase 68 audit): agmDate used to be a
  // raw `agm.meetingDate.toISOString()` — for a real LOCAL-midnight-stored
  // date, that shifts to the PREVIOUS calendar day in UTC for IST, so a
  // renderer's `.slice(0, 10)` displayed the AGM one day early. Fixed to
  // toLocalDateOnlyIso, matching serializeFiling/serializeMeeting's own fix.
  it('agmDate reflects the correct LOCAL calendar day, not shifted back a day via UTC', async () => {
    const db = makeRollupDb({
      filingClientIds: [],
      meetingClientIds: ['cust-1'],
      clients: [{ id: 'cust-1', customerName: 'Alpha Pvt Ltd' }],
      filings: [],
      agmMeetings: [{ clientId: 'cust-1', meetingDate: new Date(2026, 7, 15) }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceRollup('2025-26')

    const row = (res as { data: any[] }).data[0]
    expect((row.agmDate as string).slice(0, 10)).toBe('2026-08-15')
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

// Phase 68 §9.1 — Company Secretary item 1: AGM-to-ROC-filing auto-calendar.

function makeAGMDb(existingFormTypes: string[] = []) {
  const db: Record<string, any> = {
    rOCFiling: {
      findMany: vi.fn().mockResolvedValue(existingFormTypes.map((formType) => ({ formType }))),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeFiling({ id: `filing-${data.formType}`, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('roc-filing.service.generateFilingsFromAGM', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates AOC-4 (due +30d) and MGT-7 (due +60d) filings from the AGM date when neither exists', async () => {
    const db = makeAGMDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateFilingsFromAGM({ clientId: 'cust-1', agmDate: '2026-08-15', financialYear: '2025-26' })

    expect(res.success).toBe(true)
    const created = (res as { data: any[] }).data
    expect(created).toHaveLength(2)
    const aoc4Call = db.rOCFiling.create.mock.calls.find((c: any[]) => c[0].data.formType === 'AOC-4')[0]
    const mgt7Call = db.rOCFiling.create.mock.calls.find((c: any[]) => c[0].data.formType === 'MGT-7')[0]
    expect(aoc4Call.data.dueDate).toEqual(new Date(2026, 8, 14))
    expect(mgt7Call.data.dueDate).toEqual(new Date(2026, 9, 14))
  })

  it('is idempotent — skips a form type that already has a filing row for that client+FY', async () => {
    const db = makeAGMDb(['AOC-4'])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateFilingsFromAGM({ clientId: 'cust-1', agmDate: '2026-08-15', financialYear: '2025-26' })

    expect(res.success).toBe(true)
    expect((res as { data: any[] }).data).toHaveLength(1)
    expect(db.rOCFiling.create).toHaveBeenCalledTimes(1)
    expect(db.rOCFiling.create.mock.calls[0][0].data.formType).toBe('MGT-7')
  })

  it('creates nothing and returns an empty array when both filings already exist', async () => {
    const db = makeAGMDb(['AOC-4', 'MGT-7'])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateFilingsFromAGM({ clientId: 'cust-1', agmDate: '2026-08-15', financialYear: '2025-26' })

    expect(res.success).toBe(true)
    expect((res as { data: any[] }).data).toHaveLength(0)
    expect(db.rOCFiling.create).not.toHaveBeenCalled()
  })
})

// Phase 68 §9.1 — Company Secretary items 4/5: aggregate completion rate +
// per-company health score, both derived from getComplianceRollup's rows.

describe('roc-filing.service.getComplianceCompletionSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes a 100% health score for a company with AGM held and all 3 filings FILED', async () => {
    const db = makeRollupDb({
      filingClientIds: ['cust-1'],
      meetingClientIds: ['cust-1'],
      clients: [{ id: 'cust-1', customerName: 'Alpha Ltd' }],
      filings: [
        { clientId: 'cust-1', formType: 'MGT-7', status: 'FILED' },
        { clientId: 'cust-1', formType: 'AOC-4', status: 'FILED' },
        { clientId: 'cust-1', formType: 'ADT-1', status: 'FILED' },
      ],
      agmMeetings: [{ clientId: 'cust-1', meetingDate: new Date(2026, 7, 15) }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceCompletionSummary('2025-26')

    expect(res.success).toBe(true)
    const data = (res as { data: { rows: any[]; overallCompletionRatePercent: number } }).data
    expect(data.rows[0].healthScorePercent).toBe(100)
    expect(data.overallCompletionRatePercent).toBe(100)
  })

  it('computes a 0% health score for a company with no AGM and no filings done', async () => {
    const db = makeRollupDb({
      filingClientIds: ['cust-1'],
      meetingClientIds: [],
      clients: [{ id: 'cust-1', customerName: 'Alpha Ltd' }],
      filings: [],
      agmMeetings: [],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceCompletionSummary('2025-26')

    const data = (res as { data: { rows: any[]; overallCompletionRatePercent: number } }).data
    expect(data.rows[0].healthScorePercent).toBe(0)
    expect(data.overallCompletionRatePercent).toBe(0)
  })

  it('averages per-company scores into the overall completion rate across multiple companies', async () => {
    const db = makeRollupDb({
      filingClientIds: ['cust-a', 'cust-b'],
      meetingClientIds: ['cust-a'],
      clients: [{ id: 'cust-a', customerName: 'Alpha Ltd' }, { id: 'cust-b', customerName: 'Beta Ltd' }],
      filings: [{ clientId: 'cust-a', formType: 'MGT-7', status: 'FILED' }],
      agmMeetings: [{ clientId: 'cust-a', meetingDate: new Date(2026, 7, 15) }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getComplianceCompletionSummary('2025-26')

    const data = (res as { data: { rows: any[]; overallCompletionRatePercent: number } }).data
    // cust-a: agmHeld + mgt7 FILED = 2/4 = 50%. cust-b: 0/4 = 0%. avg = 25%.
    expect(data.overallCompletionRatePercent).toBe(25)
  })
})
