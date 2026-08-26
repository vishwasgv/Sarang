import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import {
  upsertChronicCondition,
  listChronicConditions,
  getChronicRecallDashboardCounts,
  generateChronicRecallComplianceReport,
} from '../chronic-condition-record.service'

// Phase 67 §9.1 item 19 — GP Clinic chronic-condition recall. Coverage
// focuses on the one real design decision this service makes that
// RecallRecord (Dental) doesn't have to: snapshotting each recall period's
// on-time/late outcome into ChronicRecallComplianceLog BEFORE the record is
// overwritten by the next upsert, since the live record has no history of
// its own past state.

function makeDb(overrides: Record<string, any> = {}) {
  const complianceLogs: Record<string, unknown>[] = []
  const records = new Map<string, Record<string, unknown>>()
  let idCounter = 0

  const tx = {
    chronicConditionRecord: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(records.get(where.id) ?? null)),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const id = `ccr-${++idCounter}`
        const record = { id, isActive: true, ...data }
        records.set(id, record)
        return Promise.resolve(record)
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = records.get(where.id)!
        const updated = { ...existing, ...data }
        records.set(where.id, updated)
        return Promise.resolve(updated)
      }),
    },
    chronicRecallComplianceLog: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        complianceLogs.push(data)
        return Promise.resolve({ id: `log-${complianceLogs.length}`, ...data })
      }),
    },
  }

  const db: Record<string, any> = {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    chronicConditionRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    chronicRecallComplianceLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  }
  return { db, tx, records, complianceLogs }
}

describe('chronic-condition-record.service — upsert + compliance snapshot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new record with no compliance log entry (nothing to compare against on first tag)', async () => {
    const { db, tx, complianceLogs } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertChronicCondition({
      patientId: 'cust-1',
      conditionName: 'Diabetes',
      lastVisitDate: '2026-08-01',
      nextRecallDate: '2026-11-01',
    })

    expect(res.success).toBe(true)
    expect(tx.chronicConditionRecord.create).toHaveBeenCalledTimes(1)
    expect(tx.chronicRecallComplianceLog.create).not.toHaveBeenCalled()
    expect(complianceLogs).toHaveLength(0)
  })

  it('logs onTime=true when the follow-up visit happens on or before the scheduled recall date', async () => {
    const { db, tx, records } = makeDb()
    records.set('ccr-1', {
      id: 'ccr-1', patientId: 'cust-1', conditionName: 'Diabetes',
      lastVisitDate: new Date('2026-08-01'), nextRecallDate: new Date('2026-11-01'), isActive: true,
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertChronicCondition({
      id: 'ccr-1',
      patientId: 'cust-1',
      conditionName: 'Diabetes',
      lastVisitDate: '2026-10-28', // before the Nov 1 recall date that was due
      nextRecallDate: '2027-01-28',
    })

    expect(res.success).toBe(true)
    expect(tx.chronicRecallComplianceLog.create).toHaveBeenCalledTimes(1)
    const logged = tx.chronicRecallComplianceLog.create.mock.calls[0][0].data
    expect(logged.onTime).toBe(true)
    expect(logged.scheduledDate).toEqual(new Date('2026-11-01'))
  })

  it('logs onTime=false when the follow-up visit happens after the scheduled recall date', async () => {
    const { db, tx, records } = makeDb()
    records.set('ccr-1', {
      id: 'ccr-1', patientId: 'cust-1', conditionName: 'Hypertension',
      lastVisitDate: new Date('2026-05-01'), nextRecallDate: new Date('2026-08-01'), isActive: true,
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertChronicCondition({
      id: 'ccr-1',
      patientId: 'cust-1',
      conditionName: 'Hypertension',
      lastVisitDate: '2026-08-15', // 14 days late
      nextRecallDate: '2026-11-15',
    })

    expect(res.success).toBe(true)
    const logged = tx.chronicRecallComplianceLog.create.mock.calls[0][0].data
    expect(logged.onTime).toBe(false)
  })
})

describe('chronic-condition-record.service — listing and dashboard counts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults to active-only records', async () => {
    const { db } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listChronicConditions()

    expect(db.chronicConditionRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    )
  })

  it('dashboard counts reflect overdue vs. due-this-week vs. compliance separately', async () => {
    const { db } = makeDb({
      chronicConditionRecord: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn()
          .mockResolvedValueOnce(3) // overdueCount
          .mockResolvedValueOnce(2), // dueThisWeek
      },
      chronicRecallComplianceLog: {
        findMany: vi.fn().mockResolvedValue([{ onTime: true }, { onTime: true }, { onTime: false }, { onTime: true }]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getChronicRecallDashboardCounts()

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ overdueCount: 3, dueThisWeek: 2, compliancePercent: 75 })
  })

  it('reports compliancePercent as null (not 0) when there is no history yet', async () => {
    const { db } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getChronicRecallDashboardCounts()

    expect(res.success).toBe(true)
    expect(res.data?.compliancePercent).toBeNull()
  })
})

describe('chronic-condition-record.service — compliance report', () => {
  beforeEach(() => vi.clearAllMocks())

  it('breaks down on-time percent per condition, not just an overall blend', async () => {
    const { db } = makeDb({
      chronicRecallComplianceLog: {
        findMany: vi.fn().mockResolvedValue([
          { onTime: true, record: { conditionName: 'Diabetes' } },
          { onTime: true, record: { conditionName: 'Diabetes' } },
          { onTime: false, record: { conditionName: 'Diabetes' } },
          { onTime: false, record: { conditionName: 'Hypertension' } },
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateChronicRecallComplianceReport()

    expect(res.success).toBe(true)
    expect(res.data?.totalRecallsClosed).toBe(4)
    expect(res.data?.overallPercent).toBe(50)
    const diabetes = res.data?.byCondition.find((c) => c.conditionName === 'Diabetes')
    const hypertension = res.data?.byCondition.find((c) => c.conditionName === 'Hypertension')
    expect(diabetes).toEqual({ conditionName: 'Diabetes', total: 3, onTime: 2, percent: 67 })
    expect(hypertension).toEqual({ conditionName: 'Hypertension', total: 1, onTime: 0, percent: 0 })
  })

  it('reports overallPercent as null when no recall periods have closed yet', async () => {
    const { db } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateChronicRecallComplianceReport()

    expect(res.success).toBe(true)
    expect(res.data?.totalRecallsClosed).toBe(0)
    expect(res.data?.overallPercent).toBeNull()
    expect(res.data?.byCondition).toEqual([])
  })

  it('respects an explicit dateFrom/dateTo range (the Reports screen path), not just the trailing-months default', async () => {
    const { db } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await generateChronicRecallComplianceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const callArgs = db.chronicRecallComplianceLog.findMany.mock.calls[0][0]
    // Local midnight, not new Date('2026-01-01') (UTC midnight) — a
    // date-only ISO string parses as UTC, which is the wrong calendar day
    // in any positive-UTC-offset timezone (this app's primary market is
    // IST). See parseLocalDateStart in utils/date.util.ts.
    expect(callArgs.where.scheduledDate.gte).toEqual(new Date(2026, 0, 1))
    expect(callArgs.where.scheduledDate.lte).toEqual(new Date('2026-01-31T23:59:59.999'))
  })

  it('uses LOCAL midnight (not UTC midnight) as the range start, so a record scheduled early on dateFrom in a positive-UTC-offset timezone is not silently excluded', async () => {
    const { db } = makeDb({
      chronicRecallComplianceLog: {
        findMany: vi.fn().mockResolvedValue([
          { onTime: true, record: { conditionName: 'Diabetes' } },
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await generateChronicRecallComplianceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const callArgs = db.chronicRecallComplianceLog.findMany.mock.calls[0][0]
    const gte: Date = callArgs.where.scheduledDate.gte
    expect(gte.getFullYear()).toBe(2026)
    expect(gte.getMonth()).toBe(0)
    expect(gte.getDate()).toBe(1)
    expect(gte.getHours()).toBe(0)
    expect(gte.getMinutes()).toBe(0)
  })
})
