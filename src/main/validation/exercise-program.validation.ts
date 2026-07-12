import { z } from 'zod'

export const UpsertProgramSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  title: z.string().max(255).optional(),
  exercises: z.string().min(1, 'Exercises are required'),
})

export const MarkProgramPrintedSchema = z.object({
  id: z.string().min(1, 'Program ID is required'),
})

export type UpsertProgramPayload = z.infer<typeof UpsertProgramSchema>
