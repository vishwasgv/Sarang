import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue(null) }))

import { getPrisma } from '../../database/db'
import { upsertRecall, generateDentalRecallComplianceReport } from '../recall-record.service'

// Phase 67 §9.1 item 21.4 — Dental Clinic Recall Compliance. Coverage
// mirrors chronic-condition-record.service.test.ts's own pattern exactly:
// the one real design decision this service makes is snapshotting each
// recall period's on-time/late outcome into RecallComplianceLog BEFORE
// RecallRecord (patientId @unique — one row per patient) is overwritten by
// the next upsert, since the live record has no history of its own.

function makeDb(overrides: Record<string, any> = {}) {
  const complianceLogs: Record<string, unknown>[] = []
  let recallRecord: Record<string, unknown> | null = null

  const tx = {
    recallRecord: {
      findUnique: vi.fn(() => Promise.resolve(recallRecord)),
      upsert: vi.fn(({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        recallRecord = recallRecord ? { ...recallRecord, ...update } : { id: 'rr-1', ...create }
        return Promise.resolve(recallRecord)
      }),
    },
    recallComplianceLog: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        complianceLogs.push(data)
        return Promise.resolve({ id: `log-${complianceLogs.length}`, ...data })
      }),
    },
  }

  const db: Record<string, any> = {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    notificationQueue: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
    customer: { findUnique: vi.fn().mockResolvedValue({ customerName: 'Test Patient', phone: null }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    recallComplianceLog: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  }
  return { db, tx, complianceLogs, setExisting: (r: Record<string, unknown>) => { recallRecord = r } }
}

describe('recall-record.service — upsertRecall + compliance snapshot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a new record with no compliance log entry (nothing to compare against on first recall)', async () => {
    const { db, tx, complianceLogs } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertRecall({
      patientId: 'cust-1', recallType: 'HYGIENE_6M',
      lastVisitDate: '2026-08-01', nextRecallDate: '2027-02-01',
    })

    expect(res.success).toBe(true)
    expect(tx.recallComplianceLog.create).not.toHaveBeenCalled()
    expect(complianceLogs).toHaveLength(0)
  })

  it('logs onTime=true when the patient returns on or before the previously-scheduled recall date', async () => {
    const { db, tx, setExisting } = makeDb()
    setExisting({
      id: 'rr-1', patientId: 'cust-1', recallType: 'HYGIENE_6M',
      lastVisitDate: new Date('2026-02-01'), nextRecallDate: new Date('2026-08-01'),
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertRecall({
      patientId: 'cust-1', recallType: 'HYGIENE_6M',
      lastVisitDate: '2026-07-28', // before the Aug 1 recall date that was due
      nextRecallDate: '2027-01-28',
    })

    expect(res.success).toBe(true)
    expect(tx.recallComplianceLog.create).toHaveBeenCalledTimes(1)
    const logged = tx.recallComplianceLog.create.mock.calls[0][0].data
    expect(logged.onTime).toBe(true)
    expect(logged.scheduledDate).toEqual(new Date('2026-08-01'))
    expect(logged.recordId).toBe('rr-1')
  })

  it('logs onTime=false when the patient returns after the previously-scheduled recall date', async () => {
    const { db, tx, setExisting } = makeDb()
    setExisting({
      id: 'rr-1', patientId: 'cust-1', recallType: 'HYGIENE_6M',
      lastVisitDate: new Date('2026-01-01'), nextRecallDate: new Date('2026-07-01'),
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertRecall({
      patientId: 'cust-1', recallType: 'HYGIENE_6M',
      lastVisitDate: '2026-07-20', // 19 days late
      nextRecallDate: '2027-01-20',
    })

    expect(res.success).toBe(true)
    const logged = tx.recallComplianceLog.create.mock.calls[0][0].data
    expect(logged.onTime).toBe(false)
  })
})

describe('recall-record.service — generateDentalRecallComplianceReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('breaks down on-time percent per recall type, not just an overall blend', async () => {
    const { db } = makeDb({
      recallComplianceLog: {
        findMany: vi.fn().mockResolvedValue([
          { onTime: true, record: { recallType: 'HYGIENE_6M' } },
          { onTime: true, record: { recallType: 'HYGIENE_6M' } },
          { onTime: false, record: { recallType: 'HYGIENE_6M' } },
          { onTime: false, record: { recallType: 'CROWN_REVIEW' } },
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDentalRecallComplianceReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(res.success).toBe(true)
    expect(res.data?.totalRecallsClosed).toBe(4)
    expect(res.data?.overallPercent).toBe(50)
    const hygiene = res.data?.byRecallType.find((r) => r.recallType === 'HYGIENE_6M')
    const crown = res.data?.byRecallType.find((r) => r.recallType === 'CROWN_REVIEW')
    expect(hygiene).toEqual({ recallType: 'HYGIENE_6M', total: 3, onTime: 2, percent: 67 })
    expect(crown).toEqual({ recallType: 'CROWN_REVIEW', total: 1, onTime: 0, percent: 0 })
  })

  it('reports overallPercent as null (not 0) when no recall periods have closed yet', async () => {
    const { db } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDentalRecallComplianceReport({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })

    expect(res.success).toBe(true)
    expect(res.data?.totalRecallsClosed).toBe(0)
    expect(res.data?.overallPercent).toBeNull()
    expect(res.data?.byRecallType).toEqual([])
  })

  it('respects the explicit dateFrom/dateTo range', async () => {
    const { db } = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await generateDentalRecallComplianceReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const callArgs = db.recallComplianceLog.findMany.mock.calls[0][0]
    expect(callArgs.where.scheduledDate.gte).toEqual(new Date('2026-01-01'))
    expect(callArgs.where.scheduledDate.lte).toEqual(new Date('2026-01-31T23:59:59.999'))
  })
})
