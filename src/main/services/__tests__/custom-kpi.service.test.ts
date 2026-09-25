import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { customKpiService, parseKpis, periodStart } from '../custom-kpi.service'

function makeDb(stored: string | null) {
  return {
    setting: {
      findUnique: vi.fn().mockResolvedValue(stored === null ? null : { settingValue: stored }),
      upsert: vi.fn().mockResolvedValue({})
    },
    invoice: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 1234 } }), count: vi.fn().mockResolvedValue(7) },
    expense: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
    bill: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 50 } }) },
    customer: { count: vi.fn().mockResolvedValue(3) }
  }
}

describe('custom KPI tiles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ignores bad stored data', () => {
    expect(parseKpis('garbage')).toEqual([])
    expect(parseKpis('[{"id":"a","name":"x","metric":"NOPE","period":"WEEK"}]')).toEqual([])
  })

  it('period starts: week starts Monday', () => {
    const wed = new Date(2026, 8, 23, 15, 0)
    expect(periodStart('WEEK', wed)).toEqual(new Date(2026, 8, 21))
    expect(periodStart('MONTH', wed)).toEqual(new Date(2026, 8, 1))
    expect(periodStart('YEAR', wed)).toEqual(new Date(2026, 0, 1))
    expect(periodStart('TODAY', wed)).toEqual(new Date(2026, 8, 23))
  })

  it('lists tiles with values (empty sums become 0)', async () => {
    const stored = JSON.stringify([
      { id: 'a', name: 'Sales', metric: 'SALES_TOTAL', period: 'MONTH' },
      { id: 'b', name: 'Spend', metric: 'EXPENSE_TOTAL', period: 'WEEK' }
    ])
    vi.mocked(getPrisma).mockReturnValue(makeDb(stored) as never)
    const r = await customKpiService.list(new Date(2026, 8, 23))
    expect(r.success).toBe(true)
    expect((r as { data: { value: number }[] }).data.map((d) => d.value)).toEqual([1234, 0])
  })

  it('adds a tile, refuses blank names and more than 8', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    expect((await customKpiService.add({ name: ' ', metric: 'SALES_TOTAL', period: 'WEEK' })).success).toBe(false)
    expect((await customKpiService.add({ name: 'Sales', metric: 'SALES_TOTAL', period: 'WEEK' })).success).toBe(true)
    expect(JSON.parse(db.setting.upsert.mock.calls[0][0].create.settingValue)).toHaveLength(1)

    const full = JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ id: `k${i}`, name: 'n', metric: 'SALES_TOTAL', period: 'WEEK' })))
    vi.mocked(getPrisma).mockReturnValue(makeDb(full) as never)
    const r = await customKpiService.add({ name: 'Ninth', metric: 'SALES_TOTAL', period: 'WEEK' })
    expect(r.success).toBe(false)
  })

  it('removes a tile by id', async () => {
    const stored = JSON.stringify([{ id: 'a', name: 'S', metric: 'SALES_TOTAL', period: 'MONTH' }, { id: 'b', name: 'T', metric: 'INVOICE_COUNT', period: 'MONTH' }])
    const db = makeDb(stored)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await customKpiService.remove('a')
    expect(JSON.parse(db.setting.upsert.mock.calls[0][0].update.settingValue).map((k: { id: string }) => k.id)).toEqual(['b'])
  })
})
