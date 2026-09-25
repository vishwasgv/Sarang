import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { journalEntryService } from './journal-entry.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { assertNotLocked } from './transaction-lock.service'
import { firstMatchingRule, lineAmount } from './bank-rule.util'

export interface BankRuleInput {
  name: string
  bankAccountId?: string | null
  direction: 'DEBIT' | 'CREDIT' | 'ANY'
  contains: string
  minAmount?: number | null
  maxAmount?: number | null
  accountId: string
  priority?: number
}

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

async function checkInput(p: BankRuleInput) {
  const db = getPrisma()
  if (!p.name.trim()) throw new ServiceError('BR-001', 'Give the rule a name.')
  if (!p.contains.trim() && p.minAmount == null && p.maxAmount == null) throw new ServiceError('BR-002', 'A rule needs some words to look for, or an amount range.')
  if (p.minAmount != null && p.maxAmount != null && p.minAmount > p.maxAmount) throw new ServiceError('BR-003', 'The smallest amount is more than the largest.')
  const account = await db.chartOfAccounts.findUnique({ where: { id: p.accountId }, select: { id: true, isActive: true } })
  if (!account || !account.isActive) throw new ServiceError('BR-004', 'Choose an active account to post to.')
  if (p.bankAccountId) {
    const bank = await db.bankAccount.findUnique({ where: { id: p.bankAccountId }, select: { id: true } })
    if (!bank) throw new ServiceError('BR-005', 'Bank account not found.')
  }
}

function data(p: BankRuleInput) {
  return { name: p.name.trim(), bankAccountId: p.bankAccountId || null, direction: p.direction, contains: p.contains.trim(), minAmount: p.minAmount ?? null, maxAmount: p.maxAmount ?? null, accountId: p.accountId, priority: p.priority ?? 100 }
}

export const bankRuleService = {
  async list() {
    const rows = await getPrisma().bankRule.findMany({ orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] })
    return { success: true, data: rows }
  },

  async create(p: BankRuleInput, userId?: string) {
    try {
      await checkInput(p)
      const row = await getPrisma().bankRule.create({ data: data(p) })
      await logAction({ userId, action: 'BANK_RULE_CREATED', entityType: 'BankRule', entityId: row.id, newValue: { name: row.name } })
      return { success: true, data: row }
    } catch (err) {
      return fail(err)
    }
  },

  async update(id: string, p: BankRuleInput & { isActive?: boolean }, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.bankRule.findUnique({ where: { id }, select: { id: true } })
      if (!existing) throw new ServiceError('BR-006', 'Rule not found.')
      await checkInput(p)
      const row = await db.bankRule.update({ where: { id }, data: { ...data(p), ...(p.isActive !== undefined ? { isActive: p.isActive } : {}) } })
      await logAction({ userId, action: 'BANK_RULE_UPDATED', entityType: 'BankRule', entityId: id })
      return { success: true, data: row }
    } catch (err) {
      return fail(err)
    }
  },

  async remove(id: string, userId?: string) {
    try {
      await getPrisma().bankRule.deleteMany({ where: { id } })
      await logAction({ userId, action: 'BANK_RULE_DELETED', entityType: 'BankRule', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  },

  /** Unreconciled statement lines of one bank account, each with the rule that fits it (if any). */
  async suggestions(bankAccountId: string) {
    try {
      const db = getPrisma()
      const [lines, rules, accounts] = await Promise.all([
        db.bankStatementLine.findMany({ where: { bankAccountId, reconciled: false }, orderBy: { transactionDate: 'asc' }, take: 500 }),
        db.bankRule.findMany({ where: { isActive: true } }),
        db.chartOfAccounts.findMany({ select: { id: true, accountName: true } })
      ])
      const nameOf = new Map(accounts.map((a) => [a.id, a.accountName]))
      const data = lines.map((l) => {
        const rule = firstMatchingRule(rules, l)
        return {
          lineId: l.id, date: l.transactionDate.toISOString(), description: l.description, referenceNumber: l.referenceNumber,
          debitAmount: l.debitAmount, creditAmount: l.creditAmount,
          rule: rule ? { id: rule.id, name: rule.name, accountId: rule.accountId, accountName: nameOf.get(rule.accountId) ?? '' } : null
        }
      })
      return { success: true, data }
    } catch (err) {
      return fail(err)
    }
  },

  /** Posts the journal entry a rule describes for one line and marks the line reconciled, in one step. */
  async applyToLine(p: { lineId: string; ruleId: string }, userId?: string) {
    try {
      const db = getPrisma()
      const [line, rule] = await Promise.all([
        db.bankStatementLine.findUnique({ where: { id: p.lineId } }),
        db.bankRule.findUnique({ where: { id: p.ruleId } })
      ])
      if (!line) throw new ServiceError('BANK-002', 'Statement line not found.')
      if (!rule) throw new ServiceError('BR-006', 'Rule not found.')
      if (line.reconciled) throw new ServiceError('BR-007', 'This line is already reconciled.')
      const amount = lineAmount(line)
      if (!(amount > 0)) throw new ServiceError('BR-008', 'This line has no amount.')
      const lockError = await assertNotLocked(line.transactionDate)
      if (lockError) return lockError

      const entry = await db.$transaction(async (tx) => {
        const claimed = await tx.bankStatementLine.updateMany({ where: { id: line.id, reconciled: false }, data: { reconciled: true, reconciledAt: new Date(), matchedType: 'JOURNAL_ENTRY' } })
        if (claimed.count === 0) throw new ServiceError('BR-007', 'This line is already reconciled.')
        const bankSide = await chartOfAccountsService.getSystemAccountByCode('1000', tx)
        const moneyOut = line.debitAmount > 0
        const created = await journalEntryService.postSystemEntry(tx, {
          sourceType: 'BANK_RULE', sourceId: line.id, entryDate: line.transactionDate,
          narration: `${rule.name}: ${line.description}`.slice(0, 500),
          lines: moneyOut
            ? [{ accountId: rule.accountId, bankAccountId: null, debitAmount: amount, creditAmount: 0 }, { accountId: bankSide.id, bankAccountId: line.bankAccountId, debitAmount: 0, creditAmount: amount }]
            : [{ accountId: bankSide.id, bankAccountId: line.bankAccountId, debitAmount: amount, creditAmount: 0 }, { accountId: rule.accountId, bankAccountId: null, debitAmount: 0, creditAmount: amount }]
        } as never)
        await tx.bankStatementLine.update({ where: { id: line.id }, data: { matchedId: created.id } })
        return created
      })
      await logAction({ userId, action: 'BANK_RULE_APPLIED', entityType: 'BankStatementLine', entityId: line.id, newValue: { ruleId: rule.id, entryNumber: entry.entryNumber } })
      return { success: true, data: { entryNumber: entry.entryNumber } }
    } catch (err) {
      return fail(err)
    }
  }
}
