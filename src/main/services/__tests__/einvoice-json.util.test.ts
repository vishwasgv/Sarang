import { describe, it, expect } from 'vitest'
import { buildEInvoiceJson, einvoiceProblems, pincodeOf, unitCode, type EInvoiceSource } from '../einvoice-json.util'

const base: EInvoiceSource = {
  invoiceNumber: 'INV-2026-00001', invoiceDate: '2026-09-05', isCreditNote: false, gstType: 'CGST_SGST', pricesIncludeTax: false,
  roundingAmount: 0.4, totalAmount: 2360, decimals: 2, buyerState: 'Maharashtra',
  seller: { gstin: '27AAAAA0000A1Z5', name: 'Acme Traders', address: 'Shop 4, MG Road, Pune 411001', city: 'Pune', state: 'Maharashtra' },
  buyer: { gstin: '27BBBBB1111B1Z5', name: 'Buyer Pvt Ltd', address: 'Plot 9, Andheri, Mumbai 400053', city: 'Mumbai', state: 'Maharashtra' },
  lines: [
    { description: 'Wheat flour 10kg', hsnCode: '1101', quantity: 10, unit: 'kg', taxRate: 18, taxAmount: 180, lineTotal: 1180 },
    { description: 'Consulting', hsnCode: '998313', quantity: 1, unit: 'nos', taxRate: 18, taxAmount: 90, lineTotal: 590 }
  ]
}

describe('e-invoice helpers', () => {
  it('finds the pincode in an address and maps units', () => {
    expect(pincodeOf('Shop 4, MG Road, Pune 411001')).toBe('411001')
    expect(pincodeOf('No pin here')).toBe('')
    expect(unitCode('kg')).toBe('KGS')
    expect(unitCode('pcs')).toBe('PCS')
    expect(unitCode('bundle of joy')).toBe('OTH')
    expect(unitCode('')).toBe('OTH')
  })
})

describe('einvoiceProblems', () => {
  it('is empty for a complete invoice', () => {
    expect(einvoiceProblems(base)).toEqual([])
  })
  it('lists everything that is missing', () => {
    const bad = { ...base, seller: { ...base.seller, address: 'Pune' }, buyer: { ...base.buyer, gstin: '' }, lines: [{ ...base.lines[0], hsnCode: '' }] }
    expect(einvoiceProblems(bad)).toEqual(expect.arrayContaining([
      'Your business address with a 6-digit pincode', 'The customer GSTIN (e-invoices are for registered buyers)', 'An HSN/SAC code on every line'
    ]))
  })
})

describe('buildEInvoiceJson', () => {
  it('builds an intra-state invoice with CGST and SGST halves that add up', () => {
    const j = buildEInvoiceJson(base)
    expect(j.Version).toBe('1.1')
    expect(j.DocDtls).toEqual({ Typ: 'INV', No: 'INV-2026-00001', Dt: '05/09/2026' })
    expect(j.SellerDtls).toMatchObject({ Gstin: '27AAAAA0000A1Z5', Pin: 411001, Stcd: '27' })
    expect(j.BuyerDtls).toMatchObject({ Pos: '27', Pin: 400053, Stcd: '27' })
    expect(j.ItemList[0]).toMatchObject({ SlNo: '1', HsnCd: '1101', IsServc: 'N', Unit: 'KGS', AssAmt: 1000, TotAmt: 1000, UnitPrice: 100, CgstAmt: 90, SgstAmt: 90, IgstAmt: 0, TotItemVal: 1180 })
    expect(j.ItemList[1]).toMatchObject({ IsServc: 'Y', AssAmt: 500, CgstAmt: 45, SgstAmt: 45 })
    expect(j.ValDtls).toMatchObject({ AssVal: 1500, CgstVal: 135, SgstVal: 135, IgstVal: 0, RndOffAmt: 0.4, TotInvVal: 2360 })
  })

  it('an inter-state invoice carries IGST only', () => {
    const j = buildEInvoiceJson({ ...base, gstType: 'IGST', buyerState: 'Karnataka', buyer: { ...base.buyer, gstin: '29BBBBB1111B1Z5' } })
    expect(j.BuyerDtls.Pos).toBe('29')
    expect(j.ItemList[0]).toMatchObject({ IgstAmt: 180, CgstAmt: 0, SgstAmt: 0 })
    expect(j.ValDtls.IgstVal).toBe(270)
  })

  it('a credit note becomes CRN with the original invoice and positive amounts', () => {
    const j = buildEInvoiceJson({
      ...base, isCreditNote: true, roundingAmount: 0, totalAmount: -1180,
      original: { number: 'INV-2026-00001', date: '2026-09-05' },
      lines: [{ description: 'Wheat flour', hsnCode: '1101', quantity: -10, unit: 'KGS', taxRate: 18, taxAmount: -180, lineTotal: -1000 }]
    })
    expect(j.DocDtls.Typ).toBe('CRN')
    expect(j.PrecDocDtls).toEqual([{ InvNo: 'INV-2026-00001', InvDt: '05/09/2026' }])
    expect(j.ItemList[0]).toMatchObject({ Qty: 10, AssAmt: 1000, CgstAmt: 90, TotItemVal: 1180 })
    expect(j.ValDtls.TotInvVal).toBe(1180)
  })

  it('every line balances: taxable + tax = item value, and item values add to the invoice value before rounding', () => {
    const j = buildEInvoiceJson({ ...base, roundingAmount: 0, totalAmount: 1770 })
    const items = j.ItemList
    for (const i of items) expect(i.AssAmt + i.CgstAmt + i.SgstAmt + i.IgstAmt).toBeCloseTo(i.TotItemVal, 6)
    const v = j.ValDtls
    expect(v.AssVal + v.CgstVal + v.SgstVal + v.IgstVal + v.CesVal + v.RndOffAmt).toBeCloseTo(v.TotInvVal, 6)
  })
})
