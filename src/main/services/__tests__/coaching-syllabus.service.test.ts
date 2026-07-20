import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listSyllabusTopics, createSyllabusTopic, updateSyllabusTopic, deleteSyllabusTopic, getSyllabusProgress } from '../coaching-syllabus.service'

// Phase 58 §2 — Coaching Institute: topic-by-topic syllabus coverage per
// batch. Real logic worth testing: completing a topic stamps completedDate
// automatically, reverting it back to PENDING clears that stamp rather than
// leaving a stale date on a topic no longer marked done; progress % handles
// the zero-topics case without dividing by zero.

function makeTopic(overrides: Record<string, unknown> = {}) {
  return {
    id: 'topic-1', batchId: 'batch-1', topicName: 'Quadratic Equations',
    sequenceOrder: 0, plannedDate: null, status: 'PENDING', completedDate: null,
    notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb() {
  const db: Record<string, any> = {
    syllabusTopic: {
      findMany: vi.fn().mockResolvedValue([makeTopic()]),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeTopic({ id: 'topic-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeTopic({ ...data }))
      ),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('coaching-syllabus.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listSyllabusTopics orders by sequenceOrder then createdAt', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listSyllabusTopics('batch-1')

    expect(res.success).toBe(true)
    expect(db.syllabusTopic.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { batchId: 'batch-1' },
      orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
    }))
  })

  it('createSyllabusTopic defaults sequenceOrder to 0 and stores plannedDate', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSyllabusTopic({ batchId: 'batch-1', topicName: 'Trigonometry', plannedDate: '2026-08-01' })

    expect(res.success).toBe(true)
    expect(db.syllabusTopic.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ topicName: 'Trigonometry', sequenceOrder: 0, plannedDate: new Date('2026-08-01') }),
    }))
  })

  it('marking a topic COMPLETED stamps completedDate automatically', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSyllabusTopic({ id: 'topic-1', status: 'COMPLETED' })

    expect(res.success).toBe(true)
    const call = db.syllabusTopic.update.mock.calls[0][0]
    expect(call.data.status).toBe('COMPLETED')
    expect(call.data.completedDate).toBeInstanceOf(Date)
  })

  it('reverting a topic back to PENDING clears completedDate', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSyllabusTopic({ id: 'topic-1', status: 'PENDING' })

    expect(res.success).toBe(true)
    const call = db.syllabusTopic.update.mock.calls[0][0]
    expect(call.data.status).toBe('PENDING')
    expect(call.data.completedDate).toBeNull()
  })

  it('updating fields other than status does not touch completedDate', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateSyllabusTopic({ id: 'topic-1', topicName: 'Renamed Topic' })

    const call = db.syllabusTopic.update.mock.calls[0][0]
    expect(call.data.topicName).toBe('Renamed Topic')
    expect('completedDate' in call.data).toBe(false)
  })

  it('deleteSyllabusTopic removes the row', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteSyllabusTopic('topic-1')

    expect(res.success).toBe(true)
    expect(db.syllabusTopic.delete).toHaveBeenCalledWith({ where: { id: 'topic-1' } })
  })

  it('getSyllabusProgress computes a rounded percent', async () => {
    const db = makeMockDb()
    db.syllabusTopic.count = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSyllabusProgress('batch-1')

    expect(res.success).toBe(true)
    expect((res as { data: { total: number; completed: number; percent: number } }).data).toEqual({ total: 3, completed: 1, percent: 33 })
  })

  it('getSyllabusProgress returns 0% (not NaN) when there are no topics yet', async () => {
    const db = makeMockDb()
    db.syllabusTopic.count = vi.fn().mockResolvedValue(0)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSyllabusProgress('batch-1')

    expect((res as { data: { percent: number } }).data.percent).toBe(0)
  })
})
