import { roundMoney } from '../../shared/utils/money'
import { normalizeState } from '../../shared/utils/gst-presentation'
import type { GSTR1Report, GSTR3BPreview, HSNSummaryReport } from './report.service'
import type { GstNetPayableReport } from './gst-input-credit.service'

// Builds the JSON layouts the GST portal's offline tools read for GSTR-1 and GSTR-3B. The files are drafts
// prepared from the books: the owner checks them in the portal's own tool before filing. Nothing is sent
// anywhere by Sarang.

const r2 = (n: number) => roundMoney(n, 2)
const ZERO_CESS = 0

export function returnPeriod(dateFrom: string): string {
  const [y, m] = dateFrom.split('-')
  return `${m}${y}`
}

/** "2026-09-05" -> "05-09-2026" */
export function portalDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/** Two-digit state code from a state name, code, or "27-Maharashtra" label; '' when unknown. */
export function stateCodeOf(label: string): string {
  const code = normalizeState(label)
  return /^\d{2}$/.test(code) ? code : ''
}

function itemDetail(rate: number, taxable: number, igst: number, cgst: number, sgst: number) {
  return { rt: rate, txval: r2(taxable), iamt: r2(igst), camt: r2(cgst), samt: r2(sgst), csamt: ZERO_CESS }
}

export function buildGstr1Json(p: { gstin: string; dateFrom: string; gstr1: GSTR1Report; hsn: HSNSummaryReport }) {
  const { gstr1 } = p

  const b2bByBuyer = new Map<string, Map<string, { val: number; pos: string; idt: string; itms: unknown[] }>>()
  for (const row of gstr1.b2b) {
    const invoices = b2bByBuyer.get(row.gstin) ?? new Map()
    const inv = invoices.get(row.invoiceNumber) ?? { val: r2(row.invoiceValue), pos: stateCodeOf(row.placeOfSupply), idt: portalDate(row.invoiceDate), itms: [] }
    inv.itms.push({ num: inv.itms.length + 1, itm_det: itemDetail(row.rate, row.taxableValue, row.igstAmount, row.cgstAmount, row.sgstAmount) })
    invoices.set(row.invoiceNumber, inv)
    b2bByBuyer.set(row.gstin, invoices)
  }
  const b2b = Array.from(b2bByBuyer.entries()).map(([ctin, invoices]) => ({
    ctin,
    inv: Array.from(invoices.entries()).map(([inum, v]) => ({ inum, idt: v.idt, val: v.val, pos: v.pos, rchrg: 'N', inv_typ: 'R', itms: v.itms }))
  }))

  const businessCode = p.gstin.slice(0, 2)
  const b2cs = gstr1.b2cs.map((row) => {
    const pos = stateCodeOf(row.placeOfSupply)
    return {
      sply_ty: row.igstAmount !== 0 || (pos !== '' && pos !== businessCode) ? 'INTER' : 'INTRA',
      typ: 'OE', pos, rt: row.rate,
      txval: r2(row.taxableValue), iamt: r2(row.igstAmount), camt: r2(row.cgstAmount), samt: r2(row.sgstAmount), csamt: ZERO_CESS
    }
  })

  // The portal wants credit-note values as positive figures; Sarang holds them as negatives.
  const notesByBuyer = new Map<string, Map<string, { val: number; pos: string; dt: string; itms: unknown[] }>>()
  for (const row of gstr1.cdnr) {
    const notes = notesByBuyer.get(row.gstin) ?? new Map()
    const note = notes.get(row.noteNumber) ?? { val: r2(Math.abs(row.noteValue)), pos: stateCodeOf(row.placeOfSupply), dt: portalDate(row.noteDate), itms: [] }
    note.itms.push({ num: note.itms.length + 1, itm_det: itemDetail(row.rate, Math.abs(row.taxableValue), Math.abs(row.igstAmount), Math.abs(row.cgstAmount), Math.abs(row.sgstAmount)) })
    notes.set(row.noteNumber, note)
    notesByBuyer.set(row.gstin, notes)
  }
  const cdnr = Array.from(notesByBuyer.entries()).map(([ctin, notes]) => ({
    ctin,
    nt: Array.from(notes.entries()).map(([nt_num, v]) => ({ ntty: 'C', nt_num, nt_dt: v.dt, val: v.val, pos: v.pos, rchrg: 'N', inv_typ: 'R', itms: v.itms }))
  }))

  const nilGroups = new Map<string, { expt: number; nil: number; ngsup: number }>()
  for (const row of gstr1.nilExempt) {
    const key = `${row.interState ? 'INTR' : 'INTRA'}${row.registered ? 'B2B' : 'B2C'}`
    const g = nilGroups.get(key) ?? { expt: 0, nil: 0, ngsup: 0 }
    if (row.category === 'EXEMPT') g.expt += row.taxableValue
    else if (row.category === 'NIL_RATED') g.nil += row.taxableValue
    else g.ngsup += row.taxableValue
    nilGroups.set(key, g)
  }
  const nil = { inv: Array.from(nilGroups.entries()).map(([sply_ty, g]) => ({ sply_ty, expt_amt: r2(g.expt), nil_amt: r2(g.nil), ngsup_amt: r2(g.ngsup) })) }

  const hsnRows = [...p.hsn.b2b, ...p.hsn.b2c]
  const hsn = {
    data: hsnRows.map((row, i) => ({
      num: i + 1, hsn_sc: row.hsnCode === 'No HSN Code' ? '' : row.hsnCode, desc: row.description, uqc: row.uqc, qty: row.totalQuantity,
      txval: r2(row.taxableValue), iamt: r2(row.igstAmount), camt: r2(row.cgstAmount), samt: r2(row.sgstAmount), csamt: ZERO_CESS
    }))
  }

  return {
    gstin: p.gstin, fp: returnPeriod(p.dateFrom),
    ...(b2b.length > 0 ? { b2b } : {}),
    ...(b2cs.length > 0 ? { b2cs } : {}),
    ...(cdnr.length > 0 ? { cdnr } : {}),
    ...(nil.inv.length > 0 ? { nil } : {}),
    ...(hsn.data.length > 0 ? { hsn } : {})
  }
}

export function buildGstr3bJson(p: { gstin: string; dateFrom: string; preview: GSTR3BPreview; net: GstNetPayableReport }) {
  const { preview, net } = p
  const t = preview.table31
  const rcm = net.reverseCharge
  const otherItc = {
    iamt: r2(net.inputCredit.igst - rcm.igst),
    camt: r2(net.inputCredit.cgst - rcm.cgst),
    samt: r2(net.inputCredit.sgst - rcm.sgst)
  }
  const itcNet = { iamt: r2(net.inputCredit.igst), camt: r2(net.inputCredit.cgst), samt: r2(net.inputCredit.sgst), csamt: ZERO_CESS }

  return {
    gstin: p.gstin,
    ret_period: returnPeriod(p.dateFrom),
    sup_details: {
      osup_det: { txval: r2(t.taxableOutwardSupplies), iamt: r2(t.taxAmount.igst), camt: r2(t.taxAmount.cgst), samt: r2(t.taxAmount.sgst), csamt: ZERO_CESS },
      osup_zero: { txval: r2(t.zeroRatedSupplies), iamt: 0, csamt: ZERO_CESS },
      osup_nil_exmp: { txval: r2(t.exemptNilNonGstSupplies) },
      isup_rev: { txval: r2(preview.table31d.taxableValue), iamt: r2(rcm.igst), camt: r2(rcm.cgst), samt: r2(rcm.sgst), csamt: ZERO_CESS },
      osup_nongst: { txval: 0 }
    },
    inter_sup: {
      unreg_details: preview.table32.map((row) => ({ pos: stateCodeOf(row.state), txval: r2(row.taxableValue), iamt: r2(row.igstAmount) })),
      comp_details: [],
      uin_details: []
    },
    itc_elg: {
      itc_avl: [
        { ty: 'IMPG', iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS },
        { ty: 'IMPS', iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS },
        { ty: 'ISRC', iamt: r2(rcm.igst), camt: r2(rcm.cgst), samt: r2(rcm.sgst), csamt: ZERO_CESS },
        { ty: 'ISD', iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS },
        { ty: 'OTH', ...otherItc, csamt: ZERO_CESS }
      ],
      itc_rev: [
        { ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS },
        { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS }
      ],
      itc_net: itcNet,
      itc_inelg: [
        { ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS },
        { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS }
      ]
    },
    inward_sup: { isup_details: [{ ty: 'GST', inter: 0, intra: 0 }, { ty: 'NONGST', inter: 0, intra: 0 }] },
    intr_ltfee: { intr_details: { iamt: 0, camt: 0, samt: 0, csamt: ZERO_CESS } }
  }
}
