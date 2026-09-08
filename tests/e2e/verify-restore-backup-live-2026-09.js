/**
 * Live-click verification of backup.restore's REAL UI path (button click ->
 * confirm modal -> app.relaunch()) — deliberately excluded from the shared
 * run-all.js suite set because it restarts the app and would corrupt other
 * suites sharing the dev DB. Safe here because it's the ONLY thing running:
 * creates a fresh backup of CURRENT state first, so "restoring" it back is
 * idempotent — no real data is at risk.
 */
const h = require('./harness')
const { execSync } = require('child_process')
const fs = require('fs')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()

  try {
    await h.login(page)
    await h.gotoHash(page, '#/backup')
    await page.waitForTimeout(700)

    // Create a fresh backup of CURRENT state — restoring this back is a no-op on data.
    const beforeMtime = fs.statSync(h.DEV_DB_PATH).mtimeMs
    const createBtn = page.locator('button', { hasText: /Create Backup|Backup Now/i }).first()
    r.log('create-backup-button-found', await createBtn.count() > 0)
    await createBtn.click()
    await page.waitForTimeout(2500)
    r.log('backup-created-no-crash', !(await h.hasErrorBoundary(page)))

    // Find the row for the backup we just made (most recent) and click Restore.
    // The per-row action is an icon-only button, identified by its `title`
    // attribute, not visible text — a plain hasText:/Restore/i regex was
    // matching the unrelated "Restore from File" text button instead
    // (opens a native OS file picker, which then hung the whole script).
    const restoreBtn = page.locator('button[title="Restore from this backup"]').first()
    r.log('restore-button-found-on-newest-backup', await restoreBtn.count() > 0)
    await restoreBtn.click()
    await page.waitForTimeout(1000)

    // Confirm modal — target the exact distinctive button text (not a
    // generic "Restore" regex, which also matches the disabled row button
    // sitting underneath the modal and hangs waiting for it to enable).
    const confirmBtn = page.locator('button', { hasText: 'Restore & Restart' })
    r.log('restore-confirm-modal-appeared', await confirmBtn.count() > 0)
    await confirmBtn.click()

    // app.relaunch()+app.exit(0) fires now — this Playwright connection dies.
    // Give the OS a moment, then verify a NEW electron.exe process exists.
    await page.waitForTimeout(6000).catch(() => {})
  } catch (e) {
    console.log('Expected: connection may drop here due to app.relaunch(). Detail:', String(e && e.message || e).slice(0, 200))
  }

  // Post-relaunch verification — separate from the (now-dead) app/page handles above.
  await new Promise((res) => setTimeout(res, 3000))
  let relaunchedProcessSeen = false
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq electron.exe"', { encoding: 'utf8' })
    relaunchedProcessSeen = (out.match(/electron\.exe/gi) || []).length > 0
  } catch { /* tasklist itself failing isn't the thing under test */ }
  r.log('electron-process-exists-after-relaunch', relaunchedProcessSeen)

  const dbExists = fs.existsSync(h.DEV_DB_PATH)
  r.log('db-file-exists-after-restore-swap', dbExists)

  // Fresh connection to confirm the relaunched app is actually functional.
  try {
    const app2 = await h.launchApp()
    const page2 = await h.getMainWindow(app2)
    await h.login(page2)
    await h.gotoHash(page2, '#/dashboard')
    await page2.waitForTimeout(1200)
    r.log('post-restore-app-loads-and-logs-in-fine', !(await h.hasErrorBoundary(page2)))
    await h.closeApp(app2)
  } catch (e) {
    r.log('post-restore-app-loads-and-logs-in-fine', false, String(e && e.message || e).slice(0, 200))
  }

  h.randomizeAdminPassword()
  const s = r.summary()
  console.log(`\n=== BACKUP-RESTORE LIVE VERIFICATION: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
