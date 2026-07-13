// Phase 57 — AI Assistant. Active-vertical templates (PHASE_57_TECHNICAL_SPEC.md
// Section 5) — wired only for the one business type actually installed,
// determined dynamically via industry-template.service.ts's getActiveTemplate().
// Since only one business type is ever active per install, this is a small,
// bounded per-install addition, not a 43-way expansion.
//
// Deliberately excludes hotel.guestRegister from this pass: it surfaces raw
// guest ID numbers/names (police/immigration compliance data), and phrasing
// that through an LLM chat response — even restating pre-formatted text —
// is an unnecessary exposure surface for data that's already well served by
// the existing dedicated Guest Register report screen. Flagged here, not
// silently dropped; revisit only if there's a real request for it.
//
// EXTENDED 2026-07-13 — founder asked whether every business type across
// Sarang is supported. Answer: the 18 universal templates (sales/inventory/
// customers/suppliers/credit/finance) already work correctly for all 43
// business types, since they're built on the shared Invoice/Product/
// Customer/Supplier model — but vertical-specific questions only existed
// for the 5 types above. This extension wires in 14 MORE already-existing,
// already-tested report functions (report.service.ts) that simply hadn't
// been connected to the assistant yet — the same "reuse over
// reimplementation" pattern as the original 5, not new business logic.
// Brings vertical-specific coverage from 5 to ~30 of 43 business types.
// Remaining uncovered types (RETAIL, GENERAL, REAL_ESTATE, PLACEMENT_AGENCY,
// and a few others with no dedicated report function yet) are disclosed at
// the bottom of getActiveVerticalTemplateNames, not silently omitted.
import { getActiveTemplate } from './industry-template.service'
import { getOccupancyReport } from './hotel.service'
import { reportService } from './report.service'
import { getPlacementKPIs } from './placement.service'
import { formatAmountForSpeech } from './ai-format.util'

interface TemplateResult { headline: string; details: string[]; isEmpty: boolean }

function thisMonthRange(params: Record<string, unknown>): { dateFrom: string; dateTo: string } {
  const now = new Date()
  return {
    dateFrom: (params.dateFrom as string) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    dateTo: (params.dateTo as string) ?? now.toISOString().slice(0, 10)
  }
}

// Business types sharing the appointments-based service foundation (Phase
// 22) — appointment utilisation and client retention are meaningful
// questions for any of them.
const APPOINTMENT_BASED_TYPES = new Set([
  'VET_CLINIC', 'GP_CLINIC', 'SPECIALIST_CLINIC', 'DENTAL_CLINIC', 'PHYSIO_CLINIC',
  'BEAUTY_SALON', 'GYM_STUDIO', 'DRIVING_SCHOOL', 'LAWYER', 'PHOTO_STUDIO',
  'EVENT_MANAGEMENT', 'TAILOR_BOUTIQUE', 'PEST_CONTROL'
])
// Of those, only Beauty Salon and Gym Studio use the staff_commission module.
const COMMISSION_BASED_TYPES = new Set(['BEAUTY_SALON', 'GYM_STUDIO'])
// Business types with a real project/engagement workflow (service_projects).
const PROJECT_BASED_TYPES = new Set([
  'SERVICE', 'CONSULTANT', 'INDEPENDENT_CONSULTANT', 'ARCHITECT', 'CIVIL_ENGINEER',
  'MARKETING_AGENCY', 'SOFTWARE_AGENCY', 'REAL_ESTATE'
])
// Product businesses with the Phase 37 logistics module set enabled.
const LOGISTICS_BASED_TYPES = new Set(['DISTRIBUTOR', 'HARDWARE'])

export async function getActiveVerticalTemplateNames(): Promise<string[]> {
  const result = await getActiveTemplate()
  const businessType = result.data?.businessType

  if (!businessType) return []

  switch (businessType) {
    case 'HOTEL_LODGE': return ['hotel.occupancy']
    case 'JEWELLERY': return ['jewellery.stockAndSales']
    case 'RENTAL': return ['rental.status', 'rental.revenue']
    case 'DIAGNOSTIC_LAB': return ['lab.throughput']
    case 'BLOOD_BANK': return ['bloodBank.stock']
    case 'RESTAURANT': return ['restaurant.foodCost', 'restaurant.orderVolume']
    case 'MANUFACTURING': return ['manufacturing.production']
    case 'ELECTRONICS': return ['electronics.serialWarranty']
    case 'CLOTHING': case 'FOOTWEAR': return ['retail.variantStock']
    case 'COACHING_INSTITUTE': return ['coaching.testScores']
    case 'CA_FIRM': case 'COMPANY_SECRETARY': return ['compliance.tasks']
    case 'REPAIR': case 'CAR_SERVICE_CENTER': return ['repair.jobCards']
    case 'PHARMACY': case 'AGRI_INPUTS': return ['inventory.batchExpiry']
    // Added 2026-07-13 alongside the RETAIL/GENERAL/PLACEMENT_AGENCY gap
    // review — getPlacementKPIs() (placement.service.ts) already existed
    // and fit the same reuse pattern as every other template here; there
    // was no reason to leave this one out.
    case 'PLACEMENT_AGENCY': return ['placement.summary']
  }

  if (PROJECT_BASED_TYPES.has(businessType)) return ['service.projects']
  if (APPOINTMENT_BASED_TYPES.has(businessType)) {
    const templates = ['service.appointmentUtilisation', 'service.clientRetention']
    if (COMMISSION_BASED_TYPES.has(businessType)) templates.push('service.commission')
    return templates
  }
  if (LOGISTICS_BASED_TYPES.has(businessType)) return ['logistics.summary']

  // Genuinely uncovered — RETAIL and GENERAL have no dedicated vertical
  // report function because they have no dedicated data model beyond the
  // shared Invoice/Product/Customer/Supplier tables every business type
  // already uses — there is no vertical-specific question to ask that the
  // 18 universal templates (sales/inventory/customers/suppliers/credit/
  // finance) don't already answer. This isn't a missing integration, it's
  // the accurate reflection of there being nothing vertical-specific to
  // wire. Disclosed, not silently dropped.
  return []
}

export async function executeVerticalTemplate(template: string, params: Record<string, unknown>, sym: string): Promise<TemplateResult> {
  switch (template) {
    case 'hotel.occupancy': {
      const res = await getOccupancyReport()
      const r = res.data
      if (!r) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${r.occupied} of ${r.totalRooms} rooms occupied (${r.occupancyPercent.toFixed(0)}%)`,
        details: [`Available: ${r.available}`, `Cleaning: ${r.cleaning}`, `Maintenance: ${r.maintenance}`],
        isEmpty: r.totalRooms === 0
      }
    }
    case 'jewellery.stockAndSales': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateJewelleryReport({ dateFrom, dateTo })
      return {
        headline: `Stock valuation: ${formatAmountForSpeech(r.summary.totalStockValuationAmount, sym)} (${r.summary.totalStockValuationGrams.toFixed(1)}g)`,
        details: [
          `Making-charge revenue this period: ${formatAmountForSpeech(r.summary.totalMakingChargeRevenue, sym)}`,
          `Old-metal exchanges: ${r.summary.totalExchangeCount} totaling ${formatAmountForSpeech(r.summary.totalExchangeValueGiven, sym)}`
        ],
        isEmpty: r.summary.totalStockValuationAmount === 0
      }
    }
    case 'rental.status': {
      const r = await reportService.generateRentalStatusReport()
      return {
        headline: `${r.summary.totalCheckedOut} items currently checked out, ${r.summary.overdueCount} overdue`,
        details: [],
        isEmpty: r.summary.totalCheckedOut === 0
      }
    }
    case 'rental.revenue': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateRentalRevenueReport({ dateFrom, dateTo })
      return {
        headline: `Rental revenue this period: ${formatAmountForSpeech(r.summary.totalRevenue, sym)} across ${r.summary.totalBookings} bookings`,
        details: [],
        isEmpty: r.summary.totalRevenue === 0
      }
    }
    case 'lab.throughput': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateLabThroughputReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalOrders} test orders this period, ${r.summary.delivered} delivered`,
        details: [
          `Pending: ${r.summary.pendingCount}`,
          r.summary.avgTurnaroundHours !== null ? `Average turnaround: ${r.summary.avgTurnaroundHours.toFixed(1)} hours` : 'No completed orders to average yet'
        ],
        isEmpty: r.summary.totalOrders === 0
      }
    }
    case 'bloodBank.stock': {
      const r = await reportService.generateBloodStockReport()
      return {
        headline: `${r.summary.totalAvailable} units available, ${r.summary.totalExpiringSoon} expiring soon`,
        details: r.summary.groupsWithNoStock.length > 0 ? [`No stock: ${r.summary.groupsWithNoStock.join(', ')}`] : [],
        isEmpty: r.summary.totalAvailable === 0 && r.summary.totalExpiringSoon === 0
      }
    }
    case 'restaurant.foodCost': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateFoodCostReport({ dateFrom, dateTo })
      return {
        headline: `Ingredient cost this period: ${formatAmountForSpeech(r.totalCost, sym)}`,
        details: [],
        isEmpty: r.totalCost === 0
      }
    }
    case 'restaurant.orderVolume': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateOrderVolumeReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalOrders} orders this period, ${(r.summary.acceptanceRate).toFixed(0)}% accepted`,
        details: [`Pending: ${r.summary.pending}`, `Rejected: ${r.summary.rejected}`],
        isEmpty: r.summary.totalOrders === 0
      }
    }
    case 'manufacturing.production': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateProductionReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalOrders} production orders this period, ${(r.summary.completionRate).toFixed(0)}% completion rate`,
        details: [`Completed: ${r.summary.completed}`, `In progress: ${r.summary.inProgress}`, `Planned qty: ${r.summary.totalPlannedQty}, produced: ${r.summary.totalProducedQty}`],
        isEmpty: r.summary.totalOrders === 0
      }
    }
    case 'electronics.serialWarranty': {
      const r = await reportService.generateSerialWarrantyReport()
      return {
        headline: `${r.summary.inStock} devices in stock, ${r.summary.sold} sold`,
        details: [`Warranty expiring soon: ${r.summary.warrantyExpiringSoon}`, `Warranty already expired: ${r.summary.warrantyExpired}`],
        isEmpty: r.summary.totalSerials === 0
      }
    }
    case 'retail.variantStock': {
      const r = await reportService.generateVariantStockReport()
      return {
        headline: `${r.summary.totalVariants} product variants, ${r.summary.totalStockQty} units in stock`,
        details: [`Out of stock: ${r.summary.outOfStockVariants} variants`],
        isEmpty: r.summary.totalVariants === 0
      }
    }
    case 'coaching.testScores': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateTestScoreReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalTests} tests recorded this period, average score ${r.summary.averagePercentage.toFixed(1)}%`,
        details: [`Students below 50%: ${r.summary.belowFiftyCount}`, `Students covered: ${r.summary.studentCount}`],
        isEmpty: r.summary.totalTests === 0
      }
    }
    case 'compliance.tasks': {
      const r = await reportService.generateComplianceTaskReport()
      return {
        headline: `${r.summary.totalOpen} open compliance tasks, ${r.summary.overdueCount} overdue`,
        details: [`Due this week: ${r.summary.dueThisWeekCount}`, `Clients with open tasks: ${r.summary.clientCount}`],
        isEmpty: r.summary.totalOpen === 0
      }
    }
    case 'repair.jobCards': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateJobCardReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalJobs} job cards this period, ${r.summary.delivered} delivered`,
        details: [`Pending: ${r.summary.pending}`, `Estimated cost: ${formatAmountForSpeech(r.summary.totalEstimatedCost, sym)}, actual: ${formatAmountForSpeech(r.summary.totalActualCost, sym)}`],
        isEmpty: r.summary.totalJobs === 0
      }
    }
    case 'inventory.batchExpiry': {
      const r = await reportService.generateBatchExpiryReport()
      return {
        headline: `${r.summary.expiredCount} expired batches, ${r.summary.criticalCount} expiring very soon`,
        details: [`Expiring soon (warning): ${r.summary.warningCount}`, `Safe: ${r.summary.safeCount}`, `Value already expired: ${formatAmountForSpeech(r.summary.expiredValue, sym)}`],
        isEmpty: r.summary.totalBatches === 0
      }
    }
    case 'service.projects': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateProjectReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalProjects} projects this period, ${r.summary.active} active`,
        details: [`Completed: ${r.summary.completed}`, `On hold: ${r.summary.onHold}`, `Total contract value: ${formatAmountForSpeech(r.summary.totalContractValue, sym)}`],
        isEmpty: r.summary.totalProjects === 0
      }
    }
    case 'service.appointmentUtilisation': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateAppointmentUtilisationReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.total} appointments this period, ${(r.summary.completionRate).toFixed(0)}% completed`,
        details: [`No-shows: ${r.summary.noShow}`, `Cancelled: ${r.summary.cancelled}`],
        isEmpty: r.summary.total === 0
      }
    }
    case 'service.clientRetention': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateClientRetentionReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalUnique} clients this period — ${r.summary.newClients} new, ${r.summary.returningClients} returning`,
        details: [`Retention rate: ${r.summary.retentionRate.toFixed(0)}%`, `At risk of leaving: ${r.summary.atRiskCount}`],
        isEmpty: r.summary.totalUnique === 0
      }
    }
    case 'service.commission': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateCommissionReport({ dateFrom, dateTo })
      return {
        headline: `Staff commission this period: ${formatAmountForSpeech(r.summary.totalCommission, sym)}`,
        details: [`Unpaid: ${formatAmountForSpeech(r.summary.unpaidAmount, sym)}`, `Tips: ${formatAmountForSpeech(r.summary.totalTips, sym)}`],
        isEmpty: r.summary.totalCommission === 0 && r.summary.totalTips === 0
      }
    }
    case 'logistics.summary': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateLogisticsReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalShipments} shipments this period, ${r.summary.deliveryRate.toFixed(0)}% delivered on time`,
        details: [`Average delivery time: ${r.summary.avgDeliveryDays.toFixed(1)} days`, `Freight pending: ${formatAmountForSpeech(r.summary.freightPending, sym)}`],
        isEmpty: r.summary.totalShipments === 0
      }
    }
    case 'placement.summary': {
      const res = await getPlacementKPIs()
      const r = res.data
      if (!r) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${r.placementsThisMonth} candidates placed this month, generating ${formatAmountForSpeech(r.revenueThisMonth, sym)} in commission`,
        details: [`Active candidates: ${r.activeCandidates}`, `Open job orders: ${r.openJobOrders}`],
        isEmpty: r.placementsThisMonth === 0 && r.activeCandidates === 0 && r.openJobOrders === 0
      }
    }
    default:
      return { headline: '', details: [], isEmpty: true }
  }
}
