import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney } from '../../shared/utils/money'
import { reportService } from './report.service'
import { gstInputCreditService, type TaxHeads } from './gst-input-credit.service'
import { gstPurchaseReportsService, type PurchaseHsnRow } from './gst-purchase-reports.service'
import { gstPaymentService } from './gst-payment.service'

// Annual return (GSTR-9) working data: the figures of a financial year laid out under the annual return's
// tables, taken from the same reports used every month. A working paper for the accountant, not a filing.

export interface Gstr9Amounts { taxable: number; igst: number; cgst: number; sgst: number }

export interface Gstr9Report {
  dateFrom: string
  dateTo: string
  decimals: number
  /** Table 4: outward supplies on which tax is payable. */
  table4: { b2b: Gstr9Amounts; b2c: Gstr9Amounts; creditNotes: Gstr9Amounts; total: Gstr9Amounts }
  /** Table 5: outward supplies with no tax. */
  table5: { nilRated: number; exempt: number; nonGst: number }
  /** Table 6: input tax credit availed. */
  table6: { inputs: TaxHeads; reverseCharge: TaxHeads; total: TaxHeads }
  /** Table 9: tax payable (sales tax plus reverse-charge tax) and what was paid. */
  table9: { payable: TaxHeads; paidFromCredit: number; paidInCash: number }
  /** Table 17: outward supplies by HSN. */
  table17: { hsnCode: string; description: string; uqc: string; quantity: number; taxable: number; tax: number }[]
  /** Table 18: inward supplies by HSN. */
  table18: PurchaseHsnRow[]
  /** Fixed explanations the screen translates by code. */
  notes: Array<'financialYearDates' | 'accountantCheck'>
}

const amounts = (rows: Array<{ taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number }>, decimals: number): Gstr9Amounts => ({
  taxable: sumMoney(rows.map((r) => r.taxableValue), decimals),
  igst: sumMoney(rows.map((r) => r.igstAmount), decimals),
  cgst: sumMoney(rows.map((r) => r.cgstAmount), decimals),
  sgst: sumMoney(rows.map((r) => r.sgstAmount), decimals)
})

const plus = (a: Gstr9Amounts, b: Gstr9Amounts, decimals: number): Gstr9Amounts => ({
  taxable: sumMoney([a.taxable, b.taxable], decimals),
  igst: sumMoney([a.igst, b.igst], decimals),
  cgst: sumMoney([a.cgst, b.cgst], decimals),
  sgst: sumMoney([a.sgst, b.sgst], decimals)
})

async function generateGstr9(params: { dateFrom: string; dateTo: string }): Promise<Gstr9Report> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)

  const [gstr1, hsn, net, inwardHsn, payments] = await Promise.all([
    reportService.generateGSTR1(params),
    reportService.generateHSNSummaryReport(params),
    gstInputCreditService.generateGstNetPayable(params),
    gstPurchaseReportsService.generatePurchaseHsnSummary(params),
    gstPaymentService.list()
  ])

  const b2b = amounts(gstr1.b2b, decimals)
  const b2c = amounts(gstr1.b2cs, decimals)
  const creditNotes = amounts(gstr1.cdnr, decimals)
  const total = plus(plus(b2b, b2c, decimals), creditNotes, decimals)

  const sumNil = (category: string) => sumMoney(gstr1.nilExempt.filter((r) => r.category === category).map((r) => r.taxableValue), decimals)

  const paid = ((payments as { data?: Array<{ date: string; isReversed: boolean; creditUsed: number; cashPaid: number }> }).data ?? [])
    .filter((p) => !p.isReversed && p.date >= params.dateFrom && p.date <= params.dateTo)

  const payable: TaxHeads = {
    cgst: sumMoney([net.output.cgst, net.reverseCharge.cgst], decimals),
    sgst: sumMoney([net.output.sgst, net.reverseCharge.sgst], decimals),
    igst: sumMoney([net.output.igst, net.reverseCharge.igst], decimals),
    total: sumMoney([net.output.total, net.reverseCharge.total], decimals)
  }

  return {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    decimals,
    table4: { b2b, b2c, creditNotes, total },
    table5: { nilRated: sumNil('NIL_RATED'), exempt: sumNil('EXEMPT'), nonGst: sumNil('OUT_OF_SCOPE') },
    table6: {
      inputs: {
        cgst: sumMoney([net.inputCredit.cgst, -net.reverseCharge.cgst], decimals),
        sgst: sumMoney([net.inputCredit.sgst, -net.reverseCharge.sgst], decimals),
        igst: sumMoney([net.inputCredit.igst, -net.reverseCharge.igst], decimals),
        total: sumMoney([net.inputCredit.total, -net.reverseCharge.total], decimals)
      },
      reverseCharge: net.reverseCharge,
      total: net.inputCredit
    },
    table9: {
      payable,
      paidFromCredit: sumMoney(paid.map((p) => p.creditUsed), decimals),
      paidInCash: sumMoney(paid.map((p) => p.cashPaid), decimals)
    },
    table17: [...hsn.b2b, ...hsn.b2c].map((r) => ({
      hsnCode: r.hsnCode, description: r.description, uqc: r.uqc, quantity: r.totalQuantity,
      taxable: r.taxableValue, tax: sumMoney([r.igstAmount, r.cgstAmount, r.sgstAmount], decimals)
    })),
    table18: inwardHsn.rows,
    notes: ['financialYearDates', 'accountantCheck']
  }
}

export const gstr9Service = { generateGstr9 }
