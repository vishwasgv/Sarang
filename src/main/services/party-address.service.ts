import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

// Extra addresses for a customer or supplier (ship-to, warehouse, branch office). The party's own address field stays the main one.

export type PartyType = 'CUSTOMER' | 'SUPPLIER'
const MAX_PER_PARTY = 20

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

export const partyAddressService = {
  async list(partyType: PartyType, partyId: string) {
    try {
      const rows = await getPrisma().partyAddress.findMany({ where: { partyType, partyId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })
      return { success: true, data: rows }
    } catch (err) {
      return fail(err)
    }
  },

  async save(p: { id?: string; partyType: PartyType; partyId: string; label: string; addressText: string; isDefault?: boolean }, userId?: string) {
    try {
      const db = getPrisma()
      const label = p.label.trim()
      const addressText = p.addressText.trim()
      if (!label) throw new ServiceError('ADR-001', 'Give the address a name, for example "Warehouse".')
      if (!addressText) throw new ServiceError('ADR-002', 'Enter the address.')
      const party = p.partyType === 'CUSTOMER'
        ? await db.customer.findUnique({ where: { id: p.partyId }, select: { id: true } })
        : await db.supplier.findUnique({ where: { id: p.partyId }, select: { id: true } })
      if (!party) throw new ServiceError('ADR-003', `${p.partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'} not found.`)
      if (!p.id && await db.partyAddress.count({ where: { partyType: p.partyType, partyId: p.partyId } }) >= MAX_PER_PARTY) {
        throw new ServiceError('ADR-004', `You can keep up to ${MAX_PER_PARTY} addresses for one party.`)
      }
      const id = await db.$transaction(async (tx) => {
        if (p.isDefault) await tx.partyAddress.updateMany({ where: { partyType: p.partyType, partyId: p.partyId }, data: { isDefault: false } })
        if (p.id) {
          await tx.partyAddress.update({ where: { id: p.id }, data: { label, addressText, ...(p.isDefault !== undefined ? { isDefault: p.isDefault } : {}) } })
          return p.id
        }
        const row = await tx.partyAddress.create({ data: { partyType: p.partyType, partyId: p.partyId, label, addressText, isDefault: p.isDefault ?? false } })
        return row.id
      })
      await logAction({ userId, action: p.id ? 'PARTY_ADDRESS_UPDATED' : 'PARTY_ADDRESS_ADDED', entityType: 'PartyAddress', entityId: id })
      return { success: true, data: { id } }
    } catch (err) {
      return fail(err)
    }
  },

  async remove(id: string, userId?: string) {
    try {
      await getPrisma().partyAddress.deleteMany({ where: { id } })
      await logAction({ userId, action: 'PARTY_ADDRESS_DELETED', entityType: 'PartyAddress', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  }
}
