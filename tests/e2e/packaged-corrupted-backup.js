/**
 * Confirms a corrupted/truncated backup file fails restore cleanly with a
 * real error, and does NOT silently partial-restore the live database.
 * Release checklist Section 2 (Migrations/Backup).
 */
const { _electron } = require('playwright-core')
const fs = require('fs')

const EXE_PATH = 'C:\\Users\\vishw\\AppData\\Local\\Programs\\Sarang Business OS Lite\\Sarang Business OS Lite.exe'
const ADMIN_PASSWORD = 'FreshInstall!2026Test'

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
    for (let i = 0; i < 6; i++) {
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
      if (who?.success) break
      const u = page.locator('input[name="username"]')
      if (await u.count()) {
        await u.fill('admin')
        await page.locator('input[name="password"]').fill(ADMIN_PASSWORD)
        await page.locator('button[type="submit"]').click()
      }
      await page.waitForTimeout(1000)
    }
    const skipBtn = page.getByRole('button', { name: 'Skip for now' })
    if (await skipBtn.count()) { await skipBtn.click(); await page.waitForTimeout(500) }

    // Marker customer to confirm the DB is genuinely untouched afterward.
    const markerName = `Corrupted Backup Marker ${Date.now()}`
    const markerRes = await page.evaluate((name) => window.api.customers.create({
      customerName: name, phone: String(Date.now()).slice(-10),
    }), markerName)
    results.push(['marker-customer-created', !!markerRes?.success])

    const backupRes = await page.evaluate(() => window.api.backup.create())
    results.push(['real-backup-created', !!backupRes?.success, JSON.stringify(backupRes?.error || backupRes?.data?.id)])
    const backupId = backupRes?.data?.id
    const backupPath = backupRes?.data?.backupPath

    if (backupPath && fs.existsSync(backupPath)) {
      // Truncate the real backup file's bytes in place -- corrupts both the
      // ZIP structure and invalidates the stored checksum.
      const original = fs.readFileSync(backupPath)
      fs.writeFileSync(backupPath, original.subarray(0, Math.floor(original.length / 2)))
      results.push(['backup-file-truncated-on-disk', true, `${original.length} -> ${Math.floor(original.length / 2)} bytes`])

      const restoreRes = await page.evaluate((id) => window.api.backup.restore({ backupId: id }), backupId)
      results.push(['corrupted-restore-rejected-with-clear-error', restoreRes?.success === false && !!restoreRes?.error?.code, JSON.stringify(restoreRes?.error || restoreRes)])

      // Confirm the app is STILL RESPONSIVE (didn't crash) and the marker
      // customer is STILL PRESENT (no partial/silent restore occurred).
      const stillUp = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
      results.push(['app-still-responsive-after-failed-restore', !!stillUp?.success])

      const markerCheck = await page.evaluate((name) => window.api.customers.search(name), markerName)
      const markerStillThere = (markerCheck?.data || []).some((c) => c.customerName === markerName)
      results.push(['no-silent-partial-restore-marker-data-intact', markerStillThere])
    } else {
      results.push(['backup-file-exists-on-disk', false, JSON.stringify(backupRes)])
    }
  } catch (e) {
    results.push(['FATAL', false, String(e && e.message)])
  } finally {
    await app.close().catch(() => {})
  }

  let pass = 0
  for (const [name, ok, detail] of results) { log(name, ok, detail); if (ok) pass++ }
  console.log(`\nCORRUPTED BACKUP TEST: ${pass}/${results.length} passed`)
  process.exit(pass === results.length ? 0 : 1)
}

main()
