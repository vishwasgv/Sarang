import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ dialog: { showOpenDialog: vi.fn() } }))
vi.mock('fs/promises', () => ({ readFile: vi.fn() }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { dialog } from 'electron'
import { readFile } from 'fs/promises'
import { getPrisma } from '../../database/db'
import { gstReconciliationService } from '../gst-reconciliation.service'

const portalFile = {
  data: {
    gstin: '27AAAAA0000A1Z5', rtnprd: '092026',
    docdata: { b2b: [{ ctin: '29ABCDE1234F1Z5', trdnm: 'Far Ltd', inv: [{ inum: 'INV-22', dt: '05-09-2026', val: 1180, items: [{ txval: 1000, igst: 180 }] }] }] }
  }
}

function makeDb(bills: unknown[]) {
  return {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ state: 'Maharashtra', taxNumber: '27AAAAA0000A1Z5', currencyCode: 'INR' }) },
    bill: { findMany: vi.fn().mockResolvedValue(bills) }
  }
}

const bill = (over: Record<string, unknown>) => ({
  id: 'b1', billNumber: 'BILL-1', billDate: new Date('2026-09-05T12:00:00'), gstType: 'IGST', taxAmount: 180, totalAmount: 1180, isReverseCharge: false,
  supplierInvoiceNumber: 'inv/22', supplier: { supplierName: 'Far Ltd', taxNumber: '29ABCDE1234F1Z5', state: 'Karnataka' }, items: [{ taxRate: 18, taxAmount: 180 }], ...over
})

describe('gstReconciliationService.runFromFile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does nothing when the file dialog is cancelled', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] } as never)
    expect(await gstReconciliationService.runFromFile()).toEqual({ success: true, data: null })
  })

  it('matches the file against bills and flags a bill the supplier never reported', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['C:/dl/GSTR2B_092026.json'] } as never)
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(portalFile) as never)
    vi.mocked(getPrisma).mockReturnValue(makeDb([
      bill({}),
      bill({ id: 'b2', billNumber: 'BILL-2', supplierInvoiceNumber: 'INV-77', taxAmount: 90, totalAmount: 590 })
    ]) as never)
    const r = await gstReconciliationService.runFromFile()
    expect(r.success).toBe(true)
    const data = (r as { data: { counts: Record<string, number>; creditAtRisk: number; claimablePerPortal: number; fileName: string } }).data
    expect(data.counts).toMatchObject({ MATCHED: 1, MISSING_IN_PORTAL: 1 })
    expect(data.creditAtRisk).toBe(90)
    expect(data.claimablePerPortal).toBe(180)
    expect(data.fileName).toBe('GSTR2B_092026.json')
  })

  it('a bill from another month is not reported as missing from this month\'s file', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['x.json'] } as never)
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(portalFile) as never)
    vi.mocked(getPrisma).mockReturnValue(makeDb([bill({ id: 'b3', billDate: new Date('2026-08-05T12:00:00'), supplierInvoiceNumber: 'OLD-1' })]) as never)
    const r = await gstReconciliationService.runFromFile()
    expect((r as { data: { creditAtRisk: number } }).data.creditAtRisk).toBe(0)
  })

  it('explains an unreadable or empty file', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['x.json'] } as never)
    vi.mocked(readFile).mockResolvedValueOnce('not json' as never)
    expect(await gstReconciliationService.runFromFile()).toMatchObject({ success: false, error: { code: 'GSTREC-001' } })
    vi.mocked(readFile).mockResolvedValueOnce('{}' as never)
    expect(await gstReconciliationService.runFromFile()).toMatchObject({ success: false, error: { code: 'GSTREC-002' } })
  })
})
