import { requirePermission } from '../permission-guard'
import {
  listVaccinationRecords,
  getVaccinationRecord,
  createVaccinationRecord,
  updateVaccinationRecord,
  deleteVaccinationRecord,
  generateVaccineReminder,
  getUpcomingVaccinations,
} from '../../services/vaccination.service'
import {
  CreateVaccinationRecordSchema,
  UpdateVaccinationRecordSchema,
  DeleteVaccinationRecordSchema,
  CreateVaccineReminderSchema,
} from '../../validation/vaccination.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('vaccinations:list', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const { petId } = payload as { petId: string }
    return listVaccinationRecords(petId)
  })

  handle('vaccinations:get', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const { id } = payload as { id: string }
    return getVaccinationRecord(id)
  })

  handle('vaccinations:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    const parsed = CreateVaccinationRecordSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createVaccinationRecord(parsed.data)
  })

  handle('vaccinations:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    const parsed = UpdateVaccinationRecordSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateVaccinationRecord(parsed.data)
  })

  handle('vaccinations:delete', async (payload) => {
    const deny = await requirePermission('billing.void')
    if (deny) return deny
    const parsed = DeleteVaccinationRecordSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteVaccinationRecord(parsed.data.id)
  })

  handle('vaccinations:createReminder', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    const parsed = CreateVaccineReminderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateVaccineReminder(parsed.data.vaccinationRecordId)
  })

  handle('vaccinations:upcoming', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const p = payload as { daysAhead?: number } | undefined
    return getUpcomingVaccinations((p as { daysAhead?: number })?.daysAhead)
  })
}
