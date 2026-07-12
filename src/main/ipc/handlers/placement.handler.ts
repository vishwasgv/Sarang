import {
  listPlacements, getPlacement, createPlacement, updatePlacement,
  deletePlacement, generatePlacementInvoice, getPlacementKPIs
} from '../../services/placement.service'
import { requirePermission } from '../permission-guard'
import { CreatePlacementSchema, UpdatePlacementSchema, PlacementIdSchema } from '../../validation/placement.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPlacement(handle: HandleFn): void {
  handle('placement:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listPlacements(raw as Parameters<typeof listPlacements>[0])
  })

  handle('placement:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPlacement(raw as string)
  })

  handle('placement:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePlacementSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPlacement(parsed.data)
  })

  handle('placement:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePlacementSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePlacement(parsed.data)
  })

  handle('placement:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PlacementIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deletePlacement(parsed.data)
  })

  handle('placement:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PlacementIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generatePlacementInvoice(parsed.data)
  })

  handle('placement:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPlacementKPIs()
  })
}
