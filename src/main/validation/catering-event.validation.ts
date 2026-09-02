import { z } from 'zod'

const CateringEventMenuItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
})

const CateringEventDayInputSchema = z.object({
  serviceDate: z.string().min(1, 'Service date is required'),
  mealsCount: z.number().int().nonnegative().optional(),
  snacksCount: z.number().int().nonnegative().optional(),
})

const CateringEventStaffInputSchema = z.object({
  role: z.enum(['COOK', 'SERVER', 'CLEANER', 'OTHER']),
  workerCount: z.number().int().positive('Worker count must be greater than zero'),
  ratePerWorker: z.number().nonnegative('Rate per worker cannot be negative'),
  serviceDate: z.string().optional(),
})

export const CreateCateringEventSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  eventStartDate: z.string().min(1, 'Event start date is required'),
  eventEndDate: z.string().optional(),
  venueAddress: z.string().max(500).optional(),
  attendeeCount: z.number().int().positive('Attendee count must be greater than zero'),
  pricePerPlate: z.number().nonnegative('Price per plate cannot be negative'),
  advanceAmount: z.number().nonnegative().optional(),
  advancePaymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']).optional(),
  notes: z.string().max(2000).optional(),
  menuItems: z.array(CateringEventMenuItemInputSchema).optional(),
  days: z.array(CateringEventDayInputSchema).optional(),
  staff: z.array(CateringEventStaffInputSchema).optional(),
})

export const RecordFinalNegotiatedPriceSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  finalNegotiatedPrice: z.number().nonnegative('Final negotiated price cannot be negative'),
})

export const UpdateCateringEventStatusSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  status: z.enum(['BOOKED', 'COMPLETED', 'CANCELLED']),
})

export type CreateCateringEventPayload = z.infer<typeof CreateCateringEventSchema>
export type RecordFinalNegotiatedPricePayload = z.infer<typeof RecordFinalNegotiatedPriceSchema>
export type UpdateCateringEventStatusPayload = z.infer<typeof UpdateCateringEventStatusSchema>
