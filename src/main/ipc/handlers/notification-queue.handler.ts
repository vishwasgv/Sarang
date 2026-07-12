import { requirePermission } from '../permission-guard'
import * as svc from '../../services/notification-queue.service'
import { GenerateWhatsAppLinkSchema, CreateAppointmentReminderSchema } from '../../validation/notification-queue.validation'

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
    const parsed = GenerateWhatsAppLinkSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.generateWhatsAppLink(parsed.data)
  })

  handle('notificationQueue:createReminder', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateAppointmentReminderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.createAppointmentReminder(parsed.data.appointmentId)
  })
}
