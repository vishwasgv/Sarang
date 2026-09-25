import { z } from 'zod'
import { exchangeRateService } from '../../services/exchange-rate.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const SaveSchema = z.object({ currencyCode: z.string().min(3).max(3), rate: z.number().positive().max(1e9), rateDate: z.string().min(8).max(10) })
const LatestSchema = z.object({ currencyCode: z.string().min(3).max(3), onDate: z.string().max(10).optional() })
const ImportSchema = z.object({ text: z.string().min(1).max(500_000) })

export function register(handle: HandleFn): void {
  // Reading rates is needed by anyone who can make an invoice, so it follows the billing permission.
  handle('exchangeRates:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const code = (payload as { currencyCode?: unknown } | null)?.currencyCode
    return exchangeRateService.list(typeof code === 'string' ? code : undefined)
  })

  handle('exchangeRates:latest', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = LatestSchema.safeParse(payload)
    if (!parsed.success) return { success: true, data: null }
    return exchangeRateService.latest(parsed.data.currencyCode, parsed.data.onDate)
  })

  handle('exchangeRates:save', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = SaveSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid rate.' } }
    return exchangeRateService.save(parsed.data, getCurrentSession()?.userId)
  })

  handle('exchangeRates:importCsv', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ImportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a CSV file with your rates.' } }
    return exchangeRateService.importCsv(parsed.data.text, getCurrentSession()?.userId)
  })

  handle('exchangeRates:remove', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a rate.' } }
    return exchangeRateService.remove(id, getCurrentSession()?.userId)
  })
}
