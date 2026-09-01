import { z } from 'zod'

const BulkListOrderItemInputSchema = z.object({
  itemLabel: z.string().min(1, 'Item label is required'),
  requestedQty: z.number().positive('Requested quantity must be greater than zero'),
  productId: z.string().optional(),
  unitPrice: z.number().nonnegative().optional(),
})

export const CreateBulkListOrderSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().max(200).optional(),
  listName: z.string().min(1, 'List name is required'),
  notes: z.string().max(2000).optional(),
  items: z.array(BulkListOrderItemInputSchema).min(1, 'At least one supply-list line is required'),
})

export const MatchBulkListOrderItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  productId: z.string().min(1, 'Product is required'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
})

export const BillBulkListOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT']),
})

export type CreateBulkListOrderPayload = z.infer<typeof CreateBulkListOrderSchema>
export type MatchBulkListOrderItemPayload = z.infer<typeof MatchBulkListOrderItemSchema>
export type BillBulkListOrderPayload = z.infer<typeof BillBulkListOrderSchema>
