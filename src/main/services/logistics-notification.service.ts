import { getPrisma } from '../database/db'
import { buildReminderWhatsAppLink } from './notification-queue.service'
import { renderMessageTemplate } from './message-template.service'

// Each queued notification carries a `referenceKey` (for example
// "SHIPMENT_DISPATCHED:<shipmentId>") used only to avoid queueing the same
// message twice. It is never part of the message text or the WhatsApp link.

async function alreadyQueued(referenceKey: string): Promise<boolean> {
  const db = getPrisma()
  const existing = await db.notificationQueue.findFirst({ where: { referenceKey, status: 'PENDING' }, select: { id: true } })
  return !!existing
}

export async function scheduleShipmentDispatchNotification(
  shipmentId: string,
  shipmentNumber: string,
  customerName: string,
  customerPhone: string | null,
  customerId: string | null,
  trackingNumber: string | null,
  expectedDelivery: Date | null
): Promise<void> {
  try {
    const db = getPrisma()
    const referenceKey = `SHIPMENT_DISPATCHED:${shipmentId}`
    if (await alreadyQueued(referenceKey)) return

    const dateStr = expectedDelivery
      ? expectedDelivery.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'TBD'
    const trackPart = trackingNumber ? ` (Tracking: ${trackingNumber})` : ''
    const body = await renderMessageTemplate('SHIPMENT_DISPATCHED', { customerName, shipmentNumber, trackPart, date: dateStr })
    const whatsappLink = customerPhone ? await buildReminderWhatsAppLink(customerPhone, body) : null

    await db.notificationQueue.create({
      data: {
        customerId,
        customerName,
        customerPhone,
        notificationType: 'SHIPMENT_DISPATCHED',
        templateBody: body,
        whatsappLink,
        referenceKey,
        scheduledFor: new Date(),
        status: 'PENDING',
      }
    })
  } catch { /* non-critical */ }
}

export async function scheduleShipmentDelayedNotification(
  shipmentId: string,
  shipmentNumber: string,
  customerName: string,
  customerId: string | null,
  expectedDelivery: Date
): Promise<void> {
  try {
    const db = getPrisma()
    const referenceKey = `SHIPMENT_DELAYED:${shipmentId}`
    if (await alreadyQueued(referenceKey)) return

    const dateStr = expectedDelivery.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const body = await renderMessageTemplate('SHIPMENT_DELAYED', { customerName, shipmentNumber, date: dateStr })

    let customerPhone: string | null = null
    if (customerId) {
      const cust = await db.customer.findUnique({ where: { id: customerId }, select: { phone: true } })
      customerPhone = cust?.phone ?? null
    }
    const whatsappLink = customerPhone ? await buildReminderWhatsAppLink(customerPhone, body) : null

    await db.notificationQueue.create({
      data: {
        customerId,
        customerName,
        customerPhone,
        notificationType: 'SHIPMENT_DELAYED',
        templateBody: body,
        whatsappLink,
        referenceKey,
        scheduledFor: new Date(),
        status: 'PENDING',
      }
    })
  } catch { /* non-critical */ }
}

// A GRN acknowledgement goes to the supplier, so it is only queued when the
// supplier has a phone number. Without one there is nobody to message and an
// un-sendable row would only clutter the WhatsApp Reminders list.
export async function scheduleGRNPostedNotification(
  grnId: string,
  grnNumber: string,
  supplierName: string
): Promise<void> {
  try {
    const db = getPrisma()
    const referenceKey = `GRN_POSTED:${grnId}`
    if (await alreadyQueued(referenceKey)) return

    const grn = await db.goodsReceiptNote.findUnique({ where: { id: grnId }, select: { supplierId: true } })
    const supplier = grn?.supplierId
      ? await db.supplier.findUnique({ where: { id: grn.supplierId }, select: { phone: true } })
      : null
    const supplierPhone = supplier?.phone ?? null
    if (!supplierPhone) return

    const body = await renderMessageTemplate('GRN_POSTED', { grnNumber, supplierName })
    const whatsappLink = await buildReminderWhatsAppLink(supplierPhone, body)

    await db.notificationQueue.create({
      data: {
        customerId: null,
        customerName: supplierName,
        customerPhone: supplierPhone,
        notificationType: 'GRN_POSTED',
        templateBody: body,
        whatsappLink,
        referenceKey,
        scheduledFor: new Date(),
        status: 'PENDING',
      }
    })
  } catch { /* non-critical */ }
}
