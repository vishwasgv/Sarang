// Phase 57 — AI Assistant IPC surface. Deliberately deviates from house
// convention: every handler here checks isModuleEnabled('ai_assistant')
// server-side IN ADDITION TO requirePermission() — confirmed via a fresh
// grep of all other 109 handler files (2026-07-13) that isModuleEnabled is
// never re-checked at this layer anywhere else in the codebase (it's a
// service-layer/UI-layer-only concern elsewhere). That's an acceptable
// tradeoff for barcode/loose-billing; it is not acceptable here — a
// disabled AI module must mean the capability is actually unreachable via
// direct IPC call, not just hidden from the UI, since it surfaces revenue/
// customer/credit data. See PHASE_57_TECHNICAL_SPEC.md Section 7.
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { isModuleEnabled } from '../../services/industry-template.service'
import { askQuestion, getAiStatus, clearAiQueryHistory } from '../../services/ai-query.service'
import { AskQuestionSchema } from '../../validation/ai.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('ai:query', async (payload) => {
    const deny = await requirePermission('ai.query'); if (deny) return deny
    if (!(await isModuleEnabled('ai_assistant'))) {
      return { success: false, error: { code: 'AI-001', message: 'The AI Assistant is not enabled for this business.' } }
    }
    const parsed = AskQuestionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return askQuestion(parsed.data.question, session?.userId)
  })

  handle('ai:getStatus', async () => {
    const deny = await requirePermission('ai.query'); if (deny) return deny
    return getAiStatus()
  })

  handle('ai:clearHistory', async () => {
    const deny = await requirePermission('audit.view'); if (deny) return deny
    const session = getCurrentSession()
    return clearAiQueryHistory(session?.userId)
  })
}
