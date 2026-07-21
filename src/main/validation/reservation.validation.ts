import { z } from 'zod'

export const EntityIdSchema = z.object({ id: z.string().min(1, 'ID is required') })

export const CreateReservationSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().min(1, 'Phone number is required').max(20),
  partySize: z.number().int().positive('Party size must be at least 1'),
  reservedFor: z.string().min(1, 'Reservation date/time is required'),
  tableId: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export const UpdateReservationStatusSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  status: z.enum(['CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW']),
})

export const ListReservationsSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export type CreateReservationPayload = z.input<typeof CreateReservationSchema>
export type UpdateReservationStatusPayload = z.input<typeof UpdateReservationStatusSchema>
export type ListReservationsPayload = z.input<typeof ListReservationsSchema>
