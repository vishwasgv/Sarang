import { getPrisma } from '../database/db'
import { serializePestJobSheet } from './pest-job-sheet.service'
import { buildWhatsAppLink } from './notification-queue.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// AMC (annual maintenance contract) renewal reminders — previously
// PestServiceContract.endDate/serviceFrequency were captured but nothing
// ever read them, so a contract could lapse with no one prompted to renew
// it. Same 30-day/7-day WhatsApp-queue pattern membership.service.ts already
// uses for membership expiry — manual-send by design (see
// TRUST_HARDENING_MASTER_PROMPT.md Section 0), not automatic delivery.
async function scheduleContractRenewalNotifications(
  clientId: string,
  customerName: string,
  phone: string | null,
  endDate: Date,
  contractNumber: string
) {
  try {
    const db = getPrisma()
    const thirtyDaysBefore = new Date(endDate)
    thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30)
    const sevenDaysBefore = new Date(endDate)
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7)

    const expDateStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const customerPhone = phone ?? ''
    const body30 = `Dear ${customerName}, your pest control contract (${contractNumber}) expires on ${expDateStr}. Renew now to stay protected! Powered by Sarang | www.aszurex.com`
    const body7 = `Dear ${customerName}, your pest control contract (${contractNumber}) expires in 7 days (${expDateStr}). Renew today to avoid a gap in coverage! Powered by Sarang | www.aszurex.com`
    const now = new Date()

    if (thirtyDaysBefore > now) {
      const link30 = customerPhone ? await buildWhatsAppLink(customerPhone, body30) : null
      await db.notificationQueue.create({
        data: { customerId: clientId, customerName, customerPhone, notificationType: 'CONTRACT_RENEWAL_30D', templateBody: body30, whatsappLink: link30, scheduledFor: thirtyDaysBefore },
      })
    }
    if (sevenDaysBefore > now) {
      const link7 = customerPhone ? await buildWhatsAppLink(customerPhone, body7) : null
      await db.notificationQueue.create({
        data: { customerId: clientId, customerName, customerPhone, notificationType: 'CONTRACT_RENEWAL_7D', templateBody: body7, whatsappLink: link7, scheduledFor: sevenDaysBefore },
      })
    }
  } catch {
    // Non-critical — silently ignore notification scheduling errors, same convention as membership.service.ts
  }
}

// PestServiceContract.contractValue is a Prisma Decimal field —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes
// one. getPestContract also nests `jobSheets[]` (its own Decimal field,
// jobAmount), serialized via the shared helper from
// pest-job-sheet.service.ts so the fix stays in one place.
function serializePestContract<T extends { contractValue: unknown; jobSheets?: unknown[] }>(c: T): T {
  return {
    ...c,
    contractValue: Number(c.contractValue),
    ...(c.jobSheets ? { jobSheets: c.jobSheets.map((s) => serializePestJobSheet(s as Parameters<typeof serializePestJobSheet>[0])) } : {}),
  }
}

async function generateContractNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'pest_contract_number_sequence', 'PCT', 5,
    async () => {
      const last = await tx.pestServiceContract.findFirst({ orderBy: { createdAt: 'desc' }, select: { contractNumber: true } })
      return last ? parseInt(last.contractNumber.replace('PCT-', ''), 10) : 0
    }
  )
}

export async function listPestContracts(filters?: { status?: string; clientId?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.clientId) where.clientId = filters.clientId
  if (filters?.search) {
    where.OR = [
      { contractNumber: { contains: filters.search } },
      { propertyAddress: { contains: filters.search } },
      { client: { customerName: { contains: filters.search } } },
    ]
  }
  const contracts = await db.pestServiceContract.findMany({
    where,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true } },
      _count: { select: { jobSheets: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: contracts.map(serializePestContract) }
}

export async function getPestContract(id: string) {
  const db = getPrisma()
  const contract = await db.pestServiceContract.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true } },
      jobSheets: { orderBy: { visitDate: 'desc' } },
    },
  })
  if (!contract) return { success: false, error: { code: 'PCT-001', message: 'Contract not found.' } }
  return { success: true, data: serializePestContract(contract) }
}

export async function createPestContract(payload: {
  clientId: string
  propertyAddress: string
  propertyType?: string
  pestTypes?: string[]
  serviceFrequency?: string
  startDate: string
  endDate?: string
  contractValue: number
  status?: string
  assignedToId?: string
  notes?: string
}) {
  const db = getPrisma()
  const contract = await db.$transaction(async (tx) => {
    const contractNumber = await generateContractNumber(tx)
    return tx.pestServiceContract.create({
      data: {
        contractNumber,
        clientId: payload.clientId,
        propertyAddress: payload.propertyAddress,
        propertyType: payload.propertyType ?? 'RESIDENTIAL',
        pestTypes: JSON.stringify(payload.pestTypes ?? []),
        serviceFrequency: payload.serviceFrequency ?? 'QUARTERLY',
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        contractValue: payload.contractValue,
        status: payload.status ?? 'ACTIVE',
        assignedToId: payload.assignedToId ?? null,
        notes: payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
        _count: { select: { jobSheets: true } },
      },
    })
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'PestServiceContract', entityId: contract.id, newValue: JSON.stringify({ contractNumber: contract.contractNumber }) } }).catch(() => {})

  if (contract.endDate) {
    await scheduleContractRenewalNotifications(contract.clientId, contract.client.customerName, contract.client.phone, contract.endDate, contract.contractNumber)
  }

  return { success: true, data: serializePestContract(contract) }
}

export async function updatePestContract(payload: {
  id: string
  propertyAddress?: string
  propertyType?: string
  pestTypes?: string[]
  serviceFrequency?: string
  startDate?: string
  endDate?: string | null
  contractValue?: number
  status?: string
  assignedToId?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, pestTypes, startDate, endDate, ...rest } = payload
  const data: Record<string, unknown> = { ...rest }
  if (pestTypes !== undefined) data.pestTypes = JSON.stringify(pestTypes)
  if (startDate !== undefined) data.startDate = new Date(startDate)
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null

  // Only need the prior endDate to detect an actual change below.
  const existing = endDate !== undefined ? await db.pestServiceContract.findUnique({ where: { id }, select: { endDate: true } }) : null

  const contract = await db.pestServiceContract.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true } },
      _count: { select: { jobSheets: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'PestServiceContract', entityId: contract.id } }).catch(() => {})

  // Contract renewed/rescheduled with a new end date — queue fresh reminders
  // for it. Deliberately doesn't try to find and cancel any stale reminders
  // already queued against the old date (NotificationQueue has no per-contract
  // reference, only customerId, and a client can have more than one contract)
  // — worst case a staff member sees one extra, slightly-off reminder they can
  // dismiss, not a functional bug.
  if (endDate !== undefined && contract.endDate && contract.endDate.getTime() !== existing?.endDate?.getTime()) {
    await scheduleContractRenewalNotifications(contract.clientId, contract.client.customerName, contract.client.phone, contract.endDate, contract.contractNumber)
  }

  return { success: true, data: serializePestContract(contract) }
}

export async function deletePestContract(id: string) {
  const db = getPrisma()
  const count = await db.pestJobSheet.count({ where: { contractId: id } })
  if (count > 0) {
    return { success: false, error: { code: 'PCT-002', message: `Cannot delete contract with ${count} job sheet(s). Delete all job sheets first or cancel the contract.` } }
  }
  await db.pestServiceContract.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'PestServiceContract', entityId: id } }).catch(() => {})
  return { success: true }
}

// Fresh-audit fix (2026-07-12): PestServiceContract.contractValue was NEVER
// billed anywhere — only ad-hoc PestJobSheet visits invoiced. For a business
// whose whole point is a recurring contract fee, that's a real revenue gap,
// not just polish. Same period-keyed ("YYYY-MM") claim pattern as
// retainer.service.ts/engagement.service.ts — staff trigger this manually at
// whatever cadence matches the contract's own serviceFrequency (the system
// only prevents double-invoicing the SAME period, it doesn't enforce the
// schedule itself, same as the other two recurring-fee services). Reuses
// pest-job-sheet.service.ts's own SAC 998534 (Pest control and extermination
// services, 18% GST) find-or-create product so a contract-fee invoice and a
// job-sheet invoice always land on the identical line-item product.
export async function generateContractInvoice(contractId: string, period?: string) {
  const db = getPrisma()
  try {
    const targetPeriod = period ?? new Date().toISOString().slice(0, 7)
    const contract = await db.pestServiceContract.findUnique({
      where: { id: contractId },
      include: { client: { select: { id: true, customerName: true } } },
    })
    if (!contract) return { success: false, error: { code: 'PCT-003', message: 'Contract not found.' } }
    if (contract.lastInvoicedPeriod === targetPeriod) {
      return { success: false, error: { code: 'PCT-004', message: `Already invoiced for ${targetPeriod}.` } }
    }
    if (Number(contract.contractValue) <= 0) {
      return { success: false, error: { code: 'PCT-005', message: 'Contract value must be greater than zero.' } }
    }
    const priorPeriod = contract.lastInvoicedPeriod

    const claim = await db.pestServiceContract.updateMany({
      where: { id: contractId, lastInvoicedPeriod: priorPeriod },
      data: { lastInvoicedPeriod: targetPeriod },
    })
    if (claim.count === 0) {
      return { success: false, error: { code: 'PCT-004', message: 'Already invoiced for this period.' } }
    }

    try {
      let product = await db.product.findFirst({ where: { hsnCode: '998534', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Pest Control Service', productType: 'SERVICE', hsnCode: '998534', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: contract.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(contract.contractValue),
        }],
        notes: `Pest control contract: ${contract.contractNumber} — ${targetPeriod}`,
        referenceNumber: contractId.slice(0, 12),
      })
      if (!result.success) {
        await db.pestServiceContract.update({ where: { id: contractId }, data: { lastInvoicedPeriod: priorPeriod } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'PestServiceContract', entityId: contractId, newValue: JSON.stringify({ invoiceId: invoice.id, period: targetPeriod }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id, period: targetPeriod } }
    } catch (err) {
      await db.pestServiceContract.update({ where: { id: contractId }, data: { lastInvoicedPeriod: priorPeriod } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'PCT-006', message: err instanceof Error ? err.message : 'Could not generate contract invoice.' } }
  }
}

export async function getPestContractKPIs() {
  const db = getPrisma()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysLater = new Date(todayStart)
  sevenDaysLater.setDate(todayStart.getDate() + 7)
  sevenDaysLater.setHours(23, 59, 59, 999)

  const [activeContracts, pendingJobSheets, scheduledThisWeek] = await Promise.all([
    db.pestServiceContract.count({ where: { status: 'ACTIVE' } }),
    db.pestJobSheet.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    db.pestJobSheet.count({ where: { visitDate: { gte: todayStart, lte: sevenDaysLater }, status: { not: 'CANCELLED' } } }),
  ])
  return { success: true, data: { activeContracts, pendingJobSheets, scheduledThisWeek } }
}
