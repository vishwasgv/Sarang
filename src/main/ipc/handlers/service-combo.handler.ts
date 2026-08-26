import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import * as svc from '../../services/service-combo.service'
import { CreateServiceComboSchema, UpdateServiceComboSchema, ServiceComboIdSchema } from '../../validation/service-combo.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('serviceCombo:list', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return svc.listServiceCombos(payload as Parameters<typeof svc.listServiceCombos>[0])
  })

  handle('serviceCombo:create', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = CreateServiceComboSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.createServiceCombo(parsed.data, session?.userId)
  })

  handle('serviceCombo:update', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpdateServiceComboSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.updateServiceCombo(parsed.data, session?.userId)
  })

  handle('serviceCombo:delete', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ServiceComboIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.deleteServiceCombo(parsed.data.id, session?.userId)
  })

  // Booking-form-facing: same 'billing.view' gate providerSkills:listQualified
  // already uses for the identical reason (this codebase has no dedicated
  // 'appointments.*' permission — booking is gated on billing.*).
  handle('serviceCombo:resolve', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ServiceComboIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.resolveComboServices(parsed.data.id)
  })
}
