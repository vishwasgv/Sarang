import { getPrisma } from '../database/db'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'

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
// Real bug found live (2026-08-27 Phase 68 audit): dueDate/filedOn are
// stored at LOCAL midnight (see parseLocalDateStart below), but this
// serializer converted them via a plain `.toISOString()` instead of the
// toLocalDateOnlyIso fix every sibling service in this same family
// (compliance-task.service.ts, legal-case.service.ts, engagement.service.ts)
// already applies — for IST (UTC+5:30), local midnight is 18:30 UTC the
// PREVIOUS calendar day, so ROCFilingsScreen.tsx's `.slice(0, 10)` on the
// raw ISO string displayed every due date and filed date one day early.
function serializeFiling<T extends { govtFee: unknown; dueDate: Date | null; filedOn: Date | null; createdAt: Date; updatedAt: Date }>(f: T): T {
  return {
    ...f,
    govtFee: f.govtFee == null ? null : Number(f.govtFee),
    dueDate: (f.dueDate ? toLocalDateOnlyIso(f.dueDate) : null) as unknown as Date,
    filedOn: (f.filedOn ? toLocalDateOnlyIso(f.filedOn) : null) as unknown as Date,
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
        // Real bug found live (2026-07-28 service-vertical audit): a bare
        // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent
        // with any local-`now`-based overdue comparison on this field.
        dueDate:       payload.dueDate ? parseLocalDateStart(payload.dueDate) : null,
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
        ...(dueDate  !== undefined ? { dueDate:  dueDate  ? parseLocalDateStart(dueDate)  : null } : {}),
        ...(filedOn  !== undefined ? { filedOn:  filedOn  ? parseLocalDateStart(filedOn)  : null } : {}),
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
        // Real bug found live (2026-08-27 Phase 68 audit): a raw
        // `.toISOString()` here shifts a locally-stored midnight date
        // (see BoardMeeting.meetingDate, written via parseLocalDateStart)
        // back to the PREVIOUS calendar day in UTC for IST — same bug
        // class as serializeFiling/serializeMeeting, just not caught by
        // the earlier `.toISOString() as unknown as Date` grep since this
        // field is typed as `string` directly rather than cast through
        // that pattern.
        agmDate: agm ? toLocalDateOnlyIso(agm.meetingDate) : null,
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

// Phase 68 §9.1 — Company Secretary item 1: AGM-to-ROC-filing auto-calendar.
// Once an AGM is recorded, the two downstream statutory filing deadlines are
// a fixed offset from the AGM date under the Companies Act — AOC-4
// (financial statements) within 30 days, MGT-7 (annual return) within 60
// days. Deliberately explicit (clientId/agmDate/financialYear passed in,
// not auto-fired off a BoardMeeting write) since financialYear is a free
// string the CS assigns per-filing and can't be reliably derived from the
// AGM's own calendar date alone. Idempotent: skips any form type that
// already has a filing row for that client+FY, so re-running after a
// mistaken AGM-date edit never creates duplicates.
const AOC4_DAYS_FROM_AGM = 30
const MGT7_DAYS_FROM_AGM = 60

export async function generateFilingsFromAGM(payload: {
  clientId: string
  agmDate: string
  financialYear: string
}) {
  try {
    const db = getPrisma()
    const agm = parseLocalDateStart(payload.agmDate)

    const existing = await db.rOCFiling.findMany({
      where: { clientId: payload.clientId, financialYear: payload.financialYear, formType: { in: ['AOC-4', 'MGT-7'] } },
      select: { formType: true },
    })
    const existingTypes = new Set(existing.map((f) => f.formType))

    const toCreate: Array<{ formType: string; dueDate: Date; purpose: string }> = []
    if (!existingTypes.has('AOC-4')) {
      const due = new Date(agm)
      due.setDate(due.getDate() + AOC4_DAYS_FROM_AGM)
      toCreate.push({ formType: 'AOC-4', dueDate: due, purpose: 'Filing of financial statements (auto-generated from AGM date)' })
    }
    if (!existingTypes.has('MGT-7')) {
      const due = new Date(agm)
      due.setDate(due.getDate() + MGT7_DAYS_FROM_AGM)
      toCreate.push({ formType: 'MGT-7', dueDate: due, purpose: 'Filing of annual return (auto-generated from AGM date)' })
    }
    if (toCreate.length === 0) return { success: true, data: [] }

    const created = await Promise.all(
      toCreate.map((f) =>
        db.rOCFiling.create({
          data: {
            clientId: payload.clientId,
            formType: f.formType,
            financialYear: payload.financialYear,
            purpose: f.purpose,
            dueDate: f.dueDate,
            status: 'PENDING',
          },
          include: {
            client: { select: { id: true, customerName: true, phone: true } },
            staff: { select: { id: true, fullName: true } },
          },
        })
      )
    )
    await db.auditLog
      .create({
        data: {
          action: 'CREATE',
          entityType: 'ROCFiling',
          entityId: payload.clientId,
          newValue: JSON.stringify({ source: 'AGM_AUTO_CALENDAR', formTypes: toCreate.map((f) => f.formType) }),
        },
      })
      .catch(() => {})
    return { success: true, data: created.map(serializeFiling) }
  } catch (err) {
    return { success: false, error: { code: 'RF29-006', message: err instanceof Error ? err.message : 'Could not auto-generate filings from AGM date.' } }
  }
}

// Phase 68 §9.1 — Company Secretary items 4/5: an aggregate completion rate
// (item 4) and a per-company health score (item 5), both derived from the
// SAME rollup rows getComplianceRollup already computes (no fabricated
// composite metric — each row's score is a plain count of the 4 real
// signals: AGM held + 3 filing statuses actually FILED, out of 4).
export interface ComplianceCompletionSummary {
  rows: Array<ComplianceRollupRow & { healthScorePercent: number }>
  overallCompletionRatePercent: number
}

export async function getComplianceCompletionSummary(
  financialYear: string
): Promise<{ success: true; data: ComplianceCompletionSummary } | { success: false; error: { code: string; message: string } }> {
  const rollup = await getComplianceRollup(financialYear)
  if (!rollup.success) return rollup

  const scored = rollup.data.map((row) => {
    const signalsDone = (row.agmHeld ? 1 : 0) + (row.mgt7Status === 'FILED' ? 1 : 0) + (row.aoc4Status === 'FILED' ? 1 : 0) + (row.adt1Status === 'FILED' ? 1 : 0)
    return { ...row, healthScorePercent: Math.round((signalsDone / 4) * 100) }
  })
  const overallCompletionRatePercent = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, r) => sum + r.healthScorePercent, 0) / scored.length)

  return { success: true, data: { rows: scored, overallCompletionRatePercent } }
}
