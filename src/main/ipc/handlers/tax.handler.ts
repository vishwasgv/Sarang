import * as taxService from '../../services/tax.service'
import { requirePermission, requireSession } from '../permission-guard'
import { CreateTaxSchema, UpdateTaxSchema } from '../../validation/tax.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('tax:list', async () => {
    const deny = requireSession(); if (deny) return deny
    return taxService.listTaxConfigurations()
  })

  handle('tax:create', async (payload) => {
    const deny = await requirePermission('settings.modifyTax'); if (deny) return deny
    const parsed = CreateTaxSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid tax data.' } }
    return taxService.createTaxConfiguration(parsed.data)
  })

  handle('tax:update', async (payload) => {
    const deny = await requirePermission('settings.modifyTax'); if (deny) return deny
    const parsed = UpdateTaxSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid tax data.' } }
    return taxService.updateTaxConfiguration(parsed.data)
  })

  handle('tax:delete', async (id) => {
    const deny = await requirePermission('settings.modifyTax'); if (deny) return deny
    const bad = validateId(id, 'tax ID'); if (bad) return bad
    return taxService.deleteTaxConfiguration(id as string)
  })
}
