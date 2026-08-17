import { toLocalISODate } from '../utils/date.util'
import { reportService } from './report.service'
import { getOccupancyReport } from './hotel.service'
import { getFeeKPIs } from './coaching-fee.service'
import { getPlacementKPIs } from './placement.service'
import { getExpiringMemberships } from './membership.service'
import { listLegalCases } from './legal-case.service'
import { listHearings } from './hearing.service'
import { getShootKPIs } from './shoot-booking.service'
import { getUpcomingTestsAndLowBalanceKPIs } from './driving.service'
import { getPrisma } from '../database/db'
import { APPOINTMENT_BASED_TYPES, PROJECT_BASED_TYPES } from './ai-vertical-templates.service'

// Phase 66 — Per-Vertical Dashboards. Real per-vertical Dashboard spotlight
// data, genuinely reusing the SAME report/service functions Ask Sarang AI's
// vertical templates already call (ai-vertical-templates.service.ts) rather
// than a parallel computation — confirmed via a grounding-check research
// pass that most of this data already existed, just never surfaced on the
// Dashboard itself. Real per-record labels/i18n live in the renderer
// (DashboardScreen.tsx's IndustrySpotlight); this function returns only raw
// numbers, discriminated by `kind` so the renderer can narrow the type.
export type VerticalSpotlightData =
  | { kind: 'membership'; expiringThisWeek: number; expiringThisMonth: number; activeCount: number }
  | { kind: 'legal'; openCases: number; upcomingHearings: number }
  | { kind: 'photography'; upcoming: number; thisMonth: number; deliveriesPending: number }
  | { kind: 'driving'; upcomingTests: number; lowBalanceCount: number }
  | { kind: 'appointment'; total: number; completionRate: number; noShow: number; cancelled: number }
  | { kind: 'project'; totalProjects: number; active: number; completed: number; totalContractValue: number }
  | { kind: 'hotel'; occupied: number; totalRooms: number; occupancyPercent: number; available: number }
  | { kind: 'lab'; totalOrders: number; pendingCount: number; delivered: number }
  | { kind: 'coaching'; totalDue: number; pendingCount: number; totalReceived: number }
  | { kind: 'compliance'; totalOpen: number; overdueCount: number; dueThisWeekCount: number }
  | { kind: 'jobCards'; totalJobs: number; pending: number; delivered: number }
  | { kind: 'placement'; activeCandidates: number; openJobOrders: number; placementsThisMonth: number; revenueThisMonth: number }
  | { kind: 'general'; invoicesToday: number; outstanding: number }
  | { kind: 'none' }

function thisMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  return { dateFrom: toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: toLocalISODate(now) }
}

export async function getVerticalSpotlightKpis(businessType: string): Promise<{ success: boolean; data?: VerticalSpotlightData; error?: { code: string; message: string } }> {
  try {
    const type = businessType.toUpperCase()

    // GYM_STUDIO is technically an APPOINTMENT_BASED_TYPES member (class
    // bookings are tracked as appointments), but the founder's own UAT
    // scenario for this vertical is specifically "how many memberships
    // expire this week" — a gym owner's real daily question — not generic
    // appointment completion stats. Reuses the SAME getExpiringMemberships()
    // the dedicated Memberships screen's own "Expiring Soon" tab already
    // calls (membership.handler.ts), not a parallel computation. Must be
    // checked before the generic APPOINTMENT_BASED_TYPES branch below.
    if (type === 'GYM_STUDIO') {
      const [weekRes, monthRes, activeCount] = await Promise.all([
        getExpiringMemberships(7),
        getExpiringMemberships(30),
        getPrisma().membership.count({ where: { status: 'ACTIVE' } })
      ])
      return {
        success: true,
        data: {
          kind: 'membership',
          expiringThisWeek: weekRes.success ? weekRes.data!.length : 0,
          expiringThisMonth: monthRes.success ? monthRes.data!.length : 0,
          activeCount
        }
      }
    }

    // LAWYER/PHOTO_STUDIO/DRIVING_SCHOOL are also APPOINTMENT_BASED_TYPES
    // members, but each already has its own real, more specific AI template
    // (legal.openCasesAndHearings / photography.upcomingShoots /
    // driving.upcomingTestsAndLowBalance in ai-vertical-templates.service.ts)
    // reusing dedicated data these owners actually check daily — a lawyer's
    // hearing calendar, a photographer's shoot pipeline, a driving school's
    // upcoming tests. Routing these three through the generic appointment
    // branch instead (as an earlier draft of this file did) would have been
    // a real regression against the phase's own spec, which named these as
    // "reuse-ready" verticals with existing dedicated data. Must be checked
    // before the generic APPOINTMENT_BASED_TYPES branch below, same as
    // GYM_STUDIO above.
    if (type === 'LAWYER') {
      const now = new Date()
      const weekLater = new Date(now)
      weekLater.setDate(weekLater.getDate() + 7)
      const [casesRes, hearingsRes] = await Promise.all([
        listLegalCases({ status: 'ACTIVE' }),
        listHearings({ status: 'SCHEDULED', fromDate: toLocalISODate(now), toDate: toLocalISODate(weekLater) })
      ])
      return {
        success: true,
        data: { kind: 'legal', openCases: casesRes.data?.length ?? 0, upcomingHearings: hearingsRes.data?.length ?? 0 }
      }
    }

    if (type === 'PHOTO_STUDIO') {
      const res = await getShootKPIs()
      if (!res.data) return { success: true, data: { kind: 'none' } }
      return { success: true, data: { kind: 'photography', upcoming: res.data.upcoming, thisMonth: res.data.thisMonth, deliveriesPending: res.data.deliveriesPending } }
    }

    if (type === 'DRIVING_SCHOOL') {
      const res = await getUpcomingTestsAndLowBalanceKPIs()
      if (!res.data) return { success: true, data: { kind: 'none' } }
      return { success: true, data: { kind: 'driving', upcomingTests: res.data.upcomingTests.length, lowBalanceCount: res.data.lowBalanceCount } }
    }

    if (APPOINTMENT_BASED_TYPES.has(type)) {
      const { dateFrom, dateTo } = thisMonthRange()
      const r = await reportService.generateAppointmentUtilisationReport({ dateFrom, dateTo })
      return { success: true, data: { kind: 'appointment', total: r.summary.total, completionRate: r.summary.completionRate, noShow: r.summary.noShow, cancelled: r.summary.cancelled } }
    }

    if (PROJECT_BASED_TYPES.has(type)) {
      const { dateFrom, dateTo } = thisMonthRange()
      const r = await reportService.generateServiceProjectReport({ dateFrom, dateTo })
      return { success: true, data: { kind: 'project', totalProjects: r.summary.totalProjects, active: r.summary.active, completed: r.summary.completed, totalContractValue: r.summary.totalContractValue } }
    }

    if (type === 'HOTEL_LODGE') {
      const res = await getOccupancyReport()
      if (!res.data) return { success: true, data: { kind: 'none' } }
      const r = res.data
      return { success: true, data: { kind: 'hotel', occupied: r.occupied, totalRooms: r.totalRooms, occupancyPercent: r.occupancyPercent, available: r.available } }
    }

    if (type === 'DIAGNOSTIC_LAB') {
      const { dateFrom, dateTo } = thisMonthRange()
      const r = await reportService.generateLabThroughputReport({ dateFrom, dateTo })
      return { success: true, data: { kind: 'lab', totalOrders: r.summary.totalOrders, pendingCount: r.summary.pendingCount, delivered: r.summary.delivered } }
    }

    if (type === 'COACHING_INSTITUTE') {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const res = await getFeeKPIs(month)
      if (!res.data) return { success: true, data: { kind: 'none' } }
      return { success: true, data: { kind: 'coaching', totalDue: res.data.totalDue, pendingCount: res.data.pendingCount, totalReceived: res.data.totalReceived } }
    }

    if (type === 'CA_FIRM' || type === 'COMPANY_SECRETARY') {
      const r = await reportService.generateComplianceTaskReport()
      return { success: true, data: { kind: 'compliance', totalOpen: r.summary.totalOpen, overdueCount: r.summary.overdueCount, dueThisWeekCount: r.summary.dueThisWeekCount } }
    }

    if (type === 'REPAIR' || type === 'CAR_SERVICE_CENTER') {
      const { dateFrom, dateTo } = thisMonthRange()
      const r = await reportService.generateJobCardReport({ dateFrom, dateTo })
      return { success: true, data: { kind: 'jobCards', totalJobs: r.summary.totalJobs, pending: r.summary.pending, delivered: r.summary.delivered } }
    }

    if (type === 'PLACEMENT_AGENCY') {
      const res = await getPlacementKPIs()
      if (!res.data) return { success: true, data: { kind: 'none' } }
      return { success: true, data: { kind: 'placement', ...res.data } }
    }

    // GENERAL — genuinely has no vertical-specific data model (same
    // reasoning ai-vertical-templates.service.ts's own comment gives for why
    // RETAIL/GENERAL get zero AI templates), but still deserves a real,
    // non-generic-feeling card instead of a Retail-shaped default: today's
    // real invoice count and real outstanding total.
    if (type === 'GENERAL') {
      const db = getPrisma()
      const now = new Date()
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const [invoicesToday, outstandingResult] = await Promise.all([
        db.invoice.count({ where: { invoiceDate: { gte: dayStart, lte: dayEnd }, status: { not: 'CANCELLED' } } }),
        db.invoice.aggregate({ _sum: { balanceAmount: true }, where: { status: { not: 'CANCELLED' } } })
      ])
      return { success: true, data: { kind: 'general', invoicesToday, outstanding: Number(outstandingResult._sum.balanceAmount ?? 0) } }
    }

    return { success: true, data: { kind: 'none' } }
  } catch (err) {
    return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not load dashboard spotlight data.' } }
  }
}
