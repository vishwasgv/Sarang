import { getPrisma } from '../database/db'

// Full DIAL_CODES matching notification-queue.service.ts (30 countries)
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

async function buildWhatsAppLink(phone: string, message: string): Promise<string> {
  const hasPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  let number: string
  if (hasPlus) {
    number = digits
  } else if (digits.startsWith('00')) {
    number = digits.slice(2)
  } else {
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst({ select: { country: true } })
    const key = (profile?.country ?? '').toLowerCase().trim()
    const dialCode = DIAL_CODES[key]
    number = dialCode ? `${dialCode}${digits.replace(/^0/, '')}` : digits
  }
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export async function listVaccinationRecords(petId: string) {
  try {
    const db = getPrisma()
    const items = await db.vaccinationRecord.findMany({
      where: { petId },
      orderBy: { administeredAt: 'desc' },
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'VAC-001', message: err instanceof Error ? err.message : 'Could not list vaccination records.' } }
  }
}

export async function getVaccinationRecord(id: string) {
  try {
    const db = getPrisma()
    const item = await db.vaccinationRecord.findUnique({
      where: { id },
      include: {
        pet: {
          include: {
            customer: { select: { id: true, customerName: true, phone: true } },
          },
        },
      },
    })
    if (!item) return { success: false, error: { code: 'VAC-002', message: 'Vaccination record not found.' } }
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'VAC-002', message: err instanceof Error ? err.message : 'Could not fetch vaccination record.' } }
  }
}

export async function createVaccinationRecord(payload: {
  petId: string
  vaccineName: string
  vaccineType?: string
  batchNumber?: string
  manufacturer?: string
  administeredAt: string
  administeredBy?: string
  nextDueDate?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const item = await db.vaccinationRecord.create({
      data: {
        petId: payload.petId,
        vaccineName: payload.vaccineName,
        vaccineType: payload.vaccineType ?? null,
        batchNumber: payload.batchNumber ?? null,
        manufacturer: payload.manufacturer ?? null,
        administeredAt: new Date(payload.administeredAt),
        administeredBy: payload.administeredBy ?? null,
        nextDueDate: payload.nextDueDate ? new Date(payload.nextDueDate) : null,
        notes: payload.notes ?? null,
      },
    })
    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'VaccinationRecord', entityId: item.id, newValue: JSON.stringify({ petId: payload.petId, vaccineName: payload.vaccineName }) },
    }).catch(() => {})
    if (item.nextDueDate) generateVaccineReminder(item.id).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'VAC-003', message: err instanceof Error ? err.message : 'Could not create vaccination record.' } }
  }
}

export async function updateVaccinationRecord(payload: {
  id: string
  vaccineName?: string
  vaccineType?: string | null
  batchNumber?: string | null
  manufacturer?: string | null
  administeredAt?: string
  administeredBy?: string | null
  nextDueDate?: string | null
  notes?: string | null
  certificatePrinted?: boolean
}) {
  try {
    const db = getPrisma()
    const { id, administeredAt, nextDueDate, ...rest } = payload

    // Fetch the pre-update due date so a changed/newly-set nextDueDate can
    // (re)schedule reminders — mirrors hearing.service.ts's rescheduleHearingReminder,
    // which already handles the equivalent case for Hearing.hearingDate.
    const before = nextDueDate !== undefined
      ? await db.vaccinationRecord.findUnique({ where: { id }, select: { nextDueDate: true } })
      : null

    const item = await db.vaccinationRecord.update({
      where: { id },
      data: {
        ...rest,
        ...(administeredAt ? { administeredAt: new Date(administeredAt) } : {}),
        ...(nextDueDate !== undefined ? { nextDueDate: nextDueDate ? new Date(nextDueDate) : null } : {}),
      },
    })

    if (before && nextDueDate !== undefined && before.nextDueDate?.getTime() !== item.nextDueDate?.getTime()) {
      await rescheduleVaccineReminder(id, before.nextDueDate, item.nextDueDate)
    }

    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'VaccinationRecord', entityId: id },
    }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'VAC-004', message: err instanceof Error ? err.message : 'Could not update vaccination record.' } }
  }
}

export async function deleteVaccinationRecord(id: string) {
  try {
    const db = getPrisma()
    await db.vaccinationRecord.delete({ where: { id } })
    await db.auditLog.create({
      data: { action: 'DELETE', entityType: 'VaccinationRecord', entityId: id },
    }).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'VAC-005', message: err instanceof Error ? err.message : 'Could not delete vaccination record.' } }
  }
}

// Called when an update changes/sets/clears nextDueDate — deletes any still-PENDING
// reminders scheduled off the old due date (they're now wrong), then queues fresh
// ones off the new date. Mirrors hearing.service.ts's rescheduleHearingReminder.
async function rescheduleVaccineReminder(vaccinationRecordId: string, oldDueDate: Date | null, newDueDate: Date | null) {
  try {
    const db = getPrisma()
    if (oldDueDate) {
      const record = await db.vaccinationRecord.findUnique({
        where: { id: vaccinationRecordId },
        select: { pet: { select: { customer: { select: { id: true } } } } },
      })
      const customerId = record?.pet.customer?.id ?? null
      if (customerId) {
        const oldSevenDaysBefore = new Date(oldDueDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        const oldThirtyDaysBefore = new Date(oldDueDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        await db.notificationQueue.deleteMany({
          where: {
            customerId,
            notificationType: { in: ['VACCINE_DUE_7D', 'VACCINE_DUE_30D'] },
            status: 'PENDING',
            scheduledFor: { in: [oldSevenDaysBefore, oldThirtyDaysBefore] },
          },
        })
      }
    }
  } catch {
    // Non-critical — worst case the stale reminder from the old date remains
  }
  if (newDueDate) await generateVaccineReminder(vaccinationRecordId)
}

export async function generateVaccineReminder(vaccinationRecordId: string) {
  try {
    const db = getPrisma()
    const record = await db.vaccinationRecord.findUnique({
      where: { id: vaccinationRecordId },
      include: {
        pet: {
          include: {
            customer: { select: { id: true, customerName: true, phone: true } },
          },
        },
      },
    })
    if (!record) return { success: false, error: { code: 'VAC-006', message: 'Vaccination record not found.' } }
    if (!record.nextDueDate) return { success: false, error: { code: 'VAC-006', message: 'No next due date set on this vaccination record.' } }

    const phone = record.pet.customer?.phone ?? null
    if (!phone) return { success: true, data: null } // owner has no phone — nothing to queue

    const ownerName = record.pet.customer?.customerName ?? 'Pet Owner'
    const petName = record.pet.petName
    const dateStr = record.nextDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const customerId = record.pet.customer?.id ?? null
    const sevenDaysBefore = new Date(record.nextDueDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysBefore = new Date(record.nextDueDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    const now = new Date()

    const message7 = `Dear ${ownerName}, ${petName}'s ${record.vaccineName} vaccination is due on ${dateStr}. Please book an appointment soon. Powered by Sarang | www.aszurex.com`
    const message30 = `Dear ${ownerName}, ${petName}'s ${record.vaccineName} vaccination is due in 30 days (${dateStr}). Book an appointment to stay on schedule. Powered by Sarang | www.aszurex.com`

    if (record.nextDueDate < now) {
      const existingOverdue = await db.notificationQueue.findFirst({
        where: { notificationType: 'VACCINE_OVERDUE', templateBody: { contains: record.id.slice(-6) }, status: 'PENDING' },
      })
      if (!existingOverdue) {
        const overdueMsg = `Dear ${ownerName}, ${petName}'s ${record.vaccineName} vaccination was due on ${dateStr} and is now overdue [${record.id.slice(-6)}]. Please book an appointment urgently. Powered by Sarang | www.aszurex.com`
        const overdueLink = await buildWhatsAppLink(phone, overdueMsg)
        await db.notificationQueue.create({
          data: { appointmentId: null, customerId, customerName: ownerName, customerPhone: phone, notificationType: 'VACCINE_OVERDUE', templateBody: overdueMsg, whatsappLink: overdueLink, scheduledFor: now, status: 'PENDING' },
        })
      }
    }

    // Dedup on (notificationType, customerId, scheduledFor) — scheduledFor is
    // computed deterministically from this record's nextDueDate, so a repeat
    // call for the same record (this fires automatically on record creation
    // AND is re-triggerable any time via the "Send Reminder" button, which
    // never disables itself) always recomputes the same timestamp and is
    // correctly recognised as a duplicate, same as the VACCINE_OVERDUE guard
    // above already does via a different key.
    if (sevenDaysBefore > now) {
      const existing7 = await db.notificationQueue.findFirst({
        where: { notificationType: 'VACCINE_DUE_7D', customerId, scheduledFor: sevenDaysBefore, status: 'PENDING' },
      })
      if (!existing7) {
        const link7 = await buildWhatsAppLink(phone, message7)
        await db.notificationQueue.create({
          data: {
            appointmentId: null,
            customerId,
            customerName: ownerName,
            customerPhone: phone,
            notificationType: 'VACCINE_DUE_7D',
            templateBody: message7,
            whatsappLink: link7,
            scheduledFor: sevenDaysBefore,
            status: 'PENDING',
          },
        })
      }
    }
    if (thirtyDaysBefore > now) {
      const existing30 = await db.notificationQueue.findFirst({
        where: { notificationType: 'VACCINE_DUE_30D', customerId, scheduledFor: thirtyDaysBefore, status: 'PENDING' },
      })
      if (!existing30) {
        const link30 = await buildWhatsAppLink(phone, message30)
        await db.notificationQueue.create({
          data: {
            appointmentId: null,
            customerId,
            customerName: ownerName,
            customerPhone: phone,
            notificationType: 'VACCINE_DUE_30D',
            templateBody: message30,
            whatsappLink: link30,
            scheduledFor: thirtyDaysBefore,
            status: 'PENDING',
          },
        })
      }
    }

    return { success: true, data: { message: message7, link: await buildWhatsAppLink(phone, message7) } }
  } catch (err) {
    return { success: false, error: { code: 'VAC-006', message: err instanceof Error ? err.message : 'Could not generate vaccine reminder.' } }
  }
}

export async function getUpcomingVaccinations(daysAhead?: number) {
  try {
    const db = getPrisma()
    const days = daysAhead ?? 30
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)

    const items = await db.vaccinationRecord.findMany({
      where: {
        nextDueDate: { gte: today, lte: cutoff },
        pet: { isActive: true },
      },
      include: {
        pet: {
          include: {
            customer: { select: { id: true, customerName: true, phone: true } },
          },
        },
      },
      orderBy: { nextDueDate: 'asc' },
    })

    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'VAC-007', message: err instanceof Error ? err.message : 'Could not fetch upcoming vaccinations.' } }
  }
}
