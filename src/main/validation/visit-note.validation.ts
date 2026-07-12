import { z } from 'zod'

const vitalsShape = {
  painScore: z.number().nonnegative('Pain score cannot be negative').nullable().optional(),
  bpSystolic: z.number().nonnegative('Systolic BP cannot be negative').nullable().optional(),
  bpDiastolic: z.number().nonnegative('Diastolic BP cannot be negative').nullable().optional(),
  pulseRate: z.number().nonnegative('Pulse rate cannot be negative').nullable().optional(),
  temperatureF: z.number().nonnegative('Temperature cannot be negative').nullable().optional(),
  heightCm: z.number().nonnegative('Height cannot be negative').nullable().optional(),
  weightKg: z.number().nonnegative('Weight cannot be negative').nullable().optional(),
}

export const CreateVisitNoteSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment is required'),
  patientName: z.string().min(1, 'Patient name is required'),
  patientAge: z.string().optional(),
  chiefComplaint: z.string().optional(),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpNotes: z.string().optional(),
  referredBy: z.string().optional(),
  referralDate: z.string().optional(),
  referralReason: z.string().optional(),
  treatmentDone: z.string().optional(),
  treatmentGiven: z.string().optional(),
  ...vitalsShape,
})

export const UpdateVisitNoteSchema = z.object({
  id: z.string().min(1, 'Visit note ID is required'),
  patientName: z.string().min(1).optional(),
  patientAge: z.string().nullable().optional(),
  chiefComplaint: z.string().nullable().optional(),
  subjective: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  assessment: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  followUpNotes: z.string().nullable().optional(),
  referredBy: z.string().nullable().optional(),
  referralDate: z.string().nullable().optional(),
  referralReason: z.string().nullable().optional(),
  treatmentDone: z.string().nullable().optional(),
  treatmentGiven: z.string().nullable().optional(),
  ...vitalsShape,
})

export const FinalizeVisitNoteSchema = z.object({
  id: z.string().min(1, 'Visit note ID is required'),
})

export const ReferToProviderSchema = z.object({
  visitNoteId: z.string().min(1, 'Visit note is required'),
  providerId: z.string().min(1, 'Provider is required'),
  serviceCatalogId: z.string().optional(),
  serviceTitle: z.string().optional(),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  durationMinutes: z.number().positive('Duration must be greater than zero').optional(),
  reason: z.string().optional(),
})

export type CreateVisitNotePayload = z.infer<typeof CreateVisitNoteSchema>
export type UpdateVisitNotePayload = z.infer<typeof UpdateVisitNoteSchema>
export type FinalizeVisitNotePayload = z.infer<typeof FinalizeVisitNoteSchema>
export type ReferToProviderPayload = z.infer<typeof ReferToProviderSchema>
