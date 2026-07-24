import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: vi.fn(() => '1.1.2') } }))
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
        return Promise.resolve({})
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

async function importFresh() {
  return await import('../update-check.service')
}

describe('isAutoUpdateCheckEnabled / setAutoUpdateCheckEnabled', () => {
  it('defaults to enabled when never toggled (absence of the row means ON, not OFF)', async () => {
    const { isAutoUpdateCheckEnabled } = await importFresh()
    expect(await isAutoUpdateCheckEnabled()).toBe(true)
  })

  it('respects an explicit off toggle', async () => {
    const { isAutoUpdateCheckEnabled, setAutoUpdateCheckEnabled } = await importFresh()
    await setAutoUpdateCheckEnabled(false)
    expect(await isAutoUpdateCheckEnabled()).toBe(false)
  })
})

describe('checkForUpdatesIfDue', () => {
  it('returns null and makes no network call when the toggle is off', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { checkForUpdatesIfDue, setAutoUpdateCheckEnabled } = await importFresh()
    await setAutoUpdateCheckEnabled(false)
    expect(await checkForUpdatesIfDue()).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('checks when due and returns a result only if a real update exists', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tag_name: 'v1.2.0' }) })
    vi.stubGlobal('fetch', fetchSpy)
    const { checkForUpdatesIfDue } = await importFresh()
    const result = await checkForUpdatesIfDue()
    expect(result?.hasUpdate).toBe(true)
    expect(result?.latestVersion).toBe('1.2.0')
    vi.unstubAllGlobals()
  })

  it('returns null when already on the latest version', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tag_name: 'v1.1.2' }) })
    vi.stubGlobal('fetch', fetchSpy)
    const { checkForUpdatesIfDue } = await importFresh()
    expect(await checkForUpdatesIfDue()).toBeNull()
    vi.unstubAllGlobals()
  })

  it('is throttled to ~once/day — skips and makes no network call if already checked recently', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    db.__store.set('auto_update_check_last_run_at', new Date().toISOString())
    const { checkForUpdatesIfDue } = await importFresh()
    expect(await checkForUpdatesIfDue()).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('never throws even when the network call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { checkForUpdatesIfDue } = await importFresh()
    await expect(checkForUpdatesIfDue()).resolves.toBeNull()
    vi.unstubAllGlobals()
  })
})
