import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { toLocalISODate, parseLocalDateStart } from '../utils/date.util'
import { roundCurrency } from './currency.service'

// TimeEntry.hours/ratePerHour/amount are Prisma Decimal fields — Electron's
// IPC (structured clone) cannot serialize a Decimal instance and throws
// "An object could not be cloned" on every response that includes one.
// Exported so legal-case.service.ts can apply it to TimeEntry rows nested
// under a case (getLegalCase's `include: { timeEntries }`).
export function serializeTimeEntry<T extends { hours: unknown; ratePerHour: unknown; amount: unknown }>(t: T): T {
  return { ...t, hours: Number(t.hours), ratePerHour: Number(t.ratePerHour), amount: Number(t.amount) }
}

export async function listTimeEntries(filters?: {
  caseId?: string
  projectId?: string
  retainerId?: string
  employeeId?: string
  isBilled?: boolean
  fromDate?: string
  toDate?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.caseId) where.caseId = filters.caseId
    if (filters?.projectId) where.projectId = filters.projectId
    if (filters?.retainerId) where.retainerId = filters.retainerId
    if (filters?.employeeId) where.employeeId = filters.employeeId
    if (filters?.isBilled !== undefined) where.isBilled = filters.isBilled
    if (filters?.fromDate || filters?.toDate) {
      // BUG FOUND 2026-07-22: both bounds used to be new Date(dateString),
      // parsed as UTC midnight instead of local midnight — date is a pure
      // calendar-date field here (always local-midnight-constructed), so
      // parseLocalDateStart on both bounds keeps a same-day match inclusive.
      where.date = {
        ...(filters?.fromDate ? { gte: parseLocalDateStart(filters.fromDate) } : {}),
        ...(filters?.toDate ? { lte: parseLocalDateStart(filters.toDate) } : {}),
      }
    }

    const entries = await db.timeEntry.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true } },
        case: { select: { id: true, caseNumber: true, caseTitle: true } },
        project: { select: { id: true, projectName: true } },
        retainer: { select: { id: true, title: true } },
      },
      orderBy: { date: 'desc' },
    })
    return { success: true, data: entries.map(serializeTimeEntry) }
  } catch (err) {
    return { success: false, error: { code: 'TE28-001', message: err instanceof Error ? err.message : 'Could not list time entries.' } }
  }
}

export async function createTimeEntry(payload: {
  caseId?: string
  projectId?: string
  retainerId?: string
  employeeId?: string
  date: string
  description: string
  hours: number
  ratePerHour: number
}) {
  try {
    const db = getPrisma()
    // Real bug found live (2026-07-28 service-vertical audit): plain
    // `Math.round(x * 100) / 100` crosses IEEE-754's classic 1.005 boundary
    // wrong — e.g. hours=0.5, ratePerHour=2.01 -> raw product 1.005 ->
    // Math.round(1.005*100)/100 = 1 (should be 1.01). This amount is baked
    // straight into an invoice's unitPrice by generateTimeEntryInvoice, so
    // the drift compounds into a real invoice, not just a display artifact.
    // roundCurrency uses Prisma.Decimal with ROUND_HALF_UP, same as every
    // other money computation in this codebase.
    const amount = roundCurrency(payload.hours * payload.ratePerHour)

    const entry = await db.timeEntry.create({
      data: {
        caseId: payload.caseId ?? null,
        projectId: payload.projectId ?? null,
        retainerId: payload.retainerId ?? null,
        employeeId: payload.employeeId ?? null,
        // BUG FOUND 2026-07-22: same UTC-vs-local parsing issue as the
        // date-range filter above.
        date: parseLocalDateStart(payload.date),
        description: payload.description.trim(),
        hours: payload.hours,
        ratePerHour: payload.ratePerHour,
        amount,
        isBilled: false,
      },
      include: {
        employee: { select: { id: true, fullName: true } },
        case: { select: { id: true, caseNumber: true, caseTitle: true } },
        project: { select: { id: true, projectName: true } },
        retainer: { select: { id: true, title: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'TimeEntry', entityId: entry.id, newValue: JSON.stringify({ hours: entry.hours, amount: entry.amount }) } }).catch(() => {})
    return { success: true, data: serializeTimeEntry(entry) }
  } catch (err) {
    return { success: false, error: { code: 'TE28-002', message: err instanceof Error ? err.message : 'Could not create time entry.' } }
  }
}

export async function updateTimeEntry(payload: {
  id: string
  date?: string
  description?: string
  hours?: number
  ratePerHour?: number
}) {
  try {
    const db = getPrisma()
    const { id, date, hours, ratePerHour, ...rest } = payload

    // Recompute amount if hours or rate changed
    let amountUpdate: { amount: number } | Record<string, never> = {}
    if (hours !== undefined || ratePerHour !== undefined) {
      const existing = await db.timeEntry.findUnique({ where: { id }, select: { hours: true, ratePerHour: true } })
      if (existing) {
        const h = hours ?? Number(existing.hours)
        const r = ratePerHour ?? Number(existing.ratePerHour)
        amountUpdate = { amount: roundCurrency(h * r) }
      }
    }

    const entry = await db.timeEntry.update({
      where: { id },
      data: {
        ...rest,
        ...(date !== undefined ? { date: parseLocalDateStart(date) } : {}),
        ...(hours !== undefined ? { hours } : {}),
        ...(ratePerHour !== undefined ? { ratePerHour } : {}),
        ...amountUpdate,
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'TimeEntry', entityId: entry.id } }).catch(() => {})
    return { success: true, data: serializeTimeEntry(entry) }
  } catch (err) {
    return { success: false, error: { code: 'TE28-003', message: err instanceof Error ? err.message : 'Could not update time entry.' } }
  }
}

export async function deleteTimeEntry(id: string) {
  try {
    const db = getPrisma()
    const entry = await db.timeEntry.findUnique({ where: { id }, select: { isBilled: true } })
    if (!entry) return { success: false, error: { code: 'TE28-NOT-FOUND', message: 'Time entry not found.' } }
    if (entry.isBilled) return { success: false, error: { code: 'TE28-BILLED', message: 'Cannot delete a billed time entry.' } }
    await db.timeEntry.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'TimeEntry', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'TE28-004', message: err instanceof Error ? err.message : 'Could not delete time entry.' } }
  }
}

// Finds or creates the generic service product for a given SAC code — same
// find-or-create pattern already established in property-deal.service.ts and
// placement.service.ts, so a business's product catalog gets exactly one
// "Legal Advisory Services" / "Professional Consulting Services" row, not a
// duplicate per invoice.
async function findOrCreateServiceProduct(hsnCode: string, productName: string) {
  const db = getPrisma()
  let product = await db.product.findFirst({ where: { hsnCode, isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName, productType: 'SERVICE', hsnCode, sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
    })
  }
  return product
}

// Phase 40: closes a stub explicitly left for "a future phase" when Phase 28
// added TimeEntry.invoiceId — aggregates a set of unbilled time entries for
// one client into a single itemized invoice (one line per entry, so the
// client sees a real timesheet, not just a lump sum), then marks every
// entry billed and linked to the resulting invoice.
// Sentinel written to TimeEntry.invoiceId while a generation is in flight —
// distinct from both `null` (not yet invoiced) and a real cuid (already
// invoiced), and truthy so every existing `!entry.invoiceId`-style guard
// elsewhere correctly treats a claimed-but-not-yet-invoiced entry as "don't
// touch me" too.
const INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateTimeEntryInvoice(entryIds: string[]) {
  const db = getPrisma()
  try {
    if (!entryIds.length) return { success: false, error: { code: 'TE28-006', message: 'Select at least one time entry to invoice.' } }
    const uniqueIds = [...new Set(entryIds)]

    const entries = await db.timeEntry.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        case: { select: { id: true, clientId: true } },
        project: { select: { id: true, clientId: true } },
      },
    })
    if (entries.length !== uniqueIds.length) return { success: false, error: { code: 'TE28-007', message: 'One or more time entries were not found.' } }
    if (entries.some((e) => e.isBilled || e.invoiceId)) return { success: false, error: { code: 'TE28-008', message: 'One or more selected entries are already billed.' } }

    const clientIds = new Set(entries.map((e) => e.case?.clientId ?? e.project?.clientId ?? null))
    if (clientIds.has(null)) return { success: false, error: { code: 'TE28-009', message: 'A freestanding time entry (no case or project) cannot be invoiced automatically — link it to a case/project first, or bill manually.' } }
    if (clientIds.size > 1) return { success: false, error: { code: 'TE28-010', message: 'Selected time entries belong to different clients — invoice each client separately.' } }
    const clientId = [...clientIds][0] as string

    // Legal (case-linked) vs. professional/consulting (project-linked) get
    // distinct SAC codes — a real accuracy difference, not decoration; a
    // batch must be homogeneous (all-case or all-project) so one invoice
    // doesn't need two tax categories on one line-item product.
    const isLegal = entries.every((e) => e.caseId !== null)
    const isProject = entries.every((e) => e.projectId !== null)
    if (!isLegal && !isProject) return { success: false, error: { code: 'TE28-011', message: 'Cannot mix legal-case and project time entries in one invoice — generate them separately.' } }

    // Atomic claim: a single UPDATE...WHERE isBilled=false AND invoiceId IS
    // NULL is one SQL statement, which SQLite executes atomically against
    // its single-writer lock — so of two near-simultaneous calls selecting
    // the same entries (double-click, two windows), only one can ever win
    // this race. The count check below detects the loser precisely, without
    // needing a wrapping transaction around billingService.createInvoice.
    const claim = await db.timeEntry.updateMany({
      where: { id: { in: uniqueIds }, isBilled: false, invoiceId: null },
      data: { invoiceId: INVOICE_CLAIM_SENTINEL },
    })
    if (claim.count !== uniqueIds.length) {
      // Release only the entries we ourselves just claimed — an entry that
      // won a concurrent race keeps its real invoiceId/isBilled untouched.
      await db.timeEntry.updateMany({ where: { id: { in: uniqueIds }, invoiceId: INVOICE_CLAIM_SENTINEL }, data: { invoiceId: null } })
      return { success: false, error: { code: 'TE28-008', message: 'One or more selected entries are already billed.' } }
    }

    try {
      const product = isLegal
        ? await findOrCreateServiceProduct('998212', 'Legal Advisory Services')
        : await findOrCreateServiceProduct('998311', 'Professional Consulting Services')

      // BUG FOUND 2026-07-22: `taxRate: 18` was hardcoded here too,
      // permanently overriding the product's own configurable rate — same
      // bug class fixed across many other vertical services this session.
      // Removed so it falls through to product.taxRate.
      const items = entries.map((e) => ({
        productId: product.id,
        quantity: 1,
        unitPrice: Number(e.amount),
        variantInfo: `${toLocalISODate(e.date)} — ${e.description} (${Number(e.hours)}h @ ${Number(e.ratePerHour)}/h)`.slice(0, 100),
      }))

      const result = await billingService.createInvoice({
        customerId: clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items,
        notes: `Professional fees — ${entries.length} time ${entries.length === 1 ? 'entry' : 'entries'}`,
        referenceNumber: uniqueIds[0].slice(0, 12),
      })
      if (!result.success) {
        await db.timeEntry.updateMany({ where: { id: { in: uniqueIds } }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.timeEntry.updateMany({ where: { id: { in: uniqueIds } }, data: { isBilled: true, invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'TimeEntry', entityId: uniqueIds[0], newValue: JSON.stringify({ invoiceId: invoice.id, entryIds: uniqueIds }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.timeEntry.updateMany({ where: { id: { in: uniqueIds } }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'TE28-012', message: err instanceof Error ? err.message : 'Could not generate invoice from time entries.' } }
  }
}

// Phase 63 — ServiceProject.billingMethod, read here instead of the
// invoice-generation path always assuming hourly. HOURLY delegates straight
// to generateTimeEntryInvoice above, unmodified — the one path that's
// actually driven by real logged hours. The other three methods
// (FIXED_COST/DAILY_PER_TASK/DAILY_PER_PROJECT/DAILY_PER_USER) aren't
// hours-driven at all, so they bill one computed line instead of one line
// per time entry. This schema has no dedicated daily-rate or per-task/
// per-user breakdown on ServiceProject (a single totalContractValue and a
// single assignedToId) — rather than invent an unverifiable elapsed-days or
// per-task heuristic server-side, the caller explicitly states how many
// days to bill (dayCount), the same "explicit selection, not a guess"
// principle generateTimeEntryInvoice's own entryIds parameter already
// follows. FIXED_COST needs no dayCount — it bills the contract value once.
export async function generateInvoiceForServiceProject(payload: { serviceProjectId: string; timeEntryIds?: string[]; dayCount?: number }, userId?: string) {
  const db = getPrisma()
  try {
    const project = await db.serviceProject.findUnique({
      where: { id: payload.serviceProjectId },
      select: { id: true, clientId: true, projectName: true, billingMethod: true, totalContractValue: true }
    })
    if (!project) return { success: false, error: { code: 'SP-001', message: 'Service project not found.' } }

    if (project.billingMethod === 'HOURLY') {
      if (!payload.timeEntryIds?.length) return { success: false, error: { code: 'SP-002', message: 'Select at least one time entry to bill for an hourly-billed project.' } }
      return generateTimeEntryInvoice(payload.timeEntryIds)
    }

    const contractValue = project.totalContractValue ? Number(project.totalContractValue) : 0
    if (contractValue <= 0) return { success: false, error: { code: 'SP-003', message: 'This project has no contract value set — cannot generate an invoice.' } }

    let quantity = 1
    let unitPrice = contractValue
    let description = `${project.projectName} — Fixed Cost`
    if (project.billingMethod !== 'FIXED_COST') {
      if (!payload.dayCount || payload.dayCount <= 0) return { success: false, error: { code: 'SP-004', message: 'Enter the number of days to bill for a daily-rate project.' } }
      quantity = payload.dayCount
      unitPrice = contractValue // contractValue doubles as the per-day rate for the DAILY_* methods, per this schema's own single-field shape
      description = `${project.projectName} — ${payload.dayCount} day(s) @ ${project.billingMethod}`
    }

    const product = await findOrCreateServiceProduct('998311', 'Professional Consulting Services')
    const result = await billingService.createInvoice({
      customerId: project.clientId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: [{ productId: product.id, quantity, unitPrice, variantInfo: description.slice(0, 100) }],
      notes: description,
      referenceNumber: project.id.slice(0, 12)
    }, userId)
    if (!result.success) return result

    const invoice = result.data as { id: string }
    await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'ServiceProject', entityId: project.id, newValue: JSON.stringify({ invoiceId: invoice.id, billingMethod: project.billingMethod, quantity }) } }).catch(() => {})
    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    return { success: false, error: { code: 'SP-005', message: err instanceof Error ? err.message : 'Could not generate invoice for service project.' } }
  }
}

export async function markTimeEntriesBilled(ids: string[]) {
  try {
    const db = getPrisma()
    await db.timeEntry.updateMany({ where: { id: { in: ids } }, data: { isBilled: true } })
    await db.auditLog.create({ data: { action: 'BILLED', entityType: 'TimeEntry', entityId: ids[0] ?? '', newValue: JSON.stringify({ ids, count: ids.length }) } }).catch(() => {})
    return { success: true, data: { updatedCount: ids.length } }
  } catch (err) {
    return { success: false, error: { code: 'TE28-005', message: err instanceof Error ? err.message : 'Could not mark entries as billed.' } }
  }
}
