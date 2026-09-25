import { describe, it, expect } from 'vitest'
import { buildEwayBillJson, ewayProblems } from '../ewaybill-json.util'
import type { EInvoiceSource } from '../einvoice-json.util'

const base: EInvoiceSource = {
  invoiceNumber: 'INV-1', invoiceDate: '2026-09-05', isCreditNote: false, gstType: 'CGST_SGST', pricesIncludeTax: false,
  roundingAmount: 0, totalAmount: 2360, decimals: 2, buyerState: 'Maharashtra',
  seller: { gstin: '27AAAAA0000A1Z5', name: 'Acme', address: 'MG Road, Pune 411001', city: 'Pune', state: 'Maharashtra' },
  buyer: { gstin: '27BBBBB1111B1Z5', name: 'Buyer Ltd', address: 'Andheri, Mumbai 400053', city: 'Mumbai', state: 'Maharashtra' },
  lines: [
    { description: 'Flour', hsnCode: '1101', quantity: 10, unit: 'kg', taxRate: 18, taxAmount: 180, lineTotal: 1180 },
    { description: 'Sugar', hsnCode: '1701', quantity: 10, unit: 'kg', taxRate: 18, taxAmount: 180, lineTotal: 1180 }
  ]
}
const road = { mode: 'ROAD' as const, vehicleNumber: 'MH 12 AB 1234', distanceKm: 148.6 }

describe('ewayProblems', () => {
  it('is empty when the transport and the addresses are complete', () => {
    expect(ewayProblems(base, road)).toEqual([])
  })
  it('asks for a vehicle or transporter, a numeric HSN and a sensible vehicle number', () => {
    const p = ewayProblems({ ...base, lines: [{ ...base.lines[0], hsnCode: 'ABC' }] }, { mode: 'ROAD' })
    expect(p).toEqual(expect.arrayContaining(['A numeric HSN code (4 to 8 digits) on every line', 'A vehicle number or a transporter ID']))
    expect(ewayProblems(base, { mode: 'ROAD', vehicleNumber: 'XYZ' })).toContain('A vehicle number like MH12AB1234')
    expect(ewayProblems(base, { mode: 'RAIL', transporterId: '27AAAAA0000A1Z5' })).toEqual([])
  })
})

describe('buildEwayBillJson', () => {
  it('builds an intra-state bill with split rates and matching totals', () => {
    const j = buildEwayBillJson(base, road)
    const b = j.billLists[0]
    expect(b).toMatchObject({ supplyType: 'O', subSupplyType: 1, docType: 'INV', docNo: 'INV-1', docDate: '05/09/2026', fromPincode: 411001, toPincode: 400053, fromStateCode: 27, toStateCode: 27 })
    expect(b).toMatchObject({ totalValue: 2000, cgstValue: 180, sgstValue: 180, igstValue: 0, totInvValue: 2360, vehicleNo: 'MH12AB1234', transMode: '1', transDistance: '149', vehicleType: 'R' })
    expect(b.itemList[0]).toMatchObject({ hsnCode: 1101, qtyUnit: 'KGS', taxableAmount: 1000, cgstRate: 9, sgstRate: 9, igstRate: 0 })
    expect(Object.keys(b.itemList[0])).not.toContain('_cgst')
  })
  it('an inter-state bill carries IGST only', () => {
    const j = buildEwayBillJson({ ...base, gstType: 'IGST', buyerState: 'Karnataka', buyer: { ...base.buyer, gstin: '29BBBBB1111B1Z5' } }, road)
    const b = j.billLists[0]
    expect(b).toMatchObject({ igstValue: 360, cgstValue: 0, sgstValue: 0, toStateCode: 29 })
    expect(b.itemList[0]).toMatchObject({ igstRate: 18, cgstRate: 0 })
  })
  it('an unregistered buyer goes as URP', () => {
    const j = buildEwayBillJson({ ...base, buyer: { ...base.buyer, gstin: '' } }, road)
    expect(j.billLists[0].toGstin).toBe('URP')
  })
})
