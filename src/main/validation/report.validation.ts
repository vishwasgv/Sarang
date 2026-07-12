import { z } from 'zod'

export const DateRangeSchema = z.object({
  dateFrom: z.string().min(1, 'Start date is required'),
  dateTo: z.string().min(1, 'End date is required')
})

export const SalesReportSchema = DateRangeSchema.extend({
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional(),
  dateGroupBy: z.enum(['invoiceDate', 'paymentDate']).optional()
})

export const InventoryReportSchema = z.object({
  categoryId: z.string().optional(),
  lowStockOnly: z.boolean().optional()
}).optional()

export const TaxReportSchema = DateRangeSchema

export const GSTR1Schema = DateRangeSchema

export const ExpenseReportSchema = DateRangeSchema.extend({
  categoryId: z.string().optional()
})

export const CustomerLedgerReportSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
})

export const SupplierLedgerReportSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
})

export const AuditReportSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional()
}).optional()

export const OrderVolumeReportSchema = DateRangeSchema
export const LabThroughputReportSchema = DateRangeSchema

export type SalesReportPayload = z.infer<typeof SalesReportSchema>
export type ExpenseReportPayload = z.infer<typeof ExpenseReportSchema>
export type CustomerLedgerReportPayload = z.infer<typeof CustomerLedgerReportSchema>
export type SupplierLedgerReportPayload = z.infer<typeof SupplierLedgerReportSchema>
