import { reportService } from '../../services/report.service'
import { requirePermission } from '../permission-guard'
import {
  SalesReportSchema, InventoryReportSchema, TaxReportSchema,
  ExpenseReportSchema, CustomerLedgerReportSchema, SupplierLedgerReportSchema, AuditReportSchema, GSTR1Schema,
  OrderVolumeReportSchema, LabThroughputReportSchema, DateRangeSchema
} from '../../validation/report.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('reports:sales', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = SalesReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateSalesReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:inventory', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const parsed = InventoryReportSchema.safeParse(payload ?? undefined)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Invalid payload' } }
    const data = await reportService.generateInventoryReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:tax', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const parsed = TaxReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateTaxReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:outstanding', async () => {
    const deny = await requirePermission('reports.outstanding'); if (deny) return deny
    const data = await reportService.generateOutstandingReport()
    return { success: true, data }
  })

  handle('reports:expenses', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const parsed = ExpenseReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateExpenseReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:profitAndLoss', async (payload) => {
    // Fresh-audit fix (2026-07-12): gated on analytics.viewProfit, not the
    // more permissive reports.financial — matching the existing Dashboard
    // Profit Estimate tile's trust boundary (Admin-only by default; Manager
    // has reports.financial but deliberately not analytics.viewProfit). A
    // Manager should not gain profit visibility through the back door of a
    // new report just because they can already see other financial reports.
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateProfitAndLossReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:customerLedger', async (payload) => {
    const deny = await requirePermission('reports.invoices'); if (deny) return deny
    const parsed = CustomerLedgerReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateCustomerLedgerReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:supplierLedger', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const parsed = SupplierLedgerReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateSupplierLedgerReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:audit', async (payload) => {
    const deny = await requirePermission('audit.view'); if (deny) return deny
    const parsed = AuditReportSchema.safeParse(payload ?? undefined)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Invalid payload' } }
    const data = await reportService.generateAuditReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:foodCost', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    const data = await reportService.generateFoodCostReport(p)
    return { success: true, data }
  })

  handle('reports:gstr1', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const parsed = GSTR1Schema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateGSTR1(parsed.data)
    return { success: true, data }
  })

  handle('reports:hsnSummary', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateHSNSummaryReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:documentSummary', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateDocumentSummaryReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:gstr3bPreview', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateGSTR3BPreview(parsed.data)
    return { success: true, data }
  })

  handle('reports:appointmentUtilisation', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string; providerId?: string }
    if (!p.dateFrom || !p.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateAppointmentUtilisationReport({ dateFrom: p.dateFrom, dateTo: p.dateTo, providerId: p.providerId })
    return { success: true, data }
  })

  handle('reports:clientRetention', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    if (!p.dateFrom || !p.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateClientRetentionReport({ dateFrom: p.dateFrom, dateTo: p.dateTo })
    return { success: true, data }
  })

  handle('reports:commission', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string; staffId?: string }
    if (!p.dateFrom || !p.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateCommissionReport({ dateFrom: p.dateFrom, dateTo: p.dateTo, staffId: p.staffId })
    return { success: true, data }
  })

  handle('reports:orderVolume', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = OrderVolumeReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateOrderVolumeReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:batchExpiry', async () => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const data = await reportService.generateBatchExpiryReport()
    return { success: true, data }
  })

  handle('reports:labThroughput', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = LabThroughputReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateLabThroughputReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:bloodStock', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateBloodStockReport()
    return { success: true, data }
  })

  handle('reports:jewellery', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateJewelleryReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:projects', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateProjectReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:jobCards', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateJobCardReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:logistics', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateLogisticsReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:attendance', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateAttendanceReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:production', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateProductionReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:serialWarranty', async () => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const data = await reportService.generateSerialWarrantyReport()
    return { success: true, data }
  })

  handle('reports:variantStock', async () => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const data = await reportService.generateVariantStockReport()
    return { success: true, data }
  })

  handle('reports:testScores', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string; batchId?: string }
    const data = await reportService.generateTestScoreReport(p)
    return { success: true, data }
  })

  handle('reports:complianceTasks', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateComplianceTaskReport()
    return { success: true, data }
  })

  handle('reports:rentalStatus', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateRentalStatusReport()
    return { success: true, data }
  })

  handle('reports:rentalRevenue', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateRentalRevenueReport(parsed.data)
    return { success: true, data }
  })
}
