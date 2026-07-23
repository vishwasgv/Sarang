import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u1' }) }))

import { getPrisma } from '../../database/db'
import { getSupplierLedger } from '../supplier.service'

function makeSupplier(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sup-1', supplierCode: 'SUP-00001', supplierName: 'Acme Traders',
    phone: '9876543210', email: null, address: null,
    city: null, state: null, country: 'IN',
    isActive: true, notes: null,
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const base = {
    supplier: {
      findUnique: vi.fn().mockResolvedValue(makeSupplier()),
    },
    supplierLedger: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }),
    },
    ...overrides
  }
  const db = base as typeof base & { $transaction: ReturnType<typeof vi.fn> }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('supplierService.getSupplierLedger', () => {
  it('returns error for a non-existent supplier', async () => {
    const db = makeDb()
    db.supplier.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSupplierLedger('ghost')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SUP-001')
  })

  // Regression for a real, live, high-impact bug found 2026-07-22:
  // getSupplierLedger used to compute "outstanding" by summing only the 100
  // most-recent ledger rows returned for display — wrong for any supplier
  // with more than 100 ledger entries. The correct aggregate-based
  // calculation (supplier-ledger.service.ts's calculateBalance) already
  // existed but wasn't wired to this screen.
  it('computes outstanding from a true aggregate over the WHOLE ledger, not just the 100 displayed rows', async () => {
    const db = makeDb({
      supplierLedger: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'led-101', debitAmount: 500, creditAmount: 0 },
        ]), // only the most-recent row shown, out of 101+ real entries
        aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 80000, creditAmount: 35000 } }), // true whole-ledger sums
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSupplierLedger('sup-1')

    expect(res.success).toBe(true)
    const data = (res as { data: { outstanding: number } }).data
    // 80000 - 35000 = 45000 (the real whole-ledger balance) — NOT 500 (what
    // summing only the single displayed row would have produced).
    expect(data.outstanding).toBe(45000)
  })
})
