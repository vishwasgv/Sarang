import { getPrisma } from '../database/db'
import { computeVitalsFlags } from './normal-range.service'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { createAppointment } from './appointment.service'

// Phase 58 §2 — Vet Clinic: looked up server-side (never trust a client-sent
// species for a fact that changes how vitals get flagged) so a dog/cat's
// vitals are evaluated against the right NormalRangeReference rows instead
// of always falling back to the generic/human ones.
async function getPetSpeciesForAppointment(db: ReturnType<typeof getPrisma>, appointmentId: string): Promise<string> {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, select: { pet: { select: { species: true } } } })
  return appt?.pet?.species ?? 'ALL'
}

export async function getVisitNote(appointmentId: string) {
  try {
    const db = getPrisma()
    const note = await db.visitNote.findUnique({
      where: { appointmentId },
      include: {
        appointment: {
          select: {
            id: true,
            appointmentNumber: true,
            scheduledDate: true,
            scheduledTime: true,
            serviceTitle: true,
            customerName: true,
            customer: { select: { id: true, customerName: true, phone: true } },
            provider: { select: { id: true, fullName: true, specialization: true } },
            // Phase 58 §2 — Vet Clinic patient context (VisitNoteScreen.tsx)
            pet: { select: { id: true, petName: true, species: true, breed: true, dateOfBirth: true, gender: true } },
          },
        },
      },
    })

    // Write audit log on every view
    if (note) {
      await db.auditLog.create({
        data: { action: 'VIEW', entityType: 'VisitNote', entityId: note.id },
      }).catch(() => {})
    }

    return { success: true, data: note }
  } catch (err) {
    return { success: false, error: { code: 'VN-001', message: err instanceof Error ? err.message : 'Could not fetch visit note.' } }
  }
}

export async function createVisitNote(payload: {
  appointmentId: string
  patientName: string
  patientAge?: string
  chiefComplaint?: string
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  followUpDate?: string
  followUpNotes?: string
  referredBy?: string
  referralDate?: string
  referralReason?: string
  treatmentDone?: string
  painScore?: number | null
  functionalScore?: number | null
  treatmentGiven?: string
  bpSystolic?: number | null
  bpDiastolic?: number | null
  pulseRate?: number | null
  temperatureF?: number | null
  heightCm?: number | null
  weightKg?: number | null
  createdBy: string
}) {
  try {
    const db = getPrisma()
    const species = await getPetSpeciesForAppointment(db, payload.appointmentId)
    const vitalsFlags = await computeVitalsFlags({
      bpSystolic: payload.bpSystolic, bpDiastolic: payload.bpDiastolic,
      pulseRate: payload.pulseRate, temperatureF: payload.temperatureF,
    }, 'ALL', species)
    const note = await db.visitNote.create({
      data: {
        appointmentId: payload.appointmentId,
        patientName: payload.patientName,
        patientAge: payload.patientAge ?? null,
        chiefComplaint: payload.chiefComplaint ?? null,
        subjective: payload.subjective ?? null,
        objective: payload.objective ?? null,
        assessment: payload.assessment ?? null,
        plan: payload.plan ?? null,
        followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null,
        followUpNotes: payload.followUpNotes ?? null,
        referredBy: payload.referredBy ?? null,
        referralDate: payload.referralDate ? new Date(payload.referralDate) : null,
        referralReason: payload.referralReason ?? null,
        treatmentDone: payload.treatmentDone ?? null,
        painScore: payload.painScore != null ? Math.min(10, Math.max(0, Math.round(payload.painScore))) : null,
        functionalScore: payload.functionalScore != null ? Math.min(100, Math.max(0, Math.round(payload.functionalScore))) : null,
        treatmentGiven: payload.treatmentGiven ?? null,
        bpSystolic: payload.bpSystolic ?? null,
        bpDiastolic: payload.bpDiastolic ?? null,
        pulseRate: payload.pulseRate ?? null,
        temperatureF: payload.temperatureF ?? null,
        heightCm: payload.heightCm ?? null,
        weightKg: payload.weightKg ?? null,
        vitalsFlags: Object.keys(vitalsFlags).length > 0 ? JSON.stringify(vitalsFlags) : null,
        createdBy: payload.createdBy,
      },
    })

    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'VisitNote', entityId: note.id, newValue: JSON.stringify({ appointmentId: payload.appointmentId }) },
    }).catch(() => {})

    return { success: true, data: note }
  } catch (err) {
    return { success: false, error: { code: 'VN-002', message: err instanceof Error ? err.message : 'Could not create visit note.' } }
  }
}

export async function updateVisitNote(payload: {
  id: string
  patientName?: string
  patientAge?: string | null
  chiefComplaint?: string | null
  subjective?: string | null
  objective?: string | null
  assessment?: string | null
  plan?: string | null
  followUpDate?: string | null
  followUpNotes?: string | null
  referredBy?: string | null
  referralDate?: string | null
  referralReason?: string | null
  treatmentDone?: string | null
  painScore?: number | null
  functionalScore?: number | null
  treatmentGiven?: string | null
  bpSystolic?: number | null
  bpDiastolic?: number | null
  pulseRate?: number | null
  temperatureF?: number | null
  heightCm?: number | null
  weightKg?: number | null
}) {
  try {
    const db = getPrisma()

    const existing = await db.visitNote.findUnique({
      where: { id: payload.id },
      select: {
        isFinalized: true, bpSystolic: true, bpDiastolic: true, pulseRate: true, temperatureF: true,
        appointment: { select: { pet: { select: { species: true } } } }
      }
    })
    if (!existing) return { success: false, error: { code: 'VN-003', message: 'Visit note not found.' } }
    if (existing.isFinalized) return { success: false, error: { code: 'VN-003F', message: 'This note has been finalized and cannot be edited.' } }

    const { id, followUpDate, referralDate, painScore, functionalScore, bpSystolic, bpDiastolic, pulseRate, temperatureF, ...rest } = payload
    const anyVitalChanged = bpSystolic !== undefined || bpDiastolic !== undefined || pulseRate !== undefined || temperatureF !== undefined
    const species = existing.appointment?.pet?.species ?? 'ALL'
    const vitalsFlags = anyVitalChanged
      ? await computeVitalsFlags({
          bpSystolic: bpSystolic !== undefined ? bpSystolic : existing.bpSystolic,
          bpDiastolic: bpDiastolic !== undefined ? bpDiastolic : existing.bpDiastolic,
          pulseRate: pulseRate !== undefined ? pulseRate : existing.pulseRate,
          temperatureF: temperatureF !== undefined ? temperatureF : existing.temperatureF,
        }, 'ALL', species)
      : null

    const note = await db.visitNote.update({
      where: { id },
      data: {
        ...rest,
        ...(painScore !== undefined ? { painScore: painScore !== null ? Math.min(10, Math.max(0, Math.round(painScore))) : null } : {}),
        ...(functionalScore !== undefined ? { functionalScore: functionalScore !== null ? Math.min(100, Math.max(0, Math.round(functionalScore))) : null } : {}),
        ...(followUpDate !== undefined ? { followUpDate: followUpDate ? new Date(followUpDate) : null } : {}),
        ...(referralDate !== undefined ? { referralDate: referralDate ? new Date(referralDate) : null } : {}),
        ...(bpSystolic !== undefined ? { bpSystolic } : {}),
        ...(bpDiastolic !== undefined ? { bpDiastolic } : {}),
        ...(pulseRate !== undefined ? { pulseRate } : {}),
        ...(temperatureF !== undefined ? { temperatureF } : {}),
        ...(anyVitalChanged ? { vitalsFlags: vitalsFlags && Object.keys(vitalsFlags).length > 0 ? JSON.stringify(vitalsFlags) : null } : {}),
      },
    })

    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'VisitNote', entityId: id },
    }).catch(() => {})

    return { success: true, data: note }
  } catch (err) {
    return { success: false, error: { code: 'VN-003', message: err instanceof Error ? err.message : 'Could not update visit note.' } }
  }
}

export async function finalizeVisitNote(id: string) {
  try {
    const db = getPrisma()

    const existing = await db.visitNote.findUnique({ where: { id }, select: { isFinalized: true } })
    if (!existing) return { success: false, error: { code: 'VN-004', message: 'Visit note not found.' } }
    if (existing.isFinalized) return { success: false, error: { code: 'VN-004', message: 'Already finalized.' } }

    const note = await db.visitNote.update({
      where: { id },
      data: { isFinalized: true, finalizedAt: new Date() },
    })

    await db.auditLog.create({
      data: { action: 'FINALIZE', entityType: 'VisitNote', entityId: id },
    }).catch(() => {})

    return { success: true, data: note }
  } catch (err) {
    return { success: false, error: { code: 'VN-004', message: err instanceof Error ? err.message : 'Could not finalize visit note.' } }
  }
}

export async function listVisitNotes(filters?: {
  providerId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  isFinalized?: boolean
  page?: number
  limit?: number
}) {
  try {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.isFinalized !== undefined) where.isFinalized = filters.isFinalized
    if (filters?.dateFrom || filters?.dateTo) {
      // BUG FOUND 2026-07-22: both bounds used to be new Date(dateString),
      // parsed as UTC midnight instead of local midnight; dateTo also
      // lacked an end-of-day adjustment.
      // Real bug found 2026-07-23: the dateTo fix above still parsed the
      // string as UTC midnight FIRST before setHours() locked in
      // end-of-day — setHours() only rewrites H/M/S/ms, never the
      // Year/Month/Date a UTC parse already got wrong in any negative-UTC-
      // offset timezone. parseLocalDateEnd constructs local end-of-day
      // directly from the string's Y/M/D instead.
      where.createdAt = {
        ...(filters.dateFrom ? { gte: parseLocalDateStart(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: parseLocalDateEnd(filters.dateTo) } : {}),
      }
    }
    if (filters?.search) {
      where.patientName = { contains: filters.search }
    }
    if (filters?.providerId) {
      where.appointment = { providerId: filters.providerId }
    }

    const [total, items] = await Promise.all([
      db.visitNote.count({ where }),
      db.visitNote.findMany({
        where,
        include: {
          appointment: {
            select: {
              id: true,
              scheduledDate: true,
              scheduledTime: true,
              serviceTitle: true,
              provider: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return { success: true, data: { items, total, page, limit } }
  } catch (err) {
    return { success: false, error: { code: 'VN-005', message: err instanceof Error ? err.message : 'Could not list visit notes.' } }
  }
}

// Real in-app referral routing (Phase 54F / F.11) — previously "referral" on a
// visit note was two free-text fields (referredBy/referralReason) recording
// who referred the patient TO this note, with no mechanism for the reverse
// case: this provider sending the patient ON to another provider in the same
// clinic. This creates a real Appointment for the receiving provider (through
// the same createAppointment used everywhere else — double-booking
// prevention, atomic numbering, all of it — nothing bespoke), linked back via
// Appointment.referredFromVisitNoteId so the referring provider can see it
// was actually booked, not just noted down.
export async function referToProvider(payload: {
  visitNoteId: string
  providerId: string
  serviceCatalogId?: string
  serviceTitle?: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes?: number
  reason?: string
  createdBy?: string
}) {
  try {
    const db = getPrisma()
    const note = await db.visitNote.findUnique({
      where: { id: payload.visitNoteId },
      include: { appointment: { select: { customerId: true, customerName: true } } },
    })
    if (!note) return { success: false, error: { code: 'VN-006', message: 'Visit note not found.' } }

    const result = await createAppointment({
      customerId: note.appointment.customerId ?? undefined,
      customerName: note.appointment.customerName ?? note.patientName,
      providerId: payload.providerId,
      serviceCatalogId: payload.serviceCatalogId,
      serviceTitle: payload.serviceTitle ?? 'Specialist Referral',
      scheduledDate: payload.scheduledDate,
      scheduledTime: payload.scheduledTime,
      durationMinutes: payload.durationMinutes,
      notes: payload.reason ?? note.referralReason ?? undefined,
      createdBy: payload.createdBy,
      referredFromVisitNoteId: payload.visitNoteId,
    })
    if (!result.success) return result

    await db.auditLog.create({
      data: { action: 'REFERRED', entityType: 'VisitNote', entityId: payload.visitNoteId, newValue: JSON.stringify({ referredToProviderId: payload.providerId }) },
    }).catch(() => {})

    return result
  } catch (err) {
    return { success: false, error: { code: 'VN-007', message: err instanceof Error ? err.message : 'Could not create referral appointment.' } }
  }
}

// Appointments booked FROM this visit note's "refer to another provider"
// action — so the referring provider can see whether the patient actually
// got booked in, and with which provider/status.
export async function listReferralsForVisitNote(visitNoteId: string) {
  try {
    const db = getPrisma()
    const referrals = await db.appointment.findMany({
      where: { referredFromVisitNoteId: visitNoteId },
      select: {
        id: true, appointmentNumber: true, scheduledDate: true, scheduledTime: true,
        status: true, serviceTitle: true, notes: true,
        provider: { select: { id: true, fullName: true, specialization: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    })
    return { success: true, data: referrals }
  } catch (err) {
    return { success: false, error: { code: 'VN-008', message: err instanceof Error ? err.message : 'Could not list referrals.' } }
  }
}

// Phase 58 §2 — GP/Specialist Clinic: structured prescription, one row per
// drug — distinct from the free-text `plan` field. Edited as a whole list
// while drafting (same UX as a BOM editor), so saving replaces the full set
// atomically rather than exposing per-row add/remove IPC calls.
export async function listPrescriptionItems(visitNoteId: string) {
  try {
    const db = getPrisma()
    const items = await db.prescriptionItem.findMany({
      where: { visitNoteId },
      orderBy: { sequence: 'asc' },
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'VN-009', message: err instanceof Error ? err.message : 'Could not list prescription items.' } }
  }
}

export async function savePrescriptionItems(
  visitNoteId: string,
  items: Array<{ drugName: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }>
) {
  try {
    const db = getPrisma()
    const note = await db.visitNote.findUnique({ where: { id: visitNoteId }, select: { isFinalized: true } })
    if (!note) return { success: false, error: { code: 'VN-010', message: 'Visit note not found.' } }
    if (note.isFinalized) return { success: false, error: { code: 'VN-010F', message: 'This note has been finalized and cannot be edited.' } }

    const saved = await db.$transaction(async (tx) => {
      await tx.prescriptionItem.deleteMany({ where: { visitNoteId } })
      if (items.length === 0) return []
      await tx.prescriptionItem.createMany({
        data: items.map((it, i) => ({
          visitNoteId,
          drugName: it.drugName,
          dosage: it.dosage ?? null,
          frequency: it.frequency ?? null,
          duration: it.duration ?? null,
          instructions: it.instructions ?? null,
          sequence: i,
        })),
      })
      return tx.prescriptionItem.findMany({ where: { visitNoteId }, orderBy: { sequence: 'asc' } })
    })

    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'VisitNote', entityId: visitNoteId, newValue: JSON.stringify({ prescriptionItemCount: items.length }) },
    }).catch(() => {})

    return { success: true, data: saved }
  } catch (err) {
    return { success: false, error: { code: 'VN-011', message: err instanceof Error ? err.message : 'Could not save prescription items.' } }
  }
}

// Phase 58 §2 — GP/Specialist Clinic (and reusable by any visit_notes
// vertical): vitals trend across a patient's OWN prior visits, same "chart
// a value across time" pattern already built for pet weight
// (PetProfileScreen.tsx's WeightChart). "Same patient" means the same
// linked Pet for a vet visit, or the same Customer otherwise — VisitNote has
// no dedicated Patient entity of its own, so this walks back through the
// owning Appointment's identity field.
export async function getVitalsTrend(appointmentId: string) {
  try {
    const db = getPrisma()
    const appt = await db.appointment.findUnique({
      where: { id: appointmentId },
      select: { customerId: true, petId: true },
    })
    if (!appt) return { success: false, error: { code: 'VN-012', message: 'Appointment not found.' } }
    if (!appt.customerId && !appt.petId) return { success: true, data: [] }

    const notes = await db.visitNote.findMany({
      where: {
        appointment: appt.petId ? { petId: appt.petId } : { customerId: appt.customerId },
      },
      select: {
        bpSystolic: true, bpDiastolic: true, pulseRate: true, temperatureF: true, weightKg: true,
        // Phase 58 §2 — Physio Clinic: outcome measures trended the same way as vitals.
        painScore: true, functionalScore: true,
        appointment: { select: { scheduledDate: true } },
      },
      orderBy: { appointment: { scheduledDate: 'asc' } },
    })

    const trend = notes
      .filter((n) => n.bpSystolic != null || n.bpDiastolic != null || n.pulseRate != null || n.temperatureF != null || n.weightKg != null || n.painScore != null || n.functionalScore != null)
      .map((n) => ({
        date: n.appointment.scheduledDate,
        bpSystolic: n.bpSystolic, bpDiastolic: n.bpDiastolic, pulseRate: n.pulseRate,
        temperatureF: n.temperatureF, weightKg: n.weightKg,
        painScore: n.painScore, functionalScore: n.functionalScore,
      }))

    return { success: true, data: trend }
  } catch (err) {
    return { success: false, error: { code: 'VN-013', message: err instanceof Error ? err.message : 'Could not compute vitals trend.' } }
  }
}
