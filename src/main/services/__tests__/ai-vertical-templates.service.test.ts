import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../industry-template.service', () => ({ getActiveTemplate: vi.fn() }))
vi.mock('../membership.service', () => ({ getExpiringMemberships: vi.fn() }))
vi.mock('../legal-case.service', () => ({ listLegalCases: vi.fn() }))
vi.mock('../hearing.service', () => ({ listHearings: vi.fn() }))
vi.mock('../shoot-booking.service', () => ({ getShootKPIs: vi.fn() }))
vi.mock('../driving.service', () => ({ getUpcomingTestsAndLowBalanceKPIs: vi.fn() }))
vi.mock('../hotel.service', () => ({ getOccupancyReport: vi.fn() }))
vi.mock('../report.service', () => ({ reportService: { generatePrescriptionDrugSalesReport: vi.fn(), generateBatchExpiryReport: vi.fn(), generateSchemeCostVsVolumeReport: vi.fn(), generateWalkInVsAppointmentRatioReport: vi.fn(), generateDiagnosisCategoryTrendReport: vi.fn(), generateReferralOutcomeReport: vi.fn(), generatePackUtilizationReport: vi.fn(), generateLabTATReport: vi.fn(), generateTestVolumeByPanelReport: vi.fn(), generateReferralLeaderboardReport: vi.fn(), generateSecondOpinionConversionReport: vi.fn(), generateCaseComplexityMixReport: vi.fn(), generateTreatmentAcceptanceRateReport: vi.fn(), generateDentalRecallComplianceReport: vi.fn(), generateVaccinationComplianceReport: vi.fn(), generateVetCaseTypeVolumeReport: vi.fn(), generateDishContributionMarginReport: vi.fn(), generateTableTurnoverByHourReport: vi.fn(), generateRecipeWasteVarianceReport: vi.fn(), generateDeadStockClearanceReport: vi.fn(), generateCategorySellThroughReport: vi.fn(), generateBasketCompositionReport: vi.fn(), generateCategoryMixReport: vi.fn(), generateCashPositionTrendReport: vi.fn(), generateFastSlowMoverMatrixReport: vi.fn(), generateVendorRecoveryLedgerReport: vi.fn(), generateRepairTurnaroundByTechnicianReport: vi.fn(), generateSeasonSellThroughReport: vi.fn(), generateSizeStyleHeatmapReport: vi.fn(), generateVendorMarginReport: vi.fn(), generateBrandMarginReturnRateReport: vi.fn(), generateSizeAvailabilityHeatmapReport: vi.fn(), generateLandedCostPerUnitReport: vi.fn(), generateRejectionRateTrendReport: vi.fn(), generateSeasonalCreditExposureReport: vi.fn(), generateFarmerRepaymentReport: vi.fn(), generateDonationToIssueCycleTimeReport: vi.fn(), generateAssetUtilizationReport: vi.fn(), generateMakingChargeMarginReport: vi.fn(), generateHallmarkComplianceReport: vi.fn(), generateMetalRateVsSalesVolumeReport: vi.fn(), generatePurityAdjustedExchangeReport: vi.fn(), generateServiceResolutionTimeReport: vi.fn(), generateRepeatBusinessRateReport: vi.fn(), generateConsultantUtilizationReport: vi.fn(), generateClientProfitabilityReport: vi.fn() } }))
vi.mock('../gold-savings.service', () => ({ listGoldSavingsSchemes: vi.fn() }))
vi.mock('../service-ticket.service', () => ({ listTickets: vi.fn(), getQuoteToJobConversionStats: vi.fn() }))
vi.mock('../service-contract.service', () => ({ listServiceContracts: vi.fn() }))
vi.mock('../project.service', () => ({ getEngagementConversionStats: vi.fn(), getProposalWinRateStats: vi.fn() }))
vi.mock('../retainer.service', () => ({ listRetainers: vi.fn(), getRetainerHoursUsage: vi.fn() }))
vi.mock('../template-suggestion.service', () => ({ getTemplateSuggestion: vi.fn() }))
vi.mock('../custom-document.service', () => ({ customDocumentService: { listTypes: vi.fn(), listEntries: vi.fn() } }))
vi.mock('../placement.service', () => ({ getPlacementKPIs: vi.fn() }))
vi.mock('../roc-filing.service', () => ({ listROCFilings: vi.fn() }))
vi.mock('../property.service', () => ({ getPropertyKPIs: vi.fn() }))
vi.mock('../issue.service', () => ({ listIssues: vi.fn() }))
vi.mock('../event-booking.service', () => ({ getEventKPIs: vi.fn() }))
vi.mock('../vaccination.service', () => ({ getUpcomingVaccinations: vi.fn() }))
vi.mock('../recall-record.service', () => ({ listRecalls: vi.fn() }))
vi.mock('../chronic-condition-record.service', () => ({ listChronicConditions: vi.fn() }))
vi.mock('../car-job-card.service', () => ({ getCarJobCardKPIs: vi.fn() }))
vi.mock('../repair-ticket.service', () => ({ lookupSerialService: vi.fn() }))
vi.mock('../variant.service', () => ({ getSizeCurveReorderSuggestion: vi.fn() }))
vi.mock('../trial-session.service', () => ({ getTrialConversionSummary: vi.fn() }))
vi.mock('../seasonal-cycle.service', () => ({ getSeasonalReorderCalendar: vi.fn() }))
vi.mock('../work-order.service', () => ({ getDowntimeSummary: vi.fn(), getWorkOrderBottleneckFlag: vi.fn() }))
vi.mock('../crop-advisory.service', () => ({ listDistinctCrops: vi.fn(), getProductsForCrop: vi.fn() }))
vi.mock('../serial.service', () => ({ listEquipmentDueForService: vi.fn() }))
vi.mock('../blood-bank.service', () => ({ listDonorsDueForRecall: vi.fn(), listDonationCamps: vi.fn() }))
// generateSizeAvailabilityHeatmapReport is added to the existing
// '../report.service' mock factory below, alongside the other report fns.
vi.mock('../coaching-fee.service', () => ({ getFeeKPIs: vi.fn() }))
vi.mock('../loyalty-program.service', () => ({ loyaltyProgramService: { getSummary: vi.fn() } }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getActiveTemplate } from '../industry-template.service'
import { getExpiringMemberships } from '../membership.service'
import { reportService } from '../report.service'
import { lookupSerialService } from '../repair-ticket.service'
import { getSizeCurveReorderSuggestion } from '../variant.service'
import { getTrialConversionSummary } from '../trial-session.service'
import { getSeasonalReorderCalendar } from '../seasonal-cycle.service'
import { getDowntimeSummary, getWorkOrderBottleneckFlag } from '../work-order.service'
import { listDistinctCrops, getProductsForCrop } from '../crop-advisory.service'
import { listEquipmentDueForService } from '../serial.service'
import { listDonorsDueForRecall, listDonationCamps } from '../blood-bank.service'
import { listGoldSavingsSchemes } from '../gold-savings.service'
import { listTickets, getQuoteToJobConversionStats } from '../service-ticket.service'
import { listServiceContracts } from '../service-contract.service'
import { getEngagementConversionStats, getProposalWinRateStats } from '../project.service'
import { listRetainers, getRetainerHoursUsage } from '../retainer.service'
import { getTemplateSuggestion } from '../template-suggestion.service'
import { customDocumentService } from '../custom-document.service'
import { listChronicConditions } from '../chronic-condition-record.service'
import { loyaltyProgramService } from '../loyalty-program.service'
import { getPrisma } from '../../database/db'
import { getActiveVerticalTemplateNames, executeVerticalTemplate } from '../ai-vertical-templates.service'

beforeEach(() => vi.clearAllMocks())

// Phase 66 — GYM_STUDIO's Dashboard spotlight card now surfaces
// getExpiringMemberships data (previously only used by the dedicated
// Memberships screen). Per Section 1.2's "any new report gets a matching AI
// query pattern" rule, Ask Sarang AI needs the same intent — these tests
// confirm the registration + the case handler both exist and reuse the
// SAME function, not a parallel computation.
describe('ai-vertical-templates.service — gym.membershipsExpiring', () => {
  it('registers gym.membershipsExpiring for GYM_STUDIO alongside the shared appointment templates', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'GYM_STUDIO' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('gym.membershipsExpiring')
    expect(names).toContain('service.appointmentUtilisation')
    expect(names).toContain('service.clientRetention')
    expect(names).toContain('service.commission')
  })

  it('executeVerticalTemplate answers gym.membershipsExpiring using getExpiringMemberships(7) and (30)', async () => {
    vi.mocked(getExpiringMemberships).mockImplementation(async (daysAhead?: number) => {
      if (daysAhead === 7) {
        return {
          success: true,
          data: [{ client: { customerName: 'Anita Rao' }, plan: { planName: 'Gold' }, endDate: new Date('2026-08-20') }]
        } as never
      }
      return {
        success: true,
        data: [
          { client: { customerName: 'Anita Rao' }, plan: { planName: 'Gold' }, endDate: new Date('2026-08-20') },
          { client: { customerName: 'Ravi Kumar' }, plan: { planName: 'Silver' }, endDate: new Date('2026-09-01') }
        ]
      } as never
    })

    const result = await executeVerticalTemplate('gym.membershipsExpiring', {}, '₹')

    expect(getExpiringMemberships).toHaveBeenCalledWith(7)
    expect(getExpiringMemberships).toHaveBeenCalledWith(30)
    expect(result.headline).toContain('1 memberships expiring in the next 7 days')
    expect(result.headline).toContain('2 in the next 30 days')
    expect(result.details).toEqual(['Anita Rao — Gold, expires 2026-08-20'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when nothing expires in the next 30 days', async () => {
    vi.mocked(getExpiringMemberships).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('gym.membershipsExpiring', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Pharmacy's "Doctor-wise prescription volume" signature
// win. Confirms the intent is registered for PHARMACY only (not
// AGRI_INPUTS, which shares inventory.batchExpiry but not this one) and
// reuses the SAME generatePrescriptionDrugSalesReport() the ReportsScreen's
// own report calls, not a parallel computation.
describe('ai-vertical-templates.service — pharmacy.prescriptionVolumeByDoctor', () => {
  it('registers pharmacy.prescriptionVolumeByDoctor for PHARMACY alongside inventory.batchExpiry, but NOT for AGRI_INPUTS', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'PHARMACY' } } as never)
    const pharmacyNames = await getActiveVerticalTemplateNames()
    expect(pharmacyNames).toContain('pharmacy.prescriptionVolumeByDoctor')
    expect(pharmacyNames).toContain('inventory.batchExpiry')

    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } } as never)
    const agriNames = await getActiveVerticalTemplateNames()
    expect(agriNames).not.toContain('pharmacy.prescriptionVolumeByDoctor')
    expect(agriNames).toContain('inventory.batchExpiry')
  })

  it('executeVerticalTemplate answers with the top referring doctor and a per-doctor breakdown', async () => {
    vi.mocked(reportService.generatePrescriptionDrugSalesReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalSales: 3, totalAmount: 450, missingPrescriptionDetails: 0 },
      byDoctor: [
        { doctorName: 'Dr. Mehta', salesCount: 2, totalAmount: 250 },
        { doctorName: 'Dr. Rao', salesCount: 1, totalAmount: 200 }
      ],
      rows: []
    } as never)

    const result = await executeVerticalTemplate('pharmacy.prescriptionVolumeByDoctor', {}, '₹')

    expect(result.headline).toContain('Dr. Mehta')
    expect(result.headline).toContain('2 sales')
    expect(result.details).toEqual(['Dr. Mehta: 2 sales, ₹250.00', 'Dr. Rao: 1 sales, ₹200.00'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no prescription sales have a doctor name yet', async () => {
    vi.mocked(reportService.generatePrescriptionDrugSalesReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalSales: 0, totalAmount: 0, missingPrescriptionDetails: 0 },
      byDoctor: [], rows: []
    } as never)

    const result = await executeVerticalTemplate('pharmacy.prescriptionVolumeByDoctor', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No prescription sales recorded this period')
  })
})

// Phase 67 §9.1 — Distributor's "Scheme cost vs. incremental volume"
// signature win. Confirms the intent is registered for DISTRIBUTOR only
// (it had ZERO vertical AI templates before this) and reuses the SAME
// generateSchemeCostVsVolumeReport() the Reports screen calls.
describe('ai-vertical-templates.service — distributor.schemeCostVsVolume', () => {
  it('registers distributor.schemeCostVsVolume for DISTRIBUTOR (which previously had zero vertical templates)', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'DISTRIBUTOR' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(['distributor.schemeCostVsVolume'])
  })

  it('executeVerticalTemplate answers with active scheme count, cost, and covered products', async () => {
    vi.mocked(reportService.generateSchemeCostVsVolumeReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalSchemeCost: 8000, totalFocUnitsGiven: 40, activeSchemeCount: 2, coveredProductCount: 5 },
      byPeriod: [],
      rows: [{ schemeId: 's1', schemeName: 'Buy 10 Get 2 Free', ruleType: 'BUY_X_GET_Y_FREE', totalCost: 5000, focUnitsGiven: 25 }]
    } as never)

    const result = await executeVerticalTemplate('distributor.schemeCostVsVolume', {}, '₹')

    expect(result.headline).toContain('2 active scheme(s)')
    expect(result.headline).toContain('5 product(s)')
    expect(result.details).toEqual(['FOC units given: 40', 'Top scheme by cost: Buy 10 Get 2 Free (₹5,000.00)'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no schemes ran this period', async () => {
    vi.mocked(reportService.generateSchemeCostVsVolumeReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalSchemeCost: 0, totalFocUnitsGiven: 0, activeSchemeCount: 0, coveredProductCount: 0 },
      byPeriod: [], rows: []
    } as never)

    const result = await executeVerticalTemplate('distributor.schemeCostVsVolume', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No pricing schemes ran this period')
  })
})

// Phase 67 §9.1 item 19 — GP Clinic's Dashboard spotlight card now surfaces
// chronic-condition recall data (dashboard-spotlight.service.ts's
// `chronicRecall` kind). Per Section 1.2's "any new report gets a matching
// AI query pattern" rule, this needs a matching intent too.
describe('ai-vertical-templates.service — gp.chronicRecallsDue', () => {
  it('registers gp.chronicRecallsDue for GP_CLINIC alongside the shared appointment templates', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'GP_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(['service.appointmentUtilisation', 'service.clientRetention', 'gp.chronicRecallsDue', 'gp.walkInVsAppointmentRatio', 'gp.topDiagnosisCategory', 'gp.referralOutcomes'])
  })

  it('executeVerticalTemplate answers with recalls due in the next 30 days, filtered from all active records', async () => {
    const now = Date.now()
    vi.mocked(listChronicConditions).mockResolvedValue({
      success: true,
      data: [
        { nextRecallDate: new Date(now + 10 * 86400000), conditionName: 'Diabetes', patient: { customerName: 'Asha Rao' } },
        { nextRecallDate: new Date(now + 20 * 86400000), conditionName: 'Hypertension', patient: { customerName: 'Vikram Shah' } },
        { nextRecallDate: new Date(now + 60 * 86400000), conditionName: 'Diabetes', patient: { customerName: 'Not Due Yet' } },
      ],
    } as never)

    const result = await executeVerticalTemplate('gp.chronicRecallsDue', {}, '₹')

    expect(result.headline).toBe('2 chronic-condition recalls due in the next 30 days')
    expect(result.details).toHaveLength(2)
    expect(result.details[0]).toContain('Asha Rao')
    expect(result.details[0]).toContain('Diabetes')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no chronic-condition recalls are due in the next 30 days', async () => {
    vi.mocked(listChronicConditions).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('gp.chronicRecallsDue', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('0 chronic-condition recalls due in the next 30 days')
  })
})

describe('ai-vertical-templates.service — gp.walkInVsAppointmentRatio', () => {
  it('executeVerticalTemplate answers with the walk-in percentage and split counts', async () => {
    vi.mocked(reportService.generateWalkInVsAppointmentRatioReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalWalkIns: 30, totalAppointments: 20, walkInPercent: 60 },
      byDay: [],
    } as never)

    const result = await executeVerticalTemplate('gp.walkInVsAppointmentRatio', {}, '₹')

    expect(result.headline).toBe('60% of visits this period were walk-ins (30 walk-in, 20 booked)')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when there are no visits at all this period', async () => {
    vi.mocked(reportService.generateWalkInVsAppointmentRatioReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalWalkIns: 0, totalAppointments: 0, walkInPercent: 0 },
      byDay: [],
    } as never)

    const result = await executeVerticalTemplate('gp.walkInVsAppointmentRatio', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

describe('ai-vertical-templates.service — gp.topDiagnosisCategory', () => {
  it('sums each category across all returned months and surfaces the leader', async () => {
    vi.mocked(reportService.generateDiagnosisCategoryTrendReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalVisits: 10, categorizedCount: 10, uncategorizedCount: 0, distinctCategoryCount: 2 },
      categories: ['Infection', 'Injury'],
      byMonth: [{ month: '2026-08', Infection: 6, Injury: 4 }],
    } as never)

    const result = await executeVerticalTemplate('gp.topDiagnosisCategory', {}, '₹')

    expect(result.headline).toBe('Infection is your most common diagnosis category this period (6 visits)')
    expect(result.details).toEqual(['Infection: 6', 'Injury: 4'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when nothing is categorized this period', async () => {
    vi.mocked(reportService.generateDiagnosisCategoryTrendReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalVisits: 3, categorizedCount: 0, uncategorizedCount: 3, distinctCategoryCount: 0 },
      categories: [],
      byMonth: [],
    } as never)

    const result = await executeVerticalTemplate('gp.topDiagnosisCategory', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No categorized diagnoses this period')
  })
})

describe('ai-vertical-templates.service — gp.referralOutcomes', () => {
  it('reports completed vs. pending vs. still-missing-an-outcome counts', async () => {
    vi.mocked(reportService.generateReferralOutcomeReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalReferrals: 5, completedCount: 3, outcomeRecordedCount: 2, pendingCount: 2 },
      rows: [],
    } as never)

    const result = await executeVerticalTemplate('gp.referralOutcomes', {}, '₹')

    expect(result.headline).toBe('5 referral(s) this period, 2 with an outcome recorded')
    expect(result.details).toEqual(['Completed visits: 3', 'Still pending: 2', 'Completed but no outcome note yet: 1'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no referrals were made this period', async () => {
    vi.mocked(reportService.generateReferralOutcomeReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalReferrals: 0, completedCount: 0, outcomeRecordedCount: 0, pendingCount: 0 },
      rows: [],
    } as never)

    const result = await executeVerticalTemplate('gp.referralOutcomes', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 22.4 — Physio Clinic's Pack Utilization, a real shared
// component with Gym/Studio: one intent, one underlying report function,
// registered for BOTH business types.
describe('ai-vertical-templates.service — sessionPacks.utilization', () => {
  it('registers sessionPacks.utilization for PHYSIO_CLINIC', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'PHYSIO_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('sessionPacks.utilization')
  })

  it('registers sessionPacks.utilization for GYM_STUDIO too — same intent, shared component', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'GYM_STUDIO' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('sessionPacks.utilization')
  })

  it('executeVerticalTemplate lists which active clients have sessions remaining', async () => {
    vi.mocked(reportService.generatePackUtilizationReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalPacks: 3, totalSessionsSold: 30, totalSessionsUsed: 18, overallUtilizationPercent: 60 },
      rows: [
        { packId: 'p1', customerName: 'Asha Rao', packName: '10-Pack', totalSessions: 10, usedSessions: 4, remainingSessions: 6, utilizationPercent: 40, expiryDate: null, isActive: true },
        { packId: 'p2', customerName: 'Vikram Shah', packName: '10-Pack', totalSessions: 10, usedSessions: 10, remainingSessions: 0, utilizationPercent: 100, expiryDate: null, isActive: false },
      ],
    } as never)

    const result = await executeVerticalTemplate('sessionPacks.utilization', {}, '₹')

    expect(result.headline).toBe('60% of purchased sessions used this period (18 of 30 across 3 pack(s))')
    expect(result.details).toEqual(['Asha Rao (10-Pack): 6 session(s) left'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no packs exist this period', async () => {
    vi.mocked(reportService.generatePackUtilizationReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalPacks: 0, totalSessionsSold: 0, totalSessionsUsed: 0, overallUtilizationPercent: 0 },
      rows: [],
    } as never)

    const result = await executeVerticalTemplate('sessionPacks.utilization', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 items 23.1/23.4 — Diagnostic Lab's TAT compliance and top
// test panel by volume.
describe('ai-vertical-templates.service — lab.tatCompliance / lab.topPanel', () => {
  it('registers lab.tatCompliance, lab.topPanel and lab.referralLeaderboard for DIAGNOSTIC_LAB', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'DIAGNOSTIC_LAB' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(expect.arrayContaining(['lab.tatCompliance', 'lab.topPanel', 'lab.referralLeaderboard']))
  })

  it('lab.tatCompliance reports the overall on-time percent and lists tests running late', async () => {
    vi.mocked(reportService.generateLabTATReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalCompleted: 10, withTargetCount: 8, onTimeCount: 6, overallOnTimePercent: 75 },
      rows: [
        { testName: 'CBC', category: 'Hematology', ordersCount: 5, avgActualTATHours: 30, targetTATHours: 24, onTimeCount: 3, lateCount: 2, onTimePercent: 60 },
      ],
    } as never)

    const result = await executeVerticalTemplate('lab.tatCompliance', {}, '₹')

    expect(result.headline).toBe('75% of tests met their turnaround target this period (6 of 8)')
    expect(result.details).toEqual(['CBC: 2 late of 5'])
    expect(result.isEmpty).toBe(false)
  })

  it('lab.tatCompliance handles zero tests with a target set (nothing to compare against)', async () => {
    vi.mocked(reportService.generateLabTATReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalCompleted: 3, withTargetCount: 0, onTimeCount: 0, overallOnTimePercent: 0 },
      rows: [],
    } as never)

    const result = await executeVerticalTemplate('lab.tatCompliance', {}, '₹')

    expect(result.headline).toBe('3 test(s) completed this period, none with a turnaround target set yet')
    expect(result.isEmpty).toBe(false)
  })

  it('lab.topPanel sums each panel across months and surfaces the leader', async () => {
    vi.mocked(reportService.generateTestVolumeByPanelReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalTests: 6, distinctPanelCount: 2 },
      panels: ['Hematology', 'Biochemistry'],
      byMonth: [{ month: 'Aug 2026', Hematology: 4, Biochemistry: 2 }],
    } as never)

    const result = await executeVerticalTemplate('lab.topPanel', {}, '₹')

    expect(result.headline).toBe('Hematology is your highest-volume panel this period (4 test(s))')
    expect(result.details).toEqual(['Hematology: 4', 'Biochemistry: 2'])
    expect(result.isEmpty).toBe(false)
  })

  it('lab.topPanel marks isEmpty true when no tests recorded', async () => {
    vi.mocked(reportService.generateTestVolumeByPanelReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalTests: 0, distinctPanelCount: 0 },
      panels: [], byMonth: [],
    } as never)

    const result = await executeVerticalTemplate('lab.topPanel', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 23.5 (Diagnostic Lab) + item 20.1 (Specialist Clinic) —
// Referral Leaderboard: one report shape, two callers with different
// underlying queries (passed explicitly via businessType).
describe('ai-vertical-templates.service — referral leaderboard (lab + specialist)', () => {
  it('registers specialist.referralLeaderboard for SPECIALIST_CLINIC', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'SPECIALIST_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('specialist.referralLeaderboard')
  })

  it('lab.referralLeaderboard calls generateReferralLeaderboardReport with businessType DIAGNOSTIC_LAB', async () => {
    vi.mocked(reportService.generateReferralLeaderboardReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalReferrals: 4, distinctReferrerCount: 2, topReferrerName: 'Dr. Mehta' },
      rows: [{ referrerName: 'Dr. Mehta', count: 3 }, { referrerName: 'Dr. Iyer', count: 1 }],
    } as never)

    const result = await executeVerticalTemplate('lab.referralLeaderboard', {}, '₹')

    expect(reportService.generateReferralLeaderboardReport).toHaveBeenCalledWith(expect.objectContaining({ businessType: 'DIAGNOSTIC_LAB' }))
    expect(result.headline).toBe('Dr. Mehta referred the most tests this period (3)')
    expect(result.isEmpty).toBe(false)
  })

  it('specialist.referralLeaderboard calls generateReferralLeaderboardReport with businessType SPECIALIST_CLINIC', async () => {
    vi.mocked(reportService.generateReferralLeaderboardReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalReferrals: 2, distinctReferrerCount: 1, topReferrerName: 'Dr. Rao' },
      rows: [{ referrerName: 'Dr. Rao', count: 2 }],
    } as never)

    const result = await executeVerticalTemplate('specialist.referralLeaderboard', {}, '₹')

    expect(reportService.generateReferralLeaderboardReport).toHaveBeenCalledWith(expect.objectContaining({ businessType: 'SPECIALIST_CLINIC' }))
    expect(result.headline).toBe('Dr. Rao referred the most patients this period (2)')
  })

  it('marks isEmpty true when no referrals recorded', async () => {
    vi.mocked(reportService.generateReferralLeaderboardReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalReferrals: 0, distinctReferrerCount: 0, topReferrerName: null },
      rows: [],
    } as never)

    const result = await executeVerticalTemplate('lab.referralLeaderboard', {}, '₹')

    expect(result.headline).toBe('No referring doctors recorded this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 20.2 — Specialist Clinic's Second-Opinion Conversion report.
describe('ai-vertical-templates.service — specialist.secondOpinionConversion', () => {
  it('registers specialist.secondOpinionConversion for SPECIALIST_CLINIC', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'SPECIALIST_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('specialist.secondOpinionConversion')
  })

  it('reports the conversion percent and lists patient rows', async () => {
    vi.mocked(reportService.generateSecondOpinionConversionReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-19',
      summary: { totalSecondOpinionVisits: 4, convertedCount: 3, conversionPercent: 75, distinctPatientCount: 4 },
      rows: [
        { patientName: 'Anita Rao', visitDate: '2026-08-02', converted: true, nextVisitDate: '2026-08-15' },
        { patientName: 'Vikram Shah', visitDate: '2026-08-05', converted: false, nextVisitDate: null },
      ],
    } as never)

    const result = await executeVerticalTemplate('specialist.secondOpinionConversion', {}, '₹')

    expect(result.headline).toBe('75% of your second-opinion patients this period came back as ongoing patients (3 of 4)')
    expect(result.details[0]).toBe('Anita Rao (2026-08-02): returned 2026-08-15')
    expect(result.details[1]).toBe('Vikram Shah (2026-08-05): no return visit yet')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no second-opinion visits recorded', async () => {
    vi.mocked(reportService.generateSecondOpinionConversionReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-19',
      summary: { totalSecondOpinionVisits: 0, convertedCount: 0, conversionPercent: null, distinctPatientCount: 0 },
      rows: [],
    } as never)

    const result = await executeVerticalTemplate('specialist.secondOpinionConversion', {}, '₹')

    expect(result.headline).toBe('No second-opinion consultations recorded this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 20.3 — Specialist Clinic's Case-Complexity Mix report.
describe('ai-vertical-templates.service — specialist.caseComplexityMix', () => {
  it('registers specialist.caseComplexityMix for SPECIALIST_CLINIC', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'SPECIALIST_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('specialist.caseComplexityMix')
  })

  it('reports the complex percent and recent monthly breakdown', async () => {
    vi.mocked(reportService.generateCaseComplexityMixReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-19',
      summary: { totalTagged: 10, routineCount: 6, complexCount: 4, complexPercent: 40 },
      byMonth: [{ month: '2026-08', ROUTINE: 6, COMPLEX: 4 }],
    } as never)

    const result = await executeVerticalTemplate('specialist.caseComplexityMix', {}, '₹')

    expect(result.headline).toBe('40% of your tagged cases this period were complex (4 of 10)')
    expect(result.details[0]).toBe('2026-08: 6 routine, 4 complex')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no cases tagged', async () => {
    vi.mocked(reportService.generateCaseComplexityMixReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-19',
      summary: { totalTagged: 0, routineCount: 0, complexCount: 0, complexPercent: null },
      byMonth: [],
    } as never)

    const result = await executeVerticalTemplate('specialist.caseComplexityMix', {}, '₹')

    expect(result.headline).toBe('No cases tagged with a complexity level this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 21.2 — Dental Clinic's Treatment Acceptance Rate report.
describe('ai-vertical-templates.service — dental.treatmentAcceptanceRate', () => {
  it('registers dental.treatmentAcceptanceRate for DENTAL_CLINIC', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'DENTAL_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('dental.treatmentAcceptanceRate')
  })

  it('reports the acceptance/billed rates and the funnel breakdown', async () => {
    vi.mocked(reportService.generateTreatmentAcceptanceRateReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-19',
      summary: { proposedCount: 10, acceptedCount: 7, billedCount: 5, acceptanceRatePercent: 70, billedRatePercent: 50 },
      funnel: [{ stage: 'Proposed', count: 10 }, { stage: 'Accepted', count: 7 }, { stage: 'Billed', count: 5 }],
    } as never)

    const result = await executeVerticalTemplate('dental.treatmentAcceptanceRate', {}, '₹')

    expect(result.headline).toBe('70% of treatment plans proposed this period were accepted, 50% actually billed (5 of 10)')
    expect(result.details).toEqual(['Proposed: 10', 'Accepted: 7', 'Billed: 5'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no plans proposed', async () => {
    vi.mocked(reportService.generateTreatmentAcceptanceRateReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-19',
      summary: { proposedCount: 0, acceptedCount: 0, billedCount: 0, acceptanceRatePercent: null, billedRatePercent: null },
      funnel: [{ stage: 'Proposed', count: 0 }, { stage: 'Accepted', count: 0 }, { stage: 'Billed', count: 0 }],
    } as never)

    const result = await executeVerticalTemplate('dental.treatmentAcceptanceRate', {}, '₹')

    expect(result.headline).toBe('No treatment plans proposed this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 21.4 — Dental Clinic's Recall Compliance report.
describe('ai-vertical-templates.service — dental.recallCompliance', () => {
  it('registers dental.recallCompliance for DENTAL_CLINIC', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'DENTAL_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('dental.recallCompliance')
  })

  it('reports the overall on-time percent and the per-type breakdown', async () => {
    vi.mocked(reportService.generateDentalRecallComplianceReport).mockResolvedValue({
      totalRecallsClosed: 8, overallOnTime: 6, overallPercent: 75,
      byRecallType: [{ recallType: 'HYGIENE_6M', total: 8, onTime: 6, percent: 75 }],
    } as never)

    const result = await executeVerticalTemplate('dental.recallCompliance', {}, '₹')

    expect(result.headline).toBe('75% of recalls closed this period came back on time (6 of 8)')
    expect(result.details).toEqual(['HYGIENE_6M: 75% on time (6 of 8)'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no recall periods closed', async () => {
    vi.mocked(reportService.generateDentalRecallComplianceReport).mockResolvedValue({
      totalRecallsClosed: 0, overallOnTime: 0, overallPercent: null, byRecallType: [],
    } as never)

    const result = await executeVerticalTemplate('dental.recallCompliance', {}, '₹')

    expect(result.headline).toBe('No recall periods closed this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 18.2 — Vet Clinic's Vaccination Compliance report.
describe('ai-vertical-templates.service — vet.vaccinationCompliance', () => {
  it('registers both vet.vaccinationsDue and vet.vaccinationCompliance for VET_CLINIC', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'VET_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(expect.arrayContaining(['vet.vaccinationsDue', 'vet.vaccinationCompliance']))
  })

  it('reports the overall on-time percent and lists the worst-performing vaccines', async () => {
    vi.mocked(reportService.generateVaccinationComplianceReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      totalDosesEvaluated: 10, overallOnTime: 7, overallPercent: 70,
      byVaccine: [
        { vaccineName: 'Rabies', total: 6, onTime: 5, percent: 83 },
        { vaccineName: 'DHPP', total: 4, onTime: 2, percent: 50 },
      ],
    } as never)

    const result = await executeVerticalTemplate('vet.vaccinationCompliance', {}, '₹')

    expect(result.headline).toBe('70% of vaccine doses this period were given on time (7 of 10)')
    expect(result.details).toEqual(['Rabies: 83% on time (5 of 6)', 'DHPP: 50% on time (2 of 4)'])
    expect(result.isEmpty).toBe(false)
  })

  it('handles zero doses with a prior due date (nothing to compare against)', async () => {
    vi.mocked(reportService.generateVaccinationComplianceReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      totalDosesEvaluated: 0, overallOnTime: 0, overallPercent: null,
      byVaccine: [],
    } as never)

    const result = await executeVerticalTemplate('vet.vaccinationCompliance', {}, '₹')

    expect(result.headline).toBe('No follow-up doses with a prior due date this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 item 18.4 — Vet Clinic's Case-Type Volume Trend report.
describe('ai-vertical-templates.service — vet.caseTypeVolume', () => {
  it('registers vet.caseTypeVolume alongside the other two vet intents', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'VET_CLINIC' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(expect.arrayContaining(['vet.vaccinationsDue', 'vet.vaccinationCompliance', 'vet.caseTypeVolume']))
  })

  it('sums each case type across months and surfaces the leader', async () => {
    vi.mocked(reportService.generateVetCaseTypeVolumeReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalCases: 9, distinctCaseTypeCount: 2 },
      caseTypes: ['Consultation', 'Grooming'],
      byMonth: [{ month: 'Aug 2026', Consultation: 6, Grooming: 3 }],
    } as never)

    const result = await executeVerticalTemplate('vet.caseTypeVolume', {}, '₹')

    expect(result.headline).toBe('Consultation is your highest-volume case type this period (6 case(s))')
    expect(result.details).toEqual(['Consultation: 6', 'Grooming: 3'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no cases recorded', async () => {
    vi.mocked(reportService.generateVetCaseTypeVolumeReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-18',
      summary: { totalCases: 0, distinctCaseTypeCount: 0 },
      caseTypes: [], byMonth: [],
    } as never)

    const result = await executeVerticalTemplate('vet.caseTypeVolume', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Restaurant's Dish-Wise Contribution Margin report.
describe('ai-vertical-templates.service — restaurant.dishContributionMargin', () => {
  it('registers restaurant.dishContributionMargin for RESTAURANT', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RESTAURANT' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('restaurant.dishContributionMargin')
  })

  it('reports the best-margin dish and the top 3 rows in details', async () => {
    vi.mocked(reportService.generateDishContributionMarginReport).mockResolvedValue({
      rows: [
        { productId: 'd1', productName: 'Butter Chicken', quantitySold: 10, revenue: 4000, ingredientCost: 1000, contributionMargin: 3000, marginPercent: 75 },
        { productId: 'd2', productName: 'Dal Makhani', quantitySold: 8, revenue: 2000, ingredientCost: 500, contributionMargin: 1500, marginPercent: 75 },
      ],
    } as never)

    const result = await executeVerticalTemplate('restaurant.dishContributionMargin', {}, '₹')

    expect(result.headline).toBe('Best margin: Butter Chicken at ₹3,000.00')
    expect(result.details).toEqual(['Butter Chicken: ₹3,000.00 (75%)', 'Dal Makhani: ₹1,500.00 (75%)'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no dishes sold', async () => {
    vi.mocked(reportService.generateDishContributionMarginReport).mockResolvedValue({ rows: [] } as never)

    const result = await executeVerticalTemplate('restaurant.dishContributionMargin', {}, '₹')

    expect(result.headline).toBe('No dishes sold this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Restaurant's Table Turnover by Hour report.
describe('ai-vertical-templates.service — restaurant.tableTurnoverByHour', () => {
  it('registers restaurant.tableTurnoverByHour for RESTAURANT', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RESTAURANT' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('restaurant.tableTurnoverByHour')
  })

  it('reports the busiest day/hour and total turns', async () => {
    vi.mocked(reportService.generateTableTurnoverByHourReport).mockResolvedValue({
      cells: [], summary: { totalTurns: 42, peakDayOfWeek: 6, peakHour: 20, peakCount: 9 },
    } as never)

    const result = await executeVerticalTemplate('restaurant.tableTurnoverByHour', {}, '₹')

    expect(result.headline).toBe('Busiest: Saturday at 20:00 (9 table turns)')
    expect(result.details).toEqual(['Total table turns this period: 42'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no table turns', async () => {
    vi.mocked(reportService.generateTableTurnoverByHourReport).mockResolvedValue({
      cells: [], summary: { totalTurns: 0, peakDayOfWeek: null, peakHour: null, peakCount: 0 },
    } as never)

    const result = await executeVerticalTemplate('restaurant.tableTurnoverByHour', {}, '₹')

    expect(result.headline).toBe('No dine-in table orders this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Restaurant's Recipe-vs-Actual Waste Variance report.
describe('ai-vertical-templates.service — restaurant.recipeWasteVariance', () => {
  it('registers restaurant.recipeWasteVariance for RESTAURANT', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RESTAURANT' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('restaurant.recipeWasteVariance')
  })

  it('reports the biggest overage ingredient and top rows in details', async () => {
    vi.mocked(reportService.generateRecipeWasteVarianceReport).mockResolvedValue({
      rows: [
        { ingredientProductId: 'i1', ingredientName: 'Ghee', unit: 'KG', impliedQuantity: 6, actualQuantity: 10, varianceQuantity: 4, variancePercent: 66.7 },
        { ingredientProductId: 'i2', ingredientName: 'Rice', unit: 'KG', impliedQuantity: 20, actualQuantity: 19, varianceQuantity: -1, variancePercent: -5 },
      ],
    } as never)

    const result = await executeVerticalTemplate('restaurant.recipeWasteVariance', {}, '₹')

    expect(result.headline).toBe('Biggest overage: Ghee (+4 KG vs. recipe)')
    expect(result.details).toEqual(['Ghee: +4 KG vs. recipe', 'Rice: -1 KG vs. recipe'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no recipe-linked activity', async () => {
    vi.mocked(reportService.generateRecipeWasteVarianceReport).mockResolvedValue({ rows: [] } as never)

    const result = await executeVerticalTemplate('restaurant.recipeWasteVariance', {}, '₹')

    expect(result.headline).toBe('No recipe-linked ingredient activity this period')
    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Retail's Dead-Stock Clearance List report.
describe('ai-vertical-templates.service — retail.deadStockClearance', () => {
  it('registers retail.deadStockClearance for RETAIL', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RETAIL' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('retail.deadStockClearance')
  })

  it('reports total capital locked, item count, and the biggest single item', async () => {
    vi.mocked(reportService.generateDeadStockClearanceReport).mockResolvedValue({
      lookbackDays: 90,
      summary: { totalCapitalLocked: 15000, itemCount: 3 },
      rows: [{ productId: 'p1', productName: 'Old Sweater', sku: 'SW-1', unit: 'PCS', currentStock: 20, unitCost: 500, capitalLocked: 10000, lastSoldDate: null, daysSinceLastSale: null }],
    } as never)

    const result = await executeVerticalTemplate('retail.deadStockClearance', {}, '₹')

    expect(result.headline).toBe('₹15,000.00 locked in 3 dead-stock items (no sale in 90 days)')
    expect(result.details).toEqual(['Biggest: Old Sweater — ₹10,000.00'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no dead stock', async () => {
    vi.mocked(reportService.generateDeadStockClearanceReport).mockResolvedValue({
      lookbackDays: 90, summary: { totalCapitalLocked: 0, itemCount: 0 }, rows: [],
    } as never)

    const result = await executeVerticalTemplate('retail.deadStockClearance', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Retail's Category Sell-Through Rate report.
describe('ai-vertical-templates.service — retail.categorySellThrough', () => {
  it('registers retail.categorySellThrough for RETAIL alongside retail.deadStockClearance', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RETAIL' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('retail.categorySellThrough')
    expect(names).toContain('retail.deadStockClearance')
  })

  it('reports the leading category by sell-through rate this month, sorted highest first', async () => {
    vi.mocked(reportService.generateCategorySellThroughReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      rows: [
        { month: '2024-01', categoryId: 'cat-1', categoryName: 'Snacks', unitsSold: 10, currentStock: 30, sellThroughRate: 25 },
        { month: '2024-01', categoryId: 'cat-2', categoryName: 'Beverages', unitsSold: 40, currentStock: 10, sellThroughRate: 80 },
      ],
    } as never)

    const result = await executeVerticalTemplate('retail.categorySellThrough', {}, '₹')

    expect(result.headline).toBe('Beverages leads this month at 80% sell-through')
    expect(result.details).toEqual(['Beverages: 80% (40 sold, 10 in stock)', 'Snacks: 25% (10 sold, 30 in stock)'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when every category has zero sales and zero stock this month', async () => {
    vi.mocked(reportService.generateCategorySellThroughReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      rows: [{ month: '2024-01', categoryId: 'cat-1', categoryName: 'Snacks', unitsSold: 0, currentStock: 0, sellThroughRate: 0 }],
    } as never)

    const result = await executeVerticalTemplate('retail.categorySellThrough', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No category sales this month yet')
  })
})

// Phase 67 §9.1 — Clothing: Season/Collection Sell-Through Report.
describe('ai-vertical-templates.service — clothing.seasonSellThrough', () => {
  it('registers clothing.seasonSellThrough for CLOTHING and FOOTWEAR alongside retail.variantStock', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } } as never)
    const clothingNames = await getActiveVerticalTemplateNames()
    expect(clothingNames).toContain('clothing.seasonSellThrough')
    expect(clothingNames).toContain('retail.variantStock')
    expect(clothingNames).toContain('clothing.sizeCurveReorderSuggestion')
    expect(clothingNames).toContain('clothing.sizeStyleHeatmap')

    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } } as never)
    const footwearNames = await getActiveVerticalTemplateNames()
    expect(footwearNames).toContain('clothing.seasonSellThrough')
  })

  it('reports the leading season/collection by sell-through rate this month, sorted highest first', async () => {
    vi.mocked(reportService.generateSeasonSellThroughReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      rows: [
        { month: '2024-01', season: 'Winter 2025', unitsSold: 10, currentStock: 30, sellThroughRate: 25 },
        { month: '2024-01', season: 'Summer 2026', unitsSold: 40, currentStock: 10, sellThroughRate: 80 },
      ],
    } as never)

    const result = await executeVerticalTemplate('clothing.seasonSellThrough', {}, '₹')

    expect(result.headline).toBe('Summer 2026 leads this month at 80% sell-through')
    expect(result.details).toEqual(['Summer 2026: 80% (40 sold, 10 in stock)', 'Winter 2025: 25% (10 sold, 30 in stock)'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when every season has zero sales and zero stock this month', async () => {
    vi.mocked(reportService.generateSeasonSellThroughReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      rows: [{ month: '2024-01', season: 'Summer 2026', unitsSold: 0, currentStock: 0, sellThroughRate: 0 }],
    } as never)

    const result = await executeVerticalTemplate('clothing.seasonSellThrough', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No season/collection sales this month yet')
  })
})

// Phase 67 §9.1 — Clothing: size-curve reorder suggestion.
describe('ai-vertical-templates.service — clothing.sizeCurveReorderSuggestion', () => {
  it('reports the suggested split for the product named in the question', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Cotton T-Shirt' }) }
    } as never)
    vi.mocked(getSizeCurveReorderSuggestion).mockResolvedValue({
      success: true,
      data: {
        productId: 'prod-1', totalReorderQty: 40, lookbackDays: 90,
        rows: [
          { variantId: 'var-m', size: 'M', color: null, unitsSoldRecently: 30, suggestedQuantity: 30 },
          { variantId: 'var-l', size: 'L', color: null, unitsSoldRecently: 10, suggestedQuantity: 10 },
        ]
      }
    } as never)

    const result = await executeVerticalTemplate('clothing.sizeCurveReorderSuggestion', { searchTerm: 'Cotton T-Shirt' }, '₹')

    expect(result.headline).toBe('Suggested reorder split for Cotton T-Shirt: 40 units across 2 variants')
    expect(result.details[0]).toContain('M')
    expect(result.details[0]).toContain('30 units')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no search term was extracted', async () => {
    const result = await executeVerticalTemplate('clothing.sizeCurveReorderSuggestion', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(getSizeCurveReorderSuggestion).not.toHaveBeenCalled()
  })

  it('marks isEmpty true when no product matches the search term', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      product: { findFirst: vi.fn().mockResolvedValue(null) }
    } as never)

    const result = await executeVerticalTemplate('clothing.sizeCurveReorderSuggestion', { searchTerm: 'Nonexistent' }, '₹')

    expect(result.isEmpty).toBe(true)
  })

  it('marks isEmpty true when the matched product has no configured reorder quantity', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Cotton T-Shirt' }) }
    } as never)
    vi.mocked(getSizeCurveReorderSuggestion).mockResolvedValue({ success: false, error: { code: 'VAR-012', message: 'Enter a reorder quantity.' } } as never)

    const result = await executeVerticalTemplate('clothing.sizeCurveReorderSuggestion', { searchTerm: 'Cotton T-Shirt' }, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Clothing: Size × Style Heatmap.
describe('ai-vertical-templates.service — clothing.sizeStyleHeatmap', () => {
  it('reports the top-moving style/size combination this month', async () => {
    vi.mocked(reportService.generateSizeStyleHeatmapReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      styles: ['Cotton T-Shirt'], sizes: ['M', 'L'],
      cells: [
        { style: 'Cotton T-Shirt', size: 'M', unitsSold: 10 },
        { style: 'Cotton T-Shirt', size: 'L', unitsSold: 25 },
      ],
      summary: { totalUnitsSold: 35, topCellStyle: 'Cotton T-Shirt', topCellSize: 'L', topCellUnitsSold: 25 }
    } as never)

    const result = await executeVerticalTemplate('clothing.sizeStyleHeatmap', {}, '₹')

    expect(result.headline).toBe('Cotton T-Shirt / L is your top-moving combination this month, 25 units')
    expect(result.details[0]).toContain('Cotton T-Shirt / L')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when there are no variant-tracked cells this month', async () => {
    vi.mocked(reportService.generateSizeStyleHeatmapReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      styles: [], sizes: [], cells: [],
      summary: { totalUnitsSold: 0, topCellStyle: null, topCellSize: null, topCellUnitsSold: 0 }
    } as never)

    const result = await executeVerticalTemplate('clothing.sizeStyleHeatmap', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Clothing item 4: size/color exchange workflow.
describe('ai-vertical-templates.service — clothing.exchangeSummary', () => {
  it('registers clothing.exchangeSummary for CLOTHING and FOOTWEAR alongside the other Clothing intents', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } } as never)
    const clothingNames = await getActiveVerticalTemplateNames()
    expect(clothingNames).toContain('clothing.exchangeSummary')
    expect(clothingNames).toContain('clothing.sizeStyleHeatmap')

    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } } as never)
    const footwearNames = await getActiveVerticalTemplateNames()
    expect(footwearNames).toContain('clothing.exchangeSummary')
  })

  it('counts only exchange-linked invoices (exchangeReturnId set), not plain returns', async () => {
    const findMany = vi.fn().mockResolvedValue([{ totalAmount: 650 }, { totalAmount: 400 }])
    vi.mocked(getPrisma).mockReturnValue({ invoice: { findMany } } as never)

    const result = await executeVerticalTemplate('clothing.exchangeSummary', {}, '₹')

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ exchangeReturnId: { not: null } })
    }))
    expect(result.headline).toBe('2 size/colour exchanges processed this month, replacement items totaling ₹1,050.00')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and uses singular phrasing for exactly one exchange', async () => {
    vi.mocked(getPrisma).mockReturnValue({ invoice: { findMany: vi.fn().mockResolvedValue([{ totalAmount: 500 }]) } } as never)
    const one = await executeVerticalTemplate('clothing.exchangeSummary', {}, '₹')
    expect(one.headline).toContain('1 size/colour exchange ')
    expect(one.isEmpty).toBe(false)

    vi.mocked(getPrisma).mockReturnValue({ invoice: { findMany: vi.fn().mockResolvedValue([]) } } as never)
    const none = await executeVerticalTemplate('clothing.exchangeSummary', {}, '₹')
    expect(none.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Clothing item 5: Margin by Brand/Vendor Report, its 5th
// and final signature item.
describe('ai-vertical-templates.service — clothing.vendorMargin', () => {
  it('registers clothing.vendorMargin for CLOTHING alongside the other Clothing intents', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CLOTHING' } } as never)
    const clothingNames = await getActiveVerticalTemplateNames()
    expect(clothingNames).toContain('clothing.vendorMargin')
    expect(clothingNames).toContain('clothing.exchangeSummary')
  })

  // Phase 67 §9.1 — Footwear grounding (fetched fresh from the source
  // audit) confirmed Footwear does NOT share Clothing's item 5 — it has
  // its own distinct item 2 (footwear.brandMarginReturnRate) instead, even
  // though it shares Clothing's other 4 variant-tracking intents.
  it('does NOT register clothing.vendorMargin for FOOTWEAR — Footwear has its own distinct item 2 instead', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } } as never)
    const footwearNames = await getActiveVerticalTemplateNames()
    expect(footwearNames).not.toContain('clothing.vendorMargin')
    expect(footwearNames).toContain('footwear.brandMarginReturnRate')
    expect(footwearNames).toContain('clothing.exchangeSummary')
  })

  it('reports the leading vendor by margin this month, sorted highest first', async () => {
    vi.mocked(reportService.generateVendorMarginReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      rows: [
        { supplierId: 's2', supplierName: 'Bright Threads', revenue: 900, cogs: 100, margin: 800, marginPercent: 89 },
        { supplierId: 's1', supplierName: 'Acme Apparel', revenue: 500, cogs: 300, margin: 200, marginPercent: 40 },
      ],
      summary: { totalRevenue: 1400, totalCogs: 400, totalMargin: 1000, vendorCount: 2 }
    } as never)

    const result = await executeVerticalTemplate('clothing.vendorMargin', {}, '₹')

    expect(result.headline).toBe('Bright Threads leads with ₹800.00 margin this month (89%)')
    expect(result.details).toEqual(['Bright Threads: ₹800.00 margin (89%)', 'Acme Apparel: ₹200.00 margin (40%)'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no vendor-assigned products sold this month', async () => {
    vi.mocked(reportService.generateVendorMarginReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31', rows: [],
      summary: { totalRevenue: 0, totalCogs: 0, totalMargin: 0, vendorCount: 0 }
    } as never)

    const result = await executeVerticalTemplate('clothing.vendorMargin', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No sales this month for products with an assigned vendor/brand')
  })
})

// Phase 67 §9.1 — Footwear item 2: Brand-Wise Margin & Return-Rate Report.
describe('ai-vertical-templates.service — footwear.brandMarginReturnRate', () => {
  it('registers footwear.brandMarginReturnRate for FOOTWEAR only, not clothing.vendorMargin', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('footwear.brandMarginReturnRate')
    expect(names).not.toContain('clothing.vendorMargin')
  })

  it('reports the leading brand by margin this month, alongside its return rate', async () => {
    vi.mocked(reportService.generateBrandMarginReturnRateReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      rows: [
        { supplierId: 's1', supplierName: 'Acme Footwear', revenue: 5000, cogs: 3000, margin: 2000, marginPercent: 40, unitsSold: 20, unitsReturned: 5, returnRatePercent: 25 },
        { supplierId: 's2', supplierName: 'Bright Soles', revenue: 900, cogs: 100, margin: 800, marginPercent: 89, unitsSold: 10, unitsReturned: 1, returnRatePercent: 10 },
      ],
      summary: { totalRevenue: 5900, totalMargin: 2800, overallReturnRatePercent: 20, vendorCount: 2 }
    } as never)

    const result = await executeVerticalTemplate('footwear.brandMarginReturnRate', {}, '₹')

    expect(result.headline).toBe('Acme Footwear leads with ₹2,000.00 margin this month, 25% return rate')
    expect(result.details).toEqual([
      'Acme Footwear: ₹2,000.00 margin, 25% returned (5/20 units)',
      'Bright Soles: ₹800.00 margin, 10% returned (1/10 units)',
    ])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no vendor-assigned products sold this month', async () => {
    vi.mocked(reportService.generateBrandMarginReturnRateReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31', rows: [],
      summary: { totalRevenue: 0, totalMargin: 0, overallReturnRatePercent: 0, vendorCount: 0 }
    } as never)

    const result = await executeVerticalTemplate('footwear.brandMarginReturnRate', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No sales this month for products with an assigned vendor/brand')
  })
})

// Phase 67 §9.1 — Footwear item 3: trial-pair counter workflow.
describe('ai-vertical-templates.service — footwear.trialConversionRate', () => {
  it('registers footwear.trialConversionRate for FOOTWEAR', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('footwear.trialConversionRate')
  })

  it('reports the conversion rate and averages when sessions exist', async () => {
    vi.mocked(getTrialConversionSummary).mockResolvedValue({
      success: true,
      data: { totalSessions: 10, convertedSessions: 6, conversionRatePercent: 60, avgPairsTriedPerSession: 2.5, avgPairsTriedPerConversion: 2.1 }
    } as never)

    const result = await executeVerticalTemplate('footwear.trialConversionRate', {}, '₹')

    expect(result.headline).toBe('60% of trial sessions converted to a sale, out of 10 recorded')
    expect(result.details).toEqual([
      'Converted: 6 / 10',
      'Average pairs tried per session: 2.5',
      'Average pairs tried before a purchase: 2.1'
    ])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no trial sessions exist', async () => {
    vi.mocked(getTrialConversionSummary).mockResolvedValue({
      success: true,
      data: { totalSessions: 0, convertedSessions: 0, conversionRatePercent: 0, avgPairsTriedPerSession: 0, avgPairsTriedPerConversion: 0 }
    } as never)

    const result = await executeVerticalTemplate('footwear.trialConversionRate', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No trial sessions recorded yet')
  })
})

// Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap.
describe('ai-vertical-templates.service — footwear.sizeAvailabilityHeatmap', () => {
  it('registers footwear.sizeAvailabilityHeatmap for FOOTWEAR', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('footwear.sizeAvailabilityHeatmap')
  })

  it('leads with the style with the most out-of-stock sizes, listing its own out-of-stock cells', async () => {
    vi.mocked(reportService.generateSizeAvailabilityHeatmapReport).mockResolvedValue({
      lowStockThreshold: 3,
      styles: ['Trail Runner'], sizes: ['8', '9'],
      cells: [
        { style: 'Trail Runner', size: '8', stockQty: 0, status: 'OUT' },
        { style: 'Trail Runner', size: '9', stockQty: 2, status: 'LOW' },
      ],
      summary: { totalStyles: 1, outOfStockCells: 1, lowStockCells: 1, styleWithMostGaps: 'Trail Runner', styleGapCount: 1 }
    } as never)

    const result = await executeVerticalTemplate('footwear.sizeAvailabilityHeatmap', {}, '₹')

    expect(result.headline).toBe('Trail Runner has the most sizes out of stock, 1 sizes')
    expect(result.details).toEqual(['Trail Runner / 8: out of stock'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when nothing is out or low', async () => {
    vi.mocked(reportService.generateSizeAvailabilityHeatmapReport).mockResolvedValue({
      lowStockThreshold: 3,
      styles: ['Trail Runner'], sizes: ['8'],
      cells: [{ style: 'Trail Runner', size: '8', stockQty: 50, status: 'IN' }],
      summary: { totalStyles: 1, outOfStockCells: 0, lowStockCells: 0, styleWithMostGaps: null, styleGapCount: 0 }
    } as never)

    const result = await executeVerticalTemplate('footwear.sizeAvailabilityHeatmap', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No sizes are currently out of stock')
  })

  it('marks isEmpty true with an honest empty headline when there is no variant-tracked stock at all', async () => {
    vi.mocked(reportService.generateSizeAvailabilityHeatmapReport).mockResolvedValue({
      lowStockThreshold: 3, styles: [], sizes: [], cells: [],
      summary: { totalStyles: 0, outOfStockCells: 0, lowStockCells: 0, styleWithMostGaps: null, styleGapCount: 0 }
    } as never)

    const result = await executeVerticalTemplate('footwear.sizeAvailabilityHeatmap', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar.
describe('ai-vertical-templates.service — footwear.seasonalReorderStatus', () => {
  it('registers footwear.seasonalReorderStatus for FOOTWEAR', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'FOOTWEAR' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('footwear.seasonalReorderStatus')
  })

  it('leads with the season(s) needing reorder now when any exist', async () => {
    vi.mocked(getSeasonalReorderCalendar).mockResolvedValue({
      success: true,
      data: [
        { id: 'c1', name: 'Monsoon', startMonth: 6, startDay: 1, endMonth: 9, endDay: 30, leadTimeDays: 30, status: 'REORDER_NOW', daysUntilStart: 10, reorderByDate: '2026-05-02', nextStartDate: '2026-06-01', products: [{ productId: 'p1', productName: 'Rain Boot', stockQty: 2, lowOrOutOfStock: true }], lowOrOutOfStockCount: 1 },
        { id: 'c2', name: 'Sports', startMonth: 3, startDay: 1, endMonth: 5, endDay: 31, leadTimeDays: 20, status: 'IN_SEASON', daysUntilStart: 0, reorderByDate: '2026-02-09', nextStartDate: '2026-03-01', products: [], lowOrOutOfStockCount: 0 },
      ]
    } as never)

    const result = await executeVerticalTemplate('footwear.seasonalReorderStatus', {}, '₹')

    expect(result.headline).toBe('Monsoon — reorder now, 1 products low or out of stock')
    expect(result.details).toEqual(['Monsoon: starts 2026-06-01, 1/1 tagged products low/out of stock'])
    expect(result.isEmpty).toBe(false)
  })

  it('gives an honest headline listing upcoming/in-season cycles when nothing needs reordering yet', async () => {
    vi.mocked(getSeasonalReorderCalendar).mockResolvedValue({
      success: true,
      data: [{ id: 'c1', name: 'Winter', startMonth: 12, startDay: 1, endMonth: 12, endDay: 31, leadTimeDays: 10, status: 'UPCOMING', daysUntilStart: 60, reorderByDate: '2026-11-21', nextStartDate: '2026-12-01', products: [], lowOrOutOfStockCount: 0 }]
    } as never)

    const result = await executeVerticalTemplate('footwear.seasonalReorderStatus', {}, '₹')

    expect(result.headline).toBe('No seasons need reordering right now')
    expect(result.details).toEqual(['Winter: starts in 60 days'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no seasonal cycles are defined at all', async () => {
    vi.mocked(getSeasonalReorderCalendar).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('footwear.seasonalReorderStatus', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No seasons need reordering right now')
  })
})

// Phase 67 §9.1 — Retail's simple loyalty punch-card.
describe('ai-vertical-templates.service — retail.loyaltyProgress', () => {
  it('registers retail.loyaltyProgress for RETAIL alongside the other two Retail intents', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RETAIL' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('retail.loyaltyProgress')
    expect(names).toContain('retail.deadStockClearance')
    expect(names).toContain('retail.categorySellThrough')
  })

  it('reports how many customers are ready to redeem and rewards redeemed this month', async () => {
    vi.mocked(loyaltyProgramService.getSummary).mockResolvedValue({
      success: true, data: { configured: true, isActive: true, totalCards: 12, readyForRewardCount: 3, rewardsRedeemedThisMonth: 2 }
    } as never)

    const result = await executeVerticalTemplate('retail.loyaltyProgress', {}, '₹')

    expect(result.headline).toBe('3 customers ready to redeem, 12 total loyalty cards')
    expect(result.details).toEqual(['Rewards redeemed this month: 2', 'Program active'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and gives an honest headline when no program is configured', async () => {
    vi.mocked(loyaltyProgramService.getSummary).mockResolvedValue({ success: true, data: { configured: false } } as never)

    const result = await executeVerticalTemplate('retail.loyaltyProgress', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No loyalty program is configured yet')
  })
})

// Phase 67 §9.1 — Retail's Basket Composition report.
describe('ai-vertical-templates.service — retail.basketComposition', () => {
  it('registers retail.basketComposition for RETAIL alongside the other three Retail intents', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RETAIL' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toContain('retail.basketComposition')
    expect(names).toContain('retail.deadStockClearance')
    expect(names).toContain('retail.categorySellThrough')
    expect(names).toContain('retail.loyaltyProgress')
  })

  it('reports the top product pairing this month', async () => {
    vi.mocked(reportService.generateBasketCompositionReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      summary: { totalBaskets: 40, avgItemsPerBasket: 2.1, avgBasketValue: 500 },
      rows: [
        { productAId: 'p1', productAName: 'Bread', productBId: 'p2', productBName: 'Butter', basketCount: 12 },
        { productAId: 'p3', productAName: 'Milk', productBId: 'p4', productBName: 'Cereal', basketCount: 8 },
      ],
    } as never)

    const result = await executeVerticalTemplate('retail.basketComposition', {}, '₹')

    expect(result.headline).toBe('Bread + Butter bought together in 12 baskets this month')
    expect(result.details).toEqual(['Bread + Butter: 12 baskets', 'Milk + Cereal: 8 baskets'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no repeated pairings exist this month', async () => {
    vi.mocked(reportService.generateBasketCompositionReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      summary: { totalBaskets: 5, avgItemsPerBasket: 1, avgBasketValue: 200 }, rows: [],
    } as never)

    const result = await executeVerticalTemplate('retail.basketComposition', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No repeated product pairings found this month')
  })
})

// Phase 67 §9.1 — Hardware's Fast-Mover vs. Slow-Mover Matrix.
describe('ai-vertical-templates.service — hardware.fastSlowMoverMatrix', () => {
  it('registers hardware.fastSlowMoverMatrix for HARDWARE', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'HARDWARE' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(['hardware.fastSlowMoverMatrix'])
  })

  it('reports the fastest mover and counts slow/low-margin laggards', async () => {
    vi.mocked(reportService.generateFastSlowMoverMatrixReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31', days: 31,
      velocityMedian: 2, marginMedian: 30,
      rows: [
        { productId: 'p1', productName: 'Hammer', sku: 'HM-1', quantitySold: 90, velocity: 3, sellingPrice: 100, unitCost: 40, marginPercent: 60, quadrant: 'FAST_HIGH_MARGIN' },
        { productId: 'p2', productName: 'Nails', sku: 'NL-1', quantitySold: 20, velocity: 0.6, sellingPrice: 50, unitCost: 45, marginPercent: 10, quadrant: 'SLOW_LOW_MARGIN' },
        { productId: 'p3', productName: 'Screws', sku: 'SC-1', quantitySold: 15, velocity: 0.5, sellingPrice: 50, unitCost: 46, marginPercent: 8, quadrant: 'SLOW_LOW_MARGIN' },
      ],
    } as never)

    const result = await executeVerticalTemplate('hardware.fastSlowMoverMatrix', {}, '₹')

    expect(result.headline).toBe('Hammer is your fastest mover at 3/day (60% margin)')
    expect(result.details[0]).toBe('2 products are slow-moving with low margin — worth reviewing for discontinuation')
    expect(result.details[1]).toBe('Median velocity: 2/day, median margin: 30%')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true and reports no slow/low-margin products when none sold this month', async () => {
    vi.mocked(reportService.generateFastSlowMoverMatrixReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31', days: 31,
      velocityMedian: 0, marginMedian: 0, rows: [],
    } as never)

    const result = await executeVerticalTemplate('hardware.fastSlowMoverMatrix', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No products sold this month yet')
  })
})

// Phase 67 §9.1 — General's "Which template fits you?" wizard.
describe('ai-vertical-templates.service — general.templateSuggestion', () => {
  it('registers all five GENERAL vertical intents in order', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'GENERAL' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(['general.templateSuggestion', 'general.customDocumentSummary', 'general.categoryMix', 'general.cashPositionTrend', 'general.quotePipelineSummary'])
  })

  it('reports the suggested template with its matched signal count', async () => {
    vi.mocked(getTemplateSuggestion).mockResolvedValue({
      success: true, data: { businessType: 'HARDWARE', matchedCount: 5, signalKey: 'cartonProducts' }
    } as never)

    const result = await executeVerticalTemplate('general.templateSuggestion', {}, '₹')

    expect(result.headline).toBe('Your activity looks like a HARDWARE business (5 matching records) — worth checking Settings → Industry')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no suggestion exists yet', async () => {
    vi.mocked(getTemplateSuggestion).mockResolvedValue({ success: true, data: null } as never)

    const result = await executeVerticalTemplate('general.templateSuggestion', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No specific business template stands out from your activity yet')
  })

  it('marks isEmpty true when the underlying computation fails', async () => {
    vi.mocked(getTemplateSuggestion).mockResolvedValue({ success: false, error: { code: 'SYS-001', message: 'db down' } } as never)

    const result = await executeVerticalTemplate('general.templateSuggestion', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — General's Category Mix report.
describe('ai-vertical-templates.service — general.categoryMix', () => {
  it('reports the top revenue category with its share this month', async () => {
    vi.mocked(reportService.generateCategoryMixReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      summary: { totalRevenue: 10000, categoryCount: 3 },
      rows: [
        { categoryId: 'c1', categoryName: 'Beverages', unitsSold: 50, revenue: 6000, revenuePercent: 60 },
        { categoryId: 'c2', categoryName: 'Snacks', unitsSold: 30, revenue: 3000, revenuePercent: 30 },
        { categoryId: 'c3', categoryName: 'Other', unitsSold: 10, revenue: 1000, revenuePercent: 10 },
      ],
    } as never)

    const result = await executeVerticalTemplate('general.categoryMix', {}, '₹')

    expect(result.headline).toBe('Beverages leads with 60% of revenue this month (3 categories total)')
    expect(result.details).toEqual(['Beverages: 60% of revenue', 'Snacks: 30% of revenue', 'Other: 10% of revenue'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no categorized product sales exist this month', async () => {
    vi.mocked(reportService.generateCategoryMixReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      summary: { totalRevenue: 0, categoryCount: 0 }, rows: [],
    } as never)

    const result = await executeVerticalTemplate('general.categoryMix', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No categorized product sales this month')
  })
})

// Phase 67 §9.1 — General's Combined Cash Position Trend.
describe('ai-vertical-templates.service — general.cashPositionTrend', () => {
  it('reports the net change and opening/closing balance for this month', async () => {
    vi.mocked(reportService.generateCashPositionTrendReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      points: [{ date: '2024-01-01', balance: 1000 }, { date: '2024-01-31', balance: 1500 }],
      openingBalance: 1000, closingBalance: 1500, netChange: 500,
    } as never)

    const result = await executeVerticalTemplate('general.cashPositionTrend', {}, '₹')

    expect(result.headline).toContain('grew')
    expect(result.headline).toContain('₹1,000.00')
    expect(result.headline).toContain('₹1,500.00')
    expect(result.isEmpty).toBe(false)
  })

  it('reports a fall when netChange is negative', async () => {
    vi.mocked(reportService.generateCashPositionTrendReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      points: [{ date: '2024-01-01', balance: 1000 }], openingBalance: 1000, closingBalance: 700, netChange: -300,
    } as never)

    const result = await executeVerticalTemplate('general.cashPositionTrend', {}, '₹')

    expect(result.headline).toContain('fell')
  })

  it('marks isEmpty true when there is no cash movement recorded this month', async () => {
    vi.mocked(reportService.generateCashPositionTrendReport).mockResolvedValue({
      dateFrom: '2024-01-01', dateTo: '2024-01-31',
      points: [], openingBalance: 0, closingBalance: 0, netChange: 0,
    } as never)

    const result = await executeVerticalTemplate('general.cashPositionTrend', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No cash movement recorded this month')
  })
})

// Phase 67 §9.1 — General's Universal Quote -> Order -> Invoice pipeline.
describe('ai-vertical-templates.service — general.quotePipelineSummary', () => {
  it('breaks down this month\'s quotations by conversion path', async () => {
    const db = { quotation: { findMany: vi.fn().mockResolvedValue([
      { invoice: { id: 'inv-1' }, salesOrder: null },
      { invoice: { id: 'inv-2' }, salesOrder: null },
      { invoice: null, salesOrder: { id: 'so-1' } },
      { invoice: null, salesOrder: null },
      { invoice: null, salesOrder: null },
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await executeVerticalTemplate('general.quotePipelineSummary', {}, '₹')

    expect(result.headline).toBe('5 quotations this month — 2 billed directly, 1 moved to a Sales Order, 2 still pending')
    expect(result.details).toEqual(['Direct to invoice: 2', 'Via Sales Order: 1', 'Pending: 2'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no quotations were created this month', async () => {
    const db = { quotation: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await executeVerticalTemplate('general.quotePipelineSummary', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No quotations created this month')
  })

  it('uses singular phrasing for exactly one quotation', async () => {
    const db = { quotation: { findMany: vi.fn().mockResolvedValue([{ invoice: null, salesOrder: null }]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await executeVerticalTemplate('general.quotePipelineSummary', {}, '₹')

    expect(result.headline).toContain('1 quotation ')
    expect(result.headline).not.toContain('1 quotations')
  })
})

// Phase 67 §9.1 — Electronics: RMA SLA tracker.
describe('ai-vertical-templates.service — electronics.rmaOverdueSummary', () => {
  it('registers electronics.rmaOverdueSummary alongside the pre-existing electronics.serialWarranty for ELECTRONICS', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'ELECTRONICS' } } as never)

    const names = await getActiveVerticalTemplateNames()

    expect(names).toEqual(['electronics.serialWarranty', 'electronics.rmaOverdueSummary', 'electronics.vendorRecovery', 'electronics.repairTurnaround', 'electronics.serialServiceLookup'])
  })

  it('reports the count and top overdue units', async () => {
    const db = {
      repairTicket: {
        findMany: vi.fn().mockResolvedValue([
          { claimNumber: 'RMA-00001', product: { productName: 'Galaxy S24' }, sentToVendorDate: new Date('2026-01-01T00:00:00Z') },
          { claimNumber: 'RMA-00002', product: { productName: 'iPhone 15' }, sentToVendorDate: new Date('2026-01-05T00:00:00Z') },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await executeVerticalTemplate('electronics.rmaOverdueSummary', {}, '₹')

    expect(result.headline).toBe('2 units are overdue from vendor RMA (past the 30-day SLA)')
    expect(result.details[0]).toContain('RMA-00001')
    expect(result.details[0]).toContain('Galaxy S24')
    expect(result.isEmpty).toBe(false)
  })

  it('uses singular phrasing for exactly one overdue unit', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([
      { claimNumber: 'RMA-00001', product: { productName: 'Galaxy S24' }, sentToVendorDate: new Date() }
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await executeVerticalTemplate('electronics.rmaOverdueSummary', {}, '₹')

    expect(result.headline).toContain('1 unit is overdue')
  })

  it('marks isEmpty true when nothing is overdue', async () => {
    const db = { repairTicket: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await executeVerticalTemplate('electronics.rmaOverdueSummary', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No RMA units are currently overdue')
  })

  it('queries with the same SENT_TO_VENDOR/AWAITING_PARTS + past-vendorSlaDueDate definition the ticket screen and dashboard alert both use', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = { repairTicket: { findMany } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await executeVerticalTemplate('electronics.rmaOverdueSummary', {}, '₹')

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['SENT_TO_VENDOR', 'AWAITING_PARTS'] }, vendorSlaDueDate: { lt: expect.any(Date) } }
    }))
  })
})

// Phase 67 §9.1 — Electronics: vendor warranty-claim recovery ledger.
describe('ai-vertical-templates.service — electronics.vendorRecovery', () => {
  it('reports total outstanding and top open claims', async () => {
    vi.mocked(reportService.generateVendorRecoveryLedgerReport).mockResolvedValue({
      generatedAt: '2026-08-01T00:00:00Z',
      rows: [
        { claimNumber: 'RMA-00001', productName: 'Galaxy S24', vendorName: 'ABC Distributors', claimedAmount: 1000, recoveredAmount: 200, outstandingAmount: 800, isClosed: false, closedAt: null },
        { claimNumber: 'RMA-00002', productName: 'iPhone 15', vendorName: null, claimedAmount: 500, recoveredAmount: 500, outstandingAmount: 0, isClosed: true, closedAt: '2026-08-01T00:00:00Z' },
      ],
      summary: { totalClaimed: 1500, totalRecovered: 700, totalOutstanding: 800, openCount: 1, closedCount: 1 }
    } as never)

    const result = await executeVerticalTemplate('electronics.vendorRecovery', {}, '₹')

    expect(result.headline).toBe('₹800 outstanding across 1 open vendor claim')
    expect(result.details[0]).toContain('RMA-00001')
    expect(result.details[0]).toContain('800')
    expect(result.isEmpty).toBe(false)
  })

  it('uses plural phrasing for more than one open claim', async () => {
    vi.mocked(reportService.generateVendorRecoveryLedgerReport).mockResolvedValue({
      generatedAt: '2026-08-01T00:00:00Z',
      rows: [
        { claimNumber: 'RMA-1', productName: 'A', vendorName: null, claimedAmount: 100, recoveredAmount: 0, outstandingAmount: 100, isClosed: false, closedAt: null },
        { claimNumber: 'RMA-2', productName: 'B', vendorName: null, claimedAmount: 200, recoveredAmount: 0, outstandingAmount: 200, isClosed: false, closedAt: null },
      ],
      summary: { totalClaimed: 300, totalRecovered: 0, totalOutstanding: 300, openCount: 2, closedCount: 0 }
    } as never)

    const result = await executeVerticalTemplate('electronics.vendorRecovery', {}, '₹')

    expect(result.headline).toContain('2 open vendor claims')
  })

  it('marks isEmpty true and reports no open claims when nothing has ever been claimed', async () => {
    vi.mocked(reportService.generateVendorRecoveryLedgerReport).mockResolvedValue({
      generatedAt: '2026-08-01T00:00:00Z', rows: [],
      summary: { totalClaimed: 0, totalRecovered: 0, totalOutstanding: 0, openCount: 0, closedCount: 0 }
    } as never)

    const result = await executeVerticalTemplate('electronics.vendorRecovery', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No open vendor warranty claims')
  })
})

// Phase 67 §9.1 — Electronics: repair turnaround by technician.
describe('ai-vertical-templates.service — electronics.repairTurnaround', () => {
  it('reports overall average turnaround and the fastest technician', async () => {
    vi.mocked(reportService.generateRepairTurnaroundByTechnicianReport).mockResolvedValue({
      generatedAt: '2026-08-20T00:00:00Z',
      rows: [
        { technicianId: 'tech-1', technicianName: 'Ravi Kumar', ticketCount: 3, avgTurnaroundDays: 2, minTurnaroundDays: 1, maxTurnaroundDays: 4 },
        { technicianId: 'tech-2', technicianName: 'Sana Sheikh', ticketCount: 2, avgTurnaroundDays: 5, minTurnaroundDays: 3, maxTurnaroundDays: 7 },
      ],
      summary: { technicianCount: 2, totalTicketsCompleted: 5, overallAvgTurnaroundDays: 3.2 }
    } as never)

    const result = await executeVerticalTemplate('electronics.repairTurnaround', {}, '₹')

    expect(result.headline).toBe('3.2 day avg. repair turnaround across 2 technicians')
    expect(result.details[0]).toContain('Ravi Kumar')
    expect(result.details[0]).toContain('2 day avg.')
    expect(result.isEmpty).toBe(false)
  })

  it('uses singular phrasing for exactly one technician', async () => {
    vi.mocked(reportService.generateRepairTurnaroundByTechnicianReport).mockResolvedValue({
      generatedAt: '2026-08-20T00:00:00Z',
      rows: [{ technicianId: 'tech-1', technicianName: 'Ravi Kumar', ticketCount: 3, avgTurnaroundDays: 2, minTurnaroundDays: 1, maxTurnaroundDays: 4 }],
      summary: { technicianCount: 1, totalTicketsCompleted: 3, overallAvgTurnaroundDays: 2 }
    } as never)

    const result = await executeVerticalTemplate('electronics.repairTurnaround', {}, '₹')

    expect(result.headline).toContain('1 technician')
    expect(result.headline).not.toContain('1 technicians')
  })

  it('marks isEmpty true when no completed ticket has a technician assigned', async () => {
    vi.mocked(reportService.generateRepairTurnaroundByTechnicianReport).mockResolvedValue({
      generatedAt: '2026-08-20T00:00:00Z', rows: [],
      summary: { technicianCount: 0, totalTicketsCompleted: 0, overallAvgTurnaroundDays: 0 }
    } as never)

    const result = await executeVerticalTemplate('electronics.repairTurnaround', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No completed repair tickets have a technician assigned yet')
    expect(result.details).toEqual([])
  })
})

// Phase 67 §9.1 — Electronics: serial-number service lookup.
describe('ai-vertical-templates.service — electronics.serialServiceLookup', () => {
  it('reports the ticket count and purchase info for a resolved serial', async () => {
    vi.mocked(lookupSerialService).mockResolvedValue({
      success: true,
      data: {
        serial: { id: 'ser-1', serialNumber: 'SN-001', imeiNumber: null, imei2Number: null, status: 'SOLD', warrantyExpiryDate: null, productId: 'prod-1', productName: 'Galaxy S24' },
        purchase: { invoiceId: 'inv-1', invoiceNumber: 'INV-00001', invoiceDate: '2026-06-01T00:00:00Z', customerName: 'Ramesh Kumar', customerPhone: '9990001111', unitPrice: 25000 },
        tickets: [{ id: 'rt-1', claimNumber: 'RMA-00001', status: 'RECEIVED', issueDescription: 'Screen cracked', receivedDate: '2026-07-01T00:00:00Z' } as never],
        replacedOnTicket: null
      }
    } as never)

    const result = await executeVerticalTemplate('electronics.serialServiceLookup', { searchTerm: 'SN-001' }, '₹')

    expect(result.headline).toBe('Galaxy S24 (SN-001) — 1 repair ticket on record')
    expect(result.details[0]).toContain('INV-00001')
    expect(result.details[0]).toContain('Ramesh Kumar')
    expect(result.details[1]).toContain('RMA-00001')
    expect(result.isEmpty).toBe(false)
  })

  it('reports "never sold" when the serial has no linked purchase', async () => {
    vi.mocked(lookupSerialService).mockResolvedValue({
      success: true,
      data: {
        serial: { id: 'ser-1', serialNumber: 'SN-001', imeiNumber: null, imei2Number: null, status: 'AVAILABLE', warrantyExpiryDate: null, productId: 'prod-1', productName: 'Galaxy S24' },
        purchase: null, tickets: [], replacedOnTicket: null
      }
    } as never)

    const result = await executeVerticalTemplate('electronics.serialServiceLookup', { searchTerm: 'SN-001' }, '₹')

    expect(result.details[0]).toBe('Never sold — still in stock')
  })

  it('marks isEmpty true when no search term was extracted from the question', async () => {
    const result = await executeVerticalTemplate('electronics.serialServiceLookup', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(lookupSerialService).not.toHaveBeenCalled()
  })

  it('marks isEmpty true when the search term matches no device', async () => {
    vi.mocked(lookupSerialService).mockResolvedValue({ success: false, error: { code: 'RPR-025', message: 'No device found.' } } as never)

    const result = await executeVerticalTemplate('electronics.serialServiceLookup', { searchTerm: 'NOPE' }, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — General's Custom Document Builder.
describe('ai-vertical-templates.service — general.customDocumentSummary', () => {
  it('sums entries across every active document type', async () => {
    vi.mocked(customDocumentService.listTypes).mockResolvedValue({
      success: true, data: [{ id: 'cdt-1', name: 'Visitor Register' }, { id: 'cdt-2', name: 'Complaint Log' }]
    } as never)
    vi.mocked(customDocumentService.listEntries).mockImplementation(async (id: string) =>
      ({ success: true, data: id === 'cdt-1' ? [{}, {}, {}] : [{}] } as never)
    )

    const result = await executeVerticalTemplate('general.customDocumentSummary', {}, '₹')

    expect(result.headline).toBe('4 entries logged across 2 custom document types')
    expect(result.details).toEqual(['Visitor Register: 3 entries', 'Complaint Log: 1 entries'])
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true when no document types have been set up yet', async () => {
    vi.mocked(customDocumentService.listTypes).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('general.customDocumentSummary', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No custom document types have been set up yet')
  })

  it('marks isEmpty true when total entries across all types is zero', async () => {
    vi.mocked(customDocumentService.listTypes).mockResolvedValue({ success: true, data: [{ id: 'cdt-1', name: 'Visitor Register' }] } as never)
    vi.mocked(customDocumentService.listEntries).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('general.customDocumentSummary', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished Unit.
describe('ai-vertical-templates.service — manufacturing.landedCostPerUnit', () => {
  it('registers manufacturing.landedCostPerUnit for MANUFACTURING', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('manufacturing.landedCostPerUnit')
  })

  it('leads with the highest-cost product and its material/labour/overhead breakdown', async () => {
    vi.mocked(reportService.generateLandedCostPerUnitReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ productId: 'p1', productName: 'Steel Bracket', producedQty: 100, materialCostPerUnit: 50, laborCostPerUnit: 20, overheadCostPerUnit: 5, totalCostPerUnit: 75 }],
      summary: { totalOrders: 1, totalProducedQty: 100 }
    } as never)

    const result = await executeVerticalTemplate('manufacturing.landedCostPerUnit', {}, '₹')

    expect(result.headline).toBe('Steel Bracket costs ₹75.00/unit this month (material ₹50.00, labour ₹20.00, overhead ₹5.00)')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no orders completed this month', async () => {
    vi.mocked(reportService.generateLandedCostPerUnitReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [], summary: { totalOrders: 0, totalProducedQty: 0 }
    } as never)

    const result = await executeVerticalTemplate('manufacturing.landedCostPerUnit', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No completed production orders this month yet')
  })
})

// Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend.
describe('ai-vertical-templates.service — manufacturing.rejectionRateTrend', () => {
  it('registers manufacturing.rejectionRateTrend for MANUFACTURING', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('manufacturing.rejectionRateTrend')
  })

  it('leads with the overall rate and names the worst stage', async () => {
    vi.mocked(reportService.generateRejectionRateTrendReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      trend: [{ month: '2026-07', qtyInspected: 200, qtyRejected: 20, rejectionRatePercent: 10 }],
      byStage: [{ taskName: 'Assembly', qtyInspected: 100, qtyRejected: 18, rejectionRatePercent: 18 }],
      summary: { totalInspected: 200, totalRejected: 20, overallRejectionRatePercent: 10 }
    } as never)

    const result = await executeVerticalTemplate('manufacturing.rejectionRateTrend', {}, '₹')

    expect(result.headline).toBe('10% overall rejection rate this month, worst at "Assembly" (18%)')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no inspection counts recorded this month', async () => {
    vi.mocked(reportService.generateRejectionRateTrendReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', trend: [], byStage: [],
      summary: { totalInspected: 0, totalRejected: 0, overallRejectionRatePercent: 0 }
    } as never)

    const result = await executeVerticalTemplate('manufacturing.rejectionRateTrend', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No QC inspection counts recorded this month yet')
  })
})

// Phase 67 §9.1 — Manufacturing item 1: machine/labour downtime capture.
describe('ai-vertical-templates.service — manufacturing.downtimeSummary', () => {
  it('registers manufacturing.downtimeSummary for MANUFACTURING', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('manufacturing.downtimeSummary')
  })

  it('leads with total downtime and the top reason', async () => {
    vi.mocked(getDowntimeSummary).mockResolvedValue({
      success: true,
      data: { totalMinutes: 105, byReason: [{ reason: 'Machine breakdown', minutes: 75 }, { reason: 'Material shortage', minutes: 30 }] }
    } as never)

    const result = await executeVerticalTemplate('manufacturing.downtimeSummary', {}, '₹')

    expect(result.headline).toBe('105 minutes of downtime logged, most from "Machine breakdown"')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no downtime has been logged', async () => {
    vi.mocked(getDowntimeSummary).mockResolvedValue({ success: true, data: { totalMinutes: 0, byReason: [] } } as never)

    const result = await executeVerticalTemplate('manufacturing.downtimeSummary', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No downtime logged yet')
  })
})

// Phase 67 §9.1 — Manufacturing item 5: work-order lead-time bottleneck flag.
describe('ai-vertical-templates.service — manufacturing.bottleneckFlag', () => {
  it('registers manufacturing.bottleneckFlag for MANUFACTURING', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'MANUFACTURING' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('manufacturing.bottleneckFlag')
  })

  it('names the bottleneck stage with its average duration and share of lead time', async () => {
    vi.mocked(getWorkOrderBottleneckFlag).mockResolvedValue({
      success: true,
      data: { bottleneckStage: 'Assembly', avgDurationHours: 4, shareOfTotalLeadTimePercent: 66.7, stages: [{ taskName: 'Assembly', avgDurationHours: 4, sampleCount: 5 }] }
    } as never)

    const result = await executeVerticalTemplate('manufacturing.bottleneckFlag', {}, '₹')

    expect(result.headline).toBe('"Assembly" is your slowest stage, averaging 4h (66.7% of total lead time)')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when there is not enough completed data yet', async () => {
    vi.mocked(getWorkOrderBottleneckFlag).mockResolvedValue({
      success: true, data: { bottleneckStage: null, avgDurationHours: 0, shareOfTotalLeadTimePercent: 0, stages: [] }
    } as never)

    const result = await executeVerticalTemplate('manufacturing.bottleneckFlag', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})

// Phase 67 §9.1 — Agri Inputs item 2: Seasonal Credit Exposure.
describe('ai-vertical-templates.service — agriInputs.seasonalCreditExposure', () => {
  it('registers agriInputs.seasonalCreditExposure for AGRI_INPUTS', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('agriInputs.seasonalCreditExposure')
  })

  it('leads with total outstanding and the peak due month', async () => {
    vi.mocked(reportService.generateSeasonalCreditExposureReport).mockResolvedValue({
      byMonth: [], bySeason: [{ seasonName: 'Wheat Harvest', outstandingAmount: 5000, invoiceCount: 3 }],
      summary: { totalOutstanding: 8000, totalInvoices: 5, peakMonth: 'Apr', peakMonthAmount: 5000 }
    } as never)

    const result = await executeVerticalTemplate('agriInputs.seasonalCreditExposure', {}, '₹')

    expect(result.headline).toBe('₹8,000.00 in outstanding credit, heaviest due in Apr (₹5,000.00)')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when there is no outstanding credit', async () => {
    vi.mocked(reportService.generateSeasonalCreditExposureReport).mockResolvedValue({
      byMonth: [], bySeason: [], summary: { totalOutstanding: 0, totalInvoices: 0, peakMonth: null, peakMonthAmount: 0 }
    } as never)

    const result = await executeVerticalTemplate('agriInputs.seasonalCreditExposure', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No outstanding credit invoices with a due date right now')
  })
})

// Phase 67 §9.1 — Agri Inputs item 4: Farmer-Wise Purchase & Repayment History.
describe('ai-vertical-templates.service — agriInputs.farmerRepayment', () => {
  it('registers agriInputs.farmerRepayment for AGRI_INPUTS', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('agriInputs.farmerRepayment')
  })

  it('leads with the riskiest (lowest repayment rate) farmer', async () => {
    vi.mocked(reportService.generateFarmerRepaymentReport).mockResolvedValue({
      rows: [{ customerId: 'c1', customerName: 'Risky Farmer', phone: null, totalPurchased: 1000, totalRepaid: 100, outstandingBalance: 900, repaymentRatePercent: 10 }],
      summary: { totalFarmers: 1, totalOutstanding: 900, overallRepaymentRatePercent: 10 }
    } as never)

    const result = await executeVerticalTemplate('agriInputs.farmerRepayment', {}, '₹')

    expect(result.headline).toBe('Risky Farmer has the lowest repayment rate (10%), ₹900.00 outstanding')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when there is no farmer credit activity', async () => {
    vi.mocked(reportService.generateFarmerRepaymentReport).mockResolvedValue({
      rows: [], summary: { totalFarmers: 0, totalOutstanding: 0, overallRepaymentRatePercent: 0 }
    } as never)

    const result = await executeVerticalTemplate('agriInputs.farmerRepayment', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No farmer credit activity recorded yet')
  })
})

// Phase 67 §9.1 — Agri Inputs item 3: crop-linked product advisory.
describe('ai-vertical-templates.service — agriInputs.cropAdvisory', () => {
  it('registers agriInputs.cropAdvisory for AGRI_INPUTS', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('agriInputs.cropAdvisory')
  })

  it('summarizes the distinct crop count when no specific crop is named', async () => {
    vi.mocked(listDistinctCrops).mockResolvedValue({ success: true, data: ['Cotton', 'Wheat'] } as never)

    const result = await executeVerticalTemplate('agriInputs.cropAdvisory', {}, '₹')

    expect(result.headline).toBe('2 crops with tagged product advisories')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no products are crop-tagged', async () => {
    vi.mocked(listDistinctCrops).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('agriInputs.cropAdvisory', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No crop-tagged products yet')
  })

  it('drills into a specific crop\'s products when a cropName param is given', async () => {
    vi.mocked(getProductsForCrop).mockResolvedValue({
      success: true, data: [{ productId: 'p1', productName: 'Urea 50kg', sellingPrice: 500, stockQty: 10 }]
    } as never)

    const result = await executeVerticalTemplate('agriInputs.cropAdvisory', { cropName: 'Wheat' }, '₹')

    expect(result.headline).toBe('1 product recommended for Wheat')
    expect(listDistinctCrops).not.toHaveBeenCalled()
  })
})

// Phase 67 §9.1 — Agri Inputs item 5: equipment AMC/service reminders.
describe('ai-vertical-templates.service — agriInputs.equipmentServiceDue', () => {
  it('registers agriInputs.equipmentServiceDue for AGRI_INPUTS', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'AGRI_INPUTS' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('agriInputs.equipmentServiceDue')
  })

  it('leads with the overdue count when overdue equipment exists', async () => {
    vi.mocked(listEquipmentDueForService).mockResolvedValue({
      success: true,
      data: [
        { serialId: 's1', productName: 'Tractor A', serialNumber: 'SN-1', nextServiceDueDate: '2026-08-01', dueForService: true, overdue: true },
        { serialId: 's2', productName: 'Sprayer B', serialNumber: 'SN-2', nextServiceDueDate: '2026-09-01', dueForService: true, overdue: false },
      ]
    } as never)

    const result = await executeVerticalTemplate('agriInputs.equipmentServiceDue', {}, '₹')

    expect(result.headline).toBe('1 unit is overdue for service')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no equipment has service dates set', async () => {
    vi.mocked(listEquipmentDueForService).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('agriInputs.equipmentServiceDue', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No equipment due for service right now')
  })
})

// Phase 67 §9.1 — Blood Bank item 1: donor cooldown auto-reminder.
describe('ai-vertical-templates.service — bloodBank.donorsDueForRecall', () => {
  it('registers bloodBank.donorsDueForRecall for BLOOD_BANK', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'BLOOD_BANK' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('bloodBank.donorsDueForRecall')
  })

  it('leads with the count of donors eligible to donate again', async () => {
    vi.mocked(listDonorsDueForRecall).mockResolvedValue({
      success: true, data: [{ fullName: 'Ravi Kumar', bloodGroup: 'O+' }, { fullName: 'Priya Singh', bloodGroup: 'A+' }]
    } as never)

    const result = await executeVerticalTemplate('bloodBank.donorsDueForRecall', {}, '₹')

    expect(result.headline).toBe('2 donors are eligible to donate again')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no donors are due for recall', async () => {
    vi.mocked(listDonorsDueForRecall).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('bloodBank.donorsDueForRecall', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No donors are currently due for recall')
  })
})

// Phase 67 §9.1 — Blood Bank item 3: camp/drive scheduling turnout.
describe('ai-vertical-templates.service — bloodBank.campTurnout', () => {
  it('registers bloodBank.campTurnout for BLOOD_BANK', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'BLOOD_BANK' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('bloodBank.campTurnout')
  })

  it('leads with the highest-turnout camp', async () => {
    vi.mocked(listDonationCamps).mockResolvedValue({
      success: true,
      data: [{ campName: 'Community Hall Drive', _count: { donations: 40 } }, { campName: 'College Drive', _count: { donations: 15 } }]
    } as never)

    const result = await executeVerticalTemplate('bloodBank.campTurnout', {}, '₹')

    expect(result.headline).toBe('Community Hall Drive had the highest turnout — 40 donation(s)')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no camps are scheduled', async () => {
    vi.mocked(listDonationCamps).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('bloodBank.campTurnout', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No donation camps scheduled yet')
  })
})

// Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time.
describe('ai-vertical-templates.service — bloodBank.donationToIssueCycleTime', () => {
  it('registers bloodBank.donationToIssueCycleTime for BLOOD_BANK', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'BLOOD_BANK' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('bloodBank.donationToIssueCycleTime')
  })

  it('leads with the overall average cycle time and names the slowest component', async () => {
    vi.mocked(reportService.generateDonationToIssueCycleTimeReport).mockResolvedValue({
      summary: { totalIssuedUnits: 5, overallAvgDays: 6.2 },
      byComponent: [{ componentType: 'PLASMA', unitCount: 2, avgDays: 15, minDays: 10, maxDays: 20 }]
    } as never)

    const result = await executeVerticalTemplate('bloodBank.donationToIssueCycleTime', {}, '₹')

    expect(result.headline).toBe('6.2 days average donation-to-issue cycle time, slowest for PLASMA (15d avg)')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when no units have been issued', async () => {
    vi.mocked(reportService.generateDonationToIssueCycleTimeReport).mockResolvedValue({
      summary: { totalIssuedUnits: 0, overallAvgDays: 0 }, byComponent: []
    } as never)

    const result = await executeVerticalTemplate('bloodBank.donationToIssueCycleTime', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No issued units yet')
  })
})

// Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per unit.
describe('ai-vertical-templates.service — rental.assetUtilization', () => {
  it('registers rental.assetUtilization for RENTAL', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'RENTAL' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toContain('rental.assetUtilization')
  })

  it('leads with the worst-earning asset and mentions idle units', async () => {
    vi.mocked(reportService.generateAssetUtilizationReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ rentalUnitId: 'u1', unitLabel: 'Car B', productName: 'Sedan Car', status: 'AVAILABLE', rentedDays: 0, availableDays: 31, utilizationPercent: 0 }],
      summary: { totalUnits: 1, avgUtilizationPercent: 0, idleUnitCount: 1 }
    } as never)

    const result = await executeVerticalTemplate('rental.assetUtilization', {}, '₹')

    expect(result.headline).toBe('Sedan Car (Car B) has the lowest utilization this period at 0%, 1 unit(s) fully idle')
    expect(result.isEmpty).toBe(false)
  })

  it('marks isEmpty true with an honest headline when there are no tracked units', async () => {
    vi.mocked(reportService.generateAssetUtilizationReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [], summary: { totalUnits: 0, avgUtilizationPercent: 0, idleUnitCount: 0 }
    } as never)

    const result = await executeVerticalTemplate('rental.assetUtilization', {}, '₹')

    expect(result.isEmpty).toBe(true)
    expect(result.headline).toBe('No tracked rental units yet')
  })
})

// Phase 67 §9.1 — Jewellery items 1/2/3/4/5.
describe('ai-vertical-templates.service — Jewellery', () => {
  it('registers all 6 jewellery intents for JEWELLERY', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'JEWELLERY' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toEqual(['jewellery.stockAndSales', 'jewellery.goldSavingsSummary', 'jewellery.makingChargeMargin', 'jewellery.hallmarkCompliance', 'jewellery.metalRateVsSalesVolume', 'jewellery.purityAdjustedExchange'])
  })

  it('goldSavingsSummary counts active schemes and sums their deposits', async () => {
    vi.mocked(listGoldSavingsSchemes).mockResolvedValue({ success: true, data: [{ totalDeposited: 55000 }] } as never)

    const result = await executeVerticalTemplate('jewellery.goldSavingsSummary', {}, '₹')

    expect(result.headline).toBe('1 active gold savings scheme(s), ₹55,000.00 deposited so far')
    expect(result.isEmpty).toBe(false)
  })

  it('goldSavingsSummary marks isEmpty true when there are no active schemes', async () => {
    vi.mocked(listGoldSavingsSchemes).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('jewellery.goldSavingsSummary', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })

  it('makingChargeMargin reports the blended percentage and both amounts', async () => {
    vi.mocked(reportService.generateMakingChargeMarginReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [{ invoiceId: 'i1' }],
      summary: { totalMetalValue: 47500, totalMakingCharge: 2500, avgMakingChargePercent: 5 },
    } as never)

    const result = await executeVerticalTemplate('jewellery.makingChargeMargin', {}, '₹')

    expect(result.headline).toBe('Making charge is 5% of total sale value this period (₹2,500.00 of ₹50,000.00)')
    expect(result.isEmpty).toBe(false)
  })

  it('hallmarkCompliance mentions the non-compliant count when items are missing a hallmark', async () => {
    vi.mocked(reportService.generateHallmarkComplianceReport).mockResolvedValue({
      rows: [], summary: { totalItems: 10, compliantCount: 8, nonCompliantCount: 2, compliancePercent: 80 },
    } as never)

    const result = await executeVerticalTemplate('jewellery.hallmarkCompliance', {}, '₹')

    expect(result.headline).toBe('8 of 10 jewellery items are hallmark-compliant (80%)')
    expect(result.details).toEqual(['2 item(s) missing a hallmark/HUID number'])
  })

  it('hallmarkCompliance omits the non-compliant detail line when every item is compliant', async () => {
    vi.mocked(reportService.generateHallmarkComplianceReport).mockResolvedValue({
      rows: [], summary: { totalItems: 5, compliantCount: 5, nonCompliantCount: 0, compliancePercent: 100 },
    } as never)

    const result = await executeVerticalTemplate('jewellery.hallmarkCompliance', {}, '₹')

    expect(result.details).toEqual([])
  })

  it('metalRateVsSalesVolume names the auto-selected metal+purity and its latest month', async () => {
    vi.mocked(reportService.generateMetalRateVsSalesVolumeReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', metalType: 'GOLD', purity: '22K',
      rows: [{ month: '2026-07', avgRatePerGram: 6200.5, salesWeightGrams: 45.678 }],
    } as never)

    const result = await executeVerticalTemplate('jewellery.metalRateVsSalesVolume', {}, '₹')

    expect(result.headline).toBe('GOLD 22K: latest rate ₹6,200.50/g, 45.7g sold last tracked month')
    expect(result.isEmpty).toBe(false)
  })

  it('metalRateVsSalesVolume gives an honest no-correlation headline when there were no jewellery sales at all', async () => {
    vi.mocked(reportService.generateMetalRateVsSalesVolumeReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', metalType: '', purity: '', rows: [],
    } as never)

    const result = await executeVerticalTemplate('jewellery.metalRateVsSalesVolume', {}, '₹')

    expect(result.headline).toBe('No jewellery sales in this period to correlate against metal rates.')
    expect(result.isEmpty).toBe(true)
  })

  it('purityAdjustedExchange reports pure-metal-equivalent weight and value credited', async () => {
    vi.mocked(reportService.generatePurityAdjustedExchangeReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', byMetal: [], monthlyTrend: [],
      summary: { totalExchanges: 3, totalPureEquivalentGrams: 12.345, totalValueGiven: 75000, unparsablePurityCount: 0 },
    } as never)

    const result = await executeVerticalTemplate('jewellery.purityAdjustedExchange', {}, '₹')

    expect(result.headline).toBe('3 exchange(s) this period, 12.345g pure-metal-equivalent, ₹75,000.00 credited')
    expect(result.isEmpty).toBe(false)
  })
})

// Phase 67 §9.1 — Service items 1-5.
describe('ai-vertical-templates.service — Service', () => {
  it('registers all 5 service intents for SERVICE', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'SERVICE' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toEqual(['service.slaBreaches', 'service.resolutionTime', 'service.contractSummary', 'service.repeatBusinessRate', 'service.quoteToJobConversion'])
  })

  it('slaBreaches counts only tickets currently past their SLA due date', async () => {
    vi.mocked(listTickets).mockResolvedValue({
      success: true, data: { tickets: [{ isSlaBreached: true }, { isSlaBreached: false }, { isSlaBreached: true }], total: 3 },
    } as never)

    const result = await executeVerticalTemplate('service.slaBreaches', {}, '₹')

    expect(result.headline).toBe('2 ticket(s) currently past their SLA due date')
    expect(result.isEmpty).toBe(false)
  })

  it('slaBreaches marks isEmpty true when nothing is breached', async () => {
    vi.mocked(listTickets).mockResolvedValue({ success: true, data: { tickets: [{ isSlaBreached: false }], total: 1 } } as never)

    const result = await executeVerticalTemplate('service.slaBreaches', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })

  it('resolutionTime leads with the slowest category', async () => {
    vi.mocked(reportService.generateServiceResolutionTimeReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ category: 'Plumbing', ticketCount: 4, avgHours: 30, minHours: 10, maxHours: 50 }],
      summary: { totalResolved: 6, overallAvgHours: 20 },
    } as never)

    const result = await executeVerticalTemplate('service.resolutionTime', {}, '₹')

    expect(result.headline).toBe('Plumbing takes the longest to resolve at 30h average, 6 ticket(s) resolved this period')
    expect(result.isEmpty).toBe(false)
  })

  it('resolutionTime gives an honest headline when nothing was resolved yet', async () => {
    vi.mocked(reportService.generateServiceResolutionTimeReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [], summary: { totalResolved: 0, overallAvgHours: 0 },
    } as never)

    const result = await executeVerticalTemplate('service.resolutionTime', {}, '₹')

    expect(result.headline).toBe('No tickets resolved this period yet.')
    expect(result.isEmpty).toBe(true)
  })

  it('contractSummary sums the combined value of active contracts', async () => {
    vi.mocked(listServiceContracts).mockResolvedValue({
      success: true, data: [{ contractValue: 5000 }, { contractValue: 3000 }],
    } as never)

    const result = await executeVerticalTemplate('service.contractSummary', {}, '₹')

    expect(result.headline).toBe('2 active service contract(s), ₹8,000.00 in combined value')
    expect(result.isEmpty).toBe(false)
  })

  it('repeatBusinessRate reports the latest month\'s figures', async () => {
    vi.mocked(reportService.generateRepeatBusinessRateReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ month: '2026-07', newCustomers: 3, repeatCustomers: 7, repeatRatePercent: 70 }],
    } as never)

    const result = await executeVerticalTemplate('service.repeatBusinessRate', {}, '₹')

    expect(result.headline).toBe('70% repeat business this month — 7 returning, 3 new')
    expect(result.isEmpty).toBe(false)
  })

  it('quoteToJobConversion reports the conversion rate', async () => {
    vi.mocked(getQuoteToJobConversionStats).mockResolvedValue({
      success: true, data: { acceptedQuotations: 10, convertedToTicket: 3, conversionRatePercent: 30 },
    } as never)

    const result = await executeVerticalTemplate('service.quoteToJobConversion', {}, '₹')

    expect(result.headline).toBe('30% of accepted quotations became jobs — 3 of 10')
    expect(result.isEmpty).toBe(false)
  })
})

describe('ai-vertical-templates.service — Consultant', () => {
  it('registers all 5 consultant intents for CONSULTANT', async () => {
    vi.mocked(getActiveTemplate).mockResolvedValue({ success: true, data: { businessType: 'CONSULTANT' } } as never)
    const names = await getActiveVerticalTemplateNames()
    expect(names).toEqual(['consultant.engagementConversion', 'consultant.utilization', 'consultant.retainerBurnDown', 'consultant.clientProfitability', 'consultant.proposalWinRate'])
  })

  it('engagementConversion reports the conversion rate', async () => {
    vi.mocked(getEngagementConversionStats).mockResolvedValue({
      success: true, data: { acceptedQuotations: 8, convertedToProject: 5, conversionRatePercent: 62.5 },
    } as never)

    const result = await executeVerticalTemplate('consultant.engagementConversion', {}, '₹')

    expect(result.headline).toBe('62.5% of accepted engagement letters became projects — 5 of 8')
    expect(result.isEmpty).toBe(false)
  })

  it('engagementConversion marks isEmpty true when no engagement letters have been accepted', async () => {
    vi.mocked(getEngagementConversionStats).mockResolvedValue({
      success: true, data: { acceptedQuotations: 0, convertedToProject: 0, conversionRatePercent: 0 },
    } as never)

    const result = await executeVerticalTemplate('consultant.engagementConversion', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })

  it('utilization leads with the least-utilized consultant', async () => {
    vi.mocked(reportService.generateConsultantUtilizationReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ userName: 'Priya', billableHours: 5, nonBillableHours: 35, totalHours: 40, utilizationPercent: 12.5 }],
      summary: { totalBillableHours: 5, totalNonBillableHours: 35, overallUtilizationPercent: 12.5 },
    } as never)

    const result = await executeVerticalTemplate('consultant.utilization', {}, '₹')

    expect(result.headline).toBe('Priya has the lowest utilization at 12.5%, overall utilization 12.5% this period')
    expect(result.isEmpty).toBe(false)
  })

  it('utilization gives an honest headline when no billable work was logged yet', async () => {
    vi.mocked(reportService.generateConsultantUtilizationReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [], summary: { totalBillableHours: 0, totalNonBillableHours: 0, overallUtilizationPercent: 0 },
    } as never)

    const result = await executeVerticalTemplate('consultant.utilization', {}, '₹')

    expect(result.headline).toBe('No billable work logged this period yet.')
    expect(result.isEmpty).toBe(true)
  })

  it('retainerBurnDown aggregates hours used vs. allocated across every active HOURLY_BUCKET retainer', async () => {
    vi.mocked(listRetainers).mockResolvedValue({
      success: true, data: [
        { id: 'rt-1', title: 'Acme Retainer', hoursPerMonth: 20 },
        { id: 'rt-2', title: 'Fixed-Fee Retainer', hoursPerMonth: null }, // excluded — not hour-bucketed
      ],
    } as never)
    vi.mocked(getRetainerHoursUsage).mockResolvedValue({
      success: true, data: { period: '2026-08', hoursPerMonth: 20, hoursUsed: 18, hoursRemaining: 2 },
    } as never)

    const result = await executeVerticalTemplate('consultant.retainerBurnDown', {}, '₹')

    expect(getRetainerHoursUsage).toHaveBeenCalledTimes(1)
    expect(getRetainerHoursUsage).toHaveBeenCalledWith('rt-1')
    expect(result.headline).toBe('18.0h of 20.0h retainer hours used this month across 1 retainer(s), 0 exhausted')
    expect(result.isEmpty).toBe(false)
  })

  it('retainerBurnDown counts an exhausted (0 hours remaining) retainer correctly', async () => {
    vi.mocked(listRetainers).mockResolvedValue({ success: true, data: [{ id: 'rt-1', title: 'Acme', hoursPerMonth: 10 }] } as never)
    vi.mocked(getRetainerHoursUsage).mockResolvedValue({
      success: true, data: { period: '2026-08', hoursPerMonth: 10, hoursUsed: 10, hoursRemaining: 0 },
    } as never)

    const result = await executeVerticalTemplate('consultant.retainerBurnDown', {}, '₹')

    expect(result.headline).toContain('1 exhausted')
  })

  it('retainerBurnDown gives an honest headline when there are no active hourly retainers', async () => {
    vi.mocked(listRetainers).mockResolvedValue({ success: true, data: [] } as never)

    const result = await executeVerticalTemplate('consultant.retainerBurnDown', {}, '₹')

    expect(result.headline).toBe('No active hourly retainers to track.')
    expect(result.isEmpty).toBe(true)
    expect(getRetainerHoursUsage).not.toHaveBeenCalled()
  })

  it('clientProfitability leads with the least-profitable client', async () => {
    vi.mocked(reportService.generateClientProfitabilityReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31',
      rows: [{ customerName: 'LowMargin Co', revenue: 5000, hoursSpent: 100, revenuePerHour: 50 }],
      summary: { totalRevenue: 5000, totalHours: 100 },
    } as never)

    const result = await executeVerticalTemplate('consultant.clientProfitability', {}, '₹')

    expect(result.headline).toBe('LowMargin Co has the lowest revenue per hour at ₹50.00/h, ₹5,000.00 total revenue this period')
    expect(result.isEmpty).toBe(false)
  })

  it('clientProfitability gives an honest headline when there is no client project revenue yet', async () => {
    vi.mocked(reportService.generateClientProfitabilityReport).mockResolvedValue({
      dateFrom: '2026-07-01', dateTo: '2026-07-31', rows: [], summary: { totalRevenue: 0, totalHours: 0 },
    } as never)

    const result = await executeVerticalTemplate('consultant.clientProfitability', {}, '₹')

    expect(result.headline).toBe('No client project revenue this period yet.')
    expect(result.isEmpty).toBe(true)
  })

  it('proposalWinRate reports won/lost/pending counts', async () => {
    vi.mocked(getProposalWinRateStats).mockResolvedValue({
      success: true, data: { totalProposals: 10, won: 6, lost: 2, pending: 2, winRatePercent: 75 },
    } as never)

    const result = await executeVerticalTemplate('consultant.proposalWinRate', {}, '₹')

    expect(result.headline).toBe('75% proposal win rate — 6 won, 2 lost, 2 pending')
    expect(result.isEmpty).toBe(false)
  })

  it('proposalWinRate marks isEmpty true when there are no proposals at all', async () => {
    vi.mocked(getProposalWinRateStats).mockResolvedValue({
      success: true, data: { totalProposals: 0, won: 0, lost: 0, pending: 0, winRatePercent: 0 },
    } as never)

    const result = await executeVerticalTemplate('consultant.proposalWinRate', {}, '₹')

    expect(result.isEmpty).toBe(true)
  })
})
