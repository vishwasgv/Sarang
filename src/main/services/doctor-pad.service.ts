import { randomBytes, randomInt } from 'crypto'
import { writeFile, unlink, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { BrowserWindow } from 'electron'
import { getPrisma } from '../database/db'
import { attachDocument } from './document.service'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { secureTokenEquals } from '../security/token-compare'

const MAX_DOCTOR_PAD_PAGES = 3
// The capture group is restricted to the actual base64 alphabet (not just
// "anything after the prefix") — renderPagesToPdf interpolates this value
// raw into an <img src="..."> attribute for the multi-page PDF render, so a
// request crafted directly against the save-drawing HTTP endpoint (not the
// real tablet client, which only ever sends genuine canvas.toDataURL()
// output) could otherwise break out of the attribute and inject markup/JS
// that runs inside the hidden BrowserWindow used for printToPDF.
const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/

// Founder idea (2026-09-15) — doctors hate typing a diagnosis/prescription
// mid-consultation. A tablet on the clinic's own WiFi connects once (scan a
// QR OR type a short PIN — founder explicitly asked for both, scanning a QR
// for every single patient all day is clumsy) and from then on the tablet's
// own localStorage remembers which provider it belongs to, showing today's
// queue with zero further scanning or typing — tap a patient, draw the note
// by hand, save. The drawing attaches to the Appointment itself via the same
// generic Document attachment system every other entity type already uses
// (see saveHandDrawnNote's own comment for why APPOINTMENT, not VISIT_NOTE),
// so it's immediately viewable through the same DocumentPanel UI everything
// else already uses. Same LAN-only, no-cloud-no-sync trust model as
// qr-order-server.ts/token-queue-server.ts — a second device viewing/writing
// to the same single Sarang install, not multi-device sync (Sarang stays
// single-install-per-key).

export async function getOrCreateDoctorPadToken(): Promise<string> {
  const db = getPrisma()
  const existing = await db.setting.findUnique({ where: { settingKey: 'doctor_pad_server_token' } })
  if (existing?.settingValue) return existing.settingValue
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'doctor_pad_server_token' },
    create: { settingKey: 'doctor_pad_server_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

export async function regenerateDoctorPadToken(): Promise<string> {
  const db = getPrisma()
  const token = randomBytes(12).toString('hex')
  await db.setting.upsert({
    where: { settingKey: 'doctor_pad_server_token' },
    create: { settingKey: 'doctor_pad_server_token', settingValue: token },
    update: { settingValue: token }
  })
  return token
}

function pinSettingKey(providerId: string): string {
  return `doctor_pad_pin_${providerId}`
}

/** A short, memorable 4-digit PIN per provider — the typed alternative to scanning the QR, so a doctor can connect a new/shared tablet without a camera. */
export async function getOrCreateProviderPin(providerId: string): Promise<string> {
  const db = getPrisma()
  const key = pinSettingKey(providerId)
  const existing = await db.setting.findUnique({ where: { settingKey: key } })
  if (existing?.settingValue) return existing.settingValue
  const pin = String(randomInt(1000, 10000))
  await db.setting.upsert({ where: { settingKey: key }, create: { settingKey: key, settingValue: pin }, update: { settingValue: pin } })
  return pin
}

export async function regenerateProviderPin(providerId: string): Promise<string> {
  const db = getPrisma()
  const pin = String(randomInt(1000, 10000))
  await db.setting.upsert({ where: { settingKey: pinSettingKey(providerId) }, create: { settingKey: pinSettingKey(providerId), settingValue: pin }, update: { settingValue: pin } })
  return pin
}

/** Resolves a typed PIN back to a providerId — scans every eligible provider's PIN setting (a clinic has a handful of doctors at most, so a full scan is cheap and needs no extra index/table). */
export async function resolveProviderPin(pin: string): Promise<string | null> {
  const db = getPrisma()
  const rows = await db.setting.findMany({ where: { settingKey: { startsWith: 'doctor_pad_pin_' } } })
  const row = rows.find((r) => secureTokenEquals(pin, r.settingValue))
  if (!row) return null
  return row.settingKey.slice('doctor_pad_pin_'.length)
}

export async function getProviderDisplayName(providerId: string): Promise<string | null> {
  const db = getPrisma()
  const employee = await db.employee.findUnique({ where: { id: providerId }, select: { fullName: true } })
  return employee?.fullName ?? null
}

/** Every active provider eligible to use Doctor Pad — for the desktop's own "generate a link/PIN for..." picker. */
export async function listDoctorPadEligibleProviders() {
  const db = getPrisma()
  const providerIds = await db.appointment.findMany({
    where: { providerId: { not: null } },
    distinct: ['providerId'],
    select: { providerId: true },
    orderBy: { scheduledDate: 'desc' },
    take: 200
  })
  const ids = providerIds.map((p) => p.providerId).filter((id): id is string => !!id)
  if (ids.length === 0) return []
  const employees = await db.employee.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } })
  return employees
}

/** Today's appointments for one provider — the "queue" a bookmarked tablet shows. */
export async function listTodaysAppointmentsForProvider(providerId: string) {
  const db = getPrisma()
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const appointments = await db.appointment.findMany({
    where: {
      providerId,
      scheduledDate: { gte: parseLocalDateStart(todayStr), lte: parseLocalDateEnd(todayStr) },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] }
    },
    select: { id: true, customerName: true, scheduledTime: true, serviceTitle: true, status: true },
    orderBy: { scheduledTime: 'asc' }
  })
  return appointments
}

/**
 * Saves the doctor's hand-drawn note (one PNG data URL per page, from the
 * tablet's canvas) as an attachment on the appointment itself — deliberately
 * `entityType: 'APPOINTMENT'`, not `'VISIT_NOTE'`. The 5 eligible verticals
 * don't all share one clinical-notes model (Dental Clinic uses its own
 * tooth-chart system, not VisitNote), but every one of them has a real
 * Appointment row — attaching there works identically across all 5 with no
 * per-vertical branching, and Appointment already has a viewer wired in
 * (AppointmentsScreen.tsx's <DocumentPanel entityType="APPOINTMENT">, used
 * today for Beauty Salon's before/after photos) that the same
 * `<DocumentPanel>` component added to each clinic screen can reuse as-is.
 *
 * A prescription can genuinely run to 2-3 pages, so a single page saves as a
 * plain image (matches every other image-attachment flow in the app,
 * including DocumentPanel's own Print button, which only supports images
 * today), while more than one page is combined into a single multi-page PDF
 * — one real printable page per drawn page, built the same way every other
 * "generate a PDF from HTML" flow in this app does (hidden BrowserWindow +
 * webContents.printToPDF, see export.service.ts's exportToPdf) — rather than
 * saving 2-3 separate loose images a doctor would have to reassemble
 * themselves.
 */
export async function saveHandDrawnNote(appointmentId: string, images: string[]): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  if (!Array.isArray(images) || images.length === 0) {
    return { success: false, error: { code: 'DP-001', message: 'No drawing to save.' } }
  }
  if (images.length > MAX_DOCTOR_PAD_PAGES) {
    return { success: false, error: { code: 'DP-001', message: `A note can have at most ${MAX_DOCTOR_PAD_PAGES} pages.` } }
  }
  const decoded: string[] = []
  for (const image of images) {
    const match = PNG_DATA_URL_PATTERN.exec(image)
    if (!match) return { success: false, error: { code: 'DP-001', message: 'Invalid image data.' } }
    decoded.push(match[1])
  }

  const db = getPrisma()
  const appointment = await db.appointment.findUnique({ where: { id: appointmentId }, select: { id: true } })
  if (!appointment) return { success: false, error: { code: 'DP-002', message: 'Appointment not found.' } }

  const tmpDir = await mkdtemp(join(tmpdir(), 'sarang-doctor-pad-'))
  const stamp = new Date().toLocaleString()
  try {
    if (images.length === 1) {
      const tmpPath = join(tmpDir, `note-${Date.now()}.png`)
      await writeFile(tmpPath, Buffer.from(decoded[0], 'base64'))
      // No logged-in user on this LAN self-service write (same as
      // token-queue.service.ts's createToken) — `userId` is a real FK to
      // User.id (onDelete: Restrict), so a fake placeholder string here
      // would fail the FK constraint on every save and silently trip the
      // Dashboard's "audit log failure" alert instead of recording the
      // entry at all.
      const result = await attachDocument({
        sourcePath: tmpPath,
        fileName: `Handwritten note ${stamp}.png`,
        entityType: 'APPOINTMENT',
        entityId: appointmentId,
        notes: 'Captured via Doctor Pad (tablet)'
      })
      if (!result.success) return { success: false, error: { code: 'DP-004', message: 'Could not save the drawing.' } }
      return { success: true }
    }

    const pdfPath = await renderPagesToPdf(images, tmpDir)
    const result = await attachDocument({
      sourcePath: pdfPath,
      fileName: `Handwritten note ${stamp} (${images.length} pages).pdf`,
      entityType: 'APPOINTMENT',
      entityId: appointmentId,
      notes: 'Captured via Doctor Pad (tablet)'
    })
    if (!result.success) return { success: false, error: { code: 'DP-004', message: 'Could not save the drawing.' } }
    return { success: true }
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function renderPagesToPdf(images: string[], tmpDir: string): Promise<string> {
  const pagesHtml = images
    .map((src) => `<div style="width:100%;height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always;box-sizing:border-box;padding:24px"><img src="${src}" style="max-width:100%;max-height:100%"></div>`)
    .join('')
  const html = `<!doctype html><html><body style="margin:0">${pagesHtml}</body></html>`
  const htmlPath = join(tmpDir, `note-${Date.now()}.html`)
  await writeFile(htmlPath, html, 'utf-8')

  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } })
  try {
    await win.loadURL(`file://${htmlPath.replace(/\\/g, '/')}`)
    const pdfBuf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })
    const pdfPath = join(tmpDir, `note-${Date.now()}.pdf`)
    await writeFile(pdfPath, pdfBuf)
    return pdfPath
  } finally {
    win.destroy()
    await unlink(htmlPath).catch(() => {})
  }
}
