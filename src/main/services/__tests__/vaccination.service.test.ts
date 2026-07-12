import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { generateVaccineReminder, updateVaccinationRecord } from '../vaccination.service'

// Regression coverage for the Phase 23 re-audit finding: generateVaccineReminder
// had no deduplication for VACCINE_DUE_7D/VACCINE_DUE_30D (only VACCINE_OVERDUE
// was guarded), so calling it more than once for the same record — which
// happens automatically on record creation AND again on every click of the
// never-disabling "Send Reminder" button — created a fresh duplicate pair of
// notification-queue rows every time.

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vac-1',
    vaccineName: 'Rabies',
    nextDueDate: new Date(Date.now() + 40 * 86400000), // 40 days out — both 7d and 30d windows are still in the future
    pet: {
      petName: 'Rex',
      customer: { id: 'cust-1', customerName: 'Pet Owner', phone: '+919876543210' },
    },
    ...overrides
  }
}

function makeMockDb(queuedEntries: Record<string, unknown>[] = []) {
  const queue = [...queuedEntries]
  const db: Record<string, any> = {
    vaccinationRecord: { findUnique: vi.fn().mockResolvedValue(makeRecord()) },
    notificationQueue: {
      findFirst: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          queue.find(q =>
            q.notificationType === where.notificationType &&
            q.customerId === where.customerId &&
            q.status === where.status &&
            (where.scheduledFor === undefined || new Date(q.scheduledFor as string).getTime() === new Date(where.scheduledFor as string).getTime())
          ) ?? null
        )
      ),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        queue.push(data)
        return Promise.resolve({ id: `nq-${queue.length}`, ...data })
      }),
    },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ country: 'india' }) },
  }
  return { db, queue }
}

describe('vaccination.service — reminder deduplication', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queues one 7-day and one 30-day reminder on first call', async () => {
    const { db, queue } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateVaccineReminder('vac-1')

    expect(res.success).toBe(true)
    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_7D')).toHaveLength(1)
    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_30D')).toHaveLength(1)
  })

  it('does not create duplicates when called again for the same record (e.g. clicking "Send Reminder" twice)', async () => {
    const { db, queue } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await generateVaccineReminder('vac-1')
    await generateVaccineReminder('vac-1')
    await generateVaccineReminder('vac-1')

    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_7D')).toHaveLength(1)
    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_30D')).toHaveLength(1)
    expect(queue).toHaveLength(2)
  })

  it('still creates a fresh pair for a different record (dedup is per-record, not global)', async () => {
    const { db, queue } = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.vaccinationRecord.findUnique = vi.fn()
      .mockResolvedValueOnce(makeRecord({ id: 'vac-1' }))
      .mockResolvedValueOnce(makeRecord({ id: 'vac-2', nextDueDate: new Date(Date.now() + 45 * 86400000) }))

    await generateVaccineReminder('vac-1')
    await generateVaccineReminder('vac-2')

    expect(queue).toHaveLength(4)
  })

  it('skips silently when the owner has no phone on file', async () => {
    const { db, queue } = makeMockDb()
    db.vaccinationRecord.findUnique = vi.fn().mockResolvedValue(
      makeRecord({ pet: { petName: 'Rex', customer: { id: 'cust-1', customerName: 'Pet Owner', phone: null } } })
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateVaccineReminder('vac-1')

    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
    expect(queue).toHaveLength(0)
  })
})

// Regression coverage for the Phase 36 re-audit finding: updateVaccinationRecord
// never regenerated reminders when nextDueDate was set/changed via an edit — only
// createVaccinationRecord auto-generated them. A vet who creates a record without
// a due date (common — the follow-up schedule isn't always known yet) and later
// adds one via edit got no reminder at all, with "click Send Reminder manually" as
// the only recovery. hearing.service.ts already handled the equivalent scenario
// (hearingDate changing on update) correctly; this brings vaccination.service.ts
// in line with that pattern via rescheduleVaccineReminder.

describe('vaccination.service — reminder rescheduling on update', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queues fresh reminders when nextDueDate is set for the first time via an update', async () => {
    const newDue = new Date(Date.now() + 40 * 86400000)
    const { db, queue } = makeMockDb()
    db.vaccinationRecord.findUnique = vi.fn()
      .mockResolvedValueOnce({ nextDueDate: null }) // pre-update lookup — no due date was set
      .mockResolvedValue(makeRecord({ nextDueDate: newDue })) // reschedule's customer lookup + generateVaccineReminder's full fetch
    db.vaccinationRecord.update = vi.fn().mockResolvedValue(makeRecord({ nextDueDate: newDue }))
    db.auditLog = { create: vi.fn().mockResolvedValue({}) }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateVaccinationRecord({ id: 'vac-1', nextDueDate: newDue.toISOString() })

    expect(res.success).toBe(true)
    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_7D')).toHaveLength(1)
    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_30D')).toHaveLength(1)
  })

  it('cancels the stale reminder and schedules a fresh one when nextDueDate changes to a different date', async () => {
    const oldDue = new Date(Date.now() + 40 * 86400000)
    const newDue = new Date(Date.now() + 60 * 86400000)
    const oldSevenDaysBefore = new Date(oldDue.getTime() - 7 * 86400000)
    const oldThirtyDaysBefore = new Date(oldDue.getTime() - 30 * 86400000)
    const { db, queue } = makeMockDb([
      { notificationType: 'VACCINE_DUE_7D', customerId: 'cust-1', status: 'PENDING', scheduledFor: oldSevenDaysBefore },
      { notificationType: 'VACCINE_DUE_30D', customerId: 'cust-1', status: 'PENDING', scheduledFor: oldThirtyDaysBefore },
    ])
    db.vaccinationRecord.findUnique = vi.fn()
      .mockResolvedValueOnce({ nextDueDate: oldDue })
      .mockResolvedValue(makeRecord({ nextDueDate: newDue }))
    db.vaccinationRecord.update = vi.fn().mockResolvedValue(makeRecord({ nextDueDate: newDue }))
    db.auditLog = { create: vi.fn().mockResolvedValue({}) }
    db.notificationQueue.deleteMany = vi.fn().mockImplementation(({ where }: { where: { scheduledFor: { in: Date[] } } }) => {
      const before = queue.length
      const targets = where.scheduledFor.in.map(d => d.getTime())
      for (let i = queue.length - 1; i >= 0; i--) {
        if (targets.includes(new Date(queue[i].scheduledFor as string).getTime())) queue.splice(i, 1)
      }
      return Promise.resolve({ count: before - queue.length })
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateVaccinationRecord({ id: 'vac-1', nextDueDate: newDue.toISOString() })

    expect(res.success).toBe(true)
    // Old-date reminders removed, new-date pair added — net one pair, not a stale-plus-fresh pileup
    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_7D')).toHaveLength(1)
    expect(queue.filter(q => q.notificationType === 'VACCINE_DUE_30D')).toHaveLength(1)
    const newSevenDaysBefore = new Date(newDue.getTime() - 7 * 86400000)
    expect(new Date(queue.find(q => q.notificationType === 'VACCINE_DUE_7D')!.scheduledFor as string).getTime()).toBe(newSevenDaysBefore.getTime())
  })

  it('does not touch reminders when nextDueDate is not part of the update payload', async () => {
    const { db } = makeMockDb()
    db.vaccinationRecord.update = vi.fn().mockResolvedValue(makeRecord())
    db.auditLog = { create: vi.fn().mockResolvedValue({}) }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateVaccinationRecord({ id: 'vac-1', vaccineName: 'Rabies Booster' })

    expect(res.success).toBe(true)
    expect(db.vaccinationRecord.findUnique).not.toHaveBeenCalled()
  })
})
