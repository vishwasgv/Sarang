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
import {
  CreateMembershipPlanSchema,
  UpdateMembershipPlanSchema,
  CreateMembershipSchema,
  UpdateMembershipSchema,
  CheckInMemberSchema,
} from '../../validation/membership.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  // ── Plans ──────────────────────────────────────────────────────────────────
  handle('membershipPlan:list', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listMembershipPlans()
  })

  handle('membershipPlan:create', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = CreateMembershipPlanSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createMembershipPlan(parsed.data)
  })

  handle('membershipPlan:update', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = UpdateMembershipPlanSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateMembershipPlan(parsed.data)
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
    const parsed = CreateMembershipSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createMembership(parsed.data)
  })

  handle('membership:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateMembershipSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateMembership(parsed.data)
  })

  handle('membership:checkIn', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CheckInMemberSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return checkInMember(parsed.data.clientId, parsed.data.membershipId)
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
