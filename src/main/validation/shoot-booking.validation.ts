import { z } from 'zod'

export const CreateShootBookingSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  shootType: z.string().min(1, 'Shoot type is required'),
  shootDate: z.string().min(1, 'Shoot date is required'),
  shootTime: z.string().optional(),
  shootLocation: z.string().min(1, 'Shoot location is required'),
  estimatedDurationHours: z.number().positive('Estimated duration must be greater than zero'),
  deliverableType: z.string().optional(),
  expectedPhotosCount: z.number().nonnegative('Expected photos count cannot be negative').int().optional(),
  deliveryDeadline: z.string().optional(),
  photographerIds: z.array(z.string()).optional(),
  editorAssignedId: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateShootBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  shootType: z.string().min(1).optional(),
  shootDate: z.string().optional(),
  shootTime: z.string().nullable().optional(),
  shootLocation: z.string().min(1).optional(),
  estimatedDurationHours: z.number().positive('Estimated duration must be greater than zero').optional(),
  deliverableType: z.string().optional(),
  expectedPhotosCount: z.number().nonnegative('Expected photos count cannot be negative').int().nullable().optional(),
  deliveryDeadline: z.string().nullable().optional(),
  photographerIds: z.array(z.string()).optional(),
  editorAssignedId: z.string().nullable().optional(),
  status: z.string().optional(),
  finalAmount: z.number().nonnegative('Final amount cannot be negative').finite().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const ShootBookingIdSchema = z.string().min(1, 'Booking ID is required')

export type CreateShootBookingPayload = z.infer<typeof CreateShootBookingSchema>
export type UpdateShootBookingPayload = z.infer<typeof UpdateShootBookingSchema>
