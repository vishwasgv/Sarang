import { roundMoney, unitAmount, storedLineTaxable } from '../../shared/utils/money'
import { allocateGstHalves, stateCodeFromGstin, normalizeState } from '../../shared/utils/gst-presentation'

// Builds the e-invoice request (schema INV-1, version 1.1) for one invoice or credit note, ready to upload on
// the e-invoice portal to get the IRN. Sarang creates the file only; it never contacts the portal.

export interface EInvoiceParty {
  gstin: string
  name: string
  address: string
  city: string
  state: string
}

export interface EInvoiceLine {
  description: string
  hsnCode: string | null
  quantity: number
  unit: string
  taxRate: number
  taxAmount: number
  lineTotal: number
  discountAmount?: number
}

export interface EInvoiceSource {
  invoiceNumber: string
  invoiceDate: string // YYYY-MM-DD
  isCreditNote: boolean
  gstType: string | null
  pricesIncludeTax: boolean
  roundingAmount: number
  totalAmount: number
  seller: EInvoiceParty
  buyer: EInvoiceParty
  buyerState: string | null
  lines: EInvoiceLine[]
  /** Credit notes only: the invoice being corrected. */
  original?: { number: string; date: string }
  decimals: number
}

export const PINCODE = /\b[1-9]\d{5}\b/

export function pincodeOf(address: string): string {
  return PINCODE.exec(address)?.[0] ?? ''
}

function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// The portal accepts a fixed list of unit codes; anything else goes as OTH.
const UNIT_CODES = new Set(['BAG', 'BAL', 'BDL', 'BKL', 'BOU', 'BOX', 'BTL', 'BUN', 'CAN', 'CBM', 'CCM', 'CMS', 'CTN', 'DOZ', 'DRM', 'GGK', 'GMS', 'GRS', 'GYD', 'KGS', 'KLR', 'KME', 'LTR', 'MLT', 'MTR', 'MTS', 'NOS', 'OTH', 'PAC', 'PCS', 'PRS', 'QTL', 'ROL', 'SET', 'SQF', 'SQM', 'SQY', 'TBS', 'TGM', 'THD', 'TON', 'TUB', 'UGS', 'UNT', 'YDS'])
const UNIT_ALIASES: Record<string, string> = { KG: 'KGS', KGS: 'KGS', GM: 'GMS', G: 'GMS', L: 'LTR', LTR: 'LTR', LITRE: 'LTR', M: 'MTR', METER: 'MTR', PC: 'PCS', PIECE: 'PCS', NO: 'NOS', NUMBERS: 'NOS', TONNE: 'TON', TONS: 'TON', DOZEN: 'DOZ' }

export function unitCode(raw: string | null | undefined): string {
  const u = (raw ?? '').trim().toUpperCase()
  if (!u) return 'OTH'
  if (UNIT_ALIASES[u]) return UNIT_ALIASES[u]
  return UNIT_CODES.has(u) ? u : 'OTH'
}

/** What is missing before the file can be made; empty when the invoice is ready. */
export function einvoiceProblems(s: EInvoiceSource): string[] {
  const out: string[] = []
  if (!stateCodeFromGstin(s.seller.gstin)) out.push('Your business GSTIN')
  if (!s.seller.address.trim() || !pincodeOf(s.seller.address)) out.push('Your business address with a 6-digit pincode')
  if (!stateCodeFromGstin(s.buyer.gstin)) out.push('The customer GSTIN (e-invoices are for registered buyers)')
  if (!s.buyer.address.trim() || !pincodeOf(s.buyer.address)) out.push('The customer address with a 6-digit pincode')
  if (s.lines.length === 0) out.push('At least one line')
  if (s.lines.some((l) => !(l.hsnCode ?? '').trim())) out.push('An HSN/SAC code on every line')
  if (s.isCreditNote && !s.original) out.push('The original invoice number and date')
  return out
}

export function buildEInvoiceJson(s: EInvoiceSource) {
  const sellerCode = stateCodeFromGstin(s.seller.gstin)
  const buyerCode = stateCodeFromGstin(s.buyer.gstin)
  const posCode = /^\d{2}$/.test(normalizeState(s.buyerState ?? '')) ? normalizeState(s.buyerState ?? '') : buyerCode
  const igstOnly = s.gstType === 'IGST' || (sellerCode !== '' && posCode !== '' && sellerCode !== posCode)
  const halves = igstOnly ? null : allocateGstHalves(s.lines.map((l) => ({ taxRate: l.taxRate, taxAmount: Math.abs(l.taxAmount) })), s.decimals)
  const d = s.decimals

  const items = s.lines.map((l, i) => {
    const assessable = roundMoney(storedLineTaxable({ quantity: l.quantity, unitPrice: 0, discountAmount: l.discountAmount ?? 0, taxAmount: l.taxAmount, lineTotal: l.lineTotal }, { pricesIncludeTax: s.pricesIncludeTax, isReturn: s.isCreditNote }), d)
    const tax = roundMoney(Math.abs(l.taxAmount), d)
    const qty = Math.abs(l.quantity)
    const hsn = (l.hsnCode ?? '').trim()
    return {
      SlNo: String(i + 1),
      PrdDesc: l.description.slice(0, 300),
      IsServc: hsn.startsWith('99') ? 'Y' : 'N',
      HsnCd: hsn,
      Qty: qty,
      Unit: unitCode(l.unit),
      UnitPrice: unitAmount(assessable, qty, 3),
      TotAmt: assessable,
      Discount: 0,
      AssAmt: assessable,
      GstRt: l.taxRate,
      IgstAmt: halves ? 0 : tax,
      CgstAmt: halves ? halves[i].cgst : 0,
      SgstAmt: halves ? halves[i].sgst : 0,
      CesRt: 0,
      CesAmt: 0,
      TotItemVal: roundMoney(assessable + tax, d)
    }
  })

  const sum = (pick: (x: (typeof items)[number]) => number) => roundMoney(items.reduce((a, x) => a + pick(x), 0), d)

  return {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: 'N', IgstOnIntra: 'N' },
    DocDtls: { Typ: s.isCreditNote ? 'CRN' : 'INV', No: s.invoiceNumber, Dt: ddmmyyyy(s.invoiceDate) },
    SellerDtls: {
      Gstin: s.seller.gstin, LglNm: s.seller.name, Addr1: s.seller.address.slice(0, 100), Loc: s.seller.city || s.seller.state,
      Pin: Number(pincodeOf(s.seller.address)), Stcd: sellerCode
    },
    BuyerDtls: {
      Gstin: s.buyer.gstin, LglNm: s.buyer.name, Pos: posCode, Addr1: s.buyer.address.slice(0, 100), Loc: s.buyer.city || s.buyer.state,
      Pin: Number(pincodeOf(s.buyer.address)), Stcd: buyerCode
    },
    ItemList: items,
    ValDtls: {
      AssVal: sum((x) => x.AssAmt), CgstVal: sum((x) => x.CgstAmt), SgstVal: sum((x) => x.SgstAmt), IgstVal: sum((x) => x.IgstAmt),
      CesVal: 0, Discount: 0, RndOffAmt: roundMoney(s.isCreditNote ? Math.abs(s.roundingAmount) : s.roundingAmount, d), TotInvVal: roundMoney(Math.abs(s.totalAmount), d)
    },
    ...(s.isCreditNote && s.original ? { PrecDocDtls: [{ InvNo: s.original.number, InvDt: ddmmyyyy(s.original.date) }] } : {})
  }
}
