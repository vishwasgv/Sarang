import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../settings.service', () => ({ getBusinessCurrencyDecimals: vi.fn().mockResolvedValue(2) }))
vi.mock('../transaction-lock.service', () => ({ assertNotLockedOrThrow: vi.fn().mockResolvedValue(undefined), assertNotLocked: vi.fn().mockResolvedValue(null) }))

import { getPrisma } from '../../database/db'
import { gstPaymentService, checkGstPaymentSplit } from '../gst-payment.service'

const account = (code: string) => ({ id: `coa-${code}`, accountCode: code, accountName: code, accountType: 'ASSET', isActive: true })

function makeDb(opts: { itcDebit?: number; itcCredit?: number } = {}) {
  const tx = {
    journalEntryLine: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: opts.itcDebit ?? 0, creditAmount: opts.itcCredit ?? 0 } }) },
    chartOfAccounts: { findUnique: vi.fn(async ({ where }: { where: { accountCode: string } }) => account(where.accountCode)) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }), findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    bankAccount: { update: vi.fn().mockResolvedValue({}) },
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  }
  return {
    ...tx,
    bankAccount: { findUnique: vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC' }), update: vi.fn() },
    journalEntry: { ...tx.journalEntry, findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    tx
  }
}

const base = { paymentDate: '2026-09-20', taxAmount: 1000, creditUsed: 400, cashPaid: 600 }

describe('gstPaymentService.record', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears tax payable by input credit and cash, in one balanced entry', async () => {
    const db = makeDb({ itcDebit: 500 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await gstPaymentService.record({ ...base, bankAccountId: 'bank-1', reference: 'CPIN123' } as never, 'u1')
    expect(res.success).toBe(true)
    const data = db.tx.journalEntry.create.mock.calls[0][0].data
    expect(data.sourceType).toBe('GST_PAYMENT')
    expect(data.narration).toContain('CPIN123')
    const lines = data.lines.create as Array<{ accountId: string; debitAmount: number; creditAmount: number; bankAccountId: string | null }>
    expect(lines.find((l) => l.accountId === 'coa-2100')).toMatchObject({ debitAmount: 1000, creditAmount: 0 })
    expect(lines.find((l) => l.accountId === 'coa-1300')).toMatchObject({ debitAmount: 0, creditAmount: 400 })
    expect(lines.find((l) => l.accountId === 'coa-1000')).toMatchObject({ debitAmount: 0, creditAmount: 600, bankAccountId: 'bank-1' })
    expect(lines.reduce((s, l) => s + l.debitAmount, 0)).toBe(lines.reduce((s, l) => s + l.creditAmount, 0))
  })

  it('paying wholly in cash posts no input-credit line', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await gstPaymentService.record({ ...base, creditUsed: 0, cashPaid: 1000 } as never)
    expect(res.success).toBe(true)
    const lines = db.tx.journalEntry.create.mock.calls[0][0].data.lines.create as Array<{ accountId: string }>
    expect(lines.map((l) => l.accountId).sort()).toEqual(['coa-1000', 'coa-2100'])
  })

  it('rejects when credit plus cash does not equal the tax settled', async () => {
    const db = makeDb({ itcDebit: 500 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await gstPaymentService.record({ ...base, cashPaid: 500 } as never)
    expect(res).toMatchObject({ success: false, error: { code: 'GSTPAY-001' } })
    expect(db.tx.journalEntry.create).not.toHaveBeenCalled()
  })

  it('rejects using more input credit than the ledger holds', async () => {
    const db = makeDb({ itcDebit: 300 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await gstPaymentService.record({ ...base } as never)
    expect(res).toMatchObject({ success: false, error: { code: 'GSTPAY-002' } })
    expect(db.tx.journalEntry.create).not.toHaveBeenCalled()
  })

  it('unknown bank account is refused', async () => {
    const db = makeDb({ itcDebit: 500 })
    db.bankAccount.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await gstPaymentService.record({ ...base, bankAccountId: 'nope' } as never)
    expect(res).toMatchObject({ success: false, error: { code: 'BANK-001' } })
  })
})

describe('checkGstPaymentSplit', () => {
  it('accepts exact splits in 0, 2 and 3 decimal currencies and rejects a one-unit gap', () => {
    for (const d of [0, 2, 3]) {
      expect(checkGstPaymentSplit(100, 40, 60, d)).toBeNull()
      expect(checkGstPaymentSplit(0.3, 0.1, 0.2, 3)).toBeNull()
    }
    expect(checkGstPaymentSplit(100, 40, 59, 0)).not.toBeNull()
  })
})

describe('gstPaymentService.void', () => {
  it('only voids GST payment entries', async () => {
    const db = makeDb()
    db.journalEntry.findUnique = vi.fn().mockResolvedValue({ sourceType: 'INVOICE' })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await gstPaymentService.void('je-9', 'wrong')
    expect(res).toMatchObject({ success: false, error: { code: 'GSTPAY-003' } })
  })
})
