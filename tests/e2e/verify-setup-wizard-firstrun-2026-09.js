/**
 * Live click-through of the REAL first-run Setup Wizard, all 8 steps, against
 * a genuinely empty database (no BusinessProfile/User rows) — the actual
 * experience a brand-new customer gets on first launch. Not part of the
 * shared run-all.js suite set because it requires the dev DB to be swapped
 * out first (see the orchestrating shell commands around this script).
 * Reuses the test-license-key generator from setup-license-resume-gate.js.
 */
const h = require('./harness')
const { createHmac } = require('crypto')

const TEST_LICENSE_SECRET = process.env.SARANG_LICENSE_HMAC_SECRET || 'DEV-ONLY-INSECURE-PLACEHOLDER-DO-NOT-SHIP'
function generateTestLicenseKey(tier = 'TRIAL', region = 'IN') {
  const days = Math.floor(Date.now() / 86_400_000)
  const payload = `${tier}-${region}-${days.toString(36)}`
  const sig = createHmac('sha256', TEST_LICENSE_SECRET).update(payload).digest('hex').slice(0, 12)
  return `SARANG-${payload}-${sig}`
}

async function main() {
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()

  try {
    let bodyText = ''
    for (let i = 0; i < 10; i++) {
      bodyText = await page.locator('body').innerText().catch(() => '')
      if (bodyText.trim().length > 0) break
      await page.waitForTimeout(1000)
    }
    r.log('wizard-welcome-step-shown', /Get Started/.test(bodyText), bodyText.slice(0, 200))

    // Step 0: Welcome
    await page.getByRole('button', { name: /Get Started/i }).click()
    await page.waitForTimeout(500)

    // Step 1: Business Type — pick Retail
    const retailBtn = page.locator('button', { hasText: 'Retail / Grocery / Supermarket' })
    r.log('step1-business-type-options-shown', await retailBtn.count() > 0)
    await retailBtn.click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Continue/i }).click()
    await page.waitForTimeout(500)

    // Step 2: Business Info
    r.log('step2-business-info-shown', /Tell us about your business/i.test(await page.locator('body').innerText().catch(() => '')))
    await page.locator('input[placeholder*="Sri Ganesh Traders"]').fill('E2E Wizard Test Store')
    await page.getByRole('button', { name: /Continue/i }).click()
    await page.waitForTimeout(500)

    // Step 3: Region
    r.log('step3-region-shown', /Country/i.test(await page.locator('body').innerText().catch(() => '')))
    await page.locator('input[placeholder*="India"]').fill('India')
    await page.locator('input[placeholder*="India"]').blur()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /Continue/i }).click()
    await page.waitForTimeout(500)

    // Step 4: Tax model — pick GST (auto-suggested by country blur above, but click explicitly to be sure)
    const taxBody = await page.locator('body').innerText().catch(() => '')
    r.log('step4-tax-shown', /Tax Configuration/i.test(taxBody))
    const gstOption = page.locator('button', { hasText: 'GST' }).first()
    if (await gstOption.count()) await gstOption.click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Continue/i }).click()
    await page.waitForTimeout(500)

    // Step 5: Logo — skip
    r.log('step5-logo-shown', /Business Logo/i.test(await page.locator('body').innerText().catch(() => '')))
    await page.getByRole('button', { name: /Continue/i }).click()
    await page.waitForTimeout(500)

    // Step 6: Admin account
    r.log('step6-admin-step-shown', /Create Admin Account/i.test(await page.locator('body').innerText().catch(() => '')))
    await page.locator('input[placeholder*="Vishwas Sharma"]').fill('E2E Wizard Admin')
    await page.locator('input[placeholder*="e.g. admin"]').fill('e2ewizardadmin')
    await page.locator('input[placeholder="Create a strong password"]').fill('E2EWizardPass!2026')
    await page.locator('input[placeholder="Repeat your password"]').fill('E2EWizardPass!2026')
    // Step 6 -> 7 is the real form submit (creates the account) — its
    // button is labeled "Complete Setup", not "Continue" like every
    // earlier step.
    await page.getByRole('button', { name: /Complete Setup/i }).click()
    let completeBody = ''
    for (let i = 0; i < 20; i++) {
      completeBody = await page.locator('body').innerText().catch(() => '')
      if (/You're all set|submitError|error/i.test(completeBody)) break
      await page.waitForTimeout(1000)
    }
    console.log('BODY AFTER COMPLETE SETUP CLICK:', JSON.stringify(completeBody.slice(0, 600)))

    // Step 7: Complete — save recovery code, activate a real test license, launch
    r.log('step7-complete-step-shown', /You're all set/i.test(completeBody))
    r.log('recovery-code-shown', /Save your Password Recovery Code/i.test(completeBody))
    r.log('correct-pricing-shown', /6,999|149\/year/.test(completeBody), completeBody.match(/₹[\d,]+\/year|[$]\d+\/year/)?.[0] ?? 'not found')

    const savedCheckbox = page.locator('input[type="checkbox"]').first()
    if (await savedCheckbox.count()) await savedCheckbox.check().catch(() => {})

    const keyField = page.getByRole('textbox', { name: /license key/i })
    r.log('license-key-field-present', await keyField.count() > 0)
    await keyField.fill(generateTestLicenseKey('TRIAL', 'IN'))
    await page.getByRole('button', { name: /Activate/i }).click()
    await page.waitForTimeout(1000)
    const afterActivateBody = await page.locator('body').innerText().catch(() => '')
    r.log('license-activated', /activated/i.test(afterActivateBody))

    const disclosureCheckbox = page.locator('input[type="checkbox"]').nth(1)
    if (await disclosureCheckbox.count()) await disclosureCheckbox.check().catch(() => {})
    await page.waitForTimeout(300)

    const launchBtn = page.getByRole('button', { name: /Launch Dashboard/i })
    const launchEnabled = await launchBtn.isEnabled().catch(() => false)
    r.log('launch-dashboard-button-enabled', launchEnabled)
    if (launchEnabled) {
      await launchBtn.click()
      await page.waitForTimeout(1200)
      const afterLaunchBody = await page.locator('body').innerText().catch(() => '')
      if (/I have read and understood/i.test(afterLaunchBody)) {
        await page.locator('input[type="checkbox"]').first().check().catch(() => {})
        await page.getByRole('button', { name: /Start Using Sarang/i }).click()
        await page.waitForTimeout(1000)
      }
    }

    const finalBody = await page.locator('body').innerText().catch(() => '')
    r.log('reached-dashboard-after-full-wizard', /Dashboard/i.test(finalBody) && !/What type of business|Get Started|One more step/i.test(finalBody), finalBody.slice(0, 200))
    r.log('no-crash-at-end', !(await h.hasErrorBoundary(page)))

    // Verify via a real IPC call, not just UI text.
    const setupCheck = await page.evaluate(async () => window.api.setup.isSetupComplete()).catch(() => null)
    r.log('isSetupComplete-reports-true-via-real-ipc', setupCheck?.data?.complete === true, JSON.stringify(setupCheck?.data))
  } finally {
    await h.closeApp(app)
  }

  const s = r.summary()
  console.log(`\n=== SETUP WIZARD FIRST-RUN VERIFICATION: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
