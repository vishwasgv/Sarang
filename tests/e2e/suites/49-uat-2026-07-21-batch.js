/**
 * Suite 49 — Live UAT for the 2026-07-21 batch: offline recovery-code
 * password reset, business-switch confirmation dialog + relabeling, the
 * remembered Label Printer setting, bargained/Final-Price billing mode,
 * and the new Discounts & Bargained Pricing report.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Uat0721'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    const originalBusinessType = h.getBusinessType()

    // ── Business switch: relabeled entry + confirmation dialog ─────────────
    await r.step('switch-business-shows-confirm-dialog-and-preserves-data', async () => {
      await h.gotoHash(page, '#/settings/industry')
      await page.waitForTimeout(600)
      r.log('heading-relabeled', (await page.locator('h2:has-text("Switch Business / Industry Template")').count()) > 0)

      const custRes = await page.evaluate(async () => window.api.customers.create({ customerName: `${'E2E Uat0721'} Switch Marker`, phone: '9990001111' }))
      r.log('marker-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))

      // Every earlier suite in the full sequential run restores the business
      // type to RETAIL before finishing, so by the time suite 49 runs the app
      // is always already on Retail — switching "to Retail" would be a no-op
      // (the Apply button is correctly disabled for the current type, which
      // is real, correct app behavior, not a bug). Switch to a different tile
      // first so this actually exercises the confirm-dialog/data-preservation
      // path, then switch back to Retail before the rest of the suite runs.
      const target = originalBusinessType === 'RETAIL' ? 'Service Business / Agency / IT' : 'Retail / General Store'
      const res = await h.switchBusinessType(page, target)
      r.log('switched-to-retail-via-confirm-dialog', res.changed, JSON.stringify(res))

      const stillThere = await page.evaluate(async () => window.api.customers.list({ search: 'E2E Uat0721 Switch Marker' }))
      const found = (stillThere?.data?.customers || stillThere?.data || []).some((c) => c.customerName === 'E2E Uat0721 Switch Marker')
      r.log('data-preserved-across-switch', found, JSON.stringify(stillThere?.data))

      if (res.changed && originalBusinessType) {
        await h.switchBusinessType(page, 'Retail / General Store')
      }
    })

    // ── Label Printer remembered device (Settings > Barcode & Loose Billing) ─
    await r.step('label-printer-setting-appears-and-persists', async () => {
      // Ensure barcode_printing is enabled so the Label Printer card renders.
      const templateRes = await page.evaluate(async () => window.api.industry.getTemplate())
      const already = (templateRes?.data?.enabledModules || []).includes('barcode_printing')
      if (!already) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: [...mods, 'barcode_printing'] }), templateRes?.data?.enabledModules || [])
      }
      // Settings sub-sections are internal component state, not hash
      // sub-routes — only /settings/industry has its own route. Navigate to
      // the shared /settings screen, then click the "Barcode & Loose
      // Billing" nav item, same as a real user would.
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(600)
      await page.locator('button:has-text("Barcode & Loose Billing")').click()
      // A fixed sleep here was flaky under load (observed failing once in a full
      // 50-suite sequential run but passing in isolation) — wait for the actual
      // element instead of guessing a fixed delay.
      await page.locator('text=Label Printer').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      r.log('label-printer-card-visible', (await page.locator('text=Label Printer').count()) > 0)
      r.log('label-printer-select-present', (await page.locator('option:has-text("Ask every time")').count()) > 0)
    })

    // ── Bargained / Final-Price billing mode ────────────────────────────────
    let productId
    await r.step('bargained-final-price-computes-correct-discount', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Uat0721 Bargain Widget', productType: 'STANDARD', unit: 'PCS',
        costPrice: 200, sellingPrice: 500, taxRate: 0, openingQuantity: 20,
      }))
      r.log('product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
      productId = prodRes?.data?.id

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill('E2E Uat0721 Bargain Widget')
      await page.waitForTimeout(700)
      const productOption = page.locator('button:has-text("E2E Uat0721 Bargain Widget")').first()
      r.log('product-search-found-result', (await productOption.count()) > 0)
      await productOption.click()
      await page.waitForTimeout(400)

      // Quantity 1 @ ₹500 gross. Cycle the mode toggle % -> amount -> finalPrice.
      const toggleBtn = page.locator('button[title*="Bargained"]').first()
      r.log('bargained-toggle-present', (await toggleBtn.count()) > 0)
      await toggleBtn.click() // percent -> amount
      await page.waitForTimeout(150)
      await toggleBtn.click() // amount -> finalPrice
      await page.waitForTimeout(150)
      r.log('toggle-shows-equals-symbol', (await toggleBtn.textContent())?.trim() === '=')

      // The finalPrice input is the number[min=0] input rendered right after
      // the toggle button — same "discount input has min=0, qty has
      // min=0.001" convention 01-core-commerce.js already relies on.
      const priceInput = page.locator('input[type="number"][min="0"]').first()
      await priceInput.fill('350') // bargained down from 500 to 350
      await page.waitForTimeout(400)

      // Discount should now read ₹150 (500 - 350), shown under the line total.
      r.log('discount-shows-150', (await page.locator('text=-₹150.00').count()) > 0 || (await page.locator('text=-₹150').count()) > 0)

      await page.getByRole('button', { name: 'Cash', exact: true }).click().catch(() => {})
      await page.waitForTimeout(200)
      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('bargained-invoice-created', !!match, url)
      if (match) {
        const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), match[1])
        const item = invRes?.data?.items?.[0]
        r.log('invoice-item-discount-persisted-as-150', Math.abs((item?.discountAmount ?? 0) - 150) < 0.01, JSON.stringify(item))
        r.log('invoice-total-is-350', Math.abs((invRes?.data?.totalAmount ?? 0) - 350) < 0.01, String(invRes?.data?.totalAmount))
      }
    })

    // ── Discounts & Bargained Pricing report ────────────────────────────────
    await r.step('discounts-report-loads-and-reflects-the-bargained-line', async () => {
      const from = '2020-01-01'
      const to = h.fmtLocalDateTime(new Date()).slice(0, 10)
      const res = await page.evaluate(async ({ from, to }) => window.api.reports.discounts({ dateFrom: from, dateTo: to }), { from, to })
      r.log('discounts-report-api-success', !!res?.success, JSON.stringify(res?.error || ''))
      const row = (res?.data?.rows || []).find((rr) => rr.productName === 'E2E Uat0721 Bargain Widget')
      r.log('bargained-line-appears-in-report', !!row, JSON.stringify(row))
      r.log('report-discount-percent-is-30', row ? Math.abs(row.discountPercent - 30) < 0.5 : false, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(600)
      const discountsEntry = page.locator('button:has-text("Discounts")').first()
      r.log('discounts-report-listed-in-sidebar', (await discountsEntry.count()) > 0)
      if (await discountsEntry.count()) {
        await discountsEntry.click()
        await page.waitForTimeout(1000)
        r.log('discounts-report-screen-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'discounts-report')
      }
    })

    // ── Offline recovery-code password reset (Settings regenerate + login flow) ─
    await r.step('regenerate-recovery-code-requires-current-password', async () => {
      const wrongPwRes = await page.evaluate(async () => window.api.auth.regenerateRecoveryCode({ currentPassword: 'DefinitelyWrongPassword1' }))
      r.log('wrong-password-rejected', wrongPwRes?.success === false && wrongPwRes?.error?.code === 'AUTH-001', JSON.stringify(wrongPwRes))
    })

    let freshRecoveryCode
    await r.step('regenerate-recovery-code-via-settings-ui', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(600)
      await page.locator('button:has-text("Security")').first().click()
      await page.waitForTimeout(500)
      r.log('recovery-code-card-visible', (await page.locator('text=Password Recovery Code').count()) > 0)
      const pwInput = page.locator('input[type="password"]').last()
      await pwInput.fill(h.UAT_PASSWORD)
      await page.locator('button:has-text("Generate New Recovery Code")').click()
      await page.waitForTimeout(800)
      const codeEl = page.locator('code').first()
      freshRecoveryCode = (await codeEl.textContent().catch(() => null))?.trim()
      r.log('new-recovery-code-shown', !!freshRecoveryCode && /^[A-Z0-9-]{19}$/.test(freshRecoveryCode || ''), freshRecoveryCode || '(none)')
    })

    await r.step('forgot-password-flow-resets-with-fresh-code-then-new-password-works', async () => {
      if (!freshRecoveryCode) return r.log('forgot-password-flow', false, 'no recovery code captured from previous step')
      // Raw window.api.auth.logout() flips the main-process session but
      // leaves the renderer's Zustand auth store stale (same class of gotcha
      // as switchBusinessType() — see harness.js Gotcha 4) so the UI keeps
      // showing the logged-in view. Drive the real Sign Out button instead.
      await page.locator('button:has-text("Test Admin")').first().click().catch(async () => {
        // Fallback: the visible name may differ; open the user menu by its role instead.
        await page.locator('header button').last().click()
      })
      await page.waitForTimeout(300)
      await page.locator('button:has-text("Sign Out")').click()
      await page.waitForTimeout(1000)

      const forgotLink = page.locator('button:has-text("Forgot password?")')
      r.log('forgot-password-link-visible-on-login', (await forgotLink.count()) > 0)
      await forgotLink.click()
      await page.waitForTimeout(400)

      const modal = h.topModal(page)
      await modal.locator('input').nth(0).fill('admin')
      await modal.locator('input').nth(1).fill(freshRecoveryCode)
      const NEW_TEMP_PASSWORD = 'E2EPostRecovery!Temp99'
      await modal.locator('input[type="password"]').nth(0).fill(NEW_TEMP_PASSWORD)
      await modal.locator('input[type="password"]').nth(1).fill(NEW_TEMP_PASSWORD)
      await modal.locator('button:has-text("Reset Password")').click()
      await page.waitForTimeout(1000)
      r.log('reset-success-message-shown', (await page.locator('text=Password Reset').count()) > 0)
      await page.locator('button:has-text("Back to Sign In")').click().catch(() => {})
      await page.waitForTimeout(500)

      // Prove the new password actually works end to end.
      await page.locator('input[name="username"]').fill('admin')
      await page.locator('input[name="password"]').fill(NEW_TEMP_PASSWORD)
      await page.locator('button[type="submit"]').click()
      await page.waitForTimeout(1500)
      const who = await page.evaluate(async () => window.api.auth.getCurrentUser())
      r.log('login-succeeds-with-recovery-reset-password', !!who?.success, JSON.stringify(who?.error || ''))

      // Restore the harness's known UAT password so any later step (or a
      // re-run) isn't left stranded on a one-off temp password.
      h.resetAdminPasswordForSuite()
    })

    await r.step('reject-wrong-recovery-code', async () => {
      const res = await page.evaluate(async () => window.api.auth.resetPasswordWithRecoveryCode({
        username: 'admin', recoveryCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', newPassword: 'IrrelevantLongEnough1'
      }))
      r.log('wrong-recovery-code-rejected', res?.success === false, JSON.stringify(res))
    })

    // ── Cleanup: restore original business type ─────────────────────────────
    await r.step('restore-original-business-type', async () => {
      if (!originalBusinessType) return
      const current = h.getBusinessType()
      if (current === originalBusinessType) return r.log('business-type-already-original', true)
      // Direct DB write back is fine here — this is cleanup, not a feature
      // under test, and matches the harness's own db-cleanup conventions.
      h.withDb((db) => db.prepare('UPDATE BusinessProfile SET businessType = ?').run(originalBusinessType))
      r.log('business-type-restored', true, originalBusinessType)
    })

    if (productId) {
      await r.step('cleanup-test-product', async () => {
        h.cleanupByNamePrefix('E2E Uat0721')
      })
    }

  } finally {
    h.randomizeAdminPassword()
    await h.closeApp(app)
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSuite 49: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
