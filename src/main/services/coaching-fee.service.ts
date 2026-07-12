import { getPrisma } from '../database/db'
import { serializeEnrollment } from './coaching-batch-enrollment.service'
import { billingService } from './billing.service'
import { calculateTax, roundCurrency, sumCurrency } from './currency.service'

// CoachingFeeRecord has 5 Prisma Decimal fields (baseAmount, taxRate,
// taxAmount, amountDue, amountReceived) — Electron's IPC (structured clone)
// cannot serialize a Decimal instance and throws "An object could not be
// cloned" on every response that includes one. listFees and updateFeeRecord
// also nest `enrollment` (its own Decimal fields, discountAmount/
// effectiveFee — a second crash surface in the same response), serialized
// via the shared helper from coaching-batch-enrollment.service.ts so the
// fix stays in one place.
function serializeFeeRecord<T extends { baseAmount: unknown; taxRate: unknown; taxAmount: unknown; amountDue: unknown; amountReceived: unknown; enrollment?: unknown }>(r: T): T {
  return {
    ...r,
    baseAmount: Number(r.baseAmount),
    taxRate: Number(r.taxRate),
    taxAmount: Number(r.taxAmount),
    amountDue: Number(r.amountDue),
    amountReceived: Number(r.amountReceived),
    ...(r.enrollment ? { enrollment: serializeEnrollment(r.enrollment as Parameters<typeof serializeEnrollment>[0]) } : {}),
  }
}

export async function generateMonthlyFees(month: string, taxRate = 0) {
  // month = "2026-07"
  const db = getPrisma()
  const [year, mon] = month.split('-').map(Number)
  const dueDate = new Date(year, mon - 1, 10) // due on the 10th of the month

  const activeEnrollments = await db.coachingBatchEnrollment.findMany({
    where: { status: 'ACTIVE' },
    include: { batch: { select: { status: true } } },
  })

  // Only generate for enrollments whose batch is also ACTIVE
  const eligible = activeEnrollments.filter((e) => e.batch.status === 'ACTIVE')

  let created = 0
  let skipped = 0

  for (const enrollment of eligible) {
    const existing = await db.coachingFeeRecord.findUnique({
      where: { enrollmentId_feeMonth: { enrollmentId: enrollment.id, feeMonth: month } },
    })
    if (existing) { skipped++; continue }

    const baseAmount = Number(enrollment.effectiveFee)
    // taxRate defaults to 0 (small institutes exempt under ₹20L) but can be
    // passed by GST-registered institutes generating this month's fees.
    const taxAmount = calculateTax(baseAmount, taxRate)

    await db.coachingFeeRecord.create({
      data: {
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        batchId: enrollment.batchId,
        feeMonth: month,
        dueDate,
        baseAmount,
        taxRate,
        taxAmount,
        amountDue: roundCurrency(baseAmount + taxAmount),
        status: 'PENDING',
      },
    })
    created++
  }

  if (created > 0) {
    await db.auditLog.create({ data: { action: 'GENERATED', entityType: 'CoachingFeeRecord', entityId: month, newValue: JSON.stringify({ month, created }) } }).catch(() => {})
  }
  return { success: true, data: { created, skipped, total: eligible.length } }
}

export async function listFees(filters?: {
  month?: string
  status?: string
  batchId?: string
  studentId?: string
}) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.month) where.feeMonth = filters.month
  if (filters?.status) where.status = filters.status
  if (filters?.batchId) where.batchId = filters.batchId
  if (filters?.studentId) where.studentId = filters.studentId

  const records = await db.coachingFeeRecord.findMany({
    where,
    include: {
      enrollment: {
        include: {
          student: { select: { id: true, customerName: true, phone: true } },
          batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
        },
      },
    },
    orderBy: [{ feeMonth: 'desc' }, { enrollment: { student: { customerName: 'asc' } } }],
  })
  return { success: true, data: records.map(serializeFeeRecord) }
}

export async function getFeeKPIs(month: string) {
  const db = getPrisma()
  const records = await db.coachingFeeRecord.findMany({
    where: { feeMonth: month },
  })

  const totalDue = sumCurrency(records.map((r) => Number(r.amountDue)))
  const totalReceived = sumCurrency(records.map((r) => Number(r.amountReceived)))
  const pendingCount = records.filter((r) => r.status === 'PENDING').length
  const partialCount = records.filter((r) => r.status === 'PARTIAL').length
  const paidCount = records.filter((r) => r.status === 'PAID').length
  const waivedCount = records.filter((r) => r.status === 'WAIVED').length

  return {
    success: true,
    data: { totalDue, totalReceived, pendingCount, partialCount, paidCount, waivedCount, total: records.length },
  }
}

export async function updateFeeRecord(payload: {
  id: string
  amountReceived?: number
  status?: string
  paidDate?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const existing = await db.coachingFeeRecord.findUnique({ where: { id: payload.id } })
  if (!existing) return { success: false, error: { code: 'FEE-001', message: 'Fee record not found.' } }

  // Auto-derive status from amount if amountReceived is provided but status is not
  let status = payload.status ?? existing.status
  if (payload.amountReceived !== undefined && payload.status === undefined) {
    const received = payload.amountReceived
    const due = Number(existing.amountDue)
    if (received <= 0) status = 'PENDING'
    else if (received >= due) status = 'PAID'
    else status = 'PARTIAL'
  }

  const paidDate =
    payload.paidDate !== undefined
      ? payload.paidDate ? new Date(payload.paidDate) : null
      : status === 'PAID' && existing.status !== 'PAID'
      ? new Date()
      : existing.paidDate

  const record = await db.coachingFeeRecord.update({
    where: { id: payload.id },
    data: {
      ...(payload.amountReceived !== undefined ? { amountReceived: payload.amountReceived } : {}),
      status,
      paidDate,
      ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    },
    include: {
      enrollment: {
        include: {
          student: { select: { id: true, customerName: true } },
          batch: { select: { id: true, batchName: true } },
        },
      },
    },
  })
  const auditAction = status === 'PAID' ? 'PAID' : 'UPDATE'
  await db.auditLog.create({ data: { action: auditAction, entityType: 'CoachingFeeRecord', entityId: record.id } }).catch(() => {})

  // Before this, a fee record marked PAID never created a real Invoice — fee
  // collections were a shadow ledger invisible to Sales Report/Tax Report/
  // GSTR-1. Generate exactly one invoice, the first time a record reaches
  // PAID, for the record's full amountDue (not per-partial-payment — the
  // shadow ledger stays the source of truth for collection tracking,
  // Invoice is the one-time GST-compliant billing record for the month).
  let invoiceId: string | null = (record as { invoiceId?: string | null }).invoiceId ?? null
  if (status === 'PAID' && existing.status !== 'PAID' && !invoiceId) {
    const claim = await db.coachingFeeRecord.updateMany({
      where: { id: payload.id, invoiceId: null },
      data: { invoiceId: 'PENDING_INVOICE_GENERATION' },
    })
    if (claim.count > 0) {
      try {
        let product = await db.product.findFirst({ where: { hsnCode: '999293', isActive: true } })
        if (!product) {
          product = await db.product.create({
            data: { productName: 'Coaching / Tuition Fee', productType: 'SERVICE', hsnCode: '999293', sellingPrice: 0, taxRate: 0, unit: 'NOS', isActive: true },
          })
        }
        const result = await billingService.createInvoice({
          customerId: record.enrollment.student.id,
          paymentMethod: 'CASH',
          gstType: 'CGST_SGST',
          items: [{
            productId: product.id,
            quantity: 1,
            unitPrice: Number(existing.baseAmount),
            taxRate: Number(existing.taxRate),
          }],
          notes: `Coaching fee: ${record.enrollment.batch.batchName} — ${existing.feeMonth}`,
          referenceNumber: payload.id.slice(0, 12),
        })
        if (result.success) {
          const invoice = result.data as { id: string }
          invoiceId = invoice.id
          await db.coachingFeeRecord.update({ where: { id: payload.id }, data: { invoiceId: invoice.id } })
        } else {
          await db.coachingFeeRecord.update({ where: { id: payload.id }, data: { invoiceId: null } })
        }
      } catch {
        await db.coachingFeeRecord.update({ where: { id: payload.id }, data: { invoiceId: null } }).catch(() => {})
      }
    }
  }

  return { success: true, data: { ...serializeFeeRecord(record), invoiceId } }
}
