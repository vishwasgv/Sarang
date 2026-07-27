import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { randomBytes } from 'crypto'
import { getPrisma, closeDatabase } from '../database/db'
import { logger } from '../utils/logger'
import type { ApiResponse } from '../ipc/channels'

// ─────────────────────────────────────────────────────────────────────────
// Phase 60 — Interactive Onboarding Tutorial. See
// PHASE_60_TUTORIAL_MASTER_PROMPT.md (repo root, one level up from
// sarang-business-os) for the full design this implements.
//
// Core idea: the tutorial is the REAL app, completely unmodified, pointed at
// a separate, disposable database file instead of the real one — every
// screen/button/form the user touches during the tutorial is genuine, so
// nothing about billing.service.ts/inventory.service.ts/etc. needed to
// change to support "fill in a real form but don't save it." Entering and
// exiting both go through a full app relaunch (app.relaunch() + app.exit()),
// the exact same mechanism backup.service.ts's restoreBackup() already uses
// to safely reconnect Prisma to a different database file — not a new,
// unproven trick.
// ─────────────────────────────────────────────────────────────────────────

// A relaunch caused by startTutorial()/exitTutorial() looks IDENTICAL on disk
// to a user manually reopening the app after an earlier crash mid-tutorial —
// both see the flag file + tutorial.db present at boot. This age threshold
// disambiguates them: a fresh (just-relaunched) session is picked back up
// normally; anything older is treated as abandoned/crashed and cleaned up so
// the user lands back in their real app, not a stale demo they may have
// forgotten about. See PHASE_60 doc Section 2.5.
const TUTORIAL_FLAG_MAX_AGE_MS = 5 * 60 * 1000

export interface TutorialFlag {
  startedAt: string
  businessType: string
  adminUsername: string
  adminPassword: string
}

function tutorialBaseDir(): string {
  return app.isPackaged ? app.getPath('userData') : join(process.cwd(), '.dev-data')
}

export function getTutorialDbPath(): string {
  return join(tutorialBaseDir(), 'tutorial.db')
}

function getTutorialFlagPath(): string {
  return join(tutorialBaseDir(), 'tutorial-session.json')
}

function deleteTutorialArtifacts(): void {
  const dbPath = getTutorialDbPath()
  for (const suffix of ['', '-wal', '-shm']) {
    try { if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix) } catch { /* best-effort cleanup only */ }
  }
  try { if (existsSync(getTutorialFlagPath())) unlinkSync(getTutorialFlagPath()) } catch { /* best-effort cleanup only */ }
}

/**
 * Called once, at the very top of app startup, before any database
 * connection exists — this is deliberately filesystem-only (no Prisma), so
 * there's no chicken-and-egg problem of needing a database connection to
 * decide which database to connect to. Returns the flag (boot into
 * tutorial.db) or null (boot normally), cleaning up any stale/corrupt state
 * along the way.
 */
export function resolveTutorialBoot(): TutorialFlag | null {
  const flagPath = getTutorialFlagPath()
  if (!existsSync(flagPath)) return null

  let flag: TutorialFlag
  try {
    flag = JSON.parse(readFileSync(flagPath, 'utf-8'))
  } catch {
    logger.warn('[Tutorial] Corrupt tutorial-session.json — cleaning up, booting normally.')
    deleteTutorialArtifacts()
    return null
  }

  const age = Date.now() - new Date(flag.startedAt).getTime()
  if (!Number.isFinite(age) || age > TUTORIAL_FLAG_MAX_AGE_MS || age < -60_000) {
    logger.info('[Tutorial] Stale or malformed tutorial session — cleaning up, booting normally.')
    deleteTutorialArtifacts()
    return null
  }

  // Deliberately no "does tutorial.db already exist?" check here — a fresh
  // session's flag is written (by startTutorial(), just before app.relaunch())
  // BEFORE tutorial.db exists at all; initializeDatabase() creates it fresh
  // on THIS boot, after this function returns. Requiring the db file to
  // pre-exist here was a real bug (found live 2026-07-28): it fired on every
  // single fresh tutorial start, not just genuine crash/orphan cases,
  // silently falling back to a normal boot every time.
  return flag
}

export function isTutorialModeActive(): boolean {
  return existsSync(getTutorialFlagPath())
}

/** Seeds a small amount of realistic demo data so forms aren't empty during the walkthrough. Idempotent-ish: only ever called once, right after a fresh tutorial.db's completeSetup(). */
export async function seedTutorialDemoData(): Promise<void> {
  const db = getPrisma()
  await db.customer.create({
    data: { customerName: 'Demo Customer', phone: '9999999999', email: 'demo@example.com' }
  })
  await db.product.create({
    data: {
      productName: 'Demo Product', sku: 'DEMO-001', sellingPrice: 199, costPrice: 120,
      taxRate: 18, unit: 'PCS', productType: 'STANDARD', isActive: true,
      inventory: { create: { quantity: 25 } }
    }
  })
}

/** Starts a tutorial session for the given business type and relaunches the app into it. Never actually returns on success — app.exit(0) terminates the process first. */
export async function startTutorial(businessType: string): Promise<ApiResponse> {
  try {
    deleteTutorialArtifacts() // always begin from a genuinely clean slate
    const flag: TutorialFlag = {
      startedAt: new Date().toISOString(),
      businessType,
      // Randomly generated, throwaway, never shown to the user — only ever
      // valid inside a disposable database that gets deleted on exit.
      adminUsername: `tutorial_${randomBytes(4).toString('hex')}`,
      adminPassword: randomBytes(16).toString('hex')
    }
    writeFileSync(getTutorialFlagPath(), JSON.stringify(flag), 'utf-8')
    app.relaunch()
    app.exit(0)
    return { success: true }
  } catch (err) {
    logger.error('[Tutorial] startTutorial failed:', err)
    return { success: false, error: { code: 'TUT-001', message: 'Could not start the tutorial. Please try again.' } }
  }
}

/** Exits an active tutorial session, discards tutorial.db, and relaunches back into the real app. */
export async function exitTutorial(): Promise<ApiResponse> {
  try {
    await closeDatabase() // disconnect Prisma from tutorial.db before deleting it — an open SQLite file can't be safely removed on Windows
    deleteTutorialArtifacts()
    app.relaunch()
    app.exit(0)
    return { success: true }
  } catch (err) {
    logger.error('[Tutorial] exitTutorial failed:', err)
    return { success: false, error: { code: 'TUT-002', message: 'Could not exit the tutorial. Please try again.' } }
  }
}
