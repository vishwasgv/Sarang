import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { inventoryService } from './inventory.service'
import { roundMoney } from '../../shared/utils/money'

// A line typed as free text on a GRN never reached the stock when the GRN was posted. This links such a line
// to a catalog product after the fact and brings its accepted quantity into stock now, at the line's cost.
export async function linkPostedGrnLine(p: { itemId: string; productId: string }, userId?: string) {
  try {
    const db = getPrisma()
    const item = await db.gRNItem.findUnique({ where: { id: p.itemId }, include: { grn: { select: { id: true, grnNumber: true, status: true } } } })
    if (!item) throw new ServiceError('GRN-010', 'GRN line not found.')
    if (item.grn.status !== 'POSTED') throw new ServiceError('GRN-011', 'Only a line on a posted GRN can be linked here. Edit the GRN instead.')
    if (item.productId || item.rawMaterialId) throw new ServiceError('GRN-012', 'This line is already linked.')
    const product = await db.product.findUnique({ where: { id: p.productId }, select: { id: true, productType: true, isActive: true } })
    if (!product || !product.isActive) throw new ServiceError('GRN-013', 'Item not found.')
    if (product.productType !== 'STANDARD') throw new ServiceError('GRN-014', 'Choose an item that holds stock.')

    const accepted = Math.max(0, roundMoney(item.receivedQty - (item.rejectedQty ?? 0), 3))
    await db.$transaction(async (tx) => {
      const claimed = await tx.gRNItem.updateMany({ where: { id: item.id, productId: null, rawMaterialId: null }, data: { productId: p.productId } })
      if (claimed.count === 0) throw new ServiceError('GRN-012', 'This line is already linked.')
      if (accepted > 0) {
        await inventoryService.addStockTx(
          tx, p.productId, accepted, item.unitCost,
          `Received via GRN ${item.grn.grnNumber} (line linked after posting)`, 'GOODS_RECEIPT_NOTE', item.grn.id, userId,
          { sourceType: 'GOODS_RECEIPT_NOTE', sourceId: item.grn.id }
        )
      }
    }, { timeout: 30000 })
    await logAction({ userId, action: 'GRN_LINE_LINKED', entityType: 'GoodsReceiptNote', entityId: item.grn.id, newValue: { itemId: item.id, productId: p.productId, quantity: accepted } })
    return { success: true, data: { quantityAdded: accepted } }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
