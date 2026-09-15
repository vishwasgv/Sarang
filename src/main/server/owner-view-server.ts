import * as http from 'http'
import { networkInterfaces } from 'os'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getPrisma } from '../database/db'
import { isModuleEnabled } from '../services/industry-template.service'
import {
  getOrCreateOwnerViewToken, getOrCreateOwnerViewAccessCode,
  listOwnerViewReports, runOwnerViewReport, getOwnerViewSummary
} from '../services/owner-view.service'
import { getBusinessDisplayInfo } from '../services/field-order.service'
import { logger } from '../utils/logger'
import { secureTokenEquals } from '../security/token-compare'

// 2026-09-16 — Owner View (Phase 72, built on explicit founder go-ahead).
// Structurally cloned from doctor-pad-server.ts / kitchen-display-server.ts
// — see those files' headers for the full shared threat-model writeup: one
// listener per LAN IPv4 address + loopback (never the wildcard, never a
// virtual adapter), independent GET/code rate limits per IP, Origin-must-
// equal-Host CSRF check on the one POST route this server has.
//
// The one structural difference from every sibling LAN server: this one has
// NO write route at all, not even a narrow one. Every GET handler below
// calls straight into owner-view.service.ts, which itself only ever calls
// reportService/getDashboardKpis functions — this is a hard, permanent
// constraint from the original Phase 72 spec, not a v1 shortcut. If a write
// route is ever proposed for this file in the future, that is a scope
// change requiring the same explicit founder sign-off the original
// read-only decision required — never add one silently.

const DEFAULT_PORT = 8425 // one above doctor-pad-server.ts's 8424
const RATE_LIMIT_WINDOW_MS = 60_000
const GET_RATE_LIMIT_MAX_REQUESTS = 30
const CODE_RATE_LIMIT_MAX_REQUESTS = 10

let servers: http.Server[] = []
let activePort: number | null = null
const requestLog = new Map<string, number[]>()
let sweepInterval: ReturnType<typeof setInterval> | null = null

export function getOwnerViewServerStatus(): { running: boolean; port: number | null; lanUrls: string[] } {
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
  const setting = await db.setting.findUnique({ where: { settingKey: 'owner_view_server_port' } })
  const parsed = setting ? parseInt(setting.settingValue, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT
}

function isRateLimited(ip: string, bucket: 'get' | 'code', max: number): boolean {
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

function getPagePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'owner-view', 'index.html')
    : join(__dirname, '../../resources/owner-view/index.html')
}

let cachedPageHtml: string | null | undefined = undefined

function getPageHtml(): string | null {
  if (cachedPageHtml !== undefined) return cachedPageHtml
  const pagePath = getPagePath()
  if (!existsSync(pagePath)) { cachedPageHtml = null; return null }
  cachedPageHtml = readFileSync(pagePath, 'utf-8')
  return cachedPageHtml
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

async function readBody(req: http.IncomingMessage, maxBytes = 2_000): Promise<string> {
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
    // e.g. ['owner-view','<token>'] or ['api','owner-view','<token>','summary']
    const parts = url.pathname.split('/').filter(Boolean)
    const expectedToken = await getOrCreateOwnerViewToken()

    // GET /owner-view/:token — serves the static SPA page.
    if (req.method === 'GET' && parts[0] === 'owner-view' && parts.length === 2) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[1], expectedToken)) { res.writeHead(404); res.end('Not found'); return }
      const html = getPageHtml()
      if (html === null) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    // GET /owner-view (no token) — same static page, bare, so a brand-new
    // phone with no bookmark yet can reach the "enter the access code" state.
    if (req.method === 'GET' && parts[0] === 'owner-view' && parts.length === 1) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      const html = getPageHtml()
      if (html === null) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    // POST /api/owner-view/resolve-code — typed alternative to scanning the
    // QR, same convention as Doctor Pad's /resolve-pin.
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'owner-view' && parts[2] === 'resolve-code' && parts.length === 3) {
      if (isRateLimited(ip, 'code', CODE_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many attempts — please wait a moment and try again.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      const body = await readBody(req)
      let parsed: { code?: string }
      try { parsed = JSON.parse(body) } catch { sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } }); return }
      const code = (parsed.code ?? '').trim()
      if (!/^\d{6}$/.test(code)) { sendJson(res, 400, { success: false, error: { message: 'Enter the 6-digit code shown in Settings.' } }); return }
      const expectedCode = await getOrCreateOwnerViewAccessCode()
      if (!secureTokenEquals(code, expectedCode)) { sendJson(res, 404, { success: false, error: { message: 'That code was not recognized.' } }); return }
      sendJson(res, 200, { success: true, data: { token: expectedToken } })
      return
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'owner-view' && parts.length >= 4) {
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }

      // GET /api/owner-view/:token/business
      if (parts[3] === 'business' && parts.length === 4) {
        const info = await getBusinessDisplayInfo()
        sendJson(res, 200, { success: true, data: info })
        return
      }

      // GET /api/owner-view/:token/summary — the Dashboard KPI set.
      if (parts[3] === 'summary' && parts.length === 4) {
        const data = await getOwnerViewSummary()
        sendJson(res, 200, { success: true, data })
        return
      }

      // GET /api/owner-view/:token/reports — the report catalog.
      if (parts[3] === 'reports' && parts.length === 4) {
        sendJson(res, 200, { success: true, data: listOwnerViewReports() })
        return
      }

      // GET /api/owner-view/:token/reports/:reportId?dateFrom=&dateTo=
      if (parts[3] === 'reports' && parts.length === 5) {
        const dateFrom = url.searchParams.get('dateFrom') || undefined
        const dateTo = url.searchParams.get('dateTo') || undefined
        const result = await runOwnerViewReport(parts[4], { dateFrom, dateTo })
        sendJson(res, result.success ? 200 : 400, result)
        return
      }
    }

    res.writeHead(404); res.end('Not found')
  } catch (err) {
    logger.error('[OwnerViewServer] Request handling failed:', err)
    sendJson(res, 500, { success: false, error: { message: 'Internal error.' } })
  }
}

export async function ensureOwnerViewServerState(): Promise<void> {
  const enabled = await isModuleEnabled('owner_view')
  if (enabled && servers.length === 0) {
    await getOrCreateOwnerViewToken()
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
      logger.info(`[OwnerViewServer] Listening on port ${port} (${bindAddresses.join(', ')}).`)
    } catch (err) {
      logger.error('[OwnerViewServer] Failed to start:', err)
      await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve())))).catch(() => {})
      servers = []
      activePort = null
    }
  } else if (!enabled && servers.length > 0) {
    await stopOwnerViewServer()
  }
}

export async function stopOwnerViewServer(): Promise<void> {
  if (servers.length === 0) return
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))))
  servers = []
  activePort = null
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null }
  requestLog.clear()
  cachedPageHtml = undefined
  logger.info('[OwnerViewServer] Stopped.')
}
