import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getProviderAvailability, addHoliday } from '../provider-schedule.service'

function makeMockDb() {
  const db: Record<string, any> = {
    providerSchedule: {
      findUnique: vi.fn().mockResolvedValue({ isWorking: true, startTime: '09:00', endTime: '17:00', slotDuration: 30, breakStart: null, breakEnd: null }),
    },
    clinicHoliday: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'holiday-1', ...data })),
    },
    appointment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

// Real bug found live (2026-07-28 service-vertical audit): both `date` in
// getProviderAvailability and `date` in addHoliday used to be constructed
// via a bare `new Date('YYYY-MM-DD')` (UTC midnight). After fixing
// appointment.service.ts's scheduledDate to write at local midnight (same
// audit), leaving these anchored at UTC midnight would make them
// systematically disagree — including in this app's own primary IST
// market, where the two used to accidentally agree only because both were
// equally wrong. These tests guard the local-midnight fix.
describe('provider-schedule.service — local-date construction', () => {
  it('getProviderAvailability computes dayOfWeek from local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 2026-08-15 is a Saturday (dayOfWeek 6) in local-calendar terms.
    await getProviderAvailability({ providerId: 'prov-1', date: '2026-08-15' })

    const scheduleCall = db.providerSchedule.findUnique.mock.calls[0][0] as { where: { providerId_dayOfWeek: { dayOfWeek: number } } }
    expect(scheduleCall.where.providerId_dayOfWeek.dayOfWeek).toBe(new Date(2026, 7, 15).getDay())
  })

  it('getProviderAvailability queries the holiday/appointment range anchored at local midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getProviderAvailability({ providerId: 'prov-1', date: '2026-08-15' })

    const apptCall = db.appointment.findMany.mock.calls[0][0] as { where: { scheduledDate: { gte: Date; lt: Date } } }
    expect(apptCall.where.scheduledDate.gte).toEqual(new Date(2026, 7, 15))
    expect(apptCall.where.scheduledDate.lt).toEqual(new Date(2026, 7, 16))
  })

  it('addHoliday stores date at local midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addHoliday({ date: '2026-10-02', name: 'Gandhi Jayanti' })

    expect(res.success).toBe(true)
    const createCall = db.clinicHoliday.create.mock.calls[0][0] as { data: { date: Date } }
    expect(createCall.data.date).toEqual(new Date(2026, 9, 2))
  })
})
