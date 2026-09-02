import { z } from 'zod'

const CustomOrderBookingItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  customFlavor: z.string().max(200).optional(),
  customSize: z.string().max(200).optional(),
  customMessage: z.string().max(200).optional(),
  customDesign: z.string().max(200).optional(),
})

export const CreateCustomOrderBookingSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  dueDate: z.string().optional(),
  deliveryAddress: z.string().max(500).optional(),
  advanceAmount: z.number().nonnegative().optional(),
  advancePaymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(CustomOrderBookingItemInputSchema).min(1, 'At least one item is required'),
})

export const UpdateCustomOrderBookingStatusSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
  status: z.enum(['BOOKED', 'DELIVERED', 'CANCELLED']),
})

export type CreateCustomOrderBookingPayload = z.infer<typeof CreateCustomOrderBookingSchema>
export type UpdateCustomOrderBookingStatusPayload = z.infer<typeof UpdateCustomOrderBookingStatusSchema>
