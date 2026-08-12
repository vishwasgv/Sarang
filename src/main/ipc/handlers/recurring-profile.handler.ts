import { recurringProfileService } from '../../services/recurring-profile.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateRecurringProfileSchema, UpdateRecurringProfileSchema } from '../../validation/recurring-profile.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('recurringProfiles:list', async (payload) => {
    const deny = await requirePermission('recurringProfiles.view'); if (deny) return deny
    return recurringProfileService.listRecurringProfiles(payload as { documentType?: string; active?: boolean } | undefined)
  })

  handle('recurringProfiles:get', async (id) => {
    const deny = await requirePermission('recurringProfiles.view'); if (deny) return deny
    const bad = validateId(id, 'recurring profile ID'); if (bad) return bad
    return recurringProfileService.getRecurringProfile(id as string)
  })

  handle('recurringProfiles:create', async (payload) => {
    const deny = await requirePermission('recurringProfiles.manage'); if (deny) return deny
    const parsed = CreateRecurringProfileSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return recurringProfileService.createRecurringProfile(parsed.data, getCurrentSession()?.userId)
  })

  handle('recurringProfiles:update', async (payload) => {
    const deny = await requirePermission('recurringProfiles.manage'); if (deny) return deny
    const parsed = UpdateRecurringProfileSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return recurringProfileService.updateRecurringProfile(parsed.data, getCurrentSession()?.userId)
  })

  handle('recurringProfiles:delete', async (id) => {
    const deny = await requirePermission('recurringProfiles.manage'); if (deny) return deny
    const bad = validateId(id, 'recurring profile ID'); if (bad) return bad
    return recurringProfileService.deleteRecurringProfile(id as string, getCurrentSession()?.userId)
  })
}
