import { createRepairTicket, listRepairTickets, getRepairTicket, getSerialServiceHistory, updateRepairTicketStatus } from '../../services/repair-ticket.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateRepairTicketSchema, ListRepairTicketsSchema, UpdateRepairTicketStatusSchema } from '../../validation/repair-ticket.validation'

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

  handle('repairTickets:updateStatus', async (payload) => {
    const deny = await requirePermission('repairTickets.manage'); if (deny) return deny
    const parsed = UpdateRepairTicketStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateRepairTicketStatus(parsed.data, getCurrentSession()?.userId)
  })
}
