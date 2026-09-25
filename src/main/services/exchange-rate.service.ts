import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { logAction } from './audit.service'
import { parseRatesCsv, normaliseRateDate } from './exchange-rate.util'

// A table of exchange rates the owner keeps by hand or imports from a CSV, with the full history. The newest rate on or
// before a date is offered when an invoice is made in a foreign currency; the owner can still type any rate.

function fail(err: unknown) {
  if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
  return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Something unexpected happened. Please try again.' } }
}

const asDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const dayText = (d: Date) => d.toISOString().slice(0, 10)

export const exchangeRateService = {
  async list(currencyCode?: string) {
    try {
      const rows = await getPrisma().exchangeRate.findMany({
        where: currencyCode ? { currencyCode: currencyCode.toUpperCase() } : {},
        orderBy: [{ currencyCode: 'asc' }, { rateDate: 'desc' }],
        take: 500
      })
      return { success: true, data: rows.map((r) => ({ id: r.id, currencyCode: r.currencyCode, rate: r.rate, rateDate: dayText(r.rateDate) })) }
    } catch (err) {
      return fail(err)
    }
  },

  /** The newest rate on or before `onDate` (default today), or null when none is recorded. */
  async latest(currencyCode: string, onDate?: string) {
    try {
      const on = onDate ? normaliseRateDate(onDate) : dayText(new Date())
      if (!on) throw new ServiceError('FX-004', 'That is not a valid date.')
      const row = await getPrisma().exchangeRate.findFirst({
        where: { currencyCode: currencyCode.toUpperCase(), rateDate: { lte: asDay(on) } },
        orderBy: { rateDate: 'desc' }
      })
      return { success: true, data: row ? { rate: row.rate, rateDate: dayText(row.rateDate) } : null }
    } catch (err) {
      return fail(err)
    }
  },

  /** Adds a rate, or replaces the one already recorded for that currency and day. */
  async save(p: { currencyCode: string; rate: number; rateDate: string }, userId?: string) {
    try {
      const code = p.currencyCode.trim().toUpperCase()
      const day = normaliseRateDate(p.rateDate)
      if (!/^[A-Z]{3}$/.test(code)) throw new ServiceError('FX-001', 'Enter a 3-letter currency code, for example USD.')
      if (!(p.rate > 0)) throw new ServiceError('FX-002', 'The rate must be more than zero.')
      if (!day) throw new ServiceError('FX-004', 'That is not a valid date.')
      const row = await getPrisma().exchangeRate.upsert({
        where: { currencyCode_rateDate: { currencyCode: code, rateDate: asDay(day) } },
        create: { currencyCode: code, rate: p.rate, rateDate: asDay(day) },
        update: { rate: p.rate }
      })
      await logAction({ userId, action: 'EXCHANGE_RATE_SAVED', entityType: 'ExchangeRate', entityId: row.id, newValue: { code, rate: p.rate, day } })
      return { success: true, data: { id: row.id } }
    } catch (err) {
      return fail(err)
    }
  },

  /** Imports every valid row; nothing is saved when any row has a problem, so the owner can fix the file and retry. */
  async importCsv(text: string, userId?: string) {
    try {
      const { rates, errors } = parseRatesCsv(text)
      if (errors.length > 0) return { success: false, error: { code: 'FX-010', message: errors.slice(0, 5).join(' ') + (errors.length > 5 ? ` (and ${errors.length - 5} more)` : '') } }
      const db = getPrisma()
      await db.$transaction(async (tx) => {
        for (const r of rates) {
          await tx.exchangeRate.upsert({
            where: { currencyCode_rateDate: { currencyCode: r.currencyCode, rateDate: asDay(r.rateDate) } },
            create: { currencyCode: r.currencyCode, rate: r.rate, rateDate: asDay(r.rateDate) },
            update: { rate: r.rate }
          })
        }
      })
      await logAction({ userId, action: 'EXCHANGE_RATES_IMPORTED', entityType: 'ExchangeRate', entityId: 'csv', newValue: { rows: rates.length } })
      return { success: true, data: { imported: rates.length } }
    } catch (err) {
      return fail(err)
    }
  },

  async remove(id: string, userId?: string) {
    try {
      await getPrisma().exchangeRate.deleteMany({ where: { id } })
      await logAction({ userId, action: 'EXCHANGE_RATE_DELETED', entityType: 'ExchangeRate', entityId: id })
      return { success: true }
    } catch (err) {
      return fail(err)
    }
  }
}
