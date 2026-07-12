import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listServiceProjects, getServiceProject, createServiceProject, updateServiceProject } from '../service-project.service'

// Regression coverage for the Phase 30 re-audit finding: ServiceProject has
// THREE separate Decimal-crash surfaces in a single response —
// (1) its own totalContractValue, (2) nested milestones[].milestoneAmount
// (via `include: { milestones }`), and for getServiceProject only,
// (3) nested timeEntries[]'s own Decimal fields (hours/ratePerHour/amount).
// Electron's IPC can't serialize a Decimal instance and throws "An object
// could not be cloned" — live-verified: creating a project with a real
// totalContractValue crashed, and once a milestone or time entry existed on
// it, even a plain list/get call crashed too. A FakeDecimal test double
// (toString/valueOf only, like a real Decimal.js instance) proves
// serializeProject converts every one of these three surfaces to plain
// numbers, reusing serializeMilestone/serializeTimeEntry from their own
// services rather than duplicating the conversion logic.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeMilestone(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ms-1', projectId: 'proj-1', milestoneName: 'Design Phase',
    milestoneAmount: new FakeDecimal(25000) as unknown as number,
    dueDate: null, status: 'UPCOMING', notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeTimeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'te-1', employeeId: null, caseId: null, projectId: 'proj-1',
    date: new Date(), description: 'Site visit',
    hours: new FakeDecimal(4) as unknown as number,
    ratePerHour: new FakeDecimal(500) as unknown as number,
    amount: new FakeDecimal(2000) as unknown as number,
    isBilled: false, invoiceId: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1', clientId: 'cust-1', projectName: 'New Office Fitout',
    projectType: 'COMMERCIAL', stage: null, status: 'ACTIVE',
    totalContractValue: new FakeDecimal(500000) as unknown as number,
    startDate: null, expectedEndDate: null, completedDate: null,
    assignedToId: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    milestones: [makeMilestone()],
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeProject> | null = null) {
  const db: Record<string, any> = {
    serviceProject: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeProject({ id: 'proj-new', ...data, milestones: [] }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeProject({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('service-project.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createServiceProject returns totalContractValue as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createServiceProject({ clientId: 'cust-1', projectName: 'New Office Fitout', totalContractValue: 500000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { totalContractValue: unknown } }).data.totalContractValue).toBe('number')
  })

  it('createServiceProject returns totalContractValue as null when unset, not a Decimal', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.serviceProject.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeProject({ id: 'proj-new', ...data, totalContractValue: null, milestones: [] }))
    )

    const res = await createServiceProject({ clientId: 'cust-1', projectName: 'Retainer Only' })

    expect(res.success).toBe(true)
    expect((res as { data: { totalContractValue: unknown } }).data.totalContractValue).toBeNull()
  })

  it('listServiceProjects serializes both totalContractValue and nested milestones[].milestoneAmount', async () => {
    const db = makeMockDb(makeProject())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listServiceProjects()

    expect(res.success).toBe(true)
    const project = (res as { data: Array<{ totalContractValue: unknown; milestones: Array<{ milestoneAmount: unknown }> }> }).data[0]
    expect(typeof project.totalContractValue).toBe('number')
    expect(typeof project.milestones[0].milestoneAmount).toBe('number')
  })

  it('getServiceProject serializes totalContractValue, nested milestones[], and nested timeEntries[]', async () => {
    const db = makeMockDb(makeProject({ timeEntries: [makeTimeEntry()] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getServiceProject('proj-1')

    expect(res.success).toBe(true)
    const project = (res as {
      data: {
        totalContractValue: unknown
        milestones: Array<{ milestoneAmount: unknown }>
        timeEntries: Array<{ hours: unknown; ratePerHour: unknown; amount: unknown }>
      }
    }).data
    expect(typeof project.totalContractValue).toBe('number')
    expect(typeof project.milestones[0].milestoneAmount).toBe('number')
    expect(typeof project.timeEntries[0].hours).toBe('number')
    expect(typeof project.timeEntries[0].ratePerHour).toBe('number')
    expect(typeof project.timeEntries[0].amount).toBe('number')
  })

  it('updateServiceProject returns totalContractValue as a plain number', async () => {
    const db = makeMockDb(makeProject())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateServiceProject({ id: 'proj-1', totalContractValue: 600000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { totalContractValue: unknown } }).data.totalContractValue).toBe('number')
  })
})

describe('service-project.service — Marketing Agency campaign fields (F.13)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createServiceProject persists targetChannel/deliverableType/adSpendBudget and serializes adSpendBudget as a plain number', async () => {
    const db = makeMockDb()
    db.serviceProject.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeProject({ id: 'proj-new', ...data, adSpendBudget: new FakeDecimal(50000) as unknown as number, milestones: [] }))
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createServiceProject({
      clientId: 'cust-1', projectName: 'Diwali Campaign', projectType: 'MARKETING_CAMPAIGN',
      targetChannel: 'Meta Ads', deliverableType: 'Campaign Launch', adSpendBudget: 50000,
    })

    expect(res.success).toBe(true)
    const call = vi.mocked(db.serviceProject.create).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data).toMatchObject({ targetChannel: 'Meta Ads', deliverableType: 'Campaign Launch', adSpendBudget: 50000 })
    const data = (res as { data: { adSpendBudget: unknown } }).data
    expect(typeof data.adSpendBudget).toBe('number')
    expect(data.adSpendBudget).toBe(50000)
  })

  it('createServiceProject leaves the campaign fields null when omitted (every other vertical using this same form)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createServiceProject({ clientId: 'cust-1', projectName: 'Office Fitout' })

    const call = vi.mocked(db.serviceProject.create).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data).toMatchObject({ targetChannel: null, deliverableType: null, adSpendBudget: null })
  })

  it('updateServiceProject passes campaign fields through to the update call', async () => {
    const db = makeMockDb(makeProject())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateServiceProject({ id: 'proj-1', targetChannel: 'SEO', adSpendBudget: 15000 })

    const call = vi.mocked(db.serviceProject.update).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data).toMatchObject({ targetChannel: 'SEO', adSpendBudget: 15000 })
  })

  it('serializes adSpendBudget as null (not a Decimal) when absent from the row', async () => {
    const db = makeMockDb(makeProject({ adSpendBudget: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listServiceProjects()

    const project = (res as { data: Array<{ adSpendBudget: unknown }> }).data[0]
    expect(project.adSpendBudget).toBeNull()
  })
})
