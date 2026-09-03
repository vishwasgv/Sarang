/**
 * Suite 99 — Coverage-gap closure (2026-09-03 full-codebase audit,
 * continuation of suites 03/15/95/96/97/98): backup.create, backup.validate,
 * and backup.delete had ZERO E2E coverage of any kind in the regular dev-mode
 * suite set (only exercised by the separate `packaged-*.js` scripts, which
 * require a built installer and run against the packaged app specifically).
 *
 * backup.restore / backup.restoreFromFile are DELIBERATELY NOT exercised
 * here — restoreBackup()/restoreBackupFromFile() both end by calling
 * `app.relaunch()` + `app.exit(0)` (confirmed in backup.service.ts and in
 * BackupScreen.tsx's own "if we reach here without app restart, something
 * went wrong" comment), which would kill the harness's `app` handle mid-run
 * and revert the shared dev database to an old backup's state — corrupting
 * every other suite that depends on it. That flow is correctly covered by
 * the standalone `packaged-backup-restore.js` / `packaged-corrupted-
 * backup.js` scripts instead, each with its own isolated app lifecycle.
 */
const h = require('../harness')

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  let newBackupId = null

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('backup-screen-loads-no-crash', async () => {
      await h.gotoHash(page, '#/backup')
      await page.waitForTimeout(700)
      r.log('backup-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let countBefore = 0
    let expectedCountAfterCreate = 0
    await r.step('create-backup-via-real-ui', async () => {
      const before = await page.evaluate(async () => window.api.backup.list())
      countBefore = (before?.data || []).length
      r.log('captured-backup-count-before', true, `count=${countBefore}`)

      await page.getByRole('button', { name: 'Create Backup', exact: true }).click()
      await page.waitForTimeout(2000) // real file I/O — zip + checksum a full DB copy
      r.log('create-backup-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('backup-persisted-and-listed', () => h.withDb((db) => {
      const rows = db.prepare('SELECT * FROM "Backup" ORDER BY backupDate DESC').all()
      // createBackup() applies a retention policy (default keep-10, real
      // Setting-configurable) that prunes the oldest backup once the count
      // would exceed it — this dev DB already sits at the default ceiling,
      // so a straight "+1" assertion is wrong whenever that's the case.
      // Compute the real expected count instead of assuming it.
      const retentionSetting = db.prepare("SELECT settingValue FROM Setting WHERE settingKey = 'backup_retention_count'").get()
      const keepCount = retentionSetting ? parseInt(retentionSetting.settingValue, 10) : 10
      expectedCountAfterCreate = Math.min(countBefore + 1, keepCount)
      r.log('backup-count-matches-retention-policy', rows.length === expectedCountAfterCreate, `before=${countBefore} keepCount=${keepCount} expected=${expectedCountAfterCreate} actual=${rows.length}`)
      if (rows.length > 0) {
        newBackupId = rows[0].id
        r.log('newest-backup-marked-valid', rows[0].isValid === 1, JSON.stringify(rows[0]))
      }
    }))

    await r.step('verify-backup-via-real-ui', async () => {
      if (!newBackupId) return r.log('skipped-no-backup-id', false)
      // The newest row is always first in the list (backupDate desc), so
      // target it positionally rather than fighting for a unique text match
      // on an auto-generated timestamped filename.
      const verifyBtn = page.locator('button[title="Verify backup"]').first()
      const visible = await verifyBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
      r.log('verify-button-visible', visible)
      await verifyBtn.click()
      await page.waitForTimeout(1200)
      r.log('verify-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('valid-toast-shown', /valid/i.test(bodyText))
    })

    await r.step('delete-backup-via-real-ui', async () => {
      if (!newBackupId) return r.log('skipped-no-backup-id', false)
      const deleteBtn = page.locator('button[title="Delete Backup"]').first()
      r.log('delete-button-visible', await deleteBtn.count() > 0)
      await deleteBtn.click()
      await page.waitForTimeout(400)
      const confirmModal = h.topModal(page)
      await confirmModal.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('backup-actually-deleted', () => h.withDb((db) => {
      if (!newBackupId) return r.log('skipped-no-backup-id', false)
      const row = db.prepare('SELECT * FROM "Backup" WHERE id = ?').get(newBackupId)
      r.log('backup-row-gone', !row, JSON.stringify(row))
    }))

    await r.step('backup-count-back-to-original', () => h.withDb((db) => {
      const rows = db.prepare('SELECT * FROM "Backup"').all()
      const expectedAfterDelete = expectedCountAfterCreate - 1
      r.log('backup-count-restored', rows.length === expectedAfterDelete, `expected=${expectedAfterDelete} actual=${rows.length}`)
    }))
  } catch (e) {
    r.log('FATAL', false, String((e && e.message) || e))
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    // Safety net only — the suite's own delete step above already removes
    // the backup it created under normal circumstances.
    if (newBackupId) {
      const cleaned = h.withDb((db) => {
        const row = db.prepare('SELECT * FROM "Backup" WHERE id = ?').get(newBackupId)
        if (row) db.prepare('DELETE FROM "Backup" WHERE id = ?').run(newBackupId)
        return !!row
      })
      console.log('backup-restore-screen safety-net cleanup ran:', cleaned)
    }
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBACKUP SCREEN: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
