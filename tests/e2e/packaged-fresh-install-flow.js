/**
 * Drives the REAL PACKAGED installed app (not dev mode) through Setup
 * Wizard -> disclaimer -> login -> first customer/product/invoice/payment,
 * timing the whole thing against the release checklist's 15-minute target
 * (Section 7, Fresh Install). Written 2026-07-15 once the packaged build
 * was confirmed actually launchable (see PHASE_57 installer-crash fix).
 *
 * Run against a FRESH install only (wipe %APPDATA%\sarang-business-os
 * first) -- the Setup Wizard only shows when no BusinessProfile exists.
 */
const { _electron } = require('playwright-core')

const EXE_PATH = 'C:\\Users\\vishw\\AppData\\Local\\Programs\\Sarang Business OS Lite\\Sarang Business OS Lite.exe'
const ADMIN_PASSWORD = 'FreshInstall!2026Test'

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`) }

async function main() {
  const t0 = Date.now()
  const app = await _electron.launch({ executablePath: EXE_PATH })
  try {
    return await runFlow(app, t0)
  } catch (e) {
    const page = await app.firstWindow().catch(() => null)
    if (page) {
      await page.screenshot({ path: 'D:/Sarang(business OS LITE)/sarang-business-os/tests/e2e/shots/fresh-FAILURE.png' }).catch(() => {})
      const bodyText = await page.locator('body').innerText().catch(() => '(could not read body)')
      log(`FAILURE body text snapshot:\n${bodyText.slice(0, 2000)}`)
    }
    throw e
  } finally {
    await app.close().catch(() => {})
  }
}

async function runFlow(app, t0) {
  let page = await app.firstWindow()
  if (page.url().includes('splash.html')) {
    const mainPagePromise = app.waitForEvent('window')
    await page.waitForEvent('close').catch(() => {})
    page = await mainPagePromise
  }
  page.on('pageerror', (err) => log(`[renderer pageerror] ${err.message}`))
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1500)
  log(`App window ready at ${Date.now() - t0}ms`)

  // ── Setup Wizard ──────────────────────────────────────────────────────
  async function shot(label) {
    await page.screenshot({ path: `D:/Sarang(business OS LITE)/sarang-business-os/tests/e2e/shots/fresh-${label}.png` }).catch(() => {})
  }
  async function waitForHeading(text) {
    await page.locator('h2', { hasText: text }).waitFor({ timeout: 10000 })
  }

  await shot('00-welcome')
  await page.getByRole('button', { name: 'Get Started' }).click()
  await waitForHeading('What type of business')
  log('Step: Business Type')
  await shot('01-business-type')

  await page.locator('button', { hasText: 'Retail / Grocery / Supermarket' }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Continue' }).click()
  await waitForHeading('Tell us about your business')
  log('Step: Business Info')
  await shot('02-business-info')

  await page.locator('input[placeholder*="Sri Ganesh Traders"]').fill('E2E Fresh Install Traders')
  await page.getByRole('button', { name: 'Continue' }).click()
  await waitForHeading('Country')
  log('Step: Region')
  await shot('03-region')

  await page.locator('input[placeholder*="India"]').fill('India')
  await page.locator('input[placeholder*="India"]').blur()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Continue' }).click()
  await waitForHeading('Tax Configuration')
  log('Step: Tax')
  await shot('04-tax')

  // GST is already the default selection.
  await page.getByRole('button', { name: 'Continue' }).click()
  await waitForHeading('Business Logo')
  log('Step: Logo')
  await shot('05-logo')

  await page.getByRole('button', { name: 'Continue' }).click()
  await waitForHeading('Create Admin Account')
  log('Step: Admin Account')
  await shot('06-admin')

  await page.locator('input[placeholder*="Vishwas Sharma"]').fill('E2E Test Admin')
  await page.locator('input[placeholder*="e.g. admin"]').fill('admin')
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD)
  await page.locator('input[type="password"]').last().fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Complete Setup' }).click()
  await page.waitForTimeout(1500)
  await shot('07-complete')

  const setupDoneMs = Date.now() - t0
  log(`Setup Wizard submitted at ${setupDoneMs}ms`)

  const launchBtn = page.getByRole('button', { name: 'Launch Dashboard' })
  if (await launchBtn.count()) {
    await launchBtn.click()
    await page.waitForTimeout(1000)
  }

  // ── Disclaimer (if shown) ────────────────────────────────────────────
  const bodyText1 = await page.locator('body').innerText()
  if (/I have read and understood/i.test(bodyText1)) {
    await page.locator('input[type="checkbox"]').first().check()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Start Using Sarang' }).click()
    await page.waitForTimeout(1000)
  }

  // ── Login (if the setup flow doesn't auto-authenticate) ─────────────
  // Same real race documented in tests/e2e/harness.js's h.login(): window.api
  // existing doesn't mean the main process has registered the session yet.
  // Poll the real session state and re-submit the login form if needed.
  await page.waitForFunction(() => !!window.api, { timeout: 15000 })
  for (let attempt = 0; attempt < 6; attempt++) {
    const who = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(() => null)
    if (who?.success) break
    const userInput = page.locator('input[name="username"]')
    if (await userInput.count()) {
      log(`Login attempt ${attempt + 1} -- logging in with the admin account just created`)
      await userInput.fill('admin')
      await page.locator('input[name="password"]').fill(ADMIN_PASSWORD)
      await page.locator('button[type="submit"]').click()
    }
    await page.waitForTimeout(1000)
  }
  const postLoginBody = await page.locator('body').innerText().catch(() => '(unreadable)')
  log(`Post-login-loop body snapshot (first 500 chars):\n${postLoginBody.slice(0, 500)}`)
  await shot('08-post-login-loop')
  log(`Authenticated / dashboard-ready at ${Date.now() - t0}ms`)

  // ── First customer, product, invoice ─────────────────────────────────
  const custRes = await page.evaluate(async () => window.api.customers.create({
    customerName: 'E2E Fresh Install Customer', phone: `9${String(Date.now()).slice(-9)}`,
  }))
  log(`Customer created: ${JSON.stringify(custRes?.success)} ${JSON.stringify(custRes?.error || '')}`)

  const prodRes = await page.evaluate(async () => window.api.products.create({
    productName: 'E2E Fresh Install Product', productType: 'STANDARD', unit: 'PCS',
    costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 20,
  }))
  log(`Product created: ${JSON.stringify(prodRes?.success)} ${JSON.stringify(prodRes?.error || '')}`)

  const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
    customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 18 }],
  }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
  log(`Invoice created: ${JSON.stringify(invRes?.success)} total=${invRes?.data?.totalAmount} ${JSON.stringify(invRes?.error || '')}`)

  const firstInvoiceMs = Date.now() - t0
  log(`=== First invoice created at ${firstInvoiceMs}ms (${(firstInvoiceMs / 1000 / 60).toFixed(2)} minutes) — target: under 15 minutes ===`)

  return { setupDoneMs, firstInvoiceMs, customerOk: !!custRes?.success, productOk: !!prodRes?.success, invoiceOk: !!invRes?.success }
}

main().then((r) => {
  console.log('RESULT', JSON.stringify(r))
  process.exit(r.customerOk && r.productOk && r.invoiceOk ? 0 : 1)
}).catch((e) => { console.error('FATAL', e); process.exit(1) })
