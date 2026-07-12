import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createComplianceTask } from '../compliance-task.service'

// Regression coverage for the Phase 29 re-audit finding: the reminder dedup
// in scheduleComplianceNotifications matched on `taskId.slice(-6)` — a bare
// 6-character substring embedded in the notification body. Since
// NotificationQueue has no column linking back to a ComplianceTask (these
// are firm-internal reminders with customerId always null, so the usual
// customerId+notificationType+status dedup key doesn't apply here), a
// coincidental 6-character collision between two tasks' cuids — or between
// one task's id fragment and another task's title text — could misfire the
// delete. Fixed by embedding and matching on the full cuid instead.

function makeMockDb() {
  const db: Record<string, any> = {
    complianceTask: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'task-abc123', ...data })
      ),
    },
    notificationQueue: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('compliance-task.service — reminder dedup precision', () => {
  beforeEach(() => vi.clearAllMocks())

  it('matches and embeds the full task id, not a 6-character slice', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const farFuture = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
    await createComplianceTask({ clientId: 'cust-1', title: 'GSTR-3B Filing', category: 'GST', dueDate: farFuture })
    // scheduleComplianceNotifications fires fire-and-forget; flush microtasks
    await new Promise((r) => setTimeout(r, 0))

    expect(db.notificationQueue.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ templateBody: { contains: '[task-abc123]' } }),
      })
    )
    const createdBodies = db.notificationQueue.create.mock.calls.map((c: any) => c[0].data.templateBody)
    expect(createdBodies.every((b: string) => b.includes('[task-abc123]'))).toBe(true)
    expect(createdBodies.every((b: string) => !b.includes('[bc123]'))).toBe(true)
  })
})
