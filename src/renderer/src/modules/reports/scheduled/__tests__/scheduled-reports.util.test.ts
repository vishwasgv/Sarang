import { describe, it, expect } from 'vitest'
import { lastCompletePeriod, isDue, fileNameFor, parseSchedules, type ScheduledReport } from '../scheduled-reports.util'

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0, 0)
const base: ScheduledReport = { id: '1', reportId: 'salesByCustomer', frequency: 'DAILY', format: 'CSV', folder: 'C:/Reports', enabled: true, lastPeriodEnd: '' }

describe('lastCompletePeriod', () => {
  it('daily is yesterday, across a month and a year end', () => {
    expect(lastCompletePeriod('DAILY', at(2026, 9, 26))).toEqual({ dateFrom: '2026-09-25', dateTo: '2026-09-25' })
    expect(lastCompletePeriod('DAILY', at(2026, 1, 1))).toEqual({ dateFrom: '2025-12-31', dateTo: '2025-12-31' })
  })
  it('weekly is the previous Monday to Sunday whatever day it is now', () => {
    // 2026-09-26 is a Saturday: previous full week is Mon 14 Sep to Sun 20 Sep
    expect(lastCompletePeriod('WEEKLY', at(2026, 9, 26))).toEqual({ dateFrom: '2026-09-14', dateTo: '2026-09-20' })
    // on a Monday the week that just ended is the one before
    expect(lastCompletePeriod('WEEKLY', at(2026, 9, 21))).toEqual({ dateFrom: '2026-09-14', dateTo: '2026-09-20' })
    // on a Sunday the current week is not finished
    expect(lastCompletePeriod('WEEKLY', at(2026, 9, 27))).toEqual({ dateFrom: '2026-09-14', dateTo: '2026-09-20' })
  })
  it('monthly is the previous calendar month, including a short February and January', () => {
    expect(lastCompletePeriod('MONTHLY', at(2026, 9, 26))).toEqual({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })
    expect(lastCompletePeriod('MONTHLY', at(2028, 3, 2))).toEqual({ dateFrom: '2028-02-01', dateTo: '2028-02-29' })
    expect(lastCompletePeriod('MONTHLY', at(2026, 1, 5))).toEqual({ dateFrom: '2025-12-01', dateTo: '2025-12-31' })
  })
})

describe('isDue', () => {
  it('is due until the last complete period has been saved, then not again the same day', () => {
    expect(isDue(base, at(2026, 9, 26))).toBe(true)
    expect(isDue({ ...base, lastPeriodEnd: '2026-09-25' }, at(2026, 9, 26))).toBe(false)
    expect(isDue({ ...base, lastPeriodEnd: '2026-09-25' }, at(2026, 9, 27))).toBe(true)
  })
  it('catches up once after the app was closed for days, not once per missed day', () => {
    const s = { ...base, lastPeriodEnd: '2026-09-10' }
    expect(isDue(s, at(2026, 9, 26))).toBe(true)
    expect(lastCompletePeriod('DAILY', at(2026, 9, 26)).dateTo).toBe('2026-09-25')
  })
  it('is never due when switched off or without a folder', () => {
    expect(isDue({ ...base, enabled: false }, at(2026, 9, 26))).toBe(false)
    expect(isDue({ ...base, folder: '' }, at(2026, 9, 26))).toBe(false)
  })
})

describe('names and stored settings', () => {
  it('names the file after the report and the dates', () => {
    expect(fileNameFor('Sales by Customer', { dateFrom: '2026-09-01', dateTo: '2026-09-30' })).toBe('Sales by Customer 2026-09-01 to 2026-09-30')
    expect(fileNameFor('Day', { dateFrom: '2026-09-25', dateTo: '2026-09-25' })).toBe('Day 2026-09-25')
  })
  it('reads the stored list defensively', () => {
    expect(parseSchedules(undefined)).toEqual([])
    expect(parseSchedules('not json')).toEqual([])
    expect(parseSchedules('{"a":1}')).toEqual([])
    const ok = parseSchedules(JSON.stringify([base, { id: 'x' }, { ...base, id: '2', frequency: 'HOURLY' }, { ...base, id: '3', enabled: false }]))
    expect(ok.map((s) => s.id)).toEqual(['1', '3'])
    expect(ok[1].enabled).toBe(false)
  })
})
