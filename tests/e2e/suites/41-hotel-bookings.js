/**
 * Suite 41 — Hotel / Lodge vertical (hotel_rooms, hotel_bookings,
 * hotel_guests, hotel_extra_charges). Real UI-driven chain: Room -> Booking
 * (availability check + customer link, required for invoicing per HTL-050)
 * -> Check-In (guest ID registration) -> Add Charge -> Check-Out -> Generate
 * Bill. See project_vertical_uat_research.md and hotel.service.ts.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Hotel'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-hotel-lodge', async () => {
      const sw = await h.switchBusinessType(page, 'Hotel / Lodge')
      r.log('business-type-switched', sw.to === 'HOTEL_LODGE', JSON.stringify(sw))
    })

    await r.step('create-room-via-real-ui', async () => {
      await h.gotoHash(page, '#/hotel/rooms')
      await page.waitForTimeout(700)
      r.log('rooms-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Room' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Room Number').fill('H-E2E9')
      await modal.getByLabel('Room Type').fill('Deluxe')
      await modal.getByLabel('Rate / Night').fill('3000')
      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('room-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'hotel-room-created')
    })

    await r.step('verify-room-via-api', async () => {
      const res = await page.evaluate(async () => window.api.hotel.listRooms({ includeInactive: true }))
      const rooms = res?.data?.rooms || []
      const found = rooms.find((rm) => rm.roomNumber === 'H-E2E9')
      r.log('room-findable-via-api', !!found, JSON.stringify({ status: found?.status, baseRate: found?.baseRate }))
    })

    let bookingId

    await r.step('create-booking-via-real-ui', async () => {
      await h.gotoHash(page, '#/hotel/bookings')
      await page.waitForTimeout(700)
      r.log('bookings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Booking' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Hotel Guest')
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E Hotel Guest')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      const today = new Date()
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      const fmt = (d) => h.toLocalISODate(d)
      await modal.getByLabel('Check-In Date').fill(fmt(today))
      await modal.getByLabel('Check-Out Date').fill(fmt(tomorrow))
      await modal.getByRole('button', { name: 'Check Available Rooms' }).click()
      await page.waitForTimeout(1000)

      await modal.getByLabel('Room').selectOption({ label: /H-E2E9/ }).catch(async () => {
        // selectOption with a regex label can fail depending on Playwright
        // version — fall back to reading the exact option text.
        const text = await modal.getByLabel('Room').locator('option', { hasText: 'H-E2E9' }).first().textContent()
        await modal.getByLabel('Room').selectOption({ label: (text || '').trim() })
      })
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Booking' }).click()
      await page.waitForTimeout(1200)
      r.log('booking-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'hotel-booking-created')
    })

    await r.step('verify-booking-via-api', async () => {
      const res = await page.evaluate(async () => window.api.hotel.listBookings())
      const bookings = res?.data?.bookings || []
      const found = bookings.find((b) => b.guestName === 'E2E Hotel Guest')
      bookingId = found?.id
      r.log('booking-findable-via-api', !!bookingId, JSON.stringify({ status: found?.status, nights: found?.nights, roomCharge: found?.roomCharge }))
    })

    await r.step('check-in-via-real-ui', async () => {
      const row = page.locator('tr', { hasText: 'E2E Hotel Guest' }).first()
      await row.click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Guest name').fill('E2E Hotel Guest')
      await modal.locator('select').first().selectOption('AADHAAR')
      await modal.getByPlaceholder('ID number').fill('E2E9999AADHAAR')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Check In' }).click()
      await page.waitForTimeout(1200)
      r.log('checked-in-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'hotel-checked-in')
    })

    await r.step('verify-checked-in-via-api', async () => {
      if (!bookingId) return r.log('verify-checked-in-via-api', false, 'no bookingId captured')
      const res = await page.evaluate((id) => window.api.hotel.getBooking({ id }), bookingId)
      r.log('booking-status-checked-in', res?.data?.status === 'CHECKED_IN', JSON.stringify(res?.data?.status))
    })

    await r.step('add-charge-and-check-out-via-real-ui', async () => {
      // No row click here — handleCheckIn's onChanged() refreshes the
      // already-open modal in place (see HotelBookingsScreen.tsx) rather
      // than closing it, so it's still open with Add Charge/Check Out
      // buttons now that the booking is CHECKED_IN. Re-clicking the table
      // row was always wrong: the still-open modal backdrop covers it,
      // which is exactly why that click used to hang until Playwright's
      // 30s actionability timeout — a test bug, not a product bug.
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Description').fill('E2E Room Service')
      await modal.getByPlaceholder('Unit Price').fill('500')
      await modal.getByRole('button', { name: 'Add Charge' }).click()
      await page.waitForTimeout(1000)
      r.log('charge-added-no-crash', !(await h.hasErrorBoundary(page)))

      await modal.getByRole('button', { name: 'Check Out' }).click()
      await page.waitForTimeout(1200)
      r.log('checked-out-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'hotel-checked-out')
    })

    await r.step('verify-checked-out-via-api', async () => {
      if (!bookingId) return r.log('verify-checked-out-via-api', false, 'no bookingId captured')
      const res = await page.evaluate((id) => window.api.hotel.getBooking({ id }), bookingId)
      r.log('booking-status-checked-out', res?.data?.status === 'CHECKED_OUT', JSON.stringify(res?.data?.status))
      r.log('extra-charge-recorded', (res?.data?.extraChargesTotal ?? 0) === 500, JSON.stringify(res?.data?.extraChargesTotal))
    })

    await r.step('generate-bill-via-real-ui', async () => {
      // Same reasoning as the previous step — handleCheckOut's onChanged()
      // also refreshes in place rather than closing the modal.
      const modal = h.topModal(page)

      const billBtn = modal.getByRole('button', { name: 'Generate Bill' })
      r.log('generate-bill-button-present', await billBtn.count() > 0)
      await billBtn.click()
      await page.waitForTimeout(1500)
      r.log('bill-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!bookingId) return r.log('verify-invoice-via-api', false, 'no bookingId captured')
      const res = await page.evaluate((id) => window.api.hotel.getBooking({ id }), bookingId)
      const invoiceId = res?.data?.invoiceId
      r.log('booking-has-invoice-id', !!invoiceId, JSON.stringify(invoiceId))
      if (invoiceId) {
        const invRes = await page.evaluate((iid) => window.api.billing.getInvoice(iid), invoiceId)
        // 1 night x Rs.3000 room charge + Rs.500 extra charge, both on
        // taxRate=0 placeholder products (hotel.service.ts) — no GST added.
        const expectedTotal = 3000 + 500
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'HOTEL_LODGE') {
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
      const bookingIds = db.prepare("SELECT id FROM HotelBooking WHERE guestName = 'E2E Hotel Guest'").all().map((r2) => r2.id)
      for (const id of bookingIds) {
        try { db.prepare('DELETE FROM HotelGuest WHERE bookingId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM HotelExtraCharge WHERE bookingId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM HotelBooking WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const roomIds = db.prepare("SELECT id FROM HotelRoom WHERE roomNumber = 'H-E2E9'").all().map((r2) => r2.id)
      for (const id of roomIds) { try { db.prepare('DELETE FROM HotelRoom WHERE id = ?').run(id) } catch { /* noop */ } }
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE '%H-E2E9%' OR productName = 'E2E Room Service'").all().map((r2) => r2.id)
      for (const id of prodIds) { try { db.prepare('DELETE FROM Product WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: bookings', bookingIds.length, 'rooms', roomIds.length, 'products', prodIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nHOTEL VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
