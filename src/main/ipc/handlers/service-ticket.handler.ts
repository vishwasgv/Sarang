import { listTickets, createTicket, updateTicket, deleteTicket } from '../../services/service-ticket.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('tickets:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listTickets(payload as Parameters<typeof listTickets>[0])
  })

  handle('tickets:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return createTicket(payload as Parameters<typeof createTicket>[0], getCurrentSession()?.userId)
  })

  handle('tickets:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return updateTicket(payload as Parameters<typeof updateTicket>[0], getCurrentSession()?.userId)
  })

  handle('tickets:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const p = payload as { id: string }
    return deleteTicket(p.id, getCurrentSession()?.userId)
  })
}
