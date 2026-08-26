import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getCustomerCreditRisk, getEffectiveCreditLimit, getCreditRiskOverview } from '../distributor-credit-risk.service'

// Phase 67 §9.1 — Distributor item 5: Auto Risk-Scored Retailer Credit. Key
// non-trivial logic: tier boundaries (HIGH >30 days overdue OR >20 avg days
// late; MEDIUM any currently-overdue OR >5 avg days late; a customer with
// no payment history at all is UNRATED, not LOW) and the resulting
// creditLimit × multiplier effective limit.

const DAY = 86400000

function makeDb(opts: { creditLimit?: number; invoices?: any[]; payments?: any[] }) {
  return {
    customer: { findUnique: vi.fn().mockResolvedValue({ creditLimit: opts.creditLimit ?? 50000 }) },
    invoice: { findMany: vi.fn().mockResolvedValue(opts.invoices ?? []) },
    payment: { findMany: vi.fn().mockResolvedValue(opts.payments ?? []) },
  }
}

describe('distributor-credit-risk.service.getCustomerCreditRisk', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns CRISK-001 when the customer does not exist', async () => {
    const db = { customer: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerCreditRisk('missing')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CRISK-001')
  })

  it('rates a customer with zero invoice history as UNRATED, not LOW — a neutral 1.0x, not a reward for having no history', async () => {
    const db = makeDb({ invoices: [] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerCreditRisk('cust-1')
    expect(res.data?.riskTier).toBe('UNRATED')
    expect(res.data?.riskMultiplier).toBe(1.0)
  })

  it('rates HIGH when a currently-overdue invoice is more than 30 days late', async () => {
    const dueDate = new Date(Date.now() - 45 * DAY)
    const db = makeDb({ invoices: [{ id: 'inv-1', dueDate, balanceAmount: 5000, paymentStatus: 'UNPAID' }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerCreditRisk('cust-1')
    expect(res.data?.riskTier).toBe('HIGH')
    expect(res.data?.riskMultiplier).toBe(0.5)
  })

  it('rates MEDIUM when there is a currently-overdue invoice within 30 days (not yet HIGH)', async () => {
    const dueDate = new Date(Date.now() - 10 * DAY)
    const db = makeDb({ invoices: [{ id: 'inv-1', dueDate, balanceAmount: 3000, paymentStatus: 'UNPAID' }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerCreditRisk('cust-1')
    expect(res.data?.riskTier).toBe('MEDIUM')
    expect(res.data?.riskMultiplier).toBe(1.0)
  })

  it('rates LOW when all invoices were paid on or before their due date', async () => {
    const dueDate = new Date(Date.now() - 20 * DAY)
    const paymentDate = new Date(Date.now() - 22 * DAY)
    const db = makeDb({
      invoices: [{ id: 'inv-1', dueDate, balanceAmount: 0, paymentStatus: 'PAID' }],
      payments: [{ invoiceId: 'inv-1', paymentDate }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerCreditRisk('cust-1')
    expect(res.data?.riskTier).toBe('LOW')
    expect(res.data?.riskMultiplier).toBe(1.25)
    expect(res.data?.avgDaysLate).toBe(0)
  })

  it('effectiveCreditLimit scales the customer creditLimit by the tier multiplier', async () => {
    const dueDate = new Date(Date.now() - 20 * DAY)
    const paymentDate = new Date(Date.now() - 22 * DAY)
    const db = makeDb({
      creditLimit: 100000,
      invoices: [{ id: 'inv-1', dueDate, balanceAmount: 0, paymentStatus: 'PAID' }],
      payments: [{ invoiceId: 'inv-1', paymentDate }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerCreditRisk('cust-1')
    expect(res.data?.effectiveCreditLimit).toBe(125000)
  })

  it('getEffectiveCreditLimit falls back to the raw limit when the risk lookup fails, never blocking or loosening a sale on a transient error', async () => {
    const db = { customer: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const limit = await getEffectiveCreditLimit('missing', 75000)
    expect(limit).toBe(75000)
  })

  it('getCreditRiskOverview only scores customers with a credit limit set, and counts HIGH-risk ones', async () => {
    const dueDate = new Date(Date.now() - 45 * DAY)
    const db = {
      customer: {
        findMany: vi.fn().mockResolvedValue([{ id: 'c1', customerName: 'Retailer A' }, { id: 'c2', customerName: 'Retailer B' }]),
        findUnique: vi.fn()
          .mockResolvedValueOnce({ creditLimit: 20000 })
          .mockResolvedValueOnce({ creditLimit: 20000 }),
      },
      invoice: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ id: 'inv-1', dueDate, balanceAmount: 5000, paymentStatus: 'UNPAID' }])
          .mockResolvedValueOnce([]),
      },
      payment: { findMany: vi.fn().mockResolvedValue([]) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCreditRiskOverview()
    expect(res.data?.ratedCount).toBe(2)
    expect(res.data?.tierCounts.HIGH).toBe(1)
    expect(res.data?.highRiskCustomers[0].customerName).toBe('Retailer A')
  })
})
