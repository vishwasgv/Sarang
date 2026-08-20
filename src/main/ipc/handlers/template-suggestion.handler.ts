import { getPrisma } from '../../database/db'
import { getTemplateSuggestion } from '../../services/template-suggestion.service'
import { requireSession } from '../permission-guard'
import { logger } from '../../utils/logger'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('templateSuggestion:get', async () => {
    const deny = requireSession(); if (deny) return deny
    return getTemplateSuggestion()
  })

  // Same one-time "have we asked this owner already" Setting-row pattern as
  // the backup/tutorial prompts (app.handler.ts) — a global flag, not
  // per-user, so once dismissed it never nags again for this install.
  handle('templateSuggestion:isDismissed', async () => {
    try {
      const db = getPrisma()
      const setting = await db.setting.findUnique({ where: { settingKey: 'template_suggestion_dismissed' } })
      return { success: true, data: setting?.settingValue === 'true' }
    } catch {
      return { success: true, data: false }
    }
  })

  handle('templateSuggestion:dismiss', async () => {
    try {
      const db = getPrisma()
      await db.setting.upsert({
        where: { settingKey: 'template_suggestion_dismissed' },
        update: { settingValue: 'true' },
        create: { settingKey: 'template_suggestion_dismissed', settingValue: 'true' }
      })
      return { success: true }
    } catch (err) {
      logger.error('[TemplateSuggestion] dismiss error:', err)
      return { success: false, error: { code: 'SYS-001', message: 'Could not save your response. Please try again.' } }
    }
  })
}
