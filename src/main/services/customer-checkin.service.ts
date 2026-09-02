import { getPrisma } from '../database/db'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { logAction } from './audit.service'

// 2026-09 — universal visit check-in/check-out log (any business, via the
// customer_checkin opt-in module). Deliberately separate from
// membership.service.ts's MemberAttendance, which requires an active
// Membership row — this model works for a plain Customer with no membership
// concept at all (a coaching institute's students, a clinic's walk-ins, a
// co-working space's members, etc.), see the CustomerCheckIn model comment
// in prisma/schema.prisma.

export async function checkInCustomer(customerId: string, notes?: string, userId?: string) {
  try {
    const db = getPrisma()

    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!customer) return { success: false, error: { code: 'CCI-001', message: 'Customer not found.' } }

    // Guard against a double check-in: if this customer already has an open
    // (not checked-out) visit, don't silently create a second one — the
    // caller almost certainly meant to check them OUT, not open a second
    // concurrent visit.
    const openCheckIn = await db.customerCheckIn.findFirst({
      where: { customerId, checkOutTime: null },
      orderBy: { checkInTime: 'desc' },
    })
    if (openCheckIn) return { success: false, error: { code: 'CCI-002', message: 'This customer is already checked in. Check them out first.' } }

    const row = await db.customerCheckIn.create({
      data: { customerId, notes: notes || null },
    })

    await logAction({ userId, action: 'CUSTOMER_CHECKED_IN', entityType: 'CustomerCheckIn', entityId: row.id, newValue: { customerId } })

    return { success: true, data: row }
  } catch (err) {
    return { success: false, error: { code: 'CCI-003', message: err instanceof Error ? err.message : 'Could not check in.' } }
  }
}

export async function checkOutCustomer(checkInId: string, userId?: string) {
  try {
    const db = getPrisma()
    const row = await db.customerCheckIn.findUnique({ where: { id: checkInId } })
    if (!row) return { success: false, error: { code: 'CCI-001', message: 'Check-in record not found.' } }
    if (row.checkOutTime) return { success: false, error: { code: 'CCI-004', message: 'This visit is already checked out.' } }

    const updated = await db.customerCheckIn.update({
      where: { id: checkInId },
      data: { checkOutTime: new Date() },
    })

    await logAction({ userId, action: 'CUSTOMER_CHECKED_OUT', entityType: 'CustomerCheckIn', entityId: checkInId })

    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'CCI-005', message: err instanceof Error ? err.message : 'Could not check out.' } }
  }
}

// Everyone currently checked in (no checkOutTime yet) — the screen's default
// "who's here right now" view.
export async function listActiveCheckIns() {
  try {
    const db = getPrisma()
    const rows = await db.customerCheckIn.findMany({
      where: { checkOutTime: null },
      include: { customer: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { checkInTime: 'desc' },
    })
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'CCI-006', message: err instanceof Error ? err.message : 'Could not load active check-ins.' } }
  }
}

export async function listCheckIns(dateFrom?: string, dateTo?: string, customerId?: string) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (customerId) where.customerId = customerId
    if (dateFrom || dateTo) {
      where.checkInTime = {
        ...(dateFrom ? { gte: parseLocalDateStart(dateFrom) } : {}),
        ...(dateTo ? { lte: parseLocalDateEnd(dateTo) } : {}),
      }
    }
    const rows = await db.customerCheckIn.findMany({
      where,
      include: { customer: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { checkInTime: 'desc' },
    })
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'CCI-007', message: err instanceof Error ? err.message : 'Could not load check-ins.' } }
  }
}
