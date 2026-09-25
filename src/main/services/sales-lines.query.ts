import { getPrisma } from '../database/db'
import { getCurrencyDecimals, storedLineTaxable, roundMoney } from '../../shared/utils/money'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate } from '../utils/date.util'

// Every sale line of a period in one flat shape for the "sales by ..." reports. Returns are negative. An invoice
// that was cancelled or split is left out; credit notes that are plain amounts (no product) are not included.

export interface SalesLine {
  invoiceId: string
  invoiceNumber: string
  date: string
  customerId: string | null
  customerName: string
  salespersonId: string | null
  salespersonName: string
  productId: string
  productName: string
  categoryId: string | null
  categoryName: string
  quantity: number
  taxable: number
  tax: number
  total: number
  isReturn: boolean
}

export async function loadSalesLines(params: { dateFrom: string; dateTo: string }): Promise<{ lines: SalesLine[]; decimals: number }> {
  const db = getPrisma()
  const from = parseLocalDateStart(params.dateFrom)
  const to = parseLocalDateEnd(params.dateTo)
  const profile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'SPLIT'] } },
    select: {
      id: true, invoiceNumber: true, invoiceDate: true, invoiceType: true, pricesIncludeTax: true,
      customerId: true, customer: { select: { customerName: true } },
      salespersonId: true, salesperson: { select: { fullName: true } },
      items: {
        select: {
          productId: true, productName: true, quantity: true, unitPrice: true, discountAmount: true, taxAmount: true, lineTotal: true,
          product: { select: { categoryId: true, category: { select: { name: true } } } }
        }
      }
    },
    orderBy: { invoiceDate: 'asc' }
  })

  const lines: SalesLine[] = []
  for (const inv of invoices) {
    const isReturn = inv.invoiceType === 'RETURN'
    const sign = isReturn ? -1 : 1
    for (const it of inv.items) {
      const taxable = sign * storedLineTaxable(it, { pricesIncludeTax: inv.pricesIncludeTax, isReturn })
      const tax = sign * Math.abs(it.taxAmount)
      lines.push({
        invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, date: toLocalISODate(inv.invoiceDate),
        customerId: inv.customerId, customerName: inv.customer?.customerName ?? '',
        salespersonId: inv.salespersonId, salespersonName: inv.salesperson?.fullName ?? '',
        productId: it.productId, productName: it.productName,
        categoryId: it.product?.categoryId ?? null, categoryName: it.product?.category?.name ?? '',
        quantity: sign * Math.abs(it.quantity), taxable: roundMoney(taxable, decimals), tax: roundMoney(tax, decimals),
        total: roundMoney(taxable + tax, decimals), isReturn
      })
    }
  }
  return { lines, decimals }
}
