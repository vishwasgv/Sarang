import { roundMoney, sumMoney } from '../../shared/utils/money'

// Maps the totals of a period onto the boxes of a country's VAT / GST / sales-tax return. The figures come from
// the books; the box layouts are working papers for the owner's accountant, not the official forms.

export interface VatBase {
  decimals: number
  sales: { taxed: number; zero: number; exempt: number; outOfScope: number; tax: number }
  purchases: { taxed: number; zero: number; exempt: number; outOfScope: number; tax: number }
}

export interface ReturnBox {
  code: string
  label: string
  amount: number
  /** A total or a result the owner should read first. */
  key?: boolean
}

export interface ReturnLayout {
  country: string
  title: string
  /** Code of the box that holds the net tax to pay (negative is a refund). */
  netCode: string
  boxes: ReturnBox[]
}

const wholeUnits = (n: number) => Math.trunc(n)

export function buildReturn(countryCode: string | null, base: VatBase): ReturnLayout {
  const d = base.decimals
  const add = (...xs: number[]) => sumMoney(xs, d)
  const sub = (a: number, b: number) => roundMoney(a - b, d)
  const s = base.sales
  const p = base.purchases
  const salesAll = add(s.taxed, s.zero, s.exempt, s.outOfScope)
  const purchasesAll = add(p.taxed, p.zero, p.exempt, p.outOfScope)
  const box = (code: string, label: string, amount: number, key = false): ReturnBox => ({ code, label, amount, key })

  switch (countryCode) {
    case 'GB':
      return {
        country: 'GB', title: 'VAT Return (nine boxes)', netCode: '5', boxes: [
          box('1', 'VAT due on sales and other outputs', s.tax),
          box('2', 'VAT due on acquisitions from other EU member states', 0),
          box('3', 'Total VAT due', s.tax, true),
          box('4', 'VAT reclaimed on purchases and other inputs', p.tax),
          box('5', 'Net VAT to pay to HMRC or reclaim', sub(s.tax, p.tax), true),
          box('6', 'Total value of sales and all other outputs, excluding VAT (whole pounds)', wholeUnits(salesAll)),
          box('7', 'Total value of purchases and all other inputs, excluding VAT (whole pounds)', wholeUnits(purchasesAll)),
          box('8', 'Total value of supplies of goods to EU member states (whole pounds)', 0),
          box('9', 'Total value of acquisitions of goods from EU member states (whole pounds)', 0)
        ]
      }
    case 'AU':
      return {
        country: 'AU', title: 'Business Activity Statement (GST)', netCode: '9', boxes: [
          box('G1', 'Total sales, including GST', add(salesAll, s.tax)),
          box('G2', 'Export sales', s.zero),
          box('G3', 'Other GST-free sales', s.exempt),
          box('G10', 'Capital purchases, including GST', 0),
          box('G11', 'Non-capital purchases, including GST', add(purchasesAll, p.tax)),
          box('1A', 'GST on sales', s.tax, true),
          box('1B', 'GST on purchases', p.tax, true),
          box('9', 'Payable to the ATO (1A minus 1B; negative is a refund)', sub(s.tax, p.tax), true)
        ]
      }
    case 'NZ':
      return {
        country: 'NZ', title: 'GST return', netCode: '15', boxes: [
          box('5', 'Total sales and income for the period, including GST and zero-rated supplies', add(s.taxed, s.tax, s.zero)),
          box('6', 'Zero-rated supplies included in box 5', s.zero),
          box('7', 'Subtract box 6 from box 5', add(s.taxed, s.tax)),
          box('8', 'GST on box 7', s.tax),
          box('10', 'Total GST collected on sales and income', s.tax, true),
          box('11', 'Total purchases and expenses, including GST', add(p.taxed, p.tax)),
          box('12', 'GST on box 11', p.tax),
          box('14', 'Total GST credit for purchases and expenses', p.tax, true),
          box('15', 'GST to pay to Inland Revenue (negative is a refund)', sub(s.tax, p.tax), true)
        ]
      }
    case 'CA':
      return {
        country: 'CA', title: 'GST/HST return', netCode: '109', boxes: [
          box('101', 'Total sales and other revenue (excluding GST/HST)', salesAll),
          box('103', 'GST/HST collected or collectible', s.tax),
          box('105', 'Total GST/HST and adjustments for the period', s.tax, true),
          box('106', 'Input tax credits (ITCs)', p.tax),
          box('108', 'Total ITCs and adjustments', p.tax, true),
          box('109', 'Net tax (negative is a refund)', sub(s.tax, p.tax), true)
        ]
      }
    case 'SG':
      return {
        country: 'SG', title: 'GST F5 return', netCode: '8', boxes: [
          box('1', 'Total value of standard-rated supplies', s.taxed),
          box('2', 'Total value of zero-rated supplies', s.zero),
          box('3', 'Total value of exempt supplies', s.exempt),
          box('4', 'Total value of supplies (1 + 2 + 3)', add(s.taxed, s.zero, s.exempt), true),
          box('5', 'Total value of taxable purchases', add(p.taxed, p.zero)),
          box('6', 'Output tax due', s.tax, true),
          box('7', 'Input tax and refunds claimed', p.tax, true),
          box('8', 'Net GST to be paid to IRAS (negative is a claim)', sub(s.tax, p.tax), true)
        ]
      }
    case 'AE':
      return {
        country: 'AE', title: 'VAT 201 return', netCode: '14', boxes: [
          box('1', 'Standard-rated supplies (VAT amount in the next line)', s.taxed),
          box('1v', 'VAT on standard-rated supplies', s.tax),
          box('4', 'Zero-rated supplies', s.zero),
          box('5', 'Exempt supplies', s.exempt),
          box('8', 'Total value of sales and outputs', salesAll, true),
          box('9', 'Standard-rated expenses (VAT amount in the next line)', p.taxed),
          box('9v', 'Recoverable VAT on standard-rated expenses', p.tax),
          box('11', 'Total value of expenses', purchasesAll, true),
          box('12', 'Total VAT due', s.tax, true),
          box('13', 'Total recoverable VAT', p.tax, true),
          box('14', 'Payable tax (negative is a refund)', sub(s.tax, p.tax), true)
        ]
      }
    case 'SA':
      return {
        country: 'SA', title: 'VAT return', netCode: '17', boxes: [
          box('1', 'Standard-rated sales', s.taxed),
          box('1v', 'VAT on standard-rated sales', s.tax),
          box('3', 'Zero-rated domestic sales', s.zero),
          box('5', 'Exempt sales', s.exempt),
          box('7', 'Total sales', salesAll, true),
          box('9', 'Standard-rated domestic purchases', p.taxed),
          box('9v', 'VAT on standard-rated domestic purchases', p.tax),
          box('14', 'Total purchases', purchasesAll, true),
          box('15', 'Total VAT due', s.tax, true),
          box('16', 'Total VAT deductible', p.tax, true),
          box('17', 'Net VAT due (negative is a claim)', sub(s.tax, p.tax), true)
        ]
      }
    case 'ZA':
      return {
        country: 'ZA', title: 'VAT 201 return', netCode: '19', boxes: [
          box('1', 'Standard-rated supplies (value)', s.taxed),
          box('2', 'Zero-rated supplies (value)', s.zero),
          box('3', 'Exempt and other supplies (value)', add(s.exempt, s.outOfScope)),
          box('4', 'Output tax', s.tax, true),
          box('15', 'Standard-rated purchases (value)', p.taxed),
          box('16', 'Input tax', p.tax, true),
          box('19', 'VAT payable to SARS (negative is a refund)', sub(s.tax, p.tax), true)
        ]
      }
    default:
      return {
        country: countryCode ?? '', title: 'Tax summary for the period', netCode: 'N', boxes: [
          box('S1', 'Taxable sales, excluding tax', s.taxed),
          box('S2', 'Zero-rated sales', s.zero),
          box('S3', 'Exempt and nil-rated sales', s.exempt),
          box('S4', 'Sales outside the scope of the tax', s.outOfScope),
          box('S5', 'Tax charged on sales', s.tax, true),
          box('P1', 'Taxable purchases, excluding tax', p.taxed),
          box('P2', 'Zero-rated purchases', p.zero),
          box('P3', 'Exempt and nil-rated purchases', p.exempt),
          box('P4', 'Tax paid on purchases', p.tax, true),
          box('N', 'Net tax to pay (negative is a refund or credit)', sub(s.tax, p.tax), true)
        ]
      }
  }
}
