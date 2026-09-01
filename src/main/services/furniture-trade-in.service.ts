import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'

// Furniture vertical — old-item trade-in, mirrors metal-exchange.service.ts
// exactly (shop-assessed value credited against a new purchase via
// billing.service.ts's furnitureTradeInId payload param). tradeInValue is a
// direct shop-assessed figure, not a formula — furniture has no live market
// rate to key off the way MetalExchange has ratePerGram.

export async function listFurnitureTradeIns(filters?: { customerId?: string; unlinkedOnly?: boolean }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.unlinkedOnly) where.invoiceId = null
    const tradeIns = await db.furnitureTradeIn.findMany({
      where,
      include: { customer: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: tradeIns }
  } catch (err) {
    return { success: false, error: { code: 'FTI-001', message: err instanceof Error ? err.message : 'Could not list trade-ins.' } }
  }
}

export async function createFurnitureTradeIn(payload: {
  customerId?: string
  customerName?: string
  itemDescription: string
  condition?: string
  tradeInValue: number
  notes?: string
  createdById?: string
}) {
  try {
    if (!payload.itemDescription.trim()) {
      return { success: false, error: { code: 'FTI-002', message: 'Item description is required.' } }
    }
    if (payload.tradeInValue <= 0) {
      return { success: false, error: { code: 'FTI-003', message: 'Trade-in value must be greater than zero.' } }
    }
    if (!payload.customerId && !payload.customerName?.trim()) {
      return { success: false, error: { code: 'FTI-004', message: 'A customer or a walk-in name is required.' } }
    }

    const db = getPrisma()
    if (payload.customerId) {
      const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
      if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }
    }
    const tradeIn = await db.$transaction(async (tx) => {
      const tradeInNumber = await generateSequenceNumber(
        tx, 'furniture_trade_in_number_sequence', 'FTI', 5,
        async () => {
          const last = await tx.furnitureTradeIn.findFirst({ orderBy: { createdAt: 'desc' }, select: { tradeInNumber: true } })
          return last ? parseInt(last.tradeInNumber.replace('FTI-', ''), 10) : 0
        }
      )
      return tx.furnitureTradeIn.create({
        data: {
          tradeInNumber,
          customerId: payload.customerId ?? null,
          customerName: payload.customerName ?? null,
          itemDescription: payload.itemDescription.trim(),
          condition: payload.condition ?? null,
          tradeInValue: payload.tradeInValue,
          notes: payload.notes ?? null,
          createdById: payload.createdById ?? null,
        },
        include: { customer: { select: { id: true, customerName: true, phone: true } } },
      })
    })

    await logAction({ userId: payload.createdById, action: 'FURNITURE_TRADE_IN_CREATED', entityType: 'FurnitureTradeIn', entityId: tradeIn.id, newValue: { tradeInNumber: tradeIn.tradeInNumber, tradeInValue: payload.tradeInValue } })
    return { success: true, data: tradeIn }
  } catch (err) {
    return { success: false, error: { code: 'FTI-005', message: err instanceof Error ? err.message : 'Could not create trade-in.' } }
  }
}

export async function linkFurnitureTradeInToInvoice(tradeInId: string, invoiceId: string) {
  try {
    const db = getPrisma()
    const existing = await db.furnitureTradeIn.findUnique({ where: { id: tradeInId } })
    if (!existing) return { success: false, error: { code: 'FTI-006', message: 'Trade-in not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'FTI-007', message: 'This trade-in is already linked to an invoice.' } }
    const claim = await db.furnitureTradeIn.updateMany({ where: { id: tradeInId, invoiceId: null }, data: { invoiceId } })
    if (claim.count === 0) {
      return { success: false, error: { code: 'FTI-007', message: 'This trade-in is already linked to an invoice.' } }
    }
    const updated = await db.furnitureTradeIn.findUnique({ where: { id: tradeInId } })
    await logAction({ action: 'FURNITURE_TRADE_IN_LINKED', entityType: 'FurnitureTradeIn', entityId: tradeInId, newValue: { invoiceId } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'FTI-008', message: err instanceof Error ? err.message : 'Could not link trade-in to invoice.' } }
  }
}

export async function deleteFurnitureTradeIn(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.furnitureTradeIn.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'FTI-006', message: 'Trade-in not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'FTI-009', message: 'Cannot delete a trade-in already linked to an invoice.' } }
    await db.furnitureTradeIn.delete({ where: { id } })
    await logAction({ action: 'FURNITURE_TRADE_IN_DELETED', entityType: 'FurnitureTradeIn', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'FTI-010', message: err instanceof Error ? err.message : 'Could not delete trade-in.' } }
  }
}
