import { listServiceContracts, getServiceContract, createServiceContract, updateServiceContract, generateServiceContractInvoice } from '../../services/service-contract.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateServiceContractSchema, UpdateServiceContractSchema, GenerateServiceContractInvoiceSchema } from '../../validation/service-contract.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('serviceContracts:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listServiceContracts(payload as Parameters<typeof listServiceContracts>[0])
  })

  handle('serviceContracts:get', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return getServiceContract(id)
  })

  handle('serviceContracts:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = CreateServiceContractSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createServiceContract({ ...parsed.data, createdById: getCurrentSession()?.userId })
  })

  handle('serviceContracts:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = UpdateServiceContractSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateServiceContract(parsed.data)
  })

  handle('serviceContracts:generateInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateServiceContractInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateServiceContractInvoice(parsed.data.id, parsed.data.period)
  })
}
