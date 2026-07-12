import { getPrisma } from '../database/db'

// Lead.estimatedValue is a Prisma Decimal field — Electron's IPC (structured
// clone) cannot serialize a Decimal instance and throws "An object could not
// be cloned" on every response that includes one. Applied to every function
// below that returns a lead.
function serializeLead<T extends { estimatedValue: unknown }>(l: T): T {
  return { ...l, estimatedValue: l.estimatedValue == null ? null : Number(l.estimatedValue) }
}

export async function listLeads(filters?: {
  status?: string
  assignedToId?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId
    const leads = await db.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: leads.map(serializeLead) }
  } catch (err) {
    return { success: false, error: { code: 'LD30-001', message: err instanceof Error ? err.message : 'Could not list leads.' } }
  }
}

export async function createLead(payload: {
  fullName: string
  email?: string
  phone?: string
  companyName?: string
  source?: string
  status?: string
  estimatedValue?: number
  assignedToId?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const lead = await db.lead.create({
      data: {
        fullName:       payload.fullName.trim(),
        email:          payload.email ?? null,
        phone:          payload.phone ?? null,
        companyName:    payload.companyName ?? null,
        source:         payload.source ?? 'REFERRAL',
        status:         payload.status ?? 'OPEN',
        estimatedValue: payload.estimatedValue ?? null,
        assignedToId:   payload.assignedToId ?? null,
        notes:          payload.notes ?? null,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'Lead', entityId: lead.id, newValue: JSON.stringify({ fullName: lead.fullName }) } }).catch(() => {})
    return { success: true, data: serializeLead(lead) }
  } catch (err) {
    return { success: false, error: { code: 'LD30-002', message: err instanceof Error ? err.message : 'Could not create lead.' } }
  }
}

export async function updateLead(payload: {
  id: string
  fullName?: string
  email?: string | null
  phone?: string | null
  companyName?: string | null
  source?: string
  status?: string
  estimatedValue?: number | null
  assignedToId?: string | null
  convertedClientId?: string | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, fullName, ...rest } = payload
    const lead = await db.lead.update({
      where: { id },
      data: {
        ...rest,
        ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    })
    const leadAuditAction = payload.status === 'WON' ? 'WON' : payload.status === 'LOST' ? 'LOST' : 'UPDATE'
    await db.auditLog.create({ data: { action: leadAuditAction, entityType: 'Lead', entityId: lead.id } }).catch(() => {})
    return { success: true, data: serializeLead(lead) }
  } catch (err) {
    return { success: false, error: { code: 'LD30-003', message: err instanceof Error ? err.message : 'Could not update lead.' } }
  }
}

export async function deleteLead(id: string) {
  try {
    const db = getPrisma()
    await db.lead.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'Lead', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'LD30-004', message: err instanceof Error ? err.message : 'Could not delete lead.' } }
  }
}
