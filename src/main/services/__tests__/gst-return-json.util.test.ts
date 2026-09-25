import { describe, it, expect } from 'vitest'
import { buildGstr1Json, buildGstr3bJson, portalDate, returnPeriod, stateCodeOf } from '../gst-return-json.util'

const gstr1 = {
  period: '2026-09-01 to 2026-09-30',
  b2b: [
    { gstin: '29ABCDE1234F1Z5', receiverName: 'Far Ltd', invoiceNumber: 'INV-1', invoiceDate: '2026-09-05', invoiceValue: 2360, placeOfSupply: 'Karnataka', reverseCharge: 'N', taxableValue: 1000, igstAmount: 180, cgstAmount: 0, sgstAmount: 0, rate: 18 },
    { gstin: '29ABCDE1234F1Z5', receiverName: 'Far Ltd', invoiceNumber: 'INV-1', invoiceDate: '2026-09-05', invoiceValue: 2360, placeOfSupply: 'Karnataka', reverseCharge: 'N', taxableValue: 1000, igstAmount: 50, cgstAmount: 0, sgstAmount: 0, rate: 5 }
  ],
  cdnr: [
    { gstin: '29ABCDE1234F1Z5', receiverName: 'Far Ltd', noteNumber: 'CN-1', noteDate: '2026-09-20', noteValue: -118, placeOfSupply: 'Karnataka', taxableValue: -100, igstAmount: -18, cgstAmount: 0, sgstAmount: 0, rate: 18 }
  ],
  b2cs: [
    { placeOfSupply: 'Maharashtra', rate: 18, taxableValue: 500, igstAmount: 0, cgstAmount: 45, sgstAmount: 45 },
    { placeOfSupply: '29-Karnataka', rate: 18, taxableValue: 200, igstAmount: 36, cgstAmount: 0, sgstAmount: 0 }
  ],
  nilExempt: [
    { category: 'EXEMPT', interState: false, registered: false, taxableValue: 300 },
    { category: 'NIL_RATED', interState: false, registered: false, taxableValue: 100 },
    { category: 'OUT_OF_SCOPE', interState: true, registered: true, taxableValue: 50 }
  ],
  summary: {}, stateUnknownCount: 0
} as never

const hsn = {
  period: '', summary: { totalTaxableValue: 0, totalTax: 0, rowCount: 1 }, stateUnknownCount: 0,
  b2b: [{ hsnCode: '1001', description: 'Wheat', uqc: 'KGS', totalQuantity: 10, totalValue: 1180, taxableValue: 1000, igstAmount: 0, cgstAmount: 90, sgstAmount: 90 }],
  b2c: [{ hsnCode: 'No HSN Code', description: 'Misc', uqc: 'PCS', totalQuantity: 1, totalValue: 10, taxableValue: 10, igstAmount: 0, cgstAmount: 0, sgstAmount: 0 }]
} as never

describe('portal helpers', () => {
  it('formats period, date and state code', () => {
    expect(returnPeriod('2026-09-01')).toBe('092026')
    expect(portalDate('2026-09-05')).toBe('05-09-2026')
    expect(stateCodeOf('Maharashtra')).toBe('27')
    expect(stateCodeOf('29-Karnataka')).toBe('29')
    expect(stateCodeOf('Narnia')).toBe('')
  })
})

describe('GSTR-1 JSON', () => {
  const json = buildGstr1Json({ gstin: '27AAAAA0000A1Z5', dateFrom: '2026-09-01', gstr1, hsn })

  it('groups B2B by buyer and invoice, one item per rate, with portal date and state code', () => {
    expect(json.gstin).toBe('27AAAAA0000A1Z5')
    expect(json.fp).toBe('092026')
    expect(json.b2b).toHaveLength(1)
    const inv = json.b2b![0].inv
    expect(inv).toHaveLength(1)
    expect(inv[0]).toMatchObject({ inum: 'INV-1', idt: '05-09-2026', val: 2360, pos: '29', rchrg: 'N', inv_typ: 'R' })
    expect(inv[0].itms).toHaveLength(2)
    expect(inv[0].itms[1]).toMatchObject({ num: 2, itm_det: { rt: 5, txval: 1000, iamt: 50 } })
  })

  it('B2CS marks intra and inter supplies', () => {
    expect(json.b2cs![0]).toMatchObject({ sply_ty: 'INTRA', pos: '27', rt: 18, camt: 45, samt: 45 })
    expect(json.b2cs![1]).toMatchObject({ sply_ty: 'INTER', pos: '29', iamt: 36 })
  })

  it('credit notes go out as positive figures', () => {
    const nt = json.cdnr![0].nt[0]
    expect(nt).toMatchObject({ ntty: 'C', nt_num: 'CN-1', nt_dt: '20-09-2026', val: 118 })
    expect((nt.itms[0] as { itm_det: { txval: number; iamt: number } }).itm_det).toMatchObject({ txval: 100, iamt: 18 })
  })

  it('nil, exempt and non-GST supplies are grouped by supply type', () => {
    expect(json.nil!.inv).toEqual(expect.arrayContaining([
      { sply_ty: 'INTRAB2C', expt_amt: 300, nil_amt: 100, ngsup_amt: 0 },
      { sply_ty: 'INTRB2B', expt_amt: 0, nil_amt: 0, ngsup_amt: 50 }
    ]))
  })

  it('HSN rows are numbered and a missing code is left blank', () => {
    expect(json.hsn!.data[0]).toMatchObject({ num: 1, hsn_sc: '1001', uqc: 'KGS', qty: 10, txval: 1000, camt: 90 })
    expect(json.hsn!.data[1].hsn_sc).toBe('')
  })

  it('an empty period leaves out the empty sections', () => {
    const empty = buildGstr1Json({ gstin: 'X', dateFrom: '2026-09-01', gstr1: { b2b: [], cdnr: [], b2cs: [], nilExempt: [] } as never, hsn: { b2b: [], b2c: [] } as never })
    expect(Object.keys(empty).sort()).toEqual(['fp', 'gstin'])
  })
})

describe('GSTR-3B JSON', () => {
  const preview = {
    table31: { taxableOutwardSupplies: 10000, zeroRatedSupplies: 0, exemptNilNonGstSupplies: 400, taxAmount: { igst: 100, cgst: 90, sgst: 90 } },
    table31d: { taxableValue: 1000, taxAmount: 180, expenseTaxNotComputable: false },
    table32: [{ state: 'Karnataka', taxableValue: 200, igstAmount: 36 }]
  } as never
  const net = {
    reverseCharge: { cgst: 0, sgst: 0, igst: 180, total: 180 },
    inputCredit: { cgst: 40, sgst: 40, igst: 230, total: 310 }
  } as never
  const json = buildGstr3bJson({ gstin: '27AAAAA0000A1Z5', dateFrom: '2026-09-01', preview, net })

  it('fills outward supplies, reverse charge and state-wise inter-state supplies', () => {
    expect(json.ret_period).toBe('092026')
    expect(json.sup_details.osup_det).toMatchObject({ txval: 10000, iamt: 100, camt: 90, samt: 90 })
    expect(json.sup_details.isup_rev).toMatchObject({ txval: 1000, iamt: 180 })
    expect(json.sup_details.osup_nil_exmp.txval).toBe(400)
    expect(json.inter_sup.unreg_details).toEqual([{ pos: '29', txval: 200, iamt: 36 }])
  })

  it('splits credit into reverse-charge and other, and the net equals the claimed total', () => {
    const avl = json.itc_elg.itc_avl
    expect(avl.find((x) => x.ty === 'ISRC')).toMatchObject({ iamt: 180 })
    expect(avl.find((x) => x.ty === 'OTH')).toMatchObject({ iamt: 50, camt: 40, samt: 40 })
    const total = avl.reduce((s, x) => s + x.iamt + x.camt + x.samt, 0)
    expect(total).toBe(json.itc_elg.itc_net.iamt + json.itc_elg.itc_net.camt + json.itc_elg.itc_net.samt)
    expect(total).toBe(310)
  })
})
