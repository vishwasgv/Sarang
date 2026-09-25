import { describe, it, expect } from 'vitest'
import { parseHiddenSections, toggleSection, dashboardHiddenKey } from '../dashboard-sections.util'

describe('dashboard sections', () => {
  it('parses safely', () => {
    expect(parseHiddenSections(null)).toEqual([])
    expect(parseHiddenSections('nope')).toEqual([])
    expect(parseHiddenSections('{"a":1}')).toEqual([])
    expect(parseHiddenSections('["kpis","bogus","ask"]')).toEqual(['ask', 'kpis'])
  })
  it('toggles', () => {
    expect(toggleSection([], 'quick')).toEqual(['quick'])
    expect(toggleSection(['quick', 'ask'], 'quick')).toEqual(['ask'])
  })
  it('keys per user', () => {
    expect(dashboardHiddenKey('u1')).not.toBe(dashboardHiddenKey('u2'))
  })
})
