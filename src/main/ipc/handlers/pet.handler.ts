import { requirePermission } from '../permission-guard'
import {
  listPets,
  getPet,
  createPet,
  updatePet,
  deletePet,
  addWeightEntry,
  listWeightHistory,
} from '../../services/pet.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('pets:list', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const p = payload as Parameters<typeof listPets>[0]
    return listPets(p)
  })

  handle('pets:get', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const { id } = payload as { id: string }
    return getPet(id)
  })

  handle('pets:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    return createPet(payload as Parameters<typeof createPet>[0])
  })

  handle('pets:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    return updatePet(payload as Parameters<typeof updatePet>[0])
  })

  handle('pets:delete', async (payload) => {
    const deny = await requirePermission('billing.void')
    if (deny) return deny
    const { id } = payload as { id: string }
    return deletePet(id)
  })

  handle('pets:addWeight', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    return addWeightEntry(payload as Parameters<typeof addWeightEntry>[0])
  })

  handle('pets:weightHistory', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const { petId } = payload as { petId: string }
    return listWeightHistory(petId)
  })
}
