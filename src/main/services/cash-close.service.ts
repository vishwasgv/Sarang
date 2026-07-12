import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

function startOfDay(d: Date): Date {
  const s = new Date(d); s.setHours(0, 0, 0, 0); return s
}
function endOfDay(d: Date): Date {
  const e = new Date(d); e.setHours(23, 59, 59, 999); return e
}

export const cashCloseService = {
  async getDrawerSummary(date?: string) {
    const db = getPrisma()
    const d = date ? new Date(date) : new Date()
    const from = startOfDay(d)
    const to = endOfDay(d)

    const payments = await db.payment.findMany({
      where: { paymentDate: { gte: from, lte: to }, isReversed: false },
      select: { amount: true, paymentMethod: true }
    })

    const byMethod: Record<string, number> = {}
    for (const p of payments) {
      byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] ?? 0) + p.amount
    }
    const expectedCash = byMethod['CASH'] ?? 0
    const totalCollected = payments.reduce((s, p) => s + p.amount, 0)

    const existing = await db.dailyCashClose.findFirst({
      where: { closeDate: { gte: from, lte: to } }
    })

    return {
      success: true,
      data: {
        date: from.toISOString().slice(0, 10),
        expectedCash,
        totalCollected,
        byMethod,
        alreadyClosed: !!existing,
        existing: existing ?? null
      }
    }
  },

  async create(payload: { date: string; actualCash: number; notes?: string }, userId?: string) {
    const db = getPrisma()
    const d = new Date(payload.date)
    const from = startOfDay(d)
    const to = endOfDay(d)

    const payments = await db.payment.findMany({
      where: { paymentDate: { gte: from, lte: to }, isReversed: false, paymentMethod: 'CASH' },
      select: { amount: true }
    })
    const expectedCash = payments.reduce((s, p) => s + p.amount, 0)
    const variance = payload.actualCash - expectedCash

    const existing = await db.dailyCashClose.findFirst({ where: { closeDate: { gte: from, lte: to } } })

    let record
    if (existing) {
      record = await db.dailyCashClose.update({
        where: { id: existing.id },
        data: { actualCash: payload.actualCash, variance, notes: payload.notes ?? null, closedById: userId ?? null }
      })
    } else {
      record = await db.dailyCashClose.create({
        data: {
          closeDate: from,
          expectedCash,
          actualCash: payload.actualCash,
          variance,
          notes: payload.notes ?? null,
          closedById: userId ?? null
        }
      })
    }

    await logAction({
      userId,
      action: 'CASH_CLOSE_RECORDED',
      entityType: 'DailyCashClose',
      entityId: record.id,
      newValue: { date: payload.date, expectedCash, actualCash: payload.actualCash, variance }
    })
    return { success: true, data: record }
  },

  async list(filters?: { dateFrom?: string; dateTo?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 30
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.dateFrom || filters?.dateTo) {
      where.closeDate = {
        ...(filters?.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters?.dateTo ? { lte: new Date(filters.dateTo + 'T23:59:59') } : {})
      }
    }

    const [records, total] = await db.$transaction([
      db.dailyCashClose.findMany({ where, orderBy: { closeDate: 'desc' }, skip, take: limit }),
      db.dailyCashClose.count({ where })
    ])

    return { success: true, data: { records, total } }
  }
}
