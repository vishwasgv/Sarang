import { locationService } from '../../services/location.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateLocationSchema, UpdateLocationSchema } from '../../validation/location.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Phase 64 — Location management. locations.manage (create/update) is
// Admin-only, a structural setup action same tier as Transaction Locking;
// locations.view is Manager-tier, matching how every other view permission
// in this codebase is scoped.
export function register(handle: HandleFn): void {
  handle('locations:list', async () => {
    const deny = await requirePermission('locations.view'); if (deny) return deny
    return locationService.list()
  })

  handle('locations:hasMultipleLocations', async () => {
    const deny = await requirePermission('locations.view'); if (deny) return deny
    return locationService.hasMultipleLocations()
  })

  handle('locations:create', async (payload) => {
    const deny = await requirePermission('locations.manage'); if (deny) return deny
    const parsed = CreateLocationSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return locationService.create(parsed.data, getCurrentSession()?.userId)
  })

  handle('locations:update', async (payload) => {
    const deny = await requirePermission('locations.manage'); if (deny) return deny
    const parsed = UpdateLocationSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const { id, ...rest } = parsed.data
    return locationService.update(id, rest, getCurrentSession()?.userId)
  })
}
