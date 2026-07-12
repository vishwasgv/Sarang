import { z } from 'zod'

export const CreateTreatmentPlanSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  createdById: z.string().optional(),
  userId: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  planItems: z.string().optional(),
  totalEstimatedCost: z.number().nonnegative('Total estimated cost cannot be negative').finite().optional(),
  notes: z.string().optional(),
})

export const UpdateTreatmentPlanSchema = z.object({
  id: z.string().min(1, 'Treatment plan ID is required'),
  title: z.string().optional(),
  status: z.string().optional(),
  planItems: z.string().optional(),
  totalEstimatedCost: z.number().nonnegative('Total estimated cost cannot be negative').finite().optional(),
  notes: z.string().nullable().optional(),
  acceptedDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
})

export type CreateTreatmentPlanPayload = z.infer<typeof CreateTreatmentPlanSchema>
export type UpdateTreatmentPlanPayload = z.infer<typeof UpdateTreatmentPlanSchema>
