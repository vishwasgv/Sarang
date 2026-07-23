import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories run before top-level const initializers (import hoisting) —
// vi.hoisted keeps these mock fns accessible inside the factories below.
const { showSaveDialog, writeFile, unlink, loadURL, printToPDF, destroy } = vi.hoisted(() => ({
  showSaveDialog: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  loadURL: vi.fn().mockResolvedValue(undefined),
  printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf')),
  destroy: vi.fn()
}))

vi.mock('electron', () => {
  class MockBrowserWindow {
    webContents = { printToPDF: (...args: unknown[]) => printToPDF(...args) }
    loadURL(...args: unknown[]) { return loadURL(...args) }
    destroy(...args: unknown[]) { return destroy(...args) }
  }
  return {
    app: { getPath: vi.fn().mockReturnValue('/tmp') },
    dialog: { showSaveDialog: (...args: unknown[]) => showSaveDialog(...args) },
    BrowserWindow: MockBrowserWindow
  }
})

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => writeFile(...args),
  unlink: (...args: unknown[]) => unlink(...args)
}))

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { exportToCsv, exportToExcel, exportToPdf, generateReportHtml } from '../export.service'

beforeEach(() => vi.clearAllMocks())

// ─── CSV Export (RULE EXP002) ────────────────────────────────────────────────

describe('exportToCsv', () => {
  it('does nothing when the save dialog is cancelled', async () => {
    showSaveDialog.mockResolvedValue({ filePath: undefined })

    await exportToCsv({ filename: 'x.csv', headers: ['A'], rows: [[1]] })

    expect(writeFile).not.toHaveBeenCalled()
  })

  it('escapes commas, quotes, and newlines per RFC 4180', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.csv' })

    await exportToCsv({ filename: 'x.csv', headers: ['Name'], rows: [['Smith, "Bob"'], ['Line1\nLine2']] })

    const content = writeFile.mock.calls[0][1] as string
    expect(content).toContain('"Smith, ""Bob"""')
    expect(content).toContain('"Line1\nLine2"')
  })

  it('prefixes a UTF-8 BOM so Excel opens it correctly', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.csv' })

    await exportToCsv({ filename: 'x.csv', headers: ['A'], rows: [[1]] })

    const content = writeFile.mock.calls[0][1] as string
    expect(content.charCodeAt(0)).toBe(0xfeff)
  })

  it('appends the Aszurex branding footer', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.csv' })

    await exportToCsv({ filename: 'x.csv', headers: ['A'], rows: [[1]] })

    const content = writeFile.mock.calls[0][1] as string
    expect(content).toContain('Aszurex')
  })

  it('renders null/undefined cells as empty strings, not the literal text "null"', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.csv' })

    await exportToCsv({ filename: 'x.csv', headers: ['A', 'B'], rows: [[null, undefined]] })

    const content = writeFile.mock.calls[0][1] as string
    expect(content.split('\r\n')[1]).toBe(',')
  })
})

// ─── Excel Export ─────────────────────────────────────────────────────────────

describe('exportToExcel', () => {
  it('does nothing when the save dialog is cancelled', async () => {
    showSaveDialog.mockResolvedValue({ filePath: undefined })

    await exportToExcel({ filename: 'x.xlsx', sheets: [{ name: 'Sheet1', headers: ['A'], rows: [[1]] }] })

    expect(writeFile).not.toHaveBeenCalled()
  })

  it('writes a workbook buffer', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.xlsx' })

    await exportToExcel({ filename: 'x.xlsx', sheets: [{ name: 'Sheet1', headers: ['A'], rows: [[1]] }] })

    expect(writeFile).toHaveBeenCalledWith('/out/x.xlsx', expect.any(Buffer))
  })

  it('truncates sheet names to Excel\'s 31-character limit', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.xlsx' })
    const longName = 'A'.repeat(50)

    // XLSX.utils.book_append_sheet throws for names over 31 chars — this resolving
    // instead of rejecting proves the .slice(0, 31) truncation is actually applied.
    await expect(
      exportToExcel({ filename: 'x.xlsx', sheets: [{ name: longName, headers: ['A'], rows: [[1]] }] })
    ).resolves.toBeUndefined()
  })
})

// ─── Report HTML (used by PDF export) ────────────────────────────────────────

describe('generateReportHtml', () => {
  it('includes the business name, report title, and currency symbol', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: {
        findFirst: vi.fn().mockResolvedValue({ businessName: 'My Shop', address: '123 St', taxNumber: 'GST1', currencySymbol: '₹' })
      }
    } as never)

    const html = await generateReportHtml({ title: 'Sales Report', tables: [{ headers: ['A'], rows: [] }] })

    expect(html).toContain('My Shop')
    expect(html).toContain('Sales Report')
    expect(html).toContain('₹')
  })

  it('renders an empty-state row instead of an empty table when there are no rows', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue(null) } } as never)

    const html = await generateReportHtml({ title: 'Empty', tables: [{ headers: ['A', 'B'], rows: [] }] })

    expect(html).toContain('No data')
  })

  it('includes the Aszurex footer', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue(null) } } as never)

    const html = await generateReportHtml({ title: 'X', tables: [] })

    expect(html).toContain('Aszurex')
  })

  // Regression for a real defect found 2026-07-22: table cells, headers,
  // title, and business name/address were interpolated into the HTML with
  // no escaping at all, unlike print.service.ts's identically-purposed
  // escHtml() applied everywhere there. A customer/product/business name
  // containing `<`, `>`, or `"` (real, user-enterable data) could corrupt
  // the exported report's HTML/table structure.
  it('HTML-escapes a table cell containing markup-like characters instead of injecting it raw', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue(null) } } as never)

    const html = await generateReportHtml({
      title: 'Sales Report',
      tables: [{ headers: ['Customer'], rows: [['<script>alert(1)</script> & "Acme" \'Co\'']] }],
    })

    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Acme&quot; &#39;Co&#39;')
  })

  it('HTML-escapes the business name, title, subtitle, and table headers', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'A & B "Traders"', address: null, taxNumber: null, currencySymbol: '₹' }) }
    } as never)

    const html = await generateReportHtml({
      title: '<b>Report</b>',
      subtitle: 'Q1 <2026>',
      tables: [{ headers: ['Name & Co'], rows: [] }],
    })

    expect(html).toContain('A &amp; B &quot;Traders&quot;')
    expect(html).toContain('&lt;b&gt;Report&lt;/b&gt;')
    expect(html).toContain('Q1 &lt;2026&gt;')
    expect(html).toContain('Name &amp; Co')
    expect(html).not.toContain('<b>Report</b>')
  })

  it('still renders a real number cell correctly, unaffected by the new escaping', async () => {
    vi.mocked(getPrisma).mockReturnValue({ businessProfile: { findFirst: vi.fn().mockResolvedValue(null) } } as never)

    const html = await generateReportHtml({
      title: 'X',
      tables: [{ headers: ['Amount'], rows: [[1234.56]] }],
    })

    expect(html).toContain('<td>1234.56</td>')
  })
})

// ─── PDF Export ────────────────────────────────────────────────────────────────

describe('exportToPdf', () => {
  it('does nothing when the save dialog is cancelled', async () => {
    showSaveDialog.mockResolvedValue({ filePath: undefined })

    await exportToPdf({ html: '<html></html>', filename: 'x.pdf' })

    expect(loadURL).not.toHaveBeenCalled()
  })

  it('writes the printToPDF buffer and cleans up the temp file and hidden window', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.pdf' })

    await exportToPdf({ html: '<html></html>', filename: 'x.pdf' })

    expect(loadURL).toHaveBeenCalled()
    expect(printToPDF).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalledWith('/out/x.pdf', expect.anything())
    expect(destroy).toHaveBeenCalled()
    expect(unlink).toHaveBeenCalled()
  })

  it('still destroys the hidden window and cleans up the temp file if printToPDF throws', async () => {
    showSaveDialog.mockResolvedValue({ filePath: '/out/x.pdf' })
    printToPDF.mockRejectedValueOnce(new Error('boom'))

    await expect(exportToPdf({ html: '<html></html>', filename: 'x.pdf' })).rejects.toThrow('boom')
    expect(destroy).toHaveBeenCalled()
    expect(unlink).toHaveBeenCalled()
  })
})
