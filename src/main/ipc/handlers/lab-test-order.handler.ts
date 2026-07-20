import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import * as svc from '../../services/lab-test-order.service'
import {
  CreateLabTestOrderSchema, UpdateLabTestOrderSchema, AddTestItemSchema, RemoveTestItemSchema,
  MarkSampleCollectedSchema, UpdateTestResultSchema, FinalizeReportSchema, LabTestOrderIdSchema,
  CancelLabTestOrderSchema, AcknowledgeCriticalResultSchema,
} from '../../validation/lab-test-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('labTestOrders:list', async (payload) => {
    const deny = await requirePermission('labOrders.view'); if (deny) return deny
    return svc.listLabTestOrders(payload as Parameters<typeof svc.listLabTestOrders>[0])
  })

  handle('labTestOrders:get', async (payload) => {
    const deny = await requirePermission('labOrders.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getLabTestOrder(id)
  })

  handle('labTestOrders:create', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const parsed = CreateLabTestOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.createLabTestOrder(parsed.data, session?.userId)
  })

  handle('labTestOrders:update', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const parsed = UpdateLabTestOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.updateLabTestOrder(parsed.data, session?.userId)
  })

  handle('labTestOrders:addItem', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const parsed = AddTestItemSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.addTestItem(parsed.data, session?.userId)
  })

  handle('labTestOrders:removeItem', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const parsed = RemoveTestItemSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.removeTestItem(parsed.data.itemId, session?.userId)
  })

  handle('labTestOrders:markSampleCollected', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const parsed = MarkSampleCollectedSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.markSampleCollected(parsed.data, session?.userId)
  })

  handle('labTestOrders:updateResult', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const parsed = UpdateTestResultSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.updateTestResult(parsed.data, session?.userId)
  })

  handle('labTestOrders:finalizeReport', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const parsed = FinalizeReportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.finalizeReport(parsed.data, session?.userId)
  })

  handle('labTestOrders:markDelivered', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const parsed = LabTestOrderIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.markDelivered(parsed.data.id, session?.userId)
  })

  handle('labTestOrders:cancel', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const parsed = CancelLabTestOrderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.cancelLabTestOrder(parsed.data, session?.userId)
  })

  handle('labTestOrders:delete', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const parsed = LabTestOrderIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.deleteLabTestOrder(parsed.data.id, session?.userId)
  })

  // Phase 58 §2 — critical/panic-value escalation workflow.
  handle('labTestOrders:acknowledgeCritical', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const parsed = AcknowledgeCriticalResultSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.acknowledgeCriticalResult(parsed.data, session?.userId)
  })

  handle('labTestOrders:listPendingCriticalEscalations', async () => {
    const deny = await requirePermission('labOrders.view'); if (deny) return deny
    return svc.listPendingCriticalEscalations()
  })

  handle('labTestOrders:generateInvoice', async (payload) => {
    // Routine front-desk billing, not lab-technician-level trust — matches
    // appointments:generateInvoice gating on billing.createInvoice (Cashier
    // holds it), not a manage-tier permission. See seed.ts's Cashier grant
    // comment: Cashier can register orders AND hand over/bill a finalized one.
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const parsed = LabTestOrderIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.generateLabTestOrderInvoice(parsed.data.id)
  })
}
