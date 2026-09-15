import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../report.service', () => ({
  reportService: {
    generateSalesReport: vi.fn(),
    generateOutstandingReport: vi.fn(),
    generateInventoryReport: vi.fn(),
    generateTaxReport: vi.fn(),
    generateExpenseReport: vi.fn(),
    generateProfitAndLossReport: vi.fn(),
    generateCashBookReport: vi.fn(),
    generateTrialBalanceReport: vi.fn(),
    generateApAgingReport: vi.fn(),
    generatePurchaseRegisterReport: vi.fn(),
  }
}))
vi.mock('../analytics.service', () => ({ getDashboardKpis: vi.fn() }))

import { getPrisma } from '../../database/db'
import { reportService } from '../report.service'
import { getDashboardKpis } from '../analytics.service'
import {
  getOrCreateOwnerViewToken, regenerateOwnerViewToken,
  getOrCreateOwnerViewAccessCode, regenerateOwnerViewAccessCode,
  listOwnerViewReports, runOwnerViewReport, getOwnerViewSummary
} from '../owner-view.service'

function makeMockDb(overrides: Record<string, any> = {}) {
  return {
    setting: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('owner-view.service — token', () => {
  it('creates and persists a new token when none exists', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const token = await getOrCreateOwnerViewToken()

    expect(token).toMatch(/^[0-9a-f]{24}$/)
    expect(db.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { settingKey: 'owner_view_token' } }))
  })

  it('returns the existing token instead of minting a new one', async () => {
    const db = makeMockDb({ setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: 'existing-token' }), upsert: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const token = await getOrCreateOwnerViewToken()

    expect(token).toBe('existing-token')
    expect(db.setting.upsert).not.toHaveBeenCalled()
  })

  it('regenerateOwnerViewToken always mints a fresh value, ignoring any existing one', async () => {
    const db = makeMockDb({ setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: 'old-token' }), upsert: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const token = await regenerateOwnerViewToken()

    expect(token).toMatch(/^[0-9a-f]{24}$/)
    expect(token).not.toBe('old-token')
  })
})

describe('owner-view.service — access code', () => {
  it('creates and persists a new 6-digit code when none exists', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const code = await getOrCreateOwnerViewAccessCode()

    expect(code).toMatch(/^\d{6}$/)
    expect(db.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { settingKey: 'owner_view_access_code' } }))
  })

  it('returns the existing code instead of minting a new one', async () => {
    const db = makeMockDb({ setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: '123456' }), upsert: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const code = await getOrCreateOwnerViewAccessCode()

    expect(code).toBe('123456')
  })

  it('regenerateOwnerViewAccessCode mints a fresh 6-digit value', async () => {
    const db = makeMockDb({ setting: { findUnique: vi.fn().mockResolvedValue({ settingValue: '111111' }), upsert: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const code = await regenerateOwnerViewAccessCode()

    expect(code).toMatch(/^\d{6}$/)
  })

  it('the token and the access code are independent secrets, stored under different setting keys', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getOrCreateOwnerViewToken()
    await getOrCreateOwnerViewAccessCode()

    const keys = db.setting.upsert.mock.calls.map((c: any) => c[0].where.settingKey)
    expect(keys).toEqual(['owner_view_token', 'owner_view_access_code'])
  })
})

describe('owner-view.service — report registry', () => {
  it('lists every registered report with a category and requiresDateRange flag', () => {
    const reports = listOwnerViewReports()

    expect(reports.length).toBeGreaterThan(0)
    for (const r of reports) {
      expect(r.id).toBeTruthy()
      expect(r.label).toBeTruthy()
      expect(['sales', 'finance', 'inventory', 'suppliers']).toContain(r.category)
      expect(typeof r.requiresDateRange).toBe('boolean')
    }
  })

  it('rejects an unknown report id without touching any report service function', async () => {
    const res = await runOwnerViewReport('not-a-real-report', {})

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('OV-001')
    expect(reportService.generateSalesReport).not.toHaveBeenCalled()
  })

  it('dispatches a date-range report with the caller-supplied dates', async () => {
    vi.mocked(reportService.generateSalesReport).mockResolvedValue({ total: 500 } as never)

    const res = await runOwnerViewReport('sales', { dateFrom: '2026-09-01', dateTo: '2026-09-15' })

    expect(res.success).toBe(true)
    expect(reportService.generateSalesReport).toHaveBeenCalledWith({ dateFrom: '2026-09-01', dateTo: '2026-09-15' })
  })

  it('falls back to a default ~30-day range when a date-range report gets no dates', async () => {
    vi.mocked(reportService.generateProfitAndLossReport).mockResolvedValue({} as never)

    await runOwnerViewReport('profitAndLoss', {})

    const call = vi.mocked(reportService.generateProfitAndLossReport).mock.calls[0][0]
    expect(call.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(call.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(call.dateFrom).getTime()).toBeLessThan(new Date(call.dateTo).getTime())
  })

  it('calls a no-params report with no arguments at all', async () => {
    vi.mocked(reportService.generateOutstandingReport).mockResolvedValue({} as never)

    await runOwnerViewReport('outstanding', { dateFrom: '2026-09-01', dateTo: '2026-09-15' })

    // Dates are irrelevant for this report — must not be forwarded as if
    // they meant something to a function that takes zero arguments.
    expect(reportService.generateOutstandingReport).toHaveBeenCalledWith()
  })

  it('turns a thrown error from the underlying report function into a graceful OV-002, never an unhandled rejection', async () => {
    vi.mocked(reportService.generateInventoryReport).mockRejectedValue(new Error('DB exploded'))

    const res = await runOwnerViewReport('inventory', {})

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('OV-002')
  })

  it('every reportId in the registry has a real dispatch branch (no silent no-op entries)', async () => {
    for (const def of listOwnerViewReports()) {
      const fnName = ('generate' + def.id.charAt(0).toUpperCase() + def.id.slice(1) + 'Report') as keyof typeof reportService
      if (fnName in reportService) {
        vi.mocked(reportService[fnName] as never as (...args: unknown[]) => Promise<unknown>).mockResolvedValue({})
      }
      const res = await runOwnerViewReport(def.id, { dateFrom: '2026-09-01', dateTo: '2026-09-15' })
      expect(res.success, `report "${def.id}" did not dispatch successfully`).toBe(true)
    }
  })
})

describe('owner-view.service — summary', () => {
  it('reuses the exact same cached KPI computation the desktop Dashboard shows', async () => {
    vi.mocked(getDashboardKpis).mockResolvedValue({ todaySales: 1000 } as never)

    const summary = await getOwnerViewSummary()

    expect(getDashboardKpis).toHaveBeenCalledWith(false)
    expect(summary).toEqual({ todaySales: 1000 })
  })
})
