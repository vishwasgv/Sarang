import { dialog } from 'electron'
import { readFile } from 'fs/promises'
import { createHash } from 'crypto'
import { z } from 'zod'
import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { getCurrencyDecimals, sumMoney, roundMoney, prorateAmount } from '../../shared/utils/money'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { getProductCostsBatch } from './valuation.service'
import { loadSalesLines } from './sales-lines.query'
import { saveJsonFile } from './gst-returns.service'
import { logAction } from './audit.service'

// A branch exports one small file of its key figures for a period; head office imports the files of all its
// branches and reads them side by side. No live link between the shops: the files are carried by hand. The
// checksum only catches accidental damage or editing, it is not a security seal.

export interface BranchFigures {
  sales: number
  salesTax: number
  invoices: number
  purchases: number
  expenses: number
  receivables: number
  payables: number
  stockValue: number
  cashAndBank: number
}

export interface BranchSummaryFile {
  format: 'sarang-branch-summary'
  version: 1
  branchName: string
  periodFrom: string
  periodTo: string
  currency: string
  generatedAt: string
  figures: BranchFigures
  checksum: string
}

const FiguresSchema = z.object({
  sales: z.number(), salesTax: z.number(), invoices: z.number(), purchases: z.number(), expenses: z.number(),
  receivables: z.number(), payables: z.number(), stockValue: z.number(), cashAndBank: z.number()
})
const FileSchema = z.object({
  format: z.literal('sarang-branch-summary'),
  version: z.literal(1),
  branchName: z.string().min(1).max(120),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().max(10),
  generatedAt: z.string(),
  figures: FiguresSchema,
  checksum: z.string().length(64)
})

export function checksumOf(f: Pick<BranchSummaryFile, 'branchName' | 'periodFrom' | 'periodTo' | 'currency' | 'figures'>): string {
  const canonical = JSON.stringify({ b: f.branchName, from: f.periodFrom, to: f.periodTo, c: f.currency, f: f.figures })
  return createHash('sha256').update(canonical).digest('hex')
}

export function parseSummaryFile(raw: unknown): BranchSummaryFile {
  const parsed = FileSchema.safeParse(raw)
  if (!parsed.success) throw new ServiceError('BRANCH-001', 'This is not a Sarang branch summary file.')
  if (parsed.data.periodFrom > parsed.data.periodTo) throw new ServiceError('BRANCH-002', 'The dates in this file are the wrong way round.')
  if (checksumOf(parsed.data) !== parsed.data.checksum) throw new ServiceError('BRANCH-003', 'This file was changed after it was made, so it was not imported.')
  return parsed.data
}

export async function buildOwnFigures(period: { dateFrom: string; dateTo: string }): Promise<{ figures: BranchFigures; currency: string; businessName: string }> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { businessName: true, currencyCode: true } })
  const decimals = getCurrencyDecimals(profile?.currencyCode)
  const range = { gte: parseLocalDateStart(period.dateFrom), lte: parseLocalDateEnd(period.dateTo) }
  const [{ lines }, bills, expenses, openInvoices, openBills, inventories, banks] = await Promise.all([
    loadSalesLines(period),
    db.bill.findMany({ where: { billDate: range, status: { not: 'VOID' } }, select: { subtotal: true, discountAmount: true } }),
    db.expense.findMany({ where: { expenseDate: range }, select: { amount: true } }),
    db.invoice.findMany({ where: { balanceAmount: { gt: 0 }, status: { notIn: ['CANCELLED', 'SPLIT'] }, invoiceDate: { lte: range.lte } }, select: { balanceAmount: true } }),
    db.bill.findMany({ where: { balanceAmount: { gt: 0 }, status: { not: 'VOID' }, billDate: { lte: range.lte } }, select: { balanceAmount: true } }),
    db.inventory.findMany({ select: { productId: true, quantity: true } }),
    db.bankAccount.findMany({ where: { isActive: true }, select: { currentBalance: true } })
  ])
  const costs = await getProductCostsBatch(inventories.map((i) => i.productId))
  return {
    businessName: profile?.businessName ?? '',
    currency: profile?.currencyCode ?? '',
    figures: {
      sales: sumMoney(lines.map((l) => l.taxable), decimals),
      salesTax: sumMoney(lines.map((l) => l.tax), decimals),
      invoices: new Set(lines.map((l) => l.invoiceId)).size,
      purchases: sumMoney(bills.map((b) => roundMoney(b.subtotal - b.discountAmount, decimals)), decimals),
      expenses: sumMoney(expenses.map((e) => e.amount), decimals),
      receivables: sumMoney(openInvoices.map((i) => i.balanceAmount), decimals),
      payables: sumMoney(openBills.map((b) => b.balanceAmount), decimals),
      stockValue: sumMoney(inventories.map((i) => prorateAmount(costs.get(i.productId) ?? 0, i.quantity, 1, decimals)), decimals),
      cashAndBank: sumMoney(banks.map((b) => b.currentBalance), decimals)
    }
  }
}

export const branchSummaryService = {
  async exportOwn(p: { branchName?: string; dateFrom: string; dateTo: string }) {
    try {
      if (p.dateFrom > p.dateTo) throw new ServiceError('BRANCH-002', 'The start date is after the end date.')
      const own = await buildOwnFigures({ dateFrom: p.dateFrom, dateTo: p.dateTo })
      const base = { branchName: (p.branchName?.trim() || own.businessName || 'Branch').slice(0, 120), periodFrom: p.dateFrom, periodTo: p.dateTo, currency: own.currency, figures: own.figures }
      const file: BranchSummaryFile = { format: 'sarang-branch-summary', version: 1, ...base, generatedAt: new Date().toISOString(), checksum: checksumOf(base) }
      const safe = base.branchName.replace(/[^A-Za-z0-9_-]+/g, '_')
      return { success: true, data: await saveJsonFile(`Branch_${safe}_${p.dateFrom}_${p.dateTo}.json`, file) }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not make the summary file.' } }
    }
  },

  async importFiles(userId?: string) {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: 'Choose branch summary files',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'JSON files', extensions: ['json'] }]
      })
      if (canceled || filePaths.length === 0) return { success: true, data: { imported: 0, problems: [] as Array<{ file: string; message: string }> } }
      const db = getPrisma()
      let imported = 0
      const problems: Array<{ file: string; message: string }> = []
      for (const path of filePaths) {
        const name = path.split(/[\\/]/).pop() ?? path
        try {
          let raw: unknown
          try { raw = JSON.parse(await readFile(path, 'utf8')) } catch { throw new ServiceError('BRANCH-001', 'This is not a Sarang branch summary file.') }
          const f = parseSummaryFile(raw)
          await db.branchSummary.upsert({
            where: { branchName_periodFrom_periodTo: { branchName: f.branchName, periodFrom: f.periodFrom, periodTo: f.periodTo } },
            create: { branchName: f.branchName, periodFrom: f.periodFrom, periodTo: f.periodTo, currency: f.currency, figures: JSON.stringify(f.figures), checksum: f.checksum, generatedAt: f.generatedAt },
            update: { currency: f.currency, figures: JSON.stringify(f.figures), checksum: f.checksum, generatedAt: f.generatedAt, importedAt: new Date() }
          })
          imported += 1
        } catch (err) {
          problems.push({ file: name, message: err instanceof ServiceError ? err.message : 'This file could not be imported.' })
        }
      }
      await logAction({ userId, action: 'BRANCH_SUMMARY_IMPORTED', entityType: 'BranchSummary', entityId: 'batch', newValue: { imported, problems: problems.length } })
      return { success: true, data: { imported, problems } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Could not import the files.' } }
    }
  },

  async list() {
    const rows = await getPrisma().branchSummary.findMany({ orderBy: [{ periodTo: 'desc' }, { branchName: 'asc' }] })
    return { success: true, data: rows.map((r) => ({ id: r.id, branchName: r.branchName, periodFrom: r.periodFrom, periodTo: r.periodTo, currency: r.currency, generatedAt: r.generatedAt, importedAt: r.importedAt.toISOString(), figures: JSON.parse(r.figures) as BranchFigures })) }
  },

  async remove(id: string, userId?: string) {
    try {
      await getPrisma().branchSummary.delete({ where: { id } })
      await logAction({ userId, action: 'BRANCH_SUMMARY_DELETED', entityType: 'BranchSummary', entityId: id })
      return { success: true }
    } catch {
      return { success: false, error: { code: 'BRANCH-004', message: 'That summary was not found.' } }
    }
  }
}
