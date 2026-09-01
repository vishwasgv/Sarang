import { createJobSiteAccount, listJobSiteAccounts, getJobSiteAccountBalance, updateJobSiteAccount, closeJobSiteAccount } from '../../services/job-site-account.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateJobSiteAccountSchema, UpdateJobSiteAccountSchema } from '../../validation/job-site-account.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('jobSiteAccount:list', async (payload) => {
    const deny = await requirePermission('jobSiteAccount.view'); if (deny) return deny
    return listJobSiteAccounts(payload as Parameters<typeof listJobSiteAccounts>[0])
  })

  handle('jobSiteAccount:create', async (payload) => {
    const deny = await requirePermission('jobSiteAccount.manage'); if (deny) return deny
    const parsed = CreateJobSiteAccountSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createJobSiteAccount({ ...parsed.data, createdById: session?.userId })
  })

  handle('jobSiteAccount:balance', async (payload) => {
    const deny = await requirePermission('jobSiteAccount.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return getJobSiteAccountBalance(id)
  })

  handle('jobSiteAccount:update', async (payload) => {
    const deny = await requirePermission('jobSiteAccount.manage'); if (deny) return deny
    const parsed = UpdateJobSiteAccountSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const { id, ...rest } = parsed.data
    return updateJobSiteAccount(id, rest)
  })

  handle('jobSiteAccount:close', async (payload) => {
    const deny = await requirePermission('jobSiteAccount.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    return closeJobSiteAccount(id)
  })
}
