import { randomBytes, randomInt } from 'crypto'
import { writeFile, unlink, mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { BrowserWindow } from 'electron'
import { getPrisma } from '../database/db'
import { attachDocument } from './document.service'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { secureTokenEquals } from '../security/token-compare'
import { searchCustomers } from './customer.service'
import { customerLedgerService } from './customer-ledger.service'
import { getPatientHistory, createAppointment } from './appointment.service'

const MAX_DOCTOR_PAD_PAGES = 5
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
 * REAL BUG found+fixed 2026-09-23: a single-page note used to save as a
 * plain PNG instead of going through the PDF pipeline below — so a
 * one-page prescription printed at whatever raw pixel size the tablet's
 * canvas happened to be (a phone screen and a large landscape tablet
 * produced differently-shaped images), never as a genuine A4 sheet, and
 * DocumentPanel's Print button only supported images anyway so a 2+ page
 * note (already a PDF) had NO in-app print path at all — only "Open", which
 * hands the doctor off to whatever PDF viewer is installed. Fixed both ends
 * at once: every note, 1 page or 5, now renders through the same
 * `renderPagesToPdf` A4 pipeline below (one real printable A4 page per drawn
 * page, hidden BrowserWindow + webContents.printToPDF, see
 * export.service.ts's exportToPdf for the same pattern used elsewhere), and
 * `documents:print` / DocumentPanel's Print button (see document.handler.ts)
 * now handle `application/pdf` too, not just images — so every prescription,
 * regardless of length, is both a real A4 document AND printable with one
 * click inside the app.
 */
export async function saveHandDrawnNote(appointmentId: string, images: string[]): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  if (!Array.isArray(images) || images.length === 0) {
    return { success: false, error: { code: 'DP-001', message: 'No drawing to save.' } }
  }
  if (images.length > MAX_DOCTOR_PAD_PAGES) {
    return { success: false, error: { code: 'DP-001', message: `A note can have at most ${MAX_DOCTOR_PAD_PAGES} pages.` } }
  }
  for (const image of images) {
    if (!PNG_DATA_URL_PATTERN.test(image)) {
      return { success: false, error: { code: 'DP-001', message: 'Invalid image data.' } }
    }
  }

  const db = getPrisma()
  const appointment = await db.appointment.findUnique({ where: { id: appointmentId }, select: { id: true } })
  if (!appointment) return { success: false, error: { code: 'DP-002', message: 'Appointment not found.' } }

  const tmpDir = await mkdtemp(join(tmpdir(), 'sarang-doctor-pad-'))
  const stamp = new Date().toLocaleString()
  try {
    const pdfPath = await renderPagesToPdf(images, tmpDir)
    const pageSuffix = images.length > 1 ? ` (${images.length} pages)` : ''
    const result = await attachDocument({
      sourcePath: pdfPath,
      fileName: `Handwritten note ${stamp}${pageSuffix}.pdf`,
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

// ─────────────────────────────────────────────────────────────────────────
// Doctor Tablet (2026-09-23) — founder ask: the tablet shouldn't be limited
// to today's queue + drawing a note. A doctor should be able to search any
// patient, see their whole record (medical info + every past visit +
// prescriptions), update medical info, and start a fresh visit — all from
// the same tablet — with the one deliberate exception of accounting/billing
// WRITES (no invoice/payment/credit-limit actions ever reach this LAN
// surface), while billing stays READ-ONLY (their invoice/ledger history).
// Every function below is read-only or narrowly-scoped-write on purpose —
// see doctor-pad-server.ts's own header for why this surface stays deliberately
// minimal despite the wider feature set: unauthenticated beyond a 4-digit
// PIN, so nothing here ever touches anything outside "this one patient's
// clinical + read-only billing record."
// ─────────────────────────────────────────────────────────────────────────

/** Clinic-wide patient search (name/phone) — trimmed to the minimum a results list needs. */
export async function searchPatientsForDoctorPad(query: string) {
  const res = await searchCustomers(query)
  if (!res.success) return res
  const rows = (res.data as Array<{ id: string; customerName: string; phone: string | null }>).map(
    (c) => ({ id: c.id, customerName: c.customerName, phone: c.phone })
  )
  return { success: true, data: rows }
}

/** Full patient chart: contact + medical info + every past visit (across all dates, not just today). */
export async function getPatientChartForDoctorPad(customerId: string) {
  const db = getPrisma()
  const [customer, profile] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true, customerName: true, phone: true, email: true,
        bloodGroup: true, allergies: true, chronicConditions: true, currentMedications: true,
        emergencyContactName: true, emergencyContactPhone: true,
      },
    }),
    db.businessProfile.findFirst({ select: { businessType: true } }),
  ])
  if (!customer) return { success: false, error: { code: 'DP-005', message: 'Patient not found.' } }
  const history = await getPatientHistory(customerId)
  return {
    success: true,
    data: {
      customer,
      // Vet Clinic: this Customer row is the pet's OWNER, not the patient —
      // the pet (a separate Pet record, not touched by this pass) is the
      // actual patient. Showing "allergies/blood group" on the owner would
      // be actively wrong, not just imprecise, so the tablet hides that
      // section entirely for this one vertical rather than mislabeling it.
      isVetClinic: profile?.businessType === 'VET_CLINIC',
      visits: history.success ? (history.data as { visits: unknown[] }).visits : [],
    },
  }
}

/**
 * Narrowly scoped to exactly the 6 medical fields — deliberately NOT a
 * general customer-update route. This LAN surface is authenticated by a
 * 4-digit PIN only; letting it touch address/credit-limit/tax fields would
 * be real scope creep on an intentionally minimal attack surface, for
 * capability nothing on the tablet actually needs.
 */
export async function updatePatientMedicalInfoFromDoctorPad(customerId: string, fields: {
  bloodGroup?: string; allergies?: string; chronicConditions?: string
  currentMedications?: string; emergencyContactName?: string; emergencyContactPhone?: string
}) {
  try {
    const db = getPrisma()
    const existing = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!existing) return { success: false, error: { code: 'DP-005', message: 'Patient not found.' } }
    const updated = await db.customer.update({
      where: { id: customerId },
      data: {
        bloodGroup: fields.bloodGroup?.trim() || null,
        allergies: fields.allergies?.trim() || null,
        chronicConditions: fields.chronicConditions?.trim() || null,
        currentMedications: fields.currentMedications?.trim() || null,
        emergencyContactName: fields.emergencyContactName?.trim() || null,
        emergencyContactPhone: fields.emergencyContactPhone?.trim() || null,
      },
      select: {
        id: true, bloodGroup: true, allergies: true, chronicConditions: true,
        currentMedications: true, emergencyContactName: true, emergencyContactPhone: true,
      },
    })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'DP-006', message: err instanceof Error ? err.message : 'Could not update medical information.' } }
  }
}

/**
 * READ-ONLY billing — this patient's ledger/invoice history, reusing the
 * exact same customerLedgerService.getLedger the desktop CustomerDetailScreen
 * shows. No write path exists anywhere on this LAN surface for it — "view
 * accounting and billing" was an explicit ask, but every accounting WRITE
 * (recording a payment, generating/voiding an invoice, changing a credit
 * limit) deliberately has zero route here.
 */
export async function getPatientBillingForDoctorPad(customerId: string) {
  return customerLedgerService.getLedger(customerId, { limit: 30 })
}

/**
 * Every document (hand-drawn prescription, or anything else staff attached)
 * across ALL of this patient's past visits, newest first — lets the tablet
 * show "here's everything on file for this patient", not just today's note.
 */
export async function listPatientDocumentsForDoctorPad(customerId: string) {
  const db = getPrisma()
  const visits = await db.appointment.findMany({ where: { customerId }, select: { id: true, scheduledDate: true, serviceTitle: true } })
  if (visits.length === 0) return { success: true, data: [] }
  const visitById = new Map(visits.map((v) => [v.id, v]))
  const docs = await db.document.findMany({
    where: { entityType: 'APPOINTMENT', entityId: { in: visits.map((v) => v.id) } },
    orderBy: { createdAt: 'desc' },
  })
  return {
    success: true,
    data: docs.map((d) => ({
      id: d.id, fileName: d.fileName, mimeType: d.mimeType, createdAt: d.createdAt,
      visitDate: visitById.get(d.entityId)?.scheduledDate ?? null,
      visitService: visitById.get(d.entityId)?.serviceTitle ?? null,
    })),
  }
}

/**
 * Streams a document's raw file for the tablet's browser to open directly
 * (a phone/tablet browser renders PDFs/images natively — no Electron
 * shell.openPath available here, this is a plain LAN webpage). Deliberately
 * restricted to entityType==='APPOINTMENT' — the one document kind this
 * surface has any business serving; an invoice/report PDF attached
 * elsewhere in the app must never be fetchable through this LAN route.
 */
export async function getDoctorPadDocumentFile(documentId: string) {
  const db = getPrisma()
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { filePath: true, fileName: true, mimeType: true, entityType: true } })
  if (!doc || doc.entityType !== 'APPOINTMENT') return { success: false, error: { code: 'DP-007', message: 'Document not found.' } }
  return { success: true, data: { filePath: doc.filePath, fileName: doc.fileName, mimeType: doc.mimeType } }
}

/**
 * Starts a fresh visit for a patient right from the tablet — "fresh visit +
 * prescription" for a returning patient, without going back to the front
 * desk. Scheduled for right now (today, current time); a doctor who wants a
 * genuinely future-dated follow-up still books that normally on the desktop
 * app, same as any other appointment.
 */
export async function createVisitFromDoctorPad(payload: { customerId: string; providerId: string; reason: string }) {
  const now = new Date()
  const scheduledDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const scheduledTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return createAppointment({
    customerId: payload.customerId,
    providerId: payload.providerId,
    serviceTitle: payload.reason.trim() || 'Consultation',
    scheduledDate,
    scheduledTime,
    durationMinutes: 15,
  })
}
