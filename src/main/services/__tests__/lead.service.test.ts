import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listLeads, createLead, updateLead } from '../lead.service'

// Regression coverage for the Phase 30 re-audit finding: Lead.estimatedValue
// is a Prisma Decimal field, returned unserialized by listLeads/createLead/
// updateLead. Electron's IPC can't serialize a Decimal instance and throws
// "An object could not be cloned". Live-verified: creating a lead with a real
// estimatedValue crashed (row silently written to the DB anyway), and
// listLeads() then also crashed with that real row present — the Leads
// screen's pipeline view stayed stuck on "Loading…" forever. A FakeDecimal
// test double (toString/valueOf only, like a real Decimal.js instance)
// proves serializeLead actually converts the field to a plain number.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1', fullName: 'Ramesh Kumar', email: null, phone: null, companyName: null,
    source: 'REFERRAL', status: 'OPEN',
    estimatedValue: new FakeDecimal(50000) as unknown as number,
    assignedToId: null, convertedClientId: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeLead> | null = null) {
  const db: Record<string, any> = {
    lead: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeLead({ id: 'lead-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeLead({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('lead.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createLead returns estimatedValue as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createLead({ fullName: 'Ramesh Kumar', estimatedValue: 50000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { estimatedValue: unknown } }).data.estimatedValue).toBe('number')
  })

  it('createLead returns estimatedValue as null when unset, not a Decimal', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.lead.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeLead({ id: 'lead-new', ...data, estimatedValue: null }))
    )

    const res = await createLead({ fullName: 'Walk-in enquiry' })

    expect(res.success).toBe(true)
    expect((res as { data: { estimatedValue: unknown } }).data.estimatedValue).toBeNull()
  })

  it('listLeads returns estimatedValue as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeLead())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listLeads({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ estimatedValue: unknown }> }).data[0].estimatedValue).toBe('number')
  })

  it('updateLead returns estimatedValue as a plain number', async () => {
    const db = makeMockDb(makeLead())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLead({ id: 'lead-1', status: 'WON', estimatedValue: 75000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { estimatedValue: unknown } }).data.estimatedValue).toBe('number')
  })
})
