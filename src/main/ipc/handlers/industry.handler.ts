import * as industryService from '../../services/industry-template.service'
import * as restaurantService from '../../services/restaurant.service'
import * as restaurantOrderService from '../../services/restaurant-order.service'
import { requirePermission, requireSession } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { ensureQrOrderServerState, getServerStatus } from '../../server/qr-order-server'
import {
  ensureKitchenDisplayServerState, getKitchenDisplayServerStatus,
  getOrCreateKitchenDisplayToken, regenerateKitchenDisplayToken
} from '../../server/kitchen-display-server'
import {
  ensureFieldOrderServerState, getFieldOrderServerStatus,
  getOrCreateFieldOrderToken, regenerateFieldOrderToken
} from '../../server/field-order-server'
import * as fieldOrderService from '../../services/field-order.service'
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
    if (result.success) { await ensureQrOrderServerState(); await ensureKitchenDisplayServerState(); await ensureFieldOrderServerState() }
    return result
  })

  handle('industry:changeBusinessType', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ChangeBusinessTypeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const result = await industryService.changeBusinessType(parsed.data.businessType, getCurrentSession()?.userId)
    // Phase 47: a business-type switch changes which enabledModules apply —
    // resync the QR-ordering server's running state either way.
    if (result.success) { await ensureQrOrderServerState(); await ensureKitchenDisplayServerState(); await ensureFieldOrderServerState() }
    return result
  })

  handle('industry:updateModules', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpdateModulesSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const result = await industryService.updateEnabledModules(parsed.data.modules as industryService.TemplateModule[], getCurrentSession()?.userId)
    // Phase 47: toggling qr_table_ordering on/off must take effect immediately —
    // starts/stops the local HTTP server without requiring an app restart.
    if (result.success) { await ensureQrOrderServerState(); await ensureKitchenDisplayServerState(); await ensureFieldOrderServerState() }
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

  handle('restaurant:assignWaiter', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const p = payload as { tableId?: string; waiterId?: string | null }
    if (!p?.tableId) return { success: false, error: { code: 'VAL-001', message: 'Table ID is required.' } }
    return restaurantService.assignWaiter(p.tableId, p.waiterId ?? null, getCurrentSession()?.userId)
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

  // ── Kitchen Display (phone/laptop, LAN) ─────────────────────────────────────

  handle('restaurant:getKitchenDisplayStatus', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const status = getKitchenDisplayServerStatus()
    const token = status.running ? await getOrCreateKitchenDisplayToken() : null
    return { success: true, data: { ...status, token } }
  })

  handle('restaurant:regenerateKitchenDisplayToken', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const token = await regenerateKitchenDisplayToken()
    return { success: true, data: { token } }
  })

  handle('restaurant:generateKitchenDisplayQr', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const status = getKitchenDisplayServerStatus()
    if (!status.running || status.lanUrls.length === 0) {
      return { success: false, error: { code: 'KDS-001', message: 'Kitchen Display is not currently running. Enable it in Settings first.' } }
    }
    const token = await getOrCreateKitchenDisplayToken()
    const boardUrl = `${status.lanUrls[0]}/kitchen/${token}`
    const QRCode = await import('qrcode')
    const qrDataUrl = await QRCode.toDataURL(boardUrl, { margin: 1, width: 320 })
    return { success: true, data: { qrDataUrl, boardUrl } }
  })

  // ── Phase 58 §2 — Distributor field-rep order capture (phone/laptop, LAN) ──

  handle('distributor:getFieldOrderStatus', async () => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const status = getFieldOrderServerStatus()
    const token = status.running ? await getOrCreateFieldOrderToken() : null
    return { success: true, data: { ...status, token } }
  })

  handle('distributor:regenerateFieldOrderToken', async () => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const token = await regenerateFieldOrderToken()
    return { success: true, data: { token } }
  })

  handle('distributor:generateFieldOrderQr', async () => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const status = getFieldOrderServerStatus()
    if (!status.running || status.lanUrls.length === 0) {
      return { success: false, error: { code: 'FOR-040', message: 'Field order capture is not currently running. Enable it in Settings first.' } }
    }
    const token = await getOrCreateFieldOrderToken()
    const captureUrl = `${status.lanUrls[0]}/field-order/${token}`
    const QRCode = await import('qrcode')
    const qrDataUrl = await QRCode.toDataURL(captureUrl, { margin: 1, width: 320 })
    return { success: true, data: { qrDataUrl, captureUrl } }
  })

  handle('distributor:listFieldOrderRequests', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const { status } = (payload ?? {}) as { status?: string }
    return fieldOrderService.listFieldOrderRequests(status)
  })

  handle('distributor:acceptFieldOrderRequest', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { requestId?: string; paymentMethod?: string }
    if (!p?.requestId || !p?.paymentMethod) return { success: false, error: { code: 'VAL-001', message: 'requestId and paymentMethod are required.' } }
    return fieldOrderService.acceptFieldOrderRequest(
      p.requestId,
      { paymentMethod: p.paymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT' },
      getCurrentSession()?.userId
    )
  })

  handle('distributor:rejectFieldOrderRequest', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { requestId?: string }
    if (!p?.requestId) return { success: false, error: { code: 'VAL-001', message: 'requestId is required.' } }
    return fieldOrderService.rejectFieldOrderRequest(p.requestId, getCurrentSession()?.userId)
  })
}
