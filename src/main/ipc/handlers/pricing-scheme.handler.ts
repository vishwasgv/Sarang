import { pricingSchemeService } from '../../services/pricing-scheme.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreatePricingSchemeSchema, UpdatePricingSchemeSchema, EvaluateCartSchema } from '../../validation/pricing-scheme.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('pricingSchemes:list', async (payload) => {
    const deny = await requirePermission('pricingSchemes.view'); if (deny) return deny
    return pricingSchemeService.listPricingSchemes(payload as { isActive?: boolean; productId?: string } | undefined)
  })

  handle('pricingSchemes:create', async (payload) => {
    const deny = await requirePermission('pricingSchemes.manage'); if (deny) return deny
    const parsed = CreatePricingSchemeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return pricingSchemeService.createPricingScheme(parsed.data, getCurrentSession()?.userId)
  })

  handle('pricingSchemes:update', async (payload) => {
    const deny = await requirePermission('pricingSchemes.manage'); if (deny) return deny
    const parsed = UpdatePricingSchemeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return pricingSchemeService.updatePricingScheme(parsed.data, getCurrentSession()?.userId)
  })

  handle('pricingSchemes:delete', async (id) => {
    const deny = await requirePermission('pricingSchemes.manage'); if (deny) return deny
    const bad = validateId(id, 'pricing scheme ID'); if (bad) return bad
    return pricingSchemeService.deletePricingScheme(id as string, getCurrentSession()?.userId)
  })

  handle('pricingSchemes:evaluateCart', async (payload) => {
    const deny = await requirePermission('pricingSchemes.resolve'); if (deny) return deny
    const parsed = EvaluateCartSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return pricingSchemeService.evaluateCart(parsed.data)
  })
}
