import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { customFieldService, serializeCustomFieldValues, parseCustomFieldValues } from '../custom-field.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    customFieldDefinition: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    ...overrides
  }
}

beforeEach(() => vi.clearAllMocks())

describe('customFieldService.listDefinitions', () => {
  it('lists definitions filtered by entityType', async () => {
    const db = makeDb({
      customFieldDefinition: { findMany: vi.fn().mockResolvedValue([{ id: 'cf-1', entityType: 'CUSTOMER', fieldName: 'Referral Source', fieldType: 'TEXT', selectOptions: null, isActive: true, displayOrder: 0 }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customFieldService.listDefinitions({ entityType: 'CUSTOMER' })

    expect(res.success).toBe(true)
    expect(res.data).toHaveLength(1)
    expect(db.customFieldDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { entityType: 'CUSTOMER' } }))
  })

  it('deserializes selectOptions from its stored JSON-string form', async () => {
    const db = makeDb({
      customFieldDefinition: { findMany: vi.fn().mockResolvedValue([{ id: 'cf-1', entityType: 'PRODUCT', fieldName: 'Shelf', fieldType: 'SELECT', selectOptions: JSON.stringify(['A1', 'B2']), isActive: true, displayOrder: 0 }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customFieldService.listDefinitions()

    expect((res.data as { selectOptions: string[] }[])[0].selectOptions).toEqual(['A1', 'B2'])
  })
})

describe('customFieldService.createDefinition', () => {
  it('creates a definition and serializes selectOptions to a JSON string', async () => {
    const db = makeDb({
      customFieldDefinition: {
        create: vi.fn().mockResolvedValue({ id: 'cf-1', entityType: 'PRODUCT', fieldName: 'Shelf', fieldType: 'SELECT', selectOptions: JSON.stringify(['A1', 'B2']), isActive: true, displayOrder: 0 })
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customFieldService.createDefinition({ entityType: 'PRODUCT', fieldName: 'Shelf', fieldType: 'SELECT', selectOptions: ['A1', 'B2'] })

    expect(res.success).toBe(true)
    expect(db.customFieldDefinition.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ selectOptions: JSON.stringify(['A1', 'B2']) })
    }))
  })

  it('stores a null selectOptions for a non-SELECT field type', async () => {
    const db = makeDb({
      customFieldDefinition: { create: vi.fn().mockResolvedValue({ id: 'cf-2', entityType: 'CUSTOMER', fieldName: 'Referral Source', fieldType: 'TEXT', selectOptions: null, isActive: true, displayOrder: 0 }) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await customFieldService.createDefinition({ entityType: 'CUSTOMER', fieldName: 'Referral Source', fieldType: 'TEXT' })

    expect(db.customFieldDefinition.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ selectOptions: null })
    }))
  })
})

describe('customFieldService.updateDefinition', () => {
  it('deactivating a definition preserves it (isActive: false), does not delete it', async () => {
    const existing = { id: 'cf-1', entityType: 'CUSTOMER', fieldName: 'Referral Source', fieldType: 'TEXT', selectOptions: null, isActive: true, displayOrder: 0 }
    const db = makeDb({
      customFieldDefinition: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({ ...existing, isActive: false })
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customFieldService.updateDefinition({ id: 'cf-1', isActive: false })

    expect(res.success).toBe(true)
    expect(db.customFieldDefinition.update).toHaveBeenCalledWith({ where: { id: 'cf-1' }, data: { isActive: false } })
  })

  it('returns a real error when the definition does not exist', async () => {
    const db = makeDb({ customFieldDefinition: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await customFieldService.updateDefinition({ id: 'missing', isActive: false })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CF-001')
  })
})

describe('serializeCustomFieldValues / parseCustomFieldValues', () => {
  it('round-trips a real values object', () => {
    const values = { 'cf-1': 'North Zone', 'cf-2': 42 }
    const serialized = serializeCustomFieldValues(values)
    expect(serialized).toBe(JSON.stringify(values))
    expect(parseCustomFieldValues(serialized)).toEqual(values)
  })

  it('returns null for undefined/empty input instead of an empty-object string', () => {
    expect(serializeCustomFieldValues(undefined)).toBeNull()
    expect(serializeCustomFieldValues({})).toBeNull()
  })

  it('parses a null/malformed blob as an empty object instead of throwing', () => {
    expect(parseCustomFieldValues(null)).toEqual({})
    expect(parseCustomFieldValues('not valid json')).toEqual({})
  })
})
