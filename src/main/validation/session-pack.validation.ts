import { z } from 'zod'

export const CreatePackSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  packName: z.string().min(1, 'Pack name is required'),
  totalSessions: z.number().int().positive('Total sessions must be greater than zero'),
  purchaseDate: z.string().optional(),
  expiryDate: z.string().nullable().optional(),
  pricePerPack: z.number().nonnegative('Price per pack cannot be negative').finite().optional(),
  taxRate: z.number().nonnegative('Tax rate cannot be negative').finite().optional(),
  sacCode: z.string().optional(),
  notes: z.string().optional(),
  // Phase 58 §2 — Gym/Studio: standing trainer for this PT package.
  assignedTrainerId: z.string().optional(),
})

export const AssignPackTrainerSchema = z.object({
  packId: z.string().min(1, 'packId is required'),
  trainerId: z.string().nullable(),
})

export const DeductSessionSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  appointmentId: z.string().optional(),
})

export const GenerateSessionPackInvoiceSchema = z.object({
  id: z.string().min(1, 'Session pack ID is required'),
})

export type CreatePackPayload = z.infer<typeof CreatePackSchema>
export type DeductSessionPayload = z.infer<typeof DeductSessionSchema>
export type GenerateSessionPackInvoicePayload = z.infer<typeof GenerateSessionPackInvoiceSchema>
