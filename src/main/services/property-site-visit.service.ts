import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'

// Phase 58 §2 — Real Estate: structured site-visit scheduling with feedback
// capture, replacing PropertyInquiry.status's bare "SITE_VISIT_SCHEDULED"
// label with a real scheduled-visit record.

export async function listPropertySiteVisits(inquiryId: string) {
  try {
    const db = getPrisma()
    const items = await db.propertySiteVisit.findMany({ where: { inquiryId }, orderBy: { scheduledDate: 'desc' } })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'PSV-001', message: err instanceof Error ? err.message : 'Could not list site visits.' } }
  }
}

export async function schedulePropertySiteVisit(payload: {
  inquiryId: string
  scheduledDate: string
  scheduledTime?: string
}) {
  try {
    if (!payload.scheduledDate) return { success: false, error: { code: 'PSV-002', message: 'Scheduled date is required.' } }
    const db = getPrisma()
    const inquiry = await db.propertyInquiry.findUnique({
      where: { id: payload.inquiryId },
      include: {
        buyer: { select: { id: true, customerName: true, phone: true } },
        property: { select: { location: true, propertyType: true } },
      },
    })
    if (!inquiry) return { success: false, error: { code: 'PSV-003', message: 'Inquiry not found.' } }

    const visit = await db.propertySiteVisit.create({
      data: {
        inquiryId: payload.inquiryId,
        scheduledDate: new Date(payload.scheduledDate),
        scheduledTime: payload.scheduledTime ?? null,
        status: 'SCHEDULED',
      },
    })

    await db.propertyInquiry.update({ where: { id: payload.inquiryId }, data: { status: 'SITE_VISIT_SCHEDULED' } })

    // Reuses the SAME notificationQueue/buildWhatsAppLink mechanism every
    // other reminder in this codebase already uses (hearings, compliance
    // deadlines, appointments) — a single reminder 1 day before, since
    // property site visits are typically scheduled with days not months of
    // lead time (unlike a hearing or a statutory filing deadline).
    scheduleVisitReminder(inquiry, new Date(payload.scheduledDate), payload.scheduledTime).catch(() => {})

    await db.auditLog.create({ data: { action: 'PROPERTY_SITE_VISIT_SCHEDULED', entityType: 'PropertySiteVisit', entityId: visit.id, newValue: JSON.stringify({ inquiryId: payload.inquiryId, scheduledDate: payload.scheduledDate }) } }).catch(() => {})
    return { success: true, data: visit }
  } catch (err) {
    return { success: false, error: { code: 'PSV-004', message: err instanceof Error ? err.message : 'Could not schedule site visit.' } }
  }
}

export async function updatePropertySiteVisit(payload: {
  id: string
  scheduledDate?: string
  scheduledTime?: string | null
  status?: string
  feedback?: string | null
  interestLevel?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, scheduledDate, ...rest } = payload

    // Fetch the pre-update date so a reschedule (scheduledDate changing)
    // can cancel the reminder tied to the old date and schedule a fresh one
    // for the new date — same reschedule-on-change discipline as
    // hearing.service.ts's rescheduleHearingReminder.
    const before = scheduledDate !== undefined
      ? await db.propertySiteVisit.findUnique({ where: { id }, select: { inquiryId: true, scheduledDate: true } })
      : null

    const visit = await db.propertySiteVisit.update({
      where: { id },
      data: {
        ...rest,
        ...(scheduledDate !== undefined ? { scheduledDate: new Date(scheduledDate) } : {}),
        ...(payload.status === 'COMPLETED' ? { completedDate: new Date() } : {}),
      },
    })

    if (before && scheduledDate !== undefined && before.scheduledDate.getTime() !== visit.scheduledDate.getTime()) {
      const inquiry = await db.propertyInquiry.findUnique({
        where: { id: before.inquiryId },
        include: {
          buyer: { select: { id: true, customerName: true, phone: true } },
          property: { select: { location: true, propertyType: true } },
        },
      })
      if (inquiry) {
        const oldOneDayBefore = new Date(before.scheduledDate)
        oldOneDayBefore.setDate(oldOneDayBefore.getDate() - 1)
        await db.notificationQueue.deleteMany({
          where: { customerId: inquiry.buyer.id, notificationType: 'PROPERTY_SITE_VISIT_REMINDER', status: 'PENDING', scheduledFor: oldOneDayBefore },
        }).catch(() => {})
        scheduleVisitReminder(inquiry, visit.scheduledDate, visit.scheduledTime ?? undefined).catch(() => {})
      }
    }

    await db.auditLog.create({ data: { action: 'PROPERTY_SITE_VISIT_UPDATED', entityType: 'PropertySiteVisit', entityId: id } }).catch(() => {})
    return { success: true, data: visit }
  } catch (err) {
    return { success: false, error: { code: 'PSV-005', message: err instanceof Error ? err.message : 'Could not update site visit.' } }
  }
}

export async function deletePropertySiteVisit(id: string) {
  try {
    const db = getPrisma()
    await db.propertySiteVisit.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'PROPERTY_SITE_VISIT_DELETED', entityType: 'PropertySiteVisit', entityId: id } }).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'PSV-006', message: err instanceof Error ? err.message : 'Could not delete site visit.' } }
  }
}

async function scheduleVisitReminder(
  inquiry: { buyer: { id: string; customerName: string; phone: string | null }; property: { location: string; propertyType: string } },
  scheduledDate: Date,
  scheduledTime?: string
) {
  const db = getPrisma()
  const oneDayBefore = new Date(scheduledDate)
  oneDayBefore.setDate(oneDayBefore.getDate() - 1)
  const now = new Date()
  if (oneDayBefore <= now) return

  const phone = inquiry.buyer.phone
  if (!phone) return

  const dateStr = scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = scheduledTime ? ` at ${scheduledTime}` : ''
  const message = `Dear ${inquiry.buyer.customerName}, reminder for your site visit to the ${inquiry.property.propertyType.replace(/_/g, ' ').toLowerCase()} at ${inquiry.property.location} on ${dateStr}${timeStr}. Powered by Sarang | www.aszurex.com`
  const link = await buildWhatsAppLink(phone, message)

  await db.notificationQueue.create({
    data: {
      customerId: inquiry.buyer.id,
      customerName: inquiry.buyer.customerName,
      customerPhone: phone,
      notificationType: 'PROPERTY_SITE_VISIT_REMINDER',
      templateBody: message,
      whatsappLink: link,
      scheduledFor: oneDayBefore,
      status: 'PENDING',
    },
  })
}
