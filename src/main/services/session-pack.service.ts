import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'
import { billingService } from './billing.service'

// ClientSessionPack.pricePerPack is a Prisma Decimal — Electron's IPC
// (structured clone) cannot serialize a Decimal instance and throws
// "An object could not be cloned" on every response that includes one.
// Applied to every function below that returns pack data.
function serializePack<T extends { pricePerPack: unknown }>(pack: T): T {
  return { ...pack, pricePerPack: Number(pack.pricePerPack) }
}

export async function getActivePack(customerId: string) {
  try {
    const db = getPrisma()
    const packs = await db.clientSessionPack.findMany({
      where: { customerId, isActive: true },
      include: { sessionLogs: { orderBy: { deductedAt: 'desc' }, take: 5 } },
      orderBy: { purchaseDate: 'asc' },
    })
    const active = packs.find((p) => p.usedSessions < p.totalSessions) ?? null
    return { success: true, data: active ? serializePack(active) : null }
  } catch (err) {
    return { success: false, error: { code: 'SP-001', message: err instanceof Error ? err.message : 'Could not fetch session pack.' } }
  }
}

export async function listPacks(customerId: string) {
  try {
    const db = getPrisma()
    const packs = await db.clientSessionPack.findMany({
      where: { customerId },
      include: {
        _count: { select: { sessionLogs: true } },
      },
      orderBy: { purchaseDate: 'asc' },
    })
    return { success: true, data: packs.map(serializePack) }
  } catch (err) {
    return { success: false, error: { code: 'SP-002', message: err instanceof Error ? err.message : 'Could not list session packs.' } }
  }
}

export async function listAllActivePacks() {
  try {
    const db = getPrisma()
    const packs = await db.clientSessionPack.findMany({
      where: { isActive: true },
      include: {
        customer: { select: { id: true, customerName: true, phone: true } },
      },
      orderBy: { purchaseDate: 'desc' },
    })
    return { success: true, data: packs.map(serializePack) }
  } catch (err) {
    return { success: false, error: { code: 'SP-003', message: err instanceof Error ? err.message : 'Could not list all session packs.' } }
  }
}

export async function createPack(payload: {
  customerId: string
  packName: string
  totalSessions: number
  purchaseDate?: string
  expiryDate?: string | null
  pricePerPack?: number
  taxRate?: number
  sacCode?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const pack = await db.clientSessionPack.create({
      data: {
        customerId: payload.customerId,
        packName: payload.packName,
        totalSessions: payload.totalSessions,
        usedSessions: 0,
        purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : new Date(),
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
        pricePerPack: payload.pricePerPack ?? 0,
        taxRate: payload.taxRate ?? 18,
        sacCode: payload.sacCode ?? null,
        notes: payload.notes ?? null,
        isActive: true,
      },
    })

    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'ClientSessionPack', entityId: pack.id, newValue: JSON.stringify({ customerId: payload.customerId, totalSessions: payload.totalSessions }) },
    }).catch(() => {})

    // Schedule expiry notifications if expiryDate is set
    if (pack.expiryDate) {
      scheduleSessionPackExpiryReminders(pack.id, pack.customerId, pack.packName, pack.expiryDate).catch(() => {})
    }

    return { success: true, data: serializePack(pack) }
  } catch (err) {
    return { success: false, error: { code: 'SP-004', message: err instanceof Error ? err.message : 'Could not create session pack.' } }
  }
}

export async function deductSession(payload: { customerId: string; appointmentId?: string }) {
  try {
    const db = getPrisma()

    // The "no active pack" check, the "already deducted" check, and the
    // actual update+create all run inside one transaction now — previously
    // the checks ran before and outside the transaction, so two
    // near-simultaneous calls for the same appointment could both pass the
    // "already deducted" check before either committed, and the second
    // would crash on SessionLog.appointmentId's unique constraint instead of
    // gracefully reporting it was already deducted.
    const result = await db.$transaction(async (tx): Promise<
      | { status: 'no-pack' }
      | { status: 'already-deducted'; pack: Awaited<ReturnType<typeof tx.clientSessionPack.findFirst>> }
      | { status: 'ok'; pack: Awaited<ReturnType<typeof tx.clientSessionPack.update>>; log: Awaited<ReturnType<typeof tx.sessionLog.create>>; depleted: boolean }
    > => {
      const packs = await tx.clientSessionPack.findMany({
        where: { customerId: payload.customerId, isActive: true },
        orderBy: { purchaseDate: 'asc' },
      })
      const pack = packs.find((p) => p.usedSessions < p.totalSessions)
      if (!pack) return { status: 'no-pack' }

      if (payload.appointmentId) {
        const existing = await tx.sessionLog.findUnique({ where: { appointmentId: payload.appointmentId } })
        if (existing) return { status: 'already-deducted', pack }
      }

      const newUsed = pack.usedSessions + 1
      const depleted = newUsed >= pack.totalSessions

      const updatedPack = await tx.clientSessionPack.update({
        where: { id: pack.id },
        data: {
          usedSessions: newUsed,
          ...(depleted ? { isActive: false } : {}),
        },
      })
      const log = await tx.sessionLog.create({
        data: {
          clientSessionPackId: pack.id,
          appointmentId: payload.appointmentId ?? null,
          deductedAt: new Date(),
        },
      })

      return { status: 'ok', pack: updatedPack, log, depleted }
    })

    if (result.status === 'no-pack') {
      return { success: false, error: { code: 'SP-005', message: 'No active session pack with remaining sessions found.' } }
    }
    if (result.status === 'already-deducted') {
      return { success: true, data: { alreadyDeducted: true, pack: result.pack ? serializePack(result.pack) : null } }
    }

    await db.auditLog.create({
      data: { action: 'DEDUCT', entityType: 'ClientSessionPack', entityId: result.pack.id, newValue: JSON.stringify({ usedSessions: result.pack.usedSessions, depleted: result.depleted }) },
    }).catch(() => {})

    return {
      success: true,
      data: {
        pack: serializePack(result.pack),
        log: result.log,
        remaining: result.pack.totalSessions - result.pack.usedSessions,
        depleted: result.depleted,
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'SP-007', message: err instanceof Error ? err.message : 'Could not deduct session.' } }
  }
}

// Phase 41: closes the real root cause of a double-charge risk found while
// designing appointment invoicing — a pack-redeemed appointment never zeroes
// its own totalAmount, so the actual revenue event for that session already
// happened here, at pack purchase, not at redemption. Same atomic-claim
// pattern as every other generate function this session (see
// time-entry.service.ts's INVOICE_CLAIM_SENTINEL for the full rationale).
const INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateSessionPackInvoice(packId: string) {
  const db = getPrisma()
  try {
    const claim = await db.clientSessionPack.updateMany({
      where: { id: packId, invoiceId: null },
      data: { invoiceId: INVOICE_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.clientSessionPack.findUnique({ where: { id: packId }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'SP-008', message: 'Session pack not found.' } }
      return { success: false, error: { code: 'SP-009', message: 'Invoice already generated for this pack.' } }
    }

    try {
      const pack = await db.clientSessionPack.findUnique({ where: { id: packId } })
      if (!pack || Number(pack.pricePerPack) <= 0) {
        await db.clientSessionPack.update({ where: { id: packId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'SP-010', message: 'Set a pack price greater than zero before generating an invoice.' } }
      }

      // No single fallback SAC code is correct here — session packs are used
      // by PHYSIO_CLINIC, GYM_STUDIO, and BEAUTY_SALON alike, each with a
      // different real SAC. sacCode is left null (no HSN/SAC on the invoice
      // line) unless the business explicitly set one on this specific pack —
      // guessing wrong would misstate a real tax filing for 2 of the 3 verticals.
      let product = await db.product.findFirst({ where: { hsnCode: pack.sacCode ?? null, productName: pack.packName, isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: pack.packName, productType: 'SERVICE', hsnCode: pack.sacCode ?? null, sellingPrice: 0, taxRate: pack.taxRate, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: pack.customerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(pack.pricePerPack),
          taxRate: pack.taxRate,
        }],
        notes: `Session pack: ${pack.packName} (${pack.totalSessions} sessions)`,
        referenceNumber: packId.slice(0, 12),
      })
      if (!result.success) {
        await db.clientSessionPack.update({ where: { id: packId }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.clientSessionPack.update({ where: { id: packId }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'ClientSessionPack', entityId: packId, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.clientSessionPack.update({ where: { id: packId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'SP-011', message: err instanceof Error ? err.message : 'Could not generate session pack invoice.' } }
  }
}

export async function listSessionLogs(clientSessionPackId: string) {
  try {
    const db = getPrisma()
    const logs = await db.sessionLog.findMany({
      where: { clientSessionPackId },
      include: {
        appointment: {
          select: { id: true, appointmentNumber: true, scheduledDate: true, serviceTitle: true },
        },
      },
      orderBy: { deductedAt: 'desc' },
    })
    return { success: true, data: logs }
  } catch (err) {
    return { success: false, error: { code: 'SP-006', message: err instanceof Error ? err.message : 'Could not list session logs.' } }
  }
}

async function scheduleSessionPackExpiryReminders(packId: string, customerId: string, packName: string, expiryDate: Date) {
  try {
    const db = getPrisma()
    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { customerName: true, phone: true },
    })
    if (!customer) return
    const name = customer.customerName
    const phone = customer.phone ?? null
    const dateStr = expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const now = new Date()

    const thirtyBefore = new Date(expiryDate)
    thirtyBefore.setDate(thirtyBefore.getDate() - 30)
    const sevenBefore = new Date(expiryDate)
    sevenBefore.setDate(sevenBefore.getDate() - 7)

    if (thirtyBefore > now) {
      const body30 = `Hi ${name}, your session pack "${packName}" expires on ${dateStr}. Book sessions before it expires. Powered by Sarang | www.aszurex.com`
      const link30 = phone ? await buildWhatsAppLink(phone, body30) : null
      await db.notificationQueue.create({
        data: { customerId, customerName: name, customerPhone: phone, notificationType: 'SESSION_PACK_EXPIRY_30D', templateBody: body30, whatsappLink: link30, scheduledFor: thirtyBefore },
      })
    }
    if (sevenBefore > now) {
      const body7 = `Hi ${name}, your session pack "${packName}" expires in 7 days (${dateStr}). Use your remaining sessions soon! Powered by Sarang | www.aszurex.com`
      const link7 = phone ? await buildWhatsAppLink(phone, body7) : null
      await db.notificationQueue.create({
        data: { customerId, customerName: name, customerPhone: phone, notificationType: 'SESSION_PACK_EXPIRY_7D', templateBody: body7, whatsappLink: link7, scheduledFor: sevenBefore },
      })
    }
    void packId
  } catch {
    // Non-critical
  }
}
