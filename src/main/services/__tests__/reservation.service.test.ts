import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createReservation, listReservations, updateReservationStatus, deleteReservation, getUpcomingReservationsByTable } from '../reservation.service'

function makeReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rsv-1', customerName: 'Priya Sharma', phone: '9876543210', partySize: 4,
    reservedFor: new Date('2026-08-01T19:30:00'), tableId: null, notes: null,
    status: 'CONFIRMED', createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(reservations: ReturnType<typeof makeReservation>[] = [makeReservation()]) {
  return {
    restaurantTable: {
      findUnique: vi.fn().mockResolvedValue({ id: 'table-1', tableNumber: '5' }),
      update: vi.fn().mockResolvedValue({}),
    },
    reservation: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeReservation({ id: 'rsv-new', ...data }))),
      findMany: vi.fn().mockResolvedValue(reservations),
      findUnique: vi.fn().mockResolvedValue(reservations[0]),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeReservation({ ...reservations[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('reservation.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a reservation without a table', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createReservation({ customerName: 'Priya Sharma', phone: '9876543210', partySize: 4, reservedFor: '2026-08-01T19:30:00' })
    expect(res.success).toBe(true)
    expect(db.restaurantTable.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a reservation for a table that does not exist', async () => {
    const db = makeMockDb()
    db.restaurantTable.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createReservation({ customerName: 'Priya Sharma', phone: '9876543210', partySize: 4, reservedFor: '2026-08-01T19:30:00', tableId: 'missing' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RSV-001')
  })

  it('lists reservations ordered by reservedFor', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listReservations()
    expect(res.success).toBe(true)
    expect(db.reservation.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { reservedFor: 'asc' } }))
  })

  it('marking SEATED with a linked table also occupies that table', async () => {
    const db = makeMockDb([makeReservation({ tableId: 'table-1' })])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateReservationStatus('rsv-1', 'SEATED')
    expect(res.success).toBe(true)
    expect(db.restaurantTable.update).toHaveBeenCalledWith({ where: { id: 'table-1' }, data: { status: 'OCCUPIED' } })
  })

  it('marking SEATED with no linked table does not touch any table', async () => {
    const db = makeMockDb([makeReservation({ tableId: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateReservationStatus('rsv-1', 'SEATED')
    expect(res.success).toBe(true)
    expect(db.restaurantTable.update).not.toHaveBeenCalled()
  })

  it('rejects changing status of an already-cancelled reservation', async () => {
    const db = makeMockDb([makeReservation({ status: 'CANCELLED' })])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateReservationStatus('rsv-1', 'SEATED')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RSV-005')
  })

  it('rejects updating a reservation that does not exist', async () => {
    const db = makeMockDb()
    db.reservation.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateReservationStatus('missing', 'SEATED')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RSV-004')
  })

  it('deletes a reservation', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteReservation('rsv-1')
    expect(res.success).toBe(true)
    expect(db.reservation.delete).toHaveBeenCalledWith({ where: { id: 'rsv-1' } })
  })

  it('groups upcoming reservations by table, keeping only the earliest per table', async () => {
    const near = new Date(Date.now() + 60 * 60 * 1000)
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const db = makeMockDb()
    db.reservation.findMany = vi.fn().mockResolvedValue([
      { id: 'a', tableId: 'table-1', customerName: 'A', partySize: 2, reservedFor: near },
      { id: 'b', tableId: 'table-1', customerName: 'B', partySize: 3, reservedFor: later },
      { id: 'c', tableId: 'table-2', customerName: 'C', partySize: 4, reservedFor: later },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getUpcomingReservationsByTable(3)
    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, { id: string }> }).data
    expect(data['table-1'].id).toBe('a')
    expect(data['table-2'].id).toBe('c')
  })
})
