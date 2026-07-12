import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { creditNoteService } from '../credit-note.service'

const EXISTING = {
  id: 'cn-1',
  creditNoteNumber: 'CN-00001',
  customerId: 'cust-1',
  invoiceId: null,
  reason: 'Original reason',
  amount: 500,
  notes: null,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date()
}

function makeDb(existing: typeof EXISTING | null = EXISTING) {
  const ledgerCreateCalls: unknown[] = []
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const txClient = {
    creditNote: {
      // The real code fetches the row to mutate INSIDE the transaction now (fixes a
      // TOCTOU race the independent review caught), so the tx client — not just the
      // outer db — needs its own findUnique.
      findUnique: vi.fn().mockResolvedValue(existing),
      findFirst: vi.fn().mockResolvedValue(existing ? { creditNoteNumber: existing.creditNoteNumber } : null),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data, customer: null, invoice: null })),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'cn-new', customer: null, invoice: null }))
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    },
    customerLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }),
      create: vi.fn().mockImplementation((args) => { ledgerCreateCalls.push(args.data); return Promise.resolve({ id: 'entry-x' }) })
    },
    customer: { update: vi.fn().mockResolvedValue({}) }
  }
  return {
    creditNote: { findUnique: vi.fn().mockResolvedValue(existing) },
    invoice: { findUnique: vi.fn().mockResolvedValue({ id: 'inv-1' }) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    __ledgerCreateCalls: ledgerCreateCalls,
    __txClient: txClient
  }
}

beforeEach(() => vi.clearAllMocks())

describe('creditNoteService.create', () => {
  it('generates the next number inside the same transaction as the insert (no pre-transaction read)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.create({ customerId: 'cust-1', reason: 'Damaged goods', amount: 250 }, 'user-1')

    expect(res.success).toBe(true)
    // Bootstrapped from the one legacy row EXISTING (CN-00001) -> next is CN-00002
    expect((res as { data: { creditNoteNumber: string } }).data.creditNoteNumber).toBe('CN-00002')
    expect(db.__txClient.setting.create).toHaveBeenCalledWith({
      data: { settingKey: 'credit_note_sequence', settingValue: '2', settingType: 'NUMBER' }
    })
  })

  it('starts at CN-00001 when there is no legacy data', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.create({ reason: 'Price correction', amount: 100 }, 'user-1')

    expect((res as { data: { creditNoteNumber: string } }).data.creditNoteNumber).toBe('CN-00001')
  })
})

describe('creditNoteService.update', () => {
  it('reverses the old ledger entry and applies a new one when the amount changes', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.update('cn-1', { amount: 800 }, 'user-1')

    expect(res.success).toBe(true)
    const calls = db.__ledgerCreateCalls as Array<{ referenceType: string; debitAmount: number; creditAmount: number; customerId: string }>
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ referenceType: 'CREDIT_NOTE_EDIT_REVERSAL', debitAmount: 500, creditAmount: 0, customerId: 'cust-1' })
    expect(calls[1]).toMatchObject({ referenceType: 'CREDIT_NOTE', debitAmount: 0, creditAmount: 800, customerId: 'cust-1' })
  })

  it('moves the ledger effect to the new customer when customerId changes', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await creditNoteService.update('cn-1', { customerId: 'cust-2' }, 'user-1')

    const calls = db.__ledgerCreateCalls as Array<{ referenceType: string; customerId: string }>
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ referenceType: 'CREDIT_NOTE_EDIT_REVERSAL', customerId: 'cust-1' })
    expect(calls[1]).toMatchObject({ referenceType: 'CREDIT_NOTE', customerId: 'cust-2' })
  })

  it('does not touch the ledger when only reason/notes change', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.update('cn-1', { reason: 'Updated reason', notes: 'extra detail' }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__ledgerCreateCalls).toHaveLength(0)
  })

  it('returns an error when the credit note does not exist', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.update('missing', { amount: 100 }, 'user-1')

    expect(res.success).toBe(false)
  })

  it('validates a provided invoiceId exists before saving', async () => {
    const db = makeDb()
    db.invoice.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.update('cn-1', { invoiceId: 'bad-invoice' }, 'user-1')

    expect(res.success).toBe(false)
  })
})
