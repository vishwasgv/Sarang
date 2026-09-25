vi.mock('../sales-order-reservations', () => ({ reservedBySalesOrders: vi.fn().mockResolvedValue(new Map()), stockShortagesForOrder: vi.fn().mockResolvedValue([]) }))
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../valuation.service', () => ({ getProductCostsBatch: vi.fn().mockResolvedValue(new Map([['p1', 10], ['p2', 100]])) }))

import { getPrisma } from '../../database/db'
import { STOCK_REPORTS, ledgerByType } from '../generic-reports.stock'

const p = { dateFrom: '2026-09-01', dateTo: '2026-09-30', asOf: '2026-09-30' }
const day = (s: string) => new Date(`${s}T12:00:00`)
const profile = { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) }

describe('stock summary', () => {
  it('values stock at the item cost and flags low and out of stock', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      inventory: {
        findMany: vi.fn().mockResolvedValue([
          { productId: 'p1', quantity: 5, reservedQuantity: 0, reorderLevel: 10, product: { productName: 'Flour', sku: 'F1', unit: 'KG', isActive: true, category: { name: 'Food' } } },
          { productId: 'p2', quantity: 0, reservedQuantity: 0, reorderLevel: 2, product: { productName: 'Gold', sku: null, unit: 'G', isActive: true, category: null } },
          { productId: 'p3', quantity: 3, reservedQuantity: 0, reorderLevel: 0, product: { productName: 'Old', sku: null, unit: 'PCS', isActive: false, category: null } }
        ])
      }
    } as never)
    const r = await STOCK_REPORTS.stockSummary.run(p)
    expect(r.rows).toHaveLength(2)
    expect(r.rows.find((x) => x.name === 'Flour')).toMatchObject({ value: 50, status: 'LOW' })
    expect(r.rows.find((x) => x.name === 'Gold')).toMatchObject({ value: 0, status: 'OUT' })
    expect(r.summary.find((s) => s.labelKey === 'stock.totalValue')!.value).toBe(50)
  })
})

describe('stock ledger', () => {
  it('starts each item from its opening balance and keeps a running balance', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      inventoryMovement: {
        groupBy: vi.fn().mockResolvedValue([{ productId: 'p1', _sum: { quantity: 20 } }]),
        findMany: vi.fn().mockResolvedValue([
          { productId: 'p1', movementType: 'SALE', quantity: -5, referenceType: 'INVOICE', remarks: null, createdAt: day('2026-09-03'), product: { productName: 'Flour' }, location: null },
          { productId: 'p1', movementType: 'PURCHASE', quantity: 30, referenceType: 'BILL', remarks: null, createdAt: day('2026-09-10'), product: { productName: 'Flour' }, location: { name: 'Main' } }
        ])
      }
    } as never)
    const r = await STOCK_REPORTS.stockLedger.run(p)
    expect(r.rows.map((x) => x.type)).toEqual(['OPENING', 'SALE', 'PURCHASE'])
    expect(r.rows.map((x) => x.balance)).toEqual([20, 15, 45])
    expect(r.rows[1]).toMatchObject({ quantityOut: 5, quantityIn: null })
    expect(ledgerByType(r.rows)).toEqual([{ type: 'SALE', quantity: 5 }, { type: 'PURCHASE', quantity: 30 }])
  })
})

describe('inventory ageing', () => {
  it('treats stock on hand as the latest receipts and puts older receipts in older buckets', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', quantity: 15, product: { productName: 'Flour' } }]) },
      inventoryMovement: {
        findMany: vi.fn().mockResolvedValue([
          { productId: 'p1', quantity: 10, createdAt: day('2026-09-20') },
          { productId: 'p1', quantity: 10, createdAt: day('2026-06-01') }
        ])
      }
    } as never)
    const r = await STOCK_REPORTS.inventoryAgeing.run(p)
    // 10 units 10 days old + 5 units 121 days old, at cost 10
    expect(r.rows[0]).toMatchObject({ b0: 100, b90: 50, total: 150 })
  })
  it('stock with no receipt on record counts as the oldest', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p2', quantity: 2, product: { productName: 'Gold' } }]) },
      inventoryMovement: { findMany: vi.fn().mockResolvedValue([]) }
    } as never)
    const r = await STOCK_REPORTS.inventoryAgeing.run(p)
    expect(r.rows[0]).toMatchObject({ b90: 200 })
  })
})

describe('by location and transfers', () => {
  it('adds stock per location', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      locationStock: {
        findMany: vi.fn().mockResolvedValue([
          { productId: 'p1', quantity: 10, location: { id: 'l1', name: 'Shop' } },
          { productId: 'p2', quantity: 1, location: { id: 'l1', name: 'Shop' } },
          { productId: 'p1', quantity: 4, location: { id: 'l2', name: 'Godown' } }
        ])
      }
    } as never)
    const r = await STOCK_REPORTS.stockByLocation.run(p)
    expect(r.rows[0]).toMatchObject({ name: 'Shop', products: 2, quantity: 11, value: 200 })
    expect(r.rows[1]).toMatchObject({ name: 'Godown', value: 40 })
  })
  it('lists transfer movements with positive quantities', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      inventoryMovement: {
        findMany: vi.fn().mockResolvedValue([
          { movementType: 'TRANSFER_OUT', quantity: -3, remarks: 'to godown', createdAt: day('2026-09-05'), product: { productName: 'Flour' }, location: { name: 'Shop' } },
          { movementType: 'TRANSFER_IN', quantity: 3, remarks: null, createdAt: day('2026-09-05'), product: { productName: 'Flour' }, location: { name: 'Godown' } }
        ])
      }
    } as never)
    const r = await STOCK_REPORTS.transfersRegister.run(p)
    expect(r.rows.map((x) => x.quantity)).toEqual([3, 3])
    expect(r.summary[0].value).toBe(1)
  })
})

describe('stock count variance report', () => {
  it('adds the differences of every posted count in the period by item and drops items with no difference', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      stockTake: {
        findMany: vi.fn().mockResolvedValue([
          { lines: [{ productId: 'p1', productName: 'Flour', systemQty: 10, countedQty: 8 }, { productId: 'p2', productName: 'Gold', systemQty: 5, countedQty: 5 }] },
          { lines: [{ productId: 'p1', productName: 'Flour', systemQty: 20, countedQty: 21 }] }
        ])
      }
    } as never)
    const r = await STOCK_REPORTS.stockTakeVariance.run(p)
    expect(r.rows).toEqual([{ name: 'Flour', counts: 2, system: 30, counted: 29, variance: -1, value: -10 }])
    expect(r.summary.map((s) => s.value)).toEqual([2, 1, 0, 10])
  })
})
