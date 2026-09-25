// Setup with a country loads that country's tax rates and no other country's. Fixes gap row 3.23: the wizard used to
// create India GST rows for any business whose tax model was GST, including Australia, New Zealand, Singapore, Canada.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../../database/seed', () => ({ seedDefaultData: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../auth.service', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  generateRecoveryCode: vi.fn().mockReturnValue('RECOVERY-CODE-123'),
  checkPasswordLength: vi.fn().mockResolvedValue(null),
  getCurrentSession: vi.fn().mockReturnValue(null)
}))
vi.mock('../industry-template.service', () => ({ SERVICE_TEMPLATE_TYPES: new Set(), getLanguageLockFor: vi.fn().mockReturnValue('multi') }))
vi.mock('../service-catalog.service', () => ({ seedDefaultServicesForTemplate: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('../license.service', () => ({ getLicenseState: vi.fn() }))

import { getPrisma } from '../../database/db'
import { completeSetup } from '../setup.service'
import { INDIA_GST_SLABS, INDIA_GST_SPLIT_CONFIGS } from '../india-gst-slabs.service'
import { TAX_PRESETS } from '../../../shared/data/tax-presets'

interface Row { taxName: string; taxType: string; rate: number; country?: string | null; isDefault?: boolean; isActive?: boolean }

function makeDb() {
  const rows: Row[] = []
  const settings = new Map<string, string>()
  const tx: Record<string, any> = {
    businessProfile: { deleteMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ id: 'biz-1' }) },
    user: { create: vi.fn().mockResolvedValue({ id: 'user-1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    taxConfiguration: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => rows.find((r) => Object.entries(where).every(([k, v]) => (r as any)[k] === v)) ?? null),
      create: vi.fn(async ({ data }: { data: Row }) => { rows.push({ isActive: true, ...data }); return data })
    },
    expenseCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'e' }), create: vi.fn() },
    setting: {
      upsert: vi.fn(async ({ where, create, update }: { where: { settingKey: string }; create: { settingValue: string }; update: { settingValue?: string } }) => {
        if (!settings.has(where.settingKey)) settings.set(where.settingKey, create.settingValue)
        else if (update.settingValue !== undefined) settings.set(where.settingKey, update.settingValue)
      })
    }
  }
  const db: Record<string, any> = {
    role: { findFirst: vi.fn().mockResolvedValue({ id: 'role-admin' }) },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx))
  }
  return { db, rows, settings }
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Shop', businessType: 'RETAIL', ownerName: 'Owner', country: 'India', currencyCode: 'INR', currencySymbol: 'Rs',
    taxModel: 'GST', phone: '1', email: 'a@b.com', adminFullName: 'A', adminUsername: 'admin', adminPassword: 'password123',
    ...overrides
  }
}

async function setup(overrides: Record<string, unknown>) {
  const m = makeDb()
  vi.mocked(getPrisma).mockReturnValue(m.db as never)
  const res = await completeSetup(payload(overrides) as never)
  expect(res.success).toBe(true)
  return m
}

const isIndiaRow = (r: Row) => r.taxType === 'CGST' || r.taxType === 'SGST' || r.taxType === 'GST'

beforeEach(() => vi.clearAllMocks())

describe('setup loads only the selected country tax rates', () => {
  it('India with the GST model still gets exactly the current GST slabs and the CGST/SGST rows', async () => {
    const { rows } = await setup({ country: 'India', taxModel: 'GST' })
    const gst = rows.filter((r) => r.taxType === 'GST' && r.taxName !== 'GST Exempt')
    expect(gst.map((r) => r.taxName).sort()).toEqual(INDIA_GST_SLABS.map((s) => s.taxName).sort())
    expect(gst.find((r) => r.isDefault)?.rate).toBe(18)
    expect(rows).toHaveLength(INDIA_GST_SLABS.length + INDIA_GST_SPLIT_CONFIGS.length)
    for (const c of INDIA_GST_SPLIT_CONFIGS) expect(rows.some((r) => r.taxName === c.taxName && r.taxType === c.taxType)).toBe(true)
  })

  it('India typed as "IN" behaves the same', async () => {
    const { rows } = await setup({ country: 'IN', taxModel: 'GST' })
    expect(rows.filter((r) => r.taxType === 'GST' && r.taxName !== 'GST Exempt')).toHaveLength(INDIA_GST_SLABS.length)
  })

  it.each([
    ['Australia', 'AUD', 'VAT'], ['New Zealand', 'NZD', 'VAT'], ['Singapore', 'SGD', 'VAT'], ['Canada', 'CAD', 'VAT'],
    ['United Kingdom', 'GBP', 'VAT'], ['Germany', 'EUR', 'VAT'], ['UAE', 'AED', 'VAT'], ['Japan', 'JPY', 'VAT'], ['United States', 'USD', 'SALES_TAX']
  ])('%s gets only its own rates and no India row, even if the owner picked the GST model', async (country, currency, model) => {
    for (const taxModel of [model, 'GST']) {
      const { rows } = await setup({ country, currencyCode: currency, taxModel })
      const preset = Object.values(TAX_PRESETS).find((p) => p.name === country || (country === 'UAE' && p.code === 'AE'))!
      expect(rows.map((r) => r.taxName).sort()).toEqual(preset.rates.map((r) => r.name).sort())
      expect(rows.some(isIndiaRow)).toBe(false)
      expect(rows.every((r) => r.country === preset.code)).toBe(true)
      expect(rows.filter((r) => r.isDefault)).toHaveLength(1)
    }
  })

  it('a country with no tax at all gets only a No Tax row', async () => {
    const { rows } = await setup({ country: 'Qatar', currencyCode: 'QAR', taxModel: 'VAT' })
    expect(rows.map((r) => r.taxName)).toEqual(['No Tax'])
    expect(rows.some(isIndiaRow)).toBe(false)
  })

  it('a country without a preset gets no invented rate and no India row', async () => {
    for (const taxModel of ['VAT', 'SALES_TAX', 'GST']) {
      const { rows } = await setup({ country: 'Brazil', currencyCode: 'BRL', taxModel })
      expect(rows.map((r) => r.taxName)).toEqual(['No Tax'])
    }
  })

  it('the owner choosing No Tax gets No Tax whatever the country', async () => {
    const { rows } = await setup({ country: 'Germany', currencyCode: 'EUR', taxModel: 'NONE' })
    expect(rows.map((r) => r.taxName)).toEqual(['No Tax'])
  })

  it('an India business that is not on the GST model gets no India GST rows', async () => {
    const { rows } = await setup({ country: 'India', taxModel: 'NONE' })
    expect(rows.some(isIndiaRow)).toBe(false)
  })
})

describe('setup stores the suggestions only when the owner confirmed them', () => {
  it('writes prices_include_tax and invoice_rounding_rule when confirmed', async () => {
    const { settings } = await setup({ country: 'Switzerland', currencyCode: 'CHF', taxModel: 'VAT', pricesIncludeTax: true, invoiceRoundingRule: '0.05' })
    expect(settings.get('prices_include_tax')).toBe('true')
    expect(settings.get('invoice_rounding_rule')).toBe('0.05')
  })

  it('writes the owner declining (false) as false', async () => {
    const { settings } = await setup({ country: 'Switzerland', currencyCode: 'CHF', taxModel: 'VAT', pricesIncludeTax: false })
    expect(settings.get('prices_include_tax')).toBe('false')
    expect(settings.has('invoice_rounding_rule')).toBe(false)
  })

  it('never applies a suggestion the owner did not confirm', async () => {
    const { settings } = await setup({ country: 'Australia', currencyCode: 'AUD', taxModel: 'VAT' })
    expect(settings.has('prices_include_tax')).toBe(false)
    expect(settings.has('invoice_rounding_rule')).toBe(false)
  })
})
