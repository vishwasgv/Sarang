import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../normal-range.service', () => ({ computeVitalsFlags: vi.fn() }))
vi.mock('../appointment.service', () => ({ createAppointment: vi.fn() }))

import { getPrisma } from '../../database/db'
import { computeVitalsFlags } from '../normal-range.service'
import { createAppointment } from '../appointment.service'
import {
  createVisitNote, updateVisitNote, referToProvider, listReferralsForVisitNote,
  listPrescriptionItems, savePrescriptionItems, getVitalsTrend,
} from '../visit-note.service'

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
      appointment: { findUnique: vi.fn().mockResolvedValue(null) }, // no linked pet -> species 'ALL'
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({ bpSystolic: 'HIGH' })

    await createVisitNote({
      appointmentId: 'appt-1', patientName: 'John Doe',
      bpSystolic: 150, bpDiastolic: 80, createdBy: 'user-1',
    })

    expect(computeVitalsFlags).toHaveBeenCalledWith({ bpSystolic: 150, bpDiastolic: 80, pulseRate: undefined, temperatureF: undefined }, 'ALL', 'ALL')
    const call = vi.mocked(db.visitNote.create).mock.calls[0][0] as { data: { vitalsFlags: string | null } }
    expect(JSON.parse(call.data.vitalsFlags!)).toEqual({ bpSystolic: 'HIGH' })
  })

  it('stores vitalsFlags as null when no vital is out of range', async () => {
    const db = {
      visitNote: { create: vi.fn().mockResolvedValue(makeVisitNote()) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      appointment: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({})

    await createVisitNote({ appointmentId: 'appt-1', patientName: 'John Doe', bpSystolic: 110, createdBy: 'user-1' })

    const call = vi.mocked(db.visitNote.create).mock.calls[0][0] as { data: { vitalsFlags: string | null } }
    expect(call.data.vitalsFlags).toBeNull()
  })

  it('Phase 58 §2 — looks up the linked pet\'s species server-side and threads it into the vitals computation', async () => {
    const db = {
      visitNote: { create: vi.fn().mockResolvedValue(makeVisitNote()) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      appointment: { findUnique: vi.fn().mockResolvedValue({ pet: { species: 'Dog' } }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({})

    await createVisitNote({ appointmentId: 'appt-vet-1', patientName: 'Rex', temperatureF: 101.5, createdBy: 'user-1' })

    expect(computeVitalsFlags).toHaveBeenCalledWith(expect.objectContaining({ temperatureF: 101.5 }), 'ALL', 'Dog')
  })
})

// Phase 58 §2 — Physio Clinic: structured functional outcome measure,
// clamped to 0-100 the same way painScore is already clamped to 0-10.
describe('visit-note.service — functionalScore (Physio Clinic outcome measure)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores a valid functionalScore as-is on create', async () => {
    const db = {
      visitNote: { create: vi.fn().mockResolvedValue(makeVisitNote()) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      appointment: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({})

    await createVisitNote({ appointmentId: 'appt-1', patientName: 'Jane Doe', functionalScore: 65, createdBy: 'user-1' })

    const call = vi.mocked(db.visitNote.create).mock.calls[0][0] as { data: { functionalScore: number | null } }
    expect(call.data.functionalScore).toBe(65)
  })

  it('clamps an out-of-range functionalScore to 0-100 on create', async () => {
    const db = {
      visitNote: { create: vi.fn().mockResolvedValue(makeVisitNote()) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      appointment: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({})

    await createVisitNote({ appointmentId: 'appt-1', patientName: 'Jane Doe', functionalScore: 150, createdBy: 'user-1' })

    const call = vi.mocked(db.visitNote.create).mock.calls[0][0] as { data: { functionalScore: number | null } }
    expect(call.data.functionalScore).toBe(100)
  })

  it('updates functionalScore without disturbing an unrelated vitalsFlags recompute', async () => {
    const existing = makeVisitNote({ appointment: null })
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(makeVisitNote()),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateVisitNote({ id: 'vn-1', functionalScore: 82 })

    const call = vi.mocked(db.visitNote.update).mock.calls[0][0] as { data: { functionalScore?: number } }
    expect(call.data.functionalScore).toBe(82)
    expect(computeVitalsFlags).not.toHaveBeenCalled()
  })

  it('clears functionalScore by passing null', async () => {
    const existing = makeVisitNote({ appointment: null })
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(makeVisitNote()),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateVisitNote({ id: 'vn-1', functionalScore: null })

    const call = vi.mocked(db.visitNote.update).mock.calls[0][0] as { data: { functionalScore: number | null } }
    expect(call.data.functionalScore).toBeNull()
  })
})

describe('visit-note.service — updateVisitNote vitals', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recomputes flags using the changed vital merged with the previously saved ones', async () => {
    const existing = makeVisitNote({ bpSystolic: 120, bpDiastolic: 80, pulseRate: 72, temperatureF: 98.6, appointment: null })
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
    expect(computeVitalsFlags).toHaveBeenCalledWith({ bpSystolic: 120, bpDiastolic: 95, pulseRate: 72, temperatureF: 98.6 }, 'ALL', 'ALL')
  })

  it('Phase 58 §2 — recomputes using the linked pet\'s species (not the generic default)', async () => {
    const existing = makeVisitNote({ bpSystolic: 120, bpDiastolic: 80, pulseRate: 72, temperatureF: 98.6, appointment: { pet: { species: 'Cat' } } })
    const db = {
      visitNote: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(makeVisitNote()),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(computeVitalsFlags).mockResolvedValue({})

    await updateVisitNote({ id: 'vn-1', temperatureF: 101 })

    expect(computeVitalsFlags).toHaveBeenCalledWith(expect.objectContaining({ temperatureF: 101 }), 'ALL', 'Cat')
  })

  it('does not touch vitalsFlags at all when no vital field is part of the update', async () => {
    const existing = makeVisitNote({ appointment: null })
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
      visitNote: { findUnique: vi.fn().mockResolvedValue(makeVisitNote({ isFinalized: true, appointment: null })) },
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

// Phase 58 §2 — GP/Specialist Clinic: structured prescription, one row per
// drug, distinct from the free-text `plan` field.
describe('visit-note.service — listPrescriptionItems / savePrescriptionItems', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists items in sequence order', async () => {
    const db = {
      prescriptionItem: {
        findMany: vi.fn().mockResolvedValue([{ id: 'rx-1', drugName: 'Amoxicillin', sequence: 0 }]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listPrescriptionItems('vn-1')

    expect(res.success).toBe(true)
    expect(db.prescriptionItem.findMany).toHaveBeenCalledWith({ where: { visitNoteId: 'vn-1' }, orderBy: { sequence: 'asc' } })
  })

  it('replaces the full item set atomically inside a transaction (delete-then-recreate)', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 })
    const createMany = vi.fn().mockResolvedValue({ count: 2 })
    const findMany = vi.fn().mockResolvedValue([
      { id: 'rx-1', drugName: 'Amoxicillin', sequence: 0 },
      { id: 'rx-2', drugName: 'Paracetamol', sequence: 1 },
    ])
    const db = {
      visitNote: { findUnique: vi.fn().mockResolvedValue({ isFinalized: false }) },
      prescriptionItem: { deleteMany, createMany, findMany },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(db)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await savePrescriptionItems('vn-1', [
      { drugName: 'Amoxicillin', dosage: '500mg', frequency: '1-0-1', duration: '5 days' },
      { drugName: 'Paracetamol', dosage: '650mg' },
    ])

    expect(res.success).toBe(true)
    expect(deleteMany).toHaveBeenCalledWith({ where: { visitNoteId: 'vn-1' } })
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { visitNoteId: 'vn-1', drugName: 'Amoxicillin', dosage: '500mg', frequency: '1-0-1', duration: '5 days', instructions: null, sequence: 0 },
        { visitNoteId: 'vn-1', drugName: 'Paracetamol', dosage: '650mg', frequency: null, duration: null, instructions: null, sequence: 1 },
      ],
    })
  })

  it('saving an empty list clears all items without calling createMany', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
    const createMany = vi.fn()
    const db = {
      visitNote: { findUnique: vi.fn().mockResolvedValue({ isFinalized: false }) },
      prescriptionItem: { deleteMany, createMany, findMany: vi.fn() },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(db)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await savePrescriptionItems('vn-1', [])

    expect(res.success).toBe(true)
    expect(deleteMany).toHaveBeenCalled()
    expect(createMany).not.toHaveBeenCalled()
  })

  it('rejects saving prescription items on a finalized note', async () => {
    const db = {
      visitNote: { findUnique: vi.fn().mockResolvedValue({ isFinalized: true }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await savePrescriptionItems('vn-1', [{ drugName: 'Amoxicillin' }])

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('VN-010F')
  })

  it('returns not-found for a nonexistent visit note', async () => {
    const db = { visitNote: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await savePrescriptionItems('missing', [{ drugName: 'Amoxicillin' }])

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('VN-010')
  })
})

// Phase 58 §2 — vitals trend across a patient's prior visits, same
// "chart a value across time" pattern already built for pet weight.
describe('visit-note.service — getVitalsTrend', () => {
  beforeEach(() => vi.clearAllMocks())

  it('traces the same patient via the linked pet when the appointment has one (Vet Clinic)', async () => {
    const db = {
      appointment: { findUnique: vi.fn().mockResolvedValue({ customerId: 'cust-1', petId: 'pet-1' }) },
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { bpSystolic: null, bpDiastolic: null, pulseRate: null, temperatureF: 101.0, weightKg: null, appointment: { scheduledDate: '2026-01-01' } },
          { bpSystolic: null, bpDiastolic: null, pulseRate: null, temperatureF: 101.8, weightKg: null, appointment: { scheduledDate: '2026-02-01' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVitalsTrend('appt-1')

    expect(res.success).toBe(true)
    expect(db.visitNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { appointment: { petId: 'pet-1' } },
    }))
    expect((res.data as Array<{ temperatureF: number | null }>)).toHaveLength(2)
  })

  it('traces the same patient via customerId when there is no linked pet (GP/Specialist Clinic)', async () => {
    const db = {
      appointment: { findUnique: vi.fn().mockResolvedValue({ customerId: 'cust-1', petId: null }) },
      visitNote: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getVitalsTrend('appt-1')

    expect(db.visitNote.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { appointment: { customerId: 'cust-1' } },
    }))
  })

  it('drops visits where every vital is null, so a flat SOAP-only visit does not pollute the trend', async () => {
    const db = {
      appointment: { findUnique: vi.fn().mockResolvedValue({ customerId: 'cust-1', petId: null }) },
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { bpSystolic: null, bpDiastolic: null, pulseRate: null, temperatureF: null, weightKg: null, appointment: { scheduledDate: '2026-01-01' } },
          { bpSystolic: 120, bpDiastolic: 80, pulseRate: null, temperatureF: null, weightKg: null, appointment: { scheduledDate: '2026-02-01' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVitalsTrend('appt-1')

    expect((res.data as unknown[])).toHaveLength(1)
  })

  it('returns an empty trend without querying when the appointment has neither a customer nor a pet', async () => {
    const db = { appointment: { findUnique: vi.fn().mockResolvedValue({ customerId: null, petId: null }) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVitalsTrend('appt-1')

    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  it('returns not-found for a nonexistent appointment', async () => {
    const db = { appointment: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVitalsTrend('missing')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('VN-012')
  })

  // Phase 58 §2 — Physio Clinic: pain score and the new functional score
  // are trended through the exact same mechanism as the physiological vitals.
  it('includes painScore/functionalScore in the trend, and a visit with ONLY an outcome measure still counts (not dropped)', async () => {
    const db = {
      appointment: { findUnique: vi.fn().mockResolvedValue({ customerId: 'cust-1', petId: null }) },
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { bpSystolic: null, bpDiastolic: null, pulseRate: null, temperatureF: null, weightKg: null, painScore: 7, functionalScore: 40, appointment: { scheduledDate: '2026-01-01' } },
          { bpSystolic: null, bpDiastolic: null, pulseRate: null, temperatureF: null, weightKg: null, painScore: 3, functionalScore: 75, appointment: { scheduledDate: '2026-02-01' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVitalsTrend('appt-1')

    expect(res.success).toBe(true)
    const data = res.data as Array<{ painScore: number | null; functionalScore: number | null }>
    expect(data).toHaveLength(2)
    expect(data[0]).toEqual(expect.objectContaining({ painScore: 7, functionalScore: 40 }))
    expect(data[1]).toEqual(expect.objectContaining({ painScore: 3, functionalScore: 75 }))
  })
})
