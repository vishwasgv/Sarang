import { getPrisma } from '../database/db'
import { toLocalISODate, parseLocalDateStart } from '../utils/date.util'

// Prisma returns DateTime columns as real Date instances, which structured
// clone (Electron's IPC boundary) preserves as-is — not the ISO strings the
// renderer's ComplianceTask type (and its direct `.dueDate.slice(0, 10)`
// calls, e.g. ComplianceScreen.tsx's overdue/due-today KPI counts) assumes.
// Unlike a Prisma Decimal, a bare Date doesn't throw crossing that boundary,
// so this was never caught by a serialization error — it silently shipped
// as a live crash instead. Serialize here, the same place Decimal fields
// already get sanitized elsewhere in this codebase (see legal-case.service.ts's
// serializeCase), rather than patching every renderer call site.
//
// BUG FOUND 2026-07-22: dueDate/filedOn are pure CALENDAR-DATE fields (a
// statutory deadline has no meaningful time-of-day) constructed upstream at
// LOCAL midnight (compliance-event.service.ts's computeNextDueDate uses
// `new Date(year, month, day)`, which is genuinely correct for representing
// a calendar date). Calling `.toISOString()` on a local-midnight Date
// converts it to the UTC instant, which for any timezone ahead of UTC
// (IST included, the app's primary market) lands on the PREVIOUS UTC
// calendar day — so `.dueDate.slice(0, 10)` in the renderer displayed every
// auto-generated compliance deadline one day earlier than the real one.
// Fixed by re-deriving the ISO string from local calendar components
// (toLocalISODate) instead of the UTC instant, keeping a
// 'T00:00:00.000Z' suffix so `new Date(...)` round-trips correctly in the
// renderer (UTC midnight of the correct day always falls within the same
// local day for a positive UTC offset, same self-correcting pattern already
// used for every "to" date-range bound elsewhere in this codebase).
function toLocalDateOnlyIso(date: Date): string {
  return `${toLocalISODate(date)}T00:00:00.000Z`
}

function serializeTask<T extends { dueDate: Date; filedOn: Date | null; createdAt: Date; updatedAt: Date }>(t: T): T {
  return {
    ...t,
    dueDate: toLocalDateOnlyIso(t.dueDate) as unknown as Date,
    filedOn: (t.filedOn ? toLocalDateOnlyIso(t.filedOn) : null) as unknown as Date,
    createdAt: t.createdAt.toISOString() as unknown as Date,
    updatedAt: t.updatedAt.toISOString() as unknown as Date,
  }
}

async function scheduleComplianceNotifications(taskId: string, title: string, dueDate: Date) {
  try {
    const db = getPrisma()
    // NotificationQueue has no column linking back to a ComplianceTask (these
    // are firm-internal reminders, so customerId is always null — the usual
    // customerId+notificationType+status dedup key from recall/membership/
    // hearing reminders doesn't apply here). Embedding the full cuid — not
    // just a 6-char slice — makes an accidental substring collision with
    // another task's id or title effectively impossible.
    await db.notificationQueue.deleteMany({
      where: { notificationType: { in: ['COMPLIANCE_DUE_30D', 'COMPLIANCE_DUE_15D', 'COMPLIANCE_DUE_7D', 'COMPLIANCE_DUE_1D', 'COMPLIANCE_OVERDUE'] }, templateBody: { contains: `[${taskId}]` } },
    })
    const now = new Date()
    const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const slots: Array<{ type: string; scheduledFor: Date }> = [
      { type: 'COMPLIANCE_DUE_30D', scheduledFor: new Date(dueDate.getTime() - 30 * 86400000) },
      { type: 'COMPLIANCE_DUE_15D', scheduledFor: new Date(dueDate.getTime() - 15 * 86400000) },
      { type: 'COMPLIANCE_DUE_7D',  scheduledFor: new Date(dueDate.getTime() - 7  * 86400000) },
      { type: 'COMPLIANCE_DUE_1D',  scheduledFor: new Date(dueDate.getTime() - 1  * 86400000) },
      { type: 'COMPLIANCE_OVERDUE', scheduledFor: dueDate },
    ]
    for (const slot of slots) {
      if (slot.scheduledFor > now || slot.type === 'COMPLIANCE_OVERDUE') {
        const body = slot.type === 'COMPLIANCE_OVERDUE'
          ? `Compliance task "${title}" [${taskId}] is now due (${dueDateStr}). Please complete it today. Powered by Sarang | www.aszurex.com`
          : `Compliance task "${title}" [${taskId}] is due on ${dueDateStr}. Powered by Sarang | www.aszurex.com`
        await db.notificationQueue.create({
          data: { customerId: null, customerName: null, customerPhone: null, notificationType: slot.type, templateBody: body, whatsappLink: null, scheduledFor: slot.scheduledFor, status: 'PENDING' },
        })
      }
    }
  } catch { /* non-critical */ }
}

export async function listComplianceTasks(filters?: {
  clientId?: string
  staffId?: string
  status?: string
  category?: string
  fromDate?: string
  toDate?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.staffId) where.staffId = filters.staffId
    if (filters?.status) where.status = filters.status
    if (filters?.category) where.category = filters.category
    if (filters?.fromDate || filters?.toDate) {
      where.dueDate = {
        // BUG FOUND 2026-07-22: gte used to be new Date(filters.fromDate),
        // parsed as UTC midnight instead of local midnight.
        ...(filters?.fromDate ? { gte: parseLocalDateStart(filters.fromDate) } : {}),
        // dueDate values are always exact local midnight (see
        // computeNextDueDate) — parsing toDate the same way, rather than as
        // UTC midnight, keeps an exact same-day match inclusive.
        ...(filters?.toDate ? { lte: parseLocalDateStart(filters.toDate) } : {}),
      }
    }
    const tasks = await db.complianceTask.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
        event:  { select: { id: true, title: true, category: true, frequency: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: tasks.map(serializeTask) }
  } catch (err) {
    return { success: false, error: { code: 'CT29-001', message: err instanceof Error ? err.message : 'Could not list compliance tasks.' } }
  }
}

export async function createComplianceTask(payload: {
  complianceEventId?: string
  clientId: string
  staffId?: string
  title: string
  category: string
  dueDate: string
  priority?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const task = await db.complianceTask.create({
      data: {
        complianceEventId: payload.complianceEventId ?? null,
        clientId:          payload.clientId,
        staffId:           payload.staffId ?? null,
        title:             payload.title.trim(),
        category:          payload.category,
        dueDate:           parseLocalDateStart(payload.dueDate),
        priority:          payload.priority ?? 'NORMAL',
        status:            'PENDING',
        notes:             payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
        event:  { select: { id: true, title: true, category: true, frequency: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'ComplianceTask', entityId: task.id, newValue: JSON.stringify({ title: task.title }) } }).catch(() => {})
    scheduleComplianceNotifications(task.id, task.title, task.dueDate).catch(() => {})
    return { success: true, data: serializeTask(task) }
  } catch (err) {
    return { success: false, error: { code: 'CT29-002', message: err instanceof Error ? err.message : 'Could not create compliance task.' } }
  }
}

export async function updateComplianceTask(payload: {
  id: string
  staffId?: string | null
  title?: string
  category?: string
  dueDate?: string
  status?: string
  priority?: string
  notes?: string | null
  filedOn?: string | null
  acknowledgmentNo?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, dueDate, filedOn, ...rest } = payload
    const task = await db.complianceTask.update({
      where: { id },
      data: {
        ...rest,
        // BUG FOUND 2026-07-22: new Date(dateOnlyString) parses as UTC
        // midnight, not local midnight — same bug class as
        // report.service.ts's toDate(), for these caller-supplied
        // "YYYY-MM-DD" date-only inputs.
        ...(dueDate !== undefined ? { dueDate: parseLocalDateStart(dueDate) } : {}),
        ...(filedOn !== undefined ? { filedOn: filedOn ? parseLocalDateStart(filedOn) : null } : {}),
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
        event:  { select: { id: true, title: true, category: true, frequency: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'ComplianceTask', entityId: task.id } }).catch(() => {})
    if (task.status !== 'FILED' && task.status !== 'DONE') {
      scheduleComplianceNotifications(task.id, task.title, task.dueDate).catch(() => {})
    }
    return { success: true, data: serializeTask(task) }
  } catch (err) {
    return { success: false, error: { code: 'CT29-003', message: err instanceof Error ? err.message : 'Could not update compliance task.' } }
  }
}

export async function deleteComplianceTask(id: string) {
  try {
    const db = getPrisma()
    await db.complianceTask.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'ComplianceTask', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'CT29-004', message: err instanceof Error ? err.message : 'Could not delete compliance task.' } }
  }
}
