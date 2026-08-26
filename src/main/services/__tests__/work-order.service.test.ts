import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { updateWorkOrderStatus, upsertWorkOrders, logDowntime, listDowntimeEntries, getDowntimeSummary, getWorkOrderBottleneckFlag } from '../work-order.service'

function makeMockDb(step: { id: string; isQcStep: boolean; taskName?: string; qcResult?: string | null }) {
  const db: Record<string, any> = {
    workOrder: {
      findUnique: vi.fn().mockResolvedValue({ id: step.id, isQcStep: step.isQcStep, taskName: step.taskName ?? 'Inspect batch', qcResult: step.qcResult ?? null }),
      update: vi.fn().mockResolvedValue({}),
    },
  }
  return db
}

describe('work-order.service.updateWorkOrderStatus — Phase 58 §2 QC gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects marking a QC step DONE without a qcResult', async () => {
    const db = makeMockDb({ id: 'wo-1', isQcStep: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'wo-1', status: 'DONE' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('WO-007')
    expect(db.workOrder.update).not.toHaveBeenCalled()
  })

  it('allows marking a QC step DONE with a qcResult, and persists it', async () => {
    const db = makeMockDb({ id: 'wo-1', isQcStep: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'wo-1', status: 'DONE', qcResult: 'PASS', qcNotes: 'Looks good' })
    expect(res.success).toBe(true)
    expect(db.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: expect.objectContaining({ status: 'DONE', qcResult: 'PASS', qcNotes: 'Looks good' })
    })
  })

  it('allows marking a QC step FAIL — failing is a valid, real recorded result, not blocked', async () => {
    const db = makeMockDb({ id: 'wo-1', isQcStep: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'wo-1', status: 'DONE', qcResult: 'FAIL' })
    expect(res.success).toBe(true)
    expect(db.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: expect.objectContaining({ qcResult: 'FAIL' })
    })
  })

  it('never requires a qcResult for an ordinary (non-QC) step', async () => {
    const db = makeMockDb({ id: 'wo-2', isQcStep: false })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'wo-2', status: 'DONE' })
    expect(res.success).toBe(true)
  })

  it('does not require a qcResult when moving a QC step to a non-DONE status (e.g. IN_PROGRESS)', async () => {
    const db = makeMockDb({ id: 'wo-1', isQcStep: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'wo-1', status: 'IN_PROGRESS' })
    expect(res.success).toBe(true)
  })

  it('returns not-found for a missing step', async () => {
    const db: Record<string, any> = { workOrder: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'missing', status: 'DONE' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('WO-006')
  })

  // Phase 67 §9.1 — Manufacturing item 3: per-stage rejection quantity.
  it('persists qtyInspected/qtyRejected alongside qcResult on a QC step', async () => {
    const db = makeMockDb({ id: 'wo-1', isQcStep: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'wo-1', status: 'DONE', qcResult: 'FAIL', qtyInspected: 50, qtyRejected: 5 })
    expect(res.success).toBe(true)
    expect(db.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: expect.objectContaining({ qtyInspected: 50, qtyRejected: 5 })
    })
  })

  it('rejects a rejected quantity greater than the inspected quantity', async () => {
    const db = makeMockDb({ id: 'wo-1', isQcStep: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateWorkOrderStatus({ id: 'wo-1', status: 'DONE', qcResult: 'FAIL', qtyInspected: 5, qtyRejected: 10 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('WO-008')
    expect(db.workOrder.update).not.toHaveBeenCalled()
  })

  it('clears qtyInspected/qtyRejected to null when a QC step is completed without them', async () => {
    const db = makeMockDb({ id: 'wo-1', isQcStep: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateWorkOrderStatus({ id: 'wo-1', status: 'DONE', qcResult: 'PASS' })
    expect(db.workOrder.update).toHaveBeenCalledWith({
      where: { id: 'wo-1' },
      data: expect.objectContaining({ qtyInspected: null, qtyRejected: null })
    })
  })
})

// Phase 67 §9.1 — Manufacturing item 1: machine/labour downtime capture.
describe('work-order.service — downtime capture', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDowntimeMockDb(overrides: Record<string, any> = {}) {
    const db: Record<string, any> = {
      workOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'wo-1' }) },
      workOrderDowntimeEntry: {
        create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'dt-1', ...data, createdAt: new Date() })),
        findMany: vi.fn().mockResolvedValue([]),
      },
      ...overrides
    }
    return db
  }

  it('rejects an empty reason', async () => {
    const db = makeDowntimeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await logDowntime({ workOrderId: 'wo-1', reason: '  ', minutes: 30 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('WO-009')
  })

  it('rejects zero or negative minutes', async () => {
    const db = makeDowntimeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await logDowntime({ workOrderId: 'wo-1', reason: 'Machine breakdown', minutes: 0 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('WO-010')
  })

  it('rejects logging downtime against a non-existent work order step', async () => {
    const db = makeDowntimeMockDb({ workOrder: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await logDowntime({ workOrderId: 'missing', reason: 'Machine breakdown', minutes: 30 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('WO-011')
  })

  it('records a real downtime entry', async () => {
    const db = makeDowntimeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await logDowntime({ workOrderId: 'wo-1', reason: 'Machine breakdown', minutes: 45, notes: 'Belt snapped' }, 'user-1')
    expect(res.success).toBe(true)
    expect(res.data?.reason).toBe('Machine breakdown')
    expect(res.data?.minutes).toBe(45)
  })

  it('lists downtime entries for a work order, most recent first', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'dt-1', workOrderId: 'wo-1', reason: 'x', minutes: 10, notes: null, createdAt: new Date() }])
    const db = makeDowntimeMockDb({ workOrderDowntimeEntry: { findMany } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listDowntimeEntries('wo-1')
    expect(res.success).toBe(true)
    expect(res.data).toHaveLength(1)
    expect(findMany).toHaveBeenCalledWith({ where: { workOrderId: 'wo-1' }, orderBy: { createdAt: 'desc' } })
  })

  it('summarizes downtime minutes by reason, sorted descending', async () => {
    const db = {
      workOrderDowntimeEntry: {
        findMany: vi.fn().mockResolvedValue([
          { reason: 'Machine breakdown', minutes: 30 },
          { reason: 'Material shortage', minutes: 60 },
          { reason: 'Machine breakdown', minutes: 15 },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getDowntimeSummary()
    expect(res.success).toBe(true)
    expect(res.data?.totalMinutes).toBe(105)
    expect(res.data?.byReason).toEqual([
      { reason: 'Material shortage', minutes: 60 },
      { reason: 'Machine breakdown', minutes: 45 },
    ])
  })

  it('returns a zeroed summary when there are no downtime entries', async () => {
    const db = { workOrderDowntimeEntry: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getDowntimeSummary()
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ totalMinutes: 0, byReason: [] })
  })

  it('uses LOCAL midnight (not UTC midnight) as the range start, so an early-morning downtime entry on dateFrom is not silently excluded in a positive-UTC-offset timezone', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { workOrderDowntimeEntry: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getDowntimeSummary({ dateFrom: '2026-08-01', dateTo: '2026-08-01' })

    const callArgs = findMany.mock.calls[0][0]
    const gte: Date = callArgs.where.createdAt.gte
    expect(gte.getFullYear()).toBe(2026)
    expect(gte.getMonth()).toBe(7)
    expect(gte.getDate()).toBe(1)
    expect(gte.getHours()).toBe(0)
    expect(gte.getMinutes()).toBe(0)
  })
})

// Phase 67 §9.1 — Manufacturing item 5: work-order lead-time bottleneck flag.
describe('work-order.service.getWorkOrderBottleneckFlag', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flags the stage with the highest average duration across completed orders', async () => {
    const startDate = new Date('2026-01-01T08:00:00Z')
    const db = {
      productionOrder: {
        findMany: vi.fn().mockResolvedValue([
          {
            startDate,
            workOrders: [
              { taskName: 'Cutting', completedAt: new Date('2026-01-01T09:00:00Z') },   // 1h from start
              { taskName: 'Assembly', completedAt: new Date('2026-01-01T13:00:00Z') },  // 4h from Cutting
              { taskName: 'Packing', completedAt: new Date('2026-01-01T14:00:00Z') },   // 1h from Assembly
            ]
          }
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getWorkOrderBottleneckFlag()
    expect(res.success).toBe(true)
    expect(res.data?.bottleneckStage).toBe('Assembly')
    expect(res.data?.avgDurationHours).toBe(4)
  })

  it('computes a stage average across multiple orders, not just one', async () => {
    const db = {
      productionOrder: {
        findMany: vi.fn().mockResolvedValue([
          { startDate: new Date('2026-01-01T00:00:00Z'), workOrders: [{ taskName: 'Cutting', completedAt: new Date('2026-01-01T02:00:00Z') }] },
          { startDate: new Date('2026-01-02T00:00:00Z'), workOrders: [{ taskName: 'Cutting', completedAt: new Date('2026-01-02T06:00:00Z') }] },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getWorkOrderBottleneckFlag()
    expect(res.data?.stages[0]).toEqual({ taskName: 'Cutting', avgDurationHours: 4, sampleCount: 2 })
  })

  it('returns an honest empty result when there are no completed orders with timestamped steps', async () => {
    const db = { productionOrder: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getWorkOrderBottleneckFlag()
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ bottleneckStage: null, avgDurationHours: 0, shareOfTotalLeadTimePercent: 0, stages: [] })
  })

  it('filters to only COMPLETED orders, ignoring in-progress/draft/cancelled ones', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { productionOrder: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getWorkOrderBottleneckFlag()
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }))
  })

  it('uses LOCAL midnight (not UTC midnight) as the range start, so an early-morning order on dateFrom is not silently excluded in a positive-UTC-offset timezone', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { productionOrder: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getWorkOrderBottleneckFlag({ dateFrom: '2026-08-01', dateTo: '2026-08-01' })

    const callArgs = findMany.mock.calls[0][0]
    const gte: Date = callArgs.where.completedDate.gte
    expect(gte.getFullYear()).toBe(2026)
    expect(gte.getMonth()).toBe(7)
    expect(gte.getDate()).toBe(1)
    expect(gte.getHours()).toBe(0)
    expect(gte.getMinutes()).toBe(0)
  })
})

describe('work-order.service.upsertWorkOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeUpsertMockDb(existingSteps: Array<{ id: string; stepNumber: number; taskName: string; status: string; qcResult: string | null; completedAt: Date | null }>) {
    const store = new Map(existingSteps.map(s => [s.id, { ...s }]))
    const db: Record<string, any> = {
      productionOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1', status: 'IN_PROGRESS' }) },
      workOrder: {
        findMany: vi.fn().mockImplementation(({ where }: any) => {
          if (where?.productionOrderId) return Promise.resolve([...store.values()].map(s => ({ ...s, productionOrderId: 'po-1', isQcStep: false, qcNotes: null, notes: null, createdAt: new Date() })))
          return Promise.resolve([...store.values()])
        }),
        deleteMany: vi.fn().mockImplementation(({ where }: any) => {
          const ids: string[] = where.id.in
          for (const id of ids) store.delete(id)
          return Promise.resolve({ count: ids.length })
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const row = store.get(where.id)
          if (row) Object.assign(row, data)
          return Promise.resolve(row)
        }),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const id = `wo-new-${store.size + 1}`
          store.set(id, { id, status: 'PENDING', qcResult: null, completedAt: null, ...data })
          return Promise.resolve({ id, ...data })
        }),
      },
    }
    db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
    db.__store = store
    return db
  }

  // Regression for a real data-loss bug found 2026-07-22: this used to
  // unconditionally deleteMany+createMany EVERY step on EVERY save,
  // resetting status/qcResult/completedAt to PENDING/null even for steps
  // that already had real progress — adding one new step to an order with 3
  // DONE steps silently wiped all 3 back to PENDING.
  it('preserves status/qcResult/completedAt on an existing step that is unchanged, while adding a new step alongside it', async () => {
    const completedAt = new Date('2026-07-20T00:00:00Z')
    const db = makeUpsertMockDb([
      { id: 'wo-1', stepNumber: 1, taskName: 'Cut fabric', status: 'DONE', qcResult: 'PASS', completedAt },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertWorkOrders({
      productionOrderId: 'po-1',
      steps: [
        { id: 'wo-1', stepNumber: 1, taskName: 'Cut fabric' },
        { stepNumber: 2, taskName: 'Stitch panels' }, // new step, no id
      ],
    })

    expect(res.success).toBe(true)
    const wo1 = db.__store.get('wo-1')
    expect(wo1.status).toBe('DONE')
    expect(wo1.qcResult).toBe('PASS')
    expect(wo1.completedAt).toEqual(completedAt)
    expect(db.__store.size).toBe(2)
  })

  it('deletes a step that was removed from the incoming list, without touching the remaining ones', async () => {
    const db = makeUpsertMockDb([
      { id: 'wo-1', stepNumber: 1, taskName: 'Cut fabric', status: 'DONE', qcResult: null, completedAt: null },
      { id: 'wo-2', stepNumber: 2, taskName: 'Stitch panels', status: 'PENDING', qcResult: null, completedAt: null },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertWorkOrders({
      productionOrderId: 'po-1',
      steps: [{ id: 'wo-1', stepNumber: 1, taskName: 'Cut fabric' }],
    })

    expect(res.success).toBe(true)
    expect(db.__store.has('wo-2')).toBe(false)
    expect(db.__store.get('wo-1').status).toBe('DONE')
  })

  it('creates a brand-new step as PENDING when the order has no existing steps', async () => {
    const db = makeUpsertMockDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertWorkOrders({
      productionOrderId: 'po-1',
      steps: [{ stepNumber: 1, taskName: 'Cut fabric' }],
    })

    expect(res.success).toBe(true)
    expect(db.workOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ taskName: 'Cut fabric', status: 'PENDING' })
    }))
  })

  it('rejects editing steps on a COMPLETED production order', async () => {
    const db = makeUpsertMockDb([])
    db.productionOrder.findUnique = vi.fn().mockResolvedValue({ id: 'po-1', status: 'COMPLETED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertWorkOrders({ productionOrderId: 'po-1', steps: [{ stepNumber: 1, taskName: 'x' }] })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('WO-003')
  })
})
