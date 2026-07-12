import { z } from 'zod'

export const UpsertRecallSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  recallType: z.string().min(1, 'Recall type is required'),
  lastVisitDate: z.string().min(1, 'Last visit date is required'),
  nextRecallDate: z.string().min(1, 'Next recall date is required'),
  notes: z.string().nullable().optional(),
})

export type UpsertRecallPayload = z.infer<typeof UpsertRecallSchema>
