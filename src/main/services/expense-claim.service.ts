import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { createExpense } from './expense.service'

// Staff spent their own money; the owner approves, then pays them back. Paying creates a normal Expense (so books and reports pick it up).

export type ClaimStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID'

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

function serialise(c: { id: string; claimDate: Date; createdAt: Date; updatedAt: Date } & Record<string, unknown>) {
  return { ...c, claimDate: c.claimDate.toISOString(), createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() }
}

/** The only moves a claim may make. */
export function canMove(from: string, to: ClaimStatus): boolean {
  if (from === 'SUBMITTED') return to === 'APPROVED' || to === 'REJECTED'
  if (from === 'APPROVED') return to === 'PAID' || to === 'REJECTED'
  return false
}

export const expenseClaimService = {
  async list(status?: string) {
    try {
      const rows = await getPrisma().expenseClaim.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 300 })
      return { success: true, data: rows.map(serialise) }
    } catch (err) {
      return fail(err)
    }
  },

  async submit(p: { claimantName: string; categoryId: string; description: string; amount: number; claimDate?: string }, userId?: string) {
    try {
      const db = getPrisma()
      if (!p.claimantName.trim()) throw new ServiceError('CLM-001', 'Enter who is claiming.')
      if (!p.description.trim()) throw new ServiceError('CLM-002', 'Say what the money was spent on.')
      if (!(p.amount > 0)) throw new ServiceError('CLM-003', 'The amount must be more than zero.')
      const cat = await db.expenseCategory.findUnique({ where: { id: p.categoryId } })
      if (!cat) throw new ServiceError('CLM-004', 'Expense category not found.')
      const row = await db.expenseClaim.create({
        data: {
          claimantName: p.claimantName.trim(), categoryId: p.categoryId, description: p.description.trim(), amount: p.amount,
          claimDate: p.claimDate ? new Date(p.claimDate) : new Date(), submittedById: userId ?? null
        }
      })
      await logAction({ userId, action: 'EXPENSE_CLAIM_SUBMITTED', entityType: 'ExpenseClaim', entityId: row.id, newValue: { amount: row.amount, claimant: row.claimantName } })
      return { success: true, data: { id: row.id } }
    } catch (err) {
      return fail(err)
    }
  },

  async decide(id: string, to: 'APPROVED' | 'REJECTED', note: string | undefined, userId?: string) {
    try {
      const db = getPrisma()
      const claim = await db.expenseClaim.findUnique({ where: { id } })
      if (!claim) throw new ServiceError('CLM-005', 'Claim not found.')
      if (!canMove(claim.status, to)) throw new ServiceError('CLM-006', `A ${claim.status.toLowerCase()} claim cannot be ${to.toLowerCase()}.`)
      await db.expenseClaim.update({ where: { id }, data: { status: to, decisionNote: note?.trim() || null, decidedById: userId ?? null } })
      await logAction({ userId, action: `EXPENSE_CLAIM_${to}`, entityType: 'ExpenseClaim', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  },

  /** Repays an approved claim: records the Expense and marks the claim paid. */
  async pay(id: string, paymentMethod: string, userId?: string) {
    try {
      const db = getPrisma()
      const claim = await db.expenseClaim.findUnique({ where: { id } })
      if (!claim) throw new ServiceError('CLM-005', 'Claim not found.')
      if (!canMove(claim.status, 'PAID')) throw new ServiceError('CLM-006', 'Only an approved claim can be paid.')
      const res = await createExpense({
        categoryId: claim.categoryId,
        expenseName: `${claim.description} (claim by ${claim.claimantName})`,
        amount: claim.amount,
        expenseDate: claim.claimDate.toISOString(),
        paymentMethod,
        remarks: `Expense claim ${claim.id}`
      }, userId)
      if (!res.success) return res
      const expenseId = (res as { data?: { id?: string } }).data?.id ?? null
      await db.expenseClaim.update({ where: { id }, data: { status: 'PAID', expenseId } })
      await logAction({ userId, action: 'EXPENSE_CLAIM_PAID', entityType: 'ExpenseClaim', entityId: id, newValue: { expenseId } })
      return { success: true, data: { expenseId } }
    } catch (err) {
      return fail(err)
    }
  }
}
