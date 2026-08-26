import * as industryService from '../../services/industry-template.service'
import * as restaurantService from '../../services/restaurant.service'
import * as restaurantOrderService from '../../services/restaurant-order.service'
import { requirePermission, requireSession } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPrisma } from '../../database/db'
import { buildWifiQrPayload } from '../../utils/wifi-qr.util'
import { ensureQrOrderServerState, getServerStatus } from '../../server/qr-order-server'
import {
  ensureKitchenDisplayServerState, getKitchenDisplayServerStatus,
  getOrCreateKitchenDisplayToken, regenerateKitchenDisplayToken
} from '../../server/kitchen-display-server'
import {
  ensureFieldOrderServerState, getFieldOrderServerStatus,
  getOrCreateFieldOrderToken, regenerateFieldOrderToken
} from '../../server/field-order-server'
import { ensureTokenQueueServerState } from '../../server/token-queue-server'
import * as fieldOrderService from '../../services/field-order.service'
import * as distributorBeatService from '../../services/distributor-beat.service'
import { getCustomerCreditRisk } from '../../services/distributor-credit-risk.service'
import {
  ChangeBusinessTypeSchema, UpdateModulesSchema, CreateRestaurantTableSchema, UpdateTableStatusSchema,
  DeleteTableSchema, CreateKOTSchema, UpdateKOTStatusSchema, UpsertRecipeSchema, DeleteRecipeSchema,
  AcceptOrderRequestSchema, RejectOrderRequestSchema, GenerateTableQrSchema, MergeTableIntoInvoiceSchema,
  SetWifiConfigSchema,
} from '../../validation/industry.validation'

const WIFI_SSID_SETTING_KEY = 'restaurant_wifi_ssid'
const WIFI_PASSWORD_SETTING_KEY = 'restaurant_wifi_password'
const WIFI_OPEN_SETTING_KEY = 'restaurant_wifi_open'

async function readWifiConfig(): Promise<{ ssid: string; password?: string; security: 'WPA' | 'nopass' } | null> {
  const db = getPrisma()
  const [ssidRow, passwordRow, openRow] = await Promise.all([
    db.setting.findUnique({ where: { settingKey: WIFI_SSID_SETTING_KEY } }),
    db.setting.findUnique({ where: { settingKey: WIFI_PASSWORD_SETTING_KEY } }),
    db.setting.findUnique({ where: { settingKey: WIFI_OPEN_SETTING_KEY } })
  ])
  const ssid = ssidRow?.settingValue?.trim()
  if (!ssid) return null
  const open = openRow?.settingValue === 'true'
  return { ssid, password: passwordRow?.settingValue, security: open ? 'nopass' : 'WPA' }
}

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
    if (result.success) { await ensureQrOrderServerState(); await ensureKitchenDisplayServerState(); await ensureFieldOrderServerState(); await ensureTokenQueueServerState() }
    return result
  })

  handle('industry:changeBusinessType', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ChangeBusinessTypeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const result = await industryService.changeBusinessType(parsed.data.businessType, getCurrentSession()?.userId)
    // Phase 47: a business-type switch changes which enabledModules apply —
    // resync the QR-ordering server's running state either way.
    if (result.success) { await ensureQrOrderServerState(); await ensureKitchenDisplayServerState(); await ensureFieldOrderServerState(); await ensureTokenQueueServerState() }
    return result
  })

  handle('industry:updateModules', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpdateModulesSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const result = await industryService.updateEnabledModules(parsed.data.modules as industryService.TemplateModule[], getCurrentSession()?.userId)
    // Phase 47: toggling qr_table_ordering on/off must take effect immediately —
    // starts/stops the local HTTP server without requiring an app restart.
    if (result.success) { await ensureQrOrderServerState(); await ensureKitchenDisplayServerState(); await ensureFieldOrderServerState(); await ensureTokenQueueServerState() }
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

  handle('restaurant:mergeTableIntoInvoice', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = MergeTableIntoInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return restaurantService.mergeTableIntoInvoice(parsed.data.tableId, parsed.data.invoiceId, getCurrentSession()?.userId)
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

    // Task 18 — printed alongside the order QR so a customer whose phone
    // isn't already on the restaurant's WiFi can join it with the same scan
    // gesture, then immediately scan the order QR below it. Entirely
    // optional: no WiFi config saved means no wifiQrDataUrl in the response,
    // and the renderer already handles that (order QR alone, unchanged from
    // before this feature existed).
    const wifiConfig = await readWifiConfig()
    const wifiPayload = wifiConfig ? buildWifiQrPayload(wifiConfig) : null
    const wifiQrDataUrl = wifiPayload ? await QRCode.toDataURL(wifiPayload, { margin: 1, width: 320 }) : null

    return { success: true, data: { qrDataUrl, orderUrl, wifiQrDataUrl, wifiSsid: wifiConfig?.ssid ?? null } }
  })

  handle('restaurant:getWifiConfig', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const config = await readWifiConfig()
    // Password is deliberately never sent back to the renderer — the QR
    // itself is generated main-process-side in restaurant:generateTableQr,
    // so the renderer never needs the plaintext value, only whether one is
    // set (to decide whether to show "change password" vs "set password").
    return { success: true, data: { ssid: config?.ssid ?? '', hasPassword: !!config?.password, open: config?.security === 'nopass' } }
  })

  handle('restaurant:setWifiConfig', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const parsed = SetWifiConfigSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const db = getPrisma()
    const { ssid, password, open } = parsed.data
    await db.setting.upsert({
      where: { settingKey: WIFI_SSID_SETTING_KEY },
      create: { settingKey: WIFI_SSID_SETTING_KEY, settingValue: ssid ?? '' },
      update: { settingValue: ssid ?? '' }
    })
    // Only overwrite the stored password when a new one is actually
    // provided — leaving the field blank in the UI on a later edit (e.g.
    // just renaming the network) must not silently wipe out a working
    // password.
    if (password !== undefined) {
      await db.setting.upsert({
        where: { settingKey: WIFI_PASSWORD_SETTING_KEY },
        create: { settingKey: WIFI_PASSWORD_SETTING_KEY, settingValue: password },
        update: { settingValue: password }
      })
    }
    await db.setting.upsert({
      where: { settingKey: WIFI_OPEN_SETTING_KEY },
      create: { settingKey: WIFI_OPEN_SETTING_KEY, settingValue: open ? 'true' : 'false' },
      update: { settingValue: open ? 'true' : 'false' }
    })
    return { success: true, data: null }
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

  // ── Phase 67 §9.1 — Distributor item 2: beat-plan route sequencing ──
  // Reuses distributor.manageFieldOrders (same "manage distributor field
  // operations" trust tier already granted to Admin/Manager/Cashier) rather
  // than a new permission key, since beat planning is the same operational
  // scope as field-rep order capture just above.

  handle('distributor:listBeats', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    return distributorBeatService.listBeats((payload ?? undefined) as { repName?: string; isActive?: boolean } | undefined)
  })

  handle('distributor:createBeat', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { name?: string; repName?: string; dayOfWeek?: number | null; customerIds?: string[] }
    if (!p?.name || !p?.repName) return { success: false, error: { code: 'VAL-001', message: 'name and repName are required.' } }
    return distributorBeatService.createBeat(
      { name: p.name, repName: p.repName, dayOfWeek: p.dayOfWeek, customerIds: p.customerIds },
      getCurrentSession()?.userId
    )
  })

  handle('distributor:updateBeat', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { id?: string; name?: string; repName?: string; dayOfWeek?: number | null; isActive?: boolean }
    if (!p?.id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    return distributorBeatService.updateBeat(p as { id: string; name?: string; repName?: string; dayOfWeek?: number | null; isActive?: boolean }, getCurrentSession()?.userId)
  })

  handle('distributor:deleteBeat', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { id?: string }
    if (!p?.id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    return distributorBeatService.deleteBeat(p.id, getCurrentSession()?.userId)
  })

  handle('distributor:addBeatStop', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { beatId?: string; customerId?: string }
    if (!p?.beatId || !p?.customerId) return { success: false, error: { code: 'VAL-001', message: 'beatId and customerId are required.' } }
    return distributorBeatService.addBeatStop({ beatId: p.beatId, customerId: p.customerId }, getCurrentSession()?.userId)
  })

  handle('distributor:removeBeatStop', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { id?: string }
    if (!p?.id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    return distributorBeatService.removeBeatStop(p.id, getCurrentSession()?.userId)
  })

  handle('distributor:moveBeatStop', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { id?: string; direction?: 'UP' | 'DOWN' }
    if (!p?.id || (p.direction !== 'UP' && p.direction !== 'DOWN')) return { success: false, error: { code: 'VAL-001', message: 'id and a valid direction are required.' } }
    return distributorBeatService.moveBeatStop({ id: p.id, direction: p.direction }, getCurrentSession()?.userId)
  })

  // ── Phase 67 §9.1 — Distributor item 5: risk-scored retailer credit ──

  handle('distributor:getCustomerCreditRisk', async (payload) => {
    const deny = await requirePermission('distributor.manageFieldOrders'); if (deny) return deny
    const p = payload as { customerId?: string }
    if (!p?.customerId) return { success: false, error: { code: 'VAL-001', message: 'customerId is required.' } }
    return getCustomerCreditRisk(p.customerId)
  })
}
