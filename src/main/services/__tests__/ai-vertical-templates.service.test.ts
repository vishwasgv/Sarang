import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../industry-template.service', () => ({ getActiveTemplate: vi.fn() }))
vi.mock('../membership.service', () => ({ getExpiringMemberships: vi.fn() }))
vi.mock('../legal-case.service', () => ({ listLegalCases: vi.fn() }))
vi.mock('../hearing.service', () => ({ listHearings: vi.fn() }))
vi.mock('../shoot-booking.service', () => ({ getShootKPIs: vi.fn() }))
vi.mock('../driving.service', () => ({ getUpcomingTestsAndLowBalanceKPIs: vi.fn() }))
vi.mock('../hotel.service', () => ({ getOccupancyReport: vi.fn() }))
vi.mock('../report.service', () => ({ reportService: { generatePrescriptionDrugSalesReport: vi.fn(), generateBatchExpiryReport: vi.fn(), generateSchemeCostVsVolumeReport: vi.fn() } }))
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
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getActiveTemplate } from '../industry-template.service'
import { getExpiringMemberships } from '../membership.service'
import { reportService } from '../report.service'
import { listChronicConditions } from '../chronic-condition-record.service'
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

    expect(names).toEqual(['service.appointmentUtilisation', 'service.clientRetention', 'gp.chronicRecallsDue'])
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
