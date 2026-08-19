import { z } from 'zod'

export const DateRangeSchema = z.object({
  dateFrom: z.string().min(1, 'Start date is required'),
  dateTo: z.string().min(1, 'End date is required')
})

export const SalesReportSchema = DateRangeSchema.extend({
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional(),
  dateGroupBy: z.enum(['invoiceDate', 'paymentDate']).optional()
})

// Phase 67 §9.1 item 23.5 (Diagnostic Lab) + item 20.1 (Specialist Clinic) —
// one shared report, businessType picks which of the two differently-shaped
// referral data sources to query (see report.service.ts's own comment).
export const ReferralLeaderboardReportSchema = DateRangeSchema.extend({
  businessType: z.string().min(1, 'Business type is required')
})

export const InventoryReportSchema = z.object({
  categoryId: z.string().optional(),
  lowStockOnly: z.boolean().optional()
}).optional()

export const TaxReportSchema = DateRangeSchema

export const CashBookReportSchema = DateRangeSchema.extend({
  paymentMethod: z.string().optional()
})

export const TrialBalanceReportSchema = DateRangeSchema

// Phase 65 — Reporting Tags / Cost & Profit Centres.
export const CostCentreTreemapReportSchema = DateRangeSchema

// Phase 65 — Budget vs. Actual. A single-month report (matches Budget's own
// monthly granularity), not a date range.
export const BudgetVsActualReportSchema = z.object({
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12)
})

// Phase 65 — Statutory (PF/ESI/PT) Summary Report, same monthly granularity
// as payroll itself.
export const StatutoryComplianceSummaryReportSchema = BudgetVsActualReportSchema

// Phase 65 — Cash-Flow Projection. Both bounds optional (service applies
// 30/30 defaults) — a rolling window around "today," not a fixed date range.
export const CashFlowProjectionReportSchema = z.object({
  daysBack: z.number().int().min(1).max(180).optional(),
  daysForward: z.number().int().min(1).max(180).optional()
}).optional()

// Phase 65 — Payment Performance Report.
export const PaymentPerformanceReportSchema = DateRangeSchema

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
export const DiscountReportSchema = DateRangeSchema

export type SalesReportPayload = z.infer<typeof SalesReportSchema>
export type ExpenseReportPayload = z.infer<typeof ExpenseReportSchema>
export type CustomerLedgerReportPayload = z.infer<typeof CustomerLedgerReportSchema>
export type SupplierLedgerReportPayload = z.infer<typeof SupplierLedgerReportSchema>
