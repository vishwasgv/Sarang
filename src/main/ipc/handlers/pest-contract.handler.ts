import {
  listPestContracts, getPestContract, createPestContract,
  updatePestContract, deletePestContract, getPestContractKPIs,
  generateContractInvoice
} from '../../services/pest-contract.service'
import { requirePermission } from '../permission-guard'

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
    return createPestContract(raw as Parameters<typeof createPestContract>[0])
  })

  handle('pestContract:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updatePestContract(raw as Parameters<typeof updatePestContract>[0])
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
    const { id, period } = raw as { id: string; period?: string }
    return generateContractInvoice(id, period)
  })
}
