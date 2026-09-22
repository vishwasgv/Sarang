import { requirePermission } from '../permission-guard'
import * as svc from '../../services/message-template.service'
import { buildReminderWhatsAppLink } from '../../services/notification-queue.service'
import { MESSAGE_TEMPLATE_DEFAULTS_BY_KEY } from '../../services/message-template.defaults'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('messageTemplates:list', async () => {
    const deny = await requirePermission('messageTemplates.view'); if (deny) return deny
    return svc.listMessageTemplates()
  })

  handle('messageTemplates:update', async (payload) => {
    const deny = await requirePermission('messageTemplates.manage'); if (deny) return deny
    const { key, body } = (payload ?? {}) as { key?: string; body?: string }
    if (typeof key !== 'string' || !key.trim() || typeof body !== 'string') {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid payload.' } }
    }
    return svc.updateMessageTemplate(key, body)
  })

  handle('messageTemplates:reset', async (payload) => {
    const deny = await requirePermission('messageTemplates.manage'); if (deny) return deny
    const { key } = (payload ?? {}) as { key?: string }
    if (typeof key !== 'string' || !key.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid payload.' } }
    }
    return svc.resetMessageTemplate(key)
  })

  // Read-only rendering aid (Settings screen "preview" for the draft currently
  // being typed, before it's saved) — same trust tier as viewing the
  // templates themselves, not the manage-only write actions above.
  handle('messageTemplates:preview', async (payload) => {
    const deny = await requirePermission('messageTemplates.view'); if (deny) return deny
    const { body } = (payload ?? {}) as { body?: string }
    if (typeof body !== 'string') {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid payload.' } }
    }
    return { success: true, data: svc.previewMessageTemplate(body) }
  })

  // Ad-hoc "pick a customer, pick a template, send" flow (Customer detail
  // screen's Send WhatsApp Message action) — renders the effective template
  // body against caller-supplied params (same substitution renderMessageTemplate
  // uses for every scheduled reminder) and builds the same reminder-style
  // wa.me link (business-name-prefixed, via buildReminderWhatsAppLink) a
  // scheduled reminder would produce. Same .view trust tier as preview above:
  // this only builds a link and renders text, it queues/sends nothing itself
  // — the renderer still has to click through to actually open WhatsApp,
  // same "always in control" pattern as every other Share/Reminder button.
  handle('messageTemplates:buildSendLink', async (payload) => {
    const deny = await requirePermission('messageTemplates.view'); if (deny) return deny
    const { key, phone, params } = (payload ?? {}) as { key?: string; phone?: string; params?: Record<string, string> }
    if (typeof key !== 'string' || !key.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid payload.' } }
    }
    const def = MESSAGE_TEMPLATE_DEFAULTS_BY_KEY[key]
    if (!def || !def.sendable) {
      return { success: false, error: { code: 'MSGTPL-006', message: 'This template is not sendable to a customer.' } }
    }
    const body = await svc.renderMessageTemplate(key, params ?? {})
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : ''
    const link = trimmedPhone ? await buildReminderWhatsAppLink(trimmedPhone, body) : null
    return { success: true, data: { body, link } }
  })
}
