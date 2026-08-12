import { z } from 'zod'

// Mirrors PurchaseOrderItem's own product-or-service line duality exactly
// (Phase 61) — a line is either a real, stocked Product or a free-text
// service line, never both.
const SOItemSchema = z.object({
  productId: z.string().min(1).optional(),
  serviceDescription: z.string().min(1, 'Service description is required').max(300).optional(),
  serviceCategoryId: z.string().min(1).optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  taxRate: z.number().min(0).max(100).default(0),
}).refine((item) => !!item.productId || !!item.serviceDescription, {
  message: 'Each line must be either a product or a service description.'
})

export const CreateSalesOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  expectedDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(SOItemSchema).min(1, 'At least one item is required'),
})

export const CancelSalesOrderSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
})

// One or more Sales Order lines being invoiced this time — quantity may be
// less than the line's own remaining (quantity - invoicedQty), the mechanism
// that makes partial invoicing possible across several separate Invoices.
const InvoiceLineSchema = z.object({
  salesOrderItemId: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than zero'),
})

export const CreateInvoiceFromSalesOrderSchema = z.object({
  salesOrderId: z.string().min(1),
  lines: z.array(InvoiceLineSchema).min(1, 'At least one line must be invoiced'),
})

export type CreateSalesOrderPayload = z.infer<typeof CreateSalesOrderSchema>
export type CancelSalesOrderPayload = z.infer<typeof CancelSalesOrderSchema>
export type CreateInvoiceFromSalesOrderPayload = z.infer<typeof CreateInvoiceFromSalesOrderSchema>
