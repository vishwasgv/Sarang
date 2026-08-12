import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { invoiceTemplateService } from '../invoice-template.service'

function makeSystemTemplate(overrides: Record<string, unknown> = {}) {
  return { id: 'tpl-classic', name: 'Classic', configJson: JSON.stringify({ accentColor: '#00AEEF', density: 'comfortable' }), isSystem: true, isDefault: true, ...overrides }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    invoiceTemplate: {
      findFirst: vi.fn().mockResolvedValue(makeSystemTemplate()),
      findUnique: vi.fn().mockResolvedValue(makeSystemTemplate()),
      findMany: vi.fn().mockResolvedValue([makeSystemTemplate()]),
      create: vi.fn().mockResolvedValue(makeSystemTemplate()),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...makeSystemTemplate(), ...data })),
      delete: vi.fn().mockResolvedValue({})
    },
    businessProfile: {
      findFirst: vi.fn().mockResolvedValue({ id: 'bp-1', defaultInvoiceTemplateId: null }),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'bp-1', ...data }))
    },
    ...overrides
  } as Record<string, any>
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('invoiceTemplateService.listTemplates', () => {
  it('does not re-seed when a system template already exists', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await invoiceTemplateService.listTemplates()

    expect(db.invoiceTemplate.create).not.toHaveBeenCalled()
  })

  it('lazily seeds all 4 starter templates on a fresh install, Classic as the isDefault one', async () => {
    const db = makeDb({ invoiceTemplate: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await invoiceTemplateService.listTemplates()

    expect(db.invoiceTemplate.create).toHaveBeenCalledTimes(4)
    const names = db.invoiceTemplate.create.mock.calls.map((c: any) => c[0].data.name)
    expect(names).toEqual(['Classic', 'Modern', 'Minimal', 'GST Detailed'])
    const classicCall = db.invoiceTemplate.create.mock.calls[0][0]
    expect(classicCall.data.isDefault).toBe(true)
    expect(classicCall.data.isSystem).toBe(true)
    const modernCall = db.invoiceTemplate.create.mock.calls[1][0]
    expect(modernCall.data.isDefault).toBe(false)
  })
})

describe('invoiceTemplateService.updateTemplate / deleteTemplate', () => {
  it('blocks editing a system starter template', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await invoiceTemplateService.updateTemplate({ id: 'tpl-classic', name: 'Hacked' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('IT-002')
  })

  it('blocks deleting a system starter template', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await invoiceTemplateService.deleteTemplate('tpl-classic')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('IT-002')
  })

  it('allows editing a real custom (non-system) template', async () => {
    const custom = { id: 'tpl-custom', name: 'My Template', configJson: '{}', isSystem: false, isDefault: false }
    const db = makeDb({ invoiceTemplate: { findUnique: vi.fn().mockResolvedValue(custom), update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...custom, ...data })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await invoiceTemplateService.updateTemplate({ id: 'tpl-custom', name: 'Renamed' })

    expect(res.success).toBe(true)
  })
})

describe('invoiceTemplateService.resolveTemplateConfig — most-specific-wins', () => {
  it('a per-invoice override wins over the business default and the system default', async () => {
    const perInvoice = { id: 'tpl-invoice', configJson: JSON.stringify({ accentColor: '#111111' }) }
    const db = makeDb({ invoiceTemplate: { findUnique: vi.fn().mockResolvedValue(perInvoice), findFirst: vi.fn().mockResolvedValue(makeSystemTemplate()) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const config = await invoiceTemplateService.resolveTemplateConfig('tpl-invoice', 'tpl-business-default')

    expect(config).toEqual({ accentColor: '#111111' })
    expect(db.invoiceTemplate.findUnique).toHaveBeenCalledWith({ where: { id: 'tpl-invoice' } })
  })

  it('falls back to the business default when no per-invoice override is set', async () => {
    const businessDefault = { id: 'tpl-business-default', configJson: JSON.stringify({ accentColor: '#222222' }) }
    const db = makeDb({ invoiceTemplate: { findUnique: vi.fn().mockResolvedValue(businessDefault), findFirst: vi.fn().mockResolvedValue(makeSystemTemplate()) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const config = await invoiceTemplateService.resolveTemplateConfig(null, 'tpl-business-default')

    expect(config).toEqual({ accentColor: '#222222' })
  })

  it('falls back to the isSystem isDefault template when neither is set', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const config = await invoiceTemplateService.resolveTemplateConfig(null, null)

    expect(config).toEqual({ accentColor: '#00AEEF', density: 'comfortable' })
    expect(db.invoiceTemplate.findFirst).toHaveBeenCalledWith({ where: { isDefault: true } })
  })

  it('returns null (not a throw) when nothing resolves at all', async () => {
    const db = makeDb({ invoiceTemplate: { findFirst: vi.fn().mockResolvedValue(makeSystemTemplate()), findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const config = await invoiceTemplateService.resolveTemplateConfig('ghost-id', null)

    expect(config).toBeNull()
  })
})

describe('invoiceTemplateService.setBusinessDefaultTemplate', () => {
  it('rejects a non-existent template id', async () => {
    const db = makeDb({ invoiceTemplate: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await invoiceTemplateService.setBusinessDefaultTemplate('ghost')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('IT-001')
  })

  it('allows clearing the business default back to null', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await invoiceTemplateService.setBusinessDefaultTemplate(null)

    expect(res.success).toBe(true)
    expect(db.businessProfile.update).toHaveBeenCalledWith({ where: { id: 'bp-1' }, data: { defaultInvoiceTemplateId: null } })
  })
})
