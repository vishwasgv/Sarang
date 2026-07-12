import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { calculateCommission, listCommissionsByStaff, listAllCommissions } from '../staff-commission.service'

// Regression coverage for the Phase 27 re-audit finding: StaffCommission's
// serviceRevenue/commissionRate/commissionAmount/tipAmount are Prisma
// Decimal fields — Electron's IPC can't serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes
// one. Live-verified: the appointment-completion auto-trigger silently
// failed (DB row created, response never reached the renderer), and the
// "All Records" tab never loaded. A FakeDecimal test double (toString /
// valueOf only, like a real Decimal.js instance) proves serializeCommission
// actually converts every field to a plain number.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeCommission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comm-1', staffId: 'staff-1', appointmentId: 'apt-1',
    serviceRevenue: new FakeDecimal(1000) as unknown as number,
    commissionType: 'PERCENT',
    commissionRate: new FakeDecimal(10) as unknown as number,
    commissionAmount: new FakeDecimal(100) as unknown as number,
    tipAmount: new FakeDecimal(0) as unknown as number,
    period: '2026-07', isPaid: false, paidDate: null,
    createdAt: new Date(),
    staff: { id: 'staff-1', fullName: 'Test Staff', designation: 'Trainer' },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeCommission> | null = null) {
  const db: Record<string, any> = {
    staffCommission: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCommission({ id: 'comm-new', ...data }))
      ),
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
    },
    employee: { findUnique: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('staff-commission.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calculateCommission returns every Decimal field as a plain number on create', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await calculateCommission({ appointmentId: 'apt-1', staffId: 'staff-1', serviceRevenue: 1000, commissionType: 'PERCENT', commissionRate: 10 })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    expect(typeof data.serviceRevenue).toBe('number')
    expect(typeof data.commissionRate).toBe('number')
    expect(typeof data.commissionAmount).toBe('number')
    expect(typeof data.tipAmount).toBe('number')
  })

  it('calculateCommission returns plain numbers on the idempotent existing-record path too', async () => {
    const db = makeMockDb(makeCommission())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await calculateCommission({ appointmentId: 'apt-1', staffId: 'staff-1', serviceRevenue: 1000, commissionType: 'PERCENT', commissionRate: 10 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { commissionAmount: unknown } }).data.commissionAmount).toBe('number')
  })

  it('listCommissionsByStaff returns plain numbers, not Decimal instances', async () => {
    const db = makeMockDb(makeCommission())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listCommissionsByStaff('staff-1')

    expect(res.success).toBe(true)
    const data = (res as { data: Array<Record<string, unknown>> }).data
    expect(typeof data[0].serviceRevenue).toBe('number')
    expect(typeof data[0].commissionAmount).toBe('number')
  })

  it('listAllCommissions returns plain numbers, not Decimal instances', async () => {
    const db = makeMockDb(makeCommission())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listAllCommissions({})

    expect(res.success).toBe(true)
    const data = (res as { data: Array<Record<string, unknown>> }).data
    expect(typeof data[0].tipAmount).toBe('number')
    expect(typeof data[0].commissionRate).toBe('number')
  })
})
