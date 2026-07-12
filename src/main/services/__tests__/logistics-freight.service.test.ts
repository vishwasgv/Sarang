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
  return {
    freightLedger: {
      findUnique: vi.fn().mockResolvedValue(makeEntry()),
      update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeEntry(), ...data })),
      delete: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as never
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
})
