import { requirePermission } from '../permission-guard'
import {
  listShootBookings,
  getShootBooking,
  createShootBooking,
  updateShootBooking,
  deleteShootBooking,
  getShootKPIs,
  generateShootInvoice,
} from '../../services/shoot-booking.service'
import { CreateShootBookingSchema, UpdateShootBookingSchema, ShootBookingIdSchema } from '../../validation/shoot-booking.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerShootBooking(handle: HandleFn): void {
  handle('shootBooking:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; clientId?: string; search?: string }
    return listShootBookings(payload)
  })

  handle('shootBooking:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getShootBooking(raw as string)
  })

  handle('shootBooking:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateShootBookingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createShootBooking(parsed.data)
  })

  handle('shootBooking:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateShootBookingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateShootBooking(parsed.data)
  })

  handle('shootBooking:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = ShootBookingIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteShootBooking(parsed.data)
  })

  handle('shootBooking:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getShootKPIs()
  })

  handle('shootBooking:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = ShootBookingIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateShootInvoice(parsed.data)
  })
}
