import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import type { CreateReservationPayload, ListReservationsPayload } from '../validation/reservation.validation'

// Phase 58 §2 (2026-07-21) — replaces the old bare "RESERVED" status string
// on RestaurantTable (zero persisted metadata) with a real record: who's
// coming, when, for how many, and an optional pre-assigned table. Kept
// deliberately separate from the table↔order binding used for merge/split
// (RestaurantTable.currentInvoiceId) — a reservation is a front-of-house
// scheduling record, not itself a running bill.

export async function createReservation(payload: CreateReservationPayload, userId?: string) {
  try {
    const db = getPrisma()
    if (payload.tableId) {
      const table = await db.restaurantTable.findUnique({ where: { id: payload.tableId } })
      if (!table) return { success: false, error: { code: 'RSV-001', message: 'Table not found.' } }
    }

    const reservation = await db.reservation.create({
      data: {
        customerName: payload.customerName.trim(),
        phone: payload.phone.trim(),
        partySize: payload.partySize,
        reservedFor: new Date(payload.reservedFor),
        tableId: payload.tableId ?? null,
        notes: payload.notes ?? null,
      },
      include: { table: { select: { id: true, tableNumber: true, tableName: true } } }
    })
    await logAction(userId, 'RESERVATION_CREATED', 'Reservation', reservation.id)
    return { success: true, data: reservation }
  } catch (err) {
    return { success: false, error: { code: 'RSV-002', message: err instanceof Error ? err.message : 'Could not create reservation.' } }
  }
}

export async function listReservations(filters?: ListReservationsPayload) {
  try {
    const db = getPrisma()
    const reservations = await db.reservation.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.dateFrom || filters?.dateTo ? {
          reservedFor: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo + 'T23:59:59.999') } : {}),
          }
        } : {}),
      },
      include: { table: { select: { id: true, tableNumber: true, tableName: true } } },
      orderBy: { reservedFor: 'asc' },
    })
    return { success: true, data: reservations }
  } catch (err) {
    return { success: false, error: { code: 'RSV-003', message: err instanceof Error ? err.message : 'Could not list reservations.' } }
  }
}

export async function updateReservationStatus(id: string, status: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.reservation.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'RSV-004', message: 'Reservation not found.' } }
    if (existing.status === 'CANCELLED' || existing.status === 'NO_SHOW') {
      return { success: false, error: { code: 'RSV-005', message: `Cannot change status of a ${existing.status.toLowerCase().replace('_', ' ')} reservation.` } }
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: { status },
      include: { table: { select: { id: true, tableNumber: true, tableName: true } } }
    })

    // Seating marks the physical table occupied — a real order/invoice is
    // opened separately from Billing (which is what sets
    // RestaurantTable.currentInvoiceId); this only reflects that the party
    // has arrived and sat down.
    if (status === 'SEATED' && existing.tableId) {
      await db.restaurantTable.update({ where: { id: existing.tableId }, data: { status: 'OCCUPIED' } })
    }

    await logAction(userId, 'RESERVATION_STATUS_UPDATED', 'Reservation', id, existing.status, status)
    return { success: true, data: reservation }
  } catch (err) {
    return { success: false, error: { code: 'RSV-006', message: err instanceof Error ? err.message : 'Could not update reservation.' } }
  }
}

export async function deleteReservation(id: string, userId?: string) {
  try {
    const db = getPrisma()
    await db.reservation.delete({ where: { id } })
    await logAction(userId, 'RESERVATION_DELETED', 'Reservation', id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RSV-007', message: err instanceof Error ? err.message : 'Could not delete reservation.' } }
  }
}

// Table cards on RestaurantTablesScreen show an upcoming-reservation badge
// (e.g. "Reserved 7:30 PM") — this returns just the next CONFIRMED
// reservation per table within the given lookahead window, not full history.
export async function getUpcomingReservationsByTable(withinHours = 3) {
  try {
    const db = getPrisma()
    const now = new Date()
    const cutoff = new Date(now.getTime() + withinHours * 60 * 60 * 1000)
    const reservations = await db.reservation.findMany({
      where: { status: 'CONFIRMED', tableId: { not: null }, reservedFor: { gte: now, lte: cutoff } },
      orderBy: { reservedFor: 'asc' },
      select: { id: true, tableId: true, customerName: true, partySize: true, reservedFor: true },
    })
    const byTable = new Map<string, typeof reservations[number]>()
    for (const r of reservations) {
      if (r.tableId && !byTable.has(r.tableId)) byTable.set(r.tableId, r)
    }
    return { success: true, data: Object.fromEntries(byTable) }
  } catch (err) {
    return { success: false, error: { code: 'RSV-008', message: err instanceof Error ? err.message : 'Could not load upcoming reservations.' } }
  }
}
