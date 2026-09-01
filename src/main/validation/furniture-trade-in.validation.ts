import { z } from 'zod'

export const CreateFurnitureTradeInSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().max(200).optional(),
  itemDescription: z.string().min(1, 'Item description is required'),
  condition: z.string().max(500).optional(),
  tradeInValue: z.number().positive('Trade-in value must be greater than zero'),
  notes: z.string().max(2000).optional(),
})

export const LinkFurnitureTradeInToInvoiceSchema = z.object({
  tradeInId: z.string().min(1, 'Trade-in ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
})

export type CreateFurnitureTradeInPayload = z.infer<typeof CreateFurnitureTradeInSchema>
export type LinkFurnitureTradeInToInvoicePayload = z.infer<typeof LinkFurnitureTradeInToInvoiceSchema>
