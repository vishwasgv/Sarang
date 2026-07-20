import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

export type RepairTicketStatus =
  | 'RECEIVED' | 'DIAGNOSED' | 'SENT_TO_VENDOR' | 'AWAITING_PARTS'
  | 'REPAIRED' | 'REPLACED' | 'RETURNED_TO_CUSTOMER' | 'CANCELLED'

// Which statuses a ticket may move to from its current status. REPLACED and
// REPAIRED both lead only to RETURNED_TO_CUSTOMER (the unit — original or
// replacement — physically leaves with the customer); CANCELLED is only
// reachable before either of those, since by then a real inventory/serial
// side effect (REPLACED) may already have happened and can't be silently
// undone by a cancel.
const ALLOWED_TRANSITIONS: Record<RepairTicketStatus, RepairTicketStatus[]> = {
  RECEIVED: ['DIAGNOSED', 'SENT_TO_VENDOR', 'REPAIRED', 'REPLACED', 'CANCELLED'],
  DIAGNOSED: ['SENT_TO_VENDOR', 'REPAIRED', 'REPLACED', 'CANCELLED'],
  SENT_TO_VENDOR: ['AWAITING_PARTS', 'REPAIRED', 'REPLACED', 'CANCELLED'],
  AWAITING_PARTS: ['REPAIRED', 'REPLACED', 'CANCELLED'],
  REPAIRED: ['RETURNED_TO_CUSTOMER'],
  REPLACED: ['RETURNED_TO_CUSTOMER'],
  RETURNED_TO_CUSTOMER: [],
  CANCELLED: []
}

async function generateClaimNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'repair_ticket_claim_sequence', 'RMA', 5,
    async () => {
      const last = await tx.repairTicket.findFirst({ orderBy: { createdAt: 'desc' }, select: { claimNumber: true } })
      return last ? parseInt(last.claimNumber.replace('RMA-', ''), 10) : 0
    }
  )
}

// Turnaround is derived at read time (days between intake and hand-back, or
// days-open-so-far for a ticket still in progress) — never a stored/computed
// column that would need a background job to keep current.
function turnaroundDays(receivedDate: Date, deliveredDate: Date | null): number {
  const end = deliveredDate ?? new Date()
  return Math.max(0, Math.round((end.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24)))
}

const TICKET_INCLUDE = {
  serial: { select: { id: true, serialNumber: true, imeiNumber: true, status: true, warrantyExpiryDate: true } },
  replacementSerial: { select: { id: true, serialNumber: true, imeiNumber: true, status: true } },
  product: { select: { id: true, productName: true } },
  customer: { select: { id: true, customerName: true, phone: true } },
  vendor: { select: { id: true, supplierName: true } }
} as const

function toRecord<T extends {
  id: string; claimNumber: string; issueDescription: string; status: string
  receivedDate: Date; deliveredDate: Date | null; vendorRmaNumber: string | null
  sentToVendorDate: Date | null; vendorResponseDate: Date | null; repairCost: number | null
  notes: string | null; createdAt: Date
  serial: { id: string; serialNumber: string; imeiNumber: string | null; status: string; warrantyExpiryDate: Date | null }
  replacementSerial: { id: string; serialNumber: string; imeiNumber: string | null; status: string } | null
  product: { id: string; productName: string }
  customer: { id: string; customerName: string; phone: string | null } | null
  vendor: { id: string; supplierName: string } | null
}>(t: T) {
  return {
    id: t.id,
    claimNumber: t.claimNumber,
    status: t.status as RepairTicketStatus,
    issueDescription: t.issueDescription,
    receivedDate: t.receivedDate.toISOString(),
    deliveredDate: t.deliveredDate ? t.deliveredDate.toISOString() : null,
    turnaroundDays: turnaroundDays(t.receivedDate, t.deliveredDate),
    vendorRmaNumber: t.vendorRmaNumber,
    sentToVendorDate: t.sentToVendorDate ? t.sentToVendorDate.toISOString() : null,
    vendorResponseDate: t.vendorResponseDate ? t.vendorResponseDate.toISOString() : null,
    repairCost: t.repairCost,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    serial: t.serial,
    replacementSerial: t.replacementSerial,
    product: t.product,
    customer: t.customer,
    vendor: t.vendor
  }
}

export async function createRepairTicket(payload: {
  serialId: string
  customerId?: string
  issueDescription: string
  vendorId?: string
  notes?: string
}, userId?: string): Promise<{ success: boolean; data?: { id: string; claimNumber: string }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const serial = await db.productSerial.findUnique({ where: { id: payload.serialId } })
    if (!serial) return { success: false, error: { code: 'RPR-001', message: 'Serial/IMEI not found.' } }
    if (serial.status !== 'SOLD') {
      return { success: false, error: { code: 'RPR-002', message: 'A repair ticket can only be opened for a unit that has already been sold to a customer.' } }
    }

    const result = await db.$transaction(async (tx) => {
      const claimNumber = await generateClaimNumber(tx)
      return tx.repairTicket.create({
        data: {
          claimNumber,
          serialId: payload.serialId,
          productId: serial.productId,
          customerId: payload.customerId,
          issueDescription: payload.issueDescription,
          vendorId: payload.vendorId,
          notes: payload.notes,
          createdById: userId,
          status: 'RECEIVED'
        }
      })
    })

    await logAction(userId, 'REPAIR_TICKET_CREATED', 'RepairTicket', result.id, undefined, { claimNumber: result.claimNumber })
    return { success: true, data: { id: result.id, claimNumber: result.claimNumber } }
  } catch (err) {
    return { success: false, error: { code: 'RPR-003', message: err instanceof Error ? err.message : 'Failed to create repair ticket.' } }
  }
}

export async function listRepairTickets(filters?: {
  status?: RepairTicketStatus
  productId?: string
  customerId?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{ success: boolean; data?: { tickets: ReturnType<typeof toRecord>[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.productId) where.productId = filters.productId
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.search) {
      where.OR = [
        { claimNumber: { contains: filters.search } },
        { vendorRmaNumber: { contains: filters.search } },
        { serial: { serialNumber: { contains: filters.search } } },
        { serial: { imeiNumber: { contains: filters.search } } },
        { customer: { customerName: { contains: filters.search } } }
      ]
    }

    const [rows, total] = await Promise.all([
      db.repairTicket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: TICKET_INCLUDE }),
      db.repairTicket.count({ where })
    ])

    return { success: true, data: { tickets: rows.map(toRecord), total } }
  } catch (err) {
    return { success: false, error: { code: 'RPR-004', message: err instanceof Error ? err.message : 'Failed to list repair tickets.' } }
  }
}

export async function getRepairTicket(id: string): Promise<{ success: boolean; data?: ReturnType<typeof toRecord>; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const t = await db.repairTicket.findUnique({ where: { id }, include: TICKET_INCLUDE })
    if (!t) return { success: false, error: { code: 'RPR-005', message: 'Repair ticket not found.' } }
    return { success: true, data: toRecord(t) }
  } catch (err) {
    return { success: false, error: { code: 'RPR-006', message: err instanceof Error ? err.message : 'Failed to load repair ticket.' } }
  }
}

// Service-history view per serial — every repair ticket ever opened against
// this specific physical unit, most recent first. A serial that has itself
// been issued as a REPLACEMENT on some other ticket will show that lineage
// via replacedOnTicket, since a replacement unit handed to a customer can
// later need its own repair ticket too.
export async function getSerialServiceHistory(serialId: string): Promise<{
  success: boolean
  data?: {
    tickets: ReturnType<typeof toRecord>[]
    replacedOnTicket: { id: string; claimNumber: string } | null
    serial: { id: string; serialNumber: string; imeiNumber: string | null; status: string; productId: string; productName: string } | null
  }
  error?: { code: string; message: string }
}> {
  try {
    const db = getPrisma()
    const [rows, replacedOnTicket, serial] = await Promise.all([
      db.repairTicket.findMany({ where: { serialId }, orderBy: { receivedDate: 'desc' }, include: TICKET_INCLUDE }),
      db.repairTicket.findUnique({ where: { replacementSerialId: serialId }, select: { id: true, claimNumber: true } }),
      db.productSerial.findUnique({ where: { id: serialId }, include: { product: { select: { id: true, productName: true } } } })
    ])
    return {
      success: true,
      data: {
        tickets: rows.map(toRecord),
        replacedOnTicket,
        serial: serial ? { id: serial.id, serialNumber: serial.serialNumber, imeiNumber: serial.imeiNumber, status: serial.status, productId: serial.product.id, productName: serial.product.productName } : null
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'RPR-007', message: err instanceof Error ? err.message : 'Failed to load service history.' } }
  }
}

export async function updateRepairTicketStatus(payload: {
  id: string
  status: RepairTicketStatus
  vendorId?: string
  vendorRmaNumber?: string
  replacementSerialId?: string
  repairCost?: number
  notes?: string
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.repairTicket.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'RPR-008', message: 'Repair ticket not found.' } }

    const from = existing.status as RepairTicketStatus
    if (from === payload.status) {
      // No-op transition (e.g. re-saving vendor RMA details on the same
      // status) — allowed, skips the transition-table check entirely.
    } else if (!ALLOWED_TRANSITIONS[from]?.includes(payload.status)) {
      return { success: false, error: { code: 'RPR-009', message: `Cannot move a ticket from ${from} to ${payload.status}.` } }
    }

    let replacementSerial: { id: string; productId: string; status: string } | null = null
    if (payload.status === 'REPLACED' && from !== 'REPLACED') {
      const replacementId = payload.replacementSerialId
      if (!replacementId) return { success: false, error: { code: 'RPR-010', message: 'A replacement unit (serial/IMEI) is required to mark this ticket REPLACED.' } }
      replacementSerial = await db.productSerial.findUnique({ where: { id: replacementId } })
      if (!replacementSerial) return { success: false, error: { code: 'RPR-011', message: 'Replacement serial/IMEI not found.' } }
      if (replacementSerial.productId !== existing.productId) return { success: false, error: { code: 'RPR-012', message: 'The replacement unit must be the same product.' } }
      if (replacementSerial.status !== 'AVAILABLE') return { success: false, error: { code: 'RPR-013', message: 'The replacement unit must currently be in-stock (AVAILABLE).' } }
    }

    const originalSerial = await db.productSerial.findUnique({ where: { id: existing.serialId } })
    if (!originalSerial) return { success: false, error: { code: 'RPR-014', message: 'Original serial/IMEI record is missing.' } }

    await db.$transaction(async (tx) => {
      const now = new Date()
      await tx.repairTicket.update({
        where: { id: payload.id },
        data: {
          status: payload.status,
          vendorId: payload.vendorId ?? existing.vendorId,
          vendorRmaNumber: payload.vendorRmaNumber ?? existing.vendorRmaNumber,
          replacementSerialId: payload.status === 'REPLACED' ? (payload.replacementSerialId ?? existing.replacementSerialId) : existing.replacementSerialId,
          repairCost: payload.repairCost ?? existing.repairCost,
          notes: payload.notes ?? existing.notes,
          sentToVendorDate: payload.status === 'SENT_TO_VENDOR' && !existing.sentToVendorDate ? now : existing.sentToVendorDate,
          vendorResponseDate: existing.status === 'SENT_TO_VENDOR' && !existing.vendorResponseDate && ['AWAITING_PARTS', 'REPAIRED', 'REPLACED'].includes(payload.status) ? now : existing.vendorResponseDate,
          deliveredDate: payload.status === 'RETURNED_TO_CUSTOMER' && !existing.deliveredDate ? now : existing.deliveredDate
        }
      })

      if (payload.status === 'REPLACED' && from !== 'REPLACED' && replacementSerial) {
        // Original unit is taken out of the sellable/returnable pool for
        // good — it was defective enough to warrant a full swap, so RETURNED
        // (which implies "back in inspection, may become AVAILABLE again")
        // would be misleading.
        await tx.productSerial.update({ where: { id: originalSerial.id }, data: { status: 'DEFECTIVE' } })
        // Replacement inherits the same invoice/customer link the original
        // sale had, and leaves the shelf exactly like any other sale.
        await tx.productSerial.update({
          where: { id: replacementSerial.id },
          data: { status: 'SOLD', invoiceId: originalSerial.invoiceId, soldDate: now }
        })
        await tx.inventory.upsert({
          where: { productId: existing.productId },
          create: { productId: existing.productId, quantity: 0 },
          update: { quantity: { decrement: 1 } }
        })
      }
    })

    await logAction(userId, 'REPAIR_TICKET_STATUS_UPDATED', 'RepairTicket', payload.id, from, payload.status)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RPR-015', message: err instanceof Error ? err.message : 'Failed to update repair ticket.' } }
  }
}

export const repairTicketService = {
  createRepairTicket,
  listRepairTickets,
  getRepairTicket,
  getSerialServiceHistory,
  updateRepairTicketStatus
}
