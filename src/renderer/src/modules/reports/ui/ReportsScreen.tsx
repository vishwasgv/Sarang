import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3, Package, Receipt, Users, Truck, AlertCircle,
  DollarSign, Shield, ChevronRight, Download, FileText,
  Table, RefreshCw, Calendar, HardDrive, Utensils,
  Activity, UserCheck, Award, QrCode, PackageSearch, FlaskConical, Droplet,
  Boxes, CalendarCheck, Factory, ScanLine, Shirt, GraduationCap, ClipboardCheck, FileStack, CalendarClock, Gem, TrendingUp, HeartPulse,
  Briefcase, Wrench, BedDouble, FolderOpen,
  Car, Scissors, Bug, Home, Repeat, Camera, PartyPopper, UsersRound, HardHat, Pill, HandCoins,
  PieChart, ShieldCheck, LineChart, Clock, Target, Share2, Timer
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, Cell, AreaChart, Area, ReferenceLine, Treemap,
  // Phase 67 §9.1 — Distributor's Scheme Cost vs. Volume report is this
  // file's first dual-line chart; aliased to avoid colliding with the
  // same-named lucide-react icon already imported above.
  LineChart as RCLineChart, Line,
  // Phase 67 §9.1 — Hardware's Fast-Mover vs. Slow-Mover Matrix is this
  // file's first scatter plot.
  ScatterChart, Scatter, ZAxis,
  // Phase 67 §9.1 — General's Category Mix report is this file's first
  // pie chart; aliased to avoid colliding with the same-named lucide-react
  // icon already imported above (same reasoning as RCLineChart).
  PieChart as RCPieChart, Pie,
  // Phase 67 §9.1 — Clothing's Season Sell-Through report is this file's
  // first genuine line+bar combo chart (per-season bars, overlaid with an
  // overall-average trend line), matching the artifact's own "(line + bar
  // combo)" chart-form note for this item.
  ComposedChart
} from 'recharts'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore, type TemplateModule } from '@app/store/industry.store'
import { useBusinessStore } from '@app/store/business.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate, toLocalISODate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { ShareMenu, type ExportPdfResult } from '@shared/ui/molecules/ShareMenu'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'

// ─────────────────────────────────────────────────────────────────────────────
// Types (local duplicates — avoids cross-boundary imports from main process)
// ─────────────────────────────────────────────────────────────────────────────

interface SalesReportRow { invoiceNumber: string; date: string; customer: string | null; itemCount: number; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number; paymentMethod: string; paymentStatus: string }
interface SalesReportGroup { label: string; revenue: number; invoiceCount: number; taxAmount: number }
interface SalesReportHourRow { hour: string; revenue: number; invoiceCount: number }
interface SalesReport { dateFrom?: string; dateTo?: string; groupBy?: string; summary: { totalRevenue: number; totalInvoices: number; totalTax: number; averageOrderValue: number; cancelledInvoices: number }; groups: SalesReportGroup[]; byHour: SalesReportHourRow[]; rows: SalesReportRow[]; total: number }

interface DiscountReportRow { invoiceNumber: string; date: string; customer: string | null; productName: string; quantity: number; lineGross: number; discountAmount: number; discountPercent: number; staffName: string | null }
interface DiscountByStaffRow { staffName: string; discountGiven: number; lineCount: number }
interface DiscountByProductRow { productName: string; discountGiven: number; lineCount: number }
interface DiscountReport { dateFrom: string; dateTo: string; summary: { totalDiscountGiven: number; discountedLineCount: number; totalLineCount: number; discountIncidencePercent: number; averageDiscountPercent: number }; byStaff: DiscountByStaffRow[]; byProduct: DiscountByProductRow[]; rows: DiscountReportRow[]; total: number }

interface InventoryReportRow { sku: string | null; productName: string; category: string | null; productType: string; currentStock: number; unit: string; costPrice: number; sellingPrice: number; stockValue: number; lowStockAlert: boolean; cartonBreakdown: { unitsPerPack: number; fullCartons: number; loosePieces: number } | null }
interface InventoryReport { asOf?: string; summary: { totalProducts: number; totalStockValue: number; lowStockItems: number; outOfStockItems: number }; rows: InventoryReportRow[] }

interface TaxReportRow { taxName: string; taxType: string; rate: number; taxableAmount: number; taxCollected: number; invoiceCount: number }
interface TaxReport { dateFrom?: string; dateTo?: string; summary: { totalTaxableAmount: number; totalTaxCollected: number }; rows: TaxReportRow[] }

interface AgingBuckets { current: number; days1to30: number; days31to60: number; days61to90: number; days90plus: number }
interface OutstandingCustomerRow { customerName: string; phone: string | null; outstanding: number; aging: AgingBuckets }
interface OutstandingSupplierRow { supplierName: string; phone: string | null; outstanding: number; aging: AgingBuckets }
interface OutstandingReport {
  customers: { totalOutstanding: number; count: number; rows: OutstandingCustomerRow[]; agingTotals: AgingBuckets }
  suppliers: { totalOutstanding: number; count: number; rows: OutstandingSupplierRow[]; agingTotals: AgingBuckets }
}

// Phase 61 — Purchase-side reports
interface PurchaseRegisterRow { billNumber: string; date: string; supplier: string; status: string; itemCount: number; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number }
interface PurchaseRegisterByVendorRow { supplierName: string; totalAmount: number; billCount: number }
interface PurchaseRegisterReport { dateFrom: string; dateTo: string; summary: { totalPurchases: number; billCount: number; totalTax: number }; byVendor: PurchaseRegisterByVendorRow[]; rows: PurchaseRegisterRow[]; total: number }

interface PurchasesByVendorRow { supplierId: string; supplierName: string; totalAmount: number; billCount: number }
interface PurchasesByVendorReport { dateFrom: string; dateTo: string; summary: { totalPurchases: number; vendorCount: number }; rows: PurchasesByVendorRow[] }

interface PurchasesByItemRow { itemName: string; isService: boolean; quantity: number; totalAmount: number; billCount: number }
interface PurchasesByItemReport { dateFrom: string; dateTo: string; summary: { totalPurchases: number; itemCount: number }; rows: PurchasesByItemRow[] }

interface ApAgingRow { id: string; supplierName: string; phone: string | null; outstanding: number; aging: AgingBuckets }
interface ApAgingReport { generatedAt: string; summary: { totalOutstanding: number; count: number }; agingTotals: AgingBuckets; rows: ApAgingRow[] }

interface LedgerRow { date: string; referenceType: string; referenceId: string; debitAmount: number; creditAmount: number; balance: number; remarks: string | null }
interface CustomerLedgerReport { customerId?: string; supplierId?: string; customer?: { customerName: string; phone?: string | null }; supplier?: { supplierName: string; phone?: string | null }; openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number; rows: LedgerRow[] }
interface SupplierLedgerReport { supplierId: string; supplier: { supplierName: string; phone?: string | null }; openingBalance: number; totalDebit: number; totalCredit: number; closingBalance: number; rows: LedgerRow[] }

interface ExpenseByCategoryRow { category: string | null; amount: number; count: number }
interface ExpenseReportRow { date: string; expenseName: string; category: string | null; paymentMethod: string; amount: number; remarks: string | null; recordedBy: string }
interface ExpenseReport { dateFrom?: string; dateTo?: string; summary: { totalAmount: number; expenseCount: number }; byCategory: ExpenseByCategoryRow[]; rows: ExpenseReportRow[] }

// Fresh-audit fix (2026-07-12) — profit was previously only a locked Dashboard
// KPI tile with no print/export path at all.
interface ProfitAndLossExpenseCategory { category: string; amount: number }
interface ProfitAndLossReport {
  dateFrom: string; dateTo: string
  summary: {
    revenue: number; cogs: number; grossProfit: number; grossMarginPercent: number
    totalExpenses: number; netProfit: number; netMarginPercent: number; invoiceCount: number
  }
  expensesByCategory: ProfitAndLossExpenseCategory[]
}

interface CashBookEntry { date: string; description: string; type: 'IN' | 'OUT'; paymentMethod: string; amount: number; runningBalance: number }
interface CashBookReport { dateFrom: string; dateTo: string; openingBalance: number; entries: CashBookEntry[]; totalIn: number; totalOut: number; closingBalance: number }

// Phase 65 — Cost Centres, Budgets & Payroll Compliance
interface CostCentreTreemapRow { costCentreId: string; costCentreName: string; revenue: number; expense: number; margin: number }
interface CostCentreTreemapReport { dateFrom: string; dateTo: string; rows: CostCentreTreemapRow[]; untaggedRevenue: number; untaggedExpense: number }

interface BudgetVsActualRow { budgetId: string; costCentreId: string | null; costCentreName: string | null; accountId: string | null; accountName: string | null; budgeted: number; actual: number; variance: number }
interface BudgetVsActualReport { periodYear: number; periodMonth: number; rows: BudgetVsActualRow[] }

interface StatutorySummaryRow { name: string; totalAmount: number; employeeCount: number }
interface StatutoryComplianceSummaryReport { periodYear: number; periodMonth: number; rows: StatutorySummaryRow[]; totalEmployees: number }

interface CashFlowDayBucket { date: string; actualNet: number | null; projectedNet: number | null }
interface CashFlowProjectionReport { asOf: string; daysBack: number; daysForward: number; days: CashFlowDayBucket[] }

interface CashPositionTrendPoint { date: string; balance: number }
interface CashPositionTrendReport { dateFrom: string; dateTo: string; points: CashPositionTrendPoint[]; openingBalance: number; closingBalance: number; netChange: number }

interface PaymentPerformanceRow { customerId: string; customerName: string; paidInvoiceCount: number; avgDaysToPay: number | null; outstandingInvoiceCount: number; outstandingAmount: number }
interface PaymentPerformanceReport { dateFrom: string; dateTo: string; rows: PaymentPerformanceRow[]; overallAvgDaysToPay: number | null }

interface TrialBalanceRow { account: string; debit: number; credit: number }
interface TrialBalanceReport { dateFrom: string; dateTo: string; asOf: string; rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean }

interface AuditReportRow { date: string; user: string; action: string; entityType: string; entityId: string; details: string | null }
interface AuditReport { dateFrom?: string; dateTo?: string; totalRecords: number; rows: AuditReportRow[]; page: number; limit: number }

interface FoodCostReportRow { ingredientName: string; unit: string; totalQuantityUsed: number; costPrice: number; totalCost: number }
interface FoodCostReport { dateFrom?: string; dateTo?: string; totalCost: number; rows: FoodCostReportRow[] }

interface DishContributionMarginRow { productId: string; productName: string; quantitySold: number; revenue: number; ingredientCost: number; contributionMargin: number; marginPercent: number }
interface DishContributionMarginReport { dateFrom?: string; dateTo?: string; rows: DishContributionMarginRow[] }

interface TableTurnoverCell { dayOfWeek: number; hour: number; count: number }
interface TableTurnoverByHourReport { dateFrom?: string; dateTo?: string; cells: TableTurnoverCell[]; summary: { totalTurns: number; peakDayOfWeek: number | null; peakHour: number | null; peakCount: number } }

interface RecipeWasteVarianceRow { ingredientProductId: string; ingredientName: string; unit: string; impliedQuantity: number; actualQuantity: number; varianceQuantity: number; variancePercent: number | null }
interface RecipeWasteVarianceReport { dateFrom?: string; dateTo?: string; rows: RecipeWasteVarianceRow[] }

interface DeadStockClearanceRow { productId: string; productName: string; sku: string | null; unit: string; currentStock: number; unitCost: number; capitalLocked: number; lastSoldDate: string | null; daysSinceLastSale: number | null }
interface DeadStockClearanceReport { asOfDate: string; lookbackDays: number; rows: DeadStockClearanceRow[]; summary: { totalCapitalLocked: number; itemCount: number } }

interface CategorySellThroughRow { month: string; categoryId: string; categoryName: string; unitsSold: number; currentStock: number; sellThroughRate: number }
interface CategorySellThroughReport { dateFrom: string; dateTo: string; rows: CategorySellThroughRow[] }
interface SeasonSellThroughRow { month: string; season: string; unitsSold: number; currentStock: number; sellThroughRate: number }
interface SeasonSellThroughReport { dateFrom: string; dateTo: string; rows: SeasonSellThroughRow[] }
interface SizeStyleHeatmapCell { style: string; size: string; unitsSold: number }
interface SizeStyleHeatmapReport { dateFrom: string; dateTo: string; styles: string[]; sizes: string[]; cells: SizeStyleHeatmapCell[]; summary: { totalUnitsSold: number; topCellStyle: string | null; topCellSize: string | null; topCellUnitsSold: number } }
// Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap Report.
interface SizeAvailabilityHeatmapCell { style: string; size: string; stockQty: number; status: 'OUT' | 'LOW' | 'IN' }
interface SizeAvailabilityHeatmapReport { lowStockThreshold: number; styles: string[]; sizes: string[]; cells: SizeAvailabilityHeatmapCell[]; summary: { totalStyles: number; outOfStockCells: number; lowStockCells: number; styleWithMostGaps: string | null; styleGapCount: number } }
// Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar.
interface SeasonalCycleRecord { id: string; name: string; startMonth: number; startDay: number; endMonth: number; endDay: number; leadTimeDays: number; isActive: boolean }
interface SeasonalCalendarProduct { productId: string; productName: string; stockQty: number; lowOrOutOfStock: boolean }
interface SeasonalCalendarEntry { id: string; name: string; startMonth: number; startDay: number; endMonth: number; endDay: number; leadTimeDays: number; status: 'IN_SEASON' | 'REORDER_NOW' | 'UPCOMING'; daysUntilStart: number; reorderByDate: string; nextStartDate: string; products: SeasonalCalendarProduct[]; lowOrOutOfStockCount: number }

interface BasketPairRow { productAId: string; productAName: string; productBId: string; productBName: string; basketCount: number }
interface BasketCompositionReport { dateFrom: string; dateTo: string; summary: { totalBaskets: number; avgItemsPerBasket: number; avgBasketValue: number }; rows: BasketPairRow[] }

interface CategoryMixRow { categoryId: string; categoryName: string; unitsSold: number; revenue: number; revenuePercent: number }
interface CategoryMixReport { dateFrom: string; dateTo: string; rows: CategoryMixRow[]; summary: { totalRevenue: number; categoryCount: number } }

// Phase 67 §9.1 — Clothing item 5: Margin by Brand/Vendor Report.
interface VendorMarginRow { supplierId: string; supplierName: string; revenue: number; cogs: number; margin: number; marginPercent: number }
interface VendorMarginReport { dateFrom: string; dateTo: string; rows: VendorMarginRow[]; summary: { totalRevenue: number; totalCogs: number; totalMargin: number; vendorCount: number } }

// Phase 67 §9.1 — Footwear item 2: Brand-Wise Margin & Return-Rate Report.
interface BrandMarginReturnRateRow { supplierId: string; supplierName: string; revenue: number; cogs: number; margin: number; marginPercent: number; unitsSold: number; unitsReturned: number; returnRatePercent: number }
interface BrandMarginReturnRateReport { dateFrom: string; dateTo: string; rows: BrandMarginReturnRateRow[]; summary: { totalRevenue: number; totalMargin: number; overallReturnRatePercent: number; vendorCount: number } }

type MoverQuadrant = 'FAST_HIGH_MARGIN' | 'FAST_LOW_MARGIN' | 'SLOW_HIGH_MARGIN' | 'SLOW_LOW_MARGIN'
interface FastSlowMoverRow { productId: string; productName: string; sku: string | null; quantitySold: number; velocity: number; sellingPrice: number; unitCost: number; marginPercent: number; quadrant: MoverQuadrant }
interface FastSlowMoverMatrixReport { dateFrom: string; dateTo: string; days: number; velocityMedian: number; marginMedian: number; rows: FastSlowMoverRow[] }

interface GSTR1B2BRow { gstin: string; receiverName: string; invoiceNumber: string; invoiceDate: string; invoiceValue: number; placeOfSupply: string; taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number; rate: number }
interface GSTR1B2CSRow { placeOfSupply: string; rate: number; taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number }
interface GSTR1Report { period: string; b2b: GSTR1B2BRow[]; b2cs: GSTR1B2CSRow[]; summary: { totalB2BValue: number; totalB2CSValue: number; totalIgst: number; totalCgst: number; totalSgst: number } }

interface HSNSummaryRow { hsnCode: string; description: string; uqc: string; totalQuantity: number; totalValue: number; taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number }
interface HSNSummaryReport { period: string; b2b: HSNSummaryRow[]; b2c: HSNSummaryRow[]; summary: { totalTaxableValue: number; totalTax: number; rowCount: number } }

interface DocumentSummaryRow { documentType: string; seriesPrefix: string; fromNumber: string; toNumber: string; totalCount: number; cancelledCount: number }
interface DocumentSummaryReport { period: string; rows: DocumentSummaryRow[] }

interface RentalStatusRow { bookingNumber: string; customerName: string; productName: string; unitLabel: string | null; startDateTime: string; endDateTime: string; isOverdue: boolean; daysOverdue: number }
interface RentalOverdueAgingBucket { bucket: string; count: number }
interface RentalStatusReport { rows: RentalStatusRow[]; summary: { totalCheckedOut: number; overdueCount: number }; agingBuckets: RentalOverdueAgingBucket[] }

interface RentalRevenueRow { productName: string; bookingCount: number; totalRevenue: number; unitCount: number | null; utilizationPercent: number | null }
interface RentalRevenueReport { dateFrom: string; dateTo: string; rows: RentalRevenueRow[]; summary: { totalRevenue: number; totalBookings: number } }

// Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per unit.
interface AssetUtilizationRow { rentalUnitId: string; unitLabel: string; productName: string; status: string; rentedDays: number; availableDays: number; utilizationPercent: number }
interface AssetUtilizationReport { dateFrom: string; dateTo: string; rows: AssetUtilizationRow[]; summary: { totalUnits: number; avgUtilizationPercent: number; idleUnitCount: number } }

// Phase 68 §9.1 — Beauty Salon items 1/2: stylist-wise repeat-client rate.
interface StylistRepeatClientRow { providerName: string; totalClients: number; repeatClients: number; repeatRatePercent: number }
interface StylistRepeatClientReport { dateFrom: string; dateTo: string; rows: StylistRepeatClientRow[]; summary: { totalStylists: number; overallRepeatRatePercent: number } }

// Phase 68 §9.1 — Beauty Salon items 3/4: retail-product attach rate.
interface RetailAttachRateByProviderRow { providerName: string; totalInvoices: number; withAttach: number; attachRatePercent: number }
interface RetailAttachRateReport { dateFrom: string; dateTo: string; byProvider: RetailAttachRateByProviderRow[]; summary: { totalAppointmentInvoices: number; withRetailAttach: number; attachRatePercent: number } }

// Phase 68 §9.1 — Gym/Studio items 1/2: membership renewal funnel.
interface MembershipRenewalFunnelRow { planName: string; expiredCount: number; renewedCount: number; renewalRatePercent: number }
interface MembershipRenewalFunnelReport { dateFrom: string; dateTo: string; rows: MembershipRenewalFunnelRow[]; summary: { totalExpired: number; totalRenewed: number; overallRenewalRatePercent: number } }

// Phase 68 §9.1 — Gym/Studio item 4: Class Attendance Heatmap.
interface ClassAttendanceHeatmapCell { className: string; dayOfWeek: string; checkInCount: number }
interface ClassAttendanceHeatmapReport { dateFrom: string; dateTo: string; classNames: string[]; daysOfWeek: string[]; cells: ClassAttendanceHeatmapCell[]; summary: { totalCheckIns: number; busiestClassName: string | null; busiestDay: string | null } }

// Phase 68 §9.1 — Driving School item 4: Learner Progress Funnel.
interface LearnerProgressFunnelStage { stage: string; learnerCount: number }
interface LearnerProgressFunnelReport { stages: LearnerProgressFunnelStage[]; summary: { totalEnrolled: number; dlPassedCount: number; overallCompletionPercent: number } }

interface HotelOccupancyReport { asOf: string; totalRooms: number; occupied: number; available: number; cleaning: number; maintenance: number; occupancyPercent: number }
interface HotelGuestRegisterRow { bookingNumber: string; roomNumber: string; guestName: string; idType: string; idNumber: string; nationality: string; address: string | null; checkInDate: string; checkOutDate: string; actualCheckInAt: string | null; actualCheckOutAt: string | null }
interface HotelGuestRegisterReport { rows: HotelGuestRegisterRow[] }

interface GSTR3BStateRow { state: string; taxableValue: number; igstAmount: number }
interface GSTR3BTable31d { taxableValue: number; taxAmount: number; expenseTaxNotComputable: boolean }
interface GSTR3BPreview {
  period: string
  table31: { taxableOutwardSupplies: number; zeroRatedSupplies: number; exemptNilNonGstSupplies: number; taxAmount: { igst: number; cgst: number; sgst: number } }
  table31d: GSTR3BTable31d
  table32: GSTR3BStateRow[]
  notes: string[]
}

// Phase 35 — Service Reports
interface ApptUtilByProvider { providerName: string; total: number; completed: number; cancelled: number; noShow: number; completionRate: number }
interface ApptUtilRow { appointmentNumber: string; date: string; time: string; customer: string; provider: string; service: string; status: string; durationMinutes: number }
interface AppointmentUtilisationReport { dateFrom: string; dateTo: string; summary: { total: number; completed: number; cancelled: number; noShow: number; active: number; completionRate: number }; byProvider: ApptUtilByProvider[]; byDayOfWeek: { day: string; count: number }[]; byHour: { hour: string; count: number }[]; rows: ApptUtilRow[] }

interface ClientRetentionRow { customerName: string; phone: string | null; firstVisitEver: string; lastVisit: string; visitsInPeriod: number; isNew: boolean; atRisk: boolean }
interface ClientRetentionReport { dateFrom: string; dateTo: string; summary: { totalUnique: number; newClients: number; returningClients: number; retentionRate: number; atRiskCount: number }; rows: ClientRetentionRow[] }

interface CommissionByStaff { staffName: string; serviceRevenue: number; commissionAmount: number; tipAmount: number; paidAmount: number; unpaidAmount: number; recordCount: number }
interface CommissionRow { staffName: string; period: string; serviceRevenue: number; commissionAmount: number; tipAmount: number; commissionType: string; commissionRate: number; isPaid: boolean; paidDate: string | null }
interface CommissionReport { dateFrom: string; dateTo: string; summary: { totalCommission: number; totalTips: number; totalServiceRevenue: number; paidAmount: number; unpaidAmount: number; recordCount: number }; byStaff: CommissionByStaff[]; rows: CommissionRow[] }

// Phase 54 — new-vertical reports
interface OrderVolumeByDay { date: string; pending: number; accepted: number; rejected: number; total: number }
interface OrderVolumeRow { createdAt: string; tableLabel: string; status: string; itemCount: number; resolvedAt: string | null }
interface OrderVolumeReport { dateFrom: string; dateTo: string; summary: { totalOrders: number; accepted: number; rejected: number; pending: number; acceptanceRate: number }; byDay: OrderVolumeByDay[]; rows: OrderVolumeRow[] }

type ExpiryBucketId = 'expired' | 'critical' | 'warning' | 'safe'
// Phase 67 §9.1 — `value` added (Pharmacy's "Expiry-risk value" signature win).
interface BatchExpiryBucket { bucket: ExpiryBucketId; label: string; count: number; quantityRemaining: number; value: number }
interface BatchExpiryRow { productName: string; batchNumber: string; expiryDate: string; daysToExpiry: number; quantityRemaining: number; bucket: ExpiryBucketId; unitCost: number; supplierName: string | null }
interface BatchExpiryReport { generatedAt: string; summary: { totalBatches: number; expiredCount: number; criticalCount: number; warningCount: number; safeCount: number; expiredValue: number; atRiskValue: number }; buckets: BatchExpiryBucket[]; rows: BatchExpiryRow[] }

interface LabThroughputStage { status: string; label: string; count: number }
interface LabThroughputRow { orderNumber: string; patientName: string; status: string; createdAt: string; reportedAt: string | null; turnaroundHours: number | null }
interface LabThroughputReport { dateFrom: string; dateTo: string; summary: { totalOrders: number; delivered: number; cancelled: number; pendingCount: number; avgTurnaroundHours: number | null }; byStatus: LabThroughputStage[]; rows: LabThroughputRow[] }

interface BloodStockByGroup { bloodGroup: string; available: number; expiringSoon: number }
interface BloodStockReportRow { donationNumber: string; bloodGroup: string; componentType: string; expiryDate: string; daysToExpiry: number; isExpiringSoon: boolean }
interface BloodStockReport { generatedAt: string; summary: { totalAvailable: number; totalExpiringSoon: number; groupsWithNoStock: string[] }; byGroup: BloodStockByGroup[]; rows: BloodStockReportRow[] }
// Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time.
interface DonationToIssueCycleTimeByComponent { componentType: string; unitCount: number; avgDays: number; minDays: number; maxDays: number }
interface DonationToIssueCycleTimeReport { summary: { totalIssuedUnits: number; overallAvgDays: number }; byComponent: DonationToIssueCycleTimeByComponent[] }

// Fresh-audit fix (2026-07-12) — Jewellery had zero reports
interface JewelleryStockRow { metalType: string; purity: string; netWeightGrams: number; ratePerGram: number | null; valuationAmount: number }
// Phase 67 §9.1 — Jewellery items 2/3/4/5.
interface MakingChargeMarginRow { invoiceId: string; invoiceNumber: string; invoiceDate: string; customerName: string; metalValue: number; makingCharge: number; totalValue: number; makingChargePercent: number }
interface MakingChargeMarginReport { dateFrom: string; dateTo: string; rows: MakingChargeMarginRow[]; summary: { totalMetalValue: number; totalMakingCharge: number; avgMakingChargePercent: number } }
interface HallmarkComplianceRow { productId: string; productName: string; metalType: string; purity: string; hallmarkNumber: string | null; compliant: boolean }
interface HallmarkComplianceReport { rows: HallmarkComplianceRow[]; summary: { totalItems: number; compliantCount: number; nonCompliantCount: number; compliancePercent: number } }
interface MetalRateVsSalesVolumeRow { month: string; avgRatePerGram: number | null; salesWeightGrams: number }
interface MetalRateVsSalesVolumeReport { dateFrom: string; dateTo: string; metalType: string; purity: string; rows: MetalRateVsSalesVolumeRow[] }
interface PurityAdjustedExchangeRow { metalType: string; purity: string; count: number; rawWeightGrams: number; pureEquivalentGrams: number; totalValueGiven: number }
interface PurityAdjustedExchangeReport { dateFrom: string; dateTo: string; byMetal: PurityAdjustedExchangeRow[]; monthlyTrend: { month: string; pureEquivalentGrams: number }[]; summary: { totalExchanges: number; totalPureEquivalentGrams: number; totalValueGiven: number; unparsablePurityCount: number } }
// Fresh-audit fix (2026-07-12) — SERVICE/CONSULTANT/REPAIR previously had
// zero vertical-specific reports at all.
// Real bug fix 2026-07-16: this report was wired to ServiceProject data
// (wrong model for SERVICE/CONSULTANT, who use the legacy `Project` model)
// — see report.service.ts's generateProjectReport for the full writeup.
// Split into two reports: this one now matches the legacy `Project` shape;
// ServiceProjectReport below covers the true ServiceProject-using verticals.
interface ProjectReportRow { title: string; clientName: string | null; status: string; priority: string; estimatedAmount: number; startDate: string | null; dueDate: string | null; completedDate: string | null }
interface ProjectReportByStatus { status: string; count: number }
interface ProjectReport {
  dateFrom: string; dateTo: string
  summary: { totalProjects: number; open: number; inProgress: number; completed: number; onHold: number; cancelled: number; totalEstimatedAmount: number }
  byStatus: ProjectReportByStatus[]; rows: ProjectReportRow[]
}
// Phase 67 §9.1 — Service items 2/4.
interface ServiceResolutionTimeRow { category: string; ticketCount: number; avgHours: number; minHours: number; maxHours: number }
interface ServiceResolutionTimeReport { dateFrom: string; dateTo: string; rows: ServiceResolutionTimeRow[]; summary: { totalResolved: number; overallAvgHours: number } }
interface RepeatBusinessRateRow { month: string; newCustomers: number; repeatCustomers: number; repeatRatePercent: number }
interface RepeatBusinessRateReport { dateFrom: string; dateTo: string; rows: RepeatBusinessRateRow[] }
// Phase 67 §9.1 — Consultant items 2/4.
interface ConsultantUtilizationRow { userName: string; billableHours: number; nonBillableHours: number; totalHours: number; utilizationPercent: number }
interface ConsultantUtilizationReport { dateFrom: string; dateTo: string; rows: ConsultantUtilizationRow[]; summary: { totalBillableHours: number; totalNonBillableHours: number; overallUtilizationPercent: number } }
interface ClientProfitabilityRow { customerName: string; revenue: number; hoursSpent: number; revenuePerHour: number }
interface ClientProfitabilityReport { dateFrom: string; dateTo: string; rows: ClientProfitabilityRow[]; summary: { totalRevenue: number; totalHours: number } }
// Phase 67 §9.1 — Repair items 2/4.
interface JobCardTurnaroundByTechnicianRow { technicianName: string; jobCount: number; avgTurnaroundHours: number; fastestHours: number; slowestHours: number }
interface JobCardTurnaroundByTechnicianReport { dateFrom: string; dateTo: string; rows: JobCardTurnaroundByTechnicianRow[]; summary: { totalDelivered: number; overallAvgTurnaroundHours: number } }
interface RepairCategoryVolumeTrendRow { month: string; category: string; count: number }
interface RepairCategoryVolumeTrendReport { dateFrom: string; dateTo: string; rows: RepairCategoryVolumeTrendRow[]; categories: string[]; summary: { totalJobs: number } }
// Phase 67 §9.1 — Distributor item 3. Sorted DESCENDING by value (best-first)
// — a leaderboard celebrates top performers, the deliberate exception to
// this phase's own worst-first convention (see report.service.ts's comment).
interface FieldRepLeaderboardRow { repName: string; ordersBooked: number; totalValue: number; plannedStops: number | null; distinctCustomersVisited: number; hitRatePercent: number | null }
interface FieldRepLeaderboardReport { dateFrom: string; dateTo: string; rows: FieldRepLeaderboardRow[]; summary: { totalOrdersBooked: number; totalValue: number } }

interface ServiceProjectReportRow { projectName: string; clientName: string; status: string; projectType: string; totalContractValue: number | null; startDate: string | null; expectedEndDate: string | null; completedDate: string | null }
interface ServiceProjectReportByStatus { status: string; count: number }
interface ServiceProjectReport {
  dateFrom: string; dateTo: string
  summary: { totalProjects: number; active: number; completed: number; onHold: number; cancelled: number; totalContractValue: number }
  byStatus: ServiceProjectReportByStatus[]; rows: ServiceProjectReportRow[]
}

// Phase 58 §1 — 10 new reports for verticals with zero dedicated report before this.
interface CarJobCardReportRow { jobNumber: string; customerName: string; vehicleNumber: string; vehicleMake: string; vehicleModel: string; status: string; laborTotal: number; partsTotal: number; createdAt: string; deliveredDate: string | null }
interface CarJobCardTechnicianStat { technicianId: string; jobCount: number }
interface CarJobCardReport { dateFrom: string; dateTo: string; summary: { totalJobs: number; delivered: number; totalLaborRevenue: number; totalPartsRevenue: number }; byTechnician: CarJobCardTechnicianStat[]; rows: CarJobCardReportRow[] }

interface TailoringOrderReportRow { orderNumber: string; customerName: string; garmentType: string; status: string; quantity: number; totalAmount: number; createdAt: string; deliveryDate: string | null }
interface TailoringOrderByGarment { garmentType: string; count: number; totalAmount: number }
interface TailoringOrderReport { dateFrom: string; dateTo: string; summary: { totalOrders: number; delivered: number; totalAmount: number }; byGarmentType: TailoringOrderByGarment[]; rows: TailoringOrderReportRow[] }

interface PestContractExpiringRow { contractNumber: string; customerName: string; pestTypes: string[]; endDate: string; daysUntilExpiry: number }
interface PestRevenueByType { pestType: string; revenue: number; visitCount: number }
interface PestContractReport { dateFrom: string; dateTo: string; summary: { activeContracts: number; expiringWithin30Days: number; totalContractValue: number }; expiring: PestContractExpiringRow[]; byPestType: PestRevenueByType[] }

interface RealEstatePipelineByStage { stage: string; count: number; value: number }
interface RealEstateDealRow { propertyLocation: string; buyerName: string; sellerName: string; dealValue: number; brokerageAmount: number; status: string; createdAt: string }
interface RealEstatePipelineReport { dateFrom: string; dateTo: string; summary: { totalListings: number; availableListings: number; dealsInProgress: number; totalBrokerageEarned: number }; byInquiryStage: RealEstatePipelineByStage[]; deals: RealEstateDealRow[] }

interface RetainerReportRow { title: string; clientName: string; status: string; monthlyAmount: number; billedThisPeriod: boolean }
interface RetainerReport { dateFrom: string; dateTo: string; targetPeriod: string; summary: { activeRetainers: number; totalMRR: number; billedThisPeriodCount: number; billedThisPeriodAmount: number }; rows: RetainerReportRow[] }

interface ShootBookingReportRow { clientName: string; shootType: string; shootDate: string; status: string; finalAmount: number | null }
interface ShootBookingByType { shootType: string; count: number }
interface ShootBookingReport { dateFrom: string; dateTo: string; summary: { totalBookings: number; delivered: number; totalRevenue: number }; byShootType: ShootBookingByType[]; rows: ShootBookingReportRow[] }

interface EventBookingReportRow { clientName: string; eventName: string; eventType: string; eventDate: string; status: string; finalAmount: number | null }
interface EventBookingByStatus { status: string; count: number }
interface EventBookingReport { dateFrom: string; dateTo: string; summary: { totalBookings: number; completed: number; totalRevenue: number }; byStatus: EventBookingByStatus[]; rows: EventBookingReportRow[] }

interface PlacementReportRow { placementNumber: string; candidateName: string; jobTitle: string; clientName: string; status: string; joiningDate: string; offeredSalary: number; commissionAmount: number }
interface PlacementReport { dateFrom: string; dateTo: string; summary: { totalPlacements: number; joined: number; invoiced: number; totalCommission: number }; rows: PlacementReportRow[] }

interface DrawingRegisterRow { drawingNumber: string; title: string; projectName: string; discipline: string; revisionNumber: string; status: string; issuedDate: string | null }
interface DrawingRegisterByStatus { status: string; count: number }
interface DrawingRegisterReport { dateFrom: string; dateTo: string; summary: { totalDrawings: number; approved: number; pendingReview: number }; byStatus: DrawingRegisterByStatus[]; rows: DrawingRegisterRow[] }

interface SiteVisitLogRow { projectName: string; visitDate: string; visitType: string; recordedByName: string | null; findings: string | null }
interface SiteVisitLogByType { visitType: string; count: number }
interface SiteVisitLogReport { dateFrom: string; dateTo: string; summary: { totalVisits: number }; byVisitType: SiteVisitLogByType[]; rows: SiteVisitLogRow[] }

// Phase 58 §2 — Pharmacy Schedule H/H1 prescription-drug sales register
interface PrescriptionDrugSalesRow { invoiceNumber: string; invoiceDate: string; productName: string; quantity: number; patientName: string | null; doctorName: string | null; prescriptionDate: string | null; customerName: string | null; lineTotal: number }
// Phase 67 §9.1 — `byDoctor` added (Pharmacy's "Doctor-wise prescription volume" signature win).
interface PrescriptionDrugSalesByDoctor { doctorName: string; salesCount: number; totalAmount: number }
interface PrescriptionDrugSalesReport { dateFrom: string; dateTo: string; summary: { totalSales: number; totalAmount: number; missingPrescriptionDetails: number }; byDoctor: PrescriptionDrugSalesByDoctor[]; rows: PrescriptionDrugSalesRow[] }

// Phase 67 §9.1 — Pharmacy item 1: Schedule H1/X Narcotic Register — a
// STRICTER subcategory of the prescription-drug register just above
// (Product.isScheduleH1X, not every isPrescriptionRequired product).
interface ScheduleH1XRegisterRow { invoiceNumber: string; invoiceDate: string; productName: string; quantity: number; patientName: string | null; doctorName: string | null; prescriptionDate: string | null; customerName: string | null }
interface ScheduleH1XRegisterReport { dateFrom: string; dateTo: string; summary: { totalSales: number; totalQuantity: number; missingPrescriptionDetails: number }; rows: ScheduleH1XRegisterRow[] }

// Phase 67 §9.1 — Distributor: Scheme Cost vs. Incremental Volume Report
// (a correlation view, not a causal claim — see report.service.ts's own
// comment on generateSchemeCostVsVolumeReport for why).
interface SchemeCostVsVolumePoint { period: string; schemeCost: number; totalVolume: number }
interface SchemeCostVsVolumeSchemeRow { schemeId: string; schemeName: string; ruleType: string; totalCost: number; focUnitsGiven: number }
interface SchemeCostVsVolumeReport { dateFrom: string; dateTo: string; summary: { totalSchemeCost: number; totalFocUnitsGiven: number; activeSchemeCount: number; coveredProductCount: number }; byPeriod: SchemeCostVsVolumePoint[]; rows: SchemeCostVsVolumeSchemeRow[] }

interface ChronicRecallComplianceByCondition { conditionName: string; total: number; onTime: number; percent: number }
interface ChronicRecallComplianceReport { totalRecallsClosed: number; overallOnTime: number; overallPercent: number | null; byCondition: ChronicRecallComplianceByCondition[] }

interface WalkInVsAppointmentDayPoint { date: string; walkIns: number; appointments: number }
interface WalkInVsAppointmentRatioReport { dateFrom: string; dateTo: string; summary: { totalWalkIns: number; totalAppointments: number; walkInPercent: number }; byDay: WalkInVsAppointmentDayPoint[] }

interface DiagnosisCategoryTrendReport {
  dateFrom: string; dateTo: string
  summary: { totalVisits: number; categorizedCount: number; uncategorizedCount: number; distinctCategoryCount: number }
  categories: string[]
  byMonth: Record<string, number | string>[]
}

interface ReferralOutcomeRow { appointmentNumber: string; patientName: string; referredToProviderName: string | null; scheduledDate: string; status: string; outcomeSummary: string | null }
interface ReferralOutcomeReport {
  dateFrom: string; dateTo: string
  summary: { totalReferrals: number; completedCount: number; outcomeRecordedCount: number; pendingCount: number }
  rows: ReferralOutcomeRow[]
}

interface PackUtilizationRow { packId: string; customerName: string; packName: string; totalSessions: number; usedSessions: number; remainingSessions: number; utilizationPercent: number; expiryDate: string | null; isActive: boolean }
interface PackUtilizationReport {
  dateFrom: string; dateTo: string
  summary: { totalPacks: number; totalSessionsSold: number; totalSessionsUsed: number; overallUtilizationPercent: number }
  rows: PackUtilizationRow[]
}

interface LabTATRow { testName: string; category: string | null; ordersCount: number; avgActualTATHours: number; targetTATHours: number | null; onTimeCount: number; lateCount: number; onTimePercent: number }
interface LabTATReport {
  dateFrom: string; dateTo: string
  summary: { totalCompleted: number; withTargetCount: number; onTimeCount: number; overallOnTimePercent: number }
  rows: LabTATRow[]
}

interface TestVolumeByPanelReport {
  dateFrom: string; dateTo: string
  summary: { totalTests: number; distinctPanelCount: number }
  panels: string[]
  byMonth: Record<string, number | string>[]
}

interface ReferralLeaderboardRow { referrerName: string; count: number }
interface ReferralLeaderboardReport {
  dateFrom: string; dateTo: string
  summary: { totalReferrals: number; distinctReferrerCount: number; topReferrerName: string | null }
  rows: ReferralLeaderboardRow[]
}

interface SecondOpinionConversionRow { patientName: string; visitDate: string; converted: boolean; nextVisitDate: string | null }
interface SecondOpinionConversionReport {
  dateFrom: string; dateTo: string
  summary: { totalSecondOpinionVisits: number; convertedCount: number; conversionPercent: number | null; distinctPatientCount: number }
  rows: SecondOpinionConversionRow[]
}

interface CaseComplexityMixReport {
  dateFrom: string; dateTo: string
  summary: { totalTagged: number; routineCount: number; complexCount: number; complexPercent: number | null }
  byMonth: Array<{ month: string; ROUTINE: number; COMPLEX: number }>
}

interface TreatmentAcceptanceRateReport {
  dateFrom: string; dateTo: string
  summary: { proposedCount: number; acceptedCount: number; billedCount: number; acceptanceRatePercent: number | null; billedRatePercent: number | null }
  funnel: Array<{ stage: string; count: number }>
}

interface DentalRecallComplianceReport {
  totalRecallsClosed: number; overallOnTime: number; overallPercent: number | null
  byRecallType: Array<{ recallType: string; total: number; onTime: number; percent: number }>
}

interface VaccinationComplianceByVaccine { vaccineName: string; total: number; onTime: number; percent: number }
interface VaccinationComplianceReport {
  dateFrom: string; dateTo: string
  totalDosesEvaluated: number; overallOnTime: number; overallPercent: number | null
  byVaccine: VaccinationComplianceByVaccine[]
}

interface VetCaseTypeVolumeReport {
  dateFrom: string; dateTo: string
  summary: { totalCases: number; distinctCaseTypeCount: number }
  caseTypes: string[]
  byMonth: Record<string, number | string>[]
}

interface JobCardReportRow { jobNumber: string; title: string; customerName: string | null; status: string; priority: string; estimatedCost: number; actualCost: number; receivedDate: string; expectedDate: string | null; deliveredDate: string | null }
interface JobCardReportByStatus { status: string; count: number }
interface JobCardReport {
  dateFrom: string; dateTo: string
  summary: { totalJobs: number; delivered: number; pending: number; cancelled: number; totalEstimatedCost: number; totalActualCost: number }
  byStatus: JobCardReportByStatus[]; rows: JobCardReportRow[]
}

interface JewelleryReport {
  dateFrom: string; dateTo: string
  stockByMetal: JewelleryStockRow[]
  summary: {
    totalStockValuationGrams: number; totalStockValuationAmount: number
    totalMakingChargeRevenue: number; totalExchangeCount: number; totalExchangeValueGiven: number
    metalsWithNoRateSet: string[]
  }
}

// Phase 54B — cross-business-type coverage reports
interface LogisticsReportTrendRow { month: string; count: number; freight: number }
interface LogisticsReportCarrier { name: string; count: number }
interface LogisticsReportStatusRow { status: string; count: number }
interface LogisticsReport {
  dateFrom: string; dateTo: string
  summary: { totalShipments: number; deliveryRate: number; avgDeliveryDays: number; totalFreight: number; freightPending: number; totalGRNValue: number; activeCarriers: number }
  monthlyTrend: LogisticsReportTrendRow[]; topCarriers: LogisticsReportCarrier[]; shipmentsByStatus: LogisticsReportStatusRow[]
}

interface AttendanceByEmployee { employeeName: string; present: number; absent: number; halfDay: number; leave: number; attendanceRate: number }
interface AttendanceReportRow { employeeName: string; date: string; status: string; checkIn: string | null; checkOut: string | null }
interface AttendanceReport {
  dateFrom: string; dateTo: string
  summary: { totalRecords: number; presentCount: number; absentCount: number; leaveCount: number; overallAttendanceRate: number }
  byEmployee: AttendanceByEmployee[]; rows: AttendanceReportRow[]
}

interface ProductionByStatusRow { status: string; count: number }
interface ProductionReportRow { orderNumber: string; productName: string; plannedQty: number; producedQty: number; status: string; startDate: string | null; completedDate: string | null }
interface ProductionReport {
  dateFrom: string; dateTo: string
  summary: { totalOrders: number; completed: number; inProgress: number; totalPlannedQty: number; totalProducedQty: number; completionRate: number }
  byStatus: ProductionByStatusRow[]; rows: ProductionReportRow[]
}

// Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished Unit.
interface LandedCostPerUnitRow { productId: string; productName: string; producedQty: number; materialCostPerUnit: number; laborCostPerUnit: number; overheadCostPerUnit: number; totalCostPerUnit: number }
interface LandedCostPerUnitReport { dateFrom: string; dateTo: string; rows: LandedCostPerUnitRow[]; summary: { totalOrders: number; totalProducedQty: number } }
// Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend.
interface RejectionRateTrendPoint { month: string; qtyInspected: number; qtyRejected: number; rejectionRatePercent: number }
interface RejectionRateByStageRow { taskName: string; qtyInspected: number; qtyRejected: number; rejectionRatePercent: number }
interface RejectionRateTrendReport { dateFrom: string; dateTo: string; trend: RejectionRateTrendPoint[]; byStage: RejectionRateByStageRow[]; summary: { totalInspected: number; totalRejected: number; overallRejectionRatePercent: number } }

// Phase 67 §9.1 — Agri Inputs item 2: Seasonal Credit Exposure.
interface SeasonalCreditExposureMonthPoint { month: string; outstandingAmount: number; invoiceCount: number }
interface SeasonalCreditExposureBySeasonRow { seasonName: string; outstandingAmount: number; invoiceCount: number }
interface SeasonalCreditExposureReport {
  byMonth: SeasonalCreditExposureMonthPoint[]; bySeason: SeasonalCreditExposureBySeasonRow[]
  summary: { totalOutstanding: number; totalInvoices: number; peakMonth: string | null; peakMonthAmount: number }
}
// Phase 67 §9.1 — Agri Inputs item 4: Farmer-Wise Purchase & Repayment History.
interface FarmerRepaymentRow { customerId: string; customerName: string; phone: string | null; totalPurchased: number; totalRepaid: number; outstandingBalance: number; repaymentRatePercent: number }
interface FarmerRepaymentReport { rows: FarmerRepaymentRow[]; summary: { totalFarmers: number; totalOutstanding: number; overallRepaymentRatePercent: number } }

type WarrantyBucketId = 'expired' | 'expiringSoon' | 'active' | 'noWarranty'
interface SerialWarrantyBucket { bucket: WarrantyBucketId; count: number }
interface SerialWarrantyRow { serialNumber: string; productName: string; status: string; warrantyExpiryDate: string | null; daysToExpiry: number | null }
interface SerialWarrantyReport {
  generatedAt: string
  summary: { totalSerials: number; inStock: number; sold: number; warrantyExpiringSoon: number; warrantyExpired: number }
  buckets: SerialWarrantyBucket[]; rows: SerialWarrantyRow[]
}
interface RmaAgingRow { claimNumber: string; productName: string; vendorName: string | null; sentToVendorDate: string; daysWithVendor: number; isOverdue: boolean }
interface RmaAgingReport { generatedAt: string; rows: RmaAgingRow[]; summary: { totalOpen: number; overdueCount: number } }
interface VendorRecoveryRow { claimNumber: string; productName: string; vendorName: string | null; claimedAmount: number; recoveredAmount: number; outstandingAmount: number; isClosed: boolean; closedAt: string | null }
interface VendorRecoveryLedgerReport { generatedAt: string; rows: VendorRecoveryRow[]; summary: { totalClaimed: number; totalRecovered: number; totalOutstanding: number; openCount: number; closedCount: number } }
interface TechnicianTurnaroundRow { technicianId: string; technicianName: string; ticketCount: number; avgTurnaroundDays: number; minTurnaroundDays: number; maxTurnaroundDays: number }
interface RepairTurnaroundByTechnicianReport { generatedAt: string; rows: TechnicianTurnaroundRow[]; summary: { technicianCount: number; totalTicketsCompleted: number; overallAvgTurnaroundDays: number } }

interface VariantStockRow { productName: string; size: string | null; color: string | null; sku: string | null; stockQty: number }
interface VariantStockReport {
  generatedAt: string
  summary: { totalVariants: number; totalStockQty: number; outOfStockVariants: number }
  rows: VariantStockRow[]
}

interface TestScoreReportRow {
  studentName: string; batchName: string; subject: string | null; testName: string
  marksObtained: number; maxMarks: number; percentage: number; grade: string | null; testDate: string
}
interface TestScoreReportStudentSummary { studentName: string; testCount: number; averagePercentage: number }
interface TestScoreReport {
  generatedAt: string
  summary: { totalTests: number; averagePercentage: number; belowFiftyCount: number; studentCount: number }
  studentSummaries: TestScoreReportStudentSummary[]
  rows: TestScoreReportRow[]
}

interface ComplianceTaskReportRow {
  clientName: string; title: string; category: string; dueDate: string
  daysUntilDue: number; status: string; priority: string
}
interface ComplianceTaskReport {
  generatedAt: string
  summary: { totalOpen: number; overdueCount: number; dueThisWeekCount: number; clientCount: number }
  rows: ComplianceTaskReportRow[]
}

// Phase 54C — chart specs sent to export.generateReportHtml for PDF printing;
// mirrors the IPC channel's charts param shape exactly (kept as a local type
// per this file's own "avoid cross-boundary imports from main" convention).
type ReportChart =
  | { type: 'bar'; title: string; orientation?: 'horizontal' | 'vertical'; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }
  | { type: 'stackedBar'; title: string; data: { label: string; segments: { value: number; color: string; name?: string }[] }[]; legend?: { name: string; color: string }[] }
  | { type: 'line'; title: string; data: { label: string; value: number }[]; valueIsCurrency?: boolean }
  | { type: 'pie'; title: string; data: { label: string; value: number; color?: string }[]; valueIsCurrency?: boolean }

type ReportType =
  | 'sales' | 'inventory' | 'tax' | 'outstanding'
  | 'customerLedger' | 'supplierLedger' | 'expenses' | 'profitAndLoss' | 'cashBook' | 'trialBalance' | 'audit' | 'backup'
  | 'foodCost' | 'dishContributionMargin' | 'tableTurnoverByHour' | 'recipeWasteVariance' | 'deadStockClearance' | 'categorySellThrough' | 'seasonSellThrough' | 'sizeStyleHeatmap' | 'sizeAvailabilityHeatmap' | 'seasonalReorderCalendar' | 'basketComposition' | 'categoryMix' | 'vendorMargin' | 'brandMarginReturnRate' | 'fastSlowMoverMatrix' | 'gstr1' | 'hsnSummary' | 'documentSummary' | 'gstr3bPreview'
  | 'appointmentUtilisation' | 'clientRetention' | 'commission'
  | 'orderVolume' | 'discounts' | 'batchExpiry' | 'labThroughput' | 'bloodStock' | 'donationToIssueCycleTime' | 'jewellery'
  // Phase 67 §9.1 — Jewellery items 2/3/4/5.
  | 'makingChargeMargin' | 'hallmarkCompliance' | 'metalRateVsSalesVolume' | 'purityAdjustedExchange'
  | 'logistics' | 'attendance' | 'production' | 'landedCostPerUnit' | 'rejectionRateTrend' | 'serialWarranty' | 'rmaAging' | 'vendorRecoveryLedger' | 'repairTurnaroundByTechnician' | 'variantStock'
  // Phase 67 §9.1 — Agri Inputs items 2 & 4.
  | 'seasonalCreditExposure' | 'farmerRepayment'
  | 'testScores' | 'complianceTasks'
  | 'rentalStatus' | 'rentalRevenue' | 'assetUtilization' | 'projects' | 'serviceProjects' | 'jobCards'
  | 'serviceResolutionTime' | 'repeatBusinessRate'
  // Phase 67 §9.1 — Consultant items 2 & 4.
  | 'consultantUtilization' | 'clientProfitability'
  // Phase 67 §9.1 — Repair items 2 & 4.
  | 'jobCardTurnaroundByTechnician' | 'repairCategoryVolumeTrend'
  | 'fieldRepLeaderboard'
  | 'carJobCards' | 'tailoringOrders' | 'pestContracts' | 'realEstatePipeline' | 'retainers'
  | 'shootBookings' | 'eventBookings' | 'placements' | 'drawingRegister' | 'siteVisitLog' | 'prescriptionDrugSales'
  | 'scheduleH1XRegister'
  | 'schemeCostVsVolume'
  | 'chronicRecallCompliance'
  | 'walkInVsAppointmentRatio'
  | 'diagnosisCategoryTrend'
  | 'referralOutcome'
  | 'packUtilization'
  | 'labTAT' | 'testVolumeByPanel' | 'referralLeaderboard' | 'secondOpinionConversion' | 'caseComplexityMix' | 'treatmentAcceptanceRate' | 'dentalRecallCompliance' | 'vaccinationCompliance' | 'vetCaseTypeVolume'
  | 'hotelOccupancy' | 'hotelGuestRegister'
  // Phase 61 — Purchase-side reports (Section 3.1 item 5)
  | 'purchaseRegister' | 'purchasesByVendor' | 'purchasesByItem' | 'apAging'
  // Phase 65 — Cost Centres, Budgets & Payroll Compliance
  | 'costCentreTreemap' | 'budgetVsActual' | 'statutoryComplianceSummary' | 'cashFlowProjection' | 'cashPositionTrend' | 'paymentPerformance'
  // Phase 68 §9.1 — Beauty Salon items 1/2 & 3/4
  | 'stylistRepeatClient' | 'retailAttachRate'
  // Phase 68 §9.1 — Gym/Studio items 1/2 & 4
  | 'membershipRenewalFunnel' | 'classAttendanceHeatmap'
  // Phase 68 §9.1 — Driving School item 4
  | 'learnerProgressFunnel'

interface ReportDef {
  id: ReportType; label: string; description: string
  icon: React.ReactNode; category: string; requiresDateRange: boolean
  requiresEntity?: 'customer' | 'supplier'
  permission: string
  requiredModule?: TemplateModule
  // Phase 58 §2 — Pharmacy Schedule H/H1 register: no dedicated module flag
  // exists for this (isPrescriptionRequired is a plain Product field, not a
  // TemplateModule), so gate directly on businessType instead, same
  // reasoning as isRestaurant/isDistributor elsewhere in this codebase.
  // Phase 67 §9.1 item 23.5 — an array form covers Referral Leaderboard,
  // shown for SPECIALIST_CLINIC and DIAGNOSTIC_LAB (two verticals with no
  // shared module flag for this, since their underlying referral mechanisms
  // are genuinely different — see report.service.ts's own comment).
  requiredBusinessType?: string | string[]
}

const REPORT_DEF_META: { id: ReportType; icon: React.ReactNode; category: string; requiresDateRange: boolean; requiresEntity?: 'customer' | 'supplier'; permission: string; requiredModule?: TemplateModule; requiredBusinessType?: string | string[] }[] = [
  { id: 'sales', icon: <BarChart3 size={18} />, category: 'sales', requiresDateRange: true, permission: 'reports.sales' },
  { id: 'inventory', icon: <Package size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory' },
  { id: 'tax', icon: <Receipt size={18} />, category: 'finance', requiresDateRange: true, permission: 'reports.tax' },
  { id: 'outstanding', icon: <AlertCircle size={18} />, category: 'finance', requiresDateRange: false, permission: 'reports.outstanding' },
  { id: 'customerLedger', icon: <Users size={18} />, category: 'customers', requiresDateRange: false, requiresEntity: 'customer', permission: 'reports.invoices' },
  { id: 'supplierLedger', icon: <Truck size={18} />, category: 'suppliers', requiresDateRange: false, requiresEntity: 'supplier', permission: 'reports.financial' },
  // Phase 61 — Purchase-side reports (Section 3.1 item 5). Universal, no
  // requiredModule — every business buys something, same reasoning as
  // 'discounts' above.
  { id: 'purchaseRegister', icon: <Receipt size={18} />, category: 'suppliers', requiresDateRange: true, permission: 'reports.financial' },
  { id: 'purchasesByVendor', icon: <Truck size={18} />, category: 'suppliers', requiresDateRange: true, permission: 'reports.financial' },
  { id: 'purchasesByItem', icon: <Package size={18} />, category: 'suppliers', requiresDateRange: true, permission: 'reports.financial' },
  { id: 'apAging', icon: <AlertCircle size={18} />, category: 'suppliers', requiresDateRange: false, permission: 'reports.outstanding' },
  // Phase 65 — Cost Centres, Budgets & Payroll Compliance. budgetVsActual
  // deliberately lives on its own BudgetsScreen (/budgets) instead of here —
  // it pairs naturally with Budget create/edit, unlike these four which have
  // no dedicated management screen of their own.
  { id: 'costCentreTreemap', icon: <PieChart size={18} />, category: 'finance', requiresDateRange: true, permission: 'analytics.viewProfit' },
  // Budget vs Actual also lives inline on the Budgets screen (/budgets, next
  // to Budget create/edit) — this entry is the spec's own explicit "shares
  // the Reports screen's report-picker pattern" requirement, not a
  // duplicate; same generateBudgetVsActualReport backend either way.
  { id: 'budgetVsActual', icon: <Target size={18} />, category: 'finance', requiresDateRange: true, permission: 'budgets.view' },
  { id: 'statutoryComplianceSummary', icon: <ShieldCheck size={18} />, category: 'finance', requiresDateRange: true, permission: 'hr.view' },
  { id: 'cashFlowProjection', icon: <LineChart size={18} />, category: 'finance', requiresDateRange: false, permission: 'analytics.viewProfit' },
  { id: 'paymentPerformance', icon: <Clock size={18} />, category: 'finance', requiresDateRange: true, permission: 'reports.outstanding' },
  { id: 'expenses', icon: <DollarSign size={18} />, category: 'finance', requiresDateRange: true, permission: 'reports.financial' },
  { id: 'profitAndLoss', icon: <TrendingUp size={18} />, category: 'finance', requiresDateRange: true, permission: 'analytics.viewProfit' },
  { id: 'cashBook', icon: <DollarSign size={18} />, category: 'finance', requiresDateRange: true, permission: 'reports.financial' },
  // Phase 67 §9.1 — General: Combined Cash Position Trend. A day-by-day
  // CUMULATIVE balance for the "Cash & Bank" GL account, distinct from
  // cashFlowProjection above (daily NET movement, not a running position).
  { id: 'cashPositionTrend', icon: <TrendingUp size={18} />, category: 'finance', requiresDateRange: true, permission: 'reports.financial', requiredBusinessType: 'GENERAL' },
  { id: 'trialBalance', icon: <Receipt size={18} />, category: 'finance', requiresDateRange: true, permission: 'analytics.viewProfit' },
  { id: 'audit', icon: <Shield size={18} />, category: 'admin', requiresDateRange: false, permission: 'audit.view' },
  { id: 'backup', icon: <HardDrive size={18} />, category: 'admin', requiresDateRange: false, permission: 'backup.view' },
  { id: 'foodCost', icon: <Utensils size={18} />, category: 'restaurant', requiresDateRange: true, permission: 'reports.financial', requiredModule: 'ingredient_tracking' },
  { id: 'dishContributionMargin', icon: <TrendingUp size={18} />, category: 'restaurant', requiresDateRange: true, permission: 'reports.financial', requiredModule: 'ingredient_tracking' },
  { id: 'tableTurnoverByHour', icon: <Table size={18} />, category: 'restaurant', requiresDateRange: true, permission: 'reports.financial', requiredModule: 'kot' },
  { id: 'recipeWasteVariance', icon: <AlertCircle size={18} />, category: 'restaurant', requiresDateRange: true, permission: 'reports.financial', requiredModule: 'ingredient_tracking' },
  // Phase 67 §9.1 — Retail: Dead-Stock Clearance List. Snapshot-as-of-today
  // over a fixed 90-day lookback, not a date-range report — same category
  // as Inventory Report/Batch Expiry (requiresDateRange: false).
  { id: 'deadStockClearance', icon: <Boxes size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredBusinessType: 'RETAIL' },
  { id: 'categorySellThrough', icon: <TrendingUp size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.inventory', requiredBusinessType: 'RETAIL' },
  // Phase 67 §9.1 — Clothing: Season/Collection Sell-Through Report. Both
  // CLOTHING and FOOTWEAR — the audit's own field note flags Footwear as
  // sharing Clothing's exact module set byte-for-byte.
  { id: 'seasonSellThrough', icon: <TrendingUp size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.inventory', requiredBusinessType: ['CLOTHING', 'FOOTWEAR'] },
  // Phase 67 §9.1 — Clothing: Size × Style Heatmap Report. Same icon
  // convention as the pre-existing Table Turnover heatmap.
  { id: 'sizeStyleHeatmap', icon: <Table size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.inventory', requiredBusinessType: ['CLOTHING', 'FOOTWEAR'] },
  // Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap Report. A
  // live current-state stock snapshot ("what's out right now"), deliberately
  // NOT gated to CLOTHING too — the sales-based heatmap above already covers
  // both verticals equally, but availability is Footwear's own distinct
  // signature item per the audit.
  { id: 'sizeAvailabilityHeatmap', icon: <Table size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredBusinessType: 'FOOTWEAR' },
  // Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar. Also a
  // live current-state view, not a sales-history one — reuses the same
  // requiresDateRange:false convention as the availability heatmap above.
  { id: 'seasonalReorderCalendar', icon: <Boxes size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredBusinessType: 'FOOTWEAR' },
  // Phase 67 §9.1 — Clothing item 5: Margin by Brand/Vendor Report — its
  // 5th and final signature item, closing the vertical out. "Vendor/brand"
  // reuses the pre-existing Product.defaultSupplierId (no new field).
  { id: 'vendorMargin', icon: <TrendingUp size={18} />, category: 'sales', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: ['CLOTHING', 'FOOTWEAR'] },
  // Phase 67 §9.1 — Footwear item 2: Brand-Wise Margin & Return-Rate
  // Report. Footwear-only, distinct from Clothing item 5's own vendor
  // margin above — the audit's own combo-chart note ("footwear returns
  // run higher than apparel; track it by brand").
  { id: 'brandMarginReturnRate', icon: <TrendingUp size={18} />, category: 'sales', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'FOOTWEAR' },
  { id: 'basketComposition', icon: <Share2 size={18} />, category: 'sales', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'RETAIL' },
  // Phase 67 §9.1 — General: Category Mix. What share of revenue each
  // user-defined ProductCategory contributes over a date range — distinct
  // from Category Sell-Through's own month-by-month rate-vs-stock view.
  { id: 'categoryMix', icon: <PieChart size={18} />, category: 'sales', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'GENERAL' },
  // Phase 67 §9.1 — Hardware: Fast-Mover vs. Slow-Mover Matrix. A scatter of
  // velocity x margin, quadrant-split by each axis's own median — see
  // report.service.ts's generateFastSlowMoverMatrixReport for why a median
  // split, not a fixed threshold.
  { id: 'fastSlowMoverMatrix', icon: <Target size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.inventory', requiredBusinessType: 'HARDWARE' },
  { id: 'orderVolume', icon: <QrCode size={18} />, category: 'restaurant', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'qr_table_ordering' },
  // No requiredModule — bargained/negotiated line pricing writes to the
  // same InvoiceItem.discountAmount every PRODUCT-category business's
  // billing cart already uses, so this report is universal like 'sales'.
  { id: 'discounts', icon: <HandCoins size={18} />, category: 'sales', requiresDateRange: true, permission: 'reports.sales' },
  { id: 'gstr1', icon: <Receipt size={18} />, category: 'gst', requiresDateRange: true, permission: 'reports.tax' },
  { id: 'hsnSummary', icon: <ScanLine size={18} />, category: 'gst', requiresDateRange: true, permission: 'reports.tax' },
  { id: 'documentSummary', icon: <FileStack size={18} />, category: 'gst', requiresDateRange: true, permission: 'reports.tax' },
  { id: 'gstr3bPreview', icon: <Receipt size={18} />, category: 'gst', requiresDateRange: true, permission: 'reports.tax' },
  { id: 'appointmentUtilisation', icon: <Activity size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'appointments' },
  { id: 'clientRetention', icon: <UserCheck size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'appointments' },
  { id: 'commission', icon: <Award size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.financial', requiredModule: 'appointments' },
  { id: 'labThroughput', icon: <FlaskConical size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'lab_orders' },
  { id: 'batchExpiry', icon: <PackageSearch size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredModule: 'batch_tracking' },
  { id: 'bloodStock', icon: <Droplet size={18} />, category: 'bloodBank', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'blood_bank' },
  // Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time.
  { id: 'donationToIssueCycleTime', icon: <Droplet size={18} />, category: 'bloodBank', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'blood_bank' },
  { id: 'jewellery', icon: <Gem size={18} />, category: 'jewellery', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'jewellery_pricing' },
  // Phase 67 §9.1 — Jewellery items 2/3/4/5.
  { id: 'makingChargeMargin', icon: <PieChart size={18} />, category: 'jewellery', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'jewellery_pricing' },
  { id: 'hallmarkCompliance', icon: <ShieldCheck size={18} />, category: 'jewellery', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'jewellery_pricing' },
  { id: 'metalRateVsSalesVolume', icon: <TrendingUp size={18} />, category: 'jewellery', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'jewellery_pricing' },
  { id: 'purityAdjustedExchange', icon: <Repeat size={18} />, category: 'jewellery', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'jewellery_pricing' },
  { id: 'logistics', icon: <Boxes size={18} />, category: 'logistics', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'logistics_analytics' },
  { id: 'attendance', icon: <CalendarCheck size={18} />, category: 'admin', requiresDateRange: true, permission: 'reports.sales' },
  { id: 'production', icon: <Factory size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'production_orders' },
  // Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished Unit.
  { id: 'landedCostPerUnit', icon: <Factory size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'production_orders' },
  // Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend.
  { id: 'rejectionRateTrend', icon: <Factory size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'production_orders' },
  // Phase 67 §9.1 — Agri Inputs item 2: Seasonal Credit Exposure. Live
  // current-state (no date range), gated directly on businessType — no
  // TemplateModule flag exists for this (same reasoning as pharmacy's
  // Schedule H register above), since it reads Invoice.dueDate/cropSeasonId
  // directly rather than an opt-in module.
  { id: 'seasonalCreditExposure', icon: <CalendarCheck size={18} />, category: 'finance', requiresDateRange: false, permission: 'reports.financial', requiredBusinessType: 'AGRI_INPUTS' },
  // Phase 67 §9.1 — Agri Inputs item 4: Farmer-Wise Purchase & Repayment
  // History. Same live current-state + businessType gate as above.
  { id: 'farmerRepayment', icon: <Users size={18} />, category: 'customers', requiresDateRange: false, permission: 'reports.financial', requiredBusinessType: 'AGRI_INPUTS' },
  { id: 'serialWarranty', icon: <ScanLine size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredModule: 'serial_tracking' },
  // Phase 67 §9.1 — Electronics: RMA Aging Report. Every currently-open
  // vendor RMA, ranked by days with vendor — a full breakdown, distinct
  // from the Dashboard's own alert-style overdue-only count.
  { id: 'rmaAging', icon: <Wrench size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredModule: 'repair_rma' },
  // Phase 67 §9.1 — Electronics: Vendor Warranty-Claim Recovery Ledger. A
  // money-owed-to-the-shop ledger, so category 'finance' + reports.financial
  // — same pairing cashBook above uses — not the plain inventory-status tier
  // rmaAging itself sits in.
  { id: 'vendorRecoveryLedger', icon: <DollarSign size={18} />, category: 'finance', requiresDateRange: false, permission: 'reports.financial', requiredModule: 'repair_rma' },
  // Phase 67 §9.1 — Electronics: Repair Turnaround by Technician. Same
  // inventory-status tier + repair_rma gate as rmaAging above — an
  // operations/service-quality metric, not a financial one.
  { id: 'repairTurnaroundByTechnician', icon: <Timer size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredModule: 'repair_rma' },
  { id: 'variantStock', icon: <Shirt size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredModule: 'variant_tracking' },
  { id: 'testScores', icon: <GraduationCap size={18} />, category: 'service', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'coaching_performances' },
  { id: 'complianceTasks', icon: <ClipboardCheck size={18} />, category: 'service', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'compliance_tasks' },
  { id: 'rentalStatus', icon: <CalendarClock size={18} />, category: 'rental', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'rental_bookings' },
  { id: 'rentalRevenue', icon: <BarChart3 size={18} />, category: 'rental', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'rental_bookings' },
  // Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per unit.
  { id: 'assetUtilization', icon: <BarChart3 size={18} />, category: 'rental', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'rental_bookings' },
  { id: 'hotelOccupancy', icon: <BedDouble size={18} />, category: 'hotel', requiresDateRange: false, permission: 'hotel.view', requiredModule: 'hotel_bookings' },
  { id: 'hotelGuestRegister', icon: <Users size={18} />, category: 'hotel', requiresDateRange: true, permission: 'hotel.view', requiredModule: 'hotel_bookings' },
  { id: 'projects', icon: <Briefcase size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'projects' },
  // Phase 67 §9.1 — Service items 2/4.
  { id: 'serviceResolutionTime', icon: <Clock size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'service_tickets' },
  { id: 'repeatBusinessRate', icon: <LineChart size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'service_tickets' },
  // Phase 67 §9.1 — Consultant items 2 & 4. Gated on 'projects' (same as
  // the pre-existing 'projects' tile above) rather than a new module — both
  // reports derive purely from WorkLog+Project, which Service also has, so
  // this is a genuine improvement for Service too, not an artificial
  // restriction to Consultant alone.
  { id: 'consultantUtilization', icon: <Target size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'projects' },
  { id: 'clientProfitability', icon: <DollarSign size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'projects' },
  // Phase 67 §9.1 — Repair items 2 & 4.
  { id: 'jobCardTurnaroundByTechnician', icon: <BarChart3 size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'job_cards' },
  { id: 'repairCategoryVolumeTrend', icon: <LineChart size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'job_cards' },
  { id: 'serviceProjects', icon: <FolderOpen size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'service_projects' },
  { id: 'jobCards', icon: <Wrench size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'job_cards' },
  { id: 'carJobCards', icon: <Car size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'car_job_cards' },
  { id: 'tailoringOrders', icon: <Scissors size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'tailoring_orders' },
  { id: 'pestContracts', icon: <Bug size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'pest_contracts' },
  { id: 'realEstatePipeline', icon: <Home size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'properties' },
  { id: 'retainers', icon: <Repeat size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'retainers' },
  { id: 'shootBookings', icon: <Camera size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'shoot_bookings' },
  { id: 'eventBookings', icon: <PartyPopper size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'event_bookings' },
  { id: 'placements', icon: <UsersRound size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'placement_agency' },
  { id: 'drawingRegister', icon: <FileStack size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'drawing_register' },
  { id: 'siteVisitLog', icon: <HardHat size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'site_visit_log' },
  { id: 'prescriptionDrugSales', icon: <Pill size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'PHARMACY' },
  // Phase 67 §9.1 — Pharmacy item 1: Schedule H1/X narcotic register.
  { id: 'scheduleH1XRegister', icon: <Pill size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'PHARMACY' },
  // Phase 67 §9.1 — Distributor: correlates scheme cost against covered-
  // product volume, not a causal incrementality claim (see the report
  // function's own comment in report.service.ts for why).
  { id: 'schemeCostVsVolume', icon: <TrendingUp size={18} />, category: 'distributor', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'DISTRIBUTOR' },
  // Phase 68 §9.1 — Beauty Salon items 1/2 & 3/4.
  { id: 'stylistRepeatClient', icon: <Award size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'multi_service_booking' },
  { id: 'retailAttachRate', icon: <Package size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'multi_service_booking' },
  // Phase 68 §9.1 — Gym/Studio items 1/2 & 4.
  { id: 'membershipRenewalFunnel', icon: <Repeat size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'memberships' },
  { id: 'classAttendanceHeatmap', icon: <Table size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'batch_classes' },
  // Phase 68 §9.1 — Driving School item 4. Current-state snapshot, no date range.
  { id: 'learnerProgressFunnel', icon: <Target size={18} />, category: 'service', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'learner_profiles' },
  // Phase 67 §9.1 — Distributor item 3: field-rep performance leaderboard.
  { id: 'fieldRepLeaderboard', icon: <Award size={18} />, category: 'distributor', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'DISTRIBUTOR' },
  // Phase 67 §9.1 item 19.2 — GP Clinic: % of chronic-condition recalls
  // followed up on time, over the picked date range (matches the recall
  // PERIOD's scheduled date, not when the recall was tagged).
  { id: 'chronicRecallCompliance', icon: <HeartPulse size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'chronic_recall' },
  // Phase 67 §9.1 item 19.3 — GP Clinic: Walk-in vs. Appointment Ratio.
  { id: 'walkInVsAppointmentRatio', icon: <UsersRound size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'GP_CLINIC' },
  // Phase 67 §9.1 item 19.4 — GP Clinic: Diagnosis-Category Trend.
  { id: 'diagnosisCategoryTrend', icon: <LineChart size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'diagnosis_categories' },
  // Phase 67 §9.1 item 19.5 — GP Clinic: Referral-Out Outcome. Gated by
  // 'specialist_referral' (not GP_CLINIC-only) since SPECIALIST_CLINIC
  // shares the exact same referral mechanism and data shape.
  { id: 'referralOutcome', icon: <Share2 size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'specialist_referral' },
  // Phase 67 §9.1 item 22.4 — Physio Clinic (shared with Gym/Studio, Beauty
  // Salon, Driving School — every session_packs vertical): Pack Utilization.
  { id: 'packUtilization', icon: <PackageSearch size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'session_packs' },
  // Phase 67 §9.1 item 23.1 — Diagnostic Lab: Per-Test TAT target vs. actual.
  { id: 'labTAT', icon: <Timer size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'DIAGNOSTIC_LAB' },
  // Phase 67 §9.1 item 23.4 — Diagnostic Lab: Test Volume by Panel.
  { id: 'testVolumeByPanel', icon: <LineChart size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'DIAGNOSTIC_LAB' },
  // Phase 67 §9.1 item 23.5 (Diagnostic Lab) + item 20.1 (Specialist Clinic):
  // Referral Leaderboard — shown for both, backed by two different queries.
  { id: 'referralLeaderboard', icon: <Share2 size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: ['DIAGNOSTIC_LAB', 'SPECIALIST_CLINIC'] },
  // Phase 67 §9.1 item 20.2 — Specialist Clinic: Second-Opinion Conversion.
  { id: 'secondOpinionConversion', icon: <UserCheck size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'SPECIALIST_CLINIC' },
  // Phase 67 §9.1 item 20.3 — Specialist Clinic: Case-Complexity Mix.
  { id: 'caseComplexityMix', icon: <PieChart size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'SPECIALIST_CLINIC' },
  // Phase 67 §9.1 item 21.2 — Dental Clinic: Treatment Acceptance Rate.
  { id: 'treatmentAcceptanceRate', icon: <Target size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'DENTAL_CLINIC' },
  // Phase 67 §9.1 item 21.4 — Dental Clinic: Recall Compliance.
  { id: 'dentalRecallCompliance', icon: <HeartPulse size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'DENTAL_CLINIC' },
  // Phase 67 §9.1 item 18.2 — Vet Clinic: Vaccination Compliance.
  { id: 'vaccinationCompliance', icon: <HeartPulse size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'VET_CLINIC' },
  // Phase 67 §9.1 item 18.4 — Vet Clinic: Case-Type Volume Trend.
  { id: 'vetCaseTypeVolume', icon: <LineChart size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredBusinessType: 'VET_CLINIC' },
]

const CATEGORY_IDS = ['sales', 'inventory', 'finance', 'customers', 'suppliers', 'admin', 'restaurant', 'gst', 'service', 'bloodBank', 'jewellery', 'logistics', 'rental', 'hotel', 'distributor']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFmt(_sym: string) { return (n: number) => formatCurrency(n) }
// Phase 58 §1 (fixed 2026-07-18) — real bug: both of these used to build
// their date string via .toISOString(), which is UTC-based. In a timezone
// ahead of UTC (e.g. IST, UTC+5:30), within the first ~5.5 hours after
// local midnight, .toISOString() still reports the PREVIOUS UTC day —
// today() silently returned "yesterday" as the default dateTo, and the
// report backend's own `to.setHours(23,59,59,999)` (parsing that
// UTC-midnight string, then applying LOCAL hours) computed an upper bound
// hours *before* the true current moment, excluding same-day rows from
// every date-ranged report's default view during that window. Building
// from the Date object's own local getFullYear()/getMonth()/getDate()
// avoids the UTC round-trip entirely — matches the local wall-clock date
// a user actually expects "today" to mean.
function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function today() { return localDateString(new Date()) }
function monthStart() { const d = new Date(); d.setDate(1); return localDateString(d) }

// Table Turnover by Hour's day-of-week axis — uses the browser's native
// Intl weekday formatting in the app's OWN currently-selected UI language,
// rather than hand-translating 7 day names into 13 locale files. 2024-01-07
// was a real Sunday; adding `dayOfWeek` days lands on the matching weekday
// for any 0(Sun)-6(Sat) index, in any locale, correctly.
function weekdayLabel(dayOfWeek: number, locale: string, short = true): string {
  const d = new Date(2024, 0, 7 + dayOfWeek)
  try {
    return d.toLocaleDateString(locale, { weekday: short ? 'short' : 'long' })
  } catch {
    return d.toLocaleDateString('en-US', { weekday: short ? 'short' : 'long' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function ReportsScreen() {
  const { t, i18n } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const { isModuleEnabled, businessType } = useIndustryStore()
  const taxModel = useBusinessStore(s => s.profile?.taxModel ?? 'NONE')
  const businessName = useBusinessStore(s => s.profile?.businessName ?? 'Business')
  const hasPermission = useAuthStore(s => s.hasPermission)

  const [activeReport, setActiveReport] = useState<ReportType>('sales')
  const [reportData, setReportData] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  // Bug fix (renderer audit 2026-07-28): the CSV/Excel/PDF export buttons had
  // no loading/disabled guard at all — PDF export in particular is two
  // sequential IPC calls (generateReportHtml, then toPdf), so a rapid
  // double-click could fire the export twice concurrently (e.g. two stacked
  // save-file dialogs). One shared flag since only one export makes sense
  // in flight at a time.
  const [exporting, setExporting] = useState(false)
  const [currencySymbol, setCurrencySymbol] = useState('₹')
  const AUDIT_PAGE_SIZE = 200

  // Load the configured currency symbol from the business profile
  useEffect(() => {
    window.api.businessProfile.get().then((res) => {
      const d = res.data as { currencySymbol?: string } | undefined
      if (res.success && d?.currencySymbol) {
        setCurrencySymbol(d.currencySymbol)
      } else if (!res.success) {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    }).catch(() => {
      toastError(t('common.error'), t('common.error'))
    })
  }, [t, toastError])

  const fmt = makeFmt(currencySymbol)

  // Filters
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('month')
  const [customerId, setCustomerId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<{ id: string; customerName: string }[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierResults, setSupplierResults] = useState<{ id: string; supplierName: string }[]>([])
  const [providerId, setProviderId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([])

  // Employees double as both "providers" (Appointment Utilisation) and "staff"
  // (Commission Report) — both reports filter on Employee.id.
  useEffect(() => {
    window.api.hr.listEmployees({ isActive: true }).then((res) => {
      if (!res.success) {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
        return
      }
      const d = res.data as { employees?: { id: string; fullName: string }[] } | { id: string; fullName: string }[]
      setEmployees(Array.isArray(d) ? d : (d.employees ?? []))
    }).catch(() => {
      toastError(t('common.error'), t('common.error'))
    })
  }, [t, toastError])

  const REPORT_DEFS: ReportDef[] = React.useMemo(() => REPORT_DEF_META.map(m => ({
    ...m,
    label: t(`reports.defs.${m.id}.label`),
    description: t(`reports.defs.${m.id}.description`)
  })), [t])

  const def = REPORT_DEFS.find(r => r.id === activeReport)!

  // Fires on every keystroke with no debounce — a toast per failed keystroke
  // would spam the user, so failures are logged rather than surfaced as toasts.
  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) { setCustomerResults([]); return }
    try {
      const res = await window.api.customers.search(q)
      if (res.success) setCustomerResults((res.data as { id: string; customerName: string }[]) ?? [])
      else console.error('customers.search failed', res.error)
    } catch (e) {
      console.error('customers.search threw', e)
    }
  }, [])

  const searchSuppliers = useCallback(async (q: string) => {
    if (!q.trim()) { setSupplierResults([]); return }
    try {
      const res = await window.api.suppliers.search(q)
      if (res.success) setSupplierResults((res.data as { id: string; supplierName: string }[]) ?? [])
      else console.error('suppliers.search failed', res.error)
    } catch (e) {
      console.error('suppliers.search threw', e)
    }
  }, [])

  async function runReport() {
    setLoading(true); setHasRun(true)
    try {
      let res: { success: boolean; data?: unknown; error?: { message: string } }

      switch (activeReport) {
        case 'sales':
          res = await window.api.reports.sales({ dateFrom, dateTo, groupBy })
          break
        case 'inventory':
          res = await window.api.reports.inventory({ lowStockOnly: lowStockOnly || undefined })
          break
        case 'tax':
          res = await window.api.reports.tax({ dateFrom, dateTo })
          break
        case 'outstanding':
          res = await window.api.reports.outstanding()
          break
        case 'customerLedger':
          if (!customerId) { toastError(t('common.required'), t('nav.customers')); setLoading(false); return }
          res = await window.api.reports.customerLedger({ customerId, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
          break
        case 'supplierLedger':
          if (!supplierId) { toastError(t('common.required'), t('nav.suppliers')); setLoading(false); return }
          res = await window.api.reports.supplierLedger({ supplierId, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
          break
        case 'expenses':
          res = await window.api.reports.expenses({ dateFrom, dateTo })
          break
        case 'profitAndLoss':
          res = await window.api.reports.profitAndLoss({ dateFrom, dateTo })
          break
        case 'cashBook':
          res = await window.api.reports.cashBook({ dateFrom, dateTo })
          break
        case 'trialBalance':
          res = await window.api.reports.trialBalance({ dateFrom, dateTo })
          break
        case 'audit':
          res = await window.api.reports.audit({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: 1, limit: AUDIT_PAGE_SIZE })
          break
        case 'backup':
          res = await window.api.backup.list()
          break
        case 'foodCost':
          res = await window.api.reports.foodCost({ dateFrom, dateTo })
          break
        case 'dishContributionMargin':
          res = await window.api.reports.dishContributionMargin({ dateFrom, dateTo })
          break
        case 'tableTurnoverByHour':
          res = await window.api.reports.tableTurnoverByHour({ dateFrom, dateTo })
          break
        case 'recipeWasteVariance':
          res = await window.api.reports.recipeWasteVariance({ dateFrom, dateTo })
          break
        case 'deadStockClearance':
          res = await window.api.reports.deadStockClearance({})
          break
        case 'categorySellThrough':
          res = await window.api.reports.categorySellThrough({ dateFrom, dateTo })
          break
        case 'seasonSellThrough':
          res = await window.api.reports.seasonSellThrough({ dateFrom, dateTo })
          break
        case 'sizeStyleHeatmap':
          res = await window.api.reports.sizeStyleHeatmap({ dateFrom, dateTo })
          break
        case 'sizeAvailabilityHeatmap':
          res = await window.api.reports.sizeAvailabilityHeatmap({})
          break
        case 'seasonalReorderCalendar':
          res = await window.api.seasonalCycle.calendar({})
          break
        case 'basketComposition':
          res = await window.api.reports.basketComposition({ dateFrom, dateTo })
          break
        case 'categoryMix':
          res = await window.api.reports.categoryMix({ dateFrom, dateTo })
          break
        case 'vendorMargin':
          res = await window.api.reports.vendorMargin({ dateFrom, dateTo })
          break
        case 'brandMarginReturnRate':
          res = await window.api.reports.brandMarginReturnRate({ dateFrom, dateTo })
          break
        case 'fastSlowMoverMatrix':
          res = await window.api.reports.fastSlowMoverMatrix({ dateFrom, dateTo })
          break
        case 'gstr1':
          res = await window.api.reports.gstr1({ dateFrom, dateTo })
          break
        case 'hsnSummary':
          res = await window.api.reports.hsnSummary({ dateFrom, dateTo })
          break
        case 'documentSummary':
          res = await window.api.reports.documentSummary({ dateFrom, dateTo })
          break
        case 'gstr3bPreview':
          res = await window.api.reports.gstr3bPreview({ dateFrom, dateTo })
          break
        case 'rentalStatus':
          res = await window.api.reports.rentalStatus()
          break
        case 'rentalRevenue':
          res = await window.api.reports.rentalRevenue({ dateFrom, dateTo })
          break
        case 'assetUtilization':
          res = await window.api.reports.assetUtilization({ dateFrom, dateTo })
          break
        case 'hotelOccupancy':
          res = await window.api.hotel.occupancyReport()
          break
        case 'hotelGuestRegister':
          res = await window.api.hotel.guestRegister({ dateFrom, dateTo })
          break
        case 'appointmentUtilisation':
          res = await window.api.reports.appointmentUtilisation({ dateFrom, dateTo, providerId: providerId || undefined })
          break
        case 'clientRetention':
          res = await window.api.reports.clientRetention({ dateFrom, dateTo })
          break
        case 'commission':
          res = await window.api.reports.commission({ dateFrom, dateTo, staffId: staffId || undefined })
          break
        case 'orderVolume':
          res = await window.api.reports.orderVolume({ dateFrom, dateTo })
          break
        case 'discounts':
          res = await window.api.reports.discounts({ dateFrom, dateTo })
          break
        case 'purchaseRegister':
          res = await window.api.reports.purchaseRegister({ dateFrom, dateTo })
          break
        case 'purchasesByVendor':
          res = await window.api.reports.purchasesByVendor({ dateFrom, dateTo })
          break
        case 'purchasesByItem':
          res = await window.api.reports.purchasesByItem({ dateFrom, dateTo })
          break
        case 'apAging':
          res = await window.api.reports.apAging()
          break
        case 'costCentreTreemap':
          res = await window.api.reports.costCentreTreemap({ dateFrom, dateTo })
          break
        case 'budgetVsActual': {
          const [y, m] = (dateTo || toLocalISODate(new Date())).split('-').map(Number)
          res = await window.api.reports.budgetVsActual({ periodYear: y, periodMonth: m })
          break
        }
        case 'statutoryComplianceSummary': {
          // Reuses the date-range picker's own "to" date to pick the month —
          // this report is inherently monthly (matches payroll's own
          // granularity), not a real date range.
          const [y, m] = (dateTo || toLocalISODate(new Date())).split('-').map(Number)
          res = await window.api.reports.statutoryComplianceSummary({ periodYear: y, periodMonth: m })
          break
        }
        case 'cashFlowProjection':
          res = await window.api.reports.cashFlowProjection({})
          break
        case 'cashPositionTrend':
          res = await window.api.reports.cashPositionTrend({ dateFrom, dateTo })
          break
        case 'paymentPerformance':
          res = await window.api.reports.paymentPerformance({ dateFrom, dateTo })
          break
        case 'batchExpiry':
          res = await window.api.reports.batchExpiry()
          break
        case 'labThroughput':
          res = await window.api.reports.labThroughput({ dateFrom, dateTo })
          break
        case 'bloodStock':
          res = await window.api.reports.bloodStock()
          break
        case 'donationToIssueCycleTime':
          res = await window.api.reports.donationToIssueCycleTime()
          break
        case 'jewellery':
          res = await window.api.reports.jewellery({ dateFrom, dateTo })
          break
        case 'makingChargeMargin':
          res = await window.api.reports.makingChargeMargin({ dateFrom, dateTo })
          break
        case 'hallmarkCompliance':
          res = await window.api.reports.hallmarkCompliance()
          break
        case 'metalRateVsSalesVolume':
          res = await window.api.reports.metalRateVsSalesVolume({ dateFrom, dateTo })
          break
        case 'purityAdjustedExchange':
          res = await window.api.reports.purityAdjustedExchange({ dateFrom, dateTo })
          break
        case 'projects':
          res = await window.api.reports.projects({ dateFrom, dateTo })
          break
        case 'serviceResolutionTime':
          res = await window.api.reports.serviceResolutionTime({ dateFrom, dateTo })
          break
        case 'repeatBusinessRate':
          res = await window.api.reports.repeatBusinessRate({ dateFrom, dateTo })
          break
        case 'consultantUtilization':
          res = await window.api.reports.consultantUtilization({ dateFrom, dateTo })
          break
        case 'clientProfitability':
          res = await window.api.reports.clientProfitability({ dateFrom, dateTo })
          break
        case 'jobCardTurnaroundByTechnician':
          res = await window.api.reports.jobCardTurnaroundByTechnician({ dateFrom, dateTo })
          break
        case 'repairCategoryVolumeTrend':
          res = await window.api.reports.repairCategoryVolumeTrend({ dateFrom, dateTo })
          break
        case 'fieldRepLeaderboard':
          res = await window.api.reports.fieldRepLeaderboard({ dateFrom, dateTo })
          break
        case 'stylistRepeatClient':
          res = await window.api.reports.stylistRepeatClient({ dateFrom, dateTo })
          break
        case 'retailAttachRate':
          res = await window.api.reports.retailAttachRate({ dateFrom, dateTo })
          break
        case 'membershipRenewalFunnel':
          res = await window.api.reports.membershipRenewalFunnel({ dateFrom, dateTo })
          break
        case 'classAttendanceHeatmap':
          res = await window.api.reports.classAttendanceHeatmap({ dateFrom, dateTo })
          break
        case 'learnerProgressFunnel':
          res = await window.api.reports.learnerProgressFunnel()
          break
        case 'serviceProjects':
          res = await window.api.reports.serviceProjects({ dateFrom, dateTo })
          break
        case 'jobCards':
          res = await window.api.reports.jobCards({ dateFrom, dateTo })
          break
        case 'carJobCards':
          res = await window.api.reports.carJobCards({ dateFrom, dateTo })
          break
        case 'tailoringOrders':
          res = await window.api.reports.tailoringOrders({ dateFrom, dateTo })
          break
        case 'pestContracts':
          res = await window.api.reports.pestContracts({ dateFrom, dateTo })
          break
        case 'realEstatePipeline':
          res = await window.api.reports.realEstatePipeline({ dateFrom, dateTo })
          break
        case 'retainers':
          res = await window.api.reports.retainers({ dateFrom, dateTo })
          break
        case 'shootBookings':
          res = await window.api.reports.shootBookings({ dateFrom, dateTo })
          break
        case 'eventBookings':
          res = await window.api.reports.eventBookings({ dateFrom, dateTo })
          break
        case 'placements':
          res = await window.api.reports.placements({ dateFrom, dateTo })
          break
        case 'drawingRegister':
          res = await window.api.reports.drawingRegister({ dateFrom, dateTo })
          break
        case 'siteVisitLog':
          res = await window.api.reports.siteVisitLog({ dateFrom, dateTo })
          break
        case 'prescriptionDrugSales':
          res = await window.api.reports.prescriptionDrugSales({ dateFrom, dateTo })
          break
        case 'scheduleH1XRegister':
          res = await window.api.reports.scheduleH1XRegister({ dateFrom, dateTo })
          break
        case 'schemeCostVsVolume':
          res = await window.api.reports.schemeCostVsVolume({ dateFrom, dateTo })
          break
        case 'chronicRecallCompliance':
          res = await window.api.reports.chronicRecallCompliance({ dateFrom, dateTo })
          break
        case 'walkInVsAppointmentRatio':
          res = await window.api.reports.walkInVsAppointmentRatio({ dateFrom, dateTo })
          break
        case 'diagnosisCategoryTrend':
          res = await window.api.reports.diagnosisCategoryTrend({ dateFrom, dateTo })
          break
        case 'referralOutcome':
          res = await window.api.reports.referralOutcome({ dateFrom, dateTo })
          break
        case 'packUtilization':
          res = await window.api.reports.packUtilization({ dateFrom, dateTo })
          break
        case 'labTAT':
          res = await window.api.reports.labTAT({ dateFrom, dateTo })
          break
        case 'testVolumeByPanel':
          res = await window.api.reports.testVolumeByPanel({ dateFrom, dateTo })
          break
        case 'referralLeaderboard':
          res = await window.api.reports.referralLeaderboard({ dateFrom, dateTo, businessType })
          break
        case 'secondOpinionConversion':
          res = await window.api.reports.secondOpinionConversion({ dateFrom, dateTo })
          break
        case 'caseComplexityMix':
          res = await window.api.reports.caseComplexityMix({ dateFrom, dateTo })
          break
        case 'treatmentAcceptanceRate':
          res = await window.api.reports.treatmentAcceptanceRate({ dateFrom, dateTo })
          break
        case 'dentalRecallCompliance':
          res = await window.api.reports.dentalRecallCompliance({ dateFrom, dateTo })
          break
        case 'vaccinationCompliance':
          res = await window.api.reports.vaccinationCompliance({ dateFrom, dateTo })
          break
        case 'vetCaseTypeVolume':
          res = await window.api.reports.vetCaseTypeVolume({ dateFrom, dateTo })
          break
        case 'logistics':
          res = await window.api.reports.logistics({ dateFrom, dateTo })
          break
        case 'attendance':
          res = await window.api.reports.attendance({ dateFrom, dateTo })
          break
        case 'production':
          res = await window.api.reports.production({ dateFrom, dateTo })
          break
        case 'landedCostPerUnit':
          res = await window.api.reports.landedCostPerUnit({ dateFrom, dateTo })
          break
        case 'rejectionRateTrend':
          res = await window.api.reports.rejectionRateTrend({ dateFrom, dateTo })
          break
        case 'seasonalCreditExposure':
          res = await window.api.reports.seasonalCreditExposure()
          break
        case 'farmerRepayment':
          res = await window.api.reports.farmerRepayment()
          break
        case 'serialWarranty':
          res = await window.api.reports.serialWarranty()
          break
        case 'rmaAging':
          res = await window.api.reports.rmaAging()
          break
        case 'vendorRecoveryLedger':
          res = await window.api.reports.vendorRecoveryLedger()
          break
        case 'repairTurnaroundByTechnician':
          res = await window.api.reports.repairTurnaroundByTechnician()
          break
        case 'variantStock':
          res = await window.api.reports.variantStock()
          break
        case 'testScores':
          res = await window.api.reports.testScores({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
          break
        case 'complianceTasks':
          res = await window.api.reports.complianceTasks()
          break
        default:
          return
      }

      if (res.success) {
        setReportData(res.data)
      } else {
        toastError(t('reports.title'), res.error?.message ?? t('reports.noData'))
        setReportData(null)
      }
    } catch {
      toastError(t('reports.title'), t('reports.noData'))
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  async function goToAuditPage(page: number) {
    setLoading(true)
    try {
      const res = await window.api.reports.audit({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit: AUDIT_PAGE_SIZE })
      if (res.success) {
        setReportData(res.data)
      } else {
        toastError(t('reports.title'), res.error?.message ?? t('reports.noData'))
      }
    } catch {
      toastError(t('reports.title'), t('reports.noData'))
    } finally {
      setLoading(false)
    }
  }

  // ─── Export helpers ────────────────────────────────────────────────────────

  function buildExportData(): { headers: string[]; rows: (string | number | null)[][] } {
    if (!reportData) return { headers: [], rows: [] }
    const yn = (b: boolean) => b ? t('common.yes') : t('common.no')
    switch (activeReport) {
      case 'sales': {
        const d = reportData as SalesReport
        return {
          headers: [t('reports.col.invoiceNo'), t('common.date'), t('reports.col.customer'), t('reports.col.items'), t('common.subtotal'), t('common.discount'), t('common.tax'), t('common.total'), t('reports.col.method'), t('common.status')],
          rows: d.rows.map(r => [r.invoiceNumber, r.date, r.customer, r.itemCount, r.subtotal, r.discountAmount, r.taxAmount, r.totalAmount, r.paymentMethod, r.paymentStatus])
        }
      }
      case 'inventory': {
        const d = reportData as InventoryReport
        return {
          headers: [t('reports.col.sku'), t('reports.col.product'), t('reports.col.category'), t('reports.col.type'), t('reports.col.stock'), t('common.unit'), t('reports.col.costPrice'), t('reports.col.sellingPrice'), t('reports.summary.stockValue'), t('reports.summary.lowStock')],
          rows: d.rows.map(r => [r.sku, r.productName, r.category, r.productType, r.currentStock, r.unit, r.costPrice, r.sellingPrice, r.stockValue, yn(r.lowStockAlert)])
        }
      }
      case 'tax': {
        const d = reportData as TaxReport
        return {
          headers: [t('reports.col.taxName'), t('reports.col.type'), t('reports.col.ratePercent'), t('reports.col.taxableAmount'), t('reports.summary.taxCollected'), t('reports.col.invoicesShort')],
          rows: d.rows.map(r => [r.taxName, r.taxType, r.rate, r.taxableAmount, r.taxCollected, r.invoiceCount])
        }
      }
      case 'outstanding': {
        const d = reportData as OutstandingReport
        const customerRows = d.customers.rows.map(r => [
          `${t('reports.val.customerPrefix')}${r.customerName}`, r.phone ?? '', r.outstanding, '',
          r.aging.current, r.aging.days1to30, r.aging.days31to60, r.aging.days61to90, r.aging.days90plus
        ])
        const supplierRows = d.suppliers.rows.map(r => [
          `${t('reports.val.supplierPrefix')}${r.supplierName}`, r.phone ?? '', '', r.outstanding,
          r.aging.current, r.aging.days1to30, r.aging.days31to60, r.aging.days61to90, r.aging.days90plus
        ])
        return {
          headers: [
            t('reports.col.name'), t('common.phone'), `${t('reports.summary.customerOutstanding')} (${currencySymbol})`, `${t('reports.summary.supplierPayables')} (${currencySymbol})`,
            t('reports.aging.current'), t('reports.aging.days1to30'), t('reports.aging.days31to60'), t('reports.aging.days61to90'), t('reports.aging.days90plus')
          ],
          rows: [...customerRows, ...supplierRows]
        }
      }
      case 'customerLedger':
      case 'supplierLedger': {
        const d = reportData as (CustomerLedgerReport | SupplierLedgerReport)
        return {
          headers: [t('common.date'), t('reports.col.referenceType'), t('reports.col.referenceId'), `${t('common.debit')} (${currencySymbol})`, `${t('common.credit')} (${currencySymbol})`, `${t('common.balance')} (${currencySymbol})`, t('reports.col.remarks')],
          rows: d.rows.map(r => [formatDate(r.date), r.referenceType, r.referenceId, r.debitAmount, r.creditAmount, r.balance, r.remarks])
        }
      }
      case 'profitAndLoss': {
        const d = reportData as ProfitAndLossReport
        return {
          headers: [t('reports.col.category'), `${t('common.amount')} (${currencySymbol})`],
          rows: [
            [t('reports.summary.revenue'), d.summary.revenue],
            [t('reports.summary.cogs'), -d.summary.cogs],
            [t('reports.summary.grossProfit'), d.summary.grossProfit],
            ...d.expensesByCategory.map(c => [c.category, -c.amount]),
            [t('reports.summary.totalExpenses'), -d.summary.totalExpenses],
            [t('reports.summary.netProfit'), d.summary.netProfit],
          ]
        }
      }
      case 'cashBook': {
        const d = reportData as CashBookReport
        return {
          headers: [t('common.date'), t('reports.col.description'), t('reports.col.method'), `${t('reports.col.in')} (${currencySymbol})`, `${t('reports.col.out')} (${currencySymbol})`, `${t('common.balance')} (${currencySymbol})`],
          rows: [
            [t('reports.col.openingBalance'), '', '', '', '', d.openingBalance],
            ...d.entries.map(e => [formatDate(e.date), e.description, e.paymentMethod, e.type === 'IN' ? e.amount : '', e.type === 'OUT' ? e.amount : '', e.runningBalance]),
            [t('reports.col.closingBalance'), '', '', d.totalIn, d.totalOut, d.closingBalance],
          ]
        }
      }
      case 'trialBalance': {
        const d = reportData as TrialBalanceReport
        return {
          headers: [t('reports.col.account'), `${t('common.debit')} (${currencySymbol})`, `${t('common.credit')} (${currencySymbol})`],
          rows: [
            ...d.rows.map(r => [r.account, r.debit || '', r.credit || '']),
            [t('common.total'), d.totalDebit, d.totalCredit],
          ]
        }
      }
      case 'expenses': {
        const d = reportData as ExpenseReport
        return {
          headers: [t('common.date'), t('reports.col.expense'), t('reports.col.category'), t('reports.col.paymentMethod'), `${t('common.amount')} (${currencySymbol})`, t('reports.col.remarks'), t('reports.col.recordedBy')],
          rows: d.rows.map(r => [r.date, r.expenseName, r.category, r.paymentMethod, r.amount, r.remarks, r.recordedBy])
        }
      }
      case 'audit': {
        const d = reportData as AuditReport
        return {
          headers: [t('common.date'), t('reports.col.user'), t('reports.col.action'), t('reports.col.entityType'), t('reports.col.entityId'), t('common.details')],
          rows: d.rows.map(r => [formatDate(r.date), r.user, r.action, r.entityType, r.entityId, r.details])
        }
      }
      case 'backup': {
        const backups = (reportData as { backupName?: string; backupDate?: string; backupSize?: number; backupVersion?: string; schemaVersion?: string; isValid?: boolean }[]) ?? []
        return {
          headers: [t('reports.col.backupName'), t('common.date'), t('reports.col.sizeBytes'), t('reports.col.version'), t('reports.col.schema'), t('reports.col.valid')],
          rows: backups.map(b => [b.backupName ?? '—', b.backupDate ? formatDate(b.backupDate) : '—', b.backupSize ?? 0, b.backupVersion ?? '—', b.schemaVersion ?? '—', b.isValid == null ? '—' : yn(b.isValid)])
        }
      }
      case 'foodCost': {
        const d = reportData as FoodCostReport
        return {
          headers: [t('reports.col.ingredient'), t('common.unit'), t('reports.col.qtyUsed'), t('reports.col.costPrice'), t('reports.col.totalCost')],
          rows: d.rows.map(r => [r.ingredientName, r.unit, r.totalQuantityUsed, r.costPrice, r.totalCost])
        }
      }
      case 'dishContributionMargin': {
        const d = reportData as DishContributionMarginReport
        return {
          headers: [t('reports.col.dishName'), t('reports.col.qtySold'), t('reports.col.revenue'), t('reports.col.ingredientCost'), t('reports.col.contributionMargin'), t('reports.col.marginPercent')],
          rows: d.rows.map(r => [r.productName, r.quantitySold, r.revenue, r.ingredientCost, r.contributionMargin, `${r.marginPercent}%`])
        }
      }
      case 'tableTurnoverByHour': {
        const d = reportData as TableTurnoverByHourReport
        const nonZero = d.cells.filter(c => c.count > 0)
        return {
          headers: [t('reports.col.dayOfWeek'), t('reports.col.hour'), t('reports.col.turns')],
          rows: nonZero.map(c => [weekdayLabel(c.dayOfWeek, i18n.language), c.hour, c.count])
        }
      }
      case 'recipeWasteVariance': {
        const d = reportData as RecipeWasteVarianceReport
        return {
          headers: [t('reports.col.ingredient'), t('common.unit'), t('reports.col.impliedQuantity'), t('reports.col.actualQuantity'), t('reports.col.varianceQuantity'), t('reports.col.variancePercent')],
          rows: d.rows.map(r => [r.ingredientName, r.unit, r.impliedQuantity, r.actualQuantity, r.varianceQuantity, r.variancePercent !== null ? `${r.variancePercent}%` : '—'])
        }
      }
      case 'deadStockClearance': {
        const d = reportData as DeadStockClearanceReport
        return {
          headers: [t('reports.col.product'), t('reports.col.sku'), t('reports.col.stock'), t('reports.col.unitCost'), t('reports.col.capitalLocked'), t('reports.col.lastSoldDate')],
          rows: d.rows.map(r => [r.productName, r.sku ?? '—', r.currentStock, r.unitCost, r.capitalLocked, r.lastSoldDate ?? t('reports.col.neverSold')])
        }
      }
      case 'categorySellThrough': {
        const d = reportData as CategorySellThroughReport
        return {
          headers: [t('reports.col.month'), t('reports.col.category'), t('reports.col.unitsSold'), t('reports.col.stock'), t('reports.col.sellThroughRate')],
          rows: d.rows.map(r => [r.month, r.categoryName, r.unitsSold, r.currentStock, `${r.sellThroughRate}%`])
        }
      }
      case 'seasonSellThrough': {
        const d = reportData as SeasonSellThroughReport
        return {
          headers: [t('reports.col.month'), t('reports.col.season'), t('reports.col.unitsSold'), t('reports.col.stock'), t('reports.col.sellThroughRate')],
          rows: d.rows.map(r => [r.month, r.season, r.unitsSold, r.currentStock, `${r.sellThroughRate}%`])
        }
      }
      case 'sizeStyleHeatmap': {
        const d = reportData as SizeStyleHeatmapReport
        return {
          headers: [t('reports.col.style'), t('reports.col.size'), t('reports.col.unitsSold')],
          rows: d.cells.map(c => [c.style, c.size, c.unitsSold])
        }
      }
      case 'sizeAvailabilityHeatmap': {
        const d = reportData as SizeAvailabilityHeatmapReport
        return {
          headers: [t('reports.col.style'), t('reports.col.size'), t('reports.col.stock'), t('reports.col.status')],
          rows: d.cells.map(c => [c.style, c.size, c.stockQty, c.status])
        }
      }
      case 'seasonalReorderCalendar': {
        const d = reportData as SeasonalCalendarEntry[]
        return {
          headers: [t('reports.col.season'), t('reports.col.status'), t('reports.col.nextStartDate'), t('reports.col.reorderByDate'), t('reports.col.lowStockCount')],
          rows: d.map(e => [e.name, e.status, e.nextStartDate, e.reorderByDate, e.lowOrOutOfStockCount])
        }
      }
      case 'basketComposition': {
        const d = reportData as BasketCompositionReport
        return {
          headers: [t('reports.col.productA'), t('reports.col.productB'), t('reports.col.basketCount')],
          rows: d.rows.map(r => [r.productAName, r.productBName, r.basketCount])
        }
      }
      case 'categoryMix': {
        const d = reportData as CategoryMixReport
        return {
          headers: [t('reports.col.category'), t('reports.col.unitsSold'), t('reports.col.revenue'), t('reports.col.revenuePercent')],
          rows: d.rows.map(r => [r.categoryName, r.unitsSold, r.revenue, `${r.revenuePercent}%`])
        }
      }
      case 'vendorMargin': {
        const d = reportData as VendorMarginReport
        return {
          headers: [t('reports.col.supplier'), t('reports.col.revenue'), t('reports.summary.cogs'), t('reports.col.margin'), t('reports.col.marginPercent')],
          rows: d.rows.map(r => [r.supplierName, r.revenue, r.cogs, r.margin, `${r.marginPercent}%`])
        }
      }
      case 'brandMarginReturnRate': {
        const d = reportData as BrandMarginReturnRateReport
        return {
          headers: [t('reports.col.supplier'), t('reports.col.margin'), t('reports.col.marginPercent'), t('reports.col.unitsSold'), t('reports.col.unitsReturned'), t('reports.col.returnRatePercent')],
          rows: d.rows.map(r => [r.supplierName, r.margin, `${r.marginPercent}%`, r.unitsSold, r.unitsReturned, `${r.returnRatePercent}%`])
        }
      }
      case 'fastSlowMoverMatrix': {
        const d = reportData as FastSlowMoverMatrixReport
        return {
          headers: [t('reports.col.product'), t('reports.col.sku'), t('reports.col.unitsSold'), t('reports.col.velocity'), t('reports.col.marginPercent'), t('reports.col.quadrant')],
          rows: d.rows.map(r => [r.productName, r.sku ?? '—', r.quantitySold, r.velocity, `${r.marginPercent}%`, t(`reports.val.quadrant.${r.quadrant}`)])
        }
      }
      case 'gstr1': {
        const d = reportData as GSTR1Report
        const b2bRows = d.b2b.map(r => ['B2B', r.gstin, r.receiverName, r.invoiceNumber, r.invoiceDate, r.invoiceValue, r.placeOfSupply, r.taxableValue, r.igstAmount, r.cgstAmount, r.sgstAmount, r.rate])
        const b2csRows = d.b2cs.map(r => ['B2CS', '', '', '', '', '', r.placeOfSupply, r.taxableValue, r.igstAmount, r.cgstAmount, r.sgstAmount, r.rate])
        return {
          headers: [t('reports.col.type'), t('reports.col.gstin'), t('reports.col.party'), t('reports.col.invoiceNo'), t('common.date'), t('reports.col.value'), t('reports.col.placeOfSupply'), t('reports.col.taxableShort'), 'IGST', 'CGST', 'SGST', t('reports.col.rateShort')],
          rows: [...b2bRows, ...b2csRows]
        }
      }
      case 'hsnSummary': {
        const d = reportData as HSNSummaryReport
        const b2bRows = d.b2b.map(r => ['B2B', r.hsnCode, r.description, r.uqc, r.totalQuantity, r.totalValue, r.taxableValue, r.igstAmount, r.cgstAmount, r.sgstAmount])
        const b2cRows = d.b2c.map(r => ['B2C', r.hsnCode, r.description, r.uqc, r.totalQuantity, r.totalValue, r.taxableValue, r.igstAmount, r.cgstAmount, r.sgstAmount])
        return {
          headers: [t('reports.col.type'), t('reports.col.hsnCode'), t('common.description'), t('reports.col.uqc'), t('reports.col.qty'), t('reports.col.value'), t('reports.col.taxableShort'), 'IGST', 'CGST', 'SGST'],
          rows: [...b2bRows, ...b2cRows]
        }
      }
      case 'documentSummary': {
        const d = reportData as DocumentSummaryReport
        return {
          headers: [t('reports.col.documentType'), t('reports.col.series'), t('reports.col.fromNumber'), t('reports.col.toNumber'), t('reports.col.totalCount'), t('reports.col.cancelledCount')],
          rows: d.rows.map(r => [r.documentType, r.seriesPrefix, r.fromNumber, r.toNumber, r.totalCount, r.cancelledCount])
        }
      }
      case 'gstr3bPreview': {
        const d = reportData as GSTR3BPreview
        return {
          headers: [t('reports.col.item'), t('reports.col.value')],
          rows: [
            [t('reports.section.table31Taxable'), d.table31.taxableOutwardSupplies],
            [t('reports.section.table31ZeroRated'), d.table31.zeroRatedSupplies],
            [t('reports.section.table31Exempt'), d.table31.exemptNilNonGstSupplies],
            ['IGST', d.table31.taxAmount.igst],
            ['CGST', d.table31.taxAmount.cgst],
            ['SGST', d.table31.taxAmount.sgst],
            [t('reports.section.table31dTaxableValue'), d.table31d.taxableValue],
            [t('reports.section.table31dTax'), d.table31d.taxAmount],
            ...d.table32.map(r => [`${t('reports.section.table32')}: ${r.state}`, r.taxableValue])
          ]
        }
      }
      case 'rentalStatus': {
        const d = reportData as RentalStatusReport
        return {
          headers: [t('rental.col.booking'), t('rental.col.customer'), t('rental.col.item'), t('rental.unitLabel'), t('rental.startDateTime'), t('rental.endDateTime'), t('common.status'), t('rental.daysOverdue')],
          rows: d.rows.map(r => [r.bookingNumber, r.customerName, r.productName, r.unitLabel ?? '—', formatDate(r.startDateTime), formatDate(r.endDateTime), r.isOverdue ? t('rental.status.OVERDUE') : t('rental.status.CHECKED_OUT'), r.daysOverdue])
        }
      }
      case 'rentalRevenue': {
        const d = reportData as RentalRevenueReport
        return {
          headers: [t('rental.col.item'), t('reports.col.bookingCount'), t('reports.col.value'), t('rental.utilization')],
          rows: d.rows.map(r => [r.productName, r.bookingCount, r.totalRevenue, r.utilizationPercent != null ? `${r.utilizationPercent.toFixed(0)}%` : '—'])
        }
      }
      case 'assetUtilization': {
        const d = reportData as AssetUtilizationReport
        return {
          headers: [t('rental.unitLabel'), t('rental.col.item'), t('common.status'), t('reports.col.rentedDays'), t('reports.col.availableDays'), t('rental.utilization')],
          rows: d.rows.map(r => [r.unitLabel, r.productName, t(`rental.status.${r.status}`), r.rentedDays, r.availableDays, `${r.utilizationPercent.toFixed(0)}%`])
        }
      }
      // Hotel/Lodge is a languageLock: 'en' business type (see
      // industry-template.service.ts) — plain English headers here render
      // identically to t()-wrapped ones would, since only English is ever
      // selectable for this vertical. Matches HotelRoomsScreen.tsx/
      // HotelBookingsScreen.tsx's own established choice.
      case 'hotelOccupancy': {
        const d = reportData as HotelOccupancyReport
        return {
          headers: ['Metric', 'Value'],
          rows: [
            ['Total Rooms', d.totalRooms], ['Occupied', d.occupied], ['Available', d.available],
            ['Cleaning', d.cleaning], ['Maintenance / Out of Order', d.maintenance], ['Occupancy %', d.occupancyPercent],
          ]
        }
      }
      case 'hotelGuestRegister': {
        const d = reportData as HotelGuestRegisterReport
        return {
          headers: ['Booking', 'Room', 'Guest Name', 'ID Type', 'ID Number', 'Nationality', 'Address', 'Check-In', 'Check-Out'],
          rows: d.rows.map(r => [r.bookingNumber, r.roomNumber, r.guestName, r.idType, r.idNumber, r.nationality, r.address ?? '—', formatDate(r.checkInDate), formatDate(r.checkOutDate)])
        }
      }
      case 'appointmentUtilisation': {
        const d = reportData as AppointmentUtilisationReport
        return {
          headers: [t('reports.col.apptNo'), t('common.date'), t('reports.col.time'), t('reports.col.customer'), t('reports.col.provider'), t('reports.col.service'), t('common.status'), t('reports.col.durationMin')],
          rows: d.rows.map(r => [r.appointmentNumber, r.date, r.time, r.customer, r.provider, r.service, r.status, r.durationMinutes])
        }
      }
      case 'clientRetention': {
        const d = reportData as ClientRetentionReport
        return {
          headers: [t('reports.col.customer'), t('common.phone'), t('reports.col.firstVisitEver'), t('reports.col.lastVisit'), t('reports.col.visitsInPeriod'), t('reports.col.newQ'), t('reports.col.atRiskQ')],
          rows: d.rows.map(r => [r.customerName, r.phone, r.firstVisitEver, r.lastVisit, r.visitsInPeriod, yn(r.isNew), yn(r.atRisk)])
        }
      }
      case 'commission': {
        const d = reportData as CommissionReport
        return {
          headers: [t('reports.col.staff'), t('reports.col.period'), t('reports.col.serviceRevenue'), t('reports.col.commission'), t('reports.col.tips'), t('reports.col.type'), t('reports.col.commissionRate'), t('reports.col.paidQ'), t('reports.col.paidDate')],
          rows: d.rows.map(r => [r.staffName, r.period, r.serviceRevenue, r.commissionAmount, r.tipAmount, r.commissionType, r.commissionRate, yn(r.isPaid), r.paidDate])
        }
      }
      case 'orderVolume': {
        const d = reportData as OrderVolumeReport
        return {
          headers: [t('common.date'), t('reports.col.tableLabel'), t('common.status'), t('reports.col.itemCount'), t('reports.col.resolvedAt')],
          rows: d.rows.map(r => [r.createdAt, r.tableLabel, r.status, r.itemCount, r.resolvedAt])
        }
      }
      case 'discounts': {
        const d = reportData as DiscountReport
        return {
          headers: [t('reports.col.invoiceNo'), t('common.date'), t('reports.col.customer'), t('reports.col.product'), t('reports.col.quantity'), t('reports.col.lineGross'), t('reports.col.discountGiven'), t('reports.col.discountPercent'), t('reports.col.staff')],
          rows: d.rows.map(r => [r.invoiceNumber, r.date, r.customer ?? '', r.productName, r.quantity, r.lineGross, r.discountAmount, r.discountPercent, r.staffName ?? ''])
        }
      }
      case 'purchaseRegister': {
        const d = reportData as PurchaseRegisterReport
        return {
          headers: [t('reports.col.billNumber'), t('common.date'), t('reports.col.supplier'), t('common.status'), t('reports.col.itemCount'), t('billing.subtotal'), t('reports.col.discountGiven'), t('billing.tax'), t('common.total')],
          rows: d.rows.map(r => [r.billNumber, r.date, r.supplier, r.status, r.itemCount, r.subtotal, r.discountAmount, r.taxAmount, r.totalAmount])
        }
      }
      case 'purchasesByVendor': {
        const d = reportData as PurchasesByVendorReport
        return {
          headers: [t('reports.col.supplier'), t('reports.col.billCount'), t('common.total')],
          rows: d.rows.map(r => [r.supplierName, r.billCount, r.totalAmount])
        }
      }
      case 'purchasesByItem': {
        const d = reportData as PurchasesByItemReport
        return {
          headers: [t('reports.col.item'), t('reports.col.type'), t('reports.col.quantity'), t('common.total')],
          rows: d.rows.map(r => [r.itemName, r.isService ? t('reports.col.service') : t('reports.col.product'), r.quantity, r.totalAmount])
        }
      }
      case 'apAging': {
        const d = reportData as ApAgingReport
        return {
          headers: [t('reports.col.supplier'), t('common.phone'), t('reports.col.payable'), t('reports.aging.current'), t('reports.aging.d1to30Short'), t('reports.aging.d31to60Short'), t('reports.aging.d61to90Short'), t('reports.aging.d90plusShort')],
          rows: d.rows.map(r => [r.supplierName, r.phone ?? '', r.outstanding, r.aging.current, r.aging.days1to30, r.aging.days31to60, r.aging.days61to90, r.aging.days90plus])
        }
      }
      case 'costCentreTreemap': {
        const d = reportData as CostCentreTreemapReport
        return {
          headers: [t('costCentres.title'), `${t('reports.summary.totalRevenue')} (${currencySymbol})`, `${t('reports.col.expense')} (${currencySymbol})`, `${t('reports.col.margin')} (${currencySymbol})`],
          rows: d.rows.map(r => [r.costCentreName, r.revenue, r.expense, r.margin])
        }
      }
      case 'budgetVsActual': {
        const d = reportData as BudgetVsActualReport
        return {
          headers: [t('budgets.scope'), `${t('budgets.budgeted')} (${currencySymbol})`, `${t('budgets.actual')} (${currencySymbol})`, `${t('budgets.variance')} (${currencySymbol})`],
          rows: d.rows.map(r => [`${r.costCentreName ?? t('budgets.wholeCompany')}${r.accountName ? ` / ${r.accountName}` : ''}`, r.budgeted, r.actual, r.variance])
        }
      }
      case 'statutoryComplianceSummary': {
        const d = reportData as StatutoryComplianceSummaryReport
        return {
          headers: [t('reports.col.deductionName'), `${t('common.amount')} (${currencySymbol})`, t('reports.col.employeeCount')],
          rows: d.rows.map(r => [r.name, r.totalAmount, r.employeeCount])
        }
      }
      case 'cashFlowProjection': {
        const d = reportData as CashFlowProjectionReport
        return {
          headers: [t('common.date'), `${t('reports.col.actual')} (${currencySymbol})`, `${t('reports.col.projected')} (${currencySymbol})`],
          rows: d.days.map(b => [b.date, b.actualNet ?? '', b.projectedNet ?? ''])
        }
      }
      case 'cashPositionTrend': {
        const d = reportData as CashPositionTrendReport
        return {
          headers: [t('common.date'), `${t('reports.col.balance')} (${currencySymbol})`],
          rows: d.points.map(p => [p.date, p.balance])
        }
      }
      case 'paymentPerformance': {
        const d = reportData as PaymentPerformanceReport
        return {
          headers: [t('reports.col.customer'), t('reports.col.paidInvoiceCount'), t('reports.col.avgDaysToPay'), t('reports.col.outstandingInvoiceCount'), `${t('reports.col.outstanding')} (${currencySymbol})`],
          rows: d.rows.map(r => [r.customerName, r.paidInvoiceCount, r.avgDaysToPay ?? '', r.outstandingInvoiceCount, r.outstandingAmount])
        }
      }
      case 'batchExpiry': {
        const d = reportData as BatchExpiryReport
        return {
          headers: [t('reports.col.product'), t('reports.col.batchNumber'), t('reports.col.expiryDate'), t('reports.col.daysToExpiry'), t('reports.col.quantityRemaining'), t('reports.col.bucket'), t('reports.col.supplier')],
          rows: d.rows.map(r => [r.productName, r.batchNumber, r.expiryDate, r.daysToExpiry, r.quantityRemaining, r.bucket, r.supplierName])
        }
      }
      case 'labThroughput': {
        const d = reportData as LabThroughputReport
        return {
          headers: [t('reports.col.orderNumber'), t('reports.col.patientName'), t('common.status'), t('reports.col.createdDate'), t('reports.col.reportedDate'), t('reports.col.turnaround')],
          rows: d.rows.map(r => [r.orderNumber, r.patientName, r.status, r.createdAt, r.reportedAt, r.turnaroundHours])
        }
      }
      case 'bloodStock': {
        const d = reportData as BloodStockReport
        return {
          headers: [t('reports.col.donationNumber'), t('reports.col.bloodGroup'), t('reports.col.componentType'), t('reports.col.expiryDate'), t('reports.col.daysToExpiry'), t('reports.col.expiringSoonQ')],
          rows: d.rows.map(r => [r.donationNumber, r.bloodGroup, r.componentType, r.expiryDate, r.daysToExpiry, yn(r.isExpiringSoon)])
        }
      }
      case 'donationToIssueCycleTime': {
        const d = reportData as DonationToIssueCycleTimeReport
        return {
          headers: [t('reports.col.componentType'), t('reports.col.unitCount'), t('reports.col.avgDays'), t('reports.col.minDays'), t('reports.col.maxDays')],
          rows: d.byComponent.map(r => [r.componentType, r.unitCount, r.avgDays, r.minDays, r.maxDays])
        }
      }
      case 'jewellery': {
        const d = reportData as JewelleryReport
        return {
          headers: [t('jewellery.metalType'), t('jewellery.purity'), t('reports.col.netWeightGrams'), t('reports.col.ratePerGram'), t('reports.col.valuation')],
          rows: d.stockByMetal.map(r => [r.metalType, r.purity, r.netWeightGrams, r.ratePerGram, r.valuationAmount])
        }
      }
      case 'makingChargeMargin': {
        const d = reportData as MakingChargeMarginReport
        return {
          headers: [t('reports.col.invoiceNumber'), t('reports.col.date'), t('reports.col.customer'), t('reports.col.metalValue'), t('reports.col.makingCharge'), t('reports.col.makingChargePercent')],
          rows: d.rows.map(r => [r.invoiceNumber, formatDate(r.invoiceDate), r.customerName, r.metalValue, r.makingCharge, `${r.makingChargePercent}%`])
        }
      }
      case 'hallmarkCompliance': {
        const d = reportData as HallmarkComplianceReport
        return {
          headers: [t('reports.col.item'), t('jewellery.metalType'), t('jewellery.purity'), t('jewellery.hallmarkNumber'), t('common.status')],
          rows: d.rows.map(r => [r.productName, r.metalType, r.purity, r.hallmarkNumber ?? '—', r.compliant ? t('reports.col.compliant') : t('reports.col.nonCompliant')])
        }
      }
      case 'metalRateVsSalesVolume': {
        const d = reportData as MetalRateVsSalesVolumeReport
        return {
          headers: [t('reports.col.month'), t('jewellery.ratePerGram'), t('reports.col.salesWeightGrams')],
          rows: d.rows.map(r => [r.month, r.avgRatePerGram ?? '—', r.salesWeightGrams])
        }
      }
      case 'purityAdjustedExchange': {
        const d = reportData as PurityAdjustedExchangeReport
        return {
          headers: [t('jewellery.metalType'), t('jewellery.purity'), t('reports.col.exchangeCount'), t('reports.col.rawWeightGrams'), t('reports.col.pureEquivalentGrams'), t('reports.col.value')],
          rows: d.byMetal.map(r => [r.metalType, r.purity, r.count, r.rawWeightGrams, r.pureEquivalentGrams, r.totalValueGiven])
        }
      }
      case 'projects': {
        const d = reportData as ProjectReport
        return {
          headers: [t('reports.col.projectTitle'), t('reports.col.client'), t('common.status'), t('reports.col.priority'), `${t('service.estimatedAmount')} (${currencySymbol})`, t('reports.col.startDate'), t('reports.col.dueDate')],
          rows: d.rows.map(r => [r.title, r.clientName, r.status, r.priority, r.estimatedAmount, r.startDate, r.dueDate])
        }
      }
      case 'serviceResolutionTime': {
        const d = reportData as ServiceResolutionTimeReport
        return {
          headers: [t('reports.col.category'), t('reports.col.ticketCount'), t('reports.col.avgHours'), t('reports.col.minHours'), t('reports.col.maxHours')],
          rows: d.rows.map(r => [r.category, r.ticketCount, r.avgHours, r.minHours, r.maxHours])
        }
      }
      case 'repeatBusinessRate': {
        const d = reportData as RepeatBusinessRateReport
        return {
          headers: [t('reports.col.month'), t('reports.col.newCustomers'), t('reports.col.repeatCustomers'), t('reports.col.repeatRatePercent')],
          rows: d.rows.map(r => [r.month, r.newCustomers, r.repeatCustomers, `${r.repeatRatePercent}%`])
        }
      }
      case 'consultantUtilization': {
        const d = reportData as ConsultantUtilizationReport
        return {
          headers: [t('reports.col.staffMember'), t('reports.col.billableHours'), t('reports.col.nonBillableHours'), t('reports.col.utilizationPercent')],
          rows: d.rows.map(r => [r.userName, r.billableHours, r.nonBillableHours, `${r.utilizationPercent}%`])
        }
      }
      case 'clientProfitability': {
        const d = reportData as ClientProfitabilityReport
        return {
          headers: [t('reports.col.client'), `${t('common.amount')} (${currencySymbol})`, t('reports.col.hoursSpent'), t('reports.col.revenuePerHour')],
          rows: d.rows.map(r => [r.customerName, r.revenue, r.hoursSpent, r.revenuePerHour])
        }
      }
      case 'jobCardTurnaroundByTechnician': {
        const d = reportData as JobCardTurnaroundByTechnicianReport
        return {
          headers: [t('reports.col.technician'), t('reports.col.jobCount'), t('reports.col.avgHours'), t('reports.col.minHours'), t('reports.col.maxHours')],
          rows: d.rows.map(r => [r.technicianName, r.jobCount, r.avgTurnaroundHours, r.fastestHours, r.slowestHours])
        }
      }
      case 'repairCategoryVolumeTrend': {
        const d = reportData as RepairCategoryVolumeTrendReport
        return {
          headers: [t('reports.col.month'), t('reports.col.category'), t('reports.col.jobCount')],
          rows: d.rows.map(r => [r.month, r.category, r.count])
        }
      }
      case 'fieldRepLeaderboard': {
        const d = reportData as FieldRepLeaderboardReport
        return {
          headers: [t('reports.col.repName'), t('reports.col.ordersBooked'), `${t('common.amount')} (${currencySymbol})`, t('reports.col.customersVisited'), t('reports.col.plannedStops'), t('reports.col.hitRatePercent')],
          rows: d.rows.map(r => [r.repName, r.ordersBooked, r.totalValue.toFixed(2), r.distinctCustomersVisited, r.plannedStops ?? '—', r.hitRatePercent !== null ? `${r.hitRatePercent}%` : '—'])
        }
      }
      case 'stylistRepeatClient': {
        const d = reportData as StylistRepeatClientReport
        return {
          headers: [t('reports.col.stylist'), t('reports.col.totalClients'), t('reports.col.repeatClients'), t('reports.col.repeatRatePercent')],
          rows: d.rows.map(r => [r.providerName, r.totalClients, r.repeatClients, `${r.repeatRatePercent}%`])
        }
      }
      case 'retailAttachRate': {
        const d = reportData as RetailAttachRateReport
        return {
          headers: [t('reports.col.stylist'), t('reports.col.totalInvoices'), t('reports.col.withAttach'), t('reports.col.attachRatePercent')],
          rows: d.byProvider.map(r => [r.providerName, r.totalInvoices, r.withAttach, `${r.attachRatePercent}%`])
        }
      }
      case 'membershipRenewalFunnel': {
        const d = reportData as MembershipRenewalFunnelReport
        return {
          headers: [t('reports.col.planName'), t('reports.col.expiredCount'), t('reports.col.renewedCount'), t('reports.col.renewalRatePercent')],
          rows: d.rows.map(r => [r.planName, r.expiredCount, r.renewedCount, `${r.renewalRatePercent}%`])
        }
      }
      case 'classAttendanceHeatmap': {
        const d = reportData as ClassAttendanceHeatmapReport
        return {
          headers: [t('reports.col.className'), t('reports.col.dayOfWeek'), t('reports.col.checkInCount')],
          rows: d.cells.map(c => [c.className, c.dayOfWeek, c.checkInCount])
        }
      }
      case 'learnerProgressFunnel': {
        const d = reportData as LearnerProgressFunnelReport
        return {
          headers: [t('reports.col.stage'), t('reports.col.learnerCount')],
          rows: d.stages.map(s => [s.stage, s.learnerCount])
        }
      }
      case 'serviceProjects': {
        const d = reportData as ServiceProjectReport
        return {
          headers: [t('reports.col.projectName'), t('reports.col.client'), t('common.status'), t('reports.col.projectType'), `${t('common.amount')} (${currencySymbol})`, t('reports.col.startDate'), t('reports.col.expectedEndDate')],
          rows: d.rows.map(r => [r.projectName, r.clientName, r.status, r.projectType, r.totalContractValue, r.startDate, r.expectedEndDate])
        }
      }
      case 'jobCards': {
        const d = reportData as JobCardReport
        return {
          headers: [t('reports.col.jobNumber'), t('common.description'), t('reports.col.customer'), t('common.status'), t('reports.col.priority'), t('reports.col.estimatedCost'), t('reports.col.actualCost'), t('reports.col.receivedDate')],
          rows: d.rows.map(r => [r.jobNumber, r.title, r.customerName, r.status, r.priority, r.estimatedCost, r.actualCost, r.receivedDate])
        }
      }
      case 'carJobCards': {
        const d = reportData as CarJobCardReport
        return {
          headers: ['Job #', t('reports.col.customer'), 'Vehicle #', 'Make', 'Model', t('common.status'), 'Labor', 'Parts', 'Created'],
          rows: d.rows.map(r => [r.jobNumber, r.customerName, r.vehicleNumber, r.vehicleMake, r.vehicleModel, r.status, r.laborTotal, r.partsTotal, r.createdAt])
        }
      }
      case 'tailoringOrders': {
        const d = reportData as TailoringOrderReport
        return {
          headers: ['Order #', t('reports.col.customer'), 'Garment Type', t('common.status'), 'Qty', t('common.amount')],
          rows: d.rows.map(r => [r.orderNumber, r.customerName, r.garmentType, r.status, r.quantity, r.totalAmount])
        }
      }
      case 'pestContracts': {
        const d = reportData as PestContractReport
        return {
          headers: ['Contract #', t('reports.col.customer'), 'Pest Types', 'Expires', 'Days Until Expiry'],
          rows: d.expiring.map(r => [r.contractNumber, r.customerName, r.pestTypes.join(', '), r.endDate, r.daysUntilExpiry])
        }
      }
      case 'realEstatePipeline': {
        const d = reportData as RealEstatePipelineReport
        return {
          headers: ['Property', 'Buyer', 'Seller', 'Deal Value', 'Brokerage', t('common.status'), t('common.date')],
          rows: d.deals.map(r => [r.propertyLocation, r.buyerName, r.sellerName, r.dealValue, r.brokerageAmount, r.status, r.createdAt])
        }
      }
      case 'retainers': {
        const d = reportData as RetainerReport
        return {
          headers: ['Title', t('reports.col.client'), t('common.status'), 'Monthly Amount', 'Billed This Period'],
          rows: d.rows.map(r => [r.title, r.clientName, r.status, r.monthlyAmount, r.billedThisPeriod ? 'Yes' : 'No'])
        }
      }
      case 'shootBookings': {
        const d = reportData as ShootBookingReport
        return {
          headers: [t('reports.col.client'), 'Shoot Type', 'Shoot Date', t('common.status'), t('common.amount')],
          rows: d.rows.map(r => [r.clientName, r.shootType, r.shootDate, r.status, r.finalAmount])
        }
      }
      case 'eventBookings': {
        const d = reportData as EventBookingReport
        return {
          headers: [t('reports.col.client'), 'Event Name', 'Event Type', 'Event Date', t('common.status'), t('common.amount')],
          rows: d.rows.map(r => [r.clientName, r.eventName, r.eventType, r.eventDate, r.status, r.finalAmount])
        }
      }
      case 'placements': {
        const d = reportData as PlacementReport
        return {
          headers: ['Placement #', 'Candidate', 'Job Title', t('reports.col.client'), t('common.status'), 'Joining Date', 'Offered Salary', 'Commission'],
          rows: d.rows.map(r => [r.placementNumber, r.candidateName, r.jobTitle, r.clientName, r.status, r.joiningDate, r.offeredSalary, r.commissionAmount])
        }
      }
      case 'drawingRegister': {
        const d = reportData as DrawingRegisterReport
        return {
          headers: ['Drawing #', 'Title', 'Project', 'Discipline', 'Revision', t('common.status'), 'Issued Date'],
          rows: d.rows.map(r => [r.drawingNumber, r.title, r.projectName, r.discipline, r.revisionNumber, r.status, r.issuedDate])
        }
      }
      case 'prescriptionDrugSales': {
        const d = reportData as PrescriptionDrugSalesReport
        return {
          headers: ['Invoice #', 'Invoice Date', 'Product', 'Qty', 'Patient', 'Doctor', 'Prescription Date', t('reports.col.customer'), t('common.amount')],
          rows: d.rows.map(r => [r.invoiceNumber, r.invoiceDate, r.productName, r.quantity, r.patientName, r.doctorName, r.prescriptionDate, r.customerName, r.lineTotal])
        }
      }
      case 'scheduleH1XRegister': {
        const d = reportData as ScheduleH1XRegisterReport
        return {
          headers: ['Invoice #', 'Invoice Date', 'Product', 'Qty', 'Patient', 'Doctor', 'Prescription Date', t('reports.col.customer')],
          rows: d.rows.map(r => [r.invoiceNumber, r.invoiceDate, r.productName, r.quantity, r.patientName, r.doctorName, r.prescriptionDate, r.customerName])
        }
      }
      case 'schemeCostVsVolume': {
        const d = reportData as SchemeCostVsVolumeReport
        return {
          headers: [t('reports.col.schemeName'), t('reports.col.ruleType'), t('reports.col.focUnitsGiven'), t('common.amount')],
          rows: d.rows.map(r => [r.schemeName, r.ruleType, r.focUnitsGiven, r.totalCost])
        }
      }
      case 'chronicRecallCompliance': {
        const d = reportData as ChronicRecallComplianceReport
        return {
          headers: [t('reports.col.condition'), t('reports.col.recallsClosed'), t('reports.col.onTime'), t('reports.col.compliancePercent')],
          rows: d.byCondition.map(r => [r.conditionName, r.total, r.onTime, `${r.percent}%`])
        }
      }
      case 'walkInVsAppointmentRatio': {
        const d = reportData as WalkInVsAppointmentRatioReport
        return {
          headers: [t('common.date'), t('reports.col.walkIns'), t('reports.col.appointments')],
          rows: d.byDay.map(r => [r.date, r.walkIns, r.appointments])
        }
      }
      case 'diagnosisCategoryTrend': {
        const d = reportData as DiagnosisCategoryTrendReport
        return {
          headers: [t('reports.col.month'), ...d.categories],
          rows: d.byMonth.map(r => [r.month, ...d.categories.map(c => r[c] ?? 0)])
        }
      }
      case 'referralOutcome': {
        const d = reportData as ReferralOutcomeReport
        return {
          headers: [t('reports.col.patientName'), t('reports.col.referredTo'), t('common.date'), t('common.status'), t('reports.col.outcome')],
          rows: d.rows.map(r => [r.patientName, r.referredToProviderName ?? '—', r.scheduledDate, r.status, r.outcomeSummary ?? '—'])
        }
      }
      case 'packUtilization': {
        const d = reportData as PackUtilizationReport
        return {
          headers: [t('reports.col.customer'), t('reports.col.packName'), t('reports.col.totalSessions'), t('reports.col.usedSessions'), t('reports.col.remainingSessions'), t('reports.col.utilization')],
          rows: d.rows.map(r => [r.customerName, r.packName, r.totalSessions, r.usedSessions, r.remainingSessions, `${r.utilizationPercent}%`])
        }
      }
      case 'labTAT': {
        const d = reportData as LabTATReport
        return {
          headers: [t('reports.col.testName'), t('reports.col.category'), t('reports.col.orders'), t('reports.col.avgActualTAT'), t('reports.col.targetTAT'), t('reports.col.onTimePercent')],
          rows: d.rows.map(r => [r.testName, r.category ?? '—', r.ordersCount, `${r.avgActualTATHours}h`, r.targetTATHours != null ? `${r.targetTATHours}h` : '—', r.targetTATHours != null ? `${r.onTimePercent}%` : '—'])
        }
      }
      case 'testVolumeByPanel': {
        const d = reportData as TestVolumeByPanelReport
        return {
          headers: [t('reports.col.month'), ...d.panels],
          rows: d.byMonth.map(r => [r.month, ...d.panels.map(p => r[p] ?? 0)])
        }
      }
      case 'referralLeaderboard': {
        const d = reportData as ReferralLeaderboardReport
        return {
          headers: [t('reports.col.referrerName'), t('reports.col.referralCount')],
          rows: d.rows.map(r => [r.referrerName, r.count])
        }
      }
      case 'secondOpinionConversion': {
        const d = reportData as SecondOpinionConversionReport
        return {
          headers: [t('reports.col.patientName'), t('reports.col.visitDate'), t('reports.col.converted'), t('reports.col.nextVisitDate')],
          rows: d.rows.map(r => [r.patientName, r.visitDate, r.converted ? t('common.yes') : t('common.no'), r.nextVisitDate ?? '—'])
        }
      }
      case 'caseComplexityMix': {
        const d = reportData as CaseComplexityMixReport
        return {
          headers: [t('reports.col.month'), t('reports.col.routine'), t('reports.col.complex')],
          rows: d.byMonth.map(r => [r.month, r.ROUTINE, r.COMPLEX])
        }
      }
      case 'treatmentAcceptanceRate': {
        const d = reportData as TreatmentAcceptanceRateReport
        return {
          headers: [t('reports.col.stage'), t('reports.col.count')],
          rows: d.funnel.map(r => [r.stage, r.count])
        }
      }
      case 'dentalRecallCompliance': {
        const d = reportData as DentalRecallComplianceReport
        return {
          headers: [t('reports.col.recallType'), t('reports.col.recallsClosed'), t('reports.col.onTime'), t('reports.col.compliancePercent')],
          rows: d.byRecallType.map(r => [r.recallType, r.total, r.onTime, `${r.percent}%`])
        }
      }
      case 'vaccinationCompliance': {
        const d = reportData as VaccinationComplianceReport
        return {
          headers: [t('reports.col.vaccineName'), t('reports.col.doses'), t('reports.col.onTime'), t('reports.col.compliancePercent')],
          rows: d.byVaccine.map(r => [r.vaccineName, r.total, r.onTime, `${r.percent}%`])
        }
      }
      case 'vetCaseTypeVolume': {
        const d = reportData as VetCaseTypeVolumeReport
        return {
          headers: [t('reports.col.month'), ...d.caseTypes],
          rows: d.byMonth.map(r => [r.month, ...d.caseTypes.map(c => r[c] ?? 0)])
        }
      }
      case 'siteVisitLog': {
        const d = reportData as SiteVisitLogReport
        return {
          headers: ['Project', 'Visit Date', 'Visit Type', 'Recorded By', 'Findings'],
          rows: d.rows.map(r => [r.projectName, r.visitDate, r.visitType, r.recordedByName, r.findings])
        }
      }
      case 'logistics': {
        const d = reportData as LogisticsReport
        return {
          headers: [t('reports.col.month'), t('reports.col.shipmentCount'), t('reports.col.freightAmount')],
          rows: d.monthlyTrend.map(r => [r.month, r.count, r.freight])
        }
      }
      case 'attendance': {
        const d = reportData as AttendanceReport
        return {
          headers: [t('reports.col.employee'), t('common.date'), t('common.status'), t('reports.col.checkIn'), t('reports.col.checkOut')],
          rows: d.rows.map(r => [r.employeeName, r.date, r.status, r.checkIn, r.checkOut])
        }
      }
      case 'production': {
        const d = reportData as ProductionReport
        return {
          headers: [t('reports.col.orderNumber'), t('reports.col.product'), t('reports.col.plannedQty'), t('reports.col.producedQty'), t('common.status'), t('reports.col.startDate'), t('reports.col.completedDate')],
          rows: d.rows.map(r => [r.orderNumber, r.productName, r.plannedQty, r.producedQty, r.status, r.startDate, r.completedDate])
        }
      }
      case 'landedCostPerUnit': {
        const d = reportData as LandedCostPerUnitReport
        return {
          headers: [t('reports.col.product'), t('reports.col.producedQty'), t('reports.col.materialCostPerUnit'), t('reports.col.laborCostPerUnit'), t('reports.col.overheadCostPerUnit'), t('reports.col.totalCostPerUnit')],
          rows: d.rows.map(r => [r.productName, r.producedQty, fmt(r.materialCostPerUnit), fmt(r.laborCostPerUnit), fmt(r.overheadCostPerUnit), fmt(r.totalCostPerUnit)])
        }
      }
      case 'rejectionRateTrend': {
        const d = reportData as RejectionRateTrendReport
        return {
          headers: [t('reports.col.stage'), t('reports.col.qtyInspected'), t('reports.col.qtyRejected'), t('reports.col.rejectionRatePercent')],
          rows: d.byStage.map(r => [r.taskName, r.qtyInspected, r.qtyRejected, `${r.rejectionRatePercent}%`])
        }
      }
      case 'seasonalCreditExposure': {
        const d = reportData as SeasonalCreditExposureReport
        return {
          headers: [t('reports.col.month'), t('reports.col.outstandingAmount'), t('reports.col.invoiceCount')],
          rows: d.byMonth.map(r => [r.month, fmt(r.outstandingAmount), r.invoiceCount])
        }
      }
      case 'farmerRepayment': {
        const d = reportData as FarmerRepaymentReport
        return {
          headers: [t('reports.col.customer'), t('reports.col.totalPurchased'), t('reports.col.totalRepaid'), t('reports.col.outstandingBalance'), t('reports.col.repaymentRatePercent')],
          rows: d.rows.map(r => [r.customerName, fmt(r.totalPurchased), fmt(r.totalRepaid), fmt(r.outstandingBalance), `${r.repaymentRatePercent}%`])
        }
      }
      case 'serialWarranty': {
        const d = reportData as SerialWarrantyReport
        return {
          headers: [t('reports.col.serialNumber'), t('reports.col.product'), t('common.status'), t('reports.col.warrantyExpiry'), t('reports.col.daysToExpiry')],
          rows: d.rows.map(r => [r.serialNumber, r.productName, r.status, r.warrantyExpiryDate, r.daysToExpiry])
        }
      }
      case 'rmaAging': {
        const d = reportData as RmaAgingReport
        return {
          headers: [t('reports.col.claimNumber'), t('reports.col.product'), t('reports.col.supplier'), t('reports.col.daysWithVendor'), t('common.status')],
          rows: d.rows.map(r => [r.claimNumber, r.productName, r.vendorName ?? '—', r.daysWithVendor, r.isOverdue ? t('reports.val.overdue') : t('reports.val.onTrack')])
        }
      }
      case 'vendorRecoveryLedger': {
        const d = reportData as VendorRecoveryLedgerReport
        return {
          headers: [t('reports.col.claimNumber'), t('reports.col.product'), t('reports.col.supplier'), t('reports.col.claimedAmount'), t('reports.col.recoveredAmount'), t('reports.col.outstanding'), t('common.status')],
          rows: d.rows.map(r => [r.claimNumber, r.productName, r.vendorName ?? '—', r.claimedAmount, r.recoveredAmount, r.outstandingAmount, r.isClosed ? t('reports.val.closed') : t('reports.val.open')])
        }
      }
      case 'repairTurnaroundByTechnician': {
        const d = reportData as RepairTurnaroundByTechnicianReport
        return {
          headers: [t('reports.col.technician'), t('reports.col.ticketCount'), t('reports.col.avgTurnaroundDays'), t('reports.col.minTurnaroundDays'), t('reports.col.maxTurnaroundDays')],
          rows: d.rows.map(r => [r.technicianName, r.ticketCount, r.avgTurnaroundDays, r.minTurnaroundDays, r.maxTurnaroundDays])
        }
      }
      case 'variantStock': {
        const d = reportData as VariantStockReport
        return {
          headers: [t('reports.col.product'), t('reports.col.size'), t('reports.col.color'), t('reports.col.sku'), t('reports.col.stockQty')],
          rows: d.rows.map(r => [r.productName, r.size, r.color, r.sku, r.stockQty])
        }
      }
      case 'testScores': {
        const d = reportData as TestScoreReport
        return {
          headers: [t('reports.col.studentName'), t('reports.col.batchName'), t('reports.col.subject'), t('reports.col.testName'), t('reports.col.marksObtained'), t('reports.col.maxMarks'), t('reports.col.percentage'), t('reports.col.grade'), t('common.date')],
          rows: d.rows.map(r => [r.studentName, r.batchName, r.subject, r.testName, r.marksObtained, r.maxMarks, r.percentage, r.grade, r.testDate])
        }
      }
      case 'complianceTasks': {
        const d = reportData as ComplianceTaskReport
        return {
          headers: [t('reports.col.customer'), t('reports.col.title'), t('reports.col.category'), t('reports.col.dueDate'), t('reports.col.daysUntilDue'), t('common.status'), t('reports.col.priority')],
          rows: d.rows.map(r => [r.clientName, r.title, r.category, r.dueDate, r.daysUntilDue, r.status, r.priority])
        }
      }
      default: return { headers: [], rows: [] }
    }
  }

  async function handleExportCsv() {
    if (exporting) return
    setExporting(true)
    try {
      const { headers, rows } = buildExportData()
      const res = await window.api.export.toCsv({ filename: `${activeReport}-report.csv`, headers, rows })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setExporting(false)
    }
  }

  async function handleExportExcel() {
    if (exporting) return
    setExporting(true)
    try {
      const { headers, rows } = buildExportData()
      const res = await window.api.export.toExcel({
        filename: `${activeReport}-report.xlsx`,
        sheets: [{ name: def.label, headers, rows }]
      })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPdf() {
    if (exporting) return
    setExporting(true)
    try {
      const { headers, rows } = buildExportData()
      const summaryCards = getSummaryCards()
      const charts = getReportCharts()
      const res = await window.api.export.generateReportHtml({
        title: def.label,
        dateRange: def.requiresDateRange ? `${dateFrom} to ${dateTo}` : undefined,
        summaryCards,
        charts,
        tables: [{ headers, rows }],
        currencySymbol,
        reportPermission: def.permission
      })
      if (res.success && res.data) {
        const pdfRes = await window.api.export.toPdf({ html: res.data as string, filename: `${activeReport}-report.pdf` })
        if (!pdfRes.success) toastError(t('common.error'), pdfRes.error?.message ?? t('common.error'))
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setExporting(false)
    }
  }

  // Share Report via WhatsApp/Email — see
  // docs/FEATURE_SHARE_BILL_REPORT_WHATSAPP_EMAIL.md. Reports are PDF-only
  // for sharing (CSV/Excel export above stays available, unaffected) — a
  // spreadsheet has no meaningful "share as a message" reading experience
  // the way a PDF does.
  function reportDateRangeLabel(): string {
    return def.requiresDateRange ? `${dateFrom} to ${dateTo}` : t('reports.allTimeRange')
  }

  async function handleExportPdfForShare(): Promise<ExportPdfResult> {
    try {
      const { headers, rows } = buildExportData()
      const summaryCards = getSummaryCards()
      const charts = getReportCharts()
      const htmlRes = await window.api.export.generateReportHtml({
        title: def.label,
        dateRange: def.requiresDateRange ? `${dateFrom} to ${dateTo}` : undefined,
        summaryCards,
        charts,
        tables: [{ headers, rows }],
        currencySymbol,
        reportPermission: def.permission
      })
      if (!htmlRes.success || !htmlRes.data) return { success: false, error: htmlRes.error }
      const pdfRes = await window.api.export.toPdf({ html: htmlRes.data as string, filename: `${activeReport}-report.pdf` })
      if (!pdfRes.success) return { success: false, error: pdfRes.error }
      const data = pdfRes.data as { cancelled: boolean; filePath?: string }
      return { success: true, cancelled: data.cancelled, filePath: data.filePath }
    } catch {
      return { success: false, error: { message: t('common.error') } }
    }
  }

  // Reports have no single customer/supplier recipient — the ShareMenu here
  // opens with an empty To:/phone field the owner fills in themselves
  // (buildShareEmailLink/WhatsApp-with-no-phone already tolerate this by
  // design; no new special-case logic needed).
  function buildReportShareWhatsAppMessage(): string {
    return t('reports.shareWhatsAppMessage', { businessName, reportType: def.label, dateRange: reportDateRangeLabel() })
  }

  function buildReportShareEmailSubject(): string {
    return t('reports.shareEmailSubject', { reportType: def.label, businessName })
  }

  function buildReportShareEmailBody(): string {
    return t('reports.shareEmailBody', { reportType: def.label, businessName, dateRange: reportDateRangeLabel() })
  }

  function getSummaryCards(): { label: string; value: string }[] {
    if (!reportData) return []
    switch (activeReport) {
      case 'sales': {
        const d = reportData as SalesReport
        return [
          { label: t('reports.summary.totalRevenue'), value: fmt(d.summary.totalRevenue) },
          { label: t('reports.summary.totalInvoices'), value: String(d.summary.totalInvoices) },
          { label: t('reports.summary.totalTaxAmount'), value: fmt(d.summary.totalTax) },
          { label: t('reports.summary.avgOrderValue'), value: fmt(d.summary.averageOrderValue) }
        ]
      }
      case 'inventory': {
        const d = reportData as InventoryReport
        return [
          { label: t('reports.summary.totalProducts'), value: String(d.summary.totalProducts) },
          { label: t('reports.summary.stockValue'), value: fmt(d.summary.totalStockValue) },
          { label: t('reports.summary.lowStock'), value: String(d.summary.lowStockItems) },
          { label: t('reports.summary.outOfStock'), value: String(d.summary.outOfStockItems) }
        ]
      }
      case 'tax': {
        const d = reportData as TaxReport
        return [
          { label: t('reports.summary.totalTaxable'), value: fmt(d.summary.totalTaxableAmount) },
          { label: t('reports.summary.taxCollected'), value: fmt(d.summary.totalTaxCollected) }
        ]
      }
      case 'outstanding': {
        const d = reportData as OutstandingReport
        return [
          { label: t('reports.summary.customerOutstanding'), value: fmt(d.customers.totalOutstanding) },
          { label: t('reports.summary.supplierPayables'), value: fmt(d.suppliers.totalOutstanding) }
        ]
      }
      case 'profitAndLoss': {
        const d = reportData as ProfitAndLossReport
        return [
          { label: t('reports.summary.revenue'), value: fmt(d.summary.revenue) },
          { label: t('reports.summary.grossProfit'), value: `${fmt(d.summary.grossProfit)} (${d.summary.grossMarginPercent}%)` },
          { label: t('reports.summary.totalExpenses'), value: fmt(d.summary.totalExpenses) },
          { label: t('reports.summary.netProfit'), value: `${fmt(d.summary.netProfit)} (${d.summary.netMarginPercent}%)` }
        ]
      }
      case 'cashBook': {
        const d = reportData as CashBookReport
        return [
          { label: t('reports.col.openingBalance'), value: fmt(d.openingBalance) },
          { label: t('reports.col.in'), value: fmt(d.totalIn) },
          { label: t('reports.col.out'), value: fmt(d.totalOut) },
          { label: t('reports.col.closingBalance'), value: fmt(d.closingBalance) }
        ]
      }
      case 'trialBalance': {
        const d = reportData as TrialBalanceReport
        return [
          { label: t('common.debit'), value: fmt(d.totalDebit) },
          { label: t('common.credit'), value: fmt(d.totalCredit) }
        ]
      }
      case 'expenses': {
        const d = reportData as ExpenseReport
        return [
          { label: t('reports.summary.totalExpenses'), value: fmt(d.summary.totalAmount) },
          { label: t('reports.summary.records'), value: String(d.summary.expenseCount) }
        ]
      }
      case 'gstr1': {
        const d = reportData as GSTR1Report
        return [
          { label: t('reports.summary.b2bValue'), value: fmt(d.summary.totalB2BValue) },
          { label: t('reports.summary.b2csValue'), value: fmt(d.summary.totalB2CSValue) },
          { label: t('reports.summary.totalCgst'), value: fmt(d.summary.totalCgst) },
          { label: t('reports.summary.totalSgst'), value: fmt(d.summary.totalSgst) },
          { label: t('reports.summary.totalIgst'), value: fmt(d.summary.totalIgst) }
        ]
      }
      case 'hsnSummary': {
        const d = reportData as HSNSummaryReport
        return [
          { label: t('reports.summary.taxableValue'), value: fmt(d.summary.totalTaxableValue) },
          { label: t('reports.summary.totalTax'), value: fmt(d.summary.totalTax) },
          { label: t('reports.summary.hsnRows'), value: String(d.summary.rowCount) }
        ]
      }
      case 'documentSummary': {
        const d = reportData as DocumentSummaryReport
        const totalDocs = d.rows.reduce((s, r) => s + r.totalCount, 0)
        const totalCancelled = d.rows.reduce((s, r) => s + r.cancelledCount, 0)
        return [
          { label: t('reports.summary.totalDocuments'), value: String(totalDocs) },
          { label: t('reports.summary.cancelledDocuments'), value: String(totalCancelled) },
          { label: t('reports.summary.series'), value: String(d.rows.length) }
        ]
      }
      case 'gstr3bPreview': {
        const d = reportData as GSTR3BPreview
        return [
          { label: t('reports.section.table31Taxable'), value: fmt(d.table31.taxableOutwardSupplies) },
          { label: t('reports.summary.totalIgst'), value: fmt(d.table31.taxAmount.igst) },
          { label: t('reports.summary.totalCgst'), value: fmt(d.table31.taxAmount.cgst) },
          { label: t('reports.summary.totalSgst'), value: fmt(d.table31.taxAmount.sgst) }
        ]
      }
      case 'rentalStatus': {
        const d = reportData as RentalStatusReport
        return [
          { label: t('rental.summary.totalCheckedOut'), value: String(d.summary.totalCheckedOut) },
          { label: t('rental.status.OVERDUE'), value: String(d.summary.overdueCount) },
        ]
      }
      case 'rentalRevenue': {
        const d = reportData as RentalRevenueReport
        return [
          { label: t('reports.summary.totalRevenue'), value: fmt(d.summary.totalRevenue) },
          { label: t('reports.col.bookingCount'), value: String(d.summary.totalBookings) },
        ]
      }
      case 'assetUtilization': {
        const d = reportData as AssetUtilizationReport
        return [
          { label: t('reports.summary.totalUnits'), value: String(d.summary.totalUnits) },
          { label: t('rental.utilization'), value: `${d.summary.avgUtilizationPercent}%` },
          { label: t('reports.summary.idleUnitCount'), value: String(d.summary.idleUnitCount) },
        ]
      }
      case 'hotelOccupancy': {
        const d = reportData as HotelOccupancyReport
        return [
          { label: 'Total Rooms', value: String(d.totalRooms) },
          { label: 'Occupied', value: String(d.occupied) },
          { label: 'Available', value: String(d.available) },
          { label: 'Occupancy %', value: `${d.occupancyPercent}%` },
        ]
      }
      case 'hotelGuestRegister': {
        const d = reportData as HotelGuestRegisterReport
        return [{ label: 'Registered Guests', value: String(d.rows.length) }]
      }
      case 'appointmentUtilisation': {
        const d = reportData as AppointmentUtilisationReport
        return [
          { label: t('reports.summary.totalAppointments'), value: String(d.summary.total) },
          { label: t('reports.summary.completed'), value: String(d.summary.completed) },
          { label: t('reports.summary.cancelled'), value: String(d.summary.cancelled) },
          { label: t('reports.summary.noShows'), value: String(d.summary.noShow) },
        ]
      }
      case 'clientRetention': {
        const d = reportData as ClientRetentionReport
        return [
          { label: t('reports.summary.totalClients'), value: String(d.summary.totalUnique) },
          { label: t('reports.summary.newClients'), value: String(d.summary.newClients) },
          { label: t('reports.summary.returningClients'), value: String(d.summary.returningClients) },
          { label: t('reports.summary.retentionRate'), value: `${d.summary.retentionRate}%` },
        ]
      }
      case 'commission': {
        const d = reportData as CommissionReport
        return [
          { label: t('reports.summary.totalCommission'), value: fmt(d.summary.totalCommission) },
          { label: t('reports.summary.totalTips'), value: fmt(d.summary.totalTips) },
          { label: t('common.paid'), value: fmt(d.summary.paidAmount) },
          { label: t('common.unpaid'), value: fmt(d.summary.unpaidAmount) },
        ]
      }
      case 'orderVolume': {
        const d = reportData as OrderVolumeReport
        return [
          { label: t('reports.summary.totalOrders'), value: String(d.summary.totalOrders) },
          { label: t('reports.summary.accepted'), value: String(d.summary.accepted) },
          { label: t('reports.summary.rejected'), value: String(d.summary.rejected) },
          { label: t('reports.summary.pendingOrders'), value: String(d.summary.pending) }
        ]
      }
      case 'discounts': {
        const d = reportData as DiscountReport
        return [
          { label: t('reports.summary.totalDiscountGiven'), value: fmt(d.summary.totalDiscountGiven) },
          { label: t('reports.summary.discountedLines'), value: `${d.summary.discountedLineCount} / ${d.summary.totalLineCount}` },
          { label: t('reports.summary.discountIncidence'), value: `${d.summary.discountIncidencePercent}%` },
          { label: t('reports.summary.avgDiscountPercent'), value: `${d.summary.averageDiscountPercent}%` }
        ]
      }
      case 'purchaseRegister': {
        const d = reportData as PurchaseRegisterReport
        return [
          { label: t('reports.summary.totalPurchases'), value: fmt(d.summary.totalPurchases) },
          { label: t('reports.summary.billCount'), value: String(d.summary.billCount) },
          { label: t('billing.tax'), value: fmt(d.summary.totalTax) }
        ]
      }
      case 'purchasesByVendor': {
        const d = reportData as PurchasesByVendorReport
        return [
          { label: t('reports.summary.totalPurchases'), value: fmt(d.summary.totalPurchases) },
          { label: t('reports.summary.vendorCount'), value: String(d.summary.vendorCount) }
        ]
      }
      case 'purchasesByItem': {
        const d = reportData as PurchasesByItemReport
        return [
          { label: t('reports.summary.totalPurchases'), value: fmt(d.summary.totalPurchases) },
          { label: t('reports.summary.itemCount'), value: String(d.summary.itemCount) }
        ]
      }
      case 'apAging': {
        const d = reportData as ApAgingReport
        return [
          { label: t('reports.summary.supplierPayables'), value: fmt(d.summary.totalOutstanding) },
          { label: t('reports.col.count'), value: String(d.summary.count) }
        ]
      }
      case 'costCentreTreemap': {
        const d = reportData as CostCentreTreemapReport
        const totalRevenue = d.rows.reduce((s, r) => s + r.revenue, 0)
        const totalExpense = d.rows.reduce((s, r) => s + r.expense, 0)
        return [
          { label: t('reports.summary.totalRevenue'), value: fmt(totalRevenue) },
          { label: t('reports.col.expense'), value: fmt(totalExpense) },
          { label: t('reports.col.margin'), value: fmt(totalRevenue - totalExpense) }
        ]
      }
      case 'budgetVsActual': {
        const d = reportData as BudgetVsActualReport
        const totalBudgeted = d.rows.reduce((s, r) => s + r.budgeted, 0)
        const totalActual = d.rows.reduce((s, r) => s + r.actual, 0)
        return [
          { label: t('budgets.budgeted'), value: fmt(totalBudgeted) },
          { label: t('budgets.actual'), value: fmt(totalActual) },
          { label: t('budgets.variance'), value: fmt(totalBudgeted - totalActual) }
        ]
      }
      case 'statutoryComplianceSummary': {
        const d = reportData as StatutoryComplianceSummaryReport
        return [
          { label: t('reports.col.totalAmount'), value: fmt(d.rows.reduce((s, r) => s + r.totalAmount, 0)) },
          { label: t('nav.employees'), value: String(d.totalEmployees) }
        ]
      }
      case 'cashFlowProjection': {
        const d = reportData as CashFlowProjectionReport
        const totalActual = d.days.reduce((s, b) => s + (b.actualNet ?? 0), 0)
        const totalProjected = d.days.reduce((s, b) => s + (b.projectedNet ?? 0), 0)
        return [
          { label: t('reports.col.actual'), value: fmt(totalActual) },
          { label: t('reports.col.projected'), value: fmt(totalProjected) }
        ]
      }
      case 'cashPositionTrend': {
        const d = reportData as CashPositionTrendReport
        return [
          { label: t('reports.col.openingBalance'), value: fmt(d.openingBalance) },
          { label: t('reports.col.closingBalance'), value: fmt(d.closingBalance) },
          { label: t('reports.col.netChange'), value: fmt(d.netChange) }
        ]
      }
      case 'paymentPerformance': {
        const d = reportData as PaymentPerformanceReport
        return [
          { label: t('reports.col.avgDaysToPay'), value: d.overallAvgDaysToPay != null ? String(d.overallAvgDaysToPay) : '—' },
          { label: t('reports.col.outstanding'), value: fmt(d.rows.reduce((s, r) => s + r.outstandingAmount, 0)) }
        ]
      }
      case 'batchExpiry': {
        const d = reportData as BatchExpiryReport
        return [
          { label: t('reports.summary.totalBatches'), value: String(d.summary.totalBatches) },
          { label: t('reports.summary.expired'), value: String(d.summary.expiredCount) },
          { label: t('reports.summary.expiringCritical'), value: String(d.summary.criticalCount) },
          { label: t('reports.summary.expiringWarning'), value: String(d.summary.warningCount) }
        ]
      }
      case 'labThroughput': {
        const d = reportData as LabThroughputReport
        return [
          { label: t('reports.summary.totalOrders'), value: String(d.summary.totalOrders) },
          { label: t('reports.summary.delivered'), value: String(d.summary.delivered) },
          { label: t('reports.summary.cancelled'), value: String(d.summary.cancelled) },
          { label: t('reports.summary.avgTurnaround'), value: d.summary.avgTurnaroundHours != null ? `${d.summary.avgTurnaroundHours}h` : '—' }
        ]
      }
      case 'bloodStock': {
        const d = reportData as BloodStockReport
        return [
          { label: t('reports.summary.totalAvailableUnits'), value: String(d.summary.totalAvailable) },
          { label: t('reports.summary.expiringSoon'), value: String(d.summary.totalExpiringSoon) }
        ]
      }
      case 'donationToIssueCycleTime': {
        const d = reportData as DonationToIssueCycleTimeReport
        return [
          { label: t('reports.summary.totalIssuedUnits'), value: String(d.summary.totalIssuedUnits) },
          { label: t('reports.summary.overallAvgDays'), value: String(d.summary.overallAvgDays) }
        ]
      }
      case 'jewellery': {
        const d = reportData as JewelleryReport
        return [
          { label: t('reports.summary.totalStockValuation'), value: fmt(d.summary.totalStockValuationAmount) },
          { label: t('reports.summary.totalMakingChargeRevenue'), value: fmt(d.summary.totalMakingChargeRevenue) },
          { label: t('reports.summary.totalExchangeCount'), value: String(d.summary.totalExchangeCount) },
          { label: t('reports.summary.totalExchangeValueGiven'), value: fmt(d.summary.totalExchangeValueGiven) }
        ]
      }
      case 'makingChargeMargin': {
        const d = reportData as MakingChargeMarginReport
        return [
          { label: t('reports.summary.totalMetalValue'), value: fmt(d.summary.totalMetalValue) },
          { label: t('reports.summary.totalMakingCharge'), value: fmt(d.summary.totalMakingCharge) },
          { label: t('reports.summary.avgMakingChargePercent'), value: `${d.summary.avgMakingChargePercent}%` }
        ]
      }
      case 'hallmarkCompliance': {
        const d = reportData as HallmarkComplianceReport
        return [
          { label: t('reports.summary.totalItems'), value: String(d.summary.totalItems) },
          { label: t('reports.summary.compliantCount'), value: String(d.summary.compliantCount) },
          { label: t('reports.summary.nonCompliantCount'), value: String(d.summary.nonCompliantCount) },
          { label: t('reports.summary.compliancePercent'), value: `${d.summary.compliancePercent}%` }
        ]
      }
      case 'metalRateVsSalesVolume': {
        const d = reportData as MetalRateVsSalesVolumeReport
        return [
          { label: t('jewellery.metalType'), value: d.metalType && d.purity ? `${d.metalType} ${d.purity}` : '—' }
        ]
      }
      case 'purityAdjustedExchange': {
        const d = reportData as PurityAdjustedExchangeReport
        return [
          { label: t('reports.summary.totalExchangeCount'), value: String(d.summary.totalExchanges) },
          { label: t('reports.summary.totalPureEquivalentGrams'), value: `${d.summary.totalPureEquivalentGrams}g` },
          { label: t('reports.summary.totalExchangeValueGiven'), value: fmt(d.summary.totalValueGiven) }
        ]
      }
      case 'projects': {
        const d = reportData as ProjectReport
        return [
          { label: t('reports.summary.totalProjects'), value: String(d.summary.totalProjects) },
          { label: t('reports.summary.completed'), value: String(d.summary.completed) },
          { label: t('reports.summary.pendingJobs'), value: String(d.summary.open + d.summary.inProgress) },
          { label: t('service.estimatedAmount'), value: fmt(d.summary.totalEstimatedAmount) }
        ]
      }
      case 'serviceResolutionTime': {
        const d = reportData as ServiceResolutionTimeReport
        return [
          { label: t('reports.summary.totalResolved'), value: String(d.summary.totalResolved) },
          { label: t('reports.summary.overallAvgHours'), value: `${d.summary.overallAvgHours}h` }
        ]
      }
      case 'repeatBusinessRate': {
        const d = reportData as RepeatBusinessRateReport
        const latest = d.rows[d.rows.length - 1]
        return [
          { label: t('reports.summary.repeatRatePercent'), value: latest ? `${latest.repeatRatePercent}%` : '—' },
          { label: t('reports.col.newCustomers'), value: String(latest?.newCustomers ?? 0) },
          { label: t('reports.col.repeatCustomers'), value: String(latest?.repeatCustomers ?? 0) }
        ]
      }
      case 'consultantUtilization': {
        const d = reportData as ConsultantUtilizationReport
        return [
          { label: t('reports.summary.overallUtilizationPercent'), value: `${d.summary.overallUtilizationPercent}%` },
          { label: t('reports.col.billableHours'), value: `${d.summary.totalBillableHours}h` },
          { label: t('reports.col.nonBillableHours'), value: `${d.summary.totalNonBillableHours}h` }
        ]
      }
      case 'clientProfitability': {
        const d = reportData as ClientProfitabilityReport
        return [
          { label: t('common.amount'), value: fmt(d.summary.totalRevenue) },
          { label: t('reports.col.hoursSpent'), value: `${d.summary.totalHours}h` }
        ]
      }
      case 'jobCardTurnaroundByTechnician': {
        const d = reportData as JobCardTurnaroundByTechnicianReport
        return [
          { label: t('reports.summary.totalDelivered'), value: String(d.summary.totalDelivered) },
          { label: t('reports.summary.overallAvgTurnaroundHours'), value: `${d.summary.overallAvgTurnaroundHours}h` }
        ]
      }
      case 'repairCategoryVolumeTrend': {
        const d = reportData as RepairCategoryVolumeTrendReport
        return [
          { label: t('reports.summary.totalJobs'), value: String(d.summary.totalJobs) },
          { label: t('reports.col.category'), value: String(d.categories.length) }
        ]
      }
      case 'fieldRepLeaderboard': {
        const d = reportData as FieldRepLeaderboardReport
        return [
          { label: t('reports.summary.totalOrdersBooked'), value: String(d.summary.totalOrdersBooked) },
          { label: `${t('common.amount')} (${currencySymbol})`, value: d.summary.totalValue.toFixed(2) }
        ]
      }
      case 'stylistRepeatClient': {
        const d = reportData as StylistRepeatClientReport
        return [
          { label: t('reports.col.stylist'), value: String(d.summary.totalStylists) },
          { label: t('reports.col.repeatRatePercent'), value: `${d.summary.overallRepeatRatePercent}%` }
        ]
      }
      case 'retailAttachRate': {
        const d = reportData as RetailAttachRateReport
        return [
          { label: t('reports.col.totalInvoices'), value: String(d.summary.totalAppointmentInvoices) },
          { label: t('reports.col.attachRatePercent'), value: `${d.summary.attachRatePercent}%` }
        ]
      }
      case 'membershipRenewalFunnel': {
        const d = reportData as MembershipRenewalFunnelReport
        return [
          { label: t('reports.col.expiredCount'), value: String(d.summary.totalExpired) },
          { label: t('reports.col.renewalRatePercent'), value: `${d.summary.overallRenewalRatePercent}%` }
        ]
      }
      case 'serviceProjects': {
        const d = reportData as ServiceProjectReport
        return [
          { label: t('reports.summary.totalProjects'), value: String(d.summary.totalProjects) },
          { label: t('reports.summary.active'), value: String(d.summary.active) },
          { label: t('reports.summary.completed'), value: String(d.summary.completed) },
          { label: t('reports.summary.totalContractValue'), value: fmt(d.summary.totalContractValue) }
        ]
      }
      case 'jobCards': {
        const d = reportData as JobCardReport
        return [
          { label: t('reports.summary.totalJobs'), value: String(d.summary.totalJobs) },
          { label: t('reports.summary.delivered'), value: String(d.summary.delivered) },
          { label: t('reports.summary.pendingJobs'), value: String(d.summary.pending) },
          { label: t('reports.summary.totalActualCost'), value: fmt(d.summary.totalActualCost) }
        ]
      }
      case 'carJobCards': {
        const d = reportData as CarJobCardReport
        return [
          { label: t('reports.summary.totalJobs'), value: String(d.summary.totalJobs) },
          { label: t('reports.summary.delivered'), value: String(d.summary.delivered) },
          { label: 'Labor Revenue', value: fmt(d.summary.totalLaborRevenue) },
          { label: 'Parts Revenue', value: fmt(d.summary.totalPartsRevenue) }
        ]
      }
      case 'tailoringOrders': {
        const d = reportData as TailoringOrderReport
        return [
          { label: 'Total Orders', value: String(d.summary.totalOrders) },
          { label: t('reports.summary.delivered'), value: String(d.summary.delivered) },
          { label: t('common.amount'), value: fmt(d.summary.totalAmount) }
        ]
      }
      case 'pestContracts': {
        const d = reportData as PestContractReport
        return [
          { label: 'Active Contracts', value: String(d.summary.activeContracts) },
          { label: 'Expiring (30 days)', value: String(d.summary.expiringWithin30Days) },
          { label: 'Total Contract Value', value: fmt(d.summary.totalContractValue) }
        ]
      }
      case 'realEstatePipeline': {
        const d = reportData as RealEstatePipelineReport
        return [
          { label: 'Total Listings', value: String(d.summary.totalListings) },
          { label: 'Available', value: String(d.summary.availableListings) },
          { label: 'Deals In Progress', value: String(d.summary.dealsInProgress) },
          { label: 'Brokerage Earned', value: fmt(d.summary.totalBrokerageEarned) }
        ]
      }
      case 'retainers': {
        const d = reportData as RetainerReport
        return [
          { label: 'Active Retainers', value: String(d.summary.activeRetainers) },
          { label: 'Total MRR', value: fmt(d.summary.totalMRR) },
          { label: 'Billed This Period', value: `${d.summary.billedThisPeriodCount} (${fmt(d.summary.billedThisPeriodAmount)})` }
        ]
      }
      case 'shootBookings': {
        const d = reportData as ShootBookingReport
        return [
          { label: 'Total Bookings', value: String(d.summary.totalBookings) },
          { label: t('reports.summary.delivered'), value: String(d.summary.delivered) },
          { label: t('common.amount'), value: fmt(d.summary.totalRevenue) }
        ]
      }
      case 'eventBookings': {
        const d = reportData as EventBookingReport
        return [
          { label: 'Total Bookings', value: String(d.summary.totalBookings) },
          { label: t('reports.summary.completed'), value: String(d.summary.completed) },
          { label: t('common.amount'), value: fmt(d.summary.totalRevenue) }
        ]
      }
      case 'placements': {
        const d = reportData as PlacementReport
        return [
          { label: 'Total Placements', value: String(d.summary.totalPlacements) },
          { label: 'Joined', value: String(d.summary.joined) },
          { label: 'Invoiced', value: String(d.summary.invoiced) },
          { label: 'Total Commission', value: fmt(d.summary.totalCommission) }
        ]
      }
      case 'drawingRegister': {
        const d = reportData as DrawingRegisterReport
        return [
          { label: 'Total Drawings', value: String(d.summary.totalDrawings) },
          { label: 'Approved', value: String(d.summary.approved) },
          { label: 'Pending Review', value: String(d.summary.pendingReview) }
        ]
      }
      case 'siteVisitLog': {
        const d = reportData as SiteVisitLogReport
        return [
          { label: 'Total Visits', value: String(d.summary.totalVisits) }
        ]
      }
      case 'prescriptionDrugSales': {
        const d = reportData as PrescriptionDrugSalesReport
        return [
          { label: 'Total Sales', value: String(d.summary.totalSales) },
          { label: t('common.amount'), value: fmt(d.summary.totalAmount) },
          { label: 'Missing Details', value: String(d.summary.missingPrescriptionDetails) }
        ]
      }
      case 'scheduleH1XRegister': {
        const d = reportData as ScheduleH1XRegisterReport
        return [
          { label: 'Total Sales', value: String(d.summary.totalSales) },
          { label: 'Total Quantity', value: String(d.summary.totalQuantity) },
          { label: 'Missing Details', value: String(d.summary.missingPrescriptionDetails) }
        ]
      }
      case 'schemeCostVsVolume': {
        const d = reportData as SchemeCostVsVolumeReport
        return [
          { label: t('reports.summary.totalSchemeCost'), value: fmt(d.summary.totalSchemeCost) },
          { label: t('reports.summary.focUnitsGiven'), value: String(d.summary.totalFocUnitsGiven) },
          { label: t('reports.summary.activeSchemes'), value: String(d.summary.activeSchemeCount) }
        ]
      }
      case 'chronicRecallCompliance': {
        const d = reportData as ChronicRecallComplianceReport
        return [
          { label: t('reports.summary.recallsClosed'), value: String(d.totalRecallsClosed) },
          { label: t('reports.summary.compliancePercent'), value: d.overallPercent != null ? `${d.overallPercent}%` : '—' }
        ]
      }
      case 'walkInVsAppointmentRatio': {
        const d = reportData as WalkInVsAppointmentRatioReport
        return [
          { label: t('reports.summary.totalWalkIns'), value: String(d.summary.totalWalkIns) },
          { label: t('reports.col.appointments'), value: String(d.summary.totalAppointments) },
          { label: t('reports.summary.walkInPercent'), value: `${d.summary.walkInPercent}%` }
        ]
      }
      case 'diagnosisCategoryTrend': {
        const d = reportData as DiagnosisCategoryTrendReport
        return [
          { label: t('reports.summary.totalVisits'), value: String(d.summary.totalVisits) },
          { label: t('reports.summary.categorized'), value: String(d.summary.categorizedCount) },
          { label: t('reports.summary.distinctCategories'), value: String(d.summary.distinctCategoryCount) }
        ]
      }
      case 'referralOutcome': {
        const d = reportData as ReferralOutcomeReport
        return [
          { label: t('reports.summary.totalReferrals'), value: String(d.summary.totalReferrals) },
          { label: t('reports.summary.outcomeRecorded'), value: String(d.summary.outcomeRecordedCount) },
          { label: t('reports.summary.pendingReferrals'), value: String(d.summary.pendingCount) }
        ]
      }
      case 'packUtilization': {
        const d = reportData as PackUtilizationReport
        return [
          { label: t('reports.summary.totalPacks'), value: String(d.summary.totalPacks) },
          { label: t('reports.summary.sessionsUsed'), value: `${d.summary.totalSessionsUsed} / ${d.summary.totalSessionsSold}` },
          { label: t('reports.summary.overallUtilization'), value: `${d.summary.overallUtilizationPercent}%` }
        ]
      }
      case 'labTAT': {
        const d = reportData as LabTATReport
        return [
          { label: t('reports.summary.totalCompleted'), value: String(d.summary.totalCompleted) },
          { label: t('reports.summary.withTarget'), value: String(d.summary.withTargetCount) },
          { label: t('reports.summary.overallOnTimePercent'), value: d.summary.withTargetCount > 0 ? `${d.summary.overallOnTimePercent}%` : '—' }
        ]
      }
      case 'testVolumeByPanel': {
        const d = reportData as TestVolumeByPanelReport
        return [
          { label: t('reports.summary.totalTests'), value: String(d.summary.totalTests) },
          { label: t('reports.summary.distinctPanels'), value: String(d.summary.distinctPanelCount) }
        ]
      }
      case 'referralLeaderboard': {
        const d = reportData as ReferralLeaderboardReport
        return [
          { label: t('reports.summary.totalReferrals'), value: String(d.summary.totalReferrals) },
          { label: t('reports.summary.distinctReferrers'), value: String(d.summary.distinctReferrerCount) },
          { label: t('reports.summary.topReferrer'), value: d.summary.topReferrerName ?? '—' }
        ]
      }
      case 'secondOpinionConversion': {
        const d = reportData as SecondOpinionConversionReport
        return [
          { label: t('reports.summary.totalSecondOpinionVisits'), value: String(d.summary.totalSecondOpinionVisits) },
          { label: t('reports.summary.convertedCount'), value: String(d.summary.convertedCount) },
          { label: t('reports.summary.conversionPercent'), value: d.summary.conversionPercent != null ? `${d.summary.conversionPercent}%` : '—' }
        ]
      }
      case 'caseComplexityMix': {
        const d = reportData as CaseComplexityMixReport
        return [
          { label: t('reports.summary.totalTagged'), value: String(d.summary.totalTagged) },
          { label: t('reports.summary.routineCount'), value: String(d.summary.routineCount) },
          { label: t('reports.summary.complexCount'), value: String(d.summary.complexCount) },
          { label: t('reports.summary.complexPercent'), value: d.summary.complexPercent != null ? `${d.summary.complexPercent}%` : '—' }
        ]
      }
      case 'treatmentAcceptanceRate': {
        const d = reportData as TreatmentAcceptanceRateReport
        return [
          { label: t('reports.summary.proposedCount'), value: String(d.summary.proposedCount) },
          { label: t('reports.summary.acceptedCount'), value: String(d.summary.acceptedCount) },
          { label: t('reports.summary.billedCount'), value: String(d.summary.billedCount) },
          { label: t('reports.summary.acceptanceRatePercent'), value: d.summary.acceptanceRatePercent != null ? `${d.summary.acceptanceRatePercent}%` : '—' },
          { label: t('reports.summary.billedRatePercent'), value: d.summary.billedRatePercent != null ? `${d.summary.billedRatePercent}%` : '—' }
        ]
      }
      case 'dentalRecallCompliance': {
        const d = reportData as DentalRecallComplianceReport
        return [
          { label: t('reports.summary.recallsClosed'), value: String(d.totalRecallsClosed) },
          { label: t('reports.summary.compliancePercent'), value: d.overallPercent != null ? `${d.overallPercent}%` : '—' }
        ]
      }
      case 'vaccinationCompliance': {
        const d = reportData as VaccinationComplianceReport
        return [
          { label: t('reports.summary.dosesEvaluated'), value: String(d.totalDosesEvaluated) },
          { label: t('reports.summary.compliancePercent'), value: d.overallPercent != null ? `${d.overallPercent}%` : '—' }
        ]
      }
      case 'vetCaseTypeVolume': {
        const d = reportData as VetCaseTypeVolumeReport
        return [
          { label: t('reports.summary.totalCases'), value: String(d.summary.totalCases) },
          { label: t('reports.summary.distinctCaseTypes'), value: String(d.summary.distinctCaseTypeCount) }
        ]
      }
      case 'logistics': {
        const d = reportData as LogisticsReport
        return [
          { label: t('reports.summary.totalShipments'), value: String(d.summary.totalShipments) },
          { label: t('reports.summary.deliveryRate'), value: `${d.summary.deliveryRate}%` },
          { label: t('reports.summary.totalFreight'), value: fmt(d.summary.totalFreight) },
          { label: t('reports.summary.freightPending'), value: fmt(d.summary.freightPending) }
        ]
      }
      case 'attendance': {
        const d = reportData as AttendanceReport
        return [
          { label: t('reports.summary.totalRecords'), value: String(d.summary.totalRecords) },
          { label: t('reports.summary.present'), value: String(d.summary.presentCount) },
          { label: t('reports.summary.absent'), value: String(d.summary.absentCount) },
          { label: t('reports.summary.overallAttendanceRate'), value: `${d.summary.overallAttendanceRate}%` }
        ]
      }
      case 'production': {
        const d = reportData as ProductionReport
        return [
          { label: t('reports.summary.totalOrders'), value: String(d.summary.totalOrders) },
          { label: t('reports.summary.completed'), value: String(d.summary.completed) },
          { label: t('reports.summary.inProgress'), value: String(d.summary.inProgress) },
          { label: t('reports.summary.completionRate'), value: `${d.summary.completionRate}%` }
        ]
      }
      case 'landedCostPerUnit': {
        const d = reportData as LandedCostPerUnitReport
        return [
          { label: t('reports.summary.totalOrders'), value: String(d.summary.totalOrders) },
          { label: t('reports.summary.totalProducedQty'), value: String(d.summary.totalProducedQty) },
        ]
      }
      case 'rejectionRateTrend': {
        const d = reportData as RejectionRateTrendReport
        return [
          { label: t('reports.col.qtyInspected'), value: String(d.summary.totalInspected) },
          { label: t('reports.col.qtyRejected'), value: String(d.summary.totalRejected) },
          { label: t('reports.summary.overallRejectionRate'), value: `${d.summary.overallRejectionRatePercent}%` },
        ]
      }
      case 'seasonalCreditExposure': {
        const d = reportData as SeasonalCreditExposureReport
        return [
          { label: t('reports.summary.totalOutstanding'), value: fmt(d.summary.totalOutstanding) },
          { label: t('reports.col.invoiceCount'), value: String(d.summary.totalInvoices) },
          { label: t('reports.summary.peakMonth'), value: d.summary.peakMonth ?? '—' },
        ]
      }
      case 'farmerRepayment': {
        const d = reportData as FarmerRepaymentReport
        return [
          { label: t('reports.summary.totalFarmers'), value: String(d.summary.totalFarmers) },
          { label: t('reports.summary.totalOutstanding'), value: fmt(d.summary.totalOutstanding) },
          { label: t('reports.summary.overallRepaymentRate'), value: `${d.summary.overallRepaymentRatePercent}%` },
        ]
      }
      case 'serialWarranty': {
        const d = reportData as SerialWarrantyReport
        return [
          { label: t('reports.summary.totalSerials'), value: String(d.summary.totalSerials) },
          { label: t('reports.summary.inStock'), value: String(d.summary.inStock) },
          { label: t('reports.summary.warrantyExpiringSoon'), value: String(d.summary.warrantyExpiringSoon) },
          { label: t('reports.summary.warrantyExpired'), value: String(d.summary.warrantyExpired) }
        ]
      }
      case 'rmaAging': {
        const d = reportData as RmaAgingReport
        return [
          { label: t('reports.summary.totalOpen'), value: String(d.summary.totalOpen) },
          { label: t('reports.val.overdue'), value: String(d.summary.overdueCount) }
        ]
      }
      case 'vendorRecoveryLedger': {
        const d = reportData as VendorRecoveryLedgerReport
        return [
          { label: t('reports.col.claimedAmount'), value: fmt(d.summary.totalClaimed) },
          { label: t('reports.col.recoveredAmount'), value: fmt(d.summary.totalRecovered) },
          { label: t('reports.col.outstanding'), value: fmt(d.summary.totalOutstanding) }
        ]
      }
      case 'repairTurnaroundByTechnician': {
        const d = reportData as RepairTurnaroundByTechnicianReport
        return [
          { label: t('reports.summary.technicianCount'), value: String(d.summary.technicianCount) },
          { label: t('reports.summary.totalTicketsCompleted'), value: String(d.summary.totalTicketsCompleted) },
          { label: t('reports.col.avgTurnaroundDays'), value: String(d.summary.overallAvgTurnaroundDays) }
        ]
      }
      case 'variantStock': {
        const d = reportData as VariantStockReport
        return [
          { label: t('reports.summary.totalVariants'), value: String(d.summary.totalVariants) },
          { label: t('reports.summary.totalStockQty'), value: String(d.summary.totalStockQty) },
          { label: t('reports.summary.outOfStockVariants'), value: String(d.summary.outOfStockVariants) }
        ]
      }
      case 'testScores': {
        const d = reportData as TestScoreReport
        return [
          { label: t('reports.summary.totalTests'), value: String(d.summary.totalTests) },
          { label: t('reports.summary.averagePercentage'), value: `${d.summary.averagePercentage}%` },
          { label: t('reports.summary.belowFiftyCount'), value: String(d.summary.belowFiftyCount) },
          { label: t('reports.summary.studentCount'), value: String(d.summary.studentCount) }
        ]
      }
      case 'complianceTasks': {
        const d = reportData as ComplianceTaskReport
        return [
          { label: t('reports.summary.totalOpen'), value: String(d.summary.totalOpen) },
          { label: t('reports.summary.overdueCount'), value: String(d.summary.overdueCount) },
          { label: t('reports.summary.dueThisWeekCount'), value: String(d.summary.dueThisWeekCount) },
          { label: t('reports.summary.clientCount'), value: String(d.summary.clientCount) }
        ]
      }
      default: return []
    }
  }

  // Phase 54C — printed PDFs previously carried only tables and number cards.
  // Every report that has a genuine chart-worthy aggregate gets one here,
  // reusing the exact same data already computed for the on-screen view (or,
  // for older reports that never got an on-screen chart, the same aggregate
  // arrays those views already hold) — no new backend calculation anywhere.
  // Audit and Backup are deliberately excluded: a compliance trail and a file
  // list have no meaningful chart, per the dataviz skill's own "sometimes the
  // right form is not a chart" principle.
  function getReportCharts(): ReportChart[] {
    if (!reportData) return []
    switch (activeReport) {
      case 'sales': {
        const d = reportData as SalesReport
        const charts: ReportChart[] = []
        if (d.groups.length > 0) charts.push({ type: 'line', title: t('reports.section.summaryByGroup', { groupBy: t(`reports.${d.groupBy}`) }), data: d.groups.map(g => ({ label: g.label, value: g.revenue })), valueIsCurrency: true })
        if (d.byHour.length > 0) charts.push({ type: 'bar', orientation: 'vertical', title: t('reports.section.salesByHour'), data: d.byHour.map(h => ({ label: h.hour, value: h.revenue })), valueIsCurrency: true })
        return charts
      }
      case 'inventory': {
        const d = reportData as InventoryReport
        const byCategory = new Map<string, number>()
        for (const r of d.rows) byCategory.set(r.category ?? '—', (byCategory.get(r.category ?? '—') ?? 0) + r.stockValue)
        const data = Array.from(byCategory.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)
        return data.length ? [{ type: 'bar', title: t('reports.summary.stockValue'), data, valueIsCurrency: true }] : []
      }
      case 'tax': {
        const d = reportData as TaxReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.summary.taxCollected'), data: d.rows.map(r => ({ label: r.taxName, value: r.taxCollected })), valueIsCurrency: true }]
      }
      case 'outstanding': {
        const d = reportData as OutstandingReport
        const bucketLabels: [keyof AgingBuckets, string][] = [
          ['current', t('reports.aging.current')], ['days1to30', t('reports.aging.d1to30Short')],
          ['days31to60', t('reports.aging.d31to60Short')], ['days61to90', t('reports.aging.d61to90Short')], ['days90plus', t('reports.aging.d90plusShort')],
        ]
        const charts: ReportChart[] = []
        if (d.customers.totalOutstanding > 0) charts.push({ type: 'bar', orientation: 'vertical', title: t('reports.summary.customerOutstanding'), data: bucketLabels.map(([k, label]) => ({ label, value: d.customers.agingTotals[k] })), valueIsCurrency: true })
        if (d.suppliers.totalOutstanding > 0) charts.push({ type: 'bar', orientation: 'vertical', title: t('reports.summary.supplierPayables'), data: bucketLabels.map(([k, label]) => ({ label, value: d.suppliers.agingTotals[k] })), valueIsCurrency: true })
        return charts
      }
      // Deliberately no chart — these are all read as a table/statement, not
      // a trend: a specific-account statement (often printed to hand
      // directly to that customer/supplier or filed for records), a
      // day-by-day cash register, and a Dr/Cr account listing all read the
      // same way regardless of period length.
      case 'customerLedger':
      case 'supplierLedger':
      case 'cashBook':
      case 'trialBalance': return []
      case 'profitAndLoss': {
        const d = reportData as ProfitAndLossReport
        const charts: ReportChart[] = [{
          type: 'bar', title: t('reports.section.plSummary'),
          data: [
            { label: t('reports.summary.revenue'), value: d.summary.revenue, color: STATUS_COLORS.brand },
            { label: t('reports.summary.grossProfit'), value: d.summary.grossProfit, color: STATUS_COLORS.success },
            { label: t('reports.summary.totalExpenses'), value: d.summary.totalExpenses, color: STATUS_COLORS.warning },
            { label: t('reports.summary.netProfit'), value: d.summary.netProfit, color: d.summary.netProfit >= 0 ? STATUS_COLORS.success : STATUS_COLORS.danger },
          ],
          valueIsCurrency: true,
        }]
        if (d.expensesByCategory.length > 0) {
          charts.push({ type: 'bar', title: t('reports.section.byCategory'), data: d.expensesByCategory.map(c => ({ label: c.category, value: c.amount })), valueIsCurrency: true })
        }
        return charts
      }
      case 'expenses': {
        const d = reportData as ExpenseReport
        if (d.byCategory.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byCategory'), data: d.byCategory.map(c => ({ label: c.category ?? '—', value: c.amount })), valueIsCurrency: true }]
      }
      case 'foodCost': {
        const d = reportData as FoodCostReport
        if (d.rows.length === 0) return []
        const top = [...d.rows].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10)
        return [{ type: 'bar', title: t('reports.summary.totalFoodCost'), data: top.map(r => ({ label: r.ingredientName, value: r.totalCost })), valueIsCurrency: true }]
      }
      case 'dishContributionMargin': {
        const d = reportData as DishContributionMarginReport
        if (d.rows.length === 0) return []
        const top = [...d.rows].slice(0, 10)
        return [{ type: 'bar', title: t('reports.summary.contributionMarginByDish'), data: top.map(r => ({ label: r.productName, value: r.contributionMargin })), valueIsCurrency: true }]
      }
      case 'recipeWasteVariance': {
        const d = reportData as RecipeWasteVarianceReport
        if (d.rows.length === 0) return []
        const top = [...d.rows].slice(0, 10)
        return [{ type: 'bar', title: t('reports.summary.varianceByIngredient'), data: top.map(r => ({ label: r.ingredientName, value: r.varianceQuantity })) }]
      }
      case 'deadStockClearance': {
        const d = reportData as DeadStockClearanceReport
        if (d.rows.length === 0) return []
        const top = [...d.rows].slice(0, 10)
        return [{ type: 'bar', title: t('reports.summary.capitalLockedByProduct'), data: top.map(r => ({ label: r.productName, value: r.capitalLocked })), valueIsCurrency: true }]
      }
      case 'categorySellThrough': {
        const d = reportData as CategorySellThroughReport
        if (d.rows.length === 0) return []
        const byCategory = new Map<string, { total: number; count: number }>()
        for (const r of d.rows) {
          const e = byCategory.get(r.categoryName) ?? { total: 0, count: 0 }
          e.total += r.sellThroughRate; e.count += 1
          byCategory.set(r.categoryName, e)
        }
        const avgRows = Array.from(byCategory.entries()).map(([label, e]) => ({ label, value: Math.round((e.total / e.count) * 10) / 10 })).sort((a, b) => b.value - a.value)
        return [{ type: 'bar', title: t('reports.summary.avgSellThroughByCategory'), data: avgRows }]
      }
      case 'seasonSellThrough': {
        const d = reportData as SeasonSellThroughReport
        if (d.rows.length === 0) return []
        const bySeason = new Map<string, { total: number; count: number }>()
        for (const r of d.rows) {
          const e = bySeason.get(r.season) ?? { total: 0, count: 0 }
          e.total += r.sellThroughRate; e.count += 1
          bySeason.set(r.season, e)
        }
        const avgRows = Array.from(bySeason.entries()).map(([label, e]) => ({ label, value: Math.round((e.total / e.count) * 10) / 10 })).sort((a, b) => b.value - a.value)
        return [{ type: 'bar', title: t('reports.summary.avgSellThroughBySeason'), data: avgRows }]
      }
      // A heatmap grid isn't representable in any of the existing PDF chart
      // types (bar/line/pie/scatter) — same as the pre-existing Table
      // Turnover heatmap, the export table already carries every cell.
      case 'sizeStyleHeatmap': return []
      case 'sizeAvailabilityHeatmap': return []
      case 'seasonalReorderCalendar': return []
      case 'basketComposition': {
        const d = reportData as BasketCompositionReport
        if (d.rows.length === 0) return []
        const top = [...d.rows].slice(0, 10)
        return [{ type: 'bar', title: t('reports.summary.topProductPairs'), data: top.map(r => ({ label: `${r.productAName} + ${r.productBName}`, value: r.basketCount })) }]
      }
      // First use of the 'pie' ReportChart variant in this codebase — fits
      // Category Mix's "share of revenue" framing better than a bar chart.
      case 'categoryMix': {
        const d = reportData as CategoryMixReport
        if (d.rows.length === 0) return []
        return [{ type: 'pie', title: t('reports.summary.revenueByCategory'), data: d.rows.map(r => ({ label: r.categoryName, value: r.revenue })), valueIsCurrency: true }]
      }
      // Phase 67 §9.1 — Clothing item 5. Bar chart per the audit's own
      // chart-form note — rows already sort by margin descending.
      case 'vendorMargin': {
        const d = reportData as VendorMarginReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.summary.marginByVendor'), data: d.rows.slice(0, 10).map(r => ({ label: r.supplierName, value: r.margin })), valueIsCurrency: true }]
      }
      // Deliberately no chart here — the interactive view's own
      // margin-bar + return-rate-line combo (two different units, one
      // currency one percent) doesn't fit any single ReportChart variant
      // (bar/stackedBar/line/pie), same reasoning tableTurnoverByHour and
      // fastSlowMoverMatrix already use below. The export table already
      // carries every row's real numbers.
      case 'brandMarginReturnRate': return []
      // Deliberately no bar/pie/line chart — Table Turnover by Hour IS
      // itself a chart (a day-of-week x hour-of-day heatmap grid), rendered
      // directly in TableTurnoverHeatmapView below rather than through this
      // generic bar/pie/line summary-chart pathway.
      case 'tableTurnoverByHour': return []
      // Same reasoning — a velocity x margin SCATTER doesn't fit this
      // switch's bar/stackedBar/line/pie shape, rendered directly in
      // FastSlowMoverMatrixView below instead.
      case 'fastSlowMoverMatrix': return []
      // Deliberately no chart — a compliance filing reference checked
      // line-by-line against the GST portal, same category as Audit Log and
      // Backup: a precise document, not a dashboard.
      case 'gstr1': return []
      // Deliberately chart-free, same category as GSTR-1/Audit Log/Backup —
      // these are compliance/reference documents checked line-by-line, not
      // aggregate business patterns a chart would usefully summarize.
      case 'hsnSummary': return []
      case 'documentSummary': return []
      case 'gstr3bPreview': return []
      // Phase 67 §9.1 — Rental item 4: Overdue Returns aging bar. The rows
      // themselves are still an individual-bookings to-do list, chart-free
      // for that same reason the Compliance Task Report is — but the audit's
      // own item wording specifically named a "list + aging bar", so the
      // aging-bucket breakdown itself gets a bar chart now.
      case 'rentalStatus': {
        const d = reportData as RentalStatusReport
        if (d.summary.overdueCount === 0) return []
        return [{ type: 'bar', orientation: 'vertical', title: t('rental.overdueAging'), data: d.agingBuckets.map(b => ({ label: b.bucket, value: b.count, color: STATUS_COLORS.dangerDeep })) }]
      }
      case 'rentalRevenue': {
        const d = reportData as RentalRevenueReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.summary.totalRevenue'), data: d.rows.slice(0, 10).map(r => ({ label: r.productName, value: r.totalRevenue })), valueIsCurrency: true }]
      }
      case 'assetUtilization': {
        const d = reportData as AssetUtilizationReport
        if (d.rows.length === 0) return []
        const worst = d.rows.slice(0, 10)
        return [{ type: 'bar', orientation: 'vertical', title: t('rental.utilization'), data: worst.map(r => ({ label: `${r.productName} (${r.unitLabel})`, value: r.utilizationPercent, color: r.utilizationPercent < 25 ? STATUS_COLORS.dangerDeep : STATUS_COLORS.brand })) }]
      }
      case 'hotelOccupancy': {
        const d = reportData as HotelOccupancyReport
        return [{
          type: 'bar', title: 'Room Status', orientation: 'horizontal',
          data: [
            { label: 'Occupied', value: d.occupied, color: STATUS_COLORS.brand },
            { label: 'Available', value: d.available, color: STATUS_COLORS.success },
            { label: 'Cleaning', value: d.cleaning, color: STATUS_COLORS.warning },
            { label: 'Maintenance', value: d.maintenance, color: STATUS_COLORS.danger },
          ],
        }]
      }
      // Deliberately no chart — same reasoning as rentalStatus: this
      // report's rows are individual guest ID records for a compliance
      // register, read as a table/produced-on-demand document, not a trend.
      case 'hotelGuestRegister': return []
      case 'appointmentUtilisation': {
        const d = reportData as AppointmentUtilisationReport
        if (d.byProvider.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byProvider'), data: d.byProvider.map(p => ({ label: p.providerName, value: p.total })) }]
      }
      // Deliberately no chart — this report's rows are individual clients (visit
      // history, at-risk flags). A chart adds nothing a clinic/salon owner needs
      // and every extra element costs print space/ink on a document that may be
      // printed often; the summary cards + table already say everything plainly.
      case 'clientRetention': return []
      case 'commission': {
        const d = reportData as CommissionReport
        if (d.byStaff.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byStaff'), data: d.byStaff.map(s => ({ label: s.staffName, value: s.commissionAmount })), valueIsCurrency: true }]
      }
      case 'orderVolume': {
        const d = reportData as OrderVolumeReport
        if (d.byDay.length === 0) return []
        return [{
          type: 'stackedBar', title: t('reports.section.byDayChart'),
          data: d.byDay.map(day => ({
            label: day.date.slice(5),
            segments: [
              { value: day.accepted, color: STATUS_COLORS.success, name: t('reports.summary.accepted') },
              { value: day.pending, color: STATUS_COLORS.warning, name: t('reports.summary.pendingOrders') },
              { value: day.rejected, color: STATUS_COLORS.danger, name: t('reports.summary.rejected') },
            ],
          })),
          legend: [
            { name: t('reports.summary.accepted'), color: STATUS_COLORS.success },
            { name: t('reports.summary.pendingOrders'), color: STATUS_COLORS.warning },
            { name: t('reports.summary.rejected'), color: STATUS_COLORS.danger },
          ],
        }]
      }
      case 'discounts': {
        const d = reportData as DiscountReport
        if (d.byProduct.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.topDiscountedProducts'), data: d.byProduct.slice(0, 10).map(p => ({ label: p.productName, value: p.discountGiven })), valueIsCurrency: true }]
      }
      case 'purchaseRegister': {
        const d = reportData as PurchaseRegisterReport
        if (d.byVendor.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.spendByVendor'), data: d.byVendor.slice(0, 10).map(v => ({ label: v.supplierName, value: v.totalAmount })), valueIsCurrency: true }]
      }
      case 'purchasesByVendor': {
        const d = reportData as PurchasesByVendorReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.spendByVendor'), data: d.rows.slice(0, 10).map(v => ({ label: v.supplierName, value: v.totalAmount })), valueIsCurrency: true }]
      }
      case 'purchasesByItem': {
        const d = reportData as PurchasesByItemReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.spendByItem'), data: d.rows.slice(0, 10).map(v => ({ label: v.itemName, value: v.totalAmount })), valueIsCurrency: true }]
      }
      case 'apAging': {
        const d = reportData as ApAgingReport
        if (d.rows.length === 0) return []
        const top = d.rows.slice(0, 10)
        return [{
          type: 'stackedBar', title: t('reports.section.apAgingByVendor'),
          data: top.map(r => ({
            label: r.supplierName,
            segments: [
              { value: r.aging.current, color: STATUS_COLORS.success, name: t('reports.aging.current') },
              { value: r.aging.days1to30, color: STATUS_COLORS.brand, name: t('reports.aging.days1to30') },
              { value: r.aging.days31to60, color: STATUS_COLORS.warning, name: t('reports.aging.days31to60') },
              { value: r.aging.days61to90, color: STATUS_COLORS.danger, name: t('reports.aging.days61to90') },
              { value: r.aging.days90plus, color: STATUS_COLORS.dangerDeep, name: t('reports.aging.days90plus') }
            ]
          })),
          legend: [
            { name: t('reports.aging.current'), color: STATUS_COLORS.success },
            { name: t('reports.aging.days1to30'), color: STATUS_COLORS.brand },
            { name: t('reports.aging.days31to60'), color: STATUS_COLORS.warning },
            { name: t('reports.aging.days61to90'), color: STATUS_COLORS.danger },
            { name: t('reports.aging.days90plus'), color: STATUS_COLORS.dangerDeep }
          ]
        }]
      }
      case 'batchExpiry': {
        const d = reportData as BatchExpiryReport
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.section.byBucket'), data: d.buckets.map(b => ({ label: t(BUCKET_LABEL_KEY[b.bucket]), value: b.count, color: BUCKET_COLOR[b.bucket] })) }]
      }
      // Deliberately no chart — rows are individual patient test orders; a
      // printed lab-ops document shouldn't spend space/ink on a chart that
      // adds nothing the summary cards + row table don't already say plainly.
      case 'labThroughput': return []
      case 'bloodStock': {
        const d = reportData as BloodStockReport
        if (d.byGroup.every(g => g.available === 0)) return []
        return [{
          type: 'stackedBar', title: t('reports.section.byBloodGroup'),
          data: d.byGroup.map(g => ({ label: g.bloodGroup, segments: [
            { value: g.available - g.expiringSoon, color: STATUS_COLORS.brand },
            { value: g.expiringSoon, color: STATUS_COLORS.warning },
          ] })),
          legend: [{ name: t('reports.summary.totalAvailableUnits'), color: STATUS_COLORS.brand }, { name: t('reports.summary.expiringSoon'), color: STATUS_COLORS.warning }],
        }]
      }
      case 'donationToIssueCycleTime': {
        const d = reportData as DonationToIssueCycleTimeReport
        if (d.byComponent.length === 0) return []
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.summary.avgCycleTimeByComponent'), data: d.byComponent.map(c => ({ label: c.componentType.replace('_', ' '), value: c.avgDays })) }]
      }
      case 'jewellery': {
        const d = reportData as JewelleryReport
        if (d.stockByMetal.length === 0) return []
        return [{
          type: 'bar', title: t('reports.section.stockByMetal'),
          data: d.stockByMetal.map(g => ({ label: `${g.metalType} ${g.purity}`, value: g.valuationAmount })),
          valueIsCurrency: true,
        }]
      }
      case 'makingChargeMargin': {
        const d = reportData as MakingChargeMarginReport
        if (d.rows.length === 0) return []
        return [{
          type: 'stackedBar', title: t('jewellery.makingChargeMargin'),
          data: d.rows.slice(0, 10).map(r => ({
            label: r.invoiceNumber,
            segments: [{ value: r.metalValue, color: STATUS_COLORS.brand, name: t('reports.col.metalValue') }, { value: r.makingCharge, color: STATUS_COLORS.warning, name: t('reports.col.makingCharge') }],
          })),
          legend: [{ name: t('reports.col.metalValue'), color: STATUS_COLORS.brand }, { name: t('reports.col.makingCharge'), color: STATUS_COLORS.warning }],
        }]
      }
      case 'hallmarkCompliance': {
        const d = reportData as HallmarkComplianceReport
        if (d.summary.totalItems === 0) return []
        return [{
          type: 'pie', title: t('jewellery.hallmarkCompliance'),
          data: [
            { label: t('reports.col.compliant'), value: d.summary.compliantCount, color: STATUS_COLORS.success },
            { label: t('reports.col.nonCompliant'), value: d.summary.nonCompliantCount, color: STATUS_COLORS.dangerDeep },
          ],
        }]
      }
      // Deliberately no PDF chart for metalRateVsSalesVolume — same
      // reasoning schemeCostVsVolume already established: this PDF chart
      // shape has no dual-axis line type, and a single rate-only or
      // volume-only line loses exactly the correlation the report exists to
      // show. The interactive Reports-screen view (below) uses a real
      // dual-yAxisId ComposedChart instead.
      case 'purityAdjustedExchange': {
        const d = reportData as PurityAdjustedExchangeReport
        if (d.byMetal.length === 0) return []
        return [{
          type: 'bar', title: t('jewellery.purityAdjustedExchange'),
          data: d.byMetal.map(r => ({ label: `${r.metalType} ${r.purity}`, value: r.pureEquivalentGrams })),
        }]
      }
      case 'projects': {
        const d = reportData as ProjectReport
        if (d.byStatus.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count })) }]
      }
      case 'serviceResolutionTime': {
        const d = reportData as ServiceResolutionTimeReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.serviceResolutionTime.label'), data: d.rows.map(r => ({ label: r.category, value: r.avgHours })) }]
      }
      case 'repeatBusinessRate': {
        const d = reportData as RepeatBusinessRateReport
        if (d.rows.length === 0) return []
        return [{ type: 'line', title: t('reports.defs.repeatBusinessRate.label'), data: d.rows.map(r => ({ label: r.month, value: r.repeatRatePercent })) }]
      }
      case 'consultantUtilization': {
        const d = reportData as ConsultantUtilizationReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.consultantUtilization.label'), data: d.rows.map(r => ({ label: r.userName, value: r.utilizationPercent })) }]
      }
      case 'clientProfitability': {
        const d = reportData as ClientProfitabilityReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.clientProfitability.label'), data: d.rows.map(r => ({ label: r.customerName, value: r.revenue })) }]
      }
      case 'jobCardTurnaroundByTechnician': {
        const d = reportData as JobCardTurnaroundByTechnicianReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.jobCardTurnaroundByTechnician.label'), data: d.rows.map(r => ({ label: r.technicianName, value: r.avgTurnaroundHours })) }]
      }
      case 'repairCategoryVolumeTrend': {
        const d = reportData as RepairCategoryVolumeTrendReport
        if (d.rows.length === 0) return []
        const byMonth = new Map<string, number>()
        for (const r of d.rows) byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.count)
        return [{ type: 'line', title: t('reports.defs.repairCategoryVolumeTrend.label'), data: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })) }]
      }
      case 'fieldRepLeaderboard': {
        const d = reportData as FieldRepLeaderboardReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.fieldRepLeaderboard.label'), data: d.rows.slice(0, 10).map(r => ({ label: r.repName, value: r.totalValue })) }]
      }
      case 'stylistRepeatClient': {
        const d = reportData as StylistRepeatClientReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.stylistRepeatClient.label'), data: d.rows.slice(0, 10).map(r => ({ label: r.providerName, value: r.repeatRatePercent })) }]
      }
      case 'retailAttachRate': {
        const d = reportData as RetailAttachRateReport
        if (d.byProvider.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.retailAttachRate.label'), data: d.byProvider.slice(0, 10).map(r => ({ label: r.providerName, value: r.attachRatePercent })) }]
      }
      case 'membershipRenewalFunnel': {
        const d = reportData as MembershipRenewalFunnelReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.defs.membershipRenewalFunnel.label'), data: d.rows.slice(0, 10).map(r => ({ label: r.planName, value: r.renewalRatePercent })) }]
      }
      case 'classAttendanceHeatmap': return []
      case 'learnerProgressFunnel': return []
      case 'serviceProjects': {
        const d = reportData as ServiceProjectReport
        if (d.byStatus.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count })) }]
      }
      case 'jobCards': {
        const d = reportData as JobCardReport
        if (d.byStatus.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count })) }]
      }
      case 'tailoringOrders': {
        const d = reportData as TailoringOrderReport
        if (d.byGarmentType.length === 0) return []
        return [{ type: 'bar', title: 'Orders by Garment Type', data: d.byGarmentType.map(g => ({ label: g.garmentType, value: g.count })) }]
      }
      case 'pestContracts': {
        const d = reportData as PestContractReport
        if (d.byPestType.length === 0) return []
        return [{ type: 'bar', title: 'Revenue by Pest Type', data: d.byPestType.map(p => ({ label: p.pestType, value: p.revenue })), valueIsCurrency: true }]
      }
      case 'shootBookings': {
        const d = reportData as ShootBookingReport
        if (d.byShootType.length === 0) return []
        return [{ type: 'bar', title: 'Bookings by Shoot Type', data: d.byShootType.map(s => ({ label: s.shootType, value: s.count })) }]
      }
      case 'eventBookings': {
        const d = reportData as EventBookingReport
        if (d.byStatus.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count })) }]
      }
      case 'drawingRegister': {
        const d = reportData as DrawingRegisterReport
        if (d.byStatus.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count })) }]
      }
      case 'siteVisitLog': {
        const d = reportData as SiteVisitLogReport
        if (d.byVisitType.length === 0) return []
        return [{ type: 'bar', title: 'Visits by Type', data: d.byVisitType.map(v => ({ label: v.visitType, value: v.count })) }]
      }
      case 'logistics': {
        const d = reportData as LogisticsReport
        const charts: ReportChart[] = []
        if (d.monthlyTrend.length > 0) charts.push({ type: 'line', title: t('reports.section.shipmentTrend'), data: d.monthlyTrend.map(m => ({ label: m.month, value: m.count })) })
        if (d.topCarriers.length > 0) charts.push({ type: 'bar', title: t('reports.section.topCarriers'), data: d.topCarriers.map(c => ({ label: c.name, value: c.count })) })
        return charts
      }
      case 'attendance': {
        const d = reportData as AttendanceReport
        if (d.byEmployee.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byEmployee'), data: d.byEmployee.map(e => ({ label: e.employeeName, value: e.attendanceRate })) }]
      }
      case 'production': {
        const d = reportData as ProductionReport
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count, color: PRODUCTION_STATUS_COLOR[s.status] ?? STATUS_COLORS.brand })) }]
      }
      case 'landedCostPerUnit': {
        const d = reportData as LandedCostPerUnitReport
        if (d.rows.length === 0) return []
        return [{
          type: 'stackedBar', title: t('reports.summary.landedCostPerUnitByProduct'),
          data: d.rows.map(r => ({
            label: r.productName,
            segments: [
              { value: r.materialCostPerUnit, color: STATUS_COLORS.brand, name: t('reports.col.materialCostPerUnit') },
              { value: r.laborCostPerUnit, color: STATUS_COLORS.success, name: t('reports.col.laborCostPerUnit') },
              { value: r.overheadCostPerUnit, color: STATUS_COLORS.warning, name: t('reports.col.overheadCostPerUnit') },
            ]
          })),
          legend: [
            { name: t('reports.col.materialCostPerUnit'), color: STATUS_COLORS.brand },
            { name: t('reports.col.laborCostPerUnit'), color: STATUS_COLORS.success },
            { name: t('reports.col.overheadCostPerUnit'), color: STATUS_COLORS.warning },
          ]
        }]
      }
      case 'rejectionRateTrend': {
        const d = reportData as RejectionRateTrendReport
        if (d.trend.length === 0) return []
        return [{ type: 'line', title: t('reports.summary.rejectionRateTrend'), data: d.trend.map(p => ({ label: p.month, value: p.rejectionRatePercent })) }]
      }
      case 'seasonalCreditExposure': {
        const d = reportData as SeasonalCreditExposureReport
        if (d.summary.totalOutstanding === 0) return []
        return [{ type: 'line', title: t('reports.summary.seasonalCreditExposureByMonth'), data: d.byMonth.map(p => ({ label: p.month, value: p.outstandingAmount })), valueIsCurrency: true }]
      }
      case 'farmerRepayment': {
        const d = reportData as FarmerRepaymentReport
        if (d.rows.length === 0) return []
        const riskiest = d.rows.slice(0, 10)
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.summary.repaymentRateByFarmer'), data: riskiest.map(r => ({ label: r.customerName, value: r.repaymentRatePercent, color: r.repaymentRatePercent < 50 ? STATUS_COLORS.dangerDeep : STATUS_COLORS.brand })) }]
      }
      case 'serialWarranty': {
        const d = reportData as SerialWarrantyReport
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.section.byWarrantyStatus'), data: d.buckets.map(b => ({ label: t(WARRANTY_BUCKET_LABEL_KEY[b.bucket]), value: b.count, color: WARRANTY_BUCKET_COLOR[b.bucket] })) }]
      }
      case 'rmaAging': {
        const d = reportData as RmaAgingReport
        if (d.rows.length === 0) return []
        const top = d.rows.slice(0, 10)
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.summary.daysWithVendorByUnit'), data: top.map(r => ({ label: `${r.claimNumber} — ${r.productName}`, value: r.daysWithVendor, color: r.isOverdue ? STATUS_COLORS.dangerDeep : STATUS_COLORS.warning })) }]
      }
      case 'vendorRecoveryLedger': {
        const d = reportData as VendorRecoveryLedgerReport
        const top = d.rows.filter(r => !r.isClosed).slice(0, 10)
        if (top.length === 0) return []
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.summary.outstandingByClaim'), data: top.map(r => ({ label: `${r.claimNumber} — ${r.productName}`, value: r.outstandingAmount, color: STATUS_COLORS.dangerDeep })) }]
      }
      case 'repairTurnaroundByTechnician': {
        const d = reportData as RepairTurnaroundByTechnicianReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.summary.avgTurnaroundByTechnician'), data: d.rows.map(r => ({ label: r.technicianName, value: r.avgTurnaroundDays })) }]
      }
      case 'variantStock': {
        const d = reportData as VariantStockReport
        const byProduct = new Map<string, number>()
        for (const r of d.rows) byProduct.set(r.productName, (byProduct.get(r.productName) ?? 0) + r.stockQty)
        const data = Array.from(byProduct.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10)
        return data.length ? [{ type: 'bar', title: t('reports.summary.totalStockQty'), data }] : []
      }
      case 'testScores': {
        // Business-wide aggregate (average % per student) — same "chart the
        // aggregate, not the individual row" rule Phase 54C established;
        // complianceTasks (below) is deliberately left chart-free since it's
        // shaped like a to-do list, not an aggregate metric (same category as
        // the already chart-free Audit Log/Backup reports).
        const d = reportData as TestScoreReport
        const data = d.studentSummaries.slice(0, 10).map(s => ({ label: s.studentName, value: s.averagePercentage }))
        return data.length ? [{ type: 'bar', orientation: 'vertical', title: t('reports.section.byStudent'), data }] : []
      }
      case 'cashPositionTrend': {
        const d = reportData as CashPositionTrendReport
        if (d.points.length === 0) return []
        return [{ type: 'line', title: t('reports.summary.cashPositionTrend'), data: d.points.map(p => ({ label: p.date, value: p.balance })), valueIsCurrency: true }]
      }
      default: return []
    }
  }

  function selectReport(id: ReportType) {
    setActiveReport(id)
    setReportData(null)
    setHasRun(false)
  }

  return (
    <div className="flex h-full">
      {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="w-64 border-e border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
              <BarChart3 size={16} className="text-brand" />
            </div>
            <h1 className="text-base font-bold text-dark dark:text-slate-100">{t('nav.reports')}</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {CATEGORY_IDS.map(cat => {
            const defs = REPORT_DEFS.filter(r => {
              if (r.category === 'gst' && taxModel !== 'GST') return false
              if (r.requiredModule && !isModuleEnabled(r.requiredModule)) return false
              if (r.requiredBusinessType) {
                const allowed = Array.isArray(r.requiredBusinessType) ? r.requiredBusinessType : [r.requiredBusinessType]
                if (!allowed.includes(businessType)) return false
              }
              if (r.permission && !hasPermission(r.permission)) return false
              return r.category === cat
            })
            if (!defs.length) return null
            return (
              <div key={cat}>
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">{t(`reports.categories.${cat}`)}</div>
                {defs.map(r => (
                  <button key={r.id} onClick={() => selectReport(r.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors',
                      activeReport === r.id
                        ? 'bg-brand/10 text-brand border-e-2 border-brand'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}>
                    <span className={cn('shrink-0', activeReport === r.id ? 'text-brand' : 'text-slate-400 dark:text-slate-500')}>{r.icon}</span>
                    <span className="text-sm font-medium truncate">{r.label}</span>
                    <ChevronRight size={12} className={cn('ms-auto shrink-0 transition-opacity', activeReport === r.id ? 'opacity-100 text-brand' : 'opacity-0')} />
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-dark dark:text-slate-100">{def.label}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{def.description}</p>
            </div>

            {!!reportData && (
              <div className="flex items-center gap-2">
                <button onClick={handleExportCsv} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Table size={12} /> CSV
                </button>
                <button onClick={handleExportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-success hover:text-success transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Download size={12} /> Excel
                </button>
                <button onClick={handleExportPdf} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-danger hover:text-danger transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <FileText size={12} /> PDF
                </button>
                {def.permission && hasPermission(def.permission) && (
                  <ShareMenu
                    variant="button"
                    recipientPhone={null}
                    recipientEmail={null}
                    buildWhatsAppMessage={buildReportShareWhatsAppMessage}
                    buildEmailSubject={buildReportShareEmailSubject}
                    buildEmailBody={buildReportShareEmailBody}
                    onExportPdf={handleExportPdfForShare}
                    disabled={exporting}
                  />
                )}
              </div>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-end gap-3">
            {def.requiresDateRange && activeReport !== 'commission' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateFrom')}</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateTo')}</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </>
            )}

            {/* Commission Report is filtered by calendar month (StaffCommission.period is YYYY-MM),
                not by day — a day-level date picker would silently return a whole month's data for
                a narrow range, so this report gets month pickers instead. */}
            {def.requiresDateRange && activeReport === 'commission' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateFrom')}</label>
                  <input type="month" value={dateFrom.slice(0, 7)} onChange={e => setDateFrom(`${e.target.value}-01`)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateTo')}</label>
                  <input type="month" value={dateTo.slice(0, 7)} onChange={e => {
                    const v = e.target.value
                    const [y, m] = v.split('-').map(Number)
                    const lastDay = new Date(y, m, 0).getDate()
                    setDateTo(`${v}-${String(lastDay).padStart(2, '0')}`)
                  }}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </>
            )}

            {activeReport === 'appointmentUtilisation' && (
              <Select label={t('reports.col.provider')} value={providerId} onChange={e => setProviderId(e.target.value)}>
                <option value="">{t('common.all')}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
            )}

            {activeReport === 'commission' && (
              <Select label={t('reports.col.staff')} value={staffId} onChange={e => setStaffId(e.target.value)}>
                <option value="">{t('common.all')}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </Select>
            )}

            {activeReport === 'sales' && (
              <Select label={t('reports.groupBy')} value={groupBy} onChange={e => setGroupBy(e.target.value as typeof groupBy)}>
                <option value="day">{t('reports.day')}</option>
                <option value="week">{t('reports.week')}</option>
                <option value="month">{t('reports.month')}</option>
                <option value="year">{t('reports.year')}</option>
              </Select>
            )}

            {activeReport === 'inventory' && (
              <label className="flex items-center gap-2 text-sm text-slate-600 mt-5 cursor-pointer select-none">
                <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand" />
                {t('inventory.lowStock')}
              </label>
            )}

            {def.requiresEntity === 'customer' && (
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('nav.customers')}</label>
                <input value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); searchCustomers(e.target.value) }}
                  placeholder={t('customers.searchCustomers')}
                  className="h-9 w-52 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                {customerResults.length > 0 && (
                  <div className="absolute top-full start-0 z-20 mt-1 w-52 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                    {customerResults.slice(0, 8).map(c => (
                      <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.customerName); setCustomerResults([]) }}
                        className="w-full text-start px-3 py-2 text-sm dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {c.customerName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {def.requiresEntity === 'supplier' && (
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('nav.suppliers')}</label>
                <input value={supplierSearch}
                  onChange={e => { setSupplierSearch(e.target.value); searchSuppliers(e.target.value) }}
                  placeholder={t('suppliers.searchSuppliers')}
                  className="h-9 w-52 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                {supplierResults.length > 0 && (
                  <div className="absolute top-full start-0 z-20 mt-1 w-52 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                    {supplierResults.slice(0, 8).map(s => (
                      <button key={s.id} onClick={() => { setSupplierId(s.id); setSupplierSearch(s.supplierName); setSupplierResults([]) }}
                        className="w-full text-start px-3 py-2 text-sm dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {s.supplierName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Optional date range for non-date-required, non-simple reports */}
            {!def.requiresDateRange && activeReport !== 'inventory' && activeReport !== 'outstanding' && activeReport !== 'backup' && activeReport !== 'batchExpiry' && activeReport !== 'bloodStock' && activeReport !== 'serialWarranty' && activeReport !== 'variantStock' && activeReport !== 'complianceTasks' && activeReport !== 'rmaAging' && activeReport !== 'vendorRecoveryLedger' && activeReport !== 'repairTurnaroundByTechnician' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateFrom')}</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.dateTo')}</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </>
            )}

            <button onClick={runReport} disabled={loading}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-60 transition-colors mt-auto">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Calendar size={14} />}
              {loading ? t('common.loading') : t('reports.generate')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!hasRun ? (
            <EmptyState title={t('reports.selectReport')} subtitle={t('reports.generate')} />
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !reportData ? (
            <EmptyState title={t('reports.noData')} subtitle={t('common.tryAgain')} />
          ) : (
            <ReportContent reportType={activeReport} data={reportData} fmt={fmt} onAuditPageChange={goToAuditPage} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
      <BarChart3 size={40} className="opacity-20" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-xs">{subtitle}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Cards
// ─────────────────────────────────────────────────────────────────────────────

// Not converted to the shared KpiCard: several callers pass a `sub` line
// (e.g. cancelled-invoice count, at-risk count) that KpiCard's fixed
// value+label shape has no slot for — forcing it through KpiCard would
// silently drop that data. Card still removes the hand-rolled border/bg/rounded
// strings; only the value+label layout stays bespoke to keep the sub line.
function SummaryCards({ cards }: { cards: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <Card key={c.label} padding="md">
          <div className="text-xs font-semibold text-slate-400 uppercase mb-1">{c.label}</div>
          <div className="text-xl font-bold text-dark dark:text-slate-100">{c.value}</div>
          {c.sub && <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>}
        </Card>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Table
// ─────────────────────────────────────────────────────────────────────────────

function DataTable({ headers, rows, emptyText = 'No records found.' }: {
  headers: string[]
  rows: (string | number | null | undefined)[][]
  emptyText?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 italic text-center py-8">{emptyText}</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            {headers.map(h => (
              <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">{cell ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Content dispatcher
// ─────────────────────────────────────────────────────────────────────────────

function ReportContent({ reportType, data, fmt, onAuditPageChange }: {
  reportType: ReportType; data: unknown
  fmt: (n: number) => string
  onAuditPageChange: (page: number) => void
}) {
  switch (reportType) {
    case 'sales': return <SalesReportView data={data as SalesReport} fmt={fmt} />
    case 'inventory': return <InventoryReportView data={data as InventoryReport} fmt={fmt} />
    case 'tax': return <TaxReportView data={data as TaxReport} fmt={fmt} />
    case 'outstanding': return <OutstandingReportView data={data as OutstandingReport} fmt={fmt} />
    case 'customerLedger': return <LedgerReportView data={data as CustomerLedgerReport} entityType="customer" fmt={fmt} />
    case 'supplierLedger': return <LedgerReportView data={data as CustomerLedgerReport} entityType="supplier" fmt={fmt} />
    case 'expenses': return <ExpenseReportView data={data as ExpenseReport} fmt={fmt} />
    case 'profitAndLoss': return <ProfitAndLossView data={data as ProfitAndLossReport} fmt={fmt} />
    case 'cashBook': return <CashBookView data={data as CashBookReport} fmt={fmt} />
    case 'trialBalance': return <TrialBalanceView data={data as TrialBalanceReport} fmt={fmt} />
    case 'audit': return <AuditReportView data={data as AuditReport} onPageChange={onAuditPageChange} />
    case 'backup': return <BackupReportView data={data as unknown[]} />
    case 'foodCost': return <FoodCostReportView data={data as FoodCostReport} fmt={fmt} />
    case 'dishContributionMargin': return <DishContributionMarginView data={data as DishContributionMarginReport} fmt={fmt} />
    case 'tableTurnoverByHour': return <TableTurnoverHeatmapView data={data as TableTurnoverByHourReport} />
    case 'recipeWasteVariance': return <RecipeWasteVarianceView data={data as RecipeWasteVarianceReport} />
    case 'deadStockClearance': return <DeadStockClearanceView data={data as DeadStockClearanceReport} fmt={fmt} />
    case 'categorySellThrough': return <CategorySellThroughView data={data as CategorySellThroughReport} />
    case 'seasonSellThrough': return <SeasonSellThroughView data={data as SeasonSellThroughReport} />
    case 'sizeStyleHeatmap': return <SizeStyleHeatmapView data={data as SizeStyleHeatmapReport} />
    case 'sizeAvailabilityHeatmap': return <SizeAvailabilityHeatmapView data={data as SizeAvailabilityHeatmapReport} />
    case 'seasonalReorderCalendar': return <SeasonalReorderCalendarView data={data as SeasonalCalendarEntry[]} />
    case 'basketComposition': return <BasketCompositionView data={data as BasketCompositionReport} />
    case 'categoryMix': return <CategoryMixView data={data as CategoryMixReport} />
    case 'vendorMargin': return <VendorMarginView data={data as VendorMarginReport} />
    case 'brandMarginReturnRate': return <BrandMarginReturnRateView data={data as BrandMarginReturnRateReport} />
    case 'fastSlowMoverMatrix': return <FastSlowMoverMatrixView data={data as FastSlowMoverMatrixReport} />
    case 'gstr1': return <GSTR1ReportView data={data as GSTR1Report} fmt={fmt} />
    case 'hsnSummary': return <HSNSummaryView data={data as HSNSummaryReport} fmt={fmt} />
    case 'documentSummary': return <DocumentSummaryView data={data as DocumentSummaryReport} />
    case 'gstr3bPreview': return <GSTR3BPreviewView data={data as GSTR3BPreview} fmt={fmt} />
    case 'rentalStatus': return <RentalStatusView data={data as RentalStatusReport} />
    case 'rentalRevenue': return <RentalRevenueView data={data as RentalRevenueReport} fmt={fmt} />
    case 'assetUtilization': return <AssetUtilizationView data={data as AssetUtilizationReport} />
    case 'stylistRepeatClient': return <StylistRepeatClientView data={data as StylistRepeatClientReport} />
    case 'retailAttachRate': return <RetailAttachRateView data={data as RetailAttachRateReport} />
    case 'membershipRenewalFunnel': return <MembershipRenewalFunnelView data={data as MembershipRenewalFunnelReport} />
    case 'classAttendanceHeatmap': return <ClassAttendanceHeatmapView data={data as ClassAttendanceHeatmapReport} />
    case 'learnerProgressFunnel': return <LearnerProgressFunnelView data={data as LearnerProgressFunnelReport} />
    case 'hotelOccupancy': return <HotelOccupancyView data={data as HotelOccupancyReport} />
    case 'hotelGuestRegister': return <HotelGuestRegisterView data={data as HotelGuestRegisterReport} />
    case 'appointmentUtilisation': return <AppointmentUtilisationView data={data as AppointmentUtilisationReport} />
    case 'clientRetention': return <ClientRetentionView data={data as ClientRetentionReport} />
    case 'commission': return <CommissionReportView data={data as CommissionReport} fmt={fmt} />
    case 'orderVolume': return <OrderVolumeView data={data as OrderVolumeReport} />
    case 'discounts': return <DiscountsView data={data as DiscountReport} fmt={fmt} />
    case 'purchaseRegister': return <PurchaseRegisterView data={data as PurchaseRegisterReport} fmt={fmt} />
    case 'purchasesByVendor': return <PurchasesByVendorView data={data as PurchasesByVendorReport} fmt={fmt} />
    case 'purchasesByItem': return <PurchasesByItemView data={data as PurchasesByItemReport} fmt={fmt} />
    case 'apAging': return <ApAgingView data={data as ApAgingReport} fmt={fmt} />
    case 'costCentreTreemap': return <CostCentreTreemapView data={data as CostCentreTreemapReport} fmt={fmt} />
    case 'budgetVsActual': return <BudgetVsActualView data={data as BudgetVsActualReport} fmt={fmt} />
    case 'statutoryComplianceSummary': return <StatutoryComplianceSummaryView data={data as StatutoryComplianceSummaryReport} fmt={fmt} />
    case 'cashFlowProjection': return <CashFlowProjectionView data={data as CashFlowProjectionReport} fmt={fmt} />
    case 'cashPositionTrend': return <CashPositionTrendView data={data as CashPositionTrendReport} fmt={fmt} />
    case 'paymentPerformance': return <PaymentPerformanceView data={data as PaymentPerformanceReport} fmt={fmt} />
    case 'batchExpiry': return <BatchExpiryView data={data as BatchExpiryReport} fmt={fmt} />
    case 'labThroughput': return <LabThroughputView data={data as LabThroughputReport} />
    case 'bloodStock': return <BloodStockView data={data as BloodStockReport} />
    case 'donationToIssueCycleTime': return <DonationToIssueCycleTimeView data={data as DonationToIssueCycleTimeReport} />
    case 'jewellery': return <JewelleryView data={data as JewelleryReport} fmt={fmt} />
    case 'makingChargeMargin': return <MakingChargeMarginView data={data as MakingChargeMarginReport} fmt={fmt} />
    case 'hallmarkCompliance': return <HallmarkComplianceView data={data as HallmarkComplianceReport} />
    case 'metalRateVsSalesVolume': return <MetalRateVsSalesVolumeView data={data as MetalRateVsSalesVolumeReport} />
    case 'purityAdjustedExchange': return <PurityAdjustedExchangeView data={data as PurityAdjustedExchangeReport} fmt={fmt} />
    case 'projects': return <ProjectReportView data={data as ProjectReport} fmt={fmt} />
    case 'serviceResolutionTime': return <ServiceResolutionTimeView data={data as ServiceResolutionTimeReport} />
    case 'repeatBusinessRate': return <RepeatBusinessRateView data={data as RepeatBusinessRateReport} />
    case 'consultantUtilization': return <ConsultantUtilizationView data={data as ConsultantUtilizationReport} />
    case 'clientProfitability': return <ClientProfitabilityView data={data as ClientProfitabilityReport} />
    case 'jobCardTurnaroundByTechnician': return <JobCardTurnaroundByTechnicianView data={data as JobCardTurnaroundByTechnicianReport} />
    case 'repairCategoryVolumeTrend': return <RepairCategoryVolumeTrendView data={data as RepairCategoryVolumeTrendReport} />
    case 'fieldRepLeaderboard': return <FieldRepLeaderboardView data={data as FieldRepLeaderboardReport} fmt={fmt} />
    case 'serviceProjects': return <ServiceProjectReportView data={data as ServiceProjectReport} fmt={fmt} />
    case 'jobCards': return <JobCardReportView data={data as JobCardReport} fmt={fmt} />
    case 'carJobCards': return <CarJobCardReportView data={data as CarJobCardReport} fmt={fmt} />
    case 'tailoringOrders': return <TailoringOrderReportView data={data as TailoringOrderReport} fmt={fmt} />
    case 'pestContracts': return <PestContractReportView data={data as PestContractReport} fmt={fmt} />
    case 'realEstatePipeline': return <RealEstatePipelineReportView data={data as RealEstatePipelineReport} fmt={fmt} />
    case 'retainers': return <RetainerReportView data={data as RetainerReport} fmt={fmt} />
    case 'shootBookings': return <ShootBookingReportView data={data as ShootBookingReport} fmt={fmt} />
    case 'eventBookings': return <EventBookingReportView data={data as EventBookingReport} fmt={fmt} />
    case 'placements': return <PlacementReportView data={data as PlacementReport} fmt={fmt} />
    case 'drawingRegister': return <DrawingRegisterReportView data={data as DrawingRegisterReport} fmt={fmt} />
    case 'siteVisitLog': return <SiteVisitLogReportView data={data as SiteVisitLogReport} fmt={fmt} />
    case 'prescriptionDrugSales': return <PrescriptionDrugSalesReportView data={data as PrescriptionDrugSalesReport} fmt={fmt} />
    case 'scheduleH1XRegister': return <ScheduleH1XRegisterView data={data as ScheduleH1XRegisterReport} />
    case 'schemeCostVsVolume': return <SchemeCostVsVolumeView data={data as SchemeCostVsVolumeReport} fmt={fmt} />
    case 'chronicRecallCompliance': return <ChronicRecallComplianceView data={data as ChronicRecallComplianceReport} />
    case 'walkInVsAppointmentRatio': return <WalkInVsAppointmentRatioView data={data as WalkInVsAppointmentRatioReport} />
    case 'diagnosisCategoryTrend': return <DiagnosisCategoryTrendView data={data as DiagnosisCategoryTrendReport} />
    case 'referralOutcome': return <ReferralOutcomeView data={data as ReferralOutcomeReport} />
    case 'packUtilization': return <PackUtilizationView data={data as PackUtilizationReport} />
    case 'labTAT': return <LabTATView data={data as LabTATReport} />
    case 'testVolumeByPanel': return <TestVolumeByPanelView data={data as TestVolumeByPanelReport} />
    case 'referralLeaderboard': return <ReferralLeaderboardView data={data as ReferralLeaderboardReport} />
    case 'secondOpinionConversion': return <SecondOpinionConversionView data={data as SecondOpinionConversionReport} />
    case 'caseComplexityMix': return <CaseComplexityMixView data={data as CaseComplexityMixReport} />
    case 'treatmentAcceptanceRate': return <TreatmentAcceptanceRateView data={data as TreatmentAcceptanceRateReport} />
    case 'dentalRecallCompliance': return <DentalRecallComplianceView data={data as DentalRecallComplianceReport} />
    case 'vaccinationCompliance': return <VaccinationComplianceView data={data as VaccinationComplianceReport} />
    case 'vetCaseTypeVolume': return <VetCaseTypeVolumeView data={data as VetCaseTypeVolumeReport} />
    case 'logistics': return <LogisticsView data={data as LogisticsReport} fmt={fmt} />
    case 'attendance': return <AttendanceView data={data as AttendanceReport} />
    case 'production': return <ProductionView data={data as ProductionReport} />
    case 'landedCostPerUnit': return <LandedCostPerUnitView data={data as LandedCostPerUnitReport} fmt={fmt} />
    case 'rejectionRateTrend': return <RejectionRateTrendView data={data as RejectionRateTrendReport} />
    case 'seasonalCreditExposure': return <SeasonalCreditExposureView data={data as SeasonalCreditExposureReport} fmt={fmt} />
    case 'farmerRepayment': return <FarmerRepaymentView data={data as FarmerRepaymentReport} fmt={fmt} />
    case 'serialWarranty': return <SerialWarrantyView data={data as SerialWarrantyReport} />
    case 'rmaAging': return <RmaAgingView data={data as RmaAgingReport} />
    case 'vendorRecoveryLedger': return <VendorRecoveryLedgerView data={data as VendorRecoveryLedgerReport} />
    case 'repairTurnaroundByTechnician': return <RepairTurnaroundByTechnicianView data={data as RepairTurnaroundByTechnicianReport} />
    case 'variantStock': return <VariantStockView data={data as VariantStockReport} />
    case 'testScores': return <TestScoreView data={data as TestScoreReport} />
    case 'complianceTasks': return <ComplianceTaskView data={data as ComplianceTaskReport} />
    default: return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Report Views
// ─────────────────────────────────────────────────────────────────────────────

function SalesReportView({ data, fmt }: { data: SalesReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRevenue'), value: fmt(s.totalRevenue) },
        { label: t('reports.summary.totalInvoices'), value: String(s.totalInvoices) },
        { label: t('reports.summary.totalTaxAmount'), value: fmt(s.totalTax) },
        { label: t('reports.summary.avgOrderValue'), value: fmt(s.averageOrderValue), sub: t('reports.summary.cancelledSuffix', { count: s.cancelledInvoices }) }
      ]} />
      {data.groups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.summaryByGroup', { groupBy: t(`reports.${data.groupBy}`) })}</h3>
          <DataTable
            headers={[t('reports.col.period'), t('common.revenue'), t('reports.col.invoiceCount'), t('common.tax')]}
            rows={data.groups.map(g => [g.label, fmt(g.revenue), g.invoiceCount, fmt(g.taxAmount)])}
          />
        </div>
      )}
      {data.byHour.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.salesByHour')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byHour} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={CHART_TICK} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => fmt(value)} />
              <Bar dataKey="revenue" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.invoiceDetails', { count: data.total })}</h3>
        <DataTable
          headers={[t('reports.col.invoiceNo'), t('common.date'), t('reports.col.customer'), t('reports.col.items'), t('common.subtotal'), t('common.discount'), t('common.tax'), t('common.total'), t('reports.col.method'), t('common.status')]}
          rows={data.rows.map(r => [
            r.invoiceNumber, r.date, r.customer ?? t('reports.val.walkIn'), r.itemCount,
            fmt(r.subtotal), fmt(r.discountAmount), fmt(r.taxAmount), fmt(r.totalAmount),
            r.paymentMethod, r.paymentStatus
          ])}
          emptyText={t('reports.empty.invoices')}
        />
      </div>
    </div>
  )
}

function InventoryReportView({ data, fmt }: { data: InventoryReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalProducts'), value: String(s.totalProducts) },
        { label: t('reports.summary.stockValue'), value: fmt(s.totalStockValue) },
        { label: t('reports.summary.lowStock'), value: String(s.lowStockItems), sub: t('reports.summary.lowStockSub') },
        { label: t('reports.summary.outOfStock'), value: String(s.outOfStockItems) }
      ]} />
      <DataTable
        headers={[t('reports.col.sku'), t('reports.col.product'), t('reports.col.category'), t('reports.col.type'), t('reports.col.stock'), t('common.unit'), t('reports.col.costShort'), t('reports.col.sellPriceShort'), t('reports.col.valueShort'), t('reports.col.alert')]}
        rows={data.rows.map(r => [
          r.sku, r.productName, r.category, r.productType,
          // Phase 67 §9.1 — Hardware: reframe the flat piece count into
          // carton terms for any product genuinely sold by pack, so a
          // shop owner sees "6 cartons + 20 pcs" instead of a bare 320.
          r.cartonBreakdown
            ? `${r.currentStock} (${t('reports.val.cartonsAndPieces', { cartons: r.cartonBreakdown.fullCartons, pieces: r.cartonBreakdown.loosePieces })})`
            : r.currentStock,
          r.unit,
          fmt(r.costPrice), fmt(r.sellingPrice), fmt(r.stockValue),
          r.lowStockAlert ? t('reports.val.lowFlag') : ''
        ])}
        emptyText={t('reports.empty.products')}
      />
    </div>
  )
}

function TaxReportView({ data, fmt }: { data: TaxReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalTaxable'), value: fmt(s.totalTaxableAmount) },
        { label: t('reports.summary.taxCollected'), value: fmt(s.totalTaxCollected) }
      ]} />
      <DataTable
        headers={[t('reports.col.taxName'), t('reports.col.type'), t('reports.col.ratePercent'), t('reports.col.taxableAmount'), t('reports.summary.taxCollected'), t('reports.col.invoiceCount')]}
        rows={data.rows.map(r => [r.taxName, r.taxType, `${r.rate}%`, fmt(r.taxableAmount), fmt(r.taxCollected), r.invoiceCount])}
        emptyText={t('reports.empty.taxable')}
      />
    </div>
  )
}

function AgingSummary({ aging, fmt }: { aging: AgingBuckets; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-5 gap-3 mb-4">
      {([
        ['reports.aging.current', aging.current],
        ['reports.aging.days1to30', aging.days1to30],
        ['reports.aging.days31to60', aging.days31to60],
        ['reports.aging.days61to90', aging.days61to90],
        ['reports.aging.days90plus', aging.days90plus]
      ] as const).map(([key, value]) => (
        <div key={key} className={cn(
          'rounded-lg border p-3 text-center',
          value > 0 && key === 'reports.aging.days90plus' ? 'border-danger/30 bg-danger/5' : 'border-slate-200 dark:border-slate-700'
        )}>
          <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">{t(key)}</div>
          <div className="text-sm font-bold text-dark dark:text-slate-100">{fmt(value)}</div>
        </div>
      ))}
    </div>
  )
}

function OutstandingReportView({ data, fmt }: { data: OutstandingReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.customerOutstanding'), value: fmt(data.customers.totalOutstanding), sub: t('reports.summary.customersSuffix', { count: data.customers.count }) },
        { label: t('reports.summary.supplierPayables'), value: fmt(data.suppliers.totalOutstanding), sub: t('reports.summary.suppliersSuffix', { count: data.suppliers.count }) }
      ]} />
      <div>
        <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.customerDues')}</h3>
        <AgingSummary aging={data.customers.agingTotals} fmt={fmt} />
        <DataTable
          headers={[t('reports.col.customer'), t('common.phone'), t('reports.col.outstanding'), t('reports.aging.current'), t('reports.aging.d1to30Short'), t('reports.aging.d31to60Short'), t('reports.aging.d61to90Short'), t('reports.aging.d90plusShort')]}
          rows={data.customers.rows.map(r => [
            r.customerName, r.phone, fmt(r.outstanding),
            fmt(r.aging.current), fmt(r.aging.days1to30), fmt(r.aging.days31to60), fmt(r.aging.days61to90), fmt(r.aging.days90plus)
          ])}
          emptyText={t('reports.empty.customerOutstanding')}
        />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.summary.supplierPayables')}</h3>
        <AgingSummary aging={data.suppliers.agingTotals} fmt={fmt} />
        <DataTable
          headers={[t('reports.col.supplier'), t('common.phone'), t('reports.col.payable'), t('reports.aging.current'), t('reports.aging.d1to30Short'), t('reports.aging.d31to60Short'), t('reports.aging.d61to90Short'), t('reports.aging.d90plusShort')]}
          rows={data.suppliers.rows.map(r => [
            r.supplierName, r.phone, fmt(r.outstanding),
            fmt(r.aging.current), fmt(r.aging.days1to30), fmt(r.aging.days31to60), fmt(r.aging.days61to90), fmt(r.aging.days90plus)
          ])}
          emptyText={t('reports.empty.supplierOutstanding')}
        />
      </div>
    </div>
  )
}

function LedgerReportView({ data, entityType, fmt }: {
  data: CustomerLedgerReport
  entityType: 'customer' | 'supplier'; fmt: (n: number) => string
}) {
  const { t } = useTranslation()
  const entity = entityType === 'customer' ? data.customer : data.supplier
  const name = entity ? ('customerName' in entity ? entity.customerName : (entity as { supplierName: string }).supplierName) : '—'
  const phone = entity && 'phone' in entity ? (entity as { phone?: string | null }).phone : undefined

  return (
    <div className="space-y-6">
      <Card padding="md" className="flex flex-wrap gap-6">
        <div>
          <div className="text-xs text-slate-400 font-semibold uppercase mb-1">{entityType === 'customer' ? t('reports.col.customer') : t('reports.col.supplier')}</div>
          <div className="text-sm font-semibold text-dark">{name}</div>
          {phone && <div className="text-xs text-slate-400">{phone}</div>}
        </div>
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.openingBalance')}</div><div className="text-sm font-semibold text-dark">{fmt(data.openingBalance)}</div></div>
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.totalDebit')}</div><div className="text-sm font-semibold text-danger">{fmt(data.totalDebit)}</div></div>
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.totalCredit')}</div><div className="text-sm font-semibold text-success">{fmt(data.totalCredit)}</div></div>
        <div>
          <div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.closingBalance')}</div>
          <div className={cn('text-sm font-bold', data.closingBalance > 0 ? 'text-danger' : 'text-success')}>{fmt(data.closingBalance)}</div>
        </div>
      </Card>
      {/* REAL BUG found+fixed 2026-07-30: these three cells used raw .toFixed(2)
          — no digit grouping, and always 2 decimals regardless of currency —
          while every other amount on this same screen (the summary cards
          above, and every other report view in this file) goes through fmt()
          (Intl.NumberFormat-based, via currency.util.ts's formatCurrency).
          Fixed to match; header currency-symbol suffixes removed to match
          the rest of this file's convention (symbol lives in fmt()'s output,
          not duplicated into the header) — see ExpenseReportView below for
          the same convention already in use. */}
      {/* Phase 67 §9.1 — Hardware: the "contractor monthly statement" items
          resolved to this SAME pre-existing ledger report (Phase 61) — the
          running-account behavior and PDF export (via this screen's own
          ShareMenu, already available on every report) were already fully
          built; the one genuinely missing piece was a running-balance trend
          visualization, added here for both Customer AND Supplier ledgers
          since they share this one component.
          Real bug found via live stress-test verification (not a unit test —
          mocked data never exercises real scale): plotting one point per
          ledger row crashed the renderer entirely on a 5,000-row account
          (thousands of XAxis category tick labels is a known Recharts
          performance cliff). A real contractor account in normal use never
          approaches this, but must degrade gracefully rather than crash.
          Fixed by evenly sampling down to at most MAX_CHART_POINTS rows —
          the opening-balance point and the true final balance are always
          kept, so the trend's start/end are never distorted by sampling,
          only its interior resolution. */}
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('reports.summary.balanceTrend')}</h3>
          {data.rows.length > LEDGER_CHART_MAX_POINTS && (
            <p className="text-xs text-slate-400 mb-3">{t('reports.summary.balanceTrendSampledNote')}</p>
          )}
          <ResponsiveContainer width="100%" height={220}>
            <RCLineChart data={[{ label: t('reports.col.openingBalance'), balance: data.openingBalance }, ...sampleLedgerRowsForChart(data.rows).map(r => ({ label: formatDate(r.date), balance: r.balance }))]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ ...CHART_TICK, fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmt(v)} width={70} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="balance" name={t('common.balance')} stroke={STATUS_COLORS.brand} strokeWidth={2} dot={false} isAnimationActive={false} />
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('common.date'), t('reports.col.reference'), t('reports.col.refId'), t('common.debit'), t('common.credit'), t('common.balance'), t('reports.col.remarks')]}
        rows={data.rows.map(r => [
          formatDate(r.date), r.referenceType, r.referenceId,
          r.debitAmount > 0 ? fmt(r.debitAmount) : '',
          r.creditAmount > 0 ? fmt(r.creditAmount) : '',
          fmt(r.balance), r.remarks
        ])}
        emptyText={t('reports.empty.ledgerEntries')}
      />
    </div>
  )
}

function ExpenseReportView({ data, fmt }: { data: ExpenseReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalExpenses'), value: fmt(data.summary.totalAmount) },
        { label: t('reports.summary.records'), value: String(data.summary.expenseCount) }
      ]} />
      {data.byCategory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.byCategory')}</h3>
          <DataTable
            headers={[t('reports.col.category'), t('common.amount'), t('reports.col.count')]}
            rows={data.byCategory.map(c => [c.category, fmt(c.amount), c.count])}
          />
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.expenseDetails')}</h3>
        <DataTable
          headers={[t('common.date'), t('reports.col.expense'), t('reports.col.category'), t('reports.col.method'), t('common.amount'), t('reports.col.remarks'), t('reports.col.recordedBy')]}
          rows={data.rows.map(r => [r.date, r.expenseName, r.category, r.paymentMethod, fmt(r.amount), r.remarks, r.recordedBy])}
          emptyText={t('reports.empty.expenses')}
        />
      </div>
    </div>
  )
}

// Fresh-audit fix (2026-07-12) — a real statement layout (Revenue, less
// COGS, = Gross Profit, less Expenses, = Net Profit), not a generic
// DataTable, since this is meant to be handed to an accountant.
function ProfitAndLossView({ data, fmt }: { data: ProfitAndLossReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  const netPositive = s.netProfit >= 0
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.revenue'), value: fmt(s.revenue) },
        { label: t('reports.summary.grossProfit'), value: `${fmt(s.grossProfit)} (${s.grossMarginPercent}%)` },
        { label: t('reports.summary.totalExpenses'), value: fmt(s.totalExpenses) },
        { label: t('reports.summary.netProfit'), value: `${fmt(s.netProfit)} (${s.netMarginPercent}%)` }
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('reports.summary.revenue')}</span>
            <span className="text-sm font-semibold text-dark dark:text-slate-100">{fmt(s.revenue)}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('reports.summary.cogs')}</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">({fmt(s.cogs)})</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sm font-semibold text-dark dark:text-slate-100">{t('reports.summary.grossProfit')}</span>
            <span className="text-sm font-semibold text-dark dark:text-slate-100">{fmt(s.grossProfit)} <span className="text-xs text-slate-400 font-normal">({s.grossMarginPercent}%)</span></span>
          </div>
          {data.expensesByCategory.map(c => (
            <div key={c.category} className="flex items-center justify-between px-5 py-2.5 ps-8">
              <span className="text-sm text-slate-500 dark:text-slate-400">{c.category}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">({fmt(c.amount)})</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('reports.summary.totalExpenses')}</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">({fmt(s.totalExpenses)})</span>
          </div>
          <div className={cn('flex items-center justify-between px-5 py-4', netPositive ? 'bg-success/5' : 'bg-danger/5')}>
            <span className="text-base font-bold text-dark dark:text-slate-100">{t('reports.summary.netProfit')}</span>
            <span className={cn('text-base font-bold', netPositive ? 'text-success' : 'text-danger')}>{fmt(s.netProfit)} <span className="text-xs font-normal">({s.netMarginPercent}%)</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

function CashBookView({ data, fmt }: { data: CashBookReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <Card padding="md" className="flex flex-wrap gap-6">
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.openingBalance')}</div><div className="text-sm font-semibold text-dark dark:text-slate-100">{fmt(data.openingBalance)}</div></div>
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.in')}</div><div className="text-sm font-semibold text-success">{fmt(data.totalIn)}</div></div>
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.out')}</div><div className="text-sm font-semibold text-danger">{fmt(data.totalOut)}</div></div>
        <div>
          <div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('reports.col.closingBalance')}</div>
          <div className={cn('text-sm font-bold', data.closingBalance >= 0 ? 'text-success' : 'text-danger')}>{fmt(data.closingBalance)}</div>
        </div>
      </Card>
      {/* REAL BUG found+fixed 2026-07-30: same fix as LedgerReportView above —
          raw .toFixed(2) had no digit grouping and always 2 decimals
          regardless of currency; routed through fmt() to match. */}
      <DataTable
        headers={[t('common.date'), t('reports.col.description'), t('reports.col.method'), t('reports.col.in'), t('reports.col.out'), t('common.balance')]}
        rows={data.entries.map(e => [
          formatDate(e.date), e.description, e.paymentMethod,
          e.type === 'IN' ? fmt(e.amount) : '',
          e.type === 'OUT' ? fmt(e.amount) : '',
          fmt(e.runningBalance)
        ])}
        emptyText={t('reports.empty.ledgerEntries')}
      />
    </div>
  )
}

function TrialBalanceView({ data, fmt }: { data: TrialBalanceReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <Card padding="md" className="flex flex-wrap items-center gap-6">
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('common.debit')}</div><div className="text-sm font-semibold text-dark dark:text-slate-100">{fmt(data.totalDebit)}</div></div>
        <div><div className="text-xs text-slate-400 font-semibold uppercase mb-1">{t('common.credit')}</div><div className="text-sm font-semibold text-dark dark:text-slate-100">{fmt(data.totalCredit)}</div></div>
        <Badge variant={data.balanced ? 'success' : 'danger'}>{data.balanced ? t('reports.summary.balanced') : t('reports.summary.notBalanced')}</Badge>
      </Card>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400 font-semibold uppercase">
              <th className="text-start px-5 py-3">{t('reports.col.account')}</th>
              <th className="text-end px-5 py-3">{t('common.debit')}</th>
              <th className="text-end px-5 py-3">{t('common.credit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.rows.map((r) => (
              <tr key={r.account}>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{r.account}</td>
                <td className="px-5 py-3 text-end text-dark dark:text-slate-100">{r.debit > 0 ? fmt(r.debit) : ''}</td>
                <td className="px-5 py-3 text-end text-dark dark:text-slate-100">{r.credit > 0 ? fmt(r.credit) : ''}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold">
              <td className="px-5 py-4 text-dark dark:text-slate-100">{t('common.total')}</td>
              <td className="px-5 py-4 text-end text-dark dark:text-slate-100">{fmt(data.totalDebit)}</td>
              <td className="px-5 py-4 text-end text-dark dark:text-slate-100">{fmt(data.totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditReportView({ data, onPageChange }: { data: AuditReport; onPageChange: (page: number) => void }) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(data.totalRecords / data.limit))
  const rangeStart = data.totalRecords === 0 ? 0 : (data.page - 1) * data.limit + 1
  const rangeEnd = Math.min(data.page * data.limit, data.totalRecords)

  return (
    <div className="space-y-6">
      <Card padding="md" className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-dark">
            {data.totalRecords === 0 ? '0' : `${rangeStart}-${rangeEnd}`} {t('common.of')} {data.totalRecords}
          </span>
          <span className="text-xs text-slate-400 ms-1">{t('reports.section.auditRecordsFound')}</span>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(data.page - 1)}
              disabled={data.page <= 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              {t('reports.section.prev')}
            </button>
            <span className="text-xs text-slate-400">{t('reports.section.pageOf', { page: data.page, total: totalPages })}</span>
            <button
              onClick={() => onPageChange(data.page + 1)}
              disabled={data.page >= totalPages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              {t('common.next')}
            </button>
          </div>
        )}
      </Card>
      <DataTable
        headers={[t('common.date'), t('reports.col.user'), t('reports.col.action'), t('reports.col.entityType'), t('reports.col.entityId'), t('common.details')]}
        rows={data.rows.map(r => [formatDate(r.date), r.user, r.action, r.entityType, r.entityId, r.details])}
        emptyText={t('reports.empty.auditRecords')}
      />
    </div>
  )
}

function BackupReportView({ data }: { data: unknown[] }) {
  const { t } = useTranslation()
  const backups = (data ?? []) as { backupName?: string; backupDate?: string; backupSize?: number; backupVersion?: string; schemaVersion?: string; isValid?: boolean }[]
  return (
    <div className="space-y-6">
      <Card padding="md">
        <span className="text-sm font-semibold text-dark">{backups.length}</span>
        <span className="text-xs text-slate-400 ms-1">{t('reports.section.backupsFound', { count: backups.length })}</span>
      </Card>
      <DataTable
        headers={[t('reports.col.backupName'), t('common.date'), t('reports.col.sizeShort'), t('reports.col.version'), t('reports.col.schemaVersion'), t('reports.col.valid')]}
        rows={backups.map(b => [
          b.backupName ?? '—',
          b.backupDate ? formatDate(b.backupDate) : '—',
          b.backupSize ? `${(b.backupSize / 1024 / 1024).toFixed(2)} MB` : '—',
          b.backupVersion ?? '—',
          b.schemaVersion ?? '—',
          b.isValid === true ? t('common.yes') : b.isValid === false ? t('common.no') : '—'
        ])}
        emptyText={t('reports.empty.backups')}
      />
    </div>
  )
}

function FoodCostReportView({ data, fmt }: { data: FoodCostReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalFoodCost'), value: fmt(data.totalCost) },
        { label: t('reports.summary.ingredientsUsed'), value: String(data.rows.length) },
      ]} />
      <DataTable
        headers={[t('reports.col.ingredient'), t('common.unit'), t('reports.col.qtyUsed'), t('reports.col.costPrice'), t('reports.col.totalCost')]}
        rows={data.rows.map(r => [
          r.ingredientName, r.unit,
          r.totalQuantityUsed.toFixed(3),
          fmt(r.costPrice),
          fmt(r.totalCost)
        ])}
        emptyText={t('reports.empty.foodCost')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Restaurant: Dish-wise Contribution Margin.
function DishContributionMarginView({ data, fmt }: { data: DishContributionMarginReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const totalRevenue = data.rows.reduce((sum, r) => sum + r.revenue, 0)
  const totalMargin = data.rows.reduce((sum, r) => sum + r.contributionMargin, 0)
  const chartRows = data.rows.slice(0, 10).map(r => ({ label: r.productName, value: r.contributionMargin }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRevenue'), value: fmt(totalRevenue) },
        { label: t('reports.summary.totalContributionMargin'), value: fmt(totalMargin) },
        { label: t('reports.summary.dishesSold'), value: String(data.rows.length) },
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.contributionMarginByDish')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={180} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" name={t('reports.col.contributionMargin')} fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.dishName'), t('reports.col.qtySold'), t('reports.col.revenue'), t('reports.col.ingredientCost'), t('reports.col.contributionMargin'), t('reports.col.marginPercent')]}
        rows={data.rows.map(r => [r.productName, r.quantitySold, fmt(r.revenue), fmt(r.ingredientCost), fmt(r.contributionMargin), `${r.marginPercent}%`])}
        emptyText={t('reports.empty.dishContributionMargin')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Restaurant: Table Turnover by Hour. A hand-built CSS-grid
// heatmap (day-of-week x hour-of-day) — this codebase has no charting-library
// heatmap primitive, and a 168-cell grid doesn't need one.
function TableTurnoverHeatmapView({ data }: { data: TableTurnoverByHourReport }) {
  const { t, i18n } = useTranslation()
  const maxCount = Math.max(1, ...data.cells.map(c => c.count))
  const cellByDayHour = new Map(data.cells.map(c => [`${c.dayOfWeek}-${c.hour}`, c.count]))
  const peakLabel = data.summary.peakDayOfWeek !== null && data.summary.peakHour !== null
    ? `${weekdayLabel(data.summary.peakDayOfWeek, i18n.language)}, ${String(data.summary.peakHour).padStart(2, '0')}:00`
    : '—'

  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalTurns'), value: String(data.summary.totalTurns) },
        { label: t('reports.summary.peakTime'), value: peakLabel },
        { label: t('reports.summary.peakTurns'), value: String(data.summary.peakCount) },
      ]} />
      {data.summary.totalTurns > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 overflow-x-auto">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.tableTurnoverHeatmap')}</h3>
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: '3rem repeat(24, 1.6rem)' }}>
            <div />
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={`h-${hour}`} className="text-[9px] text-slate-400 text-center">{hour}</div>
            ))}
            {Array.from({ length: 7 }, (_, day) => (
              <React.Fragment key={`row-${day}`}>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center">{weekdayLabel(day, i18n.language)}</div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = cellByDayHour.get(`${day}-${hour}`) ?? 0
                  const intensity = count / maxCount
                  return (
                    <div
                      key={`c-${day}-${hour}`}
                      title={`${weekdayLabel(day, i18n.language, false)}, ${String(hour).padStart(2, '0')}:00 — ${count} ${t('reports.col.turns')}`}
                      className="w-[1.6rem] h-[1.6rem] rounded-sm"
                      style={{ backgroundColor: count === 0 ? 'rgba(148,163,184,0.12)' : `rgba(0,174,239,${0.15 + intensity * 0.85})` }}
                    />
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title={t('reports.empty.tableTurnoverByHour')} subtitle="" />
      )}
    </div>
  )
}

// Phase 67 §9.1 — Restaurant: Recipe-vs-Actual Waste Variance.
function RecipeWasteVarianceView({ data }: { data: RecipeWasteVarianceReport }) {
  const { t } = useTranslation()
  const biggestWaste = data.rows.filter(r => r.varianceQuantity > 0)[0] ?? null
  const chartRows = data.rows.slice(0, 10).map(r => ({ label: r.ingredientName, value: r.varianceQuantity }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.ingredientsTracked'), value: String(data.rows.length) },
        { label: t('reports.summary.biggestWaste'), value: biggestWaste ? `${biggestWaste.ingredientName} (+${biggestWaste.varianceQuantity} ${biggestWaste.unit})` : '—' },
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.varianceByIngredient')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={180} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="value" name={t('reports.col.varianceQuantity')} radius={[0, 4, 4, 0]}>
                {chartRows.map((row, idx) => (
                  <Cell key={idx} fill={row.value > 0 ? STATUS_COLORS.danger : STATUS_COLORS.brand} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.ingredient'), t('common.unit'), t('reports.col.impliedQuantity'), t('reports.col.actualQuantity'), t('reports.col.varianceQuantity'), t('reports.col.variancePercent')]}
        rows={data.rows.map(r => [r.ingredientName, r.unit, r.impliedQuantity, r.actualQuantity, r.varianceQuantity, r.variancePercent !== null ? `${r.variancePercent}%` : '—'])}
        emptyText={t('reports.empty.recipeWasteVariance')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Retail: Dead-Stock Clearance List.
function DeadStockClearanceView({ data, fmt }: { data: DeadStockClearanceReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const chartRows = data.rows.slice(0, 10).map(r => ({ label: r.productName, value: r.capitalLocked }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalCapitalLocked'), value: fmt(data.summary.totalCapitalLocked) },
        { label: t('reports.summary.deadStockItems'), value: String(data.summary.itemCount) },
        { label: t('reports.summary.lookbackWindow'), value: `${data.lookbackDays}d` },
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.capitalLockedByProduct')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={180} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" name={t('reports.col.capitalLocked')} fill={STATUS_COLORS.warning} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.product'), t('reports.col.sku'), t('reports.col.stock'), t('reports.col.unitCost'), t('reports.col.capitalLocked'), t('reports.col.lastSoldDate')]}
        rows={data.rows.map(r => [r.productName, r.sku ?? '—', r.currentStock, fmt(r.unitCost), fmt(r.capitalLocked), r.lastSoldDate ?? t('reports.col.neverSold')])}
        emptyText={t('reports.empty.deadStockClearance')}
      />
    </div>
  )
}

const SELL_THROUGH_PALETTE = ['#00AEEF', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

function CategorySellThroughView({ data }: { data: CategorySellThroughReport }) {
  const { t } = useTranslation()
  const categoryNames = Array.from(new Set(data.rows.map(r => r.categoryName))).sort()
  const months = Array.from(new Set(data.rows.map(r => r.month))).sort()
  const chartRows = months.map(month => {
    const row: Record<string, string | number> = { month }
    for (const r of data.rows) if (r.month === month) row[r.categoryName] = r.sellThroughRate
    return row
  })
  return (
    <div className="space-y-6">
      {chartRows.length > 0 && categoryNames.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('reports.summary.sellThroughByCategoryMonth')}</h3>
          <p className="text-xs text-slate-400 mb-4">{t('reports.summary.sellThroughStockNote')}</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartRows} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {categoryNames.map((name, i) => (
                <Bar key={name} dataKey={name} name={name} fill={SELL_THROUGH_PALETTE[i % SELL_THROUGH_PALETTE.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.month'), t('reports.col.category'), t('reports.col.unitsSold'), t('reports.col.stock'), t('reports.col.sellThroughRate')]}
        rows={data.rows.map(r => [r.month, r.categoryName, r.unitsSold, r.currentStock, `${r.sellThroughRate}%`])}
        emptyText={t('reports.empty.categorySellThrough')}
      />
    </div>
  )
}

function SeasonSellThroughView({ data }: { data: SeasonSellThroughReport }) {
  const { t } = useTranslation()
  const seasons = Array.from(new Set(data.rows.map(r => r.season))).sort()
  const months = Array.from(new Set(data.rows.map(r => r.month))).sort()
  const chartRows = months.map(month => {
    const row: Record<string, string | number> = { month }
    let sum = 0; let count = 0
    for (const r of data.rows) if (r.month === month) { row[r.season] = r.sellThroughRate; sum += r.sellThroughRate; count += 1 }
    row.overallAvg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0
    return row
  })
  return (
    <div className="space-y-6">
      {chartRows.length > 0 && seasons.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('reports.summary.sellThroughBySeasonMonth')}</h3>
          <p className="text-xs text-slate-400 mb-4">{t('reports.summary.sellThroughStockNote')}</p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartRows} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {seasons.map((name, i) => (
                <Bar key={name} dataKey={name} name={name} fill={SELL_THROUGH_PALETTE[i % SELL_THROUGH_PALETTE.length]} radius={[4, 4, 0, 0]} />
              ))}
              <Line type="monotone" dataKey="overallAvg" name={t('reports.summary.overallAverage')} stroke={STATUS_COLORS.dangerDeep} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.month'), t('reports.col.season'), t('reports.col.unitsSold'), t('reports.col.stock'), t('reports.col.sellThroughRate')]}
        rows={data.rows.map(r => [r.month, r.season, r.unitsSold, r.currentStock, `${r.sellThroughRate}%`])}
        emptyText={t('reports.empty.seasonSellThrough')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Clothing: Size × Style Heatmap. Same hand-built CSS-grid
// heatmap approach as the pre-existing Table Turnover heatmap (this
// codebase has no charting-library heatmap primitive) — rows are styles
// (capped to the top 15 by net units sold), columns are every size present.
function SizeStyleHeatmapView({ data }: { data: SizeStyleHeatmapReport }) {
  const { t } = useTranslation()
  const maxUnits = Math.max(1, ...data.cells.map(c => c.unitsSold))
  const cellByStyleSize = new Map(data.cells.map(c => [`${c.style}|${c.size}`, c.unitsSold]))
  const topCellLabel = data.summary.topCellStyle && data.summary.topCellSize
    ? `${data.summary.topCellStyle} / ${data.summary.topCellSize}`
    : '—'

  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalUnitsSold'), value: String(data.summary.totalUnitsSold) },
        { label: t('reports.summary.topCombination'), value: topCellLabel },
        { label: t('reports.summary.topCombinationUnits'), value: String(data.summary.topCellUnitsSold) },
      ]} />
      {data.styles.length > 0 && data.sizes.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 overflow-x-auto">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.sizeStyleHeatmap')}</h3>
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `10rem repeat(${data.sizes.length}, 3rem)` }}>
            <div />
            {data.sizes.map(size => (
              <div key={`h-${size}`} className="text-[10px] text-slate-400 text-center">{size}</div>
            ))}
            {data.styles.map(style => (
              <React.Fragment key={`row-${style}`}>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center truncate pe-2" title={style}>{style}</div>
                {data.sizes.map(size => {
                  const units = cellByStyleSize.get(`${style}|${size}`) ?? 0
                  const intensity = units / maxUnits
                  return (
                    <div
                      key={`c-${style}-${size}`}
                      title={`${style} / ${size} — ${units} ${t('reports.col.unitsSold')}`}
                      className="h-8 rounded-sm flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: units === 0 ? 'rgba(148,163,184,0.12)' : `rgba(0,174,239,${0.15 + intensity * 0.85})`, color: intensity > 0.5 ? '#fff' : undefined }}
                    >
                      {units > 0 ? units : ''}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title={t('reports.empty.sizeStyleHeatmap')} subtitle="" />
      )}
      <DataTable
        headers={[t('reports.col.style'), t('reports.col.size'), t('reports.col.unitsSold')]}
        rows={data.cells.map(c => [c.style, c.size, c.unitsSold])}
        emptyText={t('reports.empty.sizeStyleHeatmap')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap Report. Same
// styles×sizes CSS-grid layout as SizeStyleHeatmapView above, but a status
// colour (OUT/LOW/IN) per cell instead of a sales-intensity gradient — this
// is a live stock snapshot, not a sold-units history, so there's no "more
// units = darker" scale to show.
function SizeAvailabilityHeatmapView({ data }: { data: SizeAvailabilityHeatmapReport }) {
  const { t } = useTranslation()
  const cellByStyleSize = new Map(data.cells.map(c => [`${c.style}|${c.size}`, c]))
  const statusStyle: Record<string, string> = {
    OUT: 'bg-danger/20 text-danger',
    LOW: 'bg-warning/20 text-warning',
    IN: 'bg-success/15 text-success',
  }

  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalStyles'), value: String(data.summary.totalStyles) },
        { label: t('reports.summary.outOfStockCells'), value: String(data.summary.outOfStockCells) },
        { label: t('reports.summary.lowStockCells'), value: String(data.summary.lowStockCells) },
        { label: t('reports.summary.styleWithMostGaps'), value: data.summary.styleWithMostGaps ?? '—' },
      ]} />
      {data.styles.length > 0 && data.sizes.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 overflow-x-auto">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.sizeAvailabilityHeatmap')}</h3>
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `10rem repeat(${data.sizes.length}, 3rem)` }}>
            <div />
            {data.sizes.map(size => (
              <div key={`h-${size}`} className="text-[10px] text-slate-400 text-center">{size}</div>
            ))}
            {data.styles.map(style => (
              <React.Fragment key={`row-${style}`}>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center truncate pe-2" title={style}>{style}</div>
                {data.sizes.map(size => {
                  const cell = cellByStyleSize.get(`${style}|${size}`)
                  return (
                    <div
                      key={`c-${style}-${size}`}
                      title={cell ? `${style} / ${size} — ${cell.stockQty} ${t('reports.col.stock')} (${cell.status})` : `${style} / ${size}`}
                      className={cn('h-8 rounded-sm flex items-center justify-center text-[10px] font-semibold', cell ? statusStyle[cell.status] : 'bg-slate-50 dark:bg-slate-800')}
                    >
                      {cell ? cell.stockQty : ''}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-danger/40" /> {t('reports.status.out')}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning/40" /> {t('reports.status.low')} (≤{data.lowStockThreshold})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success/40" /> {t('reports.status.in')}</span>
          </div>
        </div>
      ) : (
        <EmptyState title={t('reports.empty.sizeAvailabilityHeatmap')} subtitle="" />
      )}
      <DataTable
        headers={[t('reports.col.style'), t('reports.col.size'), t('reports.col.stock'), t('reports.col.status')]}
        rows={data.cells.map(c => [c.style, c.size, c.stockQty, c.status])}
        emptyText={t('reports.empty.sizeAvailabilityHeatmap')}
      />
    </div>
  )
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EMPTY_CYCLE_FORM = { id: '', name: '', startMonth: 1, startDay: 1, endMonth: 1, endDay: 1, leadTimeDays: 30 }

// Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar. Unlike every
// other report view in this file (purely presentational off the `data`
// prop), this one owns real mutations — adding/editing/deleting a shop's
// own seasonal windows — so it seeds local state from `data` and re-fetches
// its own calendar/cycle list after every change, the same self-contained
// pattern VariantManagementModal already uses for its own CRUD.
function SeasonalReorderCalendarView({ data }: { data: SeasonalCalendarEntry[] }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [entries, setEntries] = useState(data)
  const [cycles, setCycles] = useState<SeasonalCycleRecord[]>([])
  const [showManager, setShowManager] = useState(false)
  const [form, setForm] = useState(EMPTY_CYCLE_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setEntries(data) }, [data])
  useEffect(() => { void window.api.seasonalCycle.list().then(r => { if (r.success) setCycles(r.data ?? []) }) }, [])

  async function refresh() {
    const [calRes, listRes] = await Promise.all([window.api.seasonalCycle.calendar({}), window.api.seasonalCycle.list()])
    if (calRes.success) setEntries((calRes.data ?? []) as SeasonalCalendarEntry[])
    if (listRes.success) setCycles(listRes.data ?? [])
  }

  async function handleSave() {
    if (!form.name.trim()) { toastError(t('reports.seasonalCalendar.nameRequired')); return }
    setSaving(true)
    const payload = { name: form.name, startMonth: form.startMonth, startDay: form.startDay, endMonth: form.endMonth, endDay: form.endDay, leadTimeDays: form.leadTimeDays }
    const res = form.id ? await window.api.seasonalCycle.update({ ...payload, id: form.id }) : await window.api.seasonalCycle.create(payload)
    setSaving(false)
    if (!res.success) { toastError(res.error?.message ?? t('reports.seasonalCalendar.saveFailed')); return }
    toastSuccess(t('reports.seasonalCalendar.saved'))
    setForm(EMPTY_CYCLE_FORM)
    await refresh()
  }

  async function handleDelete(id: string) {
    const res = await window.api.seasonalCycle.delete({ id })
    if (!res.success) { toastError(res.error?.message ?? t('reports.seasonalCalendar.deleteFailed')); return }
    await refresh()
  }

  function edit(c: SeasonalCycleRecord) {
    setForm({ id: c.id, name: c.name, startMonth: c.startMonth, startDay: c.startDay, endMonth: c.endMonth, endDay: c.endDay, leadTimeDays: c.leadTimeDays })
    setShowManager(true)
  }

  const statusStyle: Record<string, string> = {
    REORDER_NOW: 'bg-danger/10 border-danger/30 text-danger',
    IN_SEASON: 'bg-success/10 border-success/30 text-success',
    UPCOMING: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500',
  }
  const statusLabel: Record<string, string> = {
    REORDER_NOW: t('reports.seasonalCalendar.status.reorderNow'),
    IN_SEASON: t('reports.seasonalCalendar.status.inSeason'),
    UPCOMING: t('reports.seasonalCalendar.status.upcoming'),
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => { setForm(EMPTY_CYCLE_FORM); setShowManager(m => !m) }}
          className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand transition-colors"
        >
          {showManager ? t('reports.seasonalCalendar.hideManager') : t('reports.seasonalCalendar.manageSeasons')}
        </button>
      </div>

      {showManager && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.seasonalCalendar.name')}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('reports.seasonalCalendar.namePlaceholder')}
                className="h-9 w-full px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.seasonalCalendar.startMonth')}</label>
              <select value={form.startMonth} onChange={e => setForm(f => ({ ...f, startMonth: Number(e.target.value) }))}
                className="h-9 w-full px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm">
                {MONTH_SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.seasonalCalendar.startDay')}</label>
              <input type="number" min={1} max={31} value={form.startDay} onChange={e => setForm(f => ({ ...f, startDay: Number(e.target.value) }))}
                className="h-9 w-full px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.seasonalCalendar.endMonth')}</label>
              <select value={form.endMonth} onChange={e => setForm(f => ({ ...f, endMonth: Number(e.target.value) }))}
                className="h-9 w-full px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm">
                {MONTH_SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.seasonalCalendar.endDay')}</label>
              <input type="number" min={1} max={31} value={form.endDay} onChange={e => setForm(f => ({ ...f, endDay: Number(e.target.value) }))}
                className="h-9 w-full px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('reports.seasonalCalendar.leadTimeDays')}</label>
              <input type="number" min={0} value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: Number(e.target.value) }))}
                className="h-9 w-full px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm" />
            </div>
            <div>
              <button onClick={() => void handleSave()} disabled={saving}
                className="h-9 w-full px-4 rounded-xl bg-brand text-white text-xs font-semibold disabled:opacity-50">
                {form.id ? t('reports.seasonalCalendar.update') : t('reports.seasonalCalendar.add')}
              </button>
            </div>
          </div>

          {cycles.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {cycles.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-dark dark:text-slate-100">
                    {c.name} — {MONTH_SHORT[c.startMonth - 1]} {c.startDay} → {MONTH_SHORT[c.endMonth - 1]} {c.endDay}
                    <span className="text-slate-400 ms-2">({t('reports.seasonalCalendar.leadTimeDays')}: {c.leadTimeDays})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button onClick={() => edit(c)} className="text-xs text-brand hover:underline">{t('reports.seasonalCalendar.editAction')}</button>
                    <button onClick={() => void handleDelete(c.id)} className="text-xs text-danger hover:underline">{t('reports.seasonalCalendar.deleteAction')}</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {entries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.map(e => (
            <div key={e.id} className={cn('rounded-xl border p-4', statusStyle[e.status])}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-dark dark:text-slate-100">{e.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{MONTH_SHORT[e.startMonth - 1]} {e.startDay} → {MONTH_SHORT[e.endMonth - 1]} {e.endDay}</p>
                </div>
                <span className={cn('text-[10px] font-bold uppercase px-2 py-1 rounded-full', statusStyle[e.status])}>{statusLabel[e.status]}</span>
              </div>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                {e.status !== 'IN_SEASON' && <p>{t('reports.seasonalCalendar.daysUntilStart', { count: e.daysUntilStart })}</p>}
                <p>{t('reports.seasonalCalendar.reorderBy')}: {formatDate(e.reorderByDate)}</p>
                <p>{t('reports.seasonalCalendar.taggedProducts')}: {e.products.length}, {t('reports.seasonalCalendar.lowStock')}: {e.lowOrOutOfStockCount}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={t('reports.seasonalCalendar.empty')} subtitle={t('reports.seasonalCalendar.emptySubtitle')} />
      )}
    </div>
  )
}

function BasketCompositionView({ data }: { data: BasketCompositionReport }) {
  const { t } = useTranslation()
  const chartRows = data.rows.slice(0, 10).map(r => ({ label: `${r.productAName} + ${r.productBName}`, value: r.basketCount }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalBaskets'), value: String(data.summary.totalBaskets) },
        { label: t('reports.summary.avgItemsPerBasket'), value: String(data.summary.avgItemsPerBasket) },
        { label: t('reports.summary.avgBasketValue'), value: formatCurrency(data.summary.avgBasketValue) },
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.topProductPairs')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={220} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="value" name={t('reports.col.basketCount')} fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.productA'), t('reports.col.productB'), t('reports.col.basketCount')]}
        rows={data.rows.map(r => [r.productAName, r.productBName, r.basketCount])}
        emptyText={t('reports.empty.basketComposition')}
      />
    </div>
  )
}

// Category count is user-defined (arbitrary N), unlike QUADRANT_COLORS'
// fixed 4 keys below — a cycling palette rather than a lookup map. Same
// hardcoded-not-STATUS_COLORS reasoning: this sits above STATUS_COLORS'
// own declaration further down the file.
const CATEGORY_MIX_COLORS = ['#00AEEF', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

// Phase 67 §9.1 — General: Category Mix. This file's first live Pie chart
// (recharts) — a natural fit for "what share of revenue each category
// contributes", unlike the bar/scatter/treemap shapes every other Phase 67
// report above has used.
// Phase 67 §9.1 — Clothing item 5: Margin by Brand/Vendor Report, its 5th
// and final signature item. Bar chart per the audit's own chart-form note
// (unlike Category Mix's pie above — margin can go negative, which a pie
// slice can't honestly represent) — same horizontal-bar structural pattern
// RmaAgingView/VendorRecoveryLedgerView already established, coloring
// negative-margin vendors distinctly rather than letting a loss-making
// vendor blend in with a merely-thin-margin one.
function VendorMarginView({ data }: { data: VendorMarginReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.rows.slice(0, 10).map(r => ({ label: r.supplierName, value: r.margin, isLoss: r.margin < 0 }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRevenue'), value: formatCurrency(s.totalRevenue) },
        { label: t('reports.summary.cogs'), value: formatCurrency(s.totalCogs) },
        { label: t('reports.summary.totalMargin'), value: formatCurrency(s.totalMargin) },
        { label: t('reports.summary.vendorCount'), value: String(s.vendorCount) },
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.marginByVendor')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" name={t('reports.summary.totalMargin')} radius={[0, 4, 4, 0]}>
                {chartRows.map((r, i) => <Cell key={i} fill={r.isLoss ? STATUS_COLORS.dangerDeep : STATUS_COLORS.success} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.supplier'), t('reports.col.revenue'), t('reports.summary.cogs'), t('reports.col.margin'), t('reports.col.marginPercent')]}
        rows={data.rows.map(r => [r.supplierName, formatCurrency(r.revenue), formatCurrency(r.cogs), formatCurrency(r.margin), `${r.marginPercent}%`])}
        emptyText={t('reports.empty.vendorMargin')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Footwear item 2: Brand-Wise Margin & Return-Rate Report.
// Combo chart per the audit's own chart-form note — margin (currency) as
// bars on the left axis, return rate (%) as an overlaid line on the right
// axis, the same dual-yAxisId ComposedChart mechanism the Distributor
// scheme-cost-vs-volume chart already established for two differently-
// scaled series on one chart, generalized here from line+line to bar+line.
function BrandMarginReturnRateView({ data }: { data: BrandMarginReturnRateReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.rows.slice(0, 10).map(r => ({ label: r.supplierName, margin: r.margin, returnRate: r.returnRatePercent, isLoss: r.margin < 0 }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRevenue'), value: formatCurrency(s.totalRevenue) },
        { label: t('reports.summary.totalMargin'), value: formatCurrency(s.totalMargin) },
        { label: t('reports.col.returnRatePercent'), value: `${s.overallReturnRatePercent}%` },
        { label: t('reports.summary.vendorCount'), value: String(s.vendorCount) },
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.brandMarginReturnRate')}</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartRows} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="margin" tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCurrency(v)} />
              <YAxis yAxisId="returnRate" orientation="right" tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number, name: string) => name === t('reports.col.margin') ? formatCurrency(v) : `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="margin" dataKey="margin" name={t('reports.col.margin')} radius={[4, 4, 0, 0]}>
                {chartRows.map((r, i) => <Cell key={i} fill={r.isLoss ? STATUS_COLORS.dangerDeep : STATUS_COLORS.success} />)}
              </Bar>
              <Line yAxisId="returnRate" type="monotone" dataKey="returnRate" name={t('reports.col.returnRatePercent')} stroke={STATUS_COLORS.warning} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.supplier'), t('reports.col.margin'), t('reports.col.marginPercent'), t('reports.col.unitsSold'), t('reports.col.unitsReturned'), t('reports.col.returnRatePercent')]}
        rows={data.rows.map(r => [r.supplierName, formatCurrency(r.margin), `${r.marginPercent}%`, r.unitsSold, r.unitsReturned, `${r.returnRatePercent}%`])}
        emptyText={t('reports.empty.brandMarginReturnRate')}
      />
    </div>
  )
}

function CategoryMixView({ data }: { data: CategoryMixReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRevenue'), value: formatCurrency(data.summary.totalRevenue) },
        { label: t('reports.summary.categoryCount'), value: String(data.summary.categoryCount) },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.revenueByCategory')}</h3>
          <ResponsiveContainer width="100%" height={320}>
            <RCPieChart>
              <Pie data={data.rows} dataKey="revenue" nameKey="categoryName" cx="50%" cy="50%" outerRadius={110} label={(p: { categoryName?: string; revenuePercent?: number }) => `${p.categoryName} (${p.revenuePercent}%)`}>
                {data.rows.map((r, i) => <Cell key={r.categoryId} fill={CATEGORY_MIX_COLORS[i % CATEGORY_MIX_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RCPieChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.category'), t('reports.col.unitsSold'), t('reports.col.revenue'), t('reports.col.revenuePercent')]}
        rows={data.rows.map(r => [r.categoryName, r.unitsSold, formatCurrency(r.revenue), `${r.revenuePercent}%`])}
        emptyText={t('reports.empty.categoryMix')}
      />
    </div>
  )
}

// Hardcoded (not STATUS_COLORS.*) — STATUS_COLORS itself is declared much
// later in this file, and this constant sits above every View component
// that needs it, so referencing it here would throw a temporal-dead-zone
// ReferenceError at module load. Values match STATUS_COLORS exactly.
const QUADRANT_COLORS: Record<MoverQuadrant, string> = {
  FAST_HIGH_MARGIN: '#22C55E',
  FAST_LOW_MARGIN: '#00AEEF',
  SLOW_HIGH_MARGIN: '#F59E0B',
  SLOW_LOW_MARGIN: '#EF4444'
}

function FastSlowMoverMatrixView({ data }: { data: FastSlowMoverMatrixReport }) {
  const { t } = useTranslation()
  const quadrantCounts = { FAST_HIGH_MARGIN: 0, FAST_LOW_MARGIN: 0, SLOW_HIGH_MARGIN: 0, SLOW_LOW_MARGIN: 0 }
  for (const r of data.rows) quadrantCounts[r.quadrant]++
  const scatterByQuadrant = (Object.keys(quadrantCounts) as MoverQuadrant[]).map(q => ({
    quadrant: q,
    points: data.rows.filter(r => r.quadrant === q).map(r => ({ ...r, x: r.velocity, y: r.marginPercent }))
  }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.velocityMedian'), value: `${data.velocityMedian}/d` },
        { label: t('reports.summary.marginMedian'), value: `${data.marginMedian}%` },
        { label: t('reports.val.quadrant.FAST_HIGH_MARGIN'), value: String(quadrantCounts.FAST_HIGH_MARGIN) },
        { label: t('reports.val.quadrant.SLOW_LOW_MARGIN'), value: String(quadrantCounts.SLOW_LOW_MARGIN) },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('reports.summary.fastSlowMoverMatrix')}</h3>
          <p className="text-xs text-slate-400 mb-4">{t('reports.summary.fastSlowMoverMatrixNote')}</p>
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" dataKey="x" name={t('reports.col.velocity')} tick={CHART_TICK} tickLine={false} axisLine={false} label={{ value: t('reports.col.velocity'), position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="number" dataKey="y" name={t('reports.col.marginPercent')} tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" width={44} />
              <ZAxis range={[60, 60]} />
              <ReferenceLine x={data.velocityMedian} stroke="#cbd5e1" strokeDasharray="3 3" />
              <ReferenceLine y={data.marginMedian} stroke="#cbd5e1" strokeDasharray="3 3" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as FastSlowMoverRow
                  return (
                    <div style={CHART_TOOLTIP_STYLE} className="bg-white px-3 py-2">
                      <p className="font-semibold text-dark">{p.productName}</p>
                      <p className="text-slate-500">{t('reports.col.velocity')}: {p.velocity}/d · {t('reports.col.marginPercent')}: {p.marginPercent}%</p>
                    </div>
                  )
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => t(`reports.val.quadrant.${value}`)} />
              {scatterByQuadrant.map(({ quadrant, points }) => (
                points.length > 0 && (
                  <Scatter key={quadrant} name={quadrant} data={points} fill={QUADRANT_COLORS[quadrant]} />
                )
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.product'), t('reports.col.sku'), t('reports.col.unitsSold'), t('reports.col.velocity'), t('reports.col.marginPercent'), t('reports.col.quadrant')]}
        rows={data.rows.map(r => [r.productName, r.sku ?? '—', r.quantitySold, r.velocity, `${r.marginPercent}%`, t(`reports.val.quadrant.${r.quadrant}`)])}
        emptyText={t('reports.empty.fastSlowMoverMatrix')}
      />
    </div>
  )
}

function GSTR1ReportView({ data, fmt }: { data: GSTR1Report; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <div className="bg-warning/10 dark:bg-warning/15 border border-warning/30 rounded-xl p-4 text-sm text-warning">
        <strong>{t('reports.section.gstr1Period', { period: data.period })}</strong><br />
        {t('reports.section.gstr1Disclaimer')}
      </div>
      <SummaryCards cards={[
        { label: t('reports.summary.b2bValue'), value: fmt(s.totalB2BValue), sub: t('reports.summary.invoicesSuffix', { count: data.b2b.length }) },
        { label: t('reports.summary.b2csValue'), value: fmt(s.totalB2CSValue), sub: t('reports.summary.groupsSuffix', { count: data.b2cs.length }) },
        { label: t('reports.summary.totalCgst'), value: fmt(s.totalCgst) },
        { label: t('reports.summary.totalSgst'), value: fmt(s.totalSgst) },
        { label: t('reports.summary.totalIgst'), value: fmt(s.totalIgst), sub: t('reports.summary.interState') },
      ]} />
      {data.b2b.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.b2bHeading')}</h3>
          <DataTable
            headers={[t('reports.col.gstin'), t('reports.col.party'), t('reports.col.invoiceNo'), t('common.date'), t('reports.col.value'), t('reports.col.placeOfSupply'), t('reports.col.taxableShort'), 'IGST', 'CGST', 'SGST', t('reports.col.rateShort')]}
            rows={data.b2b.map(r => [
              r.gstin, r.receiverName, r.invoiceNumber, r.invoiceDate,
              fmt(r.invoiceValue), r.placeOfSupply, fmt(r.taxableValue),
              fmt(r.igstAmount), fmt(r.cgstAmount), fmt(r.sgstAmount), `${r.rate}%`
            ])}
          />
        </div>
      )}
      {data.b2cs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.b2csHeading')}</h3>
          <DataTable
            headers={[t('reports.col.placeOfSupply'), t('reports.col.rateShort'), t('reports.col.taxableValue'), 'IGST', 'CGST', 'SGST']}
            rows={data.b2cs.map(r => [
              r.placeOfSupply, `${r.rate}%`,
              fmt(r.taxableValue), fmt(r.igstAmount), fmt(r.cgstAmount), fmt(r.sgstAmount)
            ])}
          />
        </div>
      )}
      {data.b2b.length === 0 && data.b2cs.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">{t('reports.empty.gstr1')}</div>
      )}
    </div>
  )
}

function HSNSummaryView({ data, fmt }: { data: HSNSummaryReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  const hsnHeaders = [t('reports.col.hsnCode'), t('common.description'), t('reports.col.uqc'), t('reports.col.qty'), t('reports.col.value'), t('reports.col.taxableShort'), 'IGST', 'CGST', 'SGST']
  const toRows = (rows: HSNSummaryRow[]) => rows.map(r => [
    r.hsnCode, r.description, r.uqc, r.totalQuantity, fmt(r.totalValue), fmt(r.taxableValue), fmt(r.igstAmount), fmt(r.cgstAmount), fmt(r.sgstAmount)
  ])
  return (
    <div className="space-y-6">
      <div className="bg-warning/10 dark:bg-warning/15 border border-warning/30 rounded-xl p-4 text-sm text-warning">
        <strong>{t('reports.section.gstr1Period', { period: data.period })}</strong><br />
        {t('reports.section.hsnDisclaimer')}
      </div>
      <SummaryCards cards={[
        { label: t('reports.summary.taxableValue'), value: fmt(s.totalTaxableValue) },
        { label: t('reports.summary.totalTax'), value: fmt(s.totalTax) },
        { label: t('reports.summary.hsnRows'), value: String(s.rowCount) },
      ]} />
      {data.b2b.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.hsnB2BHeading')}</h3>
          <DataTable headers={hsnHeaders} rows={toRows(data.b2b)} />
        </div>
      )}
      {data.b2c.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.hsnB2CHeading')}</h3>
          <DataTable headers={hsnHeaders} rows={toRows(data.b2c)} />
        </div>
      )}
      {data.b2b.length === 0 && data.b2c.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">{t('reports.empty.hsnSummary')}</div>
      )}
    </div>
  )
}

function DocumentSummaryView({ data }: { data: DocumentSummaryReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div className="bg-warning/10 dark:bg-warning/15 border border-warning/30 rounded-xl p-4 text-sm text-warning">
        <strong>{t('reports.section.gstr1Period', { period: data.period })}</strong><br />
        {t('reports.section.documentSummaryDisclaimer')}
      </div>
      {data.rows.length > 0 ? (
        <DataTable
          headers={[t('reports.col.documentType'), t('reports.col.series'), t('reports.col.fromNumber'), t('reports.col.toNumber'), t('reports.col.totalCount'), t('reports.col.cancelledCount')]}
          rows={data.rows.map(r => [r.documentType, r.seriesPrefix, r.fromNumber, r.toNumber, r.totalCount, r.cancelledCount])}
        />
      ) : (
        <div className="text-center py-12 text-slate-400 text-sm">{t('reports.empty.documentSummary')}</div>
      )}
    </div>
  )
}

function GSTR3BPreviewView({ data, fmt }: { data: GSTR3BPreview; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const t31 = data.table31
  return (
    <div className="space-y-6">
      <div className="bg-warning/10 dark:bg-warning/15 border border-warning/30 rounded-xl p-4 text-sm text-warning">
        <strong>{t('reports.section.gstr1Period', { period: data.period })}</strong><br />
        {t('reports.section.gstr3bDisclaimer')}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.table31Heading')}</h3>
        <DataTable
          headers={[t('reports.col.item'), t('reports.col.value')]}
          rows={[
            [t('reports.section.table31Taxable'), fmt(t31.taxableOutwardSupplies)],
            [t('reports.section.table31ZeroRated'), fmt(t31.zeroRatedSupplies)],
            [t('reports.section.table31Exempt'), fmt(t31.exemptNilNonGstSupplies)],
            ['IGST', fmt(t31.taxAmount.igst)],
            ['CGST', fmt(t31.taxAmount.cgst)],
            ['SGST', fmt(t31.taxAmount.sgst)],
          ]}
        />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.table31dHeading')}</h3>
        <DataTable
          headers={[t('reports.col.item'), t('reports.col.value')]}
          rows={[
            [t('reports.section.table31dTaxableValue'), fmt(data.table31d.taxableValue)],
            [t('reports.section.table31dTax'), fmt(data.table31d.taxAmount)],
          ]}
        />
      </div>
      {data.table32.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark mb-3">{t('reports.section.table32')}</h3>
          <DataTable
            headers={[t('reports.col.placeOfSupply'), t('reports.col.taxableShort'), 'IGST']}
            rows={data.table32.map(r => [r.state, fmt(r.taxableValue), fmt(r.igstAmount)])}
          />
        </div>
      )}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t('reports.section.notCovered')}</h4>
        <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
          {data.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </div>
    </div>
  )
}

function RentalStatusView({ data }: { data: RentalStatusReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('rental.summary.totalCheckedOut'), value: String(data.summary.totalCheckedOut) },
        { label: t('rental.status.OVERDUE'), value: String(data.summary.overdueCount) },
      ]} />
      {/* Phase 67 §9.1 — Rental item 4: the audit's own item names a "list +
          aging bar" — the list already existed, this bar is the missing
          half. */}
      {data.summary.overdueCount > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('rental.overdueAging')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.agingBuckets} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="bucket" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.dangerDeep} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.rows.length > 0 ? (
        <DataTable
          headers={[t('rental.col.booking'), t('rental.col.customer'), t('rental.col.item'), t('rental.unitLabel'), t('rental.startDateTime'), t('rental.endDateTime'), t('common.status'), t('rental.daysOverdue')]}
          rows={data.rows.map(r => [r.bookingNumber, r.customerName, r.productName, r.unitLabel ?? '—', formatDate(r.startDateTime), formatDate(r.endDateTime), r.isOverdue ? t('rental.status.OVERDUE') : t('rental.status.CHECKED_OUT'), r.isOverdue ? r.daysOverdue : '—'])}
        />
      ) : (
        <div className="text-center py-12 text-slate-400 text-sm">{t('rental.empty.status')}</div>
      )}
    </div>
  )
}

function RentalRevenueView({ data, fmt }: { data: RentalRevenueReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRevenue'), value: fmt(data.summary.totalRevenue) },
        { label: t('reports.col.bookingCount'), value: String(data.summary.totalBookings) },
      ]} />
      {data.rows.length > 0 ? (
        <DataTable
          headers={[t('rental.col.item'), t('reports.col.bookingCount'), t('reports.col.value'), t('rental.utilization')]}
          rows={data.rows.map(r => [r.productName, r.bookingCount, fmt(r.totalRevenue), r.utilizationPercent != null ? `${r.utilizationPercent.toFixed(0)}%` : '—'])}
        />
      ) : (
        <div className="text-center py-12 text-slate-400 text-sm">{t('rental.empty.revenue')}</div>
      )}
    </div>
  )
}

// Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per individual
// unit — deliberately distinct from RentalRevenueView's own per-PRODUCT
// utilizationPercent above, which averages across every unit of a product
// and can't surface one specific idle asset hiding behind a busy sibling.
function AssetUtilizationView({ data }: { data: AssetUtilizationReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalUnits'), value: String(data.summary.totalUnits) },
        { label: t('rental.utilization'), value: `${data.summary.avgUtilizationPercent}%` },
        { label: t('reports.summary.idleUnitCount'), value: String(data.summary.idleUnitCount) },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('rental.utilization')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.rows.length, 10) * 36)}>
            <BarChart data={data.rows.slice(0, 10).map(r => ({ ...r, label: `${r.productName} (${r.unitLabel})` }))} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="utilizationPercent" radius={[0, 4, 4, 0]}>
                {data.rows.slice(0, 10).map((r, idx) => (
                  <Cell key={idx} fill={r.utilizationPercent < 25 ? STATUS_COLORS.dangerDeep : STATUS_COLORS.brand} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('rental.unitLabel'), t('rental.col.item'), t('common.status'), t('reports.col.rentedDays'), t('reports.col.availableDays'), t('rental.utilization')]}
        rows={data.rows.map(r => [r.unitLabel, r.productName, t(`rental.status.${r.status}`), r.rentedDays, r.availableDays, `${r.utilizationPercent.toFixed(0)}%`])}
        emptyText={t('rental.empty.utilization')}
      />
    </div>
  )
}

// Phase 68 §9.1 — Beauty Salon items 1/2: stylist-wise repeat-client rate.
// Best-first (highest repeat rate) — a leaderboard, not this phase's usual
// worst-first problem list, same reasoning generateStylistRepeatClientReport
// itself documents.
function StylistRepeatClientView({ data }: { data: StylistRepeatClientReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.stylist'), value: String(data.summary.totalStylists) },
        { label: t('reports.col.repeatRatePercent'), value: `${data.summary.overallRepeatRatePercent}%` },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.stylistRepeatClient.label')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.rows.length, 10) * 40)}>
            <BarChart data={data.rows.slice(0, 10)} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="providerName" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="repeatRatePercent" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.stylist'), t('reports.col.totalClients'), t('reports.col.repeatClients'), t('reports.col.repeatRatePercent')]}
        rows={data.rows.map(r => [r.providerName, r.totalClients, r.repeatClients, `${r.repeatRatePercent}%`])}
        emptyText={t('reports.empty.stylistRepeatClient')}
      />
    </div>
  )
}

// Phase 68 §9.1 — Beauty Salon items 3/4: retail-product attach rate.
function RetailAttachRateView({ data }: { data: RetailAttachRateReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.totalInvoices'), value: String(data.summary.totalAppointmentInvoices) },
        { label: t('reports.col.attachRatePercent'), value: `${data.summary.attachRatePercent}%` },
      ]} />
      {data.byProvider.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.retailAttachRate.label')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.byProvider.length, 10) * 40)}>
            <BarChart data={data.byProvider.slice(0, 10)} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="providerName" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="attachRatePercent" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.stylist'), t('reports.col.totalInvoices'), t('reports.col.withAttach'), t('reports.col.attachRatePercent')]}
        rows={data.byProvider.map(r => [r.providerName, r.totalInvoices, r.withAttach, `${r.attachRatePercent}%`])}
        emptyText={t('reports.empty.retailAttachRate')}
      />
    </div>
  )
}

// Phase 68 §9.1 — Gym/Studio items 1/2: membership renewal funnel.
function MembershipRenewalFunnelView({ data }: { data: MembershipRenewalFunnelReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.expiredCount'), value: String(data.summary.totalExpired) },
        { label: t('reports.col.renewalRatePercent'), value: `${data.summary.overallRenewalRatePercent}%` },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.membershipRenewalFunnel.label')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.rows.length, 10) * 40)}>
            <BarChart data={data.rows.slice(0, 10)} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="planName" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="renewalRatePercent" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.planName'), t('reports.col.expiredCount'), t('reports.col.renewedCount'), t('reports.col.renewalRatePercent')]}
        rows={data.rows.map(r => [r.planName, r.expiredCount, r.renewedCount, `${r.renewalRatePercent}%`])}
        emptyText={t('reports.empty.membershipRenewalFunnel')}
      />
    </div>
  )
}

// Phase 68 §9.1 — Gym/Studio item 4: Class Attendance Heatmap. className ×
// day-of-week grid, same cell-intensity pattern SizeStyleHeatmapView above
// already established.
function ClassAttendanceHeatmapView({ data }: { data: ClassAttendanceHeatmapReport }) {
  const { t } = useTranslation()
  const maxCount = Math.max(1, ...data.cells.map(c => c.checkInCount))
  const cellByKey = new Map(data.cells.map(c => [`${c.className}|${c.dayOfWeek}`, c.checkInCount]))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.checkInCount'), value: String(data.summary.totalCheckIns) },
        { label: t('reports.col.className'), value: data.summary.busiestClassName ?? '—' },
        { label: t('reports.col.dayOfWeek'), value: data.summary.busiestDay ?? '—' },
      ]} />
      {data.classNames.length > 0 && data.daysOfWeek.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 overflow-x-auto">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.classAttendanceHeatmap.label')}</h3>
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `10rem repeat(${data.daysOfWeek.length}, 3rem)` }}>
            <div />
            {data.daysOfWeek.map(day => (
              <div key={`h-${day}`} className="text-[10px] text-slate-400 text-center">{day}</div>
            ))}
            {data.classNames.map(className => (
              <React.Fragment key={`row-${className}`}>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center truncate pe-2" title={className}>{className}</div>
                {data.daysOfWeek.map(day => {
                  const count = cellByKey.get(`${className}|${day}`) ?? 0
                  const intensity = count / maxCount
                  return (
                    <div
                      key={`c-${className}-${day}`}
                      title={`${className} / ${day} — ${count} ${t('reports.col.checkInCount')}`}
                      className="h-8 rounded-sm flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: count === 0 ? 'rgba(148,163,184,0.12)' : `rgba(0,174,239,${0.15 + intensity * 0.85})`, color: intensity > 0.5 ? '#fff' : undefined }}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title={t('reports.empty.classAttendanceHeatmap')} subtitle="" />
      )}
    </div>
  )
}

// Phase 68 §9.1 — Driving School item 4: Learner Progress Funnel.
function LearnerProgressFunnelView({ data }: { data: LearnerProgressFunnelReport }) {
  const { t } = useTranslation()
  const maxCount = Math.max(1, ...data.stages.map(s => s.learnerCount))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalEnrolled'), value: String(data.summary.totalEnrolled) },
        { label: t('reports.summary.overallCompletionPercent'), value: `${data.summary.overallCompletionPercent}%` },
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.learnerProgressFunnel.label')}</h3>
        <div className="space-y-3">
          {data.stages.map((s) => (
            <div key={s.stage}>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>{s.stage}</span>
                <span className="font-semibold text-dark dark:text-slate-100">{s.learnerCount}</span>
              </div>
              <div className="h-6 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-lg bg-brand" style={{ width: `${maxCount > 0 ? (s.learnerCount / maxCount) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Hotel/Lodge is a languageLock: 'en' business type — plain English strings
// here render identically to t()-wrapped ones would (see
// HotelRoomsScreen.tsx's header comment for the full reasoning).
function HotelOccupancyView({ data }: { data: HotelOccupancyReport }) {
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Rooms', value: String(data.totalRooms) },
        { label: 'Occupied', value: String(data.occupied) },
        { label: 'Available', value: String(data.available) },
        { label: 'Occupancy %', value: `${data.occupancyPercent}%` },
      ]} />
      <DataTable
        headers={['Status', 'Room Count']}
        rows={[
          ['Occupied', data.occupied], ['Available', data.available],
          ['Cleaning', data.cleaning], ['Maintenance / Out of Order', data.maintenance],
        ]}
      />
    </div>
  )
}

function HotelGuestRegisterView({ data }: { data: HotelGuestRegisterReport }) {
  return (
    <div className="space-y-6">
      <SummaryCards cards={[{ label: 'Registered Guests', value: String(data.rows.length) }]} />
      {data.rows.length > 0 ? (
        <DataTable
          headers={['Booking', 'Room', 'Guest Name', 'ID Type', 'ID Number', 'Nationality', 'Address', 'Check-In', 'Check-Out']}
          rows={data.rows.map(r => [r.bookingNumber, r.roomNumber, r.guestName, r.idType, r.idNumber, r.nationality, r.address ?? '—', formatDate(r.checkInDate), formatDate(r.checkOutDate)])}
        />
      ) : (
        <div className="text-center py-12 text-slate-400 text-sm">No registered guests for this date range.</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 35 — Service Report Views
// ─────────────────────────────────────────────────────────────────────────────

function AppointmentUtilisationView({ data }: { data: AppointmentUtilisationReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalAppointments'), value: String(s.total) },
        { label: t('reports.summary.completed'), value: String(s.completed), sub: t('reports.summary.completionRateSub', { rate: s.completionRate }) },
        { label: t('reports.summary.cancelled'), value: String(s.cancelled) },
        { label: t('reports.summary.noShows'), value: String(s.noShow) },
      ]} />

      {data.byProvider.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.byProvider')}</h3>
          <DataTable
            headers={[t('reports.col.provider'), t('reports.col.providerTotal'), t('reports.summary.completed'), t('reports.summary.cancelled'), t('reports.col.noShow'), t('reports.col.completionPercent')]}
            rows={data.byProvider.map(p => [p.providerName, p.total, p.completed, p.cancelled, p.noShow, `${p.completionRate}%`])}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {data.byDayOfWeek.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.byDayOfWeek')}</h3>
            <DataTable headers={[t('reports.col.day'), t('reports.col.appointments')]} rows={data.byDayOfWeek.map(d => [d.day, d.count])} />
          </div>
        )}
        {data.byHour.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.byHour')}</h3>
            <DataTable headers={[t('reports.col.hour'), t('reports.col.appointments')]} rows={data.byHour.map(h => [h.hour, h.count])} />
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.allAppointments')}</h3>
        <DataTable
          headers={[t('reports.col.apptNo'), t('common.date'), t('reports.col.time'), t('reports.col.customer'), t('reports.col.provider'), t('reports.col.service'), t('common.status'), t('reports.col.durationShort')]}
          rows={data.rows.map(r => [r.appointmentNumber, r.date, r.time, r.customer, r.provider, r.service, r.status, `${r.durationMinutes} min`])}
          emptyText={t('reports.empty.appointments')}
        />
      </div>
    </div>
  )
}

function ClientRetentionView({ data }: { data: ClientRetentionReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalClients'), value: String(s.totalUnique) },
        { label: t('reports.summary.newClients'), value: String(s.newClients), sub: t('reports.summary.firstVisitSub') },
        { label: t('reports.summary.returningClients'), value: String(s.returningClients) },
        { label: t('reports.summary.retentionRate'), value: `${s.retentionRate}%`, sub: t('reports.summary.atRiskSub', { count: s.atRiskCount }) },
      ]} />
      {s.atRiskCount > 0 && (
        <div className="bg-warning/10 dark:bg-warning/15 border border-warning/30 rounded-xl p-4 text-sm text-warning">
          {t('reports.section.atRiskBanner', { count: s.atRiskCount })}
        </div>
      )}
      <DataTable
        headers={[t('reports.col.customer'), t('common.phone'), t('reports.col.firstVisitEverParen'), t('reports.col.lastVisit'), t('reports.col.visitsInPeriod'), t('reports.col.newQ'), t('reports.col.atRiskQ')]}
        rows={data.rows.map(r => [
          r.customerName, r.phone,
          r.firstVisitEver, r.lastVisit,
          r.visitsInPeriod,
          r.isNew ? t('reports.val.new') : t('reports.val.returning'),
          r.atRisk ? t('reports.val.atRiskFlag') : '',
        ])}
        emptyText={t('reports.empty.clientAppointments')}
      />
    </div>
  )
}

function CommissionReportView({ data, fmt }: { data: CommissionReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalCommission'), value: fmt(s.totalCommission), sub: t('reports.summary.recordsSuffix', { count: s.recordCount }) },
        { label: t('reports.summary.totalTips'), value: fmt(s.totalTips) },
        { label: t('common.paid'), value: fmt(s.paidAmount) },
        { label: t('common.unpaid'), value: fmt(s.unpaidAmount) },
      ]} />

      {data.byStaff.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.byStaff')}</h3>
          <DataTable
            headers={[t('reports.col.staff'), t('reports.col.serviceRevenue'), t('reports.col.commission'), t('reports.col.tips'), t('common.paid'), t('common.unpaid'), t('reports.summary.records')]}
            rows={data.byStaff.map(st => [st.staffName, fmt(st.serviceRevenue), fmt(st.commissionAmount), fmt(st.tipAmount), fmt(st.paidAmount), fmt(st.unpaidAmount), st.recordCount])}
          />
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.commissionRecords')}</h3>
        <DataTable
          headers={[t('reports.col.staff'), t('reports.col.period'), t('reports.col.serviceRevenue'), t('reports.col.commission'), t('reports.col.tips'), t('reports.col.type'), t('reports.col.commissionRate'), t('reports.col.paidQ'), t('reports.col.paidDate')]}
          rows={data.rows.map(r => [
            r.staffName, r.period,
            fmt(r.serviceRevenue), fmt(r.commissionAmount), fmt(r.tipAmount),
            r.commissionType, r.commissionRate > 0 ? (r.commissionType === 'PERCENT' ? `${r.commissionRate}%` : fmt(r.commissionRate)) : '—',
            r.isPaid ? t('common.paid') : t('common.unpaid'),
            r.paidDate ?? '—',
          ])}
          emptyText={t('reports.empty.commission')}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 54 — New Vertical Report Views (Restaurant QR, Batch/Expiry, Labs, Blood Bank)
// ─────────────────────────────────────────────────────────────────────────────

const CHART_TICK = { fontSize: 10, fill: '#94a3b8' }
const CHART_TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }
const STATUS_COLORS = { success: '#22C55E', warning: '#F59E0B', danger: '#EF4444', dangerDeep: '#DC2626', brand: '#00AEEF' }

// Phase 67 §9.1 — Hardware: real crash found via live stress-test
// verification when the Customer/Supplier Ledger balance-trend chart tried
// to plot one point per row on a 5,000-row account (thousands of XAxis
// category ticks is a known Recharts performance cliff). Evenly sample down
// to at most this many points rather than rendering every row — the caller
// is responsible for always keeping the true final balance's own point.
const LEDGER_CHART_MAX_POINTS = 150
function sampleLedgerRowsForChart<T>(rows: T[]): T[] {
  if (rows.length <= LEDGER_CHART_MAX_POINTS) return rows
  const step = rows.length / LEDGER_CHART_MAX_POINTS
  const sampled: T[] = []
  for (let i = 0; i < LEDGER_CHART_MAX_POINTS - 1; i++) sampled.push(rows[Math.floor(i * step)])
  sampled.push(rows[rows.length - 1]) // always keep the true final balance, never a sampled approximation of it
  return sampled
}

function OrderVolumeView({ data }: { data: OrderVolumeReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartData = data.byDay.map(d => ({ ...d, label: d.date.slice(5) }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOrders'), value: String(s.totalOrders) },
        { label: t('reports.summary.accepted'), value: String(s.accepted), sub: t('reports.summary.acceptanceRateSub', { rate: s.acceptanceRate }) },
        { label: t('reports.summary.rejected'), value: String(s.rejected) },
        { label: t('reports.summary.pendingOrders'), value: String(s.pending) }
      ]} />
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byDayChart')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => (
                value === 'accepted' ? t('reports.summary.accepted') : value === 'rejected' ? t('reports.summary.rejected') : t('reports.summary.pendingOrders')
              )} />
              <Bar dataKey="accepted" stackId="orders" fill={STATUS_COLORS.success} />
              <Bar dataKey="pending" stackId="orders" fill={STATUS_COLORS.warning} />
              <Bar dataKey="rejected" stackId="orders" fill={STATUS_COLORS.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.orderDetails')}</h3>
        <DataTable
          headers={[t('common.date'), t('reports.col.tableLabel'), t('common.status'), t('reports.col.itemCount'), t('reports.col.resolvedAt')]}
          rows={data.rows.map(r => [formatDate(r.createdAt, true), r.tableLabel, r.status, r.itemCount, r.resolvedAt ? formatDate(r.resolvedAt, true) : '—'])}
          emptyText={t('reports.empty.orders')}
        />
      </div>
    </div>
  )
}

function DiscountsView({ data, fmt }: { data: DiscountReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  const topProducts = data.byProduct.slice(0, 10)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalDiscountGiven'), value: fmt(s.totalDiscountGiven) },
        { label: t('reports.summary.discountedLines'), value: `${s.discountedLineCount} / ${s.totalLineCount}` },
        { label: t('reports.summary.discountIncidence'), value: `${s.discountIncidencePercent}%` },
        { label: t('reports.summary.avgDiscountPercent'), value: `${s.averageDiscountPercent}%` }
      ]} />
      {topProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.topDiscountedProducts')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topProducts.map(p => ({ label: p.productName, value: p.discountGiven }))} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" fill={STATUS_COLORS.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.byStaff.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.byStaff')}</h3>
          <DataTable
            headers={[t('reports.col.staff'), t('reports.col.discountGiven'), t('reports.col.count')]}
            rows={data.byStaff.map(r => [r.staffName, fmt(r.discountGiven), String(r.lineCount)])}
            emptyText={t('reports.empty.discounts')}
          />
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.discountDetails')}</h3>
        <DataTable
          headers={[t('reports.col.invoiceNo'), t('common.date'), t('reports.col.customer'), t('reports.col.product'), t('reports.col.quantity'), t('reports.col.lineGross'), t('reports.col.discountGiven'), t('reports.col.discountPercent'), t('reports.col.staff')]}
          rows={data.rows.map(r => [r.invoiceNumber, formatDate(r.date), r.customer ?? '—', r.productName, String(r.quantity), fmt(r.lineGross), fmt(r.discountAmount), `${r.discountPercent}%`, r.staffName ?? '—'])}
          emptyText={t('reports.empty.discounts')}
        />
      </div>
    </div>
  )
}

// Phase 61 — Purchase Register / Purchases by Vendor / Purchases by Item /
// AP Aging (Section 3.1 items 4-5). "We first buy and then sell" — Bill is
// the source (a PO is a commitment, a Bill is the actual recorded purchase).
function PurchaseRegisterView({ data, fmt }: { data: PurchaseRegisterReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  const topVendors = data.byVendor.slice(0, 10)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalPurchases'), value: fmt(s.totalPurchases) },
        { label: t('reports.summary.billCount'), value: String(s.billCount) },
        { label: t('billing.tax'), value: fmt(s.totalTax) }
      ]} />
      {topVendors.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.spendByVendor')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topVendors.map(v => ({ label: v.supplierName, value: v.totalAmount }))} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.purchaseDetails')}</h3>
        <DataTable
          headers={[t('reports.col.billNumber'), t('common.date'), t('reports.col.supplier'), t('common.status'), t('reports.col.itemCount'), t('common.total')]}
          rows={data.rows.map(r => [r.billNumber, formatDate(r.date), r.supplier, r.status, String(r.itemCount), fmt(r.totalAmount)])}
          emptyText={t('reports.empty.purchaseRegister')}
        />
      </div>
    </div>
  )
}

function PurchasesByVendorView({ data, fmt }: { data: PurchasesByVendorReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  const top = data.rows.slice(0, 10)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalPurchases'), value: fmt(s.totalPurchases) },
        { label: t('reports.summary.vendorCount'), value: String(s.vendorCount) }
      ]} />
      {top.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.spendByVendor')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top.map(v => ({ label: v.supplierName, value: v.totalAmount }))} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.supplier'), t('reports.col.billCount'), t('common.total')]}
        rows={data.rows.map(r => [r.supplierName, String(r.billCount), fmt(r.totalAmount)])}
        emptyText={t('reports.empty.purchasesByVendor')}
      />
    </div>
  )
}

function PurchasesByItemView({ data, fmt }: { data: PurchasesByItemReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  const top = data.rows.slice(0, 10)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalPurchases'), value: fmt(s.totalPurchases) },
        { label: t('reports.summary.itemCount'), value: String(s.itemCount) }
      ]} />
      {top.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.spendByItem')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top.map(v => ({ label: v.itemName, value: v.totalAmount }))} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.item'), t('reports.col.type'), t('reports.col.quantity'), t('common.total')]}
        rows={data.rows.map(r => [r.itemName, r.isService ? t('reports.col.service') : t('reports.col.product'), String(r.quantity), fmt(r.totalAmount)])}
        emptyText={t('reports.empty.purchasesByItem')}
      />
    </div>
  )
}

function ApAgingView({ data, fmt }: { data: ApAgingReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const top = data.rows.slice(0, 10)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.supplierPayables'), value: fmt(data.summary.totalOutstanding), sub: t('reports.summary.suppliersSuffix', { count: data.summary.count }) }
      ]} />
      <AgingSummary aging={data.agingTotals} fmt={fmt} />
      {top.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.apAgingByVendor')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top.map(r => ({ label: r.supplierName, ...r.aging }))} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => t(`reports.aging.${value}`)} />
              <Bar dataKey="current" stackId="aging" fill={STATUS_COLORS.success} />
              <Bar dataKey="days1to30" stackId="aging" fill={STATUS_COLORS.brand} />
              <Bar dataKey="days31to60" stackId="aging" fill={STATUS_COLORS.warning} />
              <Bar dataKey="days61to90" stackId="aging" fill={STATUS_COLORS.danger} />
              <Bar dataKey="days90plus" stackId="aging" fill={STATUS_COLORS.dangerDeep} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.supplier'), t('common.phone'), t('reports.col.payable'), t('reports.aging.current'), t('reports.aging.d1to30Short'), t('reports.aging.d31to60Short'), t('reports.aging.d61to90Short'), t('reports.aging.d90plusShort')]}
        rows={data.rows.map(r => [
          r.supplierName, r.phone ?? '—', fmt(r.outstanding),
          fmt(r.aging.current), fmt(r.aging.days1to30), fmt(r.aging.days31to60), fmt(r.aging.days61to90), fmt(r.aging.days90plus)
        ])}
        emptyText={t('reports.empty.supplierOutstanding')}
      />
    </div>
  )
}

// ─── Budget vs. Actual (Phase 65) ──────────────────────────────────────────

function BudgetVsActualView({ data, fmt }: { data: BudgetVsActualReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const totalBudgeted = data.rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual = data.rows.reduce((s, r) => s + r.actual, 0)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('budgets.budgeted'), value: fmt(totalBudgeted) },
        { label: t('budgets.actual'), value: fmt(totalActual) },
        { label: t('budgets.variance'), value: fmt(totalBudgeted - totalActual) }
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('budgets.title')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, data.rows.length * 44)}>
            <BarChart
              data={data.rows.map(r => ({ name: r.costCentreName ?? t('budgets.wholeCompany'), budgeted: r.budgeted, actual: r.actual }))}
              layout="vertical" barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} width={130} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="budgeted" name={t('budgets.budgeted')} fill="#94A3B8" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" name={t('budgets.actual')} fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('budgets.scope'), t('budgets.budgeted'), t('budgets.actual'), t('budgets.variance')]}
        rows={data.rows.map(r => [
          `${r.costCentreName ?? t('budgets.wholeCompany')}${r.accountName ? ` / ${r.accountName}` : ''}`,
          fmt(r.budgeted), fmt(r.actual), fmt(r.variance)
        ])}
        emptyText={t('budgets.empty.title')}
      />
    </div>
  )
}

// ─── Cost Centre Treemap (Phase 65) ────────────────────────────────────────

// Real recharts Treemap — one rectangle per cost centre, sized by revenue,
// colored by margin (green if healthy, red if the centre is running at a
// loss), per this report's own spec. recharts injects x/y/width/height/name
// plus every custom field passed on each data node (margin here).
interface TreemapContentProps {
  x?: number; y?: number; width?: number; height?: number
  name?: string; margin?: number; fmt: (n: number) => string
}
function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name, margin = 0, fmt }: TreemapContentProps) {
  const fill = margin >= 0 ? STATUS_COLORS.success : STATUS_COLORS.danger
  const showLabel = width > 60 && height > 32
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 18} fontSize={12} fontWeight={600} fill="#fff">{name}</text>
          <text x={x + 8} y={y + 34} fontSize={11} fill="#fff" fillOpacity={0.9}>{fmt(margin)}</text>
        </>
      )}
    </g>
  )
}

function CostCentreTreemapView({ data, fmt }: { data: CostCentreTreemapReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const totalRevenue = data.rows.reduce((s, r) => s + r.revenue, 0)
  const totalExpense = data.rows.reduce((s, r) => s + r.expense, 0)
  const treemapData = data.rows.map(r => ({ name: r.costCentreName, revenue: Math.max(r.revenue, 1), margin: r.margin }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRevenue'), value: fmt(totalRevenue) },
        { label: t('reports.col.expense'), value: fmt(totalExpense) },
        { label: t('reports.col.margin'), value: fmt(totalRevenue - totalExpense) }
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('costCentres.title')}</h3>
          <ResponsiveContainer width="100%" height={320}>
            <Treemap
              data={treemapData}
              dataKey="revenue"
              stroke="#fff"
              isAnimationActive={false}
              content={<TreemapCell fmt={fmt} />}
            >
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number, n: string, p: { payload?: { margin?: number } }) => [n === 'revenue' ? fmt(v) : fmt(p?.payload?.margin ?? 0), n === 'revenue' ? t('reports.summary.totalRevenue') : t('reports.col.margin')]} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('costCentres.title'), `${t('reports.summary.totalRevenue')}`, t('reports.col.expense'), t('reports.col.margin')]}
        rows={data.rows.map(r => [r.costCentreName, fmt(r.revenue), fmt(r.expense), fmt(r.margin)])}
        emptyText={t('reports.empty.noData')}
      />
      {(data.untaggedRevenue !== 0 || data.untaggedExpense !== 0) && (
        <p className="text-xs text-slate-400">{t('reports.section.untaggedNote', { revenue: fmt(data.untaggedRevenue), expense: fmt(data.untaggedExpense) })}</p>
      )}
    </div>
  )
}

// ─── Statutory Compliance Summary (Phase 65) ───────────────────────────────

function StatutoryComplianceSummaryView({ data, fmt }: { data: StatutoryComplianceSummaryReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const totalAmount = data.rows.reduce((s, r) => s + r.totalAmount, 0)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.totalAmount'), value: fmt(totalAmount) },
        { label: t('nav.employees'), value: String(data.totalEmployees) }
      ]} />
      <DataTable
        headers={[t('reports.col.deductionName'), t('reports.col.totalAmount'), t('reports.col.employeeCount')]}
        rows={data.rows.map(r => [r.name, fmt(r.totalAmount), String(r.employeeCount)])}
        emptyText={t('reports.empty.noData')}
      />
    </div>
  )
}

// ─── Cash-Flow Projection (Phase 65) ───────────────────────────────────────

function CashFlowProjectionView({ data, fmt }: { data: CashFlowProjectionReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const totalActual = data.days.reduce((s, b) => s + (b.actualNet ?? 0), 0)
  const totalProjected = data.days.reduce((s, b) => s + (b.projectedNet ?? 0), 0)
  const chartData = data.days.map(b => ({ label: b.date.slice(5), actual: b.actualNet, projected: b.projectedNet }))
  const todayLabel = data.asOf.slice(5)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.actual'), value: fmt(totalActual) },
        { label: t('reports.col.projected'), value: fmt(totalProjected) }
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.cashFlowProjection.label')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={todayLabel} stroke="#64748B" strokeDasharray="2 2" label={{ value: t('common.today'), position: 'top', fontSize: 10, fill: '#64748B' }} />
            <Area type="monotone" dataKey="actual" name={t('reports.col.actual')} stroke={STATUS_COLORS.brand} fill={STATUS_COLORS.brand} fillOpacity={0.15} connectNulls={false} />
            <Area type="monotone" dataKey="projected" name={t('reports.col.projected')} stroke={STATUS_COLORS.warning} fill={STATUS_COLORS.warning} fillOpacity={0.1} strokeDasharray="5 4" connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        headers={[t('common.date'), t('reports.col.actual'), t('reports.col.projected')]}
        rows={data.days.map(b => [formatDate(b.date), b.actualNet != null ? fmt(b.actualNet) : '—', b.projectedNet != null ? fmt(b.projectedNet) : '—'])}
        emptyText={t('reports.empty.noData')}
      />
    </div>
  )
}

// Phase 67 §9.1 — General: Combined Cash Position Trend. A single cumulative
// balance series (unlike CashFlowProjectionView's dual actual/projected
// split above) — the GL-backed "Cash & Bank" running balance day by day.
function CashPositionTrendView({ data, fmt }: { data: CashPositionTrendReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const chartData = data.points.map(p => ({ label: p.date.slice(5), balance: p.balance }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.openingBalance'), value: fmt(data.openingBalance) },
        { label: t('reports.col.closingBalance'), value: fmt(data.closingBalance) },
        { label: t('reports.col.netChange'), value: fmt(data.netChange) }
      ]} />
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.cashPositionTrend')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="balance" name={t('reports.col.balance')} stroke={STATUS_COLORS.brand} fill={STATUS_COLORS.brand} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('common.date'), t('reports.col.balance')]}
        rows={data.points.map(p => [formatDate(p.date), fmt(p.balance)])}
        emptyText={t('reports.empty.cashPositionTrend')}
      />
    </div>
  )
}

// ─── Payment Performance (Phase 65) ────────────────────────────────────────

function PaymentPerformanceView({ data, fmt }: { data: PaymentPerformanceReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const totalOutstanding = data.rows.reduce((s, r) => s + r.outstandingAmount, 0)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.avgDaysToPay'), value: data.overallAvgDaysToPay != null ? String(data.overallAvgDaysToPay) : '—' },
        { label: t('reports.col.outstanding'), value: fmt(totalOutstanding) }
      ]} />
      <DataTable
        headers={[t('reports.col.customer'), t('reports.col.paidInvoiceCount'), t('reports.col.avgDaysToPay'), t('reports.col.outstandingInvoiceCount'), t('reports.col.outstanding')]}
        rows={data.rows.map(r => [r.customerName, String(r.paidInvoiceCount), r.avgDaysToPay != null ? String(r.avgDaysToPay) : '—', String(r.outstandingInvoiceCount), fmt(r.outstandingAmount)])}
        emptyText={t('reports.empty.noData')}
      />
    </div>
  )
}

const BUCKET_COLOR: Record<ExpiryBucketId, string> = {
  expired: STATUS_COLORS.dangerDeep, critical: STATUS_COLORS.danger,
  warning: STATUS_COLORS.warning, safe: STATUS_COLORS.success
}
const BUCKET_LABEL_KEY: Record<ExpiryBucketId, string> = {
  expired: 'reports.val.bucketExpired', critical: 'reports.val.bucketCritical',
  warning: 'reports.val.bucketWarning', safe: 'reports.val.bucketSafe'
}

function BatchExpiryView({ data, fmt }: { data: BatchExpiryReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartData = data.buckets.map(b => ({ ...b, name: t(BUCKET_LABEL_KEY[b.bucket]) }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalBatches'), value: String(s.totalBatches) },
        { label: t('reports.summary.expired'), value: String(s.expiredCount), sub: s.expiredValue > 0 ? fmt(s.expiredValue) : undefined },
        { label: t('reports.summary.expiringCritical'), value: String(s.criticalCount) },
        { label: t('reports.summary.expiringWarning'), value: String(s.warningCount) },
        // Phase 67 §9.1 — Pharmacy's "Expiry-risk value" signature win: money
        // still recoverable if acted on now (excludes the already-expired
        // bucket, a sunk loss rather than something actionable).
        { label: t('reports.summary.atRiskValue'), value: fmt(s.atRiskValue) }
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byBucket')}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} width={110} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map(b => <Cell key={b.bucket} fill={BUCKET_COLOR[b.bucket]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byBucketValue')}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={fmt} />
            <YAxis type="category" dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} width={110} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map(b => <Cell key={b.bucket} fill={BUCKET_COLOR[b.bucket]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.batchDetails')}</h3>
        <DataTable
          headers={[t('reports.col.product'), t('reports.col.batchNumber'), t('reports.col.expiryDate'), t('reports.col.daysToExpiry'), t('reports.col.quantityRemaining'), t('reports.col.bucket'), t('reports.col.supplier')]}
          rows={data.rows.map(r => [r.productName, r.batchNumber, formatDate(r.expiryDate), r.daysToExpiry, r.quantityRemaining, t(BUCKET_LABEL_KEY[r.bucket]), r.supplierName])}
          emptyText={t('reports.empty.batches')}
        />
      </div>
    </div>
  )
}

const LAB_STAGE_LABEL_KEY: Record<string, string> = {
  ORDERED: 'reports.val.stageOrdered', SAMPLE_COLLECTED: 'reports.val.stageSampleCollected',
  IN_PROCESS: 'reports.val.stageInProcess', REPORTED: 'reports.val.stageReported',
  DELIVERED: 'reports.val.stageDelivered', CANCELLED: 'reports.val.stageCancelled'
}
// Ordinal stages (position in the real workflow carries meaning) get one hue at
// monotone lightness steps; CANCELLED is an exit state outside the flow, so it
// wears the reserved danger status color instead — see dataviz color-formula.md.
const LAB_STAGE_OPACITY: Record<string, number> = {
  ORDERED: 0.35, SAMPLE_COLLECTED: 0.5, IN_PROCESS: 0.65, REPORTED: 0.8, DELIVERED: 1
}

function LabThroughputView({ data }: { data: LabThroughputReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartData = data.byStatus.map(st => ({ ...st, name: t(LAB_STAGE_LABEL_KEY[st.status] ?? st.status) }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOrders'), value: String(s.totalOrders) },
        { label: t('reports.summary.delivered'), value: String(s.delivered) },
        { label: t('reports.summary.cancelled'), value: String(s.cancelled) },
        { label: t('reports.summary.avgTurnaround'), value: s.avgTurnaroundHours != null ? `${s.avgTurnaroundHours}` : '—', sub: s.avgTurnaroundHours != null ? t('reports.summary.avgTurnaroundSub') : undefined }
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byStage')}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map(st => (
                <Cell key={st.status} fill={st.status === 'CANCELLED' ? STATUS_COLORS.danger : STATUS_COLORS.brand}
                  fillOpacity={st.status === 'CANCELLED' ? 1 : LAB_STAGE_OPACITY[st.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.testDetails')}</h3>
        <DataTable
          headers={[t('reports.col.orderNumber'), t('reports.col.patientName'), t('common.status'), t('reports.col.createdDate'), t('reports.col.reportedDate'), t('reports.col.turnaround')]}
          rows={data.rows.map(r => [r.orderNumber, r.patientName, t(LAB_STAGE_LABEL_KEY[r.status] ?? r.status), formatDate(r.createdAt, true), r.reportedAt ? formatDate(r.reportedAt, true) : '—', r.turnaroundHours ?? '—'])}
          emptyText={t('reports.empty.labOrders')}
        />
      </div>
    </div>
  )
}

function BloodStockView({ data }: { data: BloodStockReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartData = data.byGroup.map(g => ({ ...g, safeAvailable: g.available - g.expiringSoon }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalAvailableUnits'), value: String(s.totalAvailable) },
        { label: t('reports.summary.expiringSoon'), value: String(s.totalExpiringSoon) },
        ...(s.groupsWithNoStock.length > 0
          ? [{ label: t('reports.summary.groupsOutOfStock'), value: String(s.groupsWithNoStock.length), sub: s.groupsWithNoStock.join(', ') }]
          : [])
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byBloodGroup')}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="bloodGroup" tick={CHART_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => (
              value === 'safeAvailable' ? t('reports.summary.totalAvailableUnits') : t('reports.summary.expiringSoon')
            )} />
            <Bar dataKey="safeAvailable" stackId="stock" fill={STATUS_COLORS.brand} />
            <Bar dataKey="expiringSoon" stackId="stock" fill={STATUS_COLORS.warning} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.unitDetails')}</h3>
        <DataTable
          headers={[t('reports.col.donationNumber'), t('reports.col.bloodGroup'), t('reports.col.componentType'), t('reports.col.expiryDate'), t('reports.col.daysToExpiry'), t('reports.col.expiringSoonQ')]}
          rows={data.rows.map(r => [r.donationNumber, r.bloodGroup, r.componentType, formatDate(r.expiryDate), r.daysToExpiry, r.isExpiringSoon ? t('common.yes') : t('common.no')])}
          emptyText={t('reports.empty.bloodUnits')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time.
function DonationToIssueCycleTimeView({ data }: { data: DonationToIssueCycleTimeReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalIssuedUnits'), value: String(data.summary.totalIssuedUnits) },
        { label: t('reports.summary.overallAvgDays'), value: String(data.summary.overallAvgDays) },
      ]} />
      {data.byComponent.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.avgCycleTimeByComponent')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, data.byComponent.length * 40)}>
            <BarChart data={data.byComponent.map(c => ({ ...c, label: c.componentType.replace('_', ' ') }))} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}d`} />
              <Bar dataKey="avgDays" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.componentType'), t('reports.col.unitCount'), t('reports.col.avgDays'), t('reports.col.minDays'), t('reports.col.maxDays')]}
        rows={data.byComponent.map(r => [r.componentType.replace('_', ' '), r.unitCount, `${r.avgDays}d`, `${r.minDays}d`, `${r.maxDays}d`])}
        emptyText={t('reports.empty.donationToIssueCycleTime')}
      />
    </div>
  )
}

// Fresh-audit fix (2026-07-12) — Jewellery had zero reports; stock valuation
// here is netWeight × today's rate, distinct from (and more meaningful than)
// the generic Inventory Report's quantity × costPrice for a metal item.
function JewelleryView({ data, fmt }: { data: JewelleryReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalStockValuation'), value: fmt(s.totalStockValuationAmount) },
        { label: t('reports.summary.totalMakingChargeRevenue'), value: fmt(s.totalMakingChargeRevenue) },
        { label: t('reports.summary.totalExchangeCount'), value: String(s.totalExchangeCount) },
        { label: t('reports.summary.totalExchangeValueGiven'), value: fmt(s.totalExchangeValueGiven) },
        ...(s.metalsWithNoRateSet.length > 0
          ? [{ label: t('reports.summary.metalsWithNoRateSet'), value: String(s.metalsWithNoRateSet.length), sub: s.metalsWithNoRateSet.join(', ') }]
          : [])
      ]} />
      {data.stockByMetal.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.stockByMetal')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.stockByMetal.map(g => ({ ...g, label: `${g.metalType} ${g.purity}` }))} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="valuationAmount" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.stockByMetal')}</h3>
        <DataTable
          headers={[t('jewellery.metalType'), t('jewellery.purity'), t('reports.col.netWeightGrams'), t('reports.col.ratePerGram'), t('reports.col.valuation')]}
          rows={data.stockByMetal.map(r => [r.metalType, r.purity, r.netWeightGrams.toFixed(3), r.ratePerGram != null ? fmt(r.ratePerGram) : '—', fmt(r.valuationAmount)])}
          emptyText={t('reports.empty.jewelleryStock')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Jewellery item 2: Making-Charge vs. Metal-Value Margin,
// per sale — deliberately distinct from JewelleryView's own single blended
// totalMakingChargeRevenue number above.
function MakingChargeMarginView({ data, fmt }: { data: MakingChargeMarginReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalMetalValue'), value: fmt(data.summary.totalMetalValue) },
        { label: t('reports.summary.totalMakingCharge'), value: fmt(data.summary.totalMakingCharge) },
        { label: t('reports.summary.avgMakingChargePercent'), value: `${data.summary.avgMakingChargePercent}%` },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('jewellery.makingChargeMargin')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.rows.slice(0, 10).map(r => ({ label: r.invoiceNumber, metalValue: r.metalValue, makingCharge: r.makingCharge }))} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={fmt} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="metalValue" name={t('reports.col.metalValue')} stackId="margin" fill={STATUS_COLORS.brand} />
              <Bar dataKey="makingCharge" name={t('reports.col.makingCharge')} stackId="margin" fill={STATUS_COLORS.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.invoiceNumber'), t('reports.col.date'), t('reports.col.customer'), t('reports.col.metalValue'), t('reports.col.makingCharge'), t('reports.col.makingChargePercent')]}
        rows={data.rows.map(r => [r.invoiceNumber, formatDate(r.invoiceDate), r.customerName, fmt(r.metalValue), fmt(r.makingCharge), `${r.makingChargePercent}%`])}
        emptyText={t('reports.empty.makingChargeMargin')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Jewellery item 3: Hallmarking/HUID compliance register — a
// real audit worklist, non-compliant items sorted first by report.service.ts.
function HallmarkComplianceView({ data }: { data: HallmarkComplianceReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalItems'), value: String(s.totalItems) },
        { label: t('reports.summary.compliantCount'), value: String(s.compliantCount) },
        { label: t('reports.summary.nonCompliantCount'), value: String(s.nonCompliantCount) },
        { label: t('reports.summary.compliancePercent'), value: `${s.compliancePercent}%` },
      ]} />
      {s.totalItems > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <ResponsiveContainer width="100%" height={220}>
            <RCPieChart>
              <Pie data={[{ name: t('reports.col.compliant'), value: s.compliantCount }, { name: t('reports.col.nonCompliant'), value: s.nonCompliantCount }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(p: { name?: string; value?: number }) => `${p.name} (${p.value})`}>
                <Cell fill={STATUS_COLORS.success} />
                <Cell fill={STATUS_COLORS.dangerDeep} />
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RCPieChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.item'), t('jewellery.metalType'), t('jewellery.purity'), t('jewellery.hallmarkNumber'), t('common.status')]}
        rows={data.rows.map(r => [r.productName, r.metalType, r.purity, r.hallmarkNumber ?? '—', r.compliant ? t('reports.col.compliant') : t('reports.col.nonCompliant')])}
        emptyText={t('reports.empty.hallmarkCompliance')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Jewellery item 4: Metal Rate vs. Sales Volume, dual-axis
// line chart — auto-selects the dominant metalType+purity combination, see
// report.service.ts's own comment for why there's no picker here.
function MetalRateVsSalesVolumeView({ data }: { data: MetalRateVsSalesVolumeReport }) {
  const { t } = useTranslation()
  if (!data.metalType || data.rows.length === 0) {
    return <div className="text-center py-12 text-slate-400 text-sm">{t('reports.empty.metalRateVsSalesVolume')}</div>
  }
  return (
    <div className="space-y-6">
      <SummaryCards cards={[{ label: t('jewellery.metalType'), value: `${data.metalType} ${data.purity}` }]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('jewellery.metalRateVsSalesVolume')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <RCLineChart data={data.rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
            <YAxis yAxisId="rate" tick={CHART_TICK} tickLine={false} axisLine={false} />
            <YAxis yAxisId="volume" orientation="right" tick={CHART_TICK} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="rate" type="monotone" dataKey="avgRatePerGram" name={t('jewellery.ratePerGram')} stroke={STATUS_COLORS.warning} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line yAxisId="volume" type="monotone" dataKey="salesWeightGrams" name={t('reports.col.salesWeightGrams')} stroke={STATUS_COLORS.brand} strokeWidth={2} dot={{ r: 3 }} />
          </RCLineChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        headers={[t('reports.col.month'), t('jewellery.ratePerGram'), t('reports.col.salesWeightGrams')]}
        rows={data.rows.map(r => [r.month, r.avgRatePerGram != null ? r.avgRatePerGram.toFixed(2) : '—', r.salesWeightGrams.toFixed(3)])}
      />
    </div>
  )
}

// Phase 67 §9.1 — Jewellery item 5: Purity-adjusted old-gold exchange
// analytics, "beyond a basic exchange log" — normalizes every exchange to
// its pure-metal-equivalent weight before aggregating.
function PurityAdjustedExchangeView({ data, fmt }: { data: PurityAdjustedExchangeReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalExchangeCount'), value: String(s.totalExchanges) },
        { label: t('reports.summary.totalPureEquivalentGrams'), value: `${s.totalPureEquivalentGrams}g` },
        { label: t('reports.summary.totalExchangeValueGiven'), value: fmt(s.totalValueGiven) },
        ...(s.unparsablePurityCount > 0 ? [{ label: t('reports.summary.unparsablePurityCount'), value: String(s.unparsablePurityCount) }] : []),
      ]} />
      {data.monthlyTrend.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.pureEquivalentTrend')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RCLineChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}g`} />
              <Line type="monotone" dataKey="pureEquivalentGrams" name={t('reports.col.pureEquivalentGrams')} stroke={STATUS_COLORS.brand} strokeWidth={2} dot={{ r: 3 }} />
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('jewellery.metalType'), t('jewellery.purity'), t('reports.col.exchangeCount'), t('reports.col.rawWeightGrams'), t('reports.col.pureEquivalentGrams'), t('reports.col.value')]}
        rows={data.byMetal.map(r => [r.metalType, r.purity, r.count, r.rawWeightGrams.toFixed(3), r.pureEquivalentGrams.toFixed(3), fmt(r.totalValueGiven)])}
        emptyText={t('reports.empty.purityAdjustedExchange')}
      />
    </div>
  )
}

// Fresh-audit fix (2026-07-12) — SERVICE/CONSULTANT previously had zero
// vertical-specific reports at all.
function ProjectReportView({ data, fmt }: { data: ProjectReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalProjects'), value: String(s.totalProjects) },
        { label: t('reports.summary.completed'), value: String(s.completed) },
        { label: t('reports.summary.pendingJobs'), value: String(s.open + s.inProgress) },
        { label: t('service.estimatedAmount'), value: fmt(s.totalEstimatedAmount) }
      ]} />
      {data.byStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byOrderStatus')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byStatus} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.projectDetails')}</h3>
        <DataTable
          headers={[t('reports.col.projectTitle'), t('reports.col.client'), t('common.status'), t('reports.col.priority'), t('common.amount'), t('reports.col.startDate'), t('reports.col.dueDate')]}
          rows={data.rows.map(r => [r.title, r.clientName ?? '—', r.status, r.priority, fmt(r.estimatedAmount), r.startDate ?? '—', r.dueDate ?? '—'])}
          emptyText={t('reports.empty.projects')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Service item 2: Resolution Time by Category — "a real
// service-quality metric" per the audit. Only genuinely resolved tickets
// count; an open ticket has no resolution time yet, not a zero one.
function ServiceResolutionTimeView({ data }: { data: ServiceResolutionTimeReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalResolved'), value: String(data.summary.totalResolved) },
        { label: t('reports.summary.overallAvgHours'), value: `${data.summary.overallAvgHours}h` },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.serviceResolutionTime.label')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.rows} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="category" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} unit="h" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}h`} />
              <Bar dataKey="avgHours" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.category'), t('reports.col.ticketCount'), t('reports.col.avgHours'), t('reports.col.minHours'), t('reports.col.maxHours')]}
        rows={data.rows.map(r => [r.category, r.ticketCount, `${r.avgHours}h`, `${r.minHours}h`, `${r.maxHours}h`])}
        emptyText={t('reports.empty.serviceResolutionTime')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Service item 4: Repeat-Business Rate — "the retention
// indicator this generic scaffold has never had" per the audit.
function RepeatBusinessRateView({ data }: { data: RepeatBusinessRateReport }) {
  const { t } = useTranslation()
  const latest = data.rows[data.rows.length - 1]
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.repeatRatePercent'), value: latest ? `${latest.repeatRatePercent}%` : '—' },
        { label: t('reports.col.newCustomers'), value: String(latest?.newCustomers ?? 0) },
        { label: t('reports.col.repeatCustomers'), value: String(latest?.repeatCustomers ?? 0) },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.repeatBusinessRate.label')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RCLineChart data={data.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="repeatRatePercent" name={t('reports.summary.repeatRatePercent')} stroke={STATUS_COLORS.brand} strokeWidth={2} dot={{ r: 3 }} />
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.month'), t('reports.col.newCustomers'), t('reports.col.repeatCustomers'), t('reports.col.repeatRatePercent')]}
        rows={data.rows.map(r => [r.month, r.newCustomers, r.repeatCustomers, `${r.repeatRatePercent}%`])}
        emptyText={t('reports.empty.repeatBusinessRate')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Consultant item 2: Utilization Rate — "the #1 consulting
// metric, currently invisible." Grouped (not stacked) bar per staff member
// so billable and non-billable hours are directly comparable side by side,
// sorted least-utilized first (the actionable list).
function ConsultantUtilizationView({ data }: { data: ConsultantUtilizationReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.overallUtilizationPercent'), value: `${data.summary.overallUtilizationPercent}%` },
        { label: t('reports.col.billableHours'), value: `${data.summary.totalBillableHours}h` },
        { label: t('reports.col.nonBillableHours'), value: `${data.summary.totalNonBillableHours}h` },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.consultantUtilization.label')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.rows.length, 10) * 40)}>
            <BarChart data={data.rows.slice(0, 10)} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} unit="h" />
              <YAxis type="category" dataKey="userName" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}h`} />
              <Bar dataKey="billableHours" name={t('reports.col.billableHours')} fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
              <Bar dataKey="nonBillableHours" name={t('reports.col.nonBillableHours')} fill={STATUS_COLORS.warning} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.staffMember'), t('reports.col.billableHours'), t('reports.col.nonBillableHours'), t('reports.col.utilizationPercent')]}
        rows={data.rows.map(r => [r.userName, `${r.billableHours}h`, `${r.nonBillableHours}h`, `${r.utilizationPercent}%`])}
        emptyText={t('reports.empty.consultantUtilization')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Consultant item 4: Client Profitability — "which clients
// are actually worth keeping." Dual-axis bar (revenue and hours differ in
// scale) rather than a single mixed-scale series, sorted least-profitable
// (lowest revenue-per-hour) first.
function ClientProfitabilityView({ data }: { data: ClientProfitabilityReport }) {
  const { t } = useTranslation()
  const currencySymbol = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const fmt = (n: number) => formatCurrency(n)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('common.amount'), value: fmt(data.summary.totalRevenue) },
        { label: t('reports.col.hoursSpent'), value: `${data.summary.totalHours}h` },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.clientProfitability.label')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.rows.length, 10) * 40)}>
            <BarChart data={data.rows.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="customerName" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="revenue" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis yAxisId="hours" orientation="right" tick={CHART_TICK} tickLine={false} axisLine={false} unit="h" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number, name: string) => (name === t('reports.col.hoursSpent') ? `${v}h` : fmt(v))} />
              <Bar yAxisId="revenue" dataKey="revenue" name={`${t('common.amount')} (${currencySymbol})`} fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="hours" dataKey="hoursSpent" name={t('reports.col.hoursSpent')} fill={STATUS_COLORS.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.client'), `${t('common.amount')} (${currencySymbol})`, t('reports.col.hoursSpent'), t('reports.col.revenuePerHour')]}
        rows={data.rows.map(r => [r.customerName, fmt(r.revenue), `${r.hoursSpent}h`, fmt(r.revenuePerHour)])}
        emptyText={t('reports.empty.clientProfitability')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Repair item 2: Turnaround by Technician, for the generic
// JobCard model. Sorted worst (slowest) first, matching the audit's own
// "(bar chart)" note.
function JobCardTurnaroundByTechnicianView({ data }: { data: JobCardTurnaroundByTechnicianReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalDelivered'), value: String(data.summary.totalDelivered) },
        { label: t('reports.summary.overallAvgTurnaroundHours'), value: `${data.summary.overallAvgTurnaroundHours}h` },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.jobCardTurnaroundByTechnician.label')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.rows.length, 10) * 40)}>
            <BarChart data={data.rows.slice(0, 10)} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} unit="h" />
              <YAxis type="category" dataKey="technicianName" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}h`} />
              <Bar dataKey="avgTurnaroundHours" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.technician'), t('reports.col.jobCount'), t('reports.col.avgHours'), t('reports.col.minHours'), t('reports.col.maxHours')]}
        rows={data.rows.map(r => [r.technicianName, r.jobCount, `${r.avgTurnaroundHours}h`, `${r.fastestHours}h`, `${r.slowestHours}h`])}
        emptyText={t('reports.empty.jobCardTurnaroundByTechnician')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Repair item 4: Repair Category Volume Trend — "informs
// parts stocking" per the audit's own item wording. Multi-line, one line
// per category (capped at the top 5 by total volume so the chart stays
// readable), matching the "(line chart)" note.
function RepairCategoryVolumeTrendView({ data }: { data: RepairCategoryVolumeTrendReport }) {
  const { t } = useTranslation()
  const totalsByCategory = new Map<string, number>()
  for (const r of data.rows) totalsByCategory.set(r.category, (totalsByCategory.get(r.category) ?? 0) + r.count)
  const topCategories = Array.from(totalsByCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c)
  const palette = [STATUS_COLORS.brand, STATUS_COLORS.warning, STATUS_COLORS.success, STATUS_COLORS.danger, STATUS_COLORS.dangerDeep]

  const months = Array.from(new Set(data.rows.map(r => r.month))).sort()
  const chartData = months.map(month => {
    const point: Record<string, string | number> = { month }
    for (const cat of topCategories) {
      const row = data.rows.find(r => r.month === month && r.category === cat)
      point[cat] = row?.count ?? 0
    }
    return point
  })

  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalJobs'), value: String(data.summary.totalJobs) },
        { label: t('reports.col.category'), value: String(data.categories.length) },
      ]} />
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.repairCategoryVolumeTrend.label')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RCLineChart data={chartData} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              {topCategories.map((cat, idx) => (
                <Line key={cat} type="monotone" dataKey={cat} name={cat} stroke={palette[idx % palette.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.month'), t('reports.col.category'), t('reports.col.jobCount')]}
        rows={data.rows.map(r => [r.month, r.category, r.count])}
        emptyText={t('reports.empty.repairCategoryVolumeTrend')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Distributor item 3: Field-Rep Performance Leaderboard —
// "orders booked, value, hit-rate vs. plan" per the audit's own item
// wording. Sorted DESCENDING by value (best-first) already at the service
// layer — a leaderboard celebrates top performers, the deliberate exception
// to this phase's usual worst-first convention for problem-surfacing
// reports (see report.service.ts's own comment on why). hitRatePercent is
// "—" (not 0%) for a rep with no active beat — an honest "not applicable."
function FieldRepLeaderboardView({ data, fmt }: { data: FieldRepLeaderboardReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOrdersBooked'), value: String(data.summary.totalOrdersBooked) },
        { label: t('common.amount'), value: fmt(data.summary.totalValue) },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.defs.fieldRepLeaderboard.label')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.rows.length, 10) * 40)}>
            <BarChart data={data.rows.slice(0, 10)} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="repName" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="totalValue" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.repName'), t('reports.col.ordersBooked'), t('common.amount'), t('reports.col.customersVisited'), t('reports.col.plannedStops'), t('reports.col.hitRatePercent')]}
        rows={data.rows.map(r => [r.repName, r.ordersBooked, fmt(r.totalValue), r.distinctCustomersVisited, r.plannedStops ?? '—', r.hitRatePercent !== null ? `${r.hitRatePercent}%` : '—'])}
        emptyText={t('reports.empty.fieldRepLeaderboard')}
      />
    </div>
  )
}

// Real bug fix 2026-07-16 — was previously the only "projects" report, wired
// to ServiceProject data but gated (in the tile list) behind the unrelated
// legacy `projects` module. Now correctly scoped to the six ServiceProject-
// using verticals (Independent Consultant/Architect/Civil Engineer/Marketing
// Agency/Software Agency/Real Estate) via the `service_projects` module gate.
function ServiceProjectReportView({ data, fmt }: { data: ServiceProjectReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalProjects'), value: String(s.totalProjects) },
        { label: t('reports.summary.active'), value: String(s.active) },
        { label: t('reports.summary.completed'), value: String(s.completed) },
        { label: t('reports.summary.totalContractValue'), value: fmt(s.totalContractValue) }
      ]} />
      {data.byStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byOrderStatus')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byStatus} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.projectDetails')}</h3>
        <DataTable
          headers={[t('reports.col.projectName'), t('reports.col.client'), t('common.status'), t('reports.col.projectType'), t('common.amount'), t('reports.col.startDate'), t('reports.col.expectedEndDate')]}
          rows={data.rows.map(r => [r.projectName, r.clientName, r.status, r.projectType, r.totalContractValue != null ? fmt(r.totalContractValue) : '—', r.startDate ?? '—', r.expectedEndDate ?? '—'])}
          emptyText={t('reports.empty.serviceProjects')}
        />
      </div>
    </div>
  )
}

function JobCardReportView({ data, fmt }: { data: JobCardReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalJobs'), value: String(s.totalJobs) },
        { label: t('reports.summary.delivered'), value: String(s.delivered) },
        { label: t('reports.summary.pendingJobs'), value: String(s.pending) },
        { label: t('reports.summary.totalActualCost'), value: fmt(s.totalActualCost) }
      ]} />
      {data.byStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byOrderStatus')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byStatus} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.jobCardDetails')}</h3>
        <DataTable
          headers={[t('reports.col.jobNumber'), t('common.description'), t('reports.col.customer'), t('common.status'), t('reports.col.priority'), t('reports.col.estimatedCost'), t('reports.col.actualCost')]}
          rows={data.rows.map(r => [r.jobNumber, r.title, r.customerName ?? '—', r.status, r.priority, fmt(r.estimatedCost), fmt(r.actualCost)])}
          emptyText={t('reports.empty.jobCards')}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 58 §1 — 10 new report views for verticals with zero dedicated report
// before this (2026-07-17).
// ─────────────────────────────────────────────────────────────────────────────

function CarJobCardReportView({ data, fmt }: { data: CarJobCardReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalJobs'), value: String(s.totalJobs) },
        { label: t('reports.summary.delivered'), value: String(s.delivered) },
        { label: 'Labor Revenue', value: fmt(s.totalLaborRevenue) },
        { label: 'Parts Revenue', value: fmt(s.totalPartsRevenue) }
      ]} />
      {data.byTechnician.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">Technician Productivity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byTechnician} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="technicianId" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="jobCount" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Job Details</h3>
        <DataTable
          headers={['Job #', t('reports.col.customer'), 'Vehicle', t('common.status'), 'Labor', 'Parts']}
          rows={data.rows.map(r => [r.jobNumber, r.customerName, `${r.vehicleMake} ${r.vehicleModel} (${r.vehicleNumber})`, r.status, fmt(r.laborTotal), fmt(r.partsTotal)])}
          emptyText={t('reports.empty.carJobCards')}
        />
      </div>
    </div>
  )
}

function TailoringOrderReportView({ data, fmt }: { data: TailoringOrderReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Orders', value: String(s.totalOrders) },
        { label: t('reports.summary.delivered'), value: String(s.delivered) },
        { label: t('common.amount'), value: fmt(s.totalAmount) }
      ]} />
      {data.byGarmentType.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">Orders by Garment Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byGarmentType} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="garmentType" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Order Details</h3>
        <DataTable
          headers={['Order #', t('reports.col.customer'), 'Garment', t('common.status'), 'Qty', t('common.amount')]}
          rows={data.rows.map(r => [r.orderNumber, r.customerName, r.garmentType, r.status, r.quantity, fmt(r.totalAmount)])}
          emptyText={t('reports.empty.tailoringOrders')}
        />
      </div>
    </div>
  )
}

function PestContractReportView({ data, fmt }: { data: PestContractReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Active Contracts', value: String(s.activeContracts) },
        { label: 'Expiring (30 days)', value: String(s.expiringWithin30Days) },
        { label: 'Total Contract Value', value: fmt(s.totalContractValue) }
      ]} />
      {data.byPestType.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">Revenue by Pest Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byPestType} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="pestType" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Bar dataKey="revenue" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Contracts Expiring Soon</h3>
        <DataTable
          headers={['Contract #', t('reports.col.customer'), 'Pest Types', 'Expires', 'Days Left']}
          rows={data.expiring.map(r => [r.contractNumber, r.customerName, r.pestTypes.join(', '), r.endDate, r.daysUntilExpiry])}
          emptyText={t('reports.empty.pestContracts')}
        />
      </div>
    </div>
  )
}

function RealEstatePipelineReportView({ data, fmt }: { data: RealEstatePipelineReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Listings', value: String(s.totalListings) },
        { label: 'Available', value: String(s.availableListings) },
        { label: 'Deals In Progress', value: String(s.dealsInProgress) },
        { label: 'Brokerage Earned', value: fmt(s.totalBrokerageEarned) }
      ]} />
      {data.byInquiryStage.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">Inquiries by Stage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byInquiryStage} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stage" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Deals</h3>
        <DataTable
          headers={['Property', 'Buyer', 'Seller', 'Deal Value', 'Brokerage', t('common.status')]}
          rows={data.deals.map(r => [r.propertyLocation, r.buyerName, r.sellerName, fmt(r.dealValue), fmt(r.brokerageAmount), r.status])}
          emptyText={t('reports.empty.realEstatePipeline')}
        />
      </div>
    </div>
  )
}

function RetainerReportView({ data, fmt }: { data: RetainerReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Active Retainers', value: String(s.activeRetainers) },
        { label: 'Total MRR', value: fmt(s.totalMRR) },
        { label: 'Billed This Period', value: `${s.billedThisPeriodCount} (${fmt(s.billedThisPeriodAmount)})` }
      ]} />
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Retainers ({data.targetPeriod})</h3>
        <DataTable
          headers={['Title', t('reports.col.client'), t('common.status'), 'Monthly Amount', 'Billed This Period']}
          rows={data.rows.map(r => [r.title, r.clientName, r.status, fmt(r.monthlyAmount), r.billedThisPeriod ? 'Yes' : 'No'])}
          emptyText={t('reports.empty.retainers')}
        />
      </div>
    </div>
  )
}

function ShootBookingReportView({ data, fmt }: { data: ShootBookingReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Bookings', value: String(s.totalBookings) },
        { label: t('reports.summary.delivered'), value: String(s.delivered) },
        { label: t('common.amount'), value: fmt(s.totalRevenue) }
      ]} />
      {data.byShootType.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">Bookings by Shoot Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byShootType} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="shootType" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Booking Details</h3>
        <DataTable
          headers={[t('reports.col.client'), 'Shoot Type', 'Shoot Date', t('common.status'), t('common.amount')]}
          rows={data.rows.map(r => [r.clientName, r.shootType, r.shootDate, r.status, r.finalAmount != null ? fmt(r.finalAmount) : '—'])}
          emptyText={t('reports.empty.shootBookings')}
        />
      </div>
    </div>
  )
}

function EventBookingReportView({ data, fmt }: { data: EventBookingReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Bookings', value: String(s.totalBookings) },
        { label: t('reports.summary.completed'), value: String(s.completed) },
        { label: t('common.amount'), value: fmt(s.totalRevenue) }
      ]} />
      {data.byStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byOrderStatus')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byStatus} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Booking Details</h3>
        <DataTable
          headers={[t('reports.col.client'), 'Event Name', 'Event Type', 'Event Date', t('common.status'), t('common.amount')]}
          rows={data.rows.map(r => [r.clientName, r.eventName, r.eventType, r.eventDate, r.status, r.finalAmount != null ? fmt(r.finalAmount) : '—'])}
          emptyText={t('reports.empty.eventBookings')}
        />
      </div>
    </div>
  )
}

function PlacementReportView({ data, fmt }: { data: PlacementReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Placements', value: String(s.totalPlacements) },
        { label: 'Joined', value: String(s.joined) },
        { label: 'Invoiced', value: String(s.invoiced) },
        { label: 'Total Commission', value: fmt(s.totalCommission) }
      ]} />
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Placement Details</h3>
        <DataTable
          headers={['Placement #', 'Candidate', 'Job Title', t('reports.col.client'), t('common.status'), 'Commission']}
          rows={data.rows.map(r => [r.placementNumber, r.candidateName, r.jobTitle, r.clientName, r.status, fmt(r.commissionAmount)])}
          emptyText={t('reports.empty.placements')}
        />
      </div>
    </div>
  )
}

function DrawingRegisterReportView({ data }: { data: DrawingRegisterReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Drawings', value: String(s.totalDrawings) },
        { label: 'Approved', value: String(s.approved) },
        { label: 'Pending Review', value: String(s.pendingReview) }
      ]} />
      {data.byStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byOrderStatus')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byStatus} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Drawing Register</h3>
        <DataTable
          headers={['Drawing #', 'Title', 'Project', 'Discipline', 'Rev', t('common.status')]}
          rows={data.rows.map(r => [r.drawingNumber, r.title, r.projectName, r.discipline, r.revisionNumber, r.status])}
          emptyText={t('reports.empty.drawingRegister')}
        />
      </div>
    </div>
  )
}

function SiteVisitLogReportView({ data }: { data: SiteVisitLogReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: 'Total Visits', value: String(s.totalVisits) }
      ]} />
      {data.byVisitType.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">Visits by Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byVisitType} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="visitType" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">Site Visit Log</h3>
        <DataTable
          headers={['Project', 'Visit Date', 'Visit Type', 'Recorded By', 'Findings']}
          rows={data.rows.map(r => [r.projectName, r.visitDate, r.visitType, r.recordedByName ?? '—', r.findings ?? '—'])}
          emptyText={t('reports.empty.siteVisitLog')}
        />
      </div>
    </div>
  )
}

// Phase 58 §2 — Pharmacy Schedule H/H1 prescription-drug sales register.
// Phase 67 §9.1 — added the doctor-grouped bar chart (the "Doctor-wise
// prescription volume" signature win) below the existing register table.
// The 3 SummaryCards labels here were hardcoded English strings amid an
// otherwise fully-t()-driven component (a real pre-existing inconsistency,
// not this file's established baseline the way e.g. PurchaseOrderFormModal's
// English-only baseline is) — fixed to real t() calls while directly
// touching this component for the new chart, rather than adding a 4th
// inconsistent label alongside them.
function PrescriptionDrugSalesReportView({ data, fmt }: { data: PrescriptionDrugSalesReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalSales'), value: String(s.totalSales) },
        { label: t('common.amount'), value: fmt(s.totalAmount) },
        { label: t('reports.summary.missingDetails'), value: String(s.missingPrescriptionDetails) }
      ]} />
      {data.byDoctor.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byDoctor')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, data.byDoctor.length * 36)}>
            <BarChart data={data.byDoctor} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="doctorName" tick={CHART_TICK} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number, name: string) => name === 'totalAmount' ? fmt(v) : v} />
              <Bar dataKey="salesCount" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.prescriptionRegister')}</h3>
        <DataTable
          headers={[t('reports.col.invoiceNo'), t('reports.col.invoiceDate'), t('reports.col.product'), t('reports.col.qty'), t('reports.col.patientName'), t('reports.col.doctorName'), t('reports.col.rxDate'), t('reports.col.customer'), t('common.amount')]}
          rows={data.rows.map(r => [r.invoiceNumber, r.invoiceDate, r.productName, r.quantity, r.patientName ?? '—', r.doctorName ?? '—', r.prescriptionDate ?? '—', r.customerName ?? '—', fmt(r.lineTotal)])}
          emptyText={t('reports.empty.prescriptionDrugSales')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Pharmacy item 1: Schedule H1/X Narcotic Register — a
// STRICTER subcategory of the Prescription Drug Sales register above
// (Product.isScheduleH1X, not every isPrescriptionRequired product).
// Deliberately does not claim full statutory register-field completeness
// (no doctor registration number or patient address anywhere in this
// platform) — surfaces exactly what Sarang actually records, honestly.
function ScheduleH1XRegisterView({ data }: { data: ScheduleH1XRegisterReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalSales'), value: String(s.totalSales) },
        { label: t('reports.summary.totalQuantity'), value: String(s.totalQuantity) },
        { label: t('reports.summary.missingDetails'), value: String(s.missingPrescriptionDetails) }
      ]} />
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.scheduleH1XRegister')}</h3>
        <DataTable
          headers={[t('reports.col.invoiceNo'), t('reports.col.invoiceDate'), t('reports.col.product'), t('reports.col.qty'), t('reports.col.patientName'), t('reports.col.doctorName'), t('reports.col.rxDate'), t('reports.col.customer')]}
          rows={data.rows.map(r => [r.invoiceNumber, r.invoiceDate, r.productName, r.quantity, r.patientName ?? '—', r.doctorName ?? '—', r.prescriptionDate ?? '—', r.customerName ?? '—'])}
          emptyText={t('reports.empty.scheduleH1XRegister')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Distributor: Scheme Cost vs. Incremental Volume Report.
// Deliberately framed as a CORRELATION view, not a causal claim — this
// codebase has no counterfactual/baseline mechanism (see the report
// function's own comment in report.service.ts), so the UI copy says so
// explicitly via reports.schemeCostVsVolume.disclaimer rather than implying
// the chart proves the scheme caused the volume.
function SchemeCostVsVolumeView({ data, fmt }: { data: SchemeCostVsVolumeReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalSchemeCost'), value: fmt(s.totalSchemeCost) },
        { label: t('reports.summary.focUnitsGiven'), value: String(s.totalFocUnitsGiven) },
        { label: t('reports.summary.activeSchemes'), value: String(s.activeSchemeCount) },
        { label: t('reports.summary.coveredProducts'), value: String(s.coveredProductCount) }
      ]} />
      <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t('reports.schemeCostVsVolume.disclaimer')}</p>
      {data.byPeriod.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.schemeCostVsVolumeChart')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RCLineChart data={data.byPeriod}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis yAxisId="cost" tick={CHART_TICK} tickLine={false} axisLine={false} tickFormatter={fmt} />
              <YAxis yAxisId="volume" orientation="right" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number, name: string) => name === t('reports.legend.schemeCost') ? fmt(v) : v} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="cost" type="monotone" dataKey="schemeCost" name={t('reports.legend.schemeCost')} stroke={STATUS_COLORS.warning} strokeWidth={2} dot={false} />
              <Line yAxisId="volume" type="monotone" dataKey="totalVolume" name={t('reports.legend.coveredVolume')} stroke={STATUS_COLORS.brand} strokeWidth={2} dot={false} />
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.schemesInPeriod')}</h3>
        <DataTable
          headers={[t('reports.col.schemeName'), t('reports.col.ruleType'), t('reports.col.focUnitsGiven'), t('common.amount')]}
          rows={data.rows.map(r => [r.schemeName, r.ruleType, r.focUnitsGiven, fmt(r.totalCost)])}
          emptyText={t('reports.empty.schemeCostVsVolume')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 19.2 — GP Clinic: Recall Compliance report ("gauge: %
// followed up on time" per the roadmap's own spec wording). No gauge/radial
// component exists anywhere in this codebase yet — a plain inline SVG ring is
// self-contained for a single-use case, matching this project's own "no
// abstraction beyond what's needed" convention rather than adding a shared
// component for one caller.
function ComplianceGauge({ percent }: { percent: number | null }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const pct = percent ?? 0
  const offset = circumference * (1 - pct / 100)
  const color = percent == null ? '#cbd5e1' : percent >= 80 ? STATUS_COLORS.success : percent >= 50 ? STATUS_COLORS.warning : STATUS_COLORS.danger
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx={70} cy={70} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={14} />
      <circle
        cx={70} cy={70} r={radius} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
      />
      <text x={70} y={68} textAnchor="middle" className="fill-dark dark:fill-slate-100" style={{ fontSize: 24, fontWeight: 700 }}>
        {percent != null ? `${percent}%` : '—'}
      </text>
      <text x={70} y={88} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>on time</text>
    </svg>
  )
}

function ChronicRecallComplianceView({ data }: { data: ChronicRecallComplianceReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center gap-3">
        <ComplianceGauge percent={data.overallPercent} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('reports.summary.recallsClosed')}: {data.totalRecallsClosed}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.complianceByCondition')}</h3>
        <DataTable
          headers={[t('reports.col.condition'), t('reports.col.recallsClosed'), t('reports.col.onTime'), t('reports.col.compliancePercent')]}
          rows={data.byCondition.map(r => [r.conditionName, r.total, r.onTime, `${r.percent}%`])}
          emptyText={t('reports.empty.chronicRecallCompliance')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 18.2 — Vet Clinic: Vaccination Compliance. Reuses
// ComplianceGauge as-is (first reuse of that component outside GP Clinic) —
// a genuinely different underlying query (per-dose history vs. per-recall
// log) but an identical "single % gauge + per-category breakdown table"
// shape, so the same view structure as ChronicRecallComplianceView applies.
function VaccinationComplianceView({ data }: { data: VaccinationComplianceReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center gap-3">
        <ComplianceGauge percent={data.overallPercent} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('reports.summary.dosesEvaluated')}: {data.totalDosesEvaluated}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.complianceByVaccine')}</h3>
        <DataTable
          headers={[t('reports.col.vaccineName'), t('reports.col.doses'), t('reports.col.onTime'), t('reports.col.compliancePercent')]}
          rows={data.byVaccine.map(r => [r.vaccineName, r.total, r.onTime, `${r.percent}%`])}
          emptyText={t('reports.empty.vaccinationCompliance')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 21.4 — Dental Clinic: Recall Compliance. Third reuse of
// ComplianceGauge (after GP's chronic recall and Vet's vaccination
// compliance) — same "single % gauge + per-category breakdown table" shape,
// broken down by recallType instead of condition/vaccine.
function DentalRecallComplianceView({ data }: { data: DentalRecallComplianceReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center gap-3">
        <ComplianceGauge percent={data.overallPercent} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('reports.summary.recallsClosed')}: {data.totalRecallsClosed}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.complianceByRecallType')}</h3>
        <DataTable
          headers={[t('reports.col.recallType'), t('reports.col.recallsClosed'), t('reports.col.onTime'), t('reports.col.compliancePercent')]}
          rows={data.byRecallType.map(r => [r.recallType, r.total, r.onTime, `${r.percent}%`])}
          emptyText={t('reports.empty.dentalRecallCompliance')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 18.4 — Vet Clinic: Case-Type Volume Trend. Same
// dynamic-category multi-line pattern as DiagnosisCategoryTrendView (item
// 19.4) and TestVolumeByPanelView (item 23.4) — case types come from
// whatever categories the clinic's own Service Catalog actually has, plus a
// dedicated "Vaccinations" series sourced from real administered doses.
function VetCaseTypeVolumeView({ data }: { data: VetCaseTypeVolumeReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalCases'), value: String(s.totalCases) },
        { label: t('reports.summary.distinctCaseTypes'), value: String(s.distinctCaseTypeCount) }
      ]} />
      {data.byMonth.length > 0 && data.caseTypes.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.caseTypeVolumeChart')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RCLineChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {data.caseTypes.map((caseType, i) => (
                <Line key={caseType} type="monotone" dataKey={caseType} name={caseType} stroke={TREND_LINE_COLORS[i % TREND_LINE_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.monthlyBreakdown')}</h3>
        <DataTable
          headers={[t('reports.col.month'), ...data.caseTypes]}
          rows={data.byMonth.map(r => [r.month, ...data.caseTypes.map(c => r[c] ?? 0)])}
          emptyText={t('reports.empty.vetCaseTypeVolume')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 19.3 — GP Clinic: Walk-in vs. Appointment Ratio. Stacked
// daily bar (same convention as OrderVolumeView above) plus a summary split.
function WalkInVsAppointmentRatioView({ data }: { data: WalkInVsAppointmentRatioReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartData = data.byDay.map(d => ({ ...d, label: d.date.slice(5) }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalWalkIns'), value: String(s.totalWalkIns) },
        { label: t('reports.col.appointments'), value: String(s.totalAppointments) },
        { label: t('reports.summary.walkInPercent'), value: `${s.walkInPercent}%` }
      ]} />
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byDayChart')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => (
                value === 'walkIns' ? t('reports.summary.totalWalkIns') : t('reports.col.appointments')
              )} />
              <Bar dataKey="walkIns" stackId="visits" fill={STATUS_COLORS.warning} />
              <Bar dataKey="appointments" stackId="visits" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.dailyBreakdown')}</h3>
        <DataTable
          headers={[t('common.date'), t('reports.col.walkIns'), t('reports.col.appointments')]}
          rows={data.byDay.map(r => [r.date, r.walkIns, r.appointments])}
          emptyText={t('reports.empty.walkInVsAppointmentRatio')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 19.4 — GP Clinic: Diagnosis-Category Trend. The only
// dynamic-category multi-line chart in this codebase — categories are
// free-text per install (see VisitNote.diagnosisCategory's own header
// comment), so the number of series isn't known ahead of time. A small local
// color cycle (not a shared palette — this is the only caller) picks a
// color per category by index.
const TREND_LINE_COLORS = [STATUS_COLORS.brand, STATUS_COLORS.warning, STATUS_COLORS.success, STATUS_COLORS.danger, '#8b5cf6', '#0891b2', '#db2777', '#65a30d']

function DiagnosisCategoryTrendView({ data }: { data: DiagnosisCategoryTrendReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalVisits'), value: String(s.totalVisits) },
        { label: t('reports.summary.categorized'), value: String(s.categorizedCount), sub: s.uncategorizedCount > 0 ? t('reports.summary.uncategorizedSub', { count: s.uncategorizedCount }) : undefined },
        { label: t('reports.summary.distinctCategories'), value: String(s.distinctCategoryCount) }
      ]} />
      {data.byMonth.length > 0 && data.categories.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.diagnosisTrendChart')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RCLineChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {data.categories.map((category, i) => (
                <Line key={category} type="monotone" dataKey={category} name={category} stroke={TREND_LINE_COLORS[i % TREND_LINE_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.monthlyBreakdown')}</h3>
        <DataTable
          headers={[t('reports.col.month'), ...data.categories]}
          rows={data.byMonth.map(r => [r.month, ...data.categories.map(c => r[c] ?? 0)])}
          emptyText={t('reports.empty.diagnosisCategoryTrend')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 19.5 — GP Clinic: Referral-Out Outcome. Pure data-table
// report (no chart type named in the spec, unlike 19.1-19.4) — the "outcome"
// text is often a real sentence of clinical prose, so a table row reads
// better than trying to force it into a chart.
function ReferralOutcomeView({ data }: { data: ReferralOutcomeReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalReferrals'), value: String(s.totalReferrals) },
        { label: t('reports.summary.outcomeRecorded'), value: String(s.outcomeRecordedCount) },
        { label: t('reports.summary.pendingReferrals'), value: String(s.pendingCount) }
      ]} />
      <div>
        <DataTable
          headers={[t('reports.col.patientName'), t('reports.col.referredTo'), t('common.date'), t('common.status'), t('reports.col.outcome')]}
          rows={data.rows.map(r => [r.patientName, r.referredToProviderName ?? '—', r.scheduledDate, r.status, r.outcomeSummary ?? '—'])}
          emptyText={t('reports.empty.referralOutcome')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 22.4 — Physio Clinic (shared with every session_packs
// vertical): Pack Utilization. Chart is capped to the top 10 packs by total
// sessions (this file's own established convention for per-row bar charts,
// see e.g. the Discounts report's byProduct chart) — the table below lists
// every pack in range, not just the charted top 10.
function PackUtilizationView({ data }: { data: PackUtilizationReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.rows.slice(0, 10).map((r) => ({ label: `${r.customerName} — ${r.packName}`, used: r.usedSessions, remaining: r.remainingSessions }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalPacks'), value: String(s.totalPacks) },
        { label: t('reports.summary.sessionsUsed'), value: `${s.totalSessionsUsed} / ${s.totalSessionsSold}` },
        { label: t('reports.summary.overallUtilization'), value: `${s.overallUtilizationPercent}%` }
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.packUtilizationChart')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={180} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => (value === 'used' ? t('reports.col.usedSessions') : t('reports.col.remainingSessions'))} />
              <Bar dataKey="used" stackId="pack" fill={STATUS_COLORS.brand} />
              <Bar dataKey="remaining" stackId="pack" fill={STATUS_COLORS.success} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <DataTable
          headers={[t('reports.col.customer'), t('reports.col.packName'), t('reports.col.totalSessions'), t('reports.col.usedSessions'), t('reports.col.remainingSessions'), t('reports.col.utilization')]}
          rows={data.rows.map(r => [r.customerName, r.packName, r.totalSessions, r.usedSessions, r.remainingSessions, `${r.utilizationPercent}%`])}
          emptyText={t('reports.empty.packUtilization')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 23.1 — Diagnostic Lab: Per-Test TAT target vs. actual.
// Bar chart is SLA color-flagged per the item's own spec: green when a
// test's on-time rate is 50%+ (majority meets target), red otherwise — only
// tests that actually carry a target are chart-worthy comparisons, so the
// chart is built from rows with a target; the table below lists every
// completed test, target or not, so nothing silently disappears from view.
function LabTATView({ data }: { data: LabTATReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.rows
    .filter((r) => r.targetTATHours != null)
    .slice(0, 10)
    .map((r) => ({ label: r.testName, avgActualTATHours: r.avgActualTATHours, targetTATHours: r.targetTATHours as number, onTimePercent: r.onTimePercent }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalCompleted'), value: String(s.totalCompleted) },
        { label: t('reports.summary.withTarget'), value: String(s.withTargetCount) },
        { label: t('reports.summary.overallOnTimePercent'), value: s.withTargetCount > 0 ? `${s.overallOnTimePercent}%` : '—' }
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.labTATChart')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} unit="h" />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={180} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number, name) => [`${value}h`, name === 'avgActualTATHours' ? t('reports.col.avgActualTAT') : name]} />
              <Bar dataKey="avgActualTATHours" name={t('reports.col.avgActualTAT')} radius={[0, 4, 4, 0]}>
                {chartRows.map((r, i) => <Cell key={i} fill={r.onTimePercent >= 50 ? STATUS_COLORS.success : STATUS_COLORS.danger} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <DataTable
          headers={[t('reports.col.testName'), t('reports.col.category'), t('reports.col.orders'), t('reports.col.avgActualTAT'), t('reports.col.targetTAT'), t('reports.col.onTimePercent')]}
          rows={data.rows.map(r => [r.testName, r.category ?? '—', r.ordersCount, `${r.avgActualTATHours}h`, r.targetTATHours != null ? `${r.targetTATHours}h` : '—', r.targetTATHours != null ? `${r.onTimePercent}%` : '—'])}
          emptyText={t('reports.empty.labTAT')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 23.4 — Diagnostic Lab: Test Volume by Panel. Same
// dynamic-category multi-line pattern as DiagnosisCategoryTrendView above
// (panel/category names are free text per install, series count unknown
// ahead of time) — reuses the same TREND_LINE_COLORS palette.
function TestVolumeByPanelView({ data }: { data: TestVolumeByPanelReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalTests'), value: String(s.totalTests) },
        { label: t('reports.summary.distinctPanels'), value: String(s.distinctPanelCount) }
      ]} />
      {data.byMonth.length > 0 && data.panels.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.testVolumeByPanelChart')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RCLineChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {data.panels.map((panel, i) => (
                <Line key={panel} type="monotone" dataKey={panel} name={panel} stroke={TREND_LINE_COLORS[i % TREND_LINE_COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.monthlyBreakdown')}</h3>
        <DataTable
          headers={[t('reports.col.month'), ...data.panels]}
          rows={data.byMonth.map(r => [r.month, ...data.panels.map(p => r[p] ?? 0)])}
          emptyText={t('reports.empty.testVolumeByPanel')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 23.5 (Diagnostic Lab) + item 20.1 (Specialist Clinic) —
// Referral Leaderboard. One shared view for both verticals (see
// report.service.ts's own comment on why the two underlying queries differ
// but the shape/UI genuinely doesn't need to).
function ReferralLeaderboardView({ data }: { data: ReferralLeaderboardReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.rows.slice(0, 10).map((r) => ({ label: r.referrerName, count: r.count }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalReferrals'), value: String(s.totalReferrals) },
        { label: t('reports.summary.distinctReferrers'), value: String(s.distinctReferrerCount) },
        { label: t('reports.summary.topReferrer'), value: s.topReferrerName ?? '—' }
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.referralLeaderboardChart')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={180} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" name={t('reports.col.referralCount')} fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <DataTable
          headers={[t('reports.col.referrerName'), t('reports.col.referralCount')]}
          rows={data.rows.map(r => [r.referrerName, r.count])}
          emptyText={t('reports.empty.referralLeaderboard')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 20.2 — Specialist Clinic: Second-Opinion Conversion.
function SecondOpinionConversionView({ data }: { data: SecondOpinionConversionReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalSecondOpinionVisits'), value: String(s.totalSecondOpinionVisits) },
        { label: t('reports.summary.convertedCount'), value: String(s.convertedCount) },
        { label: t('reports.summary.conversionPercent'), value: s.conversionPercent != null ? `${s.conversionPercent}%` : '—' }
      ]} />
      <div>
        <DataTable
          headers={[t('reports.col.patientName'), t('reports.col.visitDate'), t('reports.col.converted'), t('reports.col.nextVisitDate')]}
          rows={data.rows.map(r => [r.patientName, r.visitDate, r.converted ? t('common.yes') : t('common.no'), r.nextVisitDate ?? '—'])}
          emptyText={t('reports.empty.secondOpinionConversion')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 20.3 — Specialist Clinic: Case-Complexity Mix.
function CaseComplexityMixView({ data }: { data: CaseComplexityMixReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalTagged'), value: String(s.totalTagged) },
        { label: t('reports.summary.routineCount'), value: String(s.routineCount) },
        { label: t('reports.summary.complexCount'), value: String(s.complexCount) },
        { label: t('reports.summary.complexPercent'), value: s.complexPercent != null ? `${s.complexPercent}%` : '—' }
      ]} />
      {data.byMonth.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.caseComplexityMixChart')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byMonth} margin={{ left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Bar dataKey="ROUTINE" name={t('reports.col.routine')} stackId="mix" fill={STATUS_COLORS.success} radius={[0, 0, 0, 0]} />
              <Bar dataKey="COMPLEX" name={t('reports.col.complex')} stackId="mix" fill={STATUS_COLORS.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <DataTable
          headers={[t('reports.col.month'), t('reports.col.routine'), t('reports.col.complex')]}
          rows={data.byMonth.map(r => [r.month, r.ROUTINE, r.COMPLEX])}
          emptyText={t('reports.empty.caseComplexityMix')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 item 21.2 — Dental Clinic: Treatment Acceptance Rate. A
// horizontal bar per funnel stage — same layout="vertical" pattern
// ReferralLeaderboardView already established, since this codebase has no
// dedicated funnel-chart component and three ordered, narrowing stages read
// just as clearly as a ranked horizontal bar list.
function TreatmentAcceptanceRateView({ data }: { data: TreatmentAcceptanceRateReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.funnel.map((f) => ({ label: f.stage, count: f.count }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.proposedCount'), value: String(s.proposedCount) },
        { label: t('reports.summary.acceptedCount'), value: String(s.acceptedCount), sub: s.acceptanceRatePercent != null ? `${s.acceptanceRatePercent}%` : undefined },
        { label: t('reports.summary.billedCount'), value: String(s.billedCount), sub: s.billedRatePercent != null ? `${s.billedRatePercent}%` : undefined },
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.treatmentAcceptanceFunnelChart')}</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="count" name={t('reports.col.count')} fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <DataTable
          headers={[t('reports.col.stage'), t('reports.col.count')]}
          rows={data.funnel.map(f => [f.stage, f.count])}
          emptyText={t('reports.empty.treatmentAcceptanceRate')}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 54B — Cross-Business-Type Coverage Report Views
// ─────────────────────────────────────────────────────────────────────────────

function LogisticsView({ data, fmt }: { data: LogisticsReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalShipments'), value: String(s.totalShipments) },
        { label: t('reports.summary.deliveryRate'), value: `${s.deliveryRate}%` },
        { label: t('reports.summary.totalFreight'), value: fmt(s.totalFreight) },
        { label: t('reports.summary.freightPending'), value: fmt(s.freightPending) }
      ]} />
      {data.monthlyTrend.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.shipmentTrend')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.monthlyTrend}>
              <defs>
                <linearGradient id="logisticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STATUS_COLORS.brand} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={STATUS_COLORS.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="count" stroke={STATUS_COLORS.brand} strokeWidth={2} fill="url(#logisticsGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {data.topCarriers.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.topCarriers')}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.topCarriers} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.shipmentsByStatus.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.shipmentsByStatus')}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.shipmentsByStatus} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="status" tick={CHART_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={STATUS_COLORS.brand} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function AttendanceView({ data }: { data: AttendanceReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalRecords'), value: String(s.totalRecords) },
        { label: t('reports.summary.present'), value: String(s.presentCount) },
        { label: t('reports.summary.absent'), value: String(s.absentCount) },
        { label: t('reports.summary.overallAttendanceRate'), value: `${s.overallAttendanceRate}%` }
      ]} />
      {data.byEmployee.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byEmployee')}</h3>
          <ResponsiveContainer width="100%" height={Math.min(340, Math.max(140, data.byEmployee.length * 32))}>
            <BarChart data={data.byEmployee} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <YAxis type="category" dataKey="employeeName" tick={CHART_TICK} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="attendanceRate" fill={STATUS_COLORS.brand} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.attendanceDetails')}</h3>
        <DataTable
          headers={[t('reports.col.employee'), t('common.date'), t('common.status'), t('reports.col.checkIn'), t('reports.col.checkOut')]}
          rows={data.rows.map(r => [r.employeeName, formatDate(r.date), r.status, r.checkIn, r.checkOut])}
          emptyText={t('reports.empty.attendance')}
        />
      </div>
    </div>
  )
}

const PRODUCTION_STATUS_COLOR: Record<string, string> = {
  COMPLETED: STATUS_COLORS.success, IN_PROGRESS: STATUS_COLORS.brand,
  CANCELLED: STATUS_COLORS.danger, DRAFT: STATUS_COLORS.warning,
}

function ProductionView({ data }: { data: ProductionReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOrders'), value: String(s.totalOrders) },
        { label: t('reports.summary.completed'), value: String(s.completed) },
        { label: t('reports.summary.inProgress'), value: String(s.inProgress) },
        { label: t('reports.summary.completionRate'), value: `${s.completionRate}%` }
      ]} />
      {data.byStatus.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byOrderStatus')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byStatus} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="status" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.byStatus.map(st => <Cell key={st.status} fill={PRODUCTION_STATUS_COLOR[st.status] ?? STATUS_COLORS.brand} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.productionOrderDetails')}</h3>
        <DataTable
          headers={[t('reports.col.orderNumber'), t('reports.col.product'), t('reports.col.plannedQty'), t('reports.col.producedQty'), t('common.status'), t('reports.col.startDate'), t('reports.col.completedDate')]}
          rows={data.rows.map(r => [r.orderNumber, r.productName, r.plannedQty, r.producedQty, r.status, r.startDate ? formatDate(r.startDate) : '—', r.completedDate ? formatDate(r.completedDate) : '—'])}
          emptyText={t('reports.empty.productionOrders')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished Unit.
function LandedCostPerUnitView({ data, fmt }: { data: LandedCostPerUnitReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOrders'), value: String(data.summary.totalOrders) },
        { label: t('reports.summary.totalProducedQty'), value: String(data.summary.totalProducedQty) },
      ]} />
      {data.rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.landedCostPerUnitByProduct')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, data.rows.length * 40)}>
            <BarChart data={data.rows.map(r => ({ label: r.productName, material: r.materialCostPerUnit, labor: r.laborCostPerUnit, overhead: r.overheadCostPerUnit }))} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => t(`reports.col.${value}CostPerUnit`)} />
              <Bar dataKey="material" stackId="landedCost" fill={STATUS_COLORS.brand} />
              <Bar dataKey="labor" stackId="landedCost" fill={STATUS_COLORS.success} />
              <Bar dataKey="overhead" stackId="landedCost" fill={STATUS_COLORS.warning} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.product'), t('reports.col.producedQty'), t('reports.col.materialCostPerUnit'), t('reports.col.laborCostPerUnit'), t('reports.col.overheadCostPerUnit'), t('reports.col.totalCostPerUnit')]}
        rows={data.rows.map(r => [r.productName, r.producedQty, fmt(r.materialCostPerUnit), fmt(r.laborCostPerUnit), fmt(r.overheadCostPerUnit), fmt(r.totalCostPerUnit)])}
        emptyText={t('reports.empty.landedCostPerUnit')}
      />
    </div>
  )
}

// Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend.
function RejectionRateTrendView({ data }: { data: RejectionRateTrendReport }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.qtyInspected'), value: String(data.summary.totalInspected) },
        { label: t('reports.col.qtyRejected'), value: String(data.summary.totalRejected) },
        { label: t('reports.summary.overallRejectionRate'), value: `${data.summary.overallRejectionRatePercent}%` },
      ]} />
      {data.trend.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.rejectionRateTrend')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RCLineChart data={data.trend} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="rejectionRatePercent" name={t('reports.col.rejectionRatePercent')} stroke={STATUS_COLORS.danger} strokeWidth={2} dot={{ r: 3 }} />
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.rejectionRateByStage')}</h3>
        <DataTable
          headers={[t('reports.col.stage'), t('reports.col.qtyInspected'), t('reports.col.qtyRejected'), t('reports.col.rejectionRatePercent')]}
          rows={data.byStage.map(r => [r.taskName, r.qtyInspected, r.qtyRejected, `${r.rejectionRatePercent}%`])}
          emptyText={t('reports.empty.rejectionRateTrend')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Agri Inputs item 2: Seasonal Credit Exposure.
function SeasonalCreditExposureView({ data, fmt }: { data: SeasonalCreditExposureReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOutstanding'), value: fmt(data.summary.totalOutstanding) },
        { label: t('reports.col.invoiceCount'), value: String(data.summary.totalInvoices) },
        { label: t('reports.summary.peakMonth'), value: data.summary.peakMonth ?? '—' },
      ]} />
      {data.summary.totalOutstanding > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.seasonalCreditExposureByMonth')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RCLineChart data={data.byMonth} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="outstandingAmount" name={t('reports.summary.totalOutstanding')} stroke={STATUS_COLORS.warning} strokeWidth={2} dot={{ r: 3 }} />
            </RCLineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.bySeason')}</h3>
        <DataTable
          headers={[t('reports.col.season'), t('reports.col.outstandingAmount'), t('reports.col.invoiceCount')]}
          rows={data.bySeason.map(r => [r.seasonName, fmt(r.outstandingAmount), r.invoiceCount])}
          emptyText={t('reports.empty.seasonalCreditExposure')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Agri Inputs item 4: Farmer-Wise Purchase & Repayment History.
function FarmerRepaymentView({ data, fmt }: { data: FarmerRepaymentReport; fmt: (n: number) => string }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalFarmers'), value: String(data.summary.totalFarmers) },
        { label: t('reports.summary.totalOutstanding'), value: fmt(data.summary.totalOutstanding) },
        { label: t('reports.summary.overallRepaymentRate'), value: `${data.summary.overallRepaymentRatePercent}%` },
      ]} />
      <DataTable
        headers={[t('reports.col.customer'), t('reports.col.totalPurchased'), t('reports.col.totalRepaid'), t('reports.col.outstandingBalance'), t('reports.col.repaymentRatePercent')]}
        rows={data.rows.map(r => [r.customerName, fmt(r.totalPurchased), fmt(r.totalRepaid), fmt(r.outstandingBalance), `${r.repaymentRatePercent}%`])}
        emptyText={t('reports.empty.farmerRepayment')}
      />
    </div>
  )
}

const WARRANTY_BUCKET_COLOR: Record<WarrantyBucketId, string> = {
  expired: STATUS_COLORS.dangerDeep, expiringSoon: STATUS_COLORS.warning,
  active: STATUS_COLORS.success, noWarranty: '#94a3b8',
}
const WARRANTY_BUCKET_LABEL_KEY: Record<WarrantyBucketId, string> = {
  expired: 'reports.val.warrantyExpired', expiringSoon: 'reports.val.warrantyExpiringSoon',
  active: 'reports.val.warrantyActive', noWarranty: 'reports.val.noWarranty',
}

function SerialWarrantyView({ data }: { data: SerialWarrantyReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartData = data.buckets.map(b => ({ ...b, name: t(WARRANTY_BUCKET_LABEL_KEY[b.bucket]) }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalSerials'), value: String(s.totalSerials) },
        { label: t('reports.summary.inStock'), value: String(s.inStock) },
        { label: t('reports.summary.warrantyExpiringSoon'), value: String(s.warrantyExpiringSoon) },
        { label: t('reports.summary.warrantyExpired'), value: String(s.warrantyExpired) }
      ]} />
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byWarrantyStatus')}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={CHART_TICK} tickLine={false} axisLine={false} width={110} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map(b => <Cell key={b.bucket} fill={WARRANTY_BUCKET_COLOR[b.bucket]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.serialDetails')}</h3>
        <DataTable
          headers={[t('reports.col.serialNumber'), t('reports.col.product'), t('common.status'), t('reports.col.warrantyExpiry'), t('reports.col.daysToExpiry')]}
          rows={data.rows.map(r => [r.serialNumber, r.productName, r.status, r.warrantyExpiryDate ? formatDate(r.warrantyExpiryDate) : '—', r.daysToExpiry ?? '—'])}
          emptyText={t('reports.empty.serials')}
        />
      </div>
    </div>
  )
}

// Phase 67 §9.1 — Electronics: RMA Aging Report. Top units by days with
// vendor — overdue ones colored distinctly (STATUS_COLORS.dangerDeep,
// matching WARRANTY_BUCKET_COLOR's own "expired" choice above) so the ones
// past the 30-day SLA stand out at a glance, not just in the table below.
function RmaAgingView({ data }: { data: RmaAgingReport }) {
  const { t } = useTranslation()
  const chartRows = data.rows.slice(0, 10).map(r => ({ label: `${r.claimNumber} — ${r.productName}`, value: r.daysWithVendor, isOverdue: r.isOverdue }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOpen'), value: String(data.summary.totalOpen) },
        { label: t('reports.val.overdue'), value: String(data.summary.overdueCount) },
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.daysWithVendorByUnit')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={220} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="value" name={t('reports.col.daysWithVendor')} radius={[0, 4, 4, 0]}>
                {chartRows.map((r, i) => <Cell key={i} fill={r.isOverdue ? STATUS_COLORS.dangerDeep : STATUS_COLORS.warning} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.claimNumber'), t('reports.col.product'), t('reports.col.supplier'), t('reports.col.daysWithVendor'), t('common.status')]}
        rows={data.rows.map(r => [r.claimNumber, r.productName, r.vendorName ?? '—', r.daysWithVendor, r.isOverdue ? t('reports.val.overdue') : t('reports.val.onTrack')])}
        emptyText={t('reports.empty.rmaAging')}
      />
    </div>
  )
}

function VendorRecoveryLedgerView({ data }: { data: VendorRecoveryLedgerReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.rows.filter(r => !r.isClosed).slice(0, 10).map(r => ({ label: `${r.claimNumber} — ${r.productName}`, value: r.outstandingAmount }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.col.claimedAmount'), value: formatCurrency(s.totalClaimed) },
        { label: t('reports.col.recoveredAmount'), value: formatCurrency(s.totalRecovered) },
        { label: t('reports.summary.totalOutstanding'), value: formatCurrency(s.totalOutstanding) },
        { label: t('reports.val.open'), value: String(s.openCount) },
        { label: t('reports.val.closed'), value: String(s.closedCount) }
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.outstandingByClaim')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={220} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" name={t('reports.summary.totalOutstanding')} radius={[0, 4, 4, 0]} fill={STATUS_COLORS.dangerDeep} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.claimNumber'), t('reports.col.product'), t('reports.col.supplier'), t('reports.col.claimedAmount'), t('reports.col.recoveredAmount'), t('reports.summary.totalOutstanding'), t('common.status')]}
        rows={data.rows.map(r => [r.claimNumber, r.productName, r.vendorName ?? '—', formatCurrency(r.claimedAmount), formatCurrency(r.recoveredAmount), formatCurrency(r.outstandingAmount), r.isClosed ? t('reports.val.closed') : t('reports.val.open')])}
        emptyText={t('reports.empty.vendorRecoveryLedger')}
      />
    </div>
  )
}

function RepairTurnaroundByTechnicianView({ data }: { data: RepairTurnaroundByTechnicianReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartRows = data.rows.map(r => ({ label: r.technicianName, value: r.avgTurnaroundDays }))
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.technicianCount'), value: String(s.technicianCount) },
        { label: t('reports.summary.totalTicketsCompleted'), value: String(s.totalTicketsCompleted) },
        { label: t('reports.col.avgTurnaroundDays'), value: String(s.overallAvgTurnaroundDays) }
      ]} />
      {chartRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.summary.avgTurnaroundByTechnician')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, chartRows.length * 34)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ ...CHART_TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={140} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="value" name={t('reports.col.avgTurnaroundDays')} radius={[0, 4, 4, 0]} fill={STATUS_COLORS.brand} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable
        headers={[t('reports.col.technician'), t('reports.col.ticketCount'), t('reports.col.avgTurnaroundDays'), t('reports.col.minTurnaroundDays'), t('reports.col.maxTurnaroundDays')]}
        rows={data.rows.map(r => [r.technicianName, r.ticketCount, r.avgTurnaroundDays, r.minTurnaroundDays, r.maxTurnaroundDays])}
        emptyText={t('reports.empty.repairTurnaroundByTechnician')}
      />
    </div>
  )
}

// Variant stock deliberately has no chart: a real catalog can run to dozens
// of size/color combinations per product, well past the dataviz skill's own
// "more than ~7 classes that all carry meaning → a table, not more colors"
// threshold — the table is the honest, legible form here, not a decorative
// bar chart with 40 unreadable ticks.
function VariantStockView({ data }: { data: VariantStockReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalVariants'), value: String(s.totalVariants) },
        { label: t('reports.summary.totalStockQty'), value: String(s.totalStockQty) },
        { label: t('reports.summary.outOfStockVariants'), value: String(s.outOfStockVariants) }
      ]} />
      <DataTable
        headers={[t('reports.col.product'), t('reports.col.size'), t('reports.col.color'), t('reports.col.sku'), t('reports.col.stockQty')]}
        rows={data.rows.map(r => [r.productName, r.size, r.color, r.sku, r.stockQty])}
        emptyText={t('reports.empty.variants')}
      />
    </div>
  )
}

function TestScoreView({ data }: { data: TestScoreReport }) {
  const { t } = useTranslation()
  const s = data.summary
  const chartData = data.studentSummaries.slice(0, 10)
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalTests'), value: String(s.totalTests) },
        { label: t('reports.summary.averagePercentage'), value: `${s.averagePercentage}%` },
        { label: t('reports.summary.belowFiftyCount'), value: String(s.belowFiftyCount) },
        { label: t('reports.summary.studentCount'), value: String(s.studentCount) }
      ]} />
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-4">{t('reports.section.byStudent')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis type="category" dataKey="studentName" tick={CHART_TICK} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="averagePercentage" radius={[0, 4, 4, 0]}>
                {chartData.map((r, i) => <Cell key={i} fill={r.averagePercentage < 50 ? STATUS_COLORS.danger : STATUS_COLORS.success} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.testScoreDetails')}</h3>
        <DataTable
          headers={[t('reports.col.studentName'), t('reports.col.batchName'), t('reports.col.subject'), t('reports.col.testName'), t('reports.col.marksObtained'), t('reports.col.maxMarks'), t('reports.col.percentage'), t('reports.col.grade'), t('common.date')]}
          rows={data.rows.map(r => [r.studentName, r.batchName, r.subject, r.testName, r.marksObtained, r.maxMarks, `${r.percentage}%`, r.grade, formatDate(r.testDate)])}
          emptyText={t('reports.empty.testScores')}
        />
      </div>
    </div>
  )
}

function ComplianceTaskView({ data }: { data: ComplianceTaskReport }) {
  const { t } = useTranslation()
  const s = data.summary
  return (
    <div className="space-y-6">
      <SummaryCards cards={[
        { label: t('reports.summary.totalOpen'), value: String(s.totalOpen) },
        { label: t('reports.summary.overdueCount'), value: String(s.overdueCount) },
        { label: t('reports.summary.dueThisWeekCount'), value: String(s.dueThisWeekCount) },
        { label: t('reports.summary.clientCount'), value: String(s.clientCount) }
      ]} />
      <div>
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('reports.section.complianceTaskDetails')}</h3>
        <DataTable
          headers={[t('reports.col.customer'), t('reports.col.title'), t('reports.col.category'), t('reports.col.dueDate'), t('reports.col.daysUntilDue'), t('common.status'), t('reports.col.priority')]}
          rows={data.rows.map(r => [r.clientName, r.title, r.category, formatDate(r.dueDate), r.daysUntilDue, r.status, r.priority])}
          emptyText={t('reports.empty.complianceTasks')}
        />
      </div>
    </div>
  )
}
