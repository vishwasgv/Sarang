import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber, SequenceContendedError } from './sequence.service'
import { billingService } from './billing.service'

export interface ServiceTicketRecord {
  id: string
  ticketNumber: string
  title: string
  description: string | null
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  category: string | null
  customerId: string | null
  customerName: string | null
  assignedToId: string | null
  assignedToName: string | null
  resolvedAt: string | null
  closedAt: string | null
  resolution: string | null
  invoiceId: string | null
  createdAt: string
  updatedAt: string
}

function toRecord(t: any): ServiceTicketRecord {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    priority: t.priority,
    category: t.category ?? null,
    customerId: t.customerId ?? null,
    customerName: t.customer?.customerName ?? null,
    assignedToId: t.assignedToId ?? null,
    assignedToName: t.assignedTo?.fullName ?? null,
    resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toISOString() : null,
    closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : null,
    resolution: t.resolution ?? null,
    invoiceId: t.invoiceId ?? null,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString()
  }
}

const include = {
  customer: { select: { customerName: true } },
  assignedTo: { select: { fullName: true } }
}

export async function listTickets(payload?: {
  status?: string
  priority?: string
  customerId?: string
  limit?: number
}): Promise<{ success: boolean; data?: { tickets: ServiceTicketRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.priority) where.priority = payload.priority
    if (payload?.customerId) where.customerId = payload.customerId

    const rows = await db.serviceTicket.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: payload?.limit ?? 200
    })
    const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    rows.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99
      const pb = PRIORITY_ORDER[b.priority] ?? 99
      if (pa !== pb) return pa - pb
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return { success: true, data: { tickets: rows.map(toRecord), total: rows.length } }
  } catch (e: any) {
    console.error('[TKT_LIST_FAIL]', e)
    return { success: false, error: { code: 'TKT_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createTicket(payload: {
  title: string
  description?: string
  priority?: string
  category?: string
  customerId?: string
  assignedToId?: string
}, userId?: string): Promise<{ success: boolean; data?: ServiceTicketRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.$transaction(async (tx) => {
      const ticketNumber = await generateSequenceNumber(
        tx, 'service_ticket_number_sequence', 'TKT', 5,
        async () => {
          const last = await tx.serviceTicket.findFirst({ orderBy: { createdAt: 'desc' }, select: { ticketNumber: true } })
          return last ? parseInt(last.ticketNumber.replace('TKT-', ''), 10) : 0
        }
      )
      return tx.serviceTicket.create({
        data: {
          ticketNumber,
          title: payload.title,
          description: payload.description ?? null,
          priority: payload.priority ?? 'MEDIUM',
          category: payload.category ?? null,
          customerId: payload.customerId ?? null,
          assignedToId: payload.assignedToId ?? null,
          createdById: userId ?? null
        },
        include
      })
    })

    if (userId) await logAction(userId, 'CREATE', 'SERVICE_TICKET', row.id, null, { ticketNumber: row.ticketNumber, title: payload.title })
    return { success: true, data: toRecord(row) }
  } catch (e: unknown) {
    if (e instanceof SequenceContendedError) {
      return { success: false, error: { code: 'TKT-002', message: 'The system is busy creating another ticket right now. Please try again in a moment.' } }
    }
    return { success: false, error: { code: 'TKT_CREATE_FAIL', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateTicket(payload: {
  id: string
  title?: string
  description?: string
  status?: string
  priority?: string
  category?: string
  customerId?: string | null
  assignedToId?: string | null
  resolution?: string
}, userId?: string): Promise<{ success: boolean; data?: ServiceTicketRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const old = await db.serviceTicket.findUnique({ where: { id: payload.id }, select: { status: true } })
    if (!old) return { success: false, error: { code: 'TKT_NOT_FOUND', message: 'Ticket not found' } }

    const data: Record<string, unknown> = {}
    if (payload.title !== undefined) data.title = payload.title
    if (payload.description !== undefined) data.description = payload.description
    if (payload.status !== undefined) {
      data.status = payload.status
      if (payload.status === 'RESOLVED' && old.status !== 'RESOLVED') data.resolvedAt = new Date()
      if (payload.status === 'CLOSED' && old.status !== 'CLOSED') data.closedAt = new Date()
    }
    if (payload.priority !== undefined) data.priority = payload.priority
    if (payload.category !== undefined) data.category = payload.category
    if ('customerId' in payload) data.customerId = payload.customerId ?? null
    if ('assignedToId' in payload) data.assignedToId = payload.assignedToId ?? null
    if (payload.resolution !== undefined) data.resolution = payload.resolution

    const row = await db.serviceTicket.update({ where: { id: payload.id }, data, include })
    if (userId) await logAction(userId, 'UPDATE', 'SERVICE_TICKET', payload.id, old, data)
    return { success: true, data: toRecord(row) }
  } catch (e: any) {
    console.error('[TKT_UPDATE_FAIL]', e)
    return { success: false, error: { code: 'TKT_UPDATE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function deleteTicket(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.serviceTicket.findUnique({ where: { id }, select: { status: true } })
    if (!row) return { success: false, error: { code: 'TKT_NOT_FOUND', message: 'Ticket not found' } }
    if (row.status === 'IN_PROGRESS') return { success: false, error: { code: 'TKT_ACTIVE', message: 'Cannot delete an in-progress ticket.' } }

    await db.serviceTicket.delete({ where: { id } })
    if (userId) await logAction(userId, 'DELETE', 'SERVICE_TICKET', id, row, null)
    return { success: true }
  } catch (e: any) {
    console.error('[TKT_DELETE_FAIL]', e)
    return { success: false, error: { code: 'TKT_DELETE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

// Phase 58 §1 (2026-07-17) — legacy Service/Consultant invoicing bridge,
// matching the generate*Invoice(id) pattern already proven elsewhere. Unlike
// Project (estimatedAmount) and JobCard (actualCost/estimatedCost),
// ServiceTicket has no stored monetary field at all (nor does its linked
// WorkLog — hours only, no ratePerHour) — so the billable amount has to be
// entered by the caller at generation time rather than derived.
// BUG FOUND 2026-07-22: this used to check `ticket.invoiceId` then write it
// later with no atomic claim in between — a rapid double-click on "Generate
// Invoice" could create two invoices for one ticket, with the second write
// silently overwriting invoiceId and orphaning the first invoice. Fixed to
// match the atomic claim-sentinel pattern already established elsewhere in
// this codebase (e.g. rental.service.ts's generateRentalInvoice,
// hotel.service.ts's generateHotelInvoice, tailoring-order.service.ts's
// generateTailoringInvoice).
const TICKET_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

export async function generateTicketInvoice(id: string, amount: number, userId?: string) {
  try {
    if (amount <= 0) return { success: false, error: { code: 'TKT-004', message: 'Enter a billable amount greater than zero.' } }
    const db = getPrisma()
    const ticket = await db.serviceTicket.findUnique({ where: { id } })
    if (!ticket) return { success: false, error: { code: 'TKT-005', message: 'Ticket not found.' } }
    if (!ticket.customerId) return { success: false, error: { code: 'TKT-006', message: 'This ticket has no linked customer. Set a customer before generating an invoice.' } }

    const claim = await db.serviceTicket.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: TICKET_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.serviceTicket.findUnique({ where: { id }, select: { invoiceId: true } })
      if (existing?.invoiceId === TICKET_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'TKT-008', message: 'Invoice generation already in progress for this ticket.' } }
      return { success: false, error: { code: 'TKT-007', message: 'Invoice already generated for this ticket.' } }
    }

    try {
      // SAC 998313 — IT consulting and support services, 18% GST
      let product = await db.product.findFirst({ where: { hsnCode: '998313', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Professional / Consulting Services', productType: 'SERVICE', hsnCode: '998313', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      // BUG FOUND 2026-07-22: `taxRate: 18` was also hardcoded on the
      // invoice ITEM here, permanently overriding the product's own
      // configurable rate — the same bug class fixed earlier this session
      // across 13 other vertical services. Removed so it falls through to
      // product.taxRate, owner-editable via Settings > Products.
      const result = await billingService.createInvoice({
        customerId: ticket.customerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{ productId: product.id, quantity: 1, unitPrice: amount }],
        notes: `Ticket ${ticket.ticketNumber} — ${ticket.title}`,
        referenceNumber: ticket.ticketNumber,
      })
      if (!result.success) {
        await db.serviceTicket.update({ where: { id }, data: { invoiceId: null } })
        return { success: false as const, error: result.error }
      }

      const invoice = result.data as { id: string }
      await db.serviceTicket.update({ where: { id }, data: { invoiceId: invoice.id } })
      if (userId) await logAction(userId, 'INVOICED', 'SERVICE_TICKET', id, null, { invoiceId: invoice.id })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.serviceTicket.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e: any) {
    console.error('[TKT_INVOICE_FAIL]', e)
    return { success: false, error: { code: 'TKT_INVOICE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}
