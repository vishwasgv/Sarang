import { z } from 'zod'

export const UpsertChronicConditionSchema = z.object({
  id: z.string().optional(),
  patientId: z.string().min(1, 'Patient is required'),
  conditionName: z.string().min(1, 'Condition name is required'),
  diagnosedDate: z.string().nullable().optional(),
  lastVisitDate: z.string().min(1, 'Last visit date is required'),
  nextRecallDate: z.string().min(1, 'Next recall date is required'),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

export type UpsertChronicConditionPayload = z.infer<typeof UpsertChronicConditionSchema>
