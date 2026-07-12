import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

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
    const existing = await db.productSerial.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'SER-006', message: 'Serial not found.' } }

    await db.$transaction(async (tx) => {
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
    })

    await logAction(userId, 'SERIAL_STATUS_UPDATED', 'ProductSerial', payload.id, existing.status, payload.status)
    return { success: true }
  } catch (err) {
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
export async function markSerialSoldTx(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  serialId: string,
  invoiceId: string
): Promise<void> {
  await tx.productSerial.update({
    where: { id: serialId },
    data: { status: 'SOLD', invoiceId, soldDate: new Date() }
  })
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
