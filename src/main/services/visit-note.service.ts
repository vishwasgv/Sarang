import { getPrisma } from '../database/db'
import { computeVitalsFlags } from './normal-range.service'
import { createAppointment } from './appointment.service'

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
    const vitalsFlags = await computeVitalsFlags({
      bpSystolic: payload.bpSystolic, bpDiastolic: payload.bpDiastolic,
      pulseRate: payload.pulseRate, temperatureF: payload.temperatureF,
    })
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

    const existing = await db.visitNote.findUnique({ where: { id: payload.id }, select: { isFinalized: true, bpSystolic: true, bpDiastolic: true, pulseRate: true, temperatureF: true } })
    if (!existing) return { success: false, error: { code: 'VN-003', message: 'Visit note not found.' } }
    if (existing.isFinalized) return { success: false, error: { code: 'VN-003F', message: 'This note has been finalized and cannot be edited.' } }

    const { id, followUpDate, referralDate, painScore, bpSystolic, bpDiastolic, pulseRate, temperatureF, ...rest } = payload
    const anyVitalChanged = bpSystolic !== undefined || bpDiastolic !== undefined || pulseRate !== undefined || temperatureF !== undefined
    const vitalsFlags = anyVitalChanged
      ? await computeVitalsFlags({
          bpSystolic: bpSystolic !== undefined ? bpSystolic : existing.bpSystolic,
          bpDiastolic: bpDiastolic !== undefined ? bpDiastolic : existing.bpDiastolic,
          pulseRate: pulseRate !== undefined ? pulseRate : existing.pulseRate,
          temperatureF: temperatureF !== undefined ? temperatureF : existing.temperatureF,
        })
      : null

    const note = await db.visitNote.update({
      where: { id },
      data: {
        ...rest,
        ...(painScore !== undefined ? { painScore: painScore !== null ? Math.min(10, Math.max(0, Math.round(painScore))) : null } : {}),
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
      where.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
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
        status: true, serviceTitle: true,
        provider: { select: { id: true, fullName: true, specialization: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    })
    return { success: true, data: referrals }
  } catch (err) {
    return { success: false, error: { code: 'VN-008', message: err instanceof Error ? err.message : 'Could not list referrals.' } }
  }
}
