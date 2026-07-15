import { getPrisma } from '../database/db'

// ROCFiling.govtFee is a Prisma Decimal field — Electron's IPC (structured
// clone) cannot serialize a Decimal instance and throws "An object could not
// be cloned" on every response that includes one. Applied to every function
// below that returns a filing.
//
// dueDate/filedOn/createdAt/updatedAt are Prisma DateTime fields — structured
// clone DOES preserve these as real Date instances across IPC (unlike
// Decimal, which throws), so this half was never caught by a clone error; it
// shipped as a live renderer crash instead (ROCFilingsScreen.tsx's edit-form
// populators call `f.dueDate.slice(0, 10)` / `f.filedOn.slice(0, 10)`
// assuming an ISO string — see the identical bug fixed in
// compliance-task.service.ts's serializeTask for the full writeup).
function serializeFiling<T extends { govtFee: unknown; dueDate: Date | null; filedOn: Date | null; createdAt: Date; updatedAt: Date }>(f: T): T {
  return {
    ...f,
    govtFee: f.govtFee == null ? null : Number(f.govtFee),
    dueDate: (f.dueDate ? f.dueDate.toISOString() : null) as unknown as Date,
    filedOn: (f.filedOn ? f.filedOn.toISOString() : null) as unknown as Date,
    createdAt: f.createdAt.toISOString() as unknown as Date,
    updatedAt: f.updatedAt.toISOString() as unknown as Date,
  }
}

export async function listROCFilings(filters?: {
  clientId?: string
  staffId?: string
  status?: string
  formType?: string
  financialYear?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.staffId) where.staffId = filters.staffId
    if (filters?.status) where.status = filters.status
    if (filters?.formType) where.formType = filters.formType
    if (filters?.financialYear) where.financialYear = filters.financialYear
    const filings = await db.rOCFiling.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: filings.map(serializeFiling) }
  } catch (err) {
    return { success: false, error: { code: 'RF29-001', message: err instanceof Error ? err.message : 'Could not list ROC filings.' } }
  }
}

export async function createROCFiling(payload: {
  clientId: string
  staffId?: string
  formType: string
  financialYear?: string
  purpose?: string
  dueDate?: string
  govtFee?: number
  notes?: string
}) {
  try {
    const db = getPrisma()
    const filing = await db.rOCFiling.create({
      data: {
        clientId:      payload.clientId,
        staffId:       payload.staffId ?? null,
        formType:      payload.formType.toUpperCase().trim(),
        financialYear: payload.financialYear ?? null,
        purpose:       payload.purpose ?? null,
        dueDate:       payload.dueDate ? new Date(payload.dueDate) : null,
        status:        'PENDING',
        govtFee:       payload.govtFee ?? null,
        notes:         payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'ROCFiling', entityId: filing.id, newValue: JSON.stringify({ formType: filing.formType }) } }).catch(() => {})
    return { success: true, data: serializeFiling(filing) }
  } catch (err) {
    return { success: false, error: { code: 'RF29-002', message: err instanceof Error ? err.message : 'Could not create ROC filing.' } }
  }
}

export async function updateROCFiling(payload: {
  id: string
  staffId?: string | null
  formType?: string
  financialYear?: string | null
  purpose?: string | null
  dueDate?: string | null
  filedOn?: string | null
  srn?: string | null
  status?: string
  govtFee?: number | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, dueDate, filedOn, ...rest } = payload
    const filing = await db.rOCFiling.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate  !== undefined ? { dueDate:  dueDate  ? new Date(dueDate)  : null } : {}),
        ...(filedOn  !== undefined ? { filedOn:  filedOn  ? new Date(filedOn)  : null } : {}),
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'ROCFiling', entityId: filing.id } }).catch(() => {})
    return { success: true, data: serializeFiling(filing) }
  } catch (err) {
    return { success: false, error: { code: 'RF29-003', message: err instanceof Error ? err.message : 'Could not update ROC filing.' } }
  }
}

export async function deleteROCFiling(id: string) {
  try {
    const db = getPrisma()
    await db.rOCFiling.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'ROCFiling', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'RF29-004', message: err instanceof Error ? err.message : 'Could not delete ROC filing.' } }
  }
}
