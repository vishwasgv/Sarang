import { z } from 'zod'
import { stockJournalService } from '../../services/stock-journal.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const CreateSchema = z.object({
  notes: z.string().max(300).optional(),
  lines: z.array(z.object({ kind: z.enum(['OUT', 'IN']), productId: z.string().min(1), quantity: z.number().finite().positive() })).min(2).max(100)
})

export function register(handle: HandleFn): void {
  handle('stockJournals:list', async () => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return stockJournalService.list()
  })

  handle('stockJournals:get', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a stock journal.' } }
    return stockJournalService.get(id)
  })

  handle('stockJournals:create', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = CreateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid stock journal.' } }
    return stockJournalService.create(parsed.data, getCurrentSession()?.userId)
  })
}
