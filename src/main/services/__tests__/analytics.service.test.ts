import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(false) }))

import { getPrisma } from '../../database/db'
import {
  getTopProducts, getTopOutstanding, getRevenueTrend, getDashboardAlerts,
  getTopCategories, getInventoryValue, getOutstandingAmount, getEstimatedProfit
} from '../analytics.service'

function zeroAgg(field: string) {
  return vi.fn().mockResolvedValue({ _sum: { [field]: 0 } })
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    invoice: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([])
    },
    payment: { aggregate: zeroAgg('amount') },
    expense: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: vi.fn().mockResolvedValue([])
    },
    customer: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([])
    },
    customerLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }),
      groupBy: vi.fn().mockResolvedValue([])
    },
    inventory: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0)
    },
    product: { count: vi.fn().mockResolvedValue(0) },
    supplier: { count: vi.fn().mockResolvedValue(0) },
    purchaseOrder: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }) },
    invoiceItem: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
    backup: { findFirst: vi.fn().mockResolvedValue(null) },
    notificationQueue: { count: vi.fn().mockResolvedValue(0) },
    restaurantTable: { count: vi.fn().mockResolvedValue(0) },
    kOT: { count: vi.fn().mockResolvedValue(0) },
    rentalBooking: { count: vi.fn().mockResolvedValue(0) },
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencySymbol: '₹' }) },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides
  }
}

beforeEach(() => vi.clearAllMocks())

// ─── computeProfit / getEstimatedProfit (GAP 6.1) ───────────────────────────

describe('getEstimatedProfit', () => {
  it('subtracts COGS (quantity x product.costPrice) from revenue, not just expenses', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      {
        totalAmount: 1000,
        items: [
          { quantity: 2, product: { costPrice: 100 } }, // COGS 200
          { quantity: 1, product: { costPrice: 50 } }    // COGS 50
        ]
      }
    ])
    db.expense.aggregate = vi.fn().mockResolvedValue({ _sum: { amount: 100 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const profit = await getEstimatedProfit(new Date('2026-01-01'), new Date('2026-01-31'))

    // Revenue 1000 - COGS 250 - Expenses 100 = 650
    expect(profit).toBe(650)
  })

  it('only counts realized (PAID/PARTIAL) invoices as revenue', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getEstimatedProfit(new Date('2026-01-01'), new Date('2026-01-31'))

    const call = vi.mocked(db.invoice.findMany).mock.calls[0][0] as { where: { paymentStatus: { in: string[] } } }
    expect(call.where.paymentStatus.in).toEqual(['PAID', 'PARTIAL'])
  })

  // Regression: a RETURN invoice item stores quantity as POSITIVE (see
  // returns.service.ts) — before this fix, computeProfit summed
  // quantity * costPrice for every invoice regardless of type, so a return's
  // cost got ADDED to COGS a second time instead of subtracted back out,
  // double-punishing profit (revenue already dropped via totalAmount).
  it('subtracts COGS for a RETURN invoice instead of adding it again', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { totalAmount: 1000, invoiceType: 'RETAIL', items: [{ quantity: 2, product: { costPrice: 100 } }] }, // revenue 1000, COGS +200
      { totalAmount: -300, invoiceType: 'RETURN', items: [{ quantity: 1, product: { costPrice: 100 } }] }  // revenue -300, COGS -100
    ])
    db.expense.aggregate = vi.fn().mockResolvedValue({ _sum: { amount: 0 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const profit = await getEstimatedProfit(new Date('2026-01-01'), new Date('2026-01-31'))

    // Revenue: 1000 - 300 = 700. COGS: 200 - 100 = 100. Profit: 700 - 100 - 0 = 600.
    expect(profit).toBe(600)
  })

  it('returns 0 profit when there is no revenue and no expenses', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const profit = await getEstimatedProfit(new Date('2026-01-01'), new Date('2026-01-31'))

    expect(profit).toBe(0)
  })
})

// ─── getRevenueTrend ─────────────────────────────────────────────────────────

describe('getRevenueTrend', () => {
  it('buckets 7d period into 7 daily labels', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRevenueTrend('7d')

    expect(result).toHaveLength(7)
  })

  it('buckets 12m period into 12 monthly labels', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRevenueTrend('12m')

    expect(result).toHaveLength(12)
  })

  it('buckets 1d period into 24 hourly labels', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRevenueTrend('1d')

    expect(result).toHaveLength(24)
    expect(result[0].label).toBe('00h')
  })

  it('sums revenue and expenses into the correct day bucket', async () => {
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { invoiceDate: new Date('2026-01-05'), totalAmount: 500 }
    ])
    db.expense.findMany = vi.fn().mockResolvedValue([
      { expenseDate: new Date('2026-01-05'), amount: 100 }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRevenueTrend('custom', '2026-01-01', '2026-01-10')

    const bucket = result.find(r => r.revenue > 0)
    expect(bucket?.revenue).toBe(500)
    expect(bucket?.expenses).toBe(100)
  })

  it('custom range over 90 days buckets by month', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getRevenueTrend('custom', '2026-01-01', '2026-06-01')

    // ~5 months spanned
    expect(result.length).toBeGreaterThanOrEqual(5)
    expect(result.length).toBeLessThanOrEqual(6)
  })
})

// ─── getDashboardAlerts ──────────────────────────────────────────────────────

describe('getDashboardAlerts', () => {
  it('raises a warning-level low stock alert under 5 items, danger at 5+', async () => {
    const db = makeDb()
    db.inventory.findMany = vi.fn().mockResolvedValue([
      { quantity: 0, reorderLevel: 5 }, { quantity: 1, reorderLevel: 5 }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    const lowStock = alerts.find(a => a.type === 'LOW_STOCK')
    expect(lowStock?.severity).toBe('warning')
  })

  it('raises a NO_BACKUP alert when no backup exists', async () => {
    const db = makeDb()
    db.backup.findFirst = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'NO_BACKUP')).toBe(true)
  })

  it('does not raise a backup alert when the last backup was recent', async () => {
    const db = makeDb()
    db.backup.findFirst = vi.fn().mockResolvedValue({ backupDate: new Date() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'NO_BACKUP')).toBe(false)
  })

  it('uses the configurable backup_reminder_days Setting instead of a fixed 7 (GAP 7.2)', async () => {
    const db = makeDb()
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
    db.backup.findFirst = vi.fn().mockResolvedValue({ backupDate: threeDaysAgo })
    // 3 days wouldn't trigger the default 7-day reminder, but does trigger a lowered one.
    db.setting.findUnique = vi.fn().mockResolvedValue({ settingKey: 'backup_reminder_days', settingValue: '2', settingType: 'NUMBER' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'NO_BACKUP')).toBe(true)
  })

  it('does not raise a backup alert below the default 7-day threshold when no Setting is configured', async () => {
    const db = makeDb()
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
    db.backup.findFirst = vi.fn().mockResolvedValue({ backupDate: threeDaysAgo })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'NO_BACKUP')).toBe(false)
  })

  it('raises LARGE_OUTSTANDING using the ledger, not a stale invoice snapshot', async () => {
    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 200000, creditAmount: 0 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'LARGE_OUTSTANDING')).toBe(true)
  })

  it('includes the business\'s configured currency symbol in the large-outstanding message, not a bare number', async () => {
    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 200000, creditAmount: 0 } })
    db.businessProfile.findFirst = vi.fn().mockResolvedValue({ currencySymbol: '$' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    const alert = alerts.find(a => a.type === 'LARGE_OUTSTANDING')
    expect(alert?.message).toContain('$')
  })

  it('uses the configurable large_outstanding_threshold Setting instead of a fixed 100000', async () => {
    const db = makeDb()
    // 20000 wouldn't trigger the 100000 default, but does trigger a lowered threshold.
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 20000, creditAmount: 0 } })
    db.setting.findUnique = vi.fn().mockResolvedValue({ settingKey: 'large_outstanding_threshold', settingValue: '10000', settingType: 'NUMBER' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'LARGE_OUTSTANDING')).toBe(true)
  })

  it('does not raise LARGE_OUTSTANDING below the default threshold when no Setting is configured', async () => {
    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 50000, creditAmount: 0 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'LARGE_OUTSTANDING')).toBe(false)
  })

  it('raises a warning-level PENDING_REMINDERS alert under 10 due reminders, danger at 10+', async () => {
    const db = makeDb()
    db.notificationQueue.count = vi.fn().mockResolvedValue(3)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    const alert = alerts.find(a => a.type === 'PENDING_REMINDERS')
    expect(alert?.severity).toBe('warning')
    expect(alert?.message).toContain('3')
  })

  it('escalates PENDING_REMINDERS to danger once the queue has piled up (10+)', async () => {
    const db = makeDb()
    db.notificationQueue.count = vi.fn().mockResolvedValue(12)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.find(a => a.type === 'PENDING_REMINDERS')?.severity).toBe('danger')
  })

  it('does not raise PENDING_REMINDERS when the queue is empty', async () => {
    const db = makeDb()
    db.notificationQueue.count = vi.fn().mockResolvedValue(0)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'PENDING_REMINDERS')).toBe(false)
  })

  it('raises AUDIT_LOG_FAILURE when audit.service has recorded a write failure', async () => {
    const db = makeDb()
    db.setting.findUnique = vi.fn(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'audit_log_last_failure_at' ? { settingKey: where.settingKey, settingValue: new Date().toISOString() } : null))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    const alert = alerts.find(a => a.type === 'AUDIT_LOG_FAILURE')
    expect(alert?.severity).toBe('danger')
  })

  it('does not raise AUDIT_LOG_FAILURE when no failure has been recorded', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'AUDIT_LOG_FAILURE')).toBe(false)
  })

  it('only counts reminders that are actually due (PENDING + scheduledFor has arrived), same definition as the queue screen itself', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getDashboardAlerts()

    expect(db.notificationQueue.count).toHaveBeenCalledWith({
      where: { status: 'PENDING', scheduledFor: { lte: expect.any(Date) } }
    })
  })

  it('raises RENTAL_OVERDUE at warning severity for 1-4 overdue rentals', async () => {
    const db = makeDb()
    db.rentalBooking.count = vi.fn().mockResolvedValue(2)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    const alert = alerts.find(a => a.type === 'RENTAL_OVERDUE')
    expect(alert?.severity).toBe('warning')
    expect(alert?.message).toContain('2')
  })

  it('escalates RENTAL_OVERDUE to danger severity at 5+ overdue rentals', async () => {
    const db = makeDb()
    db.rentalBooking.count = vi.fn().mockResolvedValue(5)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.find(a => a.type === 'RENTAL_OVERDUE')?.severity).toBe('danger')
  })

  it('does not raise RENTAL_OVERDUE when nothing is overdue', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const alerts = await getDashboardAlerts()

    expect(alerts.some(a => a.type === 'RENTAL_OVERDUE')).toBe(false)
  })

  it('counts overdue rentals using the same CHECKED_OUT + past-endDateTime definition as the Rental Bookings screen, computed live rather than from a stored flag', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getDashboardAlerts()

    expect(db.rentalBooking.count).toHaveBeenCalledWith({
      where: { status: 'CHECKED_OUT', endDateTime: { lt: expect.any(Date) } }
    })
  })
})

// ─── getTopOutstanding (N+1 fix) ─────────────────────────────────────────────

describe('getTopOutstanding', () => {
  it('uses a single groupBy call regardless of customer count, not one query per customer', async () => {
    const db = makeDb()
    db.customer.findMany = vi.fn().mockResolvedValue([
      { id: 'c1', customerName: 'Alpha' }, { id: 'c2', customerName: 'Beta' }, { id: 'c3', customerName: 'Gamma' }
    ])
    db.customerLedger.groupBy = vi.fn().mockResolvedValue([
      { customerId: 'c1', _sum: { debitAmount: 5000, creditAmount: 0 } },
      { customerId: 'c2', _sum: { debitAmount: 1000, creditAmount: 1000 } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopOutstanding(5)

    expect(db.customerLedger.groupBy).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0].customerName).toBe('Alpha')
    expect(result[0].outstanding).toBe(5000)
  })

  it('excludes customers with zero or negative outstanding', async () => {
    const db = makeDb()
    db.customer.findMany = vi.fn().mockResolvedValue([{ id: 'c1', customerName: 'Over-paid' }])
    db.customerLedger.groupBy = vi.fn().mockResolvedValue([
      { customerId: 'c1', _sum: { debitAmount: 100, creditAmount: 200 } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopOutstanding(5)

    expect(result).toHaveLength(0)
  })

  it('limits to the requested count', async () => {
    const db = makeDb()
    db.customer.findMany = vi.fn().mockResolvedValue([
      { id: 'c1', customerName: 'A' }, { id: 'c2', customerName: 'B' }, { id: 'c3', customerName: 'C' }
    ])
    db.customerLedger.groupBy = vi.fn().mockResolvedValue([
      { customerId: 'c1', _sum: { debitAmount: 300, creditAmount: 0 } },
      { customerId: 'c2', _sum: { debitAmount: 200, creditAmount: 0 } },
      { customerId: 'c3', _sum: { debitAmount: 100, creditAmount: 0 } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopOutstanding(2)

    expect(result).toHaveLength(2)
  })
})

// ─── getTopProducts (existing) ───────────────────────────────────────────────

describe('getTopProducts', () => {
  it('returns empty list when no sales', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopProducts(5)

    expect(result).toHaveLength(0)
  })

  it('aggregates revenue per product and sorts descending', async () => {
    const db = makeDb()
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      { productId: 'prod-1', quantity: 10, lineTotal: 1180, invoice: { invoiceType: 'RETAIL' }, product: { productName: 'Widget', sku: 'W-001' } },
      { productId: 'prod-1', quantity: 5, lineTotal: 590, invoice: { invoiceType: 'RETAIL' }, product: { productName: 'Widget', sku: 'W-001' } },
      { productId: 'prod-2', quantity: 2, lineTotal: 1090, invoice: { invoiceType: 'RETAIL' }, product: { productName: 'Gadget', sku: 'G-001' } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopProducts(5)

    expect(result[0].productName).toBe('Widget')
    expect(result[0].quantitySold).toBe(15)
    expect(result[0].revenue).toBe(1770)
  })

  // Regression: a RETURN invoice item stores quantity as POSITIVE
  // (returns.service.ts uses it to restock inventory) — only lineTotal is
  // signed negative. Before this fix, a returned unit was still ADDED to
  // quantitySold, inflating "units sold" even though the revenue correctly
  // netted to zero.
  it('subtracts quantity (not adds) for a RETURN invoice item, so returned units do not inflate quantitySold', async () => {
    const db = makeDb()
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      { productId: 'prod-1', quantity: 10, lineTotal: 1180, invoice: { invoiceType: 'RETAIL' }, product: { productName: 'Widget', sku: 'W-001' } },
      { productId: 'prod-1', quantity: 3, lineTotal: -354, invoice: { invoiceType: 'RETURN' }, product: { productName: 'Widget', sku: 'W-001' } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopProducts(5)

    expect(result[0].quantitySold).toBe(7)
    expect(result[0].revenue).toBe(826)
  })
})

// ─── getTopCategories ────────────────────────────────────────────────────────

describe('getTopCategories', () => {
  it('groups revenue by category name, falling back to Uncategorized', async () => {
    const db = makeDb()
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      { lineTotal: 500, quantity: 2, invoice: { invoiceType: 'RETAIL' }, product: { category: { name: 'Beverages' } } },
      { lineTotal: 300, quantity: 1, invoice: { invoiceType: 'RETAIL' }, product: { category: null } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopCategories(5)

    expect(result.find(c => c.categoryName === 'Beverages')?.revenue).toBe(500)
    expect(result.find(c => c.categoryName === 'Uncategorized')?.revenue).toBe(300)
  })

  it('subtracts quantity for a RETURN invoice item, so itemsSold is not inflated by returns', async () => {
    const db = makeDb()
    db.invoiceItem.findMany = vi.fn().mockResolvedValue([
      { lineTotal: 500, quantity: 5, invoice: { invoiceType: 'RETAIL' }, product: { category: { name: 'Beverages' } } },
      { lineTotal: -100, quantity: 1, invoice: { invoiceType: 'RETURN' }, product: { category: { name: 'Beverages' } } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await getTopCategories(5)

    expect(result.find(c => c.categoryName === 'Beverages')?.itemsSold).toBe(4)
  })
})

// ─── getInventoryValue ───────────────────────────────────────────────────────

describe('getInventoryValue', () => {
  it('values stock at cost price and excludes inactive products', async () => {
    const db = makeDb()
    db.inventory.findMany = vi.fn().mockResolvedValue([
      { quantity: 10, product: { costPrice: 50, isActive: true } },
      { quantity: 100, product: { costPrice: 999, isActive: false } }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const value = await getInventoryValue()

    expect(value).toBe(500)
  })
})

// ─── getOutstandingAmount ────────────────────────────────────────────────────

describe('getOutstandingAmount', () => {
  it('matches the same debit-minus-credit convention used by the Outstanding Report (RULE AN001)', async () => {
    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 10000, creditAmount: 4000 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const amount = await getOutstandingAmount()

    expect(amount).toBe(6000)
  })

  it('floors at zero rather than showing a negative outstanding balance', async () => {
    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 100, creditAmount: 500 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const amount = await getOutstandingAmount()

    expect(amount).toBe(0)
  })
})

// ─── getDashboardKpis — isolated per test to avoid the 60s in-module cache ──

describe('getDashboardKpis', () => {
  // getDashboardKpis caches its result in module-level state for 60s — reset the
  // module registry and re-import per test so the cache never leaks between cases.
  async function freshImport(kotEnabled = false) {
    vi.resetModules()
    vi.doMock('../industry-template.service', () => ({ isModuleEnabled: vi.fn().mockResolvedValue(kotEnabled) }))
    const dbModule = await import('../../database/db')
    const service = await import('../analytics.service')
    return { getDashboardKpis: service.getDashboardKpis, getPrisma: dbModule.getPrisma }
  }

  it('computes estimatedProfit as revenue minus COGS minus expenses, not revenue minus expenses alone', async () => {
    const { getDashboardKpis, getPrisma: freshGetPrisma } = await freshImport()
    const db = makeDb()
    db.invoice.findMany = vi.fn().mockResolvedValue([
      { totalAmount: 1000, items: [{ quantity: 4, product: { costPrice: 100 } }] } // COGS 400
    ])
    db.expense.aggregate = vi.fn().mockResolvedValue({ _sum: { amount: 50 } })
    vi.mocked(freshGetPrisma).mockReturnValue(db as never)

    const kpis = await getDashboardKpis()

    // Revenue 1000 - COGS 400 - Expenses 50 = 550 (NOT 1000 - 50 = 950)
    expect(kpis.estimatedProfit).toBe(550)
  })

  it('keeps lowStockCount consistent with inventoryStats — no drift between the KPI card and the Inventory Health chart', async () => {
    const { getDashboardKpis, getPrisma: freshGetPrisma } = await freshImport()
    const db = makeDb()
    db.inventory.findMany = vi.fn()
      .mockResolvedValueOnce([]) // inventoryItems (value calc) — first call in Promise.all order
      .mockResolvedValueOnce([
        { quantity: 0, reorderLevel: 5 },   // out of stock
        { quantity: 2, reorderLevel: 5 },   // low stock
        { quantity: 50, reorderLevel: 5 }   // in stock
      ])
    vi.mocked(freshGetPrisma).mockReturnValue(db as never)

    const kpis = await getDashboardKpis()

    expect(kpis.lowStockCount).toBe(kpis.inventoryStats.lowStock + kpis.inventoryStats.outOfStock)
    expect(kpis.inventoryStats.inStock + kpis.inventoryStats.lowStock + kpis.inventoryStats.outOfStock)
      .toBe(kpis.inventoryStats.total)
  })

  it('does not populate restaurant KPIs when the kot module is disabled', async () => {
    const { getDashboardKpis, getPrisma: freshGetPrisma } = await freshImport(false)
    const db = makeDb()
    vi.mocked(freshGetPrisma).mockReturnValue(db as never)

    const kpis = await getDashboardKpis()

    expect(kpis.occupiedTables).toBeUndefined()
    expect(kpis.kotPending).toBeUndefined()
    expect(kpis.kotInProgress).toBeUndefined()
  })

  it('populates occupiedTables/kotPending/kotInProgress as separate counts when the kot module is enabled', async () => {
    const { getDashboardKpis, getPrisma: freshGetPrisma } = await freshImport(true)
    const db = makeDb({
      restaurantTable: { count: vi.fn().mockResolvedValue(4) },
      kOT: { count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2) }
    })
    vi.mocked(freshGetPrisma).mockReturnValue(db as never)

    const kpis = await getDashboardKpis()

    expect(kpis.occupiedTables).toBe(4)
    expect(kpis.kotPending).toBe(3)
    expect(kpis.kotInProgress).toBe(2)
  })

  it('returns the cached value on a normal call within the TTL', async () => {
    const { getDashboardKpis, getPrisma: freshGetPrisma } = await freshImport()
    const db = makeDb()
    db.invoice.aggregate = vi.fn()
      .mockResolvedValueOnce({ _sum: { totalAmount: 111 } }) // first call's todaySales
      .mockResolvedValue({ _sum: { totalAmount: 0 } })
    vi.mocked(freshGetPrisma).mockReturnValue(db as never)

    const first = await getDashboardKpis()
    // Change what the DB would return — a genuinely fresh computation would now differ.
    db.invoice.aggregate = vi.fn().mockResolvedValue({ _sum: { totalAmount: 999 } })
    const second = await getDashboardKpis()

    expect(second.todaySales).toBe(first.todaySales)
  })

  it('forceRefresh bypasses the cache and recomputes even within the TTL — the manual Refresh button must never show stale numbers', async () => {
    const { getDashboardKpis, getPrisma: freshGetPrisma } = await freshImport()
    const db = makeDb()
    db.invoice.aggregate = vi.fn().mockResolvedValue({ _sum: { totalAmount: 111 } })
    vi.mocked(freshGetPrisma).mockReturnValue(db as never)

    const first = await getDashboardKpis()
    expect(first.todaySales).toBe(111)

    db.invoice.aggregate = vi.fn().mockResolvedValue({ _sum: { totalAmount: 999 } })
    const refreshed = await getDashboardKpis(true)

    expect(refreshed.todaySales).toBe(999)
  })
})
