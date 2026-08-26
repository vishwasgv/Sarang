import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { createServiceContract, updateServiceContract, generateServiceContractInvoice, listServiceContracts } from '../service-contract.service'

// Phase 67 §9.1 — Service item 3: Recurring service contract, an AMC-like
// arrangement for repeat customers. Mirrors pest-contract.service.ts's own
// period-keyed lastInvoicedPeriod claim pattern.

function makeMockDb(contract: Record<string, unknown> | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    serviceContract: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(contract),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'sct-1', status: 'ACTIVE', lastInvoicedPeriod: null, ...data, customer: { id: 'cust-1', customerName: 'Test Customer' } })
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'sct-1', ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue({ id: 'prod-consulting' }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'prod-new', ...data })),
    },
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

beforeEach(() => vi.clearAllMocks())

describe('service-contract.service — createServiceContract', () => {
  it('creates a contract for a real customer with a positive value', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createServiceContract({ customerId: 'cust-1', serviceFrequency: 'MONTHLY', startDate: '2026-08-01', contractValue: 10000 })

    expect(res.success).toBe(true)
    expect(db.serviceContract.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'cust-1', contractValue: 10000, serviceFrequency: 'MONTHLY' }),
    }))
  })

  it('rejects a zero or negative contract value', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createServiceContract({ customerId: 'cust-1', startDate: '2026-08-01', contractValue: 0 })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SCT-002')
    expect(db.serviceContract.create).not.toHaveBeenCalled()
  })

  it('parses startDate at LOCAL midnight and endDate at LOCAL end-of-day (not raw UTC), so the contract covers the full calendar day on both ends in a positive-UTC-offset timezone', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createServiceContract({ customerId: 'cust-1', startDate: '2026-08-01', endDate: '2026-08-31', contractValue: 10000 })

    const data = db.serviceContract.create.mock.calls[0][0].data
    expect(data.startDate.getFullYear()).toBe(2026); expect(data.startDate.getMonth()).toBe(7); expect(data.startDate.getDate()).toBe(1)
    expect(data.startDate.getHours()).toBe(0)
    expect(data.endDate.getFullYear()).toBe(2026); expect(data.endDate.getMonth()).toBe(7); expect(data.endDate.getDate()).toBe(31)
    expect(data.endDate.getHours()).toBe(23); expect(data.endDate.getMinutes()).toBe(59)
  })
})

describe('service-contract.service — updateServiceContract', () => {
  it('updates status and endDate on an existing contract', async () => {
    const db = makeMockDb({ id: 'sct-1', status: 'ACTIVE', contractValue: 10000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateServiceContract({ id: 'sct-1', status: 'CANCELLED' })

    expect(res.success).toBe(true)
    expect(db.serviceContract.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sct-1' }, data: expect.objectContaining({ status: 'CANCELLED' }),
    }))
  })

  it('rejects updating to a zero or negative contract value', async () => {
    const db = makeMockDb({ id: 'sct-1', status: 'ACTIVE' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateServiceContract({ id: 'sct-1', contractValue: -100 })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SCT-002')
  })

  it('rejects updating a contract that does not exist', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateServiceContract({ id: 'ghost', status: 'CANCELLED' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SCT-001')
  })
})

describe('service-contract.service — generateServiceContractInvoice', () => {
  it('generates an invoice for the current period and claims lastInvoicedPeriod atomically', async () => {
    const db = makeMockDb({ id: 'sct-1', customerId: 'cust-1', contractValue: 10000, lastInvoicedPeriod: null, customer: { id: 'cust-1', customerName: 'Test Customer' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await generateServiceContractInvoice('sct-1', '2026-08')

    expect(res.success).toBe(true)
    expect(db.serviceContract.updateMany).toHaveBeenCalledWith({ where: { id: 'sct-1', lastInvoicedPeriod: null }, data: { lastInvoicedPeriod: '2026-08' } })
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ unitPrice: number }> }
    expect(call.items[0].unitPrice).toBe(10000)
  })

  it('rejects generating a second invoice for the same period', async () => {
    const db = makeMockDb({ id: 'sct-1', customerId: 'cust-1', contractValue: 10000, lastInvoicedPeriod: '2026-08', customer: { id: 'cust-1', customerName: 'Test Customer' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateServiceContractInvoice('sct-1', '2026-08')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('SCT-005')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('releases the claim if billing invoice creation fails', async () => {
    const db = makeMockDb({ id: 'sct-1', customerId: 'cust-1', contractValue: 10000, lastInvoicedPeriod: null, customer: { id: 'cust-1', customerName: 'Test Customer' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INVOC-001', message: 'boom' } } as never)

    const res = await generateServiceContractInvoice('sct-1', '2026-08')

    expect(res.success).toBe(false)
    expect(db.serviceContract.update).toHaveBeenCalledWith({ where: { id: 'sct-1' }, data: { lastInvoicedPeriod: null } })
  })
})

describe('service-contract.service — listServiceContracts', () => {
  it('filters by status and customerId', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listServiceContracts({ status: 'ACTIVE', customerId: 'cust-1' })

    expect(db.serviceContract.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', customerId: 'cust-1' },
    }))
  })
})
