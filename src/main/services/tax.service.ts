import { getPrisma } from '../database/db'
import { refreshTaxComponentsCache } from './tax-components-cache'
import { validateTaxComponents, parseTaxComponents } from '../../shared/utils/tax-components'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import type { ApiResponse } from '../ipc/channels'
import type { CreateTaxPayload, UpdateTaxPayload } from '../validation/tax.validation'

function componentsJson(parts: Array<{ name: string; rate: number }> | undefined): string | null {
  return parts && parts.length > 0 ? JSON.stringify(parts.map((p) => ({ name: p.name.trim(), rate: p.rate }))) : null
}

export async function listTaxConfigurations(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const taxes = await db.taxConfiguration.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { taxType: 'asc' }, { rate: 'asc' }]
    })
    return { success: true, data: taxes.map((x) => ({ ...x, components: parseTaxComponents(x.components) })) }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function createTaxConfiguration(payload: CreateTaxPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()

    const partsError = validateTaxComponents(payload.rate, payload.components ?? [])
    if (partsError) return { success: false, error: { code: 'TAX-010', message: partsError } }
    // T001: Rate cannot be negative (enforced by Zod schema)
    // T002: Check for duplicate name
    const existing = await db.taxConfiguration.findFirst({ where: { taxName: { equals: payload.taxName }, isActive: true } })
    if (existing) return { success: false, error: { code: 'TAX-001', message: 'A tax configuration with this name already exists.' } }

    const tax = await db.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.taxConfiguration.updateMany({ where: { taxType: payload.taxType, isDefault: true }, data: { isDefault: false } })
      }
      return tx.taxConfiguration.create({
        data: { taxName: payload.taxName, taxType: payload.taxType, rate: payload.rate, country: payload.country, isDefault: payload.isDefault, components: componentsJson(payload.components) }
      })
    })
    void refreshTaxComponentsCache()

    await logAction({ userId: getCurrentSession()?.userId, action: 'TAX_CREATED', entityType: 'TaxConfiguration', entityId: tax.id, newValue: { taxName: payload.taxName, rate: payload.rate } })
    return { success: true, data: tax }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateTaxConfiguration(payload: UpdateTaxPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const existing = await db.taxConfiguration.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'TAX-002', message: 'Tax configuration not found.' } }
    const partsError = validateTaxComponents(payload.rate, payload.components ?? [])
    if (partsError) return { success: false, error: { code: 'TAX-010', message: partsError } }

    // Check duplicate name (exclude self)
    const duplicate = await db.taxConfiguration.findFirst({
      where: { taxName: { equals: payload.taxName }, isActive: true, id: { not: payload.id } }
    })
    if (duplicate) return { success: false, error: { code: 'TAX-001', message: 'A tax configuration with this name already exists.' } }

    const updated = await db.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.taxConfiguration.updateMany({ where: { taxType: payload.taxType, isDefault: true, id: { not: payload.id } }, data: { isDefault: false } })
      }
      return tx.taxConfiguration.update({
        where: { id: payload.id },
        data: { taxName: payload.taxName, taxType: payload.taxType, rate: payload.rate, country: payload.country, isDefault: payload.isDefault, components: componentsJson(payload.components) }
      })
    })
    void refreshTaxComponentsCache()

    await logAction({ userId: getCurrentSession()?.userId, action: 'TAX_UPDATED', entityType: 'TaxConfiguration', entityId: payload.id })
    return { success: true, data: updated }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function deleteTaxConfiguration(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    // Soft-delete (deactivate)
    await db.taxConfiguration.update({ where: { id }, data: { isActive: false } })
    void refreshTaxComponentsCache()
    await logAction({ userId: getCurrentSession()?.userId, action: 'TAX_DELETED', entityType: 'TaxConfiguration', entityId: id })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getDefaultTaxRate(): Promise<number> {
  try {
    const db = getPrisma()
    const def = await db.taxConfiguration.findFirst({ where: { isDefault: true, isActive: true } })
    return def?.rate ?? 0
  } catch {
    return 0
  }
}
