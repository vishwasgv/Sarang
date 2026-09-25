import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getBusinessCurrencyDecimals, getInvoiceRoundingRule, setSetting } from '../settings.service'
import { splitTaxLines } from '../../../renderer/src/shared/utils/tax.util'
import { buildMoneyContext } from '../../../renderer/src/shared/utils/money-context.util'

function mockDb(opts: { rule?: string | null; currencyCode?: string | null; throws?: boolean }) {
  const db = {
    setting: {
      findUnique: vi.fn(async () => { if (opts.throws) throw new Error('db down'); return opts.rule == null ? null : { settingKey: 'invoice_rounding_rule', settingValue: opts.rule } }),
      upsert: vi.fn().mockResolvedValue({})
    },
    businessProfile: { findFirst: vi.fn(async () => { if (opts.throws) throw new Error('db down'); return opts.currencyCode === undefined ? null : { currencyCode: opts.currencyCode } }) }
  }
  vi.mocked(getPrisma).mockReturnValue(db as never)
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('getInvoiceRoundingRule (Setting invoice_rounding_rule)', () => {
  it('defaults to whole-unit rounding for INR when unset (existing Indian users unchanged)', async () => {
    mockDb({ rule: null })
    expect(await getInvoiceRoundingRule('INR')).toBe('1')
    expect(await getInvoiceRoundingRule(null)).toBe('1')
    expect(await getInvoiceRoundingRule(undefined)).toBe('1')
  })
  it('defaults to exact totals for every other currency when unset', async () => {
    mockDb({ rule: null })
    for (const c of ['USD', 'EUR', 'GBP', 'JPY', 'KWD', 'AED']) expect(await getInvoiceRoundingRule(c)).toBe('NONE')
  })
  it('a stored rule wins over the currency default, for any currency', async () => {
    for (const rule of ['NONE', '0.05', '0.10', '0.50', '1']) {
      mockDb({ rule })
      expect(await getInvoiceRoundingRule('INR')).toBe(rule)
      expect(await getInvoiceRoundingRule('USD')).toBe(rule)
    }
  })
  it('an unrecognised stored value falls back to the currency default', async () => {
    mockDb({ rule: '0.25' })
    expect(await getInvoiceRoundingRule('INR')).toBe('1')
    expect(await getInvoiceRoundingRule('USD')).toBe('NONE')
  })
  it('a database error never blocks billing: falls back to the currency default', async () => {
    mockDb({ throws: true })
    expect(await getInvoiceRoundingRule('INR')).toBe('1')
    expect(await getInvoiceRoundingRule('USD')).toBe('NONE')
  })
  it('the renderer resolves the same rule from the same setting', () => {
    expect(buildMoneyContext({ currencyCode: 'INR' }, {}).roundingRule).toBe('1')
    expect(buildMoneyContext({ currencyCode: 'USD' }, {}).roundingRule).toBe('NONE')
    expect(buildMoneyContext({ currencyCode: 'USD' }, { invoice_rounding_rule: '0.05' }).roundingRule).toBe('0.05')
    expect(buildMoneyContext({ currencyCode: 'INR' }, { invoice_rounding_rule: 'NONE' }).roundingRule).toBe('NONE')
    expect(buildMoneyContext(null, {}).roundingRule).toBe('1')
  })
})

describe('setSetting validation for invoice_rounding_rule', () => {
  it('accepts each valid rule', async () => {
    for (const rule of ['NONE', '0.05', '0.10', '0.50', '1']) {
      const db = mockDb({})
      const res = await setSetting('invoice_rounding_rule', rule)
      expect(res.success).toBe(true)
      expect(db.setting.upsert).toHaveBeenCalledTimes(1)
    }
  })
  it('rejects anything else without writing', async () => {
    for (const bad of ['0.25', '', 'round', '5', '1.00']) {
      const db = mockDb({})
      const res = await setSetting('invoice_rounding_rule', bad)
      expect(res.success).toBe(false)
      expect(db.setting.upsert).not.toHaveBeenCalled()
    }
  })
})

describe('getBusinessCurrencyDecimals', () => {
  it('follows the business currency', async () => {
    mockDb({ currencyCode: 'JPY' }); expect(await getBusinessCurrencyDecimals()).toBe(0)
    mockDb({ currencyCode: 'KWD' }); expect(await getBusinessCurrencyDecimals()).toBe(3)
    mockDb({ currencyCode: 'INR' }); expect(await getBusinessCurrencyDecimals()).toBe(2)
    mockDb({}); expect(await getBusinessCurrencyDecimals()).toBe(2)
    mockDb({ throws: true }); expect(await getBusinessCurrencyDecimals()).toBe(2)
  })
})

describe('splitTaxLines (CGST + SGST equals the tax at any precision)', () => {
  it('two-decimal currency: 0.03 -> 0.01 + 0.02', () => {
    expect(splitTaxLines('GST', 0.03, 'CGST_SGST')).toEqual([{ label: 'CGST', amount: 0.01 }, { label: 'SGST', amount: 0.02 }])
  })
  it('zero-decimal currency: 5 -> 2 + 3, never 2.5 + 2.5', () => {
    expect(splitTaxLines('GST', 5, 'CGST_SGST', 0)).toEqual([{ label: 'CGST', amount: 2 }, { label: 'SGST', amount: 3 }])
  })
  it('three-decimal currency: 0.005 -> 0.002 + 0.003', () => {
    expect(splitTaxLines('GST', 0.005, 'CGST_SGST', 3)).toEqual([{ label: 'CGST', amount: 0.002 }, { label: 'SGST', amount: 0.003 }])
  })
  it('IGST and non-GST models are a single line; zero tax is no line', () => {
    expect(splitTaxLines('GST', 18, 'IGST')).toEqual([{ label: 'IGST', amount: 18 }])
    expect(splitTaxLines('VAT', 18)).toEqual([{ label: 'VAT', amount: 18 }])
    expect(splitTaxLines('GST', 0, 'CGST_SGST')).toEqual([])
  })
})
