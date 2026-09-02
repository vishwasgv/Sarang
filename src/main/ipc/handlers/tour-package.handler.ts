import { tourPackageService } from '../../services/tour-package.service'
import { requirePermission } from '../permission-guard'
import { CreateTourPackageSchema, UpdateTourPackageStatusSchema, CreateTourDepartureSchema, UpdateTourDepartureStatusSchema } from '../../validation/tour-package.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// 2026-09 §12 — Tours & Travels: tour package templates + departures.
export function register(handle: HandleFn): void {
  handle('tourPackage:list', async (payload) => {
    const deny = await requirePermission('tourPackage.view'); if (deny) return deny
    return tourPackageService.listTourPackages(payload as Parameters<typeof tourPackageService.listTourPackages>[0])
  })

  handle('tourPackage:create', async (payload) => {
    const deny = await requirePermission('tourPackage.manage'); if (deny) return deny
    const parsed = CreateTourPackageSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return tourPackageService.createTourPackage(parsed.data)
  })

  handle('tourPackage:updateStatus', async (payload) => {
    const deny = await requirePermission('tourPackage.manage'); if (deny) return deny
    const parsed = UpdateTourPackageStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return tourPackageService.updateTourPackageStatus(parsed.data.id, parsed.data.isActive)
  })

  handle('tourPackage:listDepartures', async (payload) => {
    const deny = await requirePermission('tourPackage.view'); if (deny) return deny
    return tourPackageService.listTourDepartures(payload as Parameters<typeof tourPackageService.listTourDepartures>[0])
  })

  handle('tourPackage:createDeparture', async (payload) => {
    const deny = await requirePermission('tourPackage.manage'); if (deny) return deny
    const parsed = CreateTourDepartureSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return tourPackageService.createTourDeparture(parsed.data)
  })

  handle('tourPackage:updateDepartureStatus', async (payload) => {
    const deny = await requirePermission('tourPackage.manage'); if (deny) return deny
    const parsed = UpdateTourDepartureStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return tourPackageService.updateTourDepartureStatus(parsed.data.id, parsed.data.status)
  })
}
