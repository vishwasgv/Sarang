import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'user-1' }) }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../license.service', () => ({ getLicenseState: vi.fn() }))

import { getPrisma } from '../../database/db'
import { salesOrderService } from '../sales-order.service'
import { isModuleEnabled } from '../industry-template.service'
import { getLicenseState } from '../license.service'
import { inventoryService } from '../inventory.service'
import { customerLedgerService } from '../customer-ledger.service'

const activeLicense = { status: 'ACTIVE' as const, tier: 'PAID' as const, region: 'IN' as const, daysSinceIssue: null, daysRemaining: null, machineMismatch: false }

function makeCustomer(overrides: Record<string, unknown> = {}) {
  return { id: 'cust-1', customerName: 'Ramesh Traders', isActive: true, creditLimit: 0, outstandingBalance: 0, ...overrides }
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return { id: 'prod-1', productName: 'Widget', sku: 'W-1', isActive: true, productType: 'STANDARD', ...overrides }
}

function makeSO(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1', soNumber: 'SO-00001', customerId: 'cust-1',
    status: 'CONFIRMED', subtotal: 1000, taxAmount: 180, totalAmount: 1180,
    notes: null,
    items: [
      { id: 'soi-1', salesOrderId: 'so-1', productId: 'prod-1', serviceDescription: null, quantity: 10, invoicedQty: 0, unitPrice: 100, taxRate: 18 }
    ],
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ lockDate: null, currencyCode: 'INR' }) },
    customer: { findUnique: vi.fn().mockResolvedValue(makeCustomer()) },
    product: { findUnique: vi.fn().mockResolvedValue(makeProduct()), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'misc-1', productType: 'SERVICE' }) },
    salesOrder: {
      create: vi.fn().mockResolvedValue({ ...makeSO(), status: 'DRAFT', customer: makeCustomer(), items: [] }),
      findUnique: vi.fn().mockResolvedValue(makeSO()),
      update: vi.fn().mockResolvedValue(makeSO({ status: 'CONFIRMED' })),
      findMany: vi.fn().mockResolvedValue([])
    },
    salesOrderItem: {
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([{ id: 'soi-1', quantity: 10, invoicedQty: 10 }])
    },
    invoice: { create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'inv-1', invoiceNumber: 'INV-00001', ...data })) },
    invoiceItem: { create: vi.fn().mockResolvedValue({}) },
    // Phase 63 gap-fix — createInvoiceFromSalesOrder now posts a real
    // JournalEntry via billing.service.ts's exported postInvoiceJournalEntry.
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }), findMany: vi.fn().mockResolvedValue([]) },
    // Phase 63 — multi-level approval workflows. Default: no active
    // workflow, matching the overwhelming majority of real installs — tests
    // that care about the approval path override these explicitly.
    approvalWorkflow: { findFirst: vi.fn().mockResolvedValue(null) },
    approvalInstance: { create: vi.fn().mockResolvedValue({ id: 'inst-1', status: 'PENDING' }), findFirst: vi.fn().mockResolvedValue(null) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
      updateMany: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
        if (!settingRow) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      })
    },
    ...overrides
  } as Record<string, any>
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getLicenseState).mockResolvedValue(activeLicense)
})

describe('salesOrderService.createSalesOrder', () => {
  it('returns error for a non-existent customer', async () => {
    const db = makeDb({ customer: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createSalesOrder({ customerId: 'ghost', items: [{ productId: 'prod-1', quantity: 10, unitPrice: 100, taxRate: 18 }] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CUST-001')
  })

  it('computes correct subtotal/tax for a mixed product+service order — 10×100×1.18 + 1×500×1.05 = 1705', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await salesOrderService.createSalesOrder({
      customerId: 'cust-1',
      items: [
        { productId: 'prod-1', quantity: 10, unitPrice: 100, taxRate: 18 },
        { serviceDescription: 'Installation', quantity: 1, unitPrice: 500, taxRate: 5 }
      ]
    })

    const createCall = vi.mocked(db.salesOrder.create).mock.calls[0][0] as { data: { subtotal: number; taxAmount: number; totalAmount: number } }
    expect(createCall.data.subtotal).toBeCloseTo(1500)
    expect(createCall.data.taxAmount).toBeCloseTo(205) // 180 + 25
    expect(createCall.data.totalAmount).toBeCloseTo(1705)
  })
})

describe('salesOrderService.confirmSalesOrder', () => {
  it('rejects confirming a non-DRAFT order', async () => {
    const db = makeDb({ salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'CONFIRMED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.confirmSalesOrder('so-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SO-002')
  })

  // Phase 63 — multi-level approval workflows, fully opt-in.
  it('goes straight to CONFIRMED when no active ApprovalWorkflow exists for SALES_ORDER', async () => {
    const db = makeDb({
      salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'DRAFT' })), update: vi.fn().mockResolvedValue(makeSO({ status: 'CONFIRMED' })) },
      approvalWorkflow: { findFirst: vi.fn().mockResolvedValue(null) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.confirmSalesOrder('so-1')

    expect(res.success).toBe(true)
    expect((res as any).data.status).toBe('CONFIRMED')
  })

  it('moves to PENDING_APPROVAL instead of CONFIRMED when the amount qualifies for an active workflow', async () => {
    const db = makeDb({
      approvalWorkflow: { findFirst: vi.fn().mockResolvedValue({ id: 'wf-1', documentType: 'SALES_ORDER', isActive: true, steps: [{ id: 'step-1', minAmountThreshold: 500 }] }) },
      salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'DRAFT', totalAmount: 1180 })), update: vi.fn().mockResolvedValue(makeSO({ status: 'PENDING_APPROVAL' })) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.confirmSalesOrder('so-1')

    expect(res.success).toBe(true)
    expect((res as any).data.status).toBe('PENDING_APPROVAL')
  })

  it('rejects confirming while still PENDING_APPROVAL and no step has approved yet', async () => {
    const db = makeDb({
      salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'PENDING_APPROVAL' })) },
      approvalInstance: { findFirst: vi.fn().mockResolvedValue({ id: 'inst-1', status: 'PENDING' }) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.confirmSalesOrder('so-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SO-010')
  })

  it('rejects confirming a Sales Order that was rejected during approval', async () => {
    const db = makeDb({
      salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'PENDING_APPROVAL' })) },
      approvalInstance: { findFirst: vi.fn().mockResolvedValue({ id: 'inst-1', status: 'REJECTED' }) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.confirmSalesOrder('so-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SO-011')
  })

  it('finishes DRAFT→CONFIRMED once the ApprovalInstance has reached APPROVED', async () => {
    const db = makeDb({
      salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'PENDING_APPROVAL' })), update: vi.fn().mockResolvedValue(makeSO({ status: 'CONFIRMED' })) },
      approvalInstance: { findFirst: vi.fn().mockResolvedValue({ id: 'inst-1', status: 'APPROVED' }) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.confirmSalesOrder('so-1')

    expect(res.success).toBe(true)
    expect((res as any).data.status).toBe('CONFIRMED')
  })
})

describe('salesOrderService.cancelSalesOrder', () => {
  it('blocks cancelling a fully INVOICED order', async () => {
    const db = makeDb({ salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'INVOICED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.cancelSalesOrder('so-1', 'customer changed mind')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SO-003')
  })

  it('allows cancelling a DRAFT order', async () => {
    const db = makeDb({ salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'DRAFT' })), update: vi.fn().mockResolvedValue(makeSO({ status: 'CANCELLED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.cancelSalesOrder('so-1', 'no longer needed')

    expect(res.success).toBe(true)
  })
})

describe('salesOrderService.createInvoiceFromSalesOrder', () => {
  it('blocks invoicing a DRAFT (unconfirmed) order', async () => {
    const db = makeDb({ salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ status: 'DRAFT' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 5 }] }, 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SO-005')
  })

  it('rejects invoicing more than the remaining quantity on a line', async () => {
    const db = makeDb({ salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ items: [{ id: 'soi-1', productId: 'prod-1', quantity: 10, invoicedQty: 7, unitPrice: 100, taxRate: 18, serviceDescription: null }] })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 5 }] }, 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SO-009')
  })

  it('a partial invoice moves status to PARTIALLY_INVOICED, not INVOICED', async () => {
    const db = makeDb({
      salesOrderItem: {
        update: vi.fn().mockResolvedValue({}),
        // After this partial invoice, one line still has remaining qty.
        findMany: vi.fn().mockResolvedValue([{ id: 'soi-1', quantity: 10, invoicedQty: 5 }])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 5 }] }, 'user-1')

    expect(res.success).toBe(true)
    const statusUpdateCall = vi.mocked(db.salesOrder.update).mock.calls.find((c: any) => c[0]?.data?.status)
    expect((statusUpdateCall![0] as any).data.status).toBe('PARTIALLY_INVOICED')
    expect(inventoryService.reduceStockTx).toHaveBeenCalledTimes(1)
  })

  it('invoicing the full remaining quantity moves status to INVOICED', async () => {
    const db = makeDb() // default: salesOrderItem.findMany already returns invoicedQty === quantity
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 10 }] }, 'user-1')

    expect(res.success).toBe(true)
    const statusUpdateCall = vi.mocked(db.salesOrder.update).mock.calls.find((c: any) => c[0]?.data?.status)
    expect((statusUpdateCall![0] as any).data.status).toBe('INVOICED')
  })

  it('a free-text service line resolves to the shared __MISC_ITEM__ product, not a nullable productId', async () => {
    const db = makeDb({
      salesOrder: { findUnique: vi.fn().mockResolvedValue(makeSO({ items: [{ id: 'soi-2', productId: null, serviceDescription: 'Consulting', quantity: 1, invoicedQty: 0, unitPrice: 2000, taxRate: 18 }] })), update: vi.fn().mockResolvedValue({}) },
      salesOrderItem: { update: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([{ id: 'soi-2', quantity: 1, invoicedQty: 1 }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-2', quantity: 1 }] }, 'user-1')

    expect(res.success).toBe(true)
    const itemCreateCall = vi.mocked(db.invoiceItem.create).mock.calls[0][0] as { data: { productId: string } }
    expect(itemCreateCall.data.productId).toBe('misc-1')
    expect(inventoryService.reduceStockTx).not.toHaveBeenCalled() // service line never touches stock
  })

  it('blocks a sale that would exceed the customer credit limit when the module is on', async () => {
    vi.mocked(isModuleEnabled).mockResolvedValue(true)
    const db = makeDb({ customer: { findUnique: vi.fn().mockResolvedValue(makeCustomer({ creditLimit: 1000, outstandingBalance: 900 })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 10 }] }, 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CUST-003')
  })

  it('is blocked once the license has expired, same as every other invoice-creating path', async () => {
    vi.mocked(getLicenseState).mockResolvedValue({ ...activeLicense, status: 'EXPIRED' })
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 10 }] }, 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LIC-002')
  })

  it('posts a real CustomerLedger debit for the invoiced amount', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await salesOrderService.createInvoiceFromSalesOrder({ salesOrderId: 'so-1', lines: [{ salesOrderItemId: 'soi-1', quantity: 10 }] }, 'user-1')

    expect(customerLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-1', debitAmount: 1180, creditAmount: 0 }),
      db
    )
  })
})
