import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../bill.service', () => ({ billService: { createBill: vi.fn() } }))
vi.mock('../expense.service', () => ({ createExpense: vi.fn() }))

import { getPrisma } from '../../database/db'
import { recurringProfileService, getPeriodInfo } from '../recurring-profile.service'
import { billingService } from '../billing.service'
import { billService } from '../bill.service'
import { createExpense } from '../expense.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Ramesh' }) },
    supplier: { findUnique: vi.fn().mockResolvedValue({ id: 'sup-1', supplierName: 'ACME' }) },
    recurringProfile: {
      create: vi.fn().mockResolvedValue({ id: 'rp-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({})
    },
    ...overrides
  } as Record<string, any>
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('getPeriodInfo', () => {
  it('MONTHLY: period key is YYYY-MM, threshold clamps dayOfPeriod to the days in that month', () => {
    const { periodKey, thresholdDate } = getPeriodInfo('MONTHLY', 31, new Date(2026, 1, 15)) // Feb 2026, not a leap year day-31
    expect(periodKey).toBe('2026-02')
    expect(thresholdDate.getDate()).toBe(28) // Feb 2026 has 28 days
  })

  it('QUARTERLY: period key is YYYY-Qn, threshold anchors to the first month of the quarter', () => {
    const { periodKey, thresholdDate } = getPeriodInfo('QUARTERLY', 5, new Date(2026, 7, 20)) // August = Q3 (Jul-Sep)
    expect(periodKey).toBe('2026-Q3')
    expect(thresholdDate.getMonth()).toBe(6) // July (0-indexed)
    expect(thresholdDate.getDate()).toBe(5)
  })

  it('YEARLY: period key is just the year, threshold anchors to January', () => {
    const { periodKey, thresholdDate } = getPeriodInfo('YEARLY', 10, new Date(2026, 5, 1))
    expect(periodKey).toBe('2026')
    expect(thresholdDate.getMonth()).toBe(0)
    expect(thresholdDate.getDate()).toBe(10)
  })

  it('WEEKLY: threshold falls within the same ISO week as the reference date', () => {
    // 2026-08-12 is a Wednesday. dayOfPeriod=1 (Monday) should land 2 days earlier.
    const { thresholdDate } = getPeriodInfo('WEEKLY', 1, new Date(2026, 7, 12))
    expect(thresholdDate.getDate()).toBe(10) // Monday of that week
  })
})

describe('recurringProfileService.createRecurringProfile', () => {
  it('rejects an INVOICE profile for a non-existent customer', async () => {
    const db = makeDb({ customer: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recurringProfileService.createRecurringProfile({
      documentType: 'INVOICE', customerId: 'ghost', items: [{ productId: 'p1', quantity: 1, unitPrice: 100, taxRate: 0 }],
      cadence: 'MONTHLY', dayOfPeriod: 1, startDate: '2026-09-01'
    } as never)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CUST-001')
  })

  it('rejects a BILL profile for a non-existent supplier', async () => {
    const db = makeDb({ supplier: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recurringProfileService.createRecurringProfile({
      documentType: 'BILL', supplierId: 'ghost', items: [{ serviceDescription: 'Rent', quantity: 1, unitCost: 5000, taxRate: 18 }],
      isReverseCharge: false, cadence: 'MONTHLY', dayOfPeriod: 1, startDate: '2026-09-01'
    } as never)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SUP-001')
  })

  it('creates a valid EXPENSE profile with no supplier required', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recurringProfileService.createRecurringProfile({
      documentType: 'EXPENSE', categoryId: 'cat-1', expenseName: 'Rent', amount: 20000,
      cadence: 'MONTHLY', dayOfPeriod: 1, startDate: '2026-09-01'
    } as never)

    expect(res.success).toBe(true)
    expect(db.recurringProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ documentType: 'EXPENSE', cadence: 'MONTHLY' })
    }))
  })
})

describe('recurringProfileService.generateDueRecurringDocuments', () => {
  function makeProfile(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rp-1', documentType: 'EXPENSE', payloadJson: JSON.stringify({ categoryId: 'cat-1', expenseName: 'Rent', amount: 20000 }),
      customerId: null, supplierId: null, cadence: 'MONTHLY', dayOfPeriod: 1,
      startDate: new Date(2026, 0, 1), endDate: null, lastGeneratedPeriod: null, active: true,
      ...overrides
    }
  }

  it('skips a profile whose startDate is in the future', async () => {
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([makeProfile({ startDate: new Date(2099, 0, 1) })]), updateMany: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recurringProfileService.generateDueRecurringDocuments()

    expect(db.recurringProfile.updateMany).not.toHaveBeenCalled()
    expect(createExpense).not.toHaveBeenCalled()
  })

  it('skips a profile already generated for the current period', async () => {
    const today = new Date()
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([makeProfile({ lastGeneratedPeriod: currentMonthKey, dayOfPeriod: 1 })]), updateMany: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recurringProfileService.generateDueRecurringDocuments()

    expect(db.recurringProfile.updateMany).not.toHaveBeenCalled()
  })

  // Section 5.4's own explicit required coverage: "correctly skips an
  // inactive or ended profile" — the `active` half is a trivial DB-level
  // `where: { active: true }` filter, but the `endDate` half is in-memory
  // logic (`if (profile.endDate && profile.endDate.getTime() < today0)
  // continue`) that a real off-by-one or timezone bug could silently break,
  // so it gets its own dedicated test rather than being assumed correct.
  it('skips a profile whose endDate has already passed', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([makeProfile({ endDate: yesterday, dayOfPeriod: 1 })]), updateMany: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recurringProfileService.generateDueRecurringDocuments()

    expect(db.recurringProfile.updateMany).not.toHaveBeenCalled()
    expect(createExpense).not.toHaveBeenCalled()
  })

  it('generates an EXPENSE via createExpense and claims the period first', async () => {
    vi.mocked(createExpense).mockResolvedValue({ success: true, data: { id: 'exp-1' } } as never)
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([makeProfile()]), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recurringProfileService.generateDueRecurringDocuments('user-1')

    expect(res.success).toBe(true)
    expect((res as any).data.generated).toHaveLength(1)
    expect(db.recurringProfile.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'rp-1', lastGeneratedPeriod: null }
    }))
    expect(createExpense).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-1', amount: 20000 }), 'user-1')
  })

  it('generates an INVOICE via billingService.createInvoice with paymentMethod CREDIT', async () => {
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)
    const profile = makeProfile({
      documentType: 'INVOICE', customerId: 'cust-1',
      payloadJson: JSON.stringify({ items: [{ productId: 'p1', quantity: 1, unitPrice: 500, taxRate: 18 }], notes: 'Monthly retainer' })
    })
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([profile]), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recurringProfileService.generateDueRecurringDocuments('user-1')

    expect(billingService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-1', paymentMethod: 'CREDIT' }),
      'user-1'
    )
  })

  it('generates a BILL via billService.createBill', async () => {
    vi.mocked(billService.createBill).mockResolvedValue({ success: true, data: { id: 'bill-1' } } as never)
    const profile = makeProfile({
      documentType: 'BILL', supplierId: 'sup-1',
      payloadJson: JSON.stringify({ items: [{ serviceDescription: 'Rent', quantity: 1, unitCost: 5000, taxRate: 18 }], isReverseCharge: false })
    })
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([profile]), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recurringProfileService.generateDueRecurringDocuments('user-1')

    expect(billService.createBill).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 'sup-1' }), 'user-1')
  })

  it('rolls back the period claim when generation fails', async () => {
    vi.mocked(createExpense).mockResolvedValue({ success: false, error: { code: 'EXP-001', message: 'boom' } } as never)
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([makeProfile()]), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recurringProfileService.generateDueRecurringDocuments('user-1')

    expect((res as any).data.failed).toHaveLength(1)
    expect(db.recurringProfile.update).toHaveBeenCalledWith({ where: { id: 'rp-1' }, data: { lastGeneratedPeriod: null } })
  })

  it('skips a profile when it lost the atomic claim race to a concurrent tick', async () => {
    const db = makeDb({ recurringProfile: { findMany: vi.fn().mockResolvedValue([makeProfile()]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recurringProfileService.generateDueRecurringDocuments()

    expect(createExpense).not.toHaveBeenCalled()
  })
})
