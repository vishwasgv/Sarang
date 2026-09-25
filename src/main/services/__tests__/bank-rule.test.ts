import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../transaction-lock.service', () => ({ assertNotLocked: vi.fn().mockResolvedValue(null) }))
vi.mock('../chart-of-accounts.service', () => ({ chartOfAccountsService: { getSystemAccountByCode: vi.fn().mockResolvedValue({ id: 'cash1000' }) } }))
vi.mock('../journal-entry.service', () => ({ journalEntryService: { postSystemEntry: vi.fn().mockResolvedValue({ id: 'je1', entryNumber: 'JE-00001' }) } }))

import { getPrisma } from '../../database/db'
import { journalEntryService } from '../journal-entry.service'
import { firstMatchingRule, ruleMatches, type BankRuleLike } from '../bank-rule.util'
import { bankRuleService } from '../bank-rule.service'

const rule = (over: Partial<BankRuleLike> = {}): BankRuleLike => ({ id: 'r1', name: 'Rent', bankAccountId: null, direction: 'ANY', contains: '', minAmount: null, maxAmount: null, accountId: 'acc1', priority: 100, isActive: true, ...over })
const out = (description: string, amount: number, bankAccountId = 'b1') => ({ bankAccountId, description, referenceNumber: null, debitAmount: amount, creditAmount: 0 })
const inn = (description: string, amount: number) => ({ bankAccountId: 'b1', description, referenceNumber: null, debitAmount: 0, creditAmount: amount })

describe('bank rule matching', () => {
  it('needs every word, in any order, ignoring case', () => {
    expect(ruleMatches(rule({ contains: 'upi swiggy' }), out('UPI/SWIGGY/9912', 250))).toBe(true)
    expect(ruleMatches(rule({ contains: 'upi zomato' }), out('UPI/SWIGGY/9912', 250))).toBe(false)
  })

  it('respects direction, amount range, bank account and the on/off switch', () => {
    expect(ruleMatches(rule({ contains: 'rent', direction: 'DEBIT' }), inn('rent', 500))).toBe(false)
    expect(ruleMatches(rule({ contains: 'rent', direction: 'CREDIT' }), inn('rent', 500))).toBe(true)
    expect(ruleMatches(rule({ contains: 'rent', minAmount: 1000 }), out('rent', 500))).toBe(false)
    expect(ruleMatches(rule({ contains: 'rent', maxAmount: 1000 }), out('rent', 1000))).toBe(true)
    expect(ruleMatches(rule({ contains: 'rent', bankAccountId: 'b2' }), out('rent', 5))).toBe(false)
    expect(ruleMatches(rule({ contains: 'rent', isActive: false }), out('rent', 5))).toBe(false)
  })

  it('a rule with only an amount range matches by amount alone; the lowest priority number wins', () => {
    expect(ruleMatches(rule({ minAmount: 100, maxAmount: 200 }), out('anything', 150))).toBe(true)
    const a = rule({ id: 'a', contains: 'rent', priority: 50 })
    const b = rule({ id: 'b', contains: 'rent', priority: 10 })
    expect(firstMatchingRule([a, b], out('office rent', 5))?.id).toBe('b')
    expect(firstMatchingRule([a, b], out('salary', 5))).toBeNull()
  })
})

describe('applying a rule to a statement line', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDb(line: Record<string, unknown>, claimed = 1) {
    const db: Record<string, any> = {
      bankStatementLine: {
        findUnique: vi.fn().mockResolvedValue(line),
        updateMany: vi.fn().mockResolvedValue({ count: claimed }),
        update: vi.fn().mockResolvedValue({})
      },
      bankRule: { findUnique: vi.fn().mockResolvedValue({ id: 'r1', name: 'Rent', accountId: 'acc1' }) }
    }
    db.$transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(db))
    return db
  }
  const base = { id: 'l1', bankAccountId: 'b1', transactionDate: new Date('2026-09-01T00:00:00'), description: 'Office rent', referenceNumber: null, reconciled: false }

  it('money out debits the chosen account and credits the bank; the line is reconciled to the entry', async () => {
    const db = makeDb({ ...base, debitAmount: 500, creditAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await bankRuleService.applyToLine({ lineId: 'l1', ruleId: 'r1' }, 'u1')
    expect(r).toMatchObject({ success: true, data: { entryNumber: 'JE-00001' } })
    const arg = vi.mocked(journalEntryService.postSystemEntry).mock.calls[0][1] as unknown as { sourceType: string; sourceId: string; lines: Array<Record<string, unknown>> }
    expect(arg.sourceType).toBe('BANK_RULE')
    expect(arg.sourceId).toBe('l1')
    expect(arg.lines).toEqual([
      { accountId: 'acc1', bankAccountId: null, debitAmount: 500, creditAmount: 0 },
      { accountId: 'cash1000', bankAccountId: 'b1', debitAmount: 0, creditAmount: 500 }
    ])
    expect(db.bankStatementLine.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { matchedId: 'je1' } })
  })

  it('money in debits the bank and credits the chosen account', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb({ ...base, debitAmount: 0, creditAmount: 900 }) as never)
    await bankRuleService.applyToLine({ lineId: 'l1', ruleId: 'r1' })
    const arg = vi.mocked(journalEntryService.postSystemEntry).mock.calls[0][1] as unknown as { lines: Array<Record<string, unknown>> }
    expect(arg.lines[0]).toMatchObject({ accountId: 'cash1000', bankAccountId: 'b1', debitAmount: 900 })
    expect(arg.lines[1]).toMatchObject({ accountId: 'acc1', creditAmount: 900 })
  })

  it('will not post a line that is already reconciled, or that another click just claimed', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb({ ...base, debitAmount: 5, creditAmount: 0, reconciled: true }) as never)
    expect(await bankRuleService.applyToLine({ lineId: 'l1', ruleId: 'r1' })).toMatchObject({ error: { code: 'BR-007' } })
    vi.mocked(getPrisma).mockReturnValue(makeDb({ ...base, debitAmount: 5, creditAmount: 0 }, 0) as never)
    expect(await bankRuleService.applyToLine({ lineId: 'l1', ruleId: 'r1' })).toMatchObject({ error: { code: 'BR-007' } })
    expect(journalEntryService.postSystemEntry).not.toHaveBeenCalled()
  })
})
