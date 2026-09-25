import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() } }))
vi.mock('fs/promises', () => ({ readFile: vi.fn(), writeFile: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../valuation.service', () => ({ getProductCostsBatch: vi.fn().mockResolvedValue(new Map([['p1', 10]])) }))
vi.mock('../sales-lines.query', () => ({
  loadSalesLines: vi.fn().mockResolvedValue({ decimals: 2, lines: [
    { invoiceId: 'i1', taxable: 1000, tax: 180 }, { invoiceId: 'i1', taxable: 500, tax: 90 }, { invoiceId: 'i2', taxable: 200, tax: 36 }
  ] })
}))

import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { getPrisma } from '../../database/db'
import { branchSummaryService, checksumOf, parseSummaryFile, type BranchSummaryFile } from '../branch-summary.service'
import { BRANCH_REPORTS } from '../generic-reports.branches'

const figures = { sales: 5000, salesTax: 900, invoices: 12, purchases: 3000, expenses: 500, receivables: 700, payables: 400, stockValue: 9000, cashAndBank: 1500 }
function makeFile(over: Partial<BranchSummaryFile> = {}): BranchSummaryFile {
  const base = { branchName: 'Pune shop', periodFrom: '2026-08-01', periodTo: '2026-08-31', currency: 'INR', figures }
  return { format: 'sarang-branch-summary', version: 1, ...base, generatedAt: '2026-09-01T10:00:00.000Z', checksum: checksumOf(base), ...over }
}

describe('branch summary file rules', () => {
  it('accepts a file it made and refuses one whose figures were edited', () => {
    expect(parseSummaryFile(makeFile()).branchName).toBe('Pune shop')
    const edited = makeFile()
    edited.figures = { ...figures, sales: 9999 }
    expect(() => parseSummaryFile(edited)).toThrow(/changed after it was made/)
  })
  it('refuses files that are not summaries or have dates the wrong way round', () => {
    expect(() => parseSummaryFile({ hello: 'world' })).toThrow(/not a Sarang branch summary/)
    const base = { branchName: 'X', periodFrom: '2026-09-30', periodTo: '2026-09-01', currency: 'INR', figures }
    expect(() => parseSummaryFile({ format: 'sarang-branch-summary', version: 1, ...base, generatedAt: 'x', checksum: checksumOf(base) })).toThrow(/wrong way round/)
  })
  it('the checksum changes with any figure, the branch name or the dates', () => {
    const b = { branchName: 'A', periodFrom: '2026-08-01', periodTo: '2026-08-31', currency: 'INR', figures }
    const c = checksumOf(b)
    expect(checksumOf({ ...b, branchName: 'B' })).not.toBe(c)
    expect(checksumOf({ ...b, periodTo: '2026-08-30' })).not.toBe(c)
    expect(checksumOf({ ...b, figures: { ...figures, cashAndBank: 1 } })).not.toBe(c)
    expect(checksumOf(b)).toBe(c)
  })
})

describe('importing files', () => {
  beforeEach(() => vi.clearAllMocks())

  it('imports good files, replaces the same branch and dates, and reports the bad ones by name', async () => {
    const upsert = vi.fn().mockResolvedValue({})
    vi.mocked(getPrisma).mockReturnValue({ branchSummary: { upsert } } as never)
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['C:/in/a.json', 'C:/in/bad.json', 'C:/in/tampered.json'] } as never)
    const tampered = makeFile(); tampered.figures = { ...figures, sales: 1 }
    vi.mocked(readFile)
      .mockResolvedValueOnce(JSON.stringify(makeFile()) as never)
      .mockResolvedValueOnce('nonsense' as never)
      .mockResolvedValueOnce(JSON.stringify(tampered) as never)
    const r = await branchSummaryService.importFiles('u1')
    expect(r.success).toBe(true)
    const data = (r as { data: { imported: number; problems: { file: string; message: string }[] } }).data
    expect(data.imported).toBe(1)
    expect(data.problems.map((x) => x.file)).toEqual(['bad.json', 'tampered.json'])
    expect(upsert.mock.calls[0][0].where).toEqual({ branchName_periodFrom_periodTo: { branchName: 'Pune shop', periodFrom: '2026-08-01', periodTo: '2026-08-31' } })
  })

  it('does nothing when the dialog is cancelled', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] } as never)
    const r = await branchSummaryService.importFiles()
    expect((r as { data: { imported: number } }).data.imported).toBe(0)
  })
})

describe('exporting and consolidating', () => {
  it('writes a file with the checksum the importer will accept', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Head Office', currencyCode: 'INR' }) },
      bill: { findMany: vi.fn().mockResolvedValue([{ subtotal: 400, discountAmount: 50, balanceAmount: 300 }]) },
      expense: { findMany: vi.fn().mockResolvedValue([{ amount: 120 }]) },
      invoice: { findMany: vi.fn().mockResolvedValue([{ balanceAmount: 300 }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', quantity: 7 }]) },
      bankAccount: { findMany: vi.fn().mockResolvedValue([{ currentBalance: 1000 }, { currentBalance: 250 }]) }
    } as never)
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'C:/out/b.json' } as never)
    const r = await branchSummaryService.exportOwn({ branchName: 'Shop 2', dateFrom: '2026-08-01', dateTo: '2026-08-31' })
    expect(r).toMatchObject({ success: true, data: { saved: true } })
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string) as BranchSummaryFile
    expect(written.figures).toMatchObject({ sales: 1700, salesTax: 306, invoices: 2, purchases: 350, expenses: 120, receivables: 300, payables: 300, stockValue: 70, cashAndBank: 1250 })
    expect(() => parseSummaryFile(written)).not.toThrow()
  })

  it('consolidation lists this business first, then imported branches inside the dates', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Head Office', currencyCode: 'INR' }) },
      bill: { findMany: vi.fn().mockResolvedValue([]) }, expense: { findMany: vi.fn().mockResolvedValue([]) }, invoice: { findMany: vi.fn().mockResolvedValue([]) },
      inventory: { findMany: vi.fn().mockResolvedValue([]) }, bankAccount: { findMany: vi.fn().mockResolvedValue([]) },
      branchSummary: { findMany: vi.fn().mockResolvedValue([{ branchName: 'Pune shop', currency: 'USD', figures: JSON.stringify(figures) }]) }
    } as never)
    const r = await BRANCH_REPORTS.branchConsolidation.run({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })
    expect(r.rows.map((x) => x.branch)).toEqual(['Head Office', 'Pune shop'])
    expect(r.totals).toMatchObject({ sales: 6700 })
    expect(r.notes).toContain('branches.currencyMixed')
  })
})
