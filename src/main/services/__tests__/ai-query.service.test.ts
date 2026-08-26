import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted spies for the real http/https `request` exports — ESM module
// namespace objects can't be spied via vi.spyOn directly (frozen exports),
// so http/https are mocked with a wrapper that delegates to the real
// implementation but records every call, matching vitest's documented
// pattern for this exact limitation.
const { httpRequestSpy, httpsRequestSpy } = vi.hoisted(() => ({
  httpRequestSpy: vi.fn(),
  httpsRequestSpy: vi.fn()
}))
vi.mock('http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('http')>()
  return { ...actual, request: (...args: unknown[]) => { httpRequestSpy(...args); return (actual.request as (...a: unknown[]) => unknown)(...args) } }
})
vi.mock('https', async (importOriginal) => {
  const actual = await importOriginal<typeof import('https')>()
  return { ...actual, request: (...args: unknown[]) => { httpsRequestSpy(...args); return (actual.request as (...a: unknown[]) => unknown)(...args) } }
})

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../../database/ai-readonly-db', () => ({ getReadOnlyPrisma: vi.fn().mockResolvedValue({}) }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../industry-template.service', () => ({
  isModuleEnabled: vi.fn(),
  // No active vertical in these tests — the business type maps to the
  // default (empty) case in ai-vertical-templates.service.ts.
  getActiveTemplate: vi.fn().mockResolvedValue({ success: true, data: { businessType: 'GENERAL' } })
}))
vi.mock('../report.service', () => ({
  reportService: {
    generateSalesReport: vi.fn(),
    generateOutstandingReport: vi.fn(),
    generateProfitAndLossReport: vi.fn(),
    generateProductionReport: vi.fn(),
    generatePurchasesByItemReport: vi.fn(),
    generatePurchaseRegisterReport: vi.fn(),
    generateCostCentreTreemapReport: vi.fn(),
    generateBudgetVsActualReport: vi.fn(),
    generateCashFlowProjection: vi.fn(),
    generatePaymentPerformanceReport: vi.fn(),
    generateStatutoryComplianceSummaryReport: vi.fn(),
    generateCategoryMixReport: vi.fn(),
    generateCashPositionTrendReport: vi.fn(),
    generateVendorRecoveryLedgerReport: vi.fn(),
    generateRepairTurnaroundByTechnicianReport: vi.fn(),
    generateSeasonSellThroughReport: vi.fn(),
    generateSizeStyleHeatmapReport: vi.fn(),
    generateVendorMarginReport: vi.fn(),
    generateBrandMarginReturnRateReport: vi.fn(),
    generateSizeAvailabilityHeatmapReport: vi.fn(),
    generateLandedCostPerUnitReport: vi.fn(),
    generateRejectionRateTrendReport: vi.fn(),
    generateSeasonalCreditExposureReport: vi.fn(),
    generateFarmerRepaymentReport: vi.fn(),
    generateDonationToIssueCycleTimeReport: vi.fn(),
    generateAssetUtilizationReport: vi.fn(),
    generateMakingChargeMarginReport: vi.fn(),
    generateHallmarkComplianceReport: vi.fn(),
    generateMetalRateVsSalesVolumeReport: vi.fn(),
    generatePurityAdjustedExchangeReport: vi.fn(),
    generateServiceResolutionTimeReport: vi.fn(),
    generateRepeatBusinessRateReport: vi.fn(),
    generateConsultantUtilizationReport: vi.fn(),
    generateClientProfitabilityReport: vi.fn()
  }
}))
vi.mock('../gold-savings.service', () => ({
  listGoldSavingsSchemes: vi.fn()
}))
vi.mock('../service-ticket.service', () => ({
  listTickets: vi.fn(),
  getQuoteToJobConversionStats: vi.fn()
}))
vi.mock('../service-contract.service', () => ({
  listServiceContracts: vi.fn()
}))
vi.mock('../project.service', () => ({
  getEngagementConversionStats: vi.fn(),
  getProposalWinRateStats: vi.fn()
}))
vi.mock('../retainer.service', () => ({
  listRetainers: vi.fn(),
  getRetainerHoursUsage: vi.fn()
}))
vi.mock('../seasonal-cycle.service', () => ({
  getSeasonalReorderCalendar: vi.fn()
}))
vi.mock('../work-order.service', () => ({
  getDowntimeSummary: vi.fn(),
  getWorkOrderBottleneckFlag: vi.fn()
}))
vi.mock('../crop-advisory.service', () => ({ listDistinctCrops: vi.fn(), getProductsForCrop: vi.fn() }))
vi.mock('../serial.service', () => ({ listEquipmentDueForService: vi.fn() }))
vi.mock('../blood-bank.service', () => ({ listDonorsDueForRecall: vi.fn(), listDonationCamps: vi.fn() }))
vi.mock('../repair-ticket.service', () => ({ lookupSerialService: vi.fn() }))
vi.mock('../variant.service', () => ({ getSizeCurveReorderSuggestion: vi.fn() }))
vi.mock('../trial-session.service', () => ({ getTrialConversionSummary: vi.fn() }))
vi.mock('../analytics.service', () => ({
  getDashboardKpis: vi.fn(),
  getOutstandingAmount: vi.fn(),
  getTopProducts: vi.fn(),
  getDashboardAlerts: vi.fn()
}))
vi.mock('../ai-aggregations.service', () => ({
  getDeadStock: vi.fn(),
  getBottomRevenueProducts: vi.fn(),
  getTopCustomersByRevenue: vi.fn(),
  getCustomersWithNoRecentPurchases: vi.fn(),
  getTopSuppliersByPurchaseVolume: vi.fn()
}))
vi.mock('../hotel.service', () => ({ getOccupancyReport: vi.fn() }))
vi.mock('../placement.service', () => ({ getPlacementKPIs: vi.fn() }))
// AI expansion, 2026-07 — Tier 1/2 dependencies, mocked just enough to
// exercise the new date/search-term extraction logic end-to-end without
// needing a real Prisma client (most other new templates call getPrisma()
// directly and are covered by the underlying, already-tested service/report
// functions they reuse rather than re-tested here individually).
vi.mock('../customer.service', () => ({ listCustomers: vi.fn(), searchCustomers: vi.fn() }))
vi.mock('../supplier.service', () => ({ searchSuppliers: vi.fn() }))
vi.mock('../supplier-ledger.service', () => ({ supplierLedgerService: { calculateBalance: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { getReadOnlyPrisma } from '../../database/ai-readonly-db'
import { isModuleEnabled, getActiveTemplate } from '../industry-template.service'
import { reportService } from '../report.service'
import { listGoldSavingsSchemes } from '../gold-savings.service'
import { listTickets } from '../service-ticket.service'
import { getProposalWinRateStats } from '../project.service'
import { getTrialConversionSummary } from '../trial-session.service'
import { getSeasonalReorderCalendar } from '../seasonal-cycle.service'
import { getDowntimeSummary, getWorkOrderBottleneckFlag } from '../work-order.service'
import { listDistinctCrops, getProductsForCrop } from '../crop-advisory.service'
import { listEquipmentDueForService } from '../serial.service'
import { listDonorsDueForRecall, listDonationCamps } from '../blood-bank.service'
import { lookupSerialService } from '../repair-ticket.service'
import { getSizeCurveReorderSuggestion } from '../variant.service'
import { getDashboardKpis, getOutstandingAmount, getDashboardAlerts } from '../analytics.service'
import { getDeadStock, getTopSuppliersByPurchaseVolume } from '../ai-aggregations.service'
import { getPlacementKPIs } from '../placement.service'
import { listCustomers, searchCustomers } from '../customer.service'
import { searchSuppliers } from '../supplier.service'
import { supplierLedgerService } from '../supplier-ledger.service'
import { askQuestion, setAIProvider } from '../ai-query.service'
import { FakeAIProvider } from '../ai-provider'

// Mirrors ai-query.service.ts's own toLocalISODate — tests must compute
// expected values with the SAME timezone-correct formatting the
// implementation now uses (real bug, 2026-07: toISOString().slice(0, 10)
// silently shifts the calendar day backward on IST/positive-UTC-offset
// machines, so an expected value computed that way is wrong exactly when
// the implementation is right).
function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function makeMockDb() {
  const db: Record<string, any> = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
    aiQueryLog: { create: vi.fn().mockResolvedValue({}) },
    // Phase 61 — suppliers.byName's period-spend lookup queries Bill directly.
    bill: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }) }
  }
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPrisma).mockReturnValue(makeMockDb() as never)
  vi.mocked(isModuleEnabled).mockResolvedValue(true)
})

describe('askQuestion — pipeline scaffolding (Phase 57.3)', () => {
  // Real bug found live 2026-07-13: the real model (Qwen2.5-1.5B-Instruct)
  // misclassified this exact question as sales.compareToPreviousPeriod and
  // answered it with real sales figures instead of refusing, because it
  // also contains data-adjacent words ("this month"). Locks in the
  // deterministic keyword-filter fix so this specific real failure can
  // never silently regress.
  it('refuses a real adversarial question the model itself got wrong live, via the deterministic keyword filter, without ever calling the model', async () => {
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Should I file a GST return this month and what tax rate should I use?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBeNull()
    expect(res.data?.answer).toMatch(/legal|tax|medical|investment|compliance/i)
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('does not over-trigger the keyword filter on a legitimate business question that happens to share some vocabulary', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue({
      todaySales: 100, todayTrend: 0, weekSales: 0, weekTrend: 0, monthSales: 0, monthTrend: 0,
      totalInvoices: 1, outstanding: 0, inventoryValue: 0, monthExpenses: 0, expenseTrend: 0,
      estimatedProfit: 0, profitTrend: 0, lowStockCount: 0, customerCount: 0, supplierCount: 0,
      inventoryStats: {} as never
    })
    const fake = new FakeAIProvider(
      { 'How much did I sell today?': { template: 'sales.totalToday', category: 'sales', params: {} } },
      'You sold ₹100 today.'
    )
    setAIProvider(fake)

    const res = await askQuestion('How much did I sell today?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('sales.totalToday')
  })

  // Real bug found via live UAT (2026-07-21): getDashboardKpis() was called
  // with no args (forceRefresh defaults to false), so a sale made seconds
  // before asking "how much did I sell today?" could return the Dashboard
  // screen's 60s-stale cached KPI snapshot -- wrongly answering ₹0 sales
  // (or even the "not enough information" fallback) despite the sale being
  // right there in the database. An AI answer is a one-shot factual claim
  // and must never be stale, unlike the continuously-viewed Dashboard
  // screen the cache TTL was designed for.
  it('forces a fresh (non-cached) KPI read for a KPI-backed template, not the Dashboard screen\'s cached snapshot', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue({
      todaySales: 200, todayTrend: 5, weekSales: 0, weekTrend: 0, monthSales: 0, monthTrend: 0,
      totalInvoices: 1, outstanding: 0, inventoryValue: 0, monthExpenses: 0, expenseTrend: 0,
      estimatedProfit: 0, profitTrend: 0, lowStockCount: 0, customerCount: 0, supplierCount: 0,
      inventoryStats: {} as never
    })
    const fake = new FakeAIProvider(
      { 'How much did I sell today?': { template: 'sales.totalToday', category: 'sales', params: {} } },
      'You sold ₹200 today.'
    )
    setAIProvider(fake)

    const res = await askQuestion('How much did I sell today?')

    expect(res.success).toBe(true)
    expect(getDashboardKpis).toHaveBeenCalledWith(true)
  })

  it('refuses when the AI module is disabled for this business, without calling the model at all', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(false)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('How much did I sell today?')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('AI-001')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('answers a real question end-to-end using only the AIProvider interface — proves the abstraction holds, not just node-llama-cpp', async () => {
    // Deliberately phrased to NOT match any FAST_PATH_PATTERNS entry (see
    // the dedicated fast-path tests below) — this test's whole point is
    // exercising the classifyIntent()-via-AIProvider path, and would
    // silently stop doing that if the question happened to fast-path match.
    vi.mocked(getDashboardKpis).mockResolvedValue({
      todaySales: 18450, todayTrend: 12, weekSales: 0, weekTrend: 0, monthSales: 0, monthTrend: 0,
      totalInvoices: 32, outstanding: 0, inventoryValue: 0, monthExpenses: 0, expenseTrend: 0,
      estimatedProfit: 0, profitTrend: 0, lowStockCount: 0, customerCount: 0, supplierCount: 0,
      inventoryStats: {} as never
    })
    const fake = new FakeAIProvider(
      { "Give me today's revenue figures": { template: 'sales.totalToday', category: 'sales', params: {} } }
    )
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion("Give me today's revenue figures", 'user-1')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('sales.totalToday')
    // Deterministic answer formatting (2026-07-13), not the model's phrasing —
    // proves the number is exact and correctly comma-grouped, not model-generated.
    expect(res.data?.answer).toBe("Today's sales: ₹18,450.00. up 12.0% compared to yesterday.")
    expect(classifySpy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(getPrisma)().aiQueryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ matchedTemplate: 'sales.totalToday', success: true }) })
    )
  })

  // LATENCY FIX regression tests (2026-07-13) — the two structural changes
  // made to hit the founder's ≤5-10s requirement.
  it('answers a common, unambiguous question via the deterministic fast-path, never touching the model at all', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue({
      todaySales: 500, todayTrend: 0, weekSales: 0, weekTrend: 0, monthSales: 0, monthTrend: 0,
      totalInvoices: 2, outstanding: 0, inventoryValue: 0, monthExpenses: 0, expenseTrend: 0,
      estimatedProfit: 0, profitTrend: 0, lowStockCount: 0, customerCount: 0, supplierCount: 0,
      inventoryStats: {} as never
    })
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    const initSpy = vi.spyOn(fake, 'initialize')
    setAIProvider(fake)

    const res = await askQuestion("What were today's sales?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('sales.totalToday')
    // Neither the model nor even its initialize() should run for a
    // fast-path-matched question — the whole point is skipping model load.
    expect(classifySpy).not.toHaveBeenCalled()
    expect(initSpy).not.toHaveBeenCalled()
  })

  // Real bug found live 2026-07-13 during the vertical-coverage expansion:
  // the model misclassified "How is production going this month?" as
  // sales.compareToPreviousPeriod instead of the new manufacturing.production
  // template — sales templates dominate the catalog numerically and "this
  // month" pattern-matches strongly on them. Fixed with a fast-path pattern
  // for `production`, same shape as the original latency fast-path. Locks
  // in the exact real failure so it can't silently regress.
  it('correctly routes a manufacturing production question via the fast-path, not the sales template the model got wrong live', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } as never })
    vi.mocked(reportService.generateProductionReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-13',
      summary: { totalOrders: 12, completed: 8, inProgress: 4, totalPlannedQty: 500, totalProducedQty: 420, completionRate: 66.7 },
      byStatus: [], rows: []
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('How is production going this month?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('manufacturing.production')
    expect(res.data?.answer).toContain('12 production orders')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — General's Category Mix report. Locks in that "category
  // mix" routes to the new date-range-scoped report, not the pre-existing
  // all-time sales.byCategory intent (which has no fast-path pattern of its
  // own and would otherwise be reachable only via the LLM classifier).
  it('routes "show me category mix" to general.categoryMix via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'GENERAL' } as never })
    vi.mocked(reportService.generateCategoryMixReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-13',
      summary: { totalRevenue: 10000, categoryCount: 2 },
      rows: [{ categoryId: 'c1', categoryName: 'Beverages', unitsSold: 50, revenue: 6000, revenuePercent: 60 }],
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me category mix')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('general.categoryMix')
    expect(res.data?.answer).toContain('Beverages')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — General's Universal Quote -> Order -> Invoice pipeline.
  it('routes "show me the quote pipeline" to general.quotePipelineSummary via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'GENERAL' } as never })
    // Extends beforeEach's makeMockDb() baseline (businessProfile/aiQueryLog/
    // bill) rather than replacing it — this intent calls getPrisma()
    // directly (not through a mocked report.service function), so the rest
    // of askQuestion's own pipeline (refreshAiNumberFormat, query logging)
    // still needs those tables mocked too.
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) },
      quotation: { findMany: vi.fn().mockResolvedValue([{ invoice: { id: 'inv-1' }, salesOrder: null }]) }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me the quote pipeline')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('general.quotePipelineSummary')
    expect(res.data?.answer).toContain('billed directly')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Electronics: RMA SLA tracker.
  it('routes "any RMA overdue" to electronics.rmaOverdueSummary via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'ELECTRONICS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) },
      repairTicket: { findMany: vi.fn().mockResolvedValue([{ claimNumber: 'RMA-00001', product: { productName: 'Galaxy S24' }, sentToVendorDate: new Date() }]) }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Is any RMA overdue right now?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('electronics.rmaOverdueSummary')
    expect(res.data?.answer).toContain('overdue')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Electronics: vendor warranty-claim recovery ledger.
  it('routes "vendor claim recovery" to electronics.vendorRecovery via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'ELECTRONICS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateVendorRecoveryLedgerReport).mockResolvedValue({
      generatedAt: '2026-08-01T00:00:00Z',
      rows: [{ claimNumber: 'RMA-00001', productName: 'Galaxy S24', vendorName: null, claimedAmount: 1000, recoveredAmount: 0, outstandingAmount: 1000, isClosed: false, closedAt: null }],
      summary: { totalClaimed: 1000, totalRecovered: 0, totalOutstanding: 1000, openCount: 1, closedCount: 0 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('How much vendor claim recovery is still outstanding?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('electronics.vendorRecovery')
    expect(res.data?.answer).toContain('outstanding')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Electronics: repair turnaround by technician.
  it('routes "repair turnaround by technician" to electronics.repairTurnaround via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'ELECTRONICS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateRepairTurnaroundByTechnicianReport).mockResolvedValue({
      generatedAt: '2026-08-20T00:00:00Z',
      rows: [{ technicianId: 'tech-1', technicianName: 'Ravi Kumar', ticketCount: 3, avgTurnaroundDays: 2, minTurnaroundDays: 1, maxTurnaroundDays: 4 }],
      summary: { technicianCount: 1, totalTicketsCompleted: 3, overallAvgTurnaroundDays: 2 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is the repair turnaround by technician?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('electronics.repairTurnaround')
    expect(res.data?.answer).toContain('turnaround')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Electronics: serial-number service lookup.
  it('routes "look up serial SN12345" to electronics.serialServiceLookup via the fast-path, with the serial extracted as searchTerm', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'ELECTRONICS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(lookupSerialService).mockResolvedValue({
      success: true,
      data: {
        serial: { id: 'ser-1', serialNumber: 'SN12345', imeiNumber: null, imei2Number: null, status: 'SOLD', warrantyExpiryDate: null, productId: 'prod-1', productName: 'Galaxy S24' },
        purchase: null, tickets: [], replacedOnTicket: null
      }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Look up serial SN12345')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('electronics.serialServiceLookup')
    expect(res.data?.answer).toContain('Galaxy S24')
    expect(lookupSerialService).toHaveBeenCalledWith('SN12345')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Clothing: Season/Collection Sell-Through Report.
  it('routes "season sell-through rate" to clothing.seasonSellThrough via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateSeasonSellThroughReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-31',
      rows: [{ month: '2026-08', season: 'Summer 2026', unitsSold: 40, currentStock: 10, sellThroughRate: 80 }]
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is the season sell-through rate?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('clothing.seasonSellThrough')
    expect(res.data?.answer).toContain('Summer 2026')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Clothing: size-curve reorder suggestion.
  it('routes "reorder split by size for Cotton T-Shirt" to clothing.sizeCurveReorderSuggestion via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Cotton T-Shirt' }) }
    } as never)
    vi.mocked(getSizeCurveReorderSuggestion).mockResolvedValue({
      success: true,
      data: { productId: 'prod-1', totalReorderQty: 40, lookbackDays: 90, rows: [{ variantId: 'var-m', size: 'M', color: null, unitsSoldRecently: 30, suggestedQuantity: 30 }] }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is the reorder split by size for Cotton T-Shirt?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('clothing.sizeCurveReorderSuggestion')
    expect(res.data?.answer).toContain('Cotton T-Shirt')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Clothing: Size × Style Heatmap.
  it('routes "size style heatmap" to clothing.sizeStyleHeatmap via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateSizeStyleHeatmapReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-31',
      styles: ['Cotton T-Shirt'], sizes: ['L'],
      cells: [{ style: 'Cotton T-Shirt', size: 'L', unitsSold: 25 }],
      summary: { totalUnitsSold: 25, topCellStyle: 'Cotton T-Shirt', topCellSize: 'L', topCellUnitsSold: 25 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me the size style heatmap')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('clothing.sizeStyleHeatmap')
    expect(res.data?.answer).toContain('Cotton T-Shirt')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Clothing item 4: size/color exchange workflow. Locks in
  // that "exchange" wording routes here, not the existing bare "return"
  // pattern sales.returnsAndRefunds already owns.
  it('routes "how many exchanges this month" to clothing.exchangeSummary via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) },
      invoice: { findMany: vi.fn().mockResolvedValue([{ totalAmount: 650 }]) }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('How many exchanges this month?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('clothing.exchangeSummary')
    expect(res.data?.answer).toContain('1 size/colour exchange')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Clothing item 5: Margin by Brand/Vendor Report. Locks
  // in that "vendor margin" wording routes here, not the existing bare
  // "margin" pattern fastSlowMoverMatrix already owns.
  it('routes "margin by vendor" to clothing.vendorMargin via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateVendorMarginReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-31',
      rows: [{ supplierId: 's1', supplierName: 'Acme Apparel', revenue: 500, cogs: 300, margin: 200, marginPercent: 40 }],
      summary: { totalRevenue: 500, totalCogs: 300, totalMargin: 200, vendorCount: 1 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me margin by vendor')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('clothing.vendorMargin')
    expect(res.data?.answer).toContain('Acme Apparel')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Footwear item 2. Locks in that the SAME "margin by
  // vendor" wording routes to footwear's OWN distinct intent for a
  // FOOTWEAR business, not clothing.vendorMargin — the two templates share
  // an overlapping regex but tryFastPathClassify only ever considers
  // templates actually registered for the current business type.
  it('routes "margin by vendor" to footwear.brandMarginReturnRate (not clothing.vendorMargin) for a FOOTWEAR business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateBrandMarginReturnRateReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-31',
      rows: [{ supplierId: 's1', supplierName: 'Acme Footwear', revenue: 500, cogs: 300, margin: 200, marginPercent: 40, unitsSold: 10, unitsReturned: 2, returnRatePercent: 20 }],
      summary: { totalRevenue: 500, totalMargin: 200, overallReturnRatePercent: 20, vendorCount: 1 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me margin by vendor')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('footwear.brandMarginReturnRate')
    expect(res.data?.answer).toContain('Acme Footwear')
    expect(res.data?.answer).toContain('20%')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Footwear item 3: trial-pair counter workflow.
  it('routes "trial conversion rate" to footwear.trialConversionRate for a FOOTWEAR business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(getTrialConversionSummary).mockResolvedValue({
      success: true,
      data: { totalSessions: 8, convertedSessions: 5, conversionRatePercent: 62.5, avgPairsTriedPerSession: 2.3, avgPairsTriedPerConversion: 2.1 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our trial conversion rate?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('footwear.trialConversionRate')
    expect(res.data?.answer).toContain('62.5%')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap. Locks in
  // that this routes correctly and NOT to the earlier, broader
  // clothing.sizeStyleHeatmap entry — both are registered for FOOTWEAR, so
  // this only works because the wording deliberately avoids "heatmap".
  it('routes "which sizes are out of stock" to footwear.sizeAvailabilityHeatmap for a FOOTWEAR business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateSizeAvailabilityHeatmapReport).mockResolvedValue({
      lowStockThreshold: 3,
      styles: ['Trail Runner'], sizes: ['8'],
      cells: [{ style: 'Trail Runner', size: '8', stockQty: 0, status: 'OUT' }],
      summary: { totalStyles: 1, outOfStockCells: 1, lowStockCells: 0, styleWithMostGaps: 'Trail Runner', styleGapCount: 1 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Which sizes are out of stock?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('footwear.sizeAvailabilityHeatmap')
    expect(res.data?.answer).toContain('Trail Runner')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar.
  it('routes "seasonal reorder calendar" to footwear.seasonalReorderStatus for a FOOTWEAR business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(getSeasonalReorderCalendar).mockResolvedValue({
      success: true,
      data: [{ id: 'c1', name: 'Monsoon', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30, leadTimeDays: 30, status: 'REORDER_NOW', daysUntilStart: 10, reorderByDate: '2026-05-02', nextStartDate: '2026-06-01', products: [], lowOrOutOfStockCount: 0 }]
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me the seasonal reorder calendar')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('footwear.seasonalReorderStatus')
    expect(res.data?.answer).toContain('Monsoon')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Manufacturing items 1-5.
  it('routes "what is our landed cost per unit" to manufacturing.landedCostPerUnit for a MANUFACTURING business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateLandedCostPerUnitReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ productId: 'p1', productName: 'Steel Bracket', producedQty: 100, materialCostPerUnit: 50, laborCostPerUnit: 20, overheadCostPerUnit: 5, totalCostPerUnit: 75 }],
      summary: { totalOrders: 1, totalProducedQty: 100 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our landed cost per unit?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('manufacturing.landedCostPerUnit')
    expect(res.data?.answer).toContain('Steel Bracket')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "what is our rejection rate" to manufacturing.rejectionRateTrend for a MANUFACTURING business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateRejectionRateTrendReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      trend: [{ month: '2026-07', qtyInspected: 200, qtyRejected: 20, rejectionRatePercent: 10 }],
      byStage: [{ taskName: 'Assembly', qtyInspected: 100, qtyRejected: 18, rejectionRatePercent: 18 }],
      summary: { totalInspected: 200, totalRejected: 20, overallRejectionRatePercent: 10 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our rejection rate?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('manufacturing.rejectionRateTrend')
    expect(res.data?.answer).toContain('Assembly')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "how much downtime did we have" to manufacturing.downtimeSummary for a MANUFACTURING business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(getDowntimeSummary).mockResolvedValue({
      success: true, data: { totalMinutes: 105, byReason: [{ reason: 'Machine breakdown', minutes: 105 }] }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('How much downtime did we have?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('manufacturing.downtimeSummary')
    expect(res.data?.answer).toContain('105')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "what is our bottleneck stage" to manufacturing.bottleneckFlag for a MANUFACTURING business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(getWorkOrderBottleneckFlag).mockResolvedValue({
      success: true,
      data: { bottleneckStage: 'Assembly', avgDurationHours: 4, shareOfTotalLeadTimePercent: 66.7, stages: [{ taskName: 'Assembly', avgDurationHours: 4, sampleCount: 5 }] }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our bottleneck stage?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('manufacturing.bottleneckFlag')
    expect(res.data?.answer).toContain('Assembly')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Agri Inputs items 2-5.
  it('routes "what is our seasonal credit exposure" to agriInputs.seasonalCreditExposure for an AGRI_INPUTS business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateSeasonalCreditExposureReport).mockResolvedValue({
      byMonth: [], bySeason: [],
      summary: { totalOutstanding: 8000, totalInvoices: 5, peakMonth: 'Apr', peakMonthAmount: 5000 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our seasonal credit exposure?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('agriInputs.seasonalCreditExposure')
    expect(res.data?.answer).toContain('Apr')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "which farmers have the worst repayment history" to agriInputs.farmerRepayment for an AGRI_INPUTS business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateFarmerRepaymentReport).mockResolvedValue({
      rows: [{ customerId: 'c1', customerName: 'Risky Farmer', phone: null, totalPurchased: 1000, totalRepaid: 100, outstandingBalance: 900, repaymentRatePercent: 10 }],
      summary: { totalFarmers: 1, totalOutstanding: 900, overallRepaymentRatePercent: 10 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me farmer repayment history')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('agriInputs.farmerRepayment')
    expect(res.data?.answer).toContain('Risky Farmer')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "give me crop advisory recommendations" to agriInputs.cropAdvisory for an AGRI_INPUTS business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(listDistinctCrops).mockResolvedValue({ success: true, data: ['Cotton', 'Wheat'] } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Give me crop advisory recommendations')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('agriInputs.cropAdvisory')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "is any equipment due for service" to agriInputs.equipmentServiceDue for an AGRI_INPUTS business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(listEquipmentDueForService).mockResolvedValue({
      success: true,
      data: [{ serialId: 's1', productName: 'Tractor A', serialNumber: 'SN-1', nextServiceDueDate: '2026-08-01', dueForService: true, overdue: true }]
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Is any equipment due for service?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('agriInputs.equipmentServiceDue')
    expect(res.data?.answer).toContain('overdue')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Blood Bank items 1, 3, 4.
  it('routes "which donors are eligible to donate again" to bloodBank.donorsDueForRecall for a BLOOD_BANK business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'BLOOD_BANK' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(listDonorsDueForRecall).mockResolvedValue({ success: true, data: [{ fullName: 'Ravi Kumar', bloodGroup: 'O+' }] } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Which donors are eligible to donate again?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('bloodBank.donorsDueForRecall')
    expect(res.data?.answer).toContain('Ravi Kumar')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "show me camp turnout" to bloodBank.campTurnout for a BLOOD_BANK business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'BLOOD_BANK' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(listDonationCamps).mockResolvedValue({
      success: true, data: [{ campName: 'Community Hall Drive', _count: { donations: 40 } }]
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me camp turnout')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('bloodBank.campTurnout')
    expect(res.data?.answer).toContain('Community Hall Drive')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "what is our donation to issue cycle time" to bloodBank.donationToIssueCycleTime for a BLOOD_BANK business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'BLOOD_BANK' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateDonationToIssueCycleTimeReport).mockResolvedValue({
      summary: { totalIssuedUnits: 5, overallAvgDays: 6.2 }, byComponent: []
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our donation to issue cycle time?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('bloodBank.donationToIssueCycleTime')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per unit.
  it('routes "what is our asset utilization rate" to rental.assetUtilization for a RENTAL business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RENTAL' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateAssetUtilizationReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ rentalUnitId: 'u1', unitLabel: 'Car B', productName: 'Sedan Car', status: 'AVAILABLE', rentedDays: 0, availableDays: 31, utilizationPercent: 0 }],
      summary: { totalUnits: 1, avgUtilizationPercent: 0, idleUnitCount: 1 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our asset utilization rate?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('rental.assetUtilization')
    expect(res.data?.answer).toContain('Sedan Car')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Jewellery items 1-5. Confirms the more-specific margin
  // pattern wins over jewellery.stockAndSales's own broad `/making[\s-]
  // charge/i` pattern when it appears earlier in the fast-path array.
  it('routes "making charge margin breakdown" to jewellery.makingChargeMargin, not the broader jewellery.stockAndSales', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'JEWELLERY' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateMakingChargeMarginReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [{ invoiceId: 'i1' }],
      summary: { totalMetalValue: 47500, totalMakingCharge: 2500, avgMakingChargePercent: 5 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me the making charge margin breakdown')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('jewellery.makingChargeMargin')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "hallmark compliance" to jewellery.hallmarkCompliance for a JEWELLERY business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'JEWELLERY' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateHallmarkComplianceReport).mockResolvedValue({
      rows: [], summary: { totalItems: 5, compliantCount: 5, nonCompliantCount: 0, compliancePercent: 100 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me our hallmark compliance register')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('jewellery.hallmarkCompliance')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Service items 1/4.
  it('routes "sla breaches" to service.slaBreaches for a SERVICE business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'SERVICE' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(listTickets).mockResolvedValue({ success: true, data: { tickets: [{ isSlaBreached: true }], total: 1 } } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Do we have any SLA breaches right now?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('service.slaBreaches')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "repeat business rate" to service.repeatBusinessRate for a SERVICE business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'SERVICE' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateRepeatBusinessRateReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [{ month: '2026-07', newCustomers: 2, repeatCustomers: 8, repeatRatePercent: 80 }]
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our repeat business rate?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('service.repeatBusinessRate')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Consultant items 2/5.
  it('routes "utilization rate" to consultant.utilization for a CONSULTANT business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CONSULTANT' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(reportService.generateConsultantUtilizationReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ userName: 'Priya', billableHours: 5, nonBillableHours: 35, totalHours: 40, utilizationPercent: 12.5 }],
      summary: { totalBillableHours: 5, totalNonBillableHours: 35, overallUtilizationPercent: 12.5 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our utilization rate?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('consultant.utilization')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('routes "proposal win rate" to consultant.proposalWinRate for a CONSULTANT business', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CONSULTANT' } as never })
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
      aiQueryLog: { create: vi.fn().mockResolvedValue({}) }
    } as never)
    vi.mocked(getProposalWinRateStats).mockResolvedValue({
      success: true, data: { totalProposals: 10, won: 6, lost: 2, pending: 2, winRatePercent: 75 }
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is our proposal win rate?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('consultant.proposalWinRate')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — General's Combined Cash Position Trend. Locks in that
  // "cash position" routes here, not the pre-existing cashFlow.projectionNextMonth
  // intent (daily net movement, not a cumulative running position).
  it('routes "what is my cash position" to general.cashPositionTrend via the fast-path', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'GENERAL' } as never })
    vi.mocked(reportService.generateCashPositionTrendReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-13',
      points: [{ date: '2026-07-01', balance: 1000 }], openingBalance: 1000, closingBalance: 1500, netChange: 500,
    } as never)
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What is my cash position?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('general.cashPositionTrend')
    expect(res.data?.answer).toContain('grew')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('never calls generateResponse (the LLM phrasing call) for any successful answer — removed entirely for latency, per PHASE_57_TECHNICAL_SPEC.md addendum', async () => {
    vi.mocked(reportService.generateOutstandingReport).mockResolvedValue({
      generatedAt: '2026-07-13', customers: { totalOutstanding: 1000, count: 1, rows: [{ id: 'c1', customerName: 'Test Co', phone: null, outstanding: 1000, aging: {} as never }], agingTotals: {} as never },
      suppliers: { totalOutstanding: 0, count: 0, rows: [], agingTotals: {} as never }
    } as never)
    const fake = new FakeAIProvider({ 'Who owes me money right now, exactly?': { template: 'credit.whoOwesMe', category: 'credit', params: {} } })
    const generateSpy = vi.spyOn(fake, 'generateResponse')
    setAIProvider(fake)

    const res = await askQuestion('Who owes me money right now, exactly?')

    expect(res.success).toBe(true)
    expect(res.data?.answer).toContain('₹1,000.00')
    expect(generateSpy).not.toHaveBeenCalled()
  })

  it('fires the fixed, code-owned refusal for an out-of-scope question — never asks the model to phrase a refusal', async () => {
    const fake = new FakeAIProvider({
      'Should I file for GST this month?': { template: null, category: 'out_of_scope', params: {} }
    })
    const generateSpy = vi.spyOn(fake, 'generateResponse')
    setAIProvider(fake)

    const res = await askQuestion('Should I file for GST this month?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBeNull()
    expect(res.data?.answer).toMatch(/legal|tax|medical|investment|compliance/i)
    expect(generateSpy).not.toHaveBeenCalled()
  })

  it('fires the fixed fallback string on a genuinely empty result, before ever calling the phrasing model', async () => {
    vi.mocked(getOutstandingAmount).mockResolvedValue(0)
    const fake = new FakeAIProvider({
      'How much do people owe me?': { template: 'credit.totalReceivable', category: 'credit', params: {} }
    })
    const generateSpy = vi.spyOn(fake, 'generateResponse')
    setAIProvider(fake)

    const res = await askQuestion('How much do people owe me?')

    expect(res.success).toBe(true)
    expect(res.data?.answer).toMatch(/could not find enough information/i)
    expect(generateSpy).not.toHaveBeenCalled()
  })

  it('reuses generateProfitAndLossReport verbatim — no parallel profit calculation', async () => {
    vi.mocked(reportService.generateProfitAndLossReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-13',
      summary: { revenue: 100000, cogs: 60000, grossProfit: 40000, grossMarginPercent: 40, totalExpenses: 10000, netProfit: 30000, netMarginPercent: 30, invoiceCount: 20 },
      expensesByCategory: []
    } as never)
    const fake = new FakeAIProvider(
      { 'What was my profit this month?': { template: 'finance.profitAndLoss', category: 'finance', params: {} } },
      'Your net profit was ₹30,000, a 30% margin.'
    )
    setAIProvider(fake)

    const res = await askQuestion('What was my profit this month?')

    expect(res.success).toBe(true)
    expect(reportService.generateProfitAndLossReport).toHaveBeenCalledTimes(1)
  })

  // Real bug found live 2026-07-13 (full question-battery test against real
  // data): a business with expenses exceeding revenue this month got told
  // "Net profit for the selected period: ₹9,876.54" — formatAmountForSpeech
  // used to Math.abs() every amount, silently turning a real loss into a
  // same-magnitude "profit". Fixed in two places: formatAmountForSpeech now
  // preserves the sign (ai-format.util.test.ts), and this template now says
  // "Net loss" instead of "Net profit" when the number is negative, so a
  // skimming reader can't miss it even with the minus sign.
  it('says "Net loss", not "Net profit", and keeps the minus sign, when netProfit is negative', async () => {
    vi.mocked(reportService.generateProfitAndLossReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-13',
      summary: { revenue: 13523.46, cogs: 200, grossProfit: 13323.46, grossMarginPercent: 98.5, totalExpenses: 23600, netProfit: -9876.54, netMarginPercent: -73, invoiceCount: 2 },
      expensesByCategory: []
    } as never)
    const fake = new FakeAIProvider({
      'What was my profit this month?': { template: 'finance.profitAndLoss', category: 'finance', params: {} }
    })
    setAIProvider(fake)

    const res = await askQuestion('What was my profit this month?')

    expect(res.success).toBe(true)
    expect(res.data?.answer).toContain('Net loss for the selected period: -₹9,876.54')
    expect(res.data?.answer).not.toContain('Net profit')
  })

  it('wires a newly-added aggregation function (inventory.deadStock) — not just the templates from the first pass', async () => {
    vi.mocked(getDeadStock).mockResolvedValue([
      { productName: 'Old Stock Item', sku: 'SKU-1', currentStock: 5, lastSoldDate: '2026-01-01' }
    ])
    const fake = new FakeAIProvider(
      { 'What has not sold in a while?': { template: 'inventory.deadStock', category: 'inventory', params: { days: 90 } } },
      "You have 1 product that hasn't sold in 90 days."
    )
    setAIProvider(fake)

    const res = await askQuestion('What has not sold in a while?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('inventory.deadStock')
    expect(getDeadStock).toHaveBeenCalledWith(90)
  })

  // Real bug found live 2026-07-13 by a full question-battery test against
  // the real model: this exact phrasing was misclassified as
  // credit.whoOwesMe (a confidently wrong answer about customer balances,
  // not suppliers) — likely "who" pattern-matching onto the far more common
  // "who owes me" template. A FakeAIProvider-scripted test couldn't have
  // caught this (it always returns whatever the test tells it to for a
  // given question, real classification failure or not) — only real live
  // testing did. Fixed with a dedicated fast-path entry; this test now also
  // asserts the model is never even reached for this phrasing.
  it('routes "who do I buy the most from" to suppliers.topByPurchaseVolume via the fast-path, not the credit.whoOwesMe misclassification the model produced live', async () => {
    vi.mocked(getTopSuppliersByPurchaseVolume).mockResolvedValue([
      { supplierName: 'Acme Supplies', phone: null, poCount: 4, totalPurchaseValue: 50000 }
    ])
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Who do I buy the most from?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('suppliers.topByPurchaseVolume')
    expect(res.data?.answer).toContain('Acme Supplies')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 61 — real Bill-based "what am I spending the most on" question,
  // distinct from suppliers.topByPurchaseVolume (per-vendor, not per-item).
  it('routes "what am I spending the most on" to suppliers.topPurchasedItems via the fast-path', async () => {
    vi.mocked(reportService.generatePurchasesByItemReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-11',
      summary: { totalPurchases: 15000, itemCount: 2 },
      rows: [
        { itemName: 'Widget', isService: false, quantity: 50, totalAmount: 10000, billCount: 3 },
        { itemName: 'AMC — quarterly', isService: true, quantity: 1, totalAmount: 5000, billCount: 1 }
      ]
    })
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What am I spending the most on?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('suppliers.topPurchasedItems')
    expect(res.data?.answer).toContain('Widget')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Phase 61 — Section 3.3's "what do I owe [vendor]" and "what did I spend
  // on [vendor] last month" both resolve through this same by-name lookup.
  it('"look up supplier Acme" now also answers what is owed and this-period spend, not just phone', async () => {
    vi.mocked(searchSuppliers).mockResolvedValue({
      success: true,
      data: [{ id: 'sup-1', supplierName: 'Acme Supplies', phone: '9999999999', supplierCode: 'SUP-00001' }]
    })
    vi.mocked(supplierLedgerService.calculateBalance).mockResolvedValue(4500)
    const db = { businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) }, aiQueryLog: { create: vi.fn().mockResolvedValue({}) }, bill: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 12000 } }) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const fake = new FakeAIProvider({
      'Look up supplier Acme': { template: 'suppliers.byName', category: 'suppliers', params: {} }
    })
    setAIProvider(fake)

    const res = await askQuestion('Look up supplier Acme')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('suppliers.byName')
    expect(res.data?.answer).toContain('Acme Supplies')
    expect(res.data?.answer).toContain('4,500')
    expect(res.data?.answer).toContain('12,000')
  })

  it('routes "show me my purchase register" to suppliers.purchaseRegisterSummary via the fast-path', async () => {
    vi.mocked(reportService.generatePurchaseRegisterReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-11',
      summary: { totalPurchases: 50000, billCount: 4, totalTax: 7627 },
      byVendor: [{ supplierName: 'Acme Supplies', totalAmount: 30000, billCount: 3 }],
      rows: [{ billNumber: 'BILL-00001', date: '2026-08-05', supplier: 'Acme Supplies', status: 'OPEN', itemCount: 1, subtotal: 25424, discountAmount: 0, taxAmount: 4576, totalAmount: 30000 }],
      total: 1
    })
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('Show me my purchase register')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('suppliers.purchaseRegisterSummary')
    expect(res.data?.answer).toContain('Acme Supplies')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // FEATURE RESTORE regression tests (2026-07-13) — the classification
  // grammar no longer emits topN/days/dateFrom/dateTo (latency fix), so
  // these values must now reach the template via extractParams's
  // deterministic regex/date-arithmetic extraction instead.
  it('extracts a spoken topN ("top 3") and passes it through to the template, even though the classifier itself returns empty params', async () => {
    vi.mocked(getTopSuppliersByPurchaseVolume).mockResolvedValue([
      { supplierName: 'Acme Supplies', phone: null, poCount: 4, totalPurchaseValue: 50000 }
    ])
    const fake = new FakeAIProvider({
      'Who are my top 3 suppliers?': { template: 'suppliers.topByPurchaseVolume', category: 'suppliers', params: {} }
    })
    setAIProvider(fake)

    const res = await askQuestion('Who are my top 3 suppliers?')

    expect(res.success).toBe(true)
    expect(getTopSuppliersByPurchaseVolume).toHaveBeenCalledWith(3)
  })

  it('extracts a spoken day count ("last 30 days") and passes it through to the template', async () => {
    vi.mocked(getDeadStock).mockResolvedValue([])
    const fake = new FakeAIProvider({
      'What has not sold in the last 30 days?': { template: 'inventory.deadStock', category: 'inventory', params: {} }
    })
    setAIProvider(fake)

    await askQuestion('What has not sold in the last 30 days?')

    expect(getDeadStock).toHaveBeenCalledWith(30)
  })

  it('extracts "last month" as an actual computed date range and passes it through, not just the current-month default', async () => {
    vi.mocked(reportService.generateProfitAndLossReport).mockResolvedValue({
      dateFrom: '2026-06-01', dateTo: '2026-06-30',
      summary: { revenue: 50000, cogs: 30000, grossProfit: 20000, grossMarginPercent: 40, totalExpenses: 5000, netProfit: 15000, netMarginPercent: 30, invoiceCount: 10 },
      expensesByCategory: []
    } as never)
    const fake = new FakeAIProvider({
      'What was my profit last month?': { template: 'finance.profitAndLoss', category: 'finance', params: {} }
    })
    setAIProvider(fake)

    const res = await askQuestion('What was my profit last month?')

    expect(res.success).toBe(true)
    const call = vi.mocked(reportService.generateProfitAndLossReport).mock.calls[0][0] as { dateFrom: string; dateTo: string }
    // Computed relative to the real wall-clock "today" (this suite doesn't
    // mock the system clock elsewhere either) rather than hardcoded, so the
    // test doesn't go stale/flaky when actually run in a different month.
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    expect(call.dateFrom).toBe(toISO(lastMonth))
    expect(call.dateTo).toBe(toISO(lastMonthEnd))
  })

  // Coverage-gap closure (2026-07-13) — Placement Agency was previously
  // genuinely uncovered by any vertical template; getPlacementKPIs()
  // already existed and fits the same reuse pattern as every other
  // template, so there was no reason to leave it out.
  it('answers a placement-agency question via the newly-wired placement.summary template, reusing getPlacementKPIs verbatim', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'PLACEMENT_AGENCY' } as never })
    vi.mocked(getPlacementKPIs).mockResolvedValue({
      success: true,
      data: { activeCandidates: 12, openJobOrders: 4, placementsThisMonth: 3, revenueThisMonth: 45000 }
    })
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('How many candidates placed this month?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('placement.summary')
    expect(res.data?.answer).toContain('3 candidates placed this month')
    expect(res.data?.answer).toContain('₹45,000.00')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('refuses a vertical template that does not apply to this business\'s installed type — the model cannot answer a hotel question for a non-hotel business', async () => {
    // beforeEach already stubs getActiveTemplate to businessType: 'GENERAL',
    // which maps to zero vertical templates in ai-vertical-templates.service.ts.
    const fake = new FakeAIProvider({
      'How many rooms are occupied?': { template: 'hotel.occupancy', category: 'vertical', params: {} }
    })
    const generateSpy = vi.spyOn(fake, 'generateResponse')
    setAIProvider(fake)

    const res = await askQuestion('How many rooms are occupied?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBeNull()
    expect(res.data?.answer).toMatch(/legal|tax|medical|investment|compliance/i)
    expect(generateSpy).not.toHaveBeenCalled()
  })

  it('answers a vertical template correctly when the business type actually matches', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'HOTEL_LODGE', enabledModules: ['hotel_bookings'], dashboardLayout: 'service' } as never })
    const { getOccupancyReport } = await import('../hotel.service')
    vi.mocked(getOccupancyReport).mockResolvedValue({
      success: true,
      data: { asOf: '2026-07-13', totalRooms: 10, occupied: 7, available: 2, cleaning: 1, maintenance: 0, occupancyPercent: 70 }
    })
    const fake = new FakeAIProvider(
      { 'How many rooms are occupied?': { template: 'hotel.occupancy', category: 'vertical', params: {} } },
      '7 of your 10 rooms are occupied right now.'
    )
    setAIProvider(fake)

    const res = await askQuestion('How many rooms are occupied?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('hotel.occupancy')
    expect(res.data?.answer).toContain('7')
  })

  // PHASE_57_TECHNICAL_SPEC.md Section 9: "zero network calls — proven, not
  // asserted." Spies on the actual Node network primitives during a full,
  // real pipeline execution (not just a grep of the source) — if anything in
  // Sarang's own AI-subsystem code ever reached for the network, this fails.
  // (node-llama-cpp itself is a separately-documented, well-established
  // pure-local inference library — this test's job is proving SARANG'S code
  // never does, not re-verifying a third-party library's own architecture.)
  it('makes zero network calls anywhere in the pipeline — proven by spying on the real network primitives, not asserted', async () => {
    httpRequestSpy.mockClear()
    httpsRequestSpy.mockClear()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    vi.mocked(getDashboardKpis).mockResolvedValue({
      todaySales: 500, todayTrend: 5, weekSales: 0, weekTrend: 0, monthSales: 0, monthTrend: 0,
      totalInvoices: 3, outstanding: 0, inventoryValue: 0, monthExpenses: 0, expenseTrend: 0,
      estimatedProfit: 0, profitTrend: 0, lowStockCount: 0, customerCount: 0, supplierCount: 0,
      inventoryStats: {} as never
    })
    const fake = new FakeAIProvider(
      { 'How much did I sell today?': { template: 'sales.totalToday', category: 'sales', params: {} } },
      'You sold ₹500 today.'
    )
    setAIProvider(fake)

    const res = await askQuestion('How much did I sell today?')

    expect(res.success).toBe(true)
    expect(httpRequestSpy).not.toHaveBeenCalled()
    expect(httpsRequestSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  // Capabilities/suggestions meta.* templates — added so the assistant can
  // describe its own scope and surface existing dashboard alerts on request,
  // without ever calling the model (same fixed-text principle as
  // REFUSAL_MESSAGE/FALLBACK_MESSAGE).
  it('answers "what can you do" via the deterministic fast-path, describing real scope without calling the model', async () => {
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What can you do?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('meta.capabilities')
    expect(res.data?.answer).toMatch(/sales, inventory, customers, suppliers, credit, finance and banking, staff and payroll, purchasing, cost centres and budgets, and documents/i)
    expect(res.data?.answer).toMatch(/legal, tax, medical, investment, or compliance/i)
    expect(classifySpy).not.toHaveBeenCalled()
  })

  // Real design constraint being locked in: `isDeterministicallyOutOfScope`'s
  // `/\bshould i\b/i` pattern runs BEFORE the fast-path and would refuse this
  // as advice-seeking if the suggestions trigger phrasing used the word
  // "should" — the trigger phrasings deliberately avoid it. This test proves
  // the question actually reaches meta.suggestions, not the refusal path.
  it('answers "what needs my attention" via meta.suggestions, not the out-of-scope refusal', async () => {
    vi.mocked(getDashboardAlerts).mockResolvedValue([
      { type: 'LOW_STOCK', message: '3 products are at or below reorder level', severity: 'warning' },
      { type: 'LARGE_OUTSTANDING', message: 'Total customer outstanding exceeds ₹50K. Review pending payments.', severity: 'danger' }
    ])
    const fake = new FakeAIProvider()
    const classifySpy = vi.spyOn(fake, 'classifyIntent')
    setAIProvider(fake)

    const res = await askQuestion('What needs my attention?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('meta.suggestions')
    expect(res.data?.answer).toContain('2 things may need your attention')
    expect(res.data?.answer).toContain('1 urgent')
    expect(res.data?.answer).toContain('3 products are at or below reorder level')
    expect(classifySpy).not.toHaveBeenCalled()
  })

  it('says nothing needs attention, not the generic "could not find" fallback, when getDashboardAlerts returns zero alerts', async () => {
    vi.mocked(getDashboardAlerts).mockResolvedValue([])
    const fake = new FakeAIProvider()
    setAIProvider(fake)

    const res = await askQuestion('Any suggestions for me?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('meta.suggestions')
    expect(res.data?.answer).toMatch(/nothing needs your attention/i)
    expect(res.data?.answer).not.toMatch(/could not find enough information/i)
  })

  // AI expansion, 2026-07 — extractParams' new tryParseSpecificDate() and
  // this-year/last-year branches, and extractSearchTerm()'s Tier 2
  // record-lookup extraction. These are new regex/date-arithmetic logic
  // with no prior coverage — routed through an already-mocked template
  // (sales.averageInvoiceValue → generateSalesReport) rather than adding a
  // real Prisma mock for every new template individually.
  describe('AI expansion — new param extraction', () => {
    it('parses a specific calendar date ("15th Jan 2025") into a single-day dateFrom/dateTo range', async () => {
      vi.mocked(reportService.generateSalesReport).mockResolvedValue({
        summary: { averageOrderValue: 1200, totalInvoices: 5 }
      } as never)
      const fake = new FakeAIProvider({
        'What was my average invoice value on 15th Jan 2025?': { template: 'sales.averageInvoiceValue', category: 'sales', params: {} }
      })
      setAIProvider(fake)

      const res = await askQuestion('What was my average invoice value on 15th Jan 2025?')

      expect(res.success).toBe(true)
      const call = vi.mocked(reportService.generateSalesReport).mock.calls[0][0] as { dateFrom: string; dateTo: string }
      expect(call.dateFrom).toBe('2025-01-15')
      expect(call.dateTo).toBe('2025-01-15')
    })

    it('rolls a year-less specific date back to the most recent past occurrence when it would otherwise land in the future', async () => {
      vi.mocked(reportService.generateSalesReport).mockResolvedValue({
        summary: { averageOrderValue: 1200, totalInvoices: 5 }
      } as never)
      const now = new Date()
      const future = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
      const dayMonth = `${future.getDate()}th ${future.toLocaleString('en-US', { month: 'long' })}`
      const fake = new FakeAIProvider({
        [`What was my average invoice value on ${dayMonth}?`]: { template: 'sales.averageInvoiceValue', category: 'sales', params: {} }
      })
      setAIProvider(fake)

      await askQuestion(`What was my average invoice value on ${dayMonth}?`)

      const call = vi.mocked(reportService.generateSalesReport).mock.calls[0][0] as { dateFrom: string; dateTo: string }
      const expected = new Date(now.getFullYear() - 1, future.getMonth(), future.getDate())
      expect(call.dateFrom).toBe(toISO(expected))
    })

    it('extracts "this year" as Jan 1 of the current year through today', async () => {
      vi.mocked(reportService.generateSalesReport).mockResolvedValue({
        summary: { averageOrderValue: 1200, totalInvoices: 5 }
      } as never)
      const fake = new FakeAIProvider({
        'What was my average invoice value this year?': { template: 'sales.averageInvoiceValue', category: 'sales', params: {} }
      })
      setAIProvider(fake)

      await askQuestion('What was my average invoice value this year?')

      const call = vi.mocked(reportService.generateSalesReport).mock.calls[0][0] as { dateFrom: string; dateTo: string }
      const now = new Date()
      expect(call.dateFrom).toBe(toISO(new Date(now.getFullYear(), 0, 1)))
      expect(call.dateTo).toBe(toISO(now))
    })

    it('extracts "last year" as the full Jan 1 – Dec 31 range of the previous year', async () => {
      vi.mocked(reportService.generateSalesReport).mockResolvedValue({
        summary: { averageOrderValue: 1200, totalInvoices: 5 }
      } as never)
      const fake = new FakeAIProvider({
        'What was my average invoice value last year?': { template: 'sales.averageInvoiceValue', category: 'sales', params: {} }
      })
      setAIProvider(fake)

      await askQuestion('What was my average invoice value last year?')

      const call = vi.mocked(reportService.generateSalesReport).mock.calls[0][0] as { dateFrom: string; dateTo: string }
      const now = new Date()
      expect(call.dateFrom).toBe(toISO(new Date(now.getFullYear() - 1, 0, 1)))
      expect(call.dateTo).toBe(toISO(new Date(now.getFullYear() - 1, 11, 31)))
    })

    it('extracts a quoted name as the Tier 2 search term and passes it to searchCustomers verbatim', async () => {
      vi.mocked(searchCustomers).mockResolvedValue({
        success: true,
        data: [{ customerName: 'Ramesh Kumar', phone: '9876543210', outstandingBalance: 500, customerCode: 'CUS-00012' }]
      } as never)
      const fake = new FakeAIProvider({
        'Look up customer "Ramesh Kumar"': { template: 'customers.byNameOrPhone', category: 'customers', params: {} }
      })
      setAIProvider(fake)

      const res = await askQuestion('Look up customer "Ramesh Kumar"')

      expect(res.success).toBe(true)
      expect(searchCustomers).toHaveBeenCalledWith('Ramesh Kumar')
      expect(res.data?.answer).toContain('Ramesh Kumar')
      expect(res.data?.answer).toContain('9876543210')
    })

    it('falls back to the standard fallback message when no identifier can be extracted from a Tier 2 lookup question', async () => {
      const fake = new FakeAIProvider({
        'look up that customer': { template: 'customers.byNameOrPhone', category: 'customers', params: {} }
      })
      setAIProvider(fake)

      const res = await askQuestion('look up that customer')

      expect(res.success).toBe(true)
      expect(searchCustomers).not.toHaveBeenCalled()
      expect(res.data?.answer).toMatch(/could not find enough information/i)
    })

    it('wires the Tier 1 customers.totalCount template to listCustomers verbatim', async () => {
      vi.mocked(listCustomers).mockResolvedValue({ success: true, data: { total: 42 } } as never)
      const fake = new FakeAIProvider({
        'How many customers do I have?': { template: 'customers.totalCount', category: 'customers', params: {} }
      })
      setAIProvider(fake)

      const res = await askQuestion('How many customers do I have?')

      expect(res.success).toBe(true)
      expect(listCustomers).toHaveBeenCalledWith({ limit: 1 })
      expect(res.data?.answer).toContain('42 customers')
    })
  })
})

// Phase 62 — the 4 required "Ask Sarang AI" intents for Banking, Ledger &
// Compliance. All 4 routed here via their own real FAST_PATH_PATTERNS
// entries, exercising the same live pipeline as every question above rather
// than calling the template function directly.
describe('askQuestion — Phase 62 Banking/Ledger AI intents', () => {
  it('answers "what is my bank balance" via the fast-path, summing real currentBalance across active accounts', async () => {
    const db = makeMockDb()
    db.bankAccount = { findMany: vi.fn().mockResolvedValue([
      { accountName: 'HDFC Current', accountType: 'BANK', currentBalance: 40000, isActive: true },
      { accountName: 'Petty Cash', accountType: 'CASH', currentBalance: 5000, isActive: true },
    ]) }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('What is my bank balance?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('ledger.bankBalance')
    expect(res.data?.answer).toContain('₹45,000.00')
  })

  it('answers "show unreconciled transactions" via the fast-path, using the real read-only Prisma connection', async () => {
    vi.mocked(getReadOnlyPrisma).mockResolvedValue({
      bankStatementLine: {
        findMany: vi.fn().mockResolvedValue([
          { debitAmount: 0, creditAmount: 1200, description: 'NEFT Credit', transactionDate: new Date(), bankAccount: { accountName: 'HDFC Current' } }
        ]),
        count: vi.fn().mockResolvedValue(3)
      }
    } as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('Show me unreconciled transactions')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('ledger.unreconciledTransactions')
    expect(res.data?.answer).toContain('3 unreconciled')
  })

  it('answers "what interest do I owe on Ramesh overdue balance" via the fast-path, resolving the customer by name then computing real interest', async () => {
    vi.mocked(searchCustomers).mockResolvedValue({ success: true, data: [{ id: 'cust-1', customerName: 'Ramesh Kumar' }] } as never)
    const db = makeMockDb()
    db.businessProfile.findFirst = vi.fn().mockResolvedValue({ currencySymbol: '₹', creditInterestEnabled: true, creditInterestRatePercent: 12, creditInterestType: 'SIMPLE' })
    db.customer = { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }) }
    const dueDate = new Date(Date.now() - 60 * 86400000) // 60 days overdue
    db.invoice = { findMany: vi.fn().mockResolvedValue([
      { id: 'inv-1', invoiceNumber: 'INV-001', balanceAmount: 10000, dueDate }
    ]) }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('What interest do I owe on Ramesh overdue balance?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('credit.customerOverdueInterest')
    expect(searchCustomers).toHaveBeenCalledWith('Ramesh')
    // 10000 * 12% * (60/365) = 197.26 — same SIMPLE formula credit-interest.service.test.ts hand-verifies independently.
    expect(res.data?.answer).toContain('197.26')
  })

  it('answers "what is my fixed asset depreciation this year" via the fast-path, using the real read-only Prisma connection', async () => {
    vi.mocked(getReadOnlyPrisma).mockResolvedValue({
      fixedAssetDepreciation: {
        findMany: vi.fn().mockResolvedValue([
          { amount: 1666.67, periodEnd: new Date(), fixedAsset: { assetName: 'Delivery Van', assetCode: 'FA-001' } },
          { amount: 833.33, periodEnd: new Date(), fixedAsset: { assetName: 'Laptop', assetCode: 'FA-002' } }
        ])
      }
    } as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('What is my fixed asset depreciation this year?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('ledger.fixedAssetDepreciationThisYear')
    expect(res.data?.answer).toContain('₹2,500.00')
  })

  // Real bug found live 2026-08-12 (Phase 62 UAT against the real running
  // app, not a unit test — the mock above bypasses the where-clause entirely
  // by stubbing findMany's return value directly, so it couldn't have caught
  // this): a depreciation run for the CURRENT month sets periodEnd to that
  // month's last day (see FixedAssetDetailScreen.tsx's RunDepreciationModal
  // default) — a future timestamp relative to `now` on every day before the
  // month's last. The original query filtered `periodEnd: { lte: now }`,
  // silently excluding the most common real case (asking about depreciation
  // right after running it this month) and always answering "I could not
  // find enough information" instead. Fixed to bound by year-end, not `now`.
  it('bounds the depreciation-this-year query by year-end, not the current instant — regression guard', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getReadOnlyPrisma).mockResolvedValue({ fixedAssetDepreciation: { findMany } } as never)
    setAIProvider(new FakeAIProvider())

    await askQuestion('What is my fixed asset depreciation this year?')

    const whereArg = findMany.mock.calls[0][0].where.periodEnd as { gte: Date; lte: Date }
    const now = new Date()
    // A same-month depreciation run's periodEnd (the month's last day) must
    // fall inside the query's own range — the exact case the bug excluded.
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    expect(whereArg.lte.getTime()).toBeGreaterThanOrEqual(thisMonthEnd.getTime())
  })
})

describe('askQuestion — Phase 63 Sales Orders/Pricing AI intents', () => {
  it('answers "create a sales order for Ramesh" via the fast-path — points to the screen, never claims to have created one', async () => {
    vi.mocked(searchCustomers).mockResolvedValue({ success: true, data: [{ id: 'cust-1', customerName: 'Ramesh Kumar' }] } as never)
    const db = makeMockDb()
    db.$transaction = vi.fn((arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : arg))
    db.salesOrder = {
      findMany: vi.fn().mockResolvedValue([{ soNumber: 'SO-001', status: 'CONFIRMED' }]),
      count: vi.fn().mockResolvedValue(1)
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('Create a sales order for Ramesh')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('salesOrders.createForCustomer')
    expect(res.data?.answer).toContain('New Sales Order')
    expect(res.data?.answer).toContain('SO-001')
  })

  it('answers "what\'s on my price list for Ramesh" via the fast-path, resolving the customer then their assigned tiers', async () => {
    vi.mocked(searchCustomers).mockResolvedValue({ success: true, data: [{ id: 'cust-1', customerName: 'Ramesh Kumar', priceListId: 'pl-1' }] } as never)
    const db = makeMockDb()
    db.priceList = {
      findUnique: vi.fn().mockResolvedValue({
        name: 'Wholesale', items: [{ minQuantity: 50, unitPrice: 90, product: { productName: 'Widget' } }]
      })
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("What's on my price list for Ramesh?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('pricing.priceListForCustomer')
    expect(res.data?.answer).toContain('Wholesale')
    expect(res.data?.answer).toContain('Widget')
  })

  it('answers "show me this month\'s free-scheme cost" via the fast-path, using the real read-only Prisma connection', async () => {
    vi.mocked(getReadOnlyPrisma).mockResolvedValue({
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([
          { quantity: 2, product: { productName: 'Widget', sellingPrice: 100 }, scheme: { name: 'Buy 2 Get 1' } }
        ])
      }
    } as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("Show me this month's free-scheme cost")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('pricing.schemeCostThisMonth')
    expect(res.data?.answer).toContain('₹200.00')
  })

  it('answers "switch my invoice template" via the fast-path, listing templates and the current default', async () => {
    const db = makeMockDb()
    db.invoiceTemplate = {
      findFirst: vi.fn().mockResolvedValue({ id: 't-1', isSystem: true }),
      findMany: vi.fn().mockResolvedValue([
        { id: 't-1', name: 'Classic', isDefault: true, configJson: '{}' },
        { id: 't-2', name: 'Modern', isDefault: false, configJson: '{}' }
      ])
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('Switch my invoice template')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('invoiceTemplate.switch')
    expect(res.data?.answer).toContain('Classic')
    expect(res.data?.answer).toContain('Modern')
  })

  it('answers "what\'s still pending approval" via the fast-path, combining Sales Orders and Purchase Orders', async () => {
    const db = makeMockDb()
    db.$transaction = vi.fn((arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : arg))
    db.salesOrder = {
      findMany: vi.fn().mockResolvedValue([{ soNumber: 'SO-002', customer: { customerName: 'Ramesh Kumar' } }]),
      count: vi.fn().mockResolvedValue(1)
    }
    db.purchaseOrder = {
      findMany: vi.fn().mockResolvedValue([{ poNumber: 'PO-009', supplier: { supplierName: 'Acme Supplies' } }]),
      count: vi.fn().mockResolvedValue(1)
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("What's still pending approval?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('approvals.pendingApproval')
    expect(res.data?.answer).toContain('SO-002')
    expect(res.data?.answer).toContain('PO-009')
  })
})

describe('askQuestion — Phase 64 Inventory & Costing Depth AI intents', () => {
  it('answers "what\'s Widget\'s current cost basis" via the fast-path, resolving through getProductCost', async () => {
    const db = makeMockDb()
    db.product = {
      findFirst: vi.fn().mockResolvedValue({ id: 'p-1', productName: 'Widget', sku: 'WID-1', unit: 'PCS', valuationMethod: 'WEIGHTED_AVERAGE' }),
      findMany: vi.fn().mockResolvedValue([{ id: 'p-1', costPrice: 50, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }])
    }
    db.inventory = { findMany: vi.fn().mockResolvedValue([{ productId: 'p-1', averageCost: 62.5, quantity: 10 }]) }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("What's Widget's current cost basis?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('inventory.productCostBasis')
    expect(res.data?.answer).toContain('Widget')
    expect(res.data?.answer).toContain('₹62.50')
    expect(res.data?.answer).toContain('Weighted Average')
  })

  it('answers "generate POs for everything below reorder level" — points to the button, never claims to have created one', async () => {
    const db = makeMockDb()
    db.inventory = {
      findMany: vi.fn().mockResolvedValue([
        { quantity: 2, reorderLevel: 5, product: { productName: 'Widget', isActive: true, defaultSupplier: { supplierName: 'Acme Supplies' } } }
      ])
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('Generate POs for everything below reorder level')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('inventory.reorderDraftPreview')
    expect(res.data?.answer).toContain('Generate Reorder POs')
    expect(res.data?.answer).toContain('Widget')
    expect(res.data?.answer).toContain('Acme Supplies')
  })

  it('answers "what did freight add to this purchase\'s cost" via the fast-path, falling back to the most recent PO with a landed cost', async () => {
    const db = makeMockDb()
    db.purchaseOrder = { findFirst: vi.fn().mockResolvedValue({ id: 'po-1', poNumber: 'PO-1042' }) }
    db.landedCostAllocation = { findMany: vi.fn().mockResolvedValue([{ costType: 'FREIGHT', amount: 500 }]) }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("What did freight add to this purchase's cost?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('purchasing.landedCostForPurchase')
    expect(res.data?.answer).toContain('PO-1042')
    expect(res.data?.answer).toContain('₹500.00')
  })

  it('answers "what\'s in this kit" via the fast-path, listing real components', async () => {
    const db = makeMockDb()
    db.product = { findFirst: vi.fn().mockResolvedValue({ id: 'kit-1', productName: 'Diwali Hamper', isKit: true }) }
    db.kitComponent = {
      findMany: vi.fn().mockResolvedValue([
        { quantity: 2, componentProduct: { productName: 'Candle', unit: 'PCS' } },
        { quantity: 1, componentProduct: { productName: 'Sweet Box', unit: 'PCS' } }
      ])
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("What's in the Diwali Hamper kit?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('kits.components')
    expect(res.data?.answer).toContain('Diwali Hamper')
    expect(res.data?.answer).toContain('Candle')
    expect(res.data?.answer).toContain('Sweet Box')
  })

  it('answers "show me stock at Warehouse" via the fast-path, resolving the named location', async () => {
    const db = makeMockDb()
    db.location = { findMany: vi.fn().mockResolvedValue([{ id: 'loc-1', name: 'Main', isDefault: true }, { id: 'loc-2', name: 'Warehouse', isDefault: false }]) }
    db.locationStock = {
      findMany: vi.fn().mockResolvedValue([{ quantity: 20, product: { productName: 'Widget', unit: 'PCS' } }])
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('Show me stock at Warehouse')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('locations.stockAtLocation')
    expect(res.data?.answer).toContain('Warehouse')
    expect(res.data?.answer).toContain('Widget')
    expect(db.locationStock.findMany.mock.calls[0][0].where.locationId).toBe('loc-2')
  })
})

describe('askQuestion — Phase 65 Cost Centres, Budgets & Payroll Compliance AI intents', () => {
  it('answers "how is Downtown doing this month" via the fast-path, reusing the treemap report\'s own data', async () => {
    const db = makeMockDb()
    db.costCentre = { findFirst: vi.fn().mockResolvedValue({ id: 'cc-1', name: 'Downtown', isActive: true }) }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(reportService.generateCostCentreTreemapReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-13',
      rows: [{ costCentreId: 'cc-1', costCentreName: 'Downtown', revenue: 50000, expense: 30000, margin: 20000 }],
      untaggedRevenue: 0, untaggedExpense: 0
    })
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('How is Downtown doing this month?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('costCentres.performanceThisMonth')
    expect(res.data?.answer).toContain('Downtown')
    expect(res.data?.answer).toContain('₹20,000.00')
  })

  it('answers "am I over budget on Marketing" via the fast-path, reusing the budget-vs-actual report\'s own data', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(reportService.generateBudgetVsActualReport).mockResolvedValue({
      periodYear: 2026, periodMonth: 8,
      rows: [{ budgetId: 'bud-1', costCentreId: 'cc-1', costCentreName: 'Marketing', accountId: null, accountName: null, budgeted: 50000, actual: 62000, variance: -12000 }]
    })
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('Am I over budget on Marketing?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('budgets.varianceCheck')
    expect(res.data?.answer).toContain('Yes')
    expect(res.data?.answer).toContain('Marketing')
  })

  it('answers "what\'s my projected cash flow next month" via the fast-path, reusing the cash-flow projection report', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    vi.mocked(reportService.generateCashFlowProjection).mockResolvedValue({
      asOf: today, daysBack: 1, daysForward: 30,
      days: [
        { date: today, actualNet: 0, projectedNet: 0 },
        { date: future, actualNet: null, projectedNet: 10000 }
      ]
    })
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("What's my projected cash flow next month?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('cashFlow.projectionNextMonth')
    expect(res.data?.answer).toContain('₹10,000.00')
  })

  it('answers "which customers are slowest to pay" via the fast-path, reusing the payment performance report', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(reportService.generatePaymentPerformanceReport).mockResolvedValue({
      dateFrom: '2026-05-13', dateTo: '2026-08-13',
      rows: [{ customerId: 'cust-1', customerName: 'Slow Traders', paidInvoiceCount: 3, avgDaysToPay: 52, outstandingInvoiceCount: 0, outstandingAmount: 0 }],
      overallAvgDaysToPay: 52
    })
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion('Which customers are slowest to pay?')

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('payments.slowestPayingCustomers')
    expect(res.data?.answer).toContain('Slow Traders')
    expect(res.data?.answer).toContain('52')
  })

  it('answers "what\'s my PF liability this month" via the fast-path, reusing the statutory compliance summary report', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(reportService.generateStatutoryComplianceSummaryReport).mockResolvedValue({
      periodYear: 2026, periodMonth: 8,
      rows: [{ name: 'PF', totalAmount: 2400, employeeCount: 2 }],
      totalEmployees: 2
    })
    setAIProvider(new FakeAIProvider())

    const res = await askQuestion("What's my PF liability this month?")

    expect(res.success).toBe(true)
    expect(res.data?.template).toBe('payroll.statutoryLiabilityThisMonth')
    expect(res.data?.answer).toContain('₹2,400.00')
  })
})
