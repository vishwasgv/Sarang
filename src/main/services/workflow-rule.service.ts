import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { createNotification } from './notification.service'

// Simple "when this happens and the amount is at least X, tell me" rules. The action is always an in-app notification.
// Rules are kept as JSON in one Setting row.

export const WORKFLOW_EVENTS = ['INVOICE_CREATED', 'BILL_CREATED', 'EXPENSE_CREATED'] as const
export type WorkflowEvent = (typeof WORKFLOW_EVENTS)[number]

export interface WorkflowRule {
  id: string
  name: string
  event: WorkflowEvent
  minAmount: number
  enabled: boolean
}

const SETTING_KEY = 'workflow_rules'
const MAX_RULES = 20

const EVENT_PATH: Record<WorkflowEvent, string> = {
  INVOICE_CREATED: '/billing',
  BILL_CREATED: '/bills',
  EXPENSE_CREATED: '/expenses'
}

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

export function parseRules(text: string | null | undefined): WorkflowRule[] {
  if (!text) return []
  try {
    const v: unknown = JSON.parse(text)
    if (!Array.isArray(v)) return []
    return v.filter((r): r is WorkflowRule =>
      !!r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.minAmount === 'number' &&
      typeof r.enabled === 'boolean' && (WORKFLOW_EVENTS as readonly string[]).includes(r.event))
  } catch {
    return []
  }
}

/** The enabled rules that fire for this event and amount. */
export function matchingRules(rules: WorkflowRule[], event: WorkflowEvent, amount: number): WorkflowRule[] {
  return rules.filter((r) => r.enabled && r.event === event && amount >= r.minAmount)
}

async function readAll(): Promise<WorkflowRule[]> {
  const row = await getPrisma().setting.findUnique({ where: { settingKey: SETTING_KEY } })
  return parseRules(row?.settingValue)
}

async function writeAll(list: WorkflowRule[]): Promise<void> {
  const value = JSON.stringify(list)
  await getPrisma().setting.upsert({ where: { settingKey: SETTING_KEY }, create: { settingKey: SETTING_KEY, settingValue: value }, update: { settingValue: value } })
}

export const workflowRuleService = {
  async list() {
    try {
      return { success: true, data: await readAll() }
    } catch (err) {
      return fail(err)
    }
  },

  async add(p: { name: string; event: WorkflowEvent; minAmount: number }, userId?: string) {
    try {
      const name = p.name.trim()
      if (!name) throw new ServiceError('WFR-001', 'Give the rule a name.')
      if (!(p.minAmount >= 0)) throw new ServiceError('WFR-002', 'The amount cannot be negative.')
      const list = await readAll()
      if (list.length >= MAX_RULES) throw new ServiceError('WFR-003', `You can keep up to ${MAX_RULES} rules. Remove one first.`)
      const rule: WorkflowRule = { id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.slice(0, 60), event: p.event, minAmount: p.minAmount, enabled: true }
      await writeAll([...list, rule])
      await logAction({ userId, action: 'WORKFLOW_RULE_ADDED', entityType: 'WorkflowRule', entityId: rule.id, newValue: { name: rule.name, event: rule.event, minAmount: rule.minAmount } })
      return { success: true, data: { id: rule.id } }
    } catch (err) {
      return fail(err)
    }
  },

  async setEnabled(id: string, enabled: boolean, userId?: string) {
    try {
      const list = await readAll()
      await writeAll(list.map((r) => (r.id === id ? { ...r, enabled } : r)))
      await logAction({ userId, action: 'WORKFLOW_RULE_TOGGLED', entityType: 'WorkflowRule', entityId: id, newValue: { enabled } })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  },

  async remove(id: string, userId?: string) {
    try {
      const list = await readAll()
      await writeAll(list.filter((r) => r.id !== id))
      await logAction({ userId, action: 'WORKFLOW_RULE_REMOVED', entityType: 'WorkflowRule', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  },

  /** Called after a document is saved. Never throws and never blocks the save. */
  async run(event: WorkflowEvent, info: { amount: number; reference?: string }): Promise<void> {
    try {
      const fired = matchingRules(await readAll(), event, info.amount)
      for (const r of fired) {
        await createNotification({
          title: r.name,
          message: `${info.reference ? info.reference + ': ' : ''}${info.amount.toFixed(2)} (rule: at least ${r.minAmount})`,
          notificationType: 'INFO',
          actionPath: EVENT_PATH[event]
        })
      }
    } catch {
      // a rule failure must never break saving
    }
  }
}

/** Reads the amount and reference from a create result of invoices, bills or expenses. */
export function afterCreate(event: WorkflowEvent, result: unknown): unknown {
  const r = result as { success?: boolean; data?: { totalAmount?: number; amount?: number; invoiceNumber?: string; billNumber?: string; expenseName?: string } } | null
  if (r?.success && r.data) {
    const amount = r.data.totalAmount ?? r.data.amount
    if (typeof amount === 'number') void workflowRuleService.run(event, { amount, reference: r.data.invoiceNumber ?? r.data.billNumber ?? r.data.expenseName })
  }
  return result
}
