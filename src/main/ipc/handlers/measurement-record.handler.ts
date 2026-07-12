import {
  listMeasurementRecords, getMeasurementRecord, createMeasurementRecord,
  updateMeasurementRecord, deleteMeasurementRecord
} from '../../services/measurement-record.service'
import { requirePermission } from '../permission-guard'
import { CreateMeasurementRecordSchema, UpdateMeasurementRecordSchema } from '../../validation/measurement-record.validation'

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
    const parsed = CreateMeasurementRecordSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createMeasurementRecord(parsed.data)
  })

  handle('measurementRecord:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateMeasurementRecordSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateMeasurementRecord(parsed.data)
  })

  handle('measurementRecord:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteMeasurementRecord(raw as string)
  })
}
