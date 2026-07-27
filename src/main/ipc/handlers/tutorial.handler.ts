import { logger } from '../../utils/logger'
import { requireSession } from '../permission-guard'
import { startTutorial, exitTutorial, isTutorialModeActive } from '../../services/tutorial.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Phase 60 — Interactive Onboarding Tutorial. requireSession() gates all
// three: starting a tutorial is a real-app action a logged-in user takes,
// and exiting one works correctly too since the tutorial's own auto-login
// (main/index.ts, on boot into tutorial.db) establishes a real session for
// the seeded demo admin — requireSession() doesn't need to know or care
// which database it's checking against.
export function register(handle: HandleFn): void {
  handle('tutorial:start', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const businessType = (payload as { businessType?: string } | undefined)?.businessType
    if (!businessType || typeof businessType !== 'string') {
      return { success: false, error: { code: 'VAL-001', message: 'A business type is required to start the tutorial.' } }
    }
    try {
      return await startTutorial(businessType)
    } catch (err) {
      logger.error('[Tutorial] start error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  })

  handle('tutorial:exit', async () => {
    const deny = requireSession(); if (deny) return deny
    try {
      return await exitTutorial()
    } catch (err) {
      logger.error('[Tutorial] exit error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  })

  handle('tutorial:isActive', async () => {
    try {
      return { success: true, data: isTutorialModeActive() }
    } catch (err) {
      logger.error('[Tutorial] isActive error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  })
}
