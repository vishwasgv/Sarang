import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import { buildReminderWhatsAppLink } from './notification-queue.service'
import { parseLocalDateStart } from '../utils/date.util'

export type SerialStatus = 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DEFECTIVE'

export interface SerialRecord {
  id: string
  productId: string
  productName: string
  serialNumber: string
  imeiNumber: string | null
  imei2Number: string | null
  warrantyMonths: number | null
  warrantyExpiryDate: string | null
  purchaseDate: string | null
  unitCost: number
  status: SerialStatus
  invoiceId: string | null
  soldDate: string | null
  createdAt: string
}

export async function listSerials(payload?: {
  productId?: string
  status?: SerialStatus
  imeiNumber?: string
  serialNumber?: string
  page?: number
  limit?: number
}): Promise<{ success: boolean; data?: { serials: SerialRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const page = payload?.page ?? 1
    const limit = payload?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (payload?.productId) where.productId = payload.productId
    if (payload?.status) where.status = payload.status
    if (payload?.imeiNumber) where.imeiNumber = { contains: payload.imeiNumber }
    if (payload?.serialNumber) where.serialNumber = { contains: payload.serialNumber }

    const [rows, total] = await Promise.all([
      db.productSerial.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { productName: true } } }
      }),
      db.productSerial.count({ where })
    ])

    return {
      success: true,
      data: {
        serials: rows.map(s => toRecord(s)),
        total
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'SER-001', message: err instanceof Error ? err.message : 'Failed to list serials.' } }
  }
}

export async function createSerial(payload: {
  productId: string
  serialNumber: string
  imeiNumber?: string
  imei2Number?: string
  warrantyMonths?: number
  purchaseDate?: string
  unitCost?: number
}, userId?: string): Promise<{ success: boolean; data?: SerialRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { productName: true } })
    if (!product) return { success: false, error: { code: 'SER-002', message: 'Product not found.' } }

    const warrantyExpiry = payload.warrantyMonths && payload.purchaseDate
      ? new Date(new Date(payload.purchaseDate).setMonth(new Date(payload.purchaseDate).getMonth() + payload.warrantyMonths))
      : payload.warrantyMonths
        ? new Date(new Date().setMonth(new Date().getMonth() + payload.warrantyMonths))
        : null

    const serial = await db.$transaction(async (tx) => {
      const created = await tx.productSerial.create({
        data: {
          productId: payload.productId,
          serialNumber: payload.serialNumber.trim().toUpperCase(),
          imeiNumber: payload.imeiNumber?.trim() ?? null,
          imei2Number: payload.imei2Number?.trim() ?? null,
          warrantyMonths: payload.warrantyMonths ?? null,
          warrantyExpiryDate: warrantyExpiry,
          purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : null,
          unitCost: payload.unitCost ?? 0,
          status: 'AVAILABLE'
        },
        include: { product: { select: { productName: true } } }
      })
      await tx.inventory.upsert({
        where: { productId: payload.productId },
        create: { productId: payload.productId, quantity: 1 },
        update: { quantity: { increment: 1 } }
      })
      return created
    })

    await logAction(userId, 'SERIAL_CREATED', 'ProductSerial', serial.id, undefined, { serialNumber: serial.serialNumber })

    return { success: true, data: toRecord({ ...serial, product: { productName: product.productName } }) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create serial.'
    if (msg.includes('Unique constraint')) {
      return { success: false, error: { code: 'SER-003', message: 'Serial number or IMEI already exists.' } }
    }
    return { success: false, error: { code: 'SER-004', message: msg } }
  }
}

export async function bulkCreateSerials(payload: {
  productId: string
  serials: Array<{ serialNumber: string; imeiNumber?: string; imei2Number?: string; warrantyMonths?: number; unitCost?: number }>
  purchaseDate?: string
}, userId?: string): Promise<{ success: boolean; data?: { created: number; skipped: number; errors: string[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { productName: true } })
    if (!product) return { success: false, error: { code: 'SER-002', message: 'Product not found.' } }

    let created = 0
    let skipped = 0
    const errors: string[] = []

    const purchaseDateObj = payload.purchaseDate ? new Date(payload.purchaseDate) : new Date()

    for (const s of payload.serials) {
      try {
        const warrantyExpiry = s.warrantyMonths
          ? new Date(new Date(purchaseDateObj).setMonth(purchaseDateObj.getMonth() + s.warrantyMonths))
          : null

        await db.productSerial.create({
          data: {
            productId: payload.productId,
            serialNumber: s.serialNumber.trim().toUpperCase(),
            imeiNumber: s.imeiNumber?.trim() ?? null,
            imei2Number: s.imei2Number?.trim() ?? null,
            warrantyMonths: s.warrantyMonths ?? null,
            warrantyExpiryDate: warrantyExpiry,
            purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : null,
            unitCost: s.unitCost ?? 0,
            status: 'AVAILABLE'
          }
        })
        created++
      } catch {
        skipped++
        errors.push(`Skipped ${s.serialNumber} — already exists or invalid.`)
      }
    }

    if (created > 0) {
      await db.inventory.upsert({
        where: { productId: payload.productId },
        create: { productId: payload.productId, quantity: created },
        update: { quantity: { increment: created } }
      })
      await logAction(userId, 'SERIALS_BULK_CREATED', 'ProductSerial', payload.productId, undefined, { created, skipped })
    }

    return { success: true, data: { created, skipped, errors } }
  } catch (err) {
    return { success: false, error: { code: 'SER-005', message: err instanceof Error ? err.message : 'Bulk create failed.' } }
  }
}

export async function updateSerialStatus(payload: {
  id: string
  status: SerialStatus
  invoiceId?: string
  soldDate?: string
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    // Real bug found live (core-commerce audit): `existing` used to be read
    // BEFORE this transaction opened, then that same stale snapshot decided
    // whether to increment/decrement inventory below. Two near-simultaneous
    // status changes on the same serial (e.g. two staff both marking a
    // returned unit back AVAILABLE) would each capture the identical
    // pre-transaction status, so the inventory adjustment could apply twice
    // for what is really only one real state transition — the same
    // read-outside-tx race class already fixed for markSerialSoldTx above,
    // and for the analogous update() flows elsewhere in this scope. Reading
    // fresh INSIDE the transaction closes it: SQLite serializes writers, so
    // nothing can commit between this read and the write right below it in
    // the same transaction (mirrors purchaseOrderService.approvePO's
    // "read-check-write atomically inside one transaction" precedent).
    const previousStatus = await db.$transaction(async (tx) => {
      const existing = await tx.productSerial.findUnique({ where: { id: payload.id } })
      if (!existing) throw new ServiceError('SER-006', 'Serial not found.')

      await tx.productSerial.update({
        where: { id: payload.id },
        data: {
          status: payload.status,
          invoiceId: payload.invoiceId ?? existing.invoiceId,
          soldDate: payload.soldDate ? new Date(payload.soldDate) : (payload.status === 'SOLD' ? new Date() : existing.soldDate)
        }
      })

      if (payload.status === 'SOLD' && existing.status === 'AVAILABLE') {
        await tx.inventory.upsert({
          where: { productId: existing.productId },
          create: { productId: existing.productId, quantity: 0 },
          update: { quantity: { decrement: 1 } }
        })
      } else if (payload.status === 'AVAILABLE' && existing.status === 'SOLD') {
        await tx.inventory.upsert({
          where: { productId: existing.productId },
          create: { productId: existing.productId, quantity: 1 },
          update: { quantity: { increment: 1 } }
        })
      } else if (payload.status === 'AVAILABLE' && existing.status === 'RETURNED') {
        // Device went SOLD → RETURNED (inspection pending) → AVAILABLE (ready again).
        // Inventory was decremented when SOLD and not restored on RETURNED, so restore here.
        await tx.inventory.upsert({
          where: { productId: existing.productId },
          create: { productId: existing.productId, quantity: 1 },
          update: { quantity: { increment: 1 } }
        })
      }

      return existing.status
    })

    await logAction(userId, 'SERIAL_STATUS_UPDATED', 'ProductSerial', payload.id, previousStatus, payload.status)
    return { success: true }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'SER-007', message: err instanceof Error ? err.message : 'Failed to update serial.' } }
  }
}

// Marks the specific unit sold and links it to the invoice — called from
// billing.service.ts inside the invoice transaction. Previously nothing in
// the sales pipeline ever touched ProductSerial at all, so "warranty
// management" had no way to know which physical unit a customer actually
// bought; the only path was a fully manual, disconnected status edit.
// inventory.quantity is deducted by the same reduceStockTx call that handles
// every other STANDARD product in the same loop, so it is NOT duplicated here.
//
// Real bug fixed (found live, 2026-07-28 audit): this used to be an
// unconditional update with no re-check inside the transaction — the only
// "is this serial available" check happened on a stale pre-transaction read
// in billing.service.ts. Two concurrent sales of the same physical unit
// would both pass that stale check, and the second one to commit would
// silently overwrite the first sale's invoiceId, leaving no record that the
// unit was ever sold on the first invoice. Fixed to match the same
// conditional-claim shape already used for tables and metal exchanges in
// billing.service.ts — a `updateMany` scoped to the still-available state,
// with the caller rejected via ServiceError if it lost the race.
export async function markSerialSoldTx(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  serialId: string,
  invoiceId: string
): Promise<void> {
  const claim = await tx.productSerial.updateMany({
    where: { id: serialId, status: 'AVAILABLE' },
    data: { status: 'SOLD', invoiceId, soldDate: new Date() }
  })
  if (claim.count === 0) {
    throw new ServiceError('INVOC-017', 'This unit was just sold on another invoice. Please pick a different unit.')
  }
}

// Invoice cancellation counterpart to markSerialSoldTx — restores the exact
// unit (unlike batches, a serial is tied to precisely one invoice item, so
// this reversal is exact, not an approximation).
export async function markSerialAvailableTx(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  serialId: string
): Promise<void> {
  await tx.productSerial.update({
    where: { id: serialId },
    data: { status: 'AVAILABLE', invoiceId: null, soldDate: null }
  })
}

export async function searchByImei(imei: string): Promise<{ success: boolean; data?: SerialRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const serial = await db.productSerial.findFirst({
      where: { OR: [{ imeiNumber: imei }, { imei2Number: imei }] },
      include: { product: { select: { productName: true } } }
    })
    if (!serial) return { success: false, error: { code: 'SER-008', message: 'No device found with this IMEI.' } }
    return { success: true, data: toRecord(serial) }
  } catch (err) {
    return { success: false, error: { code: 'SER-009', message: err instanceof Error ? err.message : 'IMEI search failed.' } }
  }
}

function toRecord(s: { id: string; productId: string; product: { productName: string }; serialNumber: string; imeiNumber: string | null; imei2Number: string | null; warrantyMonths: number | null; warrantyExpiryDate: Date | null; purchaseDate: Date | null; unitCost: number; status: string; invoiceId: string | null; soldDate: Date | null; createdAt: Date }): SerialRecord {
  return {
    id: s.id,
    productId: s.productId,
    productName: s.product.productName,
    serialNumber: s.serialNumber,
    imeiNumber: s.imeiNumber,
    imei2Number: s.imei2Number,
    warrantyMonths: s.warrantyMonths,
    warrantyExpiryDate: s.warrantyExpiryDate?.toISOString() ?? null,
    purchaseDate: s.purchaseDate?.toISOString() ?? null,
    unitCost: s.unitCost,
    status: s.status as SerialStatus,
    invoiceId: s.invoiceId,
    soldDate: s.soldDate?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString()
  }
}

// Phase 67 §9.1 — Agri Inputs item 5: equipment AMC/service reminders. Lives
// on ProductSerial itself (the equipment unit), not a JobCard — the due
// date is a property of the physical tractor/sprayer, not of any one
// service EVENT, mirroring how warrantyExpiryDate above already lives here
// rather than on a ticket. Deliberately mirrors CarJobCard's own already-
// proven listVehiclesDueForService/scheduleNextServiceReminder pattern —
// same shape, same WhatsApp-via-notificationQueue mechanism, just keyed to
// a serial/equipment unit instead of a vehicle.
export async function updateSerialServiceInfo(
  payload: { id: string; nextServiceDueDate?: string | null; lastServicedDate?: string | null },
  userId?: string
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.productSerial.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'SER-010', message: 'Equipment record not found.' } }

    await db.productSerial.update({
      where: { id: payload.id },
      data: {
        ...(payload.nextServiceDueDate !== undefined ? { nextServiceDueDate: payload.nextServiceDueDate ? parseLocalDateStart(payload.nextServiceDueDate) : null } : {}),
        ...(payload.lastServicedDate !== undefined ? { lastServicedDate: payload.lastServicedDate ? parseLocalDateStart(payload.lastServicedDate) : null } : {})
      }
    })
    await logAction(userId, 'SERIAL_SERVICE_INFO_UPDATED', 'ProductSerial', payload.id, undefined, payload)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SER-011', message: err instanceof Error ? err.message : 'Failed to update service info.' } }
  }
}

export interface EquipmentDueForServiceRow {
  serialId: string; productName: string; serialNumber: string
  nextServiceDueDate: string | null; lastServicedDate: string | null
  dueForService: boolean; overdue: boolean
}

export async function listEquipmentDueForService(dueSoonDays = 14): Promise<{ success: boolean; data?: EquipmentDueForServiceRow[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const serials = await db.productSerial.findMany({
      where: { nextServiceDueDate: { not: null } },
      include: { product: { select: { productName: true } } },
      orderBy: { nextServiceDueDate: 'asc' }
    })

    const now = new Date()
    const soonCutoff = new Date(now.getTime() + dueSoonDays * 86400000)

    const data: EquipmentDueForServiceRow[] = serials.map(s => ({
      serialId: s.id, productName: s.product.productName, serialNumber: s.serialNumber,
      nextServiceDueDate: s.nextServiceDueDate!.toISOString(), lastServicedDate: s.lastServicedDate?.toISOString() ?? null,
      dueForService: s.nextServiceDueDate! <= soonCutoff, overdue: s.nextServiceDueDate! <= now
    }))
    return { success: true, data }
  } catch (err) {
    return { success: false, error: { code: 'SER-012', message: err instanceof Error ? err.message : 'Could not list equipment due for service.' } }
  }
}

// Phase 69 §11 — Plumbing wow feature: Installation Warranty Transfer.
// Re-attributes an already-sold unit's warranty to whoever actually lives
// with the installation (often not the buyer — a contractor bought it on
// a job-site account, installs it at the homeowner's site) so a future
// warranty claim resolves against the right customer record.
export async function transferInstallationWarranty(
  payload: { serialId: string; customerId: string; installationAddress?: string },
  userId?: string
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.productSerial.findUnique({ where: { id: payload.serialId } })
    if (!existing) return { success: false, error: { code: 'SER-013', message: 'Unit not found.' } }
    if (existing.status !== 'SOLD') return { success: false, error: { code: 'SER-014', message: 'Only a sold unit can have its installation warranty transferred.' } }
    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }

    await db.productSerial.update({
      where: { id: payload.serialId },
      data: { installedCustomerId: payload.customerId, installedAt: new Date(), installationAddress: payload.installationAddress ?? null }
    })
    await logAction({ userId, action: 'INSTALLATION_WARRANTY_TRANSFERRED', entityType: 'ProductSerial', entityId: payload.serialId, newValue: { installedCustomerId: payload.customerId } })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SER-015', message: err instanceof Error ? err.message : 'Could not transfer installation warranty.' } }
  }
}

export async function scheduleEquipmentServiceReminder(
  serialId: string,
  daysBefore = 3
): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const serial = await db.productSerial.findUnique({ where: { id: serialId }, include: { product: { select: { productName: true } } } })
    if (!serial) return { success: false, error: { code: 'SER-013', message: 'Equipment record not found.' } }
    if (!serial.nextServiceDueDate) return { success: false, error: { code: 'SER-014', message: 'No next-service-due date set on this equipment.' } }

    // ProductSerial.invoiceId is a plain string, not a Prisma relation — the
    // owning customer is resolved via the linked Invoice, same as any other
    // post-sale lookup this codebase does off a bare invoiceId.
    const invoice = serial.invoiceId ? await db.invoice.findUnique({ where: { id: serial.invoiceId }, include: { customer: { select: { customerName: true, phone: true } } } }) : null
    if (!invoice?.customer?.phone) return { success: true, data: null }

    const scheduledFor = new Date(serial.nextServiceDueDate.getTime() - daysBefore * 86400000)
    if (scheduledFor <= new Date()) return { success: false, error: { code: 'SER-015', message: 'The reminder date has already passed — the due date is too close (or in the past) to schedule ahead.' } }

    const dueDateStr = serial.nextServiceDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const message = `Dear ${invoice.customer.customerName}, your ${serial.product.productName} (${serial.serialNumber}) is due for its next service around ${dueDateStr}. Please book a service visit. Thank you! Powered by Sarang | www.aszurex.com`
    const link = await buildReminderWhatsAppLink(invoice.customer.phone, message)

    const row = await db.notificationQueue.create({
      data: {
        customerId: invoice.customerId,
        customerName: invoice.customer.customerName,
        customerPhone: invoice.customer.phone,
        notificationType: 'EQUIPMENT_SERVICE_DUE_REMINDER',
        templateBody: message,
        whatsappLink: link,
        scheduledFor,
        status: 'PENDING'
      }
    })
    await logAction(undefined, 'EQUIPMENT_SERVICE_REMINDER_SCHEDULED', 'ProductSerial', serialId, undefined, { scheduledFor })
    return { success: true, data: row }
  } catch (err) {
    return { success: false, error: { code: 'SER-016', message: err instanceof Error ? err.message : 'Failed to schedule the service reminder.' } }
  }
}
