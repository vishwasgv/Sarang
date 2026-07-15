/**
 * Suite 6 — Trust & compliance (Phase 54F, F.15/F.16/F.17). Password
 * policy rejection, audit-log hash-chain verification, one payroll
 * generation pass, and both new GST reports (HSN Summary, GSTR-3B
 * Reconciliation Preview) rendering real data.
 *
 * Scope note (deliberate): does NOT cover AuditLog retention pruning
 * (`pruneOldAuditLogs`) — it only runs at app launch with no manual
 * trigger/IPC hook, so testing it deterministically needs a full app
 * relaunch mid-suite, which isn't worth the added complexity for this
 * exemplar pass. If a future session wants it: set
 * `audit_log_retention_days` very low, relaunch the app (closeApp + a
 * fresh launchApp), then confirm old AuditLog rows are gone via
 * `window.api.audit.list(...)`.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Trust'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('password-policy-rejects-too-short-password', async () => {
      // Server-side check (VAL-001), independent of the Add-User modal's
      // own stale hardcoded "6 characters" client-side gate — call the API
      // the modal itself calls, with a password shorter than the live
      // password_min_length Setting (10) but longer than the modal's own
      // stale client check (6), to specifically exercise the server-side
      // enforcement path (checkPasswordLength) rather than getting blocked
      // client-side before the real check even runs.
      const rolesRes = await page.evaluate(async () => window.api.roles.list())
      const roles = rolesRes?.data || []
      // Real bug found+fixed 2026-07-15: this used to filter on `rl.name`,
      // but the actual Prisma Role field is `roleName` — the filter always
      // silently missed and fell through to the `|| roles[0]` fallback,
      // so this "found the Staff role" check never actually verified that.
      const staffRole = roles.find((rl) => /staff/i.test(rl.roleName)) || roles[0]
      r.log('real-role-available-for-test', !!staffRole, JSON.stringify(staffRole?.roleName))

      const res = await page.evaluate(async (roleId) => window.api.users.create({
        fullName: 'E2E Trust Weak Pw User', username: `e2etrust${Date.now()}`,
        password: 'short7c', roleId,
      }), staffRole?.id)
      r.log('short-password-rejected-server-side', res?.success === false && res?.error?.code === 'VAL-001', JSON.stringify(res?.error || res))
    })

    await r.step('audit-log-hash-chain-verifies-clean', async () => {
      await h.gotoHash(page, '#/audit')
      await page.waitForTimeout(700)
      r.log('audit-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      await page.getByRole('button', { name: 'Verify Integrity' }).click()
      await page.waitForTimeout(1500)
      const bodyText = await page.locator('body').innerText()
      r.log('audit-chain-reports-intact', /chain/i.test(bodyText) && !/broken/i.test(bodyText))
      await h.shot(page, 'audit-verify')

      // Also confirm via the raw IPC result directly (the UI text depends
      // on i18n interpolation which is fragile to assert against exactly).
      const chainRes = await page.evaluate(async () => window.api.audit.verifyChain())
      r.log('audit-chain-api-reports-ok', chainRes?.success === true && chainRes?.data?.ok === true, JSON.stringify(chainRes?.data || chainRes))
    })

    await r.step('payroll-generation-runs-without-crashing', async () => {
      await h.gotoHash(page, '#/hr/payroll')
      await page.waitForTimeout(700)
      r.log('payroll-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      const genBtn = page.getByRole('button', { name: /Generate Payroll/i })
      if (await genBtn.count()) {
        await genBtn.click()
        await page.waitForTimeout(1500)
        r.log('payroll-generated-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'payroll-generated')
      } else {
        r.log('generate-payroll-button-present', false, 'not visible — may lack hr.manage or no employees with salary configured')
      }
    })

    await r.step('hsn-summary-report-renders', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'HSN-Wise Summary' }).first()
      r.log('hsn-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const dateInputs = page.locator('input[type="date"]')
        const from = new Date(Date.now() - 30 * 24 * 3600000).toISOString().slice(0, 10)
        const to = new Date().toISOString().slice(0, 10)
        await dateInputs.nth(0).fill(from)
        await dateInputs.nth(1).fill(to)
        await page.locator('button:has-text("Generate Report")').click()
        await page.waitForTimeout(1200)
        r.log('hsn-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'hsn-summary-report')
      }
    })

    await r.step('gstr3b-preview-report-renders', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'GSTR-3B Reconciliation Preview' }).first()
      r.log('gstr3b-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const dateInputs = page.locator('input[type="date"]')
        const from = new Date(Date.now() - 30 * 24 * 3600000).toISOString().slice(0, 10)
        const to = new Date().toISOString().slice(0, 10)
        await dateInputs.nth(0).fill(from)
        await dateInputs.nth(1).fill(to)
        await page.locator('button:has-text("Generate Report")').click()
        await page.waitForTimeout(1200)
        r.log('gstr3b-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'gstr3b-report')
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const userIds = db.prepare("SELECT id FROM User WHERE fullName LIKE 'E2E Trust%'").all().map((r2) => r2.id)
      for (const uid of userIds) {
        // Real bug found+fixed 2026-07-15: a hard DELETE here "succeeds"
        // (no FK error to catch) because AuditLog.userId is ON DELETE SET
        // NULL, not RESTRICT — but that cascade silently mutates any
        // historical AuditLog row this user ever appeared in (e.g. their
        // own USER_LOGIN row), which verifyAuditLogChain's hash covers,
        // producing a genuine hash_mismatch on data that was never
        // tampered with. The real app itself never hard-deletes a user
        // (`users:deactivate` is the only handler — no `users:delete`
        // exists), so this was purely a test-cleanup artifact, not a
        // product bug. Soft-delete unconditionally instead — these
        // suite-created usernames are timestamped/unique per run anyway,
        // so nothing depends on the row actually being gone.
        db.prepare('UPDATE User SET isActive = 0 WHERE id = ?').run(uid)
      }
      console.log('extra cleanup: users', userIds.length)
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTRUST & COMPLIANCE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
