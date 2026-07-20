import * as http from 'http'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getPrisma } from '../database/db'
import { isModuleEnabled } from '../services/industry-template.service'
import {
  listCustomersForFieldOrder, listFieldOrderCatalog, createFieldOrderRequest, getBusinessDisplayInfo
} from '../services/field-order.service'
import { logger } from '../utils/logger'

// Phase 58 §2 — Distributor field-rep order capture (phone/laptop, LAN).
// Structurally cloned from kitchen-display-server.ts (itself cloned from
// qr-order-server.ts — see that file's header for the full threat-model
// writeup shared by all three): one listener per LAN IPv4 address + loopback,
// never the wildcard address; GET and POST rate-limited independently per
// IP; Origin-must-equal-Host CSRF check on writes; a per-install random
// token as a path segment, same rationale as Kitchen Display's token — this
// server can resolve real (negotiated) prices and create a PENDING
// FieldOrderRequest, a step up in blast radius over anonymous LAN access,
// though — same as every LAN server in this codebase — it can never touch
// Invoice/inventory/credit-limit on its own; only the authenticated,
// permissioned acceptFieldOrderRequest IPC call can do that.

const DEFAULT_PORT = 8422 // one above kitchen-display-server.ts's 8421 so all three can run at once
const RATE_LIMIT_WINDOW_MS = 60_000
const GET_RATE_LIMIT_MAX_REQUESTS = 30
const SUBMIT_RATE_LIMIT_MAX_REQUESTS = 10

let servers: http.Server[] = []
let activePort: number | null = null
const requestLog = new Map<string, number[]>()
let sweepInterval: ReturnType<typeof setInterval> | null = null

export function getFieldOrderServerStatus(): { running: boolean; port: number | null; lanUrls: string[] } {
  return { running: servers.length > 0, port: activePort, lanUrls: activePort ? getLanUrls(activePort) : [] }
}

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
  const setting = await db.setting.findUnique({ where: { settingKey: 'field_order_server_port' } })
  const parsed = setting ? parseInt(setting.settingValue, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT
}

export async function getOrCreateFieldOrderToken(): Promise<string> {
  const db = getPrisma()
  const existing = await db.setting.findUnique({ where: { settingKey: 'field_order_token' } })
  if (existing?.settingValue) return existing.settingValue
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'field_order_token' },
    create: { settingKey: 'field_order_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

export async function regenerateFieldOrderToken(): Promise<string> {
  const db = getPrisma()
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'field_order_token' },
    create: { settingKey: 'field_order_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

function isRateLimited(ip: string, bucket: 'submit' | 'get', max: number): boolean {
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

function getCapturePagePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'field-order', 'index.html')
    : join(__dirname, '../../resources/field-order/index.html')
}

let cachedCapturePageHtml: string | null | undefined = undefined

function getCapturePageHtml(): string | null {
  if (cachedCapturePageHtml !== undefined) return cachedCapturePageHtml
  const pagePath = getCapturePagePath()
  if (!existsSync(pagePath)) { cachedCapturePageHtml = null; return null }
  cachedCapturePageHtml = readFileSync(pagePath, 'utf-8')
  return cachedCapturePageHtml
}

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
    const parts = url.pathname.split('/').filter(Boolean) // e.g. ['field-order','<token>'] or ['api','field-order','<token>','catalog']
    const expectedToken = await getOrCreateFieldOrderToken()

    // GET /field-order/:token — serves the static capture page.
    if (req.method === 'GET' && parts[0] === 'field-order' && parts.length === 2) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[1] !== expectedToken) { res.writeHead(404); res.end('Not found'); return }
      const html = getCapturePageHtml()
      if (html === null) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'field-order' && parts[3] === 'business' && parts.length === 4) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const info = await getBusinessDisplayInfo()
      sendJson(res, 200, { success: true, data: info })
      return
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'field-order' && parts[3] === 'customers' && parts.length === 4) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const customers = await listCustomersForFieldOrder()
      sendJson(res, 200, { success: true, data: customers })
      return
    }

    // GET /api/field-order/:token/catalog?customerId=... — resolves the
    // customer's negotiated class price up front so the rep isn't quoting a
    // stale number; still purely informational (accept-time re-resolves it
    // fresh regardless, see field-order.service.ts).
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'field-order' && parts[3] === 'catalog' && parts.length === 4) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const customerId = url.searchParams.get('customerId') || undefined
      const catalog = await listFieldOrderCatalog(customerId)
      sendJson(res, 200, { success: true, data: catalog })
      return
    }

    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'field-order' && parts[3] === 'submit' && parts.length === 4) {
      if (isRateLimited(ip, 'submit', SUBMIT_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many orders submitted — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }

      const body = await readBody(req)
      let parsed: { repName?: string; customerId?: string; customerName?: string; items?: Array<{ productId: string; quantity: number }>; notes?: string }
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } })
        return
      }
      const result = await createFieldOrderRequest(parsed.repName ?? '', parsed.customerId, parsed.customerName, parsed.items ?? [], parsed.notes)
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    res.writeHead(404); res.end('Not found')
  } catch (err) {
    logger.error('[FieldOrderServer] Request handling failed:', err)
    sendJson(res, 500, { success: false, error: { message: 'Internal error.' } })
  }
}

export async function ensureFieldOrderServerState(): Promise<void> {
  const enabled = await isModuleEnabled('field_order_capture')
  if (enabled && servers.length === 0) {
    await getOrCreateFieldOrderToken()
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
      logger.info(`[FieldOrderServer] Listening on port ${port} (${bindAddresses.join(', ')}).`)
    } catch (err) {
      logger.error('[FieldOrderServer] Failed to start:', err)
      await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve())))).catch(() => {})
      servers = []
      activePort = null
    }
  } else if (!enabled && servers.length > 0) {
    await stopFieldOrderServer()
  }
}

export async function stopFieldOrderServer(): Promise<void> {
  if (servers.length === 0) return
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))))
  servers = []
  activePort = null
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null }
  requestLog.clear()
  cachedCapturePageHtml = undefined
  logger.info('[FieldOrderServer] Stopped.')
}
