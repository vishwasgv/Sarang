import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../supplier-ledger.service', () => ({ supplierLedgerService: { addEntry: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { supplierPaymentService } from '../supplier-payment.service'
import { supplierLedgerService } from '../supplier-ledger.service'

function baseBill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bill-1', billNumber: 'BILL-00001',
    supplierId: 'sup-1', status: 'OPEN',
    paidAmount: 0, balanceAmount: 1000, totalAmount: 1000,
    ...overrides,
  }
}

// Phase 62 — GL auto-posting's postSystemEntry generates a JE number via
// generateSequenceNumber, which needs a real Setting-row-backed mock — same
// in-memory-claim pattern bill.service.test.ts's own makeDb() established.
function makeSettingMock() {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  return {
    findUnique: vi.fn(async () => settingRow),
    update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
    create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
    updateMany: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
      if (!settingRow) return { count: 0 }
      settingRow = { ...settingRow, settingValue: data.settingValue }
      return { count: 1 }
    }),
  }
}

function makeGlMocks() {
  return {
    chartOfAccounts: {
      findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '2000', accountName: 'Accounts Payable', accountType: 'LIABILITY', isActive: true }),
    },
    journalEntry: {
      create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    setting: makeSettingMock(),
  }
}

function makeMockDb(billOverrides: Record<string, unknown> = {}) {
  // tx === db: recordSupplierPayment/reverseSupplierPayment look up the
  // bill/payment INSIDE the transaction (same TOCTOU-avoidance shape as
  // payment.service.ts), so the callback must see the same mocked rows.
  const db: Record<string, any> = {
    // Phase 62 — Transaction Locking's assertNotLockedOrThrow reads this
    // inside the same transaction; a null lockDate means "not locked."
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ lockDate: null }) },
    ...makeGlMocks(),
    bill: {
      findUnique: vi.fn().mockResolvedValue(baseBill(billOverrides)),
      update: vi.fn().mockResolvedValue({}),
    },
    supplierPayment: {
      create: vi.fn().mockResolvedValue({ id: 'spmt-1', amount: 1000 }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  }
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Phase 62 — TDS threshold/rate suggestion. Not called inside a
// transaction (plain read), so its own minimal db mock rather than
// makeMockDb()'s transaction-oriented setting simulator.
describe('supplierPaymentService.suggestTds', () => {
  it('suggests no TDS below the configured threshold', async () => {
    const db = { setting: { findMany: vi.fn().mockResolvedValue([
      { settingKey: 'tds_threshold_amount', settingValue: '30000' },
      { settingKey: 'tds_rate_percent', settingValue: '10' },
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.suggestTds(20000)

    expect(res.success).toBe(true)
    expect((res as { data: { applicable: boolean; suggestedAmount: number } }).data).toEqual(
      expect.objectContaining({ applicable: false, suggestedAmount: 0 })
    )
  })

  it('suggests amount × rate when at or above the configured threshold', async () => {
    const db = { setting: { findMany: vi.fn().mockResolvedValue([
      { settingKey: 'tds_threshold_amount', settingValue: '30000' },
      { settingKey: 'tds_rate_percent', settingValue: '10' },
    ]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.suggestTds(50000)

    expect(res.success).toBe(true)
    expect((res as { data: { applicable: boolean; suggestedAmount: number } }).data).toEqual(
      expect.objectContaining({ applicable: true, suggestedAmount: 5000 }) // 50000 * 10%
    )
  })

  it('falls back to sensible defaults (₹30,000 / 10%) when no Setting rows exist yet', async () => {
    const db = { setting: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.suggestTds(30000)

    expect(res.success).toBe(true)
    expect((res as { data: { thresholdAmount: number; ratePercent: number; applicable: boolean } }).data).toEqual(
      expect.objectContaining({ thresholdAmount: 30000, ratePercent: 10, applicable: true }) // exactly at threshold counts as applicable
    )
  })
})

describe('supplierPaymentService.recordSupplierPayment', () => {
  it('returns error for non-existent bill', async () => {
    const db = makeMockDb()
    db.bill.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.recordSupplierPayment({ billId: 'bad', amount: 100, paymentMethod: 'CASH' , tdsAmount: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BILL-002')
  })

  it('rejects payment on a void bill', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ status: 'VOID' }) as never)

    const res = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 100, paymentMethod: 'CASH' , tdsAmount: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-001')
  })

  it('rejects payment when bill already fully paid', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ balanceAmount: 0 }) as never)

    const res = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 100, paymentMethod: 'CASH' , tdsAmount: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-002')
  })

  it('rejects payment exceeding outstanding balance', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ balanceAmount: 200 }) as never)

    const res = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 500, paymentMethod: 'CASH' , tdsAmount: 0 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-003')
  })

  it('records a partial payment, moves bill to PARTIALLY_PAID, and credits the supplier ledger', async () => {
    const db = makeMockDb({ balanceAmount: 1000, paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 400, paymentMethod: 'BANK_TRANSFER' , tdsAmount: 0 })

    expect(res.success).toBe(true)
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paidAmount: 400, balanceAmount: 600, status: 'PARTIALLY_PAID' })
    }))
    // Credit = we owe less, mirroring customerLedgerService's credit-on-payment direction.
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ debitAmount: 0, creditAmount: 400, referenceType: 'BILL_PAYMENT' }),
      expect.anything()
    )
  })

  it('posts a real balanced JournalEntry with TDS split three ways: Debit Accounts Payable (full), Credit Cash (net) + Credit TDS Payable (withheld)', async () => {
    const db = makeMockDb({ balanceAmount: 1000, paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 1000, paymentMethod: 'BANK_TRANSFER', tdsAmount: 100 })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('SUPPLIER_PAYMENT')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    expect(lines).toHaveLength(3)
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ debitAmount: 1000, creditAmount: 0 }), // Accounts Payable, full settlement
      expect.objectContaining({ debitAmount: 0, creditAmount: 900 }),  // Cash & Bank, net of TDS
      expect.objectContaining({ debitAmount: 0, creditAmount: 100 }),  // TDS Payable, withheld
    ]))
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it('marks the bill PAID once the full balance is settled', async () => {
    const db = makeMockDb({ balanceAmount: 1000, paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 1000, paymentMethod: 'CASH' , tdsAmount: 0 })

    expect(res.success).toBe(true)
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ balanceAmount: 0, status: 'PAID' })
    }))
  })
})

describe('supplierPaymentService.recordBulkPayment', () => {
  function makeBulkDb(bills: Record<string, ReturnType<typeof baseBill>>) {
    let paymentCounter = 0
    const db: Record<string, any> = {
      // Phase 62 — Transaction Locking's assertNotLockedOrThrow reads this
      // inside the same transaction; a null lockDate means "not locked."
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ lockDate: null }) },
      ...makeGlMocks(),
      bill: {
        findUnique: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(bills[where.id] ?? null)),
        update: vi.fn().mockResolvedValue({}),
      },
      supplierPayment: {
        create: vi.fn((args: { data: Record<string, unknown> }) => {
          paymentCounter++
          return Promise.resolve({ id: `spmt-${paymentCounter}`, ...args.data })
        }),
      },
    }
    db.$transaction = vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
    )
    return db
  }

  it('splits one payment run across two open bills for the same supplier, atomically', async () => {
    const db = makeBulkDb({
      'bill-1': baseBill({ id: 'bill-1', billNumber: 'BILL-00001', balanceAmount: 1000 }),
      'bill-2': baseBill({ id: 'bill-2', billNumber: 'BILL-00002', balanceAmount: 500 })
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.recordBulkPayment({
      supplierId: 'sup-1', paymentMethod: 'BANK_TRANSFER',
      allocations: [{ billId: 'bill-1', amount: 1000 }, { billId: 'bill-2', amount: 300 }]
    })

    expect(res.success).toBe(true)
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bill-1' }, data: expect.objectContaining({ balanceAmount: 0, status: 'PAID' })
    }))
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bill-2' }, data: expect.objectContaining({ balanceAmount: 200, status: 'PARTIALLY_PAID' })
    }))
    expect(supplierLedgerService.addEntry).toHaveBeenCalledTimes(2)
  })

  it('rejects the whole batch if one bill belongs to a different supplier — nothing partially commits', async () => {
    const db = makeBulkDb({
      'bill-1': baseBill({ id: 'bill-1', supplierId: 'sup-1' }),
      'bill-2': baseBill({ id: 'bill-2', supplierId: 'sup-OTHER' })
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.recordBulkPayment({
      supplierId: 'sup-1', paymentMethod: 'CASH',
      allocations: [{ billId: 'bill-1', amount: 100 }, { billId: 'bill-2', amount: 100 }]
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-006')
  })

  it('rejects an allocation exceeding that specific bill\'s outstanding balance', async () => {
    const db = makeBulkDb({
      'bill-1': baseBill({ id: 'bill-1', balanceAmount: 100 })
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.recordBulkPayment({
      supplierId: 'sup-1', paymentMethod: 'CASH',
      allocations: [{ billId: 'bill-1', amount: 500 }, { billId: 'bill-nonexistent', amount: 10 }]
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-003')
  })
})

describe('supplierPaymentService.reverseSupplierPayment', () => {
  it('returns error for non-existent payment', async () => {
    const db = makeMockDb()
    db.supplierPayment.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.reverseSupplierPayment({ paymentId: 'bad', reason: 'Duplicate entry' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-004')
  })

  it('rejects reversing an already-reversed payment', async () => {
    const db = makeMockDb()
    db.supplierPayment.findUnique = vi.fn().mockResolvedValue({
      id: 'spmt-1', billId: 'bill-1', supplierId: 'sup-1', amount: 400, isReversed: true,
      bill: baseBill({ paidAmount: 400, balanceAmount: 600 })
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.reverseSupplierPayment({ paymentId: 'spmt-1', reason: 'Duplicate entry' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-005')
  })

  it('reverses a payment, restores the bill balance, and debits the supplier ledger', async () => {
    const db = makeMockDb()
    db.supplierPayment.findUnique = vi.fn().mockResolvedValue({
      id: 'spmt-1', billId: 'bill-1', supplierId: 'sup-1', amount: 400, isReversed: false,
      paymentDate: new Date(),
      bill: baseBill({ paidAmount: 400, balanceAmount: 600 })
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await supplierPaymentService.reverseSupplierPayment({ paymentId: 'spmt-1', reason: 'Duplicate entry' })

    expect(res.success).toBe(true)
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paidAmount: 0, balanceAmount: 1000, status: 'OPEN' })
    }))
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ debitAmount: 400, creditAmount: 0, referenceType: 'BILL_PAYMENT_REVERSAL' }),
      expect.anything()
    )
  })
})

// 2026-09 — foreign-currency bill settlement. A $500 bill raised at 83.25
// (totalAmount/balanceAmount = 41,625 base currency) is the fixture — the
// mirror image of payment.service.test.ts's own invoice fixture, but with
// the gain/loss direction flipped (paying LESS cash than book value is the
// gain here, not the loss) — see recordForeignCurrencyBillSettlement's own
// header comment in supplier-payment.service.ts.
describe('supplierPaymentService.recordForeignCurrencyBillSettlement', () => {
  function foreignBill(overrides: Record<string, unknown> = {}) {
    return baseBill({
      foreignCurrencyCode: 'USD', foreignExchangeRate: 83.25, foreignTotalAmount: 500,
      balanceAmount: 41625, paidAmount: 0, totalAmount: 41625,
      ...overrides,
    })
  }

  function makeFxMockDb(billOverrides: Record<string, unknown> = {}) {
    const db = makeMockDb(billOverrides)
    const accountsByCode: Record<string, { id: string; accountCode: string; accountName: string; accountType: string }> = {
      '1000': { id: 'coa-cash', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET' },
      '2000': { id: 'coa-ap', accountCode: '2000', accountName: 'Accounts Payable', accountType: 'LIABILITY' },
    }
    db.chartOfAccounts.findUnique = vi.fn(async ({ where }: { where: { accountCode: string } }) => accountsByCode[where.accountCode] ?? null)
    db.chartOfAccounts.create = vi.fn(async ({ data }: { data: { accountCode: string } }) => {
      const created = { id: `coa-${data.accountCode}`, ...data }
      accountsByCode[data.accountCode] = created as never
      return created
    })
    return db
  }

  it('rejects a bill that was not raised in a foreign currency', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeFxMockDb({ foreignCurrencyCode: null, foreignExchangeRate: null }) as never)

    const res = await supplierPaymentService.recordForeignCurrencyBillSettlement({ billId: 'bill-1', foreignAmount: 500, settlementRate: 84, paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SPM-008')
  })

  it('gain case: paying at a LOWER rate applies the actual (lower) cash amount and writes off the AP shortfall as a gain', async () => {
    const db = makeFxMockDb(foreignBill())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 500*82 = 41,000 — LESS cash needed than the bill's own 41,625 book value.
    const res = await supplierPaymentService.recordForeignCurrencyBillSettlement({ billId: 'bill-1', foreignAmount: 500, settlementRate: 82, paymentMethod: 'CASH' })

    expect(res.success).toBe(true)
    expect(db.supplierPayment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 41000, foreignAmount: 500, foreignExchangeRate: 82, foreignCurrencyCode: 'USD' })
    }))
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paidAmount: 41625, balanceAmount: 0, status: 'PAID' })
    }))
    const journalCalls = vi.mocked(db.journalEntry.create).mock.calls
    expect(journalCalls).toHaveLength(2)
    const fxCall = journalCalls.find((c: any) => c[0].data.sourceType === 'REALIZED_FX_GAIN_LOSS')
    expect(fxCall).toBeDefined()
    const fxLines = fxCall![0].data.lines.create as Array<{ accountId: string; debitAmount: number; creditAmount: number }>
    // 625 (41,625 - 41,000) written off as a gain: Dr AP / Cr FX-Gain — not touching Cash.
    expect(fxLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'coa-ap', debitAmount: 625, creditAmount: 0 }),
      expect.objectContaining({ accountId: 'coa-4200', debitAmount: 0, creditAmount: 625 }),
    ]))
  })

  it('loss case: paying at a HIGHER rate applies the bill balance as SupplierPayment.amount and posts the extra cash out as a loss', async () => {
    const db = makeFxMockDb(foreignBill())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 500*84 = 42,000 — MORE cash needed than the bill's own 41,625 book value.
    const res = await supplierPaymentService.recordForeignCurrencyBillSettlement({ billId: 'bill-1', foreignAmount: 500, settlementRate: 84, paymentMethod: 'CASH' })

    expect(res.success).toBe(true)
    expect(db.supplierPayment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 41625, foreignAmount: 500, foreignExchangeRate: 84 })
    }))
    expect(db.bill.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paidAmount: 41625, balanceAmount: 0, status: 'PAID' })
    }))
    const journalCalls = vi.mocked(db.journalEntry.create).mock.calls
    const fxCall = journalCalls.find((c: any) => c[0].data.sourceType === 'REALIZED_FX_GAIN_LOSS')
    expect(fxCall).toBeDefined()
    const fxLines = fxCall![0].data.lines.create as Array<{ accountId: string; debitAmount: number; creditAmount: number }>
    // 375 (42,000 - 41,625) extra cash paid out, a loss: Dr FX-Loss / Cr Cash.
    expect(fxLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'coa-4200', debitAmount: 375, creditAmount: 0 }),
      expect.objectContaining({ accountId: 'coa-cash', debitAmount: 0, creditAmount: 375 }),
    ]))
  })
})
