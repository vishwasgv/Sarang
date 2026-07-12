/**
 * Suite 8 — Branding & legal (Section 2.2 item 8), single pass, not
 * per-business-type (both concerns are business-type-agnostic).
 *
 * Scope note (deliberate): does NOT attempt to screenshot the splash
 * screen. `createSplashWindow()`'s close is a side effect of the main
 * window's `ready-to-show` event, not a fixed timer — there's no
 * synchronization point Playwright can reliably race against (confirmed
 * by reading src/main/index.ts directly), so any assertion here would be
 * a flaky one, not a real regression check. Splash legibility got its own
 * dedicated visual-render verification at Phase 52's ship time (real
 * Playwright `chromium` screenshots, per PHASE_52_COMPLETION_REPORT.md) —
 * not repeated here.
 */
const h = require('../harness')

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()

  // ── Disclaimer gate — force it to show again via the documented Setting reset ──
  h.withDb((db) => {
    db.prepare("DELETE FROM Setting WHERE settingKey = 'disclaimer_accepted'").run()
  })

  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)

    await r.step('disclaimer-shows-after-reset-and-can-be-accepted', async () => {
      await page.waitForTimeout(1500)
      const bodyText = await page.locator('body').innerText()
      const disclaimerShown = /I have read and understood/i.test(bodyText)
      r.log('disclaimer-screen-shown-after-reset', disclaimerShown)
      await h.shot(page, 'disclaimer-screen')

      if (disclaimerShown) {
        const checkbox = page.locator('input[type="checkbox"]').first()
        await checkbox.check()
        await page.waitForTimeout(300)
        const acceptBtn = page.getByRole('button', { name: 'Start Using Sarang' })
        const enabled = await acceptBtn.isEnabled().catch(() => false)
        r.log('accept-button-enables-after-checking-box', enabled)
        if (enabled) {
          await acceptBtn.click()
          await page.waitForTimeout(1200)
          const afterText = await page.locator('body').innerText()
          r.log('disclaimer-dismissed-after-accept', !/I have read and understood/i.test(afterText))
        }
      }
    })

    await r.step('login-and-confirm-normal-app-flow-resumes', async () => {
      await h.login(page)
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(600)
      r.log('dashboard-loads-no-crash-after-disclaimer-flow', !(await h.hasErrorBoundary(page)))
    })

    let invoiceId

    await r.step('aszurex-branding-present-in-invoice-print-preview', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Brand Customer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Brand Product', productType: 'STANDARD', unit: 'PCS',
        costPrice: 10, sellingPrice: 20, taxRate: 5, openingQuantity: 5,
      }))
      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 20, taxRate: 5 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      invoiceId = invRes?.data?.id
      r.log('test-invoice-created', !!invoiceId)

      if (invoiceId) {
        const previewRes = await page.evaluate(async (id) => window.api.print.previewInvoice({ invoiceId: id }), invoiceId)
        const html = previewRes?.data || ''
        r.log('invoice-print-preview-contains-aszurex-branding', typeof html === 'string' && html.includes('aszurex.com'), `htmlLength=${typeof html === 'string' ? html.length : 'n/a'}`)
      }
    })

    await r.step('aszurex-branding-present-in-report-html', async () => {
      const res = await page.evaluate(async () => window.api.export.generateReportHtml({
        title: 'E2E Brand Test Report', tables: [],
      }))
      const html = res?.data || ''
      r.log('report-html-contains-aszurex-branding', typeof html === 'string' && html.includes('aszurex.com'), `htmlLength=${typeof html === 'string' ? html.length : 'n/a'}`)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Brand%'").all().map((row) => row.id)
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE 'E2E Brand%'").all().map((row) => row.id)
      for (const pid of prodIds) {
        const invIds = db.prepare('SELECT invoiceId FROM InvoiceItem WHERE productId = ?').all(pid).map((row) => row.invoiceId)
        for (const iid of invIds) {
          db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(iid)
          try { db.prepare('DELETE FROM Invoice WHERE id = ?').run(iid) } catch { /* leave it */ }
        }
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
        try { db.prepare('DELETE FROM Product WHERE id = ?').run(pid) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
      }
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { db.prepare('DELETE FROM Customer WHERE id = ?').run(cid) } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('branding cleanup: customers', custIds.length, 'products', prodIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBRANDING & LEGAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
