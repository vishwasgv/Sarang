// One-off live verification for Hotel print (A4 + thermal) and the two new
// reports (Room Occupancy, Guest Register). Not part of the permanent suite.
const h = require('./harness')

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let ok = true
  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await h.switchBusinessType(page, 'Hotel / Lodge')
    await h.gotoHash(page, '#/hotel/rooms')
    await page.waitForTimeout(800)

    await page.getByRole('button', { name: 'Add Room' }).click()
    await page.waitForTimeout(400)
    let modal = h.topModal(page)
    await modal.getByPlaceholder('e.g. 101').fill('E2E-201')
    await modal.getByPlaceholder('e.g. Deluxe').fill('E2E Deluxe')
    const rateInputs = modal.locator('input[type="number"]')
    await rateInputs.nth(1).fill('3000')
    await modal.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(800)

    await h.gotoHash(page, '#/hotel/bookings')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'New Booking' }).click()
    await page.waitForTimeout(400)
    let bookingModal = h.topModal(page)
    await bookingModal.getByText('Add new customer').click()
    await page.waitForTimeout(300)
    await bookingModal.getByPlaceholder('Customer name *').fill('E2E Hotel Report Customer')
    await bookingModal.getByPlaceholder('Phone (optional)').fill('9111222333')
    await bookingModal.getByRole('button', { name: 'Add & Select' }).click()
    // Wait for the picker to actually flip to its "selected" state instead of
    // a blind timeout — confirms the customer really got attached before we
    // proceed, rather than racing the async create call.
    await bookingModal.getByText('E2E Hotel Report Customer').waitFor({ state: 'visible', timeout: 5000 })
    console.log('customer selected in picker: true')

    await bookingModal.getByLabel('Guest Name').fill('E2E Report Guest')
    const today = new Date()
    const checkIn = new Date(today.getTime() + 24 * 3600000)
    const checkOut = new Date(today.getTime() + 2 * 24 * 3600000) // 1 night
    const fmt = (d) => d.toISOString().slice(0, 10)
    await bookingModal.getByLabel('Check-In Date').fill(fmt(checkIn))
    await bookingModal.getByLabel('Check-Out Date').fill(fmt(checkOut))
    await bookingModal.getByRole('button', { name: 'Check Available Rooms' }).click()
    await page.waitForTimeout(700)
    const roomSelect = bookingModal.locator('select').first()
    const roomOptionCount = await roomSelect.locator('option').count()
    console.log('available room options:', roomOptionCount)
    if (roomOptionCount > 1) {
      await roomSelect.selectOption({ index: 1 })
    }
    await page.waitForTimeout(300)
    await bookingModal.getByRole('button', { name: 'Create Booking' }).click()
    await page.waitForTimeout(1200)
    console.log('booking created, error boundary:', await h.hasErrorBoundary(page))

    await page.getByText('E2E Report Guest').first().click()
    await page.waitForTimeout(500)
    let detailModal = h.topModal(page)
    await detailModal.getByPlaceholder('Guest name').fill('E2E Report Guest')
    await detailModal.locator('select').first().selectOption({ index: 1 })
    await detailModal.getByPlaceholder('ID number').fill('PASS-9988-XYZ')
    await detailModal.getByRole('button', { name: 'Check In' }).click()
    await page.waitForTimeout(1000)

    detailModal = h.topModal(page)
    await detailModal.getByRole('button', { name: 'Check Out' }).click()
    await page.waitForTimeout(1000)

    detailModal = h.topModal(page)
    const genBillBtn = detailModal.getByRole('button', { name: 'Generate Bill' })
    await genBillBtn.click()
    await page.waitForTimeout(1200)
    console.log('invoice generated, error boundary:', await h.hasErrorBoundary(page))
    await h.shot(page, 'hotel-report-invoice-ready')

    console.log('\n=== Print preview: A4 Invoice ===')
    detailModal = h.topModal(page)
    await detailModal.getByRole('button', { name: 'Print Invoice (A4)' }).click()
    await page.waitForTimeout(1500)
    await h.shot(page, 'hotel-print-preview-a4')
    const iframeA4 = page.frameLocator('iframe[title="Print preview"]')
    const a4Text = await iframeA4.locator('body').innerText().catch(() => 'ERR')
    console.log('A4 preview contains guest name:', a4Text.includes('E2E Report Guest') || a4Text.includes('E2E Hotel Report Customer'))
    console.log('A4 preview contains amount 3000 or 3,000:', /3,?000/.test(a4Text))
    console.log('A4 preview contains NaN:', a4Text.includes('NaN'))
    // Close preview without actually printing (avoid a real OS print dialog in CI)
    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).last()
    if (await cancelBtn.count()) await cancelBtn.click()
    await page.waitForTimeout(500)

    console.log('\n=== Print preview: Thermal Receipt ===')
    detailModal = h.topModal(page)
    await detailModal.getByRole('button', { name: 'Print Receipt (Thermal)' }).click()
    await page.waitForTimeout(1500)
    await h.shot(page, 'hotel-print-preview-thermal')
    const iframeThermal = page.frameLocator('iframe[title="Print preview"]')
    const thermalText = await iframeThermal.locator('body').innerText().catch(() => 'ERR')
    console.log('Thermal preview contains amount:', /3,?000/.test(thermalText))
    console.log('Thermal preview contains NaN:', thermalText.includes('NaN'))
    const cancelBtn2 = page.getByRole('button', { name: 'Cancel' }).last()
    if (await cancelBtn2.count()) await cancelBtn2.click()
    await page.waitForTimeout(500)

    if (!a4Text.includes('E2E Report Guest') && !a4Text.includes('E2E Hotel Report Customer')) ok = false
    if (a4Text.includes('NaN') || thermalText.includes('NaN')) ok = false
    if (!/3,?000/.test(a4Text) || !/3,?000/.test(thermalText)) ok = false

    console.log('\n=== Reports: Room Occupancy ===')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await h.gotoHash(page, '#/reports')
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Room Occupancy' }).click()
    await page.waitForTimeout(500)
    const genBtn1 = page.getByRole('button', { name: 'Generate Report' }).first()
    if (await genBtn1.count()) { await genBtn1.click(); await page.waitForTimeout(1000) }
    const occText = await page.locator('body').innerText().catch(() => '')
    console.log('occupancy report error boundary:', await h.hasErrorBoundary(page))
    console.log('shows Total Rooms:', occText.includes('Total Rooms'))
    console.log('shows at least 1 occupied or available room:', /Occupied|Available/.test(occText))
    await h.shot(page, 'hotel-report-occupancy')
    if (await h.hasErrorBoundary(page)) ok = false

    console.log('\n=== Reports: Guest Register ===')
    await page.getByRole('button', { name: 'Guest Register' }).click()
    await page.waitForTimeout(500)
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() >= 2) {
      const wideFrom = new Date(today.getTime() - 7 * 24 * 3600000)
      const wideTo = new Date(today.getTime() + 14 * 24 * 3600000)
      await dateInputs.nth(0).fill(fmt(wideFrom))
      await dateInputs.nth(1).fill(fmt(wideTo))
    }
    const genBtn2 = page.getByRole('button', { name: 'Generate Report' }).first()
    if (await genBtn2.count()) { await genBtn2.click(); await page.waitForTimeout(1000) }
    const regText = await page.locator('body').innerText().catch(() => '')
    console.log('guest register error boundary:', await h.hasErrorBoundary(page))
    console.log('shows guest name E2E Report Guest:', regText.includes('E2E Report Guest'))
    console.log('shows ID number PASS-9988-XYZ:', regText.includes('PASS-9988-XYZ'))
    await h.shot(page, 'hotel-report-guest-register')
    if (!regText.includes('E2E Report Guest') || !regText.includes('PASS-9988-XYZ')) ok = false
    if (await h.hasErrorBoundary(page)) ok = false

    // Cleanup
    h.withDb((db) => {
      const booking = db.prepare("SELECT * FROM HotelBooking WHERE guestName = 'E2E Report Guest' ORDER BY createdAt DESC LIMIT 1").get()
      if (booking) {
        db.prepare('DELETE FROM HotelExtraCharge WHERE bookingId = ?').run(booking.id)
        db.prepare('DELETE FROM HotelGuestId WHERE bookingId = ?').run(booking.id)
        if (booking.invoiceId) {
          db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(booking.invoiceId)
          db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(booking.invoiceId)
          db.prepare('DELETE FROM Invoice WHERE id = ?').run(booking.invoiceId)
        }
        db.prepare('DELETE FROM HotelBooking WHERE id = ?').run(booking.id)
      }
      db.prepare("DELETE FROM HotelRoom WHERE roomNumber = 'E2E-201'").run()
      const custRow = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Hotel Report%'").get()
      if (custRow) db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(custRow.id)
      db.prepare("DELETE FROM Customer WHERE customerName LIKE 'E2E Hotel Report%'").run()
    })
    console.log('\ncleanup done')
  } catch (e) {
    console.error('FATAL DURING VERIFICATION', e)
    ok = false
  } finally {
    try {
      const page = await h.getMainWindow(app)
      await h.switchBusinessType(page, 'Manufacturing / Production')
    } catch { /* best-effort restore */ }
    await h.closeApp(app)
    h.randomizeAdminPassword()
  }
  console.log('\n=== RESULT:', ok ? 'PASS' : 'FAIL', '===')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
