import {
  listPestJobSheets, createPestJobSheet, updatePestJobSheet,
  deletePestJobSheet, generatePestJobInvoice,
  listJobSheetPesticides, addJobSheetPesticide, removeJobSheetPesticide
} from '../../services/pest-job-sheet.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreatePestJobSheetSchema, UpdatePestJobSheetSchema, PestJobSheetIdSchema, AddJobSheetPesticideSchema } from '../../validation/pest-job-sheet.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPestJobSheet(handle: HandleFn): void {
  handle('pestJobSheet:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listPestJobSheets(raw as Parameters<typeof listPestJobSheets>[0])
  })

  handle('pestJobSheet:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePestJobSheetSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPestJobSheet(parsed.data)
  })

  handle('pestJobSheet:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePestJobSheetSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePestJobSheet(parsed.data)
  })

  handle('pestJobSheet:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PestJobSheetIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deletePestJobSheet(parsed.data)
  })

  handle('pestJobSheet:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PestJobSheetIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generatePestJobInvoice(parsed.data)
  })

  handle('pestJobSheet:listPesticides', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = PestJobSheetIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listJobSheetPesticides(parsed.data)
  })

  handle('pestJobSheet:addPesticide', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = AddJobSheetPesticideSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addJobSheetPesticide(parsed.data, getCurrentSession()?.userId)
  })

  handle('pestJobSheet:removePesticide', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PestJobSheetIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return removeJobSheetPesticide(parsed.data, getCurrentSession()?.userId)
  })
}
