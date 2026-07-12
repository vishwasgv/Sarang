import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({ readFileSync: vi.fn() }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../backup.service', () => ({ ensureRecentBackup: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { readFileSync } from 'fs'
import { parseDroppedFile } from '../import.service'

// Regression coverage for the per-module import cap fix: MAX_IMPORT_ROWS was a
// single flat 50,000 for every module, but docs/DATA_IMPORT_AND_MIGRATION_SPEC.md
// defines per-module caps (Products 10,000, Customers 10,000, Suppliers 5,000,
// Inventory 50,000, Opening balances 10,000). Live-verified: a 100,000-row
// Products file was correctly rejected, but nothing stopped a 50,000-row
// Suppliers file (10x the spec's 5,000 limit) from sailing through silently.

function makeCsv(headerLine: string, rowCount: number): string {
  const lines = [headerLine]
  for (let i = 1; i <= rowCount; i++) lines.push(`Row ${i}`)
  return lines.join('\n') + '\n'
}

describe('import.service — per-module row caps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a Suppliers file over its 5,000-row cap, even though it is under the old flat 50,000 cap', async () => {
    vi.mocked(readFileSync).mockReturnValue(makeCsv('supplierName', 6_000))

    const res = await parseDroppedFile('suppliers', 'fake.csv')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string; message: string } }).error.code).toBe('IMP-003')
    expect((res as { error: { message: string } }).error.message).toContain('5,000')
  })

  it('accepts a Suppliers file at exactly its 5,000-row cap', async () => {
    vi.mocked(readFileSync).mockReturnValue(makeCsv('supplierName', 5_000))

    const res = await parseDroppedFile('suppliers', 'fake.csv')

    expect(res.success).toBe(true)
  })

  it('rejects a Products file over its 10,000-row cap (previously allowed up to 50,000)', async () => {
    vi.mocked(readFileSync).mockReturnValue(makeCsv('productName', 10_001))

    const res = await parseDroppedFile('products', 'fake.csv')

    expect(res.success).toBe(false)
    expect((res as { error: { message: string } }).error.message).toContain('10,000')
  })

  it('still accepts an Inventory file up to 50,000 rows, matching the spec\'s higher cap for that module', async () => {
    vi.mocked(readFileSync).mockReturnValue(makeCsv('sku,quantity', 50_000))

    const res = await parseDroppedFile('inventory', 'fake.csv')

    expect(res.success).toBe(true)
  })

  it('rejects an Inventory file over its 50,000-row cap', async () => {
    vi.mocked(readFileSync).mockReturnValue(makeCsv('sku,quantity', 50_001))

    const res = await parseDroppedFile('inventory', 'fake.csv')

    expect(res.success).toBe(false)
    expect((res as { error: { message: string } }).error.message).toContain('50,000')
  })
})
