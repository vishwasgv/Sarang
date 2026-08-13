import type { Prisma } from '@prisma/client'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

type Tx = Prisma.TransactionClient

// Phase 64 — composite items/kits. A kit product carries its own
// sellingPrice (not necessarily the sum of its components) and zero
// standalone stock of its own — see billing.service.ts's createInvoice for
// how a kit line explodes into real component stock deductions at sale
// time while still showing one clean line on the invoice.
export const kitService = {
  async getComponents(kitProductId: string) {
    const db = getPrisma()
    const rows = await db.kitComponent.findMany({
      where: { kitProductId },
      include: { componentProduct: { select: { id: true, productName: true, sku: true, sellingPrice: true, unit: true } } },
      orderBy: { id: 'asc' }
    })
    return { success: true, data: rows }
  },

  // Bulk-replace, matching PriceList's own "bulk-replace via setItems"
  // precedent from Phase 63 — the whole component list is the unit of edit,
  // not individual line CRUD.
  async setComponents(payload: { kitProductId: string; components: Array<{ componentProductId: string; quantity: number }> }, userId?: string) {
    const db = getPrisma()

    if (payload.components.length === 0) {
      return { success: false, error: { code: 'KIT-001', message: 'A kit needs at least one component.' } }
    }
    if (payload.components.some(c => c.quantity <= 0)) {
      return { success: false, error: { code: 'KIT-002', message: 'Every component quantity must be greater than zero.' } }
    }
    if (payload.components.some(c => c.componentProductId === payload.kitProductId)) {
      return { success: false, error: { code: 'KIT-003', message: 'A kit cannot include itself as a component.' } }
    }
    const uniqueIds = new Set(payload.components.map(c => c.componentProductId))
    if (uniqueIds.size !== payload.components.length) {
      return { success: false, error: { code: 'KIT-004', message: 'Each component product can only appear once in a kit — combine quantities instead.' } }
    }

    const kitProduct = await db.product.findUnique({ where: { id: payload.kitProductId }, select: { id: true, isKit: true } })
    if (!kitProduct) return { success: false, error: { code: 'PRD-001', message: 'Kit product not found.' } }

    const componentProducts = await db.product.findMany({
      where: { id: { in: [...uniqueIds] } },
      select: { id: true, productName: true, isActive: true, isKit: true }
    })
    if (componentProducts.length !== uniqueIds.size) {
      return { success: false, error: { code: 'PRD-001', message: 'One or more component products were not found.' } }
    }
    const inactive = componentProducts.find(p => !p.isActive)
    if (inactive) return { success: false, error: { code: 'PRD-005', message: `"${inactive.productName}" is archived and cannot be a kit component.` } }
    // One level deep only — a kit's own component cannot itself be a kit
    // (real, disclosed scope cut, see Section 6.1 item 5).
    const nestedKit = componentProducts.find(p => p.isKit)
    if (nestedKit) return { success: false, error: { code: 'KIT-005', message: `"${nestedKit.productName}" is itself a kit — a kit cannot include another kit as a component.` } }

    await db.$transaction(async (tx) => {
      await tx.kitComponent.deleteMany({ where: { kitProductId: payload.kitProductId } })
      await tx.kitComponent.createMany({
        data: payload.components.map(c => ({ kitProductId: payload.kitProductId, componentProductId: c.componentProductId, quantity: c.quantity }))
      })
      if (!kitProduct.isKit) {
        await tx.product.update({ where: { id: payload.kitProductId }, data: { isKit: true } })
      }
    })

    await logAction({ userId, action: 'KIT_COMPONENTS_SET', entityType: 'Product', entityId: payload.kitProductId, newValue: payload.components })
    return { success: true }
  },

  // Un-kits a product — clears its components and isKit flag. Does not
  // touch any past invoice (kit lines are already resolved to real
  // component stock movements at sale time, nothing to reverse).
  async clearKit(kitProductId: string, userId?: string) {
    const db = getPrisma()
    await db.$transaction(async (tx) => {
      await tx.kitComponent.deleteMany({ where: { kitProductId } })
      await tx.product.update({ where: { id: kitProductId }, data: { isKit: false } })
    })
    await logAction({ userId, action: 'KIT_CLEARED', entityType: 'Product', entityId: kitProductId })
    return { success: true }
  }
}

// Phase 64 — called from inside billing.service.ts's createInvoice
// transaction, a fresh in-transaction read (not the pre-transaction
// validation snapshot) so a concurrent kit-definition edit can't create a
// TOCTOU gap between validating and actually deducting stock.
export async function explodeKitComponentsTx(
  tx: Tx,
  kitProductId: string,
  kitQuantitySold: number
): Promise<Array<{ componentProductId: string; quantity: number }>> {
  const components = await tx.kitComponent.findMany({ where: { kitProductId } })
  return components.map(c => ({ componentProductId: c.componentProductId, quantity: c.quantity * kitQuantitySold }))
}
