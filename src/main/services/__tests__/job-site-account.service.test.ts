import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { createJobSiteAccount, listJobSiteAccounts, getJobSiteAccountBalance, updateJobSiteAccount, closeJobSiteAccount } from '../job-site-account.service'

function makeMockDb() {
  const db: Record<string, any> = {
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Sharma Contractors' }) },
    jobSiteAccount: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'jsa-1', ...data })),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: 'jsa-1', accountName: 'Site A', status: 'ACTIVE' }),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'jsa-1', ...data })),
    },
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { balanceAmount: 0 } }),
    },
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('job-site-account.service.createJobSiteAccount', () => {
  it('rejects an empty account name', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createJobSiteAccount({ accountName: '  ', contractorId: 'cust-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JSA-001')
  })

  it('rejects when the contractor customer does not exist', async () => {
    const db = makeMockDb()
    db.customer.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createJobSiteAccount({ accountName: 'Site A', contractorId: 'cust-missing' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JSA-002')
  })

  it('creates an account for a valid contractor', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createJobSiteAccount({ accountName: 'Sharma Residence — Wing B', contractorId: 'cust-1' })

    expect(res.success).toBe(true)
    expect(db.jobSiteAccount.create).toHaveBeenCalled()
  })
})

describe('job-site-account.service.getJobSiteAccountBalance', () => {
  it('sums totalBilled/totalOutstanding from ACTIVE tagged invoices', async () => {
    const db = makeMockDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { id: 'inv-1', invoiceNumber: 'INV-001', totalAmount: 1000, balanceAmount: 400, createdAt: new Date() },
      { id: 'inv-2', invoiceNumber: 'INV-002', totalAmount: 500, balanceAmount: 0, createdAt: new Date() },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getJobSiteAccountBalance('jsa-1')

    expect(res.success).toBe(true)
    const data = (res as { data: { totalBilled: number; totalOutstanding: number } }).data
    expect(data.totalBilled).toBe(1500)
    expect(data.totalOutstanding).toBe(400)
  })

  it('rejects a missing account', async () => {
    const db = makeMockDb()
    db.jobSiteAccount.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getJobSiteAccountBalance('jsa-missing')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JSA-002')
  })
})

describe('job-site-account.service.closeJobSiteAccount', () => {
  it('blocks closing an account with an outstanding balance', async () => {
    const db = makeMockDb()
    db.invoice.aggregate = vi.fn().mockResolvedValue({ _sum: { balanceAmount: 250 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeJobSiteAccount('jsa-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JSA-007')
    expect(db.jobSiteAccount.update).not.toHaveBeenCalled()
  })

  it('closes an account with zero outstanding balance', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeJobSiteAccount('jsa-1')

    expect(res.success).toBe(true)
    expect(db.jobSiteAccount.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'jsa-1' }, data: { status: 'CLOSED' } }))
  })
})

describe('job-site-account.service.updateJobSiteAccount / listJobSiteAccounts', () => {
  it('filters by contractorId and status', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listJobSiteAccounts({ contractorId: 'cust-1', status: 'ACTIVE' })

    expect(db.jobSiteAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { contractorId: 'cust-1', status: 'ACTIVE' },
    }))
  })

  it('rejects updating a missing account', async () => {
    const db = makeMockDb()
    db.jobSiteAccount.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateJobSiteAccount('jsa-missing', { accountName: 'New Name' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JSA-002')
  })
})
