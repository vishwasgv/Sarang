import {
  listCarJobCards, getCarJobCard, createCarJobCard, updateCarJobCard,
  deleteCarJobCard, generateCarJobInvoice, getCarJobCardKPIs,
  getVehicleServiceHistory, listVehiclesDueForService, scheduleNextServiceReminder
} from '../../services/car-job-card.service'
import { requirePermission } from '../permission-guard'
import {
  CarJobCardIdSchema, CreateCarJobCardSchema, UpdateCarJobCardSchema,
  VehicleServiceHistorySchema, ListVehiclesDueForServiceSchema, ScheduleNextServiceReminderSchema
} from '../../validation/car-job-card.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerCarJobCard(handle: HandleFn): void {
  handle('carJobCard:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listCarJobCards(raw as Parameters<typeof listCarJobCards>[0])
  })

  handle('carJobCard:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getCarJobCard(raw as string)
  })

  handle('carJobCard:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateCarJobCardSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createCarJobCard(parsed.data)
  })

  handle('carJobCard:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateCarJobCardSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateCarJobCard(parsed.data)
  })

  handle('carJobCard:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CarJobCardIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteCarJobCard(parsed.data)
  })

  handle('carJobCard:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CarJobCardIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateCarJobInvoice(parsed.data)
  })

  handle('carJobCard:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getCarJobCardKPIs()
  })

  handle('carJobCard:vehicleHistory', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = VehicleServiceHistorySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getVehicleServiceHistory(parsed.data.vehicleNumber)
  })

  handle('carJobCard:vehiclesDueForService', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListVehiclesDueForServiceSchema.safeParse(raw ?? {})
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listVehiclesDueForService(parsed.data.dueSoonDays)
  })

  handle('carJobCard:scheduleServiceReminder', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = ScheduleNextServiceReminderSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return scheduleNextServiceReminder(parsed.data.jobCardId, parsed.data.daysBefore)
  })
}
