import * as http from 'http'
import { networkInterfaces } from 'os'
import { readFileSync, existsSync, createReadStream } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getPrisma } from '../database/db'
import { isModuleEnabled } from '../services/industry-template.service'
import {
  getOrCreateDoctorPadToken, resolveProviderPin, getProviderDisplayName,
  listTodaysAppointmentsForProvider, saveHandDrawnNote,
  searchPatientsForDoctorPad, getPatientChartForDoctorPad, updatePatientMedicalInfoFromDoctorPad,
  getPatientBillingForDoctorPad, createVisitFromDoctorPad,
  listPatientDocumentsForDoctorPad, getDoctorPadDocumentFile
} from '../services/doctor-pad.service'
import { getBusinessDisplayInfo } from '../services/field-order.service'
import { logger } from '../utils/logger'
import { secureTokenEquals } from '../security/token-compare'

// Structurally cloned from token-queue-server.ts — see that file's header
// (and doctor-pad.service.ts's) for the full shared threat-model writeup.
// One difference from every sibling LAN server: this one has a genuine
// write payload worth abuse-limiting harder (a full PNG canvas image, not a
// short JSON form), so its body-size cap and submit rate limit are both
// tighter accordingly.

const DEFAULT_PORT = 8424 // one above token-queue-server.ts's 8423
const RATE_LIMIT_WINDOW_MS = 60_000
const GET_RATE_LIMIT_MAX_REQUESTS = 40
const SUBMIT_RATE_LIMIT_MAX_REQUESTS = 20
const PIN_RATE_LIMIT_MAX_REQUESTS = 10 // deliberately low — this is the one route brute-forceable (4-digit PIN), so it gets its own strict bucket distinct from the general submit bucket
const MAX_DRAWING_BYTES = 15_000_000 // ~15MB — a note can be up to 5 pages, ~3MB budget per single-color-ish canvas PNG page, far below what would meaningfully burden the main process

let servers: http.Server[] = []
let activePort: number | null = null
const requestLog = new Map<string, number[]>()
let sweepInterval: ReturnType<typeof setInterval> | null = null

export function getDoctorPadServerStatus(): { running: boolean; port: number | null; lanUrls: string[] } {
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
  const setting = await db.setting.findUnique({ where: { settingKey: 'doctor_pad_server_port' } })
  const parsed = setting ? parseInt(setting.settingValue, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT
}

function isRateLimited(ip: string, bucket: 'submit' | 'get' | 'pin', max: number): boolean {
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

function getPadPagePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'doctor-pad', 'index.html')
    : join(__dirname, '../../resources/doctor-pad/index.html')
}

let cachedPadPageHtml: string | null | undefined = undefined

function getPadPageHtml(): string | null {
  if (cachedPadPageHtml !== undefined) return cachedPadPageHtml
  const pagePath = getPadPagePath()
  if (!existsSync(pagePath)) { cachedPadPageHtml = null; return null }
  cachedPadPageHtml = readFileSync(pagePath, 'utf-8')
  return cachedPadPageHtml
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

async function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
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
    // e.g. ['doctor-pad','<token>'] or ['doctor-pad','<token>','<providerId>'] or ['api','doctor-pad','<token>',...]
    const parts = url.pathname.split('/').filter(Boolean)
    const expectedToken = await getOrCreateDoctorPadToken()

    // GET /doctor-pad/:token[/:providerId] — serves the static SPA page for
    // either the generic landing (scan-or-PIN) state or a direct per-provider
    // deep link, depending on the URL — the page's own JS reads the URL.
    if (req.method === 'GET' && parts[0] === 'doctor-pad' && parts.length >= 2 && parts.length <= 3) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[1], expectedToken)) { res.writeHead(404); res.end('Not found'); return }
      const html = getPadPageHtml()
      if (html === null) { res.writeHead(404); res.end('Not found'); return }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'business' && parts.length === 4) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const info = await getBusinessDisplayInfo()
      sendJson(res, 200, { success: true, data: info })
      return
    }

    // POST /api/doctor-pad/:token/resolve-pin — the typed alternative to
    // scanning a QR (founder was explicit: scanning every single patient
    // visit, all day, is clumsy). Strictly rate-limited since a 4-digit PIN
    // is genuinely brute-forceable given enough attempts.
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'resolve-pin' && parts.length === 4) {
      if (isRateLimited(ip, 'pin', PIN_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many attempts — please wait a moment and ask the front desk for your PIN.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const body = await readBody(req, 2_000)
      let parsed: { pin?: string }
      try { parsed = JSON.parse(body) } catch { sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } }); return }
      const pin = (parsed.pin ?? '').trim()
      if (!/^\d{4}$/.test(pin)) { sendJson(res, 400, { success: false, error: { message: 'Enter the 4-digit PIN shown on the clinic computer.' } }); return }
      const providerId = await resolveProviderPin(pin)
      if (!providerId) { sendJson(res, 404, { success: false, error: { message: 'That PIN was not recognized. Ask the front desk for the current one.' } }); return }
      const providerName = await getProviderDisplayName(providerId)
      sendJson(res, 200, { success: true, data: { providerId, providerName } })
      return
    }

    // GET /api/doctor-pad/:token/:providerId/queue — today's appointments.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[4] === 'queue' && parts.length === 5) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const providerId = parts[3]
      const [providerName, queue] = await Promise.all([getProviderDisplayName(providerId), listTodaysAppointmentsForProvider(providerId)])
      if (!providerName) { sendJson(res, 404, { success: false, error: { message: 'Provider not found.' } }); return }
      sendJson(res, 200, { success: true, data: { providerName, queue } })
      return
    }

    // POST /api/doctor-pad/:token/:appointmentId/save-drawing
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[4] === 'save-drawing' && parts.length === 5) {
      if (isRateLimited(ip, 'submit', SUBMIT_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const appointmentId = parts[3]
      let body: string
      try {
        body = await readBody(req, MAX_DRAWING_BYTES)
      } catch {
        sendJson(res, 413, { success: false, error: { message: 'Drawing is too large to save.' } })
        return
      }
      let parsed: { images?: string[] }
      try { parsed = JSON.parse(body) } catch { sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } }); return }
      if (!parsed.images || !Array.isArray(parsed.images) || parsed.images.length === 0) {
        sendJson(res, 400, { success: false, error: { message: 'No drawing to save.' } })
        return
      }
      const result = await saveHandDrawnNote(appointmentId, parsed.images)
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    // ── Doctor Tablet (2026-09-23) — patient search/chart/billing-view/
    // medical-info-edit/new-visit. See doctor-pad.service.ts's own header
    // comment on this section for the "read-only or narrowly-scoped-write,
    // no accounting writes ever" boundary these routes enforce.

    // GET /api/doctor-pad/:token/patients?q=... — clinic-wide search.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'patients' && parts.length === 4) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const q = (url.searchParams.get('q') ?? '').trim()
      if (q.length < 2) { sendJson(res, 200, { success: true, data: [] }); return }
      const result = await searchPatientsForDoctorPad(q)
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    // GET /api/doctor-pad/:token/patients/:customerId — full chart.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'patients' && parts.length === 5) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const result = await getPatientChartForDoctorPad(parts[4])
      sendJson(res, result.success ? 200 : 404, result)
      return
    }

    // GET /api/doctor-pad/:token/patients/:customerId/billing — READ-ONLY.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'patients' && parts[5] === 'billing' && parts.length === 6) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const result = await getPatientBillingForDoctorPad(parts[4])
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    // GET /api/doctor-pad/:token/patients/:customerId/documents — every
    // document across every past visit for this patient, newest first.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'patients' && parts[5] === 'documents' && parts.length === 6) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const result = await listPatientDocumentsForDoctorPad(parts[4])
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    // GET /api/doctor-pad/:token/documents/:documentId/file — streams the
    // raw file so the tablet's own browser can render/print/save it.
    if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'documents' && parts[5] === 'file' && parts.length === 6) {
      if (isRateLimited(ip, 'get', GET_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const fileResult = await getDoctorPadDocumentFile(parts[4])
      if (!fileResult.success || !fileResult.data || !existsSync(fileResult.data.filePath)) {
        res.writeHead(404); res.end('Not found'); return
      }
      res.writeHead(200, {
        'Content-Type': fileResult.data.mimeType,
        'Content-Disposition': `inline; filename="${fileResult.data.fileName.replace(/"/g, '')}"`,
      })
      createReadStream(fileResult.data.filePath).pipe(res)
      return
    }

    // POST /api/doctor-pad/:token/patients/:customerId/medical
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[3] === 'patients' && parts[5] === 'medical' && parts.length === 6) {
      if (isRateLimited(ip, 'submit', SUBMIT_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      let body: string
      try { body = await readBody(req, 10_000) } catch { sendJson(res, 413, { success: false, error: { message: 'Request too large.' } }); return }
      let fields: Record<string, string>
      try { fields = JSON.parse(body) } catch { sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } }); return }
      const result = await updatePatientMedicalInfoFromDoctorPad(parts[4], fields)
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    // POST /api/doctor-pad/:token/:providerId/new-visit — starts a fresh
    // visit for an existing patient, right now, from the tablet.
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'doctor-pad' && parts[4] === 'new-visit' && parts.length === 5) {
      if (isRateLimited(ip, 'submit', SUBMIT_RATE_LIMIT_MAX_REQUESTS)) { sendJson(res, 429, { success: false, error: { message: 'Too many requests — please wait a moment.' } }); return }
      if (!isOriginAllowed(req)) { sendJson(res, 403, { success: false, error: { message: 'Request origin not allowed.' } }); return }
      if (!secureTokenEquals(parts[2], expectedToken)) { sendJson(res, 403, { success: false, error: { message: 'Not authorized.' } }); return }
      const providerId = parts[3]
      let body: string
      try { body = await readBody(req, 2_000) } catch { sendJson(res, 413, { success: false, error: { message: 'Request too large.' } }); return }
      let parsed: { customerId?: string; reason?: string }
      try { parsed = JSON.parse(body) } catch { sendJson(res, 400, { success: false, error: { message: 'Invalid request.' } }); return }
      if (!parsed.customerId) { sendJson(res, 400, { success: false, error: { message: 'A patient is required.' } }); return }
      const result = await createVisitFromDoctorPad({ customerId: parsed.customerId, providerId, reason: parsed.reason ?? '' })
      sendJson(res, result.success ? 200 : 400, result)
      return
    }

    res.writeHead(404); res.end('Not found')
  } catch (err) {
    logger.error('[DoctorPadServer] Request handling failed:', err)
    sendJson(res, 500, { success: false, error: { message: 'Internal error.' } })
  }
}

async function anyEligibleModuleEnabled(): Promise<boolean> {
  // Doctor Pad is offered across 5 verticals that don't share one module
  // flag — matches the multi-module OR-check pattern already used wherever
  // this codebase gates a cross-vertical feature (see e.g. token_queue's own
  // callers). 'doctor_pad' is added to each of the 5 eligible verticals'
  // module list in industry-template.service.ts, so a single isModuleEnabled
  // check is sufficient — no per-vertical branching needed here.
  return isModuleEnabled('doctor_pad')
}

export async function ensureDoctorPadServerState(): Promise<void> {
  const enabled = await anyEligibleModuleEnabled()
  if (enabled && servers.length === 0) {
    await getOrCreateDoctorPadToken()
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
      logger.info(`[DoctorPadServer] Listening on port ${port} (${bindAddresses.join(', ')}).`)
    } catch (err) {
      logger.error('[DoctorPadServer] Failed to start:', err)
      await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve())))).catch(() => {})
      servers = []
      activePort = null
    }
  } else if (!enabled && servers.length > 0) {
    await stopDoctorPadServer()
  }
}

export async function stopDoctorPadServer(): Promise<void> {
  if (servers.length === 0) return
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))))
  servers = []
  activePort = null
  if (sweepInterval) { clearInterval(sweepInterval); sweepInterval = null }
  requestLog.clear()
  cachedPadPageHtml = undefined
  logger.info('[DoctorPadServer] Stopped.')
}
