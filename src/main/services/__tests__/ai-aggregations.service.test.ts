import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getDeadStock, getCustomersWithNoRecentPurchases, getInactiveSuppliers } from '../ai-aggregations.service'

beforeEach(() => vi.clearAllMocks())

// REAL BUG found+fixed 2026-09-15: each of these functions converted a real
// Date to a local-calendar-date string via toLocalISODate, then re-parsed
// that string with a bare `new Date(dateOnlyString)` for the cutoff
// comparison — re-introducing the UTC-midnight bug on the round trip (a
// date-only string always parses as UTC midnight, which is BEHIND the real
// local instant it was derived from in any timezone ahead of UTC). This
// could silently exclude a product/customer/supplier that had genuinely
// crossed the "N days inactive" cutoff. The fix compares the raw Date
// directly, before it's ever stringified.
describe('ai-aggregations.service — UTC-round-trip cutoff bug', () => {
  // Real bug found+fixed in the zero-logical-errors audit: the per-product
  // "latest sale date" used to be fetched via a nested invoiceItems relation
  // with its own orderBy+take:1 (ordering by a doubly-nested field, invoice.
  // invoiceDate, inside a to-many relation) — a shape that reliably triggers
  // a genuine Prisma query-engine Rust panic once the product catalog is
  // large (confirmed crashing at ~1,700 active products in the real dev DB).
  // Fixed by fetching invoiceItems via a separate flat db.invoiceItem.findMany
  // call and reducing to "latest per product" in JS — these tests now mock
  // that flat call instead of nesting invoiceItems onto the product row.
  it('getDeadStock includes a product whose last sale is exactly at the cutoff boundary (local time)', async () => {
    // "now" is whatever the test machine's local clock says; a sale dated
    // exactly `days` ago at local midnight must be excluded (not < cutoff),
    // but one dated `days`+1 ago must be included. The old bug's failure
    // mode was excluding sales that SHOULD have counted as stale — assert
    // the boundary itself resolves using local, not UTC, semantics.
    const now = new Date()
    const cutoffDays = 90
    const justOverCutoff = new Date(now)
    justOverCutoff.setDate(justOverCutoff.getDate() - (cutoffDays + 1))
    justOverCutoff.setHours(1, 0, 0, 0) // 1am local — the exact window the old bug mishandled in positive-UTC-offset zones

    const db = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'prod-1', productName: 'Stale Widget', sku: 'SW-1', inventory: { quantity: 5 } }
        ])
      },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([{ productId: 'prod-1', invoice: { invoiceDate: justOverCutoff } }])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getDeadStock(cutoffDays)

    expect(result).toHaveLength(1)
    expect(result[0].productName).toBe('Stale Widget')
  })

  it('getDeadStock excludes a product sold well within the cutoff window', async () => {
    const recent = new Date()
    recent.setDate(recent.getDate() - 5)
    const db = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'prod-1', productName: 'Fresh Widget', sku: 'FW-1', inventory: { quantity: 5 } }
        ])
      },
      invoiceItem: {
        findMany: vi.fn().mockResolvedValue([{ productId: 'prod-1', invoice: { invoiceDate: recent } }])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getDeadStock(90)

    expect(result).toHaveLength(0)
  })

  it('picks the MOST RECENT sale when a product has multiple invoiceItem rows, not just the first', async () => {
    const older = new Date()
    older.setDate(older.getDate() - 200)
    const newer = new Date()
    newer.setDate(newer.getDate() - 10)
    const db = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'prod-1', productName: 'Multi-Sale Widget', sku: 'MW-1', inventory: { quantity: 5 } }
        ])
      },
      invoiceItem: {
        // Older row listed FIRST — a naive "take the first row" reduction
        // would wrongly keep the 200-days-ago date and mark this dead.
        findMany: vi.fn().mockResolvedValue([
          { productId: 'prod-1', invoice: { invoiceDate: older } },
          { productId: 'prod-1', invoice: { invoiceDate: newer } },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getDeadStock(90)

    expect(result).toHaveLength(0)
  })

  it('getCustomersWithNoRecentPurchases includes a customer whose last purchase just crossed the local cutoff', async () => {
    const justOverCutoff = new Date()
    justOverCutoff.setDate(justOverCutoff.getDate() - 91)
    justOverCutoff.setHours(1, 0, 0, 0)

    const db = {
      customer: {
        findMany: vi.fn().mockResolvedValue([
          { customerName: 'Lapsed Customer', phone: '9999999999', invoices: [{ invoiceDate: justOverCutoff }] }
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getCustomersWithNoRecentPurchases(90)

    expect(result).toHaveLength(1)
    expect(result[0].customerName).toBe('Lapsed Customer')
  })

  it('getInactiveSuppliers includes a supplier whose last order just crossed the local cutoff', async () => {
    const justOverCutoff = new Date()
    justOverCutoff.setDate(justOverCutoff.getDate() - 91)
    justOverCutoff.setHours(1, 0, 0, 0)

    const db = {
      supplier: {
        findMany: vi.fn().mockResolvedValue([
          { supplierName: 'Lapsed Supplier', phone: '8888888888', purchaseOrders: [{ orderDate: justOverCutoff }] }
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getInactiveSuppliers(90)

    expect(result).toHaveLength(1)
    expect(result[0].supplierName).toBe('Lapsed Supplier')
  })
})
