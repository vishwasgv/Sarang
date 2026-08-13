import type { Prisma } from '@prisma/client'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

type Tx = Prisma.TransactionClient

// Phase 64 — pure, independently-testable allocation math. Splits one
// landed-cost amount (freight/duty/handling) across N purchase lines,
// either proportional to each line's own value (qty*unitCost) or its
// quantity. Exported standalone since both receivePO (direct receive) and
// createBill (Bill's own inline landed costs) need the identical math.
export function allocateLandedCostAcrossLines(
  totalLandedCost: number,
  allocationMethod: 'BY_VALUE' | 'BY_QUANTITY',
  lines: Array<{ value: number; quantity: number }>
): number[] {
  if (totalLandedCost <= 0 || lines.length === 0) return lines.map(() => 0)
  const basis = allocationMethod === 'BY_QUANTITY' ? lines.map(l => l.quantity) : lines.map(l => l.value)
  const totalBasis = basis.reduce((sum, b) => sum + b, 0)
  // Every line has zero value/quantity to allocate against (e.g. an
  // all-free-of-cost order) — split evenly rather than silently returning
  // an all-zero share, which would make the landed cost vanish entirely.
  if (totalBasis <= 0) {
    const evenShare = totalLandedCost / lines.length
    return lines.map(() => evenShare)
  }
  return basis.map(b => (b / totalBasis) * totalLandedCost)
}

// Phase 64 — resolves the per-unit landed-cost addition for each line of a
// Purchase Order, pooling every LandedCostAllocation row attached to it
// (each allocated independently by its own allocationMethod, then summed
// per line) — called from receivePO() right before unitCost feeds into
// addStockTx/ProductCostHistory, so a landed-cost-bearing purchase
// genuinely raises the received goods' cost basis.
export async function getLandedCostPerUnitForPO(
  tx: Tx,
  purchaseOrderId: string,
  lines: Array<{ productId: string; quantity: number; unitCost: number }>
): Promise<Map<string, number>> {
  const perUnit = new Map<string, number>()
  if (lines.length === 0) return perUnit

  const allocations = await tx.landedCostAllocation.findMany({ where: { purchaseOrderId } })
  if (allocations.length === 0) return perUnit

  const perLineTotal = new Array(lines.length).fill(0)
  for (const alloc of allocations) {
    const shares = allocateLandedCostAcrossLines(
      alloc.amount,
      alloc.allocationMethod as 'BY_VALUE' | 'BY_QUANTITY',
      lines.map(l => ({ value: l.quantity * l.unitCost, quantity: l.quantity }))
    )
    shares.forEach((s, i) => { perLineTotal[i] += s })
  }

  lines.forEach((l, i) => {
    perUnit.set(l.productId, l.quantity > 0 ? perLineTotal[i] / l.quantity : 0)
  })
  return perUnit
}

export const landedCostService = {
  async listForPurchaseOrder(purchaseOrderId: string) {
    const db = getPrisma()
    const rows = await db.landedCostAllocation.findMany({ where: { purchaseOrderId }, orderBy: { createdAt: 'asc' } })
    return { success: true, data: rows }
  },

  // Only ever allowed before the PO's first receipt — once receiving has
  // started, some lines may have already posted their ProductCostHistory
  // without this allocation baked in, and that ledger is append-only (never
  // retroactively rewritten, matching Phase 61's own established
  // convention for this table). A genuinely late-arriving freight invoice
  // is a real, disclosed scope cut here, not silently unhandled.
  async addAllocation(payload: { purchaseOrderId: string; costType: string; amount: number; allocationMethod?: 'BY_VALUE' | 'BY_QUANTITY' }, userId?: string) {
    const db = getPrisma()
    if (payload.amount <= 0) return { success: false, error: { code: 'LC-001', message: 'Amount must be greater than zero.' } }
    const po = await db.purchaseOrder.findUnique({ where: { id: payload.purchaseOrderId }, select: { id: true, status: true } })
    if (!po) return { success: false, error: { code: 'PO-001', message: 'Purchase order not found.' } }
    if (po.status === 'RECEIVED' || po.status === 'PARTIAL_RECEIVED') {
      return { success: false, error: { code: 'LC-002', message: 'Cannot add a landed cost once receiving has started on this Purchase Order.' } }
    }
    const created = await db.landedCostAllocation.create({
      data: {
        purchaseOrderId: payload.purchaseOrderId,
        costType: payload.costType,
        amount: payload.amount,
        allocationMethod: payload.allocationMethod ?? 'BY_VALUE'
      }
    })
    await logAction({ userId, action: 'LANDED_COST_ADDED', entityType: 'PurchaseOrder', entityId: payload.purchaseOrderId, newValue: created })
    return { success: true, data: created }
  },

  async removeAllocation(id: string, userId?: string) {
    const db = getPrisma()
    const existing = await db.landedCostAllocation.findUnique({ where: { id }, include: { purchaseOrder: { select: { status: true } } } })
    if (!existing) return { success: false, error: { code: 'LC-003', message: 'Landed cost allocation not found.' } }
    if (existing.purchaseOrder && (existing.purchaseOrder.status === 'RECEIVED' || existing.purchaseOrder.status === 'PARTIAL_RECEIVED')) {
      return { success: false, error: { code: 'LC-002', message: 'Cannot remove a landed cost once receiving has started on this Purchase Order.' } }
    }
    await db.landedCostAllocation.delete({ where: { id } })
    await logAction({ userId, action: 'LANDED_COST_REMOVED', entityType: 'PurchaseOrder', entityId: existing.purchaseOrderId ?? existing.billId ?? '', oldValue: existing })
    return { success: true }
  }
}
