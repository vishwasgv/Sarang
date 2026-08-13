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
  // Phase 63 — drop-shipment: deliver directly to a customer's address
  // instead of the business's own location. Narrower cut than a full
  // pass-through-inventory feature — see PurchaseOrder's own schema comment.
  dropShipToCustomerId: z.string().min(1).optional(),
  sourceSalesOrderId: z.string().min(1).optional(),
})

export const CancelPOSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
})

// Phase 64 — landed cost, addable to a PO any time before its first receipt.
export const AddLandedCostSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order ID is required'),
  costType: z.string().min(1).max(30),
  amount: z.number().positive('Amount must be greater than zero'),
  allocationMethod: z.enum(['BY_VALUE', 'BY_QUANTITY']).default('BY_VALUE'),
})

export type CreatePOPayload = z.infer<typeof CreatePOSchema>
export type CancelPOPayload = z.infer<typeof CancelPOSchema>
export type AddLandedCostPayload = z.infer<typeof AddLandedCostSchema>
