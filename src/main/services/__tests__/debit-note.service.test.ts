import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { debitNoteService } from '../debit-note.service'

const EXISTING = {
  id: 'dn-1',
  debitNoteNumber: 'DN-00001',
  supplierId: 'sup-1',
  purchaseOrderId: null,
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
    debitNote: {
      // The real code fetches the row to mutate INSIDE the transaction now (fixes a
      // TOCTOU race the independent review caught), so the tx client — not just the
      // outer db — needs its own findUnique.
      findUnique: vi.fn().mockResolvedValue(existing),
      findFirst: vi.fn().mockResolvedValue(existing ? { debitNoteNumber: existing.debitNoteNumber } : null),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data, supplier: null, purchaseOrder: null })),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'dn-new', supplier: null, purchaseOrder: null }))
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    },
    supplierLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }),
      create: vi.fn().mockImplementation((args) => { ledgerCreateCalls.push(args.data); return Promise.resolve({ id: 'entry-x' }) })
    },
    supplier: { update: vi.fn().mockResolvedValue({}) }
  }
  return {
    debitNote: { findUnique: vi.fn().mockResolvedValue(existing) },
    purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1' }) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    __ledgerCreateCalls: ledgerCreateCalls,
    __txClient: txClient
  }
}

beforeEach(() => vi.clearAllMocks())

describe('debitNoteService.create', () => {
  it('generates the next number inside the same transaction as the insert (no pre-transaction read)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await debitNoteService.create({ supplierId: 'sup-1', reason: 'Returned goods', amount: 250 }, 'user-1')

    expect(res.success).toBe(true)
    // Bootstrapped from the one legacy row EXISTING (DN-00001) -> next is DN-00002
    expect((res as { data: { debitNoteNumber: string } }).data.debitNoteNumber).toBe('DN-00002')
    expect(db.__txClient.setting.create).toHaveBeenCalledWith({
      data: { settingKey: 'debit_note_sequence', settingValue: '2', settingType: 'NUMBER' }
    })
  })

  it('starts at DN-00001 when there is no legacy data', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await debitNoteService.create({ reason: 'Price correction', amount: 100 }, 'user-1')

    expect((res as { data: { debitNoteNumber: string } }).data.debitNoteNumber).toBe('DN-00001')
  })
})

describe('debitNoteService.update', () => {
  it('reverses the old ledger entry and applies a new one when the amount changes', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await debitNoteService.update('dn-1', { amount: 800 }, 'user-1')

    expect(res.success).toBe(true)
    const calls = db.__ledgerCreateCalls as Array<{ referenceType: string; debitAmount: number; creditAmount: number; supplierId: string }>
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ referenceType: 'DEBIT_NOTE_EDIT_REVERSAL', debitAmount: 0, creditAmount: 500, supplierId: 'sup-1' })
    expect(calls[1]).toMatchObject({ referenceType: 'DEBIT_NOTE', debitAmount: 800, creditAmount: 0, supplierId: 'sup-1' })
  })

  it('moves the ledger effect to the new supplier when supplierId changes', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await debitNoteService.update('dn-1', { supplierId: 'sup-2' }, 'user-1')

    const calls = db.__ledgerCreateCalls as Array<{ referenceType: string; supplierId: string }>
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({ referenceType: 'DEBIT_NOTE_EDIT_REVERSAL', supplierId: 'sup-1' })
    expect(calls[1]).toMatchObject({ referenceType: 'DEBIT_NOTE', supplierId: 'sup-2' })
  })

  it('does not touch the ledger when only reason/notes change', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await debitNoteService.update('dn-1', { reason: 'Updated reason', notes: 'extra detail' }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__ledgerCreateCalls).toHaveLength(0)
  })

  it('returns an error when the debit note does not exist', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await debitNoteService.update('missing', { amount: 100 }, 'user-1')

    expect(res.success).toBe(false)
  })

  it('validates a provided purchaseOrderId exists before saving', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await debitNoteService.update('dn-1', { purchaseOrderId: 'bad-po' }, 'user-1')

    expect(res.success).toBe(false)
  })
})
