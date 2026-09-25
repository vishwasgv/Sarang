import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney, roundMoney, prorateAmount } from '../../shared/utils/money'
import { normalizeTdsSection } from '../../shared/data/tds-sections'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate } from '../utils/date.util'

// TDS deducted from supplier payments, laid out the way a quarterly return is prepared: one row per payment
// with the payee's PAN, the section, the amount paid and the tax deducted, plus totals by section and the
// balance still held in TDS Payable (deducted but not yet deposited).

export interface TdsRow {
  date: string
  paymentRef: string
  billNumber: string
  supplier: string
  pan: string
  section: string
  amountPaid: number
  tdsDeducted: number
  effectiveRatePercent: number
}

export interface TdsSectionTotal {
  section: string
  count: number
  amountPaid: number
  tdsDeducted: number
}

export interface TdsReport {
  dateFrom: string
  dateTo: string
  decimals: number
  rows: TdsRow[]
  bySection: TdsSectionTotal[]
  totals: { amountPaid: number; tdsDeducted: number }
  /** Deducted up to the end date and not yet deposited (ledger balance of TDS Payable). */
  payableBalance: number
  missingPanCount: number
}

async function generateTdsDeducted(params: { dateFrom: string; dateTo: string }): Promise<TdsReport> {
  const db = getPrisma()
  const from = parseLocalDateStart(params.dateFrom)
  const to = parseLocalDateEnd(params.dateTo)
  const profile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)

  const payments = await db.supplierPayment.findMany({
    where: { paymentDate: { gte: from, lte: to }, isReversed: false, tdsAmount: { gt: 0 } },
    include: {
      supplier: { select: { supplierName: true, panNumber: true } },
      bill: { select: { billNumber: true, supplier: { select: { supplierName: true, panNumber: true } } } }
    },
    orderBy: { paymentDate: 'asc' }
  })

  const rows: TdsRow[] = payments.map((p) => {
    const party = p.supplier ?? p.bill.supplier
    return {
      date: toLocalISODate(p.paymentDate),
      paymentRef: p.referenceNumber ?? '',
      billNumber: p.bill.billNumber,
      supplier: party?.supplierName ?? '',
      pan: party?.panNumber ?? '',
      section: normalizeTdsSection(p.tdsSection),
      amountPaid: roundMoney(p.amount, decimals),
      tdsDeducted: roundMoney(p.tdsAmount, decimals),
      effectiveRatePercent: p.amount > 0 ? prorateAmount(100, p.tdsAmount, p.amount, 2) : 0
    }
  })

  const groups = new Map<string, TdsRow[]>()
  for (const r of rows) groups.set(r.section, [...(groups.get(r.section) ?? []), r])
  const bySection: TdsSectionTotal[] = Array.from(groups.entries())
    .map(([section, list]) => ({
      section,
      count: list.length,
      amountPaid: sumMoney(list.map((r) => r.amountPaid), decimals),
      tdsDeducted: sumMoney(list.map((r) => r.tdsDeducted), decimals)
    }))
    .sort((a, b) => a.section.localeCompare(b.section))

  const ledger = await db.journalEntryLine.aggregate({
    where: { account: { accountCode: '2200' }, journalEntry: { entryDate: { lte: to } } },
    _sum: { debitAmount: true, creditAmount: true }
  })

  return {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    decimals,
    rows,
    bySection,
    totals: {
      amountPaid: sumMoney(rows.map((r) => r.amountPaid), decimals),
      tdsDeducted: sumMoney(rows.map((r) => r.tdsDeducted), decimals)
    },
    payableBalance: roundMoney((ledger._sum.creditAmount ?? 0) - (ledger._sum.debitAmount ?? 0), decimals),
    missingPanCount: rows.filter((r) => r.pan.trim() === '').length
  }
}

export const tdsReportService = { generateTdsDeducted }
