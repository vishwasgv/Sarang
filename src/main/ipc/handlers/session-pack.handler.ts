import { requirePermission } from '../permission-guard'
import { getActivePack, listPacks, listAllActivePacks, createPack, deductSession, listSessionLogs, generateSessionPackInvoice } from '../../services/session-pack.service'
import { CreatePackSchema, DeductSessionSchema, GenerateSessionPackInvoiceSchema } from '../../validation/session-pack.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('sessionPack:getActive', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { customerId } = payload as { customerId: string }
    return getActivePack(customerId)
  })

  handle('sessionPack:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { customerId } = payload as { customerId: string }
    return listPacks(customerId)
  })

  handle('sessionPack:listAll', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listAllActivePacks()
  })

  handle('sessionPack:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePackSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPack(parsed.data)
  })

  handle('sessionPack:deduct', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeductSessionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deductSession(parsed.data)
  })

  handle('sessionPack:logs', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { clientSessionPackId } = payload as { clientSessionPackId: string }
    return listSessionLogs(clientSessionPackId)
  })

  handle('sessionPack:generateInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateSessionPackInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateSessionPackInvoice(parsed.data.id)
  })
}
