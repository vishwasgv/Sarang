import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../industry-template.service', () => ({ getActiveTemplate: vi.fn() }))
vi.mock('../membership.service', () => ({ getExpiringMemberships: vi.fn() }))
vi.mock('../legal-case.service', () => ({ listLegalCases: vi.fn() }))
vi.mock('../hearing.service', () => ({ listHearings: vi.fn() }))
vi.mock('../shoot-booking.service', () => ({ getShootKPIs: vi.fn() }))
vi.mock('../driving.service', () => ({ getUpcomingTestsAndLowBalanceKPIs: vi.fn() }))
vi.mock('../hotel.service', () => ({ getOccupancyReport: vi.fn() }))
vi.mock('../report.service', () => ({ reportService: { generatePrescriptionDrugSalesReport: vi.fn(), generateBatchExpiryReport: vi.fn(), generateSchemeCostVsVolumeReport: vi.fn(), generateWalkInVsAppointmentRatioReport: vi.fn(), generateDiagnosisCategoryTrendReport: vi.fn(), generateReferralOutcomeReport: vi.fn(), generatePackUtilizationReport: vi.fn(), generateLabTATReport: vi.fn(), generateTestVolumeByPanelReport: vi.fn(), generateReferralLeaderboardReport: vi.fn(), generateSecondOpinionConversionReport: vi.fn(), generateCaseComplexityMixReport: vi.fn(), generateTreatmentAcceptanceRateReport: vi.fn(), generateDentalRecallComplianceReport: vi.fn(), generateVaccinationComplianceReport: vi.fn(), generateVetCaseTypeVolumeReport: vi.fn(), generateDishContributionMarginReport: vi.fn(), generateTableTurnoverByHourReport: vi.fn(), generateRecipeWasteVarianceReport: vi.fn(), generateDeadStockClearanceReport: vi.fn(), generateCategorySellThroughReport: vi.fn(), generateBasketCompositionReport: vi.fn(), generateFastSlowMoverMatrixReport: vi.fn() } }))
vi.mock('../placement.service', () => ({ getPlacementKPIs: vi.fn() }))
vi.mock('../roc-filing.service', () => ({ listROCFilings: vi.fn() }))
vi.mock('../property.service', () => ({ getPropertyKPIs: vi.fn() }))
vi.mock('../issue.service', () => ({ listIssues: vi.fn() }))
vi.mock('../event-booking.service', () => ({ getEventKPIs: vi.fn() }))
vi.mock('../vaccination.service', () => ({ getUpcomingVaccinations: vi.fn() }))
vi.mock('../recall-record.service', () => ({ listRecalls: vi.fn() }))
vi.mock('../chronic-condition-record.service', () => ({ listChronicConditions: vi.fn() }))
vi.mock('../car-job-card.service', () => ({ getCarJobCardKPIs: vi.fn() }))
vi.mock('../coaching-fee.service', () => ({ getFeeKPIs: vi.fn() }))
vi.mock('../loyalty-program.service', () => ({ loyaltyProgramService: { getSummary: vi.fn() } }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getActiveTemplate } from '../industry-template.service'
import { getExpiringMemberships } from '../membership.service'
import { reportService } from '../report.service'
import { listChronicConditions } from '../chronic-condition-record.service'
import { loyaltyProgramService } from '../loyalty-program.service'
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
