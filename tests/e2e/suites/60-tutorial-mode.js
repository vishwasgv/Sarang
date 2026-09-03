/**
 * Phase 60 — Interactive Onboarding Tutorial: live verification.
 *
 * Section 7 of PHASE_60_TUTORIAL_MASTER_PROMPT.md calls for two things a
 * unit test (mocked fs/electron) can't actually prove: that a real tutorial
 * run creates ZERO rows in the real database, and that a crash mid-tutorial
 * self-heals on the next normal launch. Both are exercised here against the
 * real compiled app (dev mode, out/main built via `npm run build`), not a
 * mock — same "verify the outcome via the DB file directly, don't try to
 * keep driving the relaunched process with the old Playwright handle" style
 * already proven in packaged-backup-restore.js for the identical
 * app.relaunch()+app.exit() mechanism.
 */
const { execSync, spawn } = require('child_process')
const { DatabaseSync } = require('node:sqlite')
const http = require('http')
const path = require('path')
const fs = require('fs')
const {
  PROJECT_ROOT, launchApp, getMainWindow, closeApp, login,
  withDb, resetAdminPasswordForSuite, randomizeAdminPassword,
  makeResults, sleep,
} = require('../harness')

const TUTORIAL_DB_PATH = path.join(PROJECT_ROOT, '.dev-data', 'tutorial.db')
const TUTORIAL_FLAG_PATH = path.join(PROJECT_ROOT, '.dev-data', 'tutorial-session.json')

// A pre-existing, general dev-server-connection race (not specific to this
// suite): a freshly-launched Electron window's very first loadURL() to the
// already-running Vite dev server occasionally hits ERR_CONNECTION_REFUSED
// before the dev server accepts the new connection, leaving the window
// stuck on chrome-error://chromewebdata/ with no automatic retry anywhere
// in main/index.ts. Confirmed live (2026-07-28) via a throwaway diagnostic
// script: identical launch code succeeded on one run and hit this on
// another, back to back, with the dev server verifiably already up both
// times. A plain page.reload() recovers it once the server is ready.
async function ensureRealPageLoaded(page, { attempts = 5, delayMs = 1500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (!page.url().startsWith('chrome-error://')) return true
    await sleep(delayMs)
    await page.reload().catch(() => {})
    await page.waitForTimeout(500)
  }
  return !page.url().startsWith('chrome-error://')
}

function isDevServerUp() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173/', { timeout: 1500 }, (res) => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

// The crash-recovery step below deliberately force-kills every electron.exe
// on the machine to simulate a real crash — in this dev-mode environment
// that also takes down the `npm run dev` companion window this suite
// relies on for ITS OWN subsequent launchApp() call (a test-harness
// limitation, not a product bug — a packaged build has no such dependency
// at all). Restart it here so the post-crash verification below actually
// gets a real page to check, rather than leaving that check unprovable.
async function ensureDevServerRunning() {
  if (await isDevServerUp()) return
  const child = spawn('npm run dev', { cwd: PROJECT_ROOT, detached: true, stdio: 'ignore', shell: true })
  child.unref()
  for (let i = 0; i < 30; i++) {
    if (await isDevServerUp()) return
    await sleep(1000)
  }
}

function tutorialArtifactsExist() {
  return fs.existsSync(TUTORIAL_DB_PATH) || fs.existsSync(TUTORIAL_FLAG_PATH)
}

function countRows(dbPath, table) {
  const db = new DatabaseSync(dbPath)
  try {
    return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c
  } finally {
    db.close()
  }
}

async function waitFor(predicate, { timeoutMs = 20000, intervalMs = 500 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true
    await sleep(intervalMs)
  }
  return predicate()
}

async function main() {
  const results = makeResults()
  resetAdminPasswordForSuite()
  // Only true once the crash-recovery step below has actually force-killed
  // electron.exe — gates the "belt-and-suspenders" cleanup kill in finally{}
  // so a normal run (or one that fails before reaching that step) never
  // touches electron.exe at all. Killing it unconditionally was a real bug
  // found live (2026-07-28): it also kills whatever OTHER electron.exe is
  // running under that same generic process name — in this environment,
  // this suite's own `npm run dev` companion window — taking the whole dev
  // server down with it, well beyond this suite's own spawned instance.
  let reachedCrashTest = false

  // Clean slate — a leftover tutorial.db/flag from a prior interrupted run
  // would invalidate the "zero real rows" comparison below.
  if (tutorialArtifactsExist()) {
    results.log('pre-clean-leftover-tutorial-artifacts', true, 'removing stale tutorial.db/flag from a prior run before starting')
    try { fs.unlinkSync(TUTORIAL_DB_PATH) } catch { /* ignore */ }
    try { fs.unlinkSync(TUTORIAL_FLAG_PATH) } catch { /* ignore */ }
  }

  let app = await launchApp()
  try {
    let page = await getMainWindow(app)
    const loaded = await ensureRealPageLoaded(page)
    results.log('initial-app-window-loaded', loaded, loaded ? '' : `stuck at ${page.url()}`)
    await login(page)

    const realCustomersBefore = withDb((db) => db.prepare('SELECT COUNT(*) as c FROM Customer').get().c)
    const realProductsBefore = withDb((db) => db.prepare('SELECT COUNT(*) as c FROM Product').get().c)

    // ── Start a tutorial session ────────────────────────────────────────
    let startThrew = false
    try {
      await page.evaluate(() => window.api.tutorial.start({ businessType: 'RETAIL' }))
    } catch {
      startThrew = true
    }
    results.log('tutorial-start-triggered-relaunch', startThrew, startThrew ? 'connection dropped (expected — app.relaunch() fired)' : 'call returned normally, unexpected')

    // The relaunched process needs to: reconnect Prisma to tutorial.db,
    // force-apply every migration fresh, seed demo data, then auto-login —
    // meaningfully more startup work than a plain backup restore, so poll
    // rather than a single fixed sleep.
    const dbAppeared = await waitFor(() => fs.existsSync(TUTORIAL_DB_PATH) && fs.existsSync(TUTORIAL_FLAG_PATH), { timeoutMs: 25000 })
    results.log('tutorial-db-and-flag-created', dbAppeared)

    if (dbAppeared) {
      // Give seedTutorialDemoData a further moment past file-creation to finish writing rows.
      await sleep(2000)

      const flag = JSON.parse(fs.readFileSync(TUTORIAL_FLAG_PATH, 'utf-8'))
      results.log('flag-records-correct-business-type', flag.businessType === 'RETAIL', flag.businessType)

      let tutorialCustomers = -1, tutorialProducts = -1
      await waitFor(() => {
        try {
          tutorialCustomers = countRows(TUTORIAL_DB_PATH, 'Customer')
          tutorialProducts = countRows(TUTORIAL_DB_PATH, 'Product')
          return tutorialCustomers >= 1 && tutorialProducts >= 1
        } catch {
          return false // migrations may not have created the table yet
        }
      }, { timeoutMs: 15000 })
      results.log('tutorial-db-seeded-with-demo-customer', tutorialCustomers === 1, `count=${tutorialCustomers}`)
      results.log('tutorial-db-seeded-with-demo-product', tutorialProducts === 1, `count=${tutorialProducts}`)

      // ── The core safety guarantee: the REAL database is untouched ──────
      const realCustomersAfter = withDb((db) => db.prepare('SELECT COUNT(*) as c FROM Customer').get().c)
      const realProductsAfter = withDb((db) => db.prepare('SELECT COUNT(*) as c FROM Product').get().c)
      results.log('real-db-customer-count-unchanged', realCustomersAfter === realCustomersBefore, `before=${realCustomersBefore} after=${realCustomersAfter}`)
      results.log('real-db-product-count-unchanged', realProductsAfter === realProductsBefore, `before=${realProductsBefore} after=${realProductsAfter}`)

      // ── Crash-recovery: back-date the flag past the 5-minute staleness
      // threshold (simulating "the app was killed a while ago and the user
      // is only now reopening it"), forcibly end the tutorial-mode process
      // (a real kill, not a graceful exit — that's the actual crash being
      // simulated), then confirm a fresh normal launch self-heals. ────────
      const staleFlag = { ...flag, startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() }
      fs.writeFileSync(TUTORIAL_FLAG_PATH, JSON.stringify(staleFlag), 'utf-8')

      reachedCrashTest = true
      try { execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' }) } catch { /* no matching process is fine */ }
      await sleep(1500)
      await ensureDevServerRunning()

      app = await launchApp()
      page = await getMainWindow(app)
      const reloadedOk = await ensureRealPageLoaded(page)
      results.log('post-crash-app-window-loaded', reloadedOk, reloadedOk ? '' : `stuck at ${page.url()}`)

      const cleanedUp = await waitFor(() => !fs.existsSync(TUTORIAL_DB_PATH) && !fs.existsSync(TUTORIAL_FLAG_PATH), { timeoutMs: 20000 })
      results.log('crash-recovery-cleans-up-stale-tutorial-artifacts', cleanedUp)

      // Confirm the fresh launch actually reached the real app (login
      // screen or an already-active real session), not stuck on a broken
      // tutorial half-state.
      await page.waitForFunction(() => !!window.api, { timeout: 15000 }).catch(() => {})
      const reachedRealApp = await page.evaluate(() => window.api.auth.getCurrentUser().then((r) => r.success).catch(() => false))
        .catch(() => false)
      const loginFormVisible = await page.locator('input[name="username"]').count().catch(() => 0)
      results.log('post-crash-launch-reaches-real-app-not-stuck', reachedRealApp || loginFormVisible > 0, `sessionActive=${reachedRealApp} loginFormVisible=${loginFormVisible > 0}`)

      const realCustomersFinal = withDb((db) => db.prepare('SELECT COUNT(*) as c FROM Customer').get().c)
      results.log('real-db-still-unchanged-after-crash-recovery', realCustomersFinal === realCustomersBefore, `before=${realCustomersBefore} final=${realCustomersFinal}`)
    }
  } catch (e) {
    results.log('FATAL', false, String((e && e.message) || e))
  } finally {
    await closeApp(app).catch(() => {})
    // Belt-and-suspenders — only if the crash-recovery step actually ran
    // (see the comment on reachedCrashTest above for why this must stay
    // conditional rather than unconditional cleanup).
    if (reachedCrashTest) {
      try { execSync('taskkill /F /IM electron.exe /T', { stdio: 'ignore' }) } catch { /* none left is fine */ }
    }
    try { if (fs.existsSync(TUTORIAL_DB_PATH)) fs.unlinkSync(TUTORIAL_DB_PATH) } catch { /* best-effort */ }
    try { if (fs.existsSync(TUTORIAL_FLAG_PATH)) fs.unlinkSync(TUTORIAL_FLAG_PATH) } catch { /* best-effort */ }
    randomizeAdminPassword()
  }

  const { total, pass, fail } = results.summary()
  console.log(`\nPHASE 60 TUTORIAL MODE: ${pass}/${total} passed`)
  process.exit(fail === 0 ? 0 : 1)
}

// Real bug found live (2026-09-03, full-suite run): with no guard here,
// merely `require()`-ing this file — which is exactly what run-all.js does
// for every suite, including this "standalone-only, run-all.js skips it"
// one — was enough to kick off this whole main() in the background
// regardless. run-all.js's own SKIPPED message (see its comment on
// `typeof suite.run !== 'function'`) only stops it from WAITING for or
// recording this suite; it does nothing to stop the suite from actually
// running. The result: this suite's machine-wide `taskkill /F /IM
// electron.exe /T` calls fired while suites 61+ were still using their own
// electron.exe windows (killing them out from under those suites), and this
// suite's own process.exit() eventually tore down the entire run-all.js
// process outright, mid-suite, with none of the later suites' results ever
// recorded. Guarding on require.main is the same convention every other
// suite file in this directory already uses, for exactly this reason.
if (require.main === module) {
  main()
}
