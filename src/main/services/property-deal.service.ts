import { getPrisma } from '../database/db'
import { billingService } from './billing.service'

// PropertyDeal.dealValue/brokeragePercent/brokerageAmount/coBrokerSharePercent/
// coBrokerShareAmount are Prisma Decimal fields — Electron's IPC (structured
// clone) cannot serialize a Decimal instance and throws "An object could not
// be cloned" on every response that includes one. Exported so
// property.service.ts can apply it to deals nested under a property
// (getProperty's `include: { deals }`).
export function serializeDeal<T extends { dealValue: unknown; brokeragePercent: unknown; brokerageAmount: unknown; coBrokerSharePercent?: unknown; coBrokerShareAmount?: unknown }>(d: T): T {
  return {
    ...d,
    dealValue: Number(d.dealValue),
    brokeragePercent: Number(d.brokeragePercent),
    brokerageAmount: Number(d.brokerageAmount),
    coBrokerSharePercent: d.coBrokerSharePercent == null ? null : Number(d.coBrokerSharePercent),
    coBrokerShareAmount: d.coBrokerShareAmount == null ? null : Number(d.coBrokerShareAmount),
  }
}

export async function listPropertyDeals(filters?: { status?: string; propertyId?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.propertyId) where.propertyId = filters.propertyId

  const deals = await db.propertyDeal.findMany({
    where,
    include: {
      property: { select: { id: true, propertyType: true, location: true, listingType: true } },
      buyer: { select: { id: true, customerName: true, phone: true } },
      seller: { select: { id: true, customerName: true, phone: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  })
  return { success: true, data: deals.map(serializeDeal) }
}

// coBrokerShareAmount is always computed here, never accepted directly from
// the caller — keeps it from silently drifting out of sync with
// brokerageAmount/coBrokerSharePercent (the same "never trust a client-sent
// derived fact" discipline this codebase applies elsewhere, e.g. billing
// line totals).
function computeCoBrokerShare(brokerageAmount: number, coBrokerSharePercent?: number | null): number | null {
  if (coBrokerSharePercent == null) return null
  return (brokerageAmount * coBrokerSharePercent) / 100
}

export async function createPropertyDeal(payload: {
  propertyId: string
  buyerClientId: string
  sellerClientId: string
  dealValue: number
  brokeragePercent: number
  expectedRegistrationDate?: string
  notes?: string
  coBrokerName?: string
  coBrokerSharePercent?: number
}) {
  const db = getPrisma()
  const brokerageAmount = (payload.dealValue * payload.brokeragePercent) / 100

  const deal = await db.propertyDeal.create({
    data: {
      propertyId: payload.propertyId,
      buyerClientId: payload.buyerClientId,
      sellerClientId: payload.sellerClientId,
      dealValue: payload.dealValue,
      brokeragePercent: payload.brokeragePercent,
      brokerageAmount,
      expectedRegistrationDate: payload.expectedRegistrationDate ? new Date(payload.expectedRegistrationDate) : null,
      notes: payload.notes || null,
      coBrokerName: payload.coBrokerName?.trim() || null,
      coBrokerSharePercent: payload.coBrokerSharePercent ?? null,
      coBrokerShareAmount: computeCoBrokerShare(brokerageAmount, payload.coBrokerSharePercent),
    },
    include: {
      property: { select: { id: true, propertyType: true, location: true, listingType: true } },
      buyer: { select: { id: true, customerName: true, phone: true } },
      seller: { select: { id: true, customerName: true, phone: true } },
    },
  })

  await db.property.update({ where: { id: payload.propertyId }, data: { status: 'UNDER_NEGOTIATION' } })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'PropertyDeal', entityId: deal.id, newValue: JSON.stringify({ propertyId: deal.propertyId, dealValue: deal.dealValue }) } }).catch(() => {})
  return { success: true, data: serializeDeal(deal) }
}

export async function updatePropertyDeal(payload: {
  id: string
  dealValue?: number
  brokeragePercent?: number
  expectedRegistrationDate?: string | null
  status?: string
  invoiceId?: string | null
  notes?: string | null
  coBrokerName?: string | null
  coBrokerSharePercent?: number | null
}) {
  const db = getPrisma()
  const { id, expectedRegistrationDate, dealValue, brokeragePercent, coBrokerSharePercent, ...rest } = payload

  let brokerageUpdate: { brokerageAmount: number; dealValue?: number; brokeragePercent?: number } | undefined
  let coBrokerShareAmountUpdate: number | null | undefined
  if (dealValue !== undefined || brokeragePercent !== undefined || coBrokerSharePercent !== undefined) {
    const existing = await db.propertyDeal.findUniqueOrThrow({ where: { id }, select: { dealValue: true, brokeragePercent: true, coBrokerSharePercent: true } })
    const newDealValue = dealValue ?? Number(existing.dealValue)
    const newBrokeragePercent = brokeragePercent ?? Number(existing.brokeragePercent)
    const newBrokerageAmount = (newDealValue * newBrokeragePercent) / 100
    if (dealValue !== undefined || brokeragePercent !== undefined) {
      brokerageUpdate = {
        brokerageAmount: newBrokerageAmount,
        ...(dealValue !== undefined ? { dealValue } : {}),
        ...(brokeragePercent !== undefined ? { brokeragePercent } : {}),
      }
    }
    // Recompute the co-broker share whenever ANY of the three inputs it
    // depends on changes — not just when coBrokerSharePercent itself is
    // touched — otherwise editing dealValue/brokeragePercent alone would
    // silently leave a stale coBrokerShareAmount behind.
    const effectiveCoBrokerPercent = coBrokerSharePercent !== undefined ? coBrokerSharePercent : (existing.coBrokerSharePercent == null ? null : Number(existing.coBrokerSharePercent))
    coBrokerShareAmountUpdate = computeCoBrokerShare(newBrokerageAmount, effectiveCoBrokerPercent)
  }

  const deal = await db.propertyDeal.update({
    where: { id },
    data: {
      ...rest,
      ...brokerageUpdate,
      ...(coBrokerSharePercent !== undefined ? { coBrokerSharePercent } : {}),
      ...(coBrokerShareAmountUpdate !== undefined ? { coBrokerShareAmount: coBrokerShareAmountUpdate } : {}),
      ...(expectedRegistrationDate !== undefined ? { expectedRegistrationDate: expectedRegistrationDate ? new Date(expectedRegistrationDate) : null } : {}),
    },
    include: {
      property: { select: { id: true, propertyType: true, location: true, listingType: true } },
      buyer: { select: { id: true, customerName: true, phone: true } },
      seller: { select: { id: true, customerName: true, phone: true } },
    },
  })

  if (payload.status === 'REGISTERED') {
    const listingType = deal.property.listingType
    const newPropertyStatus = listingType === 'SALE' ? 'SOLD' : 'RENTED'
    await db.property.update({ where: { id: deal.propertyId }, data: { status: newPropertyStatus } })
  } else if (payload.status === 'FELL_THROUGH') {
    await db.property.update({ where: { id: deal.propertyId }, data: { status: 'AVAILABLE' } })
  }

  const dealAuditAction = payload.status === 'REGISTERED' ? 'REGISTERED' : payload.status === 'FELL_THROUGH' ? 'FELL_THROUGH' : 'UPDATE'
  await db.auditLog.create({ data: { action: dealAuditAction, entityType: 'PropertyDeal', entityId: deal.id } }).catch(() => {})
  return { success: true, data: serializeDeal(deal) }
}

// Real bug found 2026-07-23: this had no atomic claim on invoiceId — just a
// plain read-then-check (`if (deal.invoiceId) return error`) with the
// actual write only happening via a plain update() AFTER
// billingService.createInvoice() had already run. Two concurrent "Generate
// Commission Invoice" calls for the same deal could both pass the stale
// check and each create a real, separate Invoice — a genuine double-bill
// of the buyer for the same brokerage. Fixed with the same atomic
// conditional-claim + release-on-failure shape used by
// car-job-card.service.ts / job-card.service.ts / membership.service.ts.
const PROPERTY_DEAL_INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateCommissionInvoice(dealId: string) {
  const db = getPrisma()

  const claim = await db.propertyDeal.updateMany({ where: { id: dealId, invoiceId: null }, data: { invoiceId: PROPERTY_DEAL_INVOICE_CLAIM_SENTINEL } })
  if (claim.count === 0) {
    const existing = await db.propertyDeal.findUnique({ where: { id: dealId }, select: { id: true } })
    if (!existing) return { success: false, error: { code: 'PROP-002', message: 'Deal not found.' } }
    return { success: false, error: { code: 'PROP-003', message: 'Commission invoice already generated for this deal.' } }
  }

  try {
    const deal = await db.propertyDeal.findUnique({
      where: { id: dealId },
      include: {
        buyer: { select: { id: true, customerName: true } },
        property: { select: { id: true, location: true, propertyType: true } },
      },
    })
    if (!deal) {
      await db.propertyDeal.update({ where: { id: dealId }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PROP-002', message: 'Deal not found.' } }
    }

    // Find or create a "Real Estate Commission" service product (SAC 997212, 18% GST)
    let commissionProduct = await db.product.findFirst({
      where: { hsnCode: '997212', isActive: true },
    })
    if (!commissionProduct) {
      commissionProduct = await db.product.create({
        data: {
          productName: 'Real Estate Commission',
          productType: 'SERVICE',
          hsnCode: '997212',
          sellingPrice: 0,
          taxRate: 18,
          unit: 'NOS',
          isActive: true,
        },
      })
    }

    const result = await billingService.createInvoice({
      customerId: deal.buyerClientId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: [{
        productId: commissionProduct.id,
        quantity: 1,
        unitPrice: Number(deal.brokerageAmount),
      }],
      notes: `Commission on deal: ${deal.property.propertyType} at ${deal.property.location}`,
      referenceNumber: dealId.slice(0, 12),
    })

    if (!result.success) {
      await db.propertyDeal.update({ where: { id: dealId }, data: { invoiceId: null } })
      return result
    }

    const invoice = result.data as { id: string }
    await db.propertyDeal.update({ where: { id: dealId }, data: { invoiceId: invoice.id } })
    await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'PropertyDeal', entityId: dealId, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    await db.propertyDeal.update({ where: { id: dealId }, data: { invoiceId: null } }).catch(() => {})
    return { success: false, error: { code: 'PROP-005', message: err instanceof Error ? err.message : 'Could not generate commission invoice.' } }
  }
}

export async function deletePropertyDeal(id: string) {
  const db = getPrisma()
  const deal = await db.propertyDeal.findUnique({ where: { id }, select: { propertyId: true, invoiceId: true, status: true } })
  if (deal?.invoiceId) {
    return { success: false, error: { code: 'PROP-004', message: 'Cannot delete a registered deal that has an associated invoice.' } }
  }
  await db.propertyDeal.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'PropertyDeal', entityId: id } }).catch(() => {})
  if (deal) {
    const [otherRegistered, otherInProgress] = await Promise.all([
      db.propertyDeal.count({ where: { propertyId: deal.propertyId, status: 'REGISTERED' } }),
      db.propertyDeal.count({ where: { propertyId: deal.propertyId, status: 'IN_PROGRESS' } }),
    ])
    if (otherRegistered === 0 && otherInProgress === 0) {
      await db.property.update({ where: { id: deal.propertyId }, data: { status: 'AVAILABLE' } })
    }
  }
  return { success: true }
}
