import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../cheque-book.service', () => ({ chequeBookService: { consumeNextChequeNumber: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { postDatedChequeService } from '../post-dated-cheque.service'
import { chequeBookService } from '../cheque-book.service'

function makePdc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pdc-1', bankAccountId: 'bank-1', chequeNumber: '000123', direction: 'RECEIVED',
    partyType: 'CUSTOMER', partyId: 'cust-1', amount: 5000, status: 'PENDING', remarks: null,
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    // Phase 62 — clearing a cheque posts a JournalEntryLine with
    // bankAccountId set, which journal-entry.service.ts's own
    // applyBankBalanceDeltas moves via bankAccount.update.
    bankAccount: { findUnique: vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC Current' }), update: vi.fn().mockResolvedValue({}) },
    postDatedCheque: {
      create: vi.fn().mockResolvedValue(makePdc()),
      findUnique: vi.fn().mockResolvedValue(makePdc()),
      update: vi.fn().mockResolvedValue(makePdc({ status: 'CLEARED' })),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }), findMany: vi.fn().mockResolvedValue([]) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
      updateMany: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
        if (!settingRow) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
    },
    ...overrides,
  }
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('postDatedChequeService.createPDC', () => {
  it('returns error for a non-existent bank account', async () => {
    const db = makeDb({ bankAccount: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.createPDC({ bankAccountId: 'ghost', chequeNumber: '1', direction: 'RECEIVED', dueDate: '2026-09-01', amount: 5000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BANK-001')
  })

  it('creates the cheque as PENDING, posting no JournalEntry yet', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.createPDC({ bankAccountId: 'bank-1', chequeNumber: '000123', direction: 'RECEIVED', dueDate: '2026-09-01', amount: 5000 })

    expect(res.success).toBe(true)
    expect(db.postDatedCheque.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }))
    expect(db.journalEntry.create).not.toHaveBeenCalled()
  })

  it('rejects when neither a cheque number nor useChequeBook is given', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.createPDC({ bankAccountId: 'bank-1', direction: 'ISSUED', dueDate: '2026-09-01', amount: 5000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CHQ-002')
  })

  it('useChequeBook auto-consumes the next number and stamps chequeBookId on the created row', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(chequeBookService.consumeNextChequeNumber).mockResolvedValue({ chequeBookId: 'book-1', chequeNumber: '100234' })

    const res = await postDatedChequeService.createPDC({ bankAccountId: 'bank-1', useChequeBook: true, direction: 'ISSUED', dueDate: '2026-09-01', amount: 5000 })

    expect(res.success).toBe(true)
    expect(chequeBookService.consumeNextChequeNumber).toHaveBeenCalledWith(db, 'bank-1')
    expect(db.postDatedCheque.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ chequeNumber: '100234', chequeBookId: 'book-1' })
    }))
  })

  it('useChequeBook is rejected on a RECEIVED cheque — the number belongs to the payer\'s own bank', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.createPDC({ bankAccountId: 'bank-1', useChequeBook: true, direction: 'RECEIVED', dueDate: '2026-09-01', amount: 5000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CHQ-005')
    expect(chequeBookService.consumeNextChequeNumber).not.toHaveBeenCalled()
  })

  it('useChequeBook fails with CHQ-001 when no active cheque book has numbers remaining', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(chequeBookService.consumeNextChequeNumber).mockResolvedValue(null)

    const res = await postDatedChequeService.createPDC({ bankAccountId: 'bank-1', useChequeBook: true, direction: 'ISSUED', dueDate: '2026-09-01', amount: 5000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CHQ-001')
    expect(db.postDatedCheque.create).not.toHaveBeenCalled()
  })
})

describe('postDatedChequeService.updateStatus', () => {
  it('rejects updating an already-CLEARED cheque', async () => {
    const db = makeDb({ postDatedCheque: { findUnique: vi.fn().mockResolvedValue(makePdc({ status: 'CLEARED' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.updateStatus({ id: 'pdc-1', status: 'BOUNCED' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PDC-002')
  })

  it('marking BOUNCED changes status without posting any JournalEntry', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.updateStatus({ id: 'pdc-1', status: 'BOUNCED', remarks: 'Insufficient funds' })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).not.toHaveBeenCalled()
  })

  it('clearing a RECEIVED cheque posts a real balanced JournalEntry: Debit Cash & Bank, Credit Accounts Receivable', async () => {
    const db = makeDb({ postDatedCheque: { findUnique: vi.fn().mockResolvedValue(makePdc({ direction: 'RECEIVED', amount: 5000 })), update: vi.fn().mockResolvedValue(makePdc({ status: 'CLEARED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.updateStatus({ id: 'pdc-1', status: 'CLEARED' })

    expect(res.success).toBe(true)
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('PDC_CLEARED')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number; bankAccountId: string | null }>
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ debitAmount: 5000, creditAmount: 0, bankAccountId: 'bank-1' }),
      expect.objectContaining({ debitAmount: 0, creditAmount: 5000, bankAccountId: null }),
    ]))
  })

  it('clearing an ISSUED cheque posts the reverse: Debit Accounts Payable, Credit Cash & Bank', async () => {
    const db = makeDb({ postDatedCheque: { findUnique: vi.fn().mockResolvedValue(makePdc({ direction: 'ISSUED', amount: 3000, partyType: 'SUPPLIER', partyId: 'sup-1' })), update: vi.fn().mockResolvedValue(makePdc({ status: 'CLEARED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await postDatedChequeService.updateStatus({ id: 'pdc-1', status: 'CLEARED' })

    expect(res.success).toBe(true)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number; bankAccountId: string | null }>
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ debitAmount: 3000, creditAmount: 0, bankAccountId: null }),
      expect.objectContaining({ debitAmount: 0, creditAmount: 3000, bankAccountId: 'bank-1' }),
    ]))
  })
})
