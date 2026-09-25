import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../message-template.service', () => ({ renderMessageTemplate: vi.fn() }))

import { getPrisma } from '../../database/db'
import { sweepReminderQueue } from '../notification-queue.service'

function makeDb(optedOut: string[], pending: Array<{ id: string; customerPhone: string | null }>) {
  return {
    customer: { findMany: vi.fn().mockResolvedValue(optedOut.map((id) => ({ id }))) },
    notificationQueue: {
      updateMany: vi.fn().mockImplementation(async ({ where }: { where: { id?: { in: string[] }; customerId?: { in: string[] } } }) => ({ count: (where.id?.in ?? where.customerId?.in ?? []).length })),
      findMany: vi.fn().mockResolvedValue(pending)
    }
  }
}

describe('reminder queue sweep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dismisses waiting reminders of customers who asked not to be messaged', async () => {
    const db = makeDb(['c1', 'c2'], [])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    expect(await sweepReminderQueue()).toEqual({ dismissed: 2, failed: 0 })
    expect(db.notificationQueue.updateMany.mock.calls[0][0].data).toEqual({ status: 'DISMISSED' })
  })

  it('marks reminders with a too-short phone number as FAILED', async () => {
    const db = makeDb([], [{ id: 'a', customerPhone: '12345' }, { id: 'b', customerPhone: '+91 98765 43210' }, { id: 'c', customerPhone: null }])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await sweepReminderQueue()
    expect(r.failed).toBe(2)
    expect(db.notificationQueue.updateMany.mock.calls[0][0].where.id.in).toEqual(['a', 'c'])
    expect(db.notificationQueue.updateMany.mock.calls[0][0].data).toEqual({ status: 'FAILED' })
  })

  it('never throws', async () => {
    vi.mocked(getPrisma).mockImplementation(() => { throw new Error('db down') })
    expect(await sweepReminderQueue()).toEqual({ dismissed: 0, failed: 0 })
  })
})
