import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { logAction } from './audit.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { roundCurrency } from './currency.service'
import { ServiceError } from '../errors/service-error'
import type { CloseFinancialYearPayload } from '../validation/year-end-close.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Year-End Close (Section 4.1 item 13) — archives nothing (this app never
// hard-deletes financial data), instead: (1) computes every account's real
// balance as of the closing date from actual JournalEntryLine postings —
// not a stored running total, so this is always correct even if entries
// were reversed along the way (a reversal's own mirrored lines net to zero
// against the original by construction, so summing ALL lines up to the
// closing date, reversed or not, is already correct without any extra
// filtering); (2) posts ONE opening JournalEntry that carries forward every
// non-zero ASSET/LIABILITY/EQUITY balance, folding the year's net INCOME/
// EXPENSE result into Owner's Capital (real double-entry practice — P&L
// accounts reset to zero each year, their net effect becomes retained
// earnings) rather than carrying P&L accounts forward as their own lines;
// (3) locks the closed year via the existing Transaction Locking mechanism.
async function computeAccountBalance(tx: TxClient, accountId: string, asOfDate: Date): Promise<number> {
  const agg = await tx.journalEntryLine.aggregate({
    where: { accountId, journalEntry: { entryDate: { lte: asOfDate } } },
    _sum: { debitAmount: true, creditAmount: true }
  })
  return roundCurrency((agg._sum.debitAmount ?? 0) - (agg._sum.creditAmount ?? 0))
}

export const yearEndCloseService = {
  async closeFinancialYear(payload: CloseFinancialYearPayload, userId?: string) {
    const db = getPrisma()
    try {
      const closingDate = parseLocalDateStart(payload.closingDate)
      const openingDate = new Date(closingDate.getTime() + 86400000)

      const profile = await db.businessProfile.findFirst()
      if (!profile) return { success: false, error: { code: 'BP-001', message: 'Business profile not found.' } }
      if (profile.lockDate && profile.lockDate.getTime() >= closingDate.getTime()) {
        return { success: false, error: { code: 'YE-002', message: 'This date (or a later one) has already been closed.' } }
      }

      await chartOfAccountsService.ensureSystemAccountsSeeded()

      const result = await db.$transaction(async (tx: TxClient) => {
        const accounts = await tx.chartOfAccounts.findMany({ where: { isActive: true } })
        let netIncome = 0
        const balanceSheetBalances: Array<{ accountId: string; accountCode: string; balance: number }> = []

        for (const acc of accounts) {
          const balance = await computeAccountBalance(tx, acc.id, closingDate)
          if (acc.accountType === 'INCOME' || acc.accountType === 'EXPENSE') {
            // balance = debit − credit; INCOME is normally credit-heavy
            // (negative here), EXPENSE debit-heavy (positive) — net income
            // = −(sum of both), the standard debit/credit-to-P&L relationship.
            netIncome -= balance
          } else {
            balanceSheetBalances.push({ accountId: acc.id, accountCode: acc.accountCode, balance })
          }
        }
        netIncome = roundCurrency(netIncome)

        // Fold the year's net income/loss into Owner's Capital — credit
        // (grow equity) on a profit, debit (shrink equity) on a loss. This
        // is what makes the opening entry balance by construction: the sum
        // of every account (balance-sheet + P&L) is always zero by the
        // accounting identity every prior posted entry already guaranteed,
        // so once P&L is folded into Capital instead of carried separately,
        // the balance-sheet-only total is guaranteed to net to zero too.
        const capitalIdx = balanceSheetBalances.findIndex((b) => b.accountCode === '3000')
        if (capitalIdx >= 0) {
          balanceSheetBalances[capitalIdx] = { ...balanceSheetBalances[capitalIdx], balance: roundCurrency(balanceSheetBalances[capitalIdx].balance - netIncome) }
        } else if (netIncome !== 0) {
          const capitalAccount = await chartOfAccountsService.getSystemAccountByCode('3000', tx)
          balanceSheetBalances.push({ accountId: capitalAccount.id, accountCode: '3000', balance: roundCurrency(-netIncome) })
        }

        const lines = balanceSheetBalances
          .filter((b) => Math.abs(b.balance) > 0.001)
          .map((b) => ({
            accountId: b.accountId, bankAccountId: null,
            debitAmount: b.balance > 0 ? b.balance : 0,
            creditAmount: b.balance < 0 ? -b.balance : 0
          }))

        if (lines.length === 0) {
          throw new ServiceError('YE-001', 'Nothing to carry forward — no account activity as of the closing date.')
        }

        const je = await journalEntryService.postSystemEntry(tx, {
          sourceType: 'YEAR_END_OPENING', entryDate: openingDate,
          narration: `Opening balances carried forward from year ending ${payload.closingDate}`,
          lines
        })

        await tx.businessProfile.update({ where: { id: profile.id }, data: { lockDate: closingDate } })

        return { journalEntryId: je.id, netIncome, accountsCarriedForward: lines.length }
      })

      await logAction({ userId, action: 'YEAR_END_CLOSED', entityType: 'BusinessProfile', entityId: profile.id, newValue: { closingDate: payload.closingDate, ...result } })
      return { success: true, data: result }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to close financial year.' } }
    }
  }
}
