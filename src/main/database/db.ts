import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, copyFileSync, statSync } from 'fs'

let prisma: PrismaClient | null = null

export function getDatabasePath(): string {
  const userDataPath = app.isPackaged
    ? app.getPath('userData')
    : join(process.cwd(), '.dev-data')

  if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true })
  return join(userDataPath, 'sarang.db')
}

export function getPrisma(): PrismaClient {
  if (!prisma) throw new Error('Database not initialized. Call initializeDatabase() first.')
  return prisma
}

export async function initializeDatabase(): Promise<void> {
  const dbPath = getDatabasePath()

  // In the packaged app, Prisma cannot dlopen() native addons from inside the
  // ASAR archive. electron-builder puts *.node files into app.asar.unpacked/
  // (via asarUnpack). Point PRISMA_QUERY_ENGINE_LIBRARY there so Prisma finds
  // its query engine without any path guessing.
  if (app.isPackaged) {
    const engineDll = join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '.prisma',
      'client',
      'query_engine-windows.dll.node'
    )
    if (existsSync(engineDll)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = engineDll
    } else {
      console.warn('[DB] Prisma engine DLL not found at expected path:', engineDll)
    }
  }

  process.env.DATABASE_URL = `file:${dbPath}`

  prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
    log: app.isPackaged ? ['error'] : ['warn', 'error']
  })

  try {
    await prisma.$connect()
    await applyMigrations(dbPath)
    console.log(`[DB] Ready: ${dbPath}`)
  } catch (err) {
    console.error('[DB] Initialization failed:', err)
    throw err
  }
}

async function applyMigrations(dbPath: string): Promise<void> {
  const db = getPrisma()

  // WAL mode improves concurrent read performance and crash recovery
  try {
    await db.$queryRaw`PRAGMA journal_mode=WAL`
    await db.$queryRaw`PRAGMA foreign_keys=ON`
    await db.$queryRaw`PRAGMA synchronous=NORMAL`
    // Phase 55 stress-test finding: with no busy_timeout set, SQLite's
    // internal busy-handler waits 0ms before giving up on a locked write —
    // any second write attempt while another transaction holds the write
    // lock fails INSTANTLY with a raw SQLITE_BUSY, which isn't a
    // ServiceError and so surfaces to the user as billing.service.ts's
    // generic "SYS-001: Something unexpected happened" catch-all instead
    // of either succeeding after a short wait or a clear "someone else is
    // completing a sale right now" message. Confirmed live: firing 50
    // genuinely concurrent invoice creations against one low-stock product
    // (only possible under real inter-process/multi-window contention —
    // this app is normally single-window, but the QR-ordering HTTP server
    // and the main window ARE two separate connections to the same file)
    // produced only 7 successes and 43 SYS-001 failures, though never any
    // overselling — data integrity held, this was a false-negative
    // failure rate, not a corruption risk. A 5s busy_timeout lets SQLite's
    // own lock-wait absorb this instead of failing immediately, matching
    // ordinary desktop-app write volumes.
    await db.$queryRaw`PRAGMA busy_timeout=5000`
  } catch (e) {
    console.warn('[DB] PRAGMA setup warning:', e)
  }

  // In development, migrations are applied manually via `npm run db:migrate`.
  // The production migration runner below only runs in the packaged app.
  if (!app.isPackaged) return

  const migrationsDir = join(process.resourcesPath, 'prisma', 'migrations')
  if (!existsSync(migrationsDir)) {
    console.warn('[DB] Migrations directory not found:', migrationsDir)
    return
  }

  // Lightweight migration tracker — avoids depending on the Prisma CLI at runtime.
  // Uses a simple table with the same naming convention as Prisma's own tracker so
  // the data remains interpretable by Prisma tools if needed later.
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_sarang_migrations" (
      "name"      TEXT NOT NULL PRIMARY KEY,
      "appliedAt" TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Migration directories are named with a timestamp prefix (e.g. 20260618_init)
  // so alphabetical order equals chronological order.
  const allDirs = readdirSync(migrationsDir)
    .filter(d => {
      const p = join(migrationsDir, d)
      return statSync(p).isDirectory() && existsSync(join(p, 'migration.sql'))
    })
    .sort()

  const appliedRows = await db.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM "_sarang_migrations"`
  )
  const applied = new Set(appliedRows.map(r => r.name))
  const pending = allDirs.filter(d => !applied.has(d))

  if (pending.length === 0) return

  // ── Pre-upgrade backup ───────────────────────────────────────────────────────
  // When new migrations are found on an existing database, take a file-level
  // backup before touching anything. This is a fast copy (no Prisma needed).
  //
  // RULE (spec: "Pre-update backup MANDATORY before upgrade") — a failed backup
  // must abort the upgrade, not silently proceed to run schema migrations with
  // no safety net. The previous version caught the copy failure and continued
  // anyway ("non-fatal"), which contradicts the literal spec wording and is
  // exactly the same class of risk RULE IMP001 already guards against for the
  // Data Import Wizard (abort if the safety backup can't be created) — except
  // here the stakes are higher: a mid-migration failure with no backup can
  // leave a live production database corrupted with zero recovery path.
  if (applied.size > 0 && existsSync(dbPath)) {
    const backupsDir = join(app.getPath('userData'), 'backups')
    if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const dest = join(backupsDir, `pre-upgrade-${ts}.db`)
    try {
      copyFileSync(dbPath, dest)
      console.log(`[DB] Pre-upgrade backup saved: ${dest}`)
    } catch (err) {
      throw new Error(
        `Could not create the mandatory pre-upgrade backup (${(err as Error).message}). ` +
        `Aborting the upgrade to protect your existing data — no schema changes were made. ` +
        `Free up disk space / check permissions on ${backupsDir} and restart the app.`
      )
    }
  }

  // ── Apply pending migrations ─────────────────────────────────────────────────
  // Each migration's statements + its tracker row are applied in ONE transaction.
  // SQLite supports transactional DDL, so a failure partway through a migration
  // (disk full, malformed SQL, etc.) rolls back cleanly instead of leaving the
  // schema half-changed. Without this, a partial failure would leave some of a
  // migration's tables/columns created but its "_sarang_migrations" row never
  // inserted — every subsequent launch would see it as still-pending and
  // re-attempt the SAME statements, which now fail immediately with "table
  // already exists" / "duplicate column" — an app that can never start again,
  // with no in-app recovery path since it can't get far enough to show the
  // Backup/Restore screen.
  for (const dir of pending) {
    const sqlFile = join(migrationsDir, dir, 'migration.sql')
    const raw = readFileSync(sqlFile, 'utf-8')

    // Strip SQL line comments, split on semicolons, discard blank statements.
    // Prisma migration SQL is pure DDL (CREATE TABLE / CREATE INDEX) — no
    // semicolons inside string literals, so simple splitting is safe here.
    const statements = raw
      .replace(/--[^\n]*/g, '')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    console.log(`[DB] Applying migration: ${dir} (${statements.length} statements)`)

    // Prisma's interactive transactions default to a 5-second timeout — fine
    // for request-path transactions, but wrong here: this runs once at
    // startup, and a schema change on a database that's been in daily use for
    // years (e.g. an index rebuild, or an ALTER TABLE that SQLite implements
    // as a full table copy since its native ALTER support is limited) can
    // legitimately take longer than 5s. Without raising this, a slow-but-
    // otherwise-correct migration would fail on nothing but the clock, on
    // exactly the customers who have accumulated the most data to protect.
    await db.$transaction(async (tx) => {
      for (const stmt of statements) {
        await tx.$executeRawUnsafe(stmt)
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO "_sarang_migrations" ("name") VALUES (?)`,
        dir
      )
    }, { timeout: 5 * 60 * 1000, maxWait: 10 * 1000 })

    console.log(`[DB] Applied: ${dir}`)
  }
}

export async function closeDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}
