/**
 * Suite 37 — Car Service Center vertical (car_job_cards). Real UI-driven
 * job card creation with a priced service item, status ladder advance
 * (RECEIVED -> INSPECTION -> IN_PROGRESS -> READY), and invoicing.
 * See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CarSvc'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-car-service-center', async () => {
      const sw = await h.switchBusinessType(page, 'Car Service Center')
      r.log('business-type-switched', sw.to === 'CAR_SERVICE_CENTER', JSON.stringify(sw))
    })

    await r.step('create-job-card-via-real-ui', async () => {
      await h.gotoHash(page, '#/carservice/jobs')
      await page.waitForTimeout(700)
      r.log('jobs-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Job Card' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E CarSvc Client')
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E CarSvc Client')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      await modal.getByPlaceholder('KA 01 AB 1234').fill('KA01E2E9999')
      await modal.getByPlaceholder('Toyota').fill('Toyota')
      await modal.getByPlaceholder('Innova Crysta').fill('Innova')
      await page.waitForTimeout(300)

      // Add a priced service item.
      const addServiceBtn = modal.getByRole('button', { name: 'Add', exact: true }).first()
      await addServiceBtn.click()
      await page.waitForTimeout(300)
      await modal.getByPlaceholder('Service name').fill('E2E Oil Change')
      await modal.getByPlaceholder('₹ Rate').first().fill('1500')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Job Card' }).click()
      await page.waitForTimeout(1200)
      r.log('job-card-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'carservice-jobcard-created')
    })

    let jobCardId

    await r.step('verify-job-card-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.carJobCard.list({}))
      const cards = listRes?.data || []
      const found = cards.find((c) => c.vehicleNumber === 'KA01E2E9999')
      jobCardId = found?.id
      r.log('job-card-findable-via-api', !!jobCardId, JSON.stringify({ status: found?.status, laborTotal: found?.laborTotal }))
    })

    await r.step('advance-status-to-ready-via-real-ui', async () => {
      // RECEIVED -> INSPECTION -> IN_PROGRESS -> READY (3 clicks; WAITING_PARTS
      // is skipped by the default ladder per STATUS_NEXT in the source).
      for (let i = 0; i < 3; i++) {
        const advanceBtn = page.locator('button', { hasText: '→' })
        if (await advanceBtn.count() === 0) break
        await advanceBtn.first().click()
        await page.waitForTimeout(800)
      }
      const res = await page.evaluate((id) => window.api.carJobCard.get(id), jobCardId)
      r.log('job-card-reached-ready', res?.data?.status === 'READY', JSON.stringify(res?.data?.status))
    })

    await r.step('generate-invoice-via-real-ui', async () => {
      const genBtn = page.getByRole('button', { name: 'Invoice' })
      r.log('invoice-button-present-at-ready', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!jobCardId) return r.log('verify-invoice-via-api', false, 'no jobCardId captured')
      const res = await page.evaluate((id) => window.api.carJobCard.get(id), jobCardId)
      const invoiceId = res?.data?.invoiceId
      r.log('job-card-has-invoice-id', !!invoiceId, JSON.stringify(invoiceId))
      if (invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        const expectedTotal = 1500 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CAR_SERVICE_CENTER') {
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
      const ids = db.prepare("SELECT id FROM CarJobCard WHERE vehicleNumber = 'KA01E2E9999'").all().map((r2) => r2.id)
      for (const id of ids) { try { db.prepare('DELETE FROM CarJobCard WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: jobCards', ids.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCAR SERVICE CENTER VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
