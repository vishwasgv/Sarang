import { z } from 'zod'
import { workflowRuleService, WORKFLOW_EVENTS } from '../../services/workflow-rule.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const AddSchema = z.object({ name: z.string().min(1).max(60), event: z.enum(WORKFLOW_EVENTS), minAmount: z.number().min(0).max(1e12) })
const ToggleSchema = z.object({ id: z.string().min(1), enabled: z.boolean() })

export function register(handle: HandleFn): void {
  handle('workflowRules:list', async () => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return workflowRuleService.list()
  })

  handle('workflowRules:add', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = AddSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid rule.' } }
    return workflowRuleService.add(parsed.data, getCurrentSession()?.userId)
  })

  handle('workflowRules:setEnabled', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ToggleSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a rule.' } }
    return workflowRuleService.setEnabled(parsed.data.id, parsed.data.enabled, getCurrentSession()?.userId)
  })

  handle('workflowRules:remove', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a rule.' } }
    return workflowRuleService.remove(id, getCurrentSession()?.userId)
  })
}
