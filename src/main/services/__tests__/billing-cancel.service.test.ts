import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({
  inventoryService: { reduceStockTx: vi.fn(), addStockTx: vi.fn() }
}))
vi.mock('../customer-ledger.service', () => ({
  customerLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined), calculateBalance: vi.fn().mockResolvedValue(300) }
}))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))
vi.mock('../notification.service', () => ({ createNotification: vi.fn() }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { customerLedgerService } from '../customer-ledger.service'

function makeCancelPayload(overrides: Record<string, unknown> = {}) {
  return { invoiceId: 'inv-1', reason: 'Customer request', ...overrides }
}

function makeActiveInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1', invoiceNumber: 'INV-2024-000001',
    status: 'ACTIVE', paymentStatus: 'PAID', paidAmount: 500, totalAmount: 500,
    customerId: 'cust-1', notes: null,
    items: [{ id: 'item-1', productId: 'prod-1', quantity: 2, lineTotal: 500, product: { productType: 'STANDARD' } }],
    payments: [{ id: 'pay-1', isReversed: false }],
    ...overrides
  }
}

// Transaction client mock shared across tests — tx === db, since cancelInvoice
// now looks up the invoice (and re-checks its status) INSIDE the transaction
// rather than against a pre-read snapshot, closing a double-cancel race.
let sharedTx: {
  invoice: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  inventory: { update: ReturnType<typeof vi.fn> }
  inventoryMovement: { create: ReturnType<typeof vi.fn> }
  customerLedger: { findMany: ReturnType<typeof vi.fn> }
  payment: { updateMany: ReturnType<typeof vi.fn> }
  productBatch: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  productSerial: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
}

function makeDb(invoiceOverride?: Record<string, unknown>) {
  sharedTx = {
    invoice: {
      findUnique: vi.fn().mockResolvedValue(makeActiveInvoice(invoiceOverride ?? {})),
      update: vi.fn().mockResolvedValue({})
    },
    inventory: { update: vi.fn().mockResolvedValue({ quantity: 52 }) },
    inventoryMovement: { create: vi.fn().mockResolvedValue({ id: 'mov-1' }) },
    customerLedger: { findMany: vi.fn().mockResolvedValue([]) },
    payment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    // Batch/serial restoration on cancel — no batches/sold-serials in these
    // fixtures, so these are no-ops (matching a plain, untracked product).
    productBatch: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    productSerial: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() }
  }

  const db = sharedTx as unknown as Record<string, any>
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(sharedTx))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('billingService.cancelInvoice', () => {
  it('marks the invoice as CANCELLED', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await billingService.cancelInvoice(makeCancelPayload())

    expect(result.success).toBe(true)
    expect(sharedTx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELLED' })
      })
    )
  })

  it('auto-reverses all non-reversed payments', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.cancelInvoice(makeCancelPayload())

    expect(sharedTx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: 'inv-1', isReversed: false },
        data: expect.objectContaining({ isReversed: true })
      })
    )
  })

  it('does not call payment.updateMany when no payments exist', async () => {
    const db = makeDb({ payments: [] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.cancelInvoice(makeCancelPayload())

    expect(sharedTx.payment.updateMany).not.toHaveBeenCalled()
  })

  it('restores inventory for STANDARD products', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.cancelInvoice(makeCancelPayload())

    expect(sharedTx.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'prod-1' },
        data: { quantity: { increment: 2 } }
      })
    )
  })

  it('creates RETURN inventory movement on cancellation', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.cancelInvoice(makeCancelPayload())

    expect(sharedTx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'RETURN',
          productId: 'prod-1',
          quantity: 2
        })
      })
    )
  })

  it('queries customerLedger to find entries to reverse', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.cancelInvoice(makeCancelPayload())

    expect(sharedTx.customerLedger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerId: 'cust-1' })
      })
    )
  })

  it('creates ledger reversal entries for each found ledger entry', async () => {
    const db = makeDb()
    sharedTx.customerLedger.findMany = vi.fn().mockResolvedValue([
      { referenceType: 'INVOICE', referenceId: 'inv-1', debitAmount: 500, creditAmount: 0 }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.cancelInvoice(makeCancelPayload())

    expect(customerLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        referenceType: 'INVOICE_CANCEL',
        debitAmount: 0,
        creditAmount: 500
      }),
      expect.anything()
    )
  })

  it('returns INVOC-005 for a non-existent invoice', async () => {
    const db = makeDb()
    db.invoice.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await billingService.cancelInvoice(makeCancelPayload({ invoiceId: 'ghost' }))

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('INVOC-005')
  })

  it('returns INVOC-006 when invoice is already cancelled', async () => {
    const db = makeDb({ status: 'CANCELLED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await billingService.cancelInvoice(makeCancelPayload())

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('INVOC-006')
  })

  it('reads the invoice inside the transaction (no double-cancel race)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billingService.cancelInvoice(makeCancelPayload())

    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrder = vi.mocked(sharedTx.invoice.findUnique).mock.invocationCallOrder[0]
    expect(txCallOrder).toBeLessThan(findCallOrder)
  })
})
