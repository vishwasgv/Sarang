import { requirePermission } from '../permission-guard'
import * as svc from '../../services/appointment.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('appointments:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return svc.listAppointments(payload as Parameters<typeof svc.listAppointments>[0])
  })

  handle('appointments:getByDate', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { date } = payload as { date: string }
    return svc.getAppointmentsByDate(date)
  })

  handle('appointments:get', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getAppointment(id)
  })

  handle('appointments:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return svc.createAppointment(payload as Parameters<typeof svc.createAppointment>[0])
  })

  handle('appointments:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return svc.updateAppointment(payload as Parameters<typeof svc.updateAppointment>[0])
  })

  handle('appointments:updateStatus', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return svc.updateAppointmentStatus(payload as Parameters<typeof svc.updateAppointmentStatus>[0])
  })

  handle('appointments:delete', async (payload) => {
    const deny = await requirePermission('billing.void'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.deleteAppointment(id)
  })

  handle('appointments:stats', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return svc.getAppointmentStats()
  })

  handle('appointments:generateInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.generateAppointmentInvoice(id)
  })

  handle('appointments:generateBatchInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { ids } = payload as { ids: string[] }
    return svc.generateAppointmentBatchInvoice(ids)
  })
}
