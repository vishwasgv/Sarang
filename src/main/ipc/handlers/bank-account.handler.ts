import { bankAccountService } from '../../services/bank-account.service'
import { bankStatementService } from '../../services/bank-statement.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateBankAccountSchema, UpdateBankAccountSchema } from '../../validation/bank-account.validation'
import { ImportStatementLinesSchema, ReconcileLineSchema } from '../../validation/bank-statement.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('bankAccounts:list', async (payload) => {
    const deny = await requirePermission('bankAccounts.view'); if (deny) return deny
    return bankAccountService.listAccounts(payload as { accountType?: string; isActive?: boolean } | undefined)
  })

  handle('bankAccounts:get', async (id) => {
    const deny = await requirePermission('bankAccounts.view'); if (deny) return deny
    return bankAccountService.getAccount(id as string)
  })

  handle('bankAccounts:create', async (payload) => {
    const deny = await requirePermission('bankAccounts.manage'); if (deny) return deny
    const parsed = CreateBankAccountSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bankAccountService.createAccount(parsed.data, getCurrentSession()?.userId)
  })

  handle('bankAccounts:update', async (payload) => {
    const deny = await requirePermission('bankAccounts.manage'); if (deny) return deny
    const parsed = UpdateBankAccountSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bankAccountService.updateAccount(parsed.data, getCurrentSession()?.userId)
  })

  // ── Bank statement import + reconciliation ──
  handle('bankStatement:import', async (payload) => {
    const deny = await requirePermission('bankReconciliation.import'); if (deny) return deny
    const parsed = ImportStatementLinesSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bankStatementService.importLines(parsed.data, getCurrentSession()?.userId)
  })

  handle('bankStatement:list', async (payload) => {
    const deny = await requirePermission('bankReconciliation.view'); if (deny) return deny
    return bankStatementService.listStatementLines(payload as { bankAccountId: string; reconciled?: boolean; page?: number; limit?: number })
  })

  handle('bankStatement:autoMatch', async (payload) => {
    const deny = await requirePermission('bankReconciliation.reconcile'); if (deny) return deny
    const p = payload as { bankAccountId: string }
    return bankStatementService.autoMatch(p.bankAccountId, getCurrentSession()?.userId)
  })

  handle('bankStatement:reconcileLine', async (payload) => {
    const deny = await requirePermission('bankReconciliation.reconcile'); if (deny) return deny
    const parsed = ReconcileLineSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return bankStatementService.reconcileLine(parsed.data, getCurrentSession()?.userId)
  })

  handle('bankStatement:unreconcileLine', async (payload) => {
    const deny = await requirePermission('bankReconciliation.reconcile'); if (deny) return deny
    const p = payload as { lineId: string }
    return bankStatementService.unreconcileLine(p.lineId, getCurrentSession()?.userId)
  })

  handle('bankStatement:summary', async (payload) => {
    const deny = await requirePermission('bankReconciliation.view'); if (deny) return deny
    const p = payload as { bankAccountId: string }
    return bankStatementService.getReconciliationSummary(p.bankAccountId)
  })
}
