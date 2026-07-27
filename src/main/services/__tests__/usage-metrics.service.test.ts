import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

function makeDb() {
  const store = new Map<string, string>()
  return {
    __store: store,
    setting: {
      findUnique: vi.fn(({ where }: { where: { settingKey: string } }) => {
        const v = store.get(where.settingKey)
        return Promise.resolve(v === undefined ? null : { settingKey: where.settingKey, settingValue: v })
      }),
      upsert: vi.fn(({ where, update }: { where: { settingKey: string }; update: { settingValue: string } }) => {
        store.set(where.settingKey, update.settingValue)
        return Promise.resolve({ settingKey: where.settingKey, settingValue: update.settingValue })
      })
    }
  }
}

let db: ReturnType<typeof makeDb>

beforeEach(async () => {
  vi.resetModules()
  db = makeDb()
  const { getPrisma } = await import('../../database/db')
  ;(getPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function importFresh() {
  return await import('../usage-metrics.service')
}

describe('recordUsageTick', () => {
  it('first-ever call starts today at ~0 minutes with no prior state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 27, 10, 0, 0))
    const { recordUsageTick } = await importFresh()
    await recordUsageTick()
    expect(db.__store.get('usage_today_date')).toBe('2026-07-27')
    expect(Number(db.__store.get('usage_today_minutes_accumulated'))).toBe(0)
  })

  it('accumulates elapsed minutes across same-day calls', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 27, 10, 0, 0))
    const { recordUsageTick } = await importFresh()
    await recordUsageTick()
    vi.setSystemTime(new Date(2026, 6, 27, 10, 5, 0)) // +5 minutes
    await recordUsageTick()
    expect(db.__store.get('usage_today_date')).toBe('2026-07-27')
    expect(Number(db.__store.get('usage_today_minutes_accumulated'))).toBe(5)
  })

  it('caps elapsed time at one tick interval + grace, so a long sleep/hibernate gap is not counted as usage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 27, 10, 0, 0))
    const { recordUsageTick } = await importFresh()
    await recordUsageTick()
    // Simulate the laptop sleeping for 3 hours between ticks — should be
    // capped, not counted as 180 minutes of active usage.
    vi.setSystemTime(new Date(2026, 6, 27, 13, 0, 0))
    await recordUsageTick()
    const minutes = Number(db.__store.get('usage_today_minutes_accumulated'))
    expect(minutes).toBeLessThan(10) // tick interval (5min) + 1min grace, not 180
  })

  // Constructed via the local Date constructor (year, monthIndex, day, ...)
  // rather than a UTC 'Z' ISO string deliberately — recordUsageTick's day
  // boundary is local-calendar-day-based (see the real bug this fixed,
  // 2026-07-28: a UTC-string round-trip shifted the boundary by the local
  // timezone's offset). Using local-constructed Dates keeps these tests
  // correct regardless of which timezone they run in.
  it('rolls a stale prior day into the pending queue and starts today fresh', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 26, 20, 0, 0)) // local July 26, 8:00 PM
    const { recordUsageTick } = await importFresh()
    await recordUsageTick()
    vi.setSystemTime(new Date(2026, 6, 26, 20, 30, 0)) // local July 26, 8:30 PM
    await recordUsageTick() // accumulates ~30 min for the 26th

    vi.setSystemTime(new Date(2026, 6, 27, 9, 0, 0)) // local July 27, next day
    await recordUsageTick()

    const queue = JSON.parse(db.__store.get('usage_pending_queue') || '[]')
    expect(queue).toHaveLength(1)
    expect(queue[0].date).toBe('2026-07-26')
    expect(queue[0].minutesUsed).toBeGreaterThan(0)
    expect(db.__store.get('usage_today_date')).toBe('2026-07-27')
  })

  it('does not enqueue a zero-minute stale day', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 26, 23, 59, 0)) // local July 26, 11:59 PM
    const { recordUsageTick } = await importFresh()
    await recordUsageTick() // today = 26th, 0 minutes so far

    vi.setSystemTime(new Date(2026, 6, 27, 0, 0, 1)) // local July 27, just after midnight
    await recordUsageTick()

    const queue = JSON.parse(db.__store.get('usage_pending_queue') || '[]')
    expect(queue).toHaveLength(0)
  })
})

describe('flushUsageQueue', () => {
  it('does nothing when the queue is empty', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { flushUsageQueue } = await importFresh()
    await flushUsageQueue()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does nothing when there is no license key yet, even with a queue', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    db.__store.set('usage_pending_queue', JSON.stringify([{ date: '2026-07-26', minutesUsed: 42 }]))
    const { flushUsageQueue } = await importFresh()
    await flushUsageQueue()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends the queue and clears it only on a genuine 200', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKey } = await import('../license.service')
    db.__store.set('license_key', generateLicenseKey('TRIAL', 'IN', new Date()))
    db.__store.set('usage_pending_queue', JSON.stringify([{ date: '2026-07-26', minutesUsed: 42 }]))

    const { flushUsageQueue } = await importFresh()
    await flushUsageQueue()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, options] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://aszurex.com/api/sarang-usage')
    const body = JSON.parse(options.body)
    expect(body.region).toBe('IN')
    expect(body.entries).toEqual([{ date: '2026-07-26', minutesUsed: 42 }])
    expect(db.__store.get('usage_pending_queue')).toBe('[]')
  })

  it('leaves the queue intact when the server responds non-OK', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 502 })
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKey } = await import('../license.service')
    db.__store.set('license_key', generateLicenseKey('TRIAL', 'IN', new Date()))
    const originalQueue = JSON.stringify([{ date: '2026-07-26', minutesUsed: 42 }])
    db.__store.set('usage_pending_queue', originalQueue)

    const { flushUsageQueue } = await importFresh()
    await flushUsageQueue()

    expect(db.__store.get('usage_pending_queue')).toBe(originalQueue)
  })

  it('leaves the queue intact and never throws when fetch itself fails (offline)', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKey } = await import('../license.service')
    db.__store.set('license_key', generateLicenseKey('TRIAL', 'IN', new Date()))
    const originalQueue = JSON.stringify([{ date: '2026-07-26', minutesUsed: 42 }])
    db.__store.set('usage_pending_queue', originalQueue)

    const { flushUsageQueue } = await importFresh()
    await expect(flushUsageQueue()).resolves.toBeUndefined()

    expect(db.__store.get('usage_pending_queue')).toBe(originalQueue)
  })

  it('throttles repeated flush attempts to at most once per ~15 minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 27, 10, 0, 0))
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    const { generateLicenseKey } = await import('../license.service')
    db.__store.set('license_key', generateLicenseKey('TRIAL', 'IN', new Date()))
    db.__store.set('usage_pending_queue', JSON.stringify([{ date: '2026-07-26', minutesUsed: 42 }]))

    const { flushUsageQueue } = await importFresh()
    await flushUsageQueue()
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    // Immediately try again — should be throttled since a flush just ran.
    db.__store.set('usage_pending_queue', JSON.stringify([{ date: '2026-07-27', minutesUsed: 10 }]))
    vi.setSystemTime(new Date(2026, 6, 27, 10, 5, 0)) // only 5 min later
    await flushUsageQueue()
    expect(fetchSpy).toHaveBeenCalledTimes(1) // still 1, not 2
  })
})
