import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { markFreightPaid, updateFreightEntry, deleteFreightEntry, getFreightSummary } from '../logistics-freight.service'

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fl-1', shipmentId: null, carrierId: 'car-1', carrierName: 'FastTrans',
    referenceNumber: null, amount: 1000, paidDate: null, paidBy: 'CASH', notes: null,
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    freightLedger: {
      findUnique: vi.fn().mockResolvedValue(makeEntry()),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeEntry(), ...data })),
      delete: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  }
  // Real race found+fixed in the zero-logical-errors audit: markFreightPaid/
  // updateFreightEntry/deleteFreightEntry now read fresh INSIDE their own
  // transaction (tx === db here, same convention as every other service's
  // own test file).
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db as never
}

beforeEach(() => vi.clearAllMocks())

describe('markFreightPaid — idempotency', () => {
  it('rejects marking an already-paid entry paid again', async () => {
    const db = makeDb({ freightLedger: { findUnique: vi.fn().mockResolvedValue(makeEntry({ paidDate: new Date() })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db)
    const result = await markFreightPaid({ id: 'fl-1' })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('marks a pending entry paid', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db)
    const result = await markFreightPaid({ id: 'fl-1' })
    expect(result.success).toBe(true)
  })
})

describe('paid entries are immutable', () => {
  it('rejects editing a paid entry', async () => {
    const db = makeDb({ freightLedger: { findUnique: vi.fn().mockResolvedValue(makeEntry({ paidDate: new Date() })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db)
    const result = await updateFreightEntry({ id: 'fl-1', amount: 2000 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('rejects deleting a paid entry', async () => {
    const db = makeDb({ freightLedger: { findUnique: vi.fn().mockResolvedValue(makeEntry({ paidDate: new Date() })), delete: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db)
    const result = await deleteFreightEntry('fl-1')
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })
})

describe('getFreightSummary', () => {
  it('splits total into paid and pending correctly', async () => {
    const db = makeDb({
      freightLedger: {
        findMany: vi.fn().mockResolvedValue([
          makeEntry({ amount: 1000, paidDate: new Date() }),
          makeEntry({ amount: 500, paidDate: null }),
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db)
    const result = await getFreightSummary()
    expect(result.success).toBe(true)
    const data = (result as { data: { totalAmount: number; paidAmount: number; pendingAmount: number } }).data
    expect(data.totalAmount).toBe(1500)
    expect(data.paidAmount).toBe(1000)
    expect(data.pendingAmount).toBe(500)
  })

  // Real bug found+fixed in the zero-logical-errors audit: totals used to
  // accumulate via plain `array.reduce`/`+=` on raw floats instead of this
  // codebase's own established Decimal-safe sumCurrency.
  it('sums float-imprecise amounts to a clean value, including per-carrier totals', async () => {
    const db = makeDb({
      freightLedger: {
        findMany: vi.fn().mockResolvedValue([
          makeEntry({ amount: 0.1, paidDate: new Date(), carrierId: 'car-1', carrierName: 'FastTrans' }),
          makeEntry({ amount: 0.2, paidDate: null, carrierId: 'car-1', carrierName: 'FastTrans' }),
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db)
    const result = await getFreightSummary()
    expect(result.success).toBe(true)
    const data = (result as { data: { totalAmount: number; byCarrier: Array<{ total: number }> } }).data
    expect(data.totalAmount).toBe(0.3)
    expect(data.byCarrier[0].total).toBe(0.3)
  })
})

// Real race found+fixed in the zero-logical-errors audit: markFreightPaid/
// updateFreightEntry/deleteFreightEntry used to read `existing` via a plain
// findUnique OUTSIDE any transaction, then write via a separate un-
// transacted call — no $transaction at all. One staff member marking an
// entry paid while another simultaneously edits/deletes it could both read
// the pre-payment state, letting an edit or delete commit AFTER the entry
// was marked paid, bypassing the "cannot edit/delete a paid entry" guard.
describe('logistics-freight.service — TOCTOU race fix', () => {
  it('markFreightPaid reads the entry fresh inside the transaction', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db)
    await markFreightPaid({ id: 'fl-1' })
    const txOrder = vi.mocked((db as any).$transaction).mock.invocationCallOrder[0]
    const findOrder = vi.mocked((db as any).freightLedger.findUnique).mock.invocationCallOrder[0]
    expect(txOrder).toBeLessThan(findOrder)
  })

  it('updateFreightEntry reads the entry fresh inside the transaction', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db)
    await updateFreightEntry({ id: 'fl-1', amount: 2000 })
    const txOrder = vi.mocked((db as any).$transaction).mock.invocationCallOrder[0]
    const findOrder = vi.mocked((db as any).freightLedger.findUnique).mock.invocationCallOrder[0]
    expect(txOrder).toBeLessThan(findOrder)
  })

  it('deleteFreightEntry reads the entry fresh inside the transaction', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db)
    await deleteFreightEntry('fl-1')
    const txOrder = vi.mocked((db as any).$transaction).mock.invocationCallOrder[0]
    const findOrder = vi.mocked((db as any).freightLedger.findUnique).mock.invocationCallOrder[0]
    expect(txOrder).toBeLessThan(findOrder)
  })
})
