import { hubService, type HubGroup } from '../../services/hub.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const PERMISSION: Record<HubGroup, string> = {
  sales: 'reports.sales',
  purchases: 'reports.financial',
  accounting: 'reports.financial',
  inventory: 'reports.inventory'
}

export function register(handle: HandleFn): void {
  handle('hubs:summary', async (payload) => {
    const group = (payload as { group?: string } | undefined)?.group as HubGroup | undefined
    if (!group || !(group in PERMISSION)) return { success: false, error: { code: 'VAL-001', message: 'Unknown overview.' } }
    const deny = await requirePermission(PERMISSION[group]); if (deny) return deny
    return { success: true, data: await hubService.summary(group) }
  })
}
