import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listJobOrders, getJobOrder, createJobOrder, updateJobOrder, serializeJobOrder } from '../job-order.service'

// Regression coverage for the Phase 34 re-audit finding: JobOrder.
// experienceMin/experienceMax/salaryBudgetMin/salaryBudgetMax/commissionValue
// are Prisma Decimal fields, returned unserialized by every function below.
// Electron's IPC can't serialize a Decimal instance and throws "An object
// could not be cloned". Live-verified: jobOrder.create with
// commissionValue=8.33 crashed (row silently written to the DB anyway).
// A FakeDecimal test double (toString/valueOf only, like a real Decimal.js
// instance) proves serializeJobOrder actually converts all fields to plain
// numbers. serializeJobOrder is also exported for reuse by
// placement.service.ts's nested jobOrder object — covered separately below
// via the property-presence guard.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeJobOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'jo-1', orderNumber: 'JO-00001', clientId: 'cust-1',
    client: { id: 'cust-1', customerName: 'Acme Corp', phone: null },
    jobTitle: 'Senior Engineer', jobDescription: null, requiredSkills: '[]',
    experienceMin: new FakeDecimal(3) as unknown as number,
    experienceMax: new FakeDecimal(7) as unknown as number,
    salaryBudgetMin: new FakeDecimal(1000000) as unknown as number,
    salaryBudgetMax: new FakeDecimal(1500000) as unknown as number,
    location: null, numberOfPositions: 1, status: 'OPEN', targetDate: null,
    commissionType: 'PERCENTAGE',
    commissionValue: new FakeDecimal(8.33) as unknown as number,
    notes: null, _count: { placements: 0 }, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeJobOrder> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    jobOrder: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeJobOrder({ id: 'jo-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeJobOrder({ ...existing, ...data }))
      ),
    },
    placement: { count: vi.fn().mockResolvedValue(0) },
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

describe('job-order.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createJobOrder returns all Decimal fields as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createJobOrder({
      clientId: 'cust-1', jobTitle: 'Senior Engineer', experienceMin: 3, experienceMax: 7,
      salaryBudgetMin: 1000000, salaryBudgetMax: 1500000, commissionType: 'PERCENTAGE', commissionValue: 8.33,
    })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    expect(typeof data.experienceMin).toBe('number')
    expect(typeof data.experienceMax).toBe('number')
    expect(typeof data.salaryBudgetMin).toBe('number')
    expect(typeof data.salaryBudgetMax).toBe('number')
    expect(typeof data.commissionValue).toBe('number')
  })

  it('listJobOrders returns commissionValue as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeJobOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listJobOrders({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ commissionValue: unknown }> }).data[0].commissionValue).toBe('number')
  })

  it('getJobOrder returns experienceMin as a plain number', async () => {
    const db = makeMockDb(makeJobOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getJobOrder('jo-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { experienceMin: unknown } }).data.experienceMin).toBe('number')
  })

  it('updateJobOrder returns salaryBudgetMax as a plain number', async () => {
    const db = makeMockDb(makeJobOrder())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateJobOrder({ id: 'jo-1', salaryBudgetMax: 1600000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { salaryBudgetMax: unknown } }).data.salaryBudgetMax).toBe('number')
  })

  it('getJobOrder handles null experienceMin/Max and salaryBudgetMin/Max without throwing', async () => {
    const db = makeMockDb(makeJobOrder({ experienceMin: null, experienceMax: null, salaryBudgetMin: null, salaryBudgetMax: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getJobOrder('jo-1')

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    expect(data.experienceMin).toBeNull()
    expect(data.experienceMax).toBeNull()
    expect(data.salaryBudgetMin).toBeNull()
    expect(data.salaryBudgetMax).toBeNull()
  })

  it('serializeJobOrder only converts fields actually present on the object (nested-select guard)', () => {
    // placement.service.ts's getPlacement nests a jobOrder select of only
    // {id, orderNumber, jobTitle, commissionType, commissionValue} — no
    // experienceMin/Max/salaryBudgetMin/Max. serializeJobOrder must not
    // inject spurious fields onto objects that never selected them.
    const nested = { id: 'jo-1', orderNumber: 'JO-00001', jobTitle: 'Senior Engineer', commissionType: 'PERCENTAGE', commissionValue: new FakeDecimal(8.33) as unknown as number }
    const result = serializeJobOrder(nested)
    expect(typeof result.commissionValue).toBe('number')
    expect('experienceMin' in result).toBe(false)
    expect('salaryBudgetMin' in result).toBe(false)
  })
})
