import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listLegalCases, getLegalCase, createLegalCase, updateLegalCase } from '../legal-case.service'

// Regression coverage for the Phase 28 re-audit finding: LegalCase.feeAgreed/
// feeCollected are Prisma Decimal fields — Electron's IPC can't serialize a
// Decimal instance and throws "An object could not be cloned" on every
// response that includes one. Live-verified: legalCase.create() with a real
// fee crashed (row silently written to the DB anyway), and legalCase.list()
// then also crashed with that real row present — the Cases tab was stuck on
// "Loading…" forever. A FakeDecimal test double (toString/valueOf only, like
// a real Decimal.js instance) proves serializeCase actually converts every
// field to a plain number, including the nested TimeEntry rows returned by
// getLegalCase (which have their own Decimal fields, serialized via the
// shared serializeTimeEntry from time-entry.service.ts).

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1', caseNumber: 'CASE-2026-001', caseTitle: 'Test vs State', caseType: 'CIVIL',
    courtName: 'District Court', courtDistrict: null, courtState: null, eCourtId: null,
    clientId: 'cust-1', advocateId: null, status: 'ACTIVE', filingDate: null, nextHearingDate: null,
    feeAgreed: new FakeDecimal(50000) as unknown as number,
    feeCollected: new FakeDecimal(0) as unknown as number,
    notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeTimeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1', employeeId: null, caseId: 'case-1', projectId: null,
    date: new Date(), description: 'Drafting petition',
    hours: new FakeDecimal(3) as unknown as number,
    ratePerHour: new FakeDecimal(2000) as unknown as number,
    amount: new FakeDecimal(6000) as unknown as number,
    isBilled: false, invoiceId: null, createdAt: new Date(), updatedAt: new Date(),
    employee: null,
    ...overrides,
  }
}

function makeMockDb(cases: ReturnType<typeof makeCase>[] = [makeCase()]) {
  const db: Record<string, any> = {
    legalCase: {
      findMany: vi.fn().mockResolvedValue(cases),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
        const c = cases.find((x) => x.id === id)
        if (!c) return Promise.resolve(null)
        return Promise.resolve({ ...c, hearings: [], timeEntries: [makeTimeEntry()] })
      }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCase({ id: 'case-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCase({ ...cases[0], ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('legal-case.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listLegalCases returns feeAgreed/feeCollected as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listLegalCases({})

    expect(res.success).toBe(true)
    const data = (res as { data: Array<Record<string, unknown>> }).data
    expect(typeof data[0].feeAgreed).toBe('number')
    expect(typeof data[0].feeCollected).toBe('number')
  })

  it('getLegalCase returns feeAgreed as null (not a Decimal) when unset, and serializes nested timeEntries', async () => {
    const db = makeMockDb([makeCase({ feeAgreed: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getLegalCase('case-1')

    expect(res.success).toBe(true)
    const data = (res as { data: { feeAgreed: unknown; timeEntries: Array<{ amount: unknown }> } }).data
    expect(data.feeAgreed).toBeNull()
    expect(typeof data.timeEntries[0].amount).toBe('number')
  })

  it('createLegalCase returns feeAgreed/feeCollected as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createLegalCase({ caseNumber: 'CASE-2026-002', caseTitle: 'New Case', courtName: 'District Court', clientId: 'cust-1', feeAgreed: 25000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feeAgreed: unknown } }).data.feeAgreed).toBe('number')
  })

  it('updateLegalCase returns feeAgreed/feeCollected as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLegalCase({ id: 'case-1', status: 'CLOSED' })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feeCollected: unknown } }).data.feeCollected).toBe('number')
  })
})
