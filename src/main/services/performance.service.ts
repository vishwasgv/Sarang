import { getPrisma } from '../database/db'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'

// BUG FOUND 2026-07-28 (reports/settings/HR/security/licensing/master-data
// audit pass): Performance.date is a non-nullable Prisma DateTime. Electron's
// ipcRenderer.invoke uses the structured clone algorithm, which preserves a
// Date as a real Date object across the IPC boundary rather than coercing it
// to a string — but PerformanceScreen.tsx's openEdit() does
// `p.date.split('T')[0]` assuming `date` is a string (matching this file's
// own declared `date: string` renderer interface). Every other service in
// this codebase that returns date fields to the renderer (hr.service.ts's
// toEmployee, payroll.service.ts's serializeRecord, etc.) explicitly calls
// `.toISOString()` first — this file was the one place that returned the raw
// Prisma row instead, so opening Edit on any performance record threw
// `TypeError: p.date.split is not a function` and crashed the modal.
//
// Also fixed the matching write-side bug while here: createPerformance/
// updatePerformance previously wrote `new Date(payload.date)` on the bare
// "YYYY-MM-DD" string `<input type="date">` sends, which the ECMAScript spec
// parses as UTC midnight rather than local midnight (see date.util.ts's own
// header comment for the full writeup) — for any timezone behind UTC this
// silently shifts the stored performance date back one calendar day.
// parseLocalDateStart avoids the round-trip; toLocalDateOnlyIso is then used
// on the way back out (instead of a raw .toISOString(), which would re-shift
// a LOCAL midnight instant to the wrong calendar date for any timezone AHEAD
// of UTC, e.g. IST) so the date the owner typed is exactly the date they see
// again when they reopen the edit form.
function serializePerformance<T extends { date: Date }>(row: T): Omit<T, 'date'> & { date: string } {
  return { ...row, date: toLocalDateOnlyIso(row.date) }
}

export async function listPerformances(filters?: { batchId?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.batchId) where.batchId = filters.batchId

  const performances = await db.performance.findMany({
    where,
    include: {
      batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
    },
    orderBy: { date: 'desc' },
  })
  return { success: true, data: performances.map(serializePerformance) }
}

export async function createPerformance(payload: {
  batchId: string
  performanceName: string
  date: string
  venue?: string
  participatingStudentIds?: string[]
  notes?: string
}) {
  const db = getPrisma()
  const performance = await db.performance.create({
    data: {
      batchId: payload.batchId,
      performanceName: payload.performanceName,
      date: parseLocalDateStart(payload.date),
      venue: payload.venue || null,
      participatingStudentIds: JSON.stringify(payload.participatingStudentIds ?? []),
      notes: payload.notes || null,
    },
    include: {
      batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
    },
  })
  return { success: true, data: serializePerformance(performance) }
}

export async function updatePerformance(payload: {
  id: string
  performanceName?: string
  date?: string
  venue?: string | null
  participatingStudentIds?: string[]
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, date, participatingStudentIds, ...rest } = payload
  const performance = await db.performance.update({
    where: { id },
    data: {
      ...rest,
      ...(date !== undefined ? { date: parseLocalDateStart(date) } : {}),
      ...(participatingStudentIds !== undefined
        ? { participatingStudentIds: JSON.stringify(participatingStudentIds) }
        : {}),
    },
    include: {
      batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
    },
  })
  return { success: true, data: serializePerformance(performance) }
}

export async function deletePerformance(id: string) {
  const db = getPrisma()
  await db.performance.delete({ where: { id } })
  return { success: true }
}
