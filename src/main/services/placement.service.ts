import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { serializeJobOrder } from './job-order.service'
import { generateSequenceNumber } from './sequence.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Placement.offeredSalary/commissionAmount are Prisma Decimal fields —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes
// one. Applied to every function below that returns a placement. getPlacement
// additionally nests a jobOrder object with commissionValue selected, which
// needs the same treatment via the exported serializeJobOrder from
// job-order.service.ts.
function serializePlacement<T extends { offeredSalary: unknown; commissionAmount: unknown }>(p: T): T {
  return { ...p, offeredSalary: Number(p.offeredSalary), commissionAmount: Number(p.commissionAmount) }
}

async function generatePlacementNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'placement_number_sequence', 'PLC', 5,
    async () => {
      const last = await tx.placement.findFirst({ orderBy: { createdAt: 'desc' }, select: { placementNumber: true } })
      return last ? parseInt(last.placementNumber.replace('PLC-', ''), 10) : 0
    }
  )
}

export async function listPlacements(filters?: { status?: string; candidateId?: string; jobOrderId?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.candidateId) where.candidateId = filters.candidateId
  if (filters?.jobOrderId) where.jobOrderId = filters.jobOrderId
  if (filters?.search) {
    where.OR = [
      { placementNumber: { contains: filters.search } },
      { candidate: { fullName: { contains: filters.search } } },
      { jobOrder: { jobTitle: { contains: filters.search } } },
      { client: { customerName: { contains: filters.search } } },
    ]
  }
  const placements = await db.placement.findMany({
    where,
    include: {
      candidate: { select: { id: true, candidateNumber: true, fullName: true, phone: true } },
      jobOrder: { select: { id: true, orderNumber: true, jobTitle: true, replacementGuaranteeDays: true } },
      client: { select: { id: true, customerName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: placements.map(serializePlacement) }
}

export async function getPlacement(id: string) {
  const db = getPrisma()
  const placement = await db.placement.findUnique({
    where: { id },
    include: {
      candidate: { select: { id: true, candidateNumber: true, fullName: true, phone: true } },
      jobOrder: { select: { id: true, orderNumber: true, jobTitle: true, commissionType: true, commissionValue: true } },
      client: { select: { id: true, customerName: true } },
    },
  })
  if (!placement) return { success: false, error: { code: 'PLC-001', message: 'Placement not found.' } }
  return { success: true, data: { ...serializePlacement(placement), jobOrder: serializeJobOrder(placement.jobOrder) } }
}

export async function createPlacement(payload: {
  candidateId: string
  jobOrderId: string
  clientId: string
  joiningDate: string
  offeredSalary: number
  commissionAmount: number
  notes?: string
}) {
  const db = getPrisma()
  const placement = await db.$transaction(async (tx) => {
    const placementNumber = await generatePlacementNumber(tx)
    return tx.placement.create({
      data: {
        placementNumber,
        candidateId: payload.candidateId,
        jobOrderId: payload.jobOrderId,
        clientId: payload.clientId,
        joiningDate: new Date(payload.joiningDate),
        offeredSalary: payload.offeredSalary,
        commissionAmount: payload.commissionAmount,
        notes: payload.notes ?? null,
      },
      include: {
        candidate: { select: { id: true, candidateNumber: true, fullName: true, phone: true } },
        jobOrder: { select: { id: true, orderNumber: true, jobTitle: true, replacementGuaranteeDays: true } },
        client: { select: { id: true, customerName: true } },
      },
    })
  })
  await db.auditLog.create({
    data: { action: 'CREATE', entityType: 'Placement', entityId: placement.id, newValue: JSON.stringify({ placementNumber: placement.placementNumber }) },
  }).catch(() => {})
  return { success: true, data: serializePlacement(placement) }
}

export async function updatePlacement(payload: {
  id: string
  joiningDate?: string
  offeredSalary?: number
  commissionAmount?: number
  status?: string
  invoiceId?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, joiningDate, ...rest } = payload
  const data: Record<string, unknown> = { ...rest }
  if (joiningDate !== undefined) data.joiningDate = new Date(joiningDate)

  // When advancing to JOINED mark candidate as PLACED (never overwrite BLACKLISTED)
  if (payload.status === 'JOINED') {
    const existing = await db.placement.findUnique({
      where: { id },
      select: { candidateId: true, candidate: { select: { status: true } } },
    })
    if (existing && existing.candidate && existing.candidate.status !== 'BLACKLISTED') {
      await db.candidate.update({ where: { id: existing.candidateId }, data: { status: 'PLACED' } })
    }
  }

  const placement = await db.placement.update({
    where: { id },
    data,
    include: {
      candidate: { select: { id: true, candidateNumber: true, fullName: true, phone: true } },
      jobOrder: { select: { id: true, orderNumber: true, jobTitle: true, replacementGuaranteeDays: true } },
      client: { select: { id: true, customerName: true } },
    },
  })
  const auditAction = payload.status === 'JOINED' ? 'JOINED' : 'UPDATE'
  await db.auditLog.create({
    data: { action: auditAction, entityType: 'Placement', entityId: id },
  }).catch(() => {})
  return { success: true, data: serializePlacement(placement) }
}

export async function deletePlacement(id: string) {
  const db = getPrisma()
  const placement = await db.placement.findUnique({ where: { id }, select: { invoiceId: true, candidateId: true } })
  if (placement?.invoiceId) {
    return { success: false, error: { code: 'PLC-002', message: 'Cannot delete a placement that has an associated invoice.' } }
  }
  await db.placement.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'DELETE', entityType: 'Placement', entityId: id },
  }).catch(() => {})
  // if this candidate has no remaining placements AND is currently PLACED, revert them to ACTIVE
  if (placement) {
    const remaining = await db.placement.count({ where: { candidateId: placement.candidateId } })
    if (remaining === 0) {
      const cand = await db.candidate.findUnique({ where: { id: placement.candidateId }, select: { status: true } })
      if (cand?.status === 'PLACED') {
        await db.candidate.update({ where: { id: placement.candidateId }, data: { status: 'ACTIVE' } })
      }
    }
  }
  return { success: true }
}

// Real bug found 2026-07-23: this had no atomic claim on invoiceId — just a
// plain read-then-check (`if (placement.invoiceId) return error`) with the
// actual write only happening via a plain update() AFTER
// billingService.createInvoice() had already run. Two concurrent "Generate
// Invoice" calls for the same placement could both pass the stale check and
// each create a real, separate Invoice — a genuine double-bill of the
// client for the same recruitment commission. Fixed with the same atomic
// conditional-claim + release-on-failure shape used by
// car-job-card.service.ts / job-card.service.ts / project.service.ts.
const PLACEMENT_INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generatePlacementInvoice(id: string) {
  const db = getPrisma()
  const claim = await db.placement.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: PLACEMENT_INVOICE_CLAIM_SENTINEL } })
  if (claim.count === 0) {
    const existing = await db.placement.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return { success: false, error: { code: 'PLC-001', message: 'Placement not found.' } }
    return { success: false, error: { code: 'PLC-003', message: 'Invoice already generated for this placement.' } }
  }

  try {
    const placement = await db.placement.findUnique({
      where: { id },
      include: { client: { select: { id: true } } },
    })
    if (!placement) {
      await db.placement.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PLC-001', message: 'Placement not found.' } }
    }
    if (Number(placement.commissionAmount) === 0) {
      await db.placement.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PLC-004', message: 'Commission amount is zero. Set a commission amount before generating an invoice.' } }
    }

    // SAC 999132 — Manpower Recruitment and Placement Services, 18% GST
    let product = await db.product.findFirst({ where: { hsnCode: '999132', isActive: true } })
    if (!product) {
      product = await db.product.create({
        data: { productName: 'Placement / Recruitment Services', productType: 'SERVICE', hsnCode: '999132', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
      })
    }

    const result = await billingService.createInvoice({
      customerId: placement.clientId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: [{ productId: product.id, quantity: 1, unitPrice: Number(placement.commissionAmount) }],
      notes: `Placement ${placement.placementNumber}`,
      referenceNumber: placement.placementNumber,
    })
    if (!result.success) {
      await db.placement.update({ where: { id }, data: { invoiceId: null } })
      return result
    }

    const invoice = result.data as { id: string }
    await db.placement.update({ where: { id }, data: { invoiceId: invoice.id, status: 'INVOICED' } })
    await db.auditLog.create({
      data: { action: 'INVOICED', entityType: 'Placement', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) },
    }).catch(() => {})
    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    await db.placement.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
    return { success: false, error: { code: 'PLC-005', message: err instanceof Error ? err.message : 'Could not generate placement invoice.' } }
  }
}

export async function getPlacementKPIs() {
  const db = getPrisma()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [activeCandidates, openJobOrders, placementsThisMonth, revenueResult] = await Promise.all([
    db.candidate.count({ where: { status: 'ACTIVE' } }),
    db.jobOrder.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    db.placement.count({ where: { status: { in: ['JOINED', 'INVOICED'] }, joiningDate: { gte: monthStart, lte: monthEnd } } }),
    db.placement.aggregate({ _sum: { commissionAmount: true }, where: { invoiceId: { not: null }, joiningDate: { gte: monthStart, lte: monthEnd } } }),
  ])

  const revenueThisMonth = Number(revenueResult._sum.commissionAmount ?? 0)
  return { success: true, data: { activeCandidates, openJobOrders, placementsThisMonth, revenueThisMonth } }
}
