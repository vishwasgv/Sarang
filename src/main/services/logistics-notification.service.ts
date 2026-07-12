import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'

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
    const anchor = shipmentId.slice(-6)
    const existing = await db.notificationQueue.findFirst({
      where: { notificationType: 'SHIPMENT_DISPATCHED', templateBody: { contains: anchor }, status: 'PENDING' },
    })
    if (existing) return

    const dateStr = expectedDelivery
      ? expectedDelivery.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'TBD'
    const trackPart = trackingNumber ? ` (Tracking: ${trackingNumber})` : ''
    const body = `Dear ${customerName}, your shipment ${shipmentNumber} [${anchor}] has been dispatched${trackPart}. Expected delivery: ${dateStr}. Powered by Sarang | www.aszurex.com`
    const whatsappLink = customerPhone ? await buildWhatsAppLink(customerPhone, body) : null

    await db.notificationQueue.create({
      data: {
        customerId,
        customerName,
        customerPhone,
        notificationType: 'SHIPMENT_DISPATCHED',
        templateBody: body,
        whatsappLink,
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
    const anchor = `${shipmentId.slice(-6)}-DELAY`
    const existing = await db.notificationQueue.findFirst({
      where: { notificationType: 'SHIPMENT_DELAYED', templateBody: { contains: anchor }, status: 'PENDING' },
    })
    if (existing) return

    const dateStr = expectedDelivery.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const body = `Dear ${customerName}, we apologise for the delay on shipment ${shipmentNumber} [${anchor}]. Expected delivery was ${dateStr}. Our team is working to deliver your order at the earliest. Powered by Sarang | www.aszurex.com`

    let customerPhone: string | null = null
    if (customerId) {
      const cust = await db.customer.findUnique({ where: { id: customerId }, select: { phone: true } })
      customerPhone = cust?.phone ?? null
    }
    const whatsappLink = customerPhone ? await buildWhatsAppLink(customerPhone, body) : null

    await db.notificationQueue.create({
      data: {
        customerId,
        customerName,
        customerPhone,
        notificationType: 'SHIPMENT_DELAYED',
        templateBody: body,
        whatsappLink,
        scheduledFor: new Date(),
        status: 'PENDING',
      }
    })
  } catch { /* non-critical */ }
}

export async function scheduleGRNPostedNotification(
  grnId: string,
  grnNumber: string,
  supplierName: string
): Promise<void> {
  try {
    const db = getPrisma()
    const anchor = grnId.slice(-6)
    const existing = await db.notificationQueue.findFirst({
      where: { notificationType: 'GRN_POSTED', templateBody: { contains: anchor }, status: 'PENDING' },
    })
    if (existing) return

    const body = `GRN ${grnNumber} [${anchor}] has been posted successfully. Goods received from ${supplierName} have been updated in inventory.`

    await db.notificationQueue.create({
      data: {
        customerId: null,
        customerName: supplierName,
        customerPhone: null,
        notificationType: 'GRN_POSTED',
        templateBody: body,
        whatsappLink: null,
        scheduledFor: new Date(),
        status: 'PENDING',
      }
    })
  } catch { /* non-critical */ }
}
