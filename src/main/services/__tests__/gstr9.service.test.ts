import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../report.service', () => ({
  reportService: {
    generateGSTR1: vi.fn().mockResolvedValue({
      b2b: [{ taxableValue: 1000, igstAmount: 0, cgstAmount: 90, sgstAmount: 90 }],
      b2cs: [{ taxableValue: 500, igstAmount: 90, cgstAmount: 0, sgstAmount: 0 }],
      cdnr: [{ taxableValue: -100, igstAmount: 0, cgstAmount: -9, sgstAmount: -9 }],
      nilExempt: [{ category: 'EXEMPT', taxableValue: 40 }, { category: 'NIL_RATED', taxableValue: 10 }, { category: 'OUT_OF_SCOPE', taxableValue: 5 }]
    }),
    generateHSNSummaryReport: vi.fn().mockResolvedValue({
      b2b: [{ hsnCode: '1001', description: 'Wheat', uqc: 'KGS', totalQuantity: 10, taxableValue: 1000, igstAmount: 0, cgstAmount: 90, sgstAmount: 90 }],
      b2c: []
    })
  }
}))
vi.mock('../gst-input-credit.service', () => ({
  gstInputCreditService: {
    generateGstNetPayable: vi.fn().mockResolvedValue({
      output: { cgst: 81, sgst: 81, igst: 90, total: 252 },
      reverseCharge: { cgst: 0, sgst: 0, igst: 50, total: 50 },
      inputCredit: { cgst: 30, sgst: 30, igst: 100, total: 160 }
    })
  }
}))
vi.mock('../gst-purchase-reports.service', () => ({
  gstPurchaseReportsService: { generatePurchaseHsnSummary: vi.fn().mockResolvedValue({ rows: [{ hsnCode: '2002', taxable: 300 }] }) }
}))
vi.mock('../gst-payment.service', () => ({
  gstPaymentService: {
    list: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { date: '2026-05-20', isReversed: false, creditUsed: 100, cashPaid: 50 },
        { date: '2026-06-20', isReversed: true, creditUsed: 999, cashPaid: 999 },
        { date: '2027-05-01', isReversed: false, creditUsed: 7, cashPaid: 7 }
      ]
    })
  }
}))

import { getPrisma } from '../../database/db'
import { gstr9Service } from '../gstr9.service'

describe('GSTR-9 working data', () => {
  it('lays a year out under the annual return tables', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) } } as never)
    const r = await gstr9Service.generateGstr9({ dateFrom: '2026-04-01', dateTo: '2027-03-31' })
    expect(r.table4.b2b).toEqual({ taxable: 1000, igst: 0, cgst: 90, sgst: 90 })
    expect(r.table4.total).toEqual({ taxable: 1400, igst: 90, cgst: 81, sgst: 81 })
    expect(r.table5).toEqual({ nilRated: 10, exempt: 40, nonGst: 5 })
    expect(r.table6.reverseCharge.igst).toBe(50)
    expect(r.table6.inputs.igst).toBe(50)
    expect(r.table6.total.total).toBe(160)
    expect(r.table9.payable.total).toBe(302)
    expect(r.table9).toMatchObject({ paidFromCredit: 100, paidInCash: 50 })
    expect(r.table17[0]).toMatchObject({ hsnCode: '1001', quantity: 10, taxable: 1000, tax: 180 })
    expect(r.table18).toHaveLength(1)
  })
})
