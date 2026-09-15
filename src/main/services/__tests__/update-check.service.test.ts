import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: vi.fn(() => '1.1.2') } }))
vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../license.service', () => ({ getLicenseState: vi.fn() }))

const mockAutoUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  logger: null as unknown,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn()
}
vi.mock('electron-updater', () => ({ autoUpdater: mockAutoUpdater }))

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
  vi.clearAllMocks()
  db = makeDb()
  const { getPrisma } = await import('../../database/db')
  ;(getPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db)
  mockAutoUpdater.checkForUpdates.mockResolvedValue(null)
  mockAutoUpdater.downloadUpdate.mockResolvedValue(undefined)
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

  it('triggers a background electron-updater download only when a real update exists AND the license is eligible', async () => {
    const { getLicenseState } = await import('../license.service')
    ;(getLicenseState as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 'PAID', status: 'ACTIVE' })
    mockAutoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.2.0' } })
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tag_name: 'v1.2.0' }) })
    vi.stubGlobal('fetch', fetchSpy)
    const { checkForUpdatesIfDue } = await importFresh()

    await checkForUpdatesIfDue()
    await vi.waitFor(() => expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalled())

    vi.unstubAllGlobals()
  })

  it('never touches electron-updater when a real update exists but the license is not eligible (trial)', async () => {
    const { getLicenseState } = await import('../license.service')
    ;(getLicenseState as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ tier: 'TRIAL', status: 'ACTIVE' })
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ tag_name: 'v1.2.0' }) })
    vi.stubGlobal('fetch', fetchSpy)
    const { checkForUpdatesIfDue } = await importFresh()

    await checkForUpdatesIfDue()
    await new Promise((r) => setTimeout(r, 0)) // flush the fire-and-forget downloadUpdateIfEligible() microtask
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})

describe('isEligibleForAutoUpdate', () => {
  it.each([
    ['PAID', 'ACTIVE', true],
    ['PAID', 'WARNING', true],
    ['PAID', 'EXPIRED', false],
    ['PAID', 'NOT_ACTIVATED', false],
    ['TRIAL', 'ACTIVE', false],
    ['TRIAL', 'WARNING', false],
  ] as const)('tier=%s status=%s -> eligible=%s', async (tier, status, expected) => {
    const { getLicenseState } = await import('../license.service')
    ;(getLicenseState as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ tier, status })
    const { isEligibleForAutoUpdate } = await importFresh()
    expect(await isEligibleForAutoUpdate()).toBe(expected)
  })
})

describe('getUpdateReadyVersion / restartAndInstallUpdate', () => {
  it('returns null when nothing has been downloaded', async () => {
    const { getUpdateReadyVersion } = await importFresh()
    expect(await getUpdateReadyVersion()).toBeNull()
  })

  it('returns the ready version once electron-updater reports one downloaded', async () => {
    const { getUpdateReadyVersion } = await importFresh()
    db.__store.set('auto_update_ready_version', '1.2.0')
    expect(await getUpdateReadyVersion()).toBe('1.2.0')
  })

  it('returns null once the app is already on the "ready" version (stale leftover setting from before a successful restart)', async () => {
    const { getUpdateReadyVersion } = await importFresh()
    db.__store.set('auto_update_ready_version', '1.1.2') // matches the mocked app.getVersion()
    expect(await getUpdateReadyVersion()).toBeNull()
  })

  it('never throws even if the DB read fails', async () => {
    const { getUpdateReadyVersion } = await importFresh()
    db.setting.findUnique.mockRejectedValueOnce(new Error('db locked'))
    await expect(getUpdateReadyVersion()).resolves.toBeNull()
  })

  it('restartAndInstallUpdate is a no-op when nothing is ready', async () => {
    const { restartAndInstallUpdate } = await importFresh()
    await restartAndInstallUpdate()
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('restartAndInstallUpdate calls quitAndInstall when a version is ready', async () => {
    const { restartAndInstallUpdate } = await importFresh()
    db.__store.set('auto_update_ready_version', '1.2.0')
    await restartAndInstallUpdate()
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalled()
  })
})
