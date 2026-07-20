import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { logAction } from './audit.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]
type Db = ReturnType<typeof getPrisma>

export type LabOrderStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROCESS' | 'REPORTED' | 'DELIVERED' | 'CANCELLED'
export type LabItemStatus = 'PENDING' | 'COLLECTED' | 'RESULT_READY' | 'REPORTED'
export type SampleType = 'BLOOD' | 'URINE' | 'STOOL' | 'SWAB' | 'IMAGING' | 'OTHER'

export interface ResultParameter {
  parameter: string
  value: string
  unit?: string
  referenceRange?: string
  // Phase 58 §2 — CRITICAL is a real panic-value tier distinct from HIGH/LOW,
  // auto-suggested by normalRange.evaluate when a test's saved reference has
  // criticalLow/criticalHigh configured, same as LOW/NORMAL/HIGH already are.
  flag?: 'LOW' | 'NORMAL' | 'HIGH' | 'ABNORMAL' | 'CRITICAL'
}

// Numeric-max sequence, not orderBy on the string column — string-sorting
// "...-10000" lands before "...-9999" lexicographically, the exact
// past-9999-per-month bug this project already hit once in
// logistics-counter.service.ts. Scoped to LabTestOrder only rather than
// extending that file, which is deliberately logistics-specific.
async function nextLabOrderNumber(tx: TxClient): Promise<string> {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const prefix = `LAB-${yyyymm}-`
  const rows = await tx.labTestOrder.findMany({ where: { orderNumber: { startsWith: prefix } }, select: { orderNumber: true } })
  let seq = 1
  if (rows.length > 0) {
    const maxSeq = rows.reduce((max, r) => {
      const n = parseInt(r.orderNumber.slice(prefix.length), 10)
      return isNaN(n) ? max : Math.max(max, n)
    }, 0)
    seq = maxSeq + 1
  }
  return `${prefix}${String(seq).padStart(4, '0')}`
}

export interface CreateLabTestOrderItemInput {
  serviceCatalogId?: string
  testName: string
  category?: string
  sampleType?: SampleType
  price?: number
}

export interface CreateLabTestOrderInput {
  customerId?: string
  patientName: string
  patientAge?: string
  appointmentId?: string
  referredByProviderId?: string
  referringNotes?: string
  notes?: string
  items: CreateLabTestOrderItemInput[]
}

export async function createLabTestOrder(payload: CreateLabTestOrderInput, userId?: string) {
  const db = getPrisma()
  try {
    if (!payload.patientName?.trim()) {
      return { success: false, error: { code: 'LAB-001', message: 'Patient name is required.' } }
    }
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: { code: 'LAB-002', message: 'Select at least one test or panel.' } }
    }
    for (const item of payload.items) {
      if (!item.testName?.trim()) {
        return { success: false, error: { code: 'LAB-003', message: 'Every ordered test needs a name.' } }
      }
    }

    const order = await db.$transaction(async (tx) => {
      const orderNumber = await nextLabOrderNumber(tx)
      const totalAmount = payload.items.reduce((sum, i) => sum + (i.price ?? 0), 0)
      return tx.labTestOrder.create({
        data: {
          orderNumber,
          customerId: payload.customerId,
          patientName: payload.patientName.trim(),
          patientAge: payload.patientAge,
          appointmentId: payload.appointmentId,
          referredByProviderId: payload.referredByProviderId,
          referringNotes: payload.referringNotes,
          notes: payload.notes,
          totalAmount,
          createdBy: userId ?? 'system',
          items: {
            create: payload.items.map((i) => ({
              serviceCatalogId: i.serviceCatalogId,
              testName: i.testName.trim(),
              category: i.category,
              sampleType: i.sampleType ?? 'BLOOD',
              price: i.price ?? 0,
            })),
          },
        },
        include: { items: true },
      })
    })

    await logAction(userId, 'LAB_ORDER_CREATED', 'LabTestOrder', order.id, undefined, { orderNumber: order.orderNumber, patientName: order.patientName })
    return { success: true, data: order }
  } catch (err) {
    return { success: false, error: { code: 'LAB-004', message: err instanceof Error ? err.message : 'Could not create lab test order.' } }
  }
}

export async function listLabTestOrders(payload?: {
  status?: LabOrderStatus
  customerId?: string
  search?: string
  page?: number
  limit?: number
}) {
  const db = getPrisma()
  try {
    const page = payload?.page ?? 1
    const limit = payload?.limit ?? 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.customerId) where.customerId = payload.customerId
    if (payload?.search) {
      where.OR = [
        { patientName: { contains: payload.search } },
        { orderNumber: { contains: payload.search } },
      ]
    }

    const [orders, total] = await Promise.all([
      db.labTestOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, customer: { select: { customerName: true } } },
      }),
      db.labTestOrder.count({ where }),
    ])

    return { success: true, data: { orders, total } }
  } catch (err) {
    return { success: false, error: { code: 'LAB-005', message: err instanceof Error ? err.message : 'Could not list lab test orders.' } }
  }
}

export async function getLabTestOrder(id: string) {
  const db = getPrisma()
  try {
    const order = await db.labTestOrder.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
        appointment: true,
        referredByProvider: { select: { id: true, fullName: true, designation: true } },
        sampleCollectedBy: { select: { id: true, fullName: true } },
        reportedBy: { select: { id: true, fullName: true } },
      },
    })
    if (!order) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    return { success: true, data: order }
  } catch (err) {
    return { success: false, error: { code: 'LAB-007', message: err instanceof Error ? err.message : 'Could not load lab test order.' } }
  }
}

export async function updateLabTestOrder(payload: {
  id: string
  customerId?: string | null
  patientName?: string
  patientAge?: string | null
  referredByProviderId?: string | null
  referringNotes?: string | null
  notes?: string | null
}, userId?: string) {
  const db = getPrisma()
  try {
    const existing = await db.labTestOrder.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    if (existing.status === 'CANCELLED' || existing.status === 'DELIVERED') {
      return { success: false, error: { code: 'LAB-008', message: `Cannot edit an order that is already ${existing.status.toLowerCase()}.` } }
    }
    if (payload.patientName !== undefined && !payload.patientName.trim()) {
      return { success: false, error: { code: 'LAB-001', message: 'Patient name is required.' } }
    }

    const updated = await db.labTestOrder.update({
      where: { id: payload.id },
      data: {
        customerId: payload.customerId,
        patientName: payload.patientName?.trim(),
        patientAge: payload.patientAge,
        referredByProviderId: payload.referredByProviderId,
        referringNotes: payload.referringNotes,
        notes: payload.notes,
      },
      include: { items: true },
    })
    await logAction(userId, 'LAB_ORDER_UPDATED', 'LabTestOrder', updated.id)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'LAB-009', message: err instanceof Error ? err.message : 'Could not update lab test order.' } }
  }
}

export async function addTestItem(payload: { labTestOrderId: string } & CreateLabTestOrderItemInput, userId?: string) {
  const db = getPrisma()
  try {
    if (!payload.testName?.trim()) return { success: false, error: { code: 'LAB-003', message: 'Test name is required.' } }
    const order = await db.labTestOrder.findUnique({ where: { id: payload.labTestOrderId } })
    if (!order) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    if (order.status !== 'ORDERED') {
      return { success: false, error: { code: 'LAB-010', message: 'Tests can only be added before the sample is collected.' } }
    }

    const price = payload.price ?? 0
    const [item] = await db.$transaction([
      db.labTestOrderItem.create({
        data: {
          labTestOrderId: payload.labTestOrderId,
          serviceCatalogId: payload.serviceCatalogId,
          testName: payload.testName.trim(),
          category: payload.category,
          sampleType: payload.sampleType ?? 'BLOOD',
          price,
        },
      }),
      db.labTestOrder.update({ where: { id: payload.labTestOrderId }, data: { totalAmount: { increment: price } } }),
    ])
    await logAction(userId, 'LAB_ORDER_ITEM_ADDED', 'LabTestOrder', payload.labTestOrderId, undefined, { testName: item.testName })
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'LAB-011', message: err instanceof Error ? err.message : 'Could not add test.' } }
  }
}

export async function removeTestItem(itemId: string, userId?: string) {
  const db = getPrisma()
  try {
    const item = await db.labTestOrderItem.findUnique({ where: { id: itemId }, include: { labTestOrder: true } })
    if (!item) return { success: false, error: { code: 'LAB-012', message: 'Test item not found.' } }
    if (item.labTestOrder.status !== 'ORDERED') {
      return { success: false, error: { code: 'LAB-010', message: 'Tests can only be removed before the sample is collected.' } }
    }
    const remainingCount = await db.labTestOrderItem.count({ where: { labTestOrderId: item.labTestOrderId } })
    if (remainingCount <= 1) {
      return { success: false, error: { code: 'LAB-013', message: 'An order must have at least one test — cancel the whole order instead.' } }
    }

    await db.$transaction([
      db.labTestOrderItem.delete({ where: { id: itemId } }),
      db.labTestOrder.update({ where: { id: item.labTestOrderId }, data: { totalAmount: { decrement: item.price } } }),
    ])
    await logAction(userId, 'LAB_ORDER_ITEM_REMOVED', 'LabTestOrder', item.labTestOrderId, undefined, { testName: item.testName })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'LAB-014', message: err instanceof Error ? err.message : 'Could not remove test.' } }
  }
}

export async function markSampleCollected(payload: { id: string; collectedById?: string }, userId?: string) {
  const db = getPrisma()
  try {
    const order = await db.labTestOrder.findUnique({ where: { id: payload.id } })
    if (!order) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    if (order.status !== 'ORDERED') {
      return { success: false, error: { code: 'LAB-015', message: 'Sample has already been collected for this order.' } }
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.labTestOrderItem.updateMany({ where: { labTestOrderId: payload.id, status: 'PENDING' }, data: { status: 'COLLECTED' } })
      return tx.labTestOrder.update({
        where: { id: payload.id },
        data: { status: 'SAMPLE_COLLECTED', sampleCollectedAt: new Date(), sampleCollectedById: payload.collectedById },
        include: { items: true },
      })
    })
    await logAction(userId, 'LAB_ORDER_SAMPLE_COLLECTED', 'LabTestOrder', payload.id)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'LAB-016', message: err instanceof Error ? err.message : 'Could not record sample collection.' } }
  }
}

export async function updateTestResult(payload: {
  itemId: string
  resultParameters?: ResultParameter[]
  resultSummary?: string | null
}, userId?: string) {
  const db = getPrisma()
  try {
    const item = await db.labTestOrderItem.findUnique({ where: { id: payload.itemId }, include: { labTestOrder: true } })
    if (!item) return { success: false, error: { code: 'LAB-012', message: 'Test item not found.' } }
    // REPORTED is included here (not just CANCELLED/DELIVERED) — once a
    // report is finalized, results are locked. Without this, editing a
    // REPORTED item's result flips it back to RESULT_READY while the order
    // stays REPORTED (finalizeReport unconditionally refuses an already-
    // REPORTED order), permanently desyncing order/item status with no way
    // to re-finalize and reflect the correction.
    if (item.labTestOrder.status === 'CANCELLED' || item.labTestOrder.status === 'DELIVERED' || item.labTestOrder.status === 'REPORTED') {
      return { success: false, error: { code: 'LAB-008', message: `Cannot edit results on an order that is already ${item.labTestOrder.status.toLowerCase()}.` } }
    }
    if (item.labTestOrder.status === 'ORDERED') {
      return { success: false, error: { code: 'LAB-017', message: 'Collect the sample before entering results.' } }
    }

    // Phase 58 §2 — a cached, derived flag so a pending-escalation dashboard
    // never has to parse the resultParameters JSON of every item. Only
    // recomputed when resultParameters is actually part of THIS save (a
    // resultSummary-only edit leaves whatever critical state was already there).
    const hasCriticalResult = payload.resultParameters
      ? payload.resultParameters.some((p) => p.flag === 'CRITICAL')
      : undefined

    const updated = await db.labTestOrderItem.update({
      where: { id: payload.itemId },
      data: {
        resultParameters: payload.resultParameters ? JSON.stringify(payload.resultParameters) : undefined,
        resultSummary: payload.resultSummary,
        status: 'RESULT_READY',
        ...(hasCriticalResult !== undefined ? { hasCriticalResult } : {}),
      },
    })

    // Order moves from SAMPLE_COLLECTED to IN_PROCESS the first time any
    // result is entered, giving front-desk visibility that work has started
    // without waiting for every test to finish.
    if (item.labTestOrder.status === 'SAMPLE_COLLECTED') {
      await db.labTestOrder.update({ where: { id: item.labTestOrderId }, data: { status: 'IN_PROCESS' } })
    }

    await logAction(userId, 'LAB_ORDER_RESULT_ENTERED', 'LabTestOrder', item.labTestOrderId, undefined, { testName: item.testName })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'LAB-018', message: err instanceof Error ? err.message : 'Could not save test result.' } }
  }
}

// Phase 58 §2 — the escalation workflow itself: recording that the
// referring doctor was actually called about a critical/panic result, not
// just flagging it. Idempotent-ish in spirit (a second call just overwrites
// the notified stamp with the newer one) rather than erroring, since a real
// lab might legitimately need to re-confirm a call was made.
export async function acknowledgeCriticalResult(payload: {
  itemId: string
  notifiedById?: string
  notes?: string
}, userId?: string) {
  const db = getPrisma()
  try {
    const item = await db.labTestOrderItem.findUnique({ where: { id: payload.itemId } })
    if (!item) return { success: false, error: { code: 'LAB-019', message: 'Test item not found.' } }
    if (!item.hasCriticalResult) return { success: false, error: { code: 'LAB-020', message: 'This item has no critical result to acknowledge.' } }

    const updated = await db.labTestOrderItem.update({
      where: { id: payload.itemId },
      data: {
        criticalNotifiedAt: new Date(),
        criticalNotifiedById: payload.notifiedById ?? null,
        criticalNotifiedNotes: payload.notes ?? null,
      },
    })

    await logAction(userId, 'LAB_ORDER_CRITICAL_ACKNOWLEDGED', 'LabTestOrder', item.labTestOrderId, undefined, { testName: item.testName })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'LAB-021', message: err instanceof Error ? err.message : 'Could not record critical-result acknowledgement.' } }
  }
}

// Escalation dashboard/alert source: every critical result that hasn't yet
// had the "doctor was called" step recorded, most recent first.
export async function listPendingCriticalEscalations() {
  try {
    const db = getPrisma()
    const items = await db.labTestOrderItem.findMany({
      where: { hasCriticalResult: true, criticalNotifiedAt: null },
      include: {
        labTestOrder: { select: { orderNumber: true, patientName: true, customerId: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'LAB-022', message: err instanceof Error ? err.message : 'Could not list pending critical escalations.' } }
  }
}

export async function finalizeReport(payload: { id: string; reportedById?: string }, userId?: string) {
  const db = getPrisma()
  try {
    const order = await db.labTestOrder.findUnique({ where: { id: payload.id }, include: { items: true } })
    if (!order) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED' || order.status === 'REPORTED') {
      return { success: false, error: { code: 'LAB-008', message: `This order is already ${order.status.toLowerCase()}.` } }
    }
    if (order.status === 'ORDERED') {
      return { success: false, error: { code: 'LAB-017', message: 'Collect the sample before finalizing a report.' } }
    }
    const notReady = order.items.filter((i) => i.status !== 'RESULT_READY')
    if (notReady.length > 0) {
      return { success: false, error: { code: 'LAB-019', message: `Enter results for every test before finalizing (${notReady.length} pending).` } }
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.labTestOrderItem.updateMany({ where: { labTestOrderId: payload.id }, data: { status: 'REPORTED' } })
      return tx.labTestOrder.update({
        where: { id: payload.id },
        data: { status: 'REPORTED', reportedAt: new Date(), reportedById: payload.reportedById },
        include: { items: true },
      })
    })
    await logAction(userId, 'LAB_ORDER_FINALIZED', 'LabTestOrder', payload.id)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'LAB-020', message: err instanceof Error ? err.message : 'Could not finalize report.' } }
  }
}

export async function markDelivered(id: string, userId?: string) {
  const db = getPrisma()
  try {
    const order = await db.labTestOrder.findUnique({ where: { id } })
    if (!order) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    if (order.status !== 'REPORTED') {
      return { success: false, error: { code: 'LAB-021', message: 'Only a finalized report can be marked delivered.' } }
    }
    const updated = await db.labTestOrder.update({ where: { id }, data: { status: 'DELIVERED' } })
    await logAction(userId, 'LAB_ORDER_DELIVERED', 'LabTestOrder', id)
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'LAB-022', message: err instanceof Error ? err.message : 'Could not mark order delivered.' } }
  }
}

export async function cancelLabTestOrder(payload: { id: string; reason?: string }, userId?: string) {
  const db = getPrisma()
  try {
    const order = await db.labTestOrder.findUnique({ where: { id: payload.id } })
    if (!order) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      return { success: false, error: { code: 'LAB-008', message: `This order is already ${order.status.toLowerCase()}.` } }
    }
    if (order.invoiceId) {
      return { success: false, error: { code: 'LAB-023', message: 'This order has already been invoiced — void or credit the invoice first.' } }
    }
    const updated = await db.labTestOrder.update({
      where: { id: payload.id },
      data: { status: 'CANCELLED', notes: payload.reason ? `${order.notes ? order.notes + ' | ' : ''}Cancelled: ${payload.reason}` : order.notes },
    })
    await logAction(userId, 'LAB_ORDER_CANCELLED', 'LabTestOrder', payload.id, order.status, 'CANCELLED')
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'LAB-024', message: err instanceof Error ? err.message : 'Could not cancel lab test order.' } }
  }
}

export async function deleteLabTestOrder(id: string, userId?: string) {
  const db = getPrisma()
  try {
    const order = await db.labTestOrder.findUnique({ where: { id } })
    if (!order) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
    if (order.status !== 'ORDERED') {
      return { success: false, error: { code: 'LAB-025', message: 'Only an order with no sample collected yet can be deleted — cancel it instead.' } }
    }
    if (order.invoiceId) {
      return { success: false, error: { code: 'LAB-023', message: 'This order has already been invoiced.' } }
    }
    await db.labTestOrder.delete({ where: { id } })
    await logAction(userId, 'LAB_ORDER_DELETED', 'LabTestOrder', id, order.status, undefined)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'LAB-026', message: err instanceof Error ? err.message : 'Could not delete lab test order.' } }
  }
}

// ─── Invoicing ────────────────────────────────────────────────────────────────
// Same atomic-claim-sentinel pattern as appointment.service.ts's
// generateAppointmentInvoice (see its comment for the full race-condition
// rationale) — prevents two near-simultaneous clicks from both passing the
// invoiceId-is-null check and creating two invoices for one order.
const LAB_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

async function findOrCreateTestProduct(db: Db, testName: string, sacCode: string | null, taxRate: number) {
  let product = await db.product.findFirst({ where: { hsnCode: sacCode, productName: testName, isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName: testName, productType: 'SERVICE', hsnCode: sacCode, sellingPrice: 0, taxRate, unit: 'NOS', isActive: true },
    })
  }
  return product
}

export async function generateLabTestOrderInvoice(id: string) {
  const db = getPrisma()
  try {
    const claim = await db.labTestOrder.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: LAB_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.labTestOrder.findUnique({ where: { id }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
      return { success: false, error: { code: 'LAB-027', message: 'Invoice already generated for this order.' } }
    }

    try {
      const order = await db.labTestOrder.findUnique({ where: { id }, include: { items: true } })
      if (!order) {
        await db.labTestOrder.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'LAB-006', message: 'Lab test order not found.' } }
      }
      if (order.status === 'CANCELLED') {
        await db.labTestOrder.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'LAB-028', message: 'Cannot invoice a cancelled order.' } }
      }
      if (!order.customerId) {
        await db.labTestOrder.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'LAB-013', message: 'Link this order to a customer record before generating an invoice.' } }
      }
      if (order.items.some((i) => i.price <= 0)) {
        await db.labTestOrder.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'LAB-014', message: 'Set a price greater than zero for every test before generating an invoice.' } }
      }

      const items: { productId: string; quantity: number; unitPrice: number; taxRate: number }[] = []
      for (const item of order.items) {
        let taxRate = 0
        let sacCode: string | null = null
        if (item.serviceCatalogId) {
          const sc = await db.serviceCatalog.findUnique({ where: { id: item.serviceCatalogId } })
          if (sc) { taxRate = sc.taxRate; sacCode = sc.sacCode }
        }
        const product = await findOrCreateTestProduct(db, item.testName, sacCode, taxRate)
        items.push({ productId: product.id, quantity: 1, unitPrice: item.price, taxRate })
      }

      const result = await billingService.createInvoice({
        customerId: order.customerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items,
        notes: `Lab Order ${order.orderNumber} — ${order.patientName}`,
        referenceNumber: id.slice(0, 12),
      })
      if (!result.success) {
        await db.labTestOrder.update({ where: { id }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.labTestOrder.update({ where: { id }, data: { invoiceId: invoice.id } })
      await logAction(undefined, 'LAB_ORDER_INVOICED', 'LabTestOrder', id, undefined, { invoiceId: invoice.id })

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.labTestOrder.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'LAB-029', message: err instanceof Error ? err.message : 'Could not generate invoice.' } }
  }
}
