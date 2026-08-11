import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import type { CreateBankAccountPayload, UpdateBankAccountPayload } from '../validation/bank-account.validation'

export const bankAccountService = {
  async listAccounts(filters?: { accountType?: string; isActive?: boolean }) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (filters?.accountType) where.accountType = filters.accountType
      if (filters?.isActive !== undefined) where.isActive = filters.isActive
      const accounts = await db.bankAccount.findMany({ where, orderBy: { accountName: 'asc' } })
      return { success: true, data: accounts }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list bank accounts.' } }
    }
  },

  async getAccount(id: string) {
    try {
      const db = getPrisma()
      const account = await db.bankAccount.findUnique({ where: { id } })
      if (!account) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch bank account.' } }
    }
  },

  // A non-zero opening balance posts a one-time balancing JournalEntry
  // (Debit the bank-linked line / Credit Owner's Capital) atomically at
  // creation, same reasoning Supplier.openingBalance already established in
  // Phase 61 — a bank account with real pre-existing funds is correct from
  // day one, not silently starting the books out of balance.
  async createAccount(payload: CreateBankAccountPayload, userId?: string) {
    const db = getPrisma()
    try {
      const account = await db.$transaction(async (tx) => {
        const created = await tx.bankAccount.create({
          data: {
            accountName: payload.accountName,
            accountType: payload.accountType,
            bankName: payload.bankName ?? null,
            accountNumberMasked: payload.accountNumberMasked ?? null,
            ifscCode: payload.ifscCode ?? null,
            currencyCode: payload.currencyCode ?? 'INR',
            openingBalance: payload.openingBalance,
            // Starts at 0, not payload.openingBalance — the opening-balance
            // JournalEntry line below (bankAccountId set) is what actually
            // moves currentBalance, via journal-entry.service.ts's own
            // applyBankBalanceDeltas. Setting it here too double-counted the
            // opening balance (found live: a real ₹15,000 opening balance
            // landed as ₹30,000 in currentBalance) — applyBankBalanceDeltas
            // must be the single source of truth for this field, never set
            // directly alongside it.
            currentBalance: 0,
            notes: payload.notes ?? null
          }
        })

        if (payload.openingBalance > 0) {
          const cashAccount = await chartOfAccountsService.getSystemAccountByCode('1000', tx)
          const capitalAccount = await chartOfAccountsService.getSystemAccountByCode('3000', tx)
          await journalEntryService.postSystemEntry(tx, {
            sourceType: 'BANK_ACCOUNT_OPENING', sourceId: created.id, narration: `Opening balance for ${created.accountName}`,
            lines: [
              { accountId: cashAccount.id, bankAccountId: created.id, debitAmount: payload.openingBalance, creditAmount: 0 },
              { accountId: capitalAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: payload.openingBalance }
            ]
          })
        }

        return created
      })

      await logAction({ userId, action: 'BANK_ACCOUNT_CREATED', entityType: 'BankAccount', entityId: account.id, newValue: { accountName: account.accountName, accountType: account.accountType, openingBalance: account.openingBalance } })
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create bank account.' } }
    }
  },

  async updateAccount(payload: UpdateBankAccountPayload, userId?: string) {
    const db = getPrisma()
    try {
      const existing = await db.bankAccount.findUnique({ where: { id: payload.id } })
      if (!existing) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }

      const account = await db.bankAccount.update({
        where: { id: payload.id },
        data: {
          accountName: payload.accountName,
          bankName: payload.bankName,
          accountNumberMasked: payload.accountNumberMasked,
          ifscCode: payload.ifscCode,
          notes: payload.notes,
          isActive: payload.isActive
        }
      })

      await logAction({ userId, action: 'BANK_ACCOUNT_UPDATED', entityType: 'BankAccount', entityId: account.id, newValue: payload })
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update bank account.' } }
    }
  }
}
