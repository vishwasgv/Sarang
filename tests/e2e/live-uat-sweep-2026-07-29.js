/**
 * One-off live UAT sweep, driven by the main audit session directly (not
 * delegated) to personally observe results across a representative sample
 * of today's ~250+ fixes: core commerce (Pass A), a product vertical
 * (Pass B), a service-business vertical (Pass C1), and a cross-cutting
 * screen (Pass C2's cash-close overwrite-confirmation fix specifically).
 * Screenshots saved for visual confirmation. Not a permanent regression
 * asset (unlike 51-real-concurrency-stress.js) -- ad hoc, one-time sweep.
 */
const h = require('./harness')
const crypto = require('crypto')

const TEST_PREFIX = 'E2E LiveUAT'
function newId() { return crypto.randomUUID() }

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  h.cleanupByNamePrefix(TEST_PREFIX)
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── 1. Billing (Pass A) — create a product + customer + invoice ────
    await r.step('billing-create-invoice', async () => {
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Product`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 20,
      }), TEST_PREFIX)
      r.log('billing-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      r.log('billing-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))

      await h.gotoHash(page, '#/billing')
      await page.waitForTimeout(800)
      await h.shot(page, 'liveuat-01-billing-screen')
      r.log('billing-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 2, unitPrice: 100, taxRate: 18 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      r.log('billing-invoice-created-correct-total', invRes?.success && invRes?.data?.totalAmount === 236, `total=${invRes?.data?.totalAmount}`)
    })

    const originalBusinessType = h.getBusinessType()

    // ── 2. Hotel (Pass B) — book + check-in, confirm real flow works ───
    await r.step('hotel-booking-checkin', async () => {
      // Via the real Settings UI, not raw IPC -- avoids the documented
      // stale-Zustand-store gotcha (harness.js's switchBusinessType comment)
      // that would otherwise leave the sidebar/module gates showing the
      // wrong vertical for the subsequent navigation below.
      const switchRes = await h.switchBusinessType(page, 'Hotel / Lodge')
      r.log('switched-to-hotel-lodge', switchRes.changed || switchRes.to === 'HOTEL_LODGE', JSON.stringify(switchRes))

      const roomRes = await page.evaluate(async (prefix) => window.api.hotel.createRoom({
        roomNumber: `${prefix}-101`, roomType: 'DELUXE', baseRate: 2000,
      }), TEST_PREFIX).catch((e) => ({ success: false, error: { message: String(e) } }))
      r.log('hotel-room-created', !!roomRes?.success, JSON.stringify(roomRes?.error || ''))

      if (roomRes?.success) {
        const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
          customerName: `${prefix} Guest`, phone: `8${String(Date.now()).slice(-9)}`,
        }), TEST_PREFIX)
        const today = new Date().toISOString().slice(0, 10)
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
        const bookRes = await page.evaluate(async (a) => window.api.hotel.createBooking(a), {
          roomId: roomRes.data.id, customerId: custRes?.data?.id, guestName: `${TEST_PREFIX} Guest`,
          checkInDate: today, checkOutDate: tomorrow, ratePerNight: 2000,
        })
        r.log('hotel-booking-created', !!bookRes?.success, JSON.stringify(bookRes?.error || ''))

        if (bookRes?.success) {
          const ciRes = await page.evaluate(async ({ id, guestName }) => window.api.hotel.checkIn({
            id, guests: [{ guestName, idType: 'AADHAAR', idNumber: '123412341234', isPrimary: true }],
          }), { id: bookRes.data.id, guestName: `${TEST_PREFIX} Guest` })
          r.log('hotel-checkin-succeeds', !!ciRes?.success, JSON.stringify(ciRes?.error || ''))

          await h.gotoHash(page, '#/hotel/bookings')
          await page.waitForTimeout(800)
          await h.shot(page, 'liveuat-02-hotel-bookings')
          r.log('hotel-bookings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
        }
      }
      await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
      await page.waitForTimeout(400)
    })

    // ── 3. Driving School (Pass C1, heaviest-fixed vertical) ───────────
    await r.step('driving-school-flow', async () => {
      const switchRes = await h.switchBusinessType(page, 'Driving School')
      r.log('switched-to-driving-school', switchRes.changed || switchRes.to === 'DRIVING_SCHOOL', JSON.stringify(switchRes))
      await h.gotoHash(page, '#/service-business/driving-school')
      await page.waitForTimeout(800)
      await h.shot(page, 'liveuat-03-driving-school')
      r.log('driving-school-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
      await page.waitForTimeout(400)
    })

    // ── 4. Cash Close overwrite-confirmation (Pass C2's specific fix) ──
    let preExistingTodayClose = null
    await r.step('cashclose-overwrite-confirmation', async () => {
      // Safety: this step's whole point is to trigger the "already recorded"
      // overwrite path, which for a REAL prior close would replace real
      // reconciliation data (actualCash/variance) for today in the shared
      // dev DB. Capture whatever's there before touching anything, and only
      // proceed with the destructive resubmit if nothing real is at risk
      // (either no close exists yet, or the existing one is clearly this
      // suite's own leftover from an interrupted prior run).
      const todayIso = new Date().toISOString().slice(0, 10)
      const summaryRes = await page.evaluate(async () => window.api.cashClose.getSummary()).catch(() => null)
      preExistingTodayClose = summaryRes?.data?.existing ?? null
      const safeToOverwrite = !preExistingTodayClose || preExistingTodayClose.notes === TEST_PREFIX
      r.log('cashclose-pre-check-safe-to-test-overwrite-path', true, safeToOverwrite ? 'no real prior close for today, or it is this suite\'s own leftover' : 'a REAL close already exists for today — skipping the destructive overwrite test to protect real reconciliation data')

      await h.gotoHash(page, '#/cash-close')
      await page.waitForTimeout(800)
      await h.shot(page, 'liveuat-04-cashclose-screen')
      r.log('cashclose-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      if (!safeToOverwrite) return

      const amountInput = page.locator('input[type="number"]').first()
      if (await amountInput.count()) {
        await amountInput.fill('5000')
        const notesInput = page.locator('textarea').first()
        if (await notesInput.count()) await notesInput.fill(TEST_PREFIX) // marks this as our own test data for cleanup/safety
        const submitBtn = page.locator('button', { hasText: /record|submit|close/i }).first()
        if (await submitBtn.count()) {
          await submitBtn.click()
          await page.waitForTimeout(800)
          r.log('cashclose-first-submit-attempted', true)

          // Second submission for the same date -- should now show a
          // ConfirmDialog (today's Pass C2 fix) instead of silently
          // overwriting the prior close.
          const amountInput2 = page.locator('input[type="number"]').first()
          if (await amountInput2.count()) {
            await amountInput2.fill('6000')
            const submitBtn2 = page.locator('button', { hasText: /record|submit|close/i }).first()
            if (await submitBtn2.count()) {
              await submitBtn2.click()
              await page.waitForTimeout(600)
              const confirmVisible = await page.locator('text=/already recorded|overwrite/i').count()
              await h.shot(page, 'liveuat-05-cashclose-overwrite-confirm')
              r.log('cashclose-overwrite-shows-confirmation-not-silent', confirmVisible > 0, `matches=${confirmVisible}`)
              // Click through it so the run actually completes cleanly.
              const confirmBtn = page.locator('button', { hasText: 'Update Close' }).last()
              if (await confirmBtn.count()) await confirmBtn.click()
              await page.waitForTimeout(500)
            }
          }
        } else {
          r.log('cashclose-submit-button-found', false, 'could not locate submit button, screen may differ from assumed layout')
        }
      } else {
        r.log('cashclose-amount-input-found', false, 'could not locate amount input, screen may differ from assumed layout')
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))

    // cleanupByNamePrefix only covers Customer/Product -- this suite also
    // created HotelRoom/HotelBooking/HotelGuestId rows (by room-number
    // prefix, not customer/product name) and, if the pre-check found it
    // safe, a DailyCashClose row for today (only ever OUR own row: the
    // pre-check refused to touch a real pre-existing close and everything
    // this suite writes there is marked with notes=TEST_PREFIX).
    h.withDb((db) => {
      db.exec('BEGIN')
      const bookingIds = db.prepare(`SELECT id FROM HotelBooking WHERE guestName LIKE ?`).all(`${TEST_PREFIX}%`).map((r) => r.id)
      for (const id of bookingIds) db.prepare('DELETE FROM HotelGuestId WHERE bookingId = ?').run(id)
      if (bookingIds.length) db.prepare(`DELETE FROM HotelBooking WHERE guestName LIKE ?`).run(`${TEST_PREFIX}%`)
      const roomsRemoved = db.prepare(`DELETE FROM HotelRoom WHERE roomNumber LIKE ?`).run(`${TEST_PREFIX}%`).changes
      const cashCloseRemoved = db.prepare(`DELETE FROM DailyCashClose WHERE notes = ?`).run(TEST_PREFIX).changes
      db.exec('COMMIT')
      console.log('extra cleanup:', JSON.stringify({ hotelBookingsRemoved: bookingIds.length, roomsRemoved, cashCloseRemoved }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLIVE UAT SWEEP: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
