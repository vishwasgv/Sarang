import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { hubService, billsDueSoon } from '../hub.service'

const now = new Date(2026, 8, 26, 10, 0, 0)
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0)
const profile = { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) }

describe('bills due soon (H8)', () => {
  it('lists overdue bills and those due within the next 7 days, marks the overdue ones, uses the bill date when there is no due date', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      bill: {
        findMany: vi.fn().mockResolvedValue([
          { id: '1', billNumber: 'B-1', dueDate: day(2026, 9, 20), billDate: day(2026, 9, 1), balanceAmount: 500, supplier: { supplierName: 'Far' } },
          { id: '2', billNumber: 'B-2', dueDate: day(2026, 10, 2), billDate: day(2026, 9, 10), balanceAmount: 300, supplier: { supplierName: 'Near' } },
          { id: '3', billNumber: 'B-3', dueDate: null, billDate: day(2026, 9, 25), balanceAmount: 50, supplier: { supplierName: 'NoDue' } }
        ])
      }
    } as never)
    const list = await billsDueSoon(7, now)
    expect(list.map((b) => [b.billNumber, b.overdue, b.dueDate])).toEqual([['B-1', true, '2026-09-20'], ['B-2', false, '2026-10-02'], ['B-3', true, '2026-09-25']])
  })

  it('asks the database only for open bills due before the end of the 7th day', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue({ bill: { findMany } } as never)
    await billsDueSoon(7, now)
    const where = findMany.mock.calls[0][0].where
    expect(where.balanceAmount).toEqual({ gt: 0 })
    expect(where.status).toEqual({ not: 'VOID' })
    const until = where.OR[0].dueDate.lt as Date
    expect([until.getMonth(), until.getDate()]).toEqual([9, 4])
  })
})

describe('overview numbers', () => {
  it('purchases: payable, overdue, due this week and the bill list', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      bill: {
        findMany: vi.fn().mockImplementation(async (q: { select: Record<string, boolean> }) => q.select.id
          ? [
            { id: '1', billNumber: 'B-1', dueDate: day(2026, 9, 20), billDate: day(2026, 9, 1), balanceAmount: 500, supplier: { supplierName: 'Far' } },
            { id: '2', billNumber: 'B-2', dueDate: day(2026, 10, 2), billDate: day(2026, 9, 10), balanceAmount: 300, supplier: { supplierName: 'Near' } }
          ]
          : [{ balanceAmount: 500 }, { balanceAmount: 300 }, { balanceAmount: 1200 }])
      }
    } as never)
    const s = await hubService.summary('purchases', now)
    const v = (k: string) => s.stats.find((x) => x.key === k)!
    expect(v('payable').value).toBe(2000)
    expect(v('overdue')).toMatchObject({ value: 500, danger: true })
    expect(v('dueThisWeek').value).toBe(300)
    expect(v('openBills').value).toBe(3)
    expect(s.dueBills).toHaveLength(2)
  })

  it('sales: takings today, what is owed and overdue, open quotations', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      invoice: {
        findMany: vi.fn().mockImplementation(async (q: { where: { balanceAmount?: unknown } }) => q.where.balanceAmount
          ? [{ balanceAmount: 400, dueDate: day(2026, 9, 1), invoiceDate: day(2026, 8, 20) }, { balanceAmount: 100, dueDate: day(2026, 10, 30), invoiceDate: day(2026, 9, 20) }]
          : [{ totalAmount: 118 }, { totalAmount: 59 }])
      },
      quotation: { count: vi.fn().mockResolvedValue(3) }
    } as never)
    const s = await hubService.summary('sales', now)
    const v = (k: string) => s.stats.find((x) => x.key === k)!
    expect(v('salesToday').value).toBe(177)
    expect(v('invoicesToday').value).toBe(2)
    expect(v('receivable').value).toBe(500)
    expect(v('overdue')).toMatchObject({ value: 400, danger: true })
    expect(v('openQuotations').value).toBe(3)
  })

  it('accounting and inventory summaries', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      businessProfile: profile,
      bankAccount: { findMany: vi.fn().mockResolvedValue([{ currentBalance: 1000 }, { currentBalance: -200 }]) },
      journalEntry: { count: vi.fn().mockResolvedValue(4) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ quantity: 5, reorderLevel: 10 }, { quantity: 0, reorderLevel: 3 }, { quantity: 50, reorderLevel: 10 }]) }
    } as never)
    const acc = await hubService.summary('accounting', now)
    expect(acc.stats.map((x) => x.value)).toEqual([800, 2, 4])
    const inv = await hubService.summary('inventory', now)
    expect(inv.stats.map((x) => x.value)).toEqual([3, 1, 1])
    expect(inv.stats[1].danger).toBe(true)
  })
})
