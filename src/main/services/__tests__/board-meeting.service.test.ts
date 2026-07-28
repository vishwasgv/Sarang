import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createBoardMeeting, updateBoardMeeting } from '../board-meeting.service'

function makeMockDb() {
  const db: Record<string, any> = {
    boardMeeting: {
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
