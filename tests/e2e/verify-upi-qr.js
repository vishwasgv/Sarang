// One-off live verification: UPI QR must actually render for a realistic
// Indian business profile (country stored as free-text "India", the
// SetupWizard default — not the ISO code 'IN') with an unpaid balance.
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
    await modal.getByPlaceholder('e.g. 101').fill('QR-301')
    await modal.getByPlaceholder('e.g. Deluxe').fill('QR Test Room')
    const rateInputs = modal.locator('input[type="number"]')
    await rateInputs.nth(1).fill('2000')
    await modal.getByRole('button', { name: 'Save' }).click()
    await page.waitForTimeout(800)

    await h.gotoHash(page, '#/hotel/bookings')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'New Booking' }).click()
    await page.waitForTimeout(400)
    let bookingModal = h.topModal(page)
    await bookingModal.getByText('Add new customer').click()
    await page.waitForTimeout(300)
    await bookingModal.getByPlaceholder('Customer name *').fill('QR Test Customer')
    await bookingModal.getByRole('button', { name: 'Add & Select' }).click()
    await bookingModal.getByText('QR Test Customer').waitFor({ state: 'visible', timeout: 5000 })

    await bookingModal.getByLabel('Guest Name').fill('QR Test Guest')
    const today = new Date()
    const checkIn = new Date(today.getTime() + 24 * 3600000)
    const checkOut = new Date(today.getTime() + 2 * 24 * 3600000)
    const fmt = (d) => d.toISOString().slice(0, 10)
    await bookingModal.getByLabel('Check-In Date').fill(fmt(checkIn))
    await bookingModal.getByLabel('Check-Out Date').fill(fmt(checkOut))
    await bookingModal.getByRole('button', { name: 'Check Available Rooms' }).click()
    await page.waitForTimeout(700)
    const roomSelect = bookingModal.locator('select').first()
    const roomOptionCount = await roomSelect.locator('option').count()
    if (roomOptionCount > 1) await roomSelect.selectOption({ index: 1 })
    await page.waitForTimeout(300)
    // Leave Advance Amount at 0 — invoice must carry a real unpaid balance
    // for canShowUpiQr()'s balanceAmount > 0.01 gate to fire.
    await bookingModal.getByRole('button', { name: 'Create Booking' }).click()
    await page.waitForTimeout(1200)

    await page.getByText('QR Test Guest').first().click()
    await page.waitForTimeout(500)
    let detailModal = h.topModal(page)
    await detailModal.getByPlaceholder('Guest name').fill('QR Test Guest')
    await detailModal.locator('select').first().selectOption({ index: 1 })
    await detailModal.getByPlaceholder('ID number').fill('QRTEST-0001')
    await detailModal.getByRole('button', { name: 'Check In' }).click()
    await page.waitForTimeout(1000)

    detailModal = h.topModal(page)
    await detailModal.getByRole('button', { name: 'Check Out' }).click()
    await page.waitForTimeout(1000)

    detailModal = h.topModal(page)
    await detailModal.getByRole('button', { name: 'Generate Bill' }).click()
    await page.waitForTimeout(1200)

    console.log('\n=== Print preview: A4 Invoice (unpaid, India, upiId set) ===')
    detailModal = h.topModal(page)
    await detailModal.getByRole('button', { name: 'Print Invoice (A4)' }).click()
    await page.waitForTimeout(1500)
    await h.shot(page, 'upi-qr-a4-preview')
    const iframeA4 = page.frameLocator('iframe[title="Print preview"]')
    const a4Html = await iframeA4.locator('body').innerHTML().catch(() => 'ERR')
    const a4Text = await iframeA4.locator('body').innerText().catch(() => 'ERR')
    const a4HasQrImg = a4Html.includes('alt="UPI QR"')
    console.log('A4 preview shows "Scan to Pay (UPI)":', a4Text.includes('Scan to Pay'))
    console.log('A4 preview has a real <img> QR element:', a4HasQrImg)
    if (!a4Text.includes('Scan to Pay') || !a4HasQrImg) ok = false

    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).last()
    if (await cancelBtn.count()) await cancelBtn.click()
    await page.waitForTimeout(500)

    console.log('\n=== Print preview: Thermal Receipt (unpaid, India, upiId set) ===')
    detailModal = h.topModal(page)
    await detailModal.getByRole('button', { name: 'Print Receipt (Thermal)' }).click()
    await page.waitForTimeout(1500)
    await h.shot(page, 'upi-qr-thermal-preview')
    const iframeThermal = page.frameLocator('iframe[title="Print preview"]')
    const thermalText = await iframeThermal.locator('body').innerText().catch(() => 'ERR')
    console.log('Thermal preview shows "Scan to Pay (UPI)":', thermalText.includes('Scan to Pay'))
    if (!thermalText.includes('Scan to Pay')) ok = false

    // Cleanup
    h.withDb((db) => {
      const booking = db.prepare("SELECT * FROM HotelBooking WHERE guestName = 'QR Test Guest' ORDER BY createdAt DESC LIMIT 1").get()
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
      db.prepare("DELETE FROM HotelRoom WHERE roomNumber = 'QR-301'").run()
      const custRow = db.prepare("SELECT id FROM Customer WHERE customerName = 'QR Test Customer'").get()
      if (custRow) db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(custRow.id)
      db.prepare("DELETE FROM Customer WHERE customerName = 'QR Test Customer'").run()
      db.exec("UPDATE BusinessProfile SET upiId = NULL")
    })
    console.log('\ncleanup done, upiId reset to null')
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
