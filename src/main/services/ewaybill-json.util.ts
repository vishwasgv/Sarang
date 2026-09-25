import { roundMoney, storedLineTaxable } from '../../shared/utils/money'
import { allocateGstHalves, stateCodeFromGstin, normalizeState } from '../../shared/utils/gst-presentation'
import { pincodeOf, unitCode, type EInvoiceSource } from './einvoice-json.util'

// Builds the bulk-generation file for e-way bills (Part A and Part B) from one invoice. Sarang creates the file
// only; the owner uploads it on the e-way bill portal.

export interface EwayTransport {
  mode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
  vehicleNumber?: string
  transporterId?: string
  transporterName?: string
  transportDocNo?: string
  transportDocDate?: string // YYYY-MM-DD
  distanceKm?: number
}

const MODE_CODE: Record<EwayTransport['mode'], string> = { ROAD: '1', RAIL: '2', AIR: '3', SHIP: '4' }

function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function ewayProblems(s: EInvoiceSource, t: EwayTransport): string[] {
  const out: string[] = []
  if (!stateCodeFromGstin(s.seller.gstin)) out.push('Your business GSTIN')
  if (!pincodeOf(s.seller.address)) out.push('Your business address with a 6-digit pincode')
  if (!s.buyer.name.trim()) out.push('The customer name')
  if (!pincodeOf(s.buyer.address)) out.push('The customer address with a 6-digit pincode')
  if (s.lines.length === 0) out.push('At least one line')
  if (s.lines.some((l) => !/^\d{4,8}$/.test((l.hsnCode ?? '').trim()))) out.push('A numeric HSN code (4 to 8 digits) on every line')
  if (!t.vehicleNumber?.trim() && !t.transporterId?.trim()) out.push('A vehicle number or a transporter ID')
  if (t.mode === 'ROAD' && t.vehicleNumber && !/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(t.vehicleNumber.replace(/[\s-]/g, '').toUpperCase())) out.push('A vehicle number like MH12AB1234')
  return out
}

export function buildEwayBillJson(s: EInvoiceSource, t: EwayTransport) {
  const d = s.decimals
  const sellerCode = stateCodeFromGstin(s.seller.gstin)
  const buyerCode = stateCodeFromGstin(s.buyer.gstin) || normalizeState(s.buyerState ?? s.buyer.state)
  const toCode = /^\d{2}$/.test(buyerCode) ? buyerCode : ''
  const inter = s.gstType === 'IGST' || (sellerCode !== '' && toCode !== '' && sellerCode !== toCode)
  const halves = inter ? null : allocateGstHalves(s.lines.map((l) => ({ taxRate: l.taxRate, taxAmount: Math.abs(l.taxAmount) })), d)

  const items = s.lines.map((l, i) => {
    const taxable = roundMoney(storedLineTaxable({ quantity: l.quantity, unitPrice: 0, discountAmount: l.discountAmount ?? 0, taxAmount: l.taxAmount, lineTotal: l.lineTotal }, { pricesIncludeTax: s.pricesIncludeTax, isReturn: s.isCreditNote }), d)
    return {
      productName: l.description.slice(0, 100),
      productDesc: l.description.slice(0, 100),
      hsnCode: Number((l.hsnCode ?? '').trim()),
      quantity: Math.abs(l.quantity),
      qtyUnit: unitCode(l.unit),
      taxableAmount: taxable,
      sgstRate: inter ? 0 : l.taxRate / 2,
      cgstRate: inter ? 0 : l.taxRate / 2,
      igstRate: inter ? l.taxRate : 0,
      cessRate: 0,
      _cgst: halves ? halves[i].cgst : 0,
      _sgst: halves ? halves[i].sgst : 0,
      _igst: inter ? roundMoney(Math.abs(l.taxAmount), d) : 0
    }
  })
  const sum = (pick: (x: (typeof items)[number]) => number) => roundMoney(items.reduce((a, x) => a + pick(x), 0), d)
  const totalValue = sum((x) => x.taxableAmount)
  const cgstValue = sum((x) => x._cgst)
  const sgstValue = sum((x) => x._sgst)
  const igstValue = sum((x) => x._igst)

  const bill = {
    userGstin: s.seller.gstin,
    supplyType: 'O',
    subSupplyType: 1,
    docType: s.isCreditNote ? 'CHL' : 'INV',
    docNo: s.invoiceNumber,
    docDate: ddmmyyyy(s.invoiceDate),
    fromGstin: s.seller.gstin,
    fromTrdName: s.seller.name,
    fromAddr1: s.seller.address.slice(0, 120),
    fromPlace: s.seller.city || s.seller.state,
    fromPincode: Number(pincodeOf(s.seller.address)),
    fromStateCode: Number(sellerCode),
    actFromStateCode: Number(sellerCode),
    toGstin: s.buyer.gstin || 'URP',
    toTrdName: s.buyer.name,
    toAddr1: s.buyer.address.slice(0, 120),
    toPlace: s.buyer.city || s.buyer.state,
    toPincode: Number(pincodeOf(s.buyer.address)),
    toStateCode: Number(toCode || sellerCode),
    actToStateCode: Number(toCode || sellerCode),
    totalValue,
    cgstValue, sgstValue, igstValue,
    cessValue: 0,
    totInvValue: roundMoney(Math.abs(s.totalAmount), d),
    transporterId: t.transporterId?.trim() ?? '',
    transporterName: t.transporterName?.trim() ?? '',
    transDocNo: t.transportDocNo?.trim() ?? '',
    transMode: MODE_CODE[t.mode],
    transDistance: String(Math.max(0, Math.round(t.distanceKm ?? 0))),
    transDocDate: t.transportDocDate ? ddmmyyyy(t.transportDocDate) : '',
    vehicleNo: (t.vehicleNumber ?? '').replace(/[\s-]/g, '').toUpperCase(),
    vehicleType: 'R',
    itemList: items.map(({ _cgst, _sgst, _igst, ...item }) => item)
  }
  return { version: '1.0.0621', billLists: [bill] }
}
