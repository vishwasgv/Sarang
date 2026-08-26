import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createBeat, updateBeat, deleteBeat, addBeatStop, removeBeatStop, moveBeatStop } from '../distributor-beat.service'

// Phase 67 §9.1 — Distributor item 2: Beat-Plan Route Sequencing. Key
// non-trivial logic: moveBeatStop swaps sequenceOrder with the immediate
// neighbour (not a full renumber) so an interrupted call can't corrupt
// order, and addBeatStop rejects a customer already on the same beat.

function makeBeat(overrides: Record<string, unknown> = {}) {
  return { id: 'beat-1', name: 'North Route', repName: 'Ravi', dayOfWeek: null, isActive: true, createdAt: new Date(), updatedAt: new Date(), stops: [], ...overrides }
}

function makeMockDb(opts: { beat?: ReturnType<typeof makeBeat> | null; stops?: any[] } = {}) {
  const beat = opts.beat !== undefined ? opts.beat : makeBeat()
  const stops = opts.stops ?? []
  const db: Record<string, any> = {
    distributorBeat: {
      findUnique: vi.fn().mockResolvedValue(beat ? { id: beat.id, name: beat.name } : null),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...beat, stops }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'beat-new', ...data })),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...beat, ...data })),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    distributorBeatStop: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(stops),
      create: vi.fn().mockResolvedValue(undefined),
      createMany: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => Promise.resolve(stops.find((s) => s.id === id))),
      aggregate: vi.fn().mockResolvedValue({ _max: { sequenceOrder: stops.length ? Math.max(...stops.map((s: any) => s.sequenceOrder)) : -1 } }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    $transaction: vi.fn().mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg)
      return (arg as (tx: unknown) => Promise<unknown>)(db)
    }),
  }
  return db
}

describe('distributor-beat.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createBeat rejects a blank beat name (BEAT-002)', async () => {
    const res = await createBeat({ name: '  ', repName: 'Ravi' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BEAT-002')
  })

  it('createBeat rejects a blank rep name (BEAT-003)', async () => {
    const res = await createBeat({ name: 'North Route', repName: ' ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BEAT-003')
  })

  it('createBeat seeds stops in the given customerIds order', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createBeat({ name: 'North Route', repName: 'Ravi', customerIds: ['cust-a', 'cust-b', 'cust-c'] })

    const call = db.distributorBeatStop.createMany.mock.calls[0][0] as { data: Array<{ customerId: string; sequenceOrder: number }> }
    expect(call.data).toEqual([
      { beatId: 'beat-new', customerId: 'cust-a', sequenceOrder: 0 },
      { beatId: 'beat-new', customerId: 'cust-b', sequenceOrder: 1 },
      { beatId: 'beat-new', customerId: 'cust-c', sequenceOrder: 2 },
    ])
  })

  it('updateBeat returns BEAT-004 when the beat does not exist', async () => {
    const db = makeMockDb({ beat: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBeat({ id: 'missing', isActive: false })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BEAT-004')
  })

  it('deleteBeat returns BEAT-004 when the beat does not exist', async () => {
    const db = makeMockDb({ beat: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteBeat('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BEAT-004')
  })

  it('addBeatStop rejects a customer already on the same beat (BEAT-005)', async () => {
    const db = makeMockDb()
    db.distributorBeatStop.findUnique.mockResolvedValue({ id: 'stop-existing' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addBeatStop({ beatId: 'beat-1', customerId: 'cust-a' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BEAT-005')
  })

  it('addBeatStop appends to the end of the current sequence, not position 0', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.distributorBeatStop.aggregate.mockResolvedValue({ _max: { sequenceOrder: 2 } })

    await addBeatStop({ beatId: 'beat-1', customerId: 'cust-new' })

    expect(db.distributorBeatStop.create).toHaveBeenCalledWith({ data: { beatId: 'beat-1', customerId: 'cust-new', sequenceOrder: 3 } })
  })

  it('removeBeatStop returns BEAT-006 when the stop does not exist', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await removeBeatStop('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BEAT-006')
  })

  it('moveBeatStop UP swaps sequenceOrder with the immediate neighbour, not a full renumber', async () => {
    const stops = [
      { id: 's1', beatId: 'beat-1', customerId: 'a', sequenceOrder: 0 },
      { id: 's2', beatId: 'beat-1', customerId: 'b', sequenceOrder: 1 },
      { id: 's3', beatId: 'beat-1', customerId: 'c', sequenceOrder: 2 },
    ]
    const db = makeMockDb({ stops })
    db.distributorBeatStop.findUnique.mockResolvedValue(stops[1])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await moveBeatStop({ id: 's2', direction: 'UP' })

    expect(db.distributorBeatStop.update).toHaveBeenCalledWith({ where: { id: 's2' }, data: { sequenceOrder: 0 } })
    expect(db.distributorBeatStop.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { sequenceOrder: 1 } })
  })

  it('moveBeatStop UP on the first stop is a no-op, not an out-of-range error', async () => {
    const stops = [
      { id: 's1', beatId: 'beat-1', customerId: 'a', sequenceOrder: 0 },
      { id: 's2', beatId: 'beat-1', customerId: 'b', sequenceOrder: 1 },
    ]
    const db = makeMockDb({ stops })
    db.distributorBeatStop.findUnique.mockResolvedValue(stops[0])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await moveBeatStop({ id: 's1', direction: 'UP' })

    expect(res.success).toBe(true)
    expect(db.distributorBeatStop.update).not.toHaveBeenCalled()
  })
})
