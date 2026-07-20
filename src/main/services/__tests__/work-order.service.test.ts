import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { updateWorkOrderStatus } from '../work-order.service'

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
