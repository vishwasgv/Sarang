import { z } from 'zod'

export const CreatePriceListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  appliesTo: z.enum(['CUSTOMER', 'SUPPLIER']),
  currencyCode: z.string().max(10).optional(),
})

export const UpdatePriceListSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(200),
  isActive: z.boolean(),
})

const PriceListItemSchema = z.object({
  productId: z.string().min(1),
  minQuantity: z.number().positive('Minimum quantity must be greater than zero').default(1),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
})

// Bulk-replace convention — the whole tier table for one Price List is
// edited as a single small grid in the UI, not one row at a time.
export const SetPriceListItemsSchema = z.object({
  priceListId: z.string().min(1),
  items: z.array(PriceListItemSchema).min(1, 'At least one price tier is required'),
})

export const ResolvePriceSchema = z.object({
  counterpartyId: z.string().min(1), // customerId or supplierId, depending on `for`
  for: z.enum(['CUSTOMER', 'SUPPLIER']),
  productId: z.string().min(1),
  quantity: z.number().positive().default(1),
})

export type CreatePriceListPayload = z.infer<typeof CreatePriceListSchema>
export type UpdatePriceListPayload = z.infer<typeof UpdatePriceListSchema>
export type SetPriceListItemsPayload = z.infer<typeof SetPriceListItemsSchema>
export type ResolvePricePayload = z.infer<typeof ResolvePriceSchema>
