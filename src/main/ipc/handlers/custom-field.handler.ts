import { customFieldService } from '../../services/custom-field.service'
import { CreateCustomFieldDefinitionSchema, UpdateCustomFieldDefinitionSchema, ListCustomFieldDefinitionsSchema } from '../../validation/custom-field.validation'
import { requirePermission, requireSession } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Phase 66 — Custom Fields. Listing just needs an active session (every
// logged-in user's own create/edit forms read these definitions to decide
// whether to show the inline value editor at all) — defining/managing
// fields is gated to settings.modify, the same Admin-tier permission this
// codebase already uses for other configuration-shaped changes (e.g.
// industry template switching).
export function register(handle: HandleFn): void {
  handle('customFields:list', async (payload) => {
    const deny = requireSession(); if (deny) return deny
    const parsed = ListCustomFieldDefinitionsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return customFieldService.listDefinitions(parsed.data)
  })

  handle('customFields:create', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = CreateCustomFieldDefinitionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return customFieldService.createDefinition(parsed.data, getCurrentSession()?.userId)
  })

  handle('customFields:update', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpdateCustomFieldDefinitionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return customFieldService.updateDefinition(parsed.data, getCurrentSession()?.userId)
  })
}
