import { z } from 'zod'

export const CreateTokenSchema = z.object({
  patientName: z.string().min(1, 'Patient name is required'),
  age: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  appointmentId: z.string().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
})

export const TokenQueueIdSchema = z.object({
  id: z.string().min(1, 'Token ID is required'),
})

export type CreateTokenPayload = z.infer<typeof CreateTokenSchema>
export type TokenQueueIdPayload = z.infer<typeof TokenQueueIdSchema>
