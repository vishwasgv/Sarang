import { z } from 'zod'

const GRNItemSchema = z.object({
  productId: z.string().optional(),
  rawMaterialId: z.string().optional(),
  itemName: z.string().min(1, 'Item name is required'),
  orderedQty: z.number().nonnegative('Ordered quantity cannot be negative').finite().optional(),
  receivedQty: z.number().positive('Received quantity must be greater than zero'),
  rejectedQty: z.number().nonnegative('Rejected quantity cannot be negative').finite().optional(),
  unit: z.string().max(20).optional(),
  unitCost: z.number().nonnegative('Unit cost cannot be negative').finite().optional(),
  batchNumber: z.string().max(100).optional(),
  expiryDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  // Phase 64 — floating/variable unit-of-measure conversion (fixed-ratio
  // case too, per Section 6.1 item 7 — PO/GRN receiving previously ignored
  // sellByPack/unitsPerPack entirely). The nominal purchase-unit quantity
  // received (e.g. "3 bags") — receivedQty above stays the real, measured
  // stocking-unit quantity, so this line's own effective conversion factor
  // is receivedQty ÷ purchaseUnitQty, never assumed to equal the product's
  // own default unitsPerPack ratio.
  purchaseUnitQty: z.number().positive('Purchase unit quantity must be greater than zero').optional(),
})

export const CreateGRNSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().min(1, 'Supplier name is required'),
  purchaseOrderId: z.string().optional(),
  shipmentId: z.string().optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceDate: z.string().optional(),
  receivedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(GRNItemSchema).min(1, 'At least one item is required'),
})

export const UpdateGRNSchema = z.object({
  id: z.string().min(1, 'GRN ID is required'),
  status: z.string().max(30).optional(),
  supplierName: z.string().min(1).optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceDate: z.string().optional(),
  receivedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(GRNItemSchema).optional(),
})

export type CreateGRNPayload = z.infer<typeof CreateGRNSchema>
export type UpdateGRNPayload = z.infer<typeof UpdateGRNSchema>
