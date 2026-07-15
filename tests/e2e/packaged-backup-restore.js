/**
 * Exercises the real backup RESTORE path (not just create+validate) against
 * the packaged installed app — release checklist Section 7's Feature Smoke
 * Test names "Backup/Restore" as one item; create+validate was confirmed in
 * packaged-feature-smoke.js, restore specifically was not. Written
 * 2026-07-15.
 *
 * Flow: create a customer (call it "before"), create a backup, create a
 * SECOND customer ("after-backup"), restore the backup, confirm "before"
 * still exists and "after-backup" is GONE (proving restore actually
 * reverted state, not a no-op that just reports success).
 */
const { _electron } = require('playwright-core')
const { DatabaseSync } = require('node:sqlite')

const EXE_PATH = 'C:\\Users\\vishw\\AppData\\Local\\Programs\\Sarang Business OS Lite\\Sarang Business OS Lite.exe'
const ADMIN_PASSWORD = 'FreshInstall!2026Test'
const DB_PATH = 'C:\\Users\\vishw\\AppData\\Roaming\\sarang-business-os\\sarang.db'

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function log(name, ok, detail) {
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? ' — ' + detail : ''))
}

async function main() {
  const app = await _electron.launch({ executablePath: EXE_PATH })
  const results = []
  try {
    let page = await app.firstWindow()
    if (page.url().includes('splash.html')) {
      const p = app.waitForEvent('window')
      await page.waitForEvent('close').catch(() => {})
      page = await p
    }
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)
    await page.waitForFunction(() => !!window.api, { timeout: 15000 })
    for (let attempt = 0; attempt < 6; attempt++) {
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
      if (who?.success) break
      const userInput = page.locator('input[name="username"]')
      if (await userInput.count()) {
        await userInput.fill('admin')
        await page.locator('input[name="password"]').fill(ADMIN_PASSWORD)
        await page.locator('button[type="submit"]').click()
      }
      await page.waitForTimeout(1000)
    }
    const skipBackupBtn = page.getByRole('button', { name: 'Skip for now' })
    if (await skipBackupBtn.count()) { await skipBackupBtn.click(); await page.waitForTimeout(500) }

    // ── Setup: "before" customer, then a backup, then "after-backup" customer ──
    const beforeName = `E2E Restore Before ${Date.now()}`
    const afterName = `E2E Restore After ${Date.now()}`

    const beforeRes = await page.evaluate(async (name) => window.api.customers.create({
      customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
    }), beforeName)
    results.push(['before-customer-created', !!beforeRes?.success, JSON.stringify(beforeRes?.error || '')])

    const backupRes = await page.evaluate(async () => window.api.backup.create())
    results.push(['backup-created', !!backupRes?.success, JSON.stringify(backupRes?.error || backupRes?.data?.id)])
    const backupId = backupRes?.data?.id

    const afterRes = await page.evaluate(async (name) => window.api.customers.create({
      customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
    }), afterName)
    results.push(['after-backup-customer-created', !!afterRes?.success, JSON.stringify(afterRes?.error || '')])

    // Confirm both exist right before restoring.
    const beforeRestore = await page.evaluate(async (name) => window.api.customers.search(name), afterName)
    results.push(['after-backup-customer-visible-before-restore', (beforeRestore?.data || []).some(c => c.customerName === afterName)])

    // ── Restore ──────────────────────────────────────────────────────────
    // backup.service.ts's restoreBackup() intentionally calls app.relaunch()
    // + app.exit(0) on success -- a full process restart to cleanly
    // reconnect Prisma to the swapped DB file, not a bug. This Playwright
    // `page`/`app` handle becomes unusable the moment that happens (it's
    // tied to the OLD process), so the IPC call itself is expected to
    // throw/disconnect on success -- verify the OUTCOME via the DB file
    // directly afterward instead of trying to keep using this connection.
    if (backupId) {
      let restoreThrew = false
      try {
        await page.evaluate(async (id) => window.api.backup.restore({ backupId: id }), backupId)
      } catch (e) {
        restoreThrew = true
      }
      results.push(['restore-call-made-app-relaunch-as-expected', restoreThrew, restoreThrew ? 'connection dropped (expected -- app.relaunch() fired)' : 'call returned normally, unexpected'])

      // Give the relaunched process time to fully boot and write the DB.
      await sleep(5000)

      const db = new DatabaseSync(DB_PATH)
      try {
        const beforeRow = db.prepare('SELECT id FROM Customer WHERE customerName = ?').get(beforeName)
        results.push(['before-customer-survived-restore', !!beforeRow])
        const afterRow = db.prepare('SELECT id FROM Customer WHERE customerName = ?').get(afterName)
        results.push(['after-backup-customer-correctly-reverted', !afterRow, afterRow ? 'still present -- restore did not revert' : 'correctly absent'])
      } finally {
        db.close()
      }
    } else {
      results.push(['restore-succeeds', false, 'no backupId to restore'])
    }
  } catch (e) {
    results.push(['FATAL', false, String(e && e.message)])
  } finally {
    await app.close().catch(() => {})
  }

  let pass = 0
  for (const [name, ok, detail] of results) { log(name, ok, detail); if (ok) pass++ }
  console.log(`\nBACKUP RESTORE TEST: ${pass}/${results.length} passed`)
  process.exit(pass === results.length ? 0 : 1)
}

main()
