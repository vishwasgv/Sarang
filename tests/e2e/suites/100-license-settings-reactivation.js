/**
 * Suite 100 — license:activate via the Settings -> License screen
 * (broader-gap-list closure, 2026-09-03). The pre-auth resume-gate path for
 * this same channel is already covered by the standalone
 * tests/e2e/setup-license-resume-gate.js (excluded from run-all.js by
 * design, since a fresh activation there is a real, permanent, desirable
 * one-time fix to the shared dev DB, not a repeatable regression check).
 * This suite covers the OTHER real path: a logged-in admin re-entering a key
 * on the Settings screen. Only reachable while the dev DB's license tier is
 * TRIAL (LicenseScreen hides the key field once tier is PAID+ACTIVE) -- if
 * that's ever no longer true, this suite should report the gap rather than
 * force the license state open just for coverage.
 */
const h = require('../harness')
const { createHmac } = require('crypto')

const LICENSE_SECRET = process.env.SARANG_LICENSE_HMAC_SECRET || 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP'

function generateTestLicenseKey(tier, region) {
  const days = Math.floor(Date.now() / 86_400_000)
  const payload = `${tier}-${region}-${days.toString(36)}`
  const sig = createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex').slice(0, 12)
  return `SARANG-${payload}-${sig}`
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    const before = h.withDb((db) => db.prepare("SELECT settingValue FROM Setting WHERE settingKey = 'license_tier'").get())

    await r.step('license-screen-loads-no-crash', async () => {
      await h.gotoHash(page, '#/license')
      await page.waitForTimeout(700)
      r.log('license-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
    })

    if (before?.settingValue !== 'TRIAL') {
      await r.step('activation-form-not-reachable', () => {
        r.log('skipped-tier-not-trial', true, `dev DB license_tier=${before?.settingValue} -- Settings re-activation form is hidden once PAID+ACTIVE, not forcing it open just for coverage`)
      })
    } else {
      await r.step('reactivate-license-via-ui', async () => {
        const newKey = generateTestLicenseKey('TRIAL', 'IN')
        const keyField = page.getByRole('textbox', { name: 'License key' })
        r.log('key-field-present', await keyField.count() > 0)
        await keyField.fill(newKey)
        await page.getByRole('button', { name: 'Activate', exact: true }).click()
        await page.waitForTimeout(1000)
        r.log('activation-no-crash', !(await h.hasErrorBoundary(page)))
        r.log('activated-confirmation-shown', await page.locator('text=License activated for this device').count() > 0)

        const after = h.withDb((db) => db.prepare("SELECT settingValue FROM Setting WHERE settingKey = 'license_key'").get())
        r.log('license-key-setting-updated', after?.settingValue === newKey.toUpperCase(), JSON.stringify(after))

        const statusRes = await page.evaluate(async () => window.api.license.getStatus())
        r.log('license-status-active-after-reactivation', statusRes?.success && statusRes?.data?.status === 'ACTIVE', JSON.stringify(statusRes?.data))
      })

      await r.step('invalid-key-rejected', async () => {
        const keyField = page.getByRole('textbox', { name: 'License key' })
        await keyField.fill('SARANG-NOT-A-REAL-KEY-000000')
        await page.getByRole('button', { name: 'Activate', exact: true }).click()
        await page.waitForTimeout(800)
        r.log('invalid-key-shows-error', await page.locator('text=That license key is not valid').count() > 0)
      })
    }
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLICENSE SETTINGS RE-ACTIVATION: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
