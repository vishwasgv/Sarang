import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { updateWorkOrderStatus, upsertWorkOrders } from '../work-order.service'

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
