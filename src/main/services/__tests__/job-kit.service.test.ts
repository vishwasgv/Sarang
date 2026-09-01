import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { suggestKitComponents } from '../job-kit.service'

function makeMockDb(invoices: unknown[]) {
  return { invoice: { findMany: vi.fn().mockResolvedValue(invoices) } } as Record<string, any>
}

beforeEach(() => vi.clearAllMocks())

describe('job-kit.service.suggestKitComponents', () => {
  it('ranks companions by how often they co-occur with the anchor product, across distinct invoices', async () => {
    const invoices = [
      { items: [
        { productId: 'anchor', quantity: 1, product: { productName: 'Ceiling Fan', productType: 'STANDARD', isKit: false } },
        { productId: 'wire', quantity: 5, product: { productName: '2.5mm Wire', sku: 'W25', productType: 'STANDARD', isKit: false } },
        { productId: 'switch', quantity: 1, product: { productName: 'Switch', sku: 'SW1', productType: 'STANDARD', isKit: false } },
      ] },
      { items: [
        { productId: 'anchor', quantity: 1, product: { productName: 'Ceiling Fan', productType: 'STANDARD', isKit: false } },
        { productId: 'wire', quantity: 3, product: { productName: '2.5mm Wire', sku: 'W25', productType: 'STANDARD', isKit: false } },
      ] },
    ]
    const db = makeMockDb(invoices)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await suggestKitComponents('anchor', 8)

    expect(res.success).toBe(true)
    const data = (res as { data: { anchorInvoiceCount: number; suggestions: Array<{ productId: string; coOccurrenceCount: number; suggestedQuantity: number }> } }).data
    expect(data.anchorInvoiceCount).toBe(2)
    expect(data.suggestions[0]).toEqual(expect.objectContaining({ productId: 'wire', coOccurrenceCount: 2, suggestedQuantity: 4 })) // avg of 5 and 3
    expect(data.suggestions[1]).toEqual(expect.objectContaining({ productId: 'switch', coOccurrenceCount: 1 }))
  })

  it('excludes the anchor product itself, and never suggests a SERVICE product or an existing kit', async () => {
    const invoices = [
      { items: [
        { productId: 'anchor', quantity: 1, product: { productName: 'Ceiling Fan', productType: 'STANDARD', isKit: false } },
        { productId: 'anchor', quantity: 2, product: { productName: 'Ceiling Fan', productType: 'STANDARD', isKit: false } }, // duplicate line, same invoice
        { productId: 'labor', quantity: 1, product: { productName: 'Installation Labor', productType: 'SERVICE', isKit: false } },
        { productId: 'starter-kit', quantity: 1, product: { productName: 'Starter Kit', productType: 'STANDARD', isKit: true } },
        { productId: 'box', quantity: 1, product: { productName: 'Junction Box', productType: 'STANDARD', isKit: false } },
      ] },
    ]
    const db = makeMockDb(invoices)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await suggestKitComponents('anchor', 8)

    const suggestions = (res as { data: { suggestions: Array<{ productId: string }> } }).data.suggestions
    expect(suggestions.map(s => s.productId)).toEqual(['box'])
  })

  it('caps results at the requested limit', async () => {
    const invoices = [{ items: Array.from({ length: 10 }, (_, i) => ({
      productId: i === 0 ? 'anchor' : `p${i}`, quantity: 1,
      product: { productName: `Product ${i}`, productType: 'STANDARD', isKit: false },
    })) }]
    const db = makeMockDb(invoices)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await suggestKitComponents('anchor', 3)

    const suggestions = (res as { data: { suggestions: unknown[] } }).data.suggestions
    expect(suggestions.length).toBe(3)
  })
})
