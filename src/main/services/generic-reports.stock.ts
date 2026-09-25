import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney, prorateAmount, roundMoney } from '../../shared/utils/money'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate, startOfLocalDay } from '../utils/date.util'
import { getProductCostsBatch } from './valuation.service'
import type { CellValue, GenericReport, GenericReportDefinition, GenericReportParams } from './generic-report.types'

// Stock reports: summary and valuation, movement ledger, ageing, by location and transfers.

type Row = Record<string, CellValue>

async function decimalsOf(): Promise<number> {
  const profile = await getPrisma().businessProfile.findFirst({ select: { currencyCode: true } })
  return getCurrencyDecimals(profile?.currencyCode)
}

async function stockSummary(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const inventories = await db.inventory.findMany({
    select: { productId: true, quantity: true, reservedQuantity: true, reorderLevel: true, product: { select: { productName: true, sku: true, unit: true, isActive: true, category: { select: { name: true } } } } }
  })
  const costs = await getProductCostsBatch(inventories.map((i) => i.productId))
  const rows: Row[] = inventories
    .filter((i) => i.product.isActive)
    .map((i) => {
      const unitCost = costs.get(i.productId) ?? 0
      const status = i.quantity <= 0 ? 'OUT' : i.reorderLevel > 0 && i.quantity <= i.reorderLevel ? 'LOW' : 'OK'
      return {
        name: i.product.productName, sku: i.product.sku ?? '', category: i.product.category?.name ?? '', unit: i.product.unit,
        quantity: i.quantity, reserved: i.reservedQuantity, unitCost, value: prorateAmount(unitCost, i.quantity, 1, decimals), status
      }
    })
    .sort((a, b) => Number(b.value) - Number(a.value))
  const value = sumMoney(rows.map((r) => Number(r.value)), decimals)
  return {
    id: 'stockSummary', dateTo: p.asOf ?? p.dateTo, decimals,
    summary: [
      { labelKey: 'stock.totalValue', type: 'money', value },
      { labelKey: 'stock.items', type: 'number', value: rows.length },
      { labelKey: 'stock.low', type: 'number', value: rows.filter((r) => r.status === 'LOW').length },
      { labelKey: 'stock.out', type: 'number', value: rows.filter((r) => r.status === 'OUT').length }
    ],
    columns: [
      { key: 'name', labelKey: 'stock.item', type: 'text' },
      { key: 'sku', labelKey: 'stock.sku', type: 'text' },
      { key: 'category', labelKey: 'stock.category', type: 'text' },
      { key: 'quantity', labelKey: 'stock.quantity', type: 'number' },
      { key: 'unitCost', labelKey: 'stock.unitCost', type: 'money' },
      { key: 'value', labelKey: 'stock.value', type: 'money' },
      { key: 'status', labelKey: 'stock.status', type: 'text' }
    ],
    rows,
    totals: { name: '', sku: '', category: '', quantity: sumMoney(rows.map((r) => Number(r.quantity)), 3), unitCost: null, value, status: '' },
    chart: { type: 'bar', titleKey: 'stock.chart.value', xKey: 'name', series: [{ key: 'value', labelKey: 'stock.value', money: true }], limit: 10 },
    notes: ['stock.currentStock']
  }
}

async function stockLedger(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const from = parseLocalDateStart(p.dateFrom)
  const to = parseLocalDateEnd(p.dateTo)
  const [before, inPeriod] = await Promise.all([
    db.inventoryMovement.groupBy({ by: ['productId'], where: { createdAt: { lt: from } }, _sum: { quantity: true } }),
    db.inventoryMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { productId: true, movementType: true, quantity: true, referenceType: true, remarks: true, createdAt: true, product: { select: { productName: true } }, location: { select: { name: true } } },
      orderBy: [{ createdAt: 'asc' }]
    })
  ])
  const running = new Map<string, number>(before.map((b) => [b.productId, b._sum.quantity ?? 0]))
  const names = new Map<string, string>()
  for (const m of inPeriod) names.set(m.productId, m.product.productName)
  const rows: Row[] = []
  const ordered = [...inPeriod].sort((a, b) => (names.get(a.productId) ?? '').localeCompare(names.get(b.productId) ?? '') || a.createdAt.getTime() - b.createdAt.getTime())
  let last = ''
  for (const m of ordered) {
    if (m.productId !== last) {
      last = m.productId
      rows.push({ date: null, name: names.get(m.productId) ?? '', type: 'OPENING', quantityIn: null, quantityOut: null, balance: roundMoney(running.get(m.productId) ?? 0, 3), reference: '', location: '' })
    }
    const balance = roundMoney((running.get(m.productId) ?? 0) + m.quantity, 3)
    running.set(m.productId, balance)
    rows.push({
      date: toLocalISODate(m.createdAt), name: names.get(m.productId) ?? '', type: m.movementType,
      quantityIn: m.quantity > 0 ? m.quantity : null, quantityOut: m.quantity < 0 ? -m.quantity : null, balance,
      reference: m.referenceType ?? m.remarks ?? '', location: m.location?.name ?? ''
    })
  }
  const totalIn = sumMoney(inPeriod.filter((m) => m.quantity > 0).map((m) => m.quantity), 3)
  const totalOut = sumMoney(inPeriod.filter((m) => m.quantity < 0).map((m) => -m.quantity), 3)
  const byType = new Map<string, number>()
  for (const m of inPeriod) byType.set(m.movementType, roundMoney((byType.get(m.movementType) ?? 0) + Math.abs(m.quantity), 3))
  return {
    id: 'stockLedger', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'ledger.movements', type: 'number', value: inPeriod.length },
      { labelKey: 'ledger.in', type: 'number', value: totalIn },
      { labelKey: 'ledger.out', type: 'number', value: totalOut },
      { labelKey: 'ledger.items', type: 'number', value: names.size }
    ],
    columns: [
      { key: 'name', labelKey: 'stock.item', type: 'text' },
      { key: 'date', labelKey: 'ledger.date', type: 'date' },
      { key: 'type', labelKey: 'ledger.type', type: 'text' },
      { key: 'quantityIn', labelKey: 'ledger.in', type: 'number' },
      { key: 'quantityOut', labelKey: 'ledger.out', type: 'number' },
      { key: 'balance', labelKey: 'ledger.balance', type: 'number' },
      { key: 'location', labelKey: 'ledger.location', type: 'text' },
      { key: 'reference', labelKey: 'ledger.reference', type: 'text' }
    ],
    rows,
    chart: { type: 'bar', titleKey: 'ledger.chart', xKey: 'type', series: [{ key: 'quantity', labelKey: 'ledger.quantity' }], limit: 12 },
    notes: ['ledger.signed']
  }
}

/** Chart rows for the stock ledger: total quantity moved per movement type. */
export function ledgerByType(rows: Row[]): Row[] {
  const map = new Map<string, number>()
  for (const r of rows) if (r.type !== 'OPENING') map.set(String(r.type), (map.get(String(r.type)) ?? 0) + Number(r.quantityIn ?? 0) + Number(r.quantityOut ?? 0))
  return Array.from(map.entries()).map(([type, quantity]) => ({ type, quantity }))
}

const BUCKETS = [
  { key: 'b0', max: 30 },
  { key: 'b31', max: 60 },
  { key: 'b61', max: 90 },
  { key: 'b90', max: Infinity }
]

async function inventoryAgeing(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const asOf = startOfLocalDay(parseLocalDateEnd(p.asOf ?? p.dateTo))
  const inventories = await db.inventory.findMany({ where: { quantity: { gt: 0 } }, select: { productId: true, quantity: true, product: { select: { productName: true } } } })
  const ids = inventories.map((i) => i.productId)
  const [costs, receipts] = await Promise.all([
    getProductCostsBatch(ids),
    db.inventoryMovement.findMany({ where: { productId: { in: ids }, quantity: { gt: 0 } }, select: { productId: true, quantity: true, createdAt: true }, orderBy: { createdAt: 'desc' } })
  ])
  const byProduct = new Map<string, Array<{ quantity: number; createdAt: Date }>>()
  for (const r of receipts) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r])

  const rows: Row[] = inventories.map((inv) => {
    // The stock on hand is taken to be the most recent receipts (first in, first out).
    let remaining = inv.quantity
    const qty: Record<string, number> = { b0: 0, b31: 0, b61: 0, b90: 0 }
    for (const r of byProduct.get(inv.productId) ?? []) {
      if (remaining <= 0) break
      const take = Math.min(remaining, r.quantity)
      const age = Math.max(0, Math.round((asOf.getTime() - startOfLocalDay(r.createdAt).getTime()) / 86400000))
      qty[BUCKETS.find((b) => age <= b.max)!.key] += take
      remaining -= take
    }
    // Stock with no receipt on record is treated as the oldest.
    if (remaining > 0) qty.b90 += remaining
    const unit = costs.get(inv.productId) ?? 0
    const v = (k: string) => prorateAmount(unit, qty[k], 1, decimals)
    const b0 = v('b0'), b31 = v('b31'), b61 = v('b61'), b90 = v('b90')
    return { name: inv.product.productName, quantity: inv.quantity, b0, b31, b61, b90, total: sumMoney([b0, b31, b61, b90], decimals) }
  }).sort((a, b) => Number(b.b90) - Number(a.b90) || Number(b.total) - Number(a.total))
  const sum = (k: string) => sumMoney(rows.map((r) => Number(r[k])), decimals)
  return {
    id: 'inventoryAgeing', dateTo: p.asOf ?? p.dateTo, decimals,
    summary: [
      { labelKey: 'ageing.total', type: 'money', value: sum('total') },
      { labelKey: 'ageing.b90', type: 'money', value: sum('b90') },
      { labelKey: 'ageing.olderShare', type: 'percent', value: sum('total') > 0 ? prorateAmount(100, sum('b90'), sum('total'), 1) : 0 }
    ],
    columns: [
      { key: 'name', labelKey: 'stock.item', type: 'text' },
      { key: 'quantity', labelKey: 'stock.quantity', type: 'number' },
      { key: 'b0', labelKey: 'ageing.b0', type: 'money' },
      { key: 'b31', labelKey: 'ageing.b31', type: 'money' },
      { key: 'b61', labelKey: 'ageing.b61', type: 'money' },
      { key: 'b90', labelKey: 'ageing.b90', type: 'money' },
      { key: 'total', labelKey: 'stock.value', type: 'money' }
    ],
    rows,
    totals: { name: '', quantity: sumMoney(rows.map((r) => Number(r.quantity)), 3), b0: sum('b0'), b31: sum('b31'), b61: sum('b61'), b90: sum('b90'), total: sum('total') },
    chart: { type: 'bar', titleKey: 'ageing.chart', xKey: 'name', series: [{ key: 'b0', labelKey: 'ageing.b0', money: true }, { key: 'b31', labelKey: 'ageing.b31', money: true }, { key: 'b61', labelKey: 'ageing.b61', money: true }, { key: 'b90', labelKey: 'ageing.b90', money: true }], limit: 10 },
    notes: ['ageing.method']
  }
}

async function stockByLocation(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const stock = await db.locationStock.findMany({ where: { quantity: { not: 0 } }, select: { productId: true, quantity: true, location: { select: { id: true, name: true } } } })
  const costs = await getProductCostsBatch(stock.map((s) => s.productId))
  const map = new Map<string, { name: string; products: Set<string>; qty: number[]; value: number[] }>()
  for (const s of stock) {
    const g = map.get(s.location.id) ?? { name: s.location.name, products: new Set<string>(), qty: [], value: [] }
    g.products.add(s.productId)
    g.qty.push(s.quantity)
    g.value.push(prorateAmount(costs.get(s.productId) ?? 0, s.quantity, 1, decimals))
    map.set(s.location.id, g)
  }
  const rows: Row[] = Array.from(map.values()).map((g) => ({ name: g.name, products: g.products.size, quantity: sumMoney(g.qty, 3), value: sumMoney(g.value, decimals) })).sort((a, b) => Number(b.value) - Number(a.value))
  const value = sumMoney(rows.map((r) => Number(r.value)), decimals)
  return {
    id: 'stockByLocation', dateTo: p.asOf ?? p.dateTo, decimals,
    summary: [
      { labelKey: 'location.count', type: 'number', value: rows.length },
      { labelKey: 'stock.totalValue', type: 'money', value }
    ],
    columns: [
      { key: 'name', labelKey: 'location.name', type: 'text' },
      { key: 'products', labelKey: 'location.products', type: 'number' },
      { key: 'quantity', labelKey: 'stock.quantity', type: 'number' },
      { key: 'value', labelKey: 'stock.value', type: 'money' }
    ],
    rows,
    totals: { name: '', products: null, quantity: sumMoney(rows.map((r) => Number(r.quantity)), 3), value },
    chart: { type: 'pie', titleKey: 'location.chart', xKey: 'name', series: [{ key: 'value', labelKey: 'stock.value', money: true }] },
    notes: ['stock.currentStock']
  }
}

async function transfersRegister(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const moves = await db.inventoryMovement.findMany({
    where: { movementType: { in: ['TRANSFER_IN', 'TRANSFER_OUT'] }, createdAt: { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) } },
    select: { movementType: true, quantity: true, remarks: true, createdAt: true, product: { select: { productName: true } }, location: { select: { name: true } } },
    orderBy: { createdAt: 'asc' }
  })
  const rows: Row[] = moves.map((m) => ({ date: toLocalISODate(m.createdAt), name: m.product.productName, direction: m.movementType, location: m.location?.name ?? '', quantity: Math.abs(m.quantity), remarks: m.remarks ?? '' }))
  return {
    id: 'transfersRegister', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'transfers.count', type: 'number', value: rows.filter((r) => r.direction === 'TRANSFER_OUT').length },
      { labelKey: 'transfers.quantity', type: 'number', value: sumMoney(rows.filter((r) => r.direction === 'TRANSFER_OUT').map((r) => Number(r.quantity)), 3) }
    ],
    columns: [
      { key: 'date', labelKey: 'ledger.date', type: 'date' },
      { key: 'name', labelKey: 'stock.item', type: 'text' },
      { key: 'direction', labelKey: 'transfers.direction', type: 'text' },
      { key: 'location', labelKey: 'ledger.location', type: 'text' },
      { key: 'quantity', labelKey: 'stock.quantity', type: 'number' },
      { key: 'remarks', labelKey: 'ledger.reference', type: 'text' }
    ],
    rows,
    chart: { type: 'line', titleKey: 'transfers.chart', xKey: 'date', series: [{ key: 'quantity', labelKey: 'stock.quantity' }] },
    notes: []
  }
}

// The ledger's chart is per movement type, not per row.
async function stockLedgerWithChart(p: GenericReportParams): Promise<GenericReport> {
  const r = await stockLedger(p)
  return { ...r, chartRows: ledgerByType(r.rows) }
}

async function stockTakeVariance(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const takes = await db.stockTake.findMany({
    where: { status: 'POSTED', postedAt: { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) } },
    select: { lines: { where: { countedQty: { not: null } }, select: { productId: true, productName: true, systemQty: true, countedQty: true } } }
  })
  const map = new Map<string, { name: string; system: number[]; counted: number[] }>()
  for (const t of takes) {
    for (const l of t.lines) {
      const g = map.get(l.productId) ?? { name: l.productName, system: [], counted: [] }
      g.system.push(l.systemQty)
      g.counted.push(l.countedQty as number)
      map.set(l.productId, g)
    }
  }
  const costs = await getProductCostsBatch(Array.from(map.keys()))
  const rows: Row[] = Array.from(map.entries()).map(([id, g]) => {
    const system = sumMoney(g.system, 3)
    const counted = sumMoney(g.counted, 3)
    const variance = roundMoney(counted - system, 3)
    return { name: g.name, counts: g.system.length, system, counted, variance, value: prorateAmount(costs.get(id) ?? 0, variance, 1, decimals) }
  }).filter((r) => Number(r.variance) !== 0).sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value)))
  return {
    id: 'stockTakeVariance', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'takeVariance.counts', type: 'number', value: takes.length },
      { labelKey: 'takeVariance.items', type: 'number', value: rows.length },
      { labelKey: 'takeVariance.surplus', type: 'money', value: sumMoney(rows.filter((r) => Number(r.value) > 0).map((r) => Number(r.value)), decimals) },
      { labelKey: 'takeVariance.shortage', type: 'money', value: sumMoney(rows.filter((r) => Number(r.value) < 0).map((r) => -Number(r.value)), decimals) }
    ],
    columns: [
      { key: 'name', labelKey: 'stock.item', type: 'text' },
      { key: 'counts', labelKey: 'takeVariance.times', type: 'number' },
      { key: 'system', labelKey: 'takeVariance.system', type: 'number' },
      { key: 'counted', labelKey: 'takeVariance.counted', type: 'number' },
      { key: 'variance', labelKey: 'takeVariance.variance', type: 'number' },
      { key: 'value', labelKey: 'takeVariance.value', type: 'money' }
    ],
    rows,
    totals: { name: '', counts: null, system: sumMoney(rows.map((r) => Number(r.system)), 3), counted: sumMoney(rows.map((r) => Number(r.counted)), 3), variance: sumMoney(rows.map((r) => Number(r.variance)), 3), value: sumMoney(rows.map((r) => Number(r.value)), decimals) },
    chart: { type: 'bar', titleKey: 'takeVariance.chart', xKey: 'name', series: [{ key: 'value', labelKey: 'takeVariance.value', money: true }], limit: 10 },
    notes: ['takeVariance.method']
  }
}

export const STOCK_REPORTS: Record<string, GenericReportDefinition> = {
  stockSummary: { permission: 'reports.inventory', run: stockSummary },
  stockLedger: { permission: 'reports.inventory', run: stockLedgerWithChart },
  inventoryAgeing: { permission: 'reports.inventory', run: inventoryAgeing },
  stockByLocation: { permission: 'reports.inventory', run: stockByLocation },
  transfersRegister: { permission: 'reports.inventory', run: transfersRegister },
  stockTakeVariance: { permission: 'reports.inventory', run: stockTakeVariance }
}
