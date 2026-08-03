import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../permission-guard', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../services/auth.service', () => ({ getCurrentSession: vi.fn() }))
vi.mock('../../../services/license.service', () => ({
  activateLicenseKey: vi.fn().mockResolvedValue({ success: true, data: {} }),
  getLicenseState: vi.fn().mockResolvedValue({ status: 'ACTIVE' }),
}))
vi.mock('../../../utils/logger', () => ({ logger: { error: vi.fn() } }))

import { requirePermission } from '../../permission-guard'
import { getCurrentSession } from '../../../services/auth.service'
import { activateLicenseKey } from '../../../services/license.service'
import { register } from '../license.handler'

// REAL BUG found+fixed 2026-08-03 (IPC auth-layer audit): license:activate
// had no permission check at all — justified for the pre-auth
// SetupWizard/resume-gate calls (no session exists yet), but the same
// unguarded handler is also reachable post-login from Settings → License,
// where seed.ts defines settings.manageLicense explicitly as Admin-only
// ("same sensitivity bar as Security"). A logged-in Manager (settings.view,
// not settings.manageLicense) could overwrite the activated license.
describe('license.handler — settings.manageLicense only enforced once a session exists', () => {
  function captureHandlers() {
    const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()
    register((channel, handler) => { handlers.set(channel, handler) })
    return handlers
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePermission).mockResolvedValue(null) // allow, by default
  })

  it('pre-auth (no session, SetupWizard/resume-gate): activates with no permission check at all', async () => {
    vi.mocked(getCurrentSession).mockReturnValue(undefined as never)
    const handlers = captureHandlers()

    const res = await handlers.get('license:activate')!({ key: 'SARANG-TRIAL-IN-ABC123-DEADBEEF0000' })

    expect(requirePermission).not.toHaveBeenCalled()
    expect(activateLicenseKey).toHaveBeenCalled()
    expect(res).toEqual({ success: true, data: {} })
  })

  it('post-login (session exists): requires settings.manageLicense', async () => {
    vi.mocked(getCurrentSession).mockReturnValue({ userId: 'u1', roleId: 'r1' } as never)
    const handlers = captureHandlers()

    await handlers.get('license:activate')!({ key: 'SARANG-TRIAL-IN-ABC123-DEADBEEF0000' })

    expect(requirePermission).toHaveBeenCalledWith('settings.manageLicense')
  })

  it('post-login, permission denied (e.g. a Manager): blocks activation entirely', async () => {
    vi.mocked(getCurrentSession).mockReturnValue({ userId: 'u1', roleId: 'r1' } as never)
    vi.mocked(requirePermission).mockResolvedValueOnce({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
    const handlers = captureHandlers()

    const res = await handlers.get('license:activate')!({ key: 'SARANG-TRIAL-IN-ABC123-DEADBEEF0000' })

    expect(res).toEqual({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
    expect(activateLicenseKey).not.toHaveBeenCalled()
  })

  it('license:getStatus remains unguarded (read-only, informational)', async () => {
    vi.mocked(getCurrentSession).mockReturnValue(undefined as never)
    const handlers = captureHandlers()

    const res = await handlers.get('license:getStatus')!(undefined)

    expect(requirePermission).not.toHaveBeenCalled()
    expect(res).toEqual({ success: true, data: { status: 'ACTIVE' } })
  })
})
