import { z } from 'zod'

export const CreateQuotationSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    productName: z.string().min(1, 'Product name is required'),
    sku: z.string().optional(),
    quantity: z.number().positive('Quantity must be greater than zero').finite(),
    unitPrice: z.number().nonnegative('Unit price cannot be negative').finite(),
    discount: z.number().nonnegative('Discount cannot be negative').max(100, 'Discount cannot exceed 100%').finite().optional(),
    taxRate: z.number().nonnegative('Tax rate cannot be negative').finite().optional(),
  })).min(1, 'At least one item is required'),
})

export const UpdateQuotationStatusSchema = z.object({
  id: z.string().min(1, 'Quotation ID is required'),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED']),
})

export type CreateQuotationValidatedPayload = z.infer<typeof CreateQuotationSchema>
export type UpdateQuotationStatusPayload = z.infer<typeof UpdateQuotationStatusSchema>
