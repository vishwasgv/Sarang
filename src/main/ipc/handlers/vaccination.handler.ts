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
    return createVaccinationRecord(payload as Parameters<typeof createVaccinationRecord>[0])
  })

  handle('vaccinations:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    return updateVaccinationRecord(payload as Parameters<typeof updateVaccinationRecord>[0])
  })

  handle('vaccinations:delete', async (payload) => {
    const deny = await requirePermission('billing.void')
    if (deny) return deny
    const { id } = payload as { id: string }
    return deleteVaccinationRecord(id)
  })

  handle('vaccinations:createReminder', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    const { vaccinationRecordId } = payload as { vaccinationRecordId: string }
    return generateVaccineReminder(vaccinationRecordId)
  })

  handle('vaccinations:upcoming', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const p = payload as { daysAhead?: number } | undefined
    return getUpcomingVaccinations((p as { daysAhead?: number })?.daysAhead)
  })
}
