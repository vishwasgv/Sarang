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

// Phase 58 §2 — Company Secretary: a per-company annual-compliance rollup
// (AGM held? MGT-7/AOC-4/ADT-1 filed?) at a glance, instead of a CS having
// to cross-reference two separate screens per client. Indian FY runs
// 1 April – 31 March; "2025-26" means Apr 2025 – Mar 2026.
function fyRange(financialYear: string): { start: Date; end: Date } {
  const startYear = parseInt(financialYear.split('-')[0], 10)
  return {
    start: new Date(Date.UTC(startYear, 3, 1)),
    end: new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999)),
  }
}

export interface ComplianceRollupRow {
  clientId: string
  clientName: string
  agmHeld: boolean
  agmDate: string | null
  mgt7Status: string
  aoc4Status: string
  adt1Status: string
}

export async function getComplianceRollup(financialYear: string): Promise<{ success: true; data: ComplianceRollupRow[] } | { success: false; error: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const { start, end } = fyRange(financialYear)

    // "Company" clients are identified by having EVER had a ROCFiling or
    // BoardMeeting record — Customer has no dedicated entity-type field, so
    // this is the closest real signal without adding a new schema flag just
    // for this one rollup view.
    const [filingClientIds, meetingClientIds] = await Promise.all([
      db.rOCFiling.findMany({ distinct: ['clientId'], select: { clientId: true } }),
      db.boardMeeting.findMany({ distinct: ['clientId'], select: { clientId: true } }),
    ])
    const companyClientIds = Array.from(new Set([...filingClientIds.map((f) => f.clientId), ...meetingClientIds.map((m) => m.clientId)]))
    if (companyClientIds.length === 0) return { success: true, data: [] }

    const [clients, filings, agmMeetings] = await Promise.all([
      db.customer.findMany({ where: { id: { in: companyClientIds } }, select: { id: true, customerName: true } }),
      db.rOCFiling.findMany({
        where: { clientId: { in: companyClientIds }, financialYear, formType: { in: ['MGT-7', 'AOC-4', 'ADT-1'] } },
        select: { clientId: true, formType: true, status: true },
      }),
      db.boardMeeting.findMany({
        where: { clientId: { in: companyClientIds }, meetingType: 'AGM', meetingDate: { gte: start, lte: end } },
        select: { clientId: true, meetingDate: true },
        orderBy: { meetingDate: 'desc' },
      }),
    ])

    const rows: ComplianceRollupRow[] = clients.map((c) => {
      const clientFilings = filings.filter((f) => f.clientId === c.id)
      const agm = agmMeetings.find((m) => m.clientId === c.id)
      const statusFor = (formType: string) => clientFilings.find((f) => f.formType === formType)?.status ?? 'NOT_STARTED'
      return {
        clientId: c.id,
        clientName: c.customerName,
        agmHeld: !!agm,
        agmDate: agm ? agm.meetingDate.toISOString() : null,
        mgt7Status: statusFor('MGT-7'),
        aoc4Status: statusFor('AOC-4'),
        adt1Status: statusFor('ADT-1'),
      }
    })
    rows.sort((a, b) => a.clientName.localeCompare(b.clientName))

    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'RF29-005', message: err instanceof Error ? err.message : 'Could not generate compliance rollup.' } }
  }
}
