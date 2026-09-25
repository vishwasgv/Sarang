import { z } from 'zod'
import { partyAddressService } from '../../services/party-address.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const PartyType = z.enum(['CUSTOMER', 'SUPPLIER'])
const ListSchema = z.object({ partyType: PartyType, partyId: z.string().min(1) })
const SaveSchema = z.object({
  id: z.string().min(1).optional(),
  partyType: PartyType,
  partyId: z.string().min(1),
  label: z.string().min(1).max(60),
  addressText: z.string().min(1).max(400),
  isDefault: z.boolean().optional()
})

// Customer addresses follow the customer permissions, supplier addresses the supplier ones.
const viewPerm = (t: 'CUSTOMER' | 'SUPPLIER') => (t === 'CUSTOMER' ? 'customers.view' : 'suppliers.view')
const editPerm = (t: 'CUSTOMER' | 'SUPPLIER') => (t === 'CUSTOMER' ? 'customers.update' : 'suppliers.update')

export function register(handle: HandleFn): void {
  handle('partyAddresses:list', async (payload) => {
    const parsed = ListSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Choose a customer or supplier.' } }
    const deny = await requirePermission(viewPerm(parsed.data.partyType)); if (deny) return deny
    return partyAddressService.list(parsed.data.partyType, parsed.data.partyId)
  })

  handle('partyAddresses:save', async (payload) => {
    const parsed = SaveSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid address.' } }
    const deny = await requirePermission(editPerm(parsed.data.partyType)); if (deny) return deny
    return partyAddressService.save(parsed.data, getCurrentSession()?.userId)
  })

  handle('partyAddresses:remove', async (payload) => {
    const p = payload as { id?: unknown; partyType?: unknown } | null
    const type = PartyType.safeParse(p?.partyType)
    if (!type.success || typeof p?.id !== 'string' || !p.id) return { success: false, error: { code: 'VAL-001', message: 'Choose an address.' } }
    const deny = await requirePermission(editPerm(type.data)); if (deny) return deny
    return partyAddressService.remove(p.id, getCurrentSession()?.userId)
  })
}
