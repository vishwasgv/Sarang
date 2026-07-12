import { getPrisma } from '../database/db'

// StaffCommission.serviceRevenue/commissionRate/commissionAmount/tipAmount
// are Prisma Decimal fields — Electron's IPC (structured clone) cannot
// serialize a Decimal instance and throws "An object could not be cloned"
// on every response that includes one. Applied to every function below
// that returns commission data (getMonthlyCommissionReport already
// aggregates into plain numbers, so it doesn't need this).
function serializeCommission<T extends { serviceRevenue: unknown; commissionRate: unknown; commissionAmount: unknown; tipAmount: unknown }>(c: T): T {
  return {
    ...c,
    serviceRevenue: Number(c.serviceRevenue),
    commissionRate: Number(c.commissionRate),
    commissionAmount: Number(c.commissionAmount),
    tipAmount: Number(c.tipAmount),
  }
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function calculateCommission(payload: {
  appointmentId: string
  staffId: string
  serviceRevenue: number
  commissionType: 'PERCENT' | 'FLAT'
  commissionRate: number
  tipAmount?: number
  period?: string
}) {
  try {
    const db = getPrisma()

    const existing = await db.staffCommission.findUnique({ where: { appointmentId: payload.appointmentId } })
    if (existing) return { success: true, data: serializeCommission(existing) }

    // Read employee's configured rate — fall back to payload values only if not set
    const employee = await db.employee.findUnique({
      where: { id: payload.staffId },
      select: { commissionRate: true, commissionType: true },
    })
    const commissionType = (employee?.commissionType ?? payload.commissionType) as 'PERCENT' | 'FLAT'
    const commissionRate = employee?.commissionRate != null ? Number(employee.commissionRate) : payload.commissionRate

    const revenue = payload.serviceRevenue
    const amount =
      commissionType === 'PERCENT'
        ? Math.round(((revenue * commissionRate) / 100) * 100) / 100
        : commissionRate

    const commission = await db.staffCommission.create({
      data: {
        staffId: payload.staffId,
        appointmentId: payload.appointmentId,
        serviceRevenue: revenue,
        commissionType: commissionType,
        commissionRate: commissionRate,
        commissionAmount: amount,
        tipAmount: payload.tipAmount ?? 0,
        period: payload.period ?? currentPeriod(),
        isPaid: false,
      },
    })

    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'StaffCommission', entityId: commission.id, newValue: JSON.stringify({ staffId: payload.staffId, amount, period: commission.period }) },
    }).catch(() => {})

    return { success: true, data: serializeCommission(commission) }
  } catch (err) {
    return { success: false, error: { code: 'SC27-001', message: err instanceof Error ? err.message : 'Could not calculate commission.' } }
  }
}

export async function listCommissionsByStaff(staffId: string, period?: string) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = { staffId }
    if (period) where.period = period

    const records = await db.staffCommission.findMany({
      where,
      include: {
        appointment: { select: { id: true, appointmentNumber: true, scheduledDate: true, serviceTitle: true, customerName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: records.map(serializeCommission) }
  } catch (err) {
    return { success: false, error: { code: 'SC27-002', message: err instanceof Error ? err.message : 'Could not list commissions.' } }
  }
}

export async function listAllCommissions(filters?: { period?: string; isPaid?: boolean; staffId?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.period) where.period = filters.period
    if (filters?.isPaid !== undefined) where.isPaid = filters.isPaid
    if (filters?.staffId) where.staffId = filters.staffId

    const records = await db.staffCommission.findMany({
      where,
      include: {
        staff: { select: { id: true, fullName: true, designation: true } },
        appointment: { select: { id: true, appointmentNumber: true, scheduledDate: true, serviceTitle: true, customerName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: records.map(serializeCommission) }
  } catch (err) {
    return { success: false, error: { code: 'SC27-003', message: err instanceof Error ? err.message : 'Could not list commissions.' } }
  }
}

export async function markCommissionsPaid(ids: string[], paidDate?: string) {
  try {
    const db = getPrisma()
    const date = paidDate ? new Date(paidDate) : new Date()
    await db.staffCommission.updateMany({
      where: { id: { in: ids } },
      data: { isPaid: true, paidDate: date },
    })
    await db.auditLog.create({
      data: { action: 'PAID', entityType: 'StaffCommission', entityId: ids[0] ?? '', newValue: JSON.stringify({ ids, paidDate: date.toISOString() }) },
    }).catch(() => {})
    return { success: true, data: { updatedCount: ids.length } }
  } catch (err) {
    return { success: false, error: { code: 'SC27-004', message: err instanceof Error ? err.message : 'Could not mark commissions as paid.' } }
  }
}

export async function getMonthlyCommissionReport(period?: string) {
  try {
    const db = getPrisma()
    const p = period ?? currentPeriod()

    const records = await db.staffCommission.findMany({
      where: { period: p },
      include: { staff: { select: { id: true, fullName: true, designation: true } } },
    })

    const byStaff: Record<string, { staffId: string; staffName: string; designation: string | null; totalRevenue: number; totalCommission: number; totalTips: number; paidAmount: number; pendingAmount: number; recordCount: number }> = {}

    for (const r of records) {
      const key = r.staffId
      if (!byStaff[key]) {
        byStaff[key] = {
          staffId: r.staffId,
          staffName: r.staff.fullName,
          designation: r.staff.designation,
          totalRevenue: 0,
          totalCommission: 0,
          totalTips: 0,
          paidAmount: 0,
          pendingAmount: 0,
          recordCount: 0,
        }
      }
      const entry = byStaff[key]
      entry.totalRevenue += Number(r.serviceRevenue)
      entry.totalCommission += Number(r.commissionAmount)
      entry.totalTips += Number(r.tipAmount)
      entry.recordCount += 1
      if (r.isPaid) {
        entry.paidAmount += Number(r.commissionAmount)
      } else {
        entry.pendingAmount += Number(r.commissionAmount)
      }
    }

    return { success: true, data: { period: p, staffSummaries: Object.values(byStaff) } }
  } catch (err) {
    return { success: false, error: { code: 'SC27-005', message: err instanceof Error ? err.message : 'Could not generate commission report.' } }
  }
}
