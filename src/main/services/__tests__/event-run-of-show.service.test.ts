import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listRunOfShow, createRunOfShowItem, updateRunOfShowItem, deleteRunOfShowItem } from '../event-run-of-show.service'

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ros-1', eventId: 'event-1', scheduledTime: new Date('2026-08-15T10:00:00'),
    activity: 'Guests arrive', responsibleParty: 'Coordinator', isDone: false, notes: null,
    ...overrides,
  }
}

function makeMockDb(items: ReturnType<typeof makeItem>[] = [makeItem()]) {
  return {
    eventBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'event-1' }) },
    eventRunOfShowItem: {
      findMany: vi.fn().mockResolvedValue(items),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeItem({ id: 'ros-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeItem({ ...items[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('event-run-of-show.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists items ordered by scheduledTime', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listRunOfShow('event-1')
    expect(res.success).toBe(true)
    expect(db.eventRunOfShowItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { scheduledTime: 'asc' } }))
  })

  it('rejects a blank activity', async () => {
    const res = await createRunOfShowItem({ eventId: 'event-1', scheduledTime: '2026-08-15T10:00:00', activity: '   ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ROS-001')
  })

  it('rejects a missing scheduled time', async () => {
    const res = await createRunOfShowItem({ eventId: 'event-1', scheduledTime: '', activity: 'Guests arrive' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ROS-002')
  })

  it('rejects a missing event', async () => {
    const db = makeMockDb()
    db.eventBooking.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createRunOfShowItem({ eventId: 'missing', scheduledTime: '2026-08-15T10:00:00', activity: 'Guests arrive' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ROS-003')
  })

  it('creates an item', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createRunOfShowItem({ eventId: 'event-1', scheduledTime: '2026-08-15T10:00:00', activity: 'Guests arrive', responsibleParty: 'Coordinator' })
    expect(res.success).toBe(true)
    expect(db.eventRunOfShowItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ activity: 'Guests arrive', responsibleParty: 'Coordinator' }),
    }))
  })

  it('toggles isDone', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateRunOfShowItem({ id: 'ros-1', isDone: true })
    expect(res.success).toBe(true)
    expect(db.eventRunOfShowItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isDone: true }) }))
  })

  it('deletes an item', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteRunOfShowItem('ros-1')
    expect(res.success).toBe(true)
  })
})
