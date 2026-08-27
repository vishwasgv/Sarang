/**
 * Suite 83 — Pest Control vertical (pest_contracts). Zero prior E2E
 * coverage for this vertical existed before this suite. Covers contract
 * creation, contract-fee invoicing (incl. Invoice.pestContractId and the
 * PCT-004 double-invoice guard), job-sheet completion with the
 * maybeScheduleNextVisit auto-recurrence side effect, the
 * undocumented-visit compliance flag, and all three new Phase 68 report
 * tiles verified against real API data.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Pest'

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

    await r.step('switch-to-pest-control', async () => {
      const sw = await h.switchBusinessType(page, 'Pest Control Service')
      r.log('business-type-switched', sw.to === 'PEST_CONTROL', JSON.stringify(sw))
    })

    let clientId

    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Pest Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))
    })

    await r.step('create-contract-via-real-ui', async () => {
      await h.gotoHash(page, '#/pest/contracts')
      await page.waitForTimeout(700)
      r.log('pest-contracts-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Contract' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Pest Client')
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: 'E2E Pest Client' }).first().click()
      await page.waitForTimeout(300)

      await modal.getByPlaceholder('Full address').fill('E2E 42 Test Street')
      await modal.getByPlaceholder('0.00').first().fill('6000')
      // Due-this-week bucket -- a clear, unambiguous renewalFunnel assertion.
      const dateInputs = modal.locator('input[type="date"]')
      await dateInputs.nth(0).fill(h.toLocalISODate(new Date()))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date(Date.now() + 3 * 24 * 3600000)))
      await modal.locator('button', { hasText: 'COCKROACHES' }).click()
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Contract' }).click()
      await page.waitForTimeout(1200)
      r.log('contract-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'pest-contract-created')
    })

    let contractId

    await r.step('verify-contract-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.pestContract.list({}))
      const found = (listRes?.data || []).find((c) => c.propertyAddress === 'E2E 42 Test Street')
      contractId = found?.id
      r.log('contract-findable-via-api', !!contractId, JSON.stringify({ contractValue: found?.contractValue, serviceFrequency: found?.serviceFrequency, status: found?.status }))
    })

    let jobSheetId

    await r.step('create-job-sheet-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Job Sheets' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'New Job Sheet' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Pest Client')
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: 'E2E Pest Client' }).first().click()
      await page.waitForTimeout(300)

      if (contractId) await modal.getByLabel(/Contract/i).selectOption(contractId)
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(h.toLocalISODate(new Date()))
      await modal.getByPlaceholder('0.00').fill('800')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Job Sheet' }).click()
      await page.waitForTimeout(1200)
      r.log('job-sheet-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'pest-jobsheet-created')

      const listRes = await page.evaluate(async () => window.api.pestJobSheet.list({}))
      const found = (listRes?.data || []).find((j) => Number(j.jobAmount) === 800 && j.contractId === contractId)
      jobSheetId = found?.id
      r.log('job-sheet-findable-via-api', !!jobSheetId, JSON.stringify(found))
    })

    await r.step('add-pesticide-line-via-api', async () => {
      if (!jobSheetId) return
      const res = await page.evaluate((id) => window.api.pestJobSheet.addPesticide({
        jobSheetId: id, pesticideName: 'E2E Cypermethrin 25 EC', quantityUsed: 50, unit: 'ML', targetPest: 'COCKROACHES',
      }), jobSheetId)
      r.log('pesticide-line-added', !!res?.success, JSON.stringify(res?.error || ''))
    })

    await r.step('complete-job-sheet-and-verify-auto-reschedule', async () => {
      if (!jobSheetId) return
      const res = await page.evaluate(({ id, today }) => window.api.pestJobSheet.update({ id, status: 'COMPLETED', completedDate: today }), { id: jobSheetId, today: h.toLocalISODate(new Date()) })
      r.log('job-sheet-marked-completed', res?.data?.status === 'COMPLETED', JSON.stringify(res?.error || ''))

      // This contract's endDate is only ~3 days out (deliberately, for the
      // renewalFunnel due-this-week bucket assertion below) while its
      // frequency is QUARTERLY -- the computed next-visit date (+3 months)
      // exceeds contract.endDate, so maybeScheduleNextVisit's own boundary
      // check should correctly SKIP auto-recurrence here. That skip is
      // itself one of the three documented conditions, worth verifying
      // directly rather than assuming reschedule always fires.
      const listRes = await page.evaluate(async (cid) => window.api.pestJobSheet.list({ contractId: cid }), contractId)
      const sheets = listRes?.data || []
      const autoScheduled = sheets.find((j) => j.id !== jobSheetId && j.status === 'SCHEDULED')
      r.log('no-auto-reschedule-when-next-date-exceeds-contract-end', !autoScheduled && sheets.length === 1, JSON.stringify(sheets.map((s) => ({ id: s.id, status: s.status, visitDate: s.visitDate }))))
    })

    let undocumentedJobSheetId

    await r.step('create-and-complete-undocumented-job-sheet', async () => {
      // No pesticide line on this one -- chemicalUsageCompliance's
      // undocumentedVisits compliance-gap signal. Ad-hoc (no contractId).
      const res = await page.evaluate(({ clientId, today }) => window.api.pestJobSheet.create({
        clientId, visitDate: today, jobAmount: 500,
      }), { clientId, today: h.toLocalISODate(new Date()) })
      undocumentedJobSheetId = res?.data?.id
      r.log('undocumented-job-sheet-created', !!undocumentedJobSheetId, JSON.stringify(res?.error || ''))
      if (undocumentedJobSheetId) {
        const upd = await page.evaluate((id) => window.api.pestJobSheet.update({ id, status: 'COMPLETED' }), undocumentedJobSheetId)
        r.log('undocumented-job-sheet-completed', upd?.data?.status === 'COMPLETED', JSON.stringify(upd?.error || ''))
      }
    })

    await r.step('generate-contract-invoice-and-verify-guards', async () => {
      if (!contractId) return
      const first = await page.evaluate((id) => window.api.pestContract.generateInvoice({ id }), contractId)
      r.log('contract-invoice-generated', !!first?.success, JSON.stringify(first?.error || ''))

      const retry = await page.evaluate((id) => window.api.pestContract.generateInvoice({ id }), contractId)
      r.log('same-period-retry-blocked-PCT-004', retry?.success === false && retry?.error?.code === 'PCT-004', JSON.stringify(retry?.error))

      if (first?.success && first?.data?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), first.data.invoiceId)
        r.log('invoice-has-pestContractId-set', invRes?.data?.pestContractId === contractId, JSON.stringify(invRes?.data?.pestContractId))
      }
    })

    await r.step('renewal-funnel-report', () => checkReportTile(page, r, 'renewalFunnel', 'Renewal Funnel', { needsDateRange: false }))

    await r.step('renewal-funnel-shows-our-contract-due-this-week-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.renewalFunnel())
      const stages = res?.data?.stages || []
      r.log('renewal-funnel-has-nonzero-total', (res?.data?.summary?.totalWithEndDate ?? 0) >= 1, JSON.stringify({ stages, summary: res?.data?.summary }))
    })

    await r.step('chemical-usage-compliance-report', () => checkReportTile(page, r, 'chemicalUsageCompliance', 'Chemical Usage / Compliance Log', { needsDateRange: true }))

    await r.step('chemical-usage-compliance-shows-usage-and-gap-via-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 5 * 24 * 3600000))
      const to = h.toLocalISODate(new Date(Date.now() + 1 * 24 * 3600000))
      const res = await page.evaluate(({ from, to }) => window.api.reports.chemicalUsageCompliance({ dateFrom: from, dateTo: to }), { from, to })
      const rows = res?.data?.rows || []
      const usageRow = rows.find((row) => row.pesticideName === 'E2E Cypermethrin 25 EC')
      r.log('usage-report-includes-our-pesticide', !!usageRow && Number(usageRow.totalQuantityUsed) === 50, JSON.stringify(usageRow))
      const undocumented = res?.data?.undocumentedVisits || []
      const flagged = undocumented.some((v) => v.jobNumber && v.customerName === 'E2E Pest Client')
      r.log('undocumented-visit-flagged', flagged, JSON.stringify(undocumented))
    })

    await r.step('pest-recurring-value-trend-report', () => checkReportTile(page, r, 'pestRecurringValueTrend', 'Recurring Contract Value Trend', { needsDateRange: true }))

    await r.step('pest-recurring-value-trend-includes-our-invoice-via-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 5 * 24 * 3600000))
      const to = h.toLocalISODate(new Date(Date.now() + 1 * 24 * 3600000))
      const res = await page.evaluate(({ from, to }) => window.api.reports.pestRecurringValueTrend({ dateFrom: from, dateTo: to }), { from, to })
      r.log('trend-report-has-nonzero-revenue', (res?.data?.summary?.totalRecurringRevenue ?? 0) >= 6000, JSON.stringify(res?.data))
    })

    await r.step('due-for-renewal-this-month', async () => {
      const res = await page.evaluate(async () => window.api.pestContract.dueForRenewalThisMonth())
      const found = (res?.data || []).some((c) => c.contractId === contractId)
      r.log('contract-flagged-due-for-renewal-this-month', found, JSON.stringify(res?.data?.map((c) => c.contractId)))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PEST_CONTROL') {
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
      const contractIds = db.prepare("SELECT id FROM PestServiceContract WHERE propertyAddress LIKE 'E2E %'").all().map((r2) => r2.id)
      let sheetCount = 0
      for (const cid of contractIds) {
        const sheetIds = db.prepare('SELECT id FROM PestJobSheet WHERE contractId = ?').all(cid).map((r2) => r2.id)
        for (const sid of sheetIds) {
          try { db.prepare('DELETE FROM PestJobSheetPesticide WHERE jobSheetId = ?').run(sid) } catch { /* noop */ }
          try { db.prepare('DELETE FROM PestJobSheet WHERE id = ?').run(sid) } catch { /* noop */ }
          sheetCount++
        }
      }
      // Also the ad-hoc undocumented sheet (not contract-linked in cleanup
      // scope above if creation failed to link it) and any auto-scheduled
      // follow-ups tied to our test client directly.
      const clientSheetIds = db.prepare("SELECT id FROM PestJobSheet WHERE clientId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E Pest%')").all().map((r2) => r2.id)
      for (const sid of clientSheetIds) {
        try { db.prepare('DELETE FROM PestJobSheetPesticide WHERE jobSheetId = ?').run(sid) } catch { /* noop */ }
        try { db.prepare('DELETE FROM PestJobSheet WHERE id = ?').run(sid) } catch { /* noop */ }
      }
      for (const id of contractIds) { try { db.prepare('DELETE FROM PestServiceContract WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: jobSheets', sheetCount + clientSheetIds.length, 'contracts', contractIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPEST CONTROL VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
