import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/910000000000?text=x') }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listPestContracts, getPestContract, createPestContract, updatePestContract, generateContractInvoice } from '../pest-contract.service'

// Regression coverage for the Phase 33 re-audit finding: PestServiceContract.
// contractValue is a Prisma Decimal field, returned unserialized by every
// function below. Electron's IPC can't serialize a Decimal instance and
// throws "An object could not be cloned". getPestContract also nests
// `jobSheets[]` (its own Decimal field, jobAmount — a second crash
// surface), serialized via the shared helper from pest-job-sheet.service.ts
// so the fix stays in one place.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeJobSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pjs-1', jobNumber: 'PJS-00001', contractId: 'pct-1', clientId: 'cust-1',
    visitDate: new Date(), scheduledTime: null, technicianIds: '[]', pesticideUsed: null,
    areasServiced: '[]', treatmentType: 'SPRAY',
    jobAmount: new FakeDecimal(1500) as unknown as number,
    status: 'SCHEDULED', completedDate: null, followUpDate: null, clientSignature: false,
    invoiceId: null, notes: null,
    ...overrides,
  }
}

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pct-1', contractNumber: 'PCT-00001', clientId: 'cust-1', propertyAddress: 'Test Address',
    propertyType: 'RESIDENTIAL', pestTypes: '[]', serviceFrequency: 'QUARTERLY',
    startDate: new Date(), endDate: null,
    contractValue: new FakeDecimal(12000) as unknown as number,
    status: 'ACTIVE', assignedToId: null, notes: null, createdAt: new Date(), updatedAt: new Date(),
    client: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: null },
    assignedTo: null, _count: { jobSheets: 0 },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeContract> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    pestServiceContract: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeContract({ id: 'pct-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeContract({ ...existing, ...data }))
      ),
    },
    pestJobSheet: {
      count: vi.fn().mockResolvedValue(0),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-pest', hsnCode: '998534' }),
    },
    notificationQueue: { create: vi.fn().mockResolvedValue({}) },
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

describe('pest-contract.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPestContract returns contractValue as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPestContract({ clientId: 'cust-1', propertyAddress: 'Test Address', startDate: '2026-07-01', contractValue: 12000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { contractValue: unknown } }).data.contractValue).toBe('number')
  })

  it('listPestContracts returns contractValue as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeContract())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listPestContracts({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ contractValue: unknown }> }).data[0].contractValue).toBe('number')
  })

  it('getPestContract serializes both contractValue and nested jobSheets[].jobAmount', async () => {
    const db = makeMockDb(makeContract({ jobSheets: [makeJobSheet()] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getPestContract('pct-1')

    expect(res.success).toBe(true)
    const contract = (res as { data: { contractValue: unknown; jobSheets: Array<{ jobAmount: unknown }> } }).data
    expect(typeof contract.contractValue).toBe('number')
    expect(typeof contract.jobSheets[0].jobAmount).toBe('number')
  })

  it('updatePestContract returns contractValue as a plain number', async () => {
    const db = makeMockDb(makeContract())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestContract({ id: 'pct-1', contractValue: 15000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { contractValue: unknown } }).data.contractValue).toBe('number')
  })
})

describe('pest-contract.service — AMC renewal reminders (F.10)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPestContract with a far-future endDate queues both 30-day and 7-day renewal reminders', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const endDate = new Date(Date.now() + 60 * 86400000).toISOString()

    const res = await createPestContract({ clientId: 'cust-1', propertyAddress: 'Test Address', startDate: '2026-07-01', endDate, contractValue: 12000 })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).toHaveBeenCalledTimes(2)
    const types = db.notificationQueue.create.mock.calls.map((c: [{ data: { notificationType: string } }]) => c[0].data.notificationType)
    expect(types.sort()).toEqual(['CONTRACT_RENEWAL_30D', 'CONTRACT_RENEWAL_7D'])
  })

  it('createPestContract with no endDate schedules nothing', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPestContract({ clientId: 'cust-1', propertyAddress: 'Test Address', startDate: '2026-07-01', contractValue: 12000 })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).not.toHaveBeenCalled()
  })

  it('updatePestContract re-schedules reminders when endDate actually changes', async () => {
    const oldEndDate = new Date(Date.now() + 10 * 86400000)
    const db = makeMockDb(makeContract({ endDate: oldEndDate }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const newEndDate = new Date(Date.now() + 60 * 86400000).toISOString()

    const res = await updatePestContract({ id: 'pct-1', endDate: newEndDate })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).toHaveBeenCalled()
  })

  it('updatePestContract does not re-schedule when endDate is left unchanged', async () => {
    const endDate = new Date(Date.now() + 60 * 86400000)
    const db = makeMockDb(makeContract({ endDate }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePestContract({ id: 'pct-1', propertyAddress: 'New Address' })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).not.toHaveBeenCalled()
  })
})

// Fresh-audit fix (2026-07-12): PestServiceContract.contractValue was NEVER
// billed anywhere before this — only ad-hoc PestJobSheet visits invoiced.
// Same period-keyed ("YYYY-MM") claim pattern as retainer.service.ts/
// engagement.service.ts's generate-invoice functions.
describe('pest-contract.service — generateContractInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing contract', async () => {
    const db = makeMockDb(null)
    db.pestServiceContract.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateContractInvoice('pct-missing', '2026-07')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PCT-003')
  })

  it('rejects a contract already invoiced for the requested period', async () => {
    const db = makeMockDb(makeContract({ lastInvoicedPeriod: '2026-07' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateContractInvoice('pct-1', '2026-07')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PCT-004')
    expect(db.pestServiceContract.updateMany).not.toHaveBeenCalled()
  })

  it('allows invoicing the NEXT period after a prior period was already invoiced', async () => {
    const db = makeMockDb(makeContract({ lastInvoicedPeriod: '2026-06' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-july' } } as never)

    const res = await generateContractInvoice('pct-1', '2026-07')

    expect(res.success).toBe(true)
    expect(db.pestServiceContract.updateMany).toHaveBeenCalledWith({
      where: { id: 'pct-1', lastInvoicedPeriod: '2026-06' },
      data: { lastInvoicedPeriod: '2026-07' },
    })
  })

  it('rejects a contract with zero value', async () => {
    const db = makeMockDb(makeContract({ contractValue: 0, lastInvoicedPeriod: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateContractInvoice('pct-1', '2026-07')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PCT-005')
    expect(db.pestServiceContract.updateMany).not.toHaveBeenCalled()
  })

  it('generates an invoice using the pest control SAC 998534 product', async () => {
    const db = makeMockDb(makeContract({ lastInvoicedPeriod: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateContractInvoice('pct-1', '2026-07')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string; period: string } }).data).toEqual({ invoiceId: 'invoice-1', period: '2026-07' })
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ productId: 'product-pest', unitPrice: 12000 })],
    }))
  })

  it('rolls back lastInvoicedPeriod when billing fails', async () => {
    const db = makeMockDb(makeContract({ lastInvoicedPeriod: '2026-06' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateContractInvoice('pct-1', '2026-07')

    expect(res.success).toBe(false)
    expect(db.pestServiceContract.update).toHaveBeenCalledWith({ where: { id: 'pct-1' }, data: { lastInvoicedPeriod: '2026-06' } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeMockDb(makeContract({ lastInvoicedPeriod: null }))
    db.pestServiceContract.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateContractInvoice('pct-1', '2026-07')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PCT-004')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})
