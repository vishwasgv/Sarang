import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { listCaseDisbursements, createCaseDisbursement, markDisbursementBilled, deleteCaseDisbursement } from '../case-disbursement.service'

// Phase 68 §9.1 — Lawyer item 5: court-fee/disbursement tracking.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeDisbursement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cd-1', caseId: 'case-1', description: 'Court filing fee', amount: new FakeDecimal(1500) as unknown as number,
    paidDate: new Date(), isBilledToClient: false, notes: null, createdAt: new Date(),
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    legalCase: { findUnique: vi.fn().mockResolvedValue({ id: 'case-1' }) },
    caseDisbursement: {
      findMany: vi.fn().mockResolvedValue([makeDisbursement()]),
      findUnique: vi.fn().mockResolvedValue(makeDisbursement()),
      create: vi.fn().mockResolvedValue(makeDisbursement()),
      update: vi.fn().mockResolvedValue(makeDisbursement({ isBilledToClient: true })),
      delete: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as Record<string, any>
}

beforeEach(() => vi.clearAllMocks())

describe('case-disbursement.service — createCaseDisbursement', () => {
  it('converts the Decimal amount to a plain number (Electron IPC cannot clone a Decimal)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCaseDisbursement({ caseId: 'case-1', description: 'Court fee', amount: 1500, paidDate: '2026-08-01' })

    expect(res.success).toBe(true)
    expect(typeof (res as any).data.amount).toBe('number')
    expect((res as any).data.amount).toBe(1500)
  })

  it('rejects a blank description', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCaseDisbursement({ caseId: 'case-1', description: '  ', amount: 1500, paidDate: '2026-08-01' })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('CD68-002')
  })

  it('rejects a zero or negative amount', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCaseDisbursement({ caseId: 'case-1', description: 'Court fee', amount: 0, paidDate: '2026-08-01' })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('CD68-003')
  })

  it('rejects a disbursement against a nonexistent case', async () => {
    const db = makeDb({ legalCase: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCaseDisbursement({ caseId: 'ghost', description: 'Court fee', amount: 1500, paidDate: '2026-08-01' })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('CD68-004')
  })

  it('parses paidDate at local midnight, not UTC midnight (this phase\'s established convention)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createCaseDisbursement({ caseId: 'case-1', description: 'Court fee', amount: 1500, paidDate: '2026-08-15' })

    const call = db.caseDisbursement.create.mock.calls[0][0] as { data: { paidDate: Date } }
    expect(call.data.paidDate).toEqual(new Date(2026, 7, 15))
  })
})

describe('case-disbursement.service — markDisbursementBilled / deleteCaseDisbursement', () => {
  it('returns not-found for a nonexistent disbursement', async () => {
    const db = makeDb({ caseDisbursement: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await markDisbursementBilled('ghost', true)

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('CD68-006')
  })

  it('flips isBilledToClient', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await markDisbursementBilled('cd-1', true)

    expect(res.success).toBe(true)
    expect(db.caseDisbursement.update).toHaveBeenCalledWith({ where: { id: 'cd-1' }, data: { isBilledToClient: true } })
  })

  it('deletes a real disbursement', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteCaseDisbursement('cd-1')

    expect(res.success).toBe(true)
    expect(db.caseDisbursement.delete).toHaveBeenCalledWith({ where: { id: 'cd-1' } })
  })
})

describe('case-disbursement.service — listCaseDisbursements', () => {
  it('converts every row\'s Decimal amount to a plain number', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listCaseDisbursements('case-1')

    expect(res.success).toBe(true)
    expect(typeof (res as any).data[0].amount).toBe('number')
  })
})
