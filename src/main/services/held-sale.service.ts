import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 58 §2 — hold/park-sale on the Billing/POS screen. Deliberately NOT
// built on Quotation (see the schema's own comment on HeldSale) — a single
// JSON blob snapshot of the cart is the cheapest correct fit for something
// this ephemeral: a row existing means it's held, deleting it (on resume or
// explicit abandon) is the only lifecycle. No stock reservation, no
// notification, no sequence number.

export interface HeldSaleSummary {
  id: string
  label: string | null
  customerId: string | null
  customerName: string | null
  itemCount: number
  totalAmount: number
  createdAt: string
}

function serializeSummary(h: { id: string; label: string | null; customerId: string | null; itemCount: number; totalAmount: number; createdAt: Date; customer: { customerName: string } | null }): HeldSaleSummary {
  return {
    id: h.id, label: h.label, customerId: h.customerId, customerName: h.customer?.customerName ?? null,
    itemCount: h.itemCount, totalAmount: h.totalAmount, createdAt: h.createdAt.toISOString(),
  }
}

export async function holdSale(payload: {
  cartJson: string; itemCount: number; totalAmount: number
  label?: string; customerId?: string; createdById?: string
}): Promise<{ success: boolean; data?: { id: string }; error?: { code: string; message: string } }> {
  try {
    if (!payload.cartJson || payload.itemCount <= 0) {
      return { success: false, error: { code: 'HLD-001', message: 'Cannot hold an empty cart.' } }
    }
    const db = getPrisma()
    const held = await db.heldSale.create({
      data: {
        label: payload.label?.trim() || null, customerId: payload.customerId ?? null,
        cartJson: payload.cartJson, itemCount: payload.itemCount, totalAmount: payload.totalAmount,
        createdById: payload.createdById ?? null,
      },
    })
    await logAction({ userId: payload.createdById, action: 'SALE_HELD', entityType: 'HeldSale', entityId: held.id })
    return { success: true, data: { id: held.id } }
  } catch (e) {
    return { success: false, error: { code: 'HLD-002', message: e instanceof Error ? e.message : 'Could not hold sale.' } }
  }
}

export async function listHeldSales(): Promise<{ success: boolean; data?: { sales: HeldSaleSummary[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.heldSale.findMany({
      include: { customer: { select: { customerName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: { sales: rows.map(serializeSummary) } }
  } catch (e) {
    return { success: false, error: { code: 'HLD-003', message: e instanceof Error ? e.message : 'Could not load held sales.' } }
  }
}

// Resuming consumes the held record — if the cashier parks it again, a
// fresh holdSale() call is what creates the next row. This avoids a stale
// held-sale silently sitting around alongside an active resumed cart.
export async function resumeSale(id: string, userId?: string): Promise<{ success: boolean; data?: { cartJson: string }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const held = await db.heldSale.findUnique({ where: { id } })
    if (!held) return { success: false, error: { code: 'HLD-004', message: 'Held sale not found.' } }
    await db.heldSale.delete({ where: { id } })
    await logAction({ userId, action: 'SALE_RESUMED', entityType: 'HeldSale', entityId: id })
    return { success: true, data: { cartJson: held.cartJson } }
  } catch (e) {
    return { success: false, error: { code: 'HLD-005', message: e instanceof Error ? e.message : 'Could not resume sale.' } }
  }
}

export async function deleteHeldSale(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    await db.heldSale.delete({ where: { id } })
    await logAction({ userId, action: 'HELD_SALE_ABANDONED', entityType: 'HeldSale', entityId: id })
    return { success: true }
  } catch (e) {
    return { success: false, error: { code: 'HLD-006', message: e instanceof Error ? e.message : 'Could not delete held sale.' } }
  }
}

export const heldSaleService = { holdSale, listHeldSales, resumeSale, deleteHeldSale }
