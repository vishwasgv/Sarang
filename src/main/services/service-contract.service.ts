import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Phase 67 §9.1 — Service item 3: Recurring service contract, an AMC-like
// arrangement for repeat customers. Mirrors pest-contract.service.ts's own
// exact shape — the same period-keyed ("YYYY-MM") lastInvoicedPeriod claim
// pattern retainer.service.ts/engagement.service.ts/pest-contract.service.ts
// all already established, generalized for the plain Service vertical
// rather than pest-specific fields.

async function generateContractNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'service_contract_number_sequence', 'SCT', 5,
    async () => {
      const last = await tx.serviceContract.findFirst({ orderBy: { createdAt: 'desc' }, select: { contractNumber: true } })
      return last ? parseInt(last.contractNumber.replace('SCT-', ''), 10) : 0
    }
  )
}

export async function listServiceContracts(filters?: { status?: string; customerId?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.customerId) where.customerId = filters.customerId
  const contracts = await db.serviceContract.findMany({
    where,
    include: { customer: { select: { id: true, customerName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: contracts }
}

export async function getServiceContract(id: string) {
  const db = getPrisma()
  const contract = await db.serviceContract.findUnique({
    where: { id },
    include: { customer: { select: { id: true, customerName: true, phone: true } } },
  })
  if (!contract) return { success: false, error: { code: 'SCT-001', message: 'Contract not found.' } }
  return { success: true, data: contract }
}

export async function createServiceContract(payload: {
  customerId: string
  scope?: string
  serviceFrequency?: string
  startDate: string
  endDate?: string
  contractValue: number
  notes?: string
  createdById?: string
}) {
  try {
    if (payload.contractValue <= 0) return { success: false, error: { code: 'SCT-002', message: 'Contract value must be greater than zero.' } }
    const db = getPrisma()
    const contract = await db.$transaction(async (tx) => {
      const contractNumber = await generateContractNumber(tx)
      return tx.serviceContract.create({
        data: {
          contractNumber,
          customerId: payload.customerId,
          scope: payload.scope?.trim() || null,
          serviceFrequency: payload.serviceFrequency ?? 'MONTHLY',
          startDate: new Date(payload.startDate),
          endDate: payload.endDate ? new Date(payload.endDate) : null,
          contractValue: payload.contractValue,
          notes: payload.notes?.trim() || null,
          createdById: payload.createdById ?? null,
        },
        include: { customer: { select: { id: true, customerName: true, phone: true } } },
      })
    })
    await logAction({ userId: payload.createdById, action: 'SERVICE_CONTRACT_CREATED', entityType: 'ServiceContract', entityId: contract.id, newValue: { contractNumber: contract.contractNumber } })
    return { success: true, data: contract }
  } catch (e) {
    return { success: false, error: { code: 'SCT-003', message: e instanceof Error ? e.message : 'Could not create service contract.' } }
  }
}

export async function updateServiceContract(payload: { id: string; status?: string; endDate?: string | null; contractValue?: number; notes?: string | null }) {
  try {
    const db = getPrisma()
    const existing = await db.serviceContract.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'SCT-001', message: 'Contract not found.' } }
    if (payload.contractValue !== undefined && payload.contractValue <= 0) return { success: false, error: { code: 'SCT-002', message: 'Contract value must be greater than zero.' } }

    const contract = await db.serviceContract.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        endDate: payload.endDate !== undefined ? (payload.endDate ? new Date(payload.endDate) : null) : undefined,
        contractValue: payload.contractValue,
        notes: payload.notes !== undefined ? (payload.notes?.trim() || null) : undefined,
      },
      include: { customer: { select: { id: true, customerName: true, phone: true } } },
    })
    await logAction({ action: 'SERVICE_CONTRACT_UPDATED', entityType: 'ServiceContract', entityId: contract.id })
    return { success: true, data: contract }
  } catch (e) {
    return { success: false, error: { code: 'SCT-004', message: e instanceof Error ? e.message : 'Could not update service contract.' } }
  }
}

// Same period-keyed claim pattern pest-contract.service.ts's own
// generateContractInvoice already established — staff trigger this manually
// at whatever cadence matches the contract's own serviceFrequency; the
// system only prevents double-invoicing the SAME period.
export async function generateServiceContractInvoice(contractId: string, period?: string) {
  const db = getPrisma()
  try {
    const targetPeriod = period ?? new Date().toISOString().slice(0, 7)
    const contract = await db.serviceContract.findUnique({
      where: { id: contractId },
      include: { customer: { select: { id: true, customerName: true } } },
    })
    if (!contract) return { success: false, error: { code: 'SCT-001', message: 'Contract not found.' } }
    if (contract.lastInvoicedPeriod === targetPeriod) {
      return { success: false, error: { code: 'SCT-005', message: `Already invoiced for ${targetPeriod}.` } }
    }
    const priorPeriod = contract.lastInvoicedPeriod

    const claim = await db.serviceContract.updateMany({
      where: { id: contractId, lastInvoicedPeriod: priorPeriod },
      data: { lastInvoicedPeriod: targetPeriod },
    })
    if (claim.count === 0) {
      return { success: false, error: { code: 'SCT-005', message: 'Already invoiced for this period.' } }
    }

    try {
      let product = await db.product.findFirst({ where: { hsnCode: '998313', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Professional / Consulting Services', productType: 'SERVICE', hsnCode: '998313', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: contract.customerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{ productId: product.id, quantity: 1, unitPrice: contract.contractValue }],
        notes: `Service contract: ${contract.contractNumber} — ${targetPeriod}`,
        referenceNumber: contract.contractNumber,
      })
      if (!result.success) {
        await db.serviceContract.update({ where: { id: contractId }, data: { lastInvoicedPeriod: priorPeriod } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string }
      await logAction({ action: 'SERVICE_CONTRACT_INVOICED', entityType: 'ServiceContract', entityId: contractId, newValue: { invoiceId: invoice.id, period: targetPeriod } })
      return { success: true, data: { invoiceId: invoice.id, period: targetPeriod } }
    } catch (err) {
      await db.serviceContract.update({ where: { id: contractId }, data: { lastInvoicedPeriod: priorPeriod } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'SCT-006', message: e instanceof Error ? e.message : 'Could not generate contract invoice.' } }
  }
}

export const serviceContractService = {
  listServiceContracts,
  getServiceContract,
  createServiceContract,
  updateServiceContract,
  generateServiceContractInvoice,
}
