/**
 * Suite 81 — Civil Engineer vertical (site_visit_log, service_projects
 * stage tracking). Zero prior E2E coverage for this vertical existed
 * before this suite (only a basic create+file-attach smoke test lives in
 * suite 10). Covers the genuinely untested Phase 68 §9.1 depth: billable
 * site-visit invoicing, material test pass/fail auto-computation, project
 * stage progression, and all three new report tiles (siteVisitBilling,
 * materialTestResults, projectStageProgress).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Civil'

async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange } = {}) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileId}-tile-present`, present)
  if (!present) return
  await tile.click()
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000)))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
  await h.shot(page, `report-${tileId}`)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-civil-engineer', async () => {
      const sw = await h.switchBusinessType(page, 'Civil Engineer')
      r.log('business-type-switched', sw.to === 'CIVIL_ENGINEER', JSON.stringify(sw))
    })

    let clientId, projectId

    await r.step('create-client-and-project', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Civil Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))

      const projRes = await page.evaluate(async (cid) => window.api.serviceProject.create({
        clientId: cid, projectName: 'E2E Civil Bridge Project', projectType: 'CIVIL', status: 'ACTIVE', stage: 'SURVEY',
      }), clientId)
      projectId = projRes?.data?.id
      r.log('project-created-with-initial-stage', !!projectId && projRes?.data?.stage === 'SURVEY', JSON.stringify(projRes?.error || ''))
    })

    let visitId

    await r.step('log-site-visit-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/site-visits')
      await page.waitForTimeout(700)
      r.log('site-visits-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByLabel('Project').selectOption(projectId)
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: /Log Visit/i }).click()
      await page.waitForTimeout(400)

      // The Log Visit form is an inline expanding panel, not a modal (no
      // `div.fixed.inset-0` wrapper) -- operate on `page` directly.
      await page.getByLabel(/Visit Date/i).fill(h.toLocalISODate(new Date()))
      await page.getByLabel('Weather Conditions').fill('Clear, dry')
      await page.locator('textarea').fill('E2E Foundation pour inspected — no issues.')
      await page.getByLabel('Billable Amount').fill('1500')
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: /^Save$/i }).click()
      await page.waitForTimeout(1000)
      r.log('site-visit-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'civil-site-visit-created')

      const listRes = await page.evaluate((pid) => window.api.siteVisit.list({ projectId: pid }), projectId)
      const found = (listRes?.data || [])[0]
      visitId = found?.id
      r.log('site-visit-findable-via-api', !!visitId && Number(found?.billableAmount) === 1500 && found?.findings?.includes('Foundation'), JSON.stringify(found))
    })

    await r.step('add-material-test-results-via-api', async () => {
      if (!visitId) return
      const pass = await page.evaluate((sid) => window.api.materialTestResult.add({
        siteVisitId: sid, testType: 'CONCRETE_CUBE_STRENGTH', materialDescription: 'E2E M25 concrete, Column C4', testValue: 28, unit: 'MPa', requiredMinValue: 25,
      }), visitId)
      r.log('passing-test-result-created', pass?.data?.result === 'PASS', JSON.stringify(pass?.data || pass?.error))

      const fail = await page.evaluate((sid) => window.api.materialTestResult.add({
        siteVisitId: sid, testType: 'SOIL_COMPACTION', materialDescription: 'E2E Backfill sample', testValue: 88, unit: '%', requiredMinValue: 95,
      }), visitId)
      r.log('failing-test-result-created', fail?.data?.result === 'FAIL', JSON.stringify(fail?.data || fail?.error))

      const pending = await page.evaluate((sid) => window.api.materialTestResult.add({
        siteVisitId: sid, testType: 'SLUMP_TEST', materialDescription: 'E2E Slump sample',
      }), visitId)
      r.log('pending-test-result-stays-pending-with-no-threshold', pending?.data?.result === 'PENDING', JSON.stringify(pending?.data || pending?.error))
    })

    await r.step('generate-site-visit-invoice-via-real-ui', async () => {
      const genBtn = page.locator('button', { hasText: 'Generate Invoice' }).first()
      r.log('generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let invoiceId

    await r.step('verify-invoice-via-api', async () => {
      if (!visitId) return r.log('verify-invoice-via-api', false, 'no visitId captured')
      const listRes = await page.evaluate((pid) => window.api.siteVisit.list({ projectId: pid }), projectId)
      const found = (listRes?.data || []).find((v) => v.id === visitId)
      invoiceId = found?.invoiceId
      r.log('site-visit-has-invoice-id', !!invoiceId, JSON.stringify(invoiceId))
      if (invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        const expectedTotal = 1500 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }

      const retry = await page.evaluate((sid) => window.api.siteVisit.generateInvoice({ siteVisitId: sid }), visitId)
      r.log('double-invoice-blocked-SV-007', retry?.success === false && retry?.error?.code === 'SV-007', JSON.stringify(retry?.error))
    })

    await r.step('site-visit-billing-report', () => checkReportTile(page, r, 'siteVisitBilling', 'Site Visit Billing', { needsDateRange: false }))

    await r.step('site-visit-billing-shows-our-visit-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.siteVisitBilling())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.siteVisitId === visitId)
      r.log('billing-report-includes-our-visit-billed', !!found && found.isBilled === true && Number(found.billableAmount) === 1500, JSON.stringify(found))
    })

    await r.step('material-test-results-report', () => checkReportTile(page, r, 'materialTestResults', 'Material Test Results', { needsDateRange: false }))

    await r.step('material-test-results-shows-both-outcomes-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.materialTestResults())
      const rows = res?.data?.rows || []
      const hasFail = rows.some((row) => row.materialDescription === 'E2E Backfill sample' && row.result === 'FAIL')
      const hasPass = rows.some((row) => row.materialDescription === 'E2E M25 concrete, Column C4' && row.result === 'PASS')
      r.log('test-results-report-includes-both-pass-and-fail', hasFail && hasPass, JSON.stringify({ hasFail, hasPass, summary: res?.data?.summary }))
      // FAILED-first ordering.
      const failIdx = rows.findIndex((row) => row.result === 'FAIL')
      const passIdx = rows.findIndex((row) => row.result === 'PASS')
      r.log('fail-sorted-before-pass', failIdx !== -1 && passIdx !== -1 && failIdx < passIdx, JSON.stringify({ failIdx, passIdx }))
    })

    await r.step('advance-project-stage', async () => {
      const before = await page.evaluate((pid) => window.api.serviceProject.get({ id: pid }), projectId)
      const res = await page.evaluate((pid) => window.api.serviceProject.update({ id: pid, stage: 'FOUNDATION' }), projectId)
      r.log('stage-advanced', res?.data?.stage === 'FOUNDATION', JSON.stringify(res?.error || ''))
      r.log('stageUpdatedAt-changed', res?.data?.stageUpdatedAt !== before?.data?.stageUpdatedAt, JSON.stringify({ before: before?.data?.stageUpdatedAt, after: res?.data?.stageUpdatedAt }))
    })

    await r.step('project-stage-progress-shows-civil-pipeline-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.projectStageProgress())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.projectId === projectId)
      r.log('civil-project-recognized-in-civil-pipeline', !!found && found.stage === 'FOUNDATION' && found.stageProgressPercent !== null, JSON.stringify(found))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CIVIL_ENGINEER') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const visitIds = db.prepare("SELECT sv.id AS id FROM SiteVisit sv JOIN ServiceProject p ON p.id = sv.projectId WHERE p.projectName LIKE 'E2E Civil%'").all().map((r2) => r2.id)
      for (const id of visitIds) {
        try { db.prepare('DELETE FROM MaterialTestResult WHERE siteVisitId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM SiteVisit WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const projIds = db.prepare("SELECT id FROM ServiceProject WHERE projectName LIKE 'E2E Civil%'").all().map((r2) => r2.id)
      for (const id of projIds) { try { db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: visits', visitIds.length, 'projects', projIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCIVIL ENGINEER VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
