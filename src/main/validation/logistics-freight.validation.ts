import { z } from 'zod'

export const CreateFreightEntrySchema = z.object({
  shipmentId: z.string().optional(),
  carrierId: z.string().optional(),
  carrierName: z.string().max(255).optional(),
  referenceNumber: z.string().max(100).optional(),
  amount: z.number().positive('Amount must be greater than zero'),
  paidBy: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateFreightEntrySchema = z.object({
  id: z.string().min(1, 'Freight entry ID is required'),
  carrierId: z.string().nullable().optional(),
  carrierName: z.string().max(255).optional(),
  referenceNumber: z.string().max(100).optional(),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  paidBy: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
})

export const MarkFreightPaidSchema = z.object({
  id: z.string().min(1, 'Freight entry ID is required'),
  paidBy: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
})

export type CreateFreightEntryPayload = z.infer<typeof CreateFreightEntrySchema>
export type UpdateFreightEntryPayload = z.infer<typeof UpdateFreightEntrySchema>
export type MarkFreightPaidPayload = z.infer<typeof MarkFreightPaidSchema>
