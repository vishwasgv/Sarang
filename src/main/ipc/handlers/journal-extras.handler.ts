import { z } from 'zod'
import { processDueReversals, journalMemoService } from '../../services/journal-extras.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const MemoSchema = z.object({ title: z.string().min(1).max(120), notes: z.string().max(1000).optional(), memoDate: z.string().optional() })

export function register(handle: HandleFn): void {
  handle('journalExtras:processReversals', async () => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    return { success: true, data: await processDueReversals() }
  })

  handle('journalExtras:listMemos', async () => {
    const deny = await requirePermission('journalEntries.view'); if (deny) return deny
    return journalMemoService.list()
  })

  handle('journalExtras:addMemo', async (payload) => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    const parsed = MemoSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid memo.' } }
    return journalMemoService.add(parsed.data, getCurrentSession()?.userId)
  })

  handle('journalExtras:removeMemo', async (payload) => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a memo.' } }
    return journalMemoService.remove(id, getCurrentSession()?.userId)
  })
}
