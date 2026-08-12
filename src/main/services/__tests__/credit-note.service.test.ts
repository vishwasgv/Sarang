import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { creditNoteService } from '../credit-note.service'

interface CreditNoteRow {
  id: string
  creditNoteNumber: string
  customerId: string | null
  invoiceId: string | null
  reason: string
  amount: number
  notes: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const EXISTING: CreditNoteRow = {
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

function makeDb(existing: CreditNoteRow | null = EXISTING, invoiceRow: Record<string, unknown> | null = null) {
  const ledgerCreateCalls: unknown[] = []
  const invoiceUpdateCalls: unknown[] = []
  let settingRow: { settingKey: string; settingValue: string } | null = null
  // Mutable so sequential findUniqueOrThrow/update calls inside one
  // transaction (e.g. update()'s reverse-then-reapply) see prior writes,
  // matching real transaction-local read-your-own-writes semantics.
  let liveInvoice = invoiceRow ? { ...invoiceRow } : null
  const txClient = {
    creditNote: {
      // The real code fetches the row to mutate INSIDE the transaction now (fixes a
      // TOCTOU race the independent review caught), so the tx client — not just the
      // outer db — needs its own findUnique.
      findUnique: vi.fn().mockResolvedValue(existing),
      findFirst: vi.fn().mockResolvedValue(existing ? { creditNoteNumber: existing.creditNoteNumber } : null),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data, customer: null, invoice: null })),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'cn-new', customer: null, invoice: null })),
      delete: vi.fn().mockResolvedValue(existing)
    },
    invoice: {
      findUniqueOrThrow: vi.fn(async () => {
        if (!liveInvoice) throw new Error('invoice not found')
        return liveInvoice
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        invoiceUpdateCalls.push(data)
        liveInvoice = liveInvoice ? { ...liveInvoice, ...data } : null
        return liveInvoice
      })
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
    __invoiceUpdateCalls: invoiceUpdateCalls,
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

  // Section 5.4's own explicit required coverage: a pre-Phase-63 (no items)
  // record must keep using its own plain `amount` field untouched by the
  // new sum-of-lines logic — `computedAmount = lineRows ? sum(...) :
  // payload.amount!` in the real code falls back to the scalar exactly when
  // no items are given, same as every credit/debit note created before this
  // phase.
  it('uses the plain amount field untouched when no items are given (legacy shape)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.create({ customerId: 'cust-1', reason: 'Goodwill adjustment', amount: 750 }, 'user-1')

    expect(res.success).toBe(true)
    expect((res as { data: { amount: number } }).data.amount).toBe(750)
  })
})

// Phase 63 — Account-based line items. amount is always the computed sum of
// the lines, never trusted from a separately-sent scalar.
describe('creditNoteService.create — Phase 63 line items', () => {
  it('computes amount as the sum of line totals, ignoring any separately-sent amount', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.create({
      customerId: 'cust-1', reason: 'Return of goods', amount: 999999,
      items: [
        { productId: 'prod-1', quantity: 2, unitPrice: 100, taxRate: 18 },
        { serviceDescription: 'Restocking fee', quantity: 1, unitPrice: 50, taxRate: 0 }
      ]
    } as never, 'user-1')

    expect(res.success).toBe(true)
    // 2*100*1.18 + 1*50*1.0 = 236 + 50 = 286
    expect((res as { data: { amount: number } }).data.amount).toBeCloseTo(286)
    const createCall = db.__txClient.creditNote.create.mock.calls[0][0] as { data: { items: { create: Array<{ productId: string | null; serviceDescription: string | null }> } } }
    expect(createCall.data.items.create).toHaveLength(2)
    expect(createCall.data.items.create[0].productId).toBe('prod-1')
    expect(createCall.data.items.create[1].serviceDescription).toBe('Restocking fee')
  })

  it('posts the computed line-item sum to the customer ledger, not a stray amount', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await creditNoteService.create({
      customerId: 'cust-1', reason: 'Return of goods',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, taxRate: 0 }]
    } as never, 'user-1')

    expect(db.__ledgerCreateCalls[0]).toMatchObject({ creditAmount: 100, debitAmount: 0 })
  })
})

// Real bug found live (2026-07-28 core-commerce audit): a credit note linked
// to an invoice used to only ever touch the Customer Ledger, never the
// invoice's own balanceAmount/paymentStatus — generateOutstandingReport
// (which sums invoice.balanceAmount directly) kept showing the full original
// balance owed even after a credit note reduced what the customer actually
// owes. These tests guard the fix.
describe('creditNoteService.create — invoice balance reconciliation', () => {
  it('reduces the linked invoice balance by the credit note amount', async () => {
    const db = makeDb(EXISTING, { balanceAmount: 500, totalAmount: 500, paymentStatus: 'UNPAID', paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.create({ customerId: 'cust-1', invoiceId: 'inv-1', reason: 'Discount', amount: 200 }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__invoiceUpdateCalls).toContainEqual({ balanceAmount: 300, paymentStatus: 'UNPAID' })
  })

  it('caps the reduction at the invoice balance and marks it PAID when fully covered', async () => {
    const db = makeDb(EXISTING, { balanceAmount: 150, totalAmount: 500, paymentStatus: 'PARTIAL', paidAmount: 350 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.create({ customerId: 'cust-1', invoiceId: 'inv-1', reason: 'Goodwill', amount: 200 }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__invoiceUpdateCalls).toContainEqual({ balanceAmount: 0, paymentStatus: 'PAID' })
  })

  it('does not touch the invoice when it is already fully paid (balance already 0)', async () => {
    const db = makeDb(EXISTING, { balanceAmount: 0, totalAmount: 500, paymentStatus: 'PAID', paidAmount: 500 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.create({ customerId: 'cust-1', invoiceId: 'inv-1', reason: 'Goodwill', amount: 100 }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__invoiceUpdateCalls).toHaveLength(0)
  })
})

describe('creditNoteService.delete — invoice balance restoration', () => {
  it('restores the invoice balance by the voided credit note amount', async () => {
    const existingWithInvoice = { ...EXISTING, invoiceId: 'inv-1', amount: 200 }
    const db = makeDb(existingWithInvoice, { balanceAmount: 300, totalAmount: 500, paymentStatus: 'UNPAID', paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.delete('cn-1', 'user-1')

    expect(res.success).toBe(true)
    expect(db.__invoiceUpdateCalls).toContainEqual({ balanceAmount: 500, paymentStatus: 'UNPAID' })
  })

  it('caps the restored balance at the invoice total', async () => {
    const existingWithInvoice = { ...EXISTING, invoiceId: 'inv-1', amount: 400 }
    const db = makeDb(existingWithInvoice, { balanceAmount: 300, totalAmount: 500, paymentStatus: 'UNPAID', paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditNoteService.delete('cn-1', 'user-1')

    expect(res.success).toBe(true)
    expect(db.__invoiceUpdateCalls).toContainEqual({ balanceAmount: 500, paymentStatus: 'UNPAID' })
  })
})

describe('creditNoteService.update — invoice balance reconciliation', () => {
  it('nets the balance change correctly when only the amount changes on the same invoice', async () => {
    const existingWithInvoice = { ...EXISTING, invoiceId: 'inv-1', amount: 200 }
    const db = makeDb(existingWithInvoice, { balanceAmount: 300, totalAmount: 500, paymentStatus: 'UNPAID', paidAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Reverse old 200 (300 -> 500), then apply new 350 (500 -> 150): net -150 vs before.
    const res = await creditNoteService.update('cn-1', { amount: 350 }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__txClient.invoice.findUniqueOrThrow).toHaveBeenCalled()
    const finalCall = db.__invoiceUpdateCalls[db.__invoiceUpdateCalls.length - 1]
    expect(finalCall).toEqual({ balanceAmount: 150, paymentStatus: 'UNPAID' })
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
