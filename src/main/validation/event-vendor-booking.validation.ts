import { z } from 'zod'

export const CreateVendorBookingSchema = z.object({
  eventId: z.string().min(1, 'Event is required'),
  vendorId: z.string().min(1, 'Vendor is required'),
  vendorCategory: z.string().min(1, 'Vendor category is required'),
  pricingType: z.enum(['FLAT', 'PER_HEAD']).optional(),
  quotedAmount: z.number().finite().nonnegative('Quoted amount cannot be negative').optional(),
  perHeadRate: z.number().finite().nonnegative('Per-head rate cannot be negative').optional(),
  advancePaid: z.number().finite().nonnegative('Advance paid cannot be negative').optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateVendorBookingSchema = z.object({
  id: z.string().min(1, 'Vendor booking ID is required'),
  vendorCategory: z.string().min(1).optional(),
  pricingType: z.enum(['FLAT', 'PER_HEAD']).optional(),
  quotedAmount: z.number().finite().nonnegative('Quoted amount cannot be negative').optional(),
  perHeadRate: z.number().finite().nonnegative('Per-head rate cannot be negative').optional(),
  advancePaid: z.number().finite().nonnegative('Advance paid cannot be negative').optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const VendorBookingIdSchema = z.string().min(1, 'Vendor booking ID is required')

export type CreateVendorBookingPayload = z.infer<typeof CreateVendorBookingSchema>
export type UpdateVendorBookingPayload = z.infer<typeof UpdateVendorBookingSchema>
