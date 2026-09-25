import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { tdsReportService } from '../tds-report.service'
import { normalizeTdsSection } from '../../../shared/data/tds-sections'

const pay = (over: Record<string, unknown>) => ({
  paymentDate: new Date('2026-09-10T12:00:00'), referenceNumber: null, amount: 10000, tdsAmount: 1000, tdsSection: '194j',
  supplier: { supplierName: 'Acme', panNumber: 'ABCDE1234F' },
  bill: { billNumber: 'BILL-1', supplier: { supplierName: 'Acme', panNumber: 'ABCDE1234F' } },
  ...over
})

function makeDb(payments: unknown[], credit = 0, debit = 0) {
  return {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
    supplierPayment: { findMany: vi.fn().mockResolvedValue(payments) },
    journalEntryLine: { aggregate: vi.fn().mockResolvedValue({ _sum: { creditAmount: credit, debitAmount: debit } }) }
  }
}

describe('TDS deducted report', () => {
  it('groups by normalised section, computes the effective rate and the undeposited balance', async () => {
    const db = makeDb([
      pay({}),
      pay({ amount: 5000, tdsAmount: 500, tdsSection: '194J ', bill: { billNumber: 'BILL-2', supplier: { supplierName: 'Acme', panNumber: 'ABCDE1234F' } } }),
      pay({ amount: 20000, tdsAmount: 200, tdsSection: null, supplier: null, bill: { billNumber: 'BILL-3', supplier: { supplierName: 'NoPan Co', panNumber: null } } })
    ], 1700, 0)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await tdsReportService.generateTdsDeducted({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(r.bySection).toEqual([
      { section: '194J', count: 2, amountPaid: 15000, tdsDeducted: 1500 },
      { section: 'NOT GIVEN', count: 1, amountPaid: 20000, tdsDeducted: 200 }
    ])
    expect(r.rows[0].effectiveRatePercent).toBe(10)
    expect(r.rows[2].effectiveRatePercent).toBe(1)
    expect(r.totals).toEqual({ amountPaid: 35000, tdsDeducted: 1700 })
    expect(r.payableBalance).toBe(1700)
    expect(r.missingPanCount).toBe(1)
  })

  it('queries only live payments that actually deducted tax', async () => {
    const db = makeDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await tdsReportService.generateTdsDeducted({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    const where = db.supplierPayment.findMany.mock.calls[0][0].where
    expect(where.isReversed).toBe(false)
    expect(where.tdsAmount).toEqual({ gt: 0 })
  })
})

describe('normalizeTdsSection', () => {
  it('trims, upper-cases and marks blanks', () => {
    expect(normalizeTdsSection(' 194c ')).toBe('194C')
    expect(normalizeTdsSection('')).toBe('NOT GIVEN')
    expect(normalizeTdsSection(undefined)).toBe('NOT GIVEN')
  })
})
