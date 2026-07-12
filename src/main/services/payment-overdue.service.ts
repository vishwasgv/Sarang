import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'

export async function scanPaymentOverdueNotifications(): Promise<void> {
  try {
    const db = getPrisma()
    const now = new Date()

    const overdueInvoices = await db.invoice.findMany({
      where: {
        dueDate: { not: null, lte: now },
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        status: { not: 'CANCELLED' },
        balanceAmount: { gt: 0 },
      },
      include: {
        customer: { select: { id: true, customerName: true, phone: true } },
      },
    })

    for (const inv of overdueInvoices) {
      if (!inv.dueDate) continue
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)

      let notifType: string | null = null
      if (daysOverdue >= 30) notifType = 'PAYMENT_OVERDUE_30D'
      else if (daysOverdue >= 14) notifType = 'PAYMENT_OVERDUE_14D'
      else if (daysOverdue >= 7) notifType = 'PAYMENT_OVERDUE_7D'

      if (!notifType) continue

      const idAnchor = inv.id.slice(-6)
      const alreadyQueued = await db.notificationQueue.findFirst({
        where: { notificationType: notifType, templateBody: { contains: idAnchor }, status: 'PENDING' },
      })
      if (alreadyQueued) continue

      const customerName = inv.customer?.customerName ?? inv.customerId ?? 'Customer'
      const phone = inv.customer?.phone ?? null
      const dueDateStr = inv.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      const body = `Dear ${customerName}, invoice #${inv.invoiceNumber} [${idAnchor}] of ₹${inv.balanceAmount.toFixed(2)} was due on ${dueDateStr} and is now overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}. Please clear at your earliest convenience. Powered by Sarang | www.aszurex.com`
      const whatsappLink = phone ? await buildWhatsAppLink(phone, body) : null

      await db.notificationQueue.create({
        data: {
          customerId: inv.customer?.id ?? null,
          customerName,
          customerPhone: phone,
          notificationType: notifType,
          templateBody: body,
          whatsappLink,
          scheduledFor: now,
          status: 'PENDING',
        },
      })
    }
  } catch { /* non-critical background scan */ }
}
