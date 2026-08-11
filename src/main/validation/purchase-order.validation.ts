import { z } from 'zod'

// Phase 61 — a PO line is either a physical product (existing shape) or a
// genuine free-text service line (professional fees, freight, AMC — nothing
// to receive into inventory). serviceCategoryId reuses ExpenseCategory, the
// same category list Expenses already draws from, rather than inventing a
// parallel taxonomy.
const POItemSchema = z.object({
  productId: z.string().min(1).optional(),
  serviceDescription: z.string().min(1, 'Service description is required').max(300).optional(),
  serviceCategoryId: z.string().min(1).optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitCost: z.number().min(0, 'Unit cost cannot be negative'),
  taxRate: z.number().min(0).max(100).default(0),
}).refine((item) => !!item.productId || !!item.serviceDescription, {
  message: 'Each line must be either a product or a service description.'
})

export const CreatePOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  expectedDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(POItemSchema).min(1, 'At least one item is required'),
  // Phase 62 — Reverse Charge Mechanism, same meaning as Bill's own.
  isReverseCharge: z.boolean().default(false),
})

export const CancelPOSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
})

export type CreatePOPayload = z.infer<typeof CreatePOSchema>
export type CancelPOPayload = z.infer<typeof CancelPOSchema>
