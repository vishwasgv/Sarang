import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../industry-template.service', () => ({ getActiveTemplate: vi.fn() }))
vi.mock('../membership.service', () => ({ getExpiringMemberships: vi.fn() }))
vi.mock('../legal-case.service', () => ({ listLegalCases: vi.fn() }))
vi.mock('../hearing.service', () => ({ listHearings: vi.fn() }))
vi.mock('../shoot-booking.service', () => ({ getShootKPIs: vi.fn() }))
vi.mock('../driving.service', () => ({ getUpcomingTestsAndLowBalanceKPIs: vi.fn() }))
vi.mock('../hotel.service', () => ({ getOccupancyReport: vi.fn() }))
vi.mock('../report.service', () => ({ reportService: {} }))
vi.mock('../placement.service', () => ({ getPlacementKPIs: vi.fn() }))
vi.mock('../roc-filing.service', () => ({ listROCFilings: vi.fn() }))
vi.mock('../property.service', () => ({ getPropertyKPIs: vi.fn() }))
vi.mock('../issue.service', () => ({ listIssues: vi.fn() }))
vi.mock('../event-booking.service', () => ({ getEventKPIs: vi.fn() }))
vi.mock('../vaccination.service', () => ({ getUpcomingVaccinations: vi.fn() }))
vi.mock('../recall-record.service', () => ({ listRecalls: vi.fn() }))
vi.mock('../car-job-card.service', () => ({ getCarJobCardKPIs: vi.fn() }))
vi.mock('../coaching-fee.service', () => ({ getFeeKPIs: vi.fn() }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getActiveTemplate } from '../industry-template.service'
import { getExpiringMemberships } from '../membership.service'
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
