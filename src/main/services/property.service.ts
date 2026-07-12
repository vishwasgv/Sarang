import { getPrisma } from '../database/db'
import { serializeDeal } from './property-deal.service'

// Property.area/askingPrice/monthlyRent/securityDeposit/brokeragePercent
// are Prisma Decimal fields — Electron's IPC (structured clone) cannot
// serialize a Decimal instance and throws "An object could not be cloned"
// on every response that includes one. getProperty also nests `deals[]`
// (its own 3 Decimal fields), serialized via the shared helper from
// property-deal.service.ts so the fix stays in one place.
function serializeProperty<T extends {
  area: unknown; askingPrice: unknown; monthlyRent: unknown; securityDeposit: unknown; brokeragePercent: unknown; deals?: unknown[]
}>(p: T): T {
  return {
    ...p,
    area: Number(p.area),
    askingPrice: p.askingPrice == null ? null : Number(p.askingPrice),
    monthlyRent: p.monthlyRent == null ? null : Number(p.monthlyRent),
    securityDeposit: p.securityDeposit == null ? null : Number(p.securityDeposit),
    brokeragePercent: p.brokeragePercent == null ? null : Number(p.brokeragePercent),
    ...(p.deals ? { deals: p.deals.map((d) => serializeDeal(d as Parameters<typeof serializeDeal>[0])) } : {}),
  }
}

export async function listProperties(filters?: { status?: string; listingType?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.listingType) where.listingType = filters.listingType
  if (filters?.search) where.location = { contains: filters.search }

  const properties = await db.property.findMany({
    where,
    include: {
      owner: { select: { id: true, customerName: true, phone: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  })
  return { success: true, data: properties.map(serializeProperty) }
}

export async function getProperty(id: string) {
  const db = getPrisma()
  const property = await db.property.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, customerName: true, phone: true } },
      inquiries: {
        include: { buyer: { select: { id: true, customerName: true, phone: true } } },
        orderBy: { inquiryDate: 'desc' },
      },
      deals: {
        include: {
          buyer: { select: { id: true, customerName: true, phone: true } },
          seller: { select: { id: true, customerName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!property) return { success: false, error: { code: 'PROP-001', message: 'Property not found.' } }
  return { success: true, data: serializeProperty(property) }
}

export async function createProperty(payload: {
  propertyType: string
  listingType: string
  location: string
  area: number
  ownerClientId: string
  floorNumber?: number
  totalFloors?: number
  askingPrice?: number
  monthlyRent?: number
  securityDeposit?: number
  brokeragePercent?: number
  photos?: string[]
  amenities?: string[]
  description?: string
  notes?: string
}) {
  const db = getPrisma()
  const property = await db.property.create({
    data: {
      propertyType: payload.propertyType,
      listingType: payload.listingType,
      location: payload.location,
      area: payload.area,
      ownerClientId: payload.ownerClientId,
      floorNumber: payload.floorNumber ?? null,
      totalFloors: payload.totalFloors ?? null,
      askingPrice: payload.askingPrice ?? null,
      monthlyRent: payload.monthlyRent ?? null,
      securityDeposit: payload.securityDeposit ?? null,
      brokeragePercent: payload.brokeragePercent ?? null,
      photos: JSON.stringify(payload.photos ?? []),
      amenities: JSON.stringify(payload.amenities ?? []),
      description: payload.description || null,
      notes: payload.notes || null,
    },
    include: {
      owner: { select: { id: true, customerName: true, phone: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'Property', entityId: property.id, newValue: JSON.stringify({ propertyType: property.propertyType, location: property.location }) } }).catch(() => {})
  return { success: true, data: serializeProperty(property) }
}

export async function updateProperty(payload: {
  id: string
  propertyType?: string
  listingType?: string
  status?: string
  location?: string
  area?: number
  floorNumber?: number | null
  totalFloors?: number | null
  askingPrice?: number | null
  monthlyRent?: number | null
  securityDeposit?: number | null
  ownerClientId?: string
  brokeragePercent?: number | null
  photos?: string[]
  amenities?: string[]
  description?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, photos, amenities, ...rest } = payload
  const property = await db.property.update({
    where: { id },
    data: {
      ...rest,
      ...(photos !== undefined ? { photos: JSON.stringify(photos) } : {}),
      ...(amenities !== undefined ? { amenities: JSON.stringify(amenities) } : {}),
    },
    include: {
      owner: { select: { id: true, customerName: true, phone: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'Property', entityId: property.id } }).catch(() => {})
  return { success: true, data: serializeProperty(property) }
}

export async function deleteProperty(id: string) {
  const db = getPrisma()
  await db.property.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'Property', entityId: id } }).catch(() => {})
  return { success: true }
}

export async function getPropertyKPIs() {
  const db = getPrisma()
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)

  const [activeListings, dealsInProgress, newInquiries, totalListings] = await Promise.all([
    db.property.count({ where: { status: 'AVAILABLE' } }),
    db.propertyDeal.count({ where: { status: 'IN_PROGRESS' } }),
    db.propertyInquiry.count({ where: { createdAt: { gte: weekStart } } }),
    db.property.count(),
  ])
  return { success: true, data: { activeListings, dealsInProgress, newInquiries, totalListings } }
}
