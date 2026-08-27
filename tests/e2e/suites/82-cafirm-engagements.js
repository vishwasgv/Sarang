/**
 * Suite 82 — CA Firm vertical (engagements, compliance_tasks). Zero prior
 * E2E coverage for this vertical existed before this suite. Covers
 * engagement creation, fee invoicing (incl. the EN29-008 double-invoice
 * guard and legitimate month-over-month re-invoicing), the
 * feeRealization report tile, and a basic compliance task creation.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CA'

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

    await r.step('switch-to-ca-firm', async () => {
      const sw = await h.switchBusinessType(page, 'CA / Chartered Accountant')
      r.log('business-type-switched', sw.to === 'CA_FIRM', JSON.stringify(sw))
    })

    let clientId

    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E CA Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))
    })

    await r.step('create-engagement-via-real-ui', async () => {
      await h.gotoHash(page, '#/ca-cs/engagements')
      await page.waitForTimeout(700)
      r.log('engagements-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Engagement' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client').selectOption(clientId)
      await modal.getByPlaceholder('e.g. GST Filing & Advisory Retainer FY 2026-27').fill('E2E CA GST Filing Retainer')
      await modal.getByPlaceholder('e.g. 12000').fill('10000')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Engagement' }).click()
      await page.waitForTimeout(1200)
      r.log('engagement-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'ca-engagement-created')
    })

    let engagementId

    await r.step('verify-engagement-via-api', async () => {
      const listRes = await page.evaluate(async (cid) => window.api.engagement.list({ clientId: cid }), clientId)
      const found = (listRes?.data || []).find((e) => e.title === 'E2E CA GST Filing Retainer')
      engagementId = found?.id
      r.log('engagement-findable-via-api', !!engagementId, JSON.stringify({ feeAmount: found?.feeAmount, status: found?.status, engagementType: found?.engagementType }))
    })

    await r.step('generate-engagement-invoice-and-verify-guards', async () => {
      if (!engagementId) return r.log('generate-engagement-invoice-and-verify-guards', false, 'no engagementId captured')
      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const first = await page.evaluate((id) => window.api.engagement.generateInvoice({ id }), engagementId)
      r.log('first-period-invoice-generated', !!first?.success, JSON.stringify(first?.error || ''))

      const retry = await page.evaluate((id) => window.api.engagement.generateInvoice({ id }), engagementId)
      r.log('same-period-retry-blocked-EN29-008', retry?.success === false && retry?.error?.code === 'EN29-008', JSON.stringify(retry?.error))

      if (first?.success && first?.data?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), first.data.invoiceId)
        const expectedTotal = 10000 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    // feeRealization is current-calendar-month only, keyed off
    // Engagement.lastInvoicedPeriod -- must check BEFORE the next-period
    // invoice below overwrites lastInvoicedPeriod to a future month.
    await r.step('fee-realization-report', () => checkReportTile(page, r, 'feeRealization', 'Fee Realization', { needsDateRange: false }))

    await r.step('fee-realization-shows-our-engagement-invoiced-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.feeRealization())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.engagementTitle === 'E2E CA GST Filing Retainer')
      r.log('fee-realization-includes-our-engagement-as-invoiced', !!found && found.isInvoicedThisPeriod === true && Number(found.expectedFee) === 10000, JSON.stringify(found))
    })

    await r.step('generate-next-period-invoice-and-verify-delete-guard', async () => {
      if (!engagementId) return
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const nextPeriod = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
      const nextRes = await page.evaluate(({ id, period }) => window.api.engagement.generateInvoice({ id, period }), { id: engagementId, period: nextPeriod })
      r.log('next-period-invoice-succeeds', !!nextRes?.success, JSON.stringify(nextRes?.error || ''))

      const delRes = await page.evaluate((id) => window.api.engagement.delete({ id }), engagementId)
      r.log('delete-blocked-once-invoiced-EN29-006', delRes?.success === false && delRes?.error?.code === 'EN29-006', JSON.stringify(delRes?.error))
    })

    await r.step('create-compliance-task-via-real-ui', async () => {
      await h.gotoHash(page, '#/ca-cs/compliance')
      await page.waitForTimeout(700)
      r.log('compliance-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Task' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client *').selectOption(clientId)
      await modal.getByPlaceholder('e.g. GSTR-3B Filing — July 2026').fill('E2E CA GSTR-3B Filing Task')
      await modal.getByLabel('Category').selectOption('GST')
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(h.toLocalISODate(new Date(Date.now() + 15 * 24 * 3600000)))
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Task' }).click()
      await page.waitForTimeout(1200)
      r.log('compliance-task-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'ca-compliance-task-created')
    })

    await r.step('verify-compliance-task-via-api', async () => {
      const listRes = await page.evaluate(async (cid) => window.api.complianceTask.list({ clientId: cid }), clientId)
      const found = (listRes?.data || []).find((t) => t.title === 'E2E CA GSTR-3B Filing Task')
      r.log('compliance-task-findable-via-api', !!found && found.category === 'GST' && found.status === 'PENDING', JSON.stringify(found))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CA_FIRM') {
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
      const taskIds = db.prepare("SELECT id FROM ComplianceTask WHERE title LIKE 'E2E CA%'").all().map((r2) => r2.id)
      for (const id of taskIds) { try { db.prepare('DELETE FROM ComplianceTask WHERE id = ?').run(id) } catch { /* noop */ } }
      // Engagement.delete is service-guarded once invoiced -- bypass via raw SQL.
      const engIds = db.prepare("SELECT id FROM Engagement WHERE title LIKE 'E2E CA%'").all().map((r2) => r2.id)
      for (const id of engIds) { try { db.prepare('DELETE FROM Engagement WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: complianceTasks', taskIds.length, 'engagements', engIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCA FIRM VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
