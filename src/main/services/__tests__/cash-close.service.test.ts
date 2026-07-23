import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { cashCloseService } from '../cash-close.service'

function makeMockDb(opts: {
  payments?: Array<{ amount: number; paymentMethod: string }>
  existing?: Record<string, unknown> | null
  updatedRecord?: Record<string, unknown>
  createdRecord?: Record<string, unknown>
} = {}) {
  const payments = opts.payments ?? []
  const existing = opts.existing !== undefined ? opts.existing : null
  const updatedRecord = opts.updatedRecord ?? { id: 'cc-1', variance: 0, actualCash: 0 }
  const createdRecord = opts.createdRecord ?? { id: 'cc-1', variance: 0 }

  return {
    payment: {
      findMany: vi.fn().mockResolvedValue(payments),
    },
    dailyCashClose: {
      findFirst: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue(updatedRecord),
      create: vi.fn().mockResolvedValue(createdRecord),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(async (ops: unknown[]) => {
      return Promise.all(ops.map(op => op))
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cashCloseService.create', () => {
  it('computes variance as actualCash minus expectedCash', async () => {
    const db = makeMockDb({
      payments: [{ amount: 300, paymentMethod: 'CASH' }, { amount: 300, paymentMethod: 'CASH' }],
      existing: null,
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await cashCloseService.create({ date: '2024-01-15', actualCash: 650, notes: undefined })

    const createCall = db.dailyCashClose.create.mock.calls[0][0]
    expect(createCall.data.expectedCash).toBe(600)
    expect(createCall.data.actualCash).toBe(650)
    expect(createCall.data.variance).toBe(50)
  })

  it('variance is negative when drawer is short', async () => {
    const db = makeMockDb({
      payments: [{ amount: 1000, paymentMethod: 'CASH' }],
      existing: null,
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await cashCloseService.create({ date: '2024-01-15', actualCash: 950 })

    const createCall = db.dailyCashClose.create.mock.calls[0][0]
    expect(createCall.data.variance).toBe(-50)
  })

  it('updates existing record if day was already closed', async () => {
    const db = makeMockDb({
      payments: [{ amount: 200, paymentMethod: 'CASH' }],
      existing: { id: 'cc-existing', closeDate: new Date('2024-01-15') },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await cashCloseService.create({ date: '2024-01-15', actualCash: 210 })

    expect(db.dailyCashClose.update).toHaveBeenCalledOnce()
    expect(db.dailyCashClose.create).not.toHaveBeenCalled()
    const updateCall = db.dailyCashClose.update.mock.calls[0][0]
    expect(updateCall.data.variance).toBe(10)
  })

  it('queries only CASH payments for expectedCash (WHERE paymentMethod = CASH)', async () => {
    const db = makeMockDb({ payments: [{ amount: 500, paymentMethod: 'CASH' }], existing: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await cashCloseService.create({ date: '2024-01-15', actualCash: 500 })

    const whereArg = db.payment.findMany.mock.calls[0][0].where
    expect(whereArg.paymentMethod).toBe('CASH')
    const createCall = db.dailyCashClose.create.mock.calls[0][0]
    expect(createCall.data.variance).toBe(0)
  })
})

// Regression for a real defect found 2026-07-22: `new Date(date)` on an
// explicit "YYYY-MM-DD" input parses as UTC midnight, then startOfDay's
// setHours(0,0,0,0) re-anchors it to LOCAL wall-clock time of that UTC
// instant — for any timezone BEHIND UTC (e.g. US), this silently shifts
// the whole close-out window back one day. parseLocalDateStart fixes it by
// constructing local midnight directly, with no UTC round-trip at all.
describe('cashCloseService date-boundary correctness', () => {
  it('queries the exact requested local calendar day, not a UTC-shifted one', async () => {
    const db = makeMockDb({ payments: [], existing: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await cashCloseService.getDrawerSummary('2026-07-31')

    const whereArg = db.payment.findMany.mock.calls[0][0].where
    const gte = whereArg.paymentDate.gte as Date
    const lte = whereArg.paymentDate.lte as Date
    // Local calendar components must read July 31st for both bounds —
    // new Date('2026-07-31') (UTC midnight) would read July 30th in any
    // timezone behind UTC once local components are inspected.
    expect(gte.getFullYear()).toBe(2026)
    expect(gte.getMonth()).toBe(6) // 0-indexed: July
    expect(gte.getDate()).toBe(31)
    expect(gte.getHours()).toBe(0)
    expect(lte.getDate()).toBe(31)
    expect(lte.getHours()).toBe(23)
  })
})

describe('cashCloseService.getDrawerSummary', () => {
  it('returns correct breakdown by payment method', async () => {
    const db = makeMockDb({
      payments: [
        { amount: 400, paymentMethod: 'CASH' },
        { amount: 600, paymentMethod: 'UPI' },
      ],
      existing: null,
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await cashCloseService.getDrawerSummary('2024-01-15')

    expect(res.success).toBe(true)
    const d = res.data as { expectedCash: number; totalCollected: number; byMethod: Record<string, number> }
    expect(d.expectedCash).toBe(400)
    expect(d.totalCollected).toBe(1000)
    expect(d.byMethod['CASH']).toBe(400)
    expect(d.byMethod['UPI']).toBe(600)
  })
})
