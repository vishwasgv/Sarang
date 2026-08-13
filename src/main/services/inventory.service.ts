import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import { getDefaultLocationId } from './location.service'
import type { AddStockPayload, AdjustStockPayload } from '../validation/inventory.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Exported so variant.service.ts's decrementVariantStockTx can respect the
// exact same setting for per-variant stock — see that function's own
// comment for the real bug this closes.
export async function getAllowNegative(): Promise<boolean> {
  const db = getPrisma()
  try {
    const setting = await db.setting.findUnique({ where: { settingKey: 'allow_negative_inventory' } })
    return setting?.settingValue === 'true'
  } catch {
    return false
  }
}

// Phase 64 — keeps LocationStock (the additive per-location breakdown, see
// PHASE_61_ROADMAP_MASTER_PROMPT.md Section 6.1 item 2) in sync with every
// Inventory.quantity change, so its sum per product always equals the
// aggregate — never a second, driftable source of truth. Defaults to the
// guaranteed default Location when the caller doesn't name one, which is
// every pre-Phase-64 call site and every call site on a business that has
// never created a second Location. Exported so any other service that
// mutates Inventory.quantity directly (not through addStockTx/reduceStockTx)
// — e.g. production-order.service's completeProductionOrder — can keep the
// same invariant without duplicating this logic.
export async function applyLocationDeltaTx(tx: TxClient, productId: string, delta: number, locationId?: string) {
  const resolvedLocationId = locationId ?? await getDefaultLocationId(tx)
  await tx.locationStock.upsert({
    where: { productId_locationId: { productId, locationId: resolvedLocationId } },
    create: { productId, locationId: resolvedLocationId, quantity: delta },
    update: { quantity: { increment: delta } }
  })
}

export const inventoryService = {
  async getInventory(productId: string) {
    const db = getPrisma()
    const inventory = await db.inventory.findUnique({
      where: { productId },
      include: {
        product: { select: { id: true, productName: true, sku: true, unit: true, isActive: true, category: { select: { id: true, name: true } } } }
      }
    })
    if (!inventory) return { success: false, error: { code: 'INV-001', message: 'Inventory record not found for this product.' } }
    return { success: true, data: inventory }
  },

  async listInventory(filters?: { lowStockOnly?: boolean; page?: number; limit?: number; search?: string }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit
    const search = filters?.search?.toLowerCase()

    // Push search + isActive filter to DB; avoid full-table scan
    const productWhere: Record<string, unknown> = { isActive: true }
    if (search) {
      productWhere.OR = [
        { productName: { contains: search } },
        { sku: { contains: search } }
      ]
    }

    const all = await db.inventory.findMany({
      where: { product: productWhere },
      include: {
        product: {
          select: {
            id: true, productName: true, sku: true, barcode: true, unit: true, isActive: true,
            sellByPack: true, packUnit: true, unitsPerPack: true,
            category: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { product: { productName: 'asc' } }
    })

    // lowStockOnly: Prisma cannot compare two columns in WHERE, so filter in memory on the already-reduced set
    const filtered = filters?.lowStockOnly
      ? all.filter(inv => inv.reorderLevel > 0 && inv.quantity <= inv.reorderLevel)
      : all

    const total = filtered.length
    const items = filtered.slice(skip, skip + limit)

    return { success: true, data: { inventory: items, total } }
  },

  async addStock(payload: AddStockPayload, userId?: string) {
    const db = getPrisma()
    try {
      const updated = await db.$transaction(async (tx) => {
        // Read-modify-write inside the transaction so concurrent stock-affecting
        // operations on the same product can't race on a stale averageCost read.
        const inventory = await tx.inventory.findUnique({ where: { productId: payload.productId } })
        if (!inventory) throw new ServiceError('INV-001', 'Inventory record not found for this product.')

        let newAvgCost = inventory.averageCost
        if (payload.unitCost !== undefined && payload.unitCost >= 0 && payload.quantity > 0) {
          const totalValue = (inventory.quantity * inventory.averageCost) + (payload.quantity * payload.unitCost)
          const totalQty = inventory.quantity + payload.quantity
          newAvgCost = totalQty > 0 ? totalValue / totalQty : payload.unitCost
        }

        const inv = await tx.inventory.update({
          where: { productId: payload.productId },
          data: { quantity: { increment: payload.quantity }, averageCost: newAvgCost }
        })
        await tx.inventoryMovement.create({
          data: {
            productId: payload.productId,
            movementType: 'ADDITION',
            quantity: payload.quantity,
            referenceType: payload.referenceType ?? null,
            referenceId: payload.referenceId ?? null,
            remarks: payload.reason,
            createdById: userId ?? null
          }
        })
        await applyLocationDeltaTx(tx, payload.productId, payload.quantity)
        return inv
      })

      await logAction({ userId, action: 'INVENTORY_ADD_STOCK', entityType: 'Inventory', entityId: payload.productId, newValue: { quantity: payload.quantity, reason: payload.reason } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  // Called from within a Prisma transaction by purchase-order.service when receiving a PO
  // Phase 64 — optional 9th param: when the caller passes costHistory, a
  // ProductCostHistory row is appended here, in the one place both
  // Inventory.averageCost and the cost-history ledger are updated together,
  // instead of each caller separately duplicating the same write (or, in
  // logistics-grn.service's case, forgetting it entirely — the real
  // pre-existing gap this closes). Deliberately NOT written for every
  // addStockTx call: logistics-challan.service's customer-return path calls
  // this with the product's own current averageCost passed back in — a
  // real physical return, not a new purchase-price data point — so it
  // correctly omits costHistory rather than polluting the FIFO/cost ledger
  // with a non-purchase event.
  async addStockTx(
    tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
    productId: string,
    quantity: number,
    unitCost: number,
    reason: string,
    referenceType: string,
    referenceId: string,
    userId?: string,
    costHistory?: { sourceType: string; sourceId: string },
    // Phase 64 — optional 10th param: which Location this stock-in happened
    // at. Omitted by every pre-Phase-64 caller, which is correct — it falls
    // back to the guaranteed default Location, so LocationStock stays in
    // sync with Inventory.quantity even for callers that don't know
    // multi-location exists.
    locationId?: string
  ) {
    const inventory = await tx.inventory.findUnique({ where: { productId } })
    if (!inventory) throw new ServiceError('INV-001', `Inventory not found for product ${productId}.`)

    const totalValue = (inventory.quantity * inventory.averageCost) + (quantity * unitCost)
    const totalQty = inventory.quantity + quantity
    const newAvgCost = totalQty > 0 ? totalValue / totalQty : unitCost

    await tx.inventory.update({
      where: { productId },
      data: { quantity: { increment: quantity }, averageCost: newAvgCost }
    })

    await tx.inventoryMovement.create({
      data: {
        productId,
        movementType: 'PURCHASE',
        quantity,
        referenceType,
        referenceId,
        remarks: reason,
        createdById: userId ?? null,
        locationId: locationId ?? null
      }
    })

    await applyLocationDeltaTx(tx, productId, quantity, locationId)

    if (costHistory) {
      await tx.productCostHistory.create({
        data: {
          productId,
          unitCost,
          quantity,
          sourceType: costHistory.sourceType,
          sourceId: costHistory.sourceId
        }
      })
    }
  },

  // Called from within a Prisma transaction by billing.service when creating an invoice
  async reduceStockTx(
    tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
    productId: string,
    quantity: number,
    reason: string,
    referenceType: string,
    referenceId: string,
    userId?: string,
    // Phase 64 — same optional-locationId convention as addStockTx above.
    locationId?: string
  ) {
    const inventory = await tx.inventory.findUnique({ where: { productId } })
    if (!inventory) throw new ServiceError('INV-001', `Inventory not found for product ${productId}.`)

    const allowNegative = await getAllowNegative()
    if (!allowNegative && inventory.quantity < quantity) {
      throw new ServiceError('INV-002', `Insufficient stock for product ${productId}. Available: ${inventory.quantity}, required: ${quantity}.`)
    }

    await tx.inventory.update({
      where: { productId },
      data: { quantity: { decrement: quantity } }
    })

    await tx.inventoryMovement.create({
      data: {
        productId,
        movementType: 'SALE',
        quantity: -quantity,
        referenceType,
        referenceId,
        remarks: reason,
        createdById: userId ?? null,
        locationId: locationId ?? null
      }
    })

    await applyLocationDeltaTx(tx, productId, -quantity, locationId)
  },

  async adjustStock(payload: AdjustStockPayload, userId?: string) {
    const db = getPrisma()

    if (payload.quantity < 0) {
      const allowNegative = await getAllowNegative()
      if (!allowNegative) {
        return { success: false, error: { code: 'INV-005', message: 'Cannot set negative stock — allow negative inventory is disabled.' } }
      }
    }

    try {
      const result = await db.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({ where: { productId: payload.productId } })
        if (!inventory) throw new ServiceError('INV-001', 'Inventory record not found for this product.')

        const difference = payload.quantity - inventory.quantity

        // RULE I001 only requires a movement record for an actual change — a no-op
        // adjustment (re-submitting the current quantity) must not pollute the
        // otherwise-immutable movement log. Rejected outright (not silently
        // accepted) per the "reject action, display friendly message" rule —
        // enforced here too, not just in the UI's disabled Save button, per
        // "never rely on UI validation alone".
        if (difference === 0) throw new ServiceError('INV-006', 'No change to apply — this is already the current quantity.')

        // Average cost only moves when stock is being added — removing/correcting
        // downward doesn't change the cost basis of what remains (RULE I007).
        let newAvgCost = inventory.averageCost
        if (difference > 0 && payload.unitCost !== undefined && payload.unitCost >= 0) {
          const totalValue = (inventory.quantity * inventory.averageCost) + (difference * payload.unitCost)
          const totalQty = inventory.quantity + difference
          newAvgCost = totalQty > 0 ? totalValue / totalQty : payload.unitCost
        }

        const inv = await tx.inventory.update({
          where: { productId: payload.productId },
          data: { quantity: payload.quantity, averageCost: newAvgCost }
        })
        // A damage/breakage write-off is always a decrease — 'DAMAGE' only
        // ever replaces the generic 'ADJUSTMENT' bucket for a downward
        // correction, never an increase (you can't "damage" stock into
        // existence). Omitting reasonCategory entirely preserves the exact
        // pre-existing movementType:'ADJUSTMENT' behavior for every caller
        // that predates this field.
        const movementType = payload.reasonCategory === 'DAMAGE' && difference < 0 ? 'DAMAGE' : 'ADJUSTMENT'
        await tx.inventoryMovement.create({
          data: {
            productId: payload.productId,
            movementType,
            quantity: difference,
            referenceType: 'ADJUSTMENT',
            remarks: payload.reason,
            createdById: userId ?? null
          }
        })
        // adjustStock has no location concept of its own (a blunt
        // set-absolute-quantity tool) — the difference always applies to
        // the default Location, keeping LocationStock's sum in sync with
        // the new aggregate Inventory.quantity.
        await applyLocationDeltaTx(tx, payload.productId, difference)
        return { updated: inv, previous: inventory }
      // REAL BUG found in this session's pre-release stress-testing audit:
      // this transaction had no extended timeout (Prisma's default 5s/2s),
      // unlike billing.service.ts's createInvoice (15s/10s) — under genuine
      // heavy concurrent write contention on the same product this timed
      // out far more often than createInvoice did, on top of always falling
      // through to a generic, unhelpful SYS-001 instead of the same honest
      // "system is busy" message createInvoice gives for the identical
      // no-data-corruption contention scenario. Matched to createInvoice's
      // values below for consistency.
      }, { timeout: 15000, maxWait: 10000 })

      await logAction({
        userId, action: 'INVENTORY_ADJUST_STOCK', entityType: 'Inventory', entityId: payload.productId,
        oldValue: { quantity: result.previous.quantity, averageCost: result.previous.averageCost },
        newValue: { quantity: payload.quantity, averageCost: result.updated.averageCost, reason: payload.reason }
      })
      return { success: true, data: result.updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const isBusyContention = err instanceof Error && (
        /transaction already closed|expired transaction/i.test(err.message) ||
        (err as { code?: string }).code === 'P1008'
      )
      if (isBusyContention) {
        return { success: false, error: { code: 'INV-007', message: 'The system is busy processing another stock change right now. Please try again in a moment.' } }
      }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  async getMovements(filters?: { productId?: string; movementType?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.productId) where.productId = filters.productId
    if (filters?.movementType) where.movementType = filters.movementType

    const [movements, total] = await db.$transaction([
      db.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { id: true, productName: true, sku: true, unit: true } },
          createdBy: { select: { id: true, fullName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.inventoryMovement.count({ where })
    ])

    return { success: true, data: { movements, total } }
  },

  async getInventoryValue() {
    const db = getPrisma()
    const inventories = await db.inventory.findMany({
      include: { product: { select: { isActive: true } } }
    })
    const active = inventories.filter(inv => inv.product.isActive)
    const totalValue = active.reduce((sum, inv) => sum + (inv.quantity * inv.averageCost), 0)
    // Matches listInventory's lowStockOnly filter: only items with a configured
    // reorderLevel count as "low stock" — an unconfigured (reorderLevel: 0) item
    // at 0 quantity isn't a meaningful alert, just an unset default.
    const lowStockCount = active.filter(inv => inv.reorderLevel > 0 && inv.quantity <= inv.reorderLevel).length
    const outOfStockCount = active.filter(inv => inv.quantity <= 0).length
    return { success: true, data: { totalValue, itemCount: active.length, lowStockCount, outOfStockCount } }
  },

  // Standalone reduceStock — wraps reduceStockTx in its own transaction.
  // Called for manual reductions; billing uses reduceStockTx directly inside the invoice transaction.
  async reduceStock(
    productId: string,
    quantity: number,
    reason: string,
    referenceType: string,
    referenceId: string,
    userId?: string
  ) {
    const db = getPrisma()
    try {
      await db.$transaction(async (tx) => {
        await this.reduceStockTx(tx, productId, quantity, reason, referenceType, referenceId, userId)
      })
      await logAction({ userId, action: 'INVENTORY_REDUCE_STOCK', entityType: 'Inventory', entityId: productId, newValue: { quantity: -quantity, reason } })
      const updated = await db.inventory.findUnique({ where: { productId } })
      return { success: true, data: updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to reduce stock.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  // Phase 64 — replaces the former INV-010 stub. A transfer moves quantity
  // between two LocationStock rows only; it never touches the product's
  // total on-hand Inventory.quantity (a transfer can't change how much of a
  // product a business owns in total, only where it physically sits) — see
  // PHASE_61_ROADMAP_MASTER_PROMPT.md Section 6.1 item 2's own documented
  // reasoning for why this is a genuinely lower-risk operation than it
  // first appears, not a gap.
  async transferStock(
    params: { productId: string; quantity: number; fromLocationId: string; toLocationId: string; reason?: string },
    userId?: string
  ) {
    if (params.quantity <= 0) {
      return { success: false, error: { code: 'INV-011', message: 'Transfer quantity must be greater than zero.' } }
    }
    if (params.fromLocationId === params.toLocationId) {
      return { success: false, error: { code: 'INV-012', message: 'Source and destination location must be different.' } }
    }

    const db = getPrisma()
    try {
      await db.$transaction(async (tx) => {
        const [product, fromLocation, toLocation] = await Promise.all([
          tx.product.findUnique({ where: { id: params.productId } }),
          tx.location.findUnique({ where: { id: params.fromLocationId } }),
          tx.location.findUnique({ where: { id: params.toLocationId } })
        ])
        if (!product) throw new ServiceError('INV-001', 'Product not found.')
        if (!fromLocation || !toLocation) throw new ServiceError('LOC-002', 'Location not found.')

        const fromStock = await tx.locationStock.findUnique({
          where: { productId_locationId: { productId: params.productId, locationId: params.fromLocationId } }
        })
        const available = fromStock?.quantity ?? 0
        const allowNegative = await getAllowNegative()
        if (!allowNegative && available < params.quantity) {
          throw new ServiceError('INV-002', `Insufficient stock at ${fromLocation.name}. Available: ${available}, required: ${params.quantity}.`)
        }

        await applyLocationDeltaTx(tx, params.productId, -params.quantity, params.fromLocationId)
        await applyLocationDeltaTx(tx, params.productId, params.quantity, params.toLocationId)

        await tx.inventoryMovement.create({
          data: {
            productId: params.productId, movementType: 'TRANSFER_OUT', quantity: -params.quantity,
            referenceType: 'LOCATION_TRANSFER', referenceId: params.toLocationId,
            remarks: params.reason ?? `Transferred to ${toLocation.name}`,
            createdById: userId ?? null, locationId: params.fromLocationId
          }
        })
        await tx.inventoryMovement.create({
          data: {
            productId: params.productId, movementType: 'TRANSFER_IN', quantity: params.quantity,
            referenceType: 'LOCATION_TRANSFER', referenceId: params.fromLocationId,
            remarks: params.reason ?? `Transferred from ${fromLocation.name}`,
            createdById: userId ?? null, locationId: params.toLocationId
          }
        })
      })

      await logAction({ userId, action: 'INVENTORY_TRANSFER_STOCK', entityType: 'Product', entityId: params.productId, newValue: params })
      return { success: true }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  }
}
