import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { customDocumentService, customDocumentEntityType } from '../custom-document.service'

function makeType(overrides: Record<string, unknown> = {}) {
  return { id: 'cdt-1', name: 'Visitor Register', description: null, isActive: true, displayOrder: 0, ...overrides }
}
function makeEntry(overrides: Record<string, unknown> = {}) {
  return { id: 'cde-1', documentTypeId: 'cdt-1', entryDate: new Date('2026-08-01'), notes: null, customFields: null, ...overrides }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    customDocumentType: {
      findMany: vi.fn().mockResolvedValue([makeType()]),
      create: vi.fn().mockResolvedValue(makeType()),
      update: vi.fn().mockResolvedValue(makeType()),
      findUnique: vi.fn().mockResolvedValue(makeType()),
    },
    customDocumentEntry: {
      findMany: vi.fn().mockResolvedValue([makeEntry()]),
      create: vi.fn().mockResolvedValue(makeEntry()),
      update: vi.fn().mockResolvedValue(makeEntry()),
      findUnique: vi.fn().mockResolvedValue(makeEntry()),
      delete: vi.fn().mockResolvedValue(makeEntry()),
    },
    ...overrides
  } as Record<string, any>
}

beforeEach(() => vi.clearAllMocks())

describe('customDocumentEntityType', () => {
  it('produces the exact namespaced key the CustomFieldDefinition table expects', () => {
    expect(customDocumentEntityType('abc123')).toBe('CUSTOM_DOCUMENT:abc123')
  })
})

describe('customDocumentService.createType', () => {
  it('creates a document type and trims the name', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customDocumentService.createType({ name: '  Visitor Register  ' } as never)

    expect(res.success).toBe(true)
    expect(db.customDocumentType.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Visitor Register' }) }))
  })
})

describe('customDocumentService.updateType', () => {
  it('returns a real error when the type does not exist', async () => {
    const db = makeDb({ customDocumentType: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customDocumentService.updateType({ id: 'missing' } as never)

    expect(res.success).toBe(false)
    expect(db.customDocumentType.update).not.toHaveBeenCalled()
  })
})

describe('customDocumentService.createEntry', () => {
  it('rejects an entry for a document type that does not exist', async () => {
    const db = makeDb({ customDocumentType: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customDocumentService.createEntry({ documentTypeId: 'missing' } as never)

    expect(res.success).toBe(false)
    expect(db.customDocumentEntry.create).not.toHaveBeenCalled()
  })

  it('serializes customFields into the JSON-string column, same convention as every other entity', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await customDocumentService.createEntry({ documentTypeId: 'cdt-1', customFields: { 'field-1': 'Jane Doe' } } as never)

    expect(db.customDocumentEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customFields: JSON.stringify({ 'field-1': 'Jane Doe' }) })
    }))
  })

  it('defaults entryDate to now when omitted', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await customDocumentService.createEntry({ documentTypeId: 'cdt-1' } as never)

    const callArg = db.customDocumentEntry.create.mock.calls[0][0]
    expect(callArg.data.entryDate).toBeInstanceOf(Date)
  })
})

describe('customDocumentService.listEntries', () => {
  it('deserializes each entry\'s customFields back into a plain object', async () => {
    const db = makeDb({
      customDocumentEntry: { findMany: vi.fn().mockResolvedValue([makeEntry({ customFields: JSON.stringify({ 'field-1': 'Jane Doe' }) })]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customDocumentService.listEntries('cdt-1')

    expect(res.success).toBe(true)
    expect((res.data as { customFields: Record<string, unknown> }[])[0].customFields).toEqual({ 'field-1': 'Jane Doe' })
  })
})

describe('customDocumentService.updateEntry', () => {
  it('returns a real error when the entry does not exist', async () => {
    const db = makeDb({ customDocumentEntry: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customDocumentService.updateEntry({ id: 'missing' } as never)

    expect(res.success).toBe(false)
    expect(db.customDocumentEntry.update).not.toHaveBeenCalled()
  })
})

describe('customDocumentService.deleteEntry', () => {
  it('deletes an existing entry', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customDocumentService.deleteEntry('cde-1')

    expect(res.success).toBe(true)
    expect(db.customDocumentEntry.delete).toHaveBeenCalledWith({ where: { id: 'cde-1' } })
  })

  it('returns a real error when the entry does not exist, rather than a silent no-op success', async () => {
    const db = makeDb({ customDocumentEntry: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customDocumentService.deleteEntry('missing')

    expect(res.success).toBe(false)
    expect(db.customDocumentEntry.delete).not.toHaveBeenCalled()
  })
})
