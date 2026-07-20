import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listShootChecklist, addShootChecklistItem, toggleShootChecklistItem, deleteShootChecklistItem } from '../shoot-checklist.service'

function makeItem(overrides: Record<string, unknown> = {}) {
  return { id: 'chk-1', shootBookingId: 'shoot-1', category: 'EQUIPMENT', label: '2nd camera body', isDone: false, ...overrides }
}

function makeMockDb(items: ReturnType<typeof makeItem>[] = [makeItem()]) {
  return {
    shootBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'shoot-1' }) },
    shootChecklistItem: {
      findMany: vi.fn().mockResolvedValue(items),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeItem({ id: 'chk-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeItem({ ...items[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('shoot-checklist.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists checklist items for a booking', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listShootChecklist('shoot-1')
    expect(res.success).toBe(true)
  })

  it('rejects a blank label', async () => {
    const res = await addShootChecklistItem({ shootBookingId: 'shoot-1', label: '   ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SCL-001')
  })

  it('rejects a missing booking', async () => {
    const db = makeMockDb()
    db.shootBooking.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addShootChecklistItem({ shootBookingId: 'missing', label: 'Tripod' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SCL-002')
  })

  it('creates an item defaulting to EQUIPMENT category', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addShootChecklistItem({ shootBookingId: 'shoot-1', label: 'Tripod' })
    expect(res.success).toBe(true)
    expect(db.shootChecklistItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'EQUIPMENT' }) }))
  })

  it('honors an explicit CREW category', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addShootChecklistItem({ shootBookingId: 'shoot-1', label: 'Assistant photographer', category: 'CREW' })
    expect(res.success).toBe(true)
    expect(db.shootChecklistItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'CREW' }) }))
  })

  it('toggles an item done/undone', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await toggleShootChecklistItem({ id: 'chk-1', isDone: true })
    expect(res.success).toBe(true)
    expect(db.shootChecklistItem.update).toHaveBeenCalledWith({ where: { id: 'chk-1' }, data: { isDone: true } })
  })

  it('deletes an item', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteShootChecklistItem('chk-1')
    expect(res.success).toBe(true)
  })
})
