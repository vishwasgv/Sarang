import { getPrisma } from '../database/db'

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

export async function listNotifications(filters?: { status?: string; limit?: number }) {
  try {
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

export async function createAppointmentReminder(appointmentId: string) {
  try {
    const db = getPrisma()
    const appt = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { customer: true, provider: { select: { fullName: true } } },
    })
    if (!appt) return { success: false, error: { code: 'NQ-006', message: 'Appointment not found.' } }

    const phone = appt.customer?.phone ?? null
    if (!phone) return { success: true, data: null }

    const name = appt.customerName ?? appt.customer?.customerName ?? 'Valued Client'
    const dateStr = appt.scheduledDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    const message = `Dear ${name}, this is a reminder for your appointment on ${dateStr} at ${appt.scheduledTime} for ${appt.serviceTitle}. Please arrive on time. Thank you! Powered by Sarang | www.aszurex.com`

    const link = await buildWhatsAppLink(phone, message)

    const schedule24h = new Date(appt.scheduledDate.getTime() - 24 * 60 * 60 * 1000)
    const schedule2h  = new Date(appt.scheduledDate.getTime() - 2  * 60 * 60 * 1000)
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
          scheduledFor: schedule24h,
          status: 'PENDING',
        },
      })
    }

    if (schedule2h > now) {
      const message2h = `Dear ${name}, your appointment is TODAY at ${appt.scheduledTime} for ${appt.serviceTitle}. See you soon! Powered by Sarang | www.aszurex.com`
      const link2h = await buildWhatsAppLink(phone, message2h)
      await db.notificationQueue.create({
        data: {
          appointmentId,
          customerId: appt.customerId ?? null,
          customerName: name,
          customerPhone: phone,
          notificationType: 'APPOINTMENT_REMINDER_2H',
          templateBody: message2h,
          whatsappLink: link2h,
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
