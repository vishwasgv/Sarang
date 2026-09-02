/**
 * Suite 93 — Tours & Travels vertical (2026-09 §12), part 2. Covers tour
 * package + departure management, atomic seat-in-coach booking via the real
 * i18n'd UI, the Commission by Agent report, and the Trip Profitability wow
 * feature (revenue + excess charges minus driver cost, fuel estimate,
 * maintenance estimate, and commission).
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

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-tours-travels', async () => {
      await h.gotoHash(page, '#/settings/industry')
      await page.waitForTimeout(1500)
      const sw = await h.switchBusinessType(page, 'Tours & Travels')
      r.log('business-type-switched', sw.to === 'TOURS_TRAVELS', JSON.stringify(sw))
    })

    const packageName = `E2E Tours Kerala Package ${String(Date.now()).slice(-6)}`
    let customer1Id, customer2Id, vehicleId

    await r.step('create-customers-and-vehicle-via-api', async () => {
      const cust1Res = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Tours Seat Customer One', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customer1Id = cust1Res?.data?.id
      const cust2Res = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Tours Seat Customer Two', phone: `8${String(Date.now()).slice(-9)}`,
      }))
      customer2Id = cust2Res?.data?.id
      r.log('customers-created', !!customer1Id && !!customer2Id)

      const vehRes = await page.evaluate(async () => window.api.vehicle.create({
        registrationNumber: `E2E Tours ${String(Date.now()).slice(-6)}B`, vehicleType: 'MINI_BUS', seatingCapacity: 12,
      }))
      vehicleId = vehRes?.data?.id
      r.log('vehicle-created-via-api', !!vehicleId, JSON.stringify(vehRes?.error || ''))
    })

    let packageId

    await r.step('create-tour-package-via-real-ui', async () => {
      await h.gotoHash(page, '#/tours/packages')
      await page.waitForTimeout(700)
      r.log('packages-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('screen-title-visible', (await page.locator('body').innerText().catch(() => '')).includes('Tour Packages'))

      await page.locator('button:has-text("New Package")').click()
      await page.waitForTimeout(400)
      await page.getByLabel('Package Name', { exact: true }).fill(packageName)
      await page.getByLabel('Itinerary', { exact: true }).fill('Day 1: Munnar, Day 2: Alleppey houseboat, Day 3: Kochi')
      const durationInput = page.getByLabel('Duration (Days)', { exact: true })
      await durationInput.fill('')
      await durationInput.fill('3')
      const seatsInput = page.getByLabel('Default Seats', { exact: true })
      await seatsInput.fill('')
      await seatsInput.fill('10')
      const fareInput = page.getByLabel('Fare per Seat', { exact: true })
      await fareInput.fill('')
      await fareInput.fill('2500')
      await page.locator('button:has-text("Add Package")').click()
      await page.waitForTimeout(900)
      r.log('package-created-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('package-visible-in-list', (await page.locator('body').innerText().catch(() => '')).includes(packageName))

      const listRes = await page.evaluate(() => window.api.tourPackage.list())
      const found = (listRes?.data || []).find((p) => p.packageName === packageName)
      packageId = found?.id
      r.log('package-findable-via-api', !!packageId, JSON.stringify({ farePerSeat: found?.farePerSeat }))
    })

    await r.step('package-active-toggle-via-real-ui', async () => {
      // Real bug found+fixed this session: the screen read a nonexistent
      // `pkg.status` field (the real Prisma field is `isActive: boolean`),
      // so the status badge silently always showed as inactive/undefined,
      // and there was no UI control to change it at all. Verifies the fix.
      if (!packageId) return
      await page.locator('button', { hasText: packageName }).first().click()
      await page.waitForTimeout(400)
      await page.locator('button:has-text("Deactivate")').click()
      await page.waitForTimeout(800)
      r.log('package-deactivate-no-crash', !(await h.hasErrorBoundary(page)))
      const afterDeactivate = await page.evaluate(() => window.api.tourPackage.list())
      const found1 = (afterDeactivate?.data || []).find((p) => p.id === packageId)
      r.log('package-deactivated', found1?.isActive === false, JSON.stringify(found1?.isActive))

      await page.locator('button:has-text("Activate")').click()
      await page.waitForTimeout(800)
      const afterActivate = await page.evaluate(() => window.api.tourPackage.list())
      const found2 = (afterActivate?.data || []).find((p) => p.id === packageId)
      r.log('package-reactivated', found2?.isActive === true, JSON.stringify(found2?.isActive))

      // Collapse the card again — the next step expects to open it fresh.
      await page.locator('button', { hasText: packageName }).first().click()
      await page.waitForTimeout(300)
    })

    let departureId
    const departureDate = h.toLocalISODate(new Date(Date.now() + 14 * 86400000))

    await r.step('add-departure-and-book-seats-via-real-ui', async () => {
      if (!packageId) return
      // Expand the package card to reveal the departures section.
      await page.locator('button', { hasText: packageName }).first().click()
      await page.waitForTimeout(400)

      await page.locator('button:has-text("Add Departure")').click()
      await page.waitForTimeout(300)
      await page.getByLabel('Departure Date', { exact: true }).fill(departureDate)
      const totalSeatsInput = page.getByLabel('Total Seats', { exact: true })
      await totalSeatsInput.fill('')
      await totalSeatsInput.fill('10')
      await page.locator('button:has-text("Save")').click()
      await page.waitForTimeout(900)
      r.log('departure-added-no-crash', !(await h.hasErrorBoundary(page)))

      const depRes = await page.evaluate((pid) => window.api.tourPackage.listDepartures({ tourPackageId: pid }), packageId)
      const dep = (depRes?.data || [])[0]
      departureId = dep?.id
      r.log('departure-findable-via-api', !!departureId, JSON.stringify({ totalSeats: dep?.totalSeats, seatsBooked: dep?.seatsBooked }))

      if (!departureId) return
      const bookSeatsBtn = page.locator('button:has-text("Book Seats")').first()
      if (await bookSeatsBtn.count() === 0) { r.log('book-seats-button-present', false); return }
      await bookSeatsBtn.click()
      await page.waitForTimeout(400)

      await page.getByPlaceholder('Search by name or phone...').fill('E2E Tours Seat Customer One')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Tours Seat Customer One' }).first().click()
      await page.waitForTimeout(300)

      const seatsToBookInput = page.getByLabel('Seats to Book', { exact: true })
      await seatsToBookInput.fill('')
      await seatsToBookInput.fill('3')
      const advanceInput = page.getByLabel('Advance Amount', { exact: true })
      await advanceInput.fill('')
      await advanceInput.fill('1500')

      await page.locator('button:has-text("Confirm Booking")').click()
      await page.waitForTimeout(1000)
      r.log('seat-booking-created-no-crash', !(await h.hasErrorBoundary(page)))

      const depAfterRes = await page.evaluate((pid) => window.api.tourPackage.listDepartures({ tourPackageId: pid }), packageId)
      const depAfter = (depAfterRes?.data || [])[0]
      // 3 seats booked atomically incremented against the departure.
      r.log('seats-booked-atomically-incremented', depAfter?.seatsBooked === 3, JSON.stringify(depAfter?.seatsBooked))
    })

    let agentBookingNumber

    await r.step('second-seat-booking-with-agent-commission-via-api', async () => {
      if (!departureId || !customer2Id) return
      const res = await page.evaluate(({ custId, depId }) => window.api.tripBooking.createSeat({
        customerId: custId, tourDepartureId: depId, seatsBooked: 2,
        referringAgentName: 'E2E Tours Agent Ramesh', commissionType: 'PERCENTAGE', commissionValue: 8,
      }), { custId: customer2Id, depId: departureId })
      r.log('agent-seat-booking-created', !!res?.success, JSON.stringify(res?.error || ''))
      // seats 2 x farePerSeat 2500 = 5000; 8% commission = 400.
      r.log('agent-booking-package-rate-correct', res?.data?.packageRate === 5000, JSON.stringify(res?.data?.packageRate))
      agentBookingNumber = res?.data?.bookingNumber
    })

    await r.step('commission-by-agent-report', () => checkReportTile(page, r, 'commissionByAgent', 'Commission by Agent', { needsDateRange: true }))

    await r.step('cancel-seat-booking-via-real-ui-releases-seats', async () => {
      // Real bug found+fixed this session: cancelling a SEAT booking never
      // released its held seats back to the departure — they stayed
      // phantom-held forever, permanently shrinking real capacity. Verifies
      // the fix through the real "Cancel Booking" UI this session also added.
      if (!agentBookingNumber || !departureId) return
      await h.gotoHash(page, '#/tours/bookings')
      await page.waitForTimeout(700)
      const row = page.locator('div.space-y-2', { has: page.getByText(agentBookingNumber, { exact: true }) })
      const cancelBtn = row.locator('button:has-text("Cancel Booking")')
      r.log('cancel-booking-button-present', await cancelBtn.count() > 0)
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click()
        await page.waitForTimeout(1000)
        r.log('cancel-booking-no-crash', !(await h.hasErrorBoundary(page)))
        const bookingsRes = await page.evaluate(() => window.api.tripBooking.list({ bookingType: 'SEAT' }))
        const agentBooking = (bookingsRes?.data || []).find((b) => b.bookingNumber === agentBookingNumber)
        r.log('diagnostic: agent-booking-status-after-cancel-click', agentBooking?.status === 'CANCELLED', JSON.stringify({ status: agentBooking?.status, seatsBooked: agentBooking?.seatsBooked }))
        const depRes = await page.evaluate((pid) => window.api.tourPackage.listDepartures({ tourPackageId: pid }), packageId)
        const dep = (depRes?.data || [])[0]
        // 5 seats booked (3 UI + 2 agent) minus the 2 just cancelled = 3.
        r.log('seats-released-back-to-departure', dep?.seatsBooked === 3, JSON.stringify(dep?.seatsBooked))
      }
    })

    let charterBookingId

    await r.step('create-and-complete-charter-booking-for-profitability-via-api', async () => {
      if (!vehicleId || !customer1Id) return
      const todayLocal = h.toLocalISODate(new Date())
      const bookRes = await page.evaluate(({ custId, vehId, today }) => window.api.tripBooking.createCharter({
        customerId: custId, vehicleId: vehId, tripStartDate: today,
        packageRate: 6000, includedKmPerDay: 200, includedHoursPerDay: 10,
      }), { custId: customer1Id, vehId: vehicleId, today: todayLocal })
      charterBookingId = bookRes?.data?.id
      r.log('charter-booking-for-profitability-created', !!charterBookingId, JSON.stringify(bookRes?.error || ''))

      if (!charterBookingId) return
      const drvRes = await page.evaluate(async (joinDate) => window.api.hr.createEmployee({
        fullName: 'E2E Tours Profitability Driver', joinDate,
      }), todayLocal)
      const driverId = drvRes?.data?.id

      const startRes = await page.evaluate(({ bookingId, drvId, dutyDate }) => window.api.driverDutyLog.start({
        tripBookingId: bookingId, driverId: drvId, dutyDate,
        startOdometer: 2000, dutyStartTime: new Date().toISOString(), driverBataAmount: 500,
      }), { bookingId: charterBookingId, drvId: driverId, dutyDate: todayLocal })
      const dutyLogId = startRes?.data?.id
      r.log('duty-started-for-profitability', !!dutyLogId)

      if (dutyLogId) {
        const closeRes = await page.evaluate(({ id, endTime }) => window.api.driverDutyLog.close({
          id, endOdometer: 2150, dutyEndTime: endTime,
        }), { id: dutyLogId, endTime: new Date(Date.now() + 2 * 3600000).toISOString() })
        r.log('duty-closed-for-profitability', !!closeRes?.success)
      }

      const invRes = await page.evaluate((id) => window.api.tripBooking.generateInvoice({ id }), charterBookingId)
      r.log('charter-invoiced-for-profitability', !!invRes?.success, JSON.stringify(invRes?.error || ''))
    })

    await r.step('trip-profitability-report', () => checkReportTile(page, r, 'tripProfitability', 'Trip Profitability', { needsDateRange: true }))

    await r.step('trip-profitability-data-correct-via-api', async () => {
      if (!charterBookingId) return
      // .toISOString() truncates to the UTC date, not local — a real gotcha
      // this codebase has hit before (see feedback_e2e_datetime_backdate_
      // and_stale_hash_nav memory). h.toLocalISODate() is the correct source
      // for a date-only string matched against a local-timezone-parsed
      // report window.
      const today = h.toLocalISODate(new Date())
      const res = await page.evaluate((d) => window.api.reports.tripProfitability({ dateFrom: d, dateTo: d }), today)
      const row = (res?.data?.rows || []).find((rw) => rw.bookingId === charterBookingId)
      // 150km driven, all within the 200km included allowance -> no excess.
      // revenue = 6000 (packageRate only). driverCost = 500 (Bata).
      // fuelCostEstimate = 150 * 8 = 1200. netProfit = 6000 - 500 - 1200 - maintenance(0) - commission(0) = 4300.
      r.log('profitability-row-found', !!row, JSON.stringify(row))
      if (row) {
        r.log('profitability-revenue-correct', row.revenue === 6000, String(row.revenue))
        r.log('profitability-fuel-estimate-correct', row.fuelCostEstimate === 1200, String(row.fuelCostEstimate))
        r.log('profitability-net-profit-correct', row.netProfit === 4300, String(row.netProfit))
      }
    })

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
      const depIds = db.prepare("SELECT td.id FROM TourDeparture td JOIN TourPackage tp ON tp.id = td.tourPackageId WHERE tp.packageName LIKE 'E2E Tours%'").all().map((row) => row.id)
      for (const id of depIds) {
        try { db.prepare('DELETE FROM TripBooking WHERE tourDepartureId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TourDeparture WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const pkgIds = db.prepare("SELECT id FROM TourPackage WHERE packageName LIKE 'E2E Tours%'").all().map((row) => row.id)
      for (const id of pkgIds) {
        try { db.prepare('DELETE FROM TourDeparture WHERE tourPackageId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TourPackage WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const vehicleIds = db.prepare("SELECT id FROM TourVehicle WHERE registrationNumber LIKE 'E2E Tours%'").all().map((row) => row.id)
      for (const id of vehicleIds) {
        try { db.prepare('DELETE FROM VehicleServiceLog WHERE vehicleId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TripBooking WHERE vehicleId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TourDeparture WHERE vehicleId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TourVehicle WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Tours%'").all().map((row) => row.id)
      for (const id of empIds) {
        try { db.prepare('DELETE FROM DriverDutyLog WHERE driverId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Employee WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: tripBookings/departures/packages/vehicles/employees', bookingIds.length, depIds.length, pkgIds.length, vehicleIds.length, empIds.length)
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTOURS & TRAVELS PACKAGES/COMMISSION/PROFITABILITY: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
