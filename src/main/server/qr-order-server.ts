import * as http from 'http'
import { networkInterfaces } from 'os'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getPrisma } from '../database/db'
import { isModuleEnabled } from '../services/industry-template.service'
import { listMenuProducts, createOrderRequest, getBusinessDisplayInfo, type MenuProduct } from '../services/restaurant-order.service'
import { logger } from '../utils/logger'

// Phase 47 — a small, deliberately dependency-free local HTTP server so a
// customer's phone (on the restaurant's own WiFi) can scan a table's QR code
// and place an order without staff involvement. This is the first
// network-reachable surface in this codebase — everything else is pure
// Electron main<->renderer IPC. Plain HTTP, no TLS (no practical cert for an
// ad-hoc LAN IP) — accepted tradeoff, documented in PHASE_47_TECHNICAL_SPEC.md.
// Only ever creates a PENDING TableOrderRequest — never an Invoice/KOT/stock
// change — so nothing here can bill or affect inventory unattended.

const DEFAULT_PORT = 8420
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 5

// Fresh-audit fix (2026-07-12): this used to be a single http.Server bound
// with no explicit host, which Node resolves to the wildcard address (all
// interfaces — IPv4 AND IPv6, including any public-facing NIC the machine
// might have, not just the LAN this feature is actually meant for). Now one
// server instance per detected LAN IPv4 address, so the socket itself can
// never be reached from anywhere other than the same LAN the QR codes were
// printed for — loopback-only fallback if no LAN interface is found at all,
// never the wildcard address.
let servers: http.Server[] = []
let activePort: number | null = null
// Keyed by `${ip}|${bucket}` — GET (menu/business lookups) and POST (order
// submission) are tracked independently per IP, each against its own cap, so
// a burst of menu page-loads can never count against the stricter order cap.
const requestLog = new Map<string, number[]>()

export function getServerStatus(): { running: boolean; port: number | null; lanUrls: string[] } {
  return { running: servers.length > 0, port: activePort, lanUrls: activePort ? getLanUrls(activePort) : [] }
}

// Real bug found 2026-07-16: a printed/shown QR code silently encoded a
// VirtualBox Host-Only Adapter address (192.168.56.x, the range VirtualBox
// always defaults to) instead of the machine's actual WiFi/Ethernet LAN
// address — completely unreachable from a real customer's phone, so the QR
// code just didn't work. Object.keys() iteration order over
// os.networkInterfaces() follows raw OS adapter enumeration, not "real
// network first", so nothing previously stopped a virtual adapter from
// landing at index 0 (the address this file always used for the QR/shown
// URL). Now sorts real-looking adapters first — every address is still
// returned (the server still binds every interface, matching prior
// behavior), only the ORDER changes, which is what the QR/display code
// actually keys off (lanUrls[0]).
const VIRTUAL_ADAPTER_NAME_PATTERN = /virtualbox|vmware|hyper-v|vethernet|virtual|wsl|docker|loopback|tailscale|zerotier|tap-|npcap/i

function getLanIPv4Addresses(): string[] {
  const real: string[] = []
  const virtual: string[] = []
  const interfaces = networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        (VIRTUAL_ADAPTER_NAME_PATTERN.test(name) ? virtual : real).push(iface.address)
      }
    }
  }
  return [...real, ...virtual]
}

function getLanUrls(port: number): string[] {
  return getLanIPv4Addresses().map((address) => `http://${address}:${port}`)
}

async function getConfiguredPort(): Promise<number> {
  const db = getPrisma()
  const setting = await db.setting.findUnique({ where: { settingKey: 'qr_order_server_port' } })
  const parsed = setting ? parseInt(setting.settingValue, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT
}

// GET routes get a more generous cap than POST /api/order — they're read-only
// menu/business-info lookups, but still hit Prisma on every call, so an
// unthrottled device on the LAN shouldn't be able to hammer the DB freely.
const GET_RATE_LIMIT_MAX_REQUESTS = 30

function isRateLimited(ip: string, bucket: 'order' | 'get', max: number): boolean {
  const key = `${ip}|${bucket}`
  const now = Date.now()
  const timestamps = (requestLog.get(key) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= max) {
    requestLog.set(key, timestamps)
    return true
  }
  timestamps.push(now)
  requestLog.set(key, timestamps)
  return false
}

// requestLog never removes an IP once seen, only filters its timestamp array
// — on a long-running install with many distinct customer-phone IPs (DHCP
// lease rotation especially) this would grow unbounded. Sweep out entries
// with no requests left in the window on a slow interval instead of only
// ever appending.
function sweepStaleRateLimitEntries(): void {
  const now = Date.now()
  for (const [ip, timestamps] of requestLog) {
    if (timestamps.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(ip)
  }
}
let sweepInterval: ReturnType<typeof setInterval> | null = null

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

// Perf fix (2026-09-02, founder-reported real-device latency scanning a
// table QR): GET /api/menu and /api/business previously re-ran the full
// Prisma query (+ category join, + result mapping) on every single request
// with zero caching, even though menu/business-profile data changes on the
// order of "staff edits a price occasionally," not "every few seconds." In
// a real restaurant, several tables can scan around the same moment (a
// party being seated together, a lunch rush), and the Electron main process
// is single-threaded — every one of those customers' requests, plus
// whatever else Sarang's own UI is doing on the same process at that
// moment (billing, KOT, reports), serializes through one JS thread. A short
// TTL cache turns N near-simultaneous menu loads into 1 real DB round trip
// + N-1 near-instant in-memory hits, which is the concrete, measurable win
// here — cheap, safe (rate-limiting still runs unconditionally before this,
// unaffected), and reset on server stop so tests (each getting a fresh
// server per `it()`, per qr-order-server.test.ts's own afterEach) never see
// a stale entry from a previous test's mock.
const MENU_CACHE_TTL_MS = 10_000
let menuCache: { data: MenuProduct[]; expiresAt: number } | null = null
let businessInfoCache: { data: { businessName: string; currencySymbol: string }; expiresAt: number } | null = null

async function getCachedMenu(): Promise<MenuProduct[]> {
  const now = Date.now()
  if (menuCache && menuCache.expiresAt > now) return menuCache.data
  const data = await listMenuProducts()
  menuCache = { data, expiresAt: now + MENU_CACHE_TTL_MS }
  return data
}

async function getCachedBusinessInfo(): Promise<{ businessName: string; currencySymbol: string }> {
  const now = Date.now()
  if (businessInfoCache && businessInfoCache.expiresAt > now) return businessInfoCache.data
  const data = await getBusinessDisplayInfo()
  businessInfoCache = { data, expiresAt: now + MENU_CACHE_TTL_MS }
  return data
}

function getMenuPagePath(): string {
  // Dev-mode depth matches createSplashWindow()'s splash.html resolution in
  // main/index.ts exactly — electron-vite bundles every main-process file
  // (this one included) into the single out/main/index.js, so __dirname at
  // runtime is out/main regardless of this file's location under src/.
  return app.isPackaged
    ? join(process.resourcesPath, 'qr-menu', 'index.html')
    : join(__dirname, '../../resources/qr-menu/index.html')
}

// undefined = not yet loaded, null = confirmed missing on disk. The page is
// a static bundled resource that never changes at runtime, so reading it
// from disk on every single GET /order/:tableId request (previously
// unconditional, unlike every other route here) was needless synchronous
// blocking I/O on the Electron main process's single event loop — the same
// thread every IPC handler (billing, invoicing, DB access) runs on. Cached
// once, reset on stopQrOrderServer() so a dev-mode resource-file edit is
// still picked up on the next server start.
let cachedMenuPageHtml: string | null | undefined = undefined

function getMenuPageHtml(): string | null {
  if (cachedMenuPageHtml !== undefined) return cachedMenuPageHtml
  const pagePath = getMenuPagePath()
  if (!existsSync(pagePath)) { cachedMenuPageHtml = null; return null }
  cachedMenuPageHtml = readFileSync(pagePath, 'utf-8')
  return cachedMenuPageHtml
}

// Fresh-audit fix (2026-07-12): this endpoint has no auth by design (a
// customer scans a QR code and orders, no login) — but that also meant ANY
// page loaded in another tab on the same WiFi could blind-POST to
// /api/order if it guessed the LAN IP and a tableId, since nothing checked
// where the request actually came from. Classic Origin-must-equal-Host
// check: the menu page's own same-origin fetch() always sends an Origin
// header matching the Host it's talking to, so a genuine request from OUR
// served page always passes; a cross-origin page trying to POST here
// (the actual CSRF threat model) sends its OWN origin, which won't match.
// Fails open only when Origin is entirely absent (some non-browser/older
// clients don't send it) — this is a LAN-trust-model feature by design, not
// a login boundary, and every order still lands PENDING requiring an
// explicit staff Accept before it can ever bill or touch stock.
function isOriginAllowed(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

async function readBody(req: http.IncomingMessage, maxBytes = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) { reject(new Error('Request body too large')); req.destroy(); return }
      data += chunk.toString('utf-8')
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const ip = req.socket.remoteAddress ?? 'unknown'

    // GET /order/:tableId — serves the static customer ordering page.
    // The table identity itself is read client-side from the URL and passed
    // back on submission; the page never gets or needs elevated access.
    if (req.method === 'GET' && url.pathname.startsWith('/order/')) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      const html = getMenuPageHtml()
      if (html === null) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/menu') {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      const menu = await getCachedMenu()
      sendJson(res, 200, { success: true, data: menu })
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/business') {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      const info = await getCachedBusinessInfo()
      sendJson(res, 200, { success: true, data: info })
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/order') {
      if (isRateLimited(ip, 'order', RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many orders submitted — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }

      const body = await readBody(req)
      let parsed: { tableId?: string; items?: Array<{ productId: string; quantity: number }> }
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } })
        return
      }
      const result = await createOrderRequest(parsed.tableId ?? '', parsed.items ?? [])
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    // 2026-09-02 — the customer's own "Checkout" action (alongside "Place
    // order"), so both exist before the final bill as requested. This never
    // bills anything itself — it only flags the table so staff know the
    // customer is ready, exactly like a printed "bring the bill" request.
    // Actual billing only ever happens via restaurant.service.ts's
    // checkoutTable, from RestaurantTablesScreen.
    if (req.method === 'POST' && url.pathname === '/api/checkout-request') {
      if (isRateLimited(ip, 'order', RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }

      const body = await readBody(req)
      let parsed: { tableId?: string }
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } })
        return
      }
      if (!parsed.tableId) { sendJson(res, 400, { success: false, error: { message: 'Table not recognized.' } }); return }
      try {
        const db = getPrisma()
        const table = await db.restaurantTable.findUnique({ where: { id: parsed.tableId } })
        if (!table) { sendJson(res, 404, { success: false, error: { message: 'Table not recognized.' } }); return }
        await db.restaurantTable.update({ where: { id: parsed.tableId }, data: { checkoutRequestedAt: new Date() } })
        sendJson(res, 200, { success: true, data: null })
      } catch (err) {
        logger.error('[QROrderServer] Checkout request failed:', err)
        sendJson(res, 500, { success: false, error: { message: 'Could not send checkout request.' } })
      }
      return
    }

    res.writeHead(404); res.end('Not found')
  } catch (err) {
    logger.error('[QROrderServer] Request handling failed:', err)
    sendJson(res, 500, { success: false, error: { message: 'Internal error.' } })
  }
}

export async function ensureQrOrderServerState(): Promise<void> {
  const enabled = await isModuleEnabled('qr_table_ordering')
  if (enabled && servers.length === 0) {
    const port = await getConfiguredPort()
    // Bind one listener per LAN IPv4 address plus loopback — rather than the
    // wildcard address, which is reachable from ANY interface the machine
    // has (a public-facing NIC, a VPN tunnel), not just the LAN the printed
    // QR codes point at. Loopback is always included too — it's inherently
    // unreachable from the network, so there's no security cost, and it's
    // what staff on the same machine (and this codebase's own test suite)
    // use to reach the server directly.
    // Loopback first, unconditionally — it's the one address that must
    // never fail to bind (staff on the same machine, and this codebase's
    // own test suite, both rely on it), so it's attempted before any LAN
    // adapter that might not cooperate.
    const bindAddresses = ['127.0.0.1', ...getLanIPv4Addresses()]
    // Real bug found+fixed 2026-09-02: this used to bind every address
    // inside ONE try/catch — a single adapter failing to bind (a stale
    // VPN/VMware/Hyper-V host-only adapter still enumerated by the OS but
    // not actually bindable, common on a real small-business Windows PC
    // that also runs other software) aborted the ENTIRE server, including
    // loopback, with only a log line — QR ordering silently dead with no
    // way for the owner to tell why the printed QR codes stopped working.
    // Each address now binds independently; one failure no longer takes
    // down the others. Only genuinely fatal if loopback itself — the one
    // address that's never a real network adapter — fails.
    const started: http.Server[] = []
    const failed: string[] = []
    for (const address of bindAddresses) {
      const instance = http.createServer((req, res) => { void handleRequest(req, res) })
      try {
        await new Promise<void>((resolve, reject) => {
          instance.once('error', reject)
          instance.listen(port, address, () => resolve())
        })
        started.push(instance)
      } catch (err) {
        failed.push(address)
        logger.error(`[QROrderServer] Could not bind ${address}:${port}, skipping this address:`, err)
      }
    }
    if (started.length === 0) {
      logger.error('[QROrderServer] Failed to start: no address could be bound (including loopback).')
      servers = []
      activePort = null
    } else {
      servers = started
      activePort = port
      sweepInterval = setInterval(sweepStaleRateLimitEntries, RATE_LIMIT_WINDOW_MS)
      const boundAddresses = bindAddresses.filter((a) => !failed.includes(a))
      logger.info(`[QROrderServer] Listening on port ${port} (${boundAddresses.join(', ')})${failed.length > 0 ? `; could not bind: ${failed.join(', ')}` : ''}.`)
    }
  } else if (!enabled && servers.length > 0) {
    await stopQrOrderServer()
  }
}

export async function stopQrOrderServer(): Promise<void> {
  if (servers.length === 0) return
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))))
  servers = []
  activePort = null
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null }
  requestLog.clear()
  cachedMenuPageHtml = undefined
  menuCache = null
  businessInfoCache = null
  logger.info('[QROrderServer] Stopped.')
}
