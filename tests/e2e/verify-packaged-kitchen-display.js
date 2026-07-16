/**
 * Verifies the REAL PACKAGED installed app (not dev mode), fresh install
 * (userData renamed aside beforehand, per user's explicit choice), walking
 * the real Setup Wizard choosing Restaurant directly, then confirming the
 * new Kitchen Display feature — which added a new resources/kitchen-display/
 * folder via extraResources, plus new main-process files — actually works
 * once packaged, not just in dev mode. This codebase has a documented
 * history of packaging-only bugs (Prisma client, missing migrations) that
 * dev-mode e2e never caught.
 */
const { _electron } = require('playwright-core')

const EXE_PATH = 'C:\\Users\\vishw\\AppData\\Local\\Programs\\Sarang Business OS Lite\\Sarang Business OS Lite.exe'
const ADMIN_PASSWORD = 'PackagedVerify!2026'

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
    await page.waitForTimeout(2000)
    check('app-launched-no-crash', true)

    async function waitForHeading(text) {
      await page.locator('h2', { hasText: text }).waitFor({ timeout: 15000 })
    }

    // ── Setup Wizard, choosing Restaurant directly ──────────────────────
    await page.getByRole('button', { name: 'Get Started' }).click()
    await waitForHeading('What type of business')
    await page.locator('button', { hasText: 'Restaurant' }).click()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Continue' }).click()
    await waitForHeading('Tell us about your business')
    check('setup-wizard-reached-business-info', true)

    await page.locator('input[placeholder*="Sri Ganesh Traders"]').fill('E2E Packaged Verify Restaurant')
    await page.getByRole('button', { name: 'Continue' }).click()
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

    await page.locator('input[placeholder*="Vishwas Sharma"]').fill('E2E Packaged Verify Admin')
    await page.locator('input[placeholder*="e.g. admin"]').fill('admin')
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD)
    await page.locator('input[type="password"]').last().fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Complete Setup' }).click()
    await page.waitForTimeout(1500)
    check('setup-wizard-completed', true)

    const launchBtn = page.getByRole('button', { name: 'Launch Dashboard' })
    if (await launchBtn.count()) {
      await launchBtn.click()
      await page.waitForTimeout(1000)
    }

    const bodyTextDisclaimer = await page.locator('body').innerText()
    if (/I have read and understood/i.test(bodyTextDisclaimer)) {
      await page.locator('input[type="checkbox"]').first().check()
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Start Using Sarang' }).click()
      await page.waitForTimeout(1000)
    }

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
    check('logged-in', !!who?.success, who?.data?.username)
    if (!who?.success) {
      log('Could not log in after fresh setup — aborting deeper checks.')
      return
    }

    await page.evaluate(() => { window.location.hash = '#/settings' })
    await page.waitForTimeout(1500)
    const bodyText2 = await page.locator('body').innerText()
    check('settings-screen-loads-no-crash', !/Something went wrong|Error Boundary/i.test(bodyText2))

    // Kitchen printer list — exercises the new print:listPrinters IPC + main window reuse.
    const printersRes = await page.evaluate(async () => window.api.print.listPrinters())
    check('kitchen-printer-list-ipc-works', printersRes?.success === true, JSON.stringify(printersRes?.data))

    // Second-monitor Kitchen Display window management — exercises the new
    // kitchen-display-window.ts module, including the app.isPackaged branch
    // of its dev/prod loadURL/loadFile logic (never hit by dev-mode e2e).
    const displaysRes = await page.evaluate(async () => window.api.kitchenDisplay.listDisplays())
    check('list-secondary-displays-ipc-works', displaysRes?.success === true, JSON.stringify(displaysRes?.data))
    const openRes = await page.evaluate(async () => window.api.kitchenDisplay.open())
    check('open-kitchen-display-window-packaged', openRes?.success === true, openRes?.error)
    await page.waitForTimeout(2000)
    const statusRes = await page.evaluate(async () => window.api.kitchenDisplay.getStatus())
    check('kitchen-display-window-reports-open-packaged', statusRes?.data?.open === true, JSON.stringify(statusRes?.data))
    await page.evaluate(async () => window.api.kitchenDisplay.close())

    // Kitchen Display (LAN) server — exercises resources/kitchen-display/
    // actually being present at process.resourcesPath in the packaged app
    // (the extraResources entry added this session), not just in dev mode
    // where it's read straight from the source tree.
    const modulesRes = await page.evaluate(async () => window.api.industry.getTemplate())
    const currentModules = modulesRes?.data?.enabledModules || []
    const withKds = currentModules.includes('kitchen_display_web') ? currentModules : [...currentModules, 'kitchen_display_web']
    const updRes = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), withKds)
    check('kitchen-display-web-module-enabled-packaged', !!updRes?.success, updRes?.error)
    await page.waitForTimeout(1000)

    const kdStatus = await page.evaluate(async () => window.api.restaurant.getKitchenDisplayStatus())
    check('kitchen-display-lan-server-running-packaged', kdStatus?.data?.running === true, JSON.stringify(kdStatus?.data))

    if (kdStatus?.data?.running && kdStatus?.data?.lanUrls?.[0] && kdStatus?.data?.token) {
      const boardUrl = `http://127.0.0.1:${kdStatus.data.port}/kitchen/${kdStatus.data.token}`
      const boardRes = await fetch(boardUrl)
      const boardHtml = await boardRes.text()
      check('kitchen-display-static-resource-served-from-packaged-app', boardRes.status === 200 && /Kitchen Display/.test(boardHtml), `status=${boardRes.status}, len=${boardHtml.length}`)
    } else {
      check('kitchen-display-static-resource-served-from-packaged-app', false, 'server not running or no token')
    }

    // Turn the module back off so we don't leave the LAN server running.
    await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), currentModules)

  } catch (e) {
    const page = await app.firstWindow().catch(() => null)
    if (page) {
      await page.screenshot({ path: 'D:/Sarang(business OS LITE)/sarang-business-os/tests/e2e/shots/packaged-kitchen-display-FAILURE.png' }).catch(() => {})
    }
    log(`FATAL: ${e.message}`)
    results.push({ name: 'fatal-error', pass: false })
  } finally {
    await app.close().catch(() => {})
  }

  const pass = results.filter(r => r.pass).length
  const total = results.length
  console.log(`\nPACKAGED KITCHEN DISPLAY VERIFICATION: ${pass}/${total} passed`)
  process.exit(results.some(r => !r.pass) ? 1 : 0)
}

main()
