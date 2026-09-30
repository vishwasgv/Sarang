import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../permission-guard', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../services/audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../../../services/auth.service', () => ({
  getCurrentSession: vi.fn().mockReturnValue({ userId: 'admin-1' }),
  checkPasswordLength: vi.fn(),
  hashPassword: vi.fn(),
  recordPasswordHistory: vi.fn(),
  checkPasswordNotReused: vi.fn(),
}))

const role = { findFirst: vi.fn(), findUnique: vi.fn() }
const user = { count: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() }
vi.mock('../../../database/db', () => ({ getPrisma: () => ({ role, user, $transaction: vi.fn() }) }))

import { requirePermission } from '../../permission-guard'
import { register } from '../users.handler'

// REAL BUG found+fixed (IPC handler audit): users:deactivate already refuses to
// deactivate the last active Admin, but users:update — which can just as
// effectively strip Admin access by reassigning that same user's roleId to a
// non-Admin role — had no equivalent check at all. A single call (buggy
// renderer or a crafted IPC call) could silently leave the install with zero
// active Admins, permanently locking out every Admin-only screen (Settings,
// license, year-end close, role management itself) until direct DB surgery.
describe('users.handler — users:update cannot strip the last active Admin of their Admin role', () => {
  function captureHandlers() {
    const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()
    register((channel, handler) => { handlers.set(channel, handler) })
    return handlers
  }

  const ADMIN_ROLE = { id: 'role-admin', roleName: 'Admin' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePermission).mockResolvedValue(null) // allow, by default
    role.findFirst.mockResolvedValue(ADMIN_ROLE)
  })

  it('blocks demoting the sole remaining active Admin to another role', async () => {
    role.findUnique.mockResolvedValue({ id: 'user-1', roleId: ADMIN_ROLE.id })
    user.count.mockResolvedValue(1)
    user.findUnique.mockResolvedValue({ id: 'user-1', roleId: ADMIN_ROLE.id })
    const handlers = captureHandlers()

    const res = await handlers.get('users:update')!({ id: 'user-1', fullName: 'Root Admin', roleId: 'role-manager', email: '', phone: '' })

    expect(res).toEqual({ success: false, error: { code: 'USER-002', message: 'At least one administrator must remain active.' } })
    expect(user.update).not.toHaveBeenCalled()
  })

  it('allows demoting an Admin when at least one other active Admin remains', async () => {
    user.count.mockResolvedValue(2)
    user.findUnique.mockResolvedValue({ id: 'user-1', roleId: ADMIN_ROLE.id })
    user.update.mockResolvedValue({ id: 'user-1', fullName: 'Second Admin', roleId: 'role-manager' })
    const handlers = captureHandlers()

    const res = await handlers.get('users:update')!({ id: 'user-1', fullName: 'Second Admin', roleId: 'role-manager', email: '', phone: '' })

    expect(user.update).toHaveBeenCalled()
    expect(res).toMatchObject({ success: true })
  })

  it('allows ordinary updates that keep the user in the Admin role', async () => {
    user.update.mockResolvedValue({ id: 'user-1', fullName: 'Root Admin', roleId: ADMIN_ROLE.id })
    const handlers = captureHandlers()

    const res = await handlers.get('users:update')!({ id: 'user-1', fullName: 'Root Admin', roleId: ADMIN_ROLE.id, email: '', phone: '' })

    // Same roleId as Admin — the last-admin count check is skipped entirely (no roleId change).
    expect(user.count).not.toHaveBeenCalled()
    expect(user.update).toHaveBeenCalled()
    expect(res).toMatchObject({ success: true })
  })

  it('allows updating a non-Admin user regardless of Admin headcount', async () => {
    user.findUnique.mockResolvedValue({ id: 'user-2', roleId: 'role-cashier' })
    user.update.mockResolvedValue({ id: 'user-2', fullName: 'Cashier', roleId: 'role-manager' })
    const handlers = captureHandlers()

    const res = await handlers.get('users:update')!({ id: 'user-2', fullName: 'Cashier', roleId: 'role-manager', email: '', phone: '' })

    expect(res).toMatchObject({ success: true })
    expect(user.update).toHaveBeenCalled()
  })
})
