// One-off live verification for the new Hotel/Lodge vertical.
// Not part of the permanent suite list — run manually: node tests/e2e/verify-hotel.js
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalType = h.getBusinessType()
  let ok = true
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    console.log('\n=== Switching to Hotel / Lodge ===')
    const switchResult = await h.switchBusinessType(page, 'Hotel / Lodge')
    console.log('switch result:', switchResult)

    console.log('\n=== Rooms screen ===')
    await h.gotoHash(page, '#/hotel/rooms')
    await page.waitForTimeout(800)
    console.log('error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'hotel-rooms-empty')

    await page.getByRole('button', { name: 'Add Room' }).click()
    await page.waitForTimeout(400)
    const modal = h.topModal(page)
    await modal.getByPlaceholder('e.g. 101').fill('E2E-101')
    await modal.getByPlaceholder('e.g. Deluxe').fill('E2E Deluxe')
    const rateInputs = modal.locator('input[type="number"]')
    await rateInputs.nth(1).fill('2500') // 0=maxOccupancy, 1=baseRate per form order
    await modal.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(800)
    console.log('room created, error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'hotel-room-created')

    console.log('\n=== Bookings screen — create booking ===')
    await h.gotoHash(page, '#/hotel/bookings')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'New Booking' }).click()
    await page.waitForTimeout(400)
    const bookingModal = h.topModal(page)
    await bookingModal.getByText('Add new customer').click()
    await page.waitForTimeout(300)
    await bookingModal.getByPlaceholder('Customer name *').fill('E2E Hotel Guest Customer')
    await bookingModal.getByPlaceholder('Phone (optional)').fill('9123456780')
    await bookingModal.getByRole('button', { name: 'Add & Select' }).click()
    await page.waitForTimeout(700)
    console.log('customer quick-added, error boundary:', await h.hasErrorBoundary(page))

    await bookingModal.getByLabel('Guest Name').fill('E2E Test Guest')
    await bookingModal.getByLabel('Guest Phone').fill('9876543210')

    const today = new Date()
    const checkIn = new Date(today.getTime() + 24 * 3600000)
    const checkOut = new Date(today.getTime() + 3 * 24 * 3600000) // 2 nights
    const fmt = (d) => d.toISOString().slice(0, 10)
    await bookingModal.getByLabel('Check-In Date').fill(fmt(checkIn))
    await bookingModal.getByLabel('Check-Out Date').fill(fmt(checkOut))
    await bookingModal.getByRole('button', { name: 'Check Available Rooms' }).click()
    await page.waitForTimeout(700)
    await h.shot(page, 'hotel-booking-availability')

    const roomSelect = bookingModal.locator('select').first()
    const optionCount = await roomSelect.locator('option').count()
    console.log('available room options:', optionCount)
    if (optionCount > 1) {
      await roomSelect.selectOption({ index: 1 })
      await page.waitForTimeout(300)
    }
    await bookingModal.getByLabel('Advance Amount').fill('1000')
    await bookingModal.getByRole('button', { name: 'Create Booking' }).click()
    await page.waitForTimeout(1200)
    console.log('booking created, error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'hotel-booking-created')

    console.log('\n=== Check-in with guest ID ===')
    await page.getByText('E2E Test Guest').first().click()
    await page.waitForTimeout(500)
    const detailModal = h.topModal(page)
    await detailModal.getByPlaceholder('Guest name').fill('E2E Test Guest')
    const idTypeSelect = detailModal.locator('select').first()
    await idTypeSelect.selectOption({ index: 1 }) // first real ID type option
    await detailModal.getByPlaceholder('ID number').fill('1234-5678-9012')
    await detailModal.getByRole('button', { name: 'Check In' }).click()
    await page.waitForTimeout(1000)
    console.log('checked in, error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'hotel-checked-in')

    console.log('\n=== Add extra charge ===')
    const detailModal2 = h.topModal(page)
    const bodyTextAfterCheckin = await page.locator('body').innerText().catch(() => '')
    console.log('shows CHECKED IN status:', bodyTextAfterCheckin.includes('CHECKED IN'))
    await detailModal2.getByPlaceholder('Description').fill('Room Service - Dinner')
    await detailModal2.getByPlaceholder('Unit Price').fill('450')
    await detailModal2.getByRole('button', { name: 'Add Charge' }).click()
    await page.waitForTimeout(800)
    await h.shot(page, 'hotel-extra-charge-added')

    console.log('\n=== Check out ===')
    const detailModal3 = h.topModal(page)
    await detailModal3.getByRole('button', { name: 'Check Out' }).click()
    await page.waitForTimeout(1000)
    console.log('checked out, error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'hotel-checked-out')

    console.log('\n=== Generate bill ===')
    const detailModal4 = h.topModal(page)
    const genBillBtn = detailModal4.getByRole('button', { name: 'Generate Bill' })
    if (await genBillBtn.count()) {
      await genBillBtn.click()
      await page.waitForTimeout(1200)
    }
    const finalText = await page.locator('body').innerText().catch(() => '')
    console.log('invoice generated message present:', finalText.includes('Invoice generated'))
    console.log('contains NaN:', finalText.includes('NaN'))
    console.log('contains undefined:', finalText.includes('undefined'))
    console.log('final error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'hotel-invoice-generated')

    // Verify the actual DB state directly — the strongest ground truth.
    const dbCheck = h.withDb((db) => {
      const booking = db.prepare("SELECT * FROM HotelBooking WHERE guestName = 'E2E Test Guest' ORDER BY createdAt DESC LIMIT 1").get()
      const guests = booking ? db.prepare('SELECT * FROM HotelGuestId WHERE bookingId = ?').all(booking.id) : []
      const charges = booking ? db.prepare('SELECT * FROM HotelExtraCharge WHERE bookingId = ?').all(booking.id) : []
      const invoice = booking && booking.invoiceId ? db.prepare('SELECT * FROM Invoice WHERE id = ?').get(booking.invoiceId) : null
      const room = booking ? db.prepare('SELECT * FROM HotelRoom WHERE id = ?').get(booking.roomId) : null
      return { booking, guests, charges, invoice, room }
    })
    console.log('\n=== DB ground truth ===')
    console.log('booking status:', dbCheck.booking && dbCheck.booking.status)
    console.log('guest count:', dbCheck.guests.length)
    console.log('guest idType/idNumber:', dbCheck.guests[0] && dbCheck.guests[0].idType, dbCheck.guests[0] && dbCheck.guests[0].idNumber)
    console.log('charge count:', dbCheck.charges.length, 'charge amount:', dbCheck.charges[0] && dbCheck.charges[0].amount)
    console.log('room status after checkout:', dbCheck.room && dbCheck.room.status)
    console.log('invoice totalAmount:', dbCheck.invoice && dbCheck.invoice.totalAmount)
    // Expected: 2 nights x 2500 = 5000 room charge + 450 room service = 5450
    const expectedTotal = 5450
    console.log('expected total:', expectedTotal, 'matches:', dbCheck.invoice && dbCheck.invoice.totalAmount === expectedTotal)

    if (!dbCheck.booking || dbCheck.booking.status !== 'CHECKED_OUT') ok = false
    if (dbCheck.guests.length !== 1) ok = false
    if (dbCheck.charges.length !== 1) ok = false
    if (!dbCheck.room || dbCheck.room.status !== 'CLEANING') ok = false
    if (!dbCheck.invoice || dbCheck.invoice.totalAmount !== expectedTotal) ok = false

    // Cleanup test data
    h.withDb((db) => {
      if (dbCheck.booking) {
        db.prepare('DELETE FROM HotelExtraCharge WHERE bookingId = ?').run(dbCheck.booking.id)
        db.prepare('DELETE FROM HotelGuestId WHERE bookingId = ?').run(dbCheck.booking.id)
        if (dbCheck.invoice) {
          db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(dbCheck.invoice.id)
          db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(dbCheck.invoice.id)
          db.prepare('DELETE FROM Invoice WHERE id = ?').run(dbCheck.invoice.id)
        }
        db.prepare('DELETE FROM HotelBooking WHERE id = ?').run(dbCheck.booking.id)
      }
      db.prepare("DELETE FROM HotelRoom WHERE roomNumber = 'E2E-101'").run()
      const custRow = db.prepare("SELECT id FROM Customer WHERE customerName = 'E2E Hotel Guest Customer'").get()
      if (custRow) db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(custRow.id)
      db.prepare("DELETE FROM Customer WHERE customerName = 'E2E Hotel Guest Customer'").run()
    })
    console.log('\ncleanup done')
  } catch (e) {
    console.error('FATAL DURING VERIFICATION', e)
    ok = false
  } finally {
    // Restore original business type via the real UI, matching harness's own convention.
    try {
      const page = await h.getMainWindow(app)
      if (originalType) await h.switchBusinessType(page, originalType === 'MANUFACTURING' ? 'Manufacturing' : originalType)
    } catch { /* best-effort restore */ }
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
  console.log('\n=== RESULT:', ok ? 'PASS' : 'FAIL', '===')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
