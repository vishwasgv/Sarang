import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney, roundMoney } from '../../shared/utils/money'
import { classifyTaxHead, resolvePartyState, splitGstHalves, type GstRateTax } from '../../shared/utils/gst-presentation'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate } from '../utils/date.util'
import { reportService } from './report.service'

// Input Tax Credit and net GST payable for a period.
//   Output tax: from sales invoices and credit notes (the same figures GSTR-1 / GSTR-3B use).
//   Reverse-charge tax and input credit: from the ledger postings of bills, received purchase orders and
//   debit notes (accounts 2100 Tax Payable and 1300 Input Tax Credit), split into CGST / SGST / IGST by the
//   document that created each posting. A voided document's reversal is attributed to that same document,
//   so a void nets to zero.

const PURCHASE_SOURCES = ['BILL', 'PURCHASE_ORDER', 'DEBIT_NOTE'] as const
type PurchaseSource = typeof PURCHASE_SOURCES[number]

export interface TaxHeads { cgst: number; sgst: number; igst: number; total: number }

export interface InputCreditRow {
  sourceType: PurchaseSource
  documentNumber: string
  date: string
  party: string
  itc: TaxHeads
  reverseCharge: TaxHeads
}

/** A fixed explanation the screen translates by code. */
export interface GstNetPayableNote { code: 'earlierPurchases' | 'setOffLater' | 'composition' | 'stateUnknown'; count?: number }

export interface GstNetPayableReport {
  dateFrom: string
  dateTo: string
  decimals: number
  output: TaxHeads
  reverseCharge: TaxHeads
  inputCredit: TaxHeads
  netPayable: TaxHeads
  /** True when the net is negative in total: credit carried forward, nothing to pay. */
  creditCarriedForward: boolean
  rows: InputCreditRow[]
  stateUnknownCount: number
  notes: GstNetPayableNote[]
}

const zeroHeads = (): TaxHeads => ({ cgst: 0, sgst: 0, igst: 0, total: 0 })

function addHeads(list: TaxHeads[], decimals: number): TaxHeads {
  const cgst = sumMoney(list.map((h) => h.cgst), decimals)
  const sgst = sumMoney(list.map((h) => h.sgst), decimals)
  const igst = sumMoney(list.map((h) => h.igst), decimals)
  return { cgst, sgst, igst, total: sumMoney([cgst, sgst, igst], decimals) }
}

function subHeads(a: TaxHeads, b: TaxHeads, decimals: number): TaxHeads {
  const cgst = roundMoney(a.cgst - b.cgst, decimals)
  const sgst = roundMoney(a.sgst - b.sgst, decimals)
  const igst = roundMoney(a.igst - b.igst, decimals)
  return { cgst, sgst, igst, total: sumMoney([cgst, sgst, igst], decimals) }
}

/** Splits a signed tax amount into CGST / SGST / IGST by the head the document is filed under. */
export function splitTaxByHead(p: {
  amount: number
  gstType: unknown
  businessState: string | null
  partyState: string | null
  decimals: number
  rateTaxes?: GstRateTax[]
}): { heads: TaxHeads; stateUnknown: boolean } {
  const sign = p.amount < 0 ? -1 : 1
  const magnitude = roundMoney(Math.abs(p.amount), p.decimals)
  const cls = classifyTaxHead(p.gstType, p.businessState, p.partyState)
  if (cls.head === 'IGST') {
    const igst = sign * magnitude
    return { heads: { cgst: 0, sgst: 0, igst, total: igst }, stateUnknown: cls.stateUnknown }
  }
  const halves = splitGstHalves(magnitude, p.decimals, p.rateTaxes)
  const cgst = sign * halves.cgst
  const sgst = sign * halves.sgst
  return { heads: { cgst, sgst, igst: 0, total: sumMoney([cgst, sgst], p.decimals) }, stateUnknown: cls.stateUnknown }
}

interface DocInfo {
  number: string
  gstType: string | null
  partyName: string
  partyState: string | null
  rateTaxes: GstRateTax[]
  totalTax: number
}

async function loadDocs(db: ReturnType<typeof getPrisma>, sourceType: PurchaseSource, ids: string[]): Promise<Map<string, DocInfo>> {
  const out = new Map<string, DocInfo>()
  if (ids.length === 0) return out
  const party = (s: { supplierName: string; state: string | null; taxNumber: string | null } | null) => ({
    partyName: s?.supplierName ?? '',
    partyState: s ? resolvePartyState(s.state, s.taxNumber) || null : null
  })
  const supplierSel = { select: { supplierName: true, state: true, taxNumber: true } }
  if (sourceType === 'BILL') {
    const docs = await db.bill.findMany({ where: { id: { in: ids } }, include: { supplier: supplierSel, items: { select: { taxRate: true, taxAmount: true } } } })
    for (const d of docs) out.set(d.id, { number: d.billNumber, gstType: d.gstType, ...party(d.supplier), rateTaxes: d.items, totalTax: d.taxAmount })
  } else if (sourceType === 'PURCHASE_ORDER') {
    const docs = await db.purchaseOrder.findMany({ where: { id: { in: ids } }, include: { supplier: supplierSel, items: { select: { taxRate: true, taxAmount: true } } } })
    for (const d of docs) out.set(d.id, { number: d.poNumber, gstType: d.gstType, ...party(d.supplier), rateTaxes: d.items, totalTax: d.taxAmount })
  } else {
    const docs = await db.debitNote.findMany({ where: { id: { in: ids } }, include: { supplier: supplierSel, items: { select: { taxRate: true, taxAmount: true } } } })
    for (const d of docs) out.set(d.id, { number: d.debitNoteNumber, gstType: d.gstType, ...party(d.supplier), rateTaxes: d.items, totalTax: d.taxAmount })
  }
  return out
}

async function generateGstNetPayable(params: { dateFrom: string; dateTo: string }): Promise<GstNetPayableReport> {
  const db = getPrisma()
  const from = parseLocalDateStart(params.dateFrom)
  const to = parseLocalDateEnd(params.dateTo)

  const profile = await db.businessProfile.findFirst({ select: { state: true, taxNumber: true, currencyCode: true, gstScheme: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)
  const businessState = resolvePartyState(profile?.state, profile?.taxNumber) || null

  const lines = await db.journalEntryLine.findMany({
    where: {
      account: { accountCode: { in: ['1300', '2100'] } },
      journalEntry: { entryDate: { gte: from, lte: to }, sourceType: { in: [...PURCHASE_SOURCES] } }
    },
    select: {
      debitAmount: true, creditAmount: true,
      account: { select: { accountCode: true } },
      journalEntry: { select: { id: true, sourceType: true, sourceId: true, entryDate: true } }
    }
  })

  // A reversal entry keeps the source type of the original but points at the original entry, not the document.
  const reversalTargets = Array.from(new Set(lines.filter((l) => l.journalEntry.sourceId).map((l) => l.journalEntry.sourceId as string)))
  const originals = reversalTargets.length > 0
    ? await db.journalEntry.findMany({ where: { id: { in: reversalTargets } }, select: { id: true, sourceId: true } })
    : []
  const originalDoc = new Map(originals.map((o) => [o.id, o.sourceId]))

  interface Bucket { sourceType: PurchaseSource; docId: string; date: Date; itc: number; rcm: number }
  const buckets = new Map<string, Bucket>()
  for (const l of lines) {
    const st = l.journalEntry.sourceType as PurchaseSource
    if (!PURCHASE_SOURCES.includes(st) || !l.journalEntry.sourceId) continue
    const docId = originalDoc.has(l.journalEntry.sourceId) ? originalDoc.get(l.journalEntry.sourceId) : l.journalEntry.sourceId
    if (!docId) continue
    const key = `${st}:${docId}`
    const b = buckets.get(key) ?? { sourceType: st, docId, date: l.journalEntry.entryDate, itc: 0, rcm: 0 }
    if (l.account.accountCode === '1300') b.itc += l.debitAmount - l.creditAmount
    // Only bills and received POs create reverse-charge liability; a debit note never posts to Tax Payable.
    else if (st !== 'DEBIT_NOTE') b.rcm += l.creditAmount - l.debitAmount
    if (l.journalEntry.entryDate > b.date) b.date = l.journalEntry.entryDate
    buckets.set(key, b)
  }

  const idsBySource: Record<PurchaseSource, string[]> = { BILL: [], PURCHASE_ORDER: [], DEBIT_NOTE: [] }
  for (const b of buckets.values()) idsBySource[b.sourceType].push(b.docId)
  const docs = new Map<string, DocInfo>()
  for (const st of PURCHASE_SOURCES) {
    for (const [id, info] of await loadDocs(db, st, idsBySource[st])) docs.set(`${st}:${id}`, info)
  }

  let stateUnknownCount = 0
  const rows: InputCreditRow[] = []
  for (const [key, b] of buckets) {
    const itcAmount = roundMoney(b.itc, decimals)
    const rcmAmount = roundMoney(b.rcm, decimals)
    if (itcAmount === 0 && rcmAmount === 0) continue
    const doc = docs.get(key)
    const split = (amount: number) => amount === 0
      ? { heads: zeroHeads(), stateUnknown: false }
      : splitTaxByHead({ amount, gstType: doc?.gstType, businessState, partyState: doc?.partyState ?? null, decimals, rateTaxes: doc?.rateTaxes })
    const itc = split(itcAmount)
    const rcm = split(rcmAmount)
    if (itc.stateUnknown || rcm.stateUnknown) stateUnknownCount += 1
    rows.push({
      sourceType: b.sourceType,
      documentNumber: doc?.number ?? '',
      date: toLocalISODate(b.date),
      party: doc?.partyName ?? '',
      itc: itc.heads,
      reverseCharge: rcm.heads
    })
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.documentNumber.localeCompare(b.documentNumber))

  const preview = await reportService.generateGSTR3BPreview({ dateFrom: params.dateFrom, dateTo: params.dateTo })
  const outputTax = preview.table31.taxAmount
  const output = addHeads([{ cgst: outputTax.cgst, sgst: outputTax.sgst, igst: outputTax.igst, total: 0 }], decimals)
  const reverseCharge = addHeads(rows.map((r) => r.reverseCharge), decimals)
  const inputCredit = addHeads(rows.map((r) => r.itc), decimals)
  const netPayable = subHeads(addHeads([output, reverseCharge], decimals), inputCredit, decimals)

  const notes: GstNetPayableNote[] = [{ code: 'earlierPurchases' }, { code: 'setOffLater' }]
  if (profile?.gstScheme === 'COMPOSITION') notes.push({ code: 'composition' })
  if (stateUnknownCount > 0) notes.push({ code: 'stateUnknown', count: stateUnknownCount })

  return {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    decimals,
    output,
    reverseCharge,
    inputCredit,
    netPayable,
    creditCarriedForward: netPayable.total < 0,
    rows,
    stateUnknownCount,
    notes
  }
}

export const gstInputCreditService = { generateGstNetPayable }
