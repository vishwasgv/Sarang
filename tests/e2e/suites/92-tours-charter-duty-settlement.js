/**
 * Suite 92 — Tours & Travels vertical (2026-09 §12), part 1. Zero prior E2E
 * coverage existed for this vertical before this suite. Covers vehicle
 * fleet creation via the real i18n'd UI, a charter booking with an
 * included-km/hour allowance, driver duty start/close with the excess-km/
 * hour settlement math driving a real invoice amount, vehicle service
 * logging, and the Vehicle Service Due report.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Tours'

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
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date()))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  const genBtn = page.locator('button:has-text("Generate Report")')
  if (await genBtn.count() > 0) await genBtn.click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
  await h.shot(page, `report-${tileId}`)
}

function toDateTimeLocal(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-tours-travels', async () => {
      // Warm up the industry-settings route first — a cold Vite-dev module
      // load for a route not yet visited this session can take longer than
      // the harness's own fixed 600ms wait inside switchBusinessType.
      await h.gotoHash(page, '#/settings/industry')
      await page.waitForTimeout(1500)
      const sw = await h.switchBusinessType(page, 'Tours & Travels')
      r.log('business-type-switched', sw.to === 'TOURS_TRAVELS', JSON.stringify(sw))
    })

    const regNumber = `E2E Tours ${String(Date.now()).slice(-6)}`
    let customerId, driverId

    await r.step('create-vehicle-via-real-ui', async () => {
      await h.gotoHash(page, '#/tours/fleet')
      await page.waitForTimeout(700)
      r.log('fleet-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('screen-title-visible', (await page.locator('body').innerText().catch(() => '')).includes('Vehicle Fleet'))

      await page.locator('button:has-text("New Vehicle")').click()
      await page.waitForTimeout(400)
      await page.getByLabel('Registration Number', { exact: true }).fill(regNumber)
      await page.getByLabel('Vehicle Type', { exact: true }).selectOption('SEDAN')
      const capacityInput = page.getByLabel('Seating Capacity', { exact: true })
      await capacityInput.fill('')
      await capacityInput.fill('4')
      await page.locator('button:has-text("Add Vehicle")').click()
      await page.waitForTimeout(900)
      r.log('vehicle-created-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('vehicle-visible-in-list', (await page.locator('body').innerText().catch(() => '')).includes(regNumber))
    })

    await r.step('vehicle-status-change-via-real-ui', async () => {
      // Real bug found+fixed this session: vehicle.updateStatus existed in
      // the backend/IPC with zero UI surface — a vehicle could never be
      // marked IN_SERVICE, permanently stuck ACTIVE. Verifies the fix.
      const statusSelect = page.getByLabel('Change vehicle status', { exact: true }).first()
      await statusSelect.selectOption('IN_SERVICE')
      await page.waitForTimeout(800)
      r.log('vehicle-status-change-no-crash', !(await h.hasErrorBoundary(page)))
      const afterInService = await page.evaluate(() => window.api.vehicle.list())
      const found1 = (afterInService?.data || []).find((v) => v.registrationNumber === regNumber)
      r.log('vehicle-status-changed-to-in-service', found1?.status === 'IN_SERVICE', found1?.status)

      // Flip back to ACTIVE — the rest of this suite needs the vehicle
      // bookable (createCharterBooking rejects a non-ACTIVE vehicle).
      await statusSelect.selectOption('ACTIVE')
      await page.waitForTimeout(800)
      const afterActive = await page.evaluate(() => window.api.vehicle.list())
      const found2 = (afterActive?.data || []).find((v) => v.registrationNumber === regNumber)
      r.log('vehicle-status-changed-back-to-active', found2?.status === 'ACTIVE', found2?.status)
    })

    await r.step('create-customer-and-driver-via-api', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Tours Regular Customer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))

      const drvRes = await page.evaluate(async (joinDate) => window.api.hr.createEmployee({
        fullName: 'E2E Tours Driver', joinDate,
      }), h.toLocalISODate(new Date()))
      driverId = drvRes?.data?.id
      r.log('driver-created', !!driverId, JSON.stringify(drvRes?.error || ''))
    })

    let vehicleId

    await r.step('fetch-vehicle-id-via-api', async () => {
      const listRes = await page.evaluate(() => window.api.vehicle.list())
      const found = (listRes?.data || []).find((v) => v.registrationNumber === regNumber)
      vehicleId = found?.id
      r.log('vehicle-findable-via-api', !!vehicleId)
    })

    let bookingId, bookingNumber

    await r.step('create-charter-booking-via-real-ui', async () => {
      if (!vehicleId) return
      await h.gotoHash(page, '#/tours/bookings')
      await page.waitForTimeout(700)
      r.log('bookings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("New Charter Booking")').click()
      await page.waitForTimeout(400)

      await page.getByPlaceholder('Search by name or phone...').fill('E2E Tours Regular Customer')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Tours Regular Customer' }).first().click()
      await page.waitForTimeout(300)

      await page.getByLabel('Vehicle', { exact: true }).selectOption(vehicleId)
      const today = h.toLocalISODate(new Date())
      await page.getByLabel('Trip Start Date', { exact: true }).fill(today)

      const packageRateInput = page.getByLabel('Package Rate', { exact: true })
      await packageRateInput.fill('')
      await packageRateInput.fill('5000')
      const includedKmInput = page.getByLabel('Included Km/Day', { exact: true })
      await includedKmInput.fill('')
      await includedKmInput.fill('100')
      const includedHoursInput = page.getByLabel('Included Hours/Day', { exact: true })
      await includedHoursInput.fill('')
      await includedHoursInput.fill('1')
      const advanceInput = page.getByLabel('Advance Amount', { exact: true })
      await advanceInput.fill('')
      await advanceInput.fill('1000')
      await page.getByLabel('Referring Agent', { exact: true }).fill('E2E Tours Agent Priya')
      await page.getByLabel('Commission Type', { exact: true }).selectOption('PERCENTAGE')
      const commissionValueInput = page.getByLabel('Commission Value', { exact: true })
      if (await commissionValueInput.count() > 0) {
        await commissionValueInput.fill('')
        await commissionValueInput.fill('10')
      }

      await page.locator('button:has-text("Create Booking")').click()
      await page.waitForTimeout(1200)
      r.log('charter-booking-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.tripBooking.list({ bookingType: 'CHARTER' }))
      const found = (listRes?.data || []).find((b) => b.vehicle?.registrationNumber === regNumber)
      bookingId = found?.id
      bookingNumber = found?.bookingNumber
      r.log('charter-booking-findable-via-api', !!bookingId, JSON.stringify({ packageRate: found?.packageRate, includedKmPerDay: found?.includedKmPerDay }))
    })

    await r.step('start-duty-via-real-ui', async () => {
      if (!bookingId) return
      const startBtn = page.locator('button:has-text("Start Duty")').first()
      await startBtn.click()
      await page.waitForTimeout(400)

      await page.getByLabel('Driver', { exact: true }).selectOption(driverId)
      await page.getByLabel('Start Odometer', { exact: true }).fill('1000')
      const now = new Date()
      await page.getByLabel('Duty Start Time', { exact: true }).fill(toDateTimeLocal(now))

      // Modal's own submit button shares the same "Start Duty" text as the
      // row-level button that opened it — it's the last one rendered.
      await page.locator('button:has-text("Start Duty")').last().click()
      await page.waitForTimeout(1000)
      r.log('duty-started-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((id) => window.api.driverDutyLog.list({ tripBookingId: id }), bookingId)
      r.log('duty-log-created-via-api', (listRes?.data || []).length > 0, JSON.stringify(listRes?.data?.[0]?.startOdometer))
    })

    await r.step('close-duty-via-real-ui-triggers-excess-charge', async () => {
      if (!bookingId) return
      const closeBtn = page.locator('button:has-text("Close Duty")').first()
      if (await closeBtn.count() === 0) { r.log('close-duty-button-present', false); return }
      await closeBtn.click()
      await page.waitForTimeout(400)

      // 1000 -> 1300 = 300km driven vs. 100 included = 200km excess @
      // SEDAN's ₹12/km = ₹2400. 3 hours vs. 1 included = 2 excess hours @
      // the flat ₹100/hr rate = ₹200. Total excess = ₹2600.
      await page.getByLabel('End Odometer', { exact: true }).fill('1300')
      const end = new Date(Date.now() + 3 * 3600000)
      await page.getByLabel('Duty End Time', { exact: true }).fill(toDateTimeLocal(end))

      await page.locator('button:has-text("Close Duty")').last().click()
      await page.waitForTimeout(1000)
      r.log('duty-closed-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((id) => window.api.driverDutyLog.list({ tripBookingId: id }), bookingId)
      const log = (listRes?.data || [])[0]
      r.log('excess-km-charge-correct', log?.excessKmCharge === 2400, JSON.stringify({ excessKm: log?.excessKm, excessKmCharge: log?.excessKmCharge }))
      r.log('excess-hour-charge-correct', log?.excessHourCharge === 200, JSON.stringify({ excessHours: log?.excessHours, excessHourCharge: log?.excessHourCharge }))
    })

    await r.step('generate-invoice-includes-excess-charge', async () => {
      if (!bookingId) return
      const genBtn = page.locator('button:has-text("Generate Invoice")').first()
      if (await genBtn.count() === 0) { r.log('generate-invoice-button-present', false); return }
      await genBtn.click()
      await page.waitForTimeout(1200)
      r.log('invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))

      const bookingRes = await page.evaluate((id) => window.api.tripBooking.list({ bookingType: 'CHARTER' }).then((res) => (res?.data || []).find((b) => b.id === id)), bookingId)
      const invoiceId = bookingRes?.invoiceId
      r.log('booking-has-invoice', !!invoiceId && invoiceId !== 'CLAIMING')
      if (invoiceId && invoiceId !== 'CLAIMING') {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        // packageRate 5000 + excess 2600 = 7600.
        r.log('invoice-total-includes-excess-charge', invRes?.data?.totalAmount === 7600, JSON.stringify(invRes?.data?.totalAmount))
        r.log('advance-applied-as-payment', (invRes?.data?.paidAmount ?? 0) >= 1000, JSON.stringify(invRes?.data?.paidAmount))
      }
    })

    await r.step('log-vehicle-service-via-real-ui', async () => {
      await h.gotoHash(page, '#/tours/fleet')
      await page.waitForTimeout(700)
      const serviceBtn = page.locator('button:has-text("Service Log")').first()
      if (await serviceBtn.count() === 0) { r.log('service-log-button-present', false); return }
      await serviceBtn.click()
      await page.waitForTimeout(400)

      await page.getByLabel('Service Date', { exact: true }).fill(h.toLocalISODate(new Date()))
      await page.getByLabel('Type', { exact: true }).selectOption('SERVICE')
      await page.getByLabel('Odometer Reading', { exact: true }).fill('1300')
      await page.getByLabel('Cost', { exact: true }).fill('1500')
      await page.locator('button:has-text("Log Service")').click()
      await page.waitForTimeout(900)
      r.log('service-logged-no-crash', !(await h.hasErrorBoundary(page)))

      if (vehicleId) {
        const logsRes = await page.evaluate((id) => window.api.vehicle.listServiceLogs({ vehicleId: id }), vehicleId)
        r.log('service-log-findable-via-api', (logsRes?.data || []).length > 0, JSON.stringify(logsRes?.data?.[0]?.cost))
      }
    })

    await r.step('vehicle-service-due-report', () => checkReportTile(page, r, 'vehicleServiceDue', 'Vehicle Service Due', { needsDateRange: false }))

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'TOURS_TRAVELS') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const bookingIds = db.prepare("SELECT tb.id FROM TripBooking tb JOIN Customer c ON c.id = tb.customerId WHERE c.customerName LIKE 'E2E Tours%'").all().map((row) => row.id)
      for (const id of bookingIds) {
        try { db.prepare('DELETE FROM DriverDutyLog WHERE tripBookingId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TripBooking WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const vehicleIds = db.prepare("SELECT id FROM TourVehicle WHERE registrationNumber LIKE 'E2E Tours%'").all().map((row) => row.id)
      for (const id of vehicleIds) {
        try { db.prepare('DELETE FROM VehicleServiceLog WHERE vehicleId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TripBooking WHERE vehicleId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TourVehicle WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Tours%'").all().map((row) => row.id)
      for (const id of empIds) {
        try { db.prepare('DELETE FROM DriverDutyLog WHERE driverId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Employee WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: tripBookings/vehicles/employees', bookingIds.length, vehicleIds.length, empIds.length)
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTOURS & TRAVELS CHARTER/DUTY: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
