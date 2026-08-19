import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { priceMarkdownService } from '../price-markdown.service'

function makeMarkdown(overrides: Record<string, unknown> = {}) {
  return {
    id: 'markdown-1', productId: 'prod-1', originalPrice: 400, markdownPrice: 300,
    startDate: new Date(), endDate: new Date(Date.now() + 7 * 86400000), status: 'ACTIVE', revertedAt: null,
    product: { id: 'prod-1', productName: 'Old Sweater', sku: 'SW-1', sellingPrice: 300 },
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', productName: 'Old Sweater', sellingPrice: 400 }),
      update: vi.fn().mockResolvedValue({})
    },
    priceMarkdown: {
      create: vi.fn().mockResolvedValue(makeMarkdown()),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(makeMarkdown()),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({})
    },
    $transaction: vi.fn((ops: unknown) => Promise.all(ops as Promise<unknown>[])),
    ...overrides
  } as Record<string, any>
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('priceMarkdownService.createPriceMarkdown', () => {
  it('rejects a product that does not exist', async () => {
    const db = makeDb({ product: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceMarkdownService.createPriceMarkdown({ productId: 'ghost', markdownPrice: 300, endDate: '2099-01-01' } as never)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PRD-001')
  })

  it('rejects an end date that is not in the future', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceMarkdownService.createPriceMarkdown({ productId: 'prod-1', markdownPrice: 300, endDate: '2020-01-01' } as never)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MKD-001')
  })

  it('rejects a second active markdown on a product that already has one', async () => {
    const db = makeDb({ priceMarkdown: { findFirst: vi.fn().mockResolvedValue(makeMarkdown()) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceMarkdownService.createPriceMarkdown({ productId: 'prod-1', markdownPrice: 300, endDate: '2099-01-01' } as never)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MKD-002')
  })

  it('captures the product\'s current sellingPrice as originalPrice and applies markdownPrice immediately', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await priceMarkdownService.createPriceMarkdown({ productId: 'prod-1', markdownPrice: 300, endDate: '2099-01-01' } as never)

    expect(db.priceMarkdown.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', originalPrice: 400, markdownPrice: 300 })
    }))
    expect(db.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { sellingPrice: 300 } })
  })
})

describe('priceMarkdownService.cancelPriceMarkdown', () => {
  it('rejects a markdown that is not ACTIVE', async () => {
    const db = makeDb({ priceMarkdown: { findUnique: vi.fn().mockResolvedValue(makeMarkdown({ status: 'REVERTED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceMarkdownService.cancelPriceMarkdown('markdown-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MKD-004')
  })

  it('reverts the price back to originalPrice when the price is still at markdownPrice', async () => {
    const db = makeDb({ priceMarkdown: { findUnique: vi.fn().mockResolvedValue(makeMarkdown()), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await priceMarkdownService.cancelPriceMarkdown('markdown-1')

    expect(db.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { sellingPrice: 400 } })
  })

  it('does NOT clobber a manually-changed price when cancelling', async () => {
    const db = makeDb({ priceMarkdown: { findUnique: vi.fn().mockResolvedValue(makeMarkdown({ product: { id: 'prod-1', productName: 'Old Sweater', sku: 'SW-1', sellingPrice: 350 } })), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await priceMarkdownService.cancelPriceMarkdown('markdown-1')

    expect(db.product.update).not.toHaveBeenCalled()
  })
})

describe('priceMarkdownService.revertDuePriceMarkdowns', () => {
  it('reverts a due markdown whose price is unchanged since it was applied', async () => {
    const db = makeDb({
      priceMarkdown: { findMany: vi.fn().mockResolvedValue([makeMarkdown()]), update: vi.fn().mockResolvedValue({}) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await priceMarkdownService.revertDuePriceMarkdowns()

    expect(db.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { sellingPrice: 400 } })
    expect(db.priceMarkdown.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'markdown-1' }, data: expect.objectContaining({ status: 'REVERTED' })
    }))
    expect(result).toEqual({ evaluated: 1, reverted: 1, skippedManualOverride: 0 })
  })

  it('skips reverting the price when it was manually changed away from markdownPrice, but still closes out the record', async () => {
    const db = makeDb({
      priceMarkdown: { findMany: vi.fn().mockResolvedValue([makeMarkdown({ product: { id: 'prod-1', productName: 'Old Sweater', sku: 'SW-1', sellingPrice: 999 } })]), update: vi.fn().mockResolvedValue({}) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await priceMarkdownService.revertDuePriceMarkdowns()

    expect(db.product.update).not.toHaveBeenCalled()
    expect(db.priceMarkdown.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'markdown-1' }, data: expect.objectContaining({ status: 'SKIPPED_MANUAL_OVERRIDE' })
    }))
    expect(result).toEqual({ evaluated: 1, reverted: 0, skippedManualOverride: 1 })
  })

  it('queries only ACTIVE markdowns whose endDate has passed', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = makeDb({ priceMarkdown: { findMany } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await priceMarkdownService.revertDuePriceMarkdowns()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'ACTIVE', endDate: expect.objectContaining({ lte: expect.any(Date) }) })
    }))
  })

  it('returns an honest zero result when nothing is due', async () => {
    const db = makeDb({ priceMarkdown: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await priceMarkdownService.revertDuePriceMarkdowns()

    expect(result).toEqual({ evaluated: 0, reverted: 0, skippedManualOverride: 0 })
  })
})
