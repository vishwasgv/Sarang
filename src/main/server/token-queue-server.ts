import * as http from 'http'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getPrisma } from '../database/db'
import { isModuleEnabled } from '../services/industry-template.service'
import { createToken } from '../services/token-queue.service'
import { getBusinessDisplayInfo } from '../services/field-order.service'
import { logger } from '../utils/logger'

// Phase 62 — Token Queue self check-in (founder idea, added live during this
// phase's build). Structurally cloned from field-order-server.ts, itself
// cloned from kitchen-display-server.ts/qr-order-server.ts — see those
// files' headers for the full shared threat-model writeup: one listener per
// LAN IPv4 address + loopback (never the wildcard, never a virtual
// adapter), independent GET/POST rate limits per IP, Origin-must-equal-Host
// CSRF check on writes, a per-install random token as a path segment. Lower
// blast radius than Field Order's own server: a self-check-in can only ever
// create a WAITING TokenQueue row (name/age/gender/phone/notes) — it never
// touches Invoice, inventory, pricing, or credit, so (unlike Field Order's
// PENDING-then-staff-accepts flow) it's safe to write directly, no separate
// staff-approval step needed.

const DEFAULT_PORT = 8423 // one above field-order-server.ts's 8422 so all four LAN servers can run at once
const RATE_LIMIT_WINDOW_MS = 60_000
const GET_RATE_LIMIT_MAX_REQUESTS = 30
const SUBMIT_RATE_LIMIT_MAX_REQUESTS = 10

let servers: http.Server[] = []
let activePort: number | null = null
const requestLog = new Map<string, number[]>()
let sweepInterval: ReturnType<typeof setInterval> | null = null

export function getTokenQueueServerStatus(): { running: boolean; port: number | null; lanUrls: string[] } {
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
  const setting = await db.setting.findUnique({ where: { settingKey: 'token_queue_server_port' } })
  const parsed = setting ? parseInt(setting.settingValue, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT
}

export async function getOrCreateTokenQueueToken(): Promise<string> {
  const db = getPrisma()
  const existing = await db.setting.findUnique({ where: { settingKey: 'token_queue_server_token' } })
  if (existing?.settingValue) return existing.settingValue
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'token_queue_server_token' },
    create: { settingKey: 'token_queue_server_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

export async function regenerateTokenQueueToken(): Promise<string> {
  const db = getPrisma()
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'token_queue_server_token' },
    create: { settingKey: 'token_queue_server_token', settingValue: token },
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

function getCheckInPagePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'token-queue', 'index.html')
    : join(__dirname, '../../resources/token-queue/index.html')
}

let cachedCheckInPageHtml: string | null | undefined = undefined

function getCheckInPageHtml(): string | null {
  if (cachedCheckInPageHtml !== undefined) return cachedCheckInPageHtml
  const pagePath = getCheckInPagePath()
  if (!existsSync(pagePath)) { cachedCheckInPageHtml = null; return null }
  cachedCheckInPageHtml = readFileSync(pagePath, 'utf-8')
  return cachedCheckInPageHtml
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
    const parts = url.pathname.split('/').filter(Boolean) // e.g. ['token-queue','<token>'] or ['api','token-queue','<token>','submit']
    const expectedToken = await getOrCreateTokenQueueToken()

    // GET /token-queue/:token — serves the static check-in page.
    if (req.method === 'GET' && parts[0] === 'token-queue' && parts.length === 2) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[1] !== expectedToken) { res.writeHead(404); res.end('Not found'); return }
      const html = getCheckInPageHtml()
      if (html === null) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'token-queue' && parts[3] === 'business' && parts.length === 4) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const info = await getBusinessDisplayInfo()
      sendJson(res, 200, { success: true, data: info })
      return
    }

    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'token-queue' && parts[3] === 'submit' && parts.length === 4) {
      if (isRateLimited(ip, 'submit', SUBMIT_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many check-ins submitted — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      if (parts[2] !== expectedToken) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }

      const body = await readBody(req)
      let parsed: { patientName?: string; age?: string; gender?: string; phone?: string; notes?: string }
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } })
        return
      }
      if (!parsed.patientName?.trim()) {
        sendJson(res, 400, { success: false, error: { message: 'Name is required.' } })
        return
      }
      const result = await createToken({
        patientName: parsed.patientName.trim(),
        age: parsed.age?.trim() || undefined,
        gender: parsed.gender || undefined,
        phone: parsed.phone?.trim() || undefined,
        notes: parsed.notes?.trim() || undefined
      })
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    res.writeHead(404); res.end('Not found')
  } catch (err) {
    logger.error('[TokenQueueServer] Request handling failed:', err)
    sendJson(res, 500, { success: false, error: { message: 'Internal error.' } })
  }
}

export async function ensureTokenQueueServerState(): Promise<void> {
  const enabled = await isModuleEnabled('token_queue')
  if (enabled && servers.length === 0) {
    await getOrCreateTokenQueueToken()
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
      logger.info(`[TokenQueueServer] Listening on port ${port} (${bindAddresses.join(', ')}).`)
    } catch (err) {
      logger.error('[TokenQueueServer] Failed to start:', err)
      await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve())))).catch(() => {})
      servers = []
      activePort = null
    }
  } else if (!enabled && servers.length > 0) {
    await stopTokenQueueServer()
  }
}

export async function stopTokenQueueServer(): Promise<void> {
  if (servers.length === 0) return
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))))
  servers = []
  activePort = null
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null }
  requestLog.clear()
  cachedCheckInPageHtml = undefined
  logger.info('[TokenQueueServer] Stopped.')
}
