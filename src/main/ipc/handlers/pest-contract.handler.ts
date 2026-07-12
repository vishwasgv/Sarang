import {
  listPestContracts, getPestContract, createPestContract,
  updatePestContract, deletePestContract, getPestContractKPIs,
  generateContractInvoice
} from '../../services/pest-contract.service'
import { requirePermission } from '../permission-guard'
import { CreatePestContractSchema, UpdatePestContractSchema, GenerateContractInvoiceSchema } from '../../validation/pest-contract.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPestContract(handle: HandleFn): void {
  handle('pestContract:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listPestContracts(raw as Parameters<typeof listPestContracts>[0])
  })

  handle('pestContract:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPestContract(raw as string)
  })

  handle('pestContract:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePestContractSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPestContract(parsed.data)
  })

  handle('pestContract:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePestContractSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePestContract(parsed.data)
  })

  handle('pestContract:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deletePestContract(raw as string)
  })

  handle('pestContract:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPestContractKPIs()
  })

  handle('pestContract:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateContractInvoiceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateContractInvoice(parsed.data.id, parsed.data.period)
  })
}
