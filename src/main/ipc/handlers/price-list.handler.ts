import { priceListService } from '../../services/price-list.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreatePriceListSchema, UpdatePriceListSchema, SetPriceListItemsSchema, ResolvePriceSchema } from '../../validation/price-list.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('priceLists:list', async (payload) => {
    const deny = await requirePermission('priceLists.view'); if (deny) return deny
    return priceListService.listPriceLists(payload as { appliesTo?: string; isActive?: boolean } | undefined)
  })

  handle('priceLists:get', async (id) => {
    const deny = await requirePermission('priceLists.view'); if (deny) return deny
    const bad = validateId(id, 'price list ID'); if (bad) return bad
    return priceListService.getPriceList(id as string)
  })

  handle('priceLists:create', async (payload) => {
    const deny = await requirePermission('priceLists.manage'); if (deny) return deny
    const parsed = CreatePriceListSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return priceListService.createPriceList(parsed.data, getCurrentSession()?.userId)
  })

  handle('priceLists:update', async (payload) => {
    const deny = await requirePermission('priceLists.manage'); if (deny) return deny
    const parsed = UpdatePriceListSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return priceListService.updatePriceList(parsed.data, getCurrentSession()?.userId)
  })

  handle('priceLists:setItems', async (payload) => {
    const deny = await requirePermission('priceLists.manage'); if (deny) return deny
    const parsed = SetPriceListItemsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return priceListService.setPriceListItems(parsed.data, getCurrentSession()?.userId)
  })

  handle('priceLists:resolve', async (payload) => {
    const deny = await requirePermission('priceLists.resolve'); if (deny) return deny
    const parsed = ResolvePriceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return priceListService.resolvePrice(parsed.data)
  })
}
