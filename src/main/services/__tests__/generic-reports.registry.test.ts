import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// A database that answers every query with "nothing found", so each report can be built and its labels checked.
const emptyDb = () => new Proxy({}, {
  get: () => new Proxy({}, {
    get: (_t, method) => async () => (method === 'findMany' || method === 'groupBy' ? [] : method === 'findFirst' ? { currencyCode: 'INR' } : method === 'aggregate' ? { _sum: {} } : null)
  })
})
vi.mock('../../database/db', () => ({ getPrisma: () => emptyDb() }))
vi.mock('../valuation.service', () => ({ getProductCostsBatch: vi.fn().mockResolvedValue(new Map()) }))
vi.mock('../sales-lines.query', () => ({
  loadSalesLines: vi.fn().mockResolvedValue({
    decimals: 2,
    lines: [
      { invoiceId: 'i1', invoiceNumber: 'A', date: '2026-09-01', customerId: 'c1', customerName: 'Acme', salespersonId: 's1', salespersonName: 'Sam', productId: 'p1', productName: 'Flour', categoryId: 'k1', categoryName: 'Food', quantity: 10, taxable: 1000, tax: 180, total: 1180, isReturn: false },
      { invoiceId: 'i2', invoiceNumber: 'B', date: '2026-09-02', customerId: 'c2', customerName: 'Beta', salespersonId: null, salespersonName: '', productId: 'p1', productName: 'Flour', categoryId: null, categoryName: '', quantity: 5, taxable: 500, tax: 90, total: 590, isReturn: false },
      { invoiceId: 'i3', invoiceNumber: 'R', date: '2026-09-03', customerId: 'c1', customerName: 'Acme', salespersonId: 's1', salespersonName: 'Sam', productId: 'p1', productName: 'Flour', categoryId: 'k1', categoryName: 'Food', quantity: -1, taxable: -100, tax: -18, total: -118, isReturn: true }
    ]
  })
}))

import { GENERIC_REPORTS, GENERIC_REPORT_IDS } from '../generic-reports.registry'
const en = JSON.parse(readFileSync(resolve(__dirname, '../../../renderer/src/i18n/locales/en.json'), 'utf8')) as Record<string, unknown>

const params = { dateFrom: '2026-09-01', dateTo: '2026-09-30', asOf: '2026-09-30' }
const at = (path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], (en as Record<string, unknown>).reports && ((en as Record<string, unknown>).reports as Record<string, unknown>).gen)

describe('generic report registry', () => {
  it('every report id is listed on the screen, and the screen lists nothing else', () => {
    const src = readFileSync(resolve(__dirname, '../../../renderer/src/modules/reports/ui/GenericReportViews.tsx'), 'utf8')
    const block = /GENERIC_REPORT_IDS = \[([\s\S]*?)\] as const/.exec(src)![1]
    const listed = [...block.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()
    expect(listed).toEqual([...GENERIC_REPORT_IDS].sort())
  })

  it('every report has a name and description in the language file', () => {
    const defs = ((en as Record<string, unknown>).reports as { defs: Record<string, { label?: string; description?: string }> }).defs
    for (const id of GENERIC_REPORT_IDS) {
      expect(defs[id]?.label, id).toBeTruthy()
      expect(defs[id]?.description, id).toBeTruthy()
    }
  })

  for (const id of GENERIC_REPORT_IDS) {
    it(`${id}: builds a well-formed report whose every label exists in the language file`, async () => {
      const r = await GENERIC_REPORTS[id].run(params)
      expect(r.id).toBe(id)
      expect(GENERIC_REPORTS[id].permission).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/)
      const keys = [
        ...r.summary.map((s) => s.labelKey), ...r.columns.map((c) => c.labelKey),
        r.chart.titleKey, ...r.chart.series.map((s) => s.labelKey), ...r.notes.map((k) => `notes.${k}`)
      ]
      for (const k of keys) expect(typeof at(k), `${id}: reports.gen.${k}`).toBe('string')
      for (const row of r.rows) for (const c of r.columns) expect(c.key in row, `${id}.${c.key}`).toBe(true)
      const chartKeys = new Set([...r.columns.map((c) => c.key), ...(r.chartRows ?? []).flatMap((row) => Object.keys(row))])
      expect(chartKeys.has(r.chart.xKey)).toBe(true)
      for (const s of r.chart.series) expect(r.columns.some((c) => c.key === s.key) || r.chartRows !== undefined, `${id}.${s.key}`).toBe(true)
    })
  }
})

describe('sales by ... reports', () => {
  it('by customer nets the return into the customer, ranks by sales and shares add to 100', async () => {
    const r = await GENERIC_REPORTS.salesByCustomer.run(params)
    expect(r.rows.map((x) => x.name)).toEqual(['Acme', 'Beta'])
    expect(r.rows[0]).toMatchObject({ invoices: 2, taxable: 900, tax: 162, total: 1062 })
    expect(r.rows[1]).toMatchObject({ taxable: 500 })
    expect(Number(r.rows[0].share) + Number(r.rows[1].share)).toBeCloseTo(100, 0)
    expect(r.totals).toMatchObject({ taxable: 1400, invoices: 3 })
  })

  it('by item, by category and by salesperson group and label the same lines; blank groups stay blank for the screen to name', async () => {
    const item = await GENERIC_REPORTS.salesByItem.run(params)
    expect(item.rows).toHaveLength(1)
    expect(item.rows[0]).toMatchObject({ name: 'Flour', quantity: 14, taxable: 1400 })
    const cat = await GENERIC_REPORTS.salesByCategory.run(params)
    expect(cat.chart.type).toBe('pie')
    expect(cat.rows.map((x) => x.name)).toEqual(['Food', ''])
    const person = await GENERIC_REPORTS.salesBySalesperson.run(params)
    expect(person.rows.find((x) => x.name === '')).toMatchObject({ taxable: 500 })
  })
})
