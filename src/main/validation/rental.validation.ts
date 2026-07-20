import { z } from 'zod'

export const CreateBookingSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  startDateTime: z.string().min(1, 'Start date/time is required'),
  endDateTime: z.string().min(1, 'End date/time is required'),
  securityDepositCollected: z.number().nonnegative('Security deposit cannot be negative').finite().optional(),
  notes: z.string().optional(),
  recurrenceIntervalDays: z.number().int().positive('Recurrence interval must be greater than zero days').finite().optional(),
  parentBookingId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    rateBasis: z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR']),
    quantity: z.number().positive('Quantity must be greater than zero').finite().optional(),
  })).min(1, 'At least one item is required'),
})

export const CheckoutBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  checkoutNotes: z.string().optional(),
  itemConditions: z.array(z.object({
    itemId: z.string().min(1),
    conditionOut: z.string(),
  })).optional(),
})

export const ReturnBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  returnNotes: z.string().optional(),
  damageChargeAmount: z.number().nonnegative('Damage charge cannot be negative').finite().optional(),
  securityDepositRefunded: z.number().nonnegative('Security deposit refunded cannot be negative').finite().optional(),
  itemConditions: z.array(z.object({
    itemId: z.string().min(1),
    conditionIn: z.string().optional(),
    damageChargeAmount: z.number().nonnegative('Damage charge cannot be negative').finite().optional(),
  })).optional(),
})

export const CreateNextRentalCycleSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
})

export const ExtendBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  newEndDateTime: z.string().min(1, 'New end date/time is required'),
})

export const CancelBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  reason: z.string().optional(),
})

export const GenerateRentalInvoiceSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
})

export const CreateRentalUnitSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  unitLabel: z.string().min(1, 'Unit label is required'),
  conditionNotes: z.string().optional(),
  purchaseDate: z.string().optional(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
  serviceIntervalRentals: z.number().int().positive('Service interval (rentals) must be greater than zero').finite().optional(),
  serviceIntervalDays: z.number().int().positive('Service interval (days) must be greater than zero').finite().optional(),
})

export const UpdateRentalUnitSchema = z.object({
  id: z.string().min(1, 'Unit ID is required'),
  unitLabel: z.string().min(1).optional(),
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'RETIRED']).optional(),
  conditionNotes: z.string().optional(),
  serviceIntervalRentals: z.number().int().positive('Service interval (rentals) must be greater than zero').finite().nullable().optional(),
  serviceIntervalDays: z.number().int().positive('Service interval (days) must be greater than zero').finite().nullable().optional(),
})

export const RentalUnitIdSchema = z.object({ id: z.string().min(1, 'Unit ID is required') })

export type CreateBookingPayload = z.infer<typeof CreateBookingSchema>
export type ReturnBookingPayload = z.infer<typeof ReturnBookingSchema>
export type CreateRentalUnitPayload = z.infer<typeof CreateRentalUnitSchema>
export type UpdateRentalUnitPayload = z.infer<typeof UpdateRentalUnitSchema>
