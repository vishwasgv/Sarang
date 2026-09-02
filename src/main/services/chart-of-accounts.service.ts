import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import type { CreateAccountPayload, UpdateAccountPayload } from '../validation/chart-of-accounts.validation'

// Seeded once, the first time this service is used against an install that
// has zero accounts — matches this codebase's own lazy-seed convention
// (e.g. default ExpenseCategory rows). Not run automatically on app start,
// since a fresh install's onboarding flow controls when Phase 62 features
// first get touched, same as every other opt-in module.
const SYSTEM_ACCOUNTS: Array<{ accountCode: string; accountName: string; accountType: string }> = [
  { accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET' },
  { accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET' },
  { accountCode: '1200', accountName: 'Inventory', accountType: 'ASSET' },
  { accountCode: '1500', accountName: 'Fixed Assets', accountType: 'ASSET' },
  { accountCode: '2000', accountName: 'Accounts Payable', accountType: 'LIABILITY' },
  { accountCode: '2100', accountName: 'Tax Payable', accountType: 'LIABILITY' },
  { accountCode: '2200', accountName: 'TDS Payable', accountType: 'LIABILITY' },
  { accountCode: '3000', accountName: 'Owner’s Capital', accountType: 'EQUITY' },
  { accountCode: '4000', accountName: 'Sales Revenue', accountType: 'INCOME' },
  { accountCode: '4100', accountName: 'Interest Income', accountType: 'INCOME' },
  // 2026-09 — realized FX gain/loss on settling a foreign-currency invoice/
  // bill at a different rate than it was raised at. A single account for
  // both directions (a loss just posts as a debit here instead of a
  // credit) — same convention as most small-business chart-of-accounts
  // templates, not a contrived simplification.
  { accountCode: '4200', accountName: 'Realized Exchange Gain/Loss', accountType: 'INCOME' },
  { accountCode: '5000', accountName: 'Cost of Goods Sold', accountType: 'EXPENSE' },
  { accountCode: '6000', accountName: 'Operating Expenses', accountType: 'EXPENSE' },
  { accountCode: '6100', accountName: 'Depreciation Expense', accountType: 'EXPENSE' },
]

export const chartOfAccountsService = {
  async ensureSystemAccountsSeeded(): Promise<void> {
    const db = getPrisma()
    const count = await db.chartOfAccounts.count()
    if (count > 0) return
    await db.chartOfAccounts.createMany({
      data: SYSTEM_ACCOUNTS.map((a) => ({ ...a, isSystem: true }))
    })
  },

  async listAccounts(filters?: { accountType?: string; isActive?: boolean }) {
    try {
      const db = getPrisma()
      await this.ensureSystemAccountsSeeded()
      const where: Record<string, unknown> = {}
      if (filters?.accountType) where.accountType = filters.accountType
      if (filters?.isActive !== undefined) where.isActive = filters.isActive
      const accounts = await db.chartOfAccounts.findMany({ where, orderBy: { accountCode: 'asc' } })
      return { success: true, data: accounts }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list accounts.' } }
    }
  },

  async getAccount(id: string) {
    try {
      const db = getPrisma()
      const account = await db.chartOfAccounts.findUnique({ where: { id } })
      if (!account) return { success: false, error: { code: 'COA-001', message: 'Account not found.' } }
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch account.' } }
    }
  },

  async createAccount(payload: CreateAccountPayload, userId?: string) {
    const db = getPrisma()
    try {
      const existing = await db.chartOfAccounts.findUnique({ where: { accountCode: payload.accountCode } })
      if (existing) return { success: false, error: { code: 'COA-002', message: 'An account with this code already exists.' } }
      if (payload.parentId) {
        const parent = await db.chartOfAccounts.findUnique({ where: { id: payload.parentId } })
        if (!parent) return { success: false, error: { code: 'COA-003', message: 'Parent account not found.' } }
        if (parent.accountType !== payload.accountType) {
          return { success: false, error: { code: 'COA-004', message: 'A child account must have the same account type as its parent.' } }
        }
      }
      const account = await db.chartOfAccounts.create({
        data: {
          accountCode: payload.accountCode,
          accountName: payload.accountName,
          accountType: payload.accountType,
          parentId: payload.parentId ?? null,
          isSystem: false
        }
      })
      await logAction({ userId, action: 'CHART_OF_ACCOUNTS_CREATED', entityType: 'ChartOfAccounts', entityId: account.id, newValue: payload })
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create account.' } }
    }
  },

  async updateAccount(payload: UpdateAccountPayload, userId?: string) {
    const db = getPrisma()
    try {
      const existing = await db.chartOfAccounts.findUnique({ where: { id: payload.id } })
      if (!existing) return { success: false, error: { code: 'COA-001', message: 'Account not found.' } }
      if (existing.isSystem && payload.isActive === false) {
        return { success: false, error: { code: 'COA-005', message: 'System accounts cannot be deactivated.' } }
      }
      if (payload.parentId) {
        if (payload.parentId === payload.id) return { success: false, error: { code: 'COA-006', message: 'An account cannot be its own parent.' } }
        const parent = await db.chartOfAccounts.findUnique({ where: { id: payload.parentId } })
        if (!parent) return { success: false, error: { code: 'COA-003', message: 'Parent account not found.' } }
        if (parent.accountType !== existing.accountType) {
          return { success: false, error: { code: 'COA-004', message: 'A child account must have the same account type as its parent.' } }
        }
      }
      const account = await db.chartOfAccounts.update({
        where: { id: payload.id },
        data: {
          accountName: payload.accountName,
          parentId: payload.parentId === undefined ? undefined : payload.parentId,
          isActive: payload.isActive
        }
      })
      await logAction({ userId, action: 'CHART_OF_ACCOUNTS_UPDATED', entityType: 'ChartOfAccounts', entityId: account.id, newValue: payload })
      return { success: true, data: account }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update account.' } }
    }
  },

  // Used internally by journal-entry.service.ts and every system-posting
  // caller (fixed-asset depreciation, credit interest, year-end close) to
  // resolve a well-known system account by its code without hardcoding IDs
  // (which differ per install since they're cuid()s). Throws ServiceError —
  // callers already run inside a $transaction and expect thrown errors to
  // roll it back, same convention as every other cross-service lookup.
  async getSystemAccountByCode(accountCode: string, tx?: unknown) {
    const db = (tx as ReturnType<typeof getPrisma>) ?? getPrisma()
    const account = await db.chartOfAccounts.findUnique({ where: { accountCode } })
    if (!account) throw new ServiceError('COA-007', `System account "${accountCode}" not found — has the Chart of Accounts been initialized?`)
    return account
  },

  // Same lookup as getSystemAccountByCode, but creates the account on the
  // fly if missing instead of throwing — for a system account added to
  // SYSTEM_ACCOUNTS AFTER an install already ran ensureSystemAccountsSeeded()
  // once (that seed only ever fires once, when the catalog is completely
  // empty — see its own comment), so an existing install would otherwise
  // never pick up a brand-new code like '4200' automatically. Only meant for
  // codes that ARE in SYSTEM_ACCOUNTS (throws if the code isn't a known one,
  // same as a typo would in getSystemAccountByCode).
  async getOrCreateSystemAccountByCode(accountCode: string, tx?: unknown) {
    const db = (tx as ReturnType<typeof getPrisma>) ?? getPrisma()
    const existing = await db.chartOfAccounts.findUnique({ where: { accountCode } })
    if (existing) return existing
    const def = SYSTEM_ACCOUNTS.find((a) => a.accountCode === accountCode)
    if (!def) throw new ServiceError('COA-007', `System account "${accountCode}" not found — has the Chart of Accounts been initialized?`)
    return db.chartOfAccounts.create({ data: { ...def, isSystem: true } })
  }
}
