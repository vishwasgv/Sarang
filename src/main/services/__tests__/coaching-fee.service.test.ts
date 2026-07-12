import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { generateMonthlyFees, listFees, updateFeeRecord } from '../coaching-fee.service'

// Regression coverage for two Phase 31 re-audit findings on
// coaching-fee.service.ts:
//
// 1. Decimal serialization — CoachingFeeRecord has 5 Prisma Decimal fields
//    (baseAmount, taxRate, taxAmount, amountDue, amountReceived), returned
//    unserialized by listFees/updateFeeRecord. Electron's IPC can't
//    serialize a Decimal instance and throws "An object could not be
//    cloned". generateMonthlyFees itself never returns a record (only
//    counts), so it wasn't at risk — but every fee record it creates
//    crashed the very next listFees() call. Live-verified.
//
// 2. GST reachability — generateMonthlyFees hardcoded `const taxRate = 0`
//    with no way for any caller (IPC channel, handler, or UI) to ever pass
//    a nonzero rate, making the schema's GST support dead code despite
//    being advertised as delivered. Fixed by adding an optional `taxRate`
//    parameter threaded through the IPC handler/channel and a "GST %"
//    input on FeesScreen.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeFeeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fee-1', enrollmentId: 'enr-1', studentId: 'stu-1', batchId: 'batch-1',
    feeMonth: '2026-07', dueDate: new Date('2026-07-10'),
    baseAmount: new FakeDecimal(3000) as unknown as number,
    taxRate: new FakeDecimal(0) as unknown as number,
    taxAmount: new FakeDecimal(0) as unknown as number,
    amountDue: new FakeDecimal(3000) as unknown as number,
    amountReceived: new FakeDecimal(0) as unknown as number,
    status: 'PENDING', paidDate: null, notes: null,
    // enrollment is included without a restrictive `select`, so Prisma
    // returns its full scalar set — including discountAmount/effectiveFee,
    // both Decimal. batch is selected WITHOUT feePerMonth here (unlike
    // listEnrollmentsByStudent), matching the real query shape.
    enrollment: {
      id: 'enr-1', batchId: 'batch-1', studentId: 'stu-1', status: 'ACTIVE', discountType: 'NONE',
      discountAmount: new FakeDecimal(0) as unknown as number,
      effectiveFee: new FakeDecimal(3000) as unknown as number,
      student: { id: 'stu-1', customerName: 'Ramesh Kumar', phone: null },
      batch: { id: 'batch-1', batchName: 'JEE 2027 Morning Batch', subjectOrCourse: 'Mathematics' },
    },
    ...overrides,
  }
}

function makeMockDb(existingFee: ReturnType<typeof makeFeeRecord> | null = null) {
  const db: Record<string, any> = {
    coachingFeeRecord: {
      findMany: vi.fn().mockResolvedValue(existingFee ? [existingFee] : []),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeFeeRecord({ ...existingFee, ...data }))
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    coachingBatchEnrollment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue({ id: 'prod-coaching-fee' }),
      create: vi.fn().mockResolvedValue({ id: 'prod-coaching-fee' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('coaching-fee.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listFees returns all 5 Decimal fields as plain numbers, not Decimal instances', async () => {
    const db = makeMockDb(makeFeeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listFees({ month: '2026-07' })

    expect(res.success).toBe(true)
    const record = (res as { data: Array<Record<string, unknown>> }).data[0]
    expect(typeof record.baseAmount).toBe('number')
    expect(typeof record.taxRate).toBe('number')
    expect(typeof record.taxAmount).toBe('number')
    expect(typeof record.amountDue).toBe('number')
    expect(typeof record.amountReceived).toBe('number')
  })

  it('updateFeeRecord returns amountDue/amountReceived as plain numbers', async () => {
    const db = makeMockDb(makeFeeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.coachingFeeRecord.findUnique = vi.fn().mockResolvedValue(makeFeeRecord())
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await updateFeeRecord({ id: 'fee-1', amountReceived: 3000, status: 'PAID' })

    expect(res.success).toBe(true)
    const data = (res as { data: { amountDue: unknown; amountReceived: unknown } }).data
    expect(typeof data.amountDue).toBe('number')
    expect(typeof data.amountReceived).toBe('number')
  })

  it('listFees also serializes the nested enrollment.discountAmount/effectiveFee — a second Decimal crash surface missed on the first fix pass', async () => {
    const db = makeMockDb(makeFeeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listFees({ month: '2026-07' })

    expect(res.success).toBe(true)
    const enrollment = (res as { data: Array<{ enrollment: { discountAmount: unknown; effectiveFee: unknown } }> }).data[0].enrollment
    expect(typeof enrollment.discountAmount).toBe('number')
    expect(typeof enrollment.effectiveFee).toBe('number')
  })

  it('does not inject a spurious feePerMonth field into enrollment.batch when it was never selected', async () => {
    // coaching-fee.service.ts's nested batch select is { id, batchName,
    // subjectOrCourse } only — no feePerMonth. serializeEnrollment must not
    // call serializeBatch (which would coerce a missing field to NaN) on an
    // object that never had that property in the first place.
    const db = makeMockDb(makeFeeRecord())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listFees({ month: '2026-07' })

    const batch = (res as { data: Array<{ enrollment: { batch: Record<string, unknown> } }> }).data[0].enrollment.batch
    expect('feePerMonth' in batch).toBe(false)
  })
})

describe('coaching-fee.service — GST reachability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('generateMonthlyFees defaults to 0% tax when no taxRate is passed', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.coachingBatchEnrollment.findMany = vi.fn().mockResolvedValue([
      { id: 'enr-1', studentId: 'stu-1', batchId: 'batch-1', effectiveFee: new FakeDecimal(3000), batch: { status: 'ACTIVE' } },
    ])

    await generateMonthlyFees('2026-07')

    expect(db.coachingFeeRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taxRate: 0, taxAmount: 0, amountDue: 3000 }) })
    )
  })

  it('generateMonthlyFees applies a nonzero taxRate when passed, computing taxAmount and amountDue correctly', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.coachingBatchEnrollment.findMany = vi.fn().mockResolvedValue([
      { id: 'enr-1', studentId: 'stu-1', batchId: 'batch-1', effectiveFee: new FakeDecimal(3000), batch: { status: 'ACTIVE' } },
    ])

    await generateMonthlyFees('2026-07', 18)

    expect(db.coachingFeeRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taxRate: 18, taxAmount: 540, amountDue: 3540 }) })
    )
  })
})
