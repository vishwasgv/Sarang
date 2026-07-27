import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

const files = vi.hoisted(() => new Map<string, string>())
const appIsPackaged = vi.hoisted(() => ({ value: false }))

vi.mock('fs', () => ({
  existsSync: vi.fn((p: string) => files.has(p)),
  readFileSync: vi.fn((p: string) => {
    if (!files.has(p)) throw new Error(`ENOENT: ${p}`)
    return files.get(p)
  }),
  writeFileSync: vi.fn((p: string, content: string) => { files.set(p, content) }),
  unlinkSync: vi.fn((p: string) => {
    if (!files.has(p)) throw new Error(`ENOENT: ${p}`)
    files.delete(p)
  })
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() { return appIsPackaged.value },
    getPath: vi.fn(() => 'C:\\fake\\userData'),
    relaunch: vi.fn(),
    exit: vi.fn()
  }
}))

vi.mock('../../database/db', () => ({
  getPrisma: vi.fn(),
  closeDatabase: vi.fn(async () => {})
}))

vi.mock('../../utils/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}))

const DEV_BASE_DIR = join(process.cwd(), '.dev-data')
const DB_PATH = join(DEV_BASE_DIR, 'tutorial.db')
const FLAG_PATH = join(DEV_BASE_DIR, 'tutorial-session.json')

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  files.clear()
  appIsPackaged.value = false
  vi.useRealTimers()
})

async function importFresh() {
  return await import('../tutorial.service')
}

describe('resolveTutorialBoot', () => {
  it('returns null when no tutorial session flag exists (normal boot)', async () => {
    const { resolveTutorialBoot } = await importFresh()
    expect(resolveTutorialBoot()).toBeNull()
  })

  it('returns the flag when it is fresh and tutorial.db exists', async () => {
    files.set(DB_PATH, 'fake-sqlite-bytes')
    files.set(FLAG_PATH, JSON.stringify({
      startedAt: new Date().toISOString(),
      businessType: 'RESTAURANT',
      adminUsername: 'tutorial_abc123',
      adminPassword: 'secret'
    }))
    const { resolveTutorialBoot } = await importFresh()
    const flag = resolveTutorialBoot()
    expect(flag).not.toBeNull()
    expect(flag?.businessType).toBe('RESTAURANT')
    expect(flag?.adminUsername).toBe('tutorial_abc123')
  })

  it('cleans up and returns null when the flag file is corrupt JSON', async () => {
    files.set(DB_PATH, 'fake-sqlite-bytes')
    files.set(FLAG_PATH, '{not valid json')
    const { resolveTutorialBoot } = await importFresh()
    expect(resolveTutorialBoot()).toBeNull()
    expect(files.has(FLAG_PATH)).toBe(false)
    expect(files.has(DB_PATH)).toBe(false)
  })

  it('cleans up and returns null when the flag is older than the 5-minute staleness threshold (crash-recovery)', async () => {
    files.set(DB_PATH, 'fake-sqlite-bytes')
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
    files.set(FLAG_PATH, JSON.stringify({
      startedAt: staleTime,
      businessType: 'RETAIL',
      adminUsername: 'tutorial_stale',
      adminPassword: 'secret'
    }))
    const { resolveTutorialBoot } = await importFresh()
    expect(resolveTutorialBoot()).toBeNull()
    expect(files.has(FLAG_PATH)).toBe(false)
    expect(files.has(DB_PATH)).toBe(false)
  })

  // Real bug found live (2026-07-28): resolveTutorialBoot() used to require
  // tutorial.db to already exist, but on every FRESH tutorial start the flag
  // is written (by startTutorial(), just before app.relaunch()) before
  // tutorial.db exists at all — initializeDatabase() only creates it after
  // this function approves booting into tutorial mode. The old check fired
  // on every single fresh start, not just genuine orphan/crash cases,
  // silently falling back to a normal boot every time. Fixed by removing
  // the db-existence requirement entirely; this test guards the fix.
  it('resolves a fresh flag successfully even though tutorial.db does not exist yet', async () => {
    files.set(FLAG_PATH, JSON.stringify({
      startedAt: new Date().toISOString(),
      businessType: 'PHARMACY',
      adminUsername: 'tutorial_nodb',
      adminPassword: 'secret'
    }))
    const { resolveTutorialBoot } = await importFresh()
    const flag = resolveTutorialBoot()
    expect(flag).not.toBeNull()
    expect(flag?.businessType).toBe('PHARMACY')
    expect(files.has(FLAG_PATH)).toBe(true)
  })

  it('cleans up and returns null when startedAt is implausibly in the future (clock skew guard)', async () => {
    files.set(DB_PATH, 'fake-sqlite-bytes')
    const futureTime = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    files.set(FLAG_PATH, JSON.stringify({
      startedAt: futureTime,
      businessType: 'RETAIL',
      adminUsername: 'tutorial_future',
      adminPassword: 'secret'
    }))
    const { resolveTutorialBoot } = await importFresh()
    expect(resolveTutorialBoot()).toBeNull()
  })
})

describe('isTutorialModeActive', () => {
  it('is false with no flag file', async () => {
    const { isTutorialModeActive } = await importFresh()
    expect(isTutorialModeActive()).toBe(false)
  })

  it('is true once a flag file is present', async () => {
    files.set(FLAG_PATH, JSON.stringify({ startedAt: new Date().toISOString(), businessType: 'RETAIL', adminUsername: 'x', adminPassword: 'y' }))
    const { isTutorialModeActive } = await importFresh()
    expect(isTutorialModeActive()).toBe(true)
  })
})

describe('startTutorial', () => {
  it('writes a fresh flag file and relaunches the app', async () => {
    const electron = await import('electron')
    const { startTutorial } = await importFresh()
    const res = await startTutorial('RESTAURANT')
    expect(res.success).toBe(true)
    expect(files.has(FLAG_PATH)).toBe(true)
    const flag = JSON.parse(files.get(FLAG_PATH)!)
    expect(flag.businessType).toBe('RESTAURANT')
    expect(flag.adminUsername).toMatch(/^tutorial_/)
    expect(typeof flag.adminPassword).toBe('string')
    expect(flag.adminPassword.length).toBeGreaterThan(10)
    expect(electron.app.relaunch).toHaveBeenCalledTimes(1)
    expect(electron.app.exit).toHaveBeenCalledWith(0)
  })

  it('clears out any pre-existing tutorial artifacts before starting fresh', async () => {
    files.set(DB_PATH, 'leftover-from-a-crashed-session')
    files.set(FLAG_PATH, 'leftover-flag')
    const { startTutorial } = await importFresh()
    await startTutorial('RETAIL')
    // the leftover DB should be gone (a fresh one is created later by
    // initializeDatabase on the relaunched boot, not by startTutorial itself)
    expect(files.has(DB_PATH)).toBe(false)
    // a brand-new flag should now be present, not the leftover string
    expect(files.get(FLAG_PATH)).not.toBe('leftover-flag')
  })

  it('returns a TUT-001 error instead of throwing if writing the flag fails', async () => {
    const fs = await import('fs')
    ;(fs.writeFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error('disk full') })
    const { startTutorial } = await importFresh()
    const res = await startTutorial('RETAIL')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TUT-001')
  })
})

describe('seedTutorialDemoData', () => {
  it('creates one demo customer and one demo product with stock, via whichever Prisma client getPrisma currently returns', async () => {
    const dbModule = await import('../../database/db')
    const fakeDb = {
      customer: { create: vi.fn(async (_args: { data: unknown }) => ({ id: 'c1' })) },
      product: { create: vi.fn(async (_args: { data: { inventory: { create: { quantity: number } } } }) => ({ id: 'p1' })) }
    }
    ;(dbModule.getPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fakeDb)

    const { seedTutorialDemoData } = await importFresh()
    await seedTutorialDemoData()

    expect(fakeDb.customer.create).toHaveBeenCalledTimes(1)
    expect(fakeDb.product.create).toHaveBeenCalledTimes(1)
    const productArgs = fakeDb.product.create.mock.calls[0]?.[0]
    expect(productArgs?.data.inventory.create.quantity).toBeGreaterThan(0)
  })
})

describe('exitTutorial', () => {
  it('closes the database connection before deleting tutorial.db, then relaunches', async () => {
    const db = await import('../../database/db')
    const electron = await import('electron')
    files.set(DB_PATH, 'active-tutorial-db')
    files.set(FLAG_PATH, 'active-flag')

    const callOrder: string[] = []
    ;(db.closeDatabase as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => { callOrder.push('closeDatabase') })
    const fs = await import('fs')
    ;(fs.unlinkSync as unknown as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
      callOrder.push(`unlink:${p}`)
      files.delete(p)
    })

    const { exitTutorial } = await importFresh()
    const res = await exitTutorial()

    expect(res.success).toBe(true)
    expect(callOrder[0]).toBe('closeDatabase')
    expect(callOrder.slice(1)).toContain(`unlink:${DB_PATH}`)
    expect(files.has(DB_PATH)).toBe(false)
    expect(files.has(FLAG_PATH)).toBe(false)
    expect(electron.app.relaunch).toHaveBeenCalledTimes(1)
    expect(electron.app.exit).toHaveBeenCalledWith(0)
  })

  it('returns a TUT-002 error instead of throwing if closing the database fails', async () => {
    const db = await import('../../database/db')
    ;(db.closeDatabase as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('locked'))
    const { exitTutorial } = await importFresh()
    const res = await exitTutorial()
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TUT-002')
  })
})
