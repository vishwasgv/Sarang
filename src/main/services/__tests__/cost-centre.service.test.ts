import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { costCentreService } from '../cost-centre.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    costCentre: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'cc-new', name: 'Downtown Branch', code: null, isActive: true }),
      update: vi.fn().mockResolvedValue({})
    },
    ...overrides
  } as Record<string, any>
  vi.mocked(getPrisma).mockReturnValue(db as never)
  return db
}

describe('costCentreService.create', () => {
  it('creates a new cost centre', async () => {
    const db = makeDb()
    const result = await costCentreService.create({ name: 'Downtown Branch', code: 'DT' }, 'user-1')
    expect(result.success).toBe(true)
    expect(db.costCentre.create).toHaveBeenCalledWith({ data: { name: 'Downtown Branch', code: 'DT' } })
  })

  it('rejects an empty/whitespace-only name', async () => {
    makeDb()
    const result = await costCentreService.create({ name: '   ' })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('CC-001')
  })
})

describe('costCentreService.update', () => {
  it('updates an existing cost centre', async () => {
    const db = makeDb({
      costCentre: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cc-1', name: 'Downtown Branch', code: null, isActive: true }),
        update: vi.fn().mockResolvedValue({ id: 'cc-1', name: 'Downtown HQ', code: null, isActive: true })
      }
    })
    const result = await costCentreService.update('cc-1', { name: 'Downtown HQ' })
    expect(result.success).toBe(true)
    expect(db.costCentre.update).toHaveBeenCalledWith({ where: { id: 'cc-1' }, data: { name: 'Downtown HQ' } })
  })

  it('returns a not-found error for an unknown cost centre id', async () => {
    makeDb({ costCentre: { findUnique: vi.fn().mockResolvedValue(null) } })
    const result = await costCentreService.update('missing', { name: 'X' })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('CC-002')
  })

  it('allows deactivating a cost centre', async () => {
    const db = makeDb({
      costCentre: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cc-2', name: 'Old Project', code: null, isActive: true }),
        update: vi.fn().mockResolvedValue({ id: 'cc-2', name: 'Old Project', code: null, isActive: false })
      }
    })
    const result = await costCentreService.update('cc-2', { isActive: false })
    expect(result.success).toBe(true)
    expect(db.costCentre.update).toHaveBeenCalledWith({ where: { id: 'cc-2' }, data: { isActive: false } })
  })
})

describe('costCentreService.hasAny', () => {
  it('is false for a fresh install with zero cost centres', async () => {
    makeDb({ costCentre: { count: vi.fn().mockResolvedValue(0) } })
    const result = await costCentreService.hasAny()
    expect(result.data).toBe(false)
  })

  it('is true once a business creates at least one active cost centre', async () => {
    makeDb({ costCentre: { count: vi.fn().mockResolvedValue(1) } })
    const result = await costCentreService.hasAny()
    expect(result.data).toBe(true)
  })
})
