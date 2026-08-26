import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart } from '../utils/date.util'

// Phase 68 §9.1 — Lawyer item 5: court-fee/disbursement tracking. Money the
// firm pays OUT on the case's behalf (court fees, stamp duty, expert
// witness fees, travel) — a genuinely different concept from
// LegalCase.feeAgreed/feeCollected (the advocate's own professional fee).
// CaseDisbursement.amount is a Prisma Decimal — Electron's IPC (structured
// clone) cannot serialize a Decimal instance, same reasoning every other
// Decimal-bearing service in this codebase documents.
function serializeDisbursement<T extends { amount: unknown }>(d: T): T {
  return { ...d, amount: Number(d.amount) }
}

export async function listCaseDisbursements(caseId: string) {
  try {
    const db = getPrisma()
    const rows = await db.caseDisbursement.findMany({ where: { caseId }, orderBy: { paidDate: 'desc' } })
    return { success: true, data: rows.map(serializeDisbursement) }
  } catch (err) {
    return { success: false, error: { code: 'CD68-001', message: err instanceof Error ? err.message : 'Could not list disbursements.' } }
  }
}

export async function createCaseDisbursement(
  payload: { caseId: string; description: string; amount: number; paidDate: string; notes?: string },
  userId?: string
) {
  try {
    if (!payload.description?.trim()) return { success: false, error: { code: 'CD68-002', message: 'Description is required.' } }
    if (payload.amount <= 0) return { success: false, error: { code: 'CD68-003', message: 'Amount must be greater than zero.' } }
    const db = getPrisma()
    const legalCase = await db.legalCase.findUnique({ where: { id: payload.caseId }, select: { id: true } })
    if (!legalCase) return { success: false, error: { code: 'CD68-004', message: 'Case not found.' } }

    const row = await db.caseDisbursement.create({
      data: {
        caseId: payload.caseId, description: payload.description.trim(), amount: payload.amount,
        paidDate: parseLocalDateStart(payload.paidDate), notes: payload.notes?.trim() || null,
      },
    })
    await logAction({ userId, action: 'CASE_DISBURSEMENT_CREATED', entityType: 'CaseDisbursement', entityId: row.id, newValue: { caseId: payload.caseId, amount: payload.amount } })
    return { success: true, data: serializeDisbursement(row) }
  } catch (err) {
    return { success: false, error: { code: 'CD68-005', message: err instanceof Error ? err.message : 'Could not create disbursement.' } }
  }
}

export async function markDisbursementBilled(id: string, isBilledToClient: boolean, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.caseDisbursement.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CD68-006', message: 'Disbursement not found.' } }
    const row = await db.caseDisbursement.update({ where: { id }, data: { isBilledToClient } })
    await logAction({ userId, action: 'CASE_DISBURSEMENT_BILLED_FLAG_SET', entityType: 'CaseDisbursement', entityId: id, newValue: { isBilledToClient } })
    return { success: true, data: serializeDisbursement(row) }
  } catch (err) {
    return { success: false, error: { code: 'CD68-007', message: err instanceof Error ? err.message : 'Could not update disbursement.' } }
  }
}

export async function deleteCaseDisbursement(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.caseDisbursement.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CD68-006', message: 'Disbursement not found.' } }
    await db.caseDisbursement.delete({ where: { id } })
    await logAction({ userId, action: 'CASE_DISBURSEMENT_DELETED', entityType: 'CaseDisbursement', entityId: id, oldValue: existing })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'CD68-008', message: err instanceof Error ? err.message : 'Could not delete disbursement.' } }
  }
}

export const caseDisbursementService = {
  listCaseDisbursements,
  createCaseDisbursement,
  markDisbursementBilled,
  deleteCaseDisbursement,
}
