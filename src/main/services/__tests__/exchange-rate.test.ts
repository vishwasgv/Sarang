import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { parseRatesCsv, normaliseRateDate } from '../exchange-rate.util'
import { exchangeRateService } from '../exchange-rate.service'

describe('exchange rate CSV', () => {
  it('reads dates in both formats and rejects impossible ones', () => {
    expect(normaliseRateDate('2026-09-05')).toBe('2026-09-05')
    expect(normaliseRateDate('05/09/2026')).toBe('2026-09-05')
    expect(normaliseRateDate('31-02-2026')).toBeNull()
    expect(normaliseRateDate('soon')).toBeNull()
  })

  it('parses columns in any order, with quotes and semicolons', () => {
    const semi = parseRatesCsv('Date;Currency;Rate\n01/09/2026;usd;83.5\n"2026-09-02";"EUR";90.25')
    expect(semi.errors).toEqual([])
    expect(semi.rates[0]).toEqual({ currencyCode: 'USD', rate: 83.5, rateDate: '2026-09-01' })
    const ok = parseRatesCsv('rate,date,currency\n83.5,2026-09-01,usd\n90.25,2026-09-02,EUR')
    expect(ok.errors).toEqual([])
    expect(ok.rates).toEqual([{ currencyCode: 'USD', rate: 83.5, rateDate: '2026-09-01' }, { currencyCode: 'EUR', rate: 90.25, rateDate: '2026-09-02' }])
  })

  it('reports each bad row and duplicates', () => {
    const r = parseRatesCsv('currency,rate,date\nUS,80,2026-09-01\nUSD,0,2026-09-01\nUSD,80,nope\nUSD,80,2026-09-01\nUSD,81,2026-09-01')
    expect(r.rates).toHaveLength(1)
    expect(r.errors).toHaveLength(4)
    expect(r.errors[3]).toMatch(/twice/)
  })

  it('needs a header with the three columns', () => {
    expect(parseRatesCsv('a,b\n1,2').errors[0]).toMatch(/currency, rate, date/)
    expect(parseRatesCsv('').errors).toHaveLength(1)
  })
})

describe('exchange rate service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves one rate per currency and day (upsert), uppercased', async () => {
    const db = { exchangeRate: { upsert: vi.fn().mockResolvedValue({ id: 'r1' }) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    expect((await exchangeRateService.save({ currencyCode: 'usd', rate: 83.1, rateDate: '2026-09-05' })).success).toBe(true)
    expect(db.exchangeRate.upsert.mock.calls[0][0].where.currencyCode_rateDate.currencyCode).toBe('USD')
    expect((await exchangeRateService.save({ currencyCode: 'US', rate: 1, rateDate: '2026-09-05' })).success).toBe(false)
    expect((await exchangeRateService.save({ currencyCode: 'USD', rate: 0, rateDate: '2026-09-05' })).success).toBe(false)
  })

  it('imports nothing when any row is bad', async () => {
    const db = { $transaction: vi.fn() }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await exchangeRateService.importCsv('currency,rate,date\nUSD,80,2026-09-01\nEUR,-1,2026-09-01')
    expect(r.success).toBe(false)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('latest returns the newest rate on or before the date, or null', async () => {
    const db = { exchangeRate: { findFirst: vi.fn().mockResolvedValue({ rate: 83, rateDate: new Date('2026-09-01T00:00:00.000Z') }) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await exchangeRateService.latest('usd', '2026-09-10')
    expect((r as { data: { rate: number; rateDate: string } }).data).toEqual({ rate: 83, rateDate: '2026-09-01' })
    expect(db.exchangeRate.findFirst.mock.calls[0][0].where.currencyCode).toBe('USD')
    db.exchangeRate.findFirst.mockResolvedValue(null)
    expect((await exchangeRateService.latest('JPY') as { data: unknown }).data).toBeNull()
  })
})
