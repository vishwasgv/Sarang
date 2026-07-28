import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listPerformances, createPerformance, updatePerformance } from '../performance.service'

// Real bug found 2026-07-28 (reports/settings/HR/security/licensing/
// master-data audit pass): Performance.date is a non-nullable Prisma
// DateTime. Electron's ipcRenderer.invoke uses the structured clone
// algorithm, which preserves a Date as a real Date instance across the IPC
// boundary — it does not coerce it to a string. PerformanceScreen.tsx's
// openEdit() does `p.date.split('T')[0]`, assuming `date` is a string
// (matching the renderer's own declared `date: string` interface). Before
// the fix, listPerformances/createPerformance/updatePerformance returned the
// raw Prisma row with `date` still a Date object, which has no `.split`
// method — opening Edit on any performance record would throw at runtime.
// These tests assert the service boundary itself returns a string, which is
// what actually protects the renderer (the bug is invisible to TypeScript
// since the interface always claimed `string`).

function makeBatchInclude() {
  return { id: 'batch-1', batchName: 'Batch A', subjectOrCourse: 'Maths' }
}

function makeMockDb(overrides: Record<string, any> = {}) {
  const storedDate = new Date(2026, 6, 28) // local midnight, 28 Jul 2026
  const db: Record<string, any> = {
    performance: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'perf-1', batchId: 'batch-1', performanceName: 'Annual Day', date: storedDate, venue: null, participatingStudentIds: '[]', notes: null, batch: makeBatchInclude() },
      ]),
      create: vi.fn().mockResolvedValue({ id: 'perf-2', batchId: 'batch-1', performanceName: 'Recital', date: storedDate, venue: null, participatingStudentIds: '[]', notes: null, batch: makeBatchInclude() }),
      update: vi.fn().mockResolvedValue({ id: 'perf-1', batchId: 'batch-1', performanceName: 'Annual Day (updated)', date: storedDate, venue: null, participatingStudentIds: '[]', notes: null, batch: makeBatchInclude() }),
    },
    ...overrides,
  }
  return db
}

describe('performance.service — date serialization across the IPC boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listPerformances returns date as a string, not a Date object', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listPerformances({})
    expect(res.success).toBe(true)
    const row = (res.data as Array<{ date: unknown }>)[0]
    expect(typeof row.date).toBe('string')
    // Must survive the exact call the renderer's openEdit() makes.
    expect(() => (row.date as string).split('T')[0]).not.toThrow()
    expect((row.date as string).split('T')[0]).toBe('2026-07-28')
  })

  it('createPerformance returns date as a string', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createPerformance({ batchId: 'batch-1', performanceName: 'Recital', date: '2026-07-28' })
    expect(res.success).toBe(true)
    expect(typeof (res.data as { date: unknown }).date).toBe('string')
  })

  it('updatePerformance returns date as a string', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updatePerformance({ id: 'perf-1', date: '2026-07-28' })
    expect(res.success).toBe(true)
    expect(typeof (res.data as { date: unknown }).date).toBe('string')
  })

  it('createPerformance stores the exact local calendar date typed, not shifted by a UTC round-trip', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createPerformance({ batchId: 'batch-1', performanceName: 'Recital', date: '2026-07-28' })
    const createCall = db.performance.create.mock.calls[0][0]
    const storedDate: Date = createCall.data.date
    // Must be LOCAL midnight of the typed date, not UTC midnight (which would
    // display as the previous day in any timezone behind UTC).
    expect(storedDate.getFullYear()).toBe(2026)
    expect(storedDate.getMonth()).toBe(6)
    expect(storedDate.getDate()).toBe(28)
    expect(storedDate.getHours()).toBe(0)
  })
})
