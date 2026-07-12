// Phase 54C — self-contained SVG chart rendering for printed/PDF reports.
// No charting library: printToPDF renders a real Chromium page, so plain
// inline <svg> renders natively — this avoids a main-process dependency on
// any DOM/canvas library and keeps every third-party name out of shipped
// output, matching this project's branding rule. Colors mirror the on-screen
// Recharts conventions already established in ReportsScreen.tsx (brand
// #00AEEF, success #22C55E, warning #F59E0B, danger #EF4444) so a printed
// report looks like the same product as the screen it came from.

export const CHART_COLORS = {
  brand: '#00AEEF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerDeep: '#DC2626',
  neutral: '#94A3B8',
} as const

// A small fixed categorical order for charts that genuinely need series
// identity (not magnitude/status) — used sparingly, only where there is no
// status/ordinal meaning to reuse instead.
const CATEGORICAL = ['#00AEEF', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B']

function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function wrap(title: string, inner: string, extraClass = ''): string {
  return `<div class="chart-block ${extraClass}"><div class="chart-title">${escapeXml(title)}</div>${inner}</div>`
}

export interface BarDatum { label: string; value: number; color?: string }
export interface BarChartOptions {
  title: string
  data: BarDatum[]
  orientation?: 'horizontal' | 'vertical'
  width?: number
  valueFormatter?: (n: number) => string
  defaultColor?: string
}

// Horizontal is the default — it reads best for text labels (category/staff/
// carrier names) and matches DashboardScreen's own "top products" convention.
export function renderBarChart(opts: BarChartOptions): string {
  const { title, data, valueFormatter } = opts
  const orientation = opts.orientation ?? 'horizontal'
  const fmt = valueFormatter ?? ((n: number) => String(n))
  const color = opts.defaultColor ?? CHART_COLORS.brand
  if (data.length === 0) return wrap(title, '<div class="chart-empty">No data</div>')

  const maxVal = Math.max(...data.map(d => d.value), 1)

  if (orientation === 'horizontal') {
    const width = opts.width ?? 720
    const barH = 20, gap = 10
    const leftW = 150, rightW = 70
    const plotW = width - leftW - rightW
    const h = data.length * (barH + gap) + gap
    const bars = data.map((d, i) => {
      const y = gap + i * (barH + gap)
      const w = Math.max(2, (d.value / maxVal) * plotW)
      return `<text x="${leftW - 8}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="10" fill="#475569">${escapeXml(d.label)}</text>` +
        `<rect x="${leftW}" y="${y}" width="${w}" height="${barH}" rx="4" fill="${d.color ?? color}" />` +
        `<text x="${leftW + w + 8}" y="${y + barH / 2 + 4}" font-size="10" font-weight="700" fill="#0f172a">${escapeXml(fmt(d.value))}</text>`
    }).join('')
    return wrap(title, `<svg viewBox="0 0 ${width} ${h}" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`)
  }

  // vertical
  const width = opts.width ?? 640
  const height = 220
  const padding = { top: 16, right: 16, bottom: 34, left: 44 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const barGap = 14
  const barW = Math.max(8, plotW / data.length - barGap)
  const bars = data.map((d, i) => {
    const x = padding.left + i * (barW + barGap) + barGap / 2
    const bh = Math.max(2, (d.value / maxVal) * plotH)
    const y = padding.top + plotH - bh
    return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="${d.color ?? color}" />` +
      `<text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="#0f172a">${escapeXml(fmt(d.value))}</text>` +
      `<text x="${x + barW / 2}" y="${height - 12}" text-anchor="middle" font-size="9" fill="#64748b">${escapeXml(d.label)}</text>`
  }).join('')
  const axisLine = `<line x1="${padding.left}" y1="${padding.top + plotH}" x2="${width - padding.right}" y2="${padding.top + plotH}" stroke="#e2e8f0" />`
  return wrap(title, `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">${axisLine}${bars}</svg>`)
}

export interface StackedBarDatum { label: string; segments: { value: number; color: string; name?: string }[] }
export interface StackedBarChartOptions {
  title: string
  data: StackedBarDatum[]
  legend?: { name: string; color: string }[]
  width?: number
}

export function renderStackedBarChart(opts: StackedBarChartOptions): string {
  const { title, data, legend } = opts
  if (data.length === 0) return wrap(title, '<div class="chart-empty">No data</div>')

  const width = opts.width ?? 640
  const height = 220
  const padding = { top: 16, right: 16, bottom: 34, left: 44 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const totals = data.map(d => d.segments.reduce((s, seg) => s + seg.value, 0))
  const maxVal = Math.max(...totals, 1)
  const barGap = 14
  const barW = Math.max(8, plotW / data.length - barGap)

  const bars = data.map((d, i) => {
    const x = padding.left + i * (barW + barGap) + barGap / 2
    let yCursor = padding.top + plotH
    const segRects = d.segments.map(seg => {
      const segH = Math.max(0, (seg.value / maxVal) * plotH)
      yCursor -= segH
      return `<rect x="${x}" y="${yCursor}" width="${barW}" height="${segH}" fill="${seg.color}" />`
    }).join('')
    return segRects + `<text x="${x + barW / 2}" y="${height - 12}" text-anchor="middle" font-size="9" fill="#64748b">${escapeXml(d.label)}</text>`
  }).join('')
  const axisLine = `<line x1="${padding.left}" y1="${padding.top + plotH}" x2="${width - padding.right}" y2="${padding.top + plotH}" stroke="#e2e8f0" />`
  const legendHtml = legend?.length
    ? `<div class="chart-legend-row">${legend.map(l => `<span class="legend-chip"><span class="legend-swatch" style="background:${l.color}"></span>${escapeXml(l.name)}</span>`).join('')}</div>`
    : ''
  return wrap(title, `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">${axisLine}${bars}</svg>${legendHtml}`)
}

export interface LineDatum { label: string; value: number }
export interface LineChartOptions {
  title: string
  data: LineDatum[]
  width?: number
  valueFormatter?: (n: number) => string
  color?: string
}

export function renderLineChart(opts: LineChartOptions): string {
  const { title, data, valueFormatter } = opts
  const fmt = valueFormatter ?? ((n: number) => String(n))
  const color = opts.color ?? CHART_COLORS.brand
  if (data.length === 0) return wrap(title, '<div class="chart-empty">No data</div>')

  const width = opts.width ?? 720
  const height = 220
  const padding = { top: 20, right: 20, bottom: 30, left: 54 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0
  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + plotH - (d.value / maxVal) * plotH,
  }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + plotH).toFixed(1)} Z`

  // Thin x-axis labels if there are many points, so text never overlaps.
  const labelEvery = data.length > 12 ? Math.ceil(data.length / 12) : 1
  const xLabels = points.map((p, i) => i % labelEvery === 0
    ? `<text x="${p.x.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="9" fill="#94a3b8">${escapeXml(data[i].label)}</text>`
    : ''
  ).join('')
  const dots = points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" />`).join('')
  const lastPoint = points[points.length - 1]
  const lastLabel = `<text x="${lastPoint.x.toFixed(1)}" y="${(lastPoint.y - 8).toFixed(1)}" text-anchor="end" font-size="10" font-weight="700" fill="#0f172a">${escapeXml(fmt(data[data.length - 1].value))}</text>`

  const svg = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">
    <line x1="${padding.left}" y1="${(padding.top + plotH).toFixed(1)}" x2="${width - padding.right}" y2="${(padding.top + plotH).toFixed(1)}" stroke="#e2e8f0" />
    <path d="${areaD}" fill="${color}" fill-opacity="0.12" stroke="none" />
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" />
    ${dots}${lastLabel}${xLabels}
  </svg>`
  return wrap(title, svg)
}

export interface PieDatum { label: string; value: number; color?: string }
export interface PieChartOptions {
  title: string
  data: PieDatum[]
  size?: number
  valueFormatter?: (n: number) => string
}

export function renderPieChart(opts: PieChartOptions): string {
  const { title, valueFormatter } = opts
  const fmt = valueFormatter ?? ((n: number) => String(n))
  const data = opts.data.filter(d => d.value > 0)
  if (data.length === 0) return wrap(title, '<div class="chart-empty">No data</div>')

  const size = opts.size ?? 180
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const cx = size / 2, cy = size / 2, r = size / 2 - 8
  let angle = -90
  const slices = data.map((d, i) => {
    const color = d.color ?? CATEGORICAL[i % CATEGORICAL.length]
    const sliceAngle = (d.value / total) * 360
    const startRad = (angle * Math.PI) / 180
    const endRad = ((angle + sliceAngle) * Math.PI) / 180
    const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad)
    const largeArc = sliceAngle > 180 ? 1 : 0
    const path = data.length === 1
      ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
      : `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
    angle += sliceAngle
    return { path, color, label: d.label, value: d.value, pct: Math.round((d.value / total) * 100) }
  })

  const svg = `<svg viewBox="0 0 ${size} ${size}" style="width:100%;max-width:${size}px;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">
    ${slices.map(s => `<path d="${s.path}" fill="${s.color}" stroke="#fff" stroke-width="2" />`).join('')}
  </svg>`
  const legend = `<div class="chart-legend">${slices.map(s =>
    `<div class="legend-item"><span class="legend-swatch" style="background:${s.color}"></span>${escapeXml(s.label)} — ${escapeXml(fmt(s.value))} (${s.pct}%)</div>`
  ).join('')}</div>`

  return wrap(title, `<div class="chart-pie-row"><div>${svg}</div>${legend}</div>`, 'chart-block-flex')
}

// Shared <style> block appended once by generateReportHtml — kept here so the
// chart markup and its CSS travel together and never drift out of sync.
export const CHART_STYLES = `
  .chart-block { margin: 16px 0; }
  .chart-title { font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
  .chart-empty { font-size: 10px; color: #94a3b8; font-style: italic; padding: 12px 0; }
  .chart-block-flex .chart-pie-row { display: flex; align-items: center; gap: 20px; }
  .chart-legend { font-size: 9px; color: #334155; }
  .legend-item { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .legend-swatch { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
  .chart-legend-row { display: flex; gap: 14px; margin-top: 6px; flex-wrap: wrap; }
  .legend-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 9px; color: #334155; }
`
