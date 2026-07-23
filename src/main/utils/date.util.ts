// Real bug found live 2026-07-22: `date.toISOString().slice(0, 10)` (or
// `.split('T')[0]`) extracts the UTC calendar date, which lags the real
// local calendar date for the first ~5.5 hours after local midnight in any
// timezone ahead of UTC (IST is +5:30) -- reproduced live in
// AppointmentsScreen.tsx's day-view query and in several report.service.ts
// display columns. Always use this for a date-only (no time-of-day) string
// -- local calendar components, never toISOString().
export function toLocalISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Real bug found 2026-07-22: the inverse direction of the bug above.
// `new Date("YYYY-MM-DD")` (a bare date-only string, exactly what an
// `<input type="date">` sends) is parsed per the ECMAScript spec as UTC
// midnight, not local midnight -- confirmed live: `new Date('2026-07-20')`
// is `2026-07-20T05:30:00` in IST. Every date-range "from" filter built with
// `new Date(dateFromString)` and used directly as a Prisma `gte` bound is
// therefore silently excluding every record between true local midnight and
// 5:30 AM IST on the start date -- asymmetric with the "to" bound, which
// self-corrects because `.setHours(23,59,59,999)` always mutates local wall-
// clock components regardless of the Date's initial parsed instant. This hit
// ~40 functions in report.service.ts (all routed through one `toDate()`
// helper -- a single-point fix) plus analytics.service.ts and the AI
// aggregation/query services. Always use this for a date-only "from" string
// used as a query lower bound -- constructs local midnight directly from the
// Y/M/D components, exactly mirroring toLocalISODate's inverse.
export function parseLocalDateStart(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

// Real bug found 2026-07-23: parseLocalDateStart's own header comment above
// claims the "to" (end) bound of a date range "self-corrects" because
// `new Date(dateToString); d.setHours(23,59,59,999)` "always mutates local
// wall-clock components regardless of the Date's initial parsed instant" —
// true, but incomplete: setHours() only changes the H/M/S/ms fields, it
// does NOT change the Year/Month/Date the mutation is applied to. Those
// were already fixed by the initial UTC-midnight parse of the bare
// "YYYY-MM-DD" string, which is one full calendar day EARLIER than
// intended in any negative-UTC-offset timezone (e.g. `new Date("2026-07-15")`
// parsed in America/New_York, UTC-4, reads as local 2026-07-14 20:00 — one
// day short). setHours(23,59,59,999) then locks in "end of the WRONG day"
// (2026-07-14 23:59:59.999 local), silently dropping the entire actually-
// selected end date from every date-ranged report/query for any user not
// in a positive UTC offset (this app's IST-based primary market never
// triggers it, which is exactly why the "self-corrects" claim above went
// unchallenged — same blind spot, same root cause, as parseLocalDateStart's
// own fix). ~35 call sites in report.service.ts alone used the buggy
// `new Date(dateTo); d.setHours(23,59,59,999)` pattern directly instead of
// this helper. Always use this for a date-only "to" string used as a query
// upper bound — constructs local end-of-day directly from the Y/M/D
// components, exactly mirroring parseLocalDateStart's construction (just
// with the day's last instant instead of its first).
export function parseLocalDateEnd(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999)
}
