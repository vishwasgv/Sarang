import * as http from 'http'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getPrisma } from '../database/db'
import { isModuleEnabled } from '../services/industry-template.service'
import { listKOTs, updateKOTStatus } from '../services/restaurant.service'
import { logger } from '../utils/logger'

// Kitchen Display (phone/laptop, LAN) — a second small, dependency-free local
// HTTP server, structurally cloned from qr-order-server.ts (see that file's
// header for the full threat-model writeup this one shares): one listener
// per LAN IPv4 address + loopback, never the wildcard address; GET and POST
// rate-limited independently per IP; Origin-must-equal-Host CSRF check on
// writes. The one real difference from qr-order-server.ts: that server can
// only ever create a PENDING order request (never bills or touches stock
// unattended); THIS server's POST /api/kitchen/:token/status calls the exact
// same restaurantService.updateKOTStatus() the in-app KOTScreen and the
// second-monitor board use, which CAN deduct ingredient stock and free a
// table (see restaurant.service.ts). Anonymous LAN access to that is a real
// step up in blast radius over the QR-ordering server, so this one adds a
// per-install random token as a path segment — not a login, but enough that
// a device merely being on the WiFi (without ever having scanned the printed
// QR code / been given the URL) can't drive it blind.

const DEFAULT_PORT = 8421 // one above qr-order-server.ts's 8420 so both can run at once
const RATE_LIMIT_WINDOW_MS = 60_000
const GET_RATE_LIMIT_MAX_REQUESTS = 30
// Kitchen staff tapping through several tickets in a burst is normal
// behaviour here (unlike qr-order-server.ts's POST /api/order, submitted at
// most once per table visit) — a materially higher cap than that endpoint's.
const STATUS_RATE_LIMIT_MAX_REQUESTS = 60

let servers: http.Server[] = []
let activePort: number | null = null
const requestLog = new Map<string, number[]>()
let sweepInterval: ReturnType<typeof setInterval> | null = null

export function getKitchenDisplayServerStatus(): { running: boolean; port: number | null; lanUrls: string[] } {
  return { running: servers.length > 0, port: activePort, lanUrls: activePort ? getLanUrls(activePort) : [] }
}

// Same real bug as qr-order-server.ts (this function was copied from it) —
// a shown/scanned QR code could silently encode a VirtualBox Host-Only
// Adapter address (192.168.56.x) instead of the real WiFi/Ethernet LAN
// address, unreachable from any real phone. See that file's comment for
// the full writeup. Every address is still returned (server still binds
// every interface) — only the order changes, which is what lanUrls[0]
// (the QR/shown URL) actually keys off.
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
  const setting = await db.setting.findUnique({ where: { settingKey: 'kitchen_display_server_port' } })
  const parsed = setting ? parseInt(setting.settingValue, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT
}

export async function getOrCreateKitchenDisplayToken(): Promise<string> {
  const db = getPrisma()
  const existing = await db.setting.findUnique({ where: { settingKey: 'kitchen_display_token' } })
  if (existing?.settingValue) return existing.settingValue
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'kitchen_display_token' },
    create: { settingKey: 'kitchen_display_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

export async function regenerateKitchenDisplayToken(): Promise<string> {
  const db = getPrisma()
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'kitchen_display_token' },
    create: { settingKey: 'kitchen_display_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

function isRateLimited(ip: string, bucket: 'status' | 'get', max: number): boolean {
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

function sweepStaleRateLimitEntries(): void {
  const now = Date.now()
  for (const [ip, timestamps] of requestLog) {
    if (timestamps.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) requestLog.delete(ip)
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function getBoardPagePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'kitchen-display', 'index.html')
    : join(__dirname, '../../resources/kitchen-display/index.html')
}

let cachedBoardPageHtml: string | null | undefined = undefined

function getBoardPageHtml(): string | null {
  if (cachedBoardPageHtml !== undefined) return cachedBoardPageHtml
  const pagePath = getBoardPagePath()
  if (!existsSync(pagePath)) { cachedBoardPageHtml = null; return null }
  cachedBoardPageHtml = readFileSync(pagePath, 'utf-8')
  return cachedBoardPageHtml
}

// Same Origin-must-equal-Host CSRF check as qr-order-server.ts's
// isOriginAllowed — see that file's comment for the full reasoning. Fails
// open only when Origin is entirely absent (some non-browser clients don't
// send it); this is a LAN-trust-model feature, not a login boundary, backed
// here additionally by the path token itself.
function isOriginAllowed(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

async function readBody(req: http.IncomingMessage, maxBytes = 5_000): Promise<string> {
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
    const parts = url.pathname.split('/').filter(Boolean) // e.g. ['kitchen', '<token>'] or ['api','kitchen','<token>','board']
    const expectedToken = await getOrCreateKitchenDisplayToken()

    // GET /kitchen/:token — serves the static board page.
    if (req.method === 'GET' && parts[0] === 'kitchen' && parts.length === 2) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[1] !== expectedToken) { res.writeHead(404); res.end('Not found'); return }
      const html = getBoardPageHtml()
      if (html === null) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    // GET /api/kitchen/:token/board — live KOT list, same data listKOTs()
    // already gives the in-app KOTScreen and the second-monitor board.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'kitchen' && parts[3] === 'board' && parts.length === 4) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const result = await listKOTs()
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    // POST /api/kitchen/:token/status — advances a ticket's status via the
    // exact same service function every other KOT-advancing surface uses.
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'kitchen' && parts[3] === 'status' && parts.length === 4) {
      if (isRateLimited(ip, 'status', STATUS_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }

      const body = await readBody(req)
      let parsed: { kotId?: string; status?: string }
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } })
        return
      }
      if (!parsed.kotId || !parsed.status) { sendJson(res, 400, { success: false, error: { message: 'kotId and status are required.' } }); return }
      const result = await updateKOTStatus(parsed.kotId, parsed.status)
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    res.writeHead(404); res.end('Not found')
  } catch (err) {
    logger.error('[KitchenDisplayServer] Request handling failed:', err)
    sendJson(res, 500, { success: false, error: { message: 'Internal error.' } })
  }
}

export async function ensureKitchenDisplayServerState(): Promise<void> {
  const enabled = await isModuleEnabled('kitchen_display_web')
  if (enabled && servers.length === 0) {
    await getOrCreateKitchenDisplayToken()
    const port = await getConfiguredPort()
    const bindAddresses = [...getLanIPv4Addresses(), '127.0.0.1']
    try {
      const started: http.Server[] = []
      for (const address of bindAddresses) {
        const instance = http.createServer((req, res) => { void handleRequest(req, res) })
        await new Promise<void>((resolve, reject) => {
          instance.once('error', reject)
          instance.listen(port, address, () => resolve())
        })
        started.push(instance)
      }
      servers = started
      activePort = port
      sweepInterval = setInterval(sweepStaleRateLimitEntries, RATE_LIMIT_WINDOW_MS)
      logger.info(`[KitchenDisplayServer] Listening on port ${port} (${bindAddresses.join(', ')}).`)
    } catch (err) {
      logger.error('[KitchenDisplayServer] Failed to start:', err)
      await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve())))).catch(() => {})
      servers = []
      activePort = null
    }
  } else if (!enabled && servers.length > 0) {
    await stopKitchenDisplayServer()
  }
}

export async function stopKitchenDisplayServer(): Promise<void> {
  if (servers.length === 0) return
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))))
  servers = []
  activePort = null
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null }
  requestLog.clear()
  cachedBoardPageHtml = undefined
  logger.info('[KitchenDisplayServer] Stopped.')
}
