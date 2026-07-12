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
import { CreatePetSchema, UpdatePetSchema, PetIdSchema, AddWeightEntrySchema } from '../../validation/pet.validation'

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
    const parsed = CreatePetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPet(parsed.data)
  })

  handle('pets:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    const parsed = UpdatePetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePet(parsed.data)
  })

  handle('pets:delete', async (payload) => {
    const deny = await requirePermission('billing.void')
    if (deny) return deny
    const parsed = PetIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deletePet(parsed.data.id)
  })

  handle('pets:addWeight', async (payload) => {
    const deny = await requirePermission('billing.createInvoice')
    if (deny) return deny
    const parsed = AddWeightEntrySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addWeightEntry(parsed.data)
  })

  handle('pets:weightHistory', async (payload) => {
    const deny = await requirePermission('billing.view')
    if (deny) return deny
    const { petId } = payload as { petId: string }
    return listWeightHistory(petId)
  })
}
