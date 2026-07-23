import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// vi.mock factories run before top-level const initializers (import hoisting) —
// vi.hoisted keeps these mock fns accessible inside the factories below.
const { relaunch, exit, closeDatabase, initializeDatabase, logAction } = vi.hoisted(() => ({
  relaunch: vi.fn(),
  exit: vi.fn(),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  logAction: vi.fn().mockResolvedValue(undefined)
}))

let backupDir: string
let dbPath: string

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    // getBackupDir()/getDatabasePath() resolve against this per-test temp dir —
    // real fs + real archiver/yauzl run against it (no ZIP-library mocking:
    // that's the part most worth testing for real).
    getPath: vi.fn(() => backupDir.replace(/[/\\]backups$/, '')),
    getVersion: vi.fn(() => '1.0.0-test'),
    relaunch,
    exit
  }
}))

vi.mock('../../database/db', () => ({
  getPrisma: vi.fn(),
  closeDatabase,
  initializeDatabase,
  getDatabasePath: vi.fn(() => dbPath)
}))

vi.mock('../audit.service', () => ({ logAction }))

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockImplementation((query: unknown) => {
      const sql = Array.isArray(query) ? (query as string[]).join('') : String(query)
      if (sql.includes('integrity_check')) return Promise.resolve([{ integrity_check: 'ok' }])
      return Promise.resolve([])
    }),
    $executeRawUnsafe: vi.fn().mockImplementation((sql: string) => {
      // Simulate VACUUM INTO '<path>' by writing a real file other real fs
      // calls (sha256/stat/zip) downstream can operate on.
      const match = /VACUUM INTO '(.+)'/.exec(sql)
      if (match) writeFileSync(match[1], 'fake-sqlite-db-bytes')
      return Promise.resolve(0)
    }),
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ businessName: 'Test Biz' }) },
    setting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
    backup: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: `bk_${Math.random().toString(36).slice(2)}`, createdAt: new Date(), ...data })
      ),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({})
    },
    ...overrides
  }
}

let db: ReturnType<typeof makeDb>

beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), 'sarang-backup-test-'))
  backupDir = join(root, 'backups')
  dbPath = join(root, 'sarang.db')
  mkdirSync(backupDir, { recursive: true })
  writeFileSync(dbPath, 'original-db-bytes')

  db = makeDb()
  const { getPrisma } = await import('../../database/db')
  ;(getPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db)

  vi.clearAllMocks()
  // clearAllMocks wipes implementations set above too — reassign after clearing.
  db = makeDb()
  ;(getPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db)
})

afterEach(() => {
  try { rmSync(join(backupDir, '..'), { recursive: true, force: true }) } catch { /* test cleanup only */ }
})

async function importFresh() {
  vi.resetModules()
  return await import('../backup.service')
}

describe('createBackup', () => {
  it('creates a valid, checksummed zip and persists a record', async () => {
    const { createBackup } = await importFresh()
    const res = await createBackup('user-1')
    expect(res.success).toBe(true)
    expect(res.data?.checksum).toBeTruthy()
    expect(res.data?.isValid).toBe(true)
    expect(existsSync(res.data!.backupPath)).toBe(true)
    expect(db.backup.create).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite an existing backup file if two calls land in the same second (regression)', async () => {
    // Mirrors backup.service.ts's private timestamp() format exactly, so we can
    // pre-occupy the exact path a same-second createBackup() call would pick.
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const ts = `${d.getFullYear()}_${p(d.getMonth() + 1)}_${p(d.getDate())}_${p(d.getHours())}_${p(d.getMinutes())}_${p(d.getSeconds())}`
    const collidingPath = join(backupDir, `SARANG_${ts}.sarang-backup`)
    writeFileSync(collidingPath, 'pre-existing-backup-from-a-concurrent-call')

    const { createBackup } = await importFresh()
    const res = await createBackup('user-1')

    expect(res.success).toBe(true)
    expect(res.data!.backupPath).not.toBe(collidingPath)
    // The pre-existing file must survive untouched — this is the actual bug being pinned.
    expect(readFileSync(collidingPath, 'utf8')).toBe('pre-existing-backup-from-a-concurrent-call')
  })

  it('aborts before writing anything when integrity check fails (RULE BK001)', async () => {
    db.$queryRaw.mockImplementation((query: unknown) => {
      const sql = Array.isArray(query) ? (query as string[]).join('') : String(query)
      if (sql.includes('integrity_check')) return Promise.resolve([{ integrity_check: 'corruption at page 12' }])
      return Promise.resolve([])
    })
    const { createBackup } = await importFresh()
    const res = await createBackup('user-1')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BK-001')
    expect(db.backup.create).not.toHaveBeenCalled()
  })

  it('applies retention policy, keeping only the N most recent backups', async () => {
    // Scoped to backup_retention_count only — a blanket mockResolvedValue also answers
    // getBackupDir()'s backup_destination_dir lookup, making '2' look like a real (relative)
    // custom destination and creating a genuine "2/" folder under the repo root via the
    // real (unmocked) fs calls in getBackupDir(). This bug leaked hundreds of stray
    // .sarang-backup files into "1/" and "2/" at the project root over several weeks.
    db.setting.findUnique.mockImplementation(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'backup_retention_count' ? { settingValue: '2' } : null)
    )
    const existing = [
      { id: 'old-1', backupPath: join(backupDir, 'old-1.sarang-backup'), backupDate: new Date('2020-01-03') },
      { id: 'old-2', backupPath: join(backupDir, 'old-2.sarang-backup'), backupDate: new Date('2020-01-02') },
      { id: 'old-3', backupPath: join(backupDir, 'old-3.sarang-backup'), backupDate: new Date('2020-01-01') }
    ]
    for (const b of existing) writeFileSync(b.backupPath, 'x')
    db.backup.findMany.mockResolvedValue(existing)

    const { createBackup } = await importFresh()
    await createBackup('user-1')

    // keepCount=2 existing + 1 new = 3 total -> oldest 1 beyond keepCount deleted
    expect(db.backup.delete).toHaveBeenCalledTimes(1)
    expect(db.backup.delete).toHaveBeenCalledWith({ where: { id: 'old-3' } })
    expect(existsSync(existing[2].backupPath)).toBe(false)
    expect(existsSync(existing[0].backupPath)).toBe(true)
    expect(existsSync(existing[1].backupPath)).toBe(true)
  })
})

describe('restoreBackup', () => {
  async function createRealBackup(label: string) {
    const { createBackup } = await importFresh()
    const res = await createBackup(`user-${label}`)
    if (!res.success || !res.data) throw new Error('setup: failed to create real backup for test')
    return res.data
  }

  it('restores by extracting the target backup and atomically replacing the db file', async () => {
    const target = await createRealBackup('a')
    db.backup.findUnique.mockResolvedValue(target)

    const { restoreBackup } = await importFresh()
    const res = await restoreBackup(target.id, 'user-1')

    expect(res.success).toBe(true)
    expect(closeDatabase).toHaveBeenCalled()
    expect(relaunch).toHaveBeenCalled()
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('removes stale -wal/-shm sidecars left by the old connection so they cannot be replayed against the restored db (regression)', async () => {
    const target = await createRealBackup('b')
    db.backup.findUnique.mockResolvedValue(target)
    writeFileSync(dbPath + '-wal', 'stale-wal-bytes-from-old-session')
    writeFileSync(dbPath + '-shm', 'stale-shm-bytes-from-old-session')

    const { restoreBackup } = await importFresh()
    const res = await restoreBackup(target.id, 'user-1')

    expect(res.success).toBe(true)
    expect(existsSync(dbPath + '-wal')).toBe(false)
    expect(existsSync(dbPath + '-shm')).toBe(false)
  })

  it('does not let retention cleanup delete the backup being restored (regression)', async () => {
    // keepCount=1: the mandatory safety backup created inside restoreBackup() would,
    // if retention ran before the target's db was extracted, delete `target` (the
    // oldest of the two) before it's ever read — this pins the fix that extracts
    // the target backup BEFORE the safety-backup/retention step runs.
    // See the retention-policy test above for why this must be scoped by settingKey.
    db.setting.findUnique.mockImplementation(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'backup_retention_count' ? { settingValue: '1' } : null)
    )

    const target = await createRealBackup('old')
    db.backup.findMany.mockResolvedValue([
      { id: target.id, backupPath: target.backupPath, backupDate: new Date('2020-01-01') }
    ])
    db.backup.findUnique.mockResolvedValue(target)

    const { restoreBackup } = await importFresh()
    const res = await restoreBackup(target.id, 'user-1')

    expect(res.success).toBe(true)
  })

  it('falls back to a raw file copy for the safety backup when the current db fails integrity (does not block disaster recovery)', async () => {
    const target = await createRealBackup('good')
    db.backup.findUnique.mockResolvedValue(target)

    // Now simulate the *current* production db being corrupted — this is what
    // restoreBackup() must recover from, so it must not depend on a clean VACUUM
    // INTO safety backup succeeding.
    db.$queryRaw.mockImplementation((query: unknown) => {
      const sql = Array.isArray(query) ? (query as string[]).join('') : String(query)
      if (sql.includes('integrity_check')) return Promise.resolve([{ integrity_check: 'corrupt' }])
      return Promise.resolve([])
    })

    db.backup.create.mockClear()
    const { restoreBackup } = await importFresh()
    const res = await restoreBackup(target.id, 'user-1')

    expect(res.success).toBe(true)
    expect(db.backup.create).not.toHaveBeenCalled()
    const rawSafetyFiles = readdirSync(backupDir).filter((f: string) => f.startsWith('PRE_RESTORE_SAFETY_'))
    expect(rawSafetyFiles.length).toBe(1)
  })

  it('returns BK-004 when the backup record does not exist', async () => {
    db.backup.findUnique.mockResolvedValue(null)
    const { restoreBackup } = await importFresh()
    const res = await restoreBackup('missing-id', 'user-1')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BK-004')
  })

  it('returns BK-006 when the selected backup fails validation', async () => {
    const target = await createRealBackup('valid')
    writeFileSync(target.backupPath, 'corrupted-not-a-real-zip')
    db.backup.findUnique.mockResolvedValue(target)

    const { restoreBackup } = await importFresh()
    const res = await restoreBackup(target.id, 'user-1')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BK-006')
  })
})

describe('deleteBackup', () => {
  it('deletes the file and the record', async () => {
    const record = { id: 'bk-1', backupPath: join(backupDir, 'bk-1.sarang-backup'), backupName: 'bk-1' }
    writeFileSync(record.backupPath, 'x')
    db.backup.findUnique.mockResolvedValue(record)

    const { deleteBackup } = await importFresh()
    const res = await deleteBackup('bk-1', 'user-1')

    expect(res.success).toBe(true)
    expect(existsSync(record.backupPath)).toBe(false)
    expect(db.backup.delete).toHaveBeenCalledWith({ where: { id: 'bk-1' } })
  })

  it('returns BK-004 when the record does not exist', async () => {
    db.backup.findUnique.mockResolvedValue(null)
    const { deleteBackup } = await importFresh()
    const res = await deleteBackup('missing', 'user-1')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BK-004')
  })
})

describe('validateBackup / listBackups', () => {
  it('validateBackup reflects a valid backup and updates isValid', async () => {
    const { createBackup, validateBackup } = await importFresh()
    const created = await createBackup('user-1')
    db.backup.findUnique.mockResolvedValue(created.data)

    const res = await validateBackup(created.data!.id)
    expect(res.success).toBe(true)
    expect(res.data?.valid).toBe(true)
    expect(db.backup.update).toHaveBeenCalledWith({ where: { id: created.data!.id }, data: { isValid: true } })
  })

  it('listBackups degrades to an empty list instead of throwing on db error', async () => {
    db.backup.findMany.mockRejectedValue(new Error('db unavailable'))
    const { listBackups } = await importFresh()
    const res = await listBackups()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })
})

describe('checkDatabaseIntegrity', () => {
  it('reports ok when PRAGMA integrity_check returns ok', async () => {
    const { checkDatabaseIntegrity } = await importFresh()
    const res = await checkDatabaseIntegrity()
    expect(res.ok).toBe(true)
  })

  it('reports not ok with the raw message when corrupted', async () => {
    db.$queryRaw.mockResolvedValue([{ integrity_check: 'corruption at page 9' }])
    const { checkDatabaseIntegrity } = await importFresh()
    const res = await checkDatabaseIntegrity()
    expect(res.ok).toBe(false)
    expect(res.message).toContain('corruption at page 9')
  })
})

describe('backup destination (F.5 — configurable local backup folder)', () => {
  it('createBackup uses the configured destination directory when one is set and reachable', async () => {
    const customDir = mkdtempSync(join(tmpdir(), 'sarang-custom-backup-dest-'))
    db.setting.findUnique = vi.fn().mockImplementation(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'backup_destination_dir' ? { settingValue: customDir } : null)
    )
    const { createBackup } = await importFresh()

    const res = await createBackup('user-1')

    expect(res.success).toBe(true)
    expect(res.data!.backupPath.startsWith(customDir)).toBe(true)
    rmSync(customDir, { recursive: true, force: true })
  })

  it('falls back to the default directory when the configured one cannot be created/written to', async () => {
    // Point the setting at a path that can never become a directory (its parent
    // is itself a plain file) — simulates a genuinely unreachable destination
    // (e.g. an unplugged USB drive under a different mount) without relying on
    // OS-specific permission APIs.
    const blockerFile = join(mkdtempSync(join(tmpdir(), 'sarang-blocker-')), 'not-a-directory')
    writeFileSync(blockerFile, 'x')
    const unreachable = join(blockerFile, 'backups')
    db.setting.findUnique = vi.fn().mockImplementation(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'backup_destination_dir' ? { settingValue: unreachable } : null)
    )
    const { createBackup } = await importFresh()

    const res = await createBackup('user-1')

    expect(res.success).toBe(true)
    expect(res.data!.backupPath.startsWith(backupDir)).toBe(true)
  })

  it('getBackupDestination reports usedFallback + the unreachable configured path so the UI can warn the owner', async () => {
    const blockerFile = join(mkdtempSync(join(tmpdir(), 'sarang-blocker2-')), 'not-a-directory')
    writeFileSync(blockerFile, 'x')
    const unreachable = join(blockerFile, 'backups')
    db.setting.findUnique = vi.fn().mockImplementation(({ where }: { where: { settingKey: string } }) =>
      Promise.resolve(where.settingKey === 'backup_destination_dir' ? { settingValue: unreachable } : null)
    )
    const { getBackupDestination } = await importFresh()

    const res = await getBackupDestination()

    expect(res.data.configuredDir).toBe(unreachable)
    expect(res.data.usedFallback).toBe(true)
    expect(res.data.effectiveDir).toBe(backupDir)
  })

  it('setBackupDestination(null) clears the configured directory back to default', async () => {
    const { setBackupDestination } = await importFresh()

    const res = await setBackupDestination(null, 'user-1')

    expect(res.success).toBe(true)
    expect(db.setting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { settingKey: 'backup_destination_dir' },
      update: { settingValue: '' }
    }))
  })

  it('setBackupDestination rejects a path that cannot be created', async () => {
    const blockerFile = join(mkdtempSync(join(tmpdir(), 'sarang-blocker3-')), 'not-a-directory')
    writeFileSync(blockerFile, 'x')
    const unreachable = join(blockerFile, 'backups')
    const { setBackupDestination } = await importFresh()

    const res = await setBackupDestination(unreachable, 'user-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('BK-006')
    expect(db.setting.upsert).not.toHaveBeenCalled()
  })
})
