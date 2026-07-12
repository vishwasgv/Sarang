import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import * as svc from '../../services/blood-bank.service'
import {
  CreateDonorSchema,
  UpdateDonorSchema,
  DonorIdSchema,
  SendDonorRecallSchema,
  CreateDonationCampSchema,
  CreateDonationRecordSchema,
  UpdateScreeningStatusSchema,
  CreateBloodIssueSchema,
  BloodIssueIdSchema,
} from '../../validation/blood-bank.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('bloodBank:createDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const parsed = CreateDonorSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.createDonor(parsed.data, session?.userId)
  })

  handle('bloodBank:listDonors', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listDonors(payload as Parameters<typeof svc.listDonors>[0])
  })

  handle('bloodBank:getDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getDonor(id)
  })

  handle('bloodBank:updateDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const parsed = UpdateDonorSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.updateDonor(parsed.data, session?.userId)
  })

  handle('bloodBank:deactivateDonor', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const parsed = DonorIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.deactivateDonor(parsed.data.id, session?.userId)
  })

  handle('bloodBank:sendDonorRecall', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const parsed = SendDonorRecallSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.sendDonorRecall(parsed.data.donorId)
  })

  handle('bloodBank:createDonationCamp', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const parsed = CreateDonationCampSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.createDonationCamp(parsed.data, session?.userId)
  })

  handle('bloodBank:listDonationCamps', async () => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listDonationCamps()
  })

  handle('bloodBank:createDonationRecord', async (payload) => {
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const parsed = CreateDonationRecordSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.createDonationRecord(parsed.data, session?.userId)
  })

  handle('bloodBank:listDonationRecords', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listDonationRecords(payload as Parameters<typeof svc.listDonationRecords>[0])
  })

  handle('bloodBank:updateScreeningStatus', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const parsed = UpdateScreeningStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.updateScreeningStatus(parsed.data, session?.userId)
  })

  handle('bloodBank:getBloodStock', async () => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.getBloodStock()
  })

  handle('bloodBank:checkCompatibilityBatch', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.checkCompatibilityBatch(payload as Parameters<typeof svc.checkCompatibilityBatch>[0])
  })

  handle('bloodBank:createIssue', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const parsed = CreateBloodIssueSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.createBloodIssue(parsed.data, session?.userId)
  })

  handle('bloodBank:listIssues', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    return svc.listBloodIssues(payload as Parameters<typeof svc.listBloodIssues>[0])
  })

  handle('bloodBank:getIssue', async (payload) => {
    const deny = await requirePermission('bloodBank.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getBloodIssue(id)
  })

  handle('bloodBank:cancelIssue', async (payload) => {
    const deny = await requirePermission('bloodBank.manage'); if (deny) return deny
    const parsed = BloodIssueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return svc.cancelBloodIssue(parsed.data.id, session?.userId)
  })

  handle('bloodBank:generateIssueInvoice', async (payload) => {
    // Routine front-desk billing once units are already issued — matches the
    // labOrders/appointments precedent of gating invoice generation on the
    // create-level permission, not manage. See seed.ts's Cashier grant.
    const deny = await requirePermission('bloodBank.create'); if (deny) return deny
    const parsed = BloodIssueIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.generateBloodIssueInvoice(parsed.data.id)
  })
}
