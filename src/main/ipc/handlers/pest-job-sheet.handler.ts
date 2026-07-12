import {
  listPestJobSheets, createPestJobSheet, updatePestJobSheet,
  deletePestJobSheet, generatePestJobInvoice
} from '../../services/pest-job-sheet.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPestJobSheet(handle: HandleFn): void {
  handle('pestJobSheet:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listPestJobSheets(raw as Parameters<typeof listPestJobSheets>[0])
  })

  handle('pestJobSheet:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createPestJobSheet(raw as Parameters<typeof createPestJobSheet>[0])
  })

  handle('pestJobSheet:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updatePestJobSheet(raw as Parameters<typeof updatePestJobSheet>[0])
  })

  handle('pestJobSheet:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deletePestJobSheet(raw as string)
  })

  handle('pestJobSheet:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return generatePestJobInvoice(raw as string)
  })
}
