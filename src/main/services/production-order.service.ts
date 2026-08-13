import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { ServiceError } from '../errors/service-error'
import { applyLocationDeltaTx } from './inventory.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

export interface ProductionOrderRecord {
  id: string
  orderNumber: string
  productId: string
  productName: string
  bomId: string
  plannedQty: number
  producedQty: number
  // Phase 58 §2 — units attempted but failed QC/rejected, consumed
  // material+labor but added zero inventory value.
  scrapQty: number
  // Phase 64 — computed from the sum of this order's own ProductionLaborEntry
  // rows once any exist; falls back to a direct payload.laborCost for any
  // order that never itemizes labor, matching every pre-Phase-64 caller.
  laborCost: number
  // Phase 64 — allocated at completion time from BusinessProfile's
  // overheadAllocationBasis/Rate; 0 for every order on a business that
  // never configures overhead allocation.
  overheadCost: number
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  startDate: string | null
  completedDate: string | null
  notes: string | null
  totalMaterialCost: number
  materialUsage: MaterialUsageRecord[]
  laborEntries: ProductionLaborEntryRecord[]
  createdAt: string
}

// Phase 64 — real itemized labor, superseding a single flat guessed number.
export interface ProductionLaborEntryRecord {
  id: string
  workerName: string
  hoursWorked: number
  ratePerHour: number
  amount: number
  createdAt: string
}

export interface MaterialUsageRecord {
  id: string
  rawMaterialId: string | null
  materialName: string | null
  materialUnit: string | null
  // Phase 58 §2 — multi-level BOM: set instead of the material* fields when
  // this usage row was generated from a component-Product BOM line.
  componentProductId: string | null
  componentProductName: string | null
  quantityPlanned: number
  quantityActual: number
  unitCost: number
  // Phase 58 §2 — which raw-material lot(s) were actually drawn on to cover
  // this usage row, empty for a component-product row or a raw material
  // with no batch records at all (same "batches are an optional additional
  // ledger" convention ProductBatch already established).
  batchConsumption: Array<{ batchId: string; batchNumber: string; quantityConsumed: number }>
}

const ORDER_INCLUDE = {
  product: { select: { productName: true } },
  materialUsage: {
    include: {
      rawMaterial: { select: { name: true, unit: true, unitCost: true } },
      componentProduct: { select: { productName: true, costPrice: true } },
      batchConsumption: { include: { rawMaterialBatch: { select: { batchNumber: true } } } }
    }
  },
  laborEntries: { orderBy: { createdAt: 'asc' } }
} as const

export async function listProductionOrders(payload?: {
  status?: string
  productId?: string
  limit?: number
}): Promise<{ success: boolean; data?: { orders: ProductionOrderRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.productId) where.productId = payload.productId

    const rows = await db.productionOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: payload?.limit ?? 200,
      include: ORDER_INCLUDE
    })
    return { success: true, data: { orders: rows.map(toRecord), total: rows.length } }
  } catch (err) {
    return { success: false, error: { code: 'PO-001', message: err instanceof Error ? err.message : 'Failed to list production orders.' } }
  }
}

export async function getProductionOrder(id: string): Promise<{ success: boolean; data?: ProductionOrderRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.productionOrder.findUnique({ where: { id }, include: ORDER_INCLUDE })
    if (!row) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'PO-003', message: err instanceof Error ? err.message : 'Failed to get production order.' } }
  }
}

export async function createProductionOrder(payload: {
  productId: string
  plannedQty: number
  notes?: string
}, userId?: string): Promise<{ success: boolean; data?: ProductionOrderRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const bom = await db.billOfMaterial.findUnique({
      where: { productId: payload.productId },
      include: {
        items: true,
        product: { select: { productName: true } }
      }
    })
    if (!bom) return { success: false, error: { code: 'PO-004', message: 'No Bill of Materials found for this product. Create a BOM first.' } }
    if (!bom.isActive) return { success: false, error: { code: 'PO-005', message: 'The BOM for this product is inactive.' } }

    const result = await db.$transaction(async (tx) => {
      // Was read OUTSIDE this transaction entirely (not even same-transaction
      // serialization applied — the widest possible window for the race, see
      // sequence.service.ts's header comment) via a plain
      // findFirst(orderBy desc)+increment. generateSequenceNumber's atomic
      // Setting-backed claim closes both the concurrency race and the
      // after-hard-delete collision.
      const orderNumber = await generateSequenceNumber(
        tx, 'production_order_number_sequence', 'PO', 5,
        async () => {
          const lastOrder = await tx.productionOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { orderNumber: true } })
          return lastOrder ? parseInt(lastOrder.orderNumber.replace('PO-', ''), 10) : 0
        }
      )
      const order = await tx.productionOrder.create({
        data: {
          orderNumber,
          productId: payload.productId,
          bomId: bom.id,
          plannedQty: payload.plannedQty,
          notes: payload.notes ?? null,
          createdById: userId ?? null
        }
      })

      // Create material usage rows with planned quantities — one per BOM
      // line, whether it's a raw material or a component-product
      // sub-assembly (Phase 58 §2 multi-level BOM).
      const materialUsageData = bom.items.map(item => {
        const effectiveQty = item.quantityNeeded * (1 + item.wastagePercent / 100)
        return {
          productionOrderId: order.id,
          rawMaterialId: item.rawMaterialId,
          componentProductId: item.componentProductId,
          quantityPlanned: effectiveQty * (payload.plannedQty / bom.outputQty),
          quantityActual: 0
        }
      })
      await tx.productionMaterialUsage.createMany({ data: materialUsageData })

      return tx.productionOrder.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
    })

    await logAction(userId, 'PRODUCTION_ORDER_CREATED', 'ProductionOrder', result!.id, undefined, { orderNumber: result!.orderNumber, productId: payload.productId, plannedQty: payload.plannedQty })
    return { success: true, data: toRecord(result!) }
  } catch (err) {
    return { success: false, error: { code: 'PO-006', message: err instanceof Error ? err.message : 'Failed to create production order.' } }
  }
}

// Phase 58 §2 — FIFO-draws a raw material usage row from its RawMaterialBatch
// lots (oldest receivedDate first), recording exactly which lot(s) covered
// it via ProductionMaterialBatchConsumption. A material with no batch
// records at all (never lot-tracked) is a no-op here — same "batches are an
// optional additional ledger" convention batch.service.ts's deductBatchStockFIFO
// already established for finished-good sales.
async function consumeRawMaterialBatchesFIFO(tx: TxClient, usageId: string, rawMaterialId: string, quantity: number): Promise<void> {
  let remaining = quantity
  const batches = await tx.rawMaterialBatch.findMany({
    where: { rawMaterialId, isActive: true, quantityRemaining: { gt: 0 } },
    orderBy: { receivedDate: 'asc' }
  })
  for (const batch of batches) {
    if (remaining <= 0) break
    const draw = Math.min(batch.quantityRemaining, remaining)
    await tx.rawMaterialBatch.update({ where: { id: batch.id }, data: { quantityRemaining: { decrement: draw } } })
    await tx.productionMaterialBatchConsumption.create({
      data: { productionMaterialUsageId: usageId, rawMaterialBatchId: batch.id, quantityConsumed: draw }
    })
    remaining -= draw
  }
  // Whatever isn't covered by tracked lots (untracked pre-existing stock, or
  // batches simply running short) is drawn from the material's aggregate
  // currentStock anyway — the caller already validated total availability
  // against currentStock, batches are traceability, not a second gate.
}

// Reverse of consumeRawMaterialBatchesFIFO — restores each consumed lot's
// quantityRemaining and removes the consumption records, called on cancel.
async function restoreRawMaterialBatchesForUsage(tx: TxClient, usageId: string): Promise<void> {
  const consumption = await tx.productionMaterialBatchConsumption.findMany({ where: { productionMaterialUsageId: usageId } })
  for (const c of consumption) {
    await tx.rawMaterialBatch.update({ where: { id: c.rawMaterialBatchId }, data: { quantityRemaining: { increment: c.quantityConsumed } } })
  }
  await tx.productionMaterialBatchConsumption.deleteMany({ where: { productionMaterialUsageId: usageId } })
}

export async function startProductionOrder(id: string, userId?: string): Promise<{ success: boolean; data?: ProductionOrderRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const order = await db.productionOrder.findUnique({
      where: { id },
      include: {
        materialUsage: {
          include: { rawMaterial: true, componentProduct: { include: { inventory: true } } }
        }
      }
    })
    if (!order) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    if (order.status !== 'DRAFT') return { success: false, error: { code: 'PO-007', message: `Cannot start: order is ${order.status}.` } }

    // Fast pre-check outside the transaction — a cheap way to reject an
    // obviously-short order without opening a transaction at all. This is
    // NOT the real guard (see below); it's just an early exit for the
    // common case.
    const shortfalls: string[] = []
    for (const usage of order.materialUsage) {
      if (usage.rawMaterial) {
        if (usage.rawMaterial.currentStock < usage.quantityPlanned) {
          shortfalls.push(`${usage.rawMaterial.name}: need ${usage.quantityPlanned} ${usage.rawMaterial.unit}, have ${usage.rawMaterial.currentStock}`)
        }
      } else if (usage.componentProduct) {
        const available = usage.componentProduct.inventory?.quantity ?? 0
        if (available < usage.quantityPlanned) {
          shortfalls.push(`${usage.componentProduct.productName} (sub-assembly): need ${usage.quantityPlanned}, have ${available}`)
        }
      }
    }
    if (shortfalls.length > 0) {
      return { success: false, error: { code: 'PO-008', message: `Insufficient stock:\n${shortfalls.join('\n')}` } }
    }

    // BUG FOUND 2026-07-22: the shortfall check above ran against a
    // pre-transaction read, then the decrement below ran unconditionally in
    // a separate transaction with no re-validation — two startProductionOrder
    // calls issued close together (a double-click, or two orders both
    // drawing the same scarce material) could both pass the stale check and
    // both decrement, driving currentStock negative with no error surfaced.
    // Fixed to match the pattern logistics-grn.service.ts's postGRN already
    // uses for the identical race: re-check fresh, INSIDE the transaction,
    // immediately before each decrement, and abort the whole transaction
    // (rolling back every decrement already applied this call) the moment
    // any material comes up short against its real current value.
    const result = await db.$transaction(async (tx) => {
      for (const usage of order.materialUsage) {
        if (usage.rawMaterial) {
          const fresh = await tx.rawMaterial.findUniqueOrThrow({ where: { id: usage.rawMaterialId! }, select: { currentStock: true, name: true, unit: true } })
          if (fresh.currentStock < usage.quantityPlanned) {
            throw Object.assign(new Error(`Insufficient stock: ${fresh.name} — need ${usage.quantityPlanned} ${fresh.unit}, have ${fresh.currentStock}.`), { _code: 'PO-008' })
          }
          const updated = await tx.rawMaterial.update({
            where: { id: usage.rawMaterialId! },
            data: { currentStock: { decrement: usage.quantityPlanned } },
            select: { currentStock: true }
          })
          await tx.rawMaterialMovement.create({
            data: {
              rawMaterialId: usage.rawMaterialId!,
              type: 'CONSUMED',
              quantity: usage.quantityPlanned,
              balanceAfter: updated.currentStock,
              reference: order.orderNumber,
              unitCost: usage.rawMaterial.unitCost,
              notes: `Consumed for production order ${order.orderNumber}`,
              createdById: userId ?? null
            }
          })
          await consumeRawMaterialBatchesFIFO(tx, usage.id, usage.rawMaterialId!, usage.quantityPlanned)
        } else if (usage.componentProduct) {
          const freshInv = await tx.inventory.findUnique({ where: { productId: usage.componentProductId! }, select: { quantity: true } })
          if ((freshInv?.quantity ?? 0) < usage.quantityPlanned) {
            throw Object.assign(new Error(`Insufficient stock: ${usage.componentProduct.productName} (sub-assembly) — need ${usage.quantityPlanned}, have ${freshInv?.quantity ?? 0}.`), { _code: 'PO-008' })
          }
          // Sub-assembly consumption — same weighted-average-preserving
          // decrement inventory.service.ts's reduceStockTx uses for a sale,
          // hand-rolled here so the InventoryMovement reads as production
          // consumption, not a SALE.
          await tx.inventory.update({
            where: { productId: usage.componentProductId! },
            data: { quantity: { decrement: usage.quantityPlanned } }
          })
          await tx.inventoryMovement.create({
            data: {
              productId: usage.componentProductId!,
              movementType: 'PRODUCTION_OUT',
              quantity: -usage.quantityPlanned,
              referenceType: 'PRODUCTION_ORDER',
              referenceId: order.orderNumber,
              remarks: `Consumed as a sub-assembly for production order ${order.orderNumber}`,
              createdById: userId ?? null
            }
          })
        }
        // Record actual as planned when starting
        await tx.productionMaterialUsage.update({
          where: { id: usage.id },
          data: { quantityActual: usage.quantityPlanned }
        })
      }

      return tx.productionOrder.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startDate: new Date() },
        include: ORDER_INCLUDE
      })
    })

    await logAction(userId, 'PRODUCTION_ORDER_STARTED', 'ProductionOrder', id)
    return { success: true, data: toRecord(result) }
  } catch (err) {
    if ((err as { _code?: string })?._code === 'PO-008') return { success: false, error: { code: 'PO-008', message: (err as Error).message } }
    return { success: false, error: { code: 'PO-009', message: err instanceof Error ? err.message : 'Failed to start production order.' } }
  }
}

export async function completeProductionOrder(payload: {
  id: string
  producedQty: number
  // Phase 58 §2 — units attempted but rejected/scrapped (material+labor
  // spent, zero inventory value added). Optional, defaults to 0 (unchanged
  // behavior for every existing caller that doesn't pass it).
  scrapQty?: number
  // Phase 58 §2 — a direct flat labor cost. Phase 64: only used as a
  // fallback for an order with zero itemized ProductionLaborEntry rows —
  // once any exist, their own real sum is server-derived and this is
  // ignored, the same "server independently re-derives and enforces"
  // discipline Phase 63 established for FOC line pricing.
  laborCost?: number
  notes?: string
}, userId?: string): Promise<{ success: boolean; data?: ProductionOrderRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const [order, laborEntries, businessProfile] = await Promise.all([
      db.productionOrder.findUnique({
        where: { id: payload.id },
        include: {
          product: { select: { productName: true } },
          materialUsage: { include: { rawMaterial: { select: { unitCost: true } }, componentProduct: { include: { inventory: true } } } }
        }
      }),
      db.productionLaborEntry.findMany({ where: { productionOrderId: payload.id } }),
      db.businessProfile.findFirst({ select: { overheadAllocationBasis: true, overheadAllocationRate: true } })
    ])
    if (!order) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    if (order.status !== 'IN_PROGRESS') return { success: false, error: { code: 'PO-010', message: `Cannot complete: order is ${order.status}.` } }
    if (payload.producedQty <= 0) return { success: false, error: { code: 'PO-011', message: 'Produced quantity must be greater than 0.' } }
    const scrapQty = Math.max(0, payload.scrapQty ?? 0)
    // Phase 64 — real itemized labor, once any entries exist, wins over a
    // direct flat payload.laborCost (which stays as the only path for an
    // order that never itemizes, e.g. every pre-Phase-64 caller).
    const totalLaborHours = laborEntries.reduce((sum, e) => sum + e.hoursWorked, 0)
    const laborCost = laborEntries.length > 0
      ? laborEntries.reduce((sum, e) => sum + e.amount, 0)
      : Math.max(0, payload.laborCost ?? 0)

    // Phase 64 — overhead allocation, disabled (0) unless the business has
    // configured a basis. PER_LABOR_HOUR allocates against itemized hours
    // only — a completion with no itemized labor has no hours to allocate
    // against, correctly yielding 0, not a guess.
    let overheadCost = 0
    if (businessProfile?.overheadAllocationBasis === 'PER_LABOR_HOUR') {
      overheadCost = totalLaborHours * (businessProfile.overheadAllocationRate ?? 0)
    } else if (businessProfile?.overheadAllocationBasis === 'PER_UNIT_PRODUCED') {
      overheadCost = payload.producedQty * (businessProfile.overheadAllocationRate ?? 0)
    }

    // Cost basis for the finished good comes from the raw materials AND
    // component products actually consumed (quantityActual, set to
    // quantityPlanned when the order was started) plus labor cost plus any
    // allocated overhead — all spread across producedQty only (not
    // producedQty+scrapQty): a scrapped unit still consumed real material,
    // labor, and overhead time, but adds zero inventory value, so its cost
    // is absorbed into the good units' unit cost, same "the batch's real
    // cost lands on what actually sold/shipped" reasoning this codebase
    // already applies to weighted-average inventory costing elsewhere.
    const totalMaterialCost = order.materialUsage.reduce((sum, u) => {
      const unitCost = u.rawMaterial?.unitCost ?? u.componentProduct?.inventory?.averageCost ?? 0
      return sum + u.quantityActual * unitCost
    }, 0)
    const totalCost = totalMaterialCost + laborCost + overheadCost
    const producedUnitCost = totalCost / payload.producedQty

    const result = await db.$transaction(async (tx) => {
      // Real bug found live (2026-07-28 product-vertical audit): the
      // `order.status !== 'IN_PROGRESS'` check above ran against a
      // pre-transaction snapshot, and the status write below was
      // unconditional — exactly the TOCTOU shape this same file's own
      // startProductionOrder already documents and fixes for the identical
      // race one function up. Two near-simultaneous completions of the same
      // order (a double-click, or two terminals) would both pass the stale
      // check and both run this transaction, double-crediting produced
      // quantity into finished-goods inventory for one physical production
      // run. Claim the status transition atomically first; the loser now
      // fails cleanly instead of double-counting stock.
      const claim = await tx.productionOrder.updateMany({
        where: { id: payload.id, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETED',
          producedQty: payload.producedQty,
          scrapQty,
          laborCost,
          overheadCost,
          completedDate: new Date(),
          ...(payload.notes ? { notes: payload.notes } : {})
        }
      })
      if (claim.count === 0) {
        throw new ServiceError('PO-010', 'This order was already completed or cancelled by another action.')
      }

      // Add produced quantity to product inventory, updating averageCost via
      // the same weighted-average formula every other stock-in path uses.
      const existingInventory = await tx.inventory.findUnique({ where: { productId: order.productId } })
      if (existingInventory) {
        const totalValue = (existingInventory.quantity * existingInventory.averageCost) + (payload.producedQty * producedUnitCost)
        const totalQty = existingInventory.quantity + payload.producedQty
        const newAvgCost = totalQty > 0 ? totalValue / totalQty : producedUnitCost
        await tx.inventory.update({
          where: { productId: order.productId },
          data: { quantity: { increment: payload.producedQty }, averageCost: newAvgCost }
        })
      } else {
        await tx.inventory.create({
          data: { productId: order.productId, quantity: payload.producedQty, averageCost: producedUnitCost }
        })
      }

      // Log inventory movement
      await tx.inventoryMovement.create({
        data: {
          productId: order.productId,
          movementType: 'PRODUCTION_IN',
          quantity: payload.producedQty,
          referenceType: 'PRODUCTION_ORDER',
          referenceId: order.orderNumber,
          remarks: scrapQty > 0
            ? `Produced from order ${order.orderNumber} (${scrapQty} scrapped)`
            : `Produced from order ${order.orderNumber}`,
          createdById: userId ?? null
        }
      })

      // Phase 64 gap fix (found while touching this exact block for job
      // costing, not a new item on its own): this path updates Inventory
      // directly rather than through addStockTx, so it previously never
      // appended a ProductCostHistory row (a finished good's own real
      // production cost was invisible to FIFO valuation) and never kept
      // LocationStock in sync with the aggregate (Item 2's own invariant).
      // Both closed here, additively, without touching the inventory
      // update logic above.
      await tx.productCostHistory.create({
        data: {
          productId: order.productId, unitCost: producedUnitCost, quantity: payload.producedQty,
          sourceType: 'PRODUCTION_ORDER', sourceId: order.id
        }
      })
      await applyLocationDeltaTx(tx, order.productId, payload.producedQty)

      // The claim above already applied every field change atomically —
      // just re-fetch the full record (with its includes) for the response.
      return tx.productionOrder.findUniqueOrThrow({ where: { id: payload.id }, include: ORDER_INCLUDE })
    })

    await logAction(userId, 'PRODUCTION_ORDER_COMPLETED', 'ProductionOrder', payload.id, undefined, { producedQty: payload.producedQty, scrapQty, laborCost })
    return { success: true, data: toRecord(result) }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'PO-012', message: err instanceof Error ? err.message : 'Failed to complete production order.' } }
  }
}

export async function cancelProductionOrder(payload: {
  id: string
  notes?: string
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const order = await db.productionOrder.findUnique({
      where: { id: payload.id },
      include: {
        materialUsage: {
          include: { rawMaterial: { select: { name: true, unit: true, unitCost: true, currentStock: true } }, componentProduct: { select: { productName: true } } }
        }
      }
    })
    if (!order) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return { success: false, error: { code: 'PO-013', message: `Cannot cancel: order is already ${order.status}.` } }
    }

    await db.$transaction(async (tx) => {
      // Real bug found live (2026-07-28 product-vertical audit): the
      // status check above ran against a pre-transaction snapshot, and the
      // status write below was unconditional — same TOCTOU shape as
      // completeProductionOrder above. Two near-simultaneous cancels of the
      // same IN_PROGRESS order would both pass the stale check and both run
      // the material-return loop below, double-crediting raw-material stock
      // and component-product inventory back for materials that were only
      // ever consumed once. Claim the transition atomically first, matched
      // against the EXACT status this call observed (not just "not
      // terminal") — if the order moved to any other state in between (e.g.
      // another action completed it), the claim fails and this call aborts
      // cleanly instead of using a now-stale `order.status` to decide
      // whether to restore materials.
      const claim = await tx.productionOrder.updateMany({
        where: { id: payload.id, status: order.status },
        data: { status: 'CANCELLED', ...(payload.notes ? { notes: payload.notes } : {}) }
      })
      if (claim.count === 0) {
        throw new ServiceError('PO-013', 'This order was already updated by another action. Please refresh and try again.')
      }

      // If IN_PROGRESS, return raw materials / component products to stock atomically
      if (order.status === 'IN_PROGRESS') {
        for (const usage of order.materialUsage) {
          if (usage.quantityActual <= 0) continue
          if (usage.rawMaterial) {
            const updated = await tx.rawMaterial.update({
              where: { id: usage.rawMaterialId! },
              data: { currentStock: { increment: usage.quantityActual } },
              select: { currentStock: true }
            })
            await tx.rawMaterialMovement.create({
              data: {
                rawMaterialId: usage.rawMaterialId!,
                type: 'RETURN',
                quantity: usage.quantityActual,
                balanceAfter: updated.currentStock,
                reference: order.orderNumber,
                unitCost: usage.rawMaterial.unitCost,
                notes: `Returned from cancelled order ${order.orderNumber}`,
                createdById: userId ?? null
              }
            })
            await restoreRawMaterialBatchesForUsage(tx, usage.id)
          } else if (usage.componentProduct) {
            await tx.inventory.update({
              where: { productId: usage.componentProductId! },
              data: { quantity: { increment: usage.quantityActual } }
            })
            await tx.inventoryMovement.create({
              data: {
                productId: usage.componentProductId!,
                movementType: 'PRODUCTION_RETURN',
                quantity: usage.quantityActual,
                referenceType: 'PRODUCTION_ORDER',
                referenceId: order.orderNumber,
                remarks: `Returned from cancelled order ${order.orderNumber}`,
                createdById: userId ?? null
              }
            })
          }
        }
      }
      // The claim above already applied the status/notes change atomically.
    })

    await logAction(userId, 'PRODUCTION_ORDER_CANCELLED', 'ProductionOrder', payload.id)
    return { success: true }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'PO-014', message: err instanceof Error ? err.message : 'Failed to cancel production order.' } }
  }
}

// Phase 64 — job costing: real itemized labor per production run,
// superseding a single flat guessed number. Addable while the order is
// DRAFT or IN_PROGRESS (mirrors when material usage is still adjustable);
// blocked once COMPLETED/CANCELLED since completeProductionOrder has
// already read and locked in the labor sum for that order's cost basis.
export async function addProductionLaborEntry(payload: {
  productionOrderId: string
  workerName: string
  hoursWorked: number
  ratePerHour: number
}, userId?: string): Promise<{ success: boolean; data?: ProductionLaborEntryRecord; error?: { code: string; message: string } }> {
  try {
    if (payload.hoursWorked <= 0) return { success: false, error: { code: 'PO-015', message: 'Hours worked must be greater than 0.' } }
    if (payload.ratePerHour < 0) return { success: false, error: { code: 'PO-015', message: 'Rate per hour cannot be negative.' } }
    if (!payload.workerName.trim()) return { success: false, error: { code: 'PO-015', message: 'Worker name is required.' } }

    const db = getPrisma()
    const order = await db.productionOrder.findUnique({ where: { id: payload.productionOrderId }, select: { status: true } })
    if (!order) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    if (order.status !== 'DRAFT' && order.status !== 'IN_PROGRESS') {
      return { success: false, error: { code: 'PO-016', message: `Cannot add a labor entry: order is ${order.status}.` } }
    }

    const amount = payload.hoursWorked * payload.ratePerHour
    const created = await db.productionLaborEntry.create({
      data: {
        productionOrderId: payload.productionOrderId,
        workerName: payload.workerName.trim(),
        hoursWorked: payload.hoursWorked,
        ratePerHour: payload.ratePerHour,
        amount
      }
    })
    await logAction(userId, 'PRODUCTION_LABOR_ENTRY_ADDED', 'ProductionOrder', payload.productionOrderId, undefined, created)
    return {
      success: true,
      data: { id: created.id, workerName: created.workerName, hoursWorked: created.hoursWorked, ratePerHour: created.ratePerHour, amount: created.amount, createdAt: created.createdAt.toISOString() }
    }
  } catch (err) {
    return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to add labor entry.' } }
  }
}

export async function removeProductionLaborEntry(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const entry = await db.productionLaborEntry.findUnique({ where: { id }, include: { productionOrder: { select: { status: true } } } })
    if (!entry) return { success: false, error: { code: 'PO-017', message: 'Labor entry not found.' } }
    if (entry.productionOrder.status !== 'DRAFT' && entry.productionOrder.status !== 'IN_PROGRESS') {
      return { success: false, error: { code: 'PO-016', message: `Cannot remove a labor entry: order is ${entry.productionOrder.status}.` } }
    }
    await db.productionLaborEntry.delete({ where: { id } })
    await logAction(userId, 'PRODUCTION_LABOR_ENTRY_REMOVED', 'ProductionOrder', entry.productionOrderId, entry)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to remove labor entry.' } }
  }
}

type OrderRow = {
  id: string
  orderNumber: string
  productId: string
  bomId: string
  plannedQty: number
  producedQty: number
  scrapQty: number
  laborCost: number
  overheadCost: number
  status: string
  startDate: Date | null
  completedDate: Date | null
  notes: string | null
  createdAt: Date
  product: { productName: string }
  materialUsage: Array<{
    id: string
    rawMaterialId: string | null
    componentProductId: string | null
    quantityPlanned: number
    quantityActual: number
    rawMaterial: { name: string; unit: string; unitCost: number } | null
    componentProduct: { productName: string; costPrice: number } | null
    batchConsumption: Array<{ rawMaterialBatchId: string; quantityConsumed: number; rawMaterialBatch: { batchNumber: string } }>
  }>
  laborEntries: Array<{ id: string; workerName: string; hoursWorked: number; ratePerHour: number; amount: number; createdAt: Date }>
}

function toRecord(o: OrderRow): ProductionOrderRecord {
  const materialUsage: MaterialUsageRecord[] = o.materialUsage.map(u => ({
    id: u.id,
    rawMaterialId: u.rawMaterialId,
    materialName: u.rawMaterial?.name ?? null,
    materialUnit: u.rawMaterial?.unit ?? null,
    componentProductId: u.componentProductId,
    componentProductName: u.componentProduct?.productName ?? null,
    quantityPlanned: u.quantityPlanned,
    quantityActual: u.quantityActual,
    unitCost: u.rawMaterial?.unitCost ?? u.componentProduct?.costPrice ?? 0,
    batchConsumption: u.batchConsumption.map(c => ({ batchId: c.rawMaterialBatchId, batchNumber: c.rawMaterialBatch.batchNumber, quantityConsumed: c.quantityConsumed }))
  }))
  const totalMaterialCost = materialUsage.reduce((sum, u) => sum + u.quantityActual * u.unitCost, 0)
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    productId: o.productId,
    productName: o.product.productName,
    bomId: o.bomId,
    plannedQty: o.plannedQty,
    producedQty: o.producedQty,
    scrapQty: o.scrapQty,
    laborCost: o.laborCost,
    overheadCost: o.overheadCost,
    status: o.status as ProductionOrderRecord['status'],
    startDate: o.startDate?.toISOString() ?? null,
    completedDate: o.completedDate?.toISOString() ?? null,
    notes: o.notes,
    totalMaterialCost,
    materialUsage,
    laborEntries: o.laborEntries.map(e => ({
      id: e.id, workerName: e.workerName, hoursWorked: e.hoursWorked,
      ratePerHour: e.ratePerHour, amount: e.amount, createdAt: e.createdAt.toISOString()
    })),
    createdAt: o.createdAt.toISOString()
  }
}
