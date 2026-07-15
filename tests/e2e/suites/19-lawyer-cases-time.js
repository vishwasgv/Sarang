/**
 * Suite 19 — Lawyer vertical (legal_cases, time_entries). Real UI-driven
 * case creation and time-entry logging, then invoicing via the IPC call
 * directly (not wired to a button in this screen — see project memory).
 * See project_vertical_uat_research.md / project_final_testing_pass_2026_07_15.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Law'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-lawyer', async () => {
      const sw = await h.switchBusinessType(page, 'Lawyer')
      r.log('business-type-switched-to-lawyer', sw.to === 'LAWYER', JSON.stringify(sw))
    })

    let clientId

    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Law Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('client-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      clientId = custRes?.data?.id
    })

    await r.step('create-case-via-real-ui', async () => {
      await h.gotoHash(page, '#/legal/cases')
      await page.waitForTimeout(700)
      r.log('cases-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Case' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('OS/123/2024').fill('E2E/LAW/001')
      await modal.getByPlaceholder('Ramesh Sharma vs State of Maharashtra').fill('E2E Law Test vs Opposing Party')
      await modal.getByPlaceholder('District Court, Mumbai').fill('E2E District Court')
      await modal.getByLabel('Client').selectOption(clientId)
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Case' }).click()
      await page.waitForTimeout(1200)
      r.log('case-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'lawyer-case-created')
    })

    let caseId

    await r.step('case-findable-and-clickable', async () => {
      const row = page.locator('tr', { hasText: 'E2E/LAW/001' }).first()
      r.log('case-row-visible-in-list', await row.count() > 0)
      await row.click()
      await page.waitForTimeout(800)
      r.log('detail-panel-loads-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let entryId

    await r.step('log-time-entry-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Log Time' }).first().click()
      await page.waitForTimeout(400)

      await page.getByPlaceholder('0.5').fill('2')
      await page.getByPlaceholder('Drafted petition, reviewed documents...').fill('E2E test drafting work')
      await page.getByPlaceholder('500').fill('1000')
      await page.waitForTimeout(300)

      const amountText = page.locator('text=Amount: ₹2,000.00')
      r.log('amount-live-computed-correctly', await amountText.count() > 0)

      await page.getByRole('button', { name: 'Log Time', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('time-entry-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'lawyer-time-entry-logged')
    })

    await r.step('verify-case-and-time-entry-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.legalCase.list({}))
      const cases = listRes?.data?.cases || listRes?.data || []
      const created = cases.find((c) => c.caseNumber === 'E2E/LAW/001')
      caseId = created?.id
      r.log('case-findable-via-api', !!caseId)

      if (caseId) {
        const detailRes = await page.evaluate(async (id) => window.api.legalCase.get({ id }), caseId)
        const entries = detailRes?.data?.timeEntries || []
        const entry = entries.find((e) => e.description === 'E2E test drafting work')
        entryId = entry?.id
        r.log('time-entry-findable-via-api', !!entryId, JSON.stringify({ hours: entry?.hours, amount: entry?.amount }))
      }
    })

    await r.step('generate-invoice-from-time-entry-via-ipc', async () => {
      if (!entryId) return r.log('generate-invoice-from-time-entry-via-ipc', false, 'no entryId captured')
      const res = await page.evaluate(async (id) => window.api.timeEntry.generateInvoice({ ids: [id] }), entryId)
      r.log('invoice-generated-successfully', !!res?.success, JSON.stringify(res?.error || ''))

      const invoiceId = res?.data?.invoiceId
      const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-has-total-2360-incl-18pct-gst', invRes?.data?.totalAmount ? Math.abs(invRes.data.totalAmount - 2000 * 1.18) < 1 : false, JSON.stringify(invRes?.data?.totalAmount))

      const retryRes = await page.evaluate(async (id) => window.api.timeEntry.generateInvoice({ ids: [id] }), entryId)
      r.log('double-invoicing-same-entry-rejected', retryRes?.success === false && retryRes?.error?.code === 'TE28-008', JSON.stringify(retryRes?.error))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'LAWYER') {
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
      const teIds = db.prepare("SELECT id FROM TimeEntry WHERE description LIKE 'E2E test%'").all().map((r2) => r2.id)
      for (const id of teIds) { try { db.prepare('DELETE FROM TimeEntry WHERE id = ?').run(id) } catch { /* noop */ } }
      const caseIds = db.prepare("SELECT id FROM LegalCase WHERE caseNumber LIKE 'E2E/LAW/%'").all().map((r2) => r2.id)
      for (const id of caseIds) { try { db.prepare('DELETE FROM LegalCase WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: timeEntries', teIds.length, 'cases', caseIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLAWYER VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
