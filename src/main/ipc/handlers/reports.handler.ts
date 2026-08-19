import { reportService } from '../../services/report.service'
import { requirePermission } from '../permission-guard'
import {
  SalesReportSchema, InventoryReportSchema, TaxReportSchema,
  ExpenseReportSchema, CustomerLedgerReportSchema, SupplierLedgerReportSchema, AuditReportSchema, GSTR1Schema,
  OrderVolumeReportSchema, LabThroughputReportSchema, DateRangeSchema, DiscountReportSchema,
  CashBookReportSchema, TrialBalanceReportSchema, CostCentreTreemapReportSchema, BudgetVsActualReportSchema, StatutoryComplianceSummaryReportSchema, CashFlowProjectionReportSchema, PaymentPerformanceReportSchema,
  ReferralLeaderboardReportSchema
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

  // Phase 61 — Purchase-side reports (Section 3.1 item 5). Same permission
  // tier as Outstanding/financial reports — these expose real vendor spend
  // and payable data.
  handle('reports:apAging', async () => {
    const deny = await requirePermission('reports.outstanding'); if (deny) return deny
    const data = await reportService.generateApAgingReport()
    return { success: true, data }
  })

  handle('reports:purchaseRegister', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePurchaseRegisterReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:purchasesByVendor', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePurchasesByVendorReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:purchasesByItem', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePurchasesByItemReport(parsed.data)
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

  handle('reports:cashBook', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const parsed = CashBookReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateCashBookReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:trialBalance', async (payload) => {
    // Same trust boundary as reports:profitAndLoss — a trial balance exposes
    // Sales Revenue, COGS, and a computed Capital/Retained-Earnings figure,
    // all profit-adjacent, so it's gated the same way.
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    const parsed = TrialBalanceReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateTrialBalanceReport(parsed.data)
    return { success: true, data }
  })

  // Phase 65 — Reporting Tags / Cost & Profit Centres. Same profit-adjacent
  // trust boundary as reports:profitAndLoss/reports:trialBalance — a
  // per-cost-centre margin breakdown is exactly the kind of figure those
  // two are already gated to protect.
  handle('reports:costCentreTreemap', async (payload) => {
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    const parsed = CostCentreTreemapReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateCostCentreTreemapReport(parsed.data)
    return { success: true, data }
  })

  // Phase 65 — Budget vs. Actual. budgets.view (not analytics.viewProfit) —
  // a budget comparison is a planning tool, matching Budget's own
  // Manager-tier permission, not the stricter Admin-adjacent profit-report gate.
  handle('reports:budgetVsActual', async (payload) => {
    const deny = await requirePermission('budgets.view'); if (deny) return deny
    const parsed = BudgetVsActualReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateBudgetVsActualReport(parsed.data)
    return { success: true, data }
  })

  // Phase 65 — Statutory Summary Report. hr.view — same visibility tier as
  // payroll:listForPeriod, since this is derived from the same data.
  handle('reports:statutoryComplianceSummary', async (payload) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    const parsed = StatutoryComplianceSummaryReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateStatutoryComplianceSummaryReport(parsed.data)
    return { success: true, data }
  })

  // Phase 65 — Cash-Flow Projection. Same profit-adjacent trust boundary as
  // reports:costCentreTreemap — a forward-looking funds picture is exactly
  // the kind of figure analytics.viewProfit already exists to gate.
  handle('reports:cashFlowProjection', async (payload) => {
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    const parsed = CashFlowProjectionReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateCashFlowProjection(parsed.data ?? {})
    return { success: true, data }
  })

  // Phase 65 — Payment Performance Report. reports.outstanding — same
  // receivables/collections trust boundary as reports:outstanding/apAging.
  handle('reports:paymentPerformance', async (payload) => {
    const deny = await requirePermission('reports.outstanding'); if (deny) return deny
    const parsed = PaymentPerformanceReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePaymentPerformanceReport(parsed.data)
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

  handle('reports:dishContributionMargin', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    const data = await reportService.generateDishContributionMarginReport(p)
    return { success: true, data }
  })

  handle('reports:tableTurnoverByHour', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    const data = await reportService.generateTableTurnoverByHourReport(p)
    return { success: true, data }
  })

  handle('reports:recipeWasteVariance', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    const data = await reportService.generateRecipeWasteVarianceReport(p)
    return { success: true, data }
  })

  handle('reports:deadStockClearance', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const p = (payload ?? {}) as { days?: number }
    const data = await reportService.generateDeadStockClearanceReport(p)
    return { success: true, data }
  })

  handle('reports:categorySellThrough', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateCategorySellThroughReport(p)
    return { success: true, data }
  })

  handle('reports:basketComposition', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateBasketCompositionReport(p)
    return { success: true, data }
  })

  handle('reports:fastSlowMoverMatrix', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateFastSlowMoverMatrixReport(p)
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

  handle('reports:discounts', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DiscountReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateDiscountReport(parsed.data)
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
    // Real bug found live (2026-07-28 reports/HR/security audit): projects
    // are gated on 'sales.view' everywhere else (project.handler.ts) — this
    // report channel used the blanket 'reports.sales' key instead, which a
    // Cashier holds but 'sales.view' they do not, letting a Cashier-role
    // user read a report over data their role has no direct access to.
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateProjectReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:serviceProjects', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateServiceProjectReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:jobCards', async (payload) => {
    // Same fix as reports:projects above — job cards are gated on
    // 'sales.view' in job-card.handler.ts, not the blanket 'reports.sales'.
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateJobCardReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:carJobCards', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateCarJobCardReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:tailoringOrders', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateTailoringOrderReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:pestContracts', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePestContractReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:realEstatePipeline', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateRealEstatePipelineReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:retainers', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateRetainerReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:shootBookings', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateShootBookingReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:eventBookings', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateEventBookingReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:placements', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePlacementReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:drawingRegister', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateDrawingRegisterReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:siteVisitLog', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateSiteVisitLogReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:prescriptionDrugSales', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePrescriptionDrugSalesReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Distributor: Scheme Cost vs. Incremental Volume Report.
  handle('reports:schemeCostVsVolume', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateSchemeCostVsVolumeReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 19.2 — GP Clinic: Recall Compliance report.
  handle('reports:chronicRecallCompliance', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateChronicRecallComplianceReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 19.3 — GP Clinic: Walk-in vs. Appointment Ratio.
  handle('reports:walkInVsAppointmentRatio', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateWalkInVsAppointmentRatioReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 19.4 — GP Clinic: Diagnosis-Category Trend.
  handle('reports:diagnosisCategoryTrend', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateDiagnosisCategoryTrendReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 19.5 — GP Clinic: Referral-Out Tracking with Outcome.
  handle('reports:referralOutcome', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateReferralOutcomeReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 22.4 — Physio Clinic (shared with Gym/Studio): Pack Utilization.
  handle('reports:packUtilization', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePackUtilizationReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 23.1 — Diagnostic Lab: Per-Test TAT.
  handle('reports:labTAT', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateLabTATReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 23.4 — Diagnostic Lab: Test Volume by Panel.
  handle('reports:testVolumeByPanel', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateTestVolumeByPanelReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 23.5 (Diagnostic Lab) + item 20.1 (Specialist Clinic): Referral Leaderboard.
  handle('reports:referralLeaderboard', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = ReferralLeaderboardReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateReferralLeaderboardReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 20.2 — Specialist Clinic: Second-Opinion Conversion.
  handle('reports:secondOpinionConversion', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateSecondOpinionConversionReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 20.3 — Specialist Clinic: Case-Complexity Mix.
  handle('reports:caseComplexityMix', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateCaseComplexityMixReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 21.2 — Dental Clinic: Treatment Acceptance Rate.
  handle('reports:treatmentAcceptanceRate', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateTreatmentAcceptanceRateReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 21.4 — Dental Clinic: Recall Compliance.
  handle('reports:dentalRecallCompliance', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateDentalRecallComplianceReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 18.2 — Vet Clinic: Vaccination Compliance.
  handle('reports:vaccinationCompliance', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateVaccinationComplianceReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 item 18.4 — Vet Clinic: Case-Type Volume Trend.
  handle('reports:vetCaseTypeVolume', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateVetCaseTypeVolumeReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:logistics', async (payload) => {
    // Same fix as reports:projects/jobCards above — logistics is gated on
    // 'logistics.view' everywhere else (logistics-shipment.handler.ts,
    // logistics-analytics.handler.ts), not the blanket 'reports.sales'.
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateLogisticsReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:attendance', async (payload) => {
    // Same fix as above — attendance is gated on 'hr.view' everywhere else
    // (hr.handler.ts), not the blanket 'reports.sales'. Without this, a
    // Cashier (who holds 'reports.sales' but not 'hr.view') could open
    // Reports -> Attendance and see every employee's name/status/check-in-out
    // for the whole business despite having no HR module access.
    const deny = await requirePermission('hr.view'); if (deny) return deny
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
