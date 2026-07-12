import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3, Package, Receipt, Users, Truck, AlertCircle,
  DollarSign, Shield, ChevronRight, Download, FileText,
  Table, RefreshCw, Calendar, HardDrive, Utensils,
  Activity, UserCheck, Award, QrCode, PackageSearch, FlaskConical, Droplet,
  Boxes, CalendarCheck, Factory, ScanLine, Shirt, GraduationCap, ClipboardCheck, FileStack, CalendarClock, Gem, TrendingUp,
  Briefcase, Wrench
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore, type TemplateModule } from '@app/store/industry.store'
import { useBusinessStore } from '@app/store/business.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Select } from '@shared/ui/atoms/Select'

// ─────────────────────────────────────────────────────────────────────────────
// Types (local duplicates — avoids cross-boundary imports from main process)
// ─────────────────────────────────────────────────────────────────────────────

interface SalesReportRow { invoiceNumber: string; date: string; customer: string | null; itemCount: number; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number; paymentMethod: string; paymentStatus: string }
interface SalesReportGroup { label: string; revenue: number; invoiceCount: number; taxAmount: number }
interface SalesReportHourRow { hour: string; revenue: number; invoiceCount: number }
interface SalesReport { dateFrom?: string; dateTo?: string; groupBy?: string; summary: { totalRevenue: number; totalInvoices: number; totalTax: number; averageOrderValue: number; cancelledInvoices: number }; groups: SalesReportGroup[]; byHour: SalesReportHourRow[]; rows: SalesReportRow[]; total: number }

interface InventoryReportRow { sku: string | null; productName: string; category: string | null; productType: string; currentStock: number; unit: string; costPrice: number; sellingPrice: number; stockValue: number; lowStockAlert: boolean }
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

interface AuditReportRow { date: string; user: string; action: string; entityType: string; entityId: string; details: string | null }
interface AuditReport { dateFrom?: string; dateTo?: string; totalRecords: number; rows: AuditReportRow[]; page: number; limit: number }

interface FoodCostReportRow { ingredientName: string; unit: string; totalQuantityUsed: number; costPrice: number; totalCost: number }
interface FoodCostReport { dateFrom?: string; dateTo?: string; totalCost: number; rows: FoodCostReportRow[] }

interface GSTR1B2BRow { gstin: string; receiverName: string; invoiceNumber: string; invoiceDate: string; invoiceValue: number; placeOfSupply: string; taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number; rate: number }
interface GSTR1B2CSRow { placeOfSupply: string; rate: number; taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number }
interface GSTR1Report { period: string; b2b: GSTR1B2BRow[]; b2cs: GSTR1B2CSRow[]; summary: { totalB2BValue: number; totalB2CSValue: number; totalIgst: number; totalCgst: number; totalSgst: number } }

interface HSNSummaryRow { hsnCode: string; description: string; uqc: string; totalQuantity: number; totalValue: number; taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number }
interface HSNSummaryReport { period: string; b2b: HSNSummaryRow[]; b2c: HSNSummaryRow[]; summary: { totalTaxableValue: number; totalTax: number; rowCount: number } }

interface DocumentSummaryRow { documentType: string; seriesPrefix: string; fromNumber: string; toNumber: string; totalCount: number; cancelledCount: number }
interface DocumentSummaryReport { period: string; rows: DocumentSummaryRow[] }

interface RentalStatusRow { bookingNumber: string; customerName: string; productName: string; unitLabel: string | null; startDateTime: string; endDateTime: string; isOverdue: boolean; daysOverdue: number }
interface RentalStatusReport { rows: RentalStatusRow[]; summary: { totalCheckedOut: number; overdueCount: number } }

interface RentalRevenueRow { productName: string; bookingCount: number; totalRevenue: number; unitCount: number | null; utilizationPercent: number | null }
interface RentalRevenueReport { dateFrom: string; dateTo: string; rows: RentalRevenueRow[]; summary: { totalRevenue: number; totalBookings: number } }

interface GSTR3BStateRow { state: string; taxableValue: number; igstAmount: number }
interface GSTR3BPreview {
  period: string
  table31: { taxableOutwardSupplies: number; zeroRatedSupplies: number; exemptNilNonGstSupplies: number; taxAmount: { igst: number; cgst: number; sgst: number } }
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
interface BatchExpiryBucket { bucket: ExpiryBucketId; label: string; count: number; quantityRemaining: number }
interface BatchExpiryRow { productName: string; batchNumber: string; expiryDate: string; daysToExpiry: number; quantityRemaining: number; bucket: ExpiryBucketId; unitCost: number; supplierName: string | null }
interface BatchExpiryReport { generatedAt: string; summary: { totalBatches: number; expiredCount: number; criticalCount: number; warningCount: number; safeCount: number; expiredValue: number }; buckets: BatchExpiryBucket[]; rows: BatchExpiryRow[] }

interface LabThroughputStage { status: string; label: string; count: number }
interface LabThroughputRow { orderNumber: string; patientName: string; status: string; createdAt: string; reportedAt: string | null; turnaroundHours: number | null }
interface LabThroughputReport { dateFrom: string; dateTo: string; summary: { totalOrders: number; delivered: number; cancelled: number; pendingCount: number; avgTurnaroundHours: number | null }; byStatus: LabThroughputStage[]; rows: LabThroughputRow[] }

interface BloodStockByGroup { bloodGroup: string; available: number; expiringSoon: number }
interface BloodStockReportRow { donationNumber: string; bloodGroup: string; componentType: string; expiryDate: string; daysToExpiry: number; isExpiringSoon: boolean }
interface BloodStockReport { generatedAt: string; summary: { totalAvailable: number; totalExpiringSoon: number; groupsWithNoStock: string[] }; byGroup: BloodStockByGroup[]; rows: BloodStockReportRow[] }

// Fresh-audit fix (2026-07-12) — Jewellery had zero reports
interface JewelleryStockRow { metalType: string; purity: string; netWeightGrams: number; ratePerGram: number | null; valuationAmount: number }
// Fresh-audit fix (2026-07-12) — SERVICE/CONSULTANT/REPAIR previously had
// zero vertical-specific reports at all.
interface ProjectReportRow { projectName: string; clientName: string; status: string; projectType: string; totalContractValue: number | null; startDate: string | null; expectedEndDate: string | null; completedDate: string | null }
interface ProjectReportByStatus { status: string; count: number }
interface ProjectReport {
  dateFrom: string; dateTo: string
  summary: { totalProjects: number; active: number; completed: number; onHold: number; cancelled: number; totalContractValue: number }
  byStatus: ProjectReportByStatus[]; rows: ProjectReportRow[]
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

type WarrantyBucketId = 'expired' | 'expiringSoon' | 'active' | 'noWarranty'
interface SerialWarrantyBucket { bucket: WarrantyBucketId; count: number }
interface SerialWarrantyRow { serialNumber: string; productName: string; status: string; warrantyExpiryDate: string | null; daysToExpiry: number | null }
interface SerialWarrantyReport {
  generatedAt: string
  summary: { totalSerials: number; inStock: number; sold: number; warrantyExpiringSoon: number; warrantyExpired: number }
  buckets: SerialWarrantyBucket[]; rows: SerialWarrantyRow[]
}

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
  | 'customerLedger' | 'supplierLedger' | 'expenses' | 'profitAndLoss' | 'audit' | 'backup'
  | 'foodCost' | 'gstr1' | 'hsnSummary' | 'documentSummary' | 'gstr3bPreview'
  | 'appointmentUtilisation' | 'clientRetention' | 'commission'
  | 'orderVolume' | 'batchExpiry' | 'labThroughput' | 'bloodStock' | 'jewellery'
  | 'logistics' | 'attendance' | 'production' | 'serialWarranty' | 'variantStock'
  | 'testScores' | 'complianceTasks'
  | 'rentalStatus' | 'rentalRevenue' | 'projects' | 'jobCards'

interface ReportDef {
  id: ReportType; label: string; description: string
  icon: React.ReactNode; category: string; requiresDateRange: boolean
  requiresEntity?: 'customer' | 'supplier'
  permission: string
  requiredModule?: TemplateModule
}

const REPORT_DEF_META: { id: ReportType; icon: React.ReactNode; category: string; requiresDateRange: boolean; requiresEntity?: 'customer' | 'supplier'; permission: string; requiredModule?: TemplateModule }[] = [
  { id: 'sales', icon: <BarChart3 size={18} />, category: 'sales', requiresDateRange: true, permission: 'reports.sales' },
  { id: 'inventory', icon: <Package size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory' },
  { id: 'tax', icon: <Receipt size={18} />, category: 'finance', requiresDateRange: true, permission: 'reports.tax' },
  { id: 'outstanding', icon: <AlertCircle size={18} />, category: 'finance', requiresDateRange: false, permission: 'reports.outstanding' },
  { id: 'customerLedger', icon: <Users size={18} />, category: 'customers', requiresDateRange: false, requiresEntity: 'customer', permission: 'reports.invoices' },
  { id: 'supplierLedger', icon: <Truck size={18} />, category: 'suppliers', requiresDateRange: false, requiresEntity: 'supplier', permission: 'reports.financial' },
  { id: 'expenses', icon: <DollarSign size={18} />, category: 'finance', requiresDateRange: true, permission: 'reports.financial' },
  { id: 'profitAndLoss', icon: <TrendingUp size={18} />, category: 'finance', requiresDateRange: true, permission: 'analytics.viewProfit' },
  { id: 'audit', icon: <Shield size={18} />, category: 'admin', requiresDateRange: false, permission: 'audit.view' },
  { id: 'backup', icon: <HardDrive size={18} />, category: 'admin', requiresDateRange: false, permission: 'backup.view' },
  { id: 'foodCost', icon: <Utensils size={18} />, category: 'restaurant', requiresDateRange: true, permission: 'reports.financial', requiredModule: 'ingredient_tracking' },
  { id: 'orderVolume', icon: <QrCode size={18} />, category: 'restaurant', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'qr_table_ordering' },
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
  { id: 'jewellery', icon: <Gem size={18} />, category: 'jewellery', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'jewellery_pricing' },
  { id: 'logistics', icon: <Boxes size={18} />, category: 'logistics', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'logistics_analytics' },
  { id: 'attendance', icon: <CalendarCheck size={18} />, category: 'admin', requiresDateRange: true, permission: 'reports.sales' },
  { id: 'production', icon: <Factory size={18} />, category: 'inventory', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'production_orders' },
  { id: 'serialWarranty', icon: <ScanLine size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredModule: 'serial_tracking' },
  { id: 'variantStock', icon: <Shirt size={18} />, category: 'inventory', requiresDateRange: false, permission: 'reports.inventory', requiredModule: 'variant_tracking' },
  { id: 'testScores', icon: <GraduationCap size={18} />, category: 'service', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'coaching_performances' },
  { id: 'complianceTasks', icon: <ClipboardCheck size={18} />, category: 'service', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'compliance_tasks' },
  { id: 'rentalStatus', icon: <CalendarClock size={18} />, category: 'rental', requiresDateRange: false, permission: 'reports.sales', requiredModule: 'rental_bookings' },
  { id: 'rentalRevenue', icon: <BarChart3 size={18} />, category: 'rental', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'rental_bookings' },
  { id: 'projects', icon: <Briefcase size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'projects' },
  { id: 'jobCards', icon: <Wrench size={18} />, category: 'service', requiresDateRange: true, permission: 'reports.sales', requiredModule: 'job_cards' },
]

const CATEGORY_IDS = ['sales', 'inventory', 'finance', 'customers', 'suppliers', 'admin', 'restaurant', 'gst', 'service', 'bloodBank', 'jewellery', 'logistics', 'rental']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFmt(_sym: string) { return (n: number) => formatCurrency(n) }
function today() { return new Date().toISOString().slice(0, 10) }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

// ─────────────────────────────────────────────────────────────────────────────
// ReportsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function ReportsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const { isModuleEnabled } = useIndustryStore()
  const taxModel = useBusinessStore(s => s.profile?.taxModel ?? 'NONE')
  const hasPermission = useAuthStore(s => s.hasPermission)

  const [activeReport, setActiveReport] = useState<ReportType>('sales')
  const [reportData, setReportData] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [hasRun, setHasRun] = useState(false)
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
        case 'audit':
          res = await window.api.reports.audit({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: 1, limit: AUDIT_PAGE_SIZE })
          break
        case 'backup':
          res = await window.api.backup.list()
          break
        case 'foodCost':
          res = await window.api.reports.foodCost({ dateFrom, dateTo })
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
        case 'batchExpiry':
          res = await window.api.reports.batchExpiry()
          break
        case 'labThroughput':
          res = await window.api.reports.labThroughput({ dateFrom, dateTo })
          break
        case 'bloodStock':
          res = await window.api.reports.bloodStock()
          break
        case 'jewellery':
          res = await window.api.reports.jewellery({ dateFrom, dateTo })
          break
        case 'projects':
          res = await window.api.reports.projects({ dateFrom, dateTo })
          break
        case 'jobCards':
          res = await window.api.reports.jobCards({ dateFrom, dateTo })
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
        case 'serialWarranty':
          res = await window.api.reports.serialWarranty()
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
      case 'jewellery': {
        const d = reportData as JewelleryReport
        return {
          headers: [t('jewellery.metalType'), t('jewellery.purity'), t('reports.col.netWeightGrams'), t('reports.col.ratePerGram'), t('reports.col.valuation')],
          rows: d.stockByMetal.map(r => [r.metalType, r.purity, r.netWeightGrams, r.ratePerGram, r.valuationAmount])
        }
      }
      case 'projects': {
        const d = reportData as ProjectReport
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
      case 'serialWarranty': {
        const d = reportData as SerialWarrantyReport
        return {
          headers: [t('reports.col.serialNumber'), t('reports.col.product'), t('common.status'), t('reports.col.warrantyExpiry'), t('reports.col.daysToExpiry')],
          rows: d.rows.map(r => [r.serialNumber, r.productName, r.status, r.warrantyExpiryDate, r.daysToExpiry])
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
    try {
      const { headers, rows } = buildExportData()
      const res = await window.api.export.toCsv({ filename: `${activeReport}-report.csv`, headers, rows })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }

  async function handleExportExcel() {
    try {
      const { headers, rows } = buildExportData()
      const res = await window.api.export.toExcel({
        filename: `${activeReport}-report.xlsx`,
        sheets: [{ name: def.label, headers, rows }]
      })
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }

  async function handleExportPdf() {
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
    }
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
      case 'jewellery': {
        const d = reportData as JewelleryReport
        return [
          { label: t('reports.summary.totalStockValuation'), value: fmt(d.summary.totalStockValuationAmount) },
          { label: t('reports.summary.totalMakingChargeRevenue'), value: fmt(d.summary.totalMakingChargeRevenue) },
          { label: t('reports.summary.totalExchangeCount'), value: String(d.summary.totalExchangeCount) },
          { label: t('reports.summary.totalExchangeValueGiven'), value: fmt(d.summary.totalExchangeValueGiven) }
        ]
      }
      case 'projects': {
        const d = reportData as ProjectReport
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
      case 'serialWarranty': {
        const d = reportData as SerialWarrantyReport
        return [
          { label: t('reports.summary.totalSerials'), value: String(d.summary.totalSerials) },
          { label: t('reports.summary.inStock'), value: String(d.summary.inStock) },
          { label: t('reports.summary.warrantyExpiringSoon'), value: String(d.summary.warrantyExpiringSoon) },
          { label: t('reports.summary.warrantyExpired'), value: String(d.summary.warrantyExpired) }
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
      // Deliberately no chart — this is a statement for one specific account,
      // often printed to hand directly to that customer/supplier or filed for
      // records; a formal statement doesn't traditionally carry a chart, and
      // with typically few transactions the balance line is rarely more than
      // 2-3 points anyway.
      case 'customerLedger':
      case 'supplierLedger': return []
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
      // Deliberately no chart — this report's rows are individual active
      // bookings (a to-do list: who's overdue, what's still out), same
      // category as the already chart-free Compliance Task Report.
      case 'rentalStatus': return []
      case 'rentalRevenue': {
        const d = reportData as RentalRevenueReport
        if (d.rows.length === 0) return []
        return [{ type: 'bar', title: t('reports.summary.totalRevenue'), data: d.rows.slice(0, 10).map(r => ({ label: r.productName, value: r.totalRevenue })), valueIsCurrency: true }]
      }
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
      case 'jewellery': {
        const d = reportData as JewelleryReport
        if (d.stockByMetal.length === 0) return []
        return [{
          type: 'bar', title: t('reports.section.stockByMetal'),
          data: d.stockByMetal.map(g => ({ label: `${g.metalType} ${g.purity}`, value: g.valuationAmount })),
          valueIsCurrency: true,
        }]
      }
      case 'projects': {
        const d = reportData as ProjectReport
        if (d.byStatus.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count })) }]
      }
      case 'jobCards': {
        const d = reportData as JobCardReport
        if (d.byStatus.length === 0) return []
        return [{ type: 'bar', title: t('reports.section.byOrderStatus'), data: d.byStatus.map(s => ({ label: s.status, value: s.count })) }]
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
      case 'serialWarranty': {
        const d = reportData as SerialWarrantyReport
        return [{ type: 'bar', orientation: 'vertical', title: t('reports.section.byWarrantyStatus'), data: d.buckets.map(b => ({ label: t(WARRANTY_BUCKET_LABEL_KEY[b.bucket]), value: b.count, color: WARRANTY_BUCKET_COLOR[b.bucket] })) }]
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
      <div className="w-64 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
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
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      activeReport === r.id
                        ? 'bg-brand/10 text-brand border-r-2 border-brand'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}>
                    <span className={cn('shrink-0', activeReport === r.id ? 'text-brand' : 'text-slate-400 dark:text-slate-500')}>{r.icon}</span>
                    <span className="text-sm font-medium truncate">{r.label}</span>
                    <ChevronRight size={12} className={cn('ml-auto shrink-0 transition-opacity', activeReport === r.id ? 'opacity-100 text-brand' : 'opacity-0')} />
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
                <button onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand hover:text-brand transition-colors">
                  <Table size={12} /> CSV
                </button>
                <button onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-success hover:text-success transition-colors">
                  <Download size={12} /> Excel
                </button>
                <button onClick={handleExportPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-danger hover:text-danger transition-colors">
                  <FileText size={12} /> PDF
                </button>
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
                  <div className="absolute top-full left-0 z-20 mt-1 w-52 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                    {customerResults.slice(0, 8).map(c => (
                      <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.customerName); setCustomerResults([]) }}
                        className="w-full text-left px-3 py-2 text-sm dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
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
                  <div className="absolute top-full left-0 z-20 mt-1 w-52 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
                    {supplierResults.slice(0, 8).map(s => (
                      <button key={s.id} onClick={() => { setSupplierId(s.id); setSupplierSearch(s.supplierName); setSupplierResults([]) }}
                        className="w-full text-left px-3 py-2 text-sm dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {s.supplierName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Optional date range for non-date-required, non-simple reports */}
            {!def.requiresDateRange && activeReport !== 'inventory' && activeReport !== 'outstanding' && activeReport !== 'backup' && activeReport !== 'batchExpiry' && activeReport !== 'bloodStock' && activeReport !== 'serialWarranty' && activeReport !== 'variantStock' && activeReport !== 'complianceTasks' && (
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
            <ReportContent reportType={activeReport} data={reportData} fmt={fmt} currencySymbol={currencySymbol} onAuditPageChange={goToAuditPage} />
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
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">{h}</th>
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

function ReportContent({ reportType, data, fmt, currencySymbol, onAuditPageChange }: {
  reportType: ReportType; data: unknown
  fmt: (n: number) => string; currencySymbol: string
  onAuditPageChange: (page: number) => void
}) {
  switch (reportType) {
    case 'sales': return <SalesReportView data={data as SalesReport} fmt={fmt} />
    case 'inventory': return <InventoryReportView data={data as InventoryReport} fmt={fmt} />
    case 'tax': return <TaxReportView data={data as TaxReport} fmt={fmt} />
    case 'outstanding': return <OutstandingReportView data={data as OutstandingReport} fmt={fmt} />
    case 'customerLedger': return <LedgerReportView data={data as CustomerLedgerReport} entityType="customer" fmt={fmt} currencySymbol={currencySymbol} />
    case 'supplierLedger': return <LedgerReportView data={data as CustomerLedgerReport} entityType="supplier" fmt={fmt} currencySymbol={currencySymbol} />
    case 'expenses': return <ExpenseReportView data={data as ExpenseReport} fmt={fmt} />
    case 'profitAndLoss': return <ProfitAndLossView data={data as ProfitAndLossReport} fmt={fmt} />
    case 'audit': return <AuditReportView data={data as AuditReport} onPageChange={onAuditPageChange} />
    case 'backup': return <BackupReportView data={data as unknown[]} />
    case 'foodCost': return <FoodCostReportView data={data as FoodCostReport} fmt={fmt} />
    case 'gstr1': return <GSTR1ReportView data={data as GSTR1Report} fmt={fmt} />
    case 'hsnSummary': return <HSNSummaryView data={data as HSNSummaryReport} fmt={fmt} />
    case 'documentSummary': return <DocumentSummaryView data={data as DocumentSummaryReport} />
    case 'gstr3bPreview': return <GSTR3BPreviewView data={data as GSTR3BPreview} fmt={fmt} />
    case 'rentalStatus': return <RentalStatusView data={data as RentalStatusReport} />
    case 'rentalRevenue': return <RentalRevenueView data={data as RentalRevenueReport} fmt={fmt} />
    case 'appointmentUtilisation': return <AppointmentUtilisationView data={data as AppointmentUtilisationReport} />
    case 'clientRetention': return <ClientRetentionView data={data as ClientRetentionReport} />
    case 'commission': return <CommissionReportView data={data as CommissionReport} fmt={fmt} />
    case 'orderVolume': return <OrderVolumeView data={data as OrderVolumeReport} />
    case 'batchExpiry': return <BatchExpiryView data={data as BatchExpiryReport} fmt={fmt} />
    case 'labThroughput': return <LabThroughputView data={data as LabThroughputReport} />
    case 'bloodStock': return <BloodStockView data={data as BloodStockReport} />
    case 'jewellery': return <JewelleryView data={data as JewelleryReport} fmt={fmt} />
    case 'projects': return <ProjectReportView data={data as ProjectReport} fmt={fmt} />
    case 'jobCards': return <JobCardReportView data={data as JobCardReport} fmt={fmt} />
    case 'logistics': return <LogisticsView data={data as LogisticsReport} fmt={fmt} />
    case 'attendance': return <AttendanceView data={data as AttendanceReport} />
    case 'production': return <ProductionView data={data as ProductionReport} />
    case 'serialWarranty': return <SerialWarrantyView data={data as SerialWarrantyReport} />
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
          r.sku, r.productName, r.category, r.productType, r.currentStock, r.unit,
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

function LedgerReportView({ data, entityType, fmt, currencySymbol }: {
  data: CustomerLedgerReport
  entityType: 'customer' | 'supplier'; fmt: (n: number) => string; currencySymbol: string
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
      <DataTable
        headers={[t('common.date'), t('reports.col.reference'), t('reports.col.refId'), `${t('common.debit')} (${currencySymbol})`, `${t('common.credit')} (${currencySymbol})`, `${t('common.balance')} (${currencySymbol})`, t('reports.col.remarks')]}
        rows={data.rows.map(r => [
          formatDate(r.date), r.referenceType, r.referenceId,
          r.debitAmount > 0 ? r.debitAmount.toFixed(2) : '',
          r.creditAmount > 0 ? r.creditAmount.toFixed(2) : '',
          r.balance.toFixed(2), r.remarks
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
            <div key={c.category} className="flex items-center justify-between px-5 py-2.5 pl-8">
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
          <span className="text-xs text-slate-400 ml-1">{t('reports.section.auditRecordsFound')}</span>
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
        <span className="text-xs text-slate-400 ml-1">{t('reports.section.backupsFound', { count: backups.length })}</span>
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
        { label: t('reports.summary.expiringWarning'), value: String(s.warningCount) }
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

// Fresh-audit fix (2026-07-12) — SERVICE/CONSULTANT previously had zero
// vertical-specific reports at all.
function ProjectReportView({ data, fmt }: { data: ProjectReport; fmt: (n: number) => string }) {
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
          emptyText={t('reports.empty.projects')}
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
