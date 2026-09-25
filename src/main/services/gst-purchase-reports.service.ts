import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney, roundMoney } from '../../shared/utils/money'
import { allocateGstHalves, classifyTaxHead, resolvePartyState } from '../../shared/utils/gst-presentation'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate } from '../utils/date.util'
import { splitTaxByHead, type TaxHeads } from './gst-input-credit.service'

// Purchase-side GST registers: every supplier bill (and debit note, as a negative row) with taxable value and
// tax by head, and the purchase HSN summary. Voided bills are left out; a bill under reverse charge shows its
// self-assessed tax and is flagged.

export interface PurchaseRegisterRow {
  kind: 'BILL' | 'DEBIT_NOTE'
  date: string
  number: string
  supplier: string
  supplierGstin: string
  state: string
  reverseCharge: boolean
  taxable: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  total: number
}

export interface PurchaseRegisterReport {
  dateFrom: string
  dateTo: string
  decimals: number
  rows: PurchaseRegisterRow[]
  totals: { taxable: number; cgst: number; sgst: number; igst: number; tax: number; total: number }
  byMonth: { month: string; taxable: number; tax: number }[]
  stateUnknownCount: number
}

export interface PurchaseHsnRow {
  hsnCode: string
  description: string
  taxRate: number
  quantity: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  tax: number
}

export interface PurchaseHsnReport {
  dateFrom: string
  dateTo: string
  decimals: number
  rows: PurchaseHsnRow[]
  totals: { taxable: number; tax: number }
  missingHsnCount: number
}

export const NO_HSN = 'No HSN Code'

async function context() {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { state: true, taxNumber: true, currencyCode: true } })
  return {
    db,
    decimals: getCurrencyDecimals(profile?.currencyCode),
    businessState: resolvePartyState(profile?.state, profile?.taxNumber) || null
  }
}

const totalsOf = (rows: PurchaseRegisterRow[], decimals: number) => ({
  taxable: sumMoney(rows.map((r) => r.taxable), decimals),
  cgst: sumMoney(rows.map((r) => r.cgst), decimals),
  sgst: sumMoney(rows.map((r) => r.sgst), decimals),
  igst: sumMoney(rows.map((r) => r.igst), decimals),
  tax: sumMoney(rows.map((r) => r.tax), decimals),
  total: sumMoney(rows.map((r) => r.total), decimals)
})

async function generatePurchaseRegister(params: { dateFrom: string; dateTo: string }): Promise<PurchaseRegisterReport> {
  const { db, decimals, businessState } = await context()
  const from = parseLocalDateStart(params.dateFrom)
  const to = parseLocalDateEnd(params.dateTo)
  const supplierSel = { select: { supplierName: true, state: true, taxNumber: true } }

  const [bills, notes] = await Promise.all([
    db.bill.findMany({
      where: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } },
      include: { supplier: supplierSel, items: { select: { taxRate: true, taxAmount: true } } },
      orderBy: { billDate: 'asc' }
    }),
    db.debitNote.findMany({
      where: { createdAt: { gte: from, lte: to }, taxApplied: true },
      include: { supplier: supplierSel, items: { select: { taxRate: true, taxAmount: true } } },
      orderBy: { createdAt: 'asc' }
    })
  ])

  let stateUnknownCount = 0
  const rows: PurchaseRegisterRow[] = []
  const push = (kind: PurchaseRegisterRow['kind'], sign: 1 | -1, d: {
    date: Date; number: string; gstType: string | null; tax: number; total: number; reverseCharge: boolean
    supplier: { supplierName: string; state: string | null; taxNumber: string | null } | null
    items: { taxRate: number; taxAmount: number }[]
  }) => {
    const partyState = d.supplier ? resolvePartyState(d.supplier.state, d.supplier.taxNumber) || null : null
    const split = splitTaxByHead({ amount: d.tax, gstType: d.gstType, businessState, partyState, decimals, rateTaxes: d.items })
    if (split.stateUnknown && d.tax > 0) stateUnknownCount += 1
    const h: TaxHeads = split.heads
    // Under reverse charge the document total is already tax-exclusive.
    const taxable = roundMoney(d.reverseCharge ? d.total : d.total - d.tax, decimals)
    rows.push({
      kind, date: toLocalISODate(d.date), number: d.number,
      supplier: d.supplier?.supplierName ?? '', supplierGstin: d.supplier?.taxNumber ?? '',
      state: partyState ?? '', reverseCharge: d.reverseCharge,
      taxable: sign * taxable, cgst: sign * h.cgst, sgst: sign * h.sgst, igst: sign * h.igst, tax: sign * roundMoney(d.tax, decimals),
      total: sign * roundMoney(d.reverseCharge ? d.total + d.tax : d.total, decimals)
    })
  }
  for (const b of bills) push('BILL', 1, { date: b.billDate, number: b.billNumber, gstType: b.gstType, tax: b.taxAmount, total: b.totalAmount, reverseCharge: b.isReverseCharge, supplier: b.supplier, items: b.items })
  for (const n of notes) push('DEBIT_NOTE', -1, { date: n.createdAt, number: n.debitNoteNumber, gstType: n.gstType, tax: n.taxAmount, total: n.amount, reverseCharge: false, supplier: n.supplier, items: n.items })
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))

  const months = new Map<string, { taxable: number[]; tax: number[] }>()
  for (const r of rows) {
    const m = months.get(r.date.slice(0, 7)) ?? { taxable: [], tax: [] }
    m.taxable.push(r.taxable)
    m.tax.push(r.tax)
    months.set(r.date.slice(0, 7), m)
  }

  return {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    decimals,
    rows,
    totals: totalsOf(rows, decimals),
    byMonth: Array.from(months.entries()).map(([month, v]) => ({ month, taxable: sumMoney(v.taxable, decimals), tax: sumMoney(v.tax, decimals) })),
    stateUnknownCount
  }
}

async function generatePurchaseHsnSummary(params: { dateFrom: string; dateTo: string }): Promise<PurchaseHsnReport> {
  const { db, decimals, businessState } = await context()
  const from = parseLocalDateStart(params.dateFrom)
  const to = parseLocalDateEnd(params.dateTo)

  const bills = await db.bill.findMany({
    where: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } },
    include: {
      supplier: { select: { state: true, taxNumber: true } },
      items: { include: { product: { select: { hsnCode: true, productName: true } } } }
    }
  })

  interface Acc { hsnCode: string; description: string; taxRate: number; quantity: number; taxable: number[]; cgst: number[]; sgst: number[]; igst: number[] }
  const map = new Map<string, Acc>()
  let missingHsnCount = 0
  for (const b of bills) {
    const partyState = b.supplier ? resolvePartyState(b.supplier.state, b.supplier.taxNumber) || null : null
    const cls = classifyTaxHead(b.gstType, businessState, partyState)
    const halves = cls.head === 'CGST_SGST' ? allocateGstHalves(b.items.map((i) => ({ taxRate: i.taxRate, taxAmount: i.taxAmount })), decimals) : null
    b.items.forEach((item, idx) => {
      const hsnCode = item.product?.hsnCode?.trim() || NO_HSN
      if (hsnCode === NO_HSN && item.taxAmount > 0) missingHsnCount += 1
      const key = `${hsnCode}|${item.taxRate}`
      const acc = map.get(key) ?? { hsnCode, description: item.product?.productName ?? item.serviceDescription ?? '', taxRate: item.taxRate, quantity: 0, taxable: [], cgst: [], sgst: [], igst: [] }
      acc.quantity += item.quantity
      acc.taxable.push(roundMoney(b.isReverseCharge ? item.total : item.total - item.taxAmount, decimals))
      acc.cgst.push(halves ? halves[idx].cgst : 0)
      acc.sgst.push(halves ? halves[idx].sgst : 0)
      acc.igst.push(cls.head === 'IGST' ? item.taxAmount : 0)
      map.set(key, acc)
    })
  }

  const rows: PurchaseHsnRow[] = Array.from(map.values()).map((a) => {
    const cgst = sumMoney(a.cgst, decimals)
    const sgst = sumMoney(a.sgst, decimals)
    const igst = sumMoney(a.igst, decimals)
    return {
      hsnCode: a.hsnCode, description: a.description, taxRate: a.taxRate, quantity: a.quantity,
      taxable: sumMoney(a.taxable, decimals), cgst, sgst, igst, tax: sumMoney([cgst, sgst, igst], decimals)
    }
  })
  rows.sort((a, b) => a.hsnCode.localeCompare(b.hsnCode) || a.taxRate - b.taxRate)

  return {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    decimals,
    rows,
    totals: { taxable: sumMoney(rows.map((r) => r.taxable), decimals), tax: sumMoney(rows.map((r) => r.tax), decimals) },
    missingHsnCount
  }
}

export const gstPurchaseReportsService = { generatePurchaseRegister, generatePurchaseHsnSummary }
