import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { sumCurrency } from './currency.service'

// Electrical/Plumbing vertical — a contractor's running account for one job
// site, tagged onto CREDIT invoices via Invoice.jobSiteAccountId. Balance is
// derived on read (sum of tagged invoices' balanceAmount), not stored as a
// running total, matching this codebase's general preference for computed
// balances over cached ones (see Customer.outstandingBalance's own callers).

export async function createJobSiteAccount(payload: {
  accountName: string
  contractorId: string
  siteAddress?: string
  notes?: string
  createdById?: string
}) {
  try {
    if (!payload.accountName.trim()) {
      return { success: false, error: { code: 'JSA-001', message: 'Account name is required.' } }
    }
    const db = getPrisma()
    const contractor = await db.customer.findUnique({ where: { id: payload.contractorId } })
    if (!contractor) return { success: false, error: { code: 'JSA-002', message: 'Contractor customer not found.' } }

    const account = await db.jobSiteAccount.create({
      data: {
        accountName: payload.accountName.trim(),
        contractorId: payload.contractorId,
        siteAddress: payload.siteAddress ?? null,
        notes: payload.notes ?? null,
        createdById: payload.createdById ?? null,
      },
      include: { contractor: { select: { id: true, customerName: true, phone: true } } },
    })
    await logAction({ userId: payload.createdById, action: 'JOB_SITE_ACCOUNT_CREATED', entityType: 'JobSiteAccount', entityId: account.id, newValue: { accountName: account.accountName } })
    return { success: true, data: account }
  } catch (err) {
    return { success: false, error: { code: 'JSA-003', message: err instanceof Error ? err.message : 'Could not create job-site account.' } }
  }
}

export async function listJobSiteAccounts(filters?: { contractorId?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.contractorId) where.contractorId = filters.contractorId
    if (filters?.status) where.status = filters.status
    const accounts = await db.jobSiteAccount.findMany({
      where,
      include: { contractor: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: accounts }
  } catch (err) {
    return { success: false, error: { code: 'JSA-004', message: err instanceof Error ? err.message : 'Could not list job-site accounts.' } }
  }
}

export async function getJobSiteAccountBalance(id: string) {
  try {
    const db = getPrisma()
    const account = await db.jobSiteAccount.findUnique({ where: { id } })
    if (!account) return { success: false, error: { code: 'JSA-002', message: 'Job-site account not found.' } }
    const invoices = await db.invoice.findMany({
      where: { jobSiteAccountId: id, status: 'ACTIVE' },
      select: { id: true, invoiceNumber: true, totalAmount: true, balanceAmount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    const totalBilled = sumCurrency(invoices.map(inv => inv.totalAmount))
    const totalOutstanding = sumCurrency(invoices.map(inv => inv.balanceAmount))
    return { success: true, data: { account, invoices, totalBilled, totalOutstanding } }
  } catch (err) {
    return { success: false, error: { code: 'JSA-005', message: err instanceof Error ? err.message : 'Could not compute account balance.' } }
  }
}

export async function updateJobSiteAccount(id: string, payload: { accountName?: string; siteAddress?: string | null; notes?: string | null }) {
  try {
    const db = getPrisma()
    const existing = await db.jobSiteAccount.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'JSA-002', message: 'Job-site account not found.' } }
    // A whitespace-only accountName must be rejected outright, not silently
    // dropped from the update — createJobSiteAccount already enforces this
    // same non-blank rule, this path was the one gap.
    if (payload.accountName !== undefined && !payload.accountName.trim()) {
      return { success: false, error: { code: 'JSA-001', message: 'Account name is required.' } }
    }
    const updated = await db.jobSiteAccount.update({
      where: { id },
      data: {
        accountName: payload.accountName?.trim() || undefined,
        siteAddress: payload.siteAddress,
        notes: payload.notes,
      },
    })
    await logAction({ action: 'JOB_SITE_ACCOUNT_UPDATED', entityType: 'JobSiteAccount', entityId: id })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'JSA-006', message: err instanceof Error ? err.message : 'Could not update job-site account.' } }
  }
}

export async function closeJobSiteAccount(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.jobSiteAccount.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'JSA-002', message: 'Job-site account not found.' } }
    const openBalance = await db.invoice.aggregate({
      where: { jobSiteAccountId: id, status: 'ACTIVE', balanceAmount: { gt: 0 } },
      _sum: { balanceAmount: true },
    })
    if ((openBalance._sum.balanceAmount ?? 0) > 0) {
      return { success: false, error: { code: 'JSA-007', message: 'Cannot close an account with an outstanding balance. Settle it first.' } }
    }
    const updated = await db.jobSiteAccount.update({ where: { id }, data: { status: 'CLOSED' } })
    await logAction({ action: 'JOB_SITE_ACCOUNT_CLOSED', entityType: 'JobSiteAccount', entityId: id })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'JSA-008', message: err instanceof Error ? err.message : 'Could not close job-site account.' } }
  }
}
