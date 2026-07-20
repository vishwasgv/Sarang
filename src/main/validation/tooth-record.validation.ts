import { z } from 'zod'

export const UpsertToothSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  toothNumber: z.number().int().positive('Tooth number must be a positive integer'),
  condition: z.string().min(1, 'Condition is required'),
  surface: z.string().optional(),
  notes: z.string().nullable().optional(),
  recordedById: z.string().optional(),
  userId: z.string().optional(),
})

// Phase 58 §2 — Dental Clinic: per-tooth chronological history
export const GetToothHistorySchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  toothNumber: z.number().int().positive('Tooth number must be a positive integer'),
})

export type UpsertToothPayload = z.infer<typeof UpsertToothSchema>
