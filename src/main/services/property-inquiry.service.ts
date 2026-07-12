import { getPrisma } from '../database/db'

export async function listPropertyInquiries(propertyId: string) {
  const db = getPrisma()
  const inquiries = await db.propertyInquiry.findMany({
    where: { propertyId },
    include: { buyer: { select: { id: true, customerName: true, phone: true } } },
    orderBy: [{ inquiryDate: 'desc' }],
  })
  return { success: true, data: inquiries }
}

export async function createPropertyInquiry(payload: {
  propertyId: string
  buyerClientId: string
  notes?: string
  nextFollowUpDate?: string
}) {
  const db = getPrisma()
  const inquiry = await db.propertyInquiry.create({
    data: {
      propertyId: payload.propertyId,
      buyerClientId: payload.buyerClientId,
      notes: payload.notes || null,
      nextFollowUpDate: payload.nextFollowUpDate ? new Date(payload.nextFollowUpDate) : null,
    },
    include: { buyer: { select: { id: true, customerName: true, phone: true } } },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'PropertyInquiry', entityId: inquiry.id, newValue: JSON.stringify({ propertyId: inquiry.propertyId, buyerClientId: inquiry.buyerClientId }) } }).catch(() => {})
  return { success: true, data: inquiry }
}

export async function updatePropertyInquiry(payload: {
  id: string
  status?: string
  notes?: string | null
  nextFollowUpDate?: string | null
}) {
  const db = getPrisma()
  const { id, nextFollowUpDate, ...rest } = payload
  const inquiry = await db.propertyInquiry.update({
    where: { id },
    data: {
      ...rest,
      ...(nextFollowUpDate !== undefined ? { nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null } : {}),
    },
    include: { buyer: { select: { id: true, customerName: true, phone: true } } },
  })
  await db.auditLog.create({ data: { action: payload.status ? payload.status : 'UPDATE', entityType: 'PropertyInquiry', entityId: inquiry.id } }).catch(() => {})
  return { success: true, data: inquiry }
}

export async function deletePropertyInquiry(id: string) {
  const db = getPrisma()
  await db.propertyInquiry.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'PropertyInquiry', entityId: id } }).catch(() => {})
  return { success: true }
}
