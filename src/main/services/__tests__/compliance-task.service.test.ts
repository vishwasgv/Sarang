import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createComplianceTask, listComplianceTasks } from '../compliance-task.service'

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

// Regression for a real date-boundary bug found 2026-07-22: a compliance
// deadline is a pure calendar date, always constructed at LOCAL midnight
// (compliance-event.service.ts's computeNextDueDate). Round-tripping it
// through a raw `.toISOString()` on serialization (or `new Date(dateStr)` on
// input) shifted it to the UTC instant, which for IST (the app's primary
// market, UTC+5:30) lands on the PREVIOUS UTC calendar day — every
// auto-generated statutory deadline displayed one day earlier than the real
// one.
describe('compliance-task.service — local calendar-date correctness', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createComplianceTask parses a "YYYY-MM-DD" dueDate as local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createComplianceTask({ clientId: 'cust-1', title: 'GSTR-3B Filing', category: 'GST', dueDate: '2026-07-31' })

    const createCall = db.complianceTask.create.mock.calls[0][0]
    const storedDate = createCall.data.dueDate as Date
    // Local calendar components must read July 31st, not July 30th (which
    // is what new Date('2026-07-31') — UTC midnight — would show once
    // re-inspected in an IST-ahead-of-UTC environment).
    expect(storedDate.getFullYear()).toBe(2026)
    expect(storedDate.getMonth()).toBe(6) // 0-indexed: July
    expect(storedDate.getDate()).toBe(31)
  })

  it('listComplianceTasks serializes dueDate to a date string that reflects the correct LOCAL calendar day, not the UTC-shifted one', async () => {
    const db = makeMockDb()
    // A dueDate exactly as computeNextDueDate would construct it: local
    // midnight of July 31, 2026.
    const localMidnightJuly31 = new Date(2026, 6, 31)
    db.complianceTask.findMany = vi.fn().mockResolvedValue([
      { id: 'task-1', dueDate: localMidnightJuly31, filedOn: null, createdAt: new Date(), updatedAt: new Date() },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listComplianceTasks()

    expect(res.success).toBe(true)
    const task = (res as unknown as { data: Array<{ dueDate: string }> }).data[0]
    // The renderer does `task.dueDate.slice(0, 10)` directly — this must
    // read "2026-07-31", not "2026-07-30".
    expect(task.dueDate.slice(0, 10)).toBe('2026-07-31')
  })
})
