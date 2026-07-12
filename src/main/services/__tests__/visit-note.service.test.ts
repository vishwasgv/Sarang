import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../normal-range.service', () => ({ computeVitalsFlags: vi.fn() }))
vi.mock('../appointment.service', () => ({ createAppointment: vi.fn() }))

import { getPrisma } from '../../database/db'
import { computeVitalsFlags } from '../normal-range.service'
import { createAppointment } from '../appointment.service'
import { createVisitNote, updateVisitNote, referToProvider, listReferralsForVisitNote } from '../visit-note.service'

// Phase 54B — VisitNote gained structured vitals (bpSystolic/bpDiastolic/
// pulseRate/temperatureF/heightCm/weightKg) plus a vitalsFlags JSON column
// computed against the shared NormalRangeReference library. Regression
// coverage for: the flags actually get computed and stored on create, and
// on update they're recomputed using only the vitals that changed (merged
// with the existing saved values, not silently dropping the others).

function makeVisitNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vn-1', appointmentId: 'appt-1', isFinalized: false,
    bpSystolic: 120, bpDiastolic: 80, pulseRate: 72, temperatureF: 98.6,
    ...overrides,
  }
}

describe('visit-note.service — createVisitNote vitals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes vitalsFlags from the provided vitals and stores them as JSON', async () => {
    const db = {
      visitNote: { create: vi.fn().mockResolvedValue(makeVisitNote()) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({ bpSystolic: 'HIGH' })

    await createVisitNote({
      appointmentId: 'appt-1', patientName: 'John Doe',
      bpSystolic: 150, bpDiastolic: 80, createdBy: 'user-1',
    })

    expect(computeVitalsFlags).toHaveBeenCalledWith({ bpSystolic: 150, bpDiastolic: 80, pulseRate: undefined, temperatureF: undefined })
    const call = vi.mocked(db.visitNote.create).mock.calls[0][0] as { data: { vitalsFlags: string | null } }
    expect(JSON.parse(call.data.vitalsFlags!)).toEqual({ bpSystolic: 'HIGH' })
  })

  it('stores vitalsFlags as null when no vital is out of range', async () => {
    const db = {
      visitNote: { create: vi.fn().mockResolvedValue(makeVisitNote()) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({})

    await createVisitNote({ appointmentId: 'appt-1', patientName: 'John Doe', bpSystolic: 110, createdBy: 'user-1' })

    const call = vi.mocked(db.visitNote.create).mock.calls[0][0] as { data: { vitalsFlags: string | null } }
    expect(call.data.vitalsFlags).toBeNull()
  })
})

describe('visit-note.service — updateVisitNote vitals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recomputes flags using the changed vital merged with the previously saved ones', async () => {
    const existing = makeVisitNote({ bpSystolic: 120, bpDiastolic: 80, pulseRate: 72, temperatureF: 98.6 })
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(makeVisitNote()),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({ bpDiastolic: 'HIGH' })

    await updateVisitNote({ id: 'vn-1', bpDiastolic: 95 })

    // Only bpDiastolic changed — the other 3 vitals passed to computeVitalsFlags
    // must come from the existing saved record, not be dropped/undefined.
    expect(computeVitalsFlags).toHaveBeenCalledWith({ bpSystolic: 120, bpDiastolic: 95, pulseRate: 72, temperatureF: 98.6 })
  })

  it('does not touch vitalsFlags at all when no vital field is part of the update', async () => {
    const existing = makeVisitNote()
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(makeVisitNote()),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateVisitNote({ id: 'vn-1', chiefComplaint: 'Follow-up' })

    expect(computeVitalsFlags).not.toHaveBeenCalled()
    const call = vi.mocked(db.visitNote.update).mock.calls[0][0] as { data: Record<string, unknown> }
    expect('vitalsFlags' in call.data).toBe(false)
  })

  it('refuses to edit a finalized note', async () => {
    const db = {
      visitNote: { findUnique: vi.fn().mockResolvedValue(makeVisitNote({ isFinalized: true })) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateVisitNote({ id: 'vn-1', bpSystolic: 130 })

    expect(res.success).toBe(false)
  })
})

describe('visit-note.service — referToProvider (F.11 real in-app referral routing)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a real appointment for the receiving provider, linked back to the referring visit note', async () => {
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'vn-1', patientName: 'Jane Doe', referralReason: null,
          appointment: { customerId: 'cust-1', customerName: 'Jane Doe' },
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createAppointment).mockResolvedValue({ success: true, data: { id: 'appt-new' } } as never)

    const res = await referToProvider({
      visitNoteId: 'vn-1', providerId: 'emp-2',
      scheduledDate: '2026-08-01', scheduledTime: '10:00',
      reason: 'Suspected fracture — needs orthopedic review', createdBy: 'user-1',
    })

    expect(res.success).toBe(true)
    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1', customerName: 'Jane Doe', providerId: 'emp-2',
      scheduledDate: '2026-08-01', scheduledTime: '10:00',
      notes: 'Suspected fracture — needs orthopedic review',
      referredFromVisitNoteId: 'vn-1', createdBy: 'user-1',
    }))
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'REFERRED', entityType: 'VisitNote', entityId: 'vn-1' })
    }))
  })

  it('falls back to the note\'s own referralReason when no explicit reason is given', async () => {
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'vn-1', patientName: 'Jane Doe', referralReason: 'Chronic back pain',
          appointment: { customerId: 'cust-1', customerName: 'Jane Doe' },
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createAppointment).mockResolvedValue({ success: true, data: { id: 'appt-new' } } as never)

    await referToProvider({ visitNoteId: 'vn-1', providerId: 'emp-2', scheduledDate: '2026-08-01', scheduledTime: '10:00' })

    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Chronic back pain' }))
  })

  it('returns an error when the visit note does not exist, without calling createAppointment', async () => {
    const db = { visitNote: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await referToProvider({ visitNoteId: 'missing', providerId: 'emp-2', scheduledDate: '2026-08-01', scheduledTime: '10:00' })

    expect(res.success).toBe(false)
    expect(createAppointment).not.toHaveBeenCalled()
  })

  it('propagates a double-booking conflict from createAppointment instead of swallowing it', async () => {
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'vn-1', patientName: 'Jane Doe', referralReason: null,
          appointment: { customerId: 'cust-1', customerName: 'Jane Doe' },
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(createAppointment).mockResolvedValue({ success: false, error: { code: 'APT-CONFLICT', message: 'Time conflict.' } } as never)

    const res = await referToProvider({ visitNoteId: 'vn-1', providerId: 'emp-2', scheduledDate: '2026-08-01', scheduledTime: '10:00' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('APT-CONFLICT')
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('visit-note.service — listReferralsForVisitNote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists appointments referred FROM this visit note', async () => {
    const db = {
      appointment: {
        findMany: vi.fn().mockResolvedValue([{ id: 'appt-1', appointmentNumber: 'APT-00001', status: 'SCHEDULED' }]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listReferralsForVisitNote('vn-1')

    expect(res.success).toBe(true)
    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { referredFromVisitNoteId: 'vn-1' }
    }))
  })
})
