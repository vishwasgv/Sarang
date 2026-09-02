import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { checkInCustomer, checkOutCustomer, listActiveCheckIns, listCheckIns } from '../../services/customer-checkin.service'
import { CheckInCustomerSchema, CheckInIdSchema, ListCheckInsSchema } from '../../validation/customer-checkin.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('customerCheckIn:checkIn', async (raw) => {
    const deny = await requirePermission('customerCheckIn.manage'); if (deny) return deny
    const parsed = CheckInCustomerSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return checkInCustomer(parsed.data.customerId, parsed.data.notes, getCurrentSession()?.userId)
  })

  handle('customerCheckIn:checkOut', async (raw) => {
    const deny = await requirePermission('customerCheckIn.manage'); if (deny) return deny
    const parsed = CheckInIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return checkOutCustomer(parsed.data.checkInId, getCurrentSession()?.userId)
  })

  handle('customerCheckIn:active', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listActiveCheckIns()
  })

  handle('customerCheckIn:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListCheckInsSchema.safeParse(raw ?? {})
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listCheckIns(parsed.data.dateFrom, parsed.data.dateTo, parsed.data.customerId)
  })
}
