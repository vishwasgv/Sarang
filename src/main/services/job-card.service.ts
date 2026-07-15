import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber, SequenceContendedError } from './sequence.service'

export interface JobCardRecord {
  id: string
  jobNumber: string
  title: string
  itemDescription: string | null
  status: 'RECEIVED' | 'DIAGNOSING' | 'IN_REPAIR' | 'PENDING_PARTS' | 'READY' | 'DELIVERED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  customerId: string | null
  customerName: string | null
  assignedToId: string | null
  assignedToName: string | null
  estimatedCost: number
  actualCost: number
  receivedDate: string
  expectedDate: string | null
  deliveredDate: string | null
  notes: string | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

function toRecord(j: any): JobCardRecord {
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    title: j.title,
    itemDescription: j.itemDescription ?? null,
    status: j.status,
    priority: j.priority,
    customerId: j.customerId ?? null,
    customerName: j.customer?.customerName ?? null,
    assignedToId: j.assignedToId ?? null,
    assignedToName: j.assignedTo?.fullName ?? null,
    estimatedCost: j.estimatedCost,
    actualCost: j.actualCost,
    receivedDate: new Date(j.receivedDate).toISOString(),
    expectedDate: j.expectedDate ? new Date(j.expectedDate).toISOString() : null,
    deliveredDate: j.deliveredDate ? new Date(j.deliveredDate).toISOString() : null,
    notes: j.notes ?? null,
    internalNotes: j.internalNotes ?? null,
    createdAt: new Date(j.createdAt).toISOString(),
    updatedAt: new Date(j.updatedAt).toISOString()
  }
}

const include = {
  customer: { select: { customerName: true } },
  assignedTo: { select: { fullName: true } }
}

export async function listJobCards(payload?: {
  status?: string
  customerId?: string
  limit?: number
}): Promise<{ success: boolean; data?: { jobCards: JobCardRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.customerId) where.customerId = payload.customerId

    const rows = await db.jobCard.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: payload?.limit ?? 200
    })
    return { success: true, data: { jobCards: rows.map(toRecord), total: rows.length } }
  } catch (e: any) {
    console.error('[JC_LIST_FAIL]', e)
    return { success: false, error: { code: 'JC_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createJobCard(payload: {
  title: string
  itemDescription?: string
  priority?: string
  customerId?: string
  assignedToId?: string
  estimatedCost?: number
  expectedDate?: string
  notes?: string
  internalNotes?: string
}, userId?: string): Promise<{ success: boolean; data?: JobCardRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.$transaction(async (tx) => {
      const jobNumber = await generateSequenceNumber(
        tx, 'job_card_number_sequence', 'JOB', 5,
        async () => {
          const last = await tx.jobCard.findFirst({ orderBy: { createdAt: 'desc' }, select: { jobNumber: true } })
          return last ? parseInt(last.jobNumber.replace('JOB-', ''), 10) : 0
        }
      )
      return tx.jobCard.create({
        data: {
          jobNumber,
          title: payload.title,
          itemDescription: payload.itemDescription ?? null,
          priority: payload.priority ?? 'MEDIUM',
          customerId: payload.customerId ?? null,
          assignedToId: payload.assignedToId ?? null,
          estimatedCost: payload.estimatedCost ?? 0,
          expectedDate: payload.expectedDate ? new Date(payload.expectedDate) : null,
          notes: payload.notes ?? null,
          internalNotes: payload.internalNotes ?? null,
          createdById: userId ?? null
        },
        include
      })
    })

    if (userId) await logAction(userId, 'CREATE', 'JOB_CARD', row.id, null, { jobNumber: row.jobNumber, title: payload.title })
    return { success: true, data: toRecord(row) }
  } catch (e: unknown) {
    // Was `message: e.message` — leaked the raw Prisma unique-constraint
    // text (or now SequenceContendedError's message) straight to the user
    // instead of a normal "please try again" message, unlike every other
    // service's catch-all convention.
    if (e instanceof SequenceContendedError) {
      return { success: false, error: { code: 'JC-002', message: 'The system is busy creating another job card right now. Please try again in a moment.' } }
    }
    return { success: false, error: { code: 'JC_CREATE_FAIL', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateJobCard(payload: {
  id: string
  title?: string
  itemDescription?: string
  status?: string
  priority?: string
  customerId?: string | null
  assignedToId?: string | null
  estimatedCost?: number
  actualCost?: number
  expectedDate?: string | null
  deliveredDate?: string | null
  notes?: string
  internalNotes?: string
}, userId?: string): Promise<{ success: boolean; data?: JobCardRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const old = await db.jobCard.findUnique({ where: { id: payload.id }, select: { status: true, jobNumber: true } })
    if (!old) return { success: false, error: { code: 'JC_NOT_FOUND', message: 'Job card not found' } }

    const data: Record<string, unknown> = {}
    if (payload.title !== undefined) data.title = payload.title
    if (payload.itemDescription !== undefined) data.itemDescription = payload.itemDescription
    if (payload.status !== undefined) {
      data.status = payload.status
      if (payload.status === 'DELIVERED' && old.status !== 'DELIVERED') data.deliveredDate = new Date()
    }
    if (payload.priority !== undefined) data.priority = payload.priority
    if ('customerId' in payload) data.customerId = payload.customerId ?? null
    if ('assignedToId' in payload) data.assignedToId = payload.assignedToId ?? null
    if (payload.estimatedCost !== undefined) data.estimatedCost = payload.estimatedCost
    if (payload.actualCost !== undefined) data.actualCost = payload.actualCost
    if ('expectedDate' in payload) data.expectedDate = payload.expectedDate ? new Date(payload.expectedDate) : null
    if ('deliveredDate' in payload) data.deliveredDate = payload.deliveredDate ? new Date(payload.deliveredDate) : null
    if (payload.notes !== undefined) data.notes = payload.notes
    if (payload.internalNotes !== undefined) data.internalNotes = payload.internalNotes

    const row = await db.jobCard.update({ where: { id: payload.id }, data, include })
    if (userId) await logAction(userId, 'UPDATE', 'JOB_CARD', payload.id, old, data)
    return { success: true, data: toRecord(row) }
  } catch (e: any) {
    console.error('[JC_UPDATE_FAIL]', e)
    return { success: false, error: { code: 'JC_UPDATE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function deleteJobCard(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.jobCard.findUnique({ where: { id }, select: { status: true, jobNumber: true } })
    if (!row) return { success: false, error: { code: 'JC_NOT_FOUND', message: 'Job card not found' } }
    if (row.status === 'IN_REPAIR' || row.status === 'PENDING_PARTS') return { success: false, error: { code: 'JC_ACTIVE', message: 'Cannot delete a job card currently in repair or awaiting parts.' } }

    await db.jobCard.delete({ where: { id } })
    if (userId) await logAction(userId, 'DELETE', 'JOB_CARD', id, row, null)
    return { success: true }
  } catch (e: any) {
    console.error('[JC_DELETE_FAIL]', e)
    return { success: false, error: { code: 'JC_DELETE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}
