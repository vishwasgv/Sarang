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

  // Phase 67 §9.1 — General: Combined Cash Position Trend. reports.financial
  // — same tier as reports:cashBook, the report this most closely sits beside.
  handle('reports:cashPositionTrend', async (payload) => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateCashPositionTrendReport(p)
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

  // Phase 67 §9.1 — Clothing: Season/Collection Sell-Through Report.
  handle('reports:seasonSellThrough', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateSeasonSellThroughReport(p)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Clothing: Size × Style Heatmap Report.
  handle('reports:sizeStyleHeatmap', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateSizeStyleHeatmapReport(p)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap Report.
  handle('reports:sizeAvailabilityHeatmap', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const p = (payload ?? {}) as { lowStockThreshold?: number }
    const data = await reportService.generateSizeAvailabilityHeatmapReport(p)
    return { success: true, data }
  })

  handle('reports:categoryMix', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateCategoryMixReport(p)
    return { success: true, data }
  })

  handle('reports:vendorMargin', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateVendorMarginReport(p)
    return { success: true, data }
  })

  handle('reports:brandMarginReturnRate', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const p = payload as { dateFrom: string; dateTo: string }
    if (!p?.dateFrom || !p?.dateTo) return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo are required.' } }
    const data = await reportService.generateBrandMarginReturnRateReport(p)
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

  // Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time.
  handle('reports:donationToIssueCycleTime', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateDonationToIssueCycleTimeReport()
    return { success: true, data }
  })

  handle('reports:jewellery', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateJewelleryReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Jewellery items 2/3/4/5.
  handle('reports:makingChargeMargin', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateMakingChargeMarginReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:hallmarkCompliance', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateHallmarkComplianceReport()
    return { success: true, data }
  })

  handle('reports:metalRateVsSalesVolume', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateMetalRateVsSalesVolumeReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:purityAdjustedExchange', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generatePurityAdjustedExchangeReport(parsed.data)
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

  // Phase 67 §9.1 — Service items 2/4. Same 'sales.view' gate as
  // reports:projects above — tickets are gated on that key everywhere else.
  handle('reports:serviceResolutionTime', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateServiceResolutionTimeReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:repeatBusinessRate', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateRepeatBusinessRateReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Consultant items 2/4.
  handle('reports:consultantUtilization', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateConsultantUtilizationReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:clientProfitability', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateClientProfitabilityReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Repair items 2/4.
  handle('reports:jobCardTurnaroundByTechnician', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateJobCardTurnaroundByTechnicianReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:repairCategoryVolumeTrend', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateRepairCategoryVolumeTrendReport(parsed.data)
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

  handle('reports:carPartsVariance', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateCarPartsVarianceReport()
    return { success: true, data }
  })

  handle('reports:serviceTypeRevenue', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateServiceTypeRevenueReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:tailoringOrders', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateTailoringOrderReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:orderTurnaround', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateOrderTurnaroundReport(parsed.data)
    return { success: true, data }
  })

  handle('reports:fittingStageTracker', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateFittingStageTrackerReport()
    return { success: true, data }
  })

  handle('reports:fabricPopularity', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateFabricPopularityReport(parsed.data)
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

  // Phase 67 §9.1 — Pharmacy item 1: Schedule H1/X Narcotic Register.
  handle('reports:scheduleH1XRegister', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateScheduleH1XRegisterReport(parsed.data)
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

  // Phase 67 §9.1 — Distributor item 2/3: field-rep leaderboard.
  handle('reports:fieldRepLeaderboard', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateFieldRepLeaderboardReport(parsed.data)
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

  // Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished Unit.
  handle('reports:landedCostPerUnit', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateLandedCostPerUnitReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend.
  handle('reports:rejectionRateTrend', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateRejectionRateTrendReport(parsed.data)
    return { success: true, data }
  })

  // Phase 67 §9.1 — Agri Inputs item 2: Seasonal Credit Exposure.
  handle('reports:seasonalCreditExposure', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateSeasonalCreditExposureReport()
    return { success: true, data }
  })

  // Phase 67 §9.1 — Agri Inputs item 4: Farmer-Wise Purchase & Repayment History.
  handle('reports:farmerRepayment', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateFarmerRepaymentReport()
    return { success: true, data }
  })

  handle('reports:serialWarranty', async () => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const data = await reportService.generateSerialWarrantyReport()
    return { success: true, data }
  })

  // Phase 67 §9.1 — Electronics: RMA Aging Report.
  handle('reports:rmaAging', async () => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const data = await reportService.generateRmaAgingReport()
    return { success: true, data }
  })

  // Phase 67 §9.1 — Electronics: Vendor Warranty-Claim Recovery Ledger.
  // reports.financial — this is a money-owed-to-the-shop ledger, same trust
  // tier as other financial reports, not the plain inventory-status tier
  // rmaAging/serialWarranty above use.
  handle('reports:vendorRecoveryLedger', async () => {
    const deny = await requirePermission('reports.financial'); if (deny) return deny
    const data = await reportService.generateVendorRecoveryLedgerReport()
    return { success: true, data }
  })

  // Phase 67 §9.1 — Electronics: Repair Turnaround by Technician. Same
  // reports.inventory tier as rmaAging/serialWarranty above — a service-
  // quality/operations metric, not a money-owed one like vendorRecoveryLedger.
  handle('reports:repairTurnaroundByTechnician', async () => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const data = await reportService.generateRepairTurnaroundByTechnicianReport()
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

  // Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per unit.
  handle('reports:assetUtilization', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateAssetUtilizationReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Beauty Salon items 1/2: stylist-wise repeat-client rate.
  handle('reports:stylistRepeatClient', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateStylistRepeatClientReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Beauty Salon items 3/4: retail-product attach rate.
  handle('reports:retailAttachRate', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateRetailAttachRateReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Gym/Studio item 4: Class Attendance Heatmap.
  handle('reports:classAttendanceHeatmap', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateClassAttendanceHeatmapReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Gym/Studio items 1/2: membership renewal funnel.
  handle('reports:membershipRenewalFunnel', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateMembershipRenewalFunnelReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Driving School item 4: Learner Progress Funnel.
  handle('reports:learnerProgressFunnel', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateLearnerProgressFunnelReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Lawyer item 4: Case Aging.
  handle('reports:caseAging', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateCaseAgingReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Lawyer item 2: Billable Hours.
  handle('reports:lawyerBillableHours', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateLawyerBillableHoursReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — CA Firm item 4: Fee Realization.
  handle('reports:feeRealization', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateFeeRealizationReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Architect item 2: Drawing Approval Cycle Time.
  handle('reports:drawingApprovalCycleTime', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateDrawingApprovalCycleTimeReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Architect/Civil item 4: Project Stage Progress.
  handle('reports:projectStageProgress', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateProjectStageProgressReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Civil Engineer items 1/2: Site Visit Billing.
  handle('reports:siteVisitBilling', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateSiteVisitBillingReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Civil Engineer item 5: Material Test Results.
  handle('reports:materialTestResults', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateMaterialTestResultsReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Independent Consultant item 1: Retainer Utilization.
  handle('reports:retainerUtilization', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateRetainerUtilizationReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Independent Consultant item 3: Proposal Win Rate.
  handle('reports:proposalWinRate', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateProposalWinRateReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Independent Consultant item 4: Client Revenue Concentration.
  handle('reports:clientRevenueConcentration', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateClientRevenueConcentrationReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Marketing Agency item 1: Campaign ROI/budget tracking.
  handle('reports:campaignROI', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateCampaignROIReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Marketing Agency item 3: Deliverable Status Pipeline.
  handle('reports:deliverableStatusPipeline', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateDeliverableStatusPipelineReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Marketing Agency item 4: Channel Performance.
  handle('reports:channelPerformance', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateChannelPerformanceReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Marketing Agency item 5: Retainer Work Delivered.
  handle('reports:retainerWorkDelivered', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateRetainerWorkDeliveredReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Software Agency item 1: Issue Aging (SLA breach flag).
  handle('reports:issueAging', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateIssueAgingReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Software Agency item 4: Team Utilization.
  handle('reports:teamUtilization', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateTeamUtilizationReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Software Agency item 5: Sprint Billing.
  handle('reports:sprintBilling', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateSprintBillingReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Photo Studio items 1/2/5: Delivery Pipeline.
  handle('reports:deliveryPipeline', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateDeliveryPipelineReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Photo Studio item 4: Shoot-Type Revenue Mix.
  handle('reports:shootTypeRevenueMix', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    const data = await reportService.generateShootTypeRevenueMixReport(parsed.data)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Photo Studio item 3: Equipment Checkout.
  handle('reports:equipmentCheckout', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateEquipmentCheckoutReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Event Management item 2: Vendor Cost vs. Budget.
  handle('reports:vendorCostVsBudget', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateVendorCostVsBudgetReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Event Management item 5: Vendor Performance History.
  handle('reports:vendorPerformanceHistory', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateVendorPerformanceHistoryReport()
    return { success: true, data }
  })

  // Phase 68 §9.1 — Coaching Institute item 4: Attendance-vs-Performance Correlation.
  handle('reports:attendancePerformanceCorrelation', async (payload) => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const { batchId } = (payload ?? {}) as { batchId?: string }
    const data = await reportService.generateAttendancePerformanceCorrelationReport(batchId)
    return { success: true, data }
  })

  // Phase 68 §9.1 — Coaching Institute item 5: Fee-Due + Underperformance Alert.
  handle('reports:feeDueUnderperformanceAlert', async () => {
    const deny = await requirePermission('reports.sales'); if (deny) return deny
    const data = await reportService.generateFeeDueUnderperformanceAlertReport()
    return { success: true, data }
  })
}
