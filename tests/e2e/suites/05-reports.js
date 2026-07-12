/**
 * Suite 5 — Reports (Section 2.2 item 5). Representative sweep across
 * chart-bearing and non-chart report categories, confirming each renders
 * real data without crashing. Runs against whatever business type is
 * currently active (no switch needed) — MANUFACTURING at the time this
 * suite was written, which conveniently exercises both a universal report
 * (Sales, Inventory, Outstanding) and a vertical-specific one (Production,
 * gated on the `production_orders` module).
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
    const from = new Date(Date.now() - 30 * 24 * 3600000).toISOString().slice(0, 10)
    const to = new Date().toISOString().slice(0, 10)
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

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('sales-report', () => generateReport(page, r, 'Sales Report', { needsDateRange: true }))
    await r.step('inventory-report', () => generateReport(page, r, 'Inventory Report', { needsDateRange: false }))
    await r.step('outstanding-report', () => generateReport(page, r, 'Outstanding Report', { needsDateRange: false }))
    await r.step('production-report', () => generateReport(page, r, 'Production Report', { needsDateRange: true }))
  } finally {
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
