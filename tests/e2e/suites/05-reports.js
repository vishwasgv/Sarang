/**
 * Suite 5 — Reports (Section 2.2 item 5). Representative sweep across
 * chart-bearing and non-chart report categories, confirming each renders
 * real data without crashing. Sales/Inventory/Outstanding are universal
 * reports, checked against whatever business type is already active.
 * Production Report is gated on the `production_orders` module (only
 * MANUFACTURING has it by default — see TEMPLATE_DEFAULTS in
 * industry-template.service.ts), so it explicitly switches business type
 * first rather than assuming ambient state — real bug found 2026-07-16:
 * this suite used to rely on "MANUFACTURING happens to be left active by
 * whatever ran before it", which silently broke once suite ordering/count
 * changed and the ambient business type was no longer MANUFACTURING by the
 * time this suite ran.
 *
 * The 2 GST reports (HSN-Wise Summary, GSTR-3B Reconciliation Preview)
 * are already covered by Suite 6 (06-trust-compliance.js) — not repeated
 * here.
 */
const h = require('../harness')

async function generateReport(page, r, tileLabel, { needsDateRange }) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileLabel}-tile-present`, present)
  if (!present) return
  await tile.click()
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    const from = h.toLocalISODate(new Date(Date.now() - 30 * 24 * 3600000))
    const to = h.toLocalISODate(new Date())
    await dateInputs.nth(0).fill(from)
    await dateInputs.nth(1).fill(to)
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileLabel}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
  await h.shot(page, `report-${tileLabel.replace(/\s+/g, '-').toLowerCase()}`)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('sales-report', () => generateReport(page, r, 'Sales Report', { needsDateRange: true }))
    await r.step('inventory-report', () => generateReport(page, r, 'Inventory Report', { needsDateRange: false }))
    await r.step('outstanding-report', () => generateReport(page, r, 'Outstanding Report', { needsDateRange: false }))

    await r.step('switch-to-manufacturing-for-production-report', async () => {
      const sw = await h.switchBusinessType(page, 'Manufacturing')
      r.log('switched-to-manufacturing', sw.to === 'MANUFACTURING', JSON.stringify(sw))
    })
    await r.step('production-report', () => generateReport(page, r, 'Production Report', { needsDateRange: true }))
  } finally {
    if (originalBusinessType) {
      try {
        const winPage = (await app.windows())[0]
        if (winPage) await winPage.evaluate((bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
      } catch { /* app may already be closing */ }
    }
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nREPORTS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
