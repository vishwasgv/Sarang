import { z } from 'zod'
import { bankRuleService } from '../../services/bank-rule.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const RuleSchema = z.object({
  name: z.string().min(1).max(80),
  bankAccountId: z.string().min(1).nullable().optional(),
  direction: z.enum(['DEBIT', 'CREDIT', 'ANY']),
  contains: z.string().max(120),
  minAmount: z.number().finite().min(0).nullable().optional(),
  maxAmount: z.number().finite().min(0).nullable().optional(),
  accountId: z.string().min(1),
  priority: z.number().int().min(1).max(9999).optional()
})
const UpdateSchema = RuleSchema.extend({ id: z.string().min(1), isActive: z.boolean().optional() })

export function register(handle: HandleFn): void {
  handle('bankRules:list', async () => {
    const deny = await requirePermission('bankReconciliation.view'); if (deny) return deny
    return bankRuleService.list()
  })

  handle('bankRules:create', async (payload) => {
    const deny = await requirePermission('bankReconciliation.reconcile'); if (deny) return deny
    const parsed = RuleSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid rule.' } }
    return bankRuleService.create(parsed.data, getCurrentSession()?.userId)
  })

  handle('bankRules:update', async (payload) => {
    const deny = await requirePermission('bankReconciliation.reconcile'); if (deny) return deny
    const parsed = UpdateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid rule.' } }
    const { id, ...rest } = parsed.data
    return bankRuleService.update(id, rest, getCurrentSession()?.userId)
  })

  handle('bankRules:remove', async (payload) => {
    const deny = await requirePermission('bankReconciliation.reconcile'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a rule.' } }
    return bankRuleService.remove(id, getCurrentSession()?.userId)
  })

  handle('bankRules:suggestions', async (payload) => {
    const deny = await requirePermission('bankReconciliation.view'); if (deny) return deny
    const id = (payload as { bankAccountId?: unknown } | null)?.bankAccountId
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a bank account.' } }
    return bankRuleService.suggestions(id)
  })

  handle('bankRules:apply', async (payload) => {
    const deny = await requirePermission('bankReconciliation.reconcile'); if (deny) return deny
    const p = payload as { lineId?: unknown; ruleId?: unknown } | null
    if (typeof p?.lineId !== 'string' || typeof p?.ruleId !== 'string' || !p.lineId || !p.ruleId) return { success: false, error: { code: 'VAL-001', message: 'Choose a line and a rule.' } }
    return bankRuleService.applyToLine({ lineId: p.lineId, ruleId: p.ruleId }, getCurrentSession()?.userId)
  })
}
