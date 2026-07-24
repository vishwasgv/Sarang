import { logger } from '../../utils/logger'
import { activateLicenseKey, getLicenseState } from '../../services/license.service'
import { ActivateLicenseKeySchema } from '../../validation/license.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Deliberately no requireSession() on either handler in this file — mirrors
// the existing `app:checkForUpdates`/`dialog:openFile` precedent (see
// app.handler.ts's own comment on this exact pattern). SetupWizard.tsx calls
// `license:activate` before any session exists (the key is entered during
// first-run setup, per PHASE_59_MONETIZATION_LICENSING_MASTER_PROMPT.md
// Section 59.5) — gating this behind a session check would break first-run
// setup entirely, the same class of near-miss this project has already hit
// once before on `dialog:openFile`.
export function register(handle: HandleFn): void {
  handle('license:activate', async (payload) => {
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
