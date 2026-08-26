import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 67 §9.1 — Distributor item 2: Beat-Plan Route Sequencing. A field
// rep's set visiting order per day/route — deliberately separate from the
// Shipment/ShipmentStop pair (a delivery-vehicle freight route), which is
// semantically unrelated despite a naming overlap. See schema.prisma's own
// comment on DistributorBeat for the full reasoning.

export interface DistributorBeatStopRecord {
  id: string
  customerId: string
  customerName: string
  sequenceOrder: number
}

export interface DistributorBeatRecord {
  id: string
  name: string
  repName: string
  dayOfWeek: number | null
  isActive: boolean
  stops: DistributorBeatStopRecord[]
  createdAt: string
  updatedAt: string
}

function toRecord(b: any): DistributorBeatRecord {
  return {
    id: b.id,
    name: b.name,
    repName: b.repName,
    dayOfWeek: b.dayOfWeek ?? null,
    isActive: b.isActive,
    stops: (b.stops ?? [])
      .slice()
      .sort((a: any, c: any) => a.sequenceOrder - c.sequenceOrder)
      .map((s: any) => ({ id: s.id, customerId: s.customerId, customerName: s.customer?.customerName ?? '', sequenceOrder: s.sequenceOrder })),
    createdAt: new Date(b.createdAt).toISOString(),
    updatedAt: new Date(b.updatedAt).toISOString()
  }
}

const include = { stops: { include: { customer: { select: { customerName: true } } } } }

export async function listBeats(filters?: { repName?: string; isActive?: boolean }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.repName) where.repName = filters.repName
    if (filters?.isActive !== undefined) where.isActive = filters.isActive
    const rows = await db.distributorBeat.findMany({ where, include, orderBy: { createdAt: 'desc' } })
    return { success: true, data: rows.map(toRecord) }
  } catch (e) {
    return { success: false, error: { code: 'BEAT-001', message: e instanceof Error ? e.message : 'Could not list beats.' } }
  }
}

export async function createBeat(payload: {
  name: string
  repName: string
  dayOfWeek?: number | null
  customerIds?: string[]
}, userId?: string) {
  try {
    if (!payload.name.trim()) return { success: false, error: { code: 'BEAT-002', message: 'Beat name is required.' } }
    if (!payload.repName.trim()) return { success: false, error: { code: 'BEAT-003', message: 'Rep name is required.' } }
    const db = getPrisma()
    const row = await db.$transaction(async (tx) => {
      const beat = await tx.distributorBeat.create({
        data: { name: payload.name.trim(), repName: payload.repName.trim(), dayOfWeek: payload.dayOfWeek ?? null }
      })
      const customerIds = [...new Set(payload.customerIds ?? [])]
      if (customerIds.length > 0) {
        await tx.distributorBeatStop.createMany({
          data: customerIds.map((customerId, idx) => ({ beatId: beat.id, customerId, sequenceOrder: idx }))
        })
      }
      return tx.distributorBeat.findUniqueOrThrow({ where: { id: beat.id }, include })
    })
    if (userId) await logAction(userId, 'CREATE', 'DISTRIBUTOR_BEAT', row.id, null, { name: row.name, repName: row.repName })
    return { success: true, data: toRecord(row) }
  } catch (e) {
    return { success: false, error: { code: 'BEAT_CREATE_FAIL', message: e instanceof Error ? e.message : 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateBeat(payload: { id: string; name?: string; repName?: string; dayOfWeek?: number | null; isActive?: boolean }, userId?: string) {
  try {
    const db = getPrisma()
    const old = await db.distributorBeat.findUnique({ where: { id: payload.id }, select: { name: true } })
    if (!old) return { success: false, error: { code: 'BEAT-004', message: 'Beat not found.' } }

    const data: Record<string, unknown> = {}
    if (payload.name !== undefined) data.name = payload.name.trim()
    if (payload.repName !== undefined) data.repName = payload.repName.trim()
    if ('dayOfWeek' in payload) data.dayOfWeek = payload.dayOfWeek ?? null
    if (payload.isActive !== undefined) data.isActive = payload.isActive

    const row = await db.distributorBeat.update({ where: { id: payload.id }, data, include })
    if (userId) await logAction(userId, 'UPDATE', 'DISTRIBUTOR_BEAT', payload.id, old, data)
    return { success: true, data: toRecord(row) }
  } catch (e) {
    return { success: false, error: { code: 'BEAT_UPDATE_FAIL', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' } }
  }
}

export async function deleteBeat(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const row = await db.distributorBeat.findUnique({ where: { id }, select: { name: true } })
    if (!row) return { success: false, error: { code: 'BEAT-004', message: 'Beat not found.' } }
    await db.distributorBeat.delete({ where: { id } })
    if (userId) await logAction(userId, 'DELETE', 'DISTRIBUTOR_BEAT', id, row, null)
    return { success: true }
  } catch (e) {
    return { success: false, error: { code: 'BEAT_DELETE_FAIL', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' } }
  }
}

// Appends one stop to the end of the beat's own current sequence — simpler
// and less error-prone for staff than asking them to specify a numeric
// position; reordering is a separate, explicit action below.
export async function addBeatStop(payload: { beatId: string; customerId: string }, userId?: string) {
  try {
    const db = getPrisma()
    const beat = await db.distributorBeat.findUnique({ where: { id: payload.beatId }, select: { id: true } })
    if (!beat) return { success: false, error: { code: 'BEAT-004', message: 'Beat not found.' } }
    const existing = await db.distributorBeatStop.findUnique({ where: { beatId_customerId: { beatId: payload.beatId, customerId: payload.customerId } } })
    if (existing) return { success: false, error: { code: 'BEAT-005', message: 'This customer is already on this beat.' } }

    const maxOrder = await db.distributorBeatStop.aggregate({ where: { beatId: payload.beatId }, _max: { sequenceOrder: true } })
    const nextOrder = (maxOrder._max.sequenceOrder ?? -1) + 1
    await db.distributorBeatStop.create({ data: { beatId: payload.beatId, customerId: payload.customerId, sequenceOrder: nextOrder } })
    if (userId) await logAction(userId, 'CREATE', 'DISTRIBUTOR_BEAT_STOP', payload.beatId, null, { customerId: payload.customerId, sequenceOrder: nextOrder })

    const row = await db.distributorBeat.findUniqueOrThrow({ where: { id: payload.beatId }, include })
    return { success: true, data: toRecord(row) }
  } catch (e) {
    return { success: false, error: { code: 'BEAT_STOP_ADD_FAIL', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' } }
  }
}

export async function removeBeatStop(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const stop = await db.distributorBeatStop.findUnique({ where: { id } })
    if (!stop) return { success: false, error: { code: 'BEAT-006', message: 'Beat stop not found.' } }
    await db.distributorBeatStop.delete({ where: { id } })
    if (userId) await logAction(userId, 'DELETE', 'DISTRIBUTOR_BEAT_STOP', stop.beatId, stop, null)

    const row = await db.distributorBeat.findUniqueOrThrow({ where: { id: stop.beatId }, include })
    return { success: true, data: toRecord(row) }
  } catch (e) {
    return { success: false, error: { code: 'BEAT_STOP_REMOVE_FAIL', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' } }
  }
}

// Moves one stop up (-1) or down (+1) in the sequence by swapping
// sequenceOrder with its immediate neighbour — a real reorder, not just a
// re-numbering of the whole list, so an interrupted call can't corrupt order.
export async function moveBeatStop(payload: { id: string; direction: 'UP' | 'DOWN' }, userId?: string) {
  try {
    const db = getPrisma()
    const stop = await db.distributorBeatStop.findUnique({ where: { id: payload.id } })
    if (!stop) return { success: false, error: { code: 'BEAT-006', message: 'Beat stop not found.' } }

    const siblings = await db.distributorBeatStop.findMany({ where: { beatId: stop.beatId }, orderBy: { sequenceOrder: 'asc' } })
    const idx = siblings.findIndex((s) => s.id === stop.id)
    const swapIdx = payload.direction === 'UP' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return { success: true, data: toRecord(await db.distributorBeat.findUniqueOrThrow({ where: { id: stop.beatId }, include })) }

    const other = siblings[swapIdx]
    await db.$transaction([
      db.distributorBeatStop.update({ where: { id: stop.id }, data: { sequenceOrder: other.sequenceOrder } }),
      db.distributorBeatStop.update({ where: { id: other.id }, data: { sequenceOrder: stop.sequenceOrder } })
    ])
    if (userId) await logAction(userId, 'UPDATE', 'DISTRIBUTOR_BEAT_STOP', stop.beatId, stop, { swappedWith: other.id })

    const row = await db.distributorBeat.findUniqueOrThrow({ where: { id: stop.beatId }, include })
    return { success: true, data: toRecord(row) }
  } catch (e) {
    return { success: false, error: { code: 'BEAT_STOP_MOVE_FAIL', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' } }
  }
}
