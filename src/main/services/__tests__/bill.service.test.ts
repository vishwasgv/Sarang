import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../supplier-ledger.service', () => ({
  supplierLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) }
}))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'user-1' }) }))

import { getPrisma } from '../../database/db'
import { billService } from '../bill.service'
import { supplierLedgerService } from '../supplier-ledger.service'

const productItem = { productId: 'prod-1', quantity: 10, unitCost: 100, taxRate: 18, discountAmount: 0 }
const serviceItem = { serviceDescription: 'AMC — quarterly', quantity: 1, unitCost: 5000, taxRate: 18, discountAmount: 0 }

function makeSupplier(overrides: Record<string, unknown> = {}) {
  return { id: 'sup-1', supplierName: 'ACME', isActive: true, ...overrides }
}

function makeBill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bill-1', billNumber: 'BILL-00001', supplierId: 'sup-1',
    status: 'OPEN', totalAmount: 1180, paidAmount: 0, balanceAmount: 1180,
    notes: null, items: [], billDate: new Date(),
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  // tx === db: createBill/voidBill run their writes inside $transaction, so
  // the callback must see the same mocked rows the tests assert against.
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db = {
    // Phase 62 — Transaction Locking's assertNotLocked/assertNotLockedOrThrow
    // read this on every dated write; a null lockDate means "not locked."
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ lockDate: null }) },
    // Phase 62 — GL auto-posting: postBillJournalEntry resolves the system
    // Operating-Expenses/Accounts-Payable accounts and posts a JournalEntry;
    // voidBill reverses it via reverseEntryBySourceTx (journalEntry.findFirst).
    chartOfAccounts: {
      findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '6000', accountName: 'Operating Expenses', accountType: 'EXPENSE', isActive: true }),
    },
    journalEntry: {
      create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    supplier: { findUnique: vi.fn().mockResolvedValue(makeSupplier()) },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Widget', isActive: true }) },
    expenseCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'cat-1', categoryName: 'Maintenance' }) },
    purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1', supplierId: 'sup-1' }) },
    bill: {
      create: vi.fn().mockResolvedValue({ ...makeBill(), supplier: makeSupplier(), items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }] }),
      findUnique: vi.fn().mockResolvedValue(makeBill()),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0)
    },
    productCostHistory: { create: vi.fn().mockResolvedValue({}) },
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

beforeEach(() => vi.clearAllMocks())

describe('billService.createBill', () => {
  it('returns error for non-existent supplier', async () => {
    const db = makeDb()
    db.supplier.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'bad', items: [productItem], isReverseCharge: false })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SUP-001')
  })

  it('rejects billing an archived supplier', async () => {
    const db = makeDb()
    db.supplier.findUnique = vi.fn().mockResolvedValue(makeSupplier({ isActive: false }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'sup-1', items: [productItem], isReverseCharge: false })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SUP-004')
  })

  // Phase 65 — Reporting Tags / Cost & Profit Centres.
  it('passes costCentreId through to the created bill row and every posted GL line', async () => {
    const db = makeDb()
    db.bill.create = vi.fn().mockResolvedValue({ ...makeBill(), costCentreId: 'cc-branch-1', supplier: makeSupplier(), items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'sup-1', items: [productItem], isReverseCharge: false, costCentreId: 'cc-branch-1' })

    expect(res.success).toBe(true)
    const billCreateCall = vi.mocked(db.bill.create).mock.calls[0][0] as { data: { costCentreId: string | null } }
    expect(billCreateCall.data.costCentreId).toBe('cc-branch-1')
    const journalCreateCall = vi.mocked(db.journalEntry.create).mock.calls[0][0] as { data: { lines: { create: Array<{ costCentreId: string | null }> } } }
    expect(journalCreateCall.data.lines.create.every((l) => l.costCentreId === 'cc-branch-1')).toBe(true)
  })

  it('accepts a mixed product + free-text service line and posts a supplier ledger debit', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'sup-1', items: [productItem, serviceItem], isReverseCharge: false })

    expect(res.success).toBe(true)
    expect(db.bill.create).toHaveBeenCalled()
    const createArgs = db.bill.create.mock.calls[0][0]
    expect(createArgs.data.items.create).toHaveLength(2)
    expect(createArgs.data.items.create[1]).toEqual(expect.objectContaining({ productId: null, serviceDescription: 'AMC — quarterly' }))
    // 10*100*1.18 + 1*5000*1.18 = 1180 + 5900 = 7080
    expect(createArgs.data.totalAmount).toBe(7080)
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ debitAmount: 7080, creditAmount: 0, referenceType: 'BILL' }),
      expect.anything()
    )
  })

  it('posts a real balanced JournalEntry: Debit Operating Expenses, Credit Accounts Payable, for the full bill total', async () => {
    const db = makeDb()
    // The default bill.create fixture always returns a fixed totalAmount
    // (1180) regardless of payload — override it here so the GL posting
    // (which reads totalAmount off whatever bill.create resolves, same as
    // real Prisma would) is actually checked against this test's own
    // 7080 mixed product+service total, not a coincidentally-matching mock.
    db.bill.create = vi.fn().mockResolvedValue({ ...makeBill({ totalAmount: 7080 }), supplier: makeSupplier(), items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'sup-1', items: [productItem, serviceItem], isReverseCharge: false })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('BILL')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    expect(lines).toHaveLength(2)
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(7080)
    expect(totalCredit).toBe(7080)
  })

  // Phase 62 — Reverse Charge Mechanism. Under RCM the supplier's own
  // invoice carries no GST (the business self-assesses it directly to the
  // government), so what's actually payable to the supplier must exclude
  // tax, and the tax portion must post as its own liability rather than
  // being folded silently into Accounts Payable.
  it('under RCM, totalAmount (and what the supplier ledger/AP track) excludes tax entirely', async () => {
    const db = makeDb()
    // productItem: qty 10 * unitCost 100 = 1000 subtotal, 18% tax = 180, gross lineTotal 1180.
    // Under RCM the amount owed to the supplier is the tax-exclusive 1000, not 1180.
    db.bill.create = vi.fn().mockResolvedValue({ ...makeBill({ totalAmount: 1000, taxAmount: 180, isReverseCharge: true }), supplier: makeSupplier(), items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'sup-1', items: [productItem], isReverseCharge: true })

    expect(res.success).toBe(true)
    const createArgs = db.bill.create.mock.calls[0][0]
    expect(createArgs.data.totalAmount).toBe(1000) // tax-exclusive
    expect(createArgs.data.taxAmount).toBe(180) // still computed/stored, just not part of what's payable
    expect(createArgs.data.isReverseCharge).toBe(true)
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ debitAmount: 1000, creditAmount: 0 }),
      expect.anything()
    )
  })

  it('under RCM, posts a 3-line balanced JournalEntry: Debit Operating Expenses for the gross amount, Credit AP for the net (tax-exclusive) amount, Credit Tax Payable for the self-assessed tax', async () => {
    const db = makeDb({
      chartOfAccounts: {
        findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => {
          const byCode: Record<string, { id: string; accountCode: string; accountName: string; accountType: string; isActive: boolean }> = {
            '6000': { id: 'coa-expense', accountCode: '6000', accountName: 'Operating Expenses', accountType: 'EXPENSE', isActive: true },
            '2000': { id: 'coa-ap', accountCode: '2000', accountName: 'Accounts Payable', accountType: 'LIABILITY', isActive: true },
            '2100': { id: 'coa-tax', accountCode: '2100', accountName: 'Tax Payable', accountType: 'LIABILITY', isActive: true },
          }
          return byCode[where.accountCode] ?? null
        })
      }
    })
    db.bill.create = vi.fn().mockResolvedValue({ ...makeBill({ totalAmount: 1000, taxAmount: 180, isReverseCharge: true }), supplier: makeSupplier(), items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'sup-1', items: [productItem], isReverseCharge: true })

    expect(res.success).toBe(true)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    const lines = jeArgs.data.lines.create as Array<{ accountId: string; debitAmount: number; creditAmount: number }>
    expect(lines).toHaveLength(3)
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'coa-expense', debitAmount: 1180, creditAmount: 0 }), // 1000 + 180 gross
      expect.objectContaining({ accountId: 'coa-ap', debitAmount: 0, creditAmount: 1000 }),
      expect.objectContaining({ accountId: 'coa-tax', debitAmount: 0, creditAmount: 180 }),
    ]))
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it('writes a ProductCostHistory row for each product line, none for service lines', async () => {
    const db = makeDb()
    db.bill.create = vi.fn().mockResolvedValue({
      ...makeBill(),
      supplier: makeSupplier(),
      items: [
        { id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 },
        { id: 'bi-2', productId: null, unitCost: 5000, quantity: 1 }
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billService.createBill({ supplierId: 'sup-1', items: [productItem, serviceItem], isReverseCharge: false })

    expect(db.productCostHistory.create).toHaveBeenCalledTimes(1)
    expect(db.productCostHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', sourceType: 'BILL' })
    }))
  })

  // Phase 64 — landed cost, entered inline at creation, folds into the
  // ProductCostHistory unitCost without ever touching Inventory (Bill still
  // doesn't affect stock).
  it('folds an inline landed cost into each product line\'s ProductCostHistory unitCost and records a real LandedCostAllocation row', async () => {
    const db = makeDb({ landedCostAllocation: { create: vi.fn().mockResolvedValue({}) } })
    db.bill.create = vi.fn().mockResolvedValue({
      ...makeBill(),
      supplier: makeSupplier(),
      items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billService.createBill({
      supplierId: 'sup-1', items: [productItem], isReverseCharge: false,
      landedCosts: [{ costType: 'FREIGHT', amount: 200, allocationMethod: 'BY_VALUE' }]
    })

    // Single line -> gets the full 200 share -> 20/unit -> 100 + 20 = 120
    expect(db.productCostHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', unitCost: 120 })
    }))
    expect(db.landedCostAllocation.create).toHaveBeenCalledWith({
      data: { billId: 'bill-1', costType: 'FREIGHT', amount: 200, allocationMethod: 'BY_VALUE' }
    })
  })

  it('leaves ProductCostHistory unitCost unchanged when no landedCosts are passed (every pre-Phase-64 caller)', async () => {
    const db = makeDb({ landedCostAllocation: { create: vi.fn() } })
    db.bill.create = vi.fn().mockResolvedValue({
      ...makeBill(),
      supplier: makeSupplier(),
      items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billService.createBill({ supplierId: 'sup-1', items: [productItem], isReverseCharge: false })

    expect(db.productCostHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', unitCost: 100 })
    }))
    expect(db.landedCostAllocation.create).not.toHaveBeenCalled()
  })

  // Phase 61 Section 3.4 — explicit ask: "purchase-price-history
  // append-not-overwrite logic". ProductCostHistory has no unique
  // constraint on productId and every write is a plain create() (never an
  // update/upsert), so two Bills for the same product must each leave their
  // own row — proven directly here rather than just asserted from reading
  // the code, matching this project's "verify, don't assume" convention.
  it('appends a new ProductCostHistory row for the same product on a second Bill, never overwriting the first', async () => {
    const db = makeDb()
    db.bill.create = vi.fn()
      .mockResolvedValueOnce({ ...makeBill({ id: 'bill-1' }), supplier: makeSupplier(), items: [{ id: 'bi-1', productId: 'prod-1', unitCost: 100, quantity: 10 }] })
      .mockResolvedValueOnce({ ...makeBill({ id: 'bill-2' }), supplier: makeSupplier(), items: [{ id: 'bi-2', productId: 'prod-1', unitCost: 120, quantity: 5 }] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await billService.createBill({ supplierId: 'sup-1', items: [productItem], isReverseCharge: false })
    await billService.createBill({ supplierId: 'sup-1', items: [{ ...productItem, unitCost: 120, quantity: 5 }], isReverseCharge: false })

    expect(db.productCostHistory.create).toHaveBeenCalledTimes(2)
    expect(db.productCostHistory.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', unitCost: 100, sourceId: 'bill-1' })
    }))
    expect(db.productCostHistory.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', unitCost: 120, sourceId: 'bill-2' })
    }))
    // No update/upsert call of any kind against the history table — the
    // only way this test could fail on an accidental overwrite is if a
    // future change adds one, which the total call count above also guards.
    expect(db.productCostHistory.update).toBeUndefined()
  })

  it('rejects a PO belonging to a different supplier', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue({ id: 'po-1', supplierId: 'sup-OTHER' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.createBill({ supplierId: 'sup-1', purchaseOrderId: 'po-1', items: [productItem], isReverseCharge: false })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BILL-001')
  })
})

describe('billService.voidBill', () => {
  it('returns error for non-existent bill', async () => {
    const db = makeDb()
    db.bill.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.voidBill('bad', 'Entered in error')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BILL-002')
  })

  it('rejects voiding a bill that already has payments recorded', async () => {
    const db = makeDb()
    db.bill.findUnique = vi.fn().mockResolvedValue(makeBill({ paidAmount: 400, balanceAmount: 780 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.voidBill('bill-1', 'Entered in error')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BILL-004')
  })

  it('voids an unpaid bill and reverses its supplier ledger debit', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await billService.voidBill('bill-1', 'Duplicate entry')

    expect(res.success).toBe(true)
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ debitAmount: 0, creditAmount: 1180, referenceType: 'BILL_VOID' }),
      expect.anything()
    )
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'VOID', balanceAmount: 0 })
    }))
  })
})
