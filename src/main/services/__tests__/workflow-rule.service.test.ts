import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../notification.service', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { createNotification } from '../notification.service'
import { workflowRuleService, matchingRules, parseRules, afterCreate, type WorkflowRule } from '../workflow-rule.service'

const rule = (over: Partial<WorkflowRule> = {}): WorkflowRule => ({ id: 'r1', name: 'Big sale', event: 'INVOICE_CREATED', minAmount: 10000, enabled: true, ...over })

function makeDb(rules: WorkflowRule[]) {
  return {
    setting: {
      findUnique: vi.fn().mockResolvedValue({ settingValue: JSON.stringify(rules) }),
      upsert: vi.fn().mockResolvedValue({})
    }
  }
}

describe('workflow rules', () => {
  beforeEach(() => vi.clearAllMocks())

  it('matches only enabled rules of the same event at or above the amount', () => {
    const rules = [rule(), rule({ id: 'r2', enabled: false }), rule({ id: 'r3', event: 'BILL_CREATED' }), rule({ id: 'r4', minAmount: 50000 })]
    expect(matchingRules(rules, 'INVOICE_CREATED', 10000).map((r) => r.id)).toEqual(['r1'])
    expect(matchingRules(rules, 'INVOICE_CREATED', 9999.99)).toEqual([])
  })

  it('ignores bad stored data', () => {
    expect(parseRules('nope')).toEqual([])
    expect(parseRules('[{"id":"a"}]')).toEqual([])
  })

  it('sends one notification per matching rule', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb([rule(), rule({ id: 'r2', name: 'Huge', minAmount: 1 })]) as never)
    await workflowRuleService.run('INVOICE_CREATED', { amount: 20000, reference: 'INV-1' })
    expect(createNotification).toHaveBeenCalledTimes(2)
  })

  it('never throws when the database fails', async () => {
    vi.mocked(getPrisma).mockImplementation(() => { throw new Error('boom') })
    await expect(workflowRuleService.run('INVOICE_CREATED', { amount: 5 })).resolves.toBeUndefined()
  })

  it('afterCreate passes the result through untouched, ignores failures', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb([rule()]) as never)
    const ok = { success: true, data: { totalAmount: 20000, invoiceNumber: 'INV-2' } }
    expect(afterCreate('INVOICE_CREATED', ok)).toBe(ok)
    const bad = { success: false }
    expect(afterCreate('INVOICE_CREATED', bad)).toBe(bad)
    await new Promise((r) => setTimeout(r, 0))
    expect(createNotification).toHaveBeenCalledTimes(1)
  })

  it('adds with validation, toggles and removes', async () => {
    const db = makeDb([rule()])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    expect((await workflowRuleService.add({ name: '', event: 'BILL_CREATED', minAmount: 1 })).success).toBe(false)
    expect((await workflowRuleService.add({ name: 'x', event: 'BILL_CREATED', minAmount: -1 })).success).toBe(false)
    expect((await workflowRuleService.add({ name: 'Big bill', event: 'BILL_CREATED', minAmount: 500 })).success).toBe(true)
    await workflowRuleService.setEnabled('r1', false)
    expect(JSON.parse(db.setting.upsert.mock.calls[1][0].update.settingValue)[0].enabled).toBe(false)
    await workflowRuleService.remove('r1')
    expect(JSON.parse(db.setting.upsert.mock.calls[2][0].update.settingValue)).toEqual([])
  })
})
