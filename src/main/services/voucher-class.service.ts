import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'

// A voucher class is a saved pattern for a journal entry: which accounts, on which side. Amounts are typed each time.

export interface VoucherClassLine {
  accountId: string
  side: 'DEBIT' | 'CREDIT'
  remarks?: string
}

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

function parseLines(text: string): VoucherClassLine[] {
  try {
    const v = JSON.parse(text)
    return Array.isArray(v) ? (v as VoucherClassLine[]) : []
  } catch {
    return []
  }
}

export const voucherClassService = {
  async list() {
    const rows = await getPrisma().voucherClass.findMany({ orderBy: { name: 'asc' } })
    return { success: true, data: rows.map((r) => ({ id: r.id, name: r.name, narration: r.narration, lines: parseLines(r.linesJson) })) }
  },

  /** Saves a pattern; saving under an existing name replaces it. */
  async save(p: { name: string; narration?: string; lines: VoucherClassLine[] }, userId?: string) {
    try {
      const db = getPrisma()
      const name = p.name.trim()
      if (!name) throw new ServiceError('VC-001', 'Give the template a name.')
      if (p.lines.length < 2) throw new ServiceError('VC-002', 'A template needs at least two lines.')
      if (!p.lines.some((l) => l.side === 'DEBIT') || !p.lines.some((l) => l.side === 'CREDIT')) throw new ServiceError('VC-003', 'A template needs at least one debit and one credit line.')
      const ids = Array.from(new Set(p.lines.map((l) => l.accountId)))
      const found = await db.chartOfAccounts.count({ where: { id: { in: ids } } })
      if (found !== ids.length) throw new ServiceError('VC-004', 'One of the accounts was not found.')
      const lines = p.lines.map((l) => ({ accountId: l.accountId, side: l.side, ...(l.remarks?.trim() ? { remarks: l.remarks.trim().slice(0, 300) } : {}) }))
      const row = await db.voucherClass.upsert({
        where: { name },
        create: { name, narration: p.narration?.trim() || null, linesJson: JSON.stringify(lines) },
        update: { narration: p.narration?.trim() || null, linesJson: JSON.stringify(lines) }
      })
      await logAction({ userId, action: 'VOUCHER_CLASS_SAVED', entityType: 'VoucherClass', entityId: row.id, newValue: { name } })
      return { success: true, data: { id: row.id } }
    } catch (err) {
      return fail(err)
    }
  },

  async remove(id: string, userId?: string) {
    try {
      await getPrisma().voucherClass.deleteMany({ where: { id } })
      await logAction({ userId, action: 'VOUCHER_CLASS_DELETED', entityType: 'VoucherClass', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  }
}
