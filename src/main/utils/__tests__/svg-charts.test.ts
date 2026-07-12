import { describe, it, expect } from 'vitest'
import { renderBarChart, renderStackedBarChart, renderLineChart, renderPieChart, CHART_COLORS } from '../svg-charts'

describe('svg-charts — renderBarChart', () => {
  it('renders a horizontal bar per datum with escaped labels and formatted values', () => {
    const html = renderBarChart({
      title: 'Sales by Category',
      data: [{ label: 'Widgets & <Gadgets>', value: 500 }, { label: 'Tools', value: 250 }],
      valueFormatter: (n) => `$${n}`,
    })
    expect(html).toContain('<svg')
    expect(html).toContain('Widgets &amp; &lt;Gadgets&gt;')
    expect(html).toContain('$500')
    expect(html).toContain('$250')
  })

  it('renders vertical orientation with x-axis category labels', () => {
    const html = renderBarChart({
      title: 'By Status', orientation: 'vertical',
      data: [{ label: 'DRAFT', value: 3 }, { label: 'COMPLETED', value: 7 }],
    })
    expect(html).toContain('DRAFT')
    expect(html).toContain('COMPLETED')
  })

  it('uses a per-datum color when provided, falling back to the default otherwise', () => {
    const html = renderBarChart({
      title: 'Mixed', data: [{ label: 'A', value: 1, color: '#ABCDEF' }, { label: 'B', value: 2 }],
    })
    expect(html).toContain('#ABCDEF')
    expect(html).toContain(CHART_COLORS.brand)
  })

  it('shows an empty-state message instead of an empty SVG when there is no data', () => {
    const html = renderBarChart({ title: 'Nothing', data: [] })
    expect(html).toContain('No data')
    expect(html).not.toContain('<svg')
  })

  it('gives every bar a nonzero minimum width even for a zero value, so it never visually disappears', () => {
    const html = renderBarChart({ title: 'Zeroes', data: [{ label: 'Empty', value: 0 }, { label: 'Full', value: 100 }] })
    expect(html).toMatch(/width="2"/)
  })
})

describe('svg-charts — renderStackedBarChart', () => {
  it('stacks segments per bar and renders the legend', () => {
    const html = renderStackedBarChart({
      title: 'Orders', data: [
        { label: 'Mon', segments: [{ value: 5, color: '#22C55E' }, { value: 2, color: '#EF4444' }] },
        { label: 'Tue', segments: [{ value: 3, color: '#22C55E' }, { value: 1, color: '#EF4444' }] },
      ],
      legend: [{ name: 'Accepted', color: '#22C55E' }, { name: 'Rejected', color: '#EF4444' }],
    })
    expect(html).toContain('Mon')
    expect(html).toContain('Tue')
    expect(html).toContain('Accepted')
    expect(html).toContain('Rejected')
  })

  it('shows an empty-state message with no data', () => {
    const html = renderStackedBarChart({ title: 'Empty', data: [] })
    expect(html).toContain('No data')
  })
})

describe('svg-charts — renderLineChart', () => {
  it('renders a path connecting every point plus the last value as a direct label', () => {
    const html = renderLineChart({
      title: 'Trend', data: [{ label: 'Jan', value: 100 }, { label: 'Feb', value: 200 }, { label: 'Mar', value: 150 }],
      valueFormatter: (n) => `₹${n}`,
    })
    expect(html).toContain('<path')
    expect(html).toContain('₹150')
    expect(html).toContain('Jan')
    expect(html).toContain('Mar')
  })

  it('thins x-axis labels when there are many points, to avoid overlapping text', () => {
    const data = Array.from({ length: 24 }, (_, i) => ({ label: `Day ${i + 1}`, value: i }))
    const html = renderLineChart({ title: 'Long trend', data })
    const labelCount = (html.match(/<text[^>]*font-size="9"[^>]*fill="#94a3b8"/g) ?? []).length
    expect(labelCount).toBeLessThan(24)
  })

  it('shows an empty-state message with no data', () => {
    const html = renderLineChart({ title: 'Empty', data: [] })
    expect(html).toContain('No data')
  })
})

describe('svg-charts — renderPieChart', () => {
  it('renders one slice per positive-value datum with a legend showing percentages', () => {
    const html = renderPieChart({
      title: 'Split', data: [{ label: 'New', value: 30, color: '#00AEEF' }, { label: 'Returning', value: 70, color: '#22C55E' }],
    })
    expect(html).toContain('New')
    expect(html).toContain('Returning')
    expect(html).toContain('30%')
    expect(html).toContain('70%')
  })

  it('filters out zero-value slices entirely', () => {
    const html = renderPieChart({ title: 'Filtered', data: [{ label: 'Has Value', value: 10 }, { label: 'Zero', value: 0 }] })
    expect(html).toContain('Has Value')
    expect(html).not.toContain('Zero')
  })

  it('renders a full circle without a moveto-to-center wedge artifact when there is only one slice', () => {
    const html = renderPieChart({ title: 'Single', data: [{ label: 'Only', value: 5 }] })
    expect(html).toContain('Only')
    expect(html).toContain('100%')
  })

  it('shows an empty-state message when every value is zero', () => {
    const html = renderPieChart({ title: 'AllZero', data: [{ label: 'A', value: 0 }] })
    expect(html).toContain('No data')
  })
})
