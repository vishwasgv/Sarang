import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createToken, getTodayQueue } from '../token-queue.service'

// Regression coverage for the Phase 24 re-audit finding: createToken's
// "read the last token number, then create" wasn't wrapped in a transaction —
// live-reproduced as a real crash (Unique constraint failed on
// (queueDate, tokenNumber)) when two calls raced. Now both run inside the
// same db.$transaction(), same fix pattern as createAppointment (Phase 22).

function makeMockDb(existingTokens: { tokenNumber: number }[] = []) {
  const tokens = [...existingTokens]
  const db: Record<string, any> = {
    tokenQueue: {
      findFirst: vi.fn().mockImplementation(() =>
        Promise.resolve(
          tokens.length > 0 ? tokens.reduce((max, t) => (t.tokenNumber > max.tokenNumber ? t : max)) : null
        )
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const tokenNumber = data.tokenNumber as number
        tokens.push({ tokenNumber })
        return Promise.resolve({ id: `tok-${tokenNumber}`, ...data })
      }),
    },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return { db, tokens }
}

describe('token-queue.service — createToken numbering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('issues token #1 for an empty queue', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createToken({ patientName: 'Patient A' })

    expect(res.success).toBe(true)
    expect((res as { data: { tokenNumber: number } }).data.tokenNumber).toBe(1)
  })

  it('issues the next sequential token number', async () => {
    const { db } = makeMockDb([{ tokenNumber: 1 }, { tokenNumber: 2 }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createToken({ patientName: 'Patient C' })

    expect(res.success).toBe(true)
    expect((res as { data: { tokenNumber: number } }).data.tokenNumber).toBe(3)
  })

  it('runs the numbering read and the write inside the same transaction', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createToken({ patientName: 'Patient A' })

    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })

  it('sequential calls (simulating two front-desk terminals via the shared mock queue) never collide', async () => {
    const { db, tokens } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const r1 = await createToken({ patientName: 'Patient A' })
    const r2 = await createToken({ patientName: 'Patient B' })

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(tokens.map(t => t.tokenNumber).sort()).toEqual([1, 2])
  })
})

// Phase 67 §9.1 item 20.5 — Specialist Clinic: waitlist prioritization by referral urgency.
describe('token-queue.service — isUrgent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores isUrgent when true on create', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createToken({ patientName: 'Patient A', isUrgent: true })

    const call = vi.mocked(db.tokenQueue.create).mock.calls[0][0] as { data: { isUrgent: boolean } }
    expect(call.data.isUrgent).toBe(true)
  })

  it('defaults isUrgent to false when omitted', async () => {
    const { db } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createToken({ patientName: 'Patient A' })

    const call = vi.mocked(db.tokenQueue.create).mock.calls[0][0] as { data: { isUrgent: boolean } }
    expect(call.data.isUrgent).toBe(false)
  })

  it('orders the queue by isUrgent desc, then tokenNumber asc — urgent tokens are called ahead of check-in order', async () => {
    const db = { tokenQueue: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getTodayQueue('2026-08-19')

    expect(db.tokenQueue.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ isUrgent: 'desc' }, { tokenNumber: 'asc' }],
    }))
  })
})
