/**
 * Suite 109 — carJobCard.delete + scheduleServiceReminder (broader-gap-list
 * Section C, 2026-09-03). update/generateInvoice are ALREADY covered by
 * suite 37 (status-ladder advance + the Invoice button) -- this closes the
 * two channels that suite genuinely never touches: the Delete (X) button
 * on a job card row, and the "Remind" button on the Vehicles-due view.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CarSvc2'

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

    let jobCardId
    await r.step('seed-job-card-with-next-service-due', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Client`)
      const clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))

      const jcRes = await page.evaluate(async (clientId) => window.api.carJobCard.create({
        clientId, vehicleNumber: 'KA01E2E8888', vehicleMake: 'Honda', vehicleModel: 'City',
      }), clientId)
      jobCardId = jcRes?.data?.id
      r.log('job-card-created', !!jobCardId, JSON.stringify(jcRes?.error || ''))
      if (!jobCardId) return

      // update itself is already proven covered (suite 37's status-ladder) --
      // used here purely as setup for the reminder test below.
      const dueDate = h.toLocalISODate(new Date(Date.now() + 10 * 24 * 3600000))
      const updRes = await page.evaluate(({ id, dueDate }) => window.api.carJobCard.update({ id, nextServiceDueDate: dueDate }), { id: jobCardId, dueDate })
      r.log('next-service-due-date-set', !!updRes?.success, JSON.stringify(updRes?.error || ''))
    })

    await r.step('schedule-service-reminder-via-ui', async () => {
      if (!jobCardId) return r.log('schedule-service-reminder-via-ui', false, 'no jobCardId')
      await h.gotoHash(page, '#/carservice/jobs')
      await page.waitForTimeout(700)
      r.log('jobs-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'Vehicles' }).click()
      await page.waitForTimeout(700)

      const row = page.locator('span', { hasText: 'KA01E2E8888' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      const remindBtn = row.getByRole('button', { name: /Remind/ })
      r.log('remind-button-present', await remindBtn.count() > 0)
      await remindBtn.click()
      await page.waitForTimeout(1200)
      r.log('remind-no-crash', !(await h.hasErrorBoundary(page)))

      const notif = h.withDb((db) => db.prepare("SELECT * FROM NotificationQueue WHERE notificationType = 'CAR_SERVICE_DUE_REMINDER' AND customerId = (SELECT clientId FROM CarJobCard WHERE id = ?)").get(jobCardId))
      r.log('reminder-queued', !!notif && notif.status === 'PENDING', JSON.stringify(notif))
    })

    await r.step('delete-job-card-via-ui', async () => {
      if (!jobCardId) return r.log('delete-job-card-via-ui', false, 'no jobCardId')
      await page.locator('button', { hasText: 'Job Cards' }).click()
      await page.waitForTimeout(700)

      // The job-card row shows the vehicle number in a plain <div> (not a
      // <span> like the Vehicles tab above) -- a bare `div` + hasText would
      // match the outermost container first (document order), so scope to
      // its exact class instead.
      const row = page.locator('div.text-sm.font-medium.text-gray-800', { hasText: 'KA01E2E8888' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.carJobCard.list({}))
      const stillThere = (listRes?.data || []).some((c) => c.id === jobCardId)
      r.log('job-card-actually-gone', !stillThere)
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
    h.withDb((db) => {
      const ids = db.prepare("SELECT id, clientId FROM CarJobCard WHERE vehicleNumber = 'KA01E2E8888'").all()
      let notifs = 0, jobCards = 0
      for (const jc of ids) {
        notifs += db.prepare("DELETE FROM NotificationQueue WHERE notificationType = 'CAR_SERVICE_DUE_REMINDER' AND customerId = ?").run(jc.clientId).changes
        try { jobCards += db.prepare('DELETE FROM CarJobCard WHERE id = ?').run(jc.id).changes } catch { /* noop */ }
      }
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E CarSvc2%'").all().map((r2) => r2.id)
      let custs = 0
      for (const cid of custIds) {
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ notifs, jobCards, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCAR JOB CARD REMIND/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
