import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u1' }) }))

import { getPrisma } from '../../database/db'
import * as customerService from '../customer.service'

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cust-1', customerCode: 'CUS-00001', customerName: 'Ravi Enterprises',
    phone: '9876543210', email: 'ravi@example.com', address: '123 Main St',
    city: 'Mumbai', state: 'Maharashtra', country: 'IN',
    taxNumber: '27AABCR1234D1Z1', creditLimit: 50000, outstandingBalance: 0,
    isActive: true, notes: null,
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const base = {
    customer: {
      findUnique: vi.fn().mockResolvedValue(makeCustomer()),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([makeCustomer()]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(makeCustomer()),
      update: vi.fn().mockResolvedValue(makeCustomer())
    },
    invoice: { count: vi.fn().mockResolvedValue(0) },
    customerLedger: {
      findMany: vi.fn().mockResolvedValue([])
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    },
    ...overrides
  }
  const db = base as typeof base & { $transaction: ReturnType<typeof vi.fn> }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('customerService.getCustomer', () => {
  it('returns customer by id', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerService.getCustomer('cust-1')

    expect(result.success).toBe(true)
    expect((result.data as { customerName: string }).customerName).toBe('Ravi Enterprises')
  })

  it('returns error for non-existent customer', async () => {
    const db = makeDb()
    db.customer.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await customerService.getCustomer('ghost')

    expect(result.success).toBe(false)
  })
})

describe('customerService.createCustomer', () => {
  it('creates customer successfully with auto-generated code', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerService.createCustomer({
      customerName: 'New Customer', creditLimit: 0, taxExempt: false, phone: '9999999999'
    })

    expect(result.success).toBe(true)
  })

  it('rejects duplicate phone number with CUS-002', async () => {
    const db = makeDb()
    db.customer.findFirst = vi.fn().mockResolvedValue(makeCustomer())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await customerService.createCustomer({
      customerName: 'Duplicate Phone', creditLimit: 0, taxExempt: false, phone: '9876543210'
    })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('CUS-002')
  })

  it('allows customer creation without phone (phone uniqueness only applies when provided)', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerService.createCustomer({
      customerName: 'Walk-in Customer', creditLimit: 0, taxExempt: false
    })

    expect(result.success).toBe(true)
  })
})

describe('customerService.updateCustomer', () => {
  it('updates customer fields', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerService.updateCustomer({
      id: 'cust-1', customerName: 'Updated Name', creditLimit: 100000, taxExempt: false, country: 'IN'
    })

    expect(result.success).toBe(true)
    const db = vi.mocked(getPrisma)()
    expect(vi.mocked(db.customer.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust-1' } })
    )
  })

  it('returns error when customer not found', async () => {
    const db = makeDb()
    db.customer.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await customerService.updateCustomer({ id: 'ghost', customerName: 'Name', creditLimit: 0, taxExempt: false, country: 'IN' })

    expect(result.success).toBe(false)
  })
})

describe('customerService.archiveCustomer', () => {
  it('archives customer with no unpaid invoices', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerService.archiveCustomer('cust-1')

    expect(result.success).toBe(true)
    const db = vi.mocked(getPrisma)()
    expect(vi.mocked(db.customer.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
  })

  it('blocks archiving customer with unpaid invoices', async () => {
    const db = makeDb()
    db.invoice.count = vi.fn().mockResolvedValue(2)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await customerService.archiveCustomer('cust-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('CUS-003')
  })
})

describe('customerService.listCustomers', () => {
  it('returns paginated customer list', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerService.listCustomers({ page: 1, limit: 20 })

    expect(result.success).toBe(true)
    const data = result.data as { customers: unknown[]; total: number }
    expect(data.customers).toHaveLength(1)
  })

  it('applies search filter when provided', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    await customerService.listCustomers({ search: 'Ravi' })

    const db = vi.mocked(getPrisma)()
    const call = vi.mocked(db.customer.findMany).mock.calls[0][0] as {
      where?: { OR?: unknown[] }
    }
    expect(call.where?.OR).toBeDefined()
  })
})

describe('customerService.searchCustomers', () => {
  it('returns matching customers for a search term', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerService.searchCustomers('Ravi')

    expect(result.success).toBe(true)
  })
})
