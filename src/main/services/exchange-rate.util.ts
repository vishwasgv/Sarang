// Reading exchange rates from a CSV the owner pastes or opens: one row per currency and date.
// Columns (any order, header row required): currency, rate, date. The rate is how much of the business currency one unit
// of the foreign currency is worth.

export interface ParsedRate {
  currencyCode: string
  rate: number
  rateDate: string // YYYY-MM-DD
}

export interface ParseResult {
  rates: ParsedRate[]
  errors: string[]
}

function splitLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if ((ch === ',' || ch === ';' || ch === '\t') && !quoted) { out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  out.push(cur.trim())
  return out
}

/** Accepts YYYY-MM-DD or DD-MM-YYYY / DD/MM/YYYY (day first, as used in India and most of the world). */
export function normaliseRateDate(text: string): string | null {
  const t = text.trim()
  let y: number, m: number, d: number
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (match) { y = +match[1]; m = +match[2]; d = +match[3] }
  else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) { d = +match[1]; m = +match[2]; y = +match[3] }
  else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseRatesCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const errors: string[] = []
  if (lines.length < 2) return { rates: [], errors: ['The file needs a header row and at least one rate.'] }
  const header = splitLine(lines[0]).map((h) => h.toLowerCase())
  const ci = header.findIndex((h) => h === 'currency' || h === 'code' || h === 'currencycode')
  const ri = header.indexOf('rate')
  const di = header.indexOf('date')
  if (ci < 0 || ri < 0 || di < 0) return { rates: [], errors: ['The header row must have the columns: currency, rate, date.'] }
  const rates: ParsedRate[] = []
  const seen = new Set<string>()
  lines.slice(1).forEach((line, i) => {
    const row = i + 2
    const cells = splitLine(line)
    const code = (cells[ci] ?? '').toUpperCase()
    const rate = Number(cells[ri])
    const date = normaliseRateDate(cells[di] ?? '')
    if (!/^[A-Z]{3}$/.test(code)) return void errors.push(`Row ${row}: "${cells[ci] ?? ''}" is not a 3-letter currency code.`)
    if (!Number.isFinite(rate) || rate <= 0) return void errors.push(`Row ${row}: the rate must be a number above zero.`)
    if (!date) return void errors.push(`Row ${row}: "${cells[di] ?? ''}" is not a valid date.`)
    const key = `${code}|${date}`
    if (seen.has(key)) return void errors.push(`Row ${row}: ${code} appears twice for ${date}.`)
    seen.add(key)
    rates.push({ currencyCode: code, rate, rateDate: date })
  })
  return { rates, errors }
}
