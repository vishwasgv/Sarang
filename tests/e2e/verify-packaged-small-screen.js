/**
 * Verifies the small-screen scroll-cutoff fix (DisclaimerScreen, SetupWizard,
 * BackupPromptScreen) in the REAL PACKAGED app, at a viewport height (550px)
 * matching the real user-reported bug photo. Real bug found+fixed 2026-07-16.
 */
const { _electron } = require('playwright-core')

const EXE_PATH = 'C:\\Users\\vishw\\AppData\\Local\\Programs\\Sarang Business OS Lite\\Sarang Business OS Lite.exe'
const ADMIN_PASSWORD = 'SmallScreenVerify!2026'

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) }

async function main() {
  const app = await _electron.launch({ executablePath: EXE_PATH })
  const results = []
  function check(name, pass, detail) {
    results.push({ name, pass })
    log(`${pass ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' — ' + JSON.stringify(detail) : ''}`)
  }
  try {
    let page = await app.firstWindow()
    if (page.url().includes('splash.html')) {
      const mainPagePromise = app.waitForEvent('window')
      await page.waitForEvent('close').catch(() => {})
      page = await mainPagePromise
    }
    page.on('pageerror', (err) => log(`[renderer pageerror] ${err.message}`))
    await page.waitForLoadState('domcontentloaded')
    await page.setViewportSize({ width: 1024, height: 550 })
    await page.waitForTimeout(2000)
    check('app-launched-no-crash', true)

    async function waitForHeading(text) {
      await page.locator('h2', { hasText: text }).waitFor({ timeout: 15000 })
    }

    // ── Setup Wizard at small viewport ──────────────────────────────────
    const getStartedBtn = page.getByRole('button', { name: 'Get Started' })
    await getStartedBtn.scrollIntoViewIfNeeded()
    check('wizard-welcome-get-started-reachable', await getStartedBtn.isVisible())
    await getStartedBtn.click()
    await waitForHeading('What type of business')

    await page.locator('button', { hasText: 'Retail' }).click()
    await page.waitForTimeout(200)
    const continueBtn1 = page.getByRole('button', { name: 'Continue' })
    await continueBtn1.scrollIntoViewIfNeeded()
    check('wizard-business-type-continue-reachable', await continueBtn1.isVisible())
    await continueBtn1.click()
    await waitForHeading('Tell us about your business')

    await page.locator('input[placeholder*="Sri Ganesh Traders"]').fill('E2E Small Screen Verify')
    const continueBtn2 = page.getByRole('button', { name: 'Continue' })
    await continueBtn2.scrollIntoViewIfNeeded()
    check('wizard-business-info-continue-reachable', await continueBtn2.isVisible())
    await continueBtn2.click()
    await waitForHeading('Country')

    await page.locator('input[placeholder*="India"]').fill('India')
    await page.locator('input[placeholder*="India"]').blur()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Continue' }).click()
    await waitForHeading('Tax Configuration')
    await page.getByRole('button', { name: 'Continue' }).click()
    await waitForHeading('Business Logo')
    await page.getByRole('button', { name: 'Continue' }).click()
    await waitForHeading('Create Admin Account')

    await page.locator('input[placeholder*="Vishwas Sharma"]').fill('E2E Small Screen Admin')
    await page.locator('input[placeholder*="e.g. admin"]').fill('admin')
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD)
    await page.locator('input[type="password"]').last().fill(ADMIN_PASSWORD)
    const completeBtn = page.getByRole('button', { name: 'Complete Setup' })
    await completeBtn.scrollIntoViewIfNeeded()
    check('wizard-admin-complete-setup-reachable', await completeBtn.isVisible())
    await completeBtn.click()
    await page.waitForTimeout(1500)

    const launchBtn = page.getByRole('button', { name: 'Launch Dashboard' })
    if (await launchBtn.count()) {
      await launchBtn.scrollIntoViewIfNeeded()
      check('wizard-launch-dashboard-reachable', await launchBtn.isVisible())
      await launchBtn.click()
      await page.waitForTimeout(1000)
    }

    // ── Disclaimer screen at small viewport — the exact reported bug ────
    const startUsingBtn = page.getByRole('button', { name: 'Start Using Sarang' })
    if (await startUsingBtn.count()) {
      await startUsingBtn.scrollIntoViewIfNeeded()
      check('disclaimer-start-button-reachable-packaged', await startUsingBtn.isVisible())
      await page.screenshot({ path: 'D:/Sarang(business OS LITE)/sarang-business-os/tests/e2e/shots/packaged-small-screen-disclaimer.png' })
      await page.locator('input[type="checkbox"]').first().check()
      await page.waitForTimeout(200)
      await startUsingBtn.click()
      await page.waitForTimeout(1000)
    } else {
      check('disclaimer-start-button-reachable-packaged', false, 'button not found at all')
    }

    // ── Login ─────────────────────────────────────────────────────────
    await page.waitForFunction(() => !!window.api, { timeout: 15000 })
    for (let attempt = 0; attempt < 6; attempt++) {
      const whoCheck = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
      if (whoCheck?.success) break
      const userInput = page.locator('input[name="username"]')
      if (await userInput.count()) {
        await userInput.fill('admin')
        await page.locator('input[name="password"]').fill(ADMIN_PASSWORD)
        await page.locator('button[type="submit"]').click()
      }
      await page.waitForTimeout(1000)
    }
    const who = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
    check('logged-in-packaged', !!who?.success, who?.data?.username)

    // ── Backup prompt screen at small viewport — the exact reported bug ─
    const chooseBtn = page.getByRole('button', { name: 'Choose a Backup Folder' })
    if (await chooseBtn.count()) {
      await chooseBtn.scrollIntoViewIfNeeded()
      check('backup-prompt-choose-button-reachable-packaged', await chooseBtn.isVisible())
      await page.screenshot({ path: 'D:/Sarang(business OS LITE)/sarang-business-os/tests/e2e/shots/packaged-small-screen-backupprompt.png' })
      const skipBtn = page.getByRole('button', { name: 'Skip for now' })
      await skipBtn.click()
      await page.waitForTimeout(1000)
    } else {
      check('backup-prompt-choose-button-reachable-packaged', false, 'button not found — prompt may not have shown')
    }

    const bodyText = await page.locator('body').innerText()
    check('reached-dashboard-after-full-flow', /Dashboard/i.test(bodyText), bodyText.slice(0, 80))

  } catch (e) {
    const page = await app.firstWindow().catch(() => null)
    if (page) await page.screenshot({ path: 'D:/Sarang(business OS LITE)/sarang-business-os/tests/e2e/shots/packaged-small-screen-FAILURE.png' }).catch(() => {})
    log(`FATAL: ${e.message}`)
    results.push({ name: 'fatal-error', pass: false })
  } finally {
    await app.close().catch(() => {})
  }

  const pass = results.filter(r => r.pass).length
  const total = results.length
  console.log(`\nPACKAGED SMALL-SCREEN VERIFICATION: ${pass}/${total} passed`)
  process.exit(results.some(r => !r.pass) ? 1 : 0)
}

main()
