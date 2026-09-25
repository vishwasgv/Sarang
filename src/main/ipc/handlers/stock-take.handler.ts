import { z } from 'zod'
import { stockTakeService } from '../../services/stock-take.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const StartSchema = z.object({ notes: z.string().max(300).optional(), categoryId: z.string().min(1).optional() })
const CountsSchema = z.object({
  id: z.string().min(1),
  counts: z.array(z.object({ lineId: z.string().min(1), countedQty: z.number().finite().nullable() })).min(1).max(5000)
})
const IdSchema = z.object({ id: z.string().min(1) })

export function register(handle: HandleFn): void {
  handle('stockTakes:list', async () => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return stockTakeService.list()
  })

  handle('stockTakes:get', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const parsed = IdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a stock count.' } }
    return stockTakeService.get(parsed.data.id)
  })

  handle('stockTakes:start', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = StartSchema.safeParse(payload ?? {})
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload.' } }
    return stockTakeService.start(parsed.data, getCurrentSession()?.userId)
  })

  handle('stockTakes:setCounts', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = CountsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid counts.' } }
    return stockTakeService.setCounts(parsed.data.id, parsed.data.counts)
  })

  handle('stockTakes:post', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = IdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a stock count.' } }
    return stockTakeService.post(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('stockTakes:cancel', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = IdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a stock count.' } }
    return stockTakeService.cancel(parsed.data.id, getCurrentSession()?.userId)
  })
}
