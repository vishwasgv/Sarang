import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ dialog: { showOpenDialog: vi.fn() } }))
vi.mock('fs/promises', () => ({ stat: vi.fn(), writeFile: vi.fn().mockResolvedValue(undefined), access: vi.fn() }))

import { dialog } from 'electron'
import { stat, writeFile, access } from 'fs/promises'
import { reportFileService, safeFileName, csvText } from '../report-file.service'

describe('safeFileName', () => {
  it('keeps a plain name, strips path parts and characters Windows refuses', () => {
    expect(safeFileName('Sales by Customer 2026-09')).toBe('Sales by Customer 2026-09')
    expect(safeFileName('..\\..\\evil/name?.csv')).toBe('name_.csv')
    expect(safeFileName('   ')).toBe('report')
    expect(safeFileName('a'.repeat(300))).toHaveLength(120)
  })
})

describe('csvText', () => {
  it('quotes commas, quotes and new lines and starts with a byte-order mark for Excel', () => {
    const t = csvText(['Name', 'Amount'], [['Acme, Inc', 10], ['He said "hi"', null], ['Line\nbreak', 2.5]])
    expect(t.startsWith('\ufeff')).toBe(true)
    expect(t).toContain('"Acme, Inc",10')
    expect(t).toContain('"He said ""hi""",')
    expect(t).toContain('"Line\nbreak",2.5')
  })
})

describe('reportFileService.save', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses a folder that does not exist', async () => {
    vi.mocked(stat).mockRejectedValue(new Error('ENOENT'))
    const r = await reportFileService.save({ folder: 'C:/nope', fileName: 'x', format: 'CSV', headers: ['a'], rows: [] })
    expect(r).toMatchObject({ success: false, error: { code: 'RPTFILE-001' } })
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('writes a CSV in the folder and adds (1) when the name is taken', async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as never)
    vi.mocked(access).mockResolvedValueOnce(undefined).mockRejectedValue(new Error('ENOENT'))
    const r = await reportFileService.save({ folder: 'C:/Reports', fileName: 'Sales.csv', format: 'CSV', headers: ['a'], rows: [[1]] })
    expect(r.success).toBe(true)
    const path = String(vi.mocked(writeFile).mock.calls[0][0]).replace(/\\/g, '/')
    expect(path.endsWith('/Reports/Sales (1).csv')).toBe(true)
  })

  it('writes an Excel file and never lets the name climb out of the folder', async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as never)
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'))
    const r = await reportFileService.save({ folder: 'C:/Reports', fileName: '../../secret', format: 'XLSX', headers: ['a', 'b'], rows: [[1, 2]] })
    expect(r.success).toBe(true)
    const path = String(vi.mocked(writeFile).mock.calls[0][0]).replace(/\\/g, '/')
    expect(path).toMatch(/\/Reports\/secret\.xlsx$/)
    expect(Buffer.isBuffer(vi.mocked(writeFile).mock.calls[0][1])).toBe(true)
  })
})

describe('reportFileService.chooseFolder', () => {
  it('returns null when cancelled and the folder when chosen', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] } as never)
    expect(await reportFileService.chooseFolder()).toEqual({ success: true, data: null })
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: false, filePaths: ['C:/Reports'] } as never)
    expect(await reportFileService.chooseFolder()).toEqual({ success: true, data: 'C:/Reports' })
  })
})
