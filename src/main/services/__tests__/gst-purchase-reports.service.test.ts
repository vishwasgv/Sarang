import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../report.service', () => ({ reportService: { generateGSTR3BPreview: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { gstPurchaseReportsService } from '../gst-purchase-reports.service'

const d = (s: string) => new Date(`${s}T12:00:00`)
const supMH = { supplierName: 'Local', state: 'Maharashtra', taxNumber: '27ABCDE1234F1Z5' }
const supKA = { supplierName: 'Far', state: 'Karnataka', taxNumber: '29ABCDE1234F1Z5' }

function makeDb(bills: unknown[], notes: unknown[] = []) {
  return {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ state: 'Maharashtra', taxNumber: '27AAAAA0000A1Z5', currencyCode: 'INR' }) },
    bill: { findMany: vi.fn().mockResolvedValue(bills) },
    debitNote: { findMany: vi.fn().mockResolvedValue(notes) }
  }
}

describe('purchase GST register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('splits tax by head, subtracts debit notes and totals exactly', async () => {
    const db = makeDb(
      [
        { billNumber: 'B-1', billDate: d('2026-09-02'), gstType: 'CGST_SGST', taxAmount: 180, totalAmount: 1180, isReverseCharge: false, supplier: supMH, items: [{ taxRate: 18, taxAmount: 180 }] },
        { billNumber: 'B-2', billDate: d('2026-09-10'), gstType: 'GST', taxAmount: 90, totalAmount: 590, isReverseCharge: false, supplier: supKA, items: [{ taxRate: 18, taxAmount: 90 }] }
      ],
      [{ debitNoteNumber: 'DN-1', createdAt: d('2026-09-12'), gstType: 'IGST', taxAmount: 18, amount: 118, supplier: supKA, items: [] }]
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await gstPurchaseReportsService.generatePurchaseRegister({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(r.rows.map((x) => x.number)).toEqual(['B-1', 'B-2', 'DN-1'])
    expect(r.rows[0]).toMatchObject({ taxable: 1000, cgst: 90, sgst: 90, igst: 0 })
    expect(r.rows[1]).toMatchObject({ taxable: 500, igst: 90, cgst: 0 })
    expect(r.rows[2]).toMatchObject({ taxable: -100, igst: -18, total: -118 })
    expect(r.totals).toMatchObject({ taxable: 1400, tax: 252, igst: 72, cgst: 90, sgst: 90, total: 1652 })
    expect(r.byMonth).toEqual([{ month: '2026-09', taxable: 1400, tax: 252 }])
  })

  it('reverse-charge bill: total is already tax-exclusive and the tax is added on top', async () => {
    const db = makeDb([{ billNumber: 'B-3', billDate: d('2026-09-03'), gstType: 'IGST', taxAmount: 180, totalAmount: 1000, isReverseCharge: true, supplier: supKA, items: [] }])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await gstPurchaseReportsService.generatePurchaseRegister({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(r.rows[0]).toMatchObject({ taxable: 1000, igst: 180, total: 1180, reverseCharge: true })
  })
})

describe('purchase HSN summary', () => {
  it('groups by HSN and rate, splits heads, counts taxed lines with no HSN', async () => {
    const product = (hsn: string | null) => ({ hsnCode: hsn, productName: 'Item' })
    const db = makeDb([
      {
        gstType: 'CGST_SGST', isReverseCharge: false, supplier: supMH,
        items: [
          { taxRate: 18, taxAmount: 18, total: 118, quantity: 1, product: product('1001'), serviceDescription: null },
          { taxRate: 18, taxAmount: 36, total: 236, quantity: 2, product: product('1001'), serviceDescription: null },
          { taxRate: 5, taxAmount: 5, total: 105, quantity: 1, product: product(null), serviceDescription: null }
        ]
      }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await gstPurchaseReportsService.generatePurchaseHsnSummary({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    const row1001 = r.rows.find((x) => x.hsnCode === '1001')!
    expect(row1001).toMatchObject({ quantity: 3, taxable: 300, cgst: 27, sgst: 27, igst: 0, tax: 54 })
    expect(r.rows.find((x) => x.hsnCode === 'No HSN Code')).toMatchObject({ taxable: 100, tax: 5 })
    expect(r.missingHsnCount).toBe(1)
    expect(r.totals).toEqual({ taxable: 400, tax: 59 })
  })
})
