import { listGoldSavingsSchemes, createGoldSavingsScheme, recordInstallment, redeemGoldSavingsScheme, linkGoldSavingsSchemeToInvoice } from '../../services/gold-savings.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateGoldSavingsSchemeSchema, RecordGoldSavingsInstallmentSchema, RedeemGoldSavingsSchemeSchema, LinkGoldSavingsSchemeToInvoiceSchema } from '../../validation/gold-savings.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('goldSavings:list', async (payload) => {
    const deny = await requirePermission('jewellery.view'); if (deny) return deny
    return listGoldSavingsSchemes(payload as Parameters<typeof listGoldSavingsSchemes>[0])
  })

  handle('goldSavings:create', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const parsed = CreateGoldSavingsSchemeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createGoldSavingsScheme({ ...parsed.data, createdById: session?.userId })
  })

  handle('goldSavings:recordInstallment', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const parsed = RecordGoldSavingsInstallmentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return recordInstallment({ ...parsed.data, createdById: session?.userId })
  })

  handle('goldSavings:redeem', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const parsed = RedeemGoldSavingsSchemeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return redeemGoldSavingsScheme({ ...parsed.data, userId: session?.userId })
  })

  handle('goldSavings:linkToInvoice', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const parsed = LinkGoldSavingsSchemeToInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return linkGoldSavingsSchemeToInvoice(parsed.data.schemeId, parsed.data.invoiceId)
  })
}
