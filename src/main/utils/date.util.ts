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
