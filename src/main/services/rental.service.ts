import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'
import { buildWhatsAppLink } from './notification-queue.service'
import { roundCurrency } from './currency.service'
import { ServiceError } from '../errors/service-error'

type PrismaTx = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

export type RateBasis = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
export type RentalTrackingType = 'UNIT' | 'BULK'

export interface RentalRate {
  basis: RateBasis
  amount: number
}

// Availability is always computed live from active RentalBooking rows, never
// from a physical Inventory.quantity decrement — see
// PHASE_54G_RENTAL_TECHNICAL_SPEC.md Section 2.2. A reservation must block
// availability before checkout (two customers reserving the same last tent
// for overlapping dates must not both succeed), which a decrement-at-
// checkout-only model would miss.
const ACTIVE_BOOKING_STATUSES = ['RESERVED', 'CHECKED_OUT']

// Fixed-length units (not calendar months/years) — deliberately avoids
// calendar arithmetic (DST, month-length, leap-year) edge cases, which would
// be a real source of the "logical errors" this spec was asked to avoid. A
// documented, consistent business rule beats a "more correct-looking" one
// that silently misbehaves once a year.
const MS_PER_HOUR = 3_600_000
const UNIT_MS: Record<RateBasis, number> = {
  HOUR: MS_PER_HOUR,
  DAY: MS_PER_HOUR * 24,
  WEEK: MS_PER_HOUR * 24 * 7,
  MONTH: MS_PER_HOUR * 24 * 30,
  YEAR: MS_PER_HOUR * 24 * 365,
}

// A booking of exactly 1 day bills as 1 day, not 0 — ceil, with a floor of 1
// full unit so a booking can never bill as zero.
function computeDurationUnits(start: Date, end: Date, basis: RateBasis): number {
  const ms = end.getTime() - start.getTime()
  if (ms <= 0) return 1
  return Math.max(1, Math.ceil(ms / UNIT_MS[basis]))
}

function parseRentalRates(raw: string): RentalRate[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function getLateFeeMultiplier(): Promise<number> {
  try {
    const db = getPrisma()
    const s = await db.setting.findUnique({ where: { settingKey: 'rental_late_fee_multiplier' } })
    const mult = s ? parseFloat(s.settingValue) : NaN
    return Number.isFinite(mult) && mult > 0 ? mult : 1.5
  } catch { return 1.5 }
}

// ─── Rental Units (asset roster for UNIT-tracked items) ─────────────────────

export interface RentalUnitRecord {
  id: string
  productId: string
  productName: string
  unitLabel: string
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED'
  conditionNotes: string | null
  purchaseDate: string | null
  unitCost: number
  serviceIntervalRentals: number | null
  serviceIntervalDays: number | null
  rentalCountSinceService: number
  lastServicedAt: string | null
  dueForService: boolean
  createdAt: string
  updatedAt: string
}

type UnitRow = {
  id: string; productId: string; unitLabel: string; status: string; conditionNotes: string | null
  purchaseDate: Date | null; unitCost: number
  serviceIntervalRentals: number | null; serviceIntervalDays: number | null
  rentalCountSinceService: number; lastServicedAt: Date | null
  createdAt: Date; updatedAt: Date; product: { productName: string }
}

function serializeUnit(u: UnitRow): RentalUnitRecord {
  return {
    id: u.id, productId: u.productId, productName: u.product.productName, unitLabel: u.unitLabel,
    status: u.status as RentalUnitRecord['status'], conditionNotes: u.conditionNotes,
    purchaseDate: u.purchaseDate ? u.purchaseDate.toISOString() : null, unitCost: u.unitCost,
    serviceIntervalRentals: u.serviceIntervalRentals, serviceIntervalDays: u.serviceIntervalDays,
    rentalCountSinceService: u.rentalCountSinceService,
    lastServicedAt: u.lastServicedAt ? u.lastServicedAt.toISOString() : null,
    dueForService: isUnitDueForService(u),
    createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString(),
  }
}

// Whether this unit has crossed either configured maintenance threshold —
// shared by returnBooking() (which acts on it) and the UI (which just
// displays it), so the two can never disagree about what "due" means.
function isUnitDueForService(u: { serviceIntervalRentals: number | null; serviceIntervalDays: number | null; rentalCountSinceService: number; lastServicedAt: Date | null; createdAt: Date }): boolean {
  if (u.serviceIntervalRentals != null && u.rentalCountSinceService >= u.serviceIntervalRentals) return true
  if (u.serviceIntervalDays != null) {
    const since = u.lastServicedAt ?? u.createdAt
    const daysSince = (Date.now() - since.getTime()) / (24 * 3_600_000)
    if (daysSince >= u.serviceIntervalDays) return true
  }
  return false
}

export async function listRentalUnits(filters?: { productId?: string; status?: string }): Promise<{ success: boolean; data?: { units: RentalUnitRecord[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.rentalUnit.findMany({
      where: { productId: filters?.productId, status: filters?.status },
      include: { product: { select: { productName: true } } },
      orderBy: { unitLabel: 'asc' },
    })
    return { success: true, data: { units: rows.map(serializeUnit) } }
  } catch (e) {
    return { success: false, error: { code: 'RENT-027', message: e instanceof Error ? e.message : 'Could not load rental units.' } }
  }
}

export async function createRentalUnit(payload: { productId: string; unitLabel: string; conditionNotes?: string; purchaseDate?: string; unitCost?: number; serviceIntervalRentals?: number; serviceIntervalDays?: number }): Promise<{ success: boolean; data?: RentalUnitRecord; error?: { code: string; message: string } }> {
  try {
    if (!payload.unitLabel?.trim()) return { success: false, error: { code: 'RENT-028', message: 'Unit label is required.' } }
    if (payload.serviceIntervalRentals !== undefined && payload.serviceIntervalRentals <= 0) return { success: false, error: { code: 'RENT-036', message: 'Service interval (rentals) must be greater than zero.' } }
    if (payload.serviceIntervalDays !== undefined && payload.serviceIntervalDays <= 0) return { success: false, error: { code: 'RENT-036', message: 'Service interval (days) must be greater than zero.' } }
    const db = getPrisma()
    const product = await db.product.findUnique({ where: { id: payload.productId } })
    if (!product || !product.isRentable) return { success: false, error: { code: 'RENT-001', message: 'Product not found or not marked as rentable.' } }
    if (product.rentalTrackingType !== 'UNIT') return { success: false, error: { code: 'RENT-029', message: 'This product is not configured for unit-level tracking.' } }

    const unit = await db.rentalUnit.create({
      data: {
        productId: payload.productId, unitLabel: payload.unitLabel.trim(),
        conditionNotes: payload.conditionNotes?.trim() || null,
        purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : null,
        unitCost: payload.unitCost ?? 0,
        serviceIntervalRentals: payload.serviceIntervalRentals ?? null,
        serviceIntervalDays: payload.serviceIntervalDays ?? null,
      },
      include: { product: { select: { productName: true } } },
    })
    await logAction({ action: 'RENTAL_UNIT_CREATED', entityType: 'RentalUnit', entityId: unit.id })
    return { success: true, data: serializeUnit(unit) }
  } catch (e) {
    return { success: false, error: { code: 'RENT-030', message: e instanceof Error ? e.message : 'Could not create rental unit.' } }
  }
}

export async function updateRentalUnit(payload: { id: string; unitLabel?: string; status?: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED'; conditionNotes?: string; serviceIntervalRentals?: number | null; serviceIntervalDays?: number | null }): Promise<{ success: boolean; data?: RentalUnitRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.rentalUnit.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'RENT-031', message: 'Rental unit not found.' } }
    if (existing.status === 'RENTED' && payload.status && payload.status !== 'AVAILABLE') {
      return { success: false, error: { code: 'RENT-032', message: 'Cannot change the status of a unit that is currently rented out — it will return to Available automatically when its booking is returned.' } }
    }
    if (payload.serviceIntervalRentals != null && payload.serviceIntervalRentals <= 0) return { success: false, error: { code: 'RENT-036', message: 'Service interval (rentals) must be greater than zero.' } }
    if (payload.serviceIntervalDays != null && payload.serviceIntervalDays <= 0) return { success: false, error: { code: 'RENT-036', message: 'Service interval (days) must be greater than zero.' } }
    const unit = await db.rentalUnit.update({
      where: { id: payload.id },
      data: {
        unitLabel: payload.unitLabel?.trim() || undefined,
        status: existing.status === 'RENTED' ? undefined : payload.status,
        conditionNotes: payload.conditionNotes !== undefined ? (payload.conditionNotes.trim() || null) : undefined,
        serviceIntervalRentals: payload.serviceIntervalRentals,
        serviceIntervalDays: payload.serviceIntervalDays,
      },
      include: { product: { select: { productName: true } } },
    })
    await logAction({ action: 'RENTAL_UNIT_UPDATED', entityType: 'RentalUnit', entityId: unit.id })
    return { success: true, data: serializeUnit(unit) }
  } catch (e) {
    return { success: false, error: { code: 'RENT-033', message: e instanceof Error ? e.message : 'Could not update rental unit.' } }
  }
}

// Clears the maintenance trigger — resets the counters, and if the unit was
// sitting in MAINTENANCE specifically because it was due (not because a
// staff member manually parked it there for an unrelated reason — but this
// codebase doesn't distinguish those, matching how "Mark Serviced" already
// reads as an unconditional "back in service" action to a real front desk),
// restores it to AVAILABLE.
export async function markUnitServiced(id: string, userId?: string): Promise<{ success: boolean; data?: RentalUnitRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.rentalUnit.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'RENT-031', message: 'Rental unit not found.' } }
    const unit = await db.rentalUnit.update({
      where: { id },
      data: {
        rentalCountSinceService: 0, lastServicedAt: new Date(),
        status: existing.status === 'MAINTENANCE' ? 'AVAILABLE' : undefined,
      },
      include: { product: { select: { productName: true } } },
    })
    await logAction({ userId, action: 'RENTAL_UNIT_SERVICED', entityType: 'RentalUnit', entityId: id })
    return { success: true, data: serializeUnit(unit) }
  } catch (e) {
    return { success: false, error: { code: 'RENT-037', message: e instanceof Error ? e.message : 'Could not mark unit serviced.' } }
  }
}

export async function deleteRentalUnit(id: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const bookingCount = await db.rentalBookingItem.count({ where: { rentalUnitId: id } })
    if (bookingCount > 0) {
      return { success: false, error: { code: 'RENT-034', message: `Cannot delete — this unit has ${bookingCount} booking record(s). Mark it Retired instead.` } }
    }
    await db.rentalUnit.delete({ where: { id } })
    await logAction({ action: 'RENTAL_UNIT_DELETED', entityType: 'RentalUnit', entityId: id })
    return { success: true }
  } catch (e) {
    return { success: false, error: { code: 'RENT-035', message: e instanceof Error ? e.message : 'Could not delete rental unit.' } }
  }
}

// ─── Availability ───────────────────────────────────────────────────────────

export interface AvailabilityResult {
  available: boolean
  availableUnits?: { id: string; unitLabel: string }[]  // UNIT items only
  availableQuantity?: number                             // BULK items only
}

export async function checkAvailability(payload: {
  productId: string
  startDateTime: string
  endDateTime: string
  quantity?: number
  excludeBookingId?: string
}): Promise<{ success: boolean; data?: AvailabilityResult; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const product = await db.product.findUnique({ where: { id: payload.productId } })
    if (!product || !product.isRentable) {
      return { success: false, error: { code: 'RENT-001', message: 'Product not found or not marked as rentable.' } }
    }
    const start = new Date(payload.startDateTime)
    const end = new Date(payload.endDateTime)
    if (end <= start) {
      return { success: false, error: { code: 'RENT-002', message: 'End date/time must be after start date/time.' } }
    }

    const result = await computeAvailability(db, product, start, end, payload.excludeBookingId)
    if (product.rentalTrackingType === 'BULK') {
      const requestedQty = payload.quantity ?? 1
      return { success: true, data: { available: (result.availableQuantity ?? 0) >= requestedQty, availableQuantity: result.availableQuantity } }
    }
    return { success: true, data: { available: (result.availableUnits?.length ?? 0) > 0, availableUnits: result.availableUnits } }
  } catch (e) {
    return { success: false, error: { code: 'RENT-003', message: e instanceof Error ? e.message : 'Could not check availability.' } }
  }
}

// Shared by checkAvailability (a plain read, safe to call outside a
// transaction) and createBooking (which re-runs this INSIDE its own
// transaction immediately before inserting — a pre-transaction-only check
// would leave the same race window billing.service.ts's credit-limit check
// and appointment.service.ts's conflict check both already had to close).
async function computeAvailability(
  db: PrismaTx | ReturnType<typeof getPrisma>,
  product: { id: string; rentalTrackingType: string | null },
  start: Date,
  end: Date,
  excludeBookingId?: string
): Promise<{ availableUnits?: { id: string; unitLabel: string }[]; availableQuantity?: number }> {
  const overlapWhere = {
    booking: {
      status: { in: ACTIVE_BOOKING_STATUSES },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      // Interval-overlap formula: newStart < existingEnd && existingStart < newEnd
      // — same formula appointment.service.ts's findProviderConflict uses,
      // generalized from same-day minutes-of-day to full multi-day DateTimes.
      startDateTime: { lt: end },
      endDateTime: { gt: start },
    },
  }

  if (product.rentalTrackingType === 'BULK') {
    const inventory = await db.inventory.findUnique({ where: { productId: product.id } })
    const totalOwned = inventory?.quantity ?? 0
    const overlapping = await db.rentalBookingItem.aggregate({
      where: { productId: product.id, ...overlapWhere },
      _sum: { quantity: true },
    })
    const committed = overlapping._sum.quantity ?? 0
    return { availableQuantity: Math.max(0, totalOwned - committed) }
  }

  // UNIT: any RentalUnit that isn't AVAILABLE (MAINTENANCE/RETIRED, or
  // currently physically RENTED past its return date but not yet processed)
  // is excluded outright; among the rest, exclude any with an overlapping
  // active booking.
  const allUnits = await db.rentalUnit.findMany({ where: { productId: product.id, status: 'AVAILABLE' } })
  const bookedUnitIds = new Set(
    (await db.rentalBookingItem.findMany({
      where: { rentalUnitId: { not: null }, ...overlapWhere },
      select: { rentalUnitId: true },
    })).map((r) => r.rentalUnitId)
  )
  const availableUnits = allUnits.filter((u) => !bookedUnitIds.has(u.id)).map((u) => ({ id: u.id, unitLabel: u.unitLabel }))
  return { availableUnits }
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export interface RentalBookingItemRecord {
  id: string
  productId: string
  productName: string
  rentalUnitId: string | null
  rentalUnitLabel: string | null
  quantity: number
  rateBasis: RateBasis
  rateAmount: number
  lineTotal: number
  conditionOut: string | null
  conditionIn: string | null
  damageChargeAmount: number
}

export interface RentalBookingRecord {
  id: string
  bookingNumber: string
  customerId: string
  customerName: string
  status: 'RESERVED' | 'CHECKED_OUT' | 'RETURNED' | 'CANCELLED'
  isOverdue: boolean
  startDateTime: string
  endDateTime: string
  securityDepositCollected: number
  securityDepositRefunded: number | null
  lateFeeAmount: number
  damageChargeAmount: number
  checkoutNotes: string | null
  returnNotes: string | null
  checkedOutAt: string | null
  returnedAt: string | null
  cancelledAt: string | null
  invoiceId: string | null
  notes: string | null
  recurrenceIntervalDays: number | null
  parentBookingId: string | null
  nextCycleGenerated: boolean
  items: RentalBookingItemRecord[]
  createdAt: string
  updatedAt: string
}

type BookingRow = {
  id: string; bookingNumber: string; customerId: string; status: string
  startDateTime: Date; endDateTime: Date
  securityDepositCollected: number; securityDepositRefunded: number | null
  lateFeeAmount: number; damageChargeAmount: number
  checkoutNotes: string | null; returnNotes: string | null
  checkedOutAt: Date | null; returnedAt: Date | null; cancelledAt: Date | null
  invoiceId: string | null; notes: string | null
  recurrenceIntervalDays: number | null; parentBookingId: string | null; nextCycleGenerated: boolean
  createdAt: Date; updatedAt: Date
  customer: { customerName: string }
  items: Array<{
    id: string; productId: string; rentalUnitId: string | null; quantity: number
    rateBasis: string; rateAmount: number; lineTotal: number
    conditionOut: string | null; conditionIn: string | null; damageChargeAmount: number
    product: { productName: string }
    rentalUnit: { unitLabel: string } | null
  }>
}

function serializeBooking(b: BookingRow): RentalBookingRecord {
  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    customerId: b.customerId,
    customerName: b.customer.customerName,
    status: b.status as RentalBookingRecord['status'],
    // Reclassified at display time, never persisted — see the schema's own
    // header comment for why (F.9's Compliance Task Report precedent).
    isOverdue: b.status === 'CHECKED_OUT' && b.endDateTime.getTime() < Date.now(),
    startDateTime: b.startDateTime.toISOString(),
    endDateTime: b.endDateTime.toISOString(),
    securityDepositCollected: b.securityDepositCollected,
    securityDepositRefunded: b.securityDepositRefunded,
    lateFeeAmount: b.lateFeeAmount,
    damageChargeAmount: b.damageChargeAmount,
    checkoutNotes: b.checkoutNotes,
    returnNotes: b.returnNotes,
    checkedOutAt: b.checkedOutAt ? b.checkedOutAt.toISOString() : null,
    returnedAt: b.returnedAt ? b.returnedAt.toISOString() : null,
    cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
    invoiceId: b.invoiceId,
    notes: b.notes,
    recurrenceIntervalDays: b.recurrenceIntervalDays,
    parentBookingId: b.parentBookingId,
    nextCycleGenerated: b.nextCycleGenerated,
    items: b.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.productName,
      rentalUnitId: i.rentalUnitId,
      rentalUnitLabel: i.rentalUnit?.unitLabel ?? null,
      quantity: i.quantity,
      rateBasis: i.rateBasis as RateBasis,
      rateAmount: i.rateAmount,
      lineTotal: i.lineTotal,
      conditionOut: i.conditionOut,
      conditionIn: i.conditionIn,
      damageChargeAmount: i.damageChargeAmount,
    })),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

const bookingInclude = {
  customer: { select: { customerName: true } },
  items: { include: { product: { select: { productName: true } }, rentalUnit: { select: { unitLabel: true } } } },
} as const

export async function listBookings(filters?: { status?: string; customerId?: string }): Promise<{ success: boolean; data?: { bookings: RentalBookingRecord[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.rentalBooking.findMany({
      where: { status: filters?.status, customerId: filters?.customerId },
      include: bookingInclude,
      orderBy: { startDateTime: 'desc' },
    })
    return { success: true, data: { bookings: rows.map((r) => serializeBooking(r as unknown as BookingRow)) } }
  } catch (e) {
    return { success: false, error: { code: 'RENT-004', message: e instanceof Error ? e.message : 'Could not load rental bookings.' } }
  }
}

export async function getBooking(id: string): Promise<{ success: boolean; data?: RentalBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.rentalBooking.findUnique({ where: { id }, include: bookingInclude })
    if (!row) return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
    return { success: true, data: serializeBooking(row as unknown as BookingRow) }
  } catch (e) {
    return { success: false, error: { code: 'RENT-006', message: e instanceof Error ? e.message : 'Could not load booking.' } }
  }
}

export async function createBooking(payload: {
  customerId: string
  startDateTime: string
  endDateTime: string
  securityDepositCollected?: number
  notes?: string
  createdById?: string
  recurrenceIntervalDays?: number
  parentBookingId?: string
  items: Array<{ productId: string; rateBasis: RateBasis; quantity?: number }>
}): Promise<{ success: boolean; data?: RentalBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const start = new Date(payload.startDateTime)
    const end = new Date(payload.endDateTime)
    if (end <= start) return { success: false, error: { code: 'RENT-002', message: 'End date/time must be after start date/time.' } }
    if (!payload.items || payload.items.length === 0) return { success: false, error: { code: 'RENT-007', message: 'At least one item is required.' } }
    if (payload.recurrenceIntervalDays !== undefined && payload.recurrenceIntervalDays <= 0) return { success: false, error: { code: 'RENT-038', message: 'Recurrence interval must be greater than zero days.' } }

    const result = await db.$transaction(async (tx): Promise<
      | { ok: true; bookingId: string }
      | { ok: false; error: { code: string; message: string } }
    > => {
      const bookingNumber = await generateSequenceNumber(
        tx, 'rental_booking_sequence', 'RENT', 5,
        async () => {
          const last = await tx.rentalBooking.findFirst({ orderBy: { createdAt: 'desc' }, select: { bookingNumber: true } })
          return last ? parseInt(last.bookingNumber.replace('RENT-', ''), 10) : 0
        }
      )

      const booking = await tx.rentalBooking.create({
        data: {
          bookingNumber,
          customerId: payload.customerId,
          startDateTime: start,
          endDateTime: end,
          securityDepositCollected: payload.securityDepositCollected ?? 0,
          notes: payload.notes?.trim() || null,
          createdById: payload.createdById ?? null,
          recurrenceIntervalDays: payload.recurrenceIntervalDays ?? null,
          parentBookingId: payload.parentBookingId ?? null,
        },
      })

      for (const itemReq of payload.items) {
        const product = await tx.product.findUnique({ where: { id: itemReq.productId } })
        if (!product || !product.isRentable) {
          return { ok: false, error: { code: 'RENT-001', message: `Product ${itemReq.productId} is not rentable.` } }
        }
        const rates = parseRentalRates(product.rentalRates)
        const rate = rates.find((r) => r.basis === itemReq.rateBasis)
        if (!rate) {
          return { ok: false, error: { code: 'RENT-008', message: `"${product.productName}" has no rate configured for ${itemReq.rateBasis}.` } }
        }
        const durationUnits = computeDurationUnits(start, end, itemReq.rateBasis)

        if (product.rentalTrackingType === 'BULK') {
          const requestedQty = itemReq.quantity ?? 1
          const avail = await computeAvailability(tx, product, start, end)
          if ((avail.availableQuantity ?? 0) < requestedQty) {
            return { ok: false, error: { code: 'RENT-009', message: `"${product.productName}" does not have ${requestedQty} unit(s) available for this date range (${avail.availableQuantity ?? 0} available).` } }
          }
          await tx.rentalBookingItem.create({
            data: {
              bookingId: booking.id, productId: product.id, quantity: requestedQty,
              rateBasis: itemReq.rateBasis, rateAmount: rate.amount,
              lineTotal: roundCurrency(rate.amount * durationUnits * requestedQty),
            },
          })
        } else {
          // UNIT: claim ONE specific available unit for the whole range, fresh
          // inside this transaction — not against a pre-read snapshot, same
          // reasoning appointment.service.ts's provider-conflict check and
          // billing.service.ts's credit-limit check already established.
          const avail = await computeAvailability(tx, product, start, end)
          const claimed = avail.availableUnits?.[0]
          if (!claimed) {
            return { ok: false, error: { code: 'RENT-010', message: `No available unit of "${product.productName}" for this date range.` } }
          }
          await tx.rentalBookingItem.create({
            data: {
              bookingId: booking.id, productId: product.id, rentalUnitId: claimed.id, quantity: 1,
              rateBasis: itemReq.rateBasis, rateAmount: rate.amount,
              lineTotal: roundCurrency(rate.amount * durationUnits),
            },
          })
        }
      }

      return { ok: true, bookingId: booking.id }
    })

    if (!result.ok) return { success: false, error: result.error }

    await logAction({ userId: payload.createdById, action: 'RENTAL_BOOKING_CREATED', entityType: 'RentalBooking', entityId: result.bookingId })
    await scheduleReturnReminder(result.bookingId).catch(() => {})
    return getBooking(result.bookingId)
  } catch (e) {
    return { success: false, error: { code: 'RENT-011', message: e instanceof Error ? e.message : 'Could not create rental booking.' } }
  }
}

export async function checkoutBooking(payload: { id: string; checkoutNotes?: string; itemConditions?: Array<{ itemId: string; conditionOut: string }>; userId?: string }): Promise<{ success: boolean; data?: RentalBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const booking = await db.rentalBooking.findUnique({ where: { id: payload.id }, include: { items: true } })
    if (!booking) return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
    if (booking.status !== 'RESERVED') {
      return { success: false, error: { code: 'RENT-012', message: `Cannot check out a booking with status ${booking.status}. Only RESERVED bookings can be checked out.` } }
    }

    await db.$transaction(async (tx) => {
      await tx.rentalBooking.update({ where: { id: payload.id }, data: { status: 'CHECKED_OUT', checkedOutAt: new Date(), checkoutNotes: payload.checkoutNotes?.trim() || null } })
      for (const c of payload.itemConditions ?? []) {
        await tx.rentalBookingItem.update({ where: { id: c.itemId }, data: { conditionOut: c.conditionOut } })
      }
      const unitIds = booking.items.map((i) => i.rentalUnitId).filter((id): id is string => !!id)
      if (unitIds.length > 0) {
        await tx.rentalUnit.updateMany({ where: { id: { in: unitIds } }, data: { status: 'RENTED' } })
      }
    })

    await logAction({ userId: payload.userId, action: 'RENTAL_CHECKED_OUT', entityType: 'RentalBooking', entityId: payload.id })
    return getBooking(payload.id)
  } catch (e) {
    return { success: false, error: { code: 'RENT-013', message: e instanceof Error ? e.message : 'Could not check out booking.' } }
  }
}

export async function returnBooking(payload: {
  id: string
  returnNotes?: string
  damageChargeAmount?: number
  securityDepositRefunded?: number
  itemConditions?: Array<{ itemId: string; conditionIn?: string; damageChargeAmount?: number }>
  userId?: string
}): Promise<{ success: boolean; data?: RentalBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const booking = await db.rentalBooking.findUnique({ where: { id: payload.id }, include: { items: true } })
    if (!booking) return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
    if (booking.status !== 'CHECKED_OUT') {
      return { success: false, error: { code: 'RENT-014', message: `Cannot return a booking with status ${booking.status}. Only a CHECKED_OUT booking can be returned.` } }
    }

    for (const c of payload.itemConditions ?? []) {
      if (c.damageChargeAmount !== undefined && c.damageChargeAmount < 0) {
        return { success: false, error: { code: 'RENT-015', message: 'Damage charge cannot be negative.' } }
      }
    }
    // Item-level damage (itemized per unit, item 4) takes over as the
    // source of truth for the booking-level aggregate the moment any item
    // has one set — otherwise fall back to the pre-existing single
    // whole-booking damageChargeAmount field for a BULK item (no single
    // physical unit to attribute it to) or a plain manual entry.
    const itemDamageTotal = (payload.itemConditions ?? []).reduce((s, c) => s + (c.damageChargeAmount ?? 0), 0)
    const usingItemizedDamage = (payload.itemConditions ?? []).some((c) => c.damageChargeAmount !== undefined && c.damageChargeAmount > 0)
    const damageCharge = usingItemizedDamage ? roundCurrency(itemDamageTotal) : (payload.damageChargeAmount ?? 0)
    if (damageCharge < 0) return { success: false, error: { code: 'RENT-015', message: 'Damage charge cannot be negative.' } }

    const depositRefunded = payload.securityDepositRefunded ?? Math.max(0, booking.securityDepositCollected - damageCharge)
    if (depositRefunded > booking.securityDepositCollected) {
      return { success: false, error: { code: 'RENT-016', message: 'Refund amount cannot exceed the security deposit collected.' } }
    }

    const now = new Date()
    let lateFee = 0
    if (now > booking.endDateTime) {
      const lateDurationUnits = computeDurationUnits(booking.endDateTime, now, 'DAY')
      const multiplier = await getLateFeeMultiplier()
      // Late fee is based on each item's own daily-equivalent rate — an
      // item priced hourly/weekly/monthly is normalized to a per-day figure
      // first so a late return is never charged in the item's original,
      // possibly much-larger, billing unit.
      for (const item of booking.items) {
        const dailyEquivalent = (item.rateAmount / UNIT_MS[item.rateBasis as RateBasis]) * UNIT_MS.DAY
        lateFee += dailyEquivalent * multiplier * lateDurationUnits * item.quantity
      }
    }

    await db.$transaction(async (tx) => {
      await tx.rentalBooking.update({
        where: { id: payload.id },
        data: {
          status: 'RETURNED', returnedAt: now,
          returnNotes: payload.returnNotes?.trim() || null,
          damageChargeAmount: damageCharge,
          securityDepositRefunded: depositRefunded,
          lateFeeAmount: lateFee,
        },
      })
      for (const c of payload.itemConditions ?? []) {
        await tx.rentalBookingItem.update({
          where: { id: c.itemId },
          data: { conditionIn: c.conditionIn, damageChargeAmount: c.damageChargeAmount ?? undefined },
        })
      }

      // Each involved unit's rental count goes up by one on every return —
      // then, independently per unit, a due-for-service unit is routed to
      // MAINTENANCE instead of AVAILABLE, blocking re-rental until a real
      // "Mark Serviced" action clears it (see markUnitServiced).
      const unitIds = booking.items.map((i) => i.rentalUnitId).filter((id): id is string => !!id)
      for (const unitId of unitIds) {
        const unit = await tx.rentalUnit.update({
          where: { id: unitId },
          data: { rentalCountSinceService: { increment: 1 } },
        })
        const dueNow = isUnitDueForService(unit)
        await tx.rentalUnit.update({ where: { id: unitId }, data: { status: dueNow ? 'MAINTENANCE' : 'AVAILABLE' } })
      }
    })

    await logAction({ userId: payload.userId, action: 'RENTAL_RETURNED', entityType: 'RentalBooking', entityId: payload.id, newValue: { lateFee, damageCharge } })
    return getBooking(payload.id)
  } catch (e) {
    return { success: false, error: { code: 'RENT-017', message: e instanceof Error ? e.message : 'Could not process return.' } }
  }
}

export async function extendBooking(payload: { id: string; newEndDateTime: string; userId?: string }): Promise<{ success: boolean; data?: RentalBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const booking = await db.rentalBooking.findUnique({ where: { id: payload.id }, include: { items: { include: { product: true } } } })
    if (!booking) return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
    if (booking.status !== 'RESERVED' && booking.status !== 'CHECKED_OUT') {
      return { success: false, error: { code: 'RENT-018', message: `Cannot extend a booking with status ${booking.status}.` } }
    }
    const newEnd = new Date(payload.newEndDateTime)
    if (newEnd <= booking.startDateTime) {
      return { success: false, error: { code: 'RENT-002', message: 'New end date/time must be after the start date/time.' } }
    }

    // BUG FOUND 2026-07-22: computeAvailability used to be called against
    // `db` (a pre-transaction read) and the actual extension committed in a
    // SEPARATE, later transaction — exactly the TOCTOU pattern createBooking
    // itself explicitly closed (see its own comment: "fresh inside this
    // transaction... not against a pre-read snapshot"). Two concurrent
    // extends, or an extend racing a new booking for the same unit/date
    // range, could both pass the check and produce an overlapping double-
    // booking. Fixed by moving the availability check and the update into
    // the SAME transaction — computeAvailability already accepts a `tx`
    // client for exactly this reason (see its signature above).
    await db.$transaction(async (tx) => {
      for (const item of booking.items) {
        const avail = await computeAvailability(tx, item.product, booking.startDateTime, newEnd, booking.id)
        if (item.product.rentalTrackingType === 'BULK') {
          if ((avail.availableQuantity ?? 0) < item.quantity) {
            throw new ServiceError('RENT-019', `Extending would exceed available stock of "${item.product.productName}" for the new date range.`)
          }
        } else if (item.rentalUnitId) {
          const stillAvailable = avail.availableUnits?.some((u) => u.id === item.rentalUnitId)
          if (!stillAvailable) {
            throw new ServiceError('RENT-020', `"${item.product.productName}" (${item.rentalUnitId}) is booked by someone else during the extended period.`)
          }
        }
      }

      // Re-derive each item's lineTotal for the new duration — rateAmount stays
      // the snapshot from booking time, only the duration changes.
      await tx.rentalBooking.update({ where: { id: payload.id }, data: { endDateTime: newEnd } })
      for (const item of booking.items) {
        const durationUnits = computeDurationUnits(booking.startDateTime, newEnd, item.rateBasis as RateBasis)
        // BUG FOUND 2026-07-22: this recomputed lineTotal skipped
        // roundCurrency, unlike createBooking's identical calculation —
        // a minor float-precision inconsistency between the two paths.
        await tx.rentalBookingItem.update({ where: { id: item.id }, data: { lineTotal: roundCurrency(item.rateAmount * durationUnits * item.quantity) } })
      }
    })

    await logAction({ userId: payload.userId, action: 'RENTAL_EXTENDED', entityType: 'RentalBooking', entityId: payload.id, newValue: { newEndDateTime: payload.newEndDateTime } })
    return getBooking(payload.id)
  } catch (e) {
    if (e instanceof ServiceError) return { success: false, error: { code: e.code, message: e.message } }
    return { success: false, error: { code: 'RENT-021', message: e instanceof Error ? e.message : 'Could not extend booking.' } }
  }
}

export async function cancelBooking(payload: { id: string; reason?: string; userId?: string }): Promise<{ success: boolean; data?: RentalBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const booking = await db.rentalBooking.findUnique({ where: { id: payload.id }, include: { items: true } })
    if (!booking) return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
    // A CHECKED_OUT booking has physically left the building — it must be
    // returned, not cancelled. This is a real-world constraint, not
    // arbitrary: cancelling it would silently free up a unit that's actually
    // still out with a customer.
    if (booking.status !== 'RESERVED') {
      return { success: false, error: { code: 'RENT-022', message: `Cannot cancel a booking with status ${booking.status}. Only a RESERVED (not yet checked out) booking can be cancelled.` } }
    }

    await db.$transaction(async (tx) => {
      await tx.rentalBooking.update({ where: { id: payload.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), notes: payload.reason ? `${booking.notes ?? ''}\nCancelled: ${payload.reason}`.trim() : booking.notes } })
      const unitIds = booking.items.map((i) => i.rentalUnitId).filter((id): id is string => !!id)
      if (unitIds.length > 0) {
        await tx.rentalUnit.updateMany({ where: { id: { in: unitIds } }, data: { status: 'AVAILABLE' } })
      }
    })

    await logAction({ userId: payload.userId, action: 'RENTAL_CANCELLED', entityType: 'RentalBooking', entityId: payload.id })
    return getBooking(payload.id)
  } catch (e) {
    return { success: false, error: { code: 'RENT-023', message: e instanceof Error ? e.message : 'Could not cancel booking.' } }
  }
}

// A staff-triggered "Create Next Cycle" action, not a background scheduler —
// matches this codebase's established recurrence pattern (e.g.
// ServiceRetainerAgreement/PestServiceContract's lastInvoicedPeriod claim
// key) since no cron/timer infra for business logic exists anywhere here.
// nextCycleGenerated is the atomic claim, same reasoning generateRentalInvoice's
// invoiceId sentinel already documents: two clicks moments apart must not
// both succeed.
export async function createNextRentalCycle(bookingId: string, userId?: string): Promise<{ success: boolean; data?: RentalBookingRecord; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.rentalBooking.updateMany({ where: { id: bookingId, nextCycleGenerated: false }, data: { nextCycleGenerated: true } })
    if (claim.count === 0) {
      return { success: false, error: { code: 'RENT-039', message: 'The next cycle has already been created for this booking.' } }
    }

    try {
      const booking = await db.rentalBooking.findUnique({ where: { id: bookingId }, include: { items: true } })
      if (!booking) {
        await db.rentalBooking.update({ where: { id: bookingId }, data: { nextCycleGenerated: false } })
        return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
      }
      if (!booking.recurrenceIntervalDays) {
        await db.rentalBooking.update({ where: { id: bookingId }, data: { nextCycleGenerated: false } })
        return { success: false, error: { code: 'RENT-040', message: 'This booking is not set up as a recurring rental.' } }
      }
      if (booking.status !== 'CHECKED_OUT' && booking.status !== 'RETURNED') {
        await db.rentalBooking.update({ where: { id: bookingId }, data: { nextCycleGenerated: false } })
        return { success: false, error: { code: 'RENT-041', message: 'Create the next cycle once this booking has been checked out or returned.' } }
      }

      // The new cycle starts exactly where this one ends and runs the same
      // duration — a weekly standing rental stays weekly even if this
      // particular cycle was extended, since the interval is the contract,
      // not a re-derivation of "how long did the LAST cycle actually run".
      const durationMs = booking.endDateTime.getTime() - booking.startDateTime.getTime()
      const newStart = new Date(booking.endDateTime.getTime())
      const newEnd = new Date(newStart.getTime() + durationMs)

      const result = await createBooking({
        customerId: booking.customerId,
        startDateTime: newStart.toISOString(),
        endDateTime: newEnd.toISOString(),
        securityDepositCollected: booking.securityDepositCollected,
        notes: booking.notes ?? undefined,
        createdById: userId,
        recurrenceIntervalDays: booking.recurrenceIntervalDays,
        parentBookingId: booking.id,
        items: booking.items.map((i) => ({ productId: i.productId, rateBasis: i.rateBasis as RateBasis, quantity: i.quantity })),
      })
      if (!result.success) {
        await db.rentalBooking.update({ where: { id: bookingId }, data: { nextCycleGenerated: false } })
        return result
      }
      await logAction({ userId, action: 'RENTAL_NEXT_CYCLE_CREATED', entityType: 'RentalBooking', entityId: bookingId, newValue: { nextBookingId: result.data?.id } })
      return result
    } catch (err) {
      await db.rentalBooking.update({ where: { id: bookingId }, data: { nextCycleGenerated: false } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'RENT-042', message: e instanceof Error ? e.message : 'Could not create next rental cycle.' } }
  }
}

// ─── Invoicing ───────────────────────────────────────────────────────────────

const RENTAL_LATE_FEE_PRODUCT_NAME = 'Rental Late Fee'
const RENTAL_DAMAGE_CHARGE_PRODUCT_NAME = 'Rental Damage Charge'

async function findOrCreatePlaceholderProduct(name: string, taxRate = 0): Promise<{ id: string }> {
  const db = getPrisma()
  let product = await db.product.findFirst({ where: { productName: name, isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName: name, productType: 'SERVICE', sellingPrice: 0, taxRate, unit: 'NOS', isActive: true },
    })
  }
  return product
}

// The actual rentable Product is almost always productType: 'STANDARD' (it
// needs a real Inventory row for BULK-item availability tracking — see
// Section 2.2). Invoicing it directly would run billing.service.ts's
// STANDARD-item stock check/deduction, which is wrong here: a rental invoice
// bills for the USE of an item over a period, not a transfer of ownership,
// and this app deliberately never touches Inventory.quantity for rentals (a
// deduction here would silently corrupt "total owned" stock counts). Instead,
// invoice a per-product SERVICE placeholder — same mechanism as the late-fee/
// damage-charge placeholders, just one per rentable product so the invoice
// still reads with the real item's name, not a generic line.
async function findOrCreateRentalChargeProduct(rentalProduct: { productName: string; taxRate: number }): Promise<{ id: string }> {
  return findOrCreatePlaceholderProduct(`${rentalProduct.productName} — Rental Charge`, rentalProduct.taxRate)
}

// Same atomic claim-sentinel + find-or-create-placeholder-Product +
// billingService.createInvoice() pattern generateDrivingSessionInvoice
// already established — not a parallel billing engine. Security deposit is
// deliberately NOT part of the invoice — it's a holding tracked only on
// RentalBooking.securityDepositCollected/Refunded, not revenue.
const RENTAL_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

export async function generateRentalInvoice(bookingId: string): Promise<{ success: boolean; data?: { invoiceId: string }; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.rentalBooking.updateMany({ where: { id: bookingId, invoiceId: null }, data: { invoiceId: RENTAL_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.rentalBooking.findUnique({ where: { id: bookingId }, select: { id: true, invoiceId: true } })
      if (!existing) return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
      if (existing.invoiceId === RENTAL_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'RENT-024', message: 'Invoice generation already in progress for this booking.' } }
      return { success: false, error: { code: 'RENT-025', message: 'An invoice has already been generated for this booking.' } }
    }

    try {
      const booking = await db.rentalBooking.findUnique({ where: { id: bookingId }, include: { items: { include: { product: true, rentalUnit: true } } } })
      if (!booking) {
        await db.rentalBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'RENT-005', message: 'Booking not found.' } }
      }

      const invoiceItems: Array<{ productId: string; quantity: number; unitPrice: number; taxRate?: number }> = []
      for (const item of booking.items) {
        const chargeProduct = await findOrCreateRentalChargeProduct(item.product)
        invoiceItems.push({ productId: chargeProduct.id, quantity: 1, unitPrice: item.lineTotal, taxRate: item.product.taxRate })
      }

      if (booking.lateFeeAmount > 0) {
        const lateFeeProduct = await findOrCreatePlaceholderProduct(RENTAL_LATE_FEE_PRODUCT_NAME)
        invoiceItems.push({ productId: lateFeeProduct.id, quantity: 1, unitPrice: booking.lateFeeAmount, taxRate: 0 })
      }
      // Itemized per unit when any line has its own damage charge (a
      // multi-unit booking where only one unit came back damaged should
      // never bill it as one anonymous lump sum against the whole booking)
      // — falls back to the single legacy aggregate line otherwise, for a
      // BULK item (no single unit to attribute damage to) or a booking
      // returned before this field existed.
      const itemsWithDamage = booking.items.filter((i) => i.damageChargeAmount > 0)
      if (itemsWithDamage.length > 0) {
        for (const item of itemsWithDamage) {
          const label = item.rentalUnit ? `${RENTAL_DAMAGE_CHARGE_PRODUCT_NAME} — ${item.product.productName} (${item.rentalUnit.unitLabel})` : `${RENTAL_DAMAGE_CHARGE_PRODUCT_NAME} — ${item.product.productName}`
          const damageProduct = await findOrCreatePlaceholderProduct(label)
          invoiceItems.push({ productId: damageProduct.id, quantity: 1, unitPrice: item.damageChargeAmount, taxRate: 0 })
        }
      } else if (booking.damageChargeAmount > 0) {
        const damageProduct = await findOrCreatePlaceholderProduct(RENTAL_DAMAGE_CHARGE_PRODUCT_NAME)
        invoiceItems.push({ productId: damageProduct.id, quantity: 1, unitPrice: booking.damageChargeAmount, taxRate: 0 })
      }

      const result = await billingService.createInvoice({
        customerId: booking.customerId,
        paymentMethod: 'CREDIT',
        items: invoiceItems,
        notes: `Rental booking ${booking.bookingNumber}`,
        referenceNumber: booking.bookingNumber,
      })
      if (!result.success) {
        await db.rentalBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string }
      await db.rentalBooking.update({ where: { id: bookingId }, data: { invoiceId: invoice.id } })
      await logAction({ action: 'RENTAL_INVOICED', entityType: 'RentalBooking', entityId: bookingId, newValue: { invoiceId: invoice.id } })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.rentalBooking.update({ where: { id: bookingId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'RENT-026', message: e instanceof Error ? e.message : 'Could not generate rental invoice.' } }
  }
}

// ─── Reminders (manual-send, never auto-delivered) ─────────────────────────

async function scheduleReturnReminder(bookingId: string): Promise<void> {
  try {
    const db = getPrisma()
    const booking = await db.rentalBooking.findUnique({ where: { id: bookingId }, include: { customer: true } })
    if (!booking) return
    const reminderDate = new Date(booking.endDateTime)
    reminderDate.setDate(reminderDate.getDate() - 1)
    if (reminderDate <= new Date()) return

    const dateStr = booking.endDateTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const body = `Dear ${booking.customer.customerName}, your rental booking (${booking.bookingNumber}) is due for return on ${dateStr}. Powered by Sarang | www.aszurex.com`
    const phone = booking.customer.phone ?? ''
    const link = phone ? await buildWhatsAppLink(phone, body) : null
    await db.notificationQueue.create({
      data: { customerId: booking.customerId, customerName: booking.customer.customerName, customerPhone: phone, notificationType: 'RENTAL_RETURN_DUE', templateBody: body, whatsappLink: link, scheduledFor: reminderDate },
    })
  } catch {
    // Non-critical — same convention as pest-contract.service.ts/membership.service.ts
  }
}

export const rentalService = {
  checkAvailability,
  listBookings,
  getBooking,
  createBooking,
  checkoutBooking,
  returnBooking,
  extendBooking,
  cancelBooking,
  generateRentalInvoice,
  createNextRentalCycle,
  listRentalUnits,
  createRentalUnit,
  updateRentalUnit,
  deleteRentalUnit,
  markUnitServiced,
}
