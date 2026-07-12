import { app } from 'electron'
import { join } from 'path'
import {
  existsSync, mkdirSync, createReadStream, createWriteStream,
  renameSync, unlinkSync
} from 'fs'
import { stat, writeFile, copyFile } from 'fs/promises'
import { createHash } from 'crypto'
import yauzl from 'yauzl'
import { getPrisma, closeDatabase, initializeDatabase, getDatabasePath } from '../database/db'
import { logAction } from './audit.service'

const APP_VERSION = app.getVersion()
const SCHEMA_VERSION = '1'
const REQUIRED_FILES = ['sarang.db', 'metadata.json']

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BackupRecord {
  id: string
  backupName: string
  backupPath: string
  backupSize: number
  backupDate: Date
  backupVersion: string
  schemaVersion: string | null
  checksum: string | null
  isValid: boolean
  createdAt: Date
}

export interface BackupMetadata {
  appName: string
  appVersion: string
  schemaVersion: string
  businessName: string
  backupDate: string
  dbChecksum: string
  dbSizeBytes: number
}

interface ValidationResult {
  valid: boolean
  metadata?: BackupMetadata
  error?: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function defaultBackupDir(): string {
  const base = app.isPackaged ? app.getPath('userData') : join(process.cwd(), '.dev-data')
  return join(base, 'backups')
}

// An owner can point backups at a different local path — typically a mounted
// USB drive or external disk — via Settings, so a laptop theft/failure
// doesn't take every backup down with it. This stays fully local/offline
// (no cloud, no third-party service, per the app's zero-cost/offline rules)
// — it's a "pick a different disk" feature, not remote storage. Falls back
// to the default app-data path (creating it if needed) whenever the
// configured directory is missing or unwritable — e.g. the USB drive isn't
// plugged in right now — so a backup attempt never simply fails silently
// because of a disconnected destination; `usedFallback` lets the caller
// surface that to the owner instead of the backup quietly landing somewhere
// they don't expect.
async function getBackupDir(): Promise<{ dir: string; usedFallback: boolean }> {
  const fallback = defaultBackupDir()
  try {
    const db = getPrisma()
    const s = await db.setting.findUnique({ where: { settingKey: 'backup_destination_dir' } })
    const configured = s?.settingValue?.trim()
    if (configured) {
      try {
        if (!existsSync(configured)) mkdirSync(configured, { recursive: true })
        return { dir: configured, usedFallback: false }
      } catch {
        // Configured path unreachable (drive unplugged, permissions, etc.) — fall through to default.
      }
    }
  } catch {
    // Setting lookup itself failed — fall through to default.
  }
  if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true })
  return { dir: fallback, usedFallback: true }
}

export async function getBackupDestination(): Promise<{ success: boolean; data: { configuredDir: string | null; effectiveDir: string; usedFallback: boolean } }> {
  const db = getPrisma()
  const s = await db.setting.findUnique({ where: { settingKey: 'backup_destination_dir' } })
  const { dir, usedFallback } = await getBackupDir()
  return { success: true, data: { configuredDir: s?.settingValue?.trim() || null, effectiveDir: dir, usedFallback } }
}

export async function setBackupDestination(path: string | null, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  const db = getPrisma()
  const value = path?.trim() || ''
  if (value) {
    try {
      if (!existsSync(value)) mkdirSync(value, { recursive: true })
    } catch {
      return { success: false, error: { code: 'BK-006', message: 'That folder could not be created or written to. Choose a different location.' } }
    }
  }
  await db.setting.upsert({
    where: { settingKey: 'backup_destination_dir' },
    update: { settingValue: value },
    create: { settingKey: 'backup_destination_dir', settingValue: value, settingType: 'STRING' }
  })
  await logAction({ userId, action: 'UPDATE_SETTING', entityType: 'Setting', entityId: 'backup_destination_dir', newValue: value || '(default)' })
  return { success: true }
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}_${p(d.getMonth() + 1)}_${p(d.getDate())}_${p(d.getHours())}_${p(d.getMinutes())}_${p(d.getSeconds())}`
}

async function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk as Buffer))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function createZip(files: { path: string; name: string }[], zipPath: string): Promise<void> {
  // archiver@8 is pure ESM (no CJS export) — electron-vite compiles the main
  // process to CommonJS, so a static import becomes a require() that
  // Electron's bundled Node cannot satisfy. Dynamic import() works from CJS.
  const { ZipArchive } = await import('archiver')
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = new ZipArchive({ zlib: { level: 6 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    for (const { path, name } of files) archive.file(path, { name })
    archive.finalize()
  })
}

async function validateZip(zipPath: string, expectedChecksum?: string): Promise<ValidationResult> {
  if (!existsSync(zipPath)) return { valid: false, error: 'Backup file not found on disk.' }

  if (expectedChecksum) {
    const actual = await sha256(zipPath)
    if (actual !== expectedChecksum) {
      return { valid: false, error: 'Checksum mismatch — file may be corrupted or tampered.' }
    }
  }

  return new Promise((resolve) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        resolve({ valid: false, error: `Cannot open ZIP: ${err?.message ?? 'unknown'}` })
        return
      }

      const found: string[] = []
      let meta: BackupMetadata | null = null

      zipfile.readEntry()

      zipfile.on('entry', (entry: yauzl.Entry) => {
        found.push(entry.fileName)
        if (entry.fileName === 'metadata.json') {
          zipfile.openReadStream(entry, (sErr, stream) => {
            if (sErr || !stream) { zipfile.readEntry(); return }
            const chunks: Buffer[] = []
            stream.on('data', (c: Buffer) => chunks.push(c))
            stream.on('end', () => {
              try { meta = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch {}
              zipfile.readEntry()
            })
          })
        } else {
          zipfile.readEntry()
        }
      })

      zipfile.on('end', () => {
        const missing = REQUIRED_FILES.filter(f => !found.includes(f))
        if (missing.length > 0) { resolve({ valid: false, error: `Missing required files: ${missing.join(', ')}` }); return }
        if (!meta) { resolve({ valid: false, error: 'Could not read metadata.json from backup.' }); return }
        if (meta.appName !== 'Sarang Business OS Lite') { resolve({ valid: false, error: 'Not a valid Sarang backup file.' }); return }
        resolve({ valid: true, metadata: meta })
      })

      zipfile.on('error', (e: Error) => resolve({ valid: false, error: `ZIP read error: ${e.message}` }))
    })
  })
}

async function extractDb(zipPath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) { reject(err ?? new Error('Cannot open ZIP')); return }
      let done = false
      zipfile.readEntry()

      zipfile.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName === 'sarang.db') {
          zipfile.openReadStream(entry, (sErr, stream) => {
            if (sErr || !stream) { reject(sErr ?? new Error('Stream error')); return }
            const out = createWriteStream(destPath)
            stream.pipe(out)
            out.on('finish', () => { done = true; resolve() })
            out.on('error', reject)
          })
        } else {
          zipfile.readEntry()
        }
      })

      zipfile.on('end', () => { if (!done) reject(new Error('sarang.db not found in backup ZIP')) })
      zipfile.on('error', reject)
    })
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function checkDatabaseIntegrity(): Promise<{ ok: boolean; message: string }> {
  try {
    const db = getPrisma()
    const result = await db.$queryRaw<{ integrity_check: string }[]>`PRAGMA integrity_check`
    const ok = result[0]?.integrity_check === 'ok'
    return {
      ok,
      message: ok ? 'Database integrity verified.' : `Integrity issue detected: ${result[0]?.integrity_check ?? 'unknown'}`
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Integrity check failed.' }
  }
}

export async function createBackup(userId?: string): Promise<{
  success: boolean; data?: BackupRecord; error?: { code: string; message: string }
}> {
  try {
    const db = getPrisma()

    // 1. Integrity check before backup
    const integrity = await checkDatabaseIntegrity()
    if (!integrity.ok) {
      return { success: false, error: { code: 'BK-001', message: `Cannot backup — integrity check failed: ${integrity.message}` } }
    }

    // 2. Flush WAL to main database file before copying
    await db.$queryRaw`PRAGMA wal_checkpoint(FULL)`

    const { dir: backupDir } = await getBackupDir()
    const ts = timestamp()
    // timestamp() has second-level granularity — two createBackup() calls landing in the
    // same second (e.g. a manual click racing the safety-backup step of a restore, or the
    // auto-backup check) would otherwise collide on an identical zipPath, silently
    // overwriting one backup's file while still inserting a second, now-dangling DB record.
    let backupName = `SARANG_${ts}`
    let zipPath = join(backupDir, `${backupName}.sarang-backup`)
    let dupeSuffix = 2
    while (existsSync(zipPath)) {
      backupName = `SARANG_${ts}_${dupeSuffix}`
      zipPath = join(backupDir, `${backupName}.sarang-backup`)
      dupeSuffix++
    }
    const tempDbPath = join(backupDir, `${backupName}_db.tmp`)
    const metaPath = join(backupDir, `${backupName}_meta.tmp`)

    // 3. VACUUM INTO creates a clean defragmented copy without closing the connection
    const vacuumPath = tempDbPath.replace(/\\/g, '/').replace(/'/g, "''")
    await db.$executeRawUnsafe(`VACUUM INTO '${vacuumPath}'`)

    // 4. Get business name for metadata
    let businessName = 'Sarang Business'
    try {
      const profile = await db.businessProfile.findFirst({ select: { businessName: true } })
      if (profile?.businessName) businessName = profile.businessName
    } catch {}

    // 5. Checksum the db copy
    const dbChecksum = await sha256(tempDbPath)
    const dbStats = await stat(tempDbPath)

    // 6. Write metadata
    const metadata: BackupMetadata = {
      appName: 'Sarang Business OS Lite',
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      businessName,
      backupDate: new Date().toISOString(),
      dbChecksum,
      dbSizeBytes: dbStats.size
    }
    await writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8')

    // 7. Create ZIP
    await createZip([
      { path: tempDbPath, name: 'sarang.db' },
      { path: metaPath, name: 'metadata.json' }
    ], zipPath)

    // 8. Cleanup temp files
    try { unlinkSync(tempDbPath) } catch {}
    try { unlinkSync(metaPath) } catch {}

    // 9. Checksum the ZIP + validate (RULE BK001)
    const zipChecksum = await sha256(zipPath)
    const zipStats = await stat(zipPath)
    const validation = await validateZip(zipPath, zipChecksum)
    if (!validation.valid) {
      try { unlinkSync(zipPath) } catch {}
      return { success: false, error: { code: 'BK-002', message: `Backup validation failed: ${validation.error}` } }
    }

    // 10. Persist record
    const record = await db.backup.create({
      data: {
        backupName,
        backupPath: zipPath,
        backupSize: BigInt(zipStats.size),
        backupVersion: APP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        checksum: zipChecksum,
        isValid: true
      }
    })

    await logAction({
      userId,
      action: 'BACKUP_CREATED',
      entityType: 'Backup',
      entityId: record.id,
      newValue: { backupName, sizeMB: (zipStats.size / 1024 / 1024).toFixed(2) }
    })

    // 11. Apply retention policy (GAP R13) — keep N most recent, delete the rest
    await applyBackupRetentionPolicy(db, userId).catch(() => {})

    return { success: true, data: { ...record, backupSize: Number(record.backupSize) } as BackupRecord }
  } catch (err) {
    return {
      success: false,
      error: { code: 'BK-003', message: err instanceof Error ? err.message : 'Backup failed unexpectedly.' }
    }
  }
}

async function applyBackupRetentionPolicy(db: ReturnType<typeof getPrisma>, userId?: string): Promise<void> {
  const retentionSetting = await db.setting.findUnique({ where: { settingKey: 'backup_retention_count' } })
  const keepCount = retentionSetting ? parseInt(retentionSetting.settingValue, 10) : 10
  if (isNaN(keepCount) || keepCount <= 0) return

  const allBackups = await db.backup.findMany({
    orderBy: { backupDate: 'desc' },
    select: { id: true, backupPath: true, backupDate: true }
  })

  if (allBackups.length <= keepCount) return

  const toDelete = allBackups.slice(keepCount)
  for (const b of toDelete) {
    try { unlinkSync(b.backupPath) } catch {}
    await db.backup.delete({ where: { id: b.id } })
    await logAction({ userId, action: 'BACKUP_DELETED_RETENTION', entityType: 'Backup', entityId: b.id })
  }
}

// Reuses a sufficiently fresh backup instead of always paying the full
// VACUUM INTO + double-SHA256 + ZIP cost of createBackup(). Used by
// operations (like the Import Wizard) that need "a recent recovery point is
// guaranteed to exist" rather than "a brand new backup right now" — without
// this, a session of several small back-to-back imports would each force a
// full backup, both taxing every trivial import with multi-second overhead
// on a large database and burning through the retention-policy's limited
// slots (default 10) with near-duplicate backups that push a genuinely
// older, more useful recovery point out of the window sooner than expected.
export async function ensureRecentBackup(userId?: string, maxAgeMs = 15 * 60 * 1000): Promise<{
  success: boolean; data?: BackupRecord; error?: { code: string; message: string }
}> {
  try {
    const db = getPrisma()
    const recent = await db.backup.findFirst({
      where: { isValid: true, backupDate: { gte: new Date(Date.now() - maxAgeMs) } },
      orderBy: { backupDate: 'desc' }
    })
    if (recent) return { success: true, data: { ...recent, backupSize: Number(recent.backupSize) } as BackupRecord }
  } catch {
    // Fall through to a fresh backup if the recency check itself fails —
    // never let a lookup error skip the safety net entirely.
  }
  return createBackup(userId)
}

export async function listBackups(): Promise<{ success: boolean; data: BackupRecord[] }> {
  try {
    const db = getPrisma()
    const backups = await db.backup.findMany({ orderBy: { backupDate: 'desc' } })
    // BigInt is not JSON-serialisable — convert to number (safe for file sizes up to 9 PB)
    const records = backups.map(b => ({ ...b, backupSize: Number(b.backupSize) })) as BackupRecord[]
    return { success: true, data: records }
  } catch {
    return { success: true, data: [] }
  }
}

export async function validateBackup(backupId: string): Promise<{
  success: boolean; data?: { valid: boolean; metadata?: BackupMetadata }; error?: { code: string; message: string }
}> {
  try {
    const db = getPrisma()
    const record = await db.backup.findUnique({ where: { id: backupId } })
    if (!record) return { success: false, error: { code: 'BK-004', message: 'Backup record not found.' } }

    const result = await validateZip(record.backupPath, record.checksum ?? undefined)
    await db.backup.update({ where: { id: backupId }, data: { isValid: result.valid } })

    return { success: true, data: { valid: result.valid, metadata: result.metadata } }
  } catch (err) {
    return { success: false, error: { code: 'BK-005', message: err instanceof Error ? err.message : 'Validation failed.' } }
  }
}

export async function restoreBackup(backupId: string, userId?: string): Promise<{
  success: boolean; error?: { code: string; message: string }
}> {
  try {
    const db = getPrisma()

    const record = await db.backup.findUnique({ where: { id: backupId } })
    if (!record) return { success: false, error: { code: 'BK-004', message: 'Backup record not found.' } }

    // Validate before restore
    const validation = await validateZip(record.backupPath, record.checksum ?? undefined)
    if (!validation.valid) {
      return { success: false, error: { code: 'BK-006', message: `Cannot restore — backup is invalid: ${validation.error}` } }
    }

    const dbPath = getDatabasePath()
    const tempPath = dbPath + '.restore_tmp'

    // Extract the target backup's database FIRST, before the safety-backup step below
    // can trigger retention cleanup (createBackup -> applyBackupRetentionPolicy can
    // unlinkSync() the oldest backups once retention count is exceeded — if `record`
    // itself sits at that boundary, it would otherwise be deleted out from under this
    // restore before extractDb() ever reads it).
    try {
      await extractDb(record.backupPath, tempPath)
    } catch (err) {
      return { success: false, error: { code: 'BK-010', message: `Could not read the selected backup: ${err instanceof Error ? err.message : 'unknown error'}` } }
    }

    // Create safety backup first — RULE BK002. If the current database is corrupted,
    // createBackup() will itself refuse (BK-001, since VACUUM INTO a corrupt DB is
    // unsafe) — that is precisely the disaster-recovery scenario restore exists for,
    // so fall back to a raw file copy instead of permanently blocking the restore.
    let safetyBackupId: string | undefined
    const safety = await createBackup(userId)
    if (safety.success) {
      safetyBackupId = safety.data?.id
    } else {
      try {
        const rawSafetyPath = join((await getBackupDir()).dir, `PRE_RESTORE_SAFETY_${timestamp()}.db`)
        await copyFile(dbPath, rawSafetyPath)
        for (const suffix of ['-wal', '-shm']) {
          try { if (existsSync(dbPath + suffix)) await copyFile(dbPath + suffix, rawSafetyPath + suffix) } catch {}
        }
      } catch (err) {
        try { unlinkSync(tempPath) } catch {}
        return {
          success: false,
          error: { code: 'BK-007', message: 'Could not create a safety copy of your current database before restoring. Aborting to protect your data.' }
        }
      }
    }

    await logAction({
      userId,
      action: 'BACKUP_RESTORE_STARTED',
      entityType: 'Backup',
      entityId: backupId,
      newValue: { backupName: record.backupName, safetyBackupId }
    })

    try {
      // Close Prisma before replacing the database file
      await closeDatabase()

      // Replace database file — renameSync is atomic on same filesystem (no partial-write risk)
      renameSync(tempPath, dbPath)

      // The extracted backup has no WAL of its own (it was VACUUM INTO'd from a
      // checkpointed source) — but renameSync only replaces the main db file, not
      // any -wal/-shm sidecars left behind by the old (just-closed) connection.
      // Remove them so the next connection can't attempt to replay stale WAL pages
      // against this unrelated, freshly-restored database file.
      for (const suffix of ['-wal', '-shm']) {
        try { if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix) } catch {}
      }

      // Restart application — renderer will reconnect after relaunch
      app.relaunch()
      app.exit(0)

      return { success: true }
    } catch (err) {
      // Attempt reconnect so the app stays functional
      try { await initializeDatabase() } catch {}
      try { if (existsSync(tempPath)) unlinkSync(tempPath) } catch {}
      return {
        success: false,
        error: { code: 'BK-008', message: `Restore failed: ${err instanceof Error ? err.message : 'Unknown error'}. A safety backup was created before this attempt — restore from that backup if needed.` }
      }
    }
  } catch (err) {
    return {
      success: false,
      error: { code: 'BK-011', message: err instanceof Error ? err.message : 'Restore failed unexpectedly.' }
    }
  }
}

export async function deleteBackup(backupId: string, userId?: string): Promise<{
  success: boolean; error?: { code: string; message: string }
}> {
  try {
    const db = getPrisma()
    const record = await db.backup.findUnique({ where: { id: backupId } })
    if (!record) return { success: false, error: { code: 'BK-004', message: 'Backup record not found.' } }

    try { if (existsSync(record.backupPath)) unlinkSync(record.backupPath) } catch {}
    await db.backup.delete({ where: { id: backupId } })

    await logAction({
      userId,
      action: 'BACKUP_DELETED',
      entityType: 'Backup',
      entityId: backupId,
      newValue: { backupName: record.backupName }
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'BK-009', message: err instanceof Error ? err.message : 'Delete failed.' } }
  }
}
