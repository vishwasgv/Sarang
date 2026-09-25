import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ dialog: { showSaveDialog: vi.fn() } }))
vi.mock('fs/promises', () => ({ writeFile: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../report.service', () => ({ reportService: {} }))

import { dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { getPrisma } from '../../database/db'
import { einvoiceService } from '../einvoice.service'

const IRN = 'a'.repeat(64)

const fullInvoice = (over: Record<string, unknown> = {}) => ({
  id: 'inv-1', invoiceNumber: 'INV-1', invoiceType: 'RETAIL', status: 'ACTIVE', invoiceDate: new Date('2026-09-05T12:00:00'),
  gstType: 'CGST_SGST', pricesIncludeTax: false, roundingAmount: 0, totalAmount: 1180, buyerState: null,
  customer: { customerName: 'Buyer Ltd', taxNumber: '27BBBBB1111B1Z5', address: 'Andheri, Mumbai 400053', city: 'Mumbai', state: 'Maharashtra' },
  items: [{ productName: 'Flour', hsnCode: '1101', quantity: 10, weightUnit: null, taxRate: 18, taxAmount: 180, lineTotal: 1180, discountAmount: 0 }],
  originalInvoice: null, ...over
})

const profile = { businessName: 'Acme', taxNumber: '27AAAAA0000A1Z5', address: 'MG Road, Pune 411001', city: 'Pune', state: 'Maharashtra', currencyCode: 'INR' }

describe('einvoiceService.exportJson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists what is missing instead of making a bad file', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      invoice: { findUnique: vi.fn().mockResolvedValue(fullInvoice({ customer: { customerName: 'X', taxNumber: null, address: '', city: '', state: '' } })) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue(profile) }
    } as never)
    const r = await einvoiceService.exportJson('inv-1')
    expect(r).toMatchObject({ success: false, error: { code: 'EINV-003' } })
    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
  })

  it('writes a one-invoice list for the portal', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      invoice: { findUnique: vi.fn().mockResolvedValue(fullInvoice()) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue(profile) }
    } as never)
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'C:/x/EINV_INV-1.json' } as never)
    const r = await einvoiceService.exportJson('inv-1')
    expect(r).toMatchObject({ success: true, data: { saved: true } })
    const body = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string)
    expect(body).toHaveLength(1)
    expect(body[0].DocDtls).toMatchObject({ Typ: 'INV', No: 'INV-1' })
  })

  it('refuses a cancelled invoice', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      invoice: { findUnique: vi.fn().mockResolvedValue(fullInvoice({ status: 'CANCELLED' })) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue(profile) }
    } as never)
    expect(await einvoiceService.exportJson('inv-1')).toMatchObject({ success: false, error: { code: 'EINV-002' } })
  })
})

describe('einvoiceService.saveIrn', () => {
  it('checks the IRN shape and refuses one already used on another invoice', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'inv-1', irn: IRN })
    vi.mocked(getPrisma).mockReturnValue({
      invoice: {
        findUnique: vi.fn().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-1' }),
        findFirst: vi.fn().mockResolvedValueOnce({ invoiceNumber: 'INV-0' }).mockResolvedValue(null),
        update
      }
    } as never)
    expect(await einvoiceService.saveIrn({ invoiceId: 'inv-1', irn: 'short' })).toMatchObject({ error: { code: 'EINV-004' } })
    expect(await einvoiceService.saveIrn({ invoiceId: 'inv-1', irn: IRN })).toMatchObject({ error: { code: 'EINV-005' } })
    const ok = await einvoiceService.saveIrn({ invoiceId: 'inv-1', irn: IRN.toUpperCase(), ackNo: ' 123 ', ackDate: '2026-09-06' })
    expect(ok.success).toBe(true)
    expect(update.mock.calls[0][0].data).toMatchObject({ irn: IRN, irnAckNo: '123' })
  })
})

describe('einvoiceService.register', () => {
  it('counts invoices to registered buyers with and without an IRN', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { invoiceNumber: 'A', invoiceType: 'RETAIL', invoiceDate: new Date('2026-09-01T12:00:00'), totalAmount: 100, irn: IRN, irnAckNo: '1', irnAckDate: new Date('2026-09-02T12:00:00'), customer: { customerName: 'C', taxNumber: 'G' } },
          { invoiceNumber: 'B', invoiceType: 'RETURN', invoiceDate: new Date('2026-09-03T12:00:00'), totalAmount: -50, irn: null, irnAckNo: null, irnAckDate: null, customer: { customerName: 'C', taxNumber: 'G' } }
        ])
      }
    } as never)
    const r = await einvoiceService.register({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(r.counts).toEqual({ withIrn: 1, withoutIrn: 1 })
    expect(r.rows[1]).toMatchObject({ kind: 'CREDIT_NOTE', irn: '' })
  })
})

describe('einvoiceService.exportEwayBill', () => {
  it('needs a vehicle or transporter, then writes the portal file', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      invoice: { findUnique: vi.fn().mockResolvedValue(fullInvoice()) },
      businessProfile: { findFirst: vi.fn().mockResolvedValue(profile) }
    } as never)
    const missing = await einvoiceService.exportEwayBill('inv-1', { mode: 'ROAD' })
    expect(missing).toMatchObject({ success: false, error: { code: 'EWB-001' } })

    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'C:/x/EWB_INV-1.json' } as never)
    const ok = await einvoiceService.exportEwayBill('inv-1', { mode: 'ROAD', vehicleNumber: 'MH12AB1234' })
    expect(ok).toMatchObject({ success: true, data: { saved: true } })
    const body = JSON.parse(vi.mocked(writeFile).mock.calls.at(-1)![1] as string)
    expect(body.billLists[0]).toMatchObject({ docNo: 'INV-1', vehicleNo: 'MH12AB1234' })
  })
})
