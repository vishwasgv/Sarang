import { requirePermission } from '../permission-guard'
import {
  listMembershipPlans,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
  listMemberships,
  getMembershipsByClient,
  createMembership,
  updateMembership,
  checkInMember,
  getMembershipAttendance,
  getExpiringMemberships,
  generateMembershipInvoice,
} from '../../services/membership.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  // ── Plans ──────────────────────────────────────────────────────────────────
  handle('membershipPlan:list', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listMembershipPlans()
  })

  handle('membershipPlan:create', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { planName: string; durationDays: number; price: number; sessionsIncluded?: number; allowedClasses?: string; isActive?: boolean }
    return createMembershipPlan(payload)
  })

  handle('membershipPlan:update', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { id: string; planName?: string; durationDays?: number; price?: number; sessionsIncluded?: number | null; allowedClasses?: string | null; isActive?: boolean }
    return updateMembershipPlan(payload)
  })

  handle('membershipPlan:delete', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteMembershipPlan(payload.id)
  })

  // ── Memberships ────────────────────────────────────────────────────────────
  handle('membership:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; search?: string }
    return listMemberships(payload)
  })

  handle('membership:getByClient', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { clientId: string }
    return getMembershipsByClient(payload.clientId)
  })

  handle('membership:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; planId: string; startDate: string; paymentStatus?: string; notes?: string }
    return createMembership(payload)
  })

  handle('membership:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; status?: string; paymentStatus?: string; freezeHistory?: string; notes?: string; sessionsUsed?: number }
    return updateMembership(payload)
  })

  handle('membership:checkIn', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; membershipId: string }
    return checkInMember(payload.clientId, payload.membershipId)
  })

  handle('membership:attendance', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { membershipId: string; dateFrom?: string; dateTo?: string }
    return getMembershipAttendance(payload.membershipId, payload.dateFrom, payload.dateTo)
  })

  handle('membership:expiring', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { daysAhead?: number }
    return getExpiringMemberships(payload.daysAhead)
  })

  handle('membership:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return generateMembershipInvoice(id)
  })
}
