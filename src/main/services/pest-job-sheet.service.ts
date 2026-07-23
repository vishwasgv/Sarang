import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { generateSequenceNumber } from './sequence.service'
import { inventoryService } from './inventory.service'
import { logAction } from './audit.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

const FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12,
  // ONE_TIME deliberately omitted — no next visit to schedule.
}

// Auto-creates the next scheduled visit from a completed, contract-linked job
// sheet — an AMC (annual maintenance contract) is supposed to keep visiting on
// its own cadence, but previously every single visit had to be created by
// hand, defeating the point of the contract's own serviceFrequency field.
// Anchored on the completed visit's own visitDate (not completedDate/today) so
// a MONTHLY contract keeps a fixed cadence regardless of how promptly staff
// mark a job complete. No-ops for ad-hoc job sheets (no contractId), ONE_TIME
// contracts, non-ACTIVE contracts, or once the next visit would fall after
// the contract's own endDate (that's exactly what the renewal reminder in
// pest-contract.service.ts exists to prompt a human to act on instead).
async function maybeScheduleNextVisit(db: ReturnType<typeof getPrisma>, sheet: { contractId: string | null; visitDate: Date }) {
  if (!sheet.contractId) return
  try {
    const contract = await db.pestServiceContract.findUnique({ where: { id: sheet.contractId } })
    if (!contract || contract.status !== 'ACTIVE') return
    const months = FREQUENCY_MONTHS[contract.serviceFrequency]
    if (!months) return

    const nextVisitDate = new Date(sheet.visitDate)
    nextVisitDate.setMonth(nextVisitDate.getMonth() + months)
    if (contract.endDate && nextVisitDate > contract.endDate) return

    await db.$transaction(async (tx) => {
      const jobNumber = await generateJobNumber(tx)
      await tx.pestJobSheet.create({
        data: {
          jobNumber,
          contractId: contract.id,
          clientId: contract.clientId,
          visitDate: nextVisitDate,
          treatmentType: 'SPRAY',
          status: 'SCHEDULED',
          notes: `Auto-scheduled from contract ${contract.contractNumber} (${contract.serviceFrequency}).`,
        },
      })
    })
  } catch {
    // Non-critical relative to the completion itself — never let auto-scheduling
    // the next visit block or fail the job sheet completion that triggered it.
  }
}

// PestJobSheet.jobAmount is a Prisma Decimal field — Electron's IPC
// (structured clone) cannot serialize a Decimal instance and throws "An
// object could not be cloned" on every response that includes one.
// Exported so pest-contract.service.ts can apply it to jobSheets nested
// under a contract (getPestContract's `include: { jobSheets }`).
export function serializePestJobSheet<T extends { jobAmount: unknown }>(s: T): T {
  return { ...s, jobAmount: Number(s.jobAmount) }
}

async function generateJobNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'pest_job_sheet_number_sequence', 'PJS', 5,
    async () => {
      const last = await tx.pestJobSheet.findFirst({ orderBy: { createdAt: 'desc' }, select: { jobNumber: true } })
      return last ? parseInt(last.jobNumber.replace('PJS-', ''), 10) : 0
    }
  )
}

export async function listPestJobSheets(filters?: { status?: string; contractId?: string; clientId?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.contractId) where.contractId = filters.contractId
  if (filters?.clientId) where.clientId = filters.clientId
  if (filters?.search) {
    where.OR = [
      { jobNumber: { contains: filters.search } },
      { client: { customerName: { contains: filters.search } } },
      { areasServiced: { contains: filters.search } },
      { pesticideUsed: { contains: filters.search } },
    ]
  }

  const sheets = await db.pestJobSheet.findMany({
    where,
    include: {
      contract: { select: { id: true, contractNumber: true, propertyAddress: true } },
      client: { select: { id: true, customerName: true, phone: true } },
    },
    orderBy: { visitDate: 'desc' },
  })
  return { success: true, data: sheets.map(serializePestJobSheet) }
}

export async function createPestJobSheet(payload: {
  contractId?: string
  clientId: string
  visitDate: string
  scheduledTime?: string
  technicianIds?: string[]
  pesticideUsed?: string
  areasServiced?: string[]
  treatmentType?: string
  jobAmount?: number
  clientSignature?: boolean
  followUpDate?: string
  notes?: string
}) {
  const db = getPrisma()
  const sheet = await db.$transaction(async (tx) => {
    const jobNumber = await generateJobNumber(tx)
    return tx.pestJobSheet.create({
      data: {
        jobNumber,
        contractId: payload.contractId ?? null,
        clientId: payload.clientId,
        visitDate: new Date(payload.visitDate),
        scheduledTime: payload.scheduledTime ?? null,
        technicianIds: JSON.stringify(payload.technicianIds ?? []),
        pesticideUsed: payload.pesticideUsed ?? null,
        areasServiced: JSON.stringify(payload.areasServiced ?? []),
        treatmentType: payload.treatmentType ?? 'SPRAY',
        jobAmount: payload.jobAmount ?? 0,
        clientSignature: payload.clientSignature ?? false,
        followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null,
        notes: payload.notes ?? null,
      },
      include: {
        contract: { select: { id: true, contractNumber: true, propertyAddress: true } },
        client: { select: { id: true, customerName: true, phone: true } },
      },
    })
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'PestJobSheet', entityId: sheet.id, newValue: JSON.stringify({ jobNumber: sheet.jobNumber, clientId: sheet.clientId }) } }).catch(() => {})
  return { success: true, data: serializePestJobSheet(sheet) }
}

export async function updatePestJobSheet(payload: {
  id: string
  visitDate?: string
  scheduledTime?: string | null
  technicianIds?: string[]
  pesticideUsed?: string | null
  areasServiced?: string[]
  treatmentType?: string
  jobAmount?: number
  status?: string
  completedDate?: string | null
  followUpDate?: string | null
  clientSignature?: boolean
  invoiceId?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, visitDate, completedDate, followUpDate, technicianIds, areasServiced, ...rest } = payload
  const data: Record<string, unknown> = { ...rest }
  if (visitDate !== undefined) data.visitDate = new Date(visitDate)
  if (completedDate !== undefined) data.completedDate = completedDate ? new Date(completedDate) : null
  if (followUpDate !== undefined) data.followUpDate = followUpDate ? new Date(followUpDate) : null
  if (technicianIds !== undefined) data.technicianIds = JSON.stringify(technicianIds)
  if (areasServiced !== undefined) data.areasServiced = JSON.stringify(areasServiced)

  // Only need the prior status to detect an actual transition INTO COMPLETED
  // below (guards against re-triggering auto-scheduling on a second edit that
  // happens to leave status untouched at COMPLETED).
  const previous = payload.status === 'COMPLETED' ? await db.pestJobSheet.findUnique({ where: { id }, select: { status: true } }) : null

  const sheet = await db.pestJobSheet.update({
    where: { id },
    data,
    include: {
      contract: { select: { id: true, contractNumber: true, propertyAddress: true } },
      client: { select: { id: true, customerName: true, phone: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'PestJobSheet', entityId: sheet.id } }).catch(() => {})

  if (payload.status === 'COMPLETED' && previous?.status !== 'COMPLETED') {
    await maybeScheduleNextVisit(db, sheet)
  }

  return { success: true, data: serializePestJobSheet(sheet) }
}

export async function deletePestJobSheet(id: string) {
  const db = getPrisma()
  const sheet = await db.pestJobSheet.findUnique({ where: { id }, select: { invoiceId: true } })
  if (sheet?.invoiceId) {
    return { success: false, error: { code: 'PJS-002', message: 'Cannot delete a job sheet that has an associated invoice.' } }
  }
  await db.pestJobSheet.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'PestJobSheet', entityId: id } }).catch(() => {})
  return { success: true }
}

// Real bug found 2026-07-23: this had no atomic claim on invoiceId — just a
// plain read-then-check (`if (sheet.invoiceId) return error`) with the
// actual write only happening via a plain update() AFTER
// billingService.createInvoice() had already run. Two concurrent "Generate
// Invoice" calls for the same job sheet could both pass the stale check and
// each create a real, separate Invoice — a genuine double-bill. Fixed with
// the same atomic conditional-claim + release-on-failure shape used by
// car-job-card.service.ts / job-card.service.ts / placement.service.ts.
const PEST_JOB_SHEET_INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generatePestJobInvoice(id: string) {
  const db = getPrisma()
  const claim = await db.pestJobSheet.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: PEST_JOB_SHEET_INVOICE_CLAIM_SENTINEL } })
  if (claim.count === 0) {
    const existing = await db.pestJobSheet.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return { success: false, error: { code: 'PJS-001', message: 'Job sheet not found.' } }
    return { success: false, error: { code: 'PJS-003', message: 'Invoice already generated for this job sheet.' } }
  }

  try {
    const sheet = await db.pestJobSheet.findUnique({
      where: { id },
      include: { client: { select: { id: true } }, contract: { select: { propertyAddress: true } } },
    })
    if (!sheet) {
      await db.pestJobSheet.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PJS-001', message: 'Job sheet not found.' } }
    }
    if (Number(sheet.jobAmount) === 0) {
      await db.pestJobSheet.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PJS-004', message: 'Job amount is zero. Set a job amount before generating an invoice.' } }
    }

    // SAC 998534 — Pest control and extermination services, 18% GST
    let pestProduct = await db.product.findFirst({ where: { hsnCode: '998534', isActive: true } })
    if (!pestProduct) {
      pestProduct = await db.product.create({
        data: { productName: 'Pest Control Service', productType: 'SERVICE', hsnCode: '998534', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
      })
    }

    const address = sheet.contract?.propertyAddress ?? ''
    const result = await billingService.createInvoice({
      customerId: sheet.clientId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: [{ productId: pestProduct.id, quantity: 1, unitPrice: Number(sheet.jobAmount) }],
      notes: `Job Sheet ${sheet.jobNumber}${address ? ` — ${address}` : ''}`,
      referenceNumber: sheet.jobNumber,
    })
    if (!result.success) {
      await db.pestJobSheet.update({ where: { id }, data: { invoiceId: null } })
      return result
    }

    const invoice = result.data as { id: string }
    await db.pestJobSheet.update({
      where: { id },
      data: { invoiceId: invoice.id, status: 'COMPLETED', completedDate: new Date() },
    })
    await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'PestJobSheet', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

    if (sheet.status !== 'COMPLETED') {
      await maybeScheduleNextVisit(db, sheet)
    }

    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    await db.pestJobSheet.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
    return { success: false, error: { code: 'PJS-010', message: err instanceof Error ? err.message : 'Could not generate job sheet invoice.' } }
  }
}

// Phase 58 §2 — Pest Control: structured pesticide dosage/quantity per
// visit, replacing the single free-text pesticideUsed field for anything
// that needs a real quantity (safety/compliance record-keeping, and real
// stock deduction when the chemical is tracked as an Inventory Product). A
// visit commonly uses more than one chemical across different areas, so
// this is an add/remove ledger (mirrors Repair's JobCardPart), not a
// set-once field.

export async function listJobSheetPesticides(jobSheetId: string) {
  try {
    const db = getPrisma()
    const lines = await db.pestJobSheetPesticide.findMany({
      where: { jobSheetId },
      include: { product: { select: { productName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: lines }
  } catch (e: any) {
    console.error('[PJP_LIST_FAIL]', e)
    return { success: false, error: { code: 'PJP_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function addJobSheetPesticide(payload: {
  jobSheetId: string
  productId?: string
  pesticideName: string
  quantityUsed: number
  unit?: string
  dosageNote?: string
  targetPest?: string
}, userId?: string) {
  try {
    if (!payload.pesticideName?.trim()) return { success: false, error: { code: 'PJS-005', message: 'Pesticide name is required.' } }
    if (payload.quantityUsed <= 0) return { success: false, error: { code: 'PJS-006', message: 'Quantity used must be greater than zero.' } }
    const db = getPrisma()

    const sheet = await db.pestJobSheet.findUnique({ where: { id: payload.jobSheetId }, select: { id: true, jobNumber: true } })
    if (!sheet) return { success: false, error: { code: 'PJS-001', message: 'Job sheet not found.' } }

    if (payload.productId) {
      const product = await db.product.findUnique({ where: { id: payload.productId }, select: { id: true } })
      if (!product) return { success: false, error: { code: 'PJS-007', message: 'Pesticide product not found.' } }
    }

    try {
      const line = await db.$transaction(async (tx) => {
        if (payload.productId) {
          await inventoryService.reduceStockTx(
            tx, payload.productId, payload.quantityUsed,
            `Used on pest job sheet ${sheet.jobNumber}`, 'PEST_JOB_SHEET', sheet.jobNumber, userId
          )
        }
        return tx.pestJobSheetPesticide.create({
          data: {
            jobSheetId: payload.jobSheetId,
            productId: payload.productId ?? null,
            pesticideName: payload.pesticideName.trim(),
            quantityUsed: payload.quantityUsed,
            unit: payload.unit ?? 'ML',
            dosageNote: payload.dosageNote ?? null,
            targetPest: payload.targetPest ?? null,
          },
          include: { product: { select: { productName: true } } },
        })
      })
      if (userId) await logAction(userId, 'CREATE', 'PEST_JOB_SHEET_PESTICIDE', line.id, null, { jobSheetId: payload.jobSheetId, pesticideName: line.pesticideName, quantityUsed: line.quantityUsed })
      return { success: true, data: line }
    } catch (e: any) {
      if (e?.code === 'INV-002') return { success: false, error: { code: 'PJS-008', message: e.message } }
      throw e
    }
  } catch (e: any) {
    console.error('[PJP_ADD_FAIL]', e)
    return { success: false, error: { code: 'PJP_ADD_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function removeJobSheetPesticide(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const line = await db.pestJobSheetPesticide.findUnique({ where: { id } })
    if (!line) return { success: false, error: { code: 'PJS-009', message: 'Pesticide usage record not found.' } }

    const sheet = await db.pestJobSheet.findUnique({ where: { id: line.jobSheetId }, select: { jobNumber: true } })

    await db.$transaction(async (tx) => {
      if (line.productId) {
        await tx.inventoryMovement.create({
          data: {
            productId: line.productId,
            movementType: 'PEST_RETURN',
            quantity: line.quantityUsed,
            referenceType: 'PEST_JOB_SHEET',
            referenceId: sheet?.jobNumber ?? line.jobSheetId,
            remarks: `Removed from pest job sheet ${sheet?.jobNumber ?? line.jobSheetId}`,
            createdById: userId ?? null,
          },
        })
        await tx.inventory.update({
          where: { productId: line.productId },
          data: { quantity: { increment: line.quantityUsed } },
        })
      }
      await tx.pestJobSheetPesticide.delete({ where: { id } })
    })

    if (userId) await logAction(userId, 'DELETE', 'PEST_JOB_SHEET_PESTICIDE', id, line, null)
    return { success: true, data: { id } }
  } catch (e: any) {
    console.error('[PJP_REMOVE_FAIL]', e)
    return { success: false, error: { code: 'PJP_REMOVE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}
