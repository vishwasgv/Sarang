/**
 * Suite 36 — Driving School vertical (learner_profiles, driving_sessions).
 * Real UI-driven learner profile upsert (any Customer can become one),
 * vehicle creation, session scheduling with fee, and invoicing.
 * session_packs is generic infra already covered by suite 30. Uses the
 * shared Tabs molecule (role="tab", per the lesson from suite 35). See
 * project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Drive'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-driving-school', async () => {
      const sw = await h.switchBusinessType(page, 'Driving School')
      r.log('business-type-switched', sw.to === 'DRIVING_SCHOOL', JSON.stringify(sw))
    })

    let learnerId

    await r.step('create-learner-and-profile-via-real-ui', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Drive Learner', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      learnerId = custRes?.data?.id
      r.log('learner-customer-created', !!custRes?.success)

      await h.gotoHash(page, '#/driving/learners')
      await page.waitForTimeout(700)
      r.log('driving-school-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const searchBox = page.getByPlaceholder('Search learner...')
      await searchBox.fill('E2E Drive Learner')
      await page.waitForTimeout(500)
      await page.locator('button', { hasText: 'E2E Drive Learner' }).first().click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: 'Save Profile' }).click()
      await page.waitForTimeout(1200)
      r.log('profile-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'driving-learner-profile-saved')
    })

    await r.step('verify-learner-profile-via-api', async () => {
      const res = await page.evaluate((cid) => window.api.learnerProfile.get({ customerId: cid }), learnerId)
      r.log('learner-profile-findable-via-api', !!res?.data, JSON.stringify({ licenseClass: res?.data?.licenseClass }))
    })

    let vehicleId

    await r.step('add-vehicle-via-real-ui', async () => {
      await page.getByRole('tab', { name: 'Vehicles' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'Add Vehicle' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('MH01AB1234').fill('MH12E2E999')
      await modal.getByPlaceholder('Maruti').fill('Maruti')
      await modal.getByPlaceholder('Alto').fill('Alto')
      await page.waitForTimeout(300)

      // The modal's submit button text is "Save Vehicle", not "Add Vehicle"
      // (that's only the header trigger's label).
      await modal.getByRole('button', { name: 'Save Vehicle' }).click()
      await page.waitForTimeout(1200)
      r.log('vehicle-added-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-vehicle-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.drivingVehicle.list({}))
      const vehicles = listRes?.data || []
      const found = vehicles.find((v) => v.registrationNumber === 'MH12E2E999')
      vehicleId = found?.id
      r.log('vehicle-findable-via-api', !!vehicleId, JSON.stringify({ make: found?.make, model: found?.model }))
    })

    let instructorId

    await r.step('create-instructor', async () => {
      const empRes = await page.evaluate(async () => window.api.hr.createEmployee({
        fullName: 'E2E Drive Instructor', phone: `8${String(Date.now()).slice(-9)}`, joinDate: new Date().toISOString().slice(0, 10),
      }))
      instructorId = empRes?.data?.id
      r.log('instructor-created', !!empRes?.success)
    })

    await r.step('schedule-session-via-real-ui', async () => {
      await page.getByRole('tab', { name: 'Sessions' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'Schedule Session' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Drive Learner')
      await page.waitForTimeout(700)
      const learnerOption = modal.locator('button', { hasText: 'E2E Drive Learner' }).first()
      r.log('learner-search-found-result', await learnerOption.count() > 0)
      await learnerOption.click()
      await page.waitForTimeout(300)

      // "Instructor *"/"Vehicle *" are raw <label> with no htmlFor (same
      // pattern as the rest of this screen) — getByLabel doesn't work.
      // CustomerPicker isn't a <select>, so Instructor is the first <select>
      // in the modal and Vehicle the second.
      const selects = modal.locator('select')
      await selects.nth(0).selectOption(instructorId)
      await selects.nth(1).selectOption(vehicleId)
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(new Date().toISOString().slice(0, 10))
      await modal.locator('input[type="time"]').fill('09:00')
      await modal.getByPlaceholder('e.g. 500').fill('600')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Schedule Session' }).click()
      await page.waitForTimeout(1200)
      r.log('session-scheduled-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'driving-session-scheduled')
    })

    let sessionId

    await r.step('verify-session-via-api', async () => {
      const listRes = await page.evaluate((lid) => window.api.drivingSession.list({ learnerId: lid }), learnerId)
      const sessions = listRes?.data || []
      const found = sessions[0]
      sessionId = found?.id
      r.log('session-findable-via-api', !!sessionId, JSON.stringify({ sessionFee: found?.sessionFee, status: found?.status }))
    })

    await r.step('generate-session-invoice-via-real-ui', async () => {
      const genBtn = page.locator('button[title="Generate Invoice"]').first()
      r.log('generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!sessionId) return r.log('verify-invoice-via-api', false, 'no sessionId captured')
      const listRes = await page.evaluate((lid) => window.api.drivingSession.list({ learnerId: lid }), learnerId)
      const sessions = listRes?.data || []
      const found = sessions.find((s) => s.id === sessionId)
      r.log('session-has-invoice-id', !!found?.invoiceId, JSON.stringify(found?.invoiceId))
      if (found?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), found.invoiceId)
        const expectedTotal = 600 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'DRIVING_SCHOOL') {
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
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Drive%'").all().map((r2) => r2.id)
      for (const eid of empIds) { try { db.prepare('DELETE FROM Employee WHERE id = ?').run(eid) } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(eid) } }
      const sessIds = db.prepare("SELECT id FROM DrivingSession WHERE learnerId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E Drive%')").all().map((r2) => r2.id)
      for (const id of sessIds) { try { db.prepare('DELETE FROM DrivingSession WHERE id = ?').run(id) } catch { /* noop */ } }
      const vehIds = db.prepare("SELECT id FROM DrivingVehicle WHERE registrationNumber = 'MH12E2E999'").all().map((r2) => r2.id)
      for (const id of vehIds) { try { db.prepare('DELETE FROM DrivingVehicle WHERE id = ?').run(id) } catch { /* noop */ } }
      const lpIds = db.prepare("SELECT id FROM LearnerProfile WHERE customerId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E Drive%')").all().map((r2) => r2.id)
      for (const id of lpIds) { try { db.prepare('DELETE FROM LearnerProfile WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: employees', empIds.length, 'sessions', sessIds.length, 'vehicles', vehIds.length, 'learnerProfiles', lpIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDRIVING SCHOOL VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
