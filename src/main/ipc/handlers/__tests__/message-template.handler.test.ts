import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../permission-guard', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../services/message-template.service', () => ({
  listMessageTemplates: vi.fn(),
  updateMessageTemplate: vi.fn(),
  resetMessageTemplate: vi.fn(),
  previewMessageTemplate: vi.fn().mockReturnValue('rendered preview'),
  renderMessageTemplate: vi.fn().mockResolvedValue('rendered body'),
}))
vi.mock('../../../services/notification-queue.service', () => ({
  buildReminderWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/919876543210?text=rendered%20body'),
}))

import { requirePermission } from '../../permission-guard'
import * as svc from '../../../services/message-template.service'
import { buildReminderWhatsAppLink } from '../../../services/notification-queue.service'
import { register } from '../message-template.handler'

function captureHandlers() {
  const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()
  register((channel, handler) => { handlers.set(channel, handler) })
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requirePermission).mockResolvedValue(null) // allow, by default
})

describe('message-template.handler — permission gating', () => {
  it('list/preview/buildSendLink require messageTemplates.view (read tier)', async () => {
    const handlers = captureHandlers()
    await handlers.get('messageTemplates:list')!(undefined)
    await handlers.get('messageTemplates:preview')!({ body: 'x' })
    await handlers.get('messageTemplates:buildSendLink')!({ key: 'BLOOD_DONOR_ELIGIBLE', params: {} })
    expect(requirePermission).toHaveBeenCalledWith('messageTemplates.view')
    expect(requirePermission).not.toHaveBeenCalledWith('messageTemplates.manage')
  })

  it('update/reset require messageTemplates.manage (write tier), not just .view', async () => {
    const handlers = captureHandlers()
    await handlers.get('messageTemplates:update')!({ key: 'MEMBERSHIP_EXPIRY_7D', body: 'x' })
    await handlers.get('messageTemplates:reset')!({ key: 'MEMBERSHIP_EXPIRY_7D' })
    expect(requirePermission).toHaveBeenCalledWith('messageTemplates.manage')
  })
})

describe('message-template.handler — messageTemplates:buildSendLink', () => {
  it('rejects a template key that is not sendable (e.g. the internal retainer-invoice note)', async () => {
    const handlers = captureHandlers()

    const res = await handlers.get('messageTemplates:buildSendLink')!({ key: 'RETAINER_INVOICE_DUE_3D', phone: '9876543210', params: {} }) as { success: boolean; error?: { code: string } }

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('MSGTPL-006')
    expect(svc.renderMessageTemplate).not.toHaveBeenCalled()
  })

  it('rejects an unknown template key entirely', async () => {
    const handlers = captureHandlers()

    const res = await handlers.get('messageTemplates:buildSendLink')!({ key: 'NOT_A_REAL_KEY', phone: '9876543210', params: {} }) as { success: boolean }

    expect(res.success).toBe(false)
  })

  it('renders the body and builds a reminder-style (business-name-prefixed) wa.me link when a phone is given', async () => {
    const handlers = captureHandlers()

    const res = await handlers.get('messageTemplates:buildSendLink')!({ key: 'BLOOD_DONOR_ELIGIBLE', phone: '9876543210', params: { donorName: 'Asha' } }) as { success: boolean; data: { body: string; link: string | null } }

    expect(res.success).toBe(true)
    expect(svc.renderMessageTemplate).toHaveBeenCalledWith('BLOOD_DONOR_ELIGIBLE', { donorName: 'Asha' })
    expect(buildReminderWhatsAppLink).toHaveBeenCalledWith('9876543210', 'rendered body')
    expect(res.data.link).toBe('https://wa.me/919876543210?text=rendered%20body')
  })

  it('still renders a preview body but returns a null link when no phone is given (live preview while composing)', async () => {
    const handlers = captureHandlers()

    const res = await handlers.get('messageTemplates:buildSendLink')!({ key: 'BLOOD_DONOR_ELIGIBLE', params: { donorName: 'Asha' } }) as { success: boolean; data: { body: string; link: string | null } }

    expect(res.success).toBe(true)
    expect(res.data.body).toBe('rendered body')
    expect(res.data.link).toBeNull()
    expect(buildReminderWhatsAppLink).not.toHaveBeenCalled()
  })
})
