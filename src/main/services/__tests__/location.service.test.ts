import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { locationService, getDefaultLocationId } from '../location.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    location: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: 'loc-main', name: 'Main', isDefault: true }),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({ id: 'loc-new', name: 'Warehouse', address: null, isDefault: false, isActive: true }),
      update: vi.fn().mockResolvedValue({})
    },
    locationStock: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  } as Record<string, any>
  vi.mocked(getPrisma).mockReturnValue(db as never)
  return db
}

describe('getDefaultLocationId', () => {
  it('returns the id of the Location flagged isDefault', async () => {
    makeDb()
    expect(await getDefaultLocationId()).toBe('loc-main')
  })

  it('throws a real error instead of silently returning undefined when no default exists (should never happen post-migration)', async () => {
    makeDb({ location: { findFirst: vi.fn().mockResolvedValue(null) } })
    await expect(getDefaultLocationId()).rejects.toThrow(/default location/i)
  })
})

describe('locationService.create', () => {
  it('creates a new, non-default Location', async () => {
    const db = makeDb()
    const result = await locationService.create({ name: 'Warehouse', address: '123 Main St' }, 'user-1')
    expect(result.success).toBe(true)
    expect(db.location.create).toHaveBeenCalledWith({ data: { name: 'Warehouse', address: '123 Main St' } })
  })

  it('rejects an empty/whitespace-only name', async () => {
    makeDb()
    const result = await locationService.create({ name: '   ' })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('LOC-003')
  })
})

describe('locationService.update', () => {
  it('rejects deactivating the default Location', async () => {
    makeDb({ location: { findUnique: vi.fn().mockResolvedValue({ id: 'loc-main', name: 'Main', isDefault: true, isActive: true }) } })
    const result = await locationService.update('loc-main', { isActive: false })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('LOC-004')
  })

  it('allows renaming the default Location', async () => {
    const db = makeDb({
      location: {
        findUnique: vi.fn().mockResolvedValue({ id: 'loc-main', name: 'Main', isDefault: true, isActive: true }),
        update: vi.fn().mockResolvedValue({ id: 'loc-main', name: 'HQ', isDefault: true, isActive: true })
      }
    })
    const result = await locationService.update('loc-main', { name: 'HQ' })
    expect(result.success).toBe(true)
    expect(db.location.update).toHaveBeenCalledWith({ where: { id: 'loc-main' }, data: { name: 'HQ' } })
  })

  it('allows deactivating a non-default Location', async () => {
    const db = makeDb({
      location: {
        findUnique: vi.fn().mockResolvedValue({ id: 'loc-2', name: 'Old Store', isDefault: false, isActive: true }),
        update: vi.fn().mockResolvedValue({ id: 'loc-2', name: 'Old Store', isDefault: false, isActive: false })
      }
    })
    const result = await locationService.update('loc-2', { isActive: false })
    expect(result.success).toBe(true)
    expect(db.location.update).toHaveBeenCalledWith({ where: { id: 'loc-2' }, data: { isActive: false } })
  })

  it('returns a not-found error for an unknown location id', async () => {
    makeDb({ location: { findUnique: vi.fn().mockResolvedValue(null) } })
    const result = await locationService.update('missing', { name: 'X' })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('LOC-002')
  })
})

describe('locationService.hasMultipleLocations', () => {
  it('is false for the default single-location install', async () => {
    makeDb({ location: { count: vi.fn().mockResolvedValue(1) } })
    const result = await locationService.hasMultipleLocations()
    expect(result.data).toBe(false)
  })

  it('is true once a business creates a second active Location', async () => {
    makeDb({ location: { count: vi.fn().mockResolvedValue(2) } })
    const result = await locationService.hasMultipleLocations()
    expect(result.data).toBe(true)
  })
})
