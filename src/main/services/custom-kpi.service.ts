import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

// Owner-defined dashboard tiles: a name, a measure and a period. The list is kept as JSON in one Setting row.

export const KPI_METRICS = ['SALES_TOTAL', 'INVOICE_COUNT', 'EXPENSE_TOTAL', 'PURCHASES_TOTAL', 'NEW_CUSTOMERS'] as const
export const KPI_PERIODS = ['TODAY', 'WEEK', 'MONTH', 'YEAR'] as const
export type KpiMetric = (typeof KPI_METRICS)[number]
export type KpiPeriod = (typeof KPI_PERIODS)[number]

export interface CustomKpi {
  id: string
  name: string
  metric: KpiMetric
  period: KpiPeriod
}

const SETTING_KEY = 'custom_kpis'
const MAX_KPIS = 8

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

export function parseKpis(text: string | null | undefined): CustomKpi[] {
  if (!text) return []
  try {
    const v: unknown = JSON.parse(text)
    if (!Array.isArray(v)) return []
    return v.filter((k): k is CustomKpi =>
      !!k && typeof k.id === 'string' && typeof k.name === 'string' &&
      (KPI_METRICS as readonly string[]).includes(k.metric) && (KPI_PERIODS as readonly string[]).includes(k.period))
  } catch {
    return []
  }
}

/** First moment of the period containing `now` (week starts Monday). */
export function periodStart(period: KpiPeriod, now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'WEEK') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  if (period === 'MONTH') d.setDate(1)
  if (period === 'YEAR') { d.setMonth(0); d.setDate(1) }
  return d
}

async function readAll(): Promise<CustomKpi[]> {
  const row = await getPrisma().setting.findUnique({ where: { settingKey: SETTING_KEY } })
  return parseKpis(row?.settingValue)
}

async function writeAll(list: CustomKpi[]): Promise<void> {
  const value = JSON.stringify(list)
  await getPrisma().setting.upsert({ where: { settingKey: SETTING_KEY }, create: { settingKey: SETTING_KEY, settingValue: value }, update: { settingValue: value } })
}

async function measure(metric: KpiMetric, from: Date): Promise<number> {
  const db = getPrisma()
  switch (metric) {
    case 'SALES_TOTAL':
      return (await db.invoice.aggregate({ where: { status: 'ACTIVE', invoiceDate: { gte: from } }, _sum: { totalAmount: true } }))._sum.totalAmount ?? 0
    case 'INVOICE_COUNT':
      return db.invoice.count({ where: { status: 'ACTIVE', invoiceDate: { gte: from } } })
    case 'EXPENSE_TOTAL':
      return (await db.expense.aggregate({ where: { expenseDate: { gte: from } }, _sum: { amount: true } }))._sum.amount ?? 0
    case 'PURCHASES_TOTAL':
      return (await db.bill.aggregate({ where: { status: { not: 'VOID' }, billDate: { gte: from } }, _sum: { totalAmount: true } }))._sum.totalAmount ?? 0
    case 'NEW_CUSTOMERS':
      return db.customer.count({ where: { createdAt: { gte: from } } })
  }
}

export const customKpiService = {
  /** The tiles with their current values. */
  async list(now: Date = new Date()) {
    try {
      const kpis = await readAll()
      const data = []
      for (const k of kpis) data.push({ ...k, value: await measure(k.metric, periodStart(k.period, now)) })
      return { success: true, data }
    } catch (err) {
      return fail(err)
    }
  },

  async add(p: { name: string; metric: KpiMetric; period: KpiPeriod }, userId?: string) {
    try {
      const name = p.name.trim()
      if (!name) throw new ServiceError('KPI-001', 'Give the tile a name.')
      const list = await readAll()
      if (list.length >= MAX_KPIS) throw new ServiceError('KPI-002', `You can keep up to ${MAX_KPIS} custom tiles. Remove one first.`)
      const kpi: CustomKpi = { id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.slice(0, 40), metric: p.metric, period: p.period }
      await writeAll([...list, kpi])
      await logAction({ userId, action: 'CUSTOM_KPI_ADDED', entityType: 'CustomKpi', entityId: kpi.id, newValue: { name: kpi.name } })
      return { success: true, data: { id: kpi.id } }
    } catch (err) {
      return fail(err)
    }
  },

  async remove(id: string, userId?: string) {
    try {
      const list = await readAll()
      await writeAll(list.filter((k) => k.id !== id))
      await logAction({ userId, action: 'CUSTOM_KPI_REMOVED', entityType: 'CustomKpi', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  }
}
