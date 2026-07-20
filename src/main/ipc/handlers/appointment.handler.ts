import { requirePermission } from '../permission-guard'
import * as svc from '../../services/appointment.service'
import {
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  UpdateAppointmentStatusSchema,
  AppointmentIdSchema,
  GenerateAppointmentBatchInvoiceSchema,
  GenerateAppointmentInvoiceSchema,
} from '../../validation/appointment.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('appointments:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return svc.listAppointments(payload as Parameters<typeof svc.listAppointments>[0])
  })

  handle('appointments:getByDate', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { date } = payload as { date: string }
    return svc.getAppointmentsByDate(date)
  })

  handle('appointments:get', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getAppointment(id)
  })

  handle('appointments:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateAppointmentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.createAppointment(parsed.data)
  })

  handle('appointments:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateAppointmentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.updateAppointment(parsed.data)
  })

  handle('appointments:updateStatus', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateAppointmentStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.updateAppointmentStatus(parsed.data)
  })

  handle('appointments:delete', async (payload) => {
    const deny = await requirePermission('billing.void'); if (deny) return deny
    const parsed = AppointmentIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.deleteAppointment(parsed.data.id)
  })

  handle('appointments:stats', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return svc.getAppointmentStats()
  })

  handle('appointments:generateInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateAppointmentInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.generateAppointmentInvoice(parsed.data.id, { retailItems: parsed.data.retailItems, paymentMethod: parsed.data.paymentMethod })
  })

  handle('appointments:generateBatchInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateAppointmentBatchInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.generateAppointmentBatchInvoice(parsed.data.ids)
  })
}
