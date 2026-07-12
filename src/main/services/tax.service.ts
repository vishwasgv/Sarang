import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import type { ApiResponse } from '../ipc/channels'
import type { CreateTaxPayload, UpdateTaxPayload } from '../validation/tax.validation'

export async function listTaxConfigurations(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const taxes = await db.taxConfiguration.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { taxType: 'asc' }, { rate: 'asc' }]
    })
    return { success: true, data: taxes }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function createTaxConfiguration(payload: CreateTaxPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()

    // T001: Rate cannot be negative (enforced by Zod schema)
    // T002: Check for duplicate name
    const existing = await db.taxConfiguration.findFirst({ where: { taxName: { equals: payload.taxName }, isActive: true } })
    if (existing) return { success: false, error: { code: 'TAX-001', message: 'A tax configuration with this name already exists.' } }

    const tax = await db.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.taxConfiguration.updateMany({ where: { taxType: payload.taxType, isDefault: true }, data: { isDefault: false } })
      }
      return tx.taxConfiguration.create({
        data: { taxName: payload.taxName, taxType: payload.taxType, rate: payload.rate, country: payload.country, isDefault: payload.isDefault }
      })
    })

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
        data: { taxName: payload.taxName, taxType: payload.taxType, rate: payload.rate, country: payload.country, isDefault: payload.isDefault }
      })
    })

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
