import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listShootAddOns, addShootAddOn, deleteShootAddOn, getShootAddOnsTotal } from '../shoot-addon.service'

function makeAddOn(overrides: Record<string, unknown> = {}) {
  return { id: 'addon-1', shootBookingId: 'shoot-1', description: 'Extra prints (6x4)', quantity: 20, unitPrice: 15, ...overrides }
}

function makeMockDb(addOns: ReturnType<typeof makeAddOn>[] = [makeAddOn()], bookingInvoiceId: string | null = null) {
  return {
    shootBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'shoot-1', invoiceId: bookingInvoiceId }) },
    shootAddOnItem: {
      findMany: vi.fn().mockResolvedValue(addOns),
      findUnique: vi.fn().mockResolvedValue({ ...addOns[0], shootBooking: { invoiceId: bookingInvoiceId } }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeAddOn({ id: 'addon-new', ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('shoot-addon.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists add-ons with unitPrice serialized to a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listShootAddOns('shoot-1')
    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ unitPrice: unknown }> }).data[0].unitPrice).toBe('number')
  })

  it('rejects a blank description', async () => {
    const res = await addShootAddOn({ shootBookingId: 'shoot-1', description: '  ', unitPrice: 15 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SAO-001')
  })

  it('rejects a zero/negative quantity', async () => {
    const res = await addShootAddOn({ shootBookingId: 'shoot-1', description: 'Prints', quantity: 0, unitPrice: 15 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SAO-002')
  })

  it('rejects a negative unit price', async () => {
    const res = await addShootAddOn({ shootBookingId: 'shoot-1', description: 'Prints', unitPrice: -5 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SAO-003')
  })

  it('rejects a missing booking', async () => {
    const db = makeMockDb()
    db.shootBooking.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addShootAddOn({ shootBookingId: 'missing', description: 'Prints', unitPrice: 15 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SAO-004')
  })

  it('rejects adding an add-on to an already-invoiced booking', async () => {
    const db = makeMockDb([makeAddOn()], 'invoice-existing')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addShootAddOn({ shootBookingId: 'shoot-1', description: 'Prints', unitPrice: 15 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SAO-005')
  })

  it('defaults quantity to 1 when omitted', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addShootAddOn({ shootBookingId: 'shoot-1', description: 'Album copy', unitPrice: 3000 })
    expect(res.success).toBe(true)
    expect(db.shootAddOnItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: 1 }) }))
  })

  it('rejects deleting an add-on from an already-invoiced booking', async () => {
    const db = makeMockDb([makeAddOn()], 'invoice-existing')
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteShootAddOn('addon-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SAO-006')
  })

  it('deletes an add-on when the booking is not yet invoiced', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteShootAddOn('addon-1')
    expect(res.success).toBe(true)
  })

  it('computes the real total from quantity × unitPrice across all add-ons', async () => {
    const db = makeMockDb([
      makeAddOn({ id: 'a1', quantity: 20, unitPrice: 15 }), // 300
      makeAddOn({ id: 'a2', quantity: 1, unitPrice: 3000 }), // 3000
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getShootAddOnsTotal('shoot-1')
    expect(res.success).toBe(true)
    expect((res as { data: { total: number; count: number } }).data).toEqual({ total: 3300, count: 2 })
  })
})
