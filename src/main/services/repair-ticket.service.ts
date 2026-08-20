import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { roundCurrency } from './currency.service'
import { ServiceError } from '../errors/service-error'

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

// Phase 67 §9.1 — Electronics: RMA SLA tracker. A fixed 30-day window from
// the day a ticket is sent to the vendor — matches the audit's own "4 units
// over 30 days" framing rather than an arbitrary different number.
const VENDOR_SLA_DAYS = 30

function daysWithVendor(sentToVendorDate: Date | null, vendorResponseDate: Date | null): number | null {
  if (!sentToVendorDate) return null
  const end = vendorResponseDate ?? new Date()
  return Math.max(0, Math.round((end.getTime() - sentToVendorDate.getTime()) / (1000 * 60 * 60 * 24)))
}

// Overdue only while genuinely still with the vendor — a ticket that came
// back late is a fact for the aging report to show, not an ongoing alert.
function isOverdue(status: string, vendorSlaDueDate: Date | null): boolean {
  if (!vendorSlaDueDate) return false
  if (status !== 'SENT_TO_VENDOR' && status !== 'AWAITING_PARTS') return false
  return new Date() > vendorSlaDueDate
}

const TICKET_INCLUDE = {
  serial: { select: { id: true, serialNumber: true, imeiNumber: true, status: true, warrantyExpiryDate: true } },
  replacementSerial: { select: { id: true, serialNumber: true, imeiNumber: true, status: true } },
  product: { select: { id: true, productName: true } },
  customer: { select: { id: true, customerName: true, phone: true } },
  vendor: { select: { id: true, supplierName: true } },
  technician: { select: { id: true, fullName: true } }
} as const

function toRecord<T extends {
  id: string; claimNumber: string; issueDescription: string; status: string
  receivedDate: Date; deliveredDate: Date | null; vendorRmaNumber: string | null
  sentToVendorDate: Date | null; vendorResponseDate: Date | null; vendorSlaDueDate: Date | null; repairCost: number | null
  vendorClaimAmount: number | null; vendorRecoveredAmount: number; vendorClaimClosedAt: Date | null
  notes: string | null; createdAt: Date
  serial: { id: string; serialNumber: string; imeiNumber: string | null; status: string; warrantyExpiryDate: Date | null }
  replacementSerial: { id: string; serialNumber: string; imeiNumber: string | null; status: string } | null
  product: { id: string; productName: string }
  customer: { id: string; customerName: string; phone: string | null } | null
  vendor: { id: string; supplierName: string } | null
  technician: { id: string; fullName: string } | null
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
    vendorSlaDueDate: t.vendorSlaDueDate ? t.vendorSlaDueDate.toISOString() : null,
    daysWithVendor: daysWithVendor(t.sentToVendorDate, t.vendorResponseDate),
    isOverdue: isOverdue(t.status, t.vendorSlaDueDate),
    repairCost: t.repairCost,
    vendorClaimAmount: t.vendorClaimAmount,
    vendorRecoveredAmount: t.vendorRecoveredAmount,
    vendorClaimClosedAt: t.vendorClaimClosedAt ? t.vendorClaimClosedAt.toISOString() : null,
    vendorClaimOutstanding: t.vendorClaimAmount !== null ? roundCurrency(t.vendorClaimAmount - t.vendorRecoveredAmount) : null,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    serial: t.serial,
    replacementSerial: t.replacementSerial,
    product: t.product,
    customer: t.customer,
    vendor: t.vendor,
    technician: t.technician
  }
}

export async function createRepairTicket(payload: {
  serialId: string
  customerId?: string
  issueDescription: string
  vendorId?: string
  technicianId?: string
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
          technicianId: payload.technicianId,
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

// Phase 67 §9.1 — Electronics: serial-number service lookup. The audit's own
// "scan/search a serial to see full purchase-plus-repair history instantly"
// — a single free-text entry point (serial number OR either IMEI) that
// resolves straight to everything about that unit, unlike
// getSerialServiceHistory() above (which needs an already-resolved
// serialId, and has no concept of the PURCHASE half at all). "Purchase"
// here means what the CUSTOMER paid this shop, not this shop's own
// upstream supplier cost — the question a service-desk person actually
// asks a walk-in customer is "when did you buy this from us, do you still
// have warranty", not the shop's internal procurement cost.
export async function lookupSerialService(searchTerm: string): Promise<{
  success: boolean
  data?: {
    serial: { id: string; serialNumber: string; imeiNumber: string | null; imei2Number: string | null; status: string; warrantyExpiryDate: string | null; productId: string; productName: string }
    purchase: { invoiceId: string; invoiceNumber: string; invoiceDate: string; customerName: string | null; customerPhone: string | null; unitPrice: number } | null
    tickets: ReturnType<typeof toRecord>[]
    replacedOnTicket: { id: string; claimNumber: string } | null
  }
  error?: { code: string; message: string }
}> {
  try {
    const term = searchTerm.trim()
    if (!term) return { success: false, error: { code: 'RPR-024', message: 'Enter a serial number or IMEI to search.' } }

    const db = getPrisma()
    const serial = await db.productSerial.findFirst({
      where: { OR: [{ serialNumber: term }, { imeiNumber: term }, { imei2Number: term }] },
      include: { product: { select: { id: true, productName: true } } }
    })
    if (!serial) return { success: false, error: { code: 'RPR-025', message: 'No device found with this serial number or IMEI.' } }

    let purchase: { invoiceId: string; invoiceNumber: string; invoiceDate: string; customerName: string | null; customerPhone: string | null; unitPrice: number } | null = null
    if (serial.invoiceId) {
      const invoice = await db.invoice.findUnique({
        where: { id: serial.invoiceId },
        select: {
          id: true, invoiceNumber: true, invoiceDate: true,
          customer: { select: { customerName: true, phone: true } },
          items: { where: { productId: serial.productId }, select: { unitPrice: true }, take: 1 }
        }
      })
      if (invoice) {
        purchase = {
          invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceDate: invoice.invoiceDate.toISOString(),
          customerName: invoice.customer?.customerName ?? null, customerPhone: invoice.customer?.phone ?? null,
          unitPrice: invoice.items[0]?.unitPrice ?? 0
        }
      }
    }

    const [tickets, replacedOnTicket] = await Promise.all([
      db.repairTicket.findMany({ where: { serialId: serial.id }, orderBy: { receivedDate: 'desc' }, include: TICKET_INCLUDE }),
      db.repairTicket.findUnique({ where: { replacementSerialId: serial.id }, select: { id: true, claimNumber: true } })
    ])

    return {
      success: true,
      data: {
        serial: {
          id: serial.id, serialNumber: serial.serialNumber, imeiNumber: serial.imeiNumber, imei2Number: serial.imei2Number,
          status: serial.status, warrantyExpiryDate: serial.warrantyExpiryDate ? serial.warrantyExpiryDate.toISOString() : null,
          productId: serial.product.id, productName: serial.product.productName
        },
        purchase,
        tickets: tickets.map(toRecord),
        replacedOnTicket
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'RPR-026', message: err instanceof Error ? err.message : 'Failed to look up serial service history.' } }
  }
}

export async function updateRepairTicketStatus(payload: {
  id: string
  status: RepairTicketStatus
  vendorId?: string
  vendorRmaNumber?: string
  replacementSerialId?: string
  repairCost?: number
  technicianId?: string
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
          technicianId: payload.technicianId ?? existing.technicianId,
          notes: payload.notes ?? existing.notes,
          sentToVendorDate: payload.status === 'SENT_TO_VENDOR' && !existing.sentToVendorDate ? now : existing.sentToVendorDate,
          vendorSlaDueDate: payload.status === 'SENT_TO_VENDOR' && !existing.sentToVendorDate
            ? new Date(now.getTime() + VENDOR_SLA_DAYS * 24 * 60 * 60 * 1000)
            : existing.vendorSlaDueDate,
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
        // Real bug found live (2026-07-28 product-vertical audit): the
        // replacement claim used to be an unconditional update, with the
        // only "is this serial still available" check done on a stale
        // pre-transaction read (line ~239 above) — the exact same TOCTOU gap
        // already fixed for markSerialSoldTx in serial.service.ts. Two
        // repair tickets picking the same in-stock replacement serial
        // moments apart could both pass that stale check; the second to
        // commit would silently overwrite the first's invoiceId link,
        // orphaning one ticket while double-decrementing inventory for a
        // unit that only physically left the shelf once. Fixed to a
        // conditional `updateMany` claim, matching markSerialSoldTx exactly.
        const claim = await tx.productSerial.updateMany({
          where: { id: replacementSerial.id, status: 'AVAILABLE' },
          data: { status: 'SOLD', invoiceId: originalSerial.invoiceId, soldDate: now }
        })
        if (claim.count === 0) {
          throw new ServiceError('RPR-016', 'This replacement unit was just claimed by another ticket. Please pick a different unit.')
        }
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
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'RPR-015', message: err instanceof Error ? err.message : 'Failed to update repair ticket.' } }
  }
}

// Phase 67 §9.1 — Electronics: vendor warranty-claim recovery ledger. Most
// in-warranty repairs the vendor just does for free — a claim only exists
// once the SHOP has already repaired or replaced the unit itself and is
// owed reimbursement, so this is a deliberate, explicit action, not
// something set automatically on any status transition. Settable/updatable
// freely (unlike sentToVendorDate's set-once convention) — a shop may
// revise its own claimed amount before the vendor settles it.
export async function recordVendorClaim(payload: { id: string; amount: number }, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    if (payload.amount < 0) return { success: false, error: { code: 'RPR-017', message: 'Claim amount cannot be negative.' } }
    const db = getPrisma()
    const existing = await db.repairTicket.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'RPR-008', message: 'Repair ticket not found.' } }

    await db.repairTicket.update({ where: { id: payload.id }, data: { vendorClaimAmount: roundCurrency(payload.amount) } })
    await logAction(userId, 'REPAIR_TICKET_VENDOR_CLAIM_RECORDED', 'RepairTicket', payload.id, existing.vendorClaimAmount, payload.amount)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RPR-018', message: err instanceof Error ? err.message : 'Failed to record vendor claim.' } }
  }
}

// A running total, incremented on every real recovery — never decremented,
// same convention as Invoice.paidAmount. Auto-closes the claim once
// recovered reaches (or exceeds, e.g. a rounding-favorable settlement) the
// claimed amount; a shop can also close it early (write-off) by claiming
// nothing further is coming, which the UI exposes as a separate action
// rather than folding into this same endpoint (a write-off isn't "money
// received," conflating the two would misreport actual recovered cash).
export async function recordVendorRecovery(payload: { id: string; amount: number }, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    if (payload.amount <= 0) return { success: false, error: { code: 'RPR-019', message: 'Recovery amount must be greater than zero.' } }
    const db = getPrisma()
    const existing = await db.repairTicket.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'RPR-008', message: 'Repair ticket not found.' } }
    if (existing.vendorClaimAmount === null) return { success: false, error: { code: 'RPR-020', message: 'No vendor claim has been recorded for this ticket yet.' } }

    const newRecovered = roundCurrency(existing.vendorRecoveredAmount + payload.amount)
    const closed = newRecovered >= existing.vendorClaimAmount
    await db.repairTicket.update({
      where: { id: payload.id },
      data: {
        vendorRecoveredAmount: newRecovered,
        vendorClaimClosedAt: closed && !existing.vendorClaimClosedAt ? new Date() : existing.vendorClaimClosedAt
      }
    })
    await logAction(userId, 'REPAIR_TICKET_VENDOR_RECOVERY_RECORDED', 'RepairTicket', payload.id, existing.vendorRecoveredAmount, newRecovered)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RPR-021', message: err instanceof Error ? err.message : 'Failed to record vendor recovery.' } }
  }
}

// Explicit write-off — closes the claim without further recovery, distinct
// from reaching the claimed amount through recordVendorRecovery() above.
export async function writeOffVendorClaim(payload: { id: string }, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.repairTicket.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'RPR-008', message: 'Repair ticket not found.' } }
    if (existing.vendorClaimAmount === null) return { success: false, error: { code: 'RPR-020', message: 'No vendor claim has been recorded for this ticket yet.' } }
    if (existing.vendorClaimClosedAt) return { success: false, error: { code: 'RPR-022', message: 'This claim is already closed.' } }

    await db.repairTicket.update({ where: { id: payload.id }, data: { vendorClaimClosedAt: new Date() } })
    await logAction(userId, 'REPAIR_TICKET_VENDOR_CLAIM_WRITTEN_OFF', 'RepairTicket', payload.id, undefined, { outstanding: roundCurrency(existing.vendorClaimAmount - existing.vendorRecoveredAmount) })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'RPR-023', message: err instanceof Error ? err.message : 'Failed to write off vendor claim.' } }
  }
}

export const repairTicketService = {
  createRepairTicket,
  listRepairTickets,
  getRepairTicket,
  getSerialServiceHistory,
  lookupSerialService,
  updateRepairTicketStatus,
  recordVendorClaim,
  recordVendorRecovery,
  writeOffVendorClaim
}
