import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))
vi.mock('../supplier-ledger.service', () => ({ supplierLedgerService: { addEntry: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { paymentService } from '../payment.service'
import { supplierPaymentService } from '../supplier-payment.service'
import { creditNoteService } from '../credit-note.service'
import { calculateCommission } from '../staff-commission.service'
import { amountToWords } from '../print.service'
import { roundCurrency, sumCurrency, moneyEpsilon, setActiveCurrencyDecimals, getActiveCurrencyDecimals } from '../currency.service'
import { resolveDisplayDecimals, getCurrencyDecimals } from '../../../shared/utils/money'

interface JournalLine { debitAmount: number; creditAmount: number }

function settingMock() {
  let row: { settingKey: string; settingValue: string } | null = null
  return {
    findUnique: vi.fn(async () => row),
    update: vi.fn(),
    create: vi.fn(async ({ data }: any) => { row = { settingKey: data.settingKey, settingValue: data.settingValue }; return row }),
    updateMany: vi.fn(async ({ data }: any) => { if (row) row = { ...row, settingValue: data.settingValue }; return { count: row ? 1 : 0 } })
  }
}

function glMocks() {
  const entries: Array<{ sourceType: string; lines: JournalLine[] }> = []
  return {
    entries,
    chartOfAccounts: {
      findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1000', accountName: 'Cash', accountType: 'ASSET', isActive: true }),
      findFirst: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '4200', accountName: 'FX', accountType: 'INCOME', isActive: true }),
      create: vi.fn().mockResolvedValue({ id: 'coa-2' })
    },
    journalEntry: {
      create: vi.fn(async ({ data }: any) => { entries.push({ sourceType: data.sourceType, lines: data.lines.create }); return { id: 'je-1', entryNumber: 'JE-1' } }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({})
    },
    setting: settingMock()
  }
}

function assertBalanced(entries: Array<{ lines: JournalLine[] }>, decimals: number) {
  expect(entries.length).toBeGreaterThan(0)
  for (const e of entries) {
    const d = sumCurrency(e.lines.map(l => l.debitAmount), decimals)
    const c = sumCurrency(e.lines.map(l => l.creditAmount), decimals)
    expect(d).toBe(c)
  }
}

function paymentDb(currencyCode: string, invoice: Record<string, unknown>) {
  const gl = glMocks()
  const db: Record<string, any> = {
    ...gl,
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode, lockDate: null }) },
    invoice: {
      findUnique: vi.fn().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-1', status: 'ACTIVE', paymentStatus: 'UNPAID', paidAmount: 0, customerId: null, ...invoice }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({})
    },
    payment: { create: vi.fn(async ({ data }: any) => ({ id: 'pmt-1', ...data })), findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    restaurantTable: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }
  }
  db.$transaction = vi.fn((arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(db) : Promise.all(arg as unknown[])))
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  setActiveCurrencyDecimals(2)
})

describe('currency service default precision follows the business currency', () => {
  it('rounds and sums to the active decimals when none is given', () => {
    setActiveCurrencyDecimals(3)
    expect(roundCurrency(12.3456)).toBe(12.346)
    expect(sumCurrency([0.1, 0.2, 0.0005])).toBe(0.301)
    expect(moneyEpsilon()).toBe(0.0005)
    setActiveCurrencyDecimals(0)
    expect(roundCurrency(1000.5)).toBe(1001)
    expect(getActiveCurrencyDecimals()).toBe(0)
    setActiveCurrencyDecimals(2)
    expect(roundCurrency(12.345)).toBe(12.35)
    expect(moneyEpsilon()).toBe(0.01)
  })
})

describe('customer payments in a 3-decimal currency (KWD)', () => {
  it('records a partial then a full payment to the fil and posts balanced journals', async () => {
    const db = paymentDb('KWD', { balanceAmount: 12.345, paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r1 = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 5.005, paymentMethod: 'CASH' })
    expect(r1.success).toBe(true)
    expect(db.invoice.update.mock.calls[0][0].data).toMatchObject({ paidAmount: 5.005, balanceAmount: 7.34, paymentStatus: 'PARTIAL' })

    const db2 = paymentDb('KWD', { balanceAmount: 12.345, paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db2 as never)
    const r2 = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 12.345, paymentMethod: 'CASH' })
    expect(r2.success).toBe(true)
    expect(db2.invoice.update.mock.calls[0][0].data).toMatchObject({ paidAmount: 12.345, balanceAmount: 0, paymentStatus: 'PAID' })
    assertBalanced(db2.entries, 3)
    expect(db2.entries[0].lines.map((l: JournalLine) => l.debitAmount + l.creditAmount)).toEqual([12.345, 12.345])
  })

  it('does not accept an overpayment of half a fil or call a 0.005 balance paid', async () => {
    const db = paymentDb('KWD', { balanceAmount: 12.345 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const over = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 12.35, paymentMethod: 'CASH' })
    expect(over.success).toBe(false)
    expect((over as { error: { code: string } }).error.code).toBe('PM-003')
    expect((over as { error: { message: string } }).error.message).toContain('12.350')

    const db2 = paymentDb('KWD', { balanceAmount: 12.345 })
    vi.mocked(getPrisma).mockReturnValue(db2 as never)
    const part = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 12.34, paymentMethod: 'CASH' })
    expect(part.success).toBe(true)
    expect(db2.invoice.update.mock.calls[0][0].data).toMatchObject({ balanceAmount: 0.005, paymentStatus: 'PARTIAL' })
  })

  it('split payment must equal the balance within half a unit of the smallest fraction, kept to 3 decimals', async () => {
    const db = paymentDb('KWD', { balanceAmount: 10.001 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const ok = await paymentService.recordSplitPayment({ invoiceId: 'inv-1', legs: [{ paymentMethod: 'CASH', amount: 4.001 }, { paymentMethod: 'UPI', amount: 6 }] } as never)
    expect(ok.success).toBe(true)
    expect(db.invoice.update.mock.calls[0][0].data).toMatchObject({ paidAmount: 10.001, balanceAmount: 0, paymentStatus: 'PAID' })
    assertBalanced(db.entries, 3)

    const db2 = paymentDb('KWD', { balanceAmount: 10.001 })
    vi.mocked(getPrisma).mockReturnValue(db2 as never)
    const bad = await paymentService.recordSplitPayment({ invoiceId: 'inv-1', legs: [{ paymentMethod: 'CASH', amount: 4 }, { paymentMethod: 'UPI', amount: 5.99 }] } as never)
    expect(bad.success).toBe(false)
  })

  it('foreign-currency settlement in KWD books the exchange difference to the fil in a balanced journal', async () => {
    const db = paymentDb('KWD', { balanceAmount: 30.75, paidAmount: 0, foreignCurrencyCode: 'USD', foreignExchangeRate: 0.3075 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await paymentService.recordForeignCurrencySettlement({ invoiceId: 'inv-1', foreignAmount: 100, settlementRate: 0.3078, paymentMethod: 'BANK' } as never)
    expect(r.success).toBe(true)
    // 100 x 0.3078 = 30.780 received against a 30.750 book value: gain of 0.030
    const fx = db.entries.find((e: { sourceType: string }) => e.sourceType === 'REALIZED_FX_GAIN_LOSS')
    expect(fx.lines.map((l: JournalLine) => l.debitAmount + l.creditAmount)).toEqual([0.03, 0.03])
    assertBalanced(db.entries, 3)
  })
})

describe('customer payments in a zero-decimal currency (JPY)', () => {
  it('keeps whole yen and does not treat a half-yen shortfall as settled', async () => {
    const db = paymentDb('JPY', { balanceAmount: 1500 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 600, paymentMethod: 'CASH' })
    expect(r.success).toBe(true)
    expect(db.invoice.update.mock.calls[0][0].data).toMatchObject({ paidAmount: 600, balanceAmount: 900, paymentStatus: 'PARTIAL' })
    assertBalanced(db.entries, 0)
    const over = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 1500.4, paymentMethod: 'CASH' })
    expect(over.success).toBe(false)
  })
})

describe('supplier payments in KWD', () => {
  it('pays to the fil, rejects a half-fil overpayment and posts a balanced journal', async () => {
    const gl = glMocks()
    const bill = { id: 'bill-1', billNumber: 'B-1', supplierId: 'sup-1', status: 'OPEN', paidAmount: 0, balanceAmount: 8.125, totalAmount: 8.125 }
    const db: Record<string, any> = {
      ...gl,
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'KWD', lockDate: null }) },
      bill: { findUnique: vi.fn().mockResolvedValue(bill), update: vi.fn() },
      supplierPayment: { create: vi.fn(async ({ data }: any) => ({ id: 'sp-1', ...data })) }
    }
    db.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(db))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const over = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 8.13, paymentMethod: 'CASH', tdsAmount: 0 } as never)
    expect(over.success).toBe(false)

    const ok = await supplierPaymentService.recordSupplierPayment({ billId: 'bill-1', amount: 8.125, paymentMethod: 'CASH', tdsAmount: 0 } as never)
    expect(ok.success).toBe(true)
    expect(db.bill.update.mock.calls[0][0].data).toMatchObject({ paidAmount: 8.125, balanceAmount: 0, status: 'PAID' })
    assertBalanced(db.entries, 3)
  })
})

describe('credit note against an invoice, balances stay exact', () => {
  it('reduces a KWD invoice balance by the note without float drift', async () => {
    let invoice = { balanceAmount: 0.3, paymentStatus: 'UNPAID' }
    const invoiceUpdates: Array<Record<string, unknown>> = []
    const tx = {
      creditNote: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }: any) => ({ id: 'cn-1', ...data, customer: null, invoice: null })),
        update: vi.fn()
      },
      invoice: {
        findUniqueOrThrow: vi.fn(async () => invoice),
        update: vi.fn(async ({ data }: any) => { invoiceUpdates.push(data); invoice = { ...invoice, ...data }; return invoice })
      },
      ...glMocks()
    }
    const db = {
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'KWD', state: null }) },
      invoice: { findUnique: vi.fn().mockResolvedValue({ id: 'inv-1', pricesIncludeTax: false, gstType: 'CGST_SGST' }) },
      customer: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx))
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await creditNoteService.create({ invoiceId: 'inv-1', reason: 'Damaged', amount: 0.1 } as never, 'user-1')
    expect(res.success).toBe(true)
    expect(invoiceUpdates[0].balanceAmount).toBe(0.2)
  })
})

describe('staff commission in KWD', () => {
  it('keeps the third decimal of a percentage commission', async () => {
    const db = {
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'KWD' }) },
      staffCommission: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(async ({ data }: any) => ({ id: 'sc-1', createdAt: new Date(), updatedAt: new Date(), ...data })) },
      employee: { findUnique: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn().mockResolvedValue({}) }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await calculateCommission({ appointmentId: 'a1', staffId: 's1', serviceRevenue: 12.345, commissionType: 'PERCENT', commissionRate: 15 })
    expect(db.staffCommission.create.mock.calls[0][0].data.commissionAmount).toBe(1.852)
  })
})

describe('amount in words and display decimals', () => {
  it('spells the fraction in the currency minor unit and never rounds up to 100/100', () => {
    expect(amountToWords(12.345, 'KWD', 3)).toBe('Twelve KWD and 345/1000 Only')
    expect(amountToWords(0.995, 'US Dollars', 2)).toBe('One US Dollars Only')
    expect(amountToWords(12.5, 'US Dollars', 2)).toBe('Twelve US Dollars and 50/100 Only')
    expect(amountToWords(1234, 'Japanese Yen', 0)).toBe('One Thousand Two Hundred Thirty Four Japanese Yen Only')
    expect(amountToWords(99.999, 'KWD', 3)).toBe('Ninety Nine KWD and 999/1000 Only')
  })

  it('never hides the third decimal of a 3-decimal currency or shows a subunit of a whole-unit one', () => {
    expect(resolveDisplayDecimals('KWD', '2')).toBe(3)
    expect(resolveDisplayDecimals('KWD', undefined)).toBe(3)
    expect(resolveDisplayDecimals('JPY', '2')).toBe(0)
    expect(resolveDisplayDecimals('INR', '2')).toBe(2)
    expect(resolveDisplayDecimals('INR', '0')).toBe(0)
    expect(resolveDisplayDecimals('USD', 'x')).toBe(getCurrencyDecimals('USD'))
  })
})
