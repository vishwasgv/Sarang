import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({
  customerLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) }
}))
vi.mock('../billing.service', () => ({
  billingService: { createInvoice: vi.fn() }
}))

import { getPrisma } from '../../database/db'
import { createExchange } from '../exchange.service'
import { billingService } from '../billing.service'

const ORIGINAL_INVOICE_ID = 'inv-orig-1'
const RETURN_INVOICE_ID = 'ret-inv-1'
const OLD_VARIANT_ID = 'var-old'
const NEW_VARIANT_ID = 'var-new'

function makeVariants(overrides: Record<string, Record<string, unknown>> = {}): Record<string, Record<string, unknown>> {
  return {
    [OLD_VARIANT_ID]: { id: OLD_VARIANT_ID, stockQty: 3 },
    [NEW_VARIANT_ID]: {
      id: NEW_VARIANT_ID, productId: 'prod-1', size: 'L', color: 'Red',
      additionalPrice: 0, stockQty: 10, isActive: true,
      product: { id: 'prod-1', productName: 'Widget', sellingPrice: 130, taxRate: 18 }
    },
    ...overrides
  }
}

function makeMockDb(opts: { variants?: Record<string, Record<string, unknown>>; original?: Record<string, unknown> } = {}) {
  const variants = opts.variants ?? makeVariants()
  const original = {
    id: ORIGINAL_INVOICE_ID,
    invoiceNumber: 'INV-000001',
    invoiceType: 'RETAIL',
    status: 'ACTIVE',
    customerId: 'cust-1',
    customer: { id: 'cust-1' },
    items: [
      {
        id: 'item-1', productId: 'prod-1', quantity: 5, unitPrice: 100,
        discountAmount: 0, taxRate: 18, variantId: OLD_VARIANT_ID, variantInfo: 'M / Blue',
        product: { id: 'prod-1', productName: 'Widget', productType: 'STANDARD' }
      }
    ],
    ...opts.original
  }

  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    invoice: {
      findUnique: vi.fn().mockResolvedValue(original),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === ORIGINAL_INVOICE_ID) return { balanceAmount: 0, paymentStatus: 'PAID' }
        if (where.id === RETURN_INVOICE_ID) return { totalAmount: -590 }
        throw new Error(`Unexpected findUniqueOrThrow id: ${where.id}`)
      }),
      update: vi.fn(),
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
        if (where && 'originalInvoiceId' in where) return []
        return []
      }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: RETURN_INVOICE_ID, ...data })
      ),
    },
    inventoryMovement: { create: vi.fn() },
    inventory: { upsert: vi.fn() },
    productBatch: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    productVariant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => variants[where.id] ?? null),
      update: vi.fn(),
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    },
  }
  db.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(db))
  return db
}

const BASE_PAYLOAD = {
  originalInvoiceId: ORIGINAL_INVOICE_ID,
  oldProductId: 'prod-1',
  oldVariantId: OLD_VARIANT_ID,
  quantity: 5,
  newVariantId: NEW_VARIANT_ID,
  reason: 'Wrong size',
  paymentMethod: 'CASH' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('exchange.service.createExchange', () => {
  it('processes a full exchange: real RETURN leg + real new-sale leg, linked, with correct netAmountDue', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({
      success: true, data: { id: 'new-inv-1', invoiceNumber: 'INV-000123', totalAmount: 650 }
    } as never)

    const res = await createExchange(BASE_PAYLOAD)

    expect(res.success).toBe(true)
    expect(res.data).toEqual({
      returnInvoiceId: RETURN_INVOICE_ID,
      returnInvoiceNumber: 'RET-00001',
      newInvoiceId: 'new-inv-1',
      newInvoiceNumber: 'INV-000123',
      netAmountDue: 60, // 650 (new sale, tax-inclusive) - 590 (abs of return total)
    })

    // Real return invoice was created via the real createReturn() code path
    expect(db.invoice.create).toHaveBeenCalledTimes(1)
    const returnCreateCall = db.invoice.create.mock.calls[0][0]
    expect(returnCreateCall.data.invoiceType).toBe('RETURN')

    // New sale created via billingService.createInvoice, priced off the
    // replacement variant's OWN product price, not the old item's price
    expect(billingService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        paymentMethod: 'CASH',
        items: [expect.objectContaining({ productId: 'prod-1', quantity: 5, unitPrice: 130, taxRate: 18, variantId: NEW_VARIANT_ID, variantInfo: 'L / Red' })]
      }),
      undefined
    )

    // Linked back via exchangeReturnId
    expect(db.invoice.update).toHaveBeenCalledWith({ where: { id: 'new-inv-1' }, data: { exchangeReturnId: RETURN_INVOICE_ID } })
  })

  it('rejects when the replacement variant is the same as the original (EXC-004)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createExchange({ ...BASE_PAYLOAD, newVariantId: OLD_VARIANT_ID })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('EXC-004')
    expect(db.invoice.create).not.toHaveBeenCalled()
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects when the replacement variant is out of stock (EXC-006), before the return leg runs', async () => {
    const db = makeMockDb({ variants: makeVariants({ [NEW_VARIANT_ID]: { ...makeVariants()[NEW_VARIANT_ID], stockQty: 2 } }) })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createExchange(BASE_PAYLOAD) // quantity 5 > stock 2

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('EXC-006')
    // The courtesy pre-check must fire BEFORE the return leg commits —
    // a customer should never lose their old item over a size that was
    // never actually available.
    expect(db.invoice.create).not.toHaveBeenCalled()
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('propagates the return leg\'s own guard failure (e.g. product not on the original invoice) without calling the sale leg', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createExchange({ ...BASE_PAYLOAD, oldProductId: 'prod-does-not-exist' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RET-006')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('when the sale leg fails after the return already committed, says so explicitly rather than a bare sale error', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({
      success: false, error: { code: 'INV-002', message: 'Insufficient stock for product prod-1.' }
    } as never)

    const res = await createExchange(BASE_PAYLOAD)

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('EXC-009')
    expect(res.error?.message).toContain('RET-00001')
    expect(res.error?.message).toContain('Insufficient stock')
    // The return really did commit — this is the whole point of the message.
    expect(db.invoice.create).toHaveBeenCalledTimes(1)
  })

  it('computes a negative netAmountDue (refund direction) when the replacement is cheaper than the surrendered item', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({
      success: true, data: { id: 'new-inv-1', invoiceNumber: 'INV-000123', totalAmount: 400 }
    } as never)

    const res = await createExchange(BASE_PAYLOAD)

    expect(res.success).toBe(true)
    expect(res.data?.netAmountDue).toBeCloseTo(400 - 590, 2) // -190
  })
})
