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
import { getPrisma } from '../database/db'
import { listLegalCases } from './legal-case.service'
import { listHearings } from './hearing.service'
import { listROCFilings } from './roc-filing.service'
import { getPropertyKPIs } from './property.service'
import { listIssues } from './issue.service'
import { getShootKPIs } from './shoot-booking.service'
import { getEventKPIs } from './event-booking.service'
import { getUpcomingVaccinations } from './vaccination.service'
import { listRecalls } from './recall-record.service'
import { getCarJobCardKPIs } from './car-job-card.service'
import { getFeeKPIs } from './coaching-fee.service'

interface TemplateResult { headline: string; details: string[]; isEmpty: boolean }

// Real, verified bug fix, 2026-07 — see ai-query.service.ts's own
// toLocalISODate for the full explanation (duplicated locally rather than
// imported, matching this file's existing pattern of a local thisMonthRange
// rather than importing ai-query.service.ts's, to avoid a circular import
// since that file already imports FROM this one). In short:
// `Date.prototype.toISOString()` converts to UTC, which silently shifts the
// calendar day backward by one for any positive UTC-offset timezone
// (including IST, UTC+5:30 — this app's primary market) whenever the date
// represents a LOCAL calendar boundary rather than a real UTC instant.
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function thisMonthRange(params: Record<string, unknown>): { dateFrom: string; dateTo: string } {
  const now = new Date()
  return {
    dateFrom: (params.dateFrom as string) ?? toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    dateTo: (params.dateTo as string) ?? toLocalISODate(now)
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
    // AI expansion, 2026-07 — lab.reportsPendingFinalization reuses the same
    // generateLabThroughputReport as lab.throughput, just framed around the
    // "reports pending" question specifically rather than the full summary.
    case 'DIAGNOSTIC_LAB': return ['lab.throughput', 'lab.reportsPendingFinalization']
    case 'BLOOD_BANK': return ['bloodBank.stock']
    case 'RESTAURANT': return ['restaurant.foodCost', 'restaurant.orderVolume']
    case 'MANUFACTURING': return ['manufacturing.production']
    case 'ELECTRONICS': return ['electronics.serialWarranty']
    case 'CLOTHING': case 'FOOTWEAR': return ['retail.variantStock']
    case 'COACHING_INSTITUTE': return ['coaching.testScores', 'coaching.feeDuesAndAttendance']
    case 'CA_FIRM': case 'COMPANY_SECRETARY': return ['compliance.tasks', 'compliance.upcomingFilings']
    case 'REPAIR': return ['repair.jobCards']
    // CAR_SERVICE_CENTER split out from REPAIR (2026-07 AI expansion) — it
    // has its own dedicated car-job-card.service.ts KPI function beyond the
    // generic repair job-card report REPAIR shares.
    case 'CAR_SERVICE_CENTER': return ['repair.jobCards', 'carService.vehiclesInService']
    case 'PHARMACY': case 'AGRI_INPUTS': return ['inventory.batchExpiry']
    // Added 2026-07-13 alongside the RETAIL/GENERAL/PLACEMENT_AGENCY gap
    // review — getPlacementKPIs() (placement.service.ts) already existed
    // and fit the same reuse pattern as every other template here; there
    // was no reason to leave this one out.
    case 'PLACEMENT_AGENCY': return ['placement.summary', 'placement.pipelineByStage']
  }

  if (PROJECT_BASED_TYPES.has(businessType)) {
    // AI expansion, 2026-07 — service.unbilledTimeValue is shared with
    // LAWYER below (TimeEntry.projectId covers every type in this set;
    // TimeEntry.caseId covers LAWYER — mutually exclusive per row). Each
    // sub-type additionally gets ONE genuinely vertical-specific template on
    // top of the shared pair. MARKETING_AGENCY deliberately gets no extra:
    // this app has no ad-spend/campaign-tracking model, so "active
    // campaigns" is honestly just its existing service.projects — there's
    // nothing further to wire without inventing data that isn't tracked.
    const templates = ['service.projects', 'service.unbilledTimeValue']
    if (businessType === 'ARCHITECT') templates.push('service.drawingsPendingRevision')
    if (businessType === 'CIVIL_ENGINEER') templates.push('service.siteVisitsDueThisWeek')
    if (businessType === 'SOFTWARE_AGENCY') templates.push('service.openIssues')
    if (businessType === 'REAL_ESTATE') templates.push('realEstate.listingsAndLeads')
    return templates
  }
  if (APPOINTMENT_BASED_TYPES.has(businessType)) {
    const templates = ['service.appointmentUtilisation', 'service.clientRetention']
    if (COMMISSION_BASED_TYPES.has(businessType)) templates.push('service.commission')
    // AI expansion, 2026-07 — same "one extra vertical-specific template"
    // pattern as PROJECT_BASED_TYPES above. GP_CLINIC/SPECIALIST_CLINIC/
    // PHYSIO_CLINIC/BEAUTY_SALON/GYM_STUDIO get no extra — not part of the
    // audited 18-business-type gap list, and the shared appointment/
    // retention pair already covers their real questions.
    if (businessType === 'LAWYER') templates.push('legal.openCasesAndHearings', 'service.unbilledTimeValue')
    if (businessType === 'PHOTO_STUDIO') templates.push('photography.upcomingShoots')
    if (businessType === 'EVENT_MANAGEMENT') templates.push('events.upcoming')
    if (businessType === 'DRIVING_SCHOOL') templates.push('driving.upcomingTestsAndLowBalance')
    if (businessType === 'TAILOR_BOUTIQUE') templates.push('tailoring.ordersDueThisWeek')
    if (businessType === 'PEST_CONTROL') templates.push('pestControl.contractsDueForRenewal')
    if (businessType === 'VET_CLINIC') templates.push('vet.vaccinationsDue')
    if (businessType === 'DENTAL_CLINIC') templates.push('dental.recallsDue')
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
      // PROJECT_BASED_TYPES includes SERVICE/CONSULTANT (legacy `Project`
      // model) alongside the true ServiceProject-using verticals, but this
      // capability has only ever queried ServiceProject data (see the real
      // bug fix note on generateServiceProjectReport in report.service.ts) —
      // kept as-is here (no behavior change) since giving SERVICE/CONSULTANT
      // their own AI project capability is tracked separately as part of
      // modernizing that legacy family (PHASE_58 plan §1).
      const r = await reportService.generateServiceProjectReport({ dateFrom, dateTo })
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
    // AI expansion, 2026-07 — 18 vertical-specific templates, one per
    // audited business type. See project memory "AI Expansion Progress" for
    // the full audit and the two documented gaps (Marketing Agency ad-spend
    // and any pipeline-stage model beyond Candidate.status) this batch ran
    // into and worked around honestly rather than inventing data.
    case 'legal.openCasesAndHearings': {
      const now = new Date()
      const weekLater = new Date(now); weekLater.setDate(weekLater.getDate() + 7)
      const [casesRes, hearingsRes] = await Promise.all([
        listLegalCases({ status: 'ACTIVE' }),
        listHearings({ status: 'SCHEDULED', fromDate: toLocalISODate(now), toDate: toLocalISODate(weekLater) })
      ])
      const openCases = casesRes.data?.length ?? 0
      const upcomingHearings = hearingsRes.data?.length ?? 0
      return {
        headline: `${openCases} open cases, ${upcomingHearings} hearings scheduled in the next 7 days`,
        details: [],
        isEmpty: openCases === 0 && upcomingHearings === 0
      }
    }
    case 'compliance.upcomingFilings': {
      const res = await listROCFilings()
      const now = new Date()
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 30)
      const pending = (res.data ?? []).filter((f) => f.status !== 'FILED' && f.status !== 'ACKNOWLEDGED' && f.dueDate && new Date(f.dueDate) <= cutoff)
      return {
        headline: `${pending.length} ROC filings due in the next 30 days`,
        details: pending.slice(0, 10).map((f) => `${f.formType} for ${f.client.customerName}, due ${toLocalISODate(new Date(f.dueDate as Date))}`),
        isEmpty: pending.length === 0
      }
    }
    case 'service.drawingsPendingRevision': {
      const db = getPrisma()
      const drawings = await db.drawingRevision.findMany({
        where: { status: 'ISSUED_FOR_REVIEW' },
        select: { drawingNumber: true, title: true, project: { select: { projectName: true } } }
      })
      return {
        headline: `${drawings.length} drawings are pending review/revision`,
        details: drawings.slice(0, 10).map((d) => `${d.drawingNumber} — ${d.title} (${d.project.projectName})`),
        isEmpty: drawings.length === 0
      }
    }
    case 'service.siteVisitsDueThisWeek': {
      const db = getPrisma()
      const now = new Date()
      const weekLater = new Date(now); weekLater.setDate(weekLater.getDate() + 7)
      const visits = await db.siteVisit.findMany({
        where: { visitDate: { gte: now, lte: weekLater } },
        select: { visitDate: true, visitType: true, project: { select: { projectName: true } } }
      })
      return {
        headline: `${visits.length} site visits due in the next 7 days`,
        details: visits.slice(0, 10).map((v) => `${v.project.projectName} — ${v.visitType}, ${toLocalISODate(v.visitDate)}`),
        isEmpty: visits.length === 0
      }
    }
    case 'realEstate.listingsAndLeads': {
      const res = await getPropertyKPIs()
      const r = res.data
      if (!r) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${r.activeListings} active listings, ${r.dealsInProgress} deals in progress`,
        details: [`New inquiries this week: ${r.newInquiries}`, `Total properties on record: ${r.totalListings}`],
        isEmpty: r.activeListings === 0 && r.totalListings === 0
      }
    }
    case 'service.openIssues': {
      const res = await listIssues()
      const issues = res.data ?? []
      const open = issues.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length
      const resolved = issues.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length
      return {
        headline: `${open} open issues, ${resolved} resolved`,
        details: [],
        isEmpty: issues.length === 0
      }
    }
    case 'photography.upcomingShoots': {
      const res = await getShootKPIs()
      const r = res.data
      if (!r) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${r.upcoming} upcoming shoots, ${r.thisMonth} scheduled this month`,
        details: [`Awaiting delivery/editing: ${r.deliveriesPending}`],
        isEmpty: r.upcoming === 0 && r.thisMonth === 0
      }
    }
    case 'events.upcoming': {
      const res = await getEventKPIs()
      const r = res.data
      if (!r) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${r.upcoming} upcoming events, ${r.thisMonth} scheduled this month`,
        details: [`Vendor bookings pending: ${r.vendorsPending}`, `New inquiries this week: ${r.leadsCount}`],
        isEmpty: r.upcoming === 0 && r.thisMonth === 0
      }
    }
    case 'driving.upcomingTestsAndLowBalance': {
      const db = getPrisma()
      const now = new Date()
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 14)
      const [tests, enrollments] = await Promise.all([
        db.drivingTest.findMany({ where: { result: 'PENDING', testDate: { gte: now, lte: cutoff } }, select: { testType: true, testDate: true, learner: { select: { customerName: true } } } }),
        db.drivingPackageEnrollment.findMany({ select: { sessionsUsed: true, learner: { select: { customerName: true } }, package: { select: { totalSessions: true } } } })
      ])
      const lowBalance = enrollments.filter((e) => e.package.totalSessions - e.sessionsUsed <= 2 && e.package.totalSessions - e.sessionsUsed > 0)
      return {
        headline: `${tests.length} learners have a test scheduled in the next 14 days, ${lowBalance.length} are low on package sessions`,
        details: tests.slice(0, 5).map((t) => `${t.learner.customerName} — ${t.testType}, ${toLocalISODate(t.testDate)}`),
        isEmpty: tests.length === 0 && lowBalance.length === 0
      }
    }
    case 'tailoring.ordersDueThisWeek': {
      const db = getPrisma()
      const now = new Date()
      const weekLater = new Date(now); weekLater.setDate(weekLater.getDate() + 7)
      const orders = await db.tailoringOrder.findMany({
        where: { deliveryDate: { gte: now, lte: weekLater }, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        select: { orderNumber: true, deliveryDate: true, client: { select: { customerName: true } } }
      })
      return {
        headline: `${orders.length} tailoring orders are due for delivery in the next 7 days`,
        details: orders.slice(0, 10).map((o) => `${o.orderNumber} — ${o.client.customerName}, due ${o.deliveryDate ? toLocalISODate(o.deliveryDate) : 'unknown'}`),
        isEmpty: orders.length === 0
      }
    }
    case 'pestControl.contractsDueForRenewal': {
      const db = getPrisma()
      const now = new Date()
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 30)
      const contracts = await db.pestServiceContract.findMany({
        where: { status: 'ACTIVE', endDate: { gte: now, lte: cutoff } },
        select: { contractNumber: true, endDate: true, client: { select: { customerName: true } } }
      })
      return {
        headline: `${contracts.length} pest control contracts are due for renewal in the next 30 days`,
        details: contracts.slice(0, 10).map((c) => `${c.contractNumber} — ${c.client.customerName}, expires ${c.endDate ? toLocalISODate(c.endDate) : 'unknown'}`),
        isEmpty: contracts.length === 0
      }
    }
    case 'vet.vaccinationsDue': {
      const res = await getUpcomingVaccinations(30)
      const items = (res.data ?? []) as Array<{ nextDueDate: Date | null; pet: { petName: string; customer: { customerName: string } | null } }>
      return {
        headline: `${items.length} vaccinations due in the next 30 days`,
        details: items.slice(0, 10).map((v) => `${v.pet.petName} (${v.pet.customer?.customerName ?? 'unknown owner'}) — due ${v.nextDueDate ? toLocalISODate(v.nextDueDate) : 'unknown'}`),
        isEmpty: items.length === 0
      }
    }
    case 'dental.recallsDue': {
      const now = new Date()
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 30)
      const res = await listRecalls({ dateTo: toLocalISODate(cutoff) })
      const items = (res.data ?? []) as Array<{ nextRecallDate: Date; patient: { customerName: string } }>
      return {
        headline: `${items.length} patient recalls due in the next 30 days`,
        details: items.slice(0, 10).map((r) => `${r.patient.customerName} — due ${toLocalISODate(new Date(r.nextRecallDate))}`),
        isEmpty: items.length === 0
      }
    }
    case 'carService.vehiclesInService': {
      const res = await getCarJobCardKPIs()
      const r = res.data
      if (!r) return { headline: '', details: [], isEmpty: true }
      return {
        headline: `${r.active} vehicles currently in service, ${r.readyForPickup} ready for pickup`,
        details: [`Delivered this month: ${r.deliveredThisMonth}`],
        isEmpty: r.active === 0 && r.readyForPickup === 0
      }
    }
    case 'coaching.feeDuesAndAttendance': {
      const db = getPrisma()
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0)
      const [feeRes, attendanceRows] = await Promise.all([
        getFeeKPIs(monthKey),
        db.coachingBatchAttendance.findMany({ where: { attendanceDate: { gte: startOfWeek } }, select: { presentStudentIds: true, absentStudentIds: true } })
      ])
      const feeData = feeRes.data
      let present = 0, total = 0
      for (const row of attendanceRows) {
        const p = (JSON.parse(row.presentStudentIds) as unknown[]).length
        const a = (JSON.parse(row.absentStudentIds) as unknown[]).length
        present += p
        total += p + a
      }
      const attendanceRate = total > 0 ? (present / total) * 100 : 0
      return {
        headline: `${feeData?.pendingCount ?? 0} students have pending fees this month, ${attendanceRate.toFixed(0)}% attendance this week`,
        details: [`Fees outstanding: ${formatAmountForSpeech((feeData?.totalDue ?? 0) - (feeData?.totalReceived ?? 0), sym)}`],
        isEmpty: (feeData?.total ?? 0) === 0 && attendanceRows.length === 0
      }
    }
    case 'lab.reportsPendingFinalization': {
      const now = new Date()
      const monthStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1))
      const r = await reportService.generateLabThroughputReport({ dateFrom: monthStart, dateTo: toLocalISODate(now) })
      return {
        headline: `${r.summary.pendingCount} lab reports are pending finalization`,
        details: [`${r.summary.delivered} delivered this period out of ${r.summary.totalOrders} total orders`],
        isEmpty: r.summary.pendingCount === 0
      }
    }
    // Reinterpreted: this app has no dedicated candidate-pipeline-stage
    // model (no Submission/Interview-stage tracking) — Candidate.status
    // (ACTIVE|PLACED|ON_HOLD|BLACKLISTED) is the closest real "stage"
    // concept the data actually supports.
    case 'placement.pipelineByStage': {
      const db = getPrisma()
      const candidates = await db.candidate.groupBy({ by: ['status'], _count: { _all: true } })
      const map = new Map(candidates.map((c) => [c.status, c._count._all]))
      return {
        headline: `Candidate pipeline: ${map.get('ACTIVE') ?? 0} active, ${map.get('PLACED') ?? 0} placed, ${map.get('ON_HOLD') ?? 0} on hold`,
        details: [`Blacklisted: ${map.get('BLACKLISTED') ?? 0}`],
        isEmpty: candidates.length === 0
      }
    }
    // Shared across LAWYER (billed via LegalCase) and every
    // PROJECT_BASED_TYPES vertical (billed via ServiceProject) —
    // TimeEntry.caseId/projectId are mutually exclusive per row, so one
    // query correctly covers both without double-counting.
    case 'service.unbilledTimeValue': {
      const db = getPrisma()
      const entries = await db.timeEntry.findMany({
        where: { isBilled: false },
        select: { amount: true, hours: true }
      })
      const totalValue = entries.reduce((s, e) => s + Number(e.amount), 0)
      const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0)
      return {
        headline: `${formatAmountForSpeech(totalValue, sym)} of unbilled time (${totalHours.toFixed(1)} hours) not yet invoiced`,
        details: [],
        isEmpty: entries.length === 0
      }
    }
    default:
      return { headline: '', details: [], isEmpty: true }
  }
}
