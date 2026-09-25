import { getPrisma } from '../database/db'
import { renderMessageTemplate } from './message-template.service'

// ISO country name / code → ITU dial code (no +)
const DIAL_CODES: Record<string, string> = {
  india: '91', in: '91',
  'united states': '1', usa: '1', us: '1',
  'united kingdom': '44', uk: '44', gb: '44',
  australia: '61', au: '61',
  canada: '1', ca: '1',
  uae: '971', 'united arab emirates': '971', ae: '971',
  'saudi arabia': '966', sa: '966',
  singapore: '65', sg: '65',
  malaysia: '60', my: '60',
  bahrain: '973', bh: '973',
  'new zealand': '64', nz: '64',
  'south africa': '27', za: '27',
  bangladesh: '880', bd: '880',
  pakistan: '92', pk: '92',
  nepal: '977', np: '977',
  'sri lanka': '94', lk: '94',
  germany: '49', de: '49',
  france: '33', fr: '33',
  italy: '39', it: '39',
  spain: '34', es: '34',
  japan: '81', jp: '81',
  china: '86', cn: '86',
  indonesia: '62', id: '62',
  thailand: '66', th: '66',
  philippines: '63', ph: '63',
  kenya: '254', ke: '254',
  nigeria: '234', ng: '234',
  ghana: '233', gh: '233',
  // More countries (ISO name and code -> dial code) so local-format numbers get the right prefix.
  ireland: '353', ie: '353', portugal: '351', pt: '351', netherlands: '31', nl: '31', belgium: '32', be: '32',
  switzerland: '41', ch: '41', austria: '43', at: '43', sweden: '46', se: '46', norway: '47', no: '47', denmark: '45', dk: '45',
  finland: '358', fi: '358', poland: '48', pl: '48', greece: '30', gr: '30', turkey: '90', tr: '90', 'türkiye': '90',
  russia: '7', ru: '7', ukraine: '380', ua: '380', romania: '40', ro: '40', hungary: '36', hu: '36', 'czech republic': '420', czechia: '420', cz: '420',
  israel: '972', il: '972', qatar: '974', qa: '974', kuwait: '965', kw: '965', oman: '968', om: '968', jordan: '962', jo: '962',
  lebanon: '961', lb: '961', iraq: '964', iq: '964', iran: '98', ir: '98', egypt: '20', eg: '20', morocco: '212', ma: '212',
  algeria: '213', dz: '213', tunisia: '216', tn: '216', ethiopia: '251', et: '251', tanzania: '255', tz: '255', uganda: '256', ug: '256',
  zambia: '260', zm: '260', zimbabwe: '263', zw: '263', mozambique: '258', mz: '258', botswana: '267', bw: '267', namibia: '264', na: '264',
  mauritius: '230', mu: '230', 'south korea': '82', korea: '82', kr: '82', vietnam: '84', vn: '84', 'hong kong': '852', hk: '852',
  taiwan: '886', tw: '886', myanmar: '95', mm: '95', cambodia: '855', kh: '855', laos: '856', la: '856', afghanistan: '93', af: '93',
  maldives: '960', mv: '960', bhutan: '975', bt: '975', mongolia: '976', mn: '976', kazakhstan: '7', kz: '7', uzbekistan: '998', uz: '998',
  mexico: '52', mx: '52', brazil: '55', br: '55', argentina: '54', ar: '54', chile: '56', cl: '56', colombia: '57', co: '57',
  peru: '51', pe: '51', venezuela: '58', ve: '58', ecuador: '593', ec: '593', uruguay: '598', uy: '598', 'costa rica': '506', cr: '506',
  panama: '507', pa: '507', 'dominican republic': '1', jamaica: '1', jm: '1', 'trinidad and tobago': '1', tt: '1',
  fiji: '679', fj: '679', 'papua new guinea': '675', pg: '675',
}

export async function buildWhatsAppLink(phone: string, message: string): Promise<string> {
  // Strip everything except digits and leading +
  const hasPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')

  let number: string
  if (hasPlus) {
    // +91 9876543210 → '919876543210'
    number = digits
  } else if (digits.startsWith('00')) {
    // 00919876543210 → '919876543210'
    number = digits.slice(2)
  } else {
    // Local format — try to prepend country dial code from business profile
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst({ select: { country: true } })
    const countryKey = (profile?.country ?? '').toLowerCase().trim()
    const dialCode = DIAL_CODES[countryKey]
    number = dialCode ? `${dialCode}${digits.replace(/^0/, '')}` : digits
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

// 2026-09-03 — real gap found across a full audit of every reminder message
// this app sends: ~17 of ~19 reminder-generating services built a message
// with no indication of WHICH business it's from (only 2 — hearing.service.ts
// and legal-case.service.ts — separately threaded a `firmName` through by
// hand). A customer receiving "Dear X, your membership expires..." with no
// sender identity is confusing and reads as spam, regardless of how good the
// rest of the message is. Centralized here (not duplicated per-service) so
// every reminder gets this for free, present and future — one
// `*BusinessName*` line prepended via WhatsApp's own bold-text markdown,
// a convention real WhatsApp Business accounts already use for their name.
//
// Deliberately NOT folded into buildWhatsAppLink() itself: that function is
// also share.service.ts's buildShareWhatsAppLink() primitive for the Share
// Bill/Report feature, whose messages already carry the business name via
// their own i18n template (see billing.shareWhatsAppMessage) — prepending
// here too would double it up. Reminder call sites use this wrapper
// instead; Share stays on the bare buildWhatsAppLink().
export async function buildReminderWhatsAppLink(phone: string, message: string): Promise<string> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { businessName: true } })
  const prefix = profile?.businessName ? `*${profile.businessName}*\n` : ''
  return buildWhatsAppLink(phone, `${prefix}${message}`)
}

/** Digits needed before a number can plausibly be reached on WhatsApp. */
const MIN_PHONE_DIGITS = 7

/**
 * Keeps the waiting list honest: reminders for a customer who asked not to be messaged are dismissed, and reminders
 * that have a WhatsApp link but no usable phone number are marked FAILED so they are not counted as ready to send (internal notes with no link are left alone). Safe to run any time.
 */
export async function sweepReminderQueue(): Promise<{ dismissed: number; failed: number }> {
  try {
    const db = getPrisma()
    const optedOut = await db.customer.findMany({ where: { doNotMessage: true }, select: { id: true } })
    let dismissed = 0
    if (optedOut.length > 0) {
      dismissed = (await db.notificationQueue.updateMany({
        where: { status: 'PENDING', customerId: { in: optedOut.map((c) => c.id) } },
        data: { status: 'DISMISSED' }
      })).count
    }
    const pending = await db.notificationQueue.findMany({ where: { status: 'PENDING', customerId: { not: null }, whatsappLink: { not: null } }, select: { id: true, customerPhone: true } })
    const badIds = pending.filter((r) => (r.customerPhone ?? '').replace(/\D/g, '').length < MIN_PHONE_DIGITS).map((r) => r.id)
    let failed = 0
    if (badIds.length > 0) failed = (await db.notificationQueue.updateMany({ where: { id: { in: badIds } }, data: { status: 'FAILED' } })).count
    return { dismissed, failed }
  } catch {
    return { dismissed: 0, failed: 0 }
  }
}

export async function listNotifications(filters?: { status?: string; limit?: number }) {
  try {
    await sweepReminderQueue()
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status

    const items = await db.notificationQueue.findMany({
      where,
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      take: filters?.limit ?? 100,
    })
    const STATUS_ORDER = ['PENDING', 'FAILED', 'SENT', 'DISMISSED']
    const sorted = [...items].sort((a, b) => {
      const pa = STATUS_ORDER.indexOf(a.status)
      const pb = STATUS_ORDER.indexOf(b.status)
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
    })
    return { success: true, data: sorted }
  } catch (err) {
    return { success: false, error: { code: 'NQ-001', message: err instanceof Error ? err.message : 'Could not list notifications.' } }
  }
}

export async function getUnsentCount() {
  try {
    await sweepReminderQueue()
    const db = getPrisma()
    const count = await db.notificationQueue.count({ where: { status: 'PENDING', scheduledFor: { lte: new Date() } } })
    return { success: true, data: count }
  } catch (err) {
    return { success: false, error: { code: 'NQ-002', message: err instanceof Error ? err.message : 'Could not get count.' } }
  }
}

export async function markNotificationSent(id: string) {
  try {
    const db = getPrisma()
    await db.notificationQueue.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'NQ-003', message: err instanceof Error ? err.message : 'Could not mark as sent.' } }
  }
}

export async function dismissNotification(id: string) {
  try {
    const db = getPrisma()
    await db.notificationQueue.update({ where: { id }, data: { status: 'DISMISSED' } })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'NQ-004', message: err instanceof Error ? err.message : 'Could not dismiss notification.' } }
  }
}

export async function generateWhatsAppLink(payload: {
  phone: string
  message: string
  notificationType: string
  appointmentId?: string
  customerId?: string
  customerName?: string
}) {
  try {
    const link = await buildWhatsAppLink(payload.phone, payload.message)

    // Persist to queue so it can be retrieved later
    const db = getPrisma()
    await db.notificationQueue.create({
      data: {
        appointmentId: payload.appointmentId ?? null,
        customerId: payload.customerId ?? null,
        customerName: payload.customerName ?? null,
        customerPhone: payload.phone,
        notificationType: payload.notificationType,
        templateBody: payload.message,
        whatsappLink: link,
        status: 'PENDING',
      },
    })

    return { success: true, data: { link } }
  } catch (err) {
    return { success: false, error: { code: 'NQ-005', message: err instanceof Error ? err.message : 'Could not generate WhatsApp link.' } }
  }
}

// An appointment's calendar date is stored at local midnight and its time as
// "HH:MM" (or "h:mm AM/PM"); reminders must count back from the real start.
export function appointmentStartTime(scheduledDate: Date, scheduledTime: string): Date {
  const start = new Date(scheduledDate)
  const m = /(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/.exec(scheduledTime ?? '')
  if (m) {
    let h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    const meridiem = m[3]?.toLowerCase()
    if (meridiem === 'pm' && h < 12) h += 12
    if (meridiem === 'am' && h === 12) h = 0
    start.setHours(h, min, 0, 0)
  }
  return start
}

const APPOINTMENT_REMINDER_TYPES = ['APPOINTMENT_REMINDER_24H', 'APPOINTMENT_REMINDER_2H']

/** Dismisses any still-pending reminders for an appointment (cancelled, completed or being rescheduled). */
export async function cancelAppointmentReminders(appointmentId: string): Promise<void> {
  try {
    const db = getPrisma()
    await db.notificationQueue.updateMany({
      where: { appointmentId, status: 'PENDING', notificationType: { in: APPOINTMENT_REMINDER_TYPES } },
      data: { status: 'DISMISSED' }
    })
  } catch { /* non-critical */ }
}

export async function createAppointmentReminder(appointmentId: string) {
  try {
    const db = getPrisma()
    const appt = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { customer: true, provider: { select: { fullName: true } } },
    })
    if (!appt) return { success: false, error: { code: 'NQ-006', message: 'Appointment not found.' } }

    // Always start from a clean slate so calling this again (a reschedule, or a
    // repeat call) replaces the old pending reminders instead of doubling them.
    await cancelAppointmentReminders(appointmentId)

    const phone = appt.customer?.phone ?? null
    if (!phone) {
      return { success: true, data: null, message: 'No phone number on file, so no WhatsApp reminder was created.' }
    }

    const name = appt.customerName ?? appt.customer?.customerName ?? 'Valued Client'
    const start = appointmentStartTime(appt.scheduledDate, appt.scheduledTime)
    const dateStr = start.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    const message = await renderMessageTemplate('APPOINTMENT_REMINDER_24H', { name, date: dateStr, time: appt.scheduledTime, serviceTitle: appt.serviceTitle })

    const link = await buildReminderWhatsAppLink(phone, message)

    const schedule24h = new Date(start.getTime() - 24 * 60 * 60 * 1000)
    const schedule2h  = new Date(start.getTime() - 2  * 60 * 60 * 1000)
    const now = new Date()

    if (schedule24h > now) {
      await db.notificationQueue.create({
        data: {
          appointmentId,
          customerId: appt.customerId ?? null,
          customerName: name,
          customerPhone: phone,
          notificationType: 'APPOINTMENT_REMINDER_24H',
          templateBody: message,
          whatsappLink: link,
          referenceKey: `APPOINTMENT_REMINDER_24H:${appointmentId}`,
          scheduledFor: schedule24h,
          status: 'PENDING',
        },
      })
    }

    if (schedule2h > now) {
      const message2h = await renderMessageTemplate('APPOINTMENT_REMINDER_2H', { name, time: appt.scheduledTime, serviceTitle: appt.serviceTitle })
      const link2h = await buildReminderWhatsAppLink(phone, message2h)
      await db.notificationQueue.create({
        data: {
          appointmentId,
          customerId: appt.customerId ?? null,
          customerName: name,
          customerPhone: phone,
          notificationType: 'APPOINTMENT_REMINDER_2H',
          templateBody: message2h,
          whatsappLink: link2h,
          referenceKey: `APPOINTMENT_REMINDER_2H:${appointmentId}`,
          scheduledFor: schedule2h,
          status: 'PENDING',
        },
      })
    }

    return { success: true, data: { message, link } }
  } catch (err) {
    return { success: false, error: { code: 'NQ-006', message: err instanceof Error ? err.message : 'Could not create reminder.' } }
  }
}

// One-time tidy-up for reminders queued by older versions, whose message text
// (and WhatsApp link) ended with an internal "[abc123]" reference token.
export async function cleanupLegacyReferenceTokens(): Promise<void> {
  try {
    const db = getPrisma()
    const rows = await db.notificationQueue.findMany({
      where: { status: 'PENDING', notificationType: { in: ['SHIPMENT_DISPATCHED', 'SHIPMENT_DELAYED', 'GRN_POSTED'] } },
      select: { id: true, templateBody: true, whatsappLink: true }
    })
    for (const r of rows) {
      const body = r.templateBody.replace(/\s\[[A-Za-z0-9-]{6,14}\]$/, '')
      const link = r.whatsappLink ? r.whatsappLink.replace(/%20%5B[A-Za-z0-9-]{6,14}%5D$/, '') : r.whatsappLink
      if (body !== r.templateBody || link !== r.whatsappLink) {
        await db.notificationQueue.update({ where: { id: r.id }, data: { templateBody: body, whatsappLink: link } })
      }
    }
  } catch { /* non-critical */ }
}
