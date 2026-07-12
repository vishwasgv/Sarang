import * as auditService from '../../services/audit.service'
import * as notificationService from '../../services/notification.service'
import { requirePermission, requireSession } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('audit:list', async (payload) => {
    const deny = await requirePermission('audit.view'); if (deny) return deny
    const filters = (payload as { userId?: string; entityType?: string; limit?: number; offset?: number }) ?? {}
    const logs = await auditService.getAuditLogs(filters)
    return { success: true, data: logs }
  })

  handle('audit:verifyChain', async () => {
    const deny = await requirePermission('audit.view'); if (deny) return deny
    const result = await auditService.verifyAuditLogChain()
    return { success: true, data: result }
  })

  handle('notifications:list', async () => {
    const deny = requireSession(); if (deny) return deny
    return notificationService.getNotifications()
  })

  handle('notifications:getUnreadCount', async () => {
    const deny = requireSession(); if (deny) return deny
    return notificationService.getUnreadCount()
  })

  handle('notifications:markRead', async (id) => {
    const deny = requireSession(); if (deny) return deny
    if (typeof id !== 'string' || !id) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid notification ID.' } }
    }
    return notificationService.markRead(id)
  })

  handle('notifications:markAllRead', async () => {
    const deny = requireSession(); if (deny) return deny
    return notificationService.markAllRead()
  })
}
