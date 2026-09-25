import { getPrisma } from '../database/db'
import { getCurrencyDecimals, roundMoney, sumMoney, storedLineTaxable } from '../../shared/utils/money'
import { resolveLineTaxCategory, isNonTaxableCategory } from '../../shared/utils/gst-presentation'
import { resolveCountryCode, getTaxPreset } from '../../shared/data/tax-presets'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { buildReturn, type ReturnLayout, type VatBase } from './vat-return-layouts'

// VAT / GST / sales-tax return working paper for businesses outside India: the period's sales and purchases by
// tax treatment, laid out under the boxes of the business country's return.

export interface VatReturnReport {
  dateFrom: string
  dateTo: string
  decimals: number
  countryCode: string | null
  countryName: string
  taxLabel: string
  base: VatBase
  layout: ReturnLayout
  /** The country has its own box layout here; false means the generic summary is shown. */
  hasCountryLayout: boolean
  notes: Array<'workingPaper' | 'genericLayout'>
}

const LAYOUT_COUNTRIES = new Set(['GB', 'AU', 'NZ', 'CA', 'SG', 'AE', 'SA', 'ZA'])

interface Bucket { taxed: number[]; zero: number[]; exempt: number[]; outOfScope: number[]; tax: number[] }
const emptyBucket = (): Bucket => ({ taxed: [], zero: [], exempt: [], outOfScope: [], tax: [] })

function place(b: Bucket, taxable: number, tax: number, taxRate: number, taxCategory: string | null | undefined) {
  const category = resolveLineTaxCategory(taxCategory, taxRate)
  if (category === 'ZERO_RATED') b.zero.push(taxable)
  else if (category === 'OUT_OF_SCOPE') b.outOfScope.push(taxable)
  else if (isNonTaxableCategory(category)) b.exempt.push(taxable)
  else b.taxed.push(taxable)
  b.tax.push(tax)
}

function close(b: Bucket, decimals: number): VatBase['sales'] {
  return {
    taxed: sumMoney(b.taxed, decimals), zero: sumMoney(b.zero, decimals), exempt: sumMoney(b.exempt, decimals),
    outOfScope: sumMoney(b.outOfScope, decimals), tax: sumMoney(b.tax, decimals)
  }
}

async function generateVatReturn(params: { dateFrom: string; dateTo: string }): Promise<VatReturnReport> {
  const db = getPrisma()
  const from = parseLocalDateStart(params.dateFrom)
  const to = parseLocalDateEnd(params.dateTo)
  const profile = await db.businessProfile.findFirst({ select: { country: true, currencyCode: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)
  const code = resolveCountryCode(profile?.country)
  const preset = getTaxPreset(profile?.country)

  const [invoices, creditNotes, bills, debitNotes] = await Promise.all([
    db.invoice.findMany({
      where: { invoiceDate: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'SPLIT'] } },
      select: { invoiceType: true, pricesIncludeTax: true, items: { select: { quantity: true, unitPrice: true, discountAmount: true, taxAmount: true, lineTotal: true, taxRate: true, taxCategory: true } } }
    }),
    db.creditNote.findMany({
      where: { createdAt: { gte: from, lte: to }, taxApplied: true },
      select: { amount: true, taxAmount: true, taxRate: true, items: { select: { taxRate: true, taxAmount: true, lineTotal: true } } }
    }),
    db.bill.findMany({
      where: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } },
      select: { isReverseCharge: true, items: { select: { taxRate: true, taxAmount: true, total: true, taxCategory: true } } }
    }),
    db.debitNote.findMany({
      where: { createdAt: { gte: from, lte: to }, taxApplied: true },
      select: { amount: true, taxAmount: true, taxRate: true, items: { select: { taxRate: true, taxAmount: true, lineTotal: true } } }
    })
  ])

  const sales = emptyBucket()
  for (const inv of invoices) {
    const isReturn = inv.invoiceType === 'RETURN'
    const sign = isReturn ? -1 : 1
    for (const it of inv.items) {
      const taxable = storedLineTaxable(it, { pricesIncludeTax: inv.pricesIncludeTax, isReturn })
      place(sales, sign * taxable, sign * Math.abs(it.taxAmount), it.taxRate, it.taxCategory)
    }
  }
  for (const n of creditNotes) {
    const lines = n.items.length > 0 ? n.items.map((i) => ({ rate: i.taxRate, tax: i.taxAmount, taxable: roundMoney(i.lineTotal - i.taxAmount, decimals) })) : [{ rate: n.taxRate ?? 0, tax: n.taxAmount, taxable: roundMoney(n.amount - n.taxAmount, decimals) }]
    for (const l of lines) place(sales, -Math.abs(l.taxable), -Math.abs(l.tax), l.rate, null)
  }

  const purchases = emptyBucket()
  for (const b of bills) {
    for (const it of b.items) place(purchases, b.isReverseCharge ? it.total : roundMoney(it.total - it.taxAmount, decimals), it.taxAmount, it.taxRate, it.taxCategory)
  }
  for (const n of debitNotes) {
    const lines = n.items.length > 0 ? n.items.map((i) => ({ rate: i.taxRate, tax: i.taxAmount, taxable: roundMoney(i.lineTotal - i.taxAmount, decimals) })) : [{ rate: n.taxRate ?? 0, tax: n.taxAmount, taxable: roundMoney(n.amount - n.taxAmount, decimals) }]
    for (const l of lines) place(purchases, -Math.abs(l.taxable), -Math.abs(l.tax), l.rate, null)
  }

  const base: VatBase = { decimals, sales: close(sales, decimals), purchases: close(purchases, decimals) }
  const hasCountryLayout = code !== null && LAYOUT_COUNTRIES.has(code)
  return {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    decimals,
    countryCode: code,
    countryName: preset?.name ?? (profile?.country ?? ''),
    taxLabel: preset?.taxLabel ?? 'Tax',
    base,
    layout: buildReturn(hasCountryLayout ? code : null, base),
    hasCountryLayout,
    notes: hasCountryLayout ? ['workingPaper'] : ['workingPaper', 'genericLayout']
  }
}

export const vatReturnService = { generateVatReturn }
