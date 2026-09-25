import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ dialog: { showSaveDialog: vi.fn() } }))
vi.mock('fs/promises', () => ({ writeFile: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../report.service', () => ({
  reportService: {
    generateGSTR1: vi.fn().mockResolvedValue({ b2b: [], cdnr: [], b2cs: [], nilExempt: [] }),
    generateHSNSummaryReport: vi.fn().mockResolvedValue({ b2b: [], b2c: [] }),
    generateGSTR3BPreview: vi.fn()
  }
}))

import { dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { getPrisma } from '../../database/db'
import { gstReturnsService, monthRange } from '../gst-returns.service'

const withGstin = (taxNumber: string | null) =>
  vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ taxNumber }) } } as never)

describe('monthRange', () => {
  it('gives the first and last day, including leap February', () => {
    expect(monthRange('2026-09')).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    expect(monthRange('2028-02')).toEqual({ dateFrom: '2028-02-01', dateTo: '2028-02-29' })
    expect(monthRange('2026-12').dateTo).toBe('2026-12-31')
  })
  it('rejects anything that is not a month', () => {
    expect(() => monthRange('')).toThrow()
    expect(() => monthRange('2026-13')).toThrow()
  })
})

describe('gstReturnsService.exportGstr1', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the GSTIN first when it is missing', async () => {
    withGstin(null)
    const r = await gstReturnsService.exportGstr1('2026-09')
    expect(r).toMatchObject({ success: false, error: { code: 'GSTRET-002' } })
    expect(dialog.showSaveDialog).not.toHaveBeenCalled()
  })

  it('writes the file the user chooses and stops quietly when they cancel', async () => {
    withGstin('27AAAAA0000A1Z5')
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: 'C:/x/GSTR1_092026.json' } as never)
    const ok = await gstReturnsService.exportGstr1('2026-09')
    expect(ok).toEqual({ success: true, data: { saved: true, path: 'C:/x/GSTR1_092026.json' } })
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string)
    expect(written).toMatchObject({ gstin: '27AAAAA0000A1Z5', fp: '092026' })

    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: undefined } as never)
    const cancelled = await gstReturnsService.exportGstr1('2026-09')
    expect(cancelled).toEqual({ success: true, data: { saved: false } })
    expect(writeFile).toHaveBeenCalledTimes(1)
  })
})
