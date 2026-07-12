import { listTickets, createTicket, updateTicket, deleteTicket } from '../../services/service-ticket.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateTicketSchema, UpdateTicketSchema, DeleteTicketSchema } from '../../validation/service-ticket.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('tickets:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listTickets(payload as Parameters<typeof listTickets>[0])
  })

  handle('tickets:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = CreateTicketSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createTicket(parsed.data, getCurrentSession()?.userId)
  })

  handle('tickets:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = UpdateTicketSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateTicket(parsed.data, getCurrentSession()?.userId)
  })

  handle('tickets:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = DeleteTicketSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteTicket(parsed.data.id, getCurrentSession()?.userId)
  })
}
