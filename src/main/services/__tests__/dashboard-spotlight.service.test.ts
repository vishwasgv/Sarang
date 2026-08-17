import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../report.service', () => ({
  reportService: {
    generateAppointmentUtilisationReport: vi.fn(),
    generateServiceProjectReport: vi.fn(),
    generateLabThroughputReport: vi.fn(),
    generateComplianceTaskReport: vi.fn(),
    generateJobCardReport: vi.fn()
  }
}))
vi.mock('../hotel.service', () => ({ getOccupancyReport: vi.fn() }))
vi.mock('../coaching-fee.service', () => ({ getFeeKPIs: vi.fn() }))
vi.mock('../placement.service', () => ({ getPlacementKPIs: vi.fn() }))
vi.mock('../membership.service', () => ({ getExpiringMemberships: vi.fn() }))
vi.mock('../legal-case.service', () => ({ listLegalCases: vi.fn() }))
vi.mock('../hearing.service', () => ({ listHearings: vi.fn() }))
vi.mock('../shoot-booking.service', () => ({ getShootKPIs: vi.fn() }))
vi.mock('../driving.service', () => ({ getUpcomingTestsAndLowBalanceKPIs: vi.fn() }))
vi.mock('../vaccination.service', () => ({ getUpcomingVaccinations: vi.fn() }))
vi.mock('../recall-record.service', () => ({ listRecalls: vi.fn() }))

import { getPrisma } from '../../database/db'
import { reportService } from '../report.service'
import { getOccupancyReport } from '../hotel.service'
import { getFeeKPIs } from '../coaching-fee.service'
import { getPlacementKPIs } from '../placement.service'
import { getExpiringMemberships } from '../membership.service'
import { listLegalCases } from '../legal-case.service'
import { listHearings } from '../hearing.service'
import { getShootKPIs } from '../shoot-booking.service'
import { getUpcomingTestsAndLowBalanceKPIs } from '../driving.service'
import { getUpcomingVaccinations } from '../vaccination.service'
import { listRecalls } from '../recall-record.service'
import { getVerticalSpotlightKpis } from '../dashboard-spotlight.service'

beforeEach(() => vi.clearAllMocks())

// Phase 66 — Per-Vertical Dashboards. Every branch reuses the SAME
// report/service function ai-vertical-templates.service.ts already calls
// for its own AI-answerable vertical templates — these tests assert the
// right function gets called for the right businessType group, not a
// parallel computation.
describe('getVerticalSpotlightKpis', () => {
  it('routes every APPOINTMENT_BASED_TYPES member to generateAppointmentUtilisationReport', async () => {
    vi.mocked(reportService.generateAppointmentUtilisationReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-13',
      summary: { total: 42, completionRate: 80, noShow: 3, cancelled: 2 }
    } as never)

    // VET_CLINIC/DENTAL_CLINIC/SPECIALIST_CLINIC/PHYSIO_CLINIC are technically
    // APPOINTMENT_BASED_TYPES members but each now has its own dedicated
    // branch (Phase 67 §9.1) — use EVENT_MANAGEMENT/BEAUTY_SALON here, the
    // members with no special-cased branch, so this test still proves the
    // generic fallback works for whoever's left in the set.
    for (const type of ['EVENT_MANAGEMENT', 'BEAUTY_SALON']) {
      const res = await getVerticalSpotlightKpis(type)
      expect(res.success).toBe(true)
      expect(res.data).toEqual({ kind: 'appointment', total: 42, completionRate: 80, noShow: 3, cancelled: 2 })
    }
    expect(reportService.generateAppointmentUtilisationReport).toHaveBeenCalledTimes(2)
  })

  // GYM_STUDIO is technically an APPOINTMENT_BASED_TYPES member, but gets its
  // own dedicated 'membership' branch instead — the founder's own UAT
  // scenario for this vertical is "how many memberships expire this week,"
  // not generic appointment completion stats. Must route here, not fall
  // into the generic appointment branch above.
  it('routes GYM_STUDIO to getExpiringMemberships (membership branch), not the generic appointment branch', async () => {
    vi.mocked(getExpiringMemberships).mockImplementation(async (daysAhead?: number) => {
      if (daysAhead === 7) return { success: true, data: [{ id: 'm1' }, { id: 'm2' }] } as never
      return { success: true, data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }, { id: 'm5' }] } as never
    })
    const db = { membership: { count: vi.fn().mockResolvedValue(37) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('GYM_STUDIO')

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ kind: 'membership', expiringThisWeek: 2, expiringThisMonth: 5, activeCount: 37 })
    expect(getExpiringMemberships).toHaveBeenCalledWith(7)
    expect(getExpiringMemberships).toHaveBeenCalledWith(30)
    expect(db.membership.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE' } })
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  // LAWYER/PHOTO_STUDIO/DRIVING_SCHOOL are also APPOINTMENT_BASED_TYPES
  // members, but each has real dedicated data more specific than generic
  // appointment stats — same "reuse-ready" verticals the phase spec named,
  // reusing the SAME function their own AI template calls.
  it('routes LAWYER to listLegalCases + listHearings (legal branch), not the generic appointment branch', async () => {
    vi.mocked(listLegalCases).mockResolvedValue({ success: true, data: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] } as never)
    vi.mocked(listHearings).mockResolvedValue({ success: true, data: [{ id: 'h1' }] } as never)

    const res = await getVerticalSpotlightKpis('LAWYER')

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ kind: 'legal', openCases: 3, upcomingHearings: 1 })
    expect(listLegalCases).toHaveBeenCalledWith({ status: 'ACTIVE' })
    expect(listHearings).toHaveBeenCalledWith(expect.objectContaining({ status: 'SCHEDULED' }))
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  it('routes PHOTO_STUDIO to getShootKPIs (photography branch), not the generic appointment branch', async () => {
    vi.mocked(getShootKPIs).mockResolvedValue({ success: true, data: { thisMonth: 5, deliveriesPending: 2, upcoming: 4 } } as never)

    const res = await getVerticalSpotlightKpis('PHOTO_STUDIO')

    expect(res.data).toEqual({ kind: 'photography', upcoming: 4, thisMonth: 5, deliveriesPending: 2 })
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  it('returns kind "none" when PHOTO_STUDIO has no shoot data yet', async () => {
    vi.mocked(getShootKPIs).mockResolvedValue({ success: true, data: null } as never)

    const res = await getVerticalSpotlightKpis('PHOTO_STUDIO')

    expect(res.data).toEqual({ kind: 'none' })
  })

  it('routes DRIVING_SCHOOL to getUpcomingTestsAndLowBalanceKPIs (driving branch), not the generic appointment branch', async () => {
    vi.mocked(getUpcomingTestsAndLowBalanceKPIs).mockResolvedValue({
      success: true,
      data: { upcomingTests: [{ testType: 'H' }, { testType: 'LMV' }], lowBalanceCount: 3 }
    } as never)

    const res = await getVerticalSpotlightKpis('DRIVING_SCHOOL')

    expect(res.data).toEqual({ kind: 'driving', upcomingTests: 2, lowBalanceCount: 3 })
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  it('returns kind "none" when DRIVING_SCHOOL has no test/enrollment data yet', async () => {
    vi.mocked(getUpcomingTestsAndLowBalanceKPIs).mockResolvedValue({ success: false, error: { code: 'X', message: 'x' } } as never)

    const res = await getVerticalSpotlightKpis('DRIVING_SCHOOL')

    expect(res.data).toEqual({ kind: 'none' })
  })

  // Phase 67 §9.1 — clinical dashboard-spotlight fix. Vet/Dental/Specialist/
  // Physio were all silently falling into the generic appointment branch
  // above despite having real dedicated data — these 4 tests assert each
  // now routes to its own branch AND explicitly assert the generic
  // appointment report is never called, the same negative-assertion pattern
  // Phase 66's own closing self-review established for this bug class.
  it('routes VET_CLINIC to getUpcomingVaccinations + a compliance% aggregate (vaccination branch), not the generic appointment branch', async () => {
    vi.mocked(getUpcomingVaccinations).mockResolvedValue({ success: true, data: [{ id: 'v1' }, { id: 'v2' }] } as never)
    const db = {
      vaccinationRecord: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ petId: 'p1' }, { petId: 'p2' }, { petId: 'p3' }, { petId: 'p4' }]) // scheduled (nextDueDate not null)
          .mockResolvedValueOnce([{ petId: 'p1' }]) // overdue
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('VET_CLINIC')

    expect(res.data).toEqual({ kind: 'vaccination', dueThisWeek: 2, overdueCount: 1, compliancePercent: 75 })
    expect(getUpcomingVaccinations).toHaveBeenCalledWith(7)
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  it('treats VET_CLINIC compliance as 100% when no pet has a scheduled vaccination yet', async () => {
    vi.mocked(getUpcomingVaccinations).mockResolvedValue({ success: true, data: [] } as never)
    const db = { vaccinationRecord: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('VET_CLINIC')

    expect(res.data).toEqual({ kind: 'vaccination', dueThisWeek: 0, overdueCount: 0, compliancePercent: 100 })
  })

  it('routes DENTAL_CLINIC to listRecalls (recall branch), not the generic appointment branch', async () => {
    vi.mocked(listRecalls).mockImplementation(async (filters?: { overdueOnly?: boolean }) => {
      if (filters?.overdueOnly) return { success: true, data: [{ id: 'r1' }] } as never
      return { success: true, data: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] } as never
    })

    const res = await getVerticalSpotlightKpis('DENTAL_CLINIC')

    expect(res.data).toEqual({ kind: 'recall', overdueCount: 1, dueThisWeek: 3, dueThisMonth: 3 })
    expect(listRecalls).toHaveBeenCalledWith({ overdueOnly: true })
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  it('routes SPECIALIST_CLINIC to a VisitNote.referredBy aggregate (referral branch), not the generic appointment branch', async () => {
    const db = {
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { referredBy: 'Dr. Rao' }, { referredBy: 'Dr. Rao' }, { referredBy: 'Dr. Iyer' }
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('SPECIALIST_CLINIC')

    expect(res.data).toEqual({ kind: 'referral', totalReferredThisMonth: 3, topReferrerName: 'Dr. Rao', topReferrerCount: 2 })
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  it('returns a null top referrer for SPECIALIST_CLINIC when no referrals exist yet', async () => {
    const db = { visitNote: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('SPECIALIST_CLINIC')

    expect(res.data).toEqual({ kind: 'referral', totalReferredThisMonth: 0, topReferrerName: null, topReferrerCount: 0 })
  })

  it('routes PHYSIO_CLINIC to a VisitNote.painScore/functionalScore aggregate (outcomeProgress branch), not the generic appointment branch', async () => {
    const db = {
      visitNote: {
        findMany: vi.fn().mockResolvedValue([
          { painScore: 6, functionalScore: 40 },
          { painScore: 4, functionalScore: 55 },
          { painScore: null, functionalScore: 60 }
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('PHYSIO_CLINIC')

    expect(res.data).toEqual({ kind: 'outcomeProgress', sessionsScoredThisMonth: 3, avgPainScore: 5, avgFunctionalScore: 51.7 })
    expect(reportService.generateAppointmentUtilisationReport).not.toHaveBeenCalled()
  })

  it('returns null averages for PHYSIO_CLINIC when no session has a score recorded yet', async () => {
    const db = { visitNote: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('PHYSIO_CLINIC')

    expect(res.data).toEqual({ kind: 'outcomeProgress', sessionsScoredThisMonth: 0, avgPainScore: null, avgFunctionalScore: null })
  })

  it('routes every PROJECT_BASED_TYPES member to generateServiceProjectReport', async () => {
    vi.mocked(reportService.generateServiceProjectReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-13',
      summary: { totalProjects: 10, active: 6, completed: 3, onHold: 1, totalContractValue: 500000 }
    } as never)

    for (const type of ['SERVICE', 'ARCHITECT', 'MARKETING_AGENCY', 'REAL_ESTATE']) {
      const res = await getVerticalSpotlightKpis(type)
      expect(res.success).toBe(true)
      expect(res.data).toEqual({ kind: 'project', totalProjects: 10, active: 6, completed: 3, totalContractValue: 500000 })
    }
    expect(reportService.generateServiceProjectReport).toHaveBeenCalledTimes(4)
  })

  it('routes HOTEL_LODGE to getOccupancyReport', async () => {
    vi.mocked(getOccupancyReport).mockResolvedValue({ success: true, data: { occupied: 8, totalRooms: 20, occupancyPercent: 40, available: 10, cleaning: 1, maintenance: 1 } } as never)

    const res = await getVerticalSpotlightKpis('HOTEL_LODGE')

    expect(res.data).toEqual({ kind: 'hotel', occupied: 8, totalRooms: 20, occupancyPercent: 40, available: 10 })
  })

  it('returns kind "none" when HOTEL_LODGE has no occupancy data yet', async () => {
    vi.mocked(getOccupancyReport).mockResolvedValue({ success: true, data: null } as never)

    const res = await getVerticalSpotlightKpis('HOTEL_LODGE')

    expect(res.data).toEqual({ kind: 'none' })
  })

  it('routes DIAGNOSTIC_LAB to generateLabThroughputReport', async () => {
    vi.mocked(reportService.generateLabThroughputReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-13',
      summary: { totalOrders: 55, pendingCount: 12, delivered: 40, avgTurnaroundHours: 6 }
    } as never)

    const res = await getVerticalSpotlightKpis('DIAGNOSTIC_LAB')

    expect(res.data).toEqual({ kind: 'lab', totalOrders: 55, pendingCount: 12, delivered: 40 })
  })

  it('routes COACHING_INSTITUTE to getFeeKPIs for the current month', async () => {
    vi.mocked(getFeeKPIs).mockResolvedValue({ success: true, data: { totalDue: 20000, totalReceived: 15000, pendingCount: 4, partialCount: 1, paidCount: 10, waivedCount: 0, total: 15 } } as never)

    const res = await getVerticalSpotlightKpis('COACHING_INSTITUTE')

    expect(res.data).toEqual({ kind: 'coaching', totalDue: 20000, pendingCount: 4, totalReceived: 15000 })
    const calledMonth = vi.mocked(getFeeKPIs).mock.calls[0][0]
    expect(calledMonth).toMatch(/^\d{4}-\d{2}$/)
  })

  it('routes both CA_FIRM and COMPANY_SECRETARY to generateComplianceTaskReport', async () => {
    vi.mocked(reportService.generateComplianceTaskReport).mockResolvedValue({
      generatedAt: '2026-08-13',
      summary: { totalOpen: 9, overdueCount: 2, dueThisWeekCount: 3, clientCount: 5 },
      rows: []
    } as never)

    for (const type of ['CA_FIRM', 'COMPANY_SECRETARY']) {
      const res = await getVerticalSpotlightKpis(type)
      expect(res.data).toEqual({ kind: 'compliance', totalOpen: 9, overdueCount: 2, dueThisWeekCount: 3 })
    }
    expect(reportService.generateComplianceTaskReport).toHaveBeenCalledTimes(2)
  })

  it('routes both REPAIR and CAR_SERVICE_CENTER to generateJobCardReport', async () => {
    vi.mocked(reportService.generateJobCardReport).mockResolvedValue({
      dateFrom: '2026-08-01', dateTo: '2026-08-13',
      summary: { totalJobs: 30, pending: 8, delivered: 20, totalEstimatedCost: 100000, totalActualCost: 95000 }
    } as never)

    for (const type of ['REPAIR', 'CAR_SERVICE_CENTER']) {
      const res = await getVerticalSpotlightKpis(type)
      expect(res.data).toEqual({ kind: 'jobCards', totalJobs: 30, pending: 8, delivered: 20 })
    }
  })

  it('routes PLACEMENT_AGENCY to getPlacementKPIs', async () => {
    vi.mocked(getPlacementKPIs).mockResolvedValue({ success: true, data: { activeCandidates: 40, openJobOrders: 6, placementsThisMonth: 3, revenueThisMonth: 75000 } } as never)

    const res = await getVerticalSpotlightKpis('PLACEMENT_AGENCY')

    expect(res.data).toEqual({ kind: 'placement', activeCandidates: 40, openJobOrders: 6, placementsThisMonth: 3, revenueThisMonth: 75000 })
  })

  it('computes a real GENERAL card from Invoice data directly', async () => {
    const db = {
      invoice: {
        count: vi.fn().mockResolvedValue(7),
        aggregate: vi.fn().mockResolvedValue({ _sum: { balanceAmount: 45000 } })
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVerticalSpotlightKpis('GENERAL')

    expect(res.data).toEqual({ kind: 'general', invoicesToday: 7, outstanding: 45000 })
    expect(db.invoice.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { not: 'CANCELLED' } }) }))
  })

  it('returns kind "none" for a business type with no vertical-specific data (e.g. RETAIL)', async () => {
    const res = await getVerticalSpotlightKpis('RETAIL')

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ kind: 'none' })
  })

  it('returns a graceful error instead of throwing when the underlying report function fails', async () => {
    vi.mocked(reportService.generateAppointmentUtilisationReport).mockRejectedValue(new Error('DB unavailable'))

    const res = await getVerticalSpotlightKpis('EVENT_MANAGEMENT')

    expect(res.success).toBe(false)
    expect(res.error?.message).toBe('DB unavailable')
  })
})
