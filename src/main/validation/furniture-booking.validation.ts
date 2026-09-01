import { z } from 'zod'

const FurnitureBookingItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  customFabric: z.string().max(200).optional(),
  customColor: z.string().max(200).optional(),
  customDimensions: z.string().max(200).optional(),
  customFinish: z.string().max(200).optional(),
})

export const CreateFurnitureBookingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  deliveryDate: z.string().optional(),
  deliveryAddress: z.string().max(500).optional(),
  advanceAmount: z.number().nonnegative().optional(),
  advancePaymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(FurnitureBookingItemInputSchema).min(1, 'At least one item is required'),
})

export const UpdateFurnitureBookingStatusSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
  status: z.enum(['BOOKED', 'DELIVERED', 'CANCELLED']),
})

export type CreateFurnitureBookingPayload = z.infer<typeof CreateFurnitureBookingSchema>
export type UpdateFurnitureBookingStatusPayload = z.infer<typeof UpdateFurnitureBookingStatusSchema>
