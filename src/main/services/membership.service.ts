import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'
import { billingService } from './billing.service'

// MembershipPlan.price is a Prisma Decimal — Electron's IPC (structured
// clone) cannot serialize a Decimal instance and throws "An object could
// not be cloned" on every response that includes one, whether returned
// directly or nested under `plan` via an `include`. Applied to every
// function below that returns plan data, directly or nested.
function serializePlan<T extends { price: unknown }>(plan: T): T {
  return { ...plan, price: Number(plan.price) }
}

function serializeMembership<T extends { plan: { price: unknown } }>(m: T): T {
  return { ...m, plan: serializePlan(m.plan) }
}

// ── MembershipPlan ────────────────────────────────────────────────────────────

export async function listMembershipPlans() {
  try {
    const db = getPrisma()
    const plans = await db.membershipPlan.findMany({ orderBy: { planName: 'asc' } })
    return { success: true, data: plans.map(serializePlan) }
  } catch (err) {
    return { success: false, error: { code: 'MP27-001', message: err instanceof Error ? err.message : 'Could not list plans.' } }
  }
}

export async function createMembershipPlan(payload: {
  planName: string
  durationDays: number
  price: number
  sessionsIncluded?: number
  allowedClasses?: string
  isActive?: boolean
}) {
  try {
    const db = getPrisma()
    const plan = await db.membershipPlan.create({
      data: {
        planName: payload.planName,
        durationDays: payload.durationDays,
        price: payload.price,
        sessionsIncluded: payload.sessionsIncluded ?? null,
        allowedClasses: payload.allowedClasses ?? null,
        isActive: payload.isActive ?? true,
      },
    })
    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'MP27-002', message: err instanceof Error ? err.message : 'Could not create plan.' } }
  }
}

export async function updateMembershipPlan(payload: {
  id: string
  planName?: string
  durationDays?: number
  price?: number
  sessionsIncluded?: number | null
  allowedClasses?: string | null
  isActive?: boolean
}) {
  try {
    const db = getPrisma()
    const { id, ...rest } = payload
    const plan = await db.membershipPlan.update({ where: { id }, data: rest })
    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'MP27-003', message: err instanceof Error ? err.message : 'Could not update plan.' } }
  }
}

export async function deleteMembershipPlan(id: string) {
  try {
    const db = getPrisma()
    const inUse = await db.membership.count({ where: { planId: id, status: { in: ['ACTIVE', 'FROZEN'] } } })
    if (inUse > 0) return { success: false, error: { code: 'MP27-IN-USE', message: 'Plan has active or frozen memberships and cannot be deleted.' } }
    await db.membershipPlan.delete({ where: { id } })
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'MP27-004', message: err instanceof Error ? err.message : 'Could not delete plan.' } }
  }
}

// ── Membership ────────────────────────────────────────────────────────────────

export async function listMemberships(filters?: { status?: string; search?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.search) where.client = { customerName: { contains: filters.search } }

    const memberships = await db.membership.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        plan: { select: { id: true, planName: true, durationDays: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: memberships.map(serializeMembership) }
  } catch (err) {
    return { success: false, error: { code: 'M27-001', message: err instanceof Error ? err.message : 'Could not list memberships.' } }
  }
}

export async function getMembershipsByClient(clientId: string) {
  try {
    const db = getPrisma()
    const memberships = await db.membership.findMany({
      where: { clientId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: memberships.map(serializeMembership) }
  } catch (err) {
    return { success: false, error: { code: 'M27-002', message: err instanceof Error ? err.message : 'Could not get memberships.' } }
  }
}

export async function createMembership(payload: {
  clientId: string
  planId: string
  startDate: string
  paymentStatus?: string
  notes?: string
}) {
  try {
    const db = getPrisma()

    const plan = await db.membershipPlan.findUnique({ where: { id: payload.planId } })
    if (!plan) return { success: false, error: { code: 'M27-NO-PLAN', message: 'Membership plan not found.' } }

    const start = new Date(payload.startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + plan.durationDays)

    const membership = await db.membership.create({
      data: {
        clientId: payload.clientId,
        planId: payload.planId,
        startDate: start,
        endDate: end,
        status: 'ACTIVE',
        paymentStatus: payload.paymentStatus ?? 'PENDING',
        notes: payload.notes ?? null,
      },
      include: { client: { select: { id: true, customerName: true, phone: true } }, plan: true },
    })

    // Schedule expiry notifications
    await scheduleExpiryNotifications(membership.clientId, membership.client.customerName, membership.client.phone, end)

    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'Membership', entityId: membership.id, newValue: JSON.stringify({ clientId: membership.clientId, planId: membership.planId }) } }).catch(() => {})
    return { success: true, data: serializeMembership(membership) }
  } catch (err) {
    return { success: false, error: { code: 'M27-003', message: err instanceof Error ? err.message : 'Could not create membership.' } }
  }
}

async function scheduleExpiryNotifications(
  clientId: string,
  customerName: string,
  phone: string | null,
  endDate: Date
) {
  try {
    const db = getPrisma()
    const thirtyDaysBefore = new Date(endDate)
    thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30)
    const sevenDaysBefore = new Date(endDate)
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7)

    const expDateStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    const customerPhone = phone ?? ''
    const body30 = `Dear ${customerName}, your gym membership expires on ${expDateStr}. Renew now to keep enjoying your classes! Powered by Sarang | www.aszurex.com`
    const body7 = `Dear ${customerName}, your gym membership expires in 7 days (${expDateStr}). Renew today to avoid a break! Powered by Sarang | www.aszurex.com`
    const now = new Date()

    if (thirtyDaysBefore > now) {
      const link30 = customerPhone ? await buildWhatsAppLink(customerPhone, body30) : null
      await db.notificationQueue.create({
        data: { customerId: clientId, customerName, customerPhone, notificationType: 'MEMBERSHIP_EXPIRY_30D', templateBody: body30, whatsappLink: link30, scheduledFor: thirtyDaysBefore },
      })
    }
    if (sevenDaysBefore > now) {
      const link7 = customerPhone ? await buildWhatsAppLink(customerPhone, body7) : null
      await db.notificationQueue.create({
        data: { customerId: clientId, customerName, customerPhone, notificationType: 'MEMBERSHIP_EXPIRY_7D', templateBody: body7, whatsappLink: link7, scheduledFor: sevenDaysBefore },
      })
    }
  } catch {
    // Non-critical — silently ignore notification scheduling errors
  }
}

export async function updateMembership(payload: {
  id: string
  status?: string
  paymentStatus?: string
  freezeHistory?: string
  notes?: string
  sessionsUsed?: number
}) {
  try {
    const db = getPrisma()
    const { id, ...rest } = payload
    const membership = await db.membership.update({ where: { id }, data: rest })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'Membership', entityId: membership.id } }).catch(() => {})
    return { success: true, data: membership }
  } catch (err) {
    return { success: false, error: { code: 'M27-004', message: err instanceof Error ? err.message : 'Could not update membership.' } }
  }
}

// Phase 41: closes a dormant invoiceId stub — Membership had a
// paymentStatus flag (PAID/PENDING/PARTIAL) tracked manually, with no
// function that ever created a real GST invoice. Same atomic-claim pattern
// as every other generate function this session.
const MEMBERSHIP_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateMembershipInvoice(membershipId: string) {
  const db = getPrisma()
  try {
    const claim = await db.membership.updateMany({
      where: { id: membershipId, invoiceId: null },
      data: { invoiceId: MEMBERSHIP_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.membership.findUnique({ where: { id: membershipId }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'M27-008', message: 'Membership not found.' } }
      return { success: false, error: { code: 'M27-009', message: 'Invoice already generated for this membership.' } }
    }

    try {
      const membership = await db.membership.findUnique({
        where: { id: membershipId },
        include: { plan: true },
      })
      if (!membership || Number(membership.plan.price) <= 0) {
        await db.membership.update({ where: { id: membershipId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'M27-010', message: 'This plan has no price set — set a plan price greater than zero before generating an invoice.' } }
      }

      let product = await db.product.findFirst({ where: { hsnCode: '999723', productName: membership.plan.planName, isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: membership.plan.planName, productType: 'SERVICE', hsnCode: '999723', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: membership.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(membership.plan.price),
          taxRate: 18,
        }],
        notes: `Membership: ${membership.plan.planName}`,
        referenceNumber: membershipId.slice(0, 12),
      })
      if (!result.success) {
        await db.membership.update({ where: { id: membershipId }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.membership.update({ where: { id: membershipId }, data: { invoiceId: invoice.id, paymentStatus: 'PAID' } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'Membership', entityId: membershipId, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.membership.update({ where: { id: membershipId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'M27-011', message: err instanceof Error ? err.message : 'Could not generate membership invoice.' } }
  }
}

export async function checkInMember(clientId: string, membershipId: string) {
  try {
    const db = getPrisma()

    const membership = await db.membership.findUnique({
      where: { id: membershipId },
      include: { plan: { select: { sessionsIncluded: true } } },
    })
    if (!membership) return { success: false, error: { code: 'M27-NO-MEMBERSHIP', message: 'Membership not found.' } }
    if (membership.status !== 'ACTIVE') return { success: false, error: { code: 'M27-NOT-ACTIVE', message: 'Membership is not active.' } }
    if (membership.endDate < new Date()) return { success: false, error: { code: 'M27-EXPIRED', message: 'Membership has expired. Please renew to continue.' } }
    const cap = membership.plan.sessionsIncluded
    if (cap != null && membership.sessionsUsed >= cap) return { success: false, error: { code: 'M27-SESSION-CAP', message: `All ${cap} sessions in your plan have been used. Please renew or upgrade your membership.` } }

    const [attendance] = await db.$transaction([
      db.memberAttendance.create({ data: { clientId, membershipId, checkInTime: new Date() } }),
      db.membership.update({ where: { id: membershipId }, data: { sessionsUsed: { increment: 1 } } }),
    ])

    await db.auditLog.create({ data: { action: 'CHECK_IN', entityType: 'Membership', entityId: membershipId } }).catch(() => {})
    return { success: true, data: attendance }
  } catch (err) {
    return { success: false, error: { code: 'M27-005', message: err instanceof Error ? err.message : 'Could not check in member.' } }
  }
}

export async function getMembershipAttendance(membershipId: string, dateFrom?: string, dateTo?: string) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = { membershipId }
    if (dateFrom || dateTo) {
      where.checkInTime = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    }
    const records = await db.memberAttendance.findMany({
      where,
      include: { client: { select: { id: true, customerName: true } } },
      orderBy: { checkInTime: 'desc' },
    })
    return { success: true, data: records }
  } catch (err) {
    return { success: false, error: { code: 'M27-006', message: err instanceof Error ? err.message : 'Could not get attendance.' } }
  }
}

export async function getExpiringMemberships(daysAhead = 30) {
  try {
    const db = getPrisma()
    const now = new Date()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + daysAhead)

    const memberships = await db.membership.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: now, lte: cutoff },
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        plan: { select: { id: true, planName: true } },
      },
      orderBy: { endDate: 'asc' },
    })
    return { success: true, data: memberships }
  } catch (err) {
    return { success: false, error: { code: 'M27-007', message: err instanceof Error ? err.message : 'Could not get expiring memberships.' } }
  }
}
