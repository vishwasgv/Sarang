import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

// Safety net: every report id mapped in ReportContent must resolve to a view
// that draws a chart (Recharts, one of the shared chart components, or an
// explicitly listed heatmap/funnel component). Reads source text only, so it
// stays fast and never renders the very large ReportsScreen file.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const SOURCES = [read('../ReportsScreen.tsx'), read('../FinancialStatementViews.tsx')]

// Components that draw a Recharts chart directly.
const RECHARTS_MARKERS = ['ResponsiveContainer', 'BreakdownChart', 'SeriesBarChart', 'SeriesLineChart', 'DonutChart', 'FunnelBarChart']
// Explicitly allowed non-Recharts charts: the coloured-grid heatmap.
const HEATMAP_FUNNEL_COMPONENTS = ['HeatmapGrid', 'FunnelBarChart']
const CHART_MARKERS = [...RECHARTS_MARKERS, ...HEATMAP_FUNNEL_COMPONENTS]

function functionBody(name: string): string | null {
  for (const src of SOURCES) {
    const m = new RegExp(`(^|\\n)(export )?function ${name}\\b`).exec(src)
    if (!m) continue
    const start = m.index
    const end = src.indexOf('\n}\n', start)
    return src.slice(start, end === -1 ? src.length : end + 3)
  }
  return null
}

function drawsChart(name: string, seen: Set<string> = new Set(), depth = 0): boolean {
  if (seen.has(name) || depth > 3) return false
  seen.add(name)
  const body = functionBody(name)
  if (!body) return false
  if (CHART_MARKERS.some(m => new RegExp(`<${m}[\\s>]`).test(body))) return true
  const children = [...body.matchAll(/<([A-Z][A-Za-z0-9]*)[\s>/]/g)].map(m => m[1])
  return children.some(c => drawsChart(c, seen, depth + 1))
}

function reportCatalogue(): { id: string; view: string }[] {
  const src = SOURCES[0]
  const start = src.indexOf('function ReportContent(')
  const end = src.indexOf('default: return null', start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return [...src.slice(start, end).matchAll(/case '(\w+)': return <(\w+)[\s>]/g)].map(m => ({ id: m[1], view: m[2] }))
}

describe('report chart catalogue', () => {
  const catalogue = reportCatalogue()

  it('finds the full report catalogue in ReportContent', () => {
    expect(catalogue.length).toBeGreaterThanOrEqual(177)
    expect(new Set(catalogue.map(c => c.id)).size).toBe(catalogue.length)
  })

  it('every report view is defined in the reports UI sources', () => {
    const missing = catalogue.filter(c => functionBody(c.view) === null).map(c => `${c.id} -> ${c.view}`)
    expect(missing).toEqual([])
  })

  it('every report shows a chart together with its numbers', () => {
    const chartless = catalogue.filter(c => !drawsChart(c.view)).map(c => `${c.id} -> ${c.view}`)
    expect(chartless).toEqual([])
  })

  it('the shared chart components really render Recharts (or the listed heatmap grid)', () => {
    for (const name of ['SeriesBarChart', 'SeriesLineChart', 'DonutChart', 'FunnelBarChart']) {
      expect(functionBody(name), name).toContain('<ResponsiveContainer')
    }
    expect(functionBody('HeatmapGrid')).toContain('grid')
  })

  it('funnel and heatmap views use the shared chart look, not hand-rolled CSS bars', () => {
    const funnels = ['CandidatePipelineFunnelView', 'LearnerProgressFunnelView', 'DeliverableStatusPipelineView', 'DeliveryPipelineView']
    for (const v of funnels) expect(functionBody(v), v).toContain('<FunnelBarChart')
    const heatmaps = ['ClassAttendanceHeatmapView', 'SizeStyleHeatmapView', 'TableTurnoverHeatmapView']
    for (const v of heatmaps) expect(functionBody(v), v).toContain('<HeatmapGrid')
  })

  it('charts show a clear message instead of a broken chart when there is no data', () => {
    for (const name of ['SeriesBarChart', 'SeriesLineChart', 'DonutChart', 'FunnelBarChart']) {
      expect(functionBody(name), name).toContain('<ChartEmpty')
    }
  })
})
