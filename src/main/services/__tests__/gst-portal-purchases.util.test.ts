import { describe, it, expect } from 'vitest'
import { parsePortalPurchases, reconcilePurchases, normalizeInvoiceNumber, isoFromPortalDate, type BookBill } from '../gst-portal-purchases.util'

const gstr2b = {
  data: {
    gstin: '27AAAAA0000A1Z5', rtnprd: '092026',
    docdata: {
      b2b: [{
        ctin: '29abcde1234f1z5', trdnm: 'Far Ltd',
        inv: [
          { inum: 'INV/0022', dt: '05-09-2026', val: 1180, itcavl: 'Y', items: [{ num: 1, rt: 18, txval: 1000, igst: 180, cgst: 0, sgst: 0, cess: 0 }] },
          { inum: 'INV-23', dt: '06-09-2026', val: 590, itcavl: 'N', items: [{ num: 1, rt: 18, txval: 500, igst: 90 }] },
          { inum: 'INV-24', dt: '07-09-2026', val: 590, itcavl: 'Y', items: [{ num: 1, rt: 18, txval: 500, igst: 90 }] }
        ]
      }],
      cdnr: [{ ctin: '29ABCDE1234F1Z5', trdnm: 'Far Ltd', nt: [{ ntnum: 'CN-1', dt: '10-09-2026', val: 118, items: [{ txval: 100, igst: 18 }] }] }]
    }
  }
}

const gstr2a = {
  gstin: '27AAAAA0000A1Z5', fp: '092026',
  b2b: [{ ctin: '27ABCDE1234F1Z5', inv: [{ inum: 'A1', idt: '01-09-2026', val: 118, itms: [{ num: 1, itm_det: { rt: 18, txval: 100, camt: 9, samt: 9, csamt: 0 } }] }] }]
}

const bill = (over: Partial<BookBill>): BookBill => ({
  billId: 'b', billNumber: 'BILL-1', supplierGstin: '29ABCDE1234F1Z5', supplierName: 'Far Ltd', supplierInvoiceNumber: 'INV-22',
  date: '2026-09-05', taxable: 1000, igst: 180, cgst: 0, sgst: 0, tax: 180, reverseCharge: false, inPeriod: true, ...over
})

describe('portal parsing', () => {
  it('reads GSTR-2B invoices and credit notes', () => {
    const p = parsePortalPurchases(gstr2b)
    expect(p.period).toBe('092026')
    expect(p.docs).toHaveLength(4)
    expect(p.docs[0]).toMatchObject({ kind: 'INVOICE', ctin: '29ABCDE1234F1Z5', number: 'INV/0022', date: '2026-09-05', taxable: 1000, igst: 180, itcAvailable: true })
    expect(p.docs[1].itcAvailable).toBe(false)
    expect(p.docs[3]).toMatchObject({ kind: 'CREDIT_NOTE', number: 'CN-1', igst: 18 })
  })
  it('reads the older GSTR-2A layout', () => {
    const p = parsePortalPurchases(gstr2a)
    expect(p.docs[0]).toMatchObject({ number: 'A1', date: '2026-09-01', taxable: 100, cgst: 9, sgst: 9 })
  })
  it('an empty or odd file gives no documents instead of throwing', () => {
    expect(parsePortalPurchases(null).docs).toEqual([])
    expect(parsePortalPurchases({ data: 5 }).docs).toEqual([])
  })
})

describe('helpers', () => {
  it('normalises invoice numbers and dates', () => {
    expect(normalizeInvoiceNumber('INV/0022')).toBe(normalizeInvoiceNumber('inv-22'))
    expect(normalizeInvoiceNumber('0')).toBe('0')
    expect(isoFromPortalDate('05-09-2026')).toBe('2026-09-05')
  })
})

describe('reconciliation', () => {
  const portal = parsePortalPurchases(gstr2b)

  it('matches on supplier GSTIN and normalised invoice number, ignoring case and leading zeros', () => {
    const r = reconcilePurchases(portal, [bill({})])
    const row = r.rows.find((x) => x.invoiceNumber === 'INV/0022')!
    expect(row).toMatchObject({ status: 'MATCHED', billNumber: 'BILL-1', portalTax: 180, booksTax: 180 })
  })

  it('flags value differences, missing-in-books, credit notes for review and credit at risk', () => {
    const r = reconcilePurchases(portal, [
      bill({ tax: 170, igst: 170 }),
      bill({ billId: 'b9', billNumber: 'BILL-9', supplierInvoiceNumber: 'INV-99', tax: 90, igst: 90, taxable: 500 })
    ])
    expect(r.rows.find((x) => x.invoiceNumber === 'INV/0022')!.status).toBe('MISMATCH')
    expect(r.rows.find((x) => x.invoiceNumber === 'INV-23')!.status).toBe('MISSING_IN_BOOKS')
    expect(r.rows.find((x) => x.invoiceNumber === 'CN-1')!.status).toBe('REVIEW')
    expect(r.rows.find((x) => x.invoiceNumber === 'INV-99')!.status).toBe('MISSING_IN_PORTAL')
    expect(r.creditAtRisk).toBe(90)
    expect(r.counts).toMatchObject({ MISMATCH: 1, MISSING_IN_BOOKS: 2, REVIEW: 1, MISSING_IN_PORTAL: 1, MATCHED: 0 })
  })

  it('claimable total counts only matched invoices the portal marks claimable; reverse-charge bills are never at risk', () => {
    const r = reconcilePurchases(portal, [
      bill({}),
      bill({ billId: 'b2', billNumber: 'BILL-2', supplierInvoiceNumber: 'INV-23', tax: 90, igst: 90, taxable: 500 }),
      bill({ billId: 'b3', billNumber: 'BILL-3', supplierInvoiceNumber: 'RCM-1', reverseCharge: true, tax: 50, igst: 50 })
    ])
    expect(r.claimablePerPortal).toBe(180)
    expect(r.rows.find((x) => x.invoiceNumber === 'INV-23')).toMatchObject({ status: 'MATCHED', note: 'notClaimable' })
    expect(r.creditAtRisk).toBe(0)
  })

  it('a difference of one currency unit or less still matches', () => {
    const r = reconcilePurchases(portal, [bill({ tax: 180.6, igst: 180.6, taxable: 999.5 })])
    expect(r.rows.find((x) => x.invoiceNumber === 'INV/0022')!.status).toBe('MATCHED')
  })
})
