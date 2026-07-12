import { z } from 'zod'

export const CreateRoomSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required').max(20),
  roomType: z.string().min(1, 'Room type is required').max(50),
  floor: z.string().max(20).optional(),
  maxOccupancy: z.number().int().positive('Max occupancy must be greater than zero').finite().optional(),
  baseRate: z.number().nonnegative('Base rate cannot be negative').finite().optional(),
  amenities: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateRoomSchema = z.object({
  id: z.string().min(1, 'Room ID is required'),
  roomType: z.string().min(1).max(50).optional(),
  floor: z.string().max(20).optional(),
  maxOccupancy: z.number().int().positive('Max occupancy must be greater than zero').finite().optional(),
  baseRate: z.number().nonnegative('Base rate cannot be negative').finite().optional(),
  status: z.enum(['AVAILABLE', 'CLEANING', 'MAINTENANCE', 'OUT_OF_ORDER']).optional(),
  amenities: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
})

export const HotelRoomIdSchema = z.object({ id: z.string().min(1, 'Room ID is required') })

export const CheckAvailabilitySchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  excludeBookingId: z.string().optional(),
})

export const ListAvailableRoomsSchema = z.object({
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  roomType: z.string().optional(),
})

export const CreateHotelBookingSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  customerId: z.string().optional(),
  guestName: z.string().min(1, 'Guest name is required').max(200),
  guestPhone: z.string().max(30).optional(),
  guestEmail: z.string().email('Invalid email address').max(200).optional().or(z.literal('')),
  numberOfGuests: z.number().int().positive('Number of guests must be greater than zero').finite().optional(),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  ratePerNight: z.number().nonnegative('Rate per night cannot be negative').finite().optional(),
  advanceAmount: z.number().nonnegative('Advance amount cannot be negative').finite().optional(),
  advancePaymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']).optional(),
  notes: z.string().max(2000).optional(),
})

// idType is intentionally a free string, not a fixed enum — the valid set
// is country-dependent (Aadhaar/Passport/Driving License/Voter ID/PAN in
// India; Passport/National ID/Driving License/Other elsewhere), enforced by
// the renderer's country-aware dropdown rather than a schema that would
// need to encode every country's document names.
const GuestIdSchema = z.object({
  guestName: z.string().min(1, 'Guest name is required').max(200),
  idType: z.string().min(1, 'ID type is required').max(50),
  idNumber: z.string().min(1, 'ID number is required').max(50),
  nationality: z.string().max(2).optional(),
  address: z.string().max(500).optional(),
  isPrimary: z.boolean().optional(),
})

export const CheckInBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  guests: z.array(GuestIdSchema).min(1, 'At least one guest ID record is required to check in'),
})

export const HotelBookingIdSchema = z.object({ id: z.string().min(1, 'Booking ID is required') })

export const CancelHotelBookingSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  reason: z.string().max(500).optional(),
})

export const AddExtraChargeSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  description: z.string().min(1, 'Description is required').max(200),
  quantity: z.number().positive('Quantity must be greater than zero').finite().optional(),
  unitPrice: z.number().nonnegative('Unit price cannot be negative').finite(),
})

export const RemoveExtraChargeSchema = z.object({ chargeId: z.string().min(1, 'Charge ID is required') })

export const GenerateHotelInvoiceSchema = z.object({ bookingId: z.string().min(1, 'Booking ID is required') })

export const GuestRegisterSchema = z.object({
  dateFrom: z.string().min(1, 'Start date is required'),
  dateTo: z.string().min(1, 'End date is required'),
})

export type CreateRoomPayload = z.infer<typeof CreateRoomSchema>
export type UpdateRoomPayload = z.infer<typeof UpdateRoomSchema>
export type CreateHotelBookingPayload = z.infer<typeof CreateHotelBookingSchema>
export type CheckInBookingPayload = z.infer<typeof CheckInBookingSchema>
export type AddExtraChargePayload = z.infer<typeof AddExtraChargeSchema>
