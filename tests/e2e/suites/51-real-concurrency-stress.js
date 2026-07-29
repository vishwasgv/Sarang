/**
 * Suite 51 — Real-concurrency stress tests for the TOCTOU (check-then-act)
 * races found and fixed during the 2026-07-28 service-vertical audit. Every
 * fix listed below was verified with a MOCKED concurrent-call unit test
 * only (fast, single-threaded, not real concurrency). This suite is the
 * first extension of the ONE existing real-concurrency pattern in this repo
 * (09-stress.js, which proves billing.service.ts's createInvoice never
 * oversells stock under genuinely simultaneous IPC calls through a real
 * Electron app against a real SQLite DB) to three of the other same-shaped
 * fixes, firing real concurrent `page.evaluate` + `Promise.all` IPC bursts
 * against the real dev app, not a mock.
 *
 * Picked 3 of the 5 candidate races, on tractability grounds:
 *   - hotel.service.ts checkInBooking — picked. Single IPC call
 *     (hotel:checkIn), trivial raw-SQL fixture (one HotelRoom + one
 *     CONFIRMED HotelBooking), and the guarantee (exactly one
 *     HotelGuestId register entry survives) is a simple COUNT(*).
 *   - restaurant-order.service.ts acceptOrderRequest — picked. Same shape,
 *     and it's the one race whose failure mode (double-billing a real
 *     customer) is the most consequential of the five, so worth the extra
 *     setup (a real Product + TableOrderRequest + TableOrderRequestItem).
 *   - blood-bank.service.ts updateScreeningStatus — picked. Same shape,
 *     minimal fixture (Donor + PENDING DonationRecord), and the guarantee
 *     (exactly one ProductBatch per physical donation) is safety-critical
 *     (double-counted blood-unit inventory).
 *   - rental.service.ts checkoutBooking/returnBooking — NOT picked here.
 *     Same claim-sentinel shape as hotel's, so it would mostly re-prove the
 *     same mechanism against a different table; lower marginal value than
 *     the three above for the added rental-unit/pricing fixture complexity.
 *   - production-order.service.ts completeProductionOrder/cancelProduction
 *     Order — NOT picked here. Needs a real BOM + component stock fixture
 *     to observe the finished-goods double-credit, meaningfully heavier
 *     setup than the three chosen; a good next candidate for a follow-up
 *     suite, not dropped for any correctness concern.
 *
 * This suite does its own raw-SQL setup/teardown for the fixture tables
 * these three races touch (HotelRoom/HotelBooking/HotelGuestId,
 * RestaurantTable/TableOrderRequest(Item), Donor/DonationRecord/
 * ProductBatch) — h.cleanupByNamePrefix only knows about Customer/Product
 * and their Invoice/CustomerLedger/Inventory dependents, so it's reused
 * here only for the one real Product this suite creates (the restaurant
 * test item) and the Invoice/InvoiceItem/Payment that acceptOrderRequest's
 * single winning call creates against it. Every other row this suite
 * creates is deleted by rawCleanup() below, called both as a self-healing
 * pre-run sweep (same rationale as 09-stress.js's own pre-cleanup — a
 * force-killed prior run skips the `finally` block) and in the real
 * teardown.
 */
const h = require('../harness')
const crypto = require('crypto')

const TEST_PREFIX = 'E2E RealConcurrency'

function newId() { return crypto.randomUUID() }

// Deletes every row this suite's three fixtures could have created, tagged
// by TEST_PREFIX in a unique-enough column (roomNumber/bookingNumber for
// hotel, tableNumber for restaurant, donorCode/donationNumber for blood
// bank). Safe to call on an empty DB (every DELETE is a no-op) and safe to
// call before h.cleanupByNamePrefix (KOT rows are removed here first, so
// that call's own Invoice delete doesn't get blocked by KOT's FK).
function rawCleanup(prefix) {
  return h.withDb((db) => {
    const like = `${prefix}%`
    db.exec('BEGIN')

    // ── Hotel ──────────────────────────────────────────────────────────
    const bookingIds = db.prepare('SELECT id FROM HotelBooking WHERE bookingNumber LIKE ?').all(like).map((r) => r.id)
    for (const bid of bookingIds) {
      db.prepare('DELETE FROM HotelGuestId WHERE bookingId = ?').run(bid)
      db.prepare('DELETE FROM HotelHousekeepingTask WHERE bookingId = ?').run(bid)
    }
    db.prepare('DELETE FROM HotelBooking WHERE bookingNumber LIKE ?').run(like)
    db.prepare('DELETE FROM HotelRoom WHERE roomNumber LIKE ?').run(like)

    // ── Restaurant QR ordering ────────────────────────────────────────
    const tableIds = db.prepare('SELECT id FROM RestaurantTable WHERE tableNumber LIKE ?').all(like).map((r) => r.id)
    for (const tid of tableIds) {
      const reqIds = db.prepare('SELECT id FROM TableOrderRequest WHERE tableId = ?').all(tid).map((r) => r.id)
      for (const rid of reqIds) {
        db.prepare('DELETE FROM TableOrderRequestItem WHERE requestId = ?').run(rid)
      }
      // KOT rows must go before h.cleanupByNamePrefix (called separately,
      // after this) tries to delete the Invoice they reference — its own
      // Invoice-delete is a best-effort try/catch that silently leaves the
      // Invoice behind on any FK block, and KOT is exactly such a block.
      db.prepare('DELETE FROM KOT WHERE tableId = ?').run(tid)
      db.prepare('DELETE FROM TableOrderRequest WHERE tableId = ?').run(tid)
    }
    db.prepare('DELETE FROM RestaurantTable WHERE tableNumber LIKE ?').run(like)

    // ── Blood bank ────────────────────────────────────────────────────
    // DonationRecord.productBatchId -> ProductBatch is ON DELETE SET NULL,
    // so either delete order works, but DonationRecord first avoids leaving
    // a dangling productBatchId reference mid-sweep.
    db.prepare('DELETE FROM DonationRecord WHERE donationNumber LIKE ?').run(like)
    db.prepare('DELETE FROM ProductBatch WHERE batchNumber LIKE ?').run(like)
    db.prepare('DELETE FROM Donor WHERE donorCode LIKE ?').run(like)

    db.exec('COMMIT')
  })
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  // Self-healing pre-cleanup — same rationale as 09-stress.js: a
  // force-killed previous run skips the `finally` teardown entirely.
  rawCleanup(TEST_PREFIX)
  h.cleanupByNamePrefix(TEST_PREFIX)
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ══════════════════════════════════════════════════════════════════
    // 1. hotel.service.ts checkInBooking — double-click / two-terminal
    //    check-in must not create a duplicate guest-register entry.
    // ══════════════════════════════════════════════════════════════════
    const HOTEL_N = 10
    const hotelRoomNumber = `${TEST_PREFIX} Room ${Date.now()}`
    const hotelBookingNumber = `${TEST_PREFIX} HTL-${Date.now()}`
    let hotelRoomId, hotelBookingId

    await r.step('hotel-setup-confirmed-booking', async () => {
      hotelRoomId = newId()
      hotelBookingId = newId()
      const checkIn = new Date()
      const checkOut = new Date(Date.now() + 86400000)
      h.withDb((db) => {
        db.exec('BEGIN')
        db.prepare(`INSERT INTO HotelRoom (id, roomNumber, roomType, status, updatedAt)
          VALUES (?, ?, 'Deluxe', 'AVAILABLE', CURRENT_TIMESTAMP)`).run(hotelRoomId, hotelRoomNumber)
        db.prepare(`INSERT INTO HotelBooking (id, bookingNumber, roomId, guestName, checkInDate, checkOutDate, ratePerNight, status, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, 2000, 'CONFIRMED', CURRENT_TIMESTAMP)`).run(
          hotelBookingId, hotelBookingNumber, hotelRoomId, `${TEST_PREFIX} Guest`, checkIn.toISOString(), checkOut.toISOString()
        )
        db.exec('COMMIT')
      })
      const row = h.withDb((db) => db.prepare('SELECT status FROM HotelBooking WHERE id = ?').get(hotelBookingId))
      r.log('hotel-setup-booking-confirmed', row?.status === 'CONFIRMED', `status=${row?.status}`)
    })

    await r.step('hotel-concurrent-checkin-exactly-one-wins', async () => {
      const results = await page.evaluate(async ({ id, n, prefix }) => {
        const calls = Array.from({ length: n }, (_, i) => window.api.hotel.checkIn({
          id,
          guests: [{ guestName: `${prefix} Guest ${i}`, idType: 'PASSPORT', idNumber: `P${i}-${Date.now()}` }],
        }).catch((e) => ({ success: false, error: { code: 'PROMISE-REJECTED', message: String((e && e.message) || e) } })))
        const settled = await Promise.all(calls)
        return settled.map((res) => ({ success: res?.success, code: res?.error?.code }))
      }, { id: hotelBookingId, n: HOTEL_N, prefix: TEST_PREFIX })

      const successCount = results.filter((x) => x.success).length
      r.log(
        'hotel-exactly-one-checkin-succeeds-under-real-concurrency',
        successCount === 1,
        `success=${successCount}/${HOTEL_N}, codes=${JSON.stringify(results.filter((x) => !x.success).map((x) => x.code))}`
      )

      const state = h.withDb((db) => ({
        booking: db.prepare('SELECT status FROM HotelBooking WHERE id = ?').get(hotelBookingId),
        room: db.prepare('SELECT status FROM HotelRoom WHERE id = ?').get(hotelRoomId),
        guestCount: db.prepare('SELECT COUNT(*) c FROM HotelGuestId WHERE bookingId = ?').get(hotelBookingId).c,
      }))
      r.log('hotel-booking-ends-checked-in', state.booking?.status === 'CHECKED_IN', `status=${state.booking?.status}`)
      r.log('hotel-room-ends-occupied', state.room?.status === 'OCCUPIED', `status=${state.room?.status}`)
      // The one non-negotiable guarantee this test exists to verify: the
      // legal guest-register must have exactly one entry per physical
      // check-in, never HOTEL_N duplicates from a losing-but-still-written
      // concurrent call.
      r.log(
        'hotel-guest-register-has-exactly-one-entry-not-duplicated',
        state.guestCount === 1,
        `guestCount=${state.guestCount} (expected 1 — the bug this guards against would have written up to ${HOTEL_N})`
      )
    })

    // ══════════════════════════════════════════════════════════════════
    // 2. restaurant-order.service.ts acceptOrderRequest — a double-tap
    //    "Accept" on a QR order must not double-bill the customer.
    // ══════════════════════════════════════════════════════════════════
    const RESTO_N = 8
    const restoTableNumber = `${TEST_PREFIX} Table ${Date.now()}`
    let restoTableId, restoRequestId, restoProductId

    await r.step('restaurant-setup-pending-order', async () => {
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} QR Race Item`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 30, sellingPrice: 80, taxRate: 5, openingQuantity: 1000,
      }), TEST_PREFIX)
      restoProductId = prodRes?.data?.id
      r.log('restaurant-test-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      restoTableId = newId()
      restoRequestId = newId()
      h.withDb((db) => {
        db.exec('BEGIN')
        db.prepare(`INSERT INTO RestaurantTable (id, tableNumber, status) VALUES (?, ?, 'AVAILABLE')`).run(restoTableId, restoTableNumber)
        db.prepare(`INSERT INTO TableOrderRequest (id, tableId, status) VALUES (?, ?, 'PENDING')`).run(restoRequestId, restoTableId)
        db.prepare(`INSERT INTO TableOrderRequestItem (id, requestId, productId, quantity) VALUES (?, ?, ?, 2)`).run(newId(), restoRequestId, restoProductId)
        db.exec('COMMIT')
      })
      const row = h.withDb((db) => db.prepare('SELECT status FROM TableOrderRequest WHERE id = ?').get(restoRequestId))
      r.log('restaurant-setup-request-pending', row?.status === 'PENDING', `status=${row?.status}`)
    })

    await r.step('restaurant-concurrent-accept-never-double-bills', async () => {
      if (!restoProductId) return r.log('restaurant-concurrent-accept-never-double-bills', false, 'no test product — setup failed')
      const results = await page.evaluate(async ({ requestId, n }) => {
        const calls = Array.from({ length: n }, () => window.api.restaurant.acceptOrderRequest({
          requestId, paymentMethod: 'CASH',
        }).catch((e) => ({ success: false, error: { code: 'PROMISE-REJECTED', message: String((e && e.message) || e) } })))
        const settled = await Promise.all(calls)
        return settled.map((res) => ({ success: res?.success, code: res?.error?.code, invoiceId: res?.data?.invoiceId }))
      }, { requestId: restoRequestId, n: RESTO_N })

      const successes = results.filter((x) => x.success)
      r.log(
        'restaurant-exactly-one-accept-succeeds-under-real-concurrency',
        successes.length === 1,
        `success=${successes.length}/${RESTO_N}, codes=${JSON.stringify(results.filter((x) => !x.success).map((x) => x.code))}`
      )

      const distinctInvoiceIds = new Set(successes.map((x) => x.invoiceId).filter(Boolean))
      r.log('restaurant-only-one-invoice-id-returned', distinctInvoiceIds.size === 1, `invoiceIds=${JSON.stringify([...distinctInvoiceIds])}`)

      // acceptOrderRequest passes `QR-${tableId.slice(-6)}` as
      // createInvoice's `referenceNumber`, which billing.service.ts stores
      // on the created Payment row (Invoice itself has no referenceNumber
      // column) — count ground-truth Payment rows tagged with it, not just
      // trust the IPC responses above.
      const state = h.withDb((db) => ({
        request: db.prepare('SELECT status, invoiceId FROM TableOrderRequest WHERE id = ?').get(restoRequestId),
        invoiceCount: db.prepare('SELECT COUNT(*) c FROM Payment WHERE referenceNumber = ?').get(`QR-${restoTableId.slice(-6)}`).c,
      }))
      r.log('restaurant-request-ends-accepted', state.request?.status === 'ACCEPTED', `status=${state.request?.status}`)
      // The one non-negotiable guarantee: one physical QR order must
      // produce exactly one Invoice, never RESTO_N duplicate bills for the
      // same order.
      r.log(
        'restaurant-customer-billed-exactly-once-not-doubled',
        state.invoiceCount === 1,
        `invoiceCount=${state.invoiceCount} (expected 1 — the bug this guards against would have created up to ${RESTO_N})`
      )
    })

    // ══════════════════════════════════════════════════════════════════
    // 3. blood-bank.service.ts updateScreeningStatus — two near-
    //    simultaneous PASSED calls for one donation must not create two
    //    ProductBatch rows for one physical unit of donated blood.
    // ══════════════════════════════════════════════════════════════════
    const BLOOD_N = 10
    const donorCode = `${TEST_PREFIX}-DNR-${Date.now()}`
    const donationNumber = `${TEST_PREFIX}-DON-${Date.now()}`
    let donorId, donationId

    await r.step('bloodbank-setup-pending-donation', async () => {
      donorId = newId()
      donationId = newId()
      h.withDb((db) => {
        db.exec('BEGIN')
        db.prepare(`INSERT INTO Donor (id, donorCode, fullName, bloodGroup, updatedAt) VALUES (?, ?, ?, 'O+', CURRENT_TIMESTAMP)`)
          .run(donorId, donorCode, `${TEST_PREFIX} Donor`)
        db.prepare(`INSERT INTO DonationRecord (id, donationNumber, donorId, bloodGroup, screeningStatus, createdBy, updatedAt)
          VALUES (?, ?, ?, 'O+', 'PENDING', 'system', CURRENT_TIMESTAMP)`).run(donationId, donationNumber, donorId)
        db.exec('COMMIT')
      })
      const row = h.withDb((db) => db.prepare('SELECT screeningStatus FROM DonationRecord WHERE id = ?').get(donationId))
      r.log('bloodbank-setup-donation-pending', row?.screeningStatus === 'PENDING', `status=${row?.screeningStatus}`)
    })

    await r.step('bloodbank-concurrent-pass-exactly-one-batch', async () => {
      const results = await page.evaluate(async ({ id, n }) => {
        const calls = Array.from({ length: n }, () => window.api.bloodBank.updateScreeningStatus({
          id, screeningStatus: 'PASSED',
        }).catch((e) => ({ success: false, error: { code: 'PROMISE-REJECTED', message: String((e && e.message) || e) } })))
        const settled = await Promise.all(calls)
        return settled.map((res) => ({ success: res?.success, code: res?.error?.code }))
      }, { id: donationId, n: BLOOD_N })

      const successCount = results.filter((x) => x.success).length
      r.log(
        'bloodbank-exactly-one-pass-succeeds-under-real-concurrency',
        successCount === 1,
        `success=${successCount}/${BLOOD_N}, codes=${JSON.stringify(results.filter((x) => !x.success).map((x) => x.code))}`
      )

      const state = h.withDb((db) => ({
        record: db.prepare('SELECT screeningStatus, productBatchId FROM DonationRecord WHERE id = ?').get(donationId),
        batchCount: db.prepare('SELECT COUNT(*) c FROM ProductBatch WHERE batchNumber = ?').get(donationNumber).c,
      }))
      r.log('bloodbank-record-ends-passed', state.record?.screeningStatus === 'PASSED', `status=${state.record?.screeningStatus}`)
      r.log('bloodbank-record-linked-to-a-batch', !!state.record?.productBatchId, `productBatchId=${state.record?.productBatchId}`)
      // The one non-negotiable guarantee: one physical donated unit must
      // produce exactly one ProductBatch, never BLOOD_N duplicates
      // double-counting real blood-unit inventory.
      r.log(
        'bloodbank-exactly-one-productbatch-not-duplicated',
        state.batchCount === 1,
        `batchCount=${state.batchCount} (expected 1 — the bug this guards against would have created up to ${BLOOD_N})`
      )
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    rawCleanup(TEST_PREFIX)
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nREAL-CONCURRENCY STRESS TESTS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
