import { roundMoney } from '../../shared/utils/money'

// Reads the purchase data downloaded from the GST portal (GSTR-2B or GSTR-2A JSON) and compares it with the
// supplier bills in the books. Pure functions, no I/O.

export interface PortalDoc {
  kind: 'INVOICE' | 'CREDIT_NOTE'
  ctin: string
  supplierName: string
  number: string
  date: string
  value: number
  taxable: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  /** GSTR-2B marks whether the credit can be claimed; 2A has no such flag (true). */
  itcAvailable: boolean
}

export interface PortalPurchases {
  gstin: string
  period: string
  docs: PortalDoc[]
}

type Json = Record<string, unknown>
const asArr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : [])
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

/** "05-09-2026" -> "2026-09-05"; anything else is returned unchanged. */
export function isoFromPortalDate(d: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d
}

/** Upper-case, letters and digits only, no leading zeros in any number part: "INV/0022" and "inv-22" match. */
export function normalizeInvoiceNumber(n: string): string {
  return n.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\d+/g, (run) => run.replace(/^0+(?=\d)/, '')).replace(/ /g, '')
}

interface ItemSums { taxable: number; igst: number; cgst: number; sgst: number; cess: number }

function sumItems(items: Json[]): ItemSums {
  const out: ItemSums = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
  for (const it of items) {
    // GSTR-2B lines are flat; GSTR-2A lines carry an itm_det object.
    const d = (it.itm_det as Json | undefined) ?? it
    out.taxable += num(d.txval)
    out.igst += num(d.igst ?? d.iamt)
    out.cgst += num(d.cgst ?? d.camt)
    out.sgst += num(d.sgst ?? d.samt)
    out.cess += num(d.cess ?? d.csamt)
  }
  return out
}

export function parsePortalPurchases(root: unknown): PortalPurchases {
  const top = (root ?? {}) as Json
  const data = ((top.data as Json | undefined) ?? top) as Json
  const docdata = ((data.docdata as Json | undefined) ?? data) as Json
  const docs: PortalDoc[] = []

  for (const party of asArr(docdata.b2b)) {
    const ctin = str(party.ctin).trim().toUpperCase()
    const supplierName = str(party.trdnm)
    for (const inv of asArr(party.inv)) {
      const s = sumItems(asArr(inv.items ?? inv.itms))
      docs.push({
        kind: 'INVOICE', ctin, supplierName, number: str(inv.inum), date: isoFromPortalDate(str(inv.dt ?? inv.idt)),
        value: num(inv.val), ...s, itcAvailable: str(inv.itcavl ?? 'Y').toUpperCase() !== 'N'
      })
    }
  }
  for (const party of asArr(docdata.cdnr)) {
    const ctin = str(party.ctin).trim().toUpperCase()
    const supplierName = str(party.trdnm)
    for (const nt of asArr(party.nt)) {
      const s = sumItems(asArr(nt.items ?? nt.itms))
      docs.push({
        kind: 'CREDIT_NOTE', ctin, supplierName, number: str(nt.ntnum ?? nt.nt_num), date: isoFromPortalDate(str(nt.dt ?? nt.nt_dt)),
        value: num(nt.val), ...s, itcAvailable: str(nt.itcavl ?? 'Y').toUpperCase() !== 'N'
      })
    }
  }
  return { gstin: str(data.gstin), period: str(data.rtnprd ?? data.fp), docs }
}

export interface BookBill {
  billId: string
  billNumber: string
  supplierGstin: string
  supplierName: string
  supplierInvoiceNumber: string
  date: string
  taxable: number
  igst: number
  cgst: number
  sgst: number
  tax: number
  reverseCharge: boolean
  /** Bill dated in the month of the portal file; only these can be reported as missing from the portal. */
  inPeriod: boolean
}

export type ReconStatus = 'MATCHED' | 'MISMATCH' | 'MISSING_IN_BOOKS' | 'MISSING_IN_PORTAL' | 'REVIEW'

export interface ReconRow {
  status: ReconStatus
  supplierGstin: string
  supplierName: string
  invoiceNumber: string
  date: string
  portalTax: number | null
  booksTax: number | null
  portalTaxable: number | null
  booksTaxable: number | null
  billNumber: string
  itcAvailable: boolean
  note: string
}

export interface ReconResult {
  rows: ReconRow[]
  counts: Record<ReconStatus, number>
  /** Tax on invoices the portal shows and the books also hold, that the portal marks claimable. */
  claimablePerPortal: number
  /** Tax on bills the supplier has not yet reported to the portal: credit that cannot be claimed yet. */
  creditAtRisk: number
}

const TOLERANCE = 1

export function reconcilePurchases(portal: PortalPurchases, bills: BookBill[], decimals = 2): ReconResult {
  const rows: ReconRow[] = []
  const key = (gstin: string, n: string) => `${gstin.trim().toUpperCase()}|${normalizeInvoiceNumber(n)}`
  const byKey = new Map<string, BookBill>()
  for (const b of bills) if (b.supplierInvoiceNumber) byKey.set(key(b.supplierGstin, b.supplierInvoiceNumber), b)
  const used = new Set<string>()
  const portalTaxOf = (d: PortalDoc) => roundMoney(d.igst + d.cgst + d.sgst, decimals)
  let claimable = 0

  for (const d of portal.docs) {
    const pt = portalTaxOf(d)
    if (d.kind === 'CREDIT_NOTE') {
      rows.push({ status: 'REVIEW', supplierGstin: d.ctin, supplierName: d.supplierName, invoiceNumber: d.number, date: d.date, portalTax: pt, booksTax: null, portalTaxable: d.taxable, booksTaxable: null, billNumber: '', itcAvailable: d.itcAvailable, note: 'creditNote' })
      continue
    }
    const b = byKey.get(key(d.ctin, d.number))
    if (!b) {
      rows.push({ status: 'MISSING_IN_BOOKS', supplierGstin: d.ctin, supplierName: d.supplierName, invoiceNumber: d.number, date: d.date, portalTax: pt, booksTax: null, portalTaxable: d.taxable, booksTaxable: null, billNumber: '', itcAvailable: d.itcAvailable, note: '' })
      continue
    }
    used.add(b.billId)
    const same = Math.abs(pt - b.tax) <= TOLERANCE && Math.abs(d.taxable - b.taxable) <= TOLERANCE
    if (same && d.itcAvailable) claimable += b.tax
    rows.push({ status: same ? 'MATCHED' : 'MISMATCH', supplierGstin: d.ctin, supplierName: d.supplierName, invoiceNumber: d.number, date: d.date, portalTax: pt, booksTax: b.tax, portalTaxable: d.taxable, booksTaxable: b.taxable, billNumber: b.billNumber, itcAvailable: d.itcAvailable, note: !d.itcAvailable ? 'notClaimable' : '' })
  }

  let atRisk = 0
  for (const b of bills) {
    if (used.has(b.billId) || !b.inPeriod || b.reverseCharge || b.tax <= 0 || !b.supplierGstin) continue
    atRisk += b.tax
    rows.push({ status: 'MISSING_IN_PORTAL', supplierGstin: b.supplierGstin, supplierName: b.supplierName, invoiceNumber: b.supplierInvoiceNumber, date: b.date, portalTax: null, booksTax: b.tax, portalTaxable: null, booksTaxable: b.taxable, billNumber: b.billNumber, itcAvailable: false, note: b.supplierInvoiceNumber ? '' : 'noInvoiceNumber' })
  }

  const counts: Record<ReconStatus, number> = { MATCHED: 0, MISMATCH: 0, MISSING_IN_BOOKS: 0, MISSING_IN_PORTAL: 0, REVIEW: 0 }
  for (const r of rows) counts[r.status] += 1
  return { rows, counts, claimablePerPortal: roundMoney(claimable, decimals), creditAtRisk: roundMoney(atRisk, decimals) }
}
