import { z } from 'zod'

export const CreateTailoringOrderSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  measurementRecordId: z.string().optional(),
  garmentType: z.string().min(1, 'Garment type is required'),
  gender: z.string().optional(),
  styleRegion: z.string().optional(),
  fabricDescription: z.string().optional(),
  fabricSupplied: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than zero').int().optional(),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').finite(),
  advancePaid: z.number().nonnegative('Advance paid cannot be negative').finite().optional(),
  trialDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  assignedToId: z.string().optional(),
  specialInstructions: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateTailoringOrderSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
  measurementRecordId: z.string().nullable().optional(),
  garmentType: z.string().min(1).optional(),
  gender: z.string().nullable().optional(),
  styleRegion: z.string().nullable().optional(),
  fabricDescription: z.string().nullable().optional(),
  fabricSupplied: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than zero').int().optional(),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').finite().optional(),
  advancePaid: z.number().nonnegative('Advance paid cannot be negative').finite().optional(),
  trialDate: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  deliveredDate: z.string().nullable().optional(),
  status: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const TailoringOrderIdSchema = z.string().min(1, 'Order ID is required')

export type CreateTailoringOrderPayload = z.infer<typeof CreateTailoringOrderSchema>
export type UpdateTailoringOrderPayload = z.infer<typeof UpdateTailoringOrderSchema>
