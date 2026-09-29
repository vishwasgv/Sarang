// Receipt OCR (J10, 2026-09-29): scan a photo of a receipt and pre-fill the Expense form.
// Split deliberately into two pieces:
//  - parseReceiptText() is a pure function (no image/OCR involved) — fully unit-tested against
//    real-shaped receipt text fixtures in the test file next to this one.
//  - runReceiptOcr() wraps tesseract.js to turn an image into text. This half has NOT been
//    live-verified end to end in the packaged Electron renderer (worker/WASM asset loading
//    under Electron's file:// protocol is a known trouble spot for this library) — flag it for
//    a live check (see M4/M8 in BUILD CHECKLIST.md) before relying on it.
//
// Either way, this is a convenience: the user always sees the detected values in the normal
// editable form fields before saving, never auto-submitted, so a bad OCR read costs a moment
// of re-typing, not a wrong expense on the books.

export interface ParsedReceipt {
  amount?: number
  /** ISO yyyy-mm-dd, local calendar date as printed on the receipt — never derived from "now". */
  date?: string
  vendor?: string
}

// \b before the group matters: without it, "total" matches inside "Subtotal" too (no word
// boundary between "sub" and "total"), which would pick the subtotal line over the real total.
const AMOUNT_KEYWORD_RE = /\b(grand\s*total|total\s*amount|amount\s*due|balance\s*due|net\s*payable|total)\s*[:\-]?\s*(?:rs\.?|inr|₹|\$|usd)?\s*([\d,]+\.\d{1,2}|[\d,]+)/i
// Fallback: a money-shaped number anywhere in the text (used only when no labelled total line
// is found). `[\s\S]` capture group requires either a decimal point (how money is normally
// printed) or, if no decimal number exists at all, a bounded whole number.
const ANY_AMOUNT_RE = /(?:rs\.?|inr|₹|\$|usd)?\s*([\d]{1,3}(?:,\d{2,3})*\.\d{1,2}|[\d]{2,7}\.\d{1,2}|[\d]{2,7})/gi

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
}

function pad2(n: string | number): string {
  return String(n).padStart(2, '0')
}

function normalizeYear(y: string): string {
  if (y.length === 4) return y
  const n = Number(y)
  return n <= 69 ? `20${pad2(n)}` : `19${pad2(n)}`
}

/** Finds the first date-shaped substring. Returns the ISO date and the raw matched text (so
 *  callers can strip it out of the text before hunting for a fallback amount — otherwise a
 *  bare year or day-of-month reads as a plausible "amount"). */
function extractDate(text: string): { date?: string; raw?: string } {
  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy (also accepts 2-digit year)
  const numeric = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/)
  if (numeric) {
    const [raw, d, m, y] = numeric
    const day = Number(d), month = Number(m)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: `${normalizeYear(y)}-${pad2(m)}-${pad2(d)}`, raw }
    }
  }
  // "12 Jan 2026" / "12 January 2026" — capture groups give day/month/year directly, no
  // re-parsing of digits out of the matched string (that was the source of an earlier bug:
  // picking the day up as if it were the year).
  const dayMonthYear = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})\b/)
  if (dayMonthYear) {
    const [raw, d, monName, y] = dayMonthYear
    const abbr = monName.slice(0, 3).toLowerCase()
    if (MONTHS[abbr] && Number(d) >= 1 && Number(d) <= 31) {
      return { date: `${normalizeYear(y)}-${MONTHS[abbr]}-${pad2(d)}`, raw }
    }
  }
  // "Jan 12, 2026" / "January 12 2026"
  const monthDayYear = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/)
  if (monthDayYear) {
    const [raw, monName, d, y] = monthDayYear
    const abbr = monName.slice(0, 3).toLowerCase()
    if (MONTHS[abbr] && Number(d) >= 1 && Number(d) <= 31) {
      return { date: `${normalizeYear(y)}-${MONTHS[abbr]}-${pad2(d)}`, raw }
    }
  }
  return {}
}

function extractAmount(text: string, dateRaw?: string): number | undefined {
  const keyed = text.match(AMOUNT_KEYWORD_RE)
  if (keyed) {
    const n = Number(keyed[2].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
  }
  // No labelled total — mask out the date substring first (a bare year or day-of-month is not
  // a plausible amount), then prefer decimal-formatted numbers (how money is normally printed)
  // over bare whole numbers (more likely a quantity, invoice number or phone-number fragment);
  // only fall back to whole numbers if no decimal number exists anywhere in the remaining text.
  const searchText = dateRaw ? text.replace(dateRaw, ' ') : text
  const decimals: number[] = []
  const wholes: number[] = []
  let m: RegExpExecArray | null
  ANY_AMOUNT_RE.lastIndex = 0
  while ((m = ANY_AMOUNT_RE.exec(searchText))) {
    const raw = m[1]
    const n = Number(raw.replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0 || n >= 10_000_000) continue
    if (raw.includes('.')) decimals.push(n)
    else wholes.push(n)
  }
  if (decimals.length > 0) return Math.round(Math.max(...decimals) * 100) / 100
  if (wholes.length > 0) return Math.max(...wholes)
  return undefined
}

function extractVendor(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  // The vendor/store name is almost always one of the first few non-empty lines, and is rarely
  // a line that is only digits/currency/a date — skip those.
  for (const line of lines.slice(0, 5)) {
    if (line.length < 3) continue
    if (/^[\d\s.,\-/:₹$]+$/.test(line)) continue
    if (/^(receipt|invoice|bill|tax\s*invoice|gstin|date|time)\b/i.test(line)) continue
    return line.slice(0, 80)
  }
  return undefined
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const text = (rawText || '').trim()
  if (!text) return {}
  const { date, raw: dateRaw } = extractDate(text)
  return {
    amount: extractAmount(text, dateRaw),
    date,
    vendor: extractVendor(text)
  }
}

/**
 * Runs offline OCR on an image (a photo/scan of a receipt) and returns the parsed fields.
 *
 * All three of tesseract.js's asset paths (worker script, WASM core, trained data) are pointed
 * explicitly at the locally bundled copies in resources/ocr (see electron-builder.config.ts and
 * app.handler.ts's app:getPaths → ocrAssetsUrl) — tesseract.js's own documented default, when
 * any of these is left unset, is to silently fetch it from the jsdelivr CDN, which would be a
 * real breach of Sarang's offline-first, no-network-calls architecture. corePath is given as the
 * exact .js filename (not the bundled directory) to skip tesseract's own SIMD/relaxed-SIMD
 * auto-detection, since only the plain SIMD-LSTM core variant is bundled — Electron's Chromium
 * always supports WASM SIMD, so this is safe, but auto-detection could otherwise pick a
 * relaxed-SIMD variant that was never bundled and fail to load it.
 *
 * NOT live-verified end-to-end in the packaged app yet: this app's renderer runs with
 * sandbox: true and webSecurity: true (see src/main/index.ts), and Web Worker + WASM loading
 * of local files under those settings is a known trouble spot for this library that needs a
 * hands-on check before this feature is relied on (BUILD CHECKLIST.md M4/M8 — live checks).
 * The Expense form never auto-saves a detected value, so the worst case of this not working is
 * a friendly "couldn't read that receipt" message, not a data-integrity problem.
 */
export async function runReceiptOcr(imageFile: File, onProgress?: (pct: number) => void): Promise<ParsedReceipt> {
  const paths = await window.api.app.getPaths()
  const assetsUrl = (paths as { data?: { ocrAssetsUrl?: string } })?.data?.ocrAssetsUrl
  if (!assetsUrl) throw new Error('OCR assets path not available')

  const { recognize } = await import('tesseract.js')
  const result = await recognize(imageFile, 'eng', {
    workerPath: `${assetsUrl}/worker.min.js`,
    corePath: `${assetsUrl}/tesseract-core-simd-lstm.wasm.js`,
    langPath: assetsUrl,
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress?.(Math.round(m.progress * 100))
    }
  })
  return parseReceiptText(result.data.text)
}
