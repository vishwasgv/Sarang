import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createBoardMeeting, updateBoardMeeting, listBoardMeetings, getMeetingsWithOverdueMinutes } from '../board-meeting.service'

function makeMockDb() {
  const db: Record<string, any> = {
    boardMeeting: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'meeting-1', createdAt: new Date(), updatedAt: new Date(), ...data })
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'meeting-1', createdAt: new Date(), updatedAt: new Date(), meetingDate: new Date(), ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

// Real bug found live (2026-07-28 service-vertical audit): meetingDate used
// to be constructed via a bare `new Date('YYYY-MM-DD')` (UTC midnight),
// inconsistent with listBoardMeetings' own read-side filter
// (parseLocalDateStart/End, already fixed in an earlier pass). Fixed to
// match — these tests guard the write side.
describe('board-meeting.service — local-date construction', () => {
  it('createBoardMeeting stores meetingDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBoardMeeting({ clientId: 'client-1', meetingDate: '2026-08-15' })

    expect(res.success).toBe(true)
    const createCall = db.boardMeeting.create.mock.calls[0][0] as { data: { meetingDate: Date } }
    expect(createCall.data.meetingDate).toEqual(new Date(2026, 7, 15))
  })

  it('updateBoardMeeting stores an updated meetingDate at local midnight too', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBoardMeeting({ id: 'meeting-1', meetingDate: '2026-09-01' })

    expect(res.success).toBe(true)
    const updateCall = db.boardMeeting.update.mock.calls[0][0] as { data: { meetingDate: Date } }
    expect(updateCall.data.meetingDate).toEqual(new Date(2026, 8, 1))
  })
})

// Real bug found live (2026-08-27 Phase 68 audit): serializeMeeting used a
// plain `.toISOString()` instead of toLocalDateOnlyIso — meetingDate is
// stored at LOCAL midnight, which shifts to the PREVIOUS calendar day in
// UTC for IST, so the renderer displayed every meeting one day early.
describe('board-meeting.service — listBoardMeetings serialization', () => {
  it('returns meetingDate on the correct LOCAL calendar day, not shifted back a day via UTC', async () => {
    const db = { boardMeeting: { findMany: vi.fn().mockResolvedValue([{ id: 'm1', meetingDate: new Date(2026, 7, 15), createdAt: new Date(), updatedAt: new Date() }]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listBoardMeetings({})

    expect(res.success).toBe(true)
    const row = (res as unknown as { data: Array<{ meetingDate: string }> }).data[0]
    expect(row.meetingDate.slice(0, 10)).toBe('2026-08-15')
  })
})

// Phase 68 §9.1 — Company Secretary item 3: board-meeting minutes cadence
// reminder (worklist of minutesDone=false meetings, 30+ days overdue).

function makeOverdueMinutesDb(meetings: Array<{ id: string; clientId: string; customerName: string; meetingType: string; daysAgo: number }>) {
  const now = Date.now()
  return {
    boardMeeting: {
      findMany: vi.fn().mockResolvedValue(
        meetings.map((m) => ({
          id: m.id,
          clientId: m.clientId,
          meetingType: m.meetingType,
          meetingDate: new Date(now - m.daysAgo * 24 * 60 * 60 * 1000),
          client: { id: m.clientId, customerName: m.customerName },
        }))
      ),
    },
  }
}

describe('board-meeting.service.getMeetingsWithOverdueMinutes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('excludes a meeting whose minutes are only 10 days old (within the 30-day grace window)', async () => {
    const db = makeOverdueMinutesDb([{ id: 'm1', clientId: 'c1', customerName: 'Alpha Ltd', meetingType: 'BOARD', daysAgo: 10 }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getMeetingsWithOverdueMinutes()

    expect(res.success).toBe(true)
    expect((res as { data: any[] }).data).toHaveLength(0)
  })

  it('includes a meeting whose minutes are 45 days old, with the correct overdue count', async () => {
    const db = makeOverdueMinutesDb([{ id: 'm1', clientId: 'c1', customerName: 'Alpha Ltd', meetingType: 'AGM', daysAgo: 45 }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getMeetingsWithOverdueMinutes()

    expect(res.success).toBe(true)
    const row = (res as { data: any[] }).data[0]
    expect(row.daysOverdue).toBe(15)
    expect(row.clientName).toBe('Alpha Ltd')
  })

  it('sorts worst (most overdue) first', async () => {
    const db = makeOverdueMinutesDb([
      { id: 'm1', clientId: 'c1', customerName: 'Alpha Ltd', meetingType: 'BOARD', daysAgo: 40 },
      { id: 'm2', clientId: 'c2', customerName: 'Beta Ltd', meetingType: 'BOARD', daysAgo: 90 },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getMeetingsWithOverdueMinutes()

    expect((res as { data: any[] }).data.map((r) => r.clientName)).toEqual(['Beta Ltd', 'Alpha Ltd'])
  })
})
