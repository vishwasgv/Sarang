import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// dueMonth/dueDay are only set for events with a genuine fixed calendar due
// date. The 4 ROC/MCA events at the bottom (MGT-7/AOC-4/ADT-1/AGM itself) are
// due relative to each client's own AGM date, which nothing in this schema
// tracks — left unset (not auto-computable) rather than guessed at; a CA
// still creates those tasks by hand once the AGM date is actually known.
const SEEDED_EVENTS = [
  // Income Tax
  { title: 'ITR Filing — Non-Audit Assessees', category: 'INCOME_TAX', frequency: 'ANNUAL', applicableTo: 'INDIVIDUAL', description: 'Due 31 July (FY end + 4 months)', dueMonth: 7, dueDay: 31 },
  { title: 'ITR Filing — Audit Assessees', category: 'INCOME_TAX', frequency: 'ANNUAL', applicableTo: 'ALL', description: 'Due 31 October for companies/firms requiring audit', dueMonth: 10, dueDay: 31 },
  { title: 'Tax Audit Report — Form 3CD', category: 'AUDIT', frequency: 'ANNUAL', applicableTo: 'ALL', description: 'Due 30 September before ITR filing for audit cases', dueMonth: 9, dueDay: 30 },
  { title: 'Advance Tax — Q1 (Apr–Jun)', category: 'INCOME_TAX', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Due 15 June — 15% of estimated annual tax', dueMonth: 6, dueDay: 15 },
  { title: 'Advance Tax — Q2 (Apr–Sep)', category: 'INCOME_TAX', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Due 15 September — 45% cumulative', dueMonth: 9, dueDay: 15 },
  { title: 'Advance Tax — Q3 (Apr–Dec)', category: 'INCOME_TAX', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Due 15 December — 75% cumulative', dueMonth: 12, dueDay: 15 },
  { title: 'Advance Tax — Q4 (Apr–Mar)', category: 'INCOME_TAX', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Due 15 March — 100% cumulative', dueMonth: 3, dueDay: 15 },
  // GST — MONTHLY events: dueMonth left null, dueDay is "this day of every month"
  { title: 'GSTR-1 Filing (Monthly)', category: 'GST', frequency: 'MONTHLY', applicableTo: 'ALL', description: 'Outward supply details — due 11th of following month', dueMonth: null, dueDay: 11 },
  { title: 'GSTR-3B Filing (Monthly)', category: 'GST', frequency: 'MONTHLY', applicableTo: 'ALL', description: 'Summary GST return & payment — due 20th of following month', dueMonth: null, dueDay: 20 },
  { title: 'GSTR-9 Annual Return', category: 'GST', frequency: 'ANNUAL', applicableTo: 'ALL', description: 'Due 31 December for previous FY', dueMonth: 12, dueDay: 31 },
  { title: 'GSTR-9C Reconciliation', category: 'GST', frequency: 'ANNUAL', applicableTo: 'COMPANY', description: 'Audit reconciliation statement — due 31 December', dueMonth: 12, dueDay: 31 },
  // TDS
  { title: 'TDS Return — Q1 (Apr–Jun)', category: 'TDS', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Form 24Q/26Q — due 31 July', dueMonth: 7, dueDay: 31 },
  { title: 'TDS Return — Q2 (Jul–Sep)', category: 'TDS', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Form 24Q/26Q — due 31 October', dueMonth: 10, dueDay: 31 },
  { title: 'TDS Return — Q3 (Oct–Dec)', category: 'TDS', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Form 24Q/26Q — due 31 January', dueMonth: 1, dueDay: 31 },
  { title: 'TDS Return — Q4 (Jan–Mar)', category: 'TDS', frequency: 'QUARTERLY', applicableTo: 'ALL', description: 'Form 24Q/26Q — due 31 May', dueMonth: 5, dueDay: 31 },
  // ROC / MCA
  { title: 'DIR-3 KYC (Director KYC)', category: 'MCA', frequency: 'ANNUAL', applicableTo: 'COMPANY', description: 'Due 30 September each year for all directors with DIN', dueMonth: 9, dueDay: 30 },
  { title: 'MGT-7 Annual Return', category: 'ROC', frequency: 'ANNUAL', applicableTo: 'COMPANY', description: 'Due within 60 days of AGM', dueMonth: null, dueDay: null },
  { title: 'AOC-4 Financial Statements', category: 'ROC', frequency: 'ANNUAL', applicableTo: 'COMPANY', description: 'Due within 30 days of AGM', dueMonth: null, dueDay: null },
  { title: 'ADT-1 Auditor Appointment', category: 'ROC', frequency: 'ANNUAL', applicableTo: 'COMPANY', description: 'Due within 15 days of AGM', dueMonth: null, dueDay: null },
  { title: 'AGM — Annual General Meeting', category: 'ROC', frequency: 'ANNUAL', applicableTo: 'COMPANY', description: 'Must be held within 6 months of FY end (by 30 September)', dueMonth: null, dueDay: null },
]

export async function listComplianceEvents(filters?: { category?: string; isActive?: boolean }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.category) where.category = filters.category
    if (filters?.isActive !== undefined) where.isActive = filters.isActive
    const events = await db.complianceEvent.findMany({
      where,
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    })
    return { success: true, data: events }
  } catch (err) {
    return { success: false, error: { code: 'CE29-001', message: err instanceof Error ? err.message : 'Could not list compliance events.' } }
  }
}

export async function seedComplianceEvents(): Promise<void> {
  const db = getPrisma()
  for (const ev of SEEDED_EVENTS) {
    const existing = await db.complianceEvent.findFirst({ where: { title: ev.title } })
    if (!existing) {
      await db.complianceEvent.create({ data: ev })
    } else if (existing.dueMonth !== ev.dueMonth || existing.dueDay !== ev.dueDay) {
      // Backfills dueMonth/dueDay onto rows seeded by an already-installed
      // database before this phase — without this, auto-generation
      // (generateComplianceTasksForAllClients) would silently skip every
      // pre-existing event since it only reads events with dueDay set.
      await db.complianceEvent.update({ where: { id: existing.id }, data: { dueMonth: ev.dueMonth, dueDay: ev.dueDay } })
    }
  }
}

// Next occurrence of this event's due date on or after `from`. `dueMonth`
// set = a single fixed calendar date recurring once a year (covers both
// ANNUAL events and the pre-split per-quarter QUARTERLY rows, which each
// only ever fire once a year on their own fixed date). `dueMonth` null =
// "this day of every month" (GSTR-1/GSTR-3B).
function computeNextDueDate(event: { dueMonth: number | null; dueDay: number }, from: Date): Date {
  if (event.dueMonth !== null) {
    const year = from.getFullYear()
    let candidate = new Date(year, event.dueMonth - 1, event.dueDay)
    if (candidate < from) candidate = new Date(year + 1, event.dueMonth - 1, event.dueDay)
    return candidate
  }
  const year = from.getFullYear()
  const month = from.getMonth()
  let candidate = new Date(year, month, event.dueDay)
  if (candidate < from) candidate = new Date(year, month + 1, event.dueDay)
  return candidate
}

// Auto-generates the next-due ComplianceTask for every active client, for
// every ComplianceEvent with a computable due date — previously the seeded
// statutory calendar (GST/TDS/ROC/ITR due dates) was accurate but entirely
// passive: a firm with 50 clients had to manually create every single task,
// every period, for every client, by hand. Idempotent (safe to call
// repeatedly, e.g. from an hourly background evaluator) — an exact
// (event, client, dueDate) match is treated as "already generated."
// Events with no computable due date (dueDay null — the AGM-relative
// ROC/MCA ones) are skipped entirely; a CA still creates those by hand once
// the client's actual AGM date is known.
export async function generateComplianceTasksForAllClients(): Promise<{ created: number }> {
  const db = getPrisma()
  const events = await db.complianceEvent.findMany({ where: { isActive: true, dueDay: { not: null } } })
  if (events.length === 0) return { created: 0 }

  const clients = await db.customer.findMany({ where: { isActive: true }, select: { id: true } })
  if (clients.length === 0) return { created: 0 }

  const now = new Date()
  let created = 0
  for (const event of events) {
    const dueDate = computeNextDueDate({ dueMonth: event.dueMonth, dueDay: event.dueDay! }, now)
    for (const client of clients) {
      const exists = await db.complianceTask.findFirst({
        where: { complianceEventId: event.id, clientId: client.id, dueDate },
        select: { id: true }
      })
      if (exists) continue
      await db.complianceTask.create({
        data: {
          complianceEventId: event.id, clientId: client.id,
          title: event.title, category: event.category, dueDate,
          status: 'PENDING', priority: 'NORMAL'
        }
      })
      created++
    }
  }

  if (created > 0) {
    await logAction({ action: 'COMPLIANCE_TASKS_AUTO_GENERATED', entityType: 'ComplianceTask', entityId: 'bulk', newValue: { created } }).catch(() => {})
  }
  return { created }
}
