import { z } from 'zod'

// 2026-09 §12 — Tours & Travels. Two booking flows off one bookingType
// discriminator — separate schemas since CHARTER and SEAT payloads share
// almost no fields.
export const CreateCharterBookingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  vehicleId: z.string().min(1, 'Vehicle is required'),
  tripStartDate: z.string().min(1, 'Trip start date is required'),
  tripEndDate: z.string().optional(),
  pickupLocation: z.string().max(500).optional(),
  dropLocation: z.string().max(500).optional(),
  route: z.string().max(500).optional(),
  packageRate: z.number().nonnegative('Package rate cannot be negative'),
  includedKmPerDay: z.number().nonnegative().optional(),
  includedHoursPerDay: z.number().nonnegative().optional(),
  advanceAmount: z.number().nonnegative().optional(),
  advancePaymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']).optional(),
  referringAgentName: z.string().max(200).optional(),
  commissionType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  commissionValue: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
})

export const CreateSeatBookingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  tourDepartureId: z.string().min(1, 'Tour departure is required'),
  seatsBooked: z.number().int().positive('Seats booked must be at least 1'),
  advanceAmount: z.number().nonnegative().optional(),
  advancePaymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']).optional(),
  referringAgentName: z.string().max(200).optional(),
  commissionType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  commissionValue: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateTripBookingStatusSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  status: z.enum(['BOOKED', 'COMPLETED', 'CANCELLED']),
})

export type CreateCharterBookingPayload = z.infer<typeof CreateCharterBookingSchema>
export type CreateSeatBookingPayload = z.infer<typeof CreateSeatBookingSchema>
