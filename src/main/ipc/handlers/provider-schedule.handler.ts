import { requirePermission } from '../permission-guard'
import * as svc from '../../services/provider-schedule.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('providerSchedule:list', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const { providerId } = payload as { providerId: string }
    return svc.listProviderSchedules(providerId)
  })

  handle('providerSchedule:upsert', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    return svc.upsertProviderSchedule(payload as Parameters<typeof svc.upsertProviderSchedule>[0])
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
    return svc.addHoliday(payload as Parameters<typeof svc.addHoliday>[0])
  })

  handle('providerSchedule:deleteHoliday', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.deleteHoliday(id)
  })

  handle('providerSchedule:getCancellationPolicy', async () => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return svc.getCancellationPolicy()
  })

  handle('providerSchedule:upsertCancellationPolicy', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    return svc.upsertCancellationPolicy(payload as Parameters<typeof svc.upsertCancellationPolicy>[0])
  })
}
