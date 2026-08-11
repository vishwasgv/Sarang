import { chartOfAccountsService } from '../../services/chart-of-accounts.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateAccountSchema, UpdateAccountSchema } from '../../validation/chart-of-accounts.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('chartOfAccounts:list', async (payload) => {
    const deny = await requirePermission('chartOfAccounts.view'); if (deny) return deny
    return chartOfAccountsService.listAccounts(payload as { accountType?: string; isActive?: boolean } | undefined)
  })

  handle('chartOfAccounts:get', async (id) => {
    const deny = await requirePermission('chartOfAccounts.view'); if (deny) return deny
    return chartOfAccountsService.getAccount(id as string)
  })

  handle('chartOfAccounts:create', async (payload) => {
    const deny = await requirePermission('chartOfAccounts.manage'); if (deny) return deny
    const parsed = CreateAccountSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return chartOfAccountsService.createAccount(parsed.data, getCurrentSession()?.userId)
  })

  handle('chartOfAccounts:update', async (payload) => {
    const deny = await requirePermission('chartOfAccounts.manage'); if (deny) return deny
    const parsed = UpdateAccountSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return chartOfAccountsService.updateAccount(parsed.data, getCurrentSession()?.userId)
  })
}
