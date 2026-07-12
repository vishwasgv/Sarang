import * as industryService from '../../services/industry-template.service'
import * as restaurantService from '../../services/restaurant.service'
import * as restaurantOrderService from '../../services/restaurant-order.service'
import { requirePermission, requireSession } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { ensureQrOrderServerState, getServerStatus } from '../../server/qr-order-server'
import {
  ChangeBusinessTypeSchema, UpdateModulesSchema, CreateRestaurantTableSchema, UpdateTableStatusSchema,
  DeleteTableSchema, CreateKOTSchema, UpdateKOTStatusSchema, UpsertRecipeSchema, DeleteRecipeSchema,
  AcceptOrderRequestSchema, RejectOrderRequestSchema, GenerateTableQrSchema,
} from '../../validation/industry.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('industry:getTemplate', async () => {
    const deny = requireSession(); if (deny) return deny
    return industryService.getActiveTemplate()
  })

  handle('industry:setTemplate', async (payload) => {
    // Same mutation as industry:changeBusinessType below — must carry the
    // same settings.modify guard and input validation, not just delegate to
    // the unguarded service call. This channel was previously reachable from
    // any renderer script with zero permission check.
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ChangeBusinessTypeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const result = await industryService.changeBusinessType(parsed.data.businessType, getCurrentSession()?.userId)
    if (result.success) await ensureQrOrderServerState()
    return result
  })

  handle('industry:changeBusinessType', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ChangeBusinessTypeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const result = await industryService.changeBusinessType(parsed.data.businessType, getCurrentSession()?.userId)
    // Phase 47: a business-type switch changes which enabledModules apply —
    // resync the QR-ordering server's running state either way.
    if (result.success) await ensureQrOrderServerState()
    return result
  })

  handle('industry:updateModules', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpdateModulesSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const result = await industryService.updateEnabledModules(parsed.data.modules as industryService.TemplateModule[], getCurrentSession()?.userId)
    // Phase 47: toggling qr_table_ordering on/off must take effect immediately —
    // starts/stops the local HTTP server without requiring an app restart.
    if (result.success) await ensureQrOrderServerState()
    return result
  })

  handle('restaurant:listTables', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    return restaurantService.listTables()
  })

  handle('restaurant:createTable', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = CreateRestaurantTableSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.createTable(parsed.data.tableNumber.trim(), parsed.data.tableName?.trim(), getCurrentSession()?.userId)
  })

  handle('restaurant:updateTableStatus', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = UpdateTableStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.updateTableStatus(parsed.data.tableId, parsed.data.status, getCurrentSession()?.userId)
  })

  handle('restaurant:deleteTable', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = DeleteTableSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.deleteTable(parsed.data.tableId, getCurrentSession()?.userId)
  })

  handle('restaurant:listKOTs', async (payload) => {
    const deny = await requirePermission('restaurant.viewKOT'); if (deny) return deny
    const p = (payload ?? {}) as { status?: string; tableId?: string }
    return restaurantService.listKOTs(p)
  })

  handle('restaurant:createKOT', async (payload) => {
    const deny = await requirePermission('restaurant.viewKOT'); if (deny) return deny
    const parsed = CreateKOTSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.createKOT(parsed.data.invoiceId, parsed.data.tableId, getCurrentSession()?.userId)
  })

  handle('restaurant:updateKOTStatus', async (payload) => {
    const deny = await requirePermission('restaurant.updateKOT'); if (deny) return deny
    const parsed = UpdateKOTStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.updateKOTStatus(parsed.data.kotId, parsed.data.status, getCurrentSession()?.userId)
  })

  handle('restaurant:listRecipes', async () => {
    const deny = await requirePermission('restaurant.manageRecipes'); if (deny) return deny
    return restaurantService.listRecipes()
  })

  handle('restaurant:getRecipe', async (payload) => {
    const deny = await requirePermission('restaurant.manageRecipes'); if (deny) return deny
    const productId = payload as string
    if (!productId) return { success: false, error: { code: 'VAL-001', message: 'productId is required.' } }
    return restaurantService.getRecipe(productId)
  })

  handle('restaurant:upsertRecipe', async (payload) => {
    const deny = await requirePermission('restaurant.manageRecipes'); if (deny) return deny
    const parsed = UpsertRecipeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.upsertRecipe(parsed.data.productId, parsed.data.recipeName, parsed.data.items ?? [], getCurrentSession()?.userId)
  })

  handle('restaurant:deleteRecipe', async (payload) => {
    const deny = await requirePermission('restaurant.manageRecipes'); if (deny) return deny
    const parsed = DeleteRecipeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.deleteRecipe(parsed.data.recipeId, getCurrentSession()?.userId)
  })

  handle('restaurant:getDailyClosingSummary', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const { date } = (payload ?? {}) as { date?: string }
    return restaurantService.getDailyClosingSummary(date)
  })

  handle('restaurant:performDailyClose', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    return restaurantService.performDailyClose(getCurrentSession()?.userId)
  })

  // ── Phase 47 — QR Table Ordering ────────────────────────────────────────────

  handle('restaurant:getQrOrderingStatus', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    return { success: true, data: getServerStatus() }
  })

  handle('restaurant:listOrderRequests', async (payload) => {
    const deny = await requirePermission('restaurant.manageOrderRequests'); if (deny) return deny
    const { status } = (payload ?? {}) as { status?: string }
    return restaurantOrderService.listOrderRequests(status)
  })

  handle('restaurant:acceptOrderRequest', async (payload) => {
    const deny = await requirePermission('restaurant.manageOrderRequests'); if (deny) return deny
    const parsed = AcceptOrderRequestSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantOrderService.acceptOrderRequest(
      parsed.data.requestId,
      { paymentMethod: parsed.data.paymentMethod, customerId: parsed.data.customerId },
      getCurrentSession()?.userId
    )
  })

  handle('restaurant:rejectOrderRequest', async (payload) => {
    const deny = await requirePermission('restaurant.manageOrderRequests'); if (deny) return deny
    const parsed = RejectOrderRequestSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantOrderService.rejectOrderRequest(parsed.data.requestId, getCurrentSession()?.userId)
  })

  handle('restaurant:generateTableQr', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = GenerateTableQrSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const { tableId } = parsed.data
    const status = getServerStatus()
    if (!status.running || status.lanUrls.length === 0) {
      return { success: false, error: { code: 'QRO-040', message: 'QR ordering is not currently running. Enable it in Settings first.' } }
    }
    const orderUrl = `${status.lanUrls[0]}/order/${tableId}`
    const QRCode = await import('qrcode')
    const qrDataUrl = await QRCode.toDataURL(orderUrl, { margin: 1, width: 320 })
    return { success: true, data: { qrDataUrl, orderUrl } }
  })
}
