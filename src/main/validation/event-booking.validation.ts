import { z } from 'zod'

export const CreateEventBookingSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  eventName: z.string().min(1, 'Event name is required'),
  eventType: z.string().min(1, 'Event type is required'),
  eventDate: z.string().min(1, 'Event date is required'),
  eventEndDate: z.string().optional(),
  venueName: z.string().min(1, 'Venue name is required'),
  venueAddress: z.string().max(500).optional(),
  expectedGuestCount: z.number().finite().nonnegative('Expected guest count cannot be negative').optional(),
  clientBudget: z.number().finite().nonnegative('Client budget cannot be negative').optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateEventBookingSchema = z.object({
  id: z.string().min(1, 'Event booking ID is required'),
  eventName: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  eventDate: z.string().optional(),
  eventEndDate: z.string().nullable().optional(),
  venueName: z.string().min(1).optional(),
  venueAddress: z.string().max(500).nullable().optional(),
  expectedGuestCount: z.number().finite().nonnegative('Expected guest count cannot be negative').nullable().optional(),
  clientBudget: z.number().finite().nonnegative('Client budget cannot be negative').nullable().optional(),
  finalAmount: z.number().finite().nonnegative('Final amount cannot be negative').nullable().optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const EventBookingIdSchema = z.string().min(1, 'Event booking ID is required')

export type CreateEventBookingPayload = z.infer<typeof CreateEventBookingSchema>
export type UpdateEventBookingPayload = z.infer<typeof UpdateEventBookingSchema>
