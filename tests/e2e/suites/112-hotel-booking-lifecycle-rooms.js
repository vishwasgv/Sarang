/**
 * Suite 112 — Hotel/Lodge vertical: the ENTIRE booking lifecycle and room
 * CRUD (broader-gap-list Section C, 2026-09-03). Suite 41 only ever
 * exercised read-only queries (listRooms/listBookings/getBooking/reports)
 * -- createBooking, checkIn, checkOut, cancelBooking, markNoShow,
 * generateInvoice, generateGroupInvoice, addExtraCharge/removeExtraCharge,
 * and room createRoom/updateRoom/deleteRoom had ZERO coverage of any kind.
 * One of the largest single gaps found in this whole audit.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Htl'
// A prior run's guest/customer names must never collide with this run's --
// CustomerPicker's "Add new customer" option disappears once a real match
// already exists, breaking the create flow (found live: a leftover
// "E2E Htl Guest 1" customer from an earlier run made the picker show that
// existing customer instead, and the create-flow branch below never
// accounted for it).
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-hotel', async () => {
      const sw = await h.switchBusinessType(page, 'Hotel / Lodge')
      r.log('business-type-switched', sw.to === 'HOTEL_LODGE', JSON.stringify(sw))
    })

    // ── Rooms: create Room A (kept alive for bookings) ──────────────────────
    const roomNumberA = `E2E-HTL-A-${Date.now().toString().slice(-6)}`
    await r.step('create-room-A-via-ui', async () => {
      await h.gotoHash(page, '#/hotel/rooms')
      await page.waitForTimeout(700)
      r.log('rooms-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Room' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Room Number').fill(roomNumberA)
      await page.getByLabel('Room Type').fill('Deluxe')
      await page.getByLabel('Rate / Night').fill('2000')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('room-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.hotel.listRooms({ includeInactive: true }))
      const found = (listRes?.data?.rooms || []).find((room) => room.roomNumber === roomNumberA)
      r.log('room-A-persisted', !!found, JSON.stringify(found))
    })

    // ── Rooms: create/update/delete Room B (never booked) ───────────────────
    const roomNumberB = `E2E-HTL-B-${Date.now().toString().slice(-6)}`
    await r.step('room-B-create-update-delete-via-ui', async () => {
      await page.getByRole('button', { name: 'Add Room' }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Room Number').fill(roomNumberB)
      await page.getByLabel('Room Type').fill('Standard')
      await page.getByLabel('Rate / Night').fill('1000')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('room-B-created-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate(async () => window.api.hotel.listRooms({ includeInactive: true }))
      let found = (listRes?.data?.rooms || []).find((room) => room.roomNumber === roomNumberB)
      r.log('room-B-persisted', !!found, JSON.stringify(found))
      if (!found) return

      await page.locator('td', { hasText: roomNumberB }).first().click()
      await page.waitForTimeout(400)
      await page.getByLabel('Rate / Night').fill('1200')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('room-B-updated-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate(async () => window.api.hotel.listRooms({ includeInactive: true }))
      found = (listRes?.data?.rooms || []).find((room) => room.roomNumber === roomNumberB)
      r.log('room-B-rate-updated', found?.baseRate === 1200, JSON.stringify(found))

      const row = page.locator('td', { hasText: roomNumberB }).first().locator('xpath=..')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('room-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.hotel.listRooms({ includeInactive: true }))
      const stillThere = (afterDelete?.data?.rooms || []).some((room) => room.roomNumber === roomNumberB)
      r.log('room-B-actually-gone', !stillThere)
    })

    async function createBooking(guestName, dayOffset, customerSearchName) {
      const searchName = customerSearchName || guestName
      const checkIn = h.toLocalISODate(new Date(Date.now() + dayOffset * 24 * 3600000))
      const checkOut = h.toLocalISODate(new Date(Date.now() + (dayOffset + 1) * 24 * 3600000))
      await h.gotoHash(page, '#/hotel/bookings')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'New Booking' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      // generateInvoice/generateGroupInvoice both reject a booking with no
      // linked customer (HTL-050) -- a plain Guest Name is not enough,
      // discovered live when the invoice step silently returned null.
      // generateGroupInvoice additionally requires every booking in the
      // group to share the SAME linked customer (HTL-058) -- callers that
      // want to combine bookings pass the same customerSearchName so this
      // finds and reuses the existing customer instead of creating a new one.
      await modal.getByPlaceholder('Search by name or phone...').fill(searchName)
      await page.waitForTimeout(700)
      // "Add new customer" is unconditionally rendered below the search box
      // (not hidden once a match exists) -- and the results dropdown, when
      // open, visually overlaps it, so clicking it blind here can hang on
      // an obscured target. Check the dropdown for an exact existing match
      // FIRST (booking 2/3 deliberately share one customer for the combined-
      // bill test below) and only fall back to Add new customer otherwise.
      const existingMatch = modal.locator('div.absolute button', { hasText: searchName }).first()
      if (await existingMatch.count()) {
        await existingMatch.click()
        await page.waitForTimeout(300)
      } else {
        await modal.locator('button', { hasText: 'Add new customer' }).click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill(searchName)
        await modal.getByPlaceholder('Phone *').fill(`9${String(Date.now()).slice(-9)}`)
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }
      await modal.getByLabel('Guest Name').fill(guestName)
      await modal.locator('input[type="date"]').first().fill(checkIn)
      await modal.locator('input[type="date"]').nth(1).fill(checkOut)
      await modal.getByRole('button', { name: 'Check Available Rooms' }).click()
      await page.waitForTimeout(800)
      const roomSelect = modal.getByLabel('Room')
      const optionText = await roomSelect.locator('option', { hasText: roomNumberA }).first().textContent().catch(() => null)
      if (optionText) await roomSelect.selectOption({ label: optionText.trim() })
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Create Booking' }).click()
      await page.waitForTimeout(1200)

      const listRes = await page.evaluate(async () => window.api.hotel.listBookings())
      const found = (listRes?.data?.bookings || []).find((b) => b.guestName === guestName)
      return found?.id
    }

    // ── Booking 1: full lifecycle -- checkIn/addCharge/removeCharge/checkOut/invoice ──
    let booking1Id
    await r.step('booking-1-create-and-checkin-via-ui', async () => {
      booking1Id = await createBooking(`${TEST_PREFIX} Guest 1 ${suffix}`, 1)
      r.log('booking-1-created', !!booking1Id)
      if (!booking1Id) return
      r.log('new-booking-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('tr', { hasText: `${TEST_PREFIX} Guest 1 ${suffix}` }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('ID number').fill('AADHAAR123456')
      await modal.locator('select').selectOption('AADHAAR')
      await modal.getByRole('button', { name: 'Check In' }).click()
      await page.waitForTimeout(1200)
      r.log('checkin-no-crash', !(await h.hasErrorBoundary(page)))

      const detail = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking1Id)
      r.log('booking-1-checked-in', detail?.data?.status === 'CHECKED_IN', JSON.stringify(detail?.data?.status))
    })

    let chargeId
    await r.step('booking-1-add-and-remove-charge-via-ui', async () => {
      if (!booking1Id) return r.log('booking-1-add-and-remove-charge-via-ui', false, 'no booking1Id')
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Description').fill('E2E Laundry Service')
      await modal.getByPlaceholder('Unit Price').fill('150')
      await modal.getByRole('button', { name: 'Add Charge' }).click()
      await page.waitForTimeout(1000)
      r.log('add-charge-no-crash', !(await h.hasErrorBoundary(page)))

      let detail = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking1Id)
      const charge = (detail?.data?.charges || []).find((c) => c.description === 'E2E Laundry Service')
      chargeId = charge?.id
      r.log('charge-added', !!chargeId, JSON.stringify(charge))
      if (!chargeId) return

      await modal.locator('button:has(svg.lucide-trash2)').first().click()
      await page.waitForTimeout(1000)
      r.log('remove-charge-no-crash', !(await h.hasErrorBoundary(page)))

      detail = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking1Id)
      const stillThere = (detail?.data?.charges || []).some((c) => c.id === chargeId)
      r.log('charge-actually-removed', !stillThere, JSON.stringify(detail?.data?.charges))
    })

    await r.step('booking-1-checkout-and-invoice-via-ui', async () => {
      if (!booking1Id) return r.log('booking-1-checkout-and-invoice-via-ui', false, 'no booking1Id')
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Check Out' }).click()
      await page.waitForTimeout(1200)
      r.log('checkout-no-crash', !(await h.hasErrorBoundary(page)))

      let detail = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking1Id)
      r.log('booking-1-checked-out', detail?.data?.status === 'CHECKED_OUT', JSON.stringify(detail?.data?.status))

      const modal2 = h.topModal(page)
      await modal2.getByRole('button', { name: 'Generate Bill' }).click()
      await page.waitForTimeout(1500)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      detail = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking1Id)
      r.log('booking-1-invoiced', !!detail?.data?.invoiceId, JSON.stringify(detail?.data?.invoiceId))
      if (detail?.data?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), detail.data.invoiceId)
        r.log('invoice-includes-room-charge', (invRes?.data?.totalAmount ?? 0) >= 2000, JSON.stringify(invRes?.data?.totalAmount))
      }
      await modal2.locator('button:has(svg.lucide-x)').first().click()
      await page.waitForTimeout(400)
    })

    // ── Booking 2 & 3: checked out, no invoice -> combined bill ──────────────
    let booking2Id, booking3Id
    await r.step('booking-2-and-3-create-checkin-checkout-via-ui', async () => {
      const sharedCustomerName = `${TEST_PREFIX} Shared Customer ${suffix}`
      booking2Id = await createBooking(`${TEST_PREFIX} Guest 2 ${suffix}`, 3, sharedCustomerName)
      r.log('booking-2-created', !!booking2Id)
      booking3Id = await createBooking(`${TEST_PREFIX} Guest 3 ${suffix}`, 5, sharedCustomerName)
      r.log('booking-3-created', !!booking3Id)

      for (const [name, id] of [[`${TEST_PREFIX} Guest 2 ${suffix}`, booking2Id], [`${TEST_PREFIX} Guest 3 ${suffix}`, booking3Id]]) {
        if (!id) continue
        await page.locator('tr', { hasText: name }).click()
        await page.waitForTimeout(500)
        const modal = h.topModal(page)
        await modal.getByPlaceholder('ID number').fill('AADHAAR654321')
        await modal.locator('select').selectOption('AADHAAR')
        await modal.getByRole('button', { name: 'Check In' }).click()
        await page.waitForTimeout(1000)
        const modal2 = h.topModal(page)
        await modal2.getByRole('button', { name: 'Check Out' }).click()
        await page.waitForTimeout(1000)
        await h.topModal(page).locator('button:has(svg.lucide-x)').first().click()
        await page.waitForTimeout(400)
      }
      r.log('bookings-2-and-3-checked-out-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('generate-combined-bill-via-ui', async () => {
      if (!booking2Id || !booking3Id) return r.log('generate-combined-bill-via-ui', false, 'missing booking2/3')
      await page.reload()
      await page.waitForTimeout(1500)
      await h.gotoHash(page, '#/hotel/bookings')
      await page.waitForTimeout(700)

      const row2 = page.locator('tr', { hasText: `${TEST_PREFIX} Guest 2 ${suffix}` })
      await row2.locator('input[type="checkbox"]').check()
      const row3 = page.locator('tr', { hasText: `${TEST_PREFIX} Guest 3 ${suffix}` })
      await row3.locator('input[type="checkbox"]').check()
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: /Generate Combined Bill \(2\)/ }).click()
      await page.waitForTimeout(1500)
      r.log('combined-bill-no-crash', !(await h.hasErrorBoundary(page)))

      const d2 = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking2Id)
      const d3 = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking3Id)
      r.log('both-bookings-share-one-invoice', !!d2?.data?.invoiceId && d2?.data?.invoiceId === d3?.data?.invoiceId, JSON.stringify({ inv2: d2?.data?.invoiceId, inv3: d3?.data?.invoiceId }))
    })

    // ── Booking 4: No-Show ────────────────────────────────────────────────────
    let booking4Id
    await r.step('booking-4-no-show-via-ui', async () => {
      booking4Id = await createBooking(`${TEST_PREFIX} Guest 4 ${suffix}`, 7)
      r.log('booking-4-created', !!booking4Id)
      if (!booking4Id) return

      await page.locator('tr', { hasText: `${TEST_PREFIX} Guest 4 ${suffix}` }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      // The Check-In section's action row is [Check In, No-Show (UserX icon), Cancel (Ban icon)] -- middle button.
      await modal.locator('button:has(svg.lucide-user-x)').click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Mark No-Show', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('no-show-no-crash', !(await h.hasErrorBoundary(page)))

      const detail = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking4Id)
      r.log('booking-4-marked-no-show', detail?.data?.status === 'NO_SHOW', JSON.stringify(detail?.data?.status))

      // The detail modal has no auto-close after a status action -- only its
      // own X button closes it -- and would otherwise block every later
      // click behind its overlay (same class of bug found earlier this
      // session on the CS board-resolution modal).
      await h.topModal(page).locator('button:has(svg.lucide-x)').first().click()
      await page.waitForTimeout(400)
    })

    // ── Booking 5: Cancel ─────────────────────────────────────────────────────
    let booking5Id
    await r.step('booking-5-cancel-via-ui', async () => {
      booking5Id = await createBooking(`${TEST_PREFIX} Guest 5 ${suffix}`, 9)
      r.log('booking-5-created', !!booking5Id)
      if (!booking5Id) return

      await page.locator('tr', { hasText: `${TEST_PREFIX} Guest 5 ${suffix}` }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.locator('button:has(svg.lucide-ban)').click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Cancel Booking', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('cancel-no-crash', !(await h.hasErrorBoundary(page)))

      const detail = await page.evaluate((id) => window.api.hotel.getBooking({ id }), booking5Id)
      r.log('booking-5-cancelled', detail?.data?.status === 'CANCELLED', JSON.stringify(detail?.data?.status))
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
    h.withDb((db) => {
      const bookingIds = db.prepare("SELECT id, invoiceId FROM HotelBooking WHERE guestName LIKE 'E2E Htl%'").all()
      let charges = 0, guests = 0, bookings = 0, invoices = 0, invoiceItems = 0
      const invoiceIds = new Set()
      for (const b of bookingIds) {
        charges += db.prepare('DELETE FROM HotelExtraCharge WHERE bookingId = ?').run(b.id).changes
        guests += db.prepare('DELETE FROM HotelGuestId WHERE bookingId = ?').run(b.id).changes
        if (b.invoiceId) invoiceIds.add(b.invoiceId)
        try { bookings += db.prepare('DELETE FROM HotelBooking WHERE id = ?').run(b.id).changes } catch { /* noop */ }
      }
      for (const invId of invoiceIds) {
        invoiceItems += db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(invId).changes
        try { invoices += db.prepare('DELETE FROM Invoice WHERE id = ?').run(invId).changes } catch { /* noop */ }
      }
      const roomIds = db.prepare("SELECT id FROM HotelRoom WHERE roomNumber LIKE 'E2E-HTL-%'").all().map((r2) => r2.id)
      let rooms = 0
      for (const rid of roomIds) { try { rooms += db.prepare('DELETE FROM HotelRoom WHERE id = ?').run(rid).changes } catch { /* noop */ } }
      // Customers created via CustomerPicker's "Add new customer" quick-add
      // were never cleaned up before -- left as permanent leftovers that
      // then broke a LATER run's create flow (see the top-of-file comment).
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Htl%'").all().map((r2) => r2.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ charges, guests, bookings, invoices, invoiceItems, rooms, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nHOTEL BOOKING LIFECYCLE & ROOMS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
