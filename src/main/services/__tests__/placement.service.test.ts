import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { listPlacements, getPlacement, createPlacement, updatePlacement } from '../placement.service'

// Regression coverage for the Phase 34 re-audit finding: Placement.
// offeredSalary/commissionAmount are Prisma Decimal fields, returned
// unserialized by every function below. Electron's IPC can't serialize a
// Decimal instance and throws "An object could not be cloned".
// getPlacement additionally nests a jobOrder object with commissionValue
// selected, which crashes the same way unless reused via the exported
// serializeJobOrder from job-order.service.ts. Live-verified:
// placement.create crashed (row silently written to the DB anyway), and
// placement.get's nested jobOrder.commissionValue crashed separately.
// A FakeDecimal test double (toString/valueOf only, like a real Decimal.js
// instance) proves both surfaces are actually converted to plain numbers.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makePlacement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plc-1', placementNumber: 'PLC-00001', candidateId: 'cnd-1', jobOrderId: 'jo-1', clientId: 'cust-1',
    candidate: { id: 'cnd-1', candidateNumber: 'CND-00001', fullName: 'Ravi Shankar', phone: null },
    jobOrder: { id: 'jo-1', orderNumber: 'JO-00001', jobTitle: 'Senior Engineer' },
    client: { id: 'cust-1', customerName: 'Acme Corp' },
    joiningDate: new Date(), offeredSalary: new FakeDecimal(1200000) as unknown as number,
    commissionAmount: new FakeDecimal(100000) as unknown as number,
    invoiceId: null, status: 'OFFERED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makePlacementWithFullJobOrder(overrides: Record<string, unknown> = {}) {
  return makePlacement({
    jobOrder: {
      id: 'jo-1', orderNumber: 'JO-00001', jobTitle: 'Senior Engineer',
      commissionType: 'PERCENTAGE', commissionValue: new FakeDecimal(8.33) as unknown as number,
    },
    ...overrides,
  })
}

function makeMockDb(existing: ReturnType<typeof makePlacement> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    placement: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makePlacement({ id: 'plc-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makePlacement({ ...existing, ...data }))
      ),
    },
    candidate: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }), update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      updateMany: vi.fn(async ({ where, data }: { where: { settingValue: string }; data: { settingValue: string } }) => {
        if (!settingRow || settingRow.settingValue !== where.settingValue) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }
        return settingRow
      }),
    },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('placement.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPlacement returns offeredSalary and commissionAmount as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPlacement({
      candidateId: 'cnd-1', jobOrderId: 'jo-1', clientId: 'cust-1',
      joiningDate: new Date().toISOString(), offeredSalary: 1200000, commissionAmount: 100000,
    })

    expect(res.success).toBe(true)
    const data = (res as { data: { offeredSalary: unknown; commissionAmount: unknown } }).data
    expect(typeof data.offeredSalary).toBe('number')
    expect(typeof data.commissionAmount).toBe('number')
  })

  it('listPlacements returns offeredSalary as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makePlacement())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listPlacements({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ offeredSalary: unknown }> }).data[0].offeredSalary).toBe('number')
  })

  it('updatePlacement returns commissionAmount as a plain number', async () => {
    const db = makeMockDb(makePlacement())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePlacement({ id: 'plc-1', commissionAmount: 110000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { commissionAmount: unknown } }).data.commissionAmount).toBe('number')
  })

  it('getPlacement returns offeredSalary and nested jobOrder.commissionValue as plain numbers', async () => {
    const db = makeMockDb(makePlacementWithFullJobOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getPlacement('plc-1')

    expect(res.success).toBe(true)
    const data = (res as { data: { offeredSalary: unknown; jobOrder: { commissionValue: unknown } } }).data
    expect(typeof data.offeredSalary).toBe('number')
    expect(typeof data.jobOrder.commissionValue).toBe('number')
  })

  it('getPlacement does not inject spurious experienceMin/salaryBudgetMin onto the nested jobOrder', async () => {
    const db = makeMockDb(makePlacementWithFullJobOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getPlacement('plc-1')

    const jobOrder = (res as { data: { jobOrder: Record<string, unknown> } }).data.jobOrder
    expect('experienceMin' in jobOrder).toBe(false)
    expect('salaryBudgetMin' in jobOrder).toBe(false)
  })
})
