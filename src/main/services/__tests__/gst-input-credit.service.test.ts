import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../report.service', () => ({
  reportService: {
    generateGSTR3BPreview: vi.fn().mockResolvedValue({
      table31: { taxAmount: { igst: 100, cgst: 90, sgst: 90 } }
    })
  }
}))

import { getPrisma } from '../../database/db'
import { gstInputCreditService, splitTaxByHead } from '../gst-input-credit.service'

const d = (s: string) => new Date(`${s}T12:00:00`)

function line(code: '1300' | '2100', debit: number, credit: number, je: { id: string; sourceType: string; sourceId: string; date: string }) {
  return { debitAmount: debit, creditAmount: credit, account: { accountCode: code }, journalEntry: { id: je.id, sourceType: je.sourceType, sourceId: je.sourceId, entryDate: d(je.date) } }
}

function makeDb(opts: { lines: unknown[]; originals?: Array<{ id: string; sourceId: string }>; bills?: unknown[]; debitNotes?: unknown[]; gstScheme?: string }) {
  return {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ state: 'Maharashtra', taxNumber: null, currencyCode: 'INR', gstScheme: opts.gstScheme ?? 'REGULAR' }) },
    journalEntryLine: { findMany: vi.fn().mockResolvedValue(opts.lines) },
    journalEntry: { findMany: vi.fn().mockResolvedValue(opts.originals ?? []) },
    bill: { findMany: vi.fn().mockResolvedValue(opts.bills ?? []) },
    purchaseOrder: { findMany: vi.fn().mockResolvedValue([]) },
    debitNote: { findMany: vi.fn().mockResolvedValue(opts.debitNotes ?? []) }
  }
}

const supplierMH = { supplierName: 'Local Supplies', state: 'Maharashtra', taxNumber: null }
const supplierKA = { supplierName: 'Far Supplies', state: 'Karnataka', taxNumber: null }

describe('splitTaxByHead', () => {
  it('same-state combined GST splits into CGST and SGST that add back exactly', () => {
    const { heads } = splitTaxByHead({ amount: 181, gstType: 'GST', businessState: 'Maharashtra', partyState: 'Maharashtra', decimals: 2 })
    expect(heads.igst).toBe(0)
    expect(heads.cgst + heads.sgst).toBeCloseTo(181, 10)
  })
  it('other-state combined GST is IGST', () => {
    const { heads } = splitTaxByHead({ amount: 180, gstType: 'GST', businessState: 'Maharashtra', partyState: 'Karnataka', decimals: 2 })
    expect(heads).toEqual({ cgst: 0, sgst: 0, igst: 180, total: 180 })
  })
  it('keeps the sign of a debit-note style negative amount', () => {
    const { heads } = splitTaxByHead({ amount: -180, gstType: 'IGST', businessState: null, partyState: null, decimals: 2 })
    expect(heads.igst).toBe(-180)
  })
})

describe('gstInputCreditService.generateGstNetPayable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds input credit from bills by head and subtracts it from output tax', async () => {
    const db = makeDb({
      lines: [
        line('1300', 180, 0, { id: 'je1', sourceType: 'BILL', sourceId: 'b1', date: '2026-09-05' }),
        line('1300', 90, 0, { id: 'je2', sourceType: 'BILL', sourceId: 'b2', date: '2026-09-06' })
      ],
      bills: [
        { id: 'b1', billNumber: 'BILL-1', gstType: 'CGST_SGST', supplier: supplierMH, items: [{ taxRate: 18, taxAmount: 180 }], taxAmount: 180 },
        { id: 'b2', billNumber: 'BILL-2', gstType: 'IGST', supplier: supplierKA, items: [{ taxRate: 18, taxAmount: 90 }], taxAmount: 90 }
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const r = await gstInputCreditService.generateGstNetPayable({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })

    expect(r.inputCredit).toEqual({ cgst: 90, sgst: 90, igst: 90, total: 270 })
    expect(r.output.total).toBe(280)
    expect(r.netPayable).toEqual({ cgst: 0, sgst: 0, igst: 10, total: 10 })
    expect(r.creditCarriedForward).toBe(false)
    expect(r.rows.map((x) => x.documentNumber)).toEqual(['BILL-1', 'BILL-2'])
  })

  it('a voided bill nets to zero: its reversal is attributed to the same document', async () => {
    const db = makeDb({
      lines: [
        line('1300', 180, 0, { id: 'je1', sourceType: 'BILL', sourceId: 'b1', date: '2026-09-05' }),
        line('1300', 0, 180, { id: 'je9', sourceType: 'BILL', sourceId: 'je1', date: '2026-09-07' })
      ],
      originals: [{ id: 'je1', sourceId: 'b1' }],
      bills: [{ id: 'b1', billNumber: 'BILL-1', gstType: 'IGST', supplier: supplierKA, items: [], taxAmount: 180 }]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await gstInputCreditService.generateGstNetPayable({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(r.inputCredit.total).toBe(0)
    expect(r.rows).toHaveLength(0)
  })

  it('a debit note reduces the credit; reverse-charge tax is added to what is payable and claimed back', async () => {
    const db = makeDb({
      lines: [
        line('1300', 180, 0, { id: 'je1', sourceType: 'BILL', sourceId: 'b1', date: '2026-09-05' }),
        line('2100', 0, 180, { id: 'je1', sourceType: 'BILL', sourceId: 'b1', date: '2026-09-05' }),
        line('1300', 0, 18, { id: 'je2', sourceType: 'DEBIT_NOTE', sourceId: 'dn1', date: '2026-09-10' })
      ],
      bills: [{ id: 'b1', billNumber: 'BILL-1', gstType: 'IGST', supplier: supplierKA, items: [], taxAmount: 180 }],
      debitNotes: [{ id: 'dn1', debitNoteNumber: 'DN-1', gstType: 'IGST', supplier: supplierKA, items: [], taxAmount: 18 }]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await gstInputCreditService.generateGstNetPayable({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(r.inputCredit.igst).toBe(162)
    expect(r.reverseCharge.igst).toBe(180)
    expect(r.netPayable.total).toBe(280 + 180 - 162)
  })

  it('reports a credit carried forward when input exceeds output', async () => {
    const db = makeDb({
      lines: [line('1300', 1000, 0, { id: 'je1', sourceType: 'BILL', sourceId: 'b1', date: '2026-09-05' })],
      bills: [{ id: 'b1', billNumber: 'BILL-1', gstType: 'IGST', supplier: supplierKA, items: [], taxAmount: 1000 }]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await gstInputCreditService.generateGstNetPayable({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(r.netPayable.total).toBe(-720)
    expect(r.creditCarriedForward).toBe(true)
  })
})
