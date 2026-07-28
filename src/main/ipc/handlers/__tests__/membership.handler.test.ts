import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../permission-guard', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../services/membership.service', () => ({
  listMembershipPlans: vi.fn(),
  createMembershipPlan: vi.fn().mockResolvedValue({ success: true, data: {} }),
  updateMembershipPlan: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteMembershipPlan: vi.fn().mockResolvedValue({ success: true }),
  listMemberships: vi.fn(),
  getMembershipsByClient: vi.fn(),
  createMembership: vi.fn(),
  updateMembership: vi.fn(),
  checkInMember: vi.fn(),
  getMembershipAttendance: vi.fn(),
  getExpiringMemberships: vi.fn(),
  generateMembershipInvoice: vi.fn(),
  freezeMembership: vi.fn(),
  resumeMembership: vi.fn(),
}))

import { requirePermission } from '../../permission-guard'
import { register } from '../membership.handler'

// Real bug found live (2026-07-28 service-vertical audit, continued):
// membershipPlan:create/update/delete were gated on 'settings.view' — a
// READ-tier permission — instead of 'settings.modify', the write-tier
// permission this codebase's own permission matrix defines for exactly this
// purpose. service-catalog.handler.ts (the direct sibling: another
// priced-catalog config screen under Settings) correctly gates its own
// create/update/delete on 'settings.modify'. Since Manager holds
// 'settings.view' but NOT 'settings.modify' (only Admin does), this let any
// Manager create/edit/delete membership pricing plans — a privilege the
// equivalent ServiceCatalog screen reserves for Admin only.
describe('membership.handler — membershipPlan mutation permission gating', () => {
  function captureHandlers() {
    const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()
    register((channel, handler) => { handlers.set(channel, handler) })
    return handlers
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePermission).mockResolvedValue(null) // allow, by default
  })

  it('membershipPlan:create requires settings.modify, not settings.view', async () => {
    const handlers = captureHandlers()
    await handlers.get('membershipPlan:create')!({ planName: 'Gold', durationDays: 30, price: 1000 })
    expect(requirePermission).toHaveBeenCalledWith('settings.modify')
    expect(requirePermission).not.toHaveBeenCalledWith('settings.view')
  })

  it('membershipPlan:update requires settings.modify, not settings.view', async () => {
    const handlers = captureHandlers()
    await handlers.get('membershipPlan:update')!({ id: 'plan-1', price: 1200 })
    expect(requirePermission).toHaveBeenCalledWith('settings.modify')
    expect(requirePermission).not.toHaveBeenCalledWith('settings.view')
  })

  it('membershipPlan:delete requires settings.modify, not settings.view', async () => {
    const handlers = captureHandlers()
    await handlers.get('membershipPlan:delete')!({ id: 'plan-1' })
    expect(requirePermission).toHaveBeenCalledWith('settings.modify')
    expect(requirePermission).not.toHaveBeenCalledWith('settings.view')
  })

  it('a denial from requirePermission is returned as-is, blocking the mutation', async () => {
    const handlers = captureHandlers()
    vi.mocked(requirePermission).mockResolvedValueOnce({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
    const res = await handlers.get('membershipPlan:create')!({ planName: 'Gold', durationDays: 30, price: 1000 })
    expect(res).toEqual({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
  })

  // membershipPlan:list is a plain read, unaffected by this fix — confirms
  // the fix is scoped to the three mutations only.
  it('membershipPlan:list is unaffected by the settings.modify fix', async () => {
    const handlers = captureHandlers()
    await handlers.get('membershipPlan:list')!(undefined)
    expect(requirePermission).not.toHaveBeenCalledWith('settings.modify')
  })
})
