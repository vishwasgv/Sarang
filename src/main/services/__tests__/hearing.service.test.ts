import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue(null) }))

import { getPrisma } from '../../database/db'
import { updateHearing } from '../hearing.service'

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
    id: 'hearing-1', caseId: 'case-1', hearingDate: new Date(FAR_FUTURE_OLD), hearingTime: null,
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
