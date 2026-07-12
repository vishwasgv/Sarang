import { getPrisma } from '../database/db'
import { generateSequenceNumber } from './sequence.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// JobOrder.experienceMin/experienceMax/salaryBudgetMin/salaryBudgetMax/
// commissionValue are Prisma Decimal fields — Electron's IPC (structured
// clone) cannot serialize a Decimal instance and throws "An object could
// not be cloned" on every response that includes one. Exported so
// placement.service.ts can apply it to the nested `jobOrder` object
// returned by getPlacement's `include: { jobOrder: { select: {...,
// commissionValue: true } } }`.
export function serializeJobOrder<T extends {
  experienceMin?: unknown; experienceMax?: unknown; salaryBudgetMin?: unknown; salaryBudgetMax?: unknown; commissionValue?: unknown
}>(o: T): T {
  const n = (v: unknown) => v == null ? null : Number(v)
  return {
    ...o,
    ...('experienceMin' in o ? { experienceMin: n(o.experienceMin) } : {}),
    ...('experienceMax' in o ? { experienceMax: n(o.experienceMax) } : {}),
    ...('salaryBudgetMin' in o ? { salaryBudgetMin: n(o.salaryBudgetMin) } : {}),
    ...('salaryBudgetMax' in o ? { salaryBudgetMax: n(o.salaryBudgetMax) } : {}),
    ...('commissionValue' in o ? { commissionValue: Number(o.commissionValue) } : {}),
  }
}

async function generateOrderNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'job_order_number_sequence', 'JO', 5,
    async () => {
      const last = await tx.jobOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { orderNumber: true } })
      return last ? parseInt(last.orderNumber.replace('JO-', ''), 10) : 0
    }
  )
}

export async function listJobOrders(filters?: { status?: string; clientId?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.clientId) where.clientId = filters.clientId
  if (filters?.search) {
    where.OR = [
      { orderNumber: { contains: filters.search } },
      { jobTitle: { contains: filters.search } },
      { location: { contains: filters.search } },
      { client: { customerName: { contains: filters.search } } },
    ]
  }
  const orders = await db.jobOrder.findMany({
    where,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      _count: { select: { placements: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: orders.map(serializeJobOrder) }
}

export async function getJobOrder(id: string) {
  const db = getPrisma()
  const order = await db.jobOrder.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      _count: { select: { placements: true } },
    },
  })
  if (!order) return { success: false, error: { code: 'JO-001', message: 'Job order not found.' } }
  return { success: true, data: serializeJobOrder(order) }
}

export async function createJobOrder(payload: {
  clientId: string
  jobTitle: string
  jobDescription?: string
  requiredSkills?: string[]
  experienceMin?: number
  experienceMax?: number
  salaryBudgetMin?: number
  salaryBudgetMax?: number
  location?: string
  numberOfPositions?: number
  targetDate?: string
  commissionType?: string
  commissionValue?: number
  notes?: string
}) {
  const db = getPrisma()
  const order = await db.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx)
    return tx.jobOrder.create({
      data: {
        orderNumber,
        clientId: payload.clientId,
        jobTitle: payload.jobTitle,
        jobDescription: payload.jobDescription ?? null,
        requiredSkills: JSON.stringify(payload.requiredSkills ?? []),
        experienceMin: payload.experienceMin ?? null,
        experienceMax: payload.experienceMax ?? null,
        salaryBudgetMin: payload.salaryBudgetMin ?? null,
        salaryBudgetMax: payload.salaryBudgetMax ?? null,
        location: payload.location ?? null,
        numberOfPositions: payload.numberOfPositions ?? 1,
        targetDate: payload.targetDate ? new Date(payload.targetDate) : null,
        commissionType: payload.commissionType ?? 'PERCENTAGE',
        commissionValue: payload.commissionValue ?? 0,
        notes: payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        _count: { select: { placements: true } },
      },
    })
  })
  await db.auditLog.create({
    data: { action: 'CREATE', entityType: 'JobOrder', entityId: order.id, newValue: JSON.stringify({ orderNumber: order.orderNumber, jobTitle: payload.jobTitle }) },
  }).catch(() => {})
  return { success: true, data: serializeJobOrder(order) }
}

export async function updateJobOrder(payload: {
  id: string
  jobTitle?: string
  jobDescription?: string | null
  requiredSkills?: string[]
  experienceMin?: number | null
  experienceMax?: number | null
  salaryBudgetMin?: number | null
  salaryBudgetMax?: number | null
  location?: string | null
  numberOfPositions?: number
  targetDate?: string | null
  status?: string
  commissionType?: string
  commissionValue?: number
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, requiredSkills, targetDate, ...rest } = payload
  const data: Record<string, unknown> = { ...rest }
  if (requiredSkills !== undefined) data.requiredSkills = JSON.stringify(requiredSkills)
  if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null
  const order = await db.jobOrder.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      _count: { select: { placements: true } },
    },
  })
  await db.auditLog.create({
    data: { action: 'UPDATE', entityType: 'JobOrder', entityId: id },
  }).catch(() => {})
  return { success: true, data: serializeJobOrder(order) }
}

export async function deleteJobOrder(id: string) {
  const db = getPrisma()
  const count = await db.placement.count({ where: { jobOrderId: id } })
  if (count > 0) {
    return { success: false, error: { code: 'JO-002', message: `Cannot delete job order with ${count} placement(s). Remove placements first.` } }
  }
  await db.jobOrder.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'DELETE', entityType: 'JobOrder', entityId: id },
  }).catch(() => {})
  return { success: true }
}
