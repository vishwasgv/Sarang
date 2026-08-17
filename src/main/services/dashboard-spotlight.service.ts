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
import { getUpcomingVaccinations } from './vaccination.service'
import { listRecalls } from './recall-record.service'
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
  // Phase 67 §9.1 — clinical dashboard-spotlight fix. Vet/Dental/Specialist/
  // Physio were all silently falling through to the generic
  // APPOINTMENT_BASED_TYPES 'appointment' card despite each already having
  // real, dedicated data (vaccination.service.ts, recall-record.service.ts,
  // VisitNote.referredBy, VisitNote.painScore/functionalScore) — the exact
  // same "reuse-ready but wired wrong" class Phase 66's own closing
  // self-review found for Gym/Lawyer/Photo Studio/Driving School. GP_CLINIC
  // is deliberately NOT included here yet — its chronic-condition recall
  // needs new tagging schema (Section 9's own GREENFIELD item) before a
  // dashboard branch can exist, unlike the other four which are pure reuse.
  | { kind: 'vaccination'; dueThisWeek: number; overdueCount: number; compliancePercent: number }
  | { kind: 'recall'; overdueCount: number; dueThisWeek: number; dueThisMonth: number }
  | { kind: 'referral'; totalReferredThisMonth: number; topReferrerName: string | null; topReferrerCount: number }
  | { kind: 'outcomeProgress'; sessionsScoredThisMonth: number; avgPainScore: number | null; avgFunctionalScore: number | null }
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

    // VET_CLINIC is an APPOINTMENT_BASED_TYPES member but already has a real,
    // dedicated vaccination-due mechanism (vaccination.service.ts, also
    // backing the vet.vaccinationsDue AI intent) — reuse it instead of the
    // generic completion-rate card. Compliance% is computed over pets that
    // have at least one scheduled next-due date (a pet with zero vaccination
    // history isn't "non-compliant", it's simply unscheduled).
    if (type === 'VET_CLINIC') {
      const db = getPrisma()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const [weekRes, scheduledPetIds, overduePetIds] = await Promise.all([
        getUpcomingVaccinations(7),
        db.vaccinationRecord.findMany({ where: { nextDueDate: { not: null } }, distinct: ['petId'], select: { petId: true } }),
        db.vaccinationRecord.findMany({ where: { nextDueDate: { lt: today } }, distinct: ['petId'], select: { petId: true } })
      ])
      const scheduledCount = scheduledPetIds.length
      const overdueCount = overduePetIds.length
      const compliancePercent = scheduledCount > 0 ? Math.round(((scheduledCount - overdueCount) / scheduledCount) * 100) : 100
      return {
        success: true,
        data: { kind: 'vaccination', dueThisWeek: weekRes.success ? (weekRes.data?.length ?? 0) : 0, overdueCount, compliancePercent }
      }
    }

    // DENTAL_CLINIC already has a fully-built RecallRecord model + dedicated
    // RecallListScreen (/dental/recalls) + AI intent (dental.recallsDue) —
    // reuse listRecalls() rather than the generic appointment card.
    if (type === 'DENTAL_CLINIC') {
      const now = new Date()
      const weekLater = new Date(now)
      weekLater.setDate(weekLater.getDate() + 7)
      const monthLater = new Date(now)
      monthLater.setDate(monthLater.getDate() + 30)
      const [overdueRes, weekRes, monthRes] = await Promise.all([
        listRecalls({ overdueOnly: true }),
        listRecalls({ dateFrom: toLocalISODate(now), dateTo: toLocalISODate(weekLater) }),
        listRecalls({ dateFrom: toLocalISODate(now), dateTo: toLocalISODate(monthLater) })
      ])
      return {
        success: true,
        data: {
          kind: 'recall',
          overdueCount: overdueRes.success ? (overdueRes.data?.length ?? 0) : 0,
          dueThisWeek: weekRes.success ? (weekRes.data?.length ?? 0) : 0,
          dueThisMonth: monthRes.success ? (monthRes.data?.length ?? 0) : 0
        }
      }
    }

    // SPECIALIST_CLINIC — VisitNote.referredBy is a real, populated field
    // (Phase 54F, distinct from the in-app Appointment.referredFromVisitNoteId
    // routing) but had zero groupBy report anywhere before this phase. Small
    // enough volume per clinic to aggregate in JS rather than a DB groupBy.
    if (type === 'SPECIALIST_CLINIC') {
      const db = getPrisma()
      const { dateFrom, dateTo } = thisMonthRange()
      const notes = await db.visitNote.findMany({
        where: { referredBy: { not: null }, appointment: { scheduledDate: { gte: new Date(dateFrom), lte: new Date(`${dateTo}T23:59:59.999`) } } },
        select: { referredBy: true }
      })
      const counts = new Map<string, number>()
      for (const n of notes) {
        if (!n.referredBy) continue
        counts.set(n.referredBy, (counts.get(n.referredBy) ?? 0) + 1)
      }
      let topReferrerName: string | null = null
      let topReferrerCount = 0
      for (const [name, count] of counts) {
        if (count > topReferrerCount) { topReferrerName = name; topReferrerCount = count }
      }
      return {
        success: true,
        data: { kind: 'referral', totalReferredThisMonth: notes.length, topReferrerName, topReferrerCount }
      }
    }

    // PHYSIO_CLINIC — VisitNote.painScore/functionalScore already exist
    // (Phase 26/58) and getVitalsTrend() already trends them per-patient;
    // this card is a fleet-wide summary, not a duplicate of that per-patient
    // trend, so it's computed directly here rather than calling
    // getVitalsTrend() in a loop.
    if (type === 'PHYSIO_CLINIC') {
      const db = getPrisma()
      const { dateFrom, dateTo } = thisMonthRange()
      const notes = await db.visitNote.findMany({
        where: {
          OR: [{ painScore: { not: null } }, { functionalScore: { not: null } }],
          appointment: { scheduledDate: { gte: new Date(dateFrom), lte: new Date(`${dateTo}T23:59:59.999`) } }
        },
        select: { painScore: true, functionalScore: true }
      })
      const painScores = notes.map(n => n.painScore).filter((v): v is number => v != null)
      const functionalScores = notes.map(n => n.functionalScore).filter((v): v is number => v != null)
      const avg = (arr: number[]): number | null => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null
      return {
        success: true,
        data: { kind: 'outcomeProgress', sessionsScoredThisMonth: notes.length, avgPainScore: avg(painScores), avgFunctionalScore: avg(functionalScores) }
      }
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
