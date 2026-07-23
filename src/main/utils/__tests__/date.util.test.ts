import { describe, it, expect } from 'vitest'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate } from '../date.util'

// Real bug found 2026-07-23: parseLocalDateEnd did not exist — every date-
// ranged "to" bound across report.service.ts (~35 call sites) was instead
// built as `new Date(dateToString); d.setHours(23,59,59,999)`. That parses
// the bare "YYYY-MM-DD" string as UTC midnight first (one full calendar day
// EARLIER than intended in any negative-UTC-offset timezone), then
// setHours() only rewrites the H/M/S/ms fields — it does NOT correct the
// Year/Month/Date that was already wrong. The result silently drops the
// entire actually-selected end date from the report for any user not in a
// positive UTC offset. parseLocalDateEnd fixes this the same way
// parseLocalDateStart already fixed the "from" bound: construct directly
// from the string's Y/M/D components, never round-tripping through a UTC
// parse.

describe('date.util — parseLocalDateStart / parseLocalDateEnd', () => {
  it('parseLocalDateStart returns local midnight for the given date, not UTC midnight', () => {
    const d = parseLocalDateStart('2026-07-15')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6) // 0-indexed: July
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it('parseLocalDateEnd returns local end-of-day (23:59:59.999) for the given date', () => {
    const d = parseLocalDateEnd('2026-07-15')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
    expect(d.getSeconds()).toBe(59)
    expect(d.getMilliseconds()).toBe(999)
  })

  it('parseLocalDateEnd stays on the SAME calendar date as parseLocalDateStart for the same input, regardless of host timezone', () => {
    // This is the actual regression: the old `new Date(dateTo); setHours(23,59,59,999)`
    // pattern could land parseLocalDateEnd's equivalent on the PREVIOUS
    // calendar date in a negative-UTC-offset timezone (the Y/M/D is fixed by
    // a UTC-midnight parse before setHours ever runs). Both helpers must
    // agree on which calendar date they're bounding.
    const start = parseLocalDateStart('2026-01-01')
    const end = parseLocalDateEnd('2026-01-01')
    expect(end.getFullYear()).toBe(start.getFullYear())
    expect(end.getMonth()).toBe(start.getMonth())
    expect(end.getDate()).toBe(start.getDate())
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('a timestamp late in the day on the selected date falls within [parseLocalDateStart, parseLocalDateEnd]', () => {
    // Simulates an invoice created at 11:58 PM local time on the selected
    // "to" date — exactly the record the buggy pattern silently excluded
    // for negative-UTC-offset users.
    const lateInDay = new Date(2026, 6, 15, 23, 58, 0, 0)
    const start = parseLocalDateStart('2026-07-15')
    const end = parseLocalDateEnd('2026-07-15')
    expect(lateInDay.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(lateInDay.getTime()).toBeLessThanOrEqual(end.getTime())
  })

  it('toLocalISODate round-trips through parseLocalDateStart/parseLocalDateEnd back to the same date string', () => {
    expect(toLocalISODate(parseLocalDateStart('2026-12-31'))).toBe('2026-12-31')
    expect(toLocalISODate(parseLocalDateEnd('2026-12-31'))).toBe('2026-12-31')
  })
})
