import { listJobCards, createJobCard, updateJobCard, deleteJobCard, generateJobCardInvoice, listJobCardParts, addJobCardPart, removeJobCardPart } from '../../services/job-card.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateJobCardSchema, UpdateJobCardSchema, DeleteJobCardSchema, AddJobCardPartSchema, JobCardPartIdSchema, ListJobCardPartsSchema } from '../../validation/job-card.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('jobCards:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listJobCards(payload as Parameters<typeof listJobCards>[0])
  })

  handle('jobCards:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = CreateJobCardSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createJobCard(parsed.data, getCurrentSession()?.userId)
  })

  handle('jobCards:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = UpdateJobCardSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateJobCard(parsed.data, getCurrentSession()?.userId)
  })

  handle('jobCards:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = DeleteJobCardSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteJobCard(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('jobCards:generateInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteJobCardSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateJobCardInvoice(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('jobCards:listParts', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const parsed = ListJobCardPartsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listJobCardParts(parsed.data.jobCardId)
  })

  handle('jobCards:addPart', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = AddJobCardPartSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addJobCardPart(parsed.data, getCurrentSession()?.userId)
  })

  handle('jobCards:removePart', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = JobCardPartIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return removeJobCardPart(parsed.data.id, getCurrentSession()?.userId)
  })
}
