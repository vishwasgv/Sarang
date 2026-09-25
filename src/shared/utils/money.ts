// Single source of truth for document money maths. Pure and dependency-free so
// the Electron main process (what gets SAVED) and the renderer (what the
// cashier SEES) run the exact same code and can never disagree by a paisa.
//
// All arithmetic is exact: inputs (JS numbers or numeric strings) are parsed
// from their shortest decimal representation into BigInt mantissa/scale pairs,
// every amount is held in integer minor units, and rounding is half away from
// zero (identical to Decimal.ROUND_HALF_UP for the values used here).

export type RoundingRule = 'NONE' | '0.05' | '0.10' | '0.50' | '1'
export const ROUNDING_RULES: readonly RoundingRule[] = ['NONE', '0.05', '0.10', '0.50', '1']
export const ROUNDING_RULE_SETTING_KEY = 'invoice_rounding_rule'
export const PRICES_INCLUDE_TAX_SETTING_KEY = 'prices_include_tax'

/** Business default for "prices include tax". Anything other than the string 'true' is false. */
export function resolvePricesIncludeTax(stored: unknown): boolean {
  return stored === true || stored === 'true'
}

export function isRoundingRule(v: unknown): v is RoundingRule {
  return typeof v === 'string' && (ROUNDING_RULES as readonly string[]).includes(v)
}

// INR keeps its historical whole-rupee rounding; every other currency is exact.
export function defaultRoundingRule(currencyCode?: string | null): RoundingRule {
  return (currencyCode ?? 'INR') === 'INR' ? '1' : 'NONE'
}

export function resolveRoundingRule(stored: unknown, currencyCode?: string | null): RoundingRule {
  return isRoundingRule(stored) ? stored : defaultRoundingRule(currencyCode)
}

const ZERO_DECIMAL_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'])
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])

export function getCurrencyDecimals(currencyCode?: string | null): number {
  if (!currencyCode) return 2
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(currencyCode)) return 3
  return 2
}

/**
 * Decimals to display or print for a currency. The owner's `decimal_places` setting may show fewer digits for
 * a 2-decimal currency, but a 3-decimal currency (KWD, BHD, OMR, JOD, TND) never hides its third decimal and a
 * no-subunit currency (JPY, KRW) never shows a subunit. An unset or invalid setting means the currency's own.
 */
export function resolveDisplayDecimals(currencyCode: string | null | undefined, stored: unknown): number {
  const own = getCurrencyDecimals(currencyCode)
  const n = typeof stored === 'number' ? stored : typeof stored === 'string' ? parseInt(stored, 10) : NaN
  if (!Number.isFinite(n) || n < 0) return own
  if (own === 3) return Math.max(Math.floor(n), 3)
  if (own === 0) return 0
  return Math.min(Math.floor(n), 4)
}

// ---------------------------------------------------------------- internals
interface Dec { n: bigint; s: number } // value = n / 10^s, s >= 0

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const TEN = BigInt(10)
const HUNDRED = BigInt(100)

const P10_CACHE: bigint[] = [ONE]
function pow10(k: number): bigint {
  while (P10_CACHE.length <= k) P10_CACHE.push(P10_CACHE[P10_CACHE.length - 1] * TEN)
  return P10_CACHE[k]
}

export type NumericInput = number | string | { toString(): string } | null | undefined

function toDec(x: NumericInput): Dec {
  if (x === null || x === undefined) return { n: ZERO, s: 0 }
  if (typeof x === 'number' && !Number.isFinite(x)) return { n: ZERO, s: 0 }
  const m = /^([+-]?)(\d*)\.?(\d*)(?:e([+-]?\d+))?$/i.exec(String(x).trim())
  if (!m) return { n: ZERO, s: 0 }
  const digits = (m[2] ?? '') + (m[3] ?? '')
  let n = digits === '' ? ZERO : BigInt(digits)
  let s = (m[3] ?? '').length - (m[4] ? parseInt(m[4], 10) : 0)
  if (s < 0) { n = n * pow10(-s); s = 0 }
  return { n: m[1] === '-' ? -n : n, s }
}

// Integer division rounded half away from zero. den must be > 0.
function divRound(num: bigint, den: bigint): bigint {
  const neg = num < ZERO
  const a = neg ? -num : num
  let q = a / den
  if ((a % den) * TWO >= den) q += ONE
  return neg ? -q : q
}

function toMinor(d: Dec, decimals: number): bigint {
  if (d.s <= decimals) return d.n * pow10(decimals - d.s)
  return divRound(d.n, pow10(d.s - decimals))
}

// Built from the exact decimal string so the resulting double is the correctly-rounded value
// (identical to parsing "12.34"), never a product of float division.
function fromMinor(m: bigint, decimals: number): number {
  if (decimals === 0) return Number(m) + 0
  const neg = m < ZERO
  const digits = (neg ? -m : m).toString().padStart(decimals + 1, '0')
  const cut = digits.length - decimals
  return Number(`${neg ? '-' : ''}${digits.slice(0, cut)}.${digits.slice(cut)}`) + 0 // "+ 0" normalises -0
}

function minBig(a: bigint, b: bigint): bigint { return a < b ? a : b }
function maxBig(a: bigint, b: bigint): bigint { return a > b ? a : b }

function taxOnMinor(taxableMinor: bigint, rate: Dec): bigint {
  return divRound(taxableMinor * rate.n, HUNDRED * pow10(rate.s))
}

// Tax-exclusive part of a tax-inclusive amount: round_half_up(inclusive / (1 + rate/100)).
function exclusiveOfInclusive(inclusiveMinor: bigint, rate: Dec): bigint {
  const base = HUNDRED * pow10(rate.s)
  return divRound(inclusiveMinor * base, base + rate.n)
}

// ------------------------------------------------------------ public helpers
export function roundMoney(amount: NumericInput, decimals = 2): number {
  return fromMinor(toMinor(toDec(amount), decimals), decimals)
}

export function sumMoney(amounts: NumericInput[], decimals = 2): number {
  // Sum exactly at the widest input scale, round once at the end.
  const decs = amounts.map(toDec)
  const scale = decs.reduce((m, d) => Math.max(m, d.s), 0)
  const total = decs.reduce((acc, d) => acc + d.n * pow10(scale - d.s), ZERO)
  return fromMinor(toMinor({ n: total, s: scale }, decimals), decimals)
}

/** amount x part / whole rounded half-up to `decimals`, computed exactly (no float division). */
export function prorateAmount(amount: NumericInput, part: NumericInput, whole: NumericInput, decimals = 2): number {
  const a = toDec(amount)
  const p = toDec(part)
  const w = toDec(whole)
  if (w.n === ZERO) return 0
  // (a.n/10^a.s) * (p.n/10^p.s) / (w.n/10^w.s), scaled to minor units.
  const num = a.n * p.n * pow10(decimals) * pow10(w.s)
  const den = w.n * pow10(a.s + p.s)
  return fromMinor(divRound(w.n < ZERO ? -num : num, w.n < ZERO ? -den : den), decimals)
}

/**
 * amount / quantity rounded half-up to `places` (default 6), exact. Used to derive a per-unit tax-exclusive
 * cost from a stored line taxable value without float division.
 */
export function unitAmount(amount: NumericInput, quantity: NumericInput, places = 6): number {
  return prorateAmount(amount, 1, quantity, places)
}

/** amount x rate% rounded half-up to `decimals`. */
export function taxOnAmount(amount: NumericInput, taxRate: NumericInput, decimals = 2): number {
  const a = toDec(amount)
  const r = toDec(taxRate)
  // value = a.n * r.n / (100 * 10^(a.s + r.s)); minor units = value * 10^decimals
  return fromMinor(divRound(a.n * r.n * pow10(decimals), HUNDRED * pow10(a.s + r.s)), decimals)
}

function ruleStepMinor(rule: RoundingRule, decimals: number): bigint | null {
  if (rule === 'NONE') return null
  const hundredths = rule === '0.05' ? 5 : rule === '0.10' ? 10 : rule === '0.50' ? 50 : 100
  const scaled = BigInt(hundredths) * pow10(decimals)
  if (scaled % HUNDRED !== ZERO) return null // step finer than the currency's minor unit
  const step = scaled / HUNDRED
  return step <= ONE ? null : step
}

/** Rounds `amount` to the nearest multiple of the rule's step (half away from zero). */
export function applyRoundingRule(amount: NumericInput, rule: RoundingRule, decimals = 2): { total: number; rounding: number } {
  const raw = toMinor(toDec(amount), decimals)
  const step = ruleStepMinor(rule, decimals)
  if (step === null) return { total: fromMinor(raw, decimals), rounding: 0 }
  const total = divRound(raw, step) * step
  return { total: fromMinor(total, decimals), rounding: fromMinor(total - raw, decimals) }
}

/** Splits a tax amount into two halves (CGST/SGST) that always add back to the tax exactly. */
export function splitTaxHalves(taxAmount: NumericInput, decimals = 2): { first: number; second: number } {
  const minor = toMinor(toDec(taxAmount), decimals)
  const first = minor / TWO // truncates toward zero; tax is non-negative
  return { first: fromMinor(first, decimals), second: fromMinor(minor - first, decimals) }
}

/**
 * Converts a per-unit price between tax-exclusive and tax-inclusive form at the given rate, rounded half-up to
 * `decimals`. Used only to prefill a line when a catalogue price is in the other mode than the document.
 */
export function convertPriceMode(price: NumericInput, taxRate: NumericInput, toInclusive: boolean, decimals = 2): number {
  const p = toMinor(toDec(price), decimals)
  const rate = toDec(taxRate)
  if (toInclusive) {
    const base = HUNDRED * pow10(rate.s)
    return fromMinor(divRound(p * (base + rate.n), base), decimals)
  }
  return fromMinor(exclusiveOfInclusive(p, rate), decimals)
}

export interface MoneyLineInput {
  quantity: NumericInput
  unitPrice: NumericInput
  /** Flat discount amount on this line. Ignored when discountPercent is given. */
  discountAmount?: NumericInput
  /** Percent discount on the rounded line gross (quotation style). */
  discountPercent?: NumericInput
  taxRate?: NumericInput
}

export interface MoneyLineResult {
  /** Tax-exclusive value of the line before any discount (equals grossEntered when prices are exclusive). */
  gross: number
  /** qty x unitPrice exactly as entered (tax-inclusive when prices include tax). */
  grossEntered: number
  /** Line discount exactly as entered (a tax-inclusive amount when prices include tax). */
  discountAmount: number
  taxable: number
  tax: number
  /** taxable + tax: what the line costs the buyer (after every discount). */
  total: number
  taxRate: number
}

export interface MoneyOptions {
  decimals?: number
  roundingRule?: RoundingRule
  /**
   * Invoice-level discount. Allocated across lines proportionally to each line's value after its own
   * discount (taxable value for exclusive prices, tax-inclusive value for inclusive prices).
   */
  globalDiscount?: NumericInput
  /** Reverse-charge documents: tax is computed but not added to the payable total. */
  excludeTaxFromTotal?: boolean
  /**
   * Unit prices (and discounts) already contain the line's tax. Header meaning stays the same:
   * subtotal and discountAmount are tax-exclusive, so subtotal - discountAmount + taxAmount = rawTotal.
   */
  pricesIncludeTax?: boolean
}

export interface MoneyTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  rawTotal: number
  roundingAmount: number
  totalAmount: number
  lines: MoneyLineResult[]
}

export function computeDocumentTotals(lineInputs: MoneyLineInput[], opts: MoneyOptions = {}): MoneyTotals {
  const decimals = opts.decimals ?? 2
  const inclusive = opts.pricesIncludeTax === true

  // `base` is the line value the global discount is allocated over: taxable value when prices are
  // exclusive, the tax-inclusive value when they include tax.
  const rows = lineInputs.map((li) => {
    const q = toDec(li.quantity)
    const p = toDec(li.unitPrice)
    const rate = toDec(li.taxRate)
    const gross = toMinor({ n: q.n * p.n, s: q.s + p.s }, decimals)
    let disc: bigint
    if (li.discountPercent !== undefined && li.discountPercent !== null) {
      const pct = toDec(li.discountPercent)
      disc = divRound(gross * pct.n, HUNDRED * pow10(pct.s))
    } else {
      disc = toMinor(toDec(li.discountAmount), decimals)
    }
    disc = maxBig(ZERO, minBig(disc, gross))
    return { gross, disc, base: gross - disc, rate, taxable: ZERO, tax: ZERO, exGross: gross, rateNum: Number(li.taxRate) || 0 }
  })

  const gd = maxBig(ZERO, toMinor(toDec(opts.globalDiscount), decimals))
  const totalBase = rows.reduce((a, r) => a + r.base, ZERO)
  const finalBase = rows.map((r) => r.base)
  let gdUnapplied = gd // part of the discount no line had room for; it stays visible so an over-discount goes negative
  if (gd > ZERO && totalBase > ZERO && rows.length > 0) {
    // Proportional shares (each rounded), the last line takes the remainder so the shares sum to
    // the discount exactly. A share can never exceed its line's own value: any excess
    // (only possible on tiny lines) is pushed back onto earlier lines that still have room, so
    // the lines always add up to the header total to the last minor unit.
    const shares: bigint[] = []
    let allocated = ZERO
    rows.forEach((r, idx) => {
      const isLast = idx === rows.length - 1
      const share = isLast ? gd - allocated : divRound(gd * r.base, totalBase)
      if (!isLast) allocated += share
      shares.push(minBig(share, r.base))
    })
    let deficit = gd - shares.reduce((a, x) => a + x, ZERO)
    for (let i = rows.length - 1; i >= 0 && deficit > ZERO; i--) {
      const add = minBig(deficit, rows[i].base - shares[i])
      if (add > ZERO) { shares[i] += add; deficit -= add }
    }
    rows.forEach((r, idx) => { finalBase[idx] = r.base - shares[idx] })
    gdUnapplied = deficit
  }

  rows.forEach((r, idx) => {
    if (inclusive) {
      r.taxable = exclusiveOfInclusive(finalBase[idx], r.rate)
      r.tax = finalBase[idx] - r.taxable
      r.exGross = exclusiveOfInclusive(r.gross, r.rate)
    } else {
      r.taxable = finalBase[idx]
      r.tax = taxOnMinor(r.taxable, r.rate)
    }
  })

  const subtotal = rows.reduce((a, r) => a + r.exGross, ZERO)
  const taxableMinor = rows.reduce((a, r) => a + r.taxable, ZERO)
  // Exclusive: line discounts + global discount. Inclusive: whatever separates the exclusive
  // subtotal from the final taxable value, so subtotal - discount + tax = raw total to the last unit.
  const discountMinor = inclusive ? subtotal - taxableMinor + gdUnapplied : rows.reduce((a, r) => a + r.disc, ZERO) + gd
  const taxMinor = rows.reduce((a, r) => a + r.tax, ZERO)
  const rawMinor = subtotal - discountMinor + (opts.excludeTaxFromTotal ? ZERO : taxMinor)

  const step = ruleStepMinor(opts.roundingRule ?? 'NONE', decimals)
  const totalMinor = step === null ? rawMinor : divRound(rawMinor, step) * step

  return {
    subtotal: fromMinor(subtotal, decimals),
    discountAmount: fromMinor(discountMinor, decimals),
    taxAmount: fromMinor(taxMinor, decimals),
    rawTotal: fromMinor(rawMinor, decimals),
    roundingAmount: fromMinor(totalMinor - rawMinor, decimals),
    totalAmount: fromMinor(totalMinor, decimals),
    lines: rows.map((r) => ({
      gross: fromMinor(r.exGross, decimals),
      grossEntered: fromMinor(r.gross, decimals),
      discountAmount: fromMinor(r.disc, decimals),
      taxable: fromMinor(r.taxable, decimals),
      tax: fromMinor(r.tax, decimals),
      total: fromMinor(r.taxable + r.tax, decimals),
      taxRate: r.rateNum
    }))
  }
}

export interface StoredInvoiceLine {
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
}

/**
 * Taxable value of a stored invoice line, for reports and returns. The stored line total already holds
 * the line's discount and its share of any invoice-level discount, so the taxable value is the stored
 * line total less the stored tax, for tax-exclusive and tax-inclusive documents alike (unit price x
 * quantity is never the taxable value: it ignores the invoice-level discount and, on inclusive
 * documents, contains the tax). Return lines store the negative taxable value as their line total.
 * Returns a positive magnitude for a return; callers apply the sign.
 */
export function storedLineTaxable(line: StoredInvoiceLine, doc: { pricesIncludeTax?: boolean | null; isReturn?: boolean }): number {
  if (doc.isReturn) return Math.abs(line.lineTotal)
  return roundMoney(line.lineTotal - line.taxAmount, 3)
}

// ------------------------------------------------------------------ credit and debit notes
export interface NoteLineInput { quantity: NumericInput; unitPrice: NumericInput; taxRate?: NumericInput }

export interface NoteTotalsInput {
  /** Itemised note. When absent the note is a plain amount. */
  items?: NoteLineInput[]
  /** Plain-amount note: the entered amount (taxable when prices are exclusive, tax-inclusive when they include tax). */
  amount?: NumericInput
  /** false: no tax at all; the total equals the taxable amount and every tax rate is ignored. */
  taxApplied: boolean
  /** Plain-amount note only: the rate applied to the entered amount. */
  taxRate?: NumericInput
  pricesIncludeTax: boolean
  decimals?: number
}

export interface NoteTotals {
  taxApplied: boolean
  pricesIncludeTax: boolean
  /** Tax-exclusive value of the note. */
  taxable: number
  taxAmount: number
  /** What the note is worth: taxable + tax. Notes carry no rounding rule (they reverse what was charged). */
  totalAmount: number
  taxRate: number | null
  lines: Array<{ taxable: number; tax: number; total: number; taxRate: number }>
}

/**
 * The single calculation behind a credit or debit note, used by the form, the service that saves it and every
 * print. The tax amount and total never depend on how the tax is presented (CGST + SGST, IGST or GST).
 */
export function computeNoteTotals(input: NoteTotalsInput): NoteTotals {
  const decimals = input.decimals ?? 2
  const applied = input.taxApplied === true
  const itemised = !!input.items && input.items.length > 0
  const lineInputs: MoneyLineInput[] = itemised
    ? input.items!.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, taxRate: applied ? i.taxRate : 0 }))
    : [{ quantity: 1, unitPrice: input.amount, taxRate: applied ? input.taxRate : 0 }]
  const t = computeDocumentTotals(lineInputs, { decimals, pricesIncludeTax: applied && input.pricesIncludeTax })
  return {
    taxApplied: applied,
    pricesIncludeTax: input.pricesIncludeTax,
    taxable: roundMoney(t.totalAmount - t.taxAmount, decimals) + 0,
    taxAmount: t.taxAmount + 0,
    totalAmount: t.totalAmount + 0,
    taxRate: itemised ? null : applied ? (Number(input.taxRate) || 0) : null,
    lines: t.lines.map((l) => ({ taxable: l.taxable + 0, tax: l.tax + 0, total: l.total + 0, taxRate: l.taxRate }))
  }
}

// ------------------------------------------------------------------ splitting a stored invoice
export interface SplitSourceLine {
  quantity: number
  unitPrice: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  lineTotal: number
}

export interface SplitAllocation { lineIndex: number; quantity: number }

export interface SplitPieceLine {
  lineIndex: number
  quantity: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
  /** Tax-exclusive value before any discount, prorated from the original line. */
  gross: number
}

export interface SplitPiece {
  lines: SplitPieceLine[]
  subtotal: number
  discountAmount: number
  taxAmount: number
  /** subtotal - discountAmount + taxAmount, before any cash rounding. */
  rawTotal: number
}

/**
 * Splits a STORED invoice into parts from what was stored, not from unit price x quantity: each line's
 * stored taxable value, tax, own discount and tax-exclusive gross are shared by quantity, so an
 * invoice-level discount share (already inside the stored line total) travels with the quantity. The
 * allocation that brings a line's cumulative quantity up to the original quantity takes the remainder,
 * so parts that cover every line sum to the original exactly.
 */
export function splitStoredLines(lines: SplitSourceLine[], parts: SplitAllocation[][], opts: { decimals?: number; pricesIncludeTax?: boolean } = {}): SplitPiece[] {
  const decimals = opts.decimals ?? 2
  const inclusive = opts.pricesIncludeTax === true
  const src = lines.map((l) => {
    const q = toDec(l.quantity)
    const u = toDec(l.unitPrice)
    const entered = fromMinor(toMinor({ n: q.n * u.n, s: q.s + u.s }, decimals), decimals)
    return {
      qty: l.quantity,
      taxable: roundMoney(l.lineTotal - l.taxAmount, decimals),
      tax: roundMoney(l.taxAmount, decimals),
      discount: roundMoney(l.discountAmount, decimals),
      gross: inclusive ? convertPriceMode(entered, l.taxRate, false, decimals) : entered,
      usedQty: 0, taxableLeft: 0, taxLeft: 0, discountLeft: 0, grossLeft: 0
    }
  })
  src.forEach((s) => { s.taxableLeft = s.taxable; s.taxLeft = s.tax; s.discountLeft = s.discount; s.grossLeft = s.gross })

  return parts.map((alloc) => {
    const pieceLines: SplitPieceLine[] = alloc.map((a) => {
      const s = src[a.lineIndex]
      s.usedQty = roundMoney(s.usedQty + a.quantity, 6)
      const last = s.usedQty >= s.qty - 0.0005
      const take = (total: number, left: number) => (last ? left : Math.min(prorateAmount(total, a.quantity, s.qty, decimals), left))
      const taxable = take(s.taxable, s.taxableLeft)
      const tax = take(s.tax, s.taxLeft)
      const discount = take(s.discount, s.discountLeft)
      const gross = take(s.gross, s.grossLeft)
      s.taxableLeft = roundMoney(s.taxableLeft - taxable, decimals)
      s.taxLeft = roundMoney(s.taxLeft - tax, decimals)
      s.discountLeft = roundMoney(s.discountLeft - discount, decimals)
      s.grossLeft = roundMoney(s.grossLeft - gross, decimals)
      return { lineIndex: a.lineIndex, quantity: a.quantity, discountAmount: discount, taxAmount: tax, lineTotal: sumMoney([taxable, tax], decimals), gross }
    })
    const subtotal = sumMoney(pieceLines.map((l) => l.gross), decimals)
    const taxAmount = sumMoney(pieceLines.map((l) => l.taxAmount), decimals)
    const lineTotals = sumMoney(pieceLines.map((l) => l.lineTotal), decimals)
    const taxable = sumMoney([lineTotals, -taxAmount], decimals)
    const discountAmount = sumMoney([subtotal, -taxable], decimals)
    return { lines: pieceLines, subtotal, discountAmount, taxAmount, rawTotal: lineTotals }
  })
}
