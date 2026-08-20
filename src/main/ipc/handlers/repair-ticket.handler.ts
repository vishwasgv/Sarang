import { createRepairTicket, listRepairTickets, getRepairTicket, getSerialServiceHistory, lookupSerialService, updateRepairTicketStatus, recordVendorClaim, recordVendorRecovery, writeOffVendorClaim } from '../../services/repair-ticket.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateRepairTicketSchema, ListRepairTicketsSchema, UpdateRepairTicketStatusSchema, RecordVendorClaimSchema, RecordVendorRecoverySchema } from '../../validation/repair-ticket.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('repairTickets:create', async (payload) => {
    const deny = await requirePermission('repairTickets.create'); if (deny) return deny
    const parsed = CreateRepairTicketSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createRepairTicket(parsed.data, getCurrentSession()?.userId)
  })

  handle('repairTickets:list', async (payload) => {
    const deny = await requirePermission('repairTickets.view'); if (deny) return deny
    const parsed = ListRepairTicketsSchema.safeParse(payload ?? {})
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listRepairTickets(parsed.data)
  })

  handle('repairTickets:get', async (payload) => {
    const deny = await requirePermission('repairTickets.view'); if (deny) return deny
    const p = (payload ?? {}) as { id: string }
    return getRepairTicket(p.id)
  })

  handle('repairTickets:serviceHistory', async (payload) => {
    const deny = await requirePermission('repairTickets.view'); if (deny) return deny
    const p = (payload ?? {}) as { serialId: string }
    return getSerialServiceHistory(p.serialId)
  })

  // Phase 67 §9.1 — Electronics: serial-number service lookup.
  handle('repairTickets:lookupSerialService', async (payload) => {
    const deny = await requirePermission('repairTickets.view'); if (deny) return deny
    const p = (payload ?? {}) as { search: string }
    return lookupSerialService(p.search ?? '')
  })

  handle('repairTickets:updateStatus', async (payload) => {
    const deny = await requirePermission('repairTickets.manage'); if (deny) return deny
    const parsed = UpdateRepairTicketStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateRepairTicketStatus(parsed.data, getCurrentSession()?.userId)
  })

  // Phase 67 §9.1 — Electronics: vendor warranty-claim recovery ledger.
  handle('repairTickets:recordVendorClaim', async (payload) => {
    const deny = await requirePermission('repairTickets.manage'); if (deny) return deny
    const parsed = RecordVendorClaimSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return recordVendorClaim(parsed.data, getCurrentSession()?.userId)
  })

  handle('repairTickets:recordVendorRecovery', async (payload) => {
    const deny = await requirePermission('repairTickets.manage'); if (deny) return deny
    const parsed = RecordVendorRecoverySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return recordVendorRecovery(parsed.data, getCurrentSession()?.userId)
  })

  handle('repairTickets:writeOffVendorClaim', async (payload) => {
    const deny = await requirePermission('repairTickets.manage'); if (deny) return deny
    const p = (payload ?? {}) as { id: string }
    if (!p.id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    return writeOffVendorClaim({ id: p.id }, getCurrentSession()?.userId)
  })
}
