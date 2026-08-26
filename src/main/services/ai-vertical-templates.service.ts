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
import { lookupSerialService } from './repair-ticket.service'
import { getSizeCurveReorderSuggestion } from './variant.service'
import { getTrialConversionSummary } from './trial-session.service'
import { getSeasonalReorderCalendar } from './seasonal-cycle.service'
import { getDowntimeSummary, getWorkOrderBottleneckFlag } from './work-order.service'
import { listDistinctCrops, getProductsForCrop } from './crop-advisory.service'
import { listEquipmentDueForService } from './serial.service'
import { listDonorsDueForRecall, listDonationCamps } from './blood-bank.service'
import { listGoldSavingsSchemes } from './gold-savings.service'
import { listTickets, getQuoteToJobConversionStats } from './service-ticket.service'
import { listServiceContracts } from './service-contract.service'
import { getEngagementConversionStats, getProposalWinRateStats } from './project.service'
import { listRetainers, getRetainerHoursUsage } from './retainer.service'
import { loyaltyProgramService } from './loyalty-program.service'
import { getTemplateSuggestion } from './template-suggestion.service'
import { customDocumentService } from './custom-document.service'
import { getPlacementKPIs } from './placement.service'
import { formatAmountForSpeech } from './ai-format.util'
import { getPrisma } from '../database/db'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { listLegalCases } from './legal-case.service'
import { listHearings } from './hearing.service'
import { listROCFilings } from './roc-filing.service'
import { getPropertyKPIs } from './property.service'
import { listIssues } from './issue.service'
import { getShootKPIs } from './shoot-booking.service'
import { getEventKPIs } from './event-booking.service'
import { getUpcomingVaccinations } from './vaccination.service'
import { listRecalls } from './recall-record.service'
import { listChronicConditions } from './chronic-condition-record.service'
import { getCarJobCardKPIs } from './car-job-card.service'
import { getFeeKPIs } from './coaching-fee.service'
import { getUpcomingTestsAndLowBalanceKPIs } from './driving.service'
import { getExpiringMemberships } from './membership.service'

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
// Phase 66 — exported so dashboard-spotlight.service.ts can reuse the exact
// same type groupings rather than maintaining a second, driftable copy.
export const APPOINTMENT_BASED_TYPES = new Set([
  'VET_CLINIC', 'GP_CLINIC', 'SPECIALIST_CLINIC', 'DENTAL_CLINIC', 'PHYSIO_CLINIC',
  'BEAUTY_SALON', 'GYM_STUDIO', 'DRIVING_SCHOOL', 'LAWYER', 'PHOTO_STUDIO',
  'EVENT_MANAGEMENT', 'TAILOR_BOUTIQUE', 'PEST_CONTROL'
])
// Of those, only Beauty Salon and Gym Studio use the staff_commission module.
const COMMISSION_BASED_TYPES = new Set(['BEAUTY_SALON', 'GYM_STUDIO'])
// Business types with a real project/engagement workflow (service_projects).
export const PROJECT_BASED_TYPES = new Set([
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
    // Phase 67 §9.1 — items 1/2/3/4/5.
    case 'JEWELLERY': return ['jewellery.stockAndSales', 'jewellery.goldSavingsSummary', 'jewellery.makingChargeMargin', 'jewellery.hallmarkCompliance', 'jewellery.metalRateVsSalesVolume', 'jewellery.purityAdjustedExchange']
    // Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per unit.
    case 'RENTAL': return ['rental.status', 'rental.revenue', 'rental.assetUtilization']
    // AI expansion, 2026-07 — lab.reportsPendingFinalization reuses the same
    // generateLabThroughputReport as lab.throughput, just framed around the
    // "reports pending" question specifically rather than the full summary.
    // Phase 67 §9.1 items 23.1/23.4/23.5 — Diagnostic Lab's TAT compliance,
    // top test panel by volume, and referral leaderboard (shared mechanism
    // with SPECIALIST_CLINIC's own intent below — see report.service.ts's
    // comment on why the two verticals need separate queries).
    case 'DIAGNOSTIC_LAB': return ['lab.throughput', 'lab.reportsPendingFinalization', 'lab.tatCompliance', 'lab.topPanel', 'lab.referralLeaderboard']
    // Phase 67 §9.1 — Blood Bank items 1, 3, 4: donor cooldown auto-reminder,
    // camp turnout, and donation-to-issue cycle time. Item 2 (bloodBank.stock)
    // already existed; item 5 (fast-match search) needs a quantity parameter
    // fast-path routing can't reliably extract, so it stays a pure UI tool
    // with no AI intent, same precedent several other pure-action items this
    // phase already established.
    case 'BLOOD_BANK': return ['bloodBank.stock', 'bloodBank.donorsDueForRecall', 'bloodBank.campTurnout', 'bloodBank.donationToIssueCycleTime']
    case 'RESTAURANT': return ['restaurant.foodCost', 'restaurant.orderVolume', 'restaurant.dishContributionMargin', 'restaurant.tableTurnoverByHour', 'restaurant.recipeWasteVariance']
    case 'RETAIL': return ['retail.deadStockClearance', 'retail.categorySellThrough', 'retail.loyaltyProgress', 'retail.basketComposition']
    // Phase 67 §9.1 — Hardware's item 4 (Fast-mover vs. slow-mover matrix)
    // gets a matching AI intent per Section 1.2's "any new report gets a
    // matching AI query pattern" rule.
    case 'HARDWARE': return ['hardware.fastSlowMoverMatrix']
    // Phase 67 §9.1 — General's item 1 ("Which template fits you?" wizard)
    // gets a matching AI intent per Section 1.2's rule — the same signal
    // computation the Dashboard banner already surfaces, answerable by
    // asking the AI directly instead of finding the banner.
    // Phase 67 §9.1 — General's item 2 (Custom Document Builder) gets its
    // own matching intent too, same "any new feature gets an AI answer"
    // rule this item's precedents (e.g. Retail's loyaltyProgress) followed.
    case 'GENERAL': return ['general.templateSuggestion', 'general.customDocumentSummary', 'general.categoryMix', 'general.cashPositionTrend', 'general.quotePipelineSummary']
    case 'MANUFACTURING': return ['manufacturing.production', 'manufacturing.landedCostPerUnit', 'manufacturing.rejectionRateTrend', 'manufacturing.downtimeSummary', 'manufacturing.bottleneckFlag']
    case 'ELECTRONICS': return ['electronics.serialWarranty', 'electronics.rmaOverdueSummary', 'electronics.vendorRecovery', 'electronics.repairTurnaround', 'electronics.serialServiceLookup']
    // Phase 67 §9.1 — Clothing item 4 (size/color exchange workflow) gets a
    // matching AI intent per Section 1.2's rule. Distinct from the generic
    // sales.returnsAndRefunds intent (ai-query.service.ts), which already
    // counts an exchange's own RETURN leg alongside plain refund returns
    // without telling them apart — this one answers the genuinely different
    // question of how many were actual size/colour exchanges specifically.
    // Phase 67 §9.1 — Clothing item 5 (Margin by Brand/Vendor Report), its
    // 5th and final signature item, closing the vertical's own list.
    case 'CLOTHING': return ['retail.variantStock', 'clothing.seasonSellThrough', 'clothing.sizeCurveReorderSuggestion', 'clothing.sizeStyleHeatmap', 'clothing.exchangeSummary', 'clothing.vendorMargin']
    // Phase 67 §9.1 — split off from the CLOTHING case above once grounding
    // confirmed (via the source audit artifact) that Footwear does NOT
    // share Clothing's own signature-item list despite sharing its module
    // set byte-for-byte — the first 4 intents here ARE genuinely shared
    // capabilities (their own report tiles are gated ['CLOTHING','FOOTWEAR']
    // in the UI too), but the 5th intent is Footwear's own distinct item 2,
    // not Clothing's item 5.
    case 'FOOTWEAR': return ['retail.variantStock', 'clothing.seasonSellThrough', 'clothing.sizeCurveReorderSuggestion', 'clothing.sizeStyleHeatmap', 'clothing.exchangeSummary', 'footwear.brandMarginReturnRate', 'footwear.trialConversionRate', 'footwear.sizeAvailabilityHeatmap', 'footwear.seasonalReorderStatus']
    case 'COACHING_INSTITUTE': return ['coaching.testScores', 'coaching.feeDuesAndAttendance']
    case 'CA_FIRM': case 'COMPANY_SECRETARY': return ['compliance.tasks', 'compliance.upcomingFilings']
    case 'REPAIR': return ['repair.jobCards']
    // CAR_SERVICE_CENTER split out from REPAIR (2026-07 AI expansion) — it
    // has its own dedicated car-job-card.service.ts KPI function beyond the
    // generic repair job-card report REPAIR shares.
    case 'CAR_SERVICE_CENTER': return ['repair.jobCards', 'carService.vehiclesInService']
    // Phase 67 §9.1 — split PHARMACY off from AGRI_INPUTS (previously shared
    // one array) so PHARMACY can carry its own extra intent; AGRI_INPUTS
    // keeps only batch expiry, unchanged.
    case 'PHARMACY': return ['inventory.batchExpiry', 'pharmacy.prescriptionVolumeByDoctor']
    // Phase 67 §9.1 — Agri Inputs items 2-5: seasonal credit exposure,
    // crop-linked product advisory, farmer repayment ranking, and equipment
    // AMC/service reminders (item 1 — crop-season due dates — has no AI
    // intent of its own, it's a billing-time computation, not a query).
    case 'AGRI_INPUTS': return ['inventory.batchExpiry', 'agriInputs.seasonalCreditExposure', 'agriInputs.farmerRepayment', 'agriInputs.cropAdvisory', 'agriInputs.equipmentServiceDue']
    // Phase 67 §9.1 — DISTRIBUTOR previously had ZERO vertical AI templates
    // (only appeared in LOGISTICS_BASED_TYPES, an unrelated module-defaults
    // set) despite being a Section-1.2-named vertical — closing that gap
    // alongside the new scheme-cost report itself, not deferring it.
    case 'DISTRIBUTOR': return ['distributor.schemeCostVsVolume']
    // Added 2026-07-13 alongside the RETAIL/GENERAL/PLACEMENT_AGENCY gap
    // review — getPlacementKPIs() (placement.service.ts) already existed
    // and fit the same reuse pattern as every other template here; there
    // was no reason to leave this one out.
    case 'PLACEMENT_AGENCY': return ['placement.summary', 'placement.pipelineByStage']
    // Phase 67 §9.1 — Service items 1-5: SLA timer, resolution time by
    // category, recurring service contracts, repeat-business rate, and
    // quote-to-job conversion tracking.
    case 'SERVICE': return ['service.slaBreaches', 'service.resolutionTime', 'service.contractSummary', 'service.repeatBusinessRate', 'service.quoteToJobConversion']
    case 'CONSULTANT': return ['consultant.engagementConversion', 'consultant.utilization', 'consultant.retainerBurnDown', 'consultant.clientProfitability', 'consultant.proposalWinRate']
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
    // PHYSIO_CLINIC/BEAUTY_SALON get no extra — not part of the audited
    // 18-business-type gap list, and the shared appointment/retention pair
    // already covers their real questions.
    if (businessType === 'LAWYER') templates.push('legal.openCasesAndHearings', 'service.unbilledTimeValue')
    if (businessType === 'PHOTO_STUDIO') templates.push('photography.upcomingShoots')
    if (businessType === 'EVENT_MANAGEMENT') templates.push('events.upcoming')
    if (businessType === 'DRIVING_SCHOOL') templates.push('driving.upcomingTestsAndLowBalance')
    if (businessType === 'TAILOR_BOUTIQUE') templates.push('tailoring.ordersDueThisWeek')
    if (businessType === 'PEST_CONTROL') templates.push('pestControl.contractsDueForRenewal')
    // Phase 67 §9.1 items 18.2/18.4 — Vet Clinic's own Vaccination
    // Compliance and Case-Type Volume Trend reports each get a matching AI
    // intent, per Section 1.2's own rule.
    if (businessType === 'VET_CLINIC') templates.push('vet.vaccinationsDue', 'vet.vaccinationCompliance', 'vet.caseTypeVolume')
    if (businessType === 'DENTAL_CLINIC') templates.push('dental.recallsDue', 'dental.treatmentAcceptanceRate', 'dental.recallCompliance')
    // Phase 66 — the Dashboard spotlight card for GYM_STUDIO now surfaces
    // expiring-membership counts (getExpiringMemberships, same function the
    // dedicated Memberships screen's own "Expiring Soon" tab calls) — per
    // Section 1.2's "any new report gets a matching AI query pattern" rule,
    // this needs a matching AI intent too, not just a Dashboard card.
    if (businessType === 'GYM_STUDIO') templates.push('gym.membershipsExpiring')
    // Phase 67 §9.1 item 19 — GP Clinic's own chronic-condition recall now
    // has a real Dashboard spotlight card (dashboard-spotlight.service.ts's
    // `chronicRecall` kind); per Section 1.2's "any new report gets a
    // matching AI query pattern" rule, it needs a matching intent too.
    if (businessType === 'GP_CLINIC') templates.push('gp.chronicRecallsDue', 'gp.walkInVsAppointmentRatio', 'gp.topDiagnosisCategory', 'gp.referralOutcomes')
    // Phase 67 §9.1 item 22.4 — Physio Clinic's own Pack Utilization report,
    // explicitly named in the roadmap as a shared component with Gym/Studio
    // (both use the exact same ClientSessionPack model) — one intent, one
    // underlying report function, two callers.
    if (businessType === 'PHYSIO_CLINIC' || businessType === 'GYM_STUDIO') templates.push('sessionPacks.utilization')
    // Phase 67 §9.1 item 20.1 — Specialist Clinic's own Referral-Source
    // Leaderboard, the audit's "exists, unused" field finally getting a real
    // report + intent. Shares its report shape/UI with Diagnostic Lab's
    // 'lab.referralLeaderboard' above, not its underlying query.
    if (businessType === 'SPECIALIST_CLINIC') templates.push('specialist.referralLeaderboard', 'specialist.secondOpinionConversion', 'specialist.caseComplexityMix')
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
    // Phase 67 §9.1 — Jewellery item 1: Gold savings (chit) scheme ledger.
    case 'jewellery.goldSavingsSummary': {
      const res = await listGoldSavingsSchemes({ status: 'ACTIVE' })
      const schemes = res.success ? (res.data ?? []) : []
      const totalDeposited = schemes.reduce((s, sc) => s + sc.totalDeposited, 0)
      return {
        headline: `${schemes.length} active gold savings scheme(s), ${formatAmountForSpeech(totalDeposited, sym)} deposited so far`,
        details: [],
        isEmpty: schemes.length === 0
      }
    }
    // Phase 67 §9.1 — Jewellery item 2: Making-Charge vs. Metal-Value Margin, per sale.
    case 'jewellery.makingChargeMargin': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateMakingChargeMarginReport({ dateFrom, dateTo })
      return {
        headline: `Making charge is ${r.summary.avgMakingChargePercent}% of total sale value this period (${formatAmountForSpeech(r.summary.totalMakingCharge, sym)} of ${formatAmountForSpeech(r.summary.totalMetalValue + r.summary.totalMakingCharge, sym)})`,
        details: [],
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Jewellery item 3: Hallmarking/HUID compliance register.
    case 'jewellery.hallmarkCompliance': {
      const r = await reportService.generateHallmarkComplianceReport()
      return {
        headline: `${r.summary.compliantCount} of ${r.summary.totalItems} jewellery items are hallmark-compliant (${r.summary.compliancePercent}%)`,
        details: r.summary.nonCompliantCount > 0 ? [`${r.summary.nonCompliantCount} item(s) missing a hallmark/HUID number`] : [],
        isEmpty: r.summary.totalItems === 0
      }
    }
    // Phase 67 §9.1 — Jewellery item 4: Metal Rate vs. Sales Volume.
    case 'jewellery.metalRateVsSalesVolume': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateMetalRateVsSalesVolumeReport({ dateFrom, dateTo })
      const latest = r.rows[r.rows.length - 1]
      return {
        headline: r.metalType
          ? `${r.metalType} ${r.purity}: latest rate ${latest?.avgRatePerGram != null ? formatAmountForSpeech(latest.avgRatePerGram, sym) + '/g' : 'not set'}, ${latest?.salesWeightGrams.toFixed(1) ?? 0}g sold last tracked month`
          : 'No jewellery sales in this period to correlate against metal rates.',
        details: [],
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Jewellery item 5: Purity-adjusted old-gold exchange analytics.
    case 'jewellery.purityAdjustedExchange': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generatePurityAdjustedExchangeReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.totalExchanges} exchange(s) this period, ${r.summary.totalPureEquivalentGrams}g pure-metal-equivalent, ${formatAmountForSpeech(r.summary.totalValueGiven, sym)} credited`,
        details: [],
        isEmpty: r.summary.totalExchanges === 0
      }
    }
    // Phase 67 §9.1 — Service item 1: Ticket SLA timer breach alert.
    case 'service.slaBreaches': {
      const r = await listTickets({})
      const breached = (r.data?.tickets ?? []).filter((tk) => tk.isSlaBreached)
      return {
        headline: `${breached.length} ticket(s) currently past their SLA due date`,
        details: [],
        isEmpty: breached.length === 0
      }
    }
    // Phase 67 §9.1 — Service item 2: Resolution Time by Category.
    case 'service.resolutionTime': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateServiceResolutionTimeReport({ dateFrom, dateTo })
      const slowest = r.rows[0]
      return {
        headline: slowest
          ? `${slowest.category} takes the longest to resolve at ${slowest.avgHours}h average, ${r.summary.totalResolved} ticket(s) resolved this period`
          : 'No tickets resolved this period yet.',
        details: [],
        isEmpty: r.summary.totalResolved === 0
      }
    }
    // Phase 67 §9.1 — Service item 3: Recurring service contract ledger.
    case 'service.contractSummary': {
      const r = await listServiceContracts({ status: 'ACTIVE' })
      const contracts = r.data ?? []
      const totalValue = contracts.reduce((s: number, c: { contractValue: number }) => s + c.contractValue, 0)
      return {
        headline: `${contracts.length} active service contract(s), ${formatAmountForSpeech(totalValue, sym)} in combined value`,
        details: [],
        isEmpty: contracts.length === 0
      }
    }
    // Phase 67 §9.1 — Service item 4: Repeat-Business Rate.
    case 'service.repeatBusinessRate': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateRepeatBusinessRateReport({ dateFrom, dateTo })
      const latest = r.rows[r.rows.length - 1]
      return {
        headline: latest
          ? `${latest.repeatRatePercent}% repeat business this month — ${latest.repeatCustomers} returning, ${latest.newCustomers} new`
          : 'No customer tickets this period to measure repeat business.',
        details: [],
        isEmpty: !latest
      }
    }
    // Phase 67 §9.1 — Service item 5: Quote-to-Job Conversion Tracking.
    case 'service.quoteToJobConversion': {
      const r = await getQuoteToJobConversionStats()
      const stats = r.data ?? { acceptedQuotations: 0, convertedToTicket: 0, conversionRatePercent: 0 }
      return {
        headline: `${stats.conversionRatePercent}% of accepted quotations became jobs — ${stats.convertedToTicket} of ${stats.acceptedQuotations}`,
        details: [],
        isEmpty: stats.acceptedQuotations === 0
      }
    }
    // Phase 67 §9.1 — Consultant item 1: Engagement-Letter -> Project Conversion.
    case 'consultant.engagementConversion': {
      const r = await getEngagementConversionStats()
      const stats = r.data ?? { acceptedQuotations: 0, convertedToProject: 0, conversionRatePercent: 0 }
      return {
        headline: `${stats.conversionRatePercent}% of accepted engagement letters became projects — ${stats.convertedToProject} of ${stats.acceptedQuotations}`,
        details: [],
        isEmpty: stats.acceptedQuotations === 0
      }
    }
    // Phase 67 §9.1 — Consultant item 2: Utilization Rate.
    case 'consultant.utilization': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateConsultantUtilizationReport({ dateFrom, dateTo })
      const lowest = r.rows[0]
      return {
        headline: lowest
          ? `${lowest.userName} has the lowest utilization at ${lowest.utilizationPercent}%, overall utilization ${r.summary.overallUtilizationPercent}% this period`
          : 'No billable work logged this period yet.',
        details: [],
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Consultant item 3: Retainer Burn-Down Tracker. Reuses
    // the pre-existing per-retainer getRetainerHoursUsage verbatim, just
    // aggregated across every ACTIVE HOURLY_BUCKET retainer for one summary
    // headline — no new retainer-service function needed.
    case 'consultant.retainerBurnDown': {
      const listRes = await listRetainers({ status: 'ACTIVE' })
      const retainers = ((listRes.data ?? []) as Array<{ id: string; title: string; hoursPerMonth: number | null }>).filter((rt) => rt.hoursPerMonth != null)
      const usages = await Promise.all(retainers.map((rt) => getRetainerHoursUsage(rt.id)))
      let totalUsed = 0; let totalAllocated = 0; let exhaustedCount = 0
      usages.forEach((u, i) => {
        const d = u.data as { hoursUsed: number; hoursPerMonth: number | null; hoursRemaining: number | null } | undefined
        if (!d) return
        totalUsed += d.hoursUsed
        totalAllocated += retainers[i].hoursPerMonth ?? 0
        if (d.hoursRemaining === 0) exhaustedCount++
      })
      return {
        headline: retainers.length > 0
          ? `${totalUsed.toFixed(1)}h of ${totalAllocated.toFixed(1)}h retainer hours used this month across ${retainers.length} retainer(s), ${exhaustedCount} exhausted`
          : 'No active hourly retainers to track.',
        details: [],
        isEmpty: retainers.length === 0
      }
    }
    // Phase 67 §9.1 — Consultant item 4: Client Profitability.
    case 'consultant.clientProfitability': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateClientProfitabilityReport({ dateFrom, dateTo })
      const worst = r.rows[0]
      return {
        headline: worst
          ? `${worst.customerName} has the lowest revenue per hour at ${formatAmountForSpeech(worst.revenuePerHour, sym)}/h, ${formatAmountForSpeech(r.summary.totalRevenue, sym)} total revenue this period`
          : 'No client project revenue this period yet.',
        details: [],
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Consultant item 5: Proposal Win-Rate Tracking.
    case 'consultant.proposalWinRate': {
      const r = await getProposalWinRateStats()
      const stats = r.data ?? { totalProposals: 0, won: 0, lost: 0, pending: 0, winRatePercent: 0 }
      return {
        headline: `${stats.winRatePercent}% proposal win rate — ${stats.won} won, ${stats.lost} lost, ${stats.pending} pending`,
        details: [],
        isEmpty: stats.totalProposals === 0
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
    // Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per unit. Leads
    // with the worst-earning asset — the actionable part of a ranked list,
    // same framing every other "worst first" report this phase uses.
    case 'rental.assetUtilization': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateAssetUtilizationReport({ dateFrom, dateTo })
      const worst = r.rows[0] ?? null
      return {
        headline: worst
          ? `${worst.productName} (${worst.unitLabel}) has the lowest utilization this period at ${worst.utilizationPercent}%${r.summary.idleUnitCount > 0 ? `, ${r.summary.idleUnitCount} unit(s) fully idle` : ''}`
          : 'No tracked rental units yet',
        details: r.rows.slice(0, 3).map(row => `${row.productName} (${row.unitLabel}): ${row.utilizationPercent}%`),
        isEmpty: r.rows.length === 0
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
    // Phase 67 §9.1 — Blood Bank item 1: donor cooldown auto-reminder.
    case 'bloodBank.donorsDueForRecall': {
      const r = await listDonorsDueForRecall()
      if (!r.success || !r.data) return { headline: 'Could not check donor eligibility', details: [], isEmpty: true }
      const donors = r.data as Array<{ fullName: string; bloodGroup: string | null }>
      return {
        headline: donors.length > 0 ? `${donors.length} donor${donors.length === 1 ? ' is' : 's are'} eligible to donate again` : 'No donors are currently due for recall',
        details: donors.slice(0, 5).map(d => `${d.fullName}${d.bloodGroup ? ` (${d.bloodGroup})` : ''}`),
        isEmpty: donors.length === 0
      }
    }
    // Phase 67 §9.1 — Blood Bank item 3: camp/drive scheduling turnout.
    case 'bloodBank.campTurnout': {
      const r = await listDonationCamps()
      if (!r.success || !r.data) return { headline: 'No donation camps scheduled yet', details: [], isEmpty: true }
      const camps = r.data as Array<{ campName: string; _count: { donations: number } }>
      const top = [...camps].sort((a, b) => b._count.donations - a._count.donations)[0] ?? null
      return {
        headline: top ? `${top.campName} had the highest turnout — ${top._count.donations} donation(s)` : 'No donation camps scheduled yet',
        details: camps.slice(0, 5).map(c => `${c.campName}: ${c._count.donations} donation(s)`),
        isEmpty: camps.length === 0
      }
    }
    // Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time.
    case 'bloodBank.donationToIssueCycleTime': {
      const r = await reportService.generateDonationToIssueCycleTimeReport()
      if (r.summary.totalIssuedUnits === 0) return { headline: 'No issued units yet', details: [], isEmpty: true }
      const slowest = r.byComponent[0] ?? null
      return {
        headline: `${r.summary.overallAvgDays} days average donation-to-issue cycle time${slowest ? `, slowest for ${slowest.componentType.replace('_', ' ')} (${slowest.avgDays}d avg)` : ''}`,
        details: r.byComponent.slice(0, 3).map(c => `${c.componentType.replace('_', ' ')}: ${c.avgDays}d avg (${c.unitCount} units)`),
        isEmpty: false
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
    case 'restaurant.dishContributionMargin': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateDishContributionMarginReport({ dateFrom, dateTo })
      const top = r.rows[0]
      return {
        headline: top ? `Best margin: ${top.productName} at ${formatAmountForSpeech(top.contributionMargin, sym)}` : 'No dishes sold this period',
        details: r.rows.slice(0, 3).map(row => `${row.productName}: ${formatAmountForSpeech(row.contributionMargin, sym)} (${row.marginPercent}%)`),
        isEmpty: r.rows.length === 0
      }
    }
    case 'restaurant.tableTurnoverByHour': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateTableTurnoverByHourReport({ dateFrom, dateTo })
      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const s = r.summary
      const peakLabel = s.peakDayOfWeek !== null && s.peakHour !== null ? `${DAY_NAMES[s.peakDayOfWeek]} at ${s.peakHour}:00` : null
      return {
        headline: peakLabel ? `Busiest: ${peakLabel} (${s.peakCount} table turns)` : 'No dine-in table orders this period',
        details: [`Total table turns this period: ${s.totalTurns}`],
        isEmpty: s.totalTurns === 0
      }
    }
    case 'restaurant.recipeWasteVariance': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateRecipeWasteVarianceReport({ dateFrom, dateTo })
      const biggest = r.rows.filter(row => row.varianceQuantity > 0)[0] ?? null
      return {
        headline: biggest ? `Biggest overage: ${biggest.ingredientName} (+${biggest.varianceQuantity} ${biggest.unit} vs. recipe)` : 'No recipe-linked ingredient activity this period',
        details: r.rows.slice(0, 3).map(row => `${row.ingredientName}: ${row.varianceQuantity > 0 ? '+' : ''}${row.varianceQuantity} ${row.unit} vs. recipe`),
        isEmpty: r.rows.length === 0
      }
    }
    case 'retail.deadStockClearance': {
      const r = await reportService.generateDeadStockClearanceReport()
      const top = r.rows[0] ?? null
      return {
        headline: `${formatAmountForSpeech(r.summary.totalCapitalLocked, sym)} locked in ${r.summary.itemCount} dead-stock items (no sale in ${r.lookbackDays} days)`,
        details: top ? [`Biggest: ${top.productName} — ${formatAmountForSpeech(top.capitalLocked, sym)}`] : [],
        isEmpty: r.summary.itemCount === 0
      }
    }
    case 'retail.categorySellThrough': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateCategorySellThroughReport({ dateFrom, dateTo })
      const thisMonth = r.rows.filter(row => row.unitsSold > 0 || row.currentStock > 0)
      const sorted = [...thisMonth].sort((a, b) => b.sellThroughRate - a.sellThroughRate)
      const top = sorted[0] ?? null
      return {
        headline: top ? `${top.categoryName} leads this month at ${top.sellThroughRate}% sell-through` : 'No category sales this month yet',
        details: sorted.slice(0, 3).map(row => `${row.categoryName}: ${row.sellThroughRate}% (${row.unitsSold} sold, ${row.currentStock} in stock)`),
        isEmpty: thisMonth.length === 0
      }
    }
    // Phase 67 §9.1 — Clothing: Season/Collection Sell-Through Report.
    case 'clothing.seasonSellThrough': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateSeasonSellThroughReport({ dateFrom, dateTo })
      const thisMonth = r.rows.filter(row => row.unitsSold > 0 || row.currentStock > 0)
      const sorted = [...thisMonth].sort((a, b) => b.sellThroughRate - a.sellThroughRate)
      const top = sorted[0] ?? null
      return {
        headline: top ? `${top.season} leads this month at ${top.sellThroughRate}% sell-through` : 'No season/collection sales this month yet',
        details: sorted.slice(0, 3).map(row => `${row.season}: ${row.sellThroughRate}% (${row.unitsSold} sold, ${row.currentStock} in stock)`),
        isEmpty: thisMonth.length === 0
      }
    }
    // Phase 67 §9.1 — Clothing: size-curve reorder suggestion. Requires a
    // specific product named in the question (unlike this vertical's own
    // sell-through intent above, which is an aggregate) — reuses the exact
    // same product-name-or-SKU lookup shape ai-query.service.ts's own
    // inventory.productCostBasis intent already established.
    case 'clothing.sizeCurveReorderSuggestion': {
      const term = params.searchTerm as string | undefined
      if (!term) return { headline: '', details: [], isEmpty: true }
      const db = getPrisma()
      const product = await db.product.findFirst({
        where: { isActive: true, OR: [{ productName: { contains: term } }, { sku: { contains: term } }] },
        select: { id: true, productName: true }
      })
      if (!product) return { headline: '', details: [], isEmpty: true }
      const res = await getSizeCurveReorderSuggestion(product.id)
      if (!res.success || !res.data) return { headline: '', details: [], isEmpty: true }
      const top = res.data.rows.filter(row => row.suggestedQuantity > 0).slice(0, 5)
      return {
        headline: `Suggested reorder split for ${product.productName}: ${res.data.totalReorderQty} units across ${res.data.rows.length} variants`,
        details: top.map(row => `${[row.size, row.width, row.color].filter(Boolean).join('/') || 'Variant'}: ${row.suggestedQuantity} units (${row.unitsSoldRecently} sold recently)`),
        isEmpty: res.data.rows.every(row => row.suggestedQuantity === 0)
      }
    }
    // Phase 67 §9.1 — Clothing: Size × Style Heatmap. An aggregate whole-
    // catalog question (unlike item 2's own per-product one above) —
    // this month's top-selling style/size combination.
    case 'clothing.sizeStyleHeatmap': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateSizeStyleHeatmapReport({ dateFrom, dateTo })
      if (r.cells.length === 0) return { headline: '', details: [], isEmpty: true }
      const top = [...r.cells].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5)
      return {
        headline: r.summary.topCellStyle
          ? `${r.summary.topCellStyle} / ${r.summary.topCellSize} is your top-moving combination this month, ${r.summary.topCellUnitsSold} units`
          : 'No variant sales this month yet',
        details: top.map(c => `${c.style} / ${c.size}: ${c.unitsSold} units`),
        isEmpty: r.summary.totalUnitsSold === 0
      }
    }
    // Phase 67 §9.1 — Clothing item 4 (size/color exchange workflow). Counts
    // the NEW/replacement-item invoices an exchange produces (each carries
    // a real exchangeReturnId back to its paired RETURN leg) — an
    // unambiguous, precise signal distinct from sales.returnsAndRefunds'
    // own count, which bundles an exchange's RETURN leg together with every
    // plain refund return and can't tell them apart.
    case 'clothing.exchangeSummary': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const db = getPrisma()
      const exchanges = await db.invoice.findMany({
        where: { exchangeReturnId: { not: null }, invoiceDate: { gte: parseLocalDateStart(dateFrom), lte: parseLocalDateEnd(dateTo) } },
        select: { totalAmount: true }
      })
      const totalValue = exchanges.reduce((s, e) => s + e.totalAmount, 0)
      return {
        headline: `${exchanges.length} size/colour exchange${exchanges.length === 1 ? '' : 's'} processed this month, replacement items totaling ${formatAmountForSpeech(totalValue, sym)}`,
        details: [],
        isEmpty: exchanges.length === 0
      }
    }
    // Phase 67 §9.1 — Clothing item 5: Margin by Brand/Vendor Report, the
    // vertical's 5th and final signature item. Reuses formatAmountForSpeech
    // for the top vendor's own margin figure, matching every other
    // currency-bearing headline in this file.
    case 'clothing.vendorMargin': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateVendorMarginReport({ dateFrom, dateTo })
      const top = r.rows[0] ?? null
      return {
        headline: top ? `${top.supplierName} leads with ${formatAmountForSpeech(top.margin, sym)} margin this month (${top.marginPercent}%)` : 'No sales this month for products with an assigned vendor/brand',
        details: r.rows.slice(0, 3).map(row => `${row.supplierName}: ${formatAmountForSpeech(row.margin, sym)} margin (${row.marginPercent}%)`),
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Footwear item 2: Brand-Wise Margin & Return-Rate
    // Report. A distinct question from clothing.vendorMargin above (which
    // this vertical does NOT get) — leads with the highest-margin brand,
    // but always states its return rate alongside, since the audit's own
    // framing is specifically about a brand's margin being quietly eaten
    // by an above-average return rate, not just "who makes the most."
    case 'footwear.brandMarginReturnRate': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateBrandMarginReturnRateReport({ dateFrom, dateTo })
      const top = r.rows[0] ?? null
      return {
        headline: top ? `${top.supplierName} leads with ${formatAmountForSpeech(top.margin, sym)} margin this month, ${top.returnRatePercent}% return rate` : 'No sales this month for products with an assigned vendor/brand',
        details: r.rows.slice(0, 3).map(row => `${row.supplierName}: ${formatAmountForSpeech(row.margin, sym)} margin, ${row.returnRatePercent}% returned (${row.unitsReturned}/${row.unitsSold} units)`),
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Footwear item 3: trial-pair counter workflow. Reads
    // ALL-TIME data (not thisMonthRange like its sibling reports) since a
    // conversion rate needs a meaningful sample size, and trial sessions are
    // a comparatively low-volume, cashier-opt-in log next to a full month of
    // ordinary invoices.
    case 'footwear.trialConversionRate': {
      const r = await getTrialConversionSummary()
      if (!r.success || !r.data) {
        return { headline: 'No trial sessions recorded yet', details: [], isEmpty: true }
      }
      const d = r.data
      return {
        headline: d.totalSessions > 0
          ? `${d.conversionRatePercent}% of trial sessions converted to a sale, out of ${d.totalSessions} recorded`
          : 'No trial sessions recorded yet',
        details: [
          `Converted: ${d.convertedSessions} / ${d.totalSessions}`,
          `Average pairs tried per session: ${d.avgPairsTriedPerSession}`,
          `Average pairs tried before a purchase: ${d.avgPairsTriedPerConversion}`
        ],
        isEmpty: d.totalSessions === 0
      }
    }
    // Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap. A live
    // current-state question ("what's out right now"), not a sales-history
    // one — deliberately a distinct intent from the shared
    // clothing.sizeStyleHeatmap above (which answers "what sold"), even
    // though both are "heatmap" questions on the surface.
    case 'footwear.sizeAvailabilityHeatmap': {
      const r = await reportService.generateSizeAvailabilityHeatmapReport()
      if (r.cells.length === 0) return { headline: '', details: [], isEmpty: true }
      const outCells = r.cells.filter(c => c.status === 'OUT').slice(0, 5)
      return {
        headline: r.summary.styleWithMostGaps
          ? `${r.summary.styleWithMostGaps} has the most sizes out of stock, ${r.summary.styleGapCount} sizes`
          : 'No sizes are currently out of stock',
        details: outCells.length > 0
          ? outCells.map(c => `${c.style} / ${c.size}: out of stock`)
          : [`${r.summary.outOfStockCells} sizes out of stock, ${r.summary.lowStockCells} running low`],
        isEmpty: r.summary.outOfStockCells === 0 && r.summary.lowStockCells === 0
      }
    }
    // Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar. Leads with
    // whichever shop-defined season needs reordering NOW (there can be
    // more than one), since that's the actionable case — an in-season or
    // upcoming one is informational, not urgent.
    case 'footwear.seasonalReorderStatus': {
      const r = await getSeasonalReorderCalendar()
      if (!r.success || !r.data) return { headline: 'No seasonal buying cycles defined yet', details: [], isEmpty: true }
      const needsReorder = r.data.filter(e => e.status === 'REORDER_NOW')
      if (needsReorder.length === 0) {
        return {
          headline: 'No seasons need reordering right now',
          details: r.data.slice(0, 3).map(e => `${e.name}: ${e.status === 'IN_SEASON' ? 'in season now' : `starts in ${e.daysUntilStart} days`}`),
          isEmpty: r.data.length === 0
        }
      }
      return {
        headline: `${needsReorder.map(e => e.name).join(', ')} — reorder now, ${needsReorder.reduce((s, e) => s + e.lowOrOutOfStockCount, 0)} products low or out of stock`,
        details: needsReorder.map(e => `${e.name}: starts ${e.nextStartDate}, ${e.lowOrOutOfStockCount}/${e.products.length} tagged products low/out of stock`),
        isEmpty: false
      }
    }
    case 'retail.loyaltyProgress': {
      const r = await loyaltyProgramService.getSummary()
      if (!r.success) {
        return { headline: 'No loyalty program is configured yet', details: [], isEmpty: true }
      }
      const d = r.data
      if (!d.configured) {
        return { headline: 'No loyalty program is configured yet', details: [], isEmpty: true }
      }
      return {
        headline: `${d.readyForRewardCount} customer${d.readyForRewardCount === 1 ? '' : 's'} ready to redeem, ${d.totalCards} total loyalty cards`,
        details: [`Rewards redeemed this month: ${d.rewardsRedeemedThisMonth}`, `Program ${d.isActive ? 'active' : 'turned off'}`],
        isEmpty: d.totalCards === 0
      }
    }
    case 'retail.basketComposition': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateBasketCompositionReport({ dateFrom, dateTo })
      const top = r.rows[0] ?? null
      return {
        headline: top ? `${top.productAName} + ${top.productBName} bought together in ${top.basketCount} baskets this month` : 'No repeated product pairings found this month',
        details: r.rows.slice(0, 3).map(row => `${row.productAName} + ${row.productBName}: ${row.basketCount} baskets`),
        isEmpty: r.rows.length === 0
      }
    }
    case 'general.templateSuggestion': {
      const r = await getTemplateSuggestion()
      if (!r.success || !r.data) {
        return { headline: 'No specific business template stands out from your activity yet', details: [], isEmpty: true }
      }
      const d = r.data
      return {
        headline: `Your activity looks like a ${d.businessType} business (${d.matchedCount} matching records) — worth checking Settings → Industry`,
        details: [`Signal: ${d.signalKey}`],
        isEmpty: false
      }
    }
    case 'general.cashPositionTrend': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateCashPositionTrendReport({ dateFrom, dateTo })
      return {
        headline: r.points.length > 0
          ? `Your cash position ${r.netChange >= 0 ? 'grew' : 'fell'} by ${formatAmountForSpeech(Math.abs(r.netChange), sym)} this month, from ${formatAmountForSpeech(r.openingBalance, sym)} to ${formatAmountForSpeech(r.closingBalance, sym)}`
          : 'No cash movement recorded this month',
        details: [`Opening: ${formatAmountForSpeech(r.openingBalance, sym)}`, `Closing: ${formatAmountForSpeech(r.closingBalance, sym)}`],
        isEmpty: r.points.length === 0
      }
    }
    case 'general.categoryMix': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateCategoryMixReport({ dateFrom, dateTo })
      const top = r.rows[0] ?? null
      return {
        headline: top ? `${top.categoryName} leads with ${top.revenuePercent}% of revenue this month (${r.summary.categoryCount} categories total)` : 'No categorized product sales this month',
        details: r.rows.slice(0, 3).map(row => `${row.categoryName}: ${row.revenuePercent}% of revenue`),
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — General's Universal Quote -> Order -> Invoice pipeline.
    // Read-only reporting, same convention as every other vertical AI
    // intent in this file — reports the funnel, never triggers a conversion
    // itself (matches the "create a sales order" universal intent's own
    // established pattern of pointing at the screen, not acting on it).
    case 'general.quotePipelineSummary': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const db = getPrisma()
      const quotations = await db.quotation.findMany({
        where: { createdAt: { gte: new Date(dateFrom), lte: new Date(`${dateTo}T23:59:59.999`) } },
        select: { invoice: { select: { id: true } }, salesOrder: { select: { id: true } } }
      })
      const total = quotations.length
      const toInvoice = quotations.filter(q => q.invoice).length
      const toSalesOrder = quotations.filter(q => q.salesOrder).length
      const pending = total - toInvoice - toSalesOrder
      return {
        headline: total > 0
          ? `${total} quotation${total === 1 ? '' : 's'} this month — ${toInvoice} billed directly, ${toSalesOrder} moved to a Sales Order, ${pending} still pending`
          : 'No quotations created this month',
        details: [`Direct to invoice: ${toInvoice}`, `Via Sales Order: ${toSalesOrder}`, `Pending: ${pending}`],
        isEmpty: total === 0
      }
    }
    case 'general.customDocumentSummary': {
      const typesRes = await customDocumentService.listTypes({ activeOnly: true })
      if (!typesRes.success) return { headline: '', details: [], isEmpty: true }
      const types = typesRes.data as { id: string; name: string }[]
      if (types.length === 0) {
        return { headline: 'No custom document types have been set up yet', details: [], isEmpty: true }
      }
      const counts = await Promise.all(types.map(async (dt) => {
        const entriesRes = await customDocumentService.listEntries(dt.id)
        return { name: dt.name, count: entriesRes.success ? (entriesRes.data as unknown[]).length : 0 }
      }))
      const total = counts.reduce((s, c) => s + c.count, 0)
      return {
        headline: `${total} entries logged across ${types.length} custom document type${types.length === 1 ? '' : 's'}`,
        details: counts.map((c) => `${c.name}: ${c.count} entries`),
        isEmpty: total === 0
      }
    }
    case 'hardware.fastSlowMoverMatrix': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateFastSlowMoverMatrixReport({ dateFrom, dateTo })
      const fastest = [...r.rows].sort((a, b) => b.velocity - a.velocity)[0] ?? null
      const laggards = r.rows.filter(row => row.quadrant === 'SLOW_LOW_MARGIN')
      return {
        headline: fastest ? `${fastest.productName} is your fastest mover at ${fastest.velocity}/day (${fastest.marginPercent}% margin)` : 'No products sold this month yet',
        details: [
          laggards.length > 0 ? `${laggards.length} product${laggards.length === 1 ? '' : 's'} are slow-moving with low margin — worth reviewing for discontinuation` : 'No slow-moving, low-margin products this month',
          `Median velocity: ${r.velocityMedian}/day, median margin: ${r.marginMedian}%`
        ],
        isEmpty: r.rows.length === 0
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
    // Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished
    // Unit. Leads with the highest-cost product, same "highest first"
    // framing the report's own sort order already uses.
    case 'manufacturing.landedCostPerUnit': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateLandedCostPerUnitReport({ dateFrom, dateTo })
      const top = r.rows[0] ?? null
      return {
        headline: top
          ? `${top.productName} costs ${formatAmountForSpeech(top.totalCostPerUnit, sym)}/unit this month (material ${formatAmountForSpeech(top.materialCostPerUnit, sym)}, labour ${formatAmountForSpeech(top.laborCostPerUnit, sym)}, overhead ${formatAmountForSpeech(top.overheadCostPerUnit, sym)})`
          : 'No completed production orders this month yet',
        details: r.rows.slice(0, 3).map(row => `${row.productName}: ${formatAmountForSpeech(row.totalCostPerUnit, sym)}/unit`),
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend. Leads with
    // the overall rate, then names the worst stage — the actionable part.
    case 'manufacturing.rejectionRateTrend': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateRejectionRateTrendReport({ dateFrom, dateTo })
      const worst = r.byStage[0] ?? null
      return {
        headline: r.summary.totalInspected > 0
          ? `${r.summary.overallRejectionRatePercent}% overall rejection rate this month${worst ? `, worst at "${worst.taskName}" (${worst.rejectionRatePercent}%)` : ''}`
          : 'No QC inspection counts recorded this month yet',
        details: r.byStage.slice(0, 3).map(s => `${s.taskName}: ${s.rejectionRatePercent}% (${s.qtyRejected}/${s.qtyInspected})`),
        isEmpty: r.summary.totalInspected === 0
      }
    }
    // Phase 67 §9.1 — Manufacturing item 1: machine/labour downtime capture.
    // Reads ALL-TIME data, same reasoning footwear.trialConversionRate
    // already established — a low-volume, cashier/floor-opt-in log next to
    // a full month of ordinary production activity needs a real sample size.
    case 'manufacturing.downtimeSummary': {
      const r = await getDowntimeSummary()
      if (!r.success || !r.data) return { headline: 'No downtime logged yet', details: [], isEmpty: true }
      const d = r.data
      return {
        headline: d.totalMinutes > 0 ? `${Math.round(d.totalMinutes)} minutes of downtime logged${d.byReason[0] ? `, most from "${d.byReason[0].reason}"` : ''}` : 'No downtime logged yet',
        details: d.byReason.slice(0, 3).map(r2 => `${r2.reason}: ${Math.round(r2.minutes)} min`),
        isEmpty: d.totalMinutes === 0
      }
    }
    // Phase 67 §9.1 — Manufacturing item 5: work-order lead-time bottleneck
    // flag. Same underlying computation the Dashboard-style banner already
    // shows proactively — this is the same answer, on request.
    case 'manufacturing.bottleneckFlag': {
      const r = await getWorkOrderBottleneckFlag()
      if (!r.success || !r.data || !r.data.bottleneckStage) return { headline: 'Not enough completed production data yet to flag a bottleneck stage', details: [], isEmpty: true }
      const d = r.data
      return {
        headline: `"${d.bottleneckStage}" is your slowest stage, averaging ${d.avgDurationHours}h (${d.shareOfTotalLeadTimePercent}% of total lead time)`,
        details: d.stages.slice(0, 3).map(s => `${s.taskName}: ${s.avgDurationHours}h avg, ${s.sampleCount} samples`),
        isEmpty: false
      }
    }
    // Phase 67 §9.1 — Agri Inputs item 2: Seasonal Credit Exposure. Live
    // current-state (no date range) — leads with the peak due month, the
    // actionable "when am I most exposed" answer.
    case 'agriInputs.seasonalCreditExposure': {
      const r = await reportService.generateSeasonalCreditExposureReport()
      return {
        headline: r.summary.peakMonth
          ? `${formatAmountForSpeech(r.summary.totalOutstanding, sym)} in outstanding credit, heaviest due in ${r.summary.peakMonth} (${formatAmountForSpeech(r.summary.peakMonthAmount, sym)})`
          : 'No outstanding credit invoices with a due date right now',
        details: r.bySeason.slice(0, 3).map(s => `${s.seasonName}: ${formatAmountForSpeech(s.outstandingAmount, sym)} across ${s.invoiceCount} invoice${s.invoiceCount === 1 ? '' : 's'}`),
        isEmpty: r.summary.totalOutstanding === 0
      }
    }
    // Phase 67 §9.1 — Agri Inputs item 4: Farmer-Wise Purchase & Repayment
    // History. Leads with the riskiest (lowest repayment rate) farmer, the
    // actionable part of a ranked list.
    case 'agriInputs.farmerRepayment': {
      const r = await reportService.generateFarmerRepaymentReport()
      const riskiest = r.rows[0] ?? null
      return {
        headline: riskiest
          ? `${riskiest.customerName} has the lowest repayment rate (${riskiest.repaymentRatePercent}%), ${formatAmountForSpeech(riskiest.outstandingBalance, sym)} outstanding`
          : 'No farmer credit activity recorded yet',
        details: [`${r.summary.totalFarmers} farmers with credit activity`, `Overall repayment rate: ${r.summary.overallRepaymentRatePercent}%`, `Total outstanding: ${formatAmountForSpeech(r.summary.totalOutstanding, sym)}`],
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Agri Inputs item 3: crop-linked product advisory.
    // Summary-level only — "which crops do we carry advisory-tagged
    // products for" — the per-crop product drill-down lives in the
    // dedicated Billing "Browse by Crop" UI, not here.
    case 'agriInputs.cropAdvisory': {
      const cropParam = typeof params.cropName === 'string' ? params.cropName : null
      if (cropParam) {
        const r = await getProductsForCrop(cropParam)
        if (!r.success || !r.data) return { headline: `No products tagged for "${cropParam}"`, details: [], isEmpty: true }
        return {
          headline: r.data.length > 0 ? `${r.data.length} product${r.data.length === 1 ? '' : 's'} recommended for ${cropParam}` : `No products tagged for "${cropParam}"`,
          details: r.data.slice(0, 5).map(p => `${p.productName}: ${formatAmountForSpeech(p.sellingPrice, sym)}, ${p.stockQty} in stock`),
          isEmpty: r.data.length === 0
        }
      }
      const r = await listDistinctCrops()
      if (!r.success || !r.data) return { headline: 'No crop-tagged products yet', details: [], isEmpty: true }
      return {
        headline: r.data.length > 0 ? `${r.data.length} crop${r.data.length === 1 ? '' : 's'} with tagged product advisories` : 'No crop-tagged products yet',
        details: r.data.slice(0, 5),
        isEmpty: r.data.length === 0
      }
    }
    // Phase 67 §9.1 — Agri Inputs item 5: equipment AMC/service reminders.
    // Leads with overdue count first (most urgent), same "overdue-first"
    // framing electronics.rmaOverdueSummary already established.
    case 'agriInputs.equipmentServiceDue': {
      const r = await listEquipmentDueForService()
      if (!r.success || !r.data) return { headline: 'No equipment service dates set yet', details: [], isEmpty: true }
      const overdue = r.data.filter(e => e.overdue)
      const dueSoon = r.data.filter(e => e.dueForService && !e.overdue)
      return {
        headline: overdue.length > 0
          ? `${overdue.length} unit${overdue.length === 1 ? ' is' : 's are'} overdue for service`
          : dueSoon.length > 0
            ? `${dueSoon.length} unit${dueSoon.length === 1 ? '' : 's'} due for service soon`
            : 'No equipment due for service right now',
        details: [...overdue, ...dueSoon].slice(0, 5).map(e => `${e.productName} (${e.serialNumber}): ${e.overdue ? 'overdue' : 'due soon'}`),
        isEmpty: r.data.length === 0
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
    // Phase 67 §9.1 — Electronics: RMA SLA tracker. Read-only, same
    // convention as every other vertical AI intent — surfaces the count,
    // never acts on it.
    case 'electronics.rmaOverdueSummary': {
      const db = getPrisma()
      const overdue = await db.repairTicket.findMany({
        where: { status: { in: ['SENT_TO_VENDOR', 'AWAITING_PARTS'] }, vendorSlaDueDate: { lt: new Date() } },
        select: { claimNumber: true, product: { select: { productName: true } }, sentToVendorDate: true },
        orderBy: { sentToVendorDate: 'asc' },
        take: 5
      })
      const count = overdue.length
      return {
        headline: count > 0
          ? `${count} unit${count === 1 ? ' is' : 's are'} overdue from vendor RMA (past the 30-day SLA)`
          : 'No RMA units are currently overdue',
        details: overdue.map(t => `${t.claimNumber} — ${t.product.productName}, sent ${t.sentToVendorDate ? t.sentToVendorDate.toISOString().slice(0, 10) : ''}`),
        isEmpty: count === 0
      }
    }
    // Phase 67 §9.1 — Electronics: vendor warranty-claim recovery ledger.
    // A genuinely different question from rmaOverdueSummary (money owed,
    // not time-with-vendor), so it gets its own intent rather than reusing
    // the SLA one — see item 2's own explicit non-duplication note above
    // for the case where reuse WAS the right call.
    case 'electronics.vendorRecovery': {
      const r = await reportService.generateVendorRecoveryLedgerReport()
      return {
        headline: r.summary.openCount > 0
          ? `₹${r.summary.totalOutstanding.toFixed(0)} outstanding across ${r.summary.openCount} open vendor claim${r.summary.openCount === 1 ? '' : 's'}`
          : 'No open vendor warranty claims',
        details: r.rows.filter(row => !row.isClosed).slice(0, 5).map(row => `${row.claimNumber} — ${row.productName}: ₹${row.outstandingAmount.toFixed(0)} outstanding`),
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Electronics: repair turnaround by technician. A
    // service-quality question, distinct from both rmaOverdueSummary
    // (vendor SLA) and vendorRecovery (money) — this one is about how fast
    // the shop's OWN staff complete work, its own genuinely new question.
    case 'electronics.repairTurnaround': {
      const r = await reportService.generateRepairTurnaroundByTechnicianReport()
      const fastest = r.rows[0]
      return {
        headline: r.rows.length > 0
          ? `${r.summary.overallAvgTurnaroundDays} day avg. repair turnaround across ${r.summary.technicianCount} technician${r.summary.technicianCount === 1 ? '' : 's'}`
          : 'No completed repair tickets have a technician assigned yet',
        details: fastest ? [`Fastest: ${fastest.technicianName} — ${fastest.avgTurnaroundDays} day avg. (${fastest.ticketCount} tickets)`] : [],
        isEmpty: r.rows.length === 0
      }
    }
    // Phase 67 §9.1 — Electronics: serial-number service lookup. Unlike
    // items 1/2/3/4's own aggregate/summary questions, this one needs a
    // specific serial number or IMEI pulled out of the question text —
    // reuses the same generic params.searchTerm extraction (a code-like
    // token) already established for customer/invoice lookups elsewhere in
    // this file's sibling ai-query.service.ts, rather than inventing a
    // second extraction mechanism.
    case 'electronics.serialServiceLookup': {
      const term = params.searchTerm as string | undefined
      if (!term) return { headline: '', details: [], isEmpty: true }
      const res = await lookupSerialService(term)
      if (!res.success || !res.data) return { headline: '', details: [], isEmpty: true }
      const { serial, purchase, tickets } = res.data
      const purchaseLine = purchase
        ? `Sold on ${purchase.invoiceNumber} (${purchase.invoiceDate.slice(0, 10)})${purchase.customerName ? ` to ${purchase.customerName}` : ''}`
        : 'Never sold — still in stock'
      return {
        headline: `${serial.productName} (${serial.serialNumber}) — ${tickets.length} repair ticket${tickets.length === 1 ? '' : 's'} on record`,
        details: [purchaseLine, ...tickets.slice(0, 5).map(tk => `${tk.claimNumber} — ${tk.issueDescription} (${tk.status})`)],
        isEmpty: false
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
        details: [
          `Expiring soon (warning): ${r.summary.warningCount}`, `Safe: ${r.summary.safeCount}`,
          `Value already expired: ${formatAmountForSpeech(r.summary.expiredValue, sym)}`,
          // Phase 67 §9.1 — Pharmacy's "Expiry-risk value" signature win:
          // money still recoverable if acted on now, distinct from the
          // already-expired figure above (a sunk loss, not an action item).
          `Value still at risk (expiring within 30 days): ${formatAmountForSpeech(r.summary.atRiskValue, sym)}`
        ],
        isEmpty: r.summary.totalBatches === 0
      }
    }
    // Phase 67 §9.1 — Pharmacy's "Doctor-wise prescription volume"
    // signature-win report. Genuinely new intent (PHARMACY previously had
    // zero prescription-related AI coverage) reusing the SAME
    // generatePrescriptionDrugSalesReport() the ReportsScreen's own
    // Prescription Drug Sales report calls, not a parallel computation.
    case 'pharmacy.prescriptionVolumeByDoctor': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generatePrescriptionDrugSalesReport({ dateFrom, dateTo })
      const top = r.byDoctor[0]
      return {
        headline: top
          ? `Dr. ${top.doctorName} drove the most prescription sales this period (${top.salesCount} sales, ${formatAmountForSpeech(top.totalAmount, sym)})`
          : 'No prescription sales recorded this period',
        details: r.byDoctor.slice(0, 5).map(d => `${d.doctorName}: ${d.salesCount} sales, ${formatAmountForSpeech(d.totalAmount, sym)}`),
        isEmpty: r.byDoctor.length === 0
      }
    }
    // Phase 67 §9.1 — Distributor's "Scheme cost vs. incremental volume"
    // signature win. Reuses the SAME generateSchemeCostVsVolumeReport() the
    // Reports screen's own report calls. Deliberately correlational phrasing
    // ("alongside", not "caused") — this codebase has no counterfactual
    // baseline, see the report function's own comment for why.
    case 'distributor.schemeCostVsVolume': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateSchemeCostVsVolumeReport({ dateFrom, dateTo })
      return {
        headline: r.summary.activeSchemeCount > 0
          ? `${r.summary.activeSchemeCount} active scheme(s) cost ${formatAmountForSpeech(r.summary.totalSchemeCost, sym)} this period, covering ${r.summary.coveredProductCount} product(s)`
          : 'No pricing schemes ran this period',
        details: [
          `FOC units given: ${r.summary.totalFocUnitsGiven}`,
          `Top scheme by cost: ${r.rows[0] ? `${r.rows[0].schemeName} (${formatAmountForSpeech(r.rows[0].totalCost, sym)})` : 'none'}`
        ],
        isEmpty: r.summary.activeSchemeCount === 0
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
    // Phase 66 — reuses the SAME getExpiringMemberships() the Dashboard
    // spotlight card and the Memberships screen's own "Expiring Soon" tab
    // both already call, not a parallel computation.
    case 'gym.membershipsExpiring': {
      const [weekRes, monthRes] = await Promise.all([
        getExpiringMemberships(7),
        getExpiringMemberships(30)
      ])
      const week = weekRes.data ?? []
      const month = monthRes.data ?? []
      return {
        headline: `${week.length} memberships expiring in the next 7 days, ${month.length} in the next 30 days`,
        details: week.slice(0, 10).map((m) => `${m.client.customerName} — ${m.plan.planName}, expires ${toLocalISODate(new Date(m.endDate))}`),
        isEmpty: month.length === 0
      }
    }
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
      const res = await getUpcomingTestsAndLowBalanceKPIs()
      if (!res.data) return { headline: '', details: [], isEmpty: true }
      const { upcomingTests, lowBalanceCount } = res.data
      return {
        headline: `${upcomingTests.length} learners have a test scheduled in the next 14 days, ${lowBalanceCount} are low on package sessions`,
        details: upcomingTests.slice(0, 5).map((t) => `${t.learner.customerName} — ${t.testType}, ${toLocalISODate(t.testDate)}`),
        isEmpty: upcomingTests.length === 0 && lowBalanceCount === 0
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
    case 'dental.treatmentAcceptanceRate': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateTreatmentAcceptanceRateReport({ dateFrom, dateTo })
      return {
        headline: r.summary.proposedCount > 0
          ? `${r.summary.acceptanceRatePercent}% of treatment plans proposed this period were accepted, ${r.summary.billedRatePercent}% actually billed (${r.summary.billedCount} of ${r.summary.proposedCount})`
          : 'No treatment plans proposed this period',
        details: r.funnel.map((f) => `${f.stage}: ${f.count}`),
        isEmpty: r.summary.proposedCount === 0
      }
    }
    case 'dental.recallCompliance': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateDentalRecallComplianceReport({ dateFrom, dateTo })
      return {
        headline: r.overallPercent != null ? `${r.overallPercent}% of recalls closed this period came back on time (${r.overallOnTime} of ${r.totalRecallsClosed})` : 'No recall periods closed this period',
        details: r.byRecallType.slice(0, 5).map((row) => `${row.recallType}: ${row.percent}% on time (${row.onTime} of ${row.total})`),
        isEmpty: r.totalRecallsClosed === 0
      }
    }
    case 'gp.chronicRecallsDue': {
      const now = new Date()
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 30)
      const res = await listChronicConditions({ activeOnly: true })
      const all = (res.data ?? []) as Array<{ nextRecallDate: Date; conditionName: string; patient: { customerName: string } }>
      const items = all.filter((r) => new Date(r.nextRecallDate).getTime() <= cutoff.getTime())
      return {
        headline: `${items.length} chronic-condition recalls due in the next 30 days`,
        details: items.slice(0, 10).map((r) => `${r.patient.customerName} (${r.conditionName}) — due ${toLocalISODate(new Date(r.nextRecallDate))}`),
        isEmpty: items.length === 0
      }
    }
    case 'gp.walkInVsAppointmentRatio': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateWalkInVsAppointmentRatioReport({ dateFrom, dateTo })
      const total = r.summary.totalWalkIns + r.summary.totalAppointments
      return {
        headline: `${r.summary.walkInPercent}% of visits this period were walk-ins (${r.summary.totalWalkIns} walk-in, ${r.summary.totalAppointments} booked)`,
        details: [],
        isEmpty: total === 0
      }
    }
    case 'gp.topDiagnosisCategory': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateDiagnosisCategoryTrendReport({ dateFrom, dateTo })
      // A raw month-by-category pivot doesn't translate to a spoken answer —
      // sum each category's counts across the returned months and surface
      // the leader, which is what a GP actually wants to know out loud.
      const totals = new Map<string, number>()
      for (const row of r.byMonth) {
        for (const category of r.categories) {
          const value = row[category]
          totals.set(category, (totals.get(category) ?? 0) + (typeof value === 'number' ? value : 0))
        }
      }
      const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
      const top = sorted[0]
      return {
        headline: top ? `${top[0]} is your most common diagnosis category this period (${top[1]} visits)` : 'No categorized diagnoses this period',
        details: sorted.slice(0, 5).map(([category, count]) => `${category}: ${count}`),
        isEmpty: r.summary.categorizedCount === 0
      }
    }
    case 'gp.referralOutcomes': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateReferralOutcomeReport({ dateFrom, dateTo })
      const pendingOutcomes = r.summary.completedCount - r.summary.outcomeRecordedCount
      return {
        headline: `${r.summary.totalReferrals} referral(s) this period, ${r.summary.outcomeRecordedCount} with an outcome recorded`,
        details: [
          `Completed visits: ${r.summary.completedCount}`,
          `Still pending: ${r.summary.pendingCount}`,
          ...(pendingOutcomes > 0 ? [`Completed but no outcome note yet: ${pendingOutcomes}`] : [])
        ],
        isEmpty: r.summary.totalReferrals === 0
      }
    }
    case 'sessionPacks.utilization': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generatePackUtilizationReport({ dateFrom, dateTo })
      return {
        headline: `${r.summary.overallUtilizationPercent}% of purchased sessions used this period (${r.summary.totalSessionsUsed} of ${r.summary.totalSessionsSold} across ${r.summary.totalPacks} pack(s))`,
        details: r.rows.filter((row) => row.remainingSessions > 0 && row.isActive).slice(0, 5).map((row) => `${row.customerName} (${row.packName}): ${row.remainingSessions} session(s) left`),
        isEmpty: r.summary.totalPacks === 0
      }
    }
    case 'lab.tatCompliance': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateLabTATReport({ dateFrom, dateTo })
      return {
        headline: r.summary.withTargetCount > 0
          ? `${r.summary.overallOnTimePercent}% of tests met their turnaround target this period (${r.summary.onTimeCount} of ${r.summary.withTargetCount})`
          : `${r.summary.totalCompleted} test(s) completed this period, none with a turnaround target set yet`,
        details: r.rows.filter((row) => row.targetTATHours != null && row.lateCount > 0).slice(0, 5).map((row) => `${row.testName}: ${row.lateCount} late of ${row.ordersCount}`),
        isEmpty: r.summary.totalCompleted === 0
      }
    }
    case 'lab.topPanel': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateTestVolumeByPanelReport({ dateFrom, dateTo })
      // Same "sum across months, surface the leader" pattern as
      // gp.topDiagnosisCategory above — a raw pivot isn't a spoken answer.
      const totals = new Map<string, number>()
      for (const row of r.byMonth) {
        for (const panel of r.panels) {
          const value = row[panel]
          totals.set(panel, (totals.get(panel) ?? 0) + (typeof value === 'number' ? value : 0))
        }
      }
      const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
      const top = sorted[0]
      return {
        headline: top ? `${top[0]} is your highest-volume panel this period (${top[1]} test(s))` : 'No tests recorded this period',
        details: sorted.slice(0, 5).map(([panel, count]) => `${panel}: ${count}`),
        isEmpty: r.summary.totalTests === 0
      }
    }
    case 'lab.referralLeaderboard': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateReferralLeaderboardReport({ dateFrom, dateTo, businessType: 'DIAGNOSTIC_LAB' })
      return {
        headline: r.summary.topReferrerName ? `${r.summary.topReferrerName} referred the most tests this period (${r.rows[0]?.count ?? 0})` : 'No referring doctors recorded this period',
        details: r.rows.slice(0, 5).map((row) => `${row.referrerName}: ${row.count}`),
        isEmpty: r.summary.totalReferrals === 0
      }
    }
    case 'specialist.referralLeaderboard': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateReferralLeaderboardReport({ dateFrom, dateTo, businessType: 'SPECIALIST_CLINIC' })
      return {
        headline: r.summary.topReferrerName ? `${r.summary.topReferrerName} referred the most patients this period (${r.rows[0]?.count ?? 0})` : 'No referring doctors recorded this period',
        details: r.rows.slice(0, 5).map((row) => `${row.referrerName}: ${row.count}`),
        isEmpty: r.summary.totalReferrals === 0
      }
    }
    case 'specialist.secondOpinionConversion': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateSecondOpinionConversionReport({ dateFrom, dateTo })
      return {
        headline: r.summary.totalSecondOpinionVisits > 0
          ? `${r.summary.conversionPercent}% of your second-opinion patients this period came back as ongoing patients (${r.summary.convertedCount} of ${r.summary.totalSecondOpinionVisits})`
          : 'No second-opinion consultations recorded this period',
        details: r.rows.slice(0, 5).map((row) => `${row.patientName} (${row.visitDate}): ${row.converted ? `returned ${row.nextVisitDate}` : 'no return visit yet'}`),
        isEmpty: r.summary.totalSecondOpinionVisits === 0
      }
    }
    case 'specialist.caseComplexityMix': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateCaseComplexityMixReport({ dateFrom, dateTo })
      return {
        headline: r.summary.totalTagged > 0
          ? `${r.summary.complexPercent}% of your tagged cases this period were complex (${r.summary.complexCount} of ${r.summary.totalTagged})`
          : 'No cases tagged with a complexity level this period',
        details: r.byMonth.slice(-3).map((row) => `${row.month}: ${row.ROUTINE} routine, ${row.COMPLEX} complex`),
        isEmpty: r.summary.totalTagged === 0
      }
    }
    case 'vet.vaccinationCompliance': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateVaccinationComplianceReport({ dateFrom, dateTo })
      return {
        headline: r.overallPercent != null ? `${r.overallPercent}% of vaccine doses this period were given on time (${r.overallOnTime} of ${r.totalDosesEvaluated})` : 'No follow-up doses with a prior due date this period',
        details: r.byVaccine.slice(0, 5).map((row) => `${row.vaccineName}: ${row.percent}% on time (${row.onTime} of ${row.total})`),
        isEmpty: r.totalDosesEvaluated === 0
      }
    }
    case 'vet.caseTypeVolume': {
      const { dateFrom, dateTo } = thisMonthRange(params)
      const r = await reportService.generateVetCaseTypeVolumeReport({ dateFrom, dateTo })
      // Same "sum across months, surface the leader" pattern as
      // gp.topDiagnosisCategory/lab.topPanel above.
      const totals = new Map<string, number>()
      for (const row of r.byMonth) {
        for (const caseType of r.caseTypes) {
          const value = row[caseType]
          totals.set(caseType, (totals.get(caseType) ?? 0) + (typeof value === 'number' ? value : 0))
        }
      }
      const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
      const top = sorted[0]
      return {
        headline: top ? `${top[0]} is your highest-volume case type this period (${top[1]} case(s))` : 'No cases recorded this period',
        details: sorted.slice(0, 5).map(([caseType, count]) => `${caseType}: ${count}`),
        isEmpty: r.summary.totalCases === 0
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
