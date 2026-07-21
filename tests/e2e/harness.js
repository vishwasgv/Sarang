/**
 * Reusable Electron + Playwright driver for live UAT against the real
 * Sarang app (real Electron process, real SQLite, no mocks).
 *
 * Built in Phase 55 by distilling the patterns independently re-derived by
 * hand across ~10 prior phases' ad-hoc scratch UAT scripts (43, 49-54G) —
 * see project memory `project_electron_live_verification.md` for the
 * original gotcha writeups this file encodes. Node's native CommonJS
 * `require()` is used deliberately (not TS/ESM) — every one of those prior
 * scripts used exactly this shape and it has never failed; introducing a
 * new TS runtime (ts-node/tsx) for this file would add a fresh failure
 * surface for a test harness whose entire job is finding OTHER bugs.
 *
 * Usage: see tests/e2e/suites/*.js and tests/e2e/README.md.
 */

const { _electron } = require('playwright-core')
const { DatabaseSync } = require('node:sqlite')
const bcrypt = require('bcryptjs')
const path = require('path')
const crypto = require('crypto')

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const DEV_DB_PATH = path.join(PROJECT_ROOT, '.dev-data', 'sarang.db')
const SHOTS_DIR = path.join(__dirname, 'shots')
const ELECTRON_BIN = path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')

const UAT_PASSWORD = 'E2ESuite!Temp2026'

// ─── App lifecycle ──────────────────────────────────────────────────────────

async function launchApp() {
  return _electron.launch({ executablePath: ELECTRON_BIN, args: ['.'], cwd: PROJECT_ROOT })
}

// Gotcha 3 (project memory): the splash screen is `firstWindow()`, not the
// main app. It self-closes shortly after DOM load; waiting a fixed timeout
// on it throws "Target page... closed" instead. Race waitForEvent('window')
// against the splash's own close.
async function getMainWindow(app) {
  let page = await app.firstWindow()
  if (page.url().includes('splash.html')) {
    const mainPagePromise = app.waitForEvent('window')
    await page.waitForEvent('close').catch(() => {})
    page = await mainPagePromise
  }
  page.on('pageerror', (err) => console.log('[renderer pageerror]', err.message))
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1200)
  return page
}

async function closeApp(app) {
  await app.close().catch(() => {})
  // Windows doesn't always release process/file handles the instant
  // app.close() resolves — a short grace period avoids a follow-up DB
  // operation racing the OS's own cleanup.
  await new Promise((r) => setTimeout(r, 500))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Retries a fs op that can transiently EBUSY/EPERM on Windows right after a
// process exits, before the OS has fully released its file handle.
async function retryFsOp(fn, { attempts = 8, delayMs = 400 } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return fn()
    } catch (e) {
      lastErr = e
      if (e && (e.code === 'EBUSY' || e.code === 'EPERM')) {
        await sleep(delayMs)
        continue
      }
      throw e
    }
  }
  throw lastErr
}

// ─── Navigation ─────────────────────────────────────────────────────────────

// Gotcha 2: this app uses HashRouter. Plain history.pushState + a manual
// popstate event does NOT trigger react-router navigation. Only a real
// location.hash assignment (which fires a genuine hashchange) works.
async function gotoHash(page, hash) {
  await page.evaluate((h) => { window.location.hash = h }, hash)
  await page.waitForTimeout(800)
}

async function hasErrorBoundary(page) {
  const text = await page.locator('body').innerText().catch(() => '')
  return /Something went wrong/i.test(text)
}

async function shot(page, label) {
  const n = (shot._n = (shot._n || 0) + 1)
  await page.screenshot({ path: path.join(SHOTS_DIR, `${String(n).padStart(3, '0')}-${label}.png`) }).catch(() => {})
}

// ─── Auth ───────────────────────────────────────────────────────────────────

// Real race found live 2026-07-15 (Section 3 suite-12 work): window.api is
// injected by the preload script regardless of login state, so waiting on
// it alone doesn't confirm the main process actually registered the
// session (getCurrentSession()) before the caller's first IPC call fires.
// Reproduced 100% (3/3) as every IPC call in a run failing with AUTH-003,
// self-healing on a fresh relaunch+relogin — a real timing race, not app
// flakiness. Almost certainly also the cause of the "flaky" first-run
// failures seen earlier that session on suites 06 and 09 (both looked like
// cold-start jitter and self-resolved on a bare rerun, which is consistent
// with this same race resolving by luck). Poll the real session state and
// re-submit the form if needed, instead of trusting one fixed wait.
async function login(page, username = 'admin', password = UAT_PASSWORD) {
  await page.waitForFunction(() => !!window.api, { timeout: 15000 })
  for (let attempt = 0; attempt < 5; attempt++) {
    const who = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
    if (who?.success) {
      await dismissBackupPrompt(page)
      return
    }
    const userInput = page.locator('input[name="username"]')
    if (await userInput.count()) {
      await userInput.fill(username)
      await page.locator('input[name="password"]').fill(password)
      await page.locator('button[type="submit"]').click()
    }
    await page.waitForTimeout(1500)
  }
}

// One-time first-run "choose a backup folder" screen (gated on the
// `backup_prompt_dismissed` Setting row) blocks the whole app behind itself
// until dismissed — real gotcha hit 2026-07-16 when a suite run found the
// dev DB missing that row and every subsequent selector timed out with no
// useful error. "Skip for now" is a real, supported user action (not a
// test-only bypass), so clicking it here just clears the same one-time
// prompt a human would dismiss on first launch.
async function dismissBackupPrompt(page) {
  const skipBtn = page.locator('button', { hasText: 'Skip for now' })
  if (await skipBtn.count().catch(() => 0)) {
    await skipBtn.click().catch(() => {})
    await page.waitForTimeout(400)
  }
}

function withDb(fn) {
  const db = new DatabaseSync(DEV_DB_PATH)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

// Sets the admin user's password to a known value for the duration of a
// suite run — never leave this as the final state (see
// randomizeAdminPassword). bcryptjs at 12 rounds matches auth.service.ts.
function resetAdminPasswordForSuite(username = 'admin') {
  return withDb((db) => {
    const hash = bcrypt.hashSync(UAT_PASSWORD, 12)
    db.prepare('UPDATE User SET passwordHash = ? WHERE username = ?').run(hash, username)
  })
}

// Must be called at the end of every suite run, success or failure, so no
// UAT credential lingers in a database that could be the founder's real one.
function randomizeAdminPassword(username = 'admin') {
  return withDb((db) => {
    const randomPw = crypto.randomBytes(24).toString('base64')
    const hash = bcrypt.hashSync(randomPw, 12)
    db.prepare('UPDATE User SET passwordHash = ? WHERE username = ?').run(hash, username)
  })
}

// ─── DB cleanup ─────────────────────────────────────────────────────────────
// Originally this harness did a whole-file snapshot/restore of sarang.db
// around each suite (back it up, let the suite mutate freely, overwrite it
// back afterward). That turned out to be UNSAFE, not just inconvenient, and
// was replaced with targeted per-suite row cleanup instead — see
// PHASE_55_COMPLETION_REPORT.md for the full writeup:
//
// `electron-vite dev` always auto-opens its own Electron window in addition
// to whichever window(s) a suite's own `_electron.launch()` spawns — so
// there is a SECOND, long-lived Prisma connection to the same sarang.db for
// the entire time the dev server is up, not just for the duration of one
// suite. SQLite WAL mode means recent writes live in a `sarang.db-wal`
// sidecar until checkpointed; deleting/replacing the main `.db` file while
// that second connection still has the WAL file open doesn't just fail
// (EBUSY, confirmed — retrying doesn't help, since the lock is held for as
// long as the dev window is open, not transiently), it risks silent
// corruption if it half-succeeds, because the live connection's WAL entries
// are keyed to the OLD file's page layout. File-level swap is only safe
// with zero other live connections — a stronger guarantee than a normal
// `npm run test:e2e` run (against an already-running dev server) can make.
//
// Row-level cleanup instead goes through the same live WAL-journal
// mechanism every other write in the app uses, correctly, regardless of how
// many connections are open — the same reason this exact pattern is what
// every prior phase's ad-hoc UAT script has always used successfully.

function checkpointWal() {
  return withDb((db) => { db.exec('PRAGMA wal_checkpoint(TRUNCATE);') })
}

// Deletes every Customer/Product (and their dependent Invoice/InvoiceItem/
// Payment/CustomerLedger/Inventory/RentalBooking/RentalUnit rows) whose
// name starts with `prefix`. Products/Customers that still have other FK
// dependents this function doesn't know about (e.g. a AuditLog reference)
// are soft-deactivated (`isActive: 0`) instead of hard-deleted, matching
// the convention every phase's manual cleanup has used — never leave a
// throwing cleanup step, prefer "hidden but present" over "crashed".
function cleanupByNamePrefix(prefix) {
  return withDb((db) => {
    const like = `${prefix}%`
    const custIds = db.prepare('SELECT id FROM Customer WHERE customerName LIKE ?').all(like).map((r) => r.id)
    const prodIds = db.prepare('SELECT id FROM Product WHERE productName LIKE ?').all(like).map((r) => r.id)

    const invIds = new Set()
    for (const pid of prodIds) {
      for (const row of db.prepare('SELECT invoiceId FROM InvoiceItem WHERE productId = ?').all(pid)) {
        if (row.invoiceId) invIds.add(row.invoiceId)
      }
    }
    for (const cid of custIds) {
      for (const row of db.prepare('SELECT id FROM Invoice WHERE customerId = ?').all(cid)) invIds.add(row.id)
    }

    for (const invId of invIds) {
      db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(invId)
      db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(invId)
      try { db.prepare('DELETE FROM Invoice WHERE id = ?').run(invId) } catch { /* other FK dependents — leave the invoice, its items are already gone */ }
    }
    for (const cid of custIds) {
      db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
      // Real bug found 2026-07-13 (live investigation into a 3-way
      // outstanding-balance discrepancy): the soft-delete fallback used to
      // leave `outstandingBalance` untouched even though the customer's
      // CustomerLedger rows (which the column is supposed to mirror) were
      // just deleted above — a soft-deleted customer with a nonzero stale
      // balance and zero backing ledger history. Confirmed as the root
      // cause for 2 of 3 stale customers found in the dev DB. Reset it in
      // both branches, not just the soft-delete one, since a hard delete
      // removes the row and can't leave a stale value, but a fallback that
      // ever changes shape shouldn't silently reintroduce this.
      try { db.prepare('DELETE FROM Customer WHERE id = ?').run(cid) } catch { db.prepare('UPDATE Customer SET isActive = 0, outstandingBalance = 0 WHERE id = ?').run(cid) }
    }
    for (const pid of prodIds) {
      db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
      try { db.prepare('DELETE FROM Product WHERE id = ?').run(pid) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
    }

    return { invoicesRemoved: invIds.size, customersHandled: custIds.length, productsHandled: prodIds.length }
  })
}

function getBusinessType() {
  return withDb((db) => db.prepare('SELECT businessType FROM BusinessProfile LIMIT 1').get()?.businessType)
}

// ─── Business type switching (via the real UI, not raw IPC) ────────────────
// Gotcha 4: calling window.api.industry.changeBusinessType() directly flips
// the DB correctly but leaves the renderer's Zustand industry store stale
// (sidebar/module gates keep showing the old vertical). Driving the real
// Settings screen avoids this — its own store wrapper action handles the
// refresh, matching what a real user actually does.
async function switchBusinessType(page, tileLabel) {
  await gotoHash(page, '#/settings/industry')
  await page.waitForTimeout(600)
  const current = await getBusinessType()
  const tile = page.locator(`button:has-text("${tileLabel}")`).first()
  if ((await tile.count()) === 0) throw new Error(`No industry tile found for label "${tileLabel}"`)
  await tile.click()
  await page.waitForTimeout(300)
  const applyBtn = page.locator('button:has-text("Apply Template")')
  const disabled = await applyBtn.isDisabled().catch(() => true)
  if (disabled) {
    // Already on this business type (tile click was a no-op) — nothing to apply.
    return { changed: false, from: current, to: current }
  }
  await applyBtn.click()
  // 2026-07-21: Apply Template now opens a confirmation dialog first
  // (IndustrySettingsScreen.tsx's ConfirmDialog) instead of saving
  // immediately — click through it the same way a real user would.
  await page.waitForTimeout(300)
  await page.locator('button:has-text("Switch Business")').click()
  await page.waitForTimeout(1500)
  const after = await getBusinessType()
  return { changed: true, from: current, to: after }
}

// ─── Modal helpers ──────────────────────────────────────────────────────────

function topModal(page) {
  return page.locator('div.fixed.inset-0').last()
}

async function closeTopModal(page) {
  await topModal(page).locator('button').first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(400)
}

function fmtLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ─── Result collection (shared shape across every suite) ───────────────────

function makeResults() {
  const results = []
  return {
    log(name, ok, detail) {
      results.push({ name, ok, detail: detail || '' })
      console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? ' — ' + detail : ''))
    },
    async step(name, fn) {
      try {
        await fn()
      } catch (e) {
        this.log(name + ' [THREW]', false, String((e && e.message) || e).slice(0, 300))
      }
    },
    all: results,
    summary() {
      const fail = results.filter((r) => !r.ok).length
      return { total: results.length, fail, pass: results.length - fail }
    },
  }
}

module.exports = {
  PROJECT_ROOT, DEV_DB_PATH, SHOTS_DIR, UAT_PASSWORD,
  launchApp, getMainWindow, closeApp,
  gotoHash, hasErrorBoundary, shot,
  login, withDb, resetAdminPasswordForSuite, randomizeAdminPassword,
  checkpointWal, cleanupByNamePrefix, getBusinessType,
  switchBusinessType, topModal, closeTopModal, fmtLocalDateTime,
  makeResults, retryFsOp, sleep,
}
