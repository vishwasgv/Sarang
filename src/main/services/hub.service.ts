import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney } from '../../shared/utils/money'
import { addLocalDays, startOfLocalDay, toLocalISODate } from '../utils/date.util'

// The few numbers shown at the top of each overview page (Sales, Purchases, Accounting, Inventory).

export type HubGroup = 'sales' | 'purchases' | 'accounting' | 'inventory'

export interface HubStat { key: string; type: 'money' | 'number'; value: number; danger?: boolean }
export interface DueBill { id: string; billNumber: string; supplier: string; dueDate: string; balance: number; overdue: boolean }
export interface HubSummary { group: HubGroup; stats: HubStat[]; dueBills?: DueBill[] }

async function decimalsOf(): Promise<number> {
  const profile = await getPrisma().businessProfile.findFirst({ select: { currencyCode: true } })
  return getCurrencyDecimals(profile?.currencyCode)
}

export async function billsDueSoon(days: number, now = new Date()): Promise<DueBill[]> {
  const db = getPrisma()
  const today = startOfLocalDay(now)
  const until = addLocalDays(today, days + 1)
  const bills = await db.bill.findMany({
    where: { balanceAmount: { gt: 0 }, status: { not: 'VOID' }, OR: [{ dueDate: { lt: until } }, { dueDate: null, billDate: { lt: until } }] },
    select: { id: true, billNumber: true, dueDate: true, billDate: true, balanceAmount: true, supplier: { select: { supplierName: true } } },
    orderBy: [{ dueDate: 'asc' }, { billDate: 'asc' }],
    take: 50
  })
  return bills.map((b) => {
    const due = startOfLocalDay(b.dueDate ?? b.billDate)
    return { id: b.id, billNumber: b.billNumber, supplier: b.supplier.supplierName, dueDate: toLocalISODate(due), balance: b.balanceAmount, overdue: due < today }
  })
}

export const hubService = {
  async summary(group: HubGroup, now = new Date()): Promise<HubSummary> {
    const db = getPrisma()
    const decimals = await decimalsOf()
    const today = startOfLocalDay(now)
    const dayEnd = addLocalDays(today, 1)

    if (group === 'sales') {
      const [open, todays, quotes] = await Promise.all([
        db.invoice.findMany({ where: { balanceAmount: { gt: 0 }, status: { notIn: ['CANCELLED', 'SPLIT'] } }, select: { balanceAmount: true, dueDate: true, invoiceDate: true } }),
        db.invoice.findMany({ where: { invoiceDate: { gte: today, lt: dayEnd }, status: { notIn: ['CANCELLED', 'SPLIT'] }, invoiceType: { not: 'RETURN' } }, select: { totalAmount: true } }),
        db.quotation.count({ where: { status: { in: ['DRAFT', 'SENT'] } } })
      ])
      const overdue = open.filter((i) => startOfLocalDay(i.dueDate ?? i.invoiceDate) < today)
      return {
        group,
        stats: [
          { key: 'salesToday', type: 'money', value: sumMoney(todays.map((t) => t.totalAmount), decimals) },
          { key: 'invoicesToday', type: 'number', value: todays.length },
          { key: 'receivable', type: 'money', value: sumMoney(open.map((i) => i.balanceAmount), decimals) },
          { key: 'overdue', type: 'money', value: sumMoney(overdue.map((i) => i.balanceAmount), decimals), danger: overdue.length > 0 },
          { key: 'openQuotations', type: 'number', value: quotes }
        ]
      }
    }

    if (group === 'purchases') {
      const bills = await billsDueSoon(7, now)
      const openBills = await db.bill.findMany({ where: { balanceAmount: { gt: 0 }, status: { not: 'VOID' } }, select: { balanceAmount: true } })
      const overdue = bills.filter((b) => b.overdue)
      const week = bills.filter((b) => !b.overdue)
      return {
        group,
        stats: [
          { key: 'payable', type: 'money', value: sumMoney(openBills.map((b) => b.balanceAmount), decimals) },
          { key: 'overdue', type: 'money', value: sumMoney(overdue.map((b) => b.balance), decimals), danger: overdue.length > 0 },
          { key: 'dueThisWeek', type: 'money', value: sumMoney(week.map((b) => b.balance), decimals) },
          { key: 'openBills', type: 'number', value: openBills.length }
        ],
        dueBills: bills.slice(0, 10)
      }
    }

    if (group === 'accounting') {
      const [banks, entries] = await Promise.all([
        db.bankAccount.findMany({ where: { isActive: true }, select: { currentBalance: true } }),
        db.journalEntry.count({ where: { entryDate: { gte: today, lt: dayEnd } } })
      ])
      return {
        group,
        stats: [
          { key: 'cashAndBank', type: 'money', value: sumMoney(banks.map((b) => b.currentBalance), decimals) },
          { key: 'bankAccounts', type: 'number', value: banks.length },
          { key: 'entriesToday', type: 'number', value: entries }
        ]
      }
    }

    const inventories = await db.inventory.findMany({ where: { product: { isActive: true } }, select: { quantity: true, reorderLevel: true } })
    return {
      group,
      stats: [
        { key: 'items', type: 'number', value: inventories.length },
        { key: 'lowStock', type: 'number', value: inventories.filter((i) => i.quantity > 0 && i.reorderLevel > 0 && i.quantity <= i.reorderLevel).length, danger: inventories.some((i) => i.quantity > 0 && i.reorderLevel > 0 && i.quantity <= i.reorderLevel) },
        { key: 'outOfStock', type: 'number', value: inventories.filter((i) => i.quantity <= 0).length, danger: inventories.some((i) => i.quantity <= 0) }
      ]
    }
  }
}
