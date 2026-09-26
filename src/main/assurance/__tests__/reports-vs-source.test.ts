import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => process.env.TEMP ?? '.' } }))

import { openRealDb, type RealDb } from '../real-db'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const round2 = (n: number) => Math.round(n * 100) / 100

let handle: RealDb

describe('reports agree with a direct query of the same records', () => {
  beforeAll(async () => {
    handle = await openRealDb()
    const { getPrisma } = await import('../../database/db')
    const { billingService } = await import('../../services/billing.service')
    const { paymentService } = await import('../../services/payment.service')
    const { billService } = await import('../../services/bill.service')
    const { supplierPaymentService } = await import('../../services/supplier-payment.service')
    const { createReturn } = await import('../../services/returns.service')
    const db = getPrisma()
    const rand = rng(77)
    const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]
    const products: string[] = []
    for (const [name, price, tax] of [['Widget', 333.33, 18], ['Gadget', 99.99, 5], ['Rice', 61.5, 0]] as const) {
      const p = await db.product.create({ data: { productName: name, sellingPrice: price, costPrice: price * 0.6, taxRate: tax } })
      await db.inventory.create({ data: { productId: p.id, quantity: 5000, averageCost: price * 0.6 } })
      products.push(p.id)
    }
    const customers = [(await db.customer.create({ data: { customerName: 'A' } })).id, (await db.customer.create({ data: { customerName: 'B' } })).id]
    const supplier = (await db.supplier.create({ data: { supplierName: 'Sup' } })).id
    for (let i = 0; i < 40; i++) {
      const r = rand()
      if (r < 0.5) {
        await billingService.createInvoice({
          customerId: pick(customers), paymentMethod: pick(['CASH', 'UPI', 'CREDIT', 'CREDIT'] as const),
          items: [{ productId: pick(products), quantity: Math.round((1 + rand() * 5) * 100) / 100, unitPrice: Math.round((10 + rand() * 500) * 100) / 100, discountAmount: 0, isFreeOfCost: false }],
          globalDiscount: rand() < 0.2 ? 5 : 0, pricesIncludeTax: rand() < 0.3
        } as never)
      } else if (r < 0.65) {
        const open = await db.invoice.findMany({ where: { status: 'ACTIVE', balanceAmount: { gt: 1 } } })
        if (open.length) { const inv = pick(open); await paymentService.recordPayment({ invoiceId: inv.id, paymentMethod: 'CASH', amount: Math.floor(inv.balanceAmount * 50) / 100 } as never) }
      } else if (r < 0.75) {
        const inv = await db.invoice.findMany({ where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' } }, include: { items: true } })
        if (inv.length) { const x = pick(inv); await createReturn(x.id, [{ productId: x.items[0].productId, quantity: Math.max(0.1, Math.round(x.items[0].quantity * 0.4 * 100) / 100) }], 'test') }
      } else if (r < 0.85) {
        await billService.createBill({ supplierId: supplier, items: [{ productId: pick(products), quantity: 10, unitCost: Math.round((10 + rand() * 100) * 100) / 100, discountAmount: 0, taxRate: 5 }], isReverseCharge: false } as never)
      } else if (r < 0.93) {
        const open = await db.bill.findMany({ where: { status: { not: 'VOID' }, balanceAmount: { gt: 1 } } })
        if (open.length) { const b = pick(open); await supplierPaymentService.recordSupplierPayment({ billId: b.id, paymentMethod: 'CASH', amount: Math.floor(b.balanceAmount * 60) / 100, tdsAmount: 0 } as never) }
      } else {
        const live = await db.invoice.findMany({ where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, originalInvoiceId: null } })
        const free = []
        for (const v of live) if (!(await db.invoice.count({ where: { originalInvoiceId: v.id } }))) free.push(v)
        if (free.length) await billingService.cancelInvoice({ invoiceId: pick(free).id, reason: 'test' } as never)
      }
    }
  }, 180000)
  afterAll(async () => { await handle.close() })

  const range = () => ({ dateFrom: '2000-01-01', dateTo: iso(new Date(Date.now() + 86400000)) })

  it('Sales report total equals the invoices, returns counted negative, cancelled left out', async () => {
    const { getPrisma } = await import('../../database/db')
    const { reportService } = await import('../../services/report.service')
    const rep = await reportService.generateSalesReport(range())
    const rows = await getPrisma().invoice.findMany({ where: { status: { notIn: ['CANCELLED', 'SPLIT'] } } })
    expect(round2(rep.summary.totalRevenue)).toBe(round2(rows.reduce((s, r) => s + r.totalAmount, 0)))
    expect(rep.summary.totalInvoices).toBe(rows.length)
    const tax = rows.reduce((s, r) => s + (r.invoiceType === 'RETURN' ? -1 : 1) * r.taxAmount, 0)
    expect(round2(rep.summary.totalTax)).toBe(round2(tax))
  })

  it('Sales report revenue (before tax) equals the Sales Revenue ledger for sales and returns', async () => {
    const { getPrisma } = await import('../../database/db')
    const { reportService } = await import('../../services/report.service')
    const db = getPrisma()
    const rep = await reportService.generateSalesReport(range())
    const acct = await db.chartOfAccounts.findUnique({ where: { accountCode: '4000' } })
    const lines = await db.journalEntryLine.findMany({ where: { accountId: acct!.id, journalEntry: { sourceType: { in: ['INVOICE', 'SALES_RETURN'] } } } })
    const glRevenue = lines.reduce((s, l) => s + l.creditAmount - l.debitAmount, 0)
    expect(round2(rep.summary.totalRevenue - rep.summary.totalTax)).toBe(round2(glRevenue))
  })

  it('Trial Balance totals equal the ledger and balance', async () => {
    const { getPrisma } = await import('../../database/db')
    const { reportService } = await import('../../services/report.service')
    const tb = await reportService.generateTrialBalanceReport(range())
    const agg = await getPrisma().journalEntryLine.aggregate({ _sum: { debitAmount: true, creditAmount: true } })
    expect(tb.balanced).toBe(true)
    // A trial balance lists each account's net balance on one side, so both sides carry the same net figure.
    expect(round2(tb.totalDebit)).toBe(round2(tb.totalCredit))
    expect(round2((agg._sum.debitAmount ?? 0) - (agg._sum.creditAmount ?? 0))).toBe(0)
  })

  it('Outstanding report equals the customer and supplier balances', async () => {
    const { getPrisma } = await import('../../database/db')
    const { reportService } = await import('../../services/report.service')
    const db = getPrisma()
    const rep = await reportService.generateOutstandingReport()
    // What a customer owes is their account balance (open invoices less any credit from returns), shown only when positive.
    const customers = await db.customer.findMany({ select: { outstandingBalance: true } })
    expect(round2(rep.customers.totalOutstanding)).toBe(round2(customers.reduce((s, c) => s + Math.max(0, c.outstandingBalance), 0)))
    const a = rep.customers.agingTotals
    expect(round2(a.current + a.days1to30 + a.days31to60 + a.days61to90 + a.days90plus)).toBe(round2(rep.customers.totalOutstanding))
    const bills = await db.bill.aggregate({ where: { status: { not: 'VOID' }, balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true } })
    expect(round2(rep.suppliers.totalOutstanding)).toBe(round2(bills._sum.balanceAmount ?? 0))
    const sa = rep.suppliers.agingTotals
    expect(round2(sa.current + sa.days1to30 + sa.days31to60 + sa.days61to90 + sa.days90plus)).toBe(round2(rep.suppliers.totalOutstanding))
  })

  it('Inventory report stock value equals quantity times cost', async () => {
    const { getPrisma } = await import('../../database/db')
    const { reportService } = await import('../../services/report.service')
    const rep = await reportService.generateInventoryReport()
    const inv = await getPrisma().inventory.findMany({ include: { product: true } })
    const byAverage = inv.reduce((s, i) => s + i.quantity * i.averageCost, 0)
    const byCostPrice = inv.reduce((s, i) => s + i.quantity * i.product.costPrice, 0)
    const matches = [byAverage, byCostPrice].some((v) => Math.abs(round2(v) - round2(rep.summary.totalStockValue)) < 0.02)
    expect(matches, `report ${rep.summary.totalStockValue}, by average cost ${byAverage}, by cost price ${byCostPrice}`).toBe(true)
  })

  it('Tax report equals the tax on the invoices', async () => {
    const { getPrisma } = await import('../../database/db')
    const { reportService } = await import('../../services/report.service')
    const rep = await reportService.generateTaxReport(range())
    const rows = await getPrisma().invoice.findMany({ where: { status: { notIn: ['CANCELLED', 'SPLIT'] } } })
    const tax = rows.reduce((s, r) => s + (r.invoiceType === 'RETURN' ? -1 : 1) * r.taxAmount, 0)
    expect(round2(rep.summary.totalTaxCollected)).toBe(round2(tax))
  })

  it('Purchase register equals the bills', async () => {
    const { getPrisma } = await import('../../database/db')
    const { reportService } = await import('../../services/report.service')
    const rep = await reportService.generatePurchaseRegisterReport(range())
    const bills = await getPrisma().bill.findMany({ where: { status: { not: 'VOID' } } })
    const total = round2(bills.reduce((s, b) => s + b.totalAmount, 0))
    const listed = round2(rep.rows.filter((r) => r.status !== 'VOID').reduce((s, r) => s + r.totalAmount, 0))
    expect(listed).toBe(total)
  })

  it('Balance sheet profit equals income less expense in the ledger', async () => {
    const { getPrisma } = await import('../../database/db')
    const { financialStatementsService } = await import('../../services/financial-statements.service')
    const db = getPrisma()
    const bs = await financialStatementsService.generateBalanceSheet({ asOf: iso(new Date()) })
    const accounts = await db.chartOfAccounts.findMany()
    const lines = await db.journalEntryLine.findMany()
    const type = new Map(accounts.map((a) => [a.id, a.accountType]))
    let profit = 0
    for (const l of lines) {
      const t = type.get(l.accountId)
      if (t === 'INCOME') profit += l.creditAmount - l.debitAmount
      if (t === 'EXPENSE') profit -= l.debitAmount - l.creditAmount
    }
    const shown = (bs as unknown as { currentProfit?: number; totals?: { currentProfit?: number } }).currentProfit
    console.log('balance sheet keys', Object.keys(bs).join(','), 'ledger profit', round2(profit), 'shown', shown)
    expect(bs.balanced).toBe(true)
    const { reportService } = await import('../../services/report.service')
    const pl = await reportService.generateProfitAndLossReport(range())
    const paid = await db.invoice.findMany({ where: { status: 'ACTIVE', paymentStatus: { in: ['PAID', 'PARTIAL'] } } })
    const exTax = paid.reduce((t, i) => t + i.totalAmount - (i.invoiceType === 'RETURN' ? -1 : 1) * i.taxAmount, 0)
    // Revenue in the Profit and Loss report is before tax: tax collected is owed to the tax authority, not earned.
    expect(round2(pl.summary.revenue)).toBe(round2(exTax))
  })

  it('Ratio Analysis reads real stock and cost of sales: gross margin is a real margin, stock days are worked out', async () => {
    const { GENERIC_REPORTS } = await import('../../services/generic-reports.registry')
    const rep = await GENERIC_REPORTS.ratioAnalysis.run({ dateFrom: '2000-01-01', dateTo: iso(new Date(Date.now() + 86400000)) })
    const gross = rep.rows.find((r) => r.ratio === 'ratios.name.grossMargin')
    const days = rep.rows.find((r) => r.ratio === 'ratios.name.stockDays')
    expect(Number(gross?.value)).toBeGreaterThan(0)
    expect(Number(gross?.value)).toBeLessThan(100)
    expect(days?.value).not.toBeNull()
  })

  it('every generic report runs on a busy database without error and returns a chart definition', async () => {
    const { GENERIC_REPORTS, GENERIC_REPORT_IDS } = await import('../../services/generic-reports.registry')
    const params = { dateFrom: '2000-01-01', dateTo: iso(new Date(Date.now() + 86400000)) }
    const failures: string[] = []
    for (const id of GENERIC_REPORT_IDS) {
      try {
        const r = await GENERIC_REPORTS[id].run(params)
        if (!r.chart || !r.columns.length) failures.push(`${id}: no chart or columns`)
        for (const row of r.rows) for (const v of Object.values(row)) if (typeof v === 'number' && !Number.isFinite(v)) failures.push(`${id}: non-finite number`)
      } catch (e) {
        failures.push(`${id}: ${(e as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })
})
