import { z } from 'zod'

// Phase 61 — a Bill line mirrors a PO line: either a physical product or a
// genuine free-text service line (rent, professional fees, AMC). Unlike a PO
// line, a Bill is a pure AP/financial record — it never touches inventory
// (that's PurchaseOrder.receive/GRN's job), so there's no product-type
// restriction here the way PRD-006 restricts PO lines.
const BillItemSchema = z.object({
  productId: z.string().min(1).optional(),
  serviceDescription: z.string().min(1, 'Service description is required').max(300).optional(),
  serviceCategoryId: z.string().min(1).optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitCost: z.number().min(0, 'Unit cost cannot be negative'),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(0),
}).refine((item) => !!item.productId || !!item.serviceDescription, {
  message: 'Each line must be either a product or a service description.'
})

export const CreateBillSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  purchaseOrderId: z.string().optional(),
  billDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(BillItemSchema).min(1, 'At least one item is required'),
  // Phase 62 — Reverse Charge Mechanism: GST liability shifts to the
  // business receiving the supply.
  isReverseCharge: z.boolean().default(false),
})

export const VoidBillSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, 'Void reason is required').max(500),
})

export type CreateBillPayload = z.infer<typeof CreateBillSchema>
export type VoidBillPayload = z.infer<typeof VoidBillSchema>
