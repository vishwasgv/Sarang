// How Indian GST is PRESENTED on a document. Presentation never changes an amount: the tax and the
// payable total come from money.ts; this module only decides how the same tax amount is shown and
// which tax head a report files it under. `splitTaxHalves` is the only splitter.

import { splitTaxHalves, sumMoney } from './money'

export type GstType = 'CGST_SGST' | 'IGST' | 'GST'
export const GST_TYPES: readonly GstType[] = ['CGST_SGST', 'IGST', 'GST']

export function isGstType(v: unknown): v is GstType {
  return v === 'CGST_SGST' || v === 'IGST' || v === 'GST'
}

/** Unknown, missing or legacy values behave as CGST_SGST. */
export function normalizeGstType(v: unknown): GstType {
  return isGstType(v) ? v : 'CGST_SGST'
}

// GST state codes, common abbreviations and names, so "27", "MH", "27-Maharashtra" and "maharashtra" all match.
const STATES: Array<[string, string, string[]]> = [
  ['01', 'jammu and kashmir', ['jk', 'j&k']], ['02', 'himachal pradesh', ['hp']], ['03', 'punjab', ['pb']],
  ['04', 'chandigarh', ['ch']], ['05', 'uttarakhand', ['uk', 'ut', 'uttaranchal']], ['06', 'haryana', ['hr']],
  ['07', 'delhi', ['dl', 'new delhi', 'nct of delhi']], ['08', 'rajasthan', ['rj']], ['09', 'uttar pradesh', ['up']],
  ['10', 'bihar', ['br']], ['11', 'sikkim', ['sk']], ['12', 'arunachal pradesh', ['ar']], ['13', 'nagaland', ['nl']],
  ['14', 'manipur', ['mn']], ['15', 'mizoram', ['mz']], ['16', 'tripura', ['tr']], ['17', 'meghalaya', ['ml']],
  ['18', 'assam', ['as']], ['19', 'west bengal', ['wb']], ['20', 'jharkhand', ['jh']], ['21', 'odisha', ['od', 'or', 'orissa']],
  ['22', 'chhattisgarh', ['cg', 'ct', 'chattisgarh']], ['23', 'madhya pradesh', ['mp']], ['24', 'gujarat', ['gj']],
  ['26', 'dadra and nagar haveli and daman and diu', ['dn', 'dd', 'dadra and nagar haveli', 'daman and diu', 'daman', 'diu']],
  ['27', 'maharashtra', ['mh']], ['29', 'karnataka', ['ka']], ['30', 'goa', ['ga']], ['31', 'lakshadweep', ['ld']],
  ['32', 'kerala', ['kl']], ['33', 'tamil nadu', ['tn', 'tamilnadu']], ['34', 'puducherry', ['py', 'pondicherry']],
  ['35', 'andaman and nicobar islands', ['an', 'andaman and nicobar']], ['36', 'telangana', ['ts', 'tg']],
  ['37', 'andhra pradesh', ['ap']], ['38', 'ladakh', ['la']]
]

function stateKey(raw: string): string {
  return raw.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

const STATE_LOOKUP = new Map<string, string>()
for (const [code, name, aliases] of STATES) {
  STATE_LOOKUP.set(code, code)
  STATE_LOOKUP.set(String(Number(code)), code)
  STATE_LOOKUP.set(stateKey(name), code)
  for (const a of aliases) STATE_LOOKUP.set(stateKey(a), code)
}
// The old separate Daman and Diu code (25) is the same territory as 26 today.
STATE_LOOKUP.set('25', '26')

/** Canonical key for an Indian state written as a name, abbreviation or GST code; '' when blank. */
export function normalizeState(raw: string | null | undefined): string {
  if (!raw) return ''
  let s = stateKey(raw)
  if (!s) return ''
  if (STATE_LOOKUP.has(s)) return STATE_LOOKUP.get(s)!
  // "27 maharashtra" or "maharashtra 27"
  const stripped = s.replace(/^\d{1,2}\s+/, '').replace(/\s+\d{1,2}$/, '')
  if (stripped && STATE_LOOKUP.has(stripped)) return STATE_LOOKUP.get(stripped)!
  s = stripped || s
  return s
}

const GSTIN_PATTERN = /^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/** State code (first two digits) of a structurally valid GSTIN with a known state; '' otherwise. */
export function stateCodeFromGstin(gstin: string | null | undefined): string {
  if (!gstin) return ''
  const m = GSTIN_PATTERN.exec(gstin.trim().toUpperCase())
  return m ? (STATE_LOOKUP.get(m[1]) ?? '') : ''
}

/** The party's state as typed or saved, else the state code of its GSTIN. */
export function resolvePartyState(state: string | null | undefined, gstin: string | null | undefined): string {
  return state && normalizeState(state) ? state : stateCodeFromGstin(gstin)
}

/** Place of supply text: the typed state, else "27-Maharashtra" from the GSTIN; '' when neither is known. */
export function placeOfSupplyLabel(state: string | null | undefined, gstin: string | null | undefined): string {
  if (state && normalizeState(state)) return state
  const code = stateCodeFromGstin(gstin)
  if (!code) return ''
  const name = STATES.find(([c]) => c === code)?.[1] ?? ''
  return `${code}-${name.replace(/\b\w/g, (ch) => ch.toUpperCase()).replace(/ And /g, ' and ')}`
}

/** True when both states are known. `same` is meaningful only when `known` is true. */
export function comparePlaceOfSupply(businessState: string | null | undefined, partyState: string | null | undefined): { known: boolean; same: boolean } {
  const a = normalizeState(businessState)
  const b = normalizeState(partyState)
  if (!a || !b) return { known: false, same: true }
  return { known: true, same: a === b }
}

/** Automatic default for a new document: same state CGST_SGST, other state IGST, unknown CGST_SGST. */
export function defaultGstTypeForPlaceOfSupply(businessState: string | null | undefined, partyState: string | null | undefined): GstType {
  const c = comparePlaceOfSupply(businessState, partyState)
  return c.known && !c.same ? 'IGST' : 'CGST_SGST'
}

export interface TaxHeadClass {
  head: 'CGST_SGST' | 'IGST'
  /** True when the head had to be assumed because a combined GST document has no known place of supply. */
  stateUnknown: boolean
}

/**
 * The tax head a return files a document under. CGST_SGST and IGST are taken as stored; the
 * combined GST presentation is decided from the place of supply (unknown counts as CGST_SGST).
 */
export function classifyTaxHead(gstType: unknown, businessState: string | null | undefined, partyState: string | null | undefined): TaxHeadClass {
  const t = normalizeGstType(gstType)
  if (t === 'IGST') return { head: 'IGST', stateUnknown: false }
  if (t === 'CGST_SGST') return { head: 'CGST_SGST', stateUnknown: false }
  const c = comparePlaceOfSupply(businessState, partyState)
  if (!c.known) return { head: 'CGST_SGST', stateUnknown: true }
  return { head: c.same ? 'CGST_SGST' : 'IGST', stateUnknown: false }
}

export interface GstRateTax { taxRate: number; taxAmount: number }

export interface GstTaxSplit { cgst: number; sgst: number }

/**
 * CGST and SGST for a document: the tax is split per rate (the way GST is charged and filed), each
 * rate exactly by splitTaxHalves, and the halves are added. CGST + SGST always equals the total tax.
 * With no per-rate detail (or detail that does not add up to the total) the total is split once.
 */
export function splitGstHalves(taxAmount: number, decimals = 2, rateTaxes?: GstRateTax[]): GstTaxSplit {
  if (rateTaxes && rateTaxes.length > 0) {
    const byRate = new Map<number, number[]>()
    for (const r of rateTaxes) {
      const key = Number(r.taxRate) || 0
      const list = byRate.get(key) ?? []
      list.push(Number(r.taxAmount) || 0)
      byRate.set(key, list)
    }
    const perRate = Array.from(byRate.values()).map((amts) => sumMoney(amts, decimals))
    const sumAll = sumMoney(perRate, decimals)
    if (sumAll === sumMoney([taxAmount], decimals)) {
      const firsts: number[] = []
      const seconds: number[] = []
      for (const t of perRate) {
        const h = splitTaxHalves(t, decimals)
        firsts.push(h.first)
        seconds.push(h.second)
      }
      return { cgst: sumMoney(firsts, decimals), sgst: sumMoney(seconds, decimals) }
    }
  }
  const h = splitTaxHalves(taxAmount, decimals)
  return { cgst: h.first, sgst: h.second }
}

/**
 * CGST and SGST for every line of a document, allocated so that the lines of one rate add up exactly
 * to the halves of that rate's total tax (the same halves splitGstHalves prints on the document).
 * Reports add these line figures, so they agree with the printed document to the last minor unit.
 * Tax amounts are non-negative magnitudes; the caller applies any sign.
 */
export function allocateGstHalves(lines: GstRateTax[], decimals = 2): GstTaxSplit[] {
  const f = 10 ** decimals
  const minor = lines.map((l) => Math.round((Number(l.taxAmount) || 0) * f))
  const groups = new Map<number, number[]>()
  lines.forEach((l, idx) => {
    const key = Number(l.taxRate) || 0
    const g = groups.get(key) ?? []
    g.push(idx)
    groups.set(key, g)
  })
  const cgst = new Array<number>(lines.length).fill(0)
  for (const idxs of groups.values()) {
    const total = idxs.reduce((a, i) => a + minor[i], 0)
    let leftover = Math.floor(total / 2) - idxs.reduce((a, i) => a + Math.floor(minor[i] / 2), 0)
    for (const i of idxs) {
      cgst[i] = Math.floor(minor[i] / 2)
      if (leftover > 0 && minor[i] % 2 === 1) { cgst[i] += 1; leftover -= 1 }
    }
  }
  return minor.map((m, i) => ({ cgst: cgst[i] / f, sgst: (m - cgst[i]) / f }))
}

export interface TaxDisplayLine { label: string; amount: number }

/**
 * Lines shown for the GST tax of a document in the chosen presentation:
 * CGST_SGST two lines, IGST one line, GST one line named "GST". Amounts always add to taxAmount.
 */
export function gstPresentationLines(gstType: unknown, taxAmount: number, decimals = 2, rateTaxes?: GstRateTax[]): TaxDisplayLine[] {
  if (!(taxAmount > 0)) return []
  const t = normalizeGstType(gstType)
  if (t === 'IGST') return [{ label: 'IGST', amount: taxAmount }]
  if (t === 'GST') return [{ label: 'GST', amount: taxAmount }]
  const { cgst, sgst } = splitGstHalves(taxAmount, decimals, rateTaxes)
  return [{ label: 'CGST', amount: cgst }, { label: 'SGST', amount: sgst }]
}

/** Tax categories a product or document line can carry. */
export const TAX_CATEGORIES = ['STANDARD', 'REDUCED', 'ZERO_RATED', 'EXEMPT', 'NIL_RATED', 'OUT_OF_SCOPE'] as const
export type TaxCategory = typeof TAX_CATEGORIES[number]

export function normalizeTaxCategory(v: unknown): TaxCategory {
  return (TAX_CATEGORIES as readonly string[]).includes(v as string) ? (v as TaxCategory) : 'STANDARD'
}

/**
 * Category snapshotted on a document line. It has to agree with the tax actually charged: a taxed
 * line is never filed as exempt or nil-rated, and an untaxed line is never filed as standard.
 */
export function resolveLineTaxCategory(category: unknown, taxRate: number): TaxCategory {
  const c = normalizeTaxCategory(category)
  if (taxRate > 0) return c === 'STANDARD' || c === 'REDUCED' ? c : 'STANDARD'
  return c === 'STANDARD' || c === 'REDUCED' ? 'NIL_RATED' : c
}

/** Suggested category for a saved rate; the owner can always change it. */
export function suggestTaxCategory(rate: number): TaxCategory {
  if (!(rate > 0)) return 'NIL_RATED'
  if (rate < 18) return 'REDUCED'
  return 'STANDARD'
}

/** Category groups a GSTR-1 style return files separately from taxable supplies. */
export function isNonTaxableCategory(c: unknown): boolean {
  const n = normalizeTaxCategory(c)
  return n === 'EXEMPT' || n === 'NIL_RATED' || n === 'OUT_OF_SCOPE'
}

/** The rates the current India schedule configures (percent). */
export const INDIA_CURRENT_SLABS: readonly number[] = [0, 0.25, 3, 5, 18, 40]
