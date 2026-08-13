import type { Prisma } from '@prisma/client'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'

type Tx = Prisma.TransactionClient

// Phase 64 — every install always has exactly one Location with
// isDefault=true, guaranteed by the 20260813130000_phase64_location_backfill
// migration (runs on every install, upgrade or fresh, unconditionally of
// whether there's any pre-existing Inventory data to back-fill). Callers
// never need to defensively create one at runtime.
export async function getDefaultLocationId(tx?: Tx): Promise<string> {
  const db = tx ?? getPrisma()
  const location = await db.location.findFirst({ where: { isDefault: true } })
  if (!location) throw new ServiceError('LOC-001', 'No default Location configured — this should never happen after the Phase 64 migration.')
  return location.id
}

export const locationService = {
  async list() {
    const db = getPrisma()
    const locations = await db.location.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] })
    return { success: true, data: locations }
  },

  // Whether a business has ever created a second Location — the UI's own
  // signal for "show the location picker at all." A single-location
  // install (the overwhelming majority) never sees it.
  async hasMultipleLocations() {
    const db = getPrisma()
    const count = await db.location.count({ where: { isActive: true } })
    return { success: true, data: count > 1 }
  },

  async create(payload: { name: string; address?: string }, userId?: string) {
    const db = getPrisma()
    const trimmed = payload.name.trim()
    if (!trimmed) return { success: false, error: { code: 'LOC-003', message: 'Location name is required.' } }
    const created = await db.location.create({ data: { name: trimmed, address: payload.address ?? null } })
    await logAction({ userId, action: 'LOCATION_CREATE', entityType: 'Location', entityId: created.id, newValue: created })
    return { success: true, data: created }
  },

  async update(id: string, payload: { name?: string; address?: string; isActive?: boolean }, userId?: string) {
    const db = getPrisma()
    const existing = await db.location.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'LOC-002', message: 'Location not found.' } }
    // The default Location can be renamed but never deactivated — every
    // addStockTx/reduceStockTx/adjustStock call that omits an explicit
    // locationId falls back to it, so deactivating it would silently break
    // ordinary single-location stock operations.
    if (existing.isDefault && payload.isActive === false) {
      return { success: false, error: { code: 'LOC-004', message: 'The default location cannot be deactivated.' } }
    }
    const data: Record<string, unknown> = {}
    if (payload.name !== undefined) data.name = payload.name.trim()
    if (payload.address !== undefined) data.address = payload.address
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    const updated = await db.location.update({ where: { id }, data })
    await logAction({ userId, action: 'LOCATION_UPDATE', entityType: 'Location', entityId: id, oldValue: existing, newValue: updated })
    return { success: true, data: updated }
  },

  async getStockByLocation(productId: string) {
    const db = getPrisma()
    const rows = await db.locationStock.findMany({
      where: { productId },
      include: { location: { select: { id: true, name: true, isDefault: true } } },
      orderBy: { location: { name: 'asc' } }
    })
    return { success: true, data: rows }
  }
}
