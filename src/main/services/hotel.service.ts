import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'
import { roundCurrency } from './currency.service'

type PrismaTx = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// A CONFIRMED or CHECKED_IN booking holds the room for its date range —
// CHECKED_OUT/CANCELLED/NO_SHOW free it back up. Same interval-overlap
// convention rental.service.ts's ACTIVE_BOOKING_STATUSES documents, adapted
// for the fact that a hotel room (unlike a rented-out physical item) is
// available again for new bookings the moment a guest checks out, not only
// after a separate "return" step.
const ACTIVE_BOOKING_STATUSES = ['CONFIRMED', 'CHECKED_IN']

const MS_PER_DAY = 86_400_000

// Calendar-day based, not a 24-hour-period count — a stay from 6pm to 10am
// the next day is universally billed as 1 night in real hotel practice,
// regardless of the exact check-in/check-out hour. Using calendar-date
// subtraction instead of raw millisecond division avoids DST-related
// off-by-one errors a naive `(end - start) / MS_PER_DAY` would risk twice a
// year in any timezone that observes it.
function computeNights(checkIn: Date, checkOut: Date): number {
  const inDateOnly = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate())
  const outDateOnly = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate())
  const diffDays = Math.round((outDateOnly.getTime() - inDateOnly.getTime()) / MS_PER_DAY)
  return Math.max(1, diffDays)
}

// ─── Rooms ──────────────────────────────────────────────────────────────────

export interface HotelRoomRecord {
  id: string
  roomNumber: string
  roomType: string
  floor: string | null
  maxOccupancy: number
  baseRate: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_ORDER'
  amenities: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type RoomRow = {
  id: string; roomNumber: string; roomType: string; floor: string | null
  maxOccupancy: number; baseRate: number; status: string
  amenities: string | null; notes: string | null; isActive: boolean
  createdAt: Date; updatedAt: Date
}

function serializeRoom(r: RoomRow): HotelRoomRecord {
  return {
    id: r.id, roomNumber: r.roomNumber, roomType: r.roomType, floor: r.floor,
    maxOccupancy: r.maxOccupancy, baseRate: r.baseRate,
    status: r.status as HotelRoomRecord['status'],
    amenities: r.amenities, notes: r.notes, isActive: r.isActive,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listRooms(filters?: { status?: string; roomType?: string; includeInactive?: boolean }): Promise<{ success: boolean; data?: { rooms: HotelRoomRecord[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.hotelRoom.findMany({
      where: {
        status: filters?.status,
        roomType: filters?.roomType,
        ...(filters?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { roomNumber: 'asc' },
    })
    return { success: true, data: { rooms: rows.map(serializeRoom) } }
  } catch (e) {
    return { success: false, error: { code: 'HTL-001', message: e instanceof Error ? e.message : 'Could not load rooms.' } }
  }
}

export async function createRoom(payload: {
  roomNumber: string; roomType: string; floor?: string; maxOccupancy?: number
  baseRate?: number; amenities?: string; notes?: string
}): Promise<{ success: boolean; data?: HotelRoomRecord; error?: { code: string; message: string } }> {
  try {
    if (!payload.roomNumber?.trim()) return { success: false, error: { code: 'HTL-002', message: 'Room number is required.' } }
    if (!payload.roomType?.trim()) return { success: false, error: { code: 'HTL-003', message: 'Room type is required.' } }
    if (payload.maxOccupancy !== undefined && payload.maxOccupancy <= 0) return { success: false, error: { code: 'HTL-004', message: 'Max occupancy must be greater than zero.' } }
    if (payload.baseRate !== undefined && payload.baseRate < 0) return { success: false, error: { code: 'HTL-005', message: 'Base rate cannot be negative.' } }

    const db = getPrisma()
    const existing = await db.hotelRoom.findUnique({ where: { roomNumber: payload.roomNumber.trim() } })
    if (existing) return { success: false, error: { code: 'HTL-006', message: `Room ${payload.roomNumber} already exists.` } }

    const room = await db.hotelRoom.create({
      data: {
        roomNumber: payload.roomNumber.trim(), roomType: payload.roomType.trim(),
        floor: payload.floor?.trim() || null,
        maxOccupancy: payload.maxOccupancy ?? 2,
        baseRate: payload.baseRate ?? 0,
        amenities: payload.amenities?.trim() || null,
        notes: payload.notes?.trim() || null,
      },
    })
    await logAction({ action: 'HOTEL_ROOM_CREATED', entityType: 'HotelRoom', entityId: room.id })
    return { success: true, data: serializeRoom(room) }
  } catch (e) {
    return { success: false, error: { code: 'HTL-007', message: e instanceof Error ? e.message : 'Could not create room.' } }
  }
}

export async function updateRoom(payload: {
  id: string; roomType?: string; floor?: string; maxOccupancy?: number
  baseRate?: number; status?: 'AVAILABLE' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_ORDER'
  amenities?: string; notes?: string; isActive?: boolean
}): Promise<{ success: boolean; data?: HotelRoomRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.hotelRoom.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'HTL-008', message: 'Room not found.' } }
    // A guest is physically in this room — its status is driven by the
    // booking lifecycle (check-in/check-out), not a manual housekeeping
    // override, same reasoning rental.service.ts's updateRentalUnit applies
    // to a currently-RENTED unit.
    if (existing.status === 'OCCUPIED' && payload.status) {
      return { success: false, error: { code: 'HTL-009', message: 'Cannot change the status of an occupied room — it updates automatically when the guest checks out.' } }
    }
    if (payload.maxOccupancy !== undefined && payload.maxOccupancy <= 0) return { success: false, error: { code: 'HTL-004', message: 'Max occupancy must be greater than zero.' } }
    if (payload.baseRate !== undefined && payload.baseRate < 0) return { success: false, error: { code: 'HTL-005', message: 'Base rate cannot be negative.' } }

    const room = await db.hotelRoom.update({
      where: { id: payload.id },
      data: {
        roomType: payload.roomType?.trim() || undefined,
        floor: payload.floor !== undefined ? (payload.floor.trim() || null) : undefined,
        maxOccupancy: payload.maxOccupancy,
        baseRate: payload.baseRate,
        status: existing.status === 'OCCUPIED' ? undefined : payload.status,
        amenities: payload.amenities !== undefined ? (payload.amenities.trim() || null) : undefined,
        notes: payload.notes !== undefined ? (payload.notes.trim() || null) : undefined,
        isActive: payload.isActive,
      },
    })
    await logAction({ action: 'HOTEL_ROOM_UPDATED', entityType: 'HotelRoom', entityId: room.id })
    return { success: true, data: serializeRoom(room) }
  } catch (e) {
    return { success: false, error: { code: 'HTL-010', message: e instanceof Error ? e.message : 'Could not update room.' } }
  }
}

export async function deleteRoom(id: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const bookingCount = await db.hotelBooking.count({ where: { roomId: id } })
    if (bookingCount > 0) {
      return { success: false, error: { code: 'HTL-011', message: `Cannot delete — this room has ${bookingCount} booking record(s). Deactivate it instead.` } }
    }
    await db.hotelRoom.delete({ where: { id } })
    await logAction({ action: 'HOTEL_ROOM_DELETED', entityType: 'HotelRoom', entityId: id })
    return { success: true }
  } catch (e) {
    return { success: false, error: { code: 'HTL-012', message: e instanceof Error ? e.message : 'Could not delete room.' } }
  }
}

// ─── Availability ───────────────────────────────────────────────────────────

async function findConflict(
  db: PrismaTx | ReturnType<typeof getPrisma>,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
) {
  return db.hotelBooking.findFirst({
    where: {
      roomId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      // Interval-overlap formula: newStart < existingEnd && existingStart < newEnd
      // — same formula rental.service.ts's computeAvailability and
      // appointment.service.ts's findProviderConflict both use.
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
    },
  })
}

export async function checkAvailability(payload: { roomId: string; checkInDate: string; checkOutDate: string; excludeBookingId?: string }): Promise<{ success: boolean; data?: { available: boolean }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const checkIn = new Date(payload.checkInDate)
    const checkOut = new Date(payload.checkOutDate)
    if (checkOut <= checkIn) return { success: false, error: { code: 'HTL-013', message: 'Check-out date must be after check-in date.' } }
    const conflict = await findConflict(db, payload.roomId, checkIn, checkOut, payload.excludeBookingId)
    return { success: true, data: { available: !conflict } }
  } catch (e) {
    return { success: false, error: { code: 'HTL-014', message: e instanceof Error ? e.message : 'Could not check availability.' } }
  }
}

// Returns every active room with no conflicting booking for the given
// range — the room picker for the booking-creation screen.
export async function listAvailableRooms(payload: { checkInDate: string; checkOutDate: string; roomType?: string }): Promise<{ success: boolean; data?: { rooms: HotelRoomRecord[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const checkIn = new Date(payload.checkInDate)
    const checkOut = new Date(payload.checkOutDate)
    if (checkOut <= checkIn) return { success: false, error: { code: 'HTL-013', message: 'Check-out date must be after check-in date.' } }

    const rooms = await db.hotelRoom.findMany({
      where: { isActive: true, status: { notIn: ['MAINTENANCE', 'OUT_OF_ORDER'] }, roomType: payload.roomType },
      orderBy: { roomNumber: 'asc' },
    })
    const conflicting = new Set(
      (await db.hotelBooking.findMany({
        where: {
          status: { in: ACTIVE_BOOKING_STATUSES },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
        },
        select: { roomId: true },
      })).map((b) => b.roomId)
    )
    const available = rooms.filter((r) => !conflicting.has(r.id))
    return { success: true, data: { rooms: available.map(serializeRoom) } }
  } catch (e) {
    return { success: false, error: { code: 'HTL-015', message: e instanceof Error ? e.message : 'Could not load available rooms.' } }
  }
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export interface HotelGuestIdRecord {
  id: string; guestName: string; idType: string; idNumber: string
  nationality: string; address: string | null; isPrimary: boolean; createdAt: string
}

export interface HotelExtraChargeRecord {
  id: string; description: string; quantity: number; unitPrice: number
  amount: number; chargeDate: string; createdAt: string
}

export interface HotelBookingRecord {
  id: string
  bookingNumber: string
  roomId: string
  roomNumber: string
  roomType: string
  customerId: string | null
  guestName: string
  guestPhone: string | null
  guestEmail: string | null
  numberOfGuests: number
  checkInDate: string
  checkOutDate: string
  actualCheckInAt: string | null
  actualCheckOutAt: string | null
  ratePerNight: number
  nights: number
  roomCharge: number
  extraChargesTotal: number
  estimatedTotal: number
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
  advanceAmount: number
  advancePaymentMethod: string
  cancelReason: string | null
  notes: string | null
  invoiceId: string | null
  guests: HotelGuestIdRecord[]
  charges: HotelExtraChargeRecord[]
  createdAt: string
  updatedAt: string
}

type BookingRow = {
  id: string; bookingNumber: string; roomId: string; customerId: string | null
  guestName: string; guestPhone: string | null; guestEmail: string | null; numberOfGuests: number
  checkInDate: Date; checkOutDate: Date; actualCheckInAt: Date | null; actualCheckOutAt: Date | null
  ratePerNight: number; status: string; advanceAmount: number; advancePaymentMethod: string
  cancelReason: string | null; notes: string | null; invoiceId: string | null
  createdAt: Date; updatedAt: Date
  room: { roomNumber: string; roomType: string }
  guests: Array<{ id: string; guestName: string; idType: string; idNumber: string; nationality: string; address: string | null; isPrimary: boolean; createdAt: Date }>
  charges: Array<{ id: string; description: string; quantity: number; unitPrice: number; amount: number; chargeDate: Date; createdAt: Date }>
}

function serializeBooking(b: BookingRow): HotelBookingRecord {
  const nights = computeNights(b.checkInDate, b.checkOutDate)
  const roomCharge = roundCurrency(b.ratePerNight * nights)
  const extraChargesTotal = roundCurrency(b.charges.reduce((s, c) => s + c.amount, 0))
  return {
    id: b.id, bookingNumber: b.bookingNumber, roomId: b.roomId,
    roomNumber: b.room.roomNumber, roomType: b.room.roomType,
    customerId: b.customerId, guestName: b.guestName, guestPhone: b.guestPhone, guestEmail: b.guestEmail,
    numberOfGuests: b.numberOfGuests,
    checkInDate: b.checkInDate.toISOString(), checkOutDate: b.checkOutDate.toISOString(),
    actualCheckInAt: b.actualCheckInAt ? b.actualCheckInAt.toISOString() : null,
    actualCheckOutAt: b.actualCheckOutAt ? b.actualCheckOutAt.toISOString() : null,
    ratePerNight: b.ratePerNight, nights, roomCharge, extraChargesTotal,
    estimatedTotal: roundCurrency(roomCharge + extraChargesTotal),
    status: b.status as HotelBookingRecord['status'],
    advanceAmount: b.advanceAmount, advancePaymentMethod: b.advancePaymentMethod,
    cancelReason: b.cancelReason, notes: b.notes, invoiceId: b.invoiceId,
    guests: b.guests.map((g) => ({
      id: g.id, guestName: g.guestName, idType: g.idType, idNumber: g.idNumber,
      nationality: g.nationality, address: g.address, isPrimary: g.isPrimary, createdAt: g.createdAt.toISOString(),
    })),
    charges: b.charges.map((c) => ({
      id: c.id, description: c.description, quantity: c.quantity, unitPrice: c.unitPrice,
      amount: c.amount, chargeDate: c.chargeDate.toISOString(), createdAt: c.createdAt.toISOString(),
    })),
    createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
  }
}

const bookingInclude = {
  room: { select: { roomNumber: true, roomType: true } },
  guests: { orderBy: { createdAt: 'asc' as const } },
  charges: { orderBy: { chargeDate: 'asc' as const } },
}

export async function listBookings(filters?: { status?: string; roomId?: string; customerId?: string }): Promise<{ success: boolean; data?: { bookings: HotelBookingRecord[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.hotelBooking.findMany({
      where: { status: filters?.status, roomId: filters?.roomId, customerId: filters?.customerId },
      include: bookingInclude,
      orderBy: { checkInDate: 'desc' },
    })
    return { success: true, data: { bookings: rows.map((r) => serializeBooking(r as unknown as BookingRow)) } }
  } catch (e) {
    return { success: false, error: { code: 'HTL-016', message: e instanceof Error ? e.message : 'Could not load bookings.' } }
  }
}

export async function getBooking(id: string): Promise<{ success: boolean; data?: HotelBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.hotelBooking.findUnique({ where: { id }, include: bookingInclude })
    if (!row) return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
    return { success: true, data: serializeBooking(row as unknown as BookingRow) }
  } catch (e) {
    return { success: false, error: { code: 'HTL-018', message: e instanceof Error ? e.message : 'Could not load booking.' } }
  }
}

export async function createBooking(payload: {
  roomId: string
  customerId?: string
  guestName: string
  guestPhone?: string
  guestEmail?: string
  numberOfGuests?: number
  checkInDate: string
  checkOutDate: string
  ratePerNight?: number
  advanceAmount?: number
  advancePaymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET'
  notes?: string
  createdById?: string
}): Promise<{ success: boolean; data?: HotelBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const checkIn = new Date(payload.checkInDate)
    const checkOut = new Date(payload.checkOutDate)
    if (checkOut <= checkIn) return { success: false, error: { code: 'HTL-013', message: 'Check-out date must be after check-in date.' } }
    if (!payload.guestName?.trim()) return { success: false, error: { code: 'HTL-019', message: 'Guest name is required.' } }
    if (payload.numberOfGuests !== undefined && payload.numberOfGuests <= 0) return { success: false, error: { code: 'HTL-020', message: 'Number of guests must be greater than zero.' } }
    if (payload.ratePerNight !== undefined && payload.ratePerNight < 0) return { success: false, error: { code: 'HTL-021', message: 'Rate per night cannot be negative.' } }
    const advanceAmount = roundCurrency(payload.advanceAmount ?? 0)
    if (advanceAmount < 0) return { success: false, error: { code: 'HTL-022', message: 'Advance amount cannot be negative.' } }

    const result = await db.$transaction(async (tx): Promise<
      | { ok: true; bookingId: string }
      | { ok: false; error: { code: string; message: string } }
    > => {
      const room = await tx.hotelRoom.findUnique({ where: { id: payload.roomId } })
      if (!room || !room.isActive) return { ok: false, error: { code: 'HTL-023', message: 'Room not found or inactive.' } }
      if (room.status === 'MAINTENANCE' || room.status === 'OUT_OF_ORDER') {
        return { ok: false, error: { code: 'HTL-024', message: `Room ${room.roomNumber} is currently ${room.status.replace('_', ' ').toLowerCase()} and cannot be booked.` } }
      }
      if (payload.numberOfGuests !== undefined && payload.numberOfGuests > room.maxOccupancy) {
        return { ok: false, error: { code: 'HTL-025', message: `Room ${room.roomNumber} has a maximum occupancy of ${room.maxOccupancy}.` } }
      }

      // Re-checked fresh inside the transaction, not against a pre-read
      // snapshot — same reasoning rental.service.ts's createBooking and
      // appointment.service.ts's provider-conflict check both document:
      // two front-desk staff booking the same room for overlapping dates
      // moments apart must not both succeed.
      const conflict = await findConflict(tx, payload.roomId, checkIn, checkOut)
      if (conflict) return { ok: false, error: { code: 'HTL-026', message: `Room ${room.roomNumber} is already booked for an overlapping date range (booking ${conflict.bookingNumber}).` } }

      const bookingNumber = await generateSequenceNumber(
        tx, 'hotel_booking_sequence', 'HTL', 5,
        async () => {
          const last = await tx.hotelBooking.findFirst({ orderBy: { createdAt: 'desc' }, select: { bookingNumber: true } })
          return last ? parseInt(last.bookingNumber.replace('HTL-', ''), 10) : 0
        }
      )

      const booking = await tx.hotelBooking.create({
        data: {
          bookingNumber, roomId: payload.roomId, customerId: payload.customerId ?? null,
          guestName: payload.guestName.trim(), guestPhone: payload.guestPhone?.trim() || null,
          guestEmail: payload.guestEmail?.trim() || null,
          numberOfGuests: payload.numberOfGuests ?? 1,
          checkInDate: checkIn, checkOutDate: checkOut,
          ratePerNight: payload.ratePerNight ?? room.baseRate,
          advanceAmount, advancePaymentMethod: payload.advancePaymentMethod ?? 'CASH',
          notes: payload.notes?.trim() || null,
          createdById: payload.createdById ?? null,
        },
      })
      return { ok: true, bookingId: booking.id }
    })

    if (!result.ok) return { success: false, error: result.error }
    await logAction({ userId: payload.createdById, action: 'HOTEL_BOOKING_CREATED', entityType: 'HotelBooking', entityId: result.bookingId })
    return getBooking(result.bookingId)
  } catch (e) {
    return { success: false, error: { code: 'HTL-027', message: e instanceof Error ? e.message : 'Could not create booking.' } }
  }
}

// The legal guest-register requirement this vertical exists to support —
// most jurisdictions require a lodging establishment to record every
// guest's ID before occupancy, producible for police/immigration
// verification. Rejecting a check-in with zero guest ID records isn't
// excess friction, it's the actual point of this module.
export async function checkInBooking(payload: {
  id: string
  guests: Array<{ guestName: string; idType: string; idNumber: string; nationality?: string; address?: string; isPrimary?: boolean }>
  userId?: string
}): Promise<{ success: boolean; data?: HotelBookingRecord; error?: { code: string; message: string } }> {
  try {
    if (!payload.guests || payload.guests.length === 0) {
      return { success: false, error: { code: 'HTL-028', message: 'At least one guest ID record is required to check in.' } }
    }
    for (const g of payload.guests) {
      if (!g.guestName?.trim()) return { success: false, error: { code: 'HTL-029', message: 'Guest name is required for every guest ID record.' } }
      if (!g.idType?.trim()) return { success: false, error: { code: 'HTL-030', message: 'ID type is required for every guest.' } }
      if (!g.idNumber?.trim()) return { success: false, error: { code: 'HTL-031', message: 'ID number is required for every guest.' } }
    }

    const db = getPrisma()
    const booking = await db.hotelBooking.findUnique({ where: { id: payload.id } })
    if (!booking) return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
    if (booking.status !== 'CONFIRMED') {
      return { success: false, error: { code: 'HTL-032', message: `Cannot check in a booking with status ${booking.status}. Only a CONFIRMED booking can be checked in.` } }
    }

    // Guarantee exactly one primary guest even if the caller didn't mark
    // one — defense-in-depth rather than trusting every future caller
    // (renderer, future API consumer) to remember to flag the first guest.
    const hasPrimary = payload.guests.some((g) => g.isPrimary)
    await db.$transaction(async (tx) => {
      await tx.hotelBooking.update({ where: { id: payload.id }, data: { status: 'CHECKED_IN', actualCheckInAt: new Date() } })
      await tx.hotelGuestId.createMany({
        data: payload.guests.map((g, i) => ({
          bookingId: payload.id, guestName: g.guestName.trim(), idType: g.idType.trim(),
          idNumber: g.idNumber.trim(), nationality: g.nationality?.trim() || 'IN',
          address: g.address?.trim() || null, isPrimary: hasPrimary ? (g.isPrimary ?? false) : i === 0,
        })),
      })
      await tx.hotelRoom.update({ where: { id: booking.roomId }, data: { status: 'OCCUPIED' } })
    })

    await logAction({ userId: payload.userId, action: 'HOTEL_CHECKED_IN', entityType: 'HotelBooking', entityId: payload.id, newValue: { guestCount: payload.guests.length } })
    return getBooking(payload.id)
  } catch (e) {
    return { success: false, error: { code: 'HTL-033', message: e instanceof Error ? e.message : 'Could not check in.' } }
  }
}

export async function checkOutBooking(payload: { id: string; userId?: string }): Promise<{ success: boolean; data?: HotelBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const booking = await db.hotelBooking.findUnique({ where: { id: payload.id } })
    if (!booking) return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
    if (booking.status !== 'CHECKED_IN') {
      return { success: false, error: { code: 'HTL-034', message: `Cannot check out a booking with status ${booking.status}. Only a CHECKED_IN booking can be checked out.` } }
    }

    await db.$transaction(async (tx) => {
      await tx.hotelBooking.update({ where: { id: payload.id }, data: { status: 'CHECKED_OUT', actualCheckOutAt: new Date() } })
      await tx.hotelRoom.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } })
    })

    await logAction({ userId: payload.userId, action: 'HOTEL_CHECKED_OUT', entityType: 'HotelBooking', entityId: payload.id })
    return getBooking(payload.id)
  } catch (e) {
    return { success: false, error: { code: 'HTL-035', message: e instanceof Error ? e.message : 'Could not check out.' } }
  }
}

export async function cancelBooking(payload: { id: string; reason?: string; userId?: string }): Promise<{ success: boolean; data?: HotelBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const booking = await db.hotelBooking.findUnique({ where: { id: payload.id } })
    if (!booking) return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
    // A CHECKED_IN guest is physically in the room — that's a check-out, not
    // a cancellation. Same real-world constraint rental.service.ts's
    // cancelBooking enforces for a CHECKED_OUT rental.
    if (booking.status !== 'CONFIRMED') {
      return { success: false, error: { code: 'HTL-036', message: `Cannot cancel a booking with status ${booking.status}. Only a CONFIRMED (not yet checked in) booking can be cancelled.` } }
    }

    await db.hotelBooking.update({ where: { id: payload.id }, data: { status: 'CANCELLED', cancelReason: payload.reason?.trim() || null } })
    await logAction({ userId: payload.userId, action: 'HOTEL_BOOKING_CANCELLED', entityType: 'HotelBooking', entityId: payload.id })
    return getBooking(payload.id)
  } catch (e) {
    return { success: false, error: { code: 'HTL-037', message: e instanceof Error ? e.message : 'Could not cancel booking.' } }
  }
}

export async function markNoShow(payload: { id: string; userId?: string }): Promise<{ success: boolean; data?: HotelBookingRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const booking = await db.hotelBooking.findUnique({ where: { id: payload.id } })
    if (!booking) return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
    if (booking.status !== 'CONFIRMED') {
      return { success: false, error: { code: 'HTL-038', message: `Cannot mark a booking with status ${booking.status} as a no-show. Only a CONFIRMED booking can be.` } }
    }
    await db.hotelBooking.update({ where: { id: payload.id }, data: { status: 'NO_SHOW' } })
    await logAction({ userId: payload.userId, action: 'HOTEL_NO_SHOW', entityType: 'HotelBooking', entityId: payload.id })
    return getBooking(payload.id)
  } catch (e) {
    return { success: false, error: { code: 'HTL-039', message: e instanceof Error ? e.message : 'Could not mark as no-show.' } }
  }
}

// ─── Extra Charges (in-stay guest folio) ────────────────────────────────────

export async function addExtraCharge(payload: { bookingId: string; description: string; quantity?: number; unitPrice: number; userId?: string }): Promise<{ success: boolean; data?: HotelExtraChargeRecord; error?: { code: string; message: string } }> {
  try {
    if (!payload.description?.trim()) return { success: false, error: { code: 'HTL-040', message: 'Description is required.' } }
    if (payload.unitPrice < 0) return { success: false, error: { code: 'HTL-041', message: 'Unit price cannot be negative.' } }
    const quantity = payload.quantity ?? 1
    if (quantity <= 0) return { success: false, error: { code: 'HTL-042', message: 'Quantity must be greater than zero.' } }

    const db = getPrisma()
    const booking = await db.hotelBooking.findUnique({ where: { id: payload.bookingId } })
    if (!booking) return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
    if (booking.status !== 'CHECKED_IN') {
      return { success: false, error: { code: 'HTL-043', message: 'Extra charges can only be added while the guest is checked in.' } }
    }

    const amount = roundCurrency(quantity * payload.unitPrice)
    const charge = await db.hotelExtraCharge.create({
      data: { bookingId: payload.bookingId, description: payload.description.trim(), quantity, unitPrice: payload.unitPrice, amount },
    })
    await logAction({ userId: payload.userId, action: 'HOTEL_CHARGE_ADDED', entityType: 'HotelBooking', entityId: payload.bookingId, newValue: { description: charge.description, amount } })
    return {
      success: true,
      data: { id: charge.id, description: charge.description, quantity: charge.quantity, unitPrice: charge.unitPrice, amount: charge.amount, chargeDate: charge.chargeDate.toISOString(), createdAt: charge.createdAt.toISOString() },
    }
  } catch (e) {
    return { success: false, error: { code: 'HTL-044', message: e instanceof Error ? e.message : 'Could not add charge.' } }
  }
}

export async function removeExtraCharge(payload: { chargeId: string; userId?: string }): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const charge = await db.hotelExtraCharge.findUnique({ where: { id: payload.chargeId }, include: { booking: { select: { status: true, id: true } } } })
    if (!charge) return { success: false, error: { code: 'HTL-045', message: 'Charge not found.' } }
    if (charge.booking.status !== 'CHECKED_IN') {
      return { success: false, error: { code: 'HTL-046', message: 'Charges can only be removed while the guest is checked in.' } }
    }
    await db.hotelExtraCharge.delete({ where: { id: payload.chargeId } })
    await logAction({ userId: payload.userId, action: 'HOTEL_CHARGE_REMOVED', entityType: 'HotelBooking', entityId: charge.booking.id })
    return { success: true }
  } catch (e) {
    return { success: false, error: { code: 'HTL-047', message: e instanceof Error ? e.message : 'Could not remove charge.' } }
  }
}

// ─── Invoicing ───────────────────────────────────────────────────────────────

const HOTEL_ROOM_CHARGE_PRODUCT_NAME = 'Hotel Room Charge'
const HOTEL_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

async function findOrCreatePlaceholderProduct(name: string): Promise<{ id: string }> {
  const db = getPrisma()
  let product = await db.product.findFirst({ where: { productName: name, isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName: name, productType: 'SERVICE', sellingPrice: 0, taxRate: 0, unit: 'NOS', isActive: true },
    })
  }
  return product
}

// Same atomic claim-sentinel + find-or-create-placeholder-Product +
// billingService.createInvoice() pattern rental.service.ts's
// generateRentalInvoice established — not a parallel billing engine. Room
// charge and each distinct extra-charge description get their own
// placeholder Product (not one shared generic line) so the printed invoice
// itemizes exactly what a real hotel folio would show, matching how
// rental.service.ts creates one placeholder per rented product name.
export async function generateHotelInvoice(bookingId: string, userId?: string): Promise<{ success: boolean; data?: { invoiceId: string }; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.hotelBooking.updateMany({ where: { id: bookingId, invoiceId: null }, data: { invoiceId: HOTEL_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.hotelBooking.findUnique({ where: { id: bookingId }, select: { id: true, invoiceId: true } })
      if (!existing) return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
      if (existing.invoiceId === HOTEL_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'HTL-048', message: 'Invoice generation already in progress for this booking.' } }
      return { success: false, error: { code: 'HTL-049', message: 'An invoice has already been generated for this booking.' } }
    }

    try {
      const booking = await db.hotelBooking.findUnique({ where: { id: bookingId }, include: { room: true, charges: true } })
      if (!booking) {
        await db.hotelBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'HTL-017', message: 'Booking not found.' } }
      }
      if (!booking.customerId) {
        await db.hotelBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'HTL-050', message: 'This booking has no linked customer record — link one before generating an invoice.' } }
      }

      const nights = computeNights(booking.checkInDate, booking.checkOutDate)
      const roomCharge = roundCurrency(booking.ratePerNight * nights)

      const roomChargeProduct = await findOrCreatePlaceholderProduct(`${HOTEL_ROOM_CHARGE_PRODUCT_NAME} — Room ${booking.room.roomNumber}`)
      const invoiceItems: Array<{ productId: string; quantity: number; unitPrice: number }> = [
        { productId: roomChargeProduct.id, quantity: 1, unitPrice: roomCharge },
      ]
      for (const charge of booking.charges) {
        const chargeProduct = await findOrCreatePlaceholderProduct(charge.description)
        invoiceItems.push({ productId: chargeProduct.id, quantity: charge.quantity, unitPrice: charge.unitPrice })
      }

      const result = await billingService.createInvoice({
        customerId: booking.customerId,
        paymentMethod: 'CREDIT',
        items: invoiceItems,
        notes: `Hotel stay ${booking.bookingNumber} — Room ${booking.room.roomNumber}, ${nights} night(s), guest: ${booking.guestName}`,
        referenceNumber: booking.bookingNumber,
      })
      if (!result.success) {
        await db.hotelBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string; totalAmount: number }
      await db.hotelBooking.update({ where: { id: bookingId }, data: { invoiceId: invoice.id } })

      // The advance collected at booking time is real money already
      // received — record it against the newly created invoice through the
      // same payments:record path every other payment in this app goes
      // through, rather than inventing separate advance-payment math.
      // Capped at the invoice total: an advance can never be recorded as a
      // payment larger than what's actually owed.
      if (booking.advanceAmount > 0) {
        const { paymentService } = await import('./payment.service')
        await paymentService.recordPayment({
          invoiceId: invoice.id,
          paymentMethod: booking.advancePaymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
          amount: Math.min(booking.advanceAmount, invoice.totalAmount),
        }, userId)
      }

      await logAction({ userId, action: 'HOTEL_INVOICED', entityType: 'HotelBooking', entityId: bookingId, newValue: { invoiceId: invoice.id } })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.hotelBooking.update({ where: { id: bookingId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'HTL-051', message: e instanceof Error ? e.message : 'Could not generate invoice.' } }
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface OccupancyReport {
  asOf: string
  totalRooms: number
  occupied: number
  available: number
  cleaning: number
  maintenance: number
  occupancyPercent: number
}

export async function getOccupancyReport(): Promise<{ success: boolean; data?: OccupancyReport; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rooms = await db.hotelRoom.findMany({ where: { isActive: true }, select: { status: true } })
    const totalRooms = rooms.length
    const occupied = rooms.filter((r) => r.status === 'OCCUPIED').length
    const available = rooms.filter((r) => r.status === 'AVAILABLE').length
    const cleaning = rooms.filter((r) => r.status === 'CLEANING').length
    const maintenance = rooms.filter((r) => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER').length
    return {
      success: true,
      data: {
        asOf: new Date().toISOString(), totalRooms, occupied, available, cleaning, maintenance,
        occupancyPercent: totalRooms > 0 ? Math.round((occupied / totalRooms) * 1000) / 10 : 0,
      },
    }
  } catch (e) {
    return { success: false, error: { code: 'HTL-052', message: e instanceof Error ? e.message : 'Could not generate occupancy report.' } }
  }
}

export interface GuestRegisterRow {
  bookingNumber: string; roomNumber: string
  guestName: string; idType: string; idNumber: string; nationality: string; address: string | null
  checkInDate: string; checkOutDate: string; actualCheckInAt: string | null; actualCheckOutAt: string | null
}

// The compliance report this whole vertical exists to support — a
// producible-on-demand register of every guest's ID, for police/
// immigration verification, filtered to guests whose stay overlaps the
// requested date range.
export async function getGuestRegister(params: { dateFrom: string; dateTo: string }): Promise<{ success: boolean; data?: { rows: GuestRegisterRow[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const from = new Date(params.dateFrom)
    const to = new Date(params.dateTo)
    to.setHours(23, 59, 59, 999)
    if (to <= from) return { success: false, error: { code: 'HTL-053', message: 'End date must be after start date.' } }

    const bookings = await db.hotelBooking.findMany({
      where: {
        checkInDate: { lt: to },
        checkOutDate: { gt: from },
        guests: { some: {} },
      },
      include: { room: { select: { roomNumber: true } }, guests: true },
      orderBy: { checkInDate: 'asc' },
    })

    const rows: GuestRegisterRow[] = bookings.flatMap((b) =>
      b.guests.map((g) => ({
        bookingNumber: b.bookingNumber, roomNumber: b.room.roomNumber,
        guestName: g.guestName, idType: g.idType, idNumber: g.idNumber,
        nationality: g.nationality, address: g.address,
        checkInDate: b.checkInDate.toISOString(), checkOutDate: b.checkOutDate.toISOString(),
        actualCheckInAt: b.actualCheckInAt ? b.actualCheckInAt.toISOString() : null,
        actualCheckOutAt: b.actualCheckOutAt ? b.actualCheckOutAt.toISOString() : null,
      }))
    )
    return { success: true, data: { rows } }
  } catch (e) {
    return { success: false, error: { code: 'HTL-054', message: e instanceof Error ? e.message : 'Could not generate guest register.' } }
  }
}

export const hotelService = {
  listRooms, createRoom, updateRoom, deleteRoom,
  checkAvailability, listAvailableRooms,
  listBookings, getBooking, createBooking,
  checkInBooking, checkOutBooking, cancelBooking, markNoShow,
  addExtraCharge, removeExtraCharge,
  generateHotelInvoice,
  getOccupancyReport, getGuestRegister,
}
