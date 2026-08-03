import { logger } from '../../utils/logger'
import { activateLicenseKey, getLicenseState } from '../../services/license.service'
import { ActivateLicenseKeySchema } from '../../validation/license.validation'
import { getCurrentSession } from '../../services/auth.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Deliberately no unconditional requireSession() on either handler in this
// file — mirrors the existing `app:checkForUpdates`/`dialog:openFile`
// precedent (see app.handler.ts's own comment on this exact pattern).
// SetupWizard.tsx (and LicenseActivationGate.tsx's resume path) both call
// `license:activate` before any session exists (the key is entered during
// first-run setup, per PHASE_59_MONETIZATION_LICENSING_MASTER_PROMPT.md
// Section 59.5) — gating this behind an unconditional session check would
// break first-run setup entirely, the same class of near-miss this project
// has already hit once before on `dialog:openFile`.
export function register(handle: HandleFn): void {
  handle('license:activate', async (payload) => {
    // REAL BUG found+fixed 2026-08-03 (IPC auth-layer audit): seed.ts defines
    // settings.manageLicense explicitly as "Admin-only... same sensitivity
    // bar as Security" — but it was never actually checked anywhere,
    // leaving this handler wide open to ANY logged-in user once a session
    // exists (Settings → License is reachable post-login by a Manager, who
    // has settings.view but not settings.manageLicense). A Manager could
    // overwrite the activated license_key/tier/issuedAt/machine-fingerprint,
    // contradicting the seed's stated Admin-only design. Only enforced when
    // a session ALREADY exists — the pre-auth SetupWizard/resume-gate calls
    // above have no session at all and must keep working unauthenticated.
    const session = getCurrentSession()
    if (session) {
      const deny = await requirePermission('settings.manageLicense')
      if (deny) return deny
    }
    const parsed = ActivateLicenseKeySchema.safeParse(payload ?? {})
    if (!parsed.success) {
      return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    }
    try {
      return await activateLicenseKey(parsed.data.key)
    } catch (err) {
      logger.error('[License] activate error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  })

  handle('license:getStatus', async () => {
    try {
      const state = await getLicenseState()
      return { success: true, data: state }
    } catch (err) {
      logger.error('[License] getStatus error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  })
}
