import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'

export interface ProductionOrderRecord {
  id: string
  orderNumber: string
  productId: string
  productName: string
  bomId: string
  plannedQty: number
  producedQty: number
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  startDate: string | null
  completedDate: string | null
  notes: string | null
  totalMaterialCost: number
  materialUsage: MaterialUsageRecord[]
  createdAt: string
}

export interface MaterialUsageRecord {
  id: string
  rawMaterialId: string
  materialName: string
  materialUnit: string
  quantityPlanned: number
  quantityActual: number
  unitCost: number
}

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
      include: {
        product: { select: { productName: true } },
        materialUsage: {
          include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } }
        }
      }
    })
    return { success: true, data: { orders: rows.map(toRecord), total: rows.length } }
  } catch (err) {
    return { success: false, error: { code: 'PO-001', message: err instanceof Error ? err.message : 'Failed to list production orders.' } }
  }
}

export async function getProductionOrder(id: string): Promise<{ success: boolean; data?: ProductionOrderRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.productionOrder.findUnique({
      where: { id },
      include: {
        product: { select: { productName: true } },
        materialUsage: {
          include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } }
        }
      }
    })
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
        items: {
          include: { rawMaterial: { select: { name: true, unit: true, unitCost: true, currentStock: true } } }
        },
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

      // Create material usage rows with planned quantities
      const materialUsageData = bom.items.map(item => {
        const effectiveQty = item.quantityNeeded * (1 + item.wastagePercent / 100)
        return {
          productionOrderId: order.id,
          rawMaterialId: item.rawMaterialId,
          quantityPlanned: effectiveQty * (payload.plannedQty / bom.outputQty),
          quantityActual: 0
        }
      })
      await tx.productionMaterialUsage.createMany({ data: materialUsageData })

      return tx.productionOrder.findUnique({
        where: { id: order.id },
        include: {
          product: { select: { productName: true } },
          materialUsage: {
            include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } }
          }
        }
      })
    })

    await logAction(userId, 'PRODUCTION_ORDER_CREATED', 'ProductionOrder', result!.id, undefined, { orderNumber: result!.orderNumber, productId: payload.productId, plannedQty: payload.plannedQty })
    return { success: true, data: toRecord(result!) }
  } catch (err) {
    return { success: false, error: { code: 'PO-006', message: err instanceof Error ? err.message : 'Failed to create production order.' } }
  }
}

export async function startProductionOrder(id: string, userId?: string): Promise<{ success: boolean; data?: ProductionOrderRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const order = await db.productionOrder.findUnique({
      where: { id },
      include: {
        materialUsage: {
          include: { rawMaterial: true }
        }
      }
    })
    if (!order) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    if (order.status !== 'DRAFT') return { success: false, error: { code: 'PO-007', message: `Cannot start: order is ${order.status}.` } }

    // Check raw material availability
    const shortfalls: string[] = []
    for (const usage of order.materialUsage) {
      if (usage.rawMaterial.currentStock < usage.quantityPlanned) {
        shortfalls.push(`${usage.rawMaterial.name}: need ${usage.quantityPlanned} ${usage.rawMaterial.unit}, have ${usage.rawMaterial.currentStock}`)
      }
    }
    if (shortfalls.length > 0) {
      return { success: false, error: { code: 'PO-008', message: `Insufficient raw materials:\n${shortfalls.join('\n')}` } }
    }

    const result = await db.$transaction(async (tx) => {
      // Deduct raw materials atomically and create movement records
      for (const usage of order.materialUsage) {
        // Use decrement — atomic, no TOCTOU race, returns updated row for balanceAfter
        const updated = await tx.rawMaterial.update({
          where: { id: usage.rawMaterialId },
          data: { currentStock: { decrement: usage.quantityPlanned } },
          select: { currentStock: true }
        })
        await tx.rawMaterialMovement.create({
          data: {
            rawMaterialId: usage.rawMaterialId,
            type: 'CONSUMED',
            quantity: usage.quantityPlanned,
            balanceAfter: updated.currentStock,
            reference: order.orderNumber,
            unitCost: usage.rawMaterial.unitCost,
            notes: `Consumed for production order ${order.orderNumber}`,
            createdById: userId ?? null
          }
        })
        // Record actual as planned when starting
        await tx.productionMaterialUsage.update({
          where: { id: usage.id },
          data: { quantityActual: usage.quantityPlanned }
        })
      }

      return tx.productionOrder.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startDate: new Date() },
        include: {
          product: { select: { productName: true } },
          materialUsage: {
            include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } }
          }
        }
      })
    })

    await logAction(userId, 'PRODUCTION_ORDER_STARTED', 'ProductionOrder', id)
    return { success: true, data: toRecord(result) }
  } catch (err) {
    return { success: false, error: { code: 'PO-009', message: err instanceof Error ? err.message : 'Failed to start production order.' } }
  }
}

export async function completeProductionOrder(payload: {
  id: string
  producedQty: number
  notes?: string
}, userId?: string): Promise<{ success: boolean; data?: ProductionOrderRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const order = await db.productionOrder.findUnique({
      where: { id: payload.id },
      include: {
        product: { select: { productName: true } },
        materialUsage: { include: { rawMaterial: { select: { unitCost: true } } } }
      }
    })
    if (!order) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    if (order.status !== 'IN_PROGRESS') return { success: false, error: { code: 'PO-010', message: `Cannot complete: order is ${order.status}.` } }
    if (payload.producedQty <= 0) return { success: false, error: { code: 'PO-011', message: 'Produced quantity must be greater than 0.' } }

    // Cost basis for the finished good comes from the raw materials actually
    // consumed (quantityActual, set to quantityPlanned when the order was
    // started), spread across the produced quantity.
    const totalMaterialCost = order.materialUsage.reduce((sum, u) => sum + u.quantityActual * u.rawMaterial.unitCost, 0)
    const producedUnitCost = totalMaterialCost / payload.producedQty

    const result = await db.$transaction(async (tx) => {
      // Add produced quantity to product inventory, updating averageCost via
      // the same weighted-average formula every other stock-in path uses
      // (inventoryService.addStockTx) — previously this only incremented
      // quantity and left averageCost untouched, so manufactured goods
      // carried a stale/zero cost basis that silently corrupted inventory
      // valuation reports. Duplicated here rather than calling addStockTx
      // directly because addStockTx assumes the Inventory row already
      // exists (throws if not); a finished good's very first production run
      // can be its first-ever stock movement, so the create path still needs
      // handling here.
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
          remarks: `Produced from order ${order.orderNumber}`,
          createdById: userId ?? null
        }
      })

      return tx.productionOrder.update({
        where: { id: payload.id },
        data: {
          status: 'COMPLETED',
          producedQty: payload.producedQty,
          completedDate: new Date(),
          ...(payload.notes ? { notes: payload.notes } : {})
        },
        include: {
          product: { select: { productName: true } },
          materialUsage: {
            include: { rawMaterial: { select: { name: true, unit: true, unitCost: true } } }
          }
        }
      })
    })

    await logAction(userId, 'PRODUCTION_ORDER_COMPLETED', 'ProductionOrder', payload.id, undefined, { producedQty: payload.producedQty })
    return { success: true, data: toRecord(result) }
  } catch (err) {
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
          include: { rawMaterial: { select: { name: true, unit: true, unitCost: true, currentStock: true } } }
        }
      }
    })
    if (!order) return { success: false, error: { code: 'PO-002', message: 'Production order not found.' } }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return { success: false, error: { code: 'PO-013', message: `Cannot cancel: order is already ${order.status}.` } }
    }

    await db.$transaction(async (tx) => {
      // If IN_PROGRESS, return raw materials to stock atomically
      if (order.status === 'IN_PROGRESS') {
        for (const usage of order.materialUsage) {
          if (usage.quantityActual <= 0) continue
          const updated = await tx.rawMaterial.update({
            where: { id: usage.rawMaterialId },
            data: { currentStock: { increment: usage.quantityActual } },
            select: { currentStock: true }
          })
          await tx.rawMaterialMovement.create({
            data: {
              rawMaterialId: usage.rawMaterialId,
              type: 'RETURN',
              quantity: usage.quantityActual,
              balanceAfter: updated.currentStock,
              reference: order.orderNumber,
              unitCost: usage.rawMaterial.unitCost,
              notes: `Returned from cancelled order ${order.orderNumber}`,
              createdById: userId ?? null
            }
          })
        }
      }

      await tx.productionOrder.update({
        where: { id: payload.id },
        data: { status: 'CANCELLED', ...(payload.notes ? { notes: payload.notes } : {}) }
      })
    })

    await logAction(userId, 'PRODUCTION_ORDER_CANCELLED', 'ProductionOrder', payload.id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'PO-014', message: err instanceof Error ? err.message : 'Failed to cancel production order.' } }
  }
}

type OrderRow = {
  id: string
  orderNumber: string
  productId: string
  bomId: string
  plannedQty: number
  producedQty: number
  status: string
  startDate: Date | null
  completedDate: Date | null
  notes: string | null
  createdAt: Date
  product: { productName: string }
  materialUsage: Array<{
    id: string
    rawMaterialId: string
    quantityPlanned: number
    quantityActual: number
    rawMaterial: { name: string; unit: string; unitCost: number }
  }>
}

function toRecord(o: OrderRow): ProductionOrderRecord {
  const materialUsage: MaterialUsageRecord[] = o.materialUsage.map(u => ({
    id: u.id,
    rawMaterialId: u.rawMaterialId,
    materialName: u.rawMaterial.name,
    materialUnit: u.rawMaterial.unit,
    quantityPlanned: u.quantityPlanned,
    quantityActual: u.quantityActual,
    unitCost: u.rawMaterial.unitCost
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
    status: o.status as ProductionOrderRecord['status'],
    startDate: o.startDate?.toISOString() ?? null,
    completedDate: o.completedDate?.toISOString() ?? null,
    notes: o.notes,
    totalMaterialCost,
    materialUsage,
    createdAt: o.createdAt.toISOString()
  }
}
