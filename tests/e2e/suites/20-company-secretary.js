/**
 * Suite 20 — Company Secretary vertical (compliance_tasks, roc_filings,
 * board_meetings). Real UI-driven creation of all 3 record types. Per
 * project_vertical_uat_research.md this vertical has a REAL structural gap
 * (no invoicing wired for any of the 3 models) — this suite documents that
 * gap explicitly rather than testing a billing flow that doesn't exist.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CS'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-company-secretary', async () => {
      const sw = await h.switchBusinessType(page, 'Company Secretary')
      r.log('business-type-switched', sw.to === 'COMPANY_SECRETARY', JSON.stringify(sw))
    })

    let clientId

    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E CS Client Pvt Ltd', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('client-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      clientId = custRes?.data?.id
    })

    await r.step('create-compliance-task-via-real-ui', async () => {
      await h.gotoHash(page, '#/ca-cs/compliance')
      await page.waitForTimeout(700)
      r.log('compliance-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Task' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client *').selectOption(clientId)
      await modal.getByPlaceholder('e.g. GSTR-3B Filing — July 2026').fill('E2E CS Annual Filing Task')
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(new Date(Date.now() + 30 * 24 * 3600000).toISOString().slice(0, 10))
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Task' }).click()
      await page.waitForTimeout(1200)
      r.log('compliance-task-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cs-compliance-task-created')
    })

    await r.step('verify-compliance-task-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.complianceTask.list({}))
      const tasks = listRes?.data || []
      const found = tasks.find((t) => t.title === 'E2E CS Annual Filing Task')
      r.log('compliance-task-findable-via-api', !!found, JSON.stringify({ status: found?.status, priority: found?.priority }))
    })

    await r.step('create-roc-filing-via-real-ui', async () => {
      await h.gotoHash(page, '#/cs/roc-filings')
      await page.waitForTimeout(700)
      r.log('roc-filings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client').selectOption(clientId)
      await modal.getByPlaceholder('e.g. 2025-26').fill('2026-27')
      await modal.getByPlaceholder('e.g. Annual Return for FY 2025-26').fill('E2E CS Annual Return')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(1200)
      r.log('roc-filing-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cs-roc-filing-created')
    })

    await r.step('verify-roc-filing-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.rocFiling.list({}))
      const filings = listRes?.data || []
      const found = filings.find((f) => f.purpose === 'E2E CS Annual Return')
      r.log('roc-filing-findable-via-api', !!found, JSON.stringify({ formType: found?.formType, status: found?.status }))
    })

    await r.step('create-board-meeting-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Board Meetings' }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client').selectOption(clientId)
      const meetingDate = new Date(Date.now() + 14 * 24 * 3600000).toISOString().slice(0, 10)
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(meetingDate)
      await modal.getByPlaceholder('e.g. Registered Office').fill('E2E CS Registered Office')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(1200)
      r.log('board-meeting-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cs-board-meeting-created')
    })

    await r.step('verify-board-meeting-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.boardMeeting.list({}))
      const meetings = listRes?.data || []
      const found = meetings.find((m) => m.venue === 'E2E CS Registered Office')
      r.log('board-meeting-findable-via-api', !!found, JSON.stringify({ meetingType: found?.meetingType }))
    })

    await r.step('confirm-no-invoicing-path-exists-known-structural-gap', async () => {
      // Documented gap in project_vertical_uat_research.md: none of these 3
      // models have an invoiceId column or a generateInvoice IPC method.
      // Confirm the API surface genuinely has no such method (not a UI-only
      // omission) so this stays an accurate, current record of the gap.
      const apiSurface = await page.evaluate(() => ({
        complianceTaskKeys: Object.keys(window.api.complianceTask || {}),
        rocFilingKeys: Object.keys(window.api.rocFiling || {}),
        boardMeetingKeys: Object.keys(window.api.boardMeeting || {}),
      }))
      const noInvoiceMethod = (keys) => !keys.some((k) => /invoice/i.test(k))
      r.log('compliance-task-has-no-invoice-method', noInvoiceMethod(apiSurface.complianceTaskKeys), JSON.stringify(apiSurface.complianceTaskKeys))
      r.log('roc-filing-has-no-invoice-method', noInvoiceMethod(apiSurface.rocFilingKeys), JSON.stringify(apiSurface.rocFilingKeys))
      r.log('board-meeting-has-no-invoice-method', noInvoiceMethod(apiSurface.boardMeetingKeys), JSON.stringify(apiSurface.boardMeetingKeys))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'COMPANY_SECRETARY') {
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
      const ctIds = db.prepare("SELECT id FROM ComplianceTask WHERE title LIKE 'E2E CS%'").all().map((r2) => r2.id)
      for (const id of ctIds) { try { db.prepare('DELETE FROM ComplianceTask WHERE id = ?').run(id) } catch { /* noop */ } }
      const rocIds = db.prepare("SELECT id FROM ROCFiling WHERE purpose LIKE 'E2E CS%'").all().map((r2) => r2.id)
      for (const id of rocIds) { try { db.prepare('DELETE FROM ROCFiling WHERE id = ?').run(id) } catch { /* noop */ } }
      const bmIds = db.prepare("SELECT id FROM BoardMeeting WHERE venue LIKE 'E2E CS%'").all().map((r2) => r2.id)
      for (const id of bmIds) { try { db.prepare('DELETE FROM BoardMeeting WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: complianceTasks', ctIds.length, 'rocFilings', rocIds.length, 'boardMeetings', bmIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOMPANY SECRETARY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
