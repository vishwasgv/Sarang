import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart } from '../utils/date.util'
import { ServiceError } from '../errors/service-error'

// Central Transaction Locking guard (Phase 62, Section 4.1 item 5) — every
// dated financial transaction type (Invoice, Bill, Payment, SupplierPayment,
// Expense, Journal Entry, PO) calls this ONE function before create/edit/
// delete/void, rather than each service re-implementing its own lock check.
// Returns an ApiResponse-shaped error object (not a thrown exception) so
// every caller can `return` it directly the same way they already return
// their own validation errors — no new error-handling shape to learn.
export async function assertNotLocked(transactionDate: Date): Promise<{ success: false; error: { code: string; message: string } } | null> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { lockDate: true } })
  if (!profile?.lockDate) return null
  if (transactionDate.getTime() <= profile.lockDate.getTime()) {
    const lockDateStr = profile.lockDate.toISOString().slice(0, 10)
    return {
      success: false,
      error: { code: 'LOCK-001', message: `This transaction falls on or before the lock date (${lockDateStr}) and cannot be created, edited, voided, or reversed. Ask an administrator to move the lock date if this was a mistake.` }
    }
  }
  return null
}

// Throwing counterpart of assertNotLocked, for the many callers in this
// codebase that check business rules INSIDE a $transaction via a thrown
// ServiceError (caught and mapped to an ApiResponse outside), rather than
// the return-early convention assertNotLocked itself follows. Takes the
// already-open tx so the lock-date read participates in the same
// transaction snapshot as the rest of the caller's writes.
export async function assertNotLockedOrThrow(tx: unknown, transactionDate: Date): Promise<void> {
  const db = (tx as ReturnType<typeof getPrisma>) ?? getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { lockDate: true } })
  if (!profile?.lockDate) return
  if (transactionDate.getTime() <= profile.lockDate.getTime()) {
    const lockDateStr = profile.lockDate.toISOString().slice(0, 10)
    throw new ServiceError('LOCK-001', `This transaction falls on or before the lock date (${lockDateStr}) and cannot be created, edited, voided, or reversed. Ask an administrator to move the lock date if this was a mistake.`)
  }
}

export const transactionLockService = {
  async getLockDate() {
    try {
      const db = getPrisma()
      const profile = await db.businessProfile.findFirst({ select: { lockDate: true } })
      // Real bug found live 2026-08-12 (LedgerSettingsScreen.tsx UAT, not a
      // unit test — mocked IPC responses matched whatever shape the test
      // author assumed, not what this handler actually returned): a raw
      // Prisma Date object crosses the contextBridge as a genuine JS Date
      // (structured clone preserves it), but the renderer calls
      // `lockDate.slice(0, 10)` in two places, assuming an ISO string — the
      // same convention this service's own assertNotLocked/OrThrow error
      // messages already use (`profile.lockDate.toISOString().slice(0,10)`).
      // Crashed LedgerSettingsScreen's ErrorBoundary the instant a lock date
      // was ever set, for every future business, since none had ever set one
      // in this dev DB before this test.
      return { success: true, data: { lockDate: profile?.lockDate?.toISOString() ?? null } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch lock date.' } }
    }
  },

  // Setting the lock date itself is deliberately NOT subject to its own
  // guard — an administrator must always be able to move or clear the lock,
  // that's the entire point of it being an administrative control.
  async setLockDate(lockDate: string | null, userId?: string) {
    try {
      const db = getPrisma()
      const profile = await db.businessProfile.findFirst()
      if (!profile) return { success: false, error: { code: 'BP-001', message: 'Business profile not found.' } }
      const updated = await db.businessProfile.update({
        where: { id: profile.id },
        data: { lockDate: lockDate ? parseLocalDateStart(lockDate) : null }
      })
      await logAction({ userId, action: 'TRANSACTION_LOCK_DATE_CHANGED', entityType: 'BusinessProfile', entityId: profile.id, oldValue: { lockDate: profile.lockDate }, newValue: { lockDate: updated.lockDate } })
      // Same raw-Date-vs-ISO-string convention as getLockDate() above — kept
      // consistent even though today's one caller (LedgerSettingsScreen)
      // re-fetches via getLockDate() instead of reading this response.
      return { success: true, data: { lockDate: updated.lockDate?.toISOString() ?? null } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to set lock date.' } }
    }
  }
}
