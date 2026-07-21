import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({ inventoryService: { adjustStock: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { updateKOTStatus, assignWaiter, mergeTableIntoInvoice, releaseTablesForInvoiceTx } from '../restaurant.service'

function makeKot(status: string) {
  return {
    id: 'kot-1', status, tableId: null,
    invoice: { items: [{ productId: 'prod-1', quantity: 2, product: {} }] }
  }
}

function makeMockDb(kotStatus: string) {
  const db: Record<string, any> = {
    kOT: {
      findUnique: vi.fn().mockResolvedValue(makeKot(kotStatus)),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'kot-1', ...data })
      ),
    },
    restaurantTable: { update: vi.fn() },
    recipe: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('restaurant.service.updateKOTStatus', () => {
  it('allows the normal forward transition PENDING -> IN_PROGRESS', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('PENDING') as never)
    const res = await updateKOTStatus('kot-1', 'IN_PROGRESS')
    expect(res.success).toBe(true)
  })

  it('rejects changing status of an already-DONE KOT — prevents double ingredient deduction', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('DONE') as never)
    const res = await updateKOTStatus('kot-1', 'CANCELLED')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-017')
    // Ingredient deduction must never even be attempted for a rejected transition
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })

  it('rejects re-marking a CANCELLED KOT as DONE — the DONE -> CANCELLED -> DONE double-deduction path', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('CANCELLED') as never)
    const res = await updateKOTStatus('kot-1', 'DONE')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-017')
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })

  it('is a no-op-safe idempotent call when re-setting the same terminal status', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('DONE') as never)
    const res = await updateKOTStatus('kot-1', 'DONE')
    // Same status -> same status is allowed through (status !== kot.status is false),
    // but must not re-deduct ingredients since kot.status === 'DONE' already.
    expect(res.success).toBe(true)
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })
})

describe('restaurant.service.assignWaiter', () => {
  it('assigns a waiter to a table', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'table-1', waiterId: 'emp-1', waiter: { id: 'emp-1', fullName: 'Ravi' } })
    vi.mocked(getPrisma).mockReturnValue({ restaurantTable: { update } } as never)

    const res = await assignWaiter('table-1', 'emp-1')

    expect(res.success).toBe(true)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { waiterId: 'emp-1' },
      include: { waiter: { select: { id: true, fullName: true } } },
    })
    expect((res as { data: { waiterId: string } }).data.waiterId).toBe('emp-1')
  })

  it('clears an assignment back to unassigned when waiterId is null', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'table-1', waiterId: null, waiter: null })
    vi.mocked(getPrisma).mockReturnValue({ restaurantTable: { update } } as never)

    const res = await assignWaiter('table-1', null)

    expect(res.success).toBe(true)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'table-1' },
      data: { waiterId: null },
      include: { waiter: { select: { id: true, fullName: true } } },
    })
    expect((res as { data: { waiterId: string | null } }).data.waiterId).toBeNull()
  })
})

describe('restaurant.service.releaseTablesForInvoiceTx', () => {
  it('clears currentInvoiceId and resets status to AVAILABLE for every table pointing at the invoice', async () => {
    const tx = { restaurantTable: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } }
    await releaseTablesForInvoiceTx(tx as never, 'inv-1')
    expect(tx.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { currentInvoiceId: 'inv-1' },
      data: { currentInvoiceId: null, status: 'AVAILABLE' }
    })
  })
})

describe('restaurant.service.mergeTableIntoInvoice', () => {
  function makeMergeDb(overrides: { invoice?: Record<string, unknown> | null; claimCount?: number } = {}) {
    const invoice = overrides.invoice === undefined ? { id: 'inv-1', status: 'ACTIVE', paymentStatus: 'UNPAID' } : overrides.invoice
    return {
      invoice: { findUnique: vi.fn().mockResolvedValue(invoice) },
      restaurantTable: {
        updateMany: vi.fn().mockResolvedValue({ count: overrides.claimCount ?? 1 }),
        findUnique: vi.fn().mockResolvedValue({ id: 'table-6', currentInvoiceId: 'inv-1', status: 'OCCUPIED' }),
      },
    }
  }

  it('merges a free table into a running, unpaid order', async () => {
    const db = makeMergeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(true)
    expect(db.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { id: 'table-6', currentInvoiceId: null },
      data: { currentInvoiceId: 'inv-1', status: 'OCCUPIED' }
    })
  })

  it('rejects merging into an invoice that no longer exists', async () => {
    const db = makeMergeDb({ invoice: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'missing')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-040')
  })

  it('rejects merging into an invoice that is not ACTIVE (e.g. already SPLIT or CANCELLED)', async () => {
    const db = makeMergeDb({ invoice: { id: 'inv-1', status: 'SPLIT', paymentStatus: 'PAID' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-041')
  })

  it('rejects merging into an invoice that is already fully paid', async () => {
    const db = makeMergeDb({ invoice: { id: 'inv-1', status: 'ACTIVE', paymentStatus: 'PAID' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-041')
  })

  it('rejects merging a table that is already part of another running order', async () => {
    const db = makeMergeDb({ claimCount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await mergeTableIntoInvoice('table-6', 'inv-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-042')
  })
})
