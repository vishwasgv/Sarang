import { z } from 'zod'
import { binLocationService } from '../../services/bin-location.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const ListSchema = z.object({ locationId: z.string().min(1), search: z.string().max(100).optional() })
const SetSchema = z.object({ productId: z.string().min(1), locationId: z.string().min(1), binCode: z.string().max(40) })

export function register(handle: HandleFn): void {
  handle('bins:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const parsed = ListSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a location.' } }
    return binLocationService.listForLocation(parsed.data.locationId, parsed.data.search)
  })

  handle('bins:set', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = SetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid bin.' } }
    return binLocationService.setBin(parsed.data, getCurrentSession()?.userId)
  })
}
