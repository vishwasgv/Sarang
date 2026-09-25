// GST reports classify by tax HEAD, never by presentation, split tax exactly, and equal the documents to the
// last minor unit. Seeded random invoices (exclusive and inclusive, invoice-level discounts, returns, all
// three presentations, known and unknown states) go through the Tax report, GSTR-1, the HSN summary and
// GSTR-3B and are compared with an independent integer oracle and with the documents' own header figures.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The property tests run thousands of documents; give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 120_000 })

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../blood-bank.service', () => ({ getBloodStock: vi.fn() }))
vi.mock('../logistics-analytics.service', () => ({ getLogisticsAnalytics: vi.fn() }))

import { getPrisma } from '../../database/db'
import { reportService } from '../report.service'
import { computeDocumentTotals, roundMoney } from '../../../shared/utils/money'
import type { GstType } from '../../../shared/utils/gst-presentation'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rng = () => number
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

const RATES = [0, 0, 0.25, 2.5, 3, 5, 12, 18, 18, 20, 28, 40] as const
const ZERO_CATEGORIES = ['NIL_RATED', 'EXEMPT', 'OUT_OF_SCOPE', 'ZERO_RATED', 'STANDARD'] as const
const HSN = ['1006', '0401', '8517', null] as const
const BIZ_STATE = 'Maharashtra'
const RANGE = { dateFrom: '2026-09-01', dateTo: '2026-09-30' }

type PartyKind = 'same' | 'other' | 'unknown'
const STATE_OF: Record<PartyKind, string | null> = { same: 'MH', other: 'Gujarat', unknown: null }

interface Doc {
  id: string
  isReturn: boolean
  inclusive: boolean
  partyKind: PartyKind
  registered: boolean
  gstType: GstType
  lines: Array<{ quantity: number; unitPrice: number; discountAmount: number; taxRate: number; hsn: string | null; category: string }>
  globalDiscount: number
}

function genDoc(rng: Rng, n: number, decimals: number): Doc {
  const lines = Array.from({ length: int(rng, 1, 5) }, () => {
    const rate = pick(rng, RATES)
    const quantity = pick(rng, [1, 2, 3, 5, 0.5, 1.25, 1.234, int(rng, 1, 40)])
    const unitPrice = pick(rng, [0.01, 0.99, 12.34, 99.99, 100, 333.33, int(rng, 1, 900000) / pick(rng, [1, 10, 100])])
    const gross = roundMoney(quantity * unitPrice, decimals)
    const discountAmount = rng() < 0.25 ? roundMoney(gross * rng(), decimals) : 0
    return { quantity, unitPrice, discountAmount, taxRate: rate, hsn: pick(rng, HSN), category: rate === 0 ? pick(rng, ZERO_CATEGORIES) : pick(rng, ['STANDARD', 'REDUCED']) }
  })
  const taxable = lines.reduce((s, l) => s + Math.max(0, roundMoney(l.quantity * l.unitPrice, decimals) - l.discountAmount), 0)
  return {
    id: `inv-${n}`,
    isReturn: rng() < 0.15,
    inclusive: rng() < 0.4,
    partyKind: pick(rng, ['same', 'same', 'other', 'other', 'unknown'] as const),
    registered: rng() < 0.4,
    gstType: pick(rng, ['CGST_SGST', 'IGST', 'GST'] as const),
    lines,
    globalDiscount: rng() < 0.4 ? roundMoney(taxable * rng() * 0.8, decimals) : 0
  }
}

// What the stored invoice looks like (billing createInvoice / returns.createReturn conventions).
function storeInvoice(doc: Doc, decimals: number) {
  const t = computeDocumentTotals(doc.lines, { decimals, globalDiscount: doc.globalDiscount, pricesIncludeTax: doc.inclusive })
  const sign = doc.isReturn ? -1 : 1
  const items = doc.lines.map((l, i) => {
    const r = t.lines[i]
    return {
      id: `${doc.id}-${i}`, invoiceId: doc.id, quantity: l.quantity, unitPrice: l.unitPrice, discountAmount: r.discountAmount,
      taxRate: l.taxRate, taxAmount: r.tax, lineTotal: doc.isReturn ? -r.taxable : r.total,
      hsnCode: l.hsn, productName: `Item ${l.hsn ?? 'none'}`, weightUnit: null, product: { unit: 'PCS' }, taxCategory: l.category
    }
  })
  const invoice = {
    id: doc.id, invoiceNumber: doc.id.toUpperCase(), invoiceDate: new Date('2026-09-15T10:00:00'), status: 'ACTIVE',
    invoiceType: doc.isReturn ? 'RETURN' : 'RETAIL', pricesIncludeTax: doc.inclusive, gstType: doc.gstType,
    buyerState: null as string | null,
    subtotal: sign * t.subtotal, discountAmount: t.discountAmount, taxAmount: t.taxAmount, totalAmount: sign * t.totalAmount,
    customer: { customerName: 'C', taxNumber: doc.registered ? (STATE_OF[doc.partyKind] ? '27AAAAA0000A1Z5' : 'REGISTERED-NO-STATE') : null, state: STATE_OF[doc.partyKind] },
    items
  }
  return { invoice, totals: t, sign }
}

interface Expect {
  taxable: number; tax: number
  cgst: number; sgst: number; igst: number
  byRate: Map<number, { cgstTaxable: number; igstTaxable: number; cgst: number; sgst: number; igst: number }>
  taxedTaxable: number; zeroRated: number; nilExemptOther: number
  nil: Record<string, number>
  unknownStateDocs: number
  allTaxable: number
  headerTaxable: number
  headerTax: number
}

// Independent integer oracle. Head: stored CGST_SGST/IGST as is; combined GST from the place of supply.
function oracle(docs: Doc[], decimals: number): Expect {
  const f = 10 ** decimals
  const e: Expect = { taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0, byRate: new Map(), taxedTaxable: 0, zeroRated: 0, nilExemptOther: 0, nil: { NIL_RATED: 0, EXEMPT: 0, OUT_OF_SCOPE: 0 }, unknownStateDocs: 0, allTaxable: 0, headerTaxable: 0, headerTax: 0 }
  for (const d of docs) {
    const { invoice, sign } = storeInvoice(d, decimals)
    const sameState = d.partyKind === 'same'
    const known = d.partyKind !== 'unknown'
    const head = d.gstType === 'IGST' ? 'IGST' : d.gstType === 'CGST_SGST' ? 'CGST_SGST' : (known ? (sameState ? 'CGST_SGST' : 'IGST') : 'CGST_SGST')
    if (d.gstType === 'GST' && !known && invoice.items.some(i => i.taxRate > 0)) e.unknownStateDocs++
    e.headerTaxable += Math.round((invoice.subtotal + (d.isReturn ? invoice.discountAmount : -invoice.discountAmount)) * f)
    e.headerTax += sign * Math.round(invoice.taxAmount * f)
    const groupTax = new Map<number, number>()
    for (const it of invoice.items) {
      const taxableMinor = sign * Math.round((d.isReturn ? Math.abs(it.lineTotal) : it.lineTotal - it.taxAmount) * f)
      const taxMinor = sign * Math.round(it.taxAmount * f)
      e.allTaxable += taxableMinor
      const cat = it.taxRate === 0 ? (['STANDARD', 'REDUCED'].includes(it.taxCategory) ? 'NIL_RATED' : it.taxCategory) : 'STANDARD'
      if (it.taxRate === 0) {
        if (cat === 'ZERO_RATED') e.zeroRated += taxableMinor
        else e.nilExemptOther += taxableMinor
        if (cat in e.nil) e.nil[cat] += taxableMinor
        continue
      }
      e.taxable += taxableMinor
      e.tax += taxMinor
      groupTax.set(it.taxRate, (groupTax.get(it.taxRate) ?? 0) + Math.round(it.taxAmount * f))
      const r = e.byRate.get(it.taxRate) ?? { cgstTaxable: 0, igstTaxable: 0, cgst: 0, sgst: 0, igst: 0 }
      if (head === 'IGST') { r.igstTaxable += taxableMinor; r.igst += taxMinor } else r.cgstTaxable += taxableMinor
      e.byRate.set(it.taxRate, r)
    }
    for (const [rate, t] of groupTax) {
      const r = e.byRate.get(rate)!
      if (head === 'IGST') { e.igst += sign * t } else {
        const first = Math.floor(t / 2)
        r.cgst += sign * first
        r.sgst += sign * (t - first)
        e.cgst += sign * first
        e.sgst += sign * (t - first)
      }
    }
  }
  return e
}

function makeDb(docs: Doc[], decimals: number, currencyCode = 'INR') {
  const stored = docs.map(d => storeInvoice(d, decimals).invoice)
  const itemRows = stored.flatMap(inv => inv.items.map(i => ({
    ...i,
    invoice: { invoiceDate: inv.invoiceDate, gstType: inv.gstType, invoiceType: inv.invoiceType, pricesIncludeTax: inv.pricesIncludeTax, buyerState: inv.buyerState, customer: { state: inv.customer.state } }
  })))
  return {
    invoice: { findMany: vi.fn().mockResolvedValue(stored) },
    invoiceItem: { findMany: vi.fn().mockResolvedValue(itemRows) },
    taxConfiguration: { findMany: vi.fn().mockResolvedValue([]) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxModel: 'GST', state: BIZ_STATE, currencyCode }) },
    bill: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) }
  }
}

const m = (x: number, f: number) => x / f + 0
beforeEach(() => vi.clearAllMocks())

describe('GST reports classify by tax head, split exactly and equal the documents', () => {
  it('2000 random invoices (both pricing modes, discounts, returns, all presentations, known and unknown states) match the integer oracle to the minor unit', async () => {
    const rng = mulberry32(2026)
    for (const [currencyCode, decimals, count] of [['INR', 2, 1500], ['KWD', 3, 250], ['JPY', 0, 250]] as const) {
      const docs = Array.from({ length: count }, (_, n) => genDoc(rng, n, decimals))
      const f = 10 ** decimals
      const e = oracle(docs, decimals)
      vi.mocked(getPrisma).mockReturnValue(makeDb(docs, decimals, currencyCode) as never)
      const tag = `${currencyCode}`

      // ---- Tax report
      const tr = await reportService.generateTaxReport(RANGE)
      expect(tr.summary.totalTaxableAmount, tag).toBe(m(e.taxable, f))
      expect(tr.summary.totalTaxCollected, tag).toBe(m(e.tax, f))
      const sumRows = (type: string) => tr.rows.filter(r => r.taxType === type).reduce((s, r) => s + Math.round(r.taxCollected * f), 0)
      expect(sumRows('CGST'), tag).toBe(e.cgst)
      expect(sumRows('SGST'), tag).toBe(e.sgst)
      expect(sumRows('IGST'), tag).toBe(e.igst)
      expect(e.cgst + e.sgst + e.igst, tag).toBe(e.tax)
      for (const [rate, r] of e.byRate) {
        const cg = tr.rows.find(x => x.taxType === 'CGST' && x.rate === rate / 2)
        const sg = tr.rows.find(x => x.taxType === 'SGST' && x.rate === rate / 2)
        const ig = tr.rows.find(x => x.taxType === 'IGST' && x.rate === rate)
        if (r.cgst !== 0 || r.sgst !== 0 || r.cgstTaxable !== 0) {
          expect(Math.round(cg!.taxCollected * f), `${tag} cgst ${rate}`).toBe(r.cgst)
          expect(Math.round(sg!.taxCollected * f), `${tag} sgst ${rate}`).toBe(r.sgst)
          expect(Math.round((cg!.taxableAmount + sg!.taxableAmount) * f), `${tag} cgst taxable ${rate}`).toBe(r.cgstTaxable)
        }
        if (r.igstTaxable !== 0 || r.igst !== 0) {
          expect(Math.round(ig!.taxCollected * f), `${tag} igst ${rate}`).toBe(r.igst)
          expect(Math.round(ig!.taxableAmount * f), `${tag} igst taxable ${rate}`).toBe(r.igstTaxable)
        }
      }
      expect(tr.stateUnknownCount, tag).toBe(e.unknownStateDocs)

      // ---- GSTR-1
      const g1 = await reportService.generateGSTR1(RANGE)
      expect(Math.round(g1.summary.totalCgst * f), `${tag} g1 cgst`).toBe(e.cgst)
      expect(Math.round(g1.summary.totalSgst * f), `${tag} g1 sgst`).toBe(e.sgst)
      expect(Math.round(g1.summary.totalIgst * f), `${tag} g1 igst`).toBe(e.igst)
      const g1Taxable = [...g1.b2b, ...g1.b2cs].reduce((s, r) => s + Math.round(r.taxableValue * f), 0)
      expect(g1Taxable, `${tag} g1 taxable`).toBe(e.taxable + e.zeroRated)
      expect(Math.round(g1.summary.totalNilRated * f), tag).toBe(e.nil.NIL_RATED)
      expect(Math.round(g1.summary.totalExempt * f), tag).toBe(e.nil.EXEMPT)
      expect(Math.round(g1.summary.totalNonGst * f), tag).toBe(e.nil.OUT_OF_SCOPE)
      expect(g1.stateUnknownCount, tag).toBe(e.unknownStateDocs)
      // every b2b/b2cs row: CGST + SGST + IGST equals its own tax share, never half a minor unit
      for (const r of [...g1.b2b, ...g1.b2cs]) {
        for (const v of [r.cgstAmount, r.sgstAmount, r.igstAmount, r.taxableValue]) expect(Math.abs(Math.round(v * f) - v * f) < 1e-6, `${tag} ${JSON.stringify(r)}`).toBe(true)
      }

      // ---- HSN summary
      const hsn = await reportService.generateHSNSummaryReport(RANGE)
      const hs = [...hsn.b2b, ...hsn.b2c]
      expect(hs.reduce((s, r) => s + Math.round(r.cgstAmount * f), 0), `${tag} hsn cgst`).toBe(e.cgst)
      expect(hs.reduce((s, r) => s + Math.round(r.sgstAmount * f), 0), `${tag} hsn sgst`).toBe(e.sgst)
      expect(hs.reduce((s, r) => s + Math.round(r.igstAmount * f), 0), `${tag} hsn igst`).toBe(e.igst)
      expect(Math.round(hsn.summary.totalTaxableValue * f), `${tag} hsn taxable`).toBe(e.allTaxable)
      expect(Math.round(hsn.summary.totalTax * f), `${tag} hsn tax`).toBe(e.tax)
      expect(hsn.stateUnknownCount, tag).toBe(e.unknownStateDocs)

      // ---- GSTR-3B
      const g3 = await reportService.generateGSTR3BPreview(RANGE)
      expect(Math.round(g3.table31.taxableOutwardSupplies * f), `${tag} 3b taxable`).toBe(e.taxable)
      expect(Math.round(g3.table31.zeroRatedSupplies * f), `${tag} 3b zero`).toBe(e.zeroRated)
      expect(Math.round(g3.table31.exemptNilNonGstSupplies * f), `${tag} 3b exempt`).toBe(e.nilExemptOther)
      expect(Math.round(g3.table31.taxAmount.cgst * f), `${tag} 3b cgst`).toBe(e.cgst)
      expect(Math.round(g3.table31.taxAmount.sgst * f), `${tag} 3b sgst`).toBe(e.sgst)
      expect(Math.round(g3.table31.taxAmount.igst * f), `${tag} 3b igst`).toBe(e.igst)
      expect(g3.stateUnknownCount, tag).toBe(e.unknownStateDocs)

      // ---- the four reports agree with each other and with the documents' own headers
      expect(g1Taxable + e.nil.NIL_RATED + e.nil.EXEMPT + e.nil.OUT_OF_SCOPE, tag).toBe(e.allTaxable)
      expect(e.taxable + e.zeroRated + e.nilExemptOther, tag).toBe(e.allTaxable)
      expect(e.allTaxable, `${tag} sum of invoice (subtotal - discount)`).toBe(e.headerTaxable)
      expect(e.tax, `${tag} sum of invoice tax`).toBe(e.headerTax)
    }
  })

  it('the presentation never changes a report: combined GST files under the same head as the equivalent CGST_SGST or IGST document', async () => {
    const rng = mulberry32(77)
    const decimals = 2
    const f = 100
    const docs = Array.from({ length: 800 }, (_, n) => genDoc(rng, n, decimals)).filter(d => d.partyKind !== 'unknown')
    const asHead = docs.map(d => ({ ...d, gstType: (d.partyKind === 'same' ? 'CGST_SGST' : 'IGST') as GstType }))
    const asCombined = docs.map(d => ({ ...d, gstType: 'GST' as GstType }))
    const run = async (set: Doc[]) => {
      vi.mocked(getPrisma).mockReturnValue(makeDb(set, decimals) as never)
      return {
        tax: await reportService.generateTaxReport(RANGE),
        g1: await reportService.generateGSTR1(RANGE),
        hsn: await reportService.generateHSNSummaryReport(RANGE),
        g3: await reportService.generateGSTR3BPreview(RANGE)
      }
    }
    expect(await run(asCombined)).toEqual(await run(asHead))
    void f
  })

  it('combined GST documents with no known state are counted, filed as CGST + SGST, and reported as a warning count', async () => {
    const mk = (id: string, gstType: GstType, partyKind: PartyKind): Doc => ({ id, isReturn: false, inclusive: false, partyKind, registered: false, gstType, globalDiscount: 0, lines: [{ quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18, hsn: '1006', category: 'STANDARD' }] })
    const docs = [mk('a', 'GST', 'unknown'), mk('b', 'GST', 'unknown'), mk('c', 'GST', 'same'), mk('d', 'CGST_SGST', 'unknown'), mk('e', 'IGST', 'unknown')]
    vi.mocked(getPrisma).mockReturnValue(makeDb(docs, 2) as never)
    const g1 = await reportService.generateGSTR1(RANGE)
    expect(g1.stateUnknownCount).toBe(2)
    // a, b, c, d on CGST + SGST (18 each), e on IGST
    expect(g1.summary.totalCgst).toBe(36)
    expect(g1.summary.totalSgst).toBe(36)
    expect(g1.summary.totalIgst).toBe(18)
    expect((await reportService.generateTaxReport(RANGE)).stateUnknownCount).toBe(2)
    expect((await reportService.generateHSNSummaryReport(RANGE)).stateUnknownCount).toBe(2)
    expect((await reportService.generateGSTR3BPreview(RANGE)).stateUnknownCount).toBe(2)
  })

  it('CGST and SGST are exact when the tax is an odd number of minor units: 3 paise, per rate', async () => {
    // 100 at 18% on one line = 18.00; a 1.00 line at 3% = 0.03 -> CGST 0.01, SGST 0.02
    const doc: Doc = { id: 'x', isReturn: false, inclusive: false, partyKind: 'same', registered: false, gstType: 'CGST_SGST', globalDiscount: 0, lines: [{ quantity: 1, unitPrice: 1, discountAmount: 0, taxRate: 3, hsn: '7113', category: 'REDUCED' }] }
    vi.mocked(getPrisma).mockReturnValue(makeDb([doc], 2) as never)
    const g1 = await reportService.generateGSTR1(RANGE)
    expect(g1.b2cs[0].cgstAmount).toBe(0.01)
    expect(g1.b2cs[0].sgstAmount).toBe(0.02)
    expect(g1.b2cs[0].cgstAmount + g1.b2cs[0].sgstAmount).toBe(0.03)
    const tr = await reportService.generateTaxReport(RANGE)
    expect(tr.rows.find(r => r.taxType === 'CGST')!.taxCollected).toBe(0.01)
    expect(tr.rows.find(r => r.taxType === 'SGST')!.taxCollected).toBe(0.02)
  })
})

describe('gap 3.11: tax-exclusive invoices with an invoice-level discount', () => {
  // 2 x 100.00 at 18% with a 20.00 invoice-level discount: taxable 180.00, tax 32.40, total 212.40
  const doc: Doc = { id: 'g', isReturn: false, inclusive: false, partyKind: 'same', registered: false, gstType: 'CGST_SGST', globalDiscount: 20, lines: [{ quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18, hsn: '1006', category: 'STANDARD' }, { quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18, hsn: '1006', category: 'STANDARD' }] }

  it('GSTR-1, HSN, Tax report and GSTR-3B report taxable value 180.00 and tax 32.40, the invoice figures', async () => {
    const { invoice } = storeInvoice(doc, 2)
    expect([invoice.subtotal, invoice.discountAmount, invoice.taxAmount, invoice.totalAmount]).toEqual([200, 20, 32.4, 212.4])
    vi.mocked(getPrisma).mockReturnValue(makeDb([doc], 2) as never)
    const g1 = await reportService.generateGSTR1(RANGE)
    expect(g1.b2cs.reduce((s, r) => s + r.taxableValue, 0)).toBe(180)
    expect(roundMoney(g1.summary.totalCgst + g1.summary.totalSgst, 2)).toBe(32.4)
    const hsn = await reportService.generateHSNSummaryReport(RANGE)
    expect(hsn.summary.totalTaxableValue).toBe(180)
    expect(hsn.summary.totalTax).toBe(32.4)
    const tr = await reportService.generateTaxReport(RANGE)
    expect(tr.summary.totalTaxableAmount).toBe(180)
    expect(tr.summary.totalTaxCollected).toBe(32.4)
    const g3 = await reportService.generateGSTR3BPreview(RANGE)
    expect(g3.table31.taxableOutwardSupplies).toBe(180)
    expect(roundMoney(g3.table31.taxAmount.cgst + g3.table31.taxAmount.sgst, 2)).toBe(32.4)
  })

  it('an inclusive invoice with the same discount reports its stored taxable value too', async () => {
    const inc = { ...doc, id: 'h', inclusive: true }
    const { invoice } = storeInvoice(inc, 2)
    vi.mocked(getPrisma).mockReturnValue(makeDb([inc], 2) as never)
    const tr = await reportService.generateTaxReport(RANGE)
    expect(tr.summary.totalTaxableAmount).toBe(roundMoney(invoice.subtotal - invoice.discountAmount, 2))
    expect(tr.summary.totalTaxCollected).toBe(invoice.taxAmount)
  })
})

describe('gap 3.15: the Discount report is tax-exclusive and includes invoice-level discounts', () => {
  it('total discount equals the sum of the invoices\' stored discount, for exclusive and inclusive documents and returns: 1500 random invoices', async () => {
    const rng = mulberry32(15)
    const decimals = 2
    const f = 100
    const docs = Array.from({ length: 1500 }, (_, n) => genDoc(rng, n, decimals))
    const stored = docs.map(d => storeInvoice(d, decimals).invoice).map(inv => ({
      ...inv, createdBy: { fullName: 'Cashier' },
      items: inv.items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.taxRate }))
    }))
    vi.mocked(getPrisma).mockReturnValue({ invoice: { findMany: vi.fn().mockResolvedValue(stored) }, businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR', state: BIZ_STATE }) } } as never)
    const r = await reportService.generateDiscountReport(RANGE)
    const want = stored.reduce((s, inv) => s + (inv.invoiceType === 'RETURN' ? -1 : 1) * Math.round(inv.discountAmount * f), 0)
    expect(Math.round(r.summary.totalDiscountGiven * f)).toBe(want)
    // line rows plus the invoice-level part explain the total exactly
    const lineSum = r.rows.reduce((s, row) => s + Math.round(row.discountAmount * f), 0)
    expect(lineSum + Math.round(r.invoiceLevelDiscount * f)).toBe(want)
    // per-staff figures also add to the total
    expect(r.byStaff.reduce((s, x) => s + Math.round(x.discountGiven * f), 0)).toBe(want)
  })

  it('a 20.00 invoice-level discount is reported as invoice-level discount, not lost', async () => {
    const doc: Doc = { id: 'g', isReturn: false, inclusive: false, partyKind: 'same', registered: false, gstType: 'GST', globalDiscount: 20, lines: [{ quantity: 1, unitPrice: 100, discountAmount: 10, taxRate: 18, hsn: '1006', category: 'STANDARD' }, { quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18, hsn: '1006', category: 'STANDARD' }] }
    const inv = storeInvoice(doc, 2).invoice
    const stored = [{ ...inv, createdBy: { fullName: 'A' }, items: inv.items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.taxRate })) }]
    vi.mocked(getPrisma).mockReturnValue({ invoice: { findMany: vi.fn().mockResolvedValue(stored) }, businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) } } as never)
    const r = await reportService.generateDiscountReport(RANGE)
    expect(r.summary.totalDiscountGiven).toBe(30)
    expect(r.invoiceLevelDiscount).toBe(20)
    expect(r.rows.map(x => x.discountAmount)).toEqual([10])
  })

  it('an inclusive document shows its discount without the tax it contained', async () => {
    // 1 x 118.00 inclusive at 18%, 18.00 discount entered inclusive: 100 - 15.25 = 84.75 exclusive discount
    const doc: Doc = { id: 'i', isReturn: false, inclusive: true, partyKind: 'same', registered: false, gstType: 'CGST_SGST', globalDiscount: 0, lines: [{ quantity: 1, unitPrice: 118, discountAmount: 18, taxRate: 18, hsn: '1006', category: 'STANDARD' }] }
    const inv = storeInvoice(doc, 2).invoice
    const stored = [{ ...inv, createdBy: { fullName: 'A' }, items: inv.items.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, taxRate: i.taxRate })) }]
    vi.mocked(getPrisma).mockReturnValue({ invoice: { findMany: vi.fn().mockResolvedValue(stored) }, businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) } } as never)
    const r = await reportService.generateDiscountReport(RANGE)
    expect(r.summary.totalDiscountGiven).toBe(inv.discountAmount)
    expect(r.rows[0].discountAmount).toBe(inv.discountAmount)
    expect(r.rows[0].discountAmount).toBeLessThan(18)
  })
})
