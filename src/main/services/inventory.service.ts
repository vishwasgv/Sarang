import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import type { AddStockPayload, AdjustStockPayload } from '../validation/inventory.validation'

async function getAllowNegative(): Promise<boolean> {
  const db = getPrisma()
  try {
    const setting = await db.setting.findUnique({ where: { settingKey: 'allow_negative_inventory' } })
    return setting?.settingValue === 'true'
  } catch {
    return false
  }
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
  async addStockTx(
    tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
    productId: string,
    quantity: number,
    unitCost: number,
    reason: string,
    referenceType: string,
    referenceId: string,
    userId?: string
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
        createdById: userId ?? null
      }
    })
  },

  // Called from within a Prisma transaction by billing.service when creating an invoice
  async reduceStockTx(
    tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
    productId: string,
    quantity: number,
    reason: string,
    referenceType: string,
    referenceId: string,
    userId?: string
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
        createdById: userId ?? null
      }
    })
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
        return { updated: inv, previous: inventory }
      })

      await logAction({
        userId, action: 'INVENTORY_ADJUST_STOCK', entityType: 'Inventory', entityId: payload.productId,
        oldValue: { quantity: result.previous.quantity, averageCost: result.previous.averageCost },
        newValue: { quantity: payload.quantity, averageCost: result.updated.averageCost, reason: payload.reason }
      })
      return { success: true, data: result.updated }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
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

  // transferStock — requires a multi-location warehouse model which is not in the V1 schema.
  // This stub is present to satisfy the service interface; multi-location support is a future phase.
  async transferStock(_params: { productId: string; quantity: number; fromLocationId?: string; toLocationId?: string }) {
    return { success: false, error: { code: 'INV-010', message: 'Stock transfer requires multi-location inventory configuration, which is not enabled in this version.' } }
  }
}
