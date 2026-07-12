import { listVariants, upsertVariants, deleteVariant, adjustVariantStock, getVariantSummary } from '../../services/variant.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('variants:list', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const p = (payload ?? {}) as { productId: string }
    return listVariants(p.productId)
  })

  handle('variants:upsert', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    return upsertVariants(payload as Parameters<typeof upsertVariants>[0], getCurrentSession()?.userId)
  })

  handle('variants:delete', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const p = (payload ?? {}) as { id: string }
    return deleteVariant(p.id, getCurrentSession()?.userId)
  })

  handle('variants:adjustStock', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    return adjustVariantStock(payload as Parameters<typeof adjustVariantStock>[0], getCurrentSession()?.userId)
  })

  handle('variants:summary', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const p = (payload ?? {}) as { productId: string }
    return getVariantSummary(p.productId)
  })
}
