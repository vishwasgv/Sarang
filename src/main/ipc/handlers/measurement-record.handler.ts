import {
  listMeasurementRecords, getMeasurementRecord, createMeasurementRecord,
  updateMeasurementRecord, deleteMeasurementRecord
} from '../../services/measurement-record.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerMeasurementRecord(handle: HandleFn): void {
  handle('measurementRecord:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listMeasurementRecords(raw as string)
  })

  handle('measurementRecord:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getMeasurementRecord(raw as string)
  })

  handle('measurementRecord:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createMeasurementRecord(raw as Parameters<typeof createMeasurementRecord>[0])
  })

  handle('measurementRecord:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateMeasurementRecord(raw as Parameters<typeof updateMeasurementRecord>[0])
  })

  handle('measurementRecord:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteMeasurementRecord(raw as string)
  })
}
