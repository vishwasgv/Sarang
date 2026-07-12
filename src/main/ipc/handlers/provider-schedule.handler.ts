import { requirePermission } from '../permission-guard'
import * as svc from '../../services/provider-schedule.service'
import { UpsertProviderScheduleSchema, AddHolidaySchema, DeleteHolidaySchema, UpsertCancellationPolicySchema } from '../../validation/provider-schedule.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('providerSchedule:list', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const { providerId } = payload as { providerId: string }
    return svc.listProviderSchedules(providerId)
  })

  handle('providerSchedule:upsert', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpsertProviderScheduleSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.upsertProviderSchedule(parsed.data)
  })

  handle('providerSchedule:getAvailability', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return svc.getProviderAvailability(payload as Parameters<typeof svc.getProviderAvailability>[0])
  })

  handle('providerSchedule:listHolidays', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return svc.listHolidays(payload as Parameters<typeof svc.listHolidays>[0])
  })

  handle('providerSchedule:addHoliday', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = AddHolidaySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.addHoliday(parsed.data)
  })

  handle('providerSchedule:deleteHoliday', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = DeleteHolidaySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.deleteHoliday(parsed.data.id)
  })

  handle('providerSchedule:getCancellationPolicy', async () => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return svc.getCancellationPolicy()
  })

  handle('providerSchedule:upsertCancellationPolicy', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpsertCancellationPolicySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.upsertCancellationPolicy(parsed.data)
  })
}
