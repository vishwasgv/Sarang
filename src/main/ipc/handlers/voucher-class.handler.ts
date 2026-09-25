import { z } from 'zod'
import { voucherClassService } from '../../services/voucher-class.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const SaveSchema = z.object({
  name: z.string().min(1).max(80),
  narration: z.string().max(500).optional(),
  lines: z.array(z.object({ accountId: z.string().min(1), side: z.enum(['DEBIT', 'CREDIT']), remarks: z.string().max(300).optional() })).min(2).max(30)
})

export function register(handle: HandleFn): void {
  handle('voucherClasses:list', async () => {
    const deny = await requirePermission('journalEntries.view'); if (deny) return deny
    return voucherClassService.list()
  })

  handle('voucherClasses:save', async (payload) => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    const parsed = SaveSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid template.' } }
    return voucherClassService.save(parsed.data, getCurrentSession()?.userId)
  })

  handle('voucherClasses:remove', async (payload) => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a template.' } }
    return voucherClassService.remove(id, getCurrentSession()?.userId)
  })
}
