import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { createReservation, listReservations, updateReservationStatus, deleteReservation, getUpcomingReservationsByTable } from '../../services/reservation.service'
import { CreateReservationSchema, UpdateReservationStatusSchema, ListReservationsSchema, EntityIdSchema } from '../../validation/reservation.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerReservations(handle: HandleFn): void {
  handle('reservations:create', async (raw) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = CreateReservationSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createReservation(parsed.data, getCurrentSession()?.userId)
  })

  handle('reservations:list', async (raw) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = ListReservationsSchema.safeParse(raw ?? {})
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listReservations(parsed.data)
  })

  handle('reservations:updateStatus', async (raw) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = UpdateReservationStatusSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateReservationStatus(parsed.data.id, parsed.data.status, getCurrentSession()?.userId)
  })

  handle('reservations:delete', async (raw) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteReservation(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('reservations:upcomingByTable', async (raw) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const { withinHours } = (raw ?? {}) as { withinHours?: number }
    return getUpcomingReservationsByTable(withinHours)
  })
}
