import { requirePermission } from '../permission-guard'
import * as svc from '../../services/notification-queue.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('notificationQueue:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return svc.listNotifications(payload as Parameters<typeof svc.listNotifications>[0])
  })

  handle('notificationQueue:getUnsentCount', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return svc.getUnsentCount()
  })

  handle('notificationQueue:markSent', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.markNotificationSent(id)
  })

  handle('notificationQueue:dismiss', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.dismissNotification(id)
  })

  handle('notificationQueue:generateWhatsAppLink', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return svc.generateWhatsAppLink(payload as Parameters<typeof svc.generateWhatsAppLink>[0])
  })

  handle('notificationQueue:createReminder', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { appointmentId } = payload as { appointmentId: string }
    return svc.createAppointmentReminder(appointmentId)
  })
}
