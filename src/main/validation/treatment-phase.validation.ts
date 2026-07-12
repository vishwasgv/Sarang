import { z } from 'zod'

export const CreateTreatmentPhaseSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  phase: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  startDate: z.string().min(1, 'Start date is required'),
  goals: z.string().optional(),
  createdById: z.string().optional(),
  userId: z.string().optional(),
})

export const UpdateTreatmentPhaseSchema = z.object({
  id: z.string().min(1, 'Treatment phase ID is required'),
  phase: z.string().optional(),
  title: z.string().min(1).optional(),
  startDate: z.string().optional(),
  goals: z.string().nullable().optional(),
})

export const CloseTreatmentPhaseSchema = z.object({
  id: z.string().min(1, 'Treatment phase ID is required'),
  outcome: z.string().optional(),
})

export type CreateTreatmentPhasePayload = z.infer<typeof CreateTreatmentPhaseSchema>
export type UpdateTreatmentPhasePayload = z.infer<typeof UpdateTreatmentPhaseSchema>
export type CloseTreatmentPhasePayload = z.infer<typeof CloseTreatmentPhaseSchema>
