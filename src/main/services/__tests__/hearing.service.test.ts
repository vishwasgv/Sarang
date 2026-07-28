import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue(null) }))

import { getPrisma } from '../../database/db'
import { updateHearing, createHearing } from '../hearing.service'
import { parseLocalDateStart, toLocalISODate } from '../../utils/date.util'

// Regression coverage for the Phase 28 re-audit finding: scheduleHearingReminder
// was only called from createHearing, never from updateHearing — rescheduling a
// hearing's date (routine in real court practice) left the original reminder
// tied to the old date, with no new reminder created for the new date. Fixed
// with rescheduleHearingReminder: cancels the pending reminder computed from
// the old date, then schedules a fresh one for the new date.

const FAR_FUTURE_OLD = '2026-08-01'
const FAR_FUTURE_NEW = '2026-09-01'

function makeHearing(overrides: Record<string, unknown> = {}) {
  return {
    // Real bug found live (2026-07-28 service-vertical audit): hearingDate
    // is now constructed via parseLocalDateStart (local midnight), not a
    // bare `new Date(dateString)` (UTC midnight) — this fixture must match
    // real behavior so the "same date -> no-op" comparison test is
    // meaningful.
    id: 'hearing-1', caseId: 'case-1', hearingDate: parseLocalDateStart(FAR_FUTURE_OLD), hearingTime: null,
    courtRoom: null, purpose: null, status: 'SCHEDULED', outcome: null, nextDate: null,
    notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb() {
  const hearingRow = makeHearing()
  const db: Record<string, any> = {
    hearing: {
      findUnique: vi.fn().mockResolvedValue(hearingRow),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...hearingRow, ...data })
      ),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    legalCase: {
      findUnique: vi.fn().mockResolvedValue({ id: 'case-1', clientId: 'cust-1', nextHearingDate: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    notificationQueue: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      create: vi.fn().mockResolvedValue({}),
    },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Test Firm' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('hearing.service — reminder rescheduling on date change', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cancels the old reminder and schedules a new one when hearingDate changes', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // legalCase lookup happens twice: once inside rescheduleHearingReminder,
    // once inside scheduleHearingReminder's client fetch.
    db.legalCase.findUnique = vi.fn().mockImplementation(({ select }: { select?: Record<string, boolean>, include?: unknown }) => {
      if (select?.clientId) return Promise.resolve({ clientId: 'cust-1' })
      return Promise.resolve({ id: 'case-1', caseNumber: 'CASE-1', caseTitle: 'Test', courtName: 'Court', client: { id: 'cust-1', customerName: 'Client', phone: '9999999999' } })
    })

    const res = await updateHearing({ id: 'hearing-1', hearingDate: FAR_FUTURE_NEW })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'cust-1',
          notificationType: { in: ['HEARING_DUE_2D', 'HEARING_DUE_7D'] },
          status: 'PENDING',
        }),
      })
    )
    expect(db.notificationQueue.create).toHaveBeenCalled()
  })

  it('does not touch reminders when hearingDate is not part of the update', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateHearing({ id: 'hearing-1', courtRoom: 'Room 4' })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.deleteMany).not.toHaveBeenCalled()
    expect(db.notificationQueue.create).not.toHaveBeenCalled()
  })

  it('does not reschedule when the hearingDate update is a no-op (same date)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateHearing({ id: 'hearing-1', hearingDate: FAR_FUTURE_OLD })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.deleteMany).not.toHaveBeenCalled()
  })
})

// Real bug found live (2026-07-28 service-vertical audit): syncNextHearingDate
// anchored its "is this hearing upcoming" threshold to UTC midnight
// (`todayStart.setUTCHours(0,0,0,0)`), with a comment claiming hearing dates
// are stored as midnight UTC — true when written, but createHearing/
// updateHearing were separately fixed the same day to store hearingDate via
// parseLocalDateStart (LOCAL midnight) instead, and this sibling read
// function was missed. In IST (UTC+5:30, this app's primary market), a
// hearing dated "today" is stored 5:30 hours BEFORE UTC midnight of that
// same calendar day, so the buggy `hearingDate >= todayStart` comparison
// evaluated false for every hearing scheduled for today — silently
// excluding it from LegalCase.nextHearingDate.
describe('hearing.service — syncNextHearingDate today-boundary (local vs UTC midnight)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts a hearing scheduled for today as the case\'s next hearing', async () => {
    const todayStr = toLocalISODate(new Date())
    const todaysHearingDate = parseLocalDateStart(todayStr)

    const db: Record<string, any> = {
      hearing: {
        create: vi.fn().mockResolvedValue({
          id: 'hearing-today', caseId: 'case-1', hearingDate: todaysHearingDate,
          hearingTime: null, courtRoom: null, purpose: null, status: 'SCHEDULED', notes: null,
        }),
        // Mirrors what a real SQLite `WHERE hearingDate >= ?` comparison
        // does — evaluates the actual stored instant against the threshold
        // the service code computed, exactly the comparison the bug got
        // wrong.
        findFirst: vi.fn().mockImplementation(({ where }: { where: { hearingDate?: { gte?: Date } } }) => {
          const gte = where.hearingDate?.gte
          if (gte && todaysHearingDate.getTime() >= gte.getTime()) {
            return Promise.resolve({ hearingDate: todaysHearingDate })
          }
          return Promise.resolve(null)
        }),
      },
      legalCase: {
        findUnique: vi.fn().mockResolvedValue(null), // scheduleHearingReminder no-ops safely
        update: vi.fn().mockResolvedValue({}),
      },
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Test Firm' }) },
      notificationQueue: { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createHearing({ caseId: 'case-1', hearingDate: todayStr })

    expect(res.success).toBe(true)
    expect(db.legalCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1' },
        data: { nextHearingDate: todaysHearingDate },
      })
    )
  })
})
