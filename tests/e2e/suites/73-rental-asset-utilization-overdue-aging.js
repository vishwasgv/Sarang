/**
 * Suite 73 — Rental vertical, Phase 67 §9.1 items 3 and 4: Asset
 * Utilization Rate (per-individual-unit, worst-earning-first) and the
 * Overdue Returns aging breakdown. Items 1 (security-deposit ledger), 2
 * (damage-charge workflow), and 5 (service-interval maintenance
 * scheduling) were already fully built pre-Phase-67 and are untouched.
 * This is the first-ever E2E suite to drive Rental Booking creation end
 * to end (no prior suite exercised rental.createBooking/checkoutBooking).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E RENT73'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let rentalTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-rental', async () => {
      const sw = await h.switchBusinessType(page, 'Rental Business')
      r.log('business-type-switched', sw.to === 'RENTAL', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      rentalTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('RENTAL')
      if (rentalTemplateRowBefore) {
        const mods = new Set(JSON.parse(rentalTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), rentalTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'RENTAL', JSON.stringify(['ai_assistant']))
      }
    })

    // ─── Setup via API — same convention this whole arc uses: real UI
    // interaction is reserved for the NEW capabilities under test, not the
    // baseline customer/product/booking scaffolding. ─────────────────────
    let customerId, utilProductId, unitAId, unitBId

    await r.step('setup-customer-and-unit-tracked-product', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer`, phone: `8${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Utilization Product`, productType: 'SERVICE', sellingPrice: 0, unit: 'NOS',
        isRentable: true, rentalTrackingType: 'UNIT', rentalRates: [{ basis: 'DAY', amount: 500 }],
      }), TEST_PREFIX)
      utilProductId = prodRes?.data?.id
      r.log('unit-tracked-product-created', !!utilProductId, JSON.stringify(prodRes?.error || ''))

      const unitARes = await page.evaluate(async ({ prodId, prefix }) => window.api.rental.createUnit({
        productId: prodId, unitLabel: `${prefix} Unit A`,
      }), { prodId: utilProductId, prefix: TEST_PREFIX })
      unitAId = unitARes?.data?.id
      const unitBRes = await page.evaluate(async ({ prodId, prefix }) => window.api.rental.createUnit({
        productId: prodId, unitLabel: `${prefix} Unit B`,
      }), { prodId: utilProductId, prefix: TEST_PREFIX })
      unitBId = unitBRes?.data?.id
      r.log('both-units-created', !!unitAId && !!unitBId, JSON.stringify({ unitAId, unitBId }))
    })

    // ─── Phase 67 §9.1 item 3: Asset Utilization Rate, per individual unit ──
    let busyUnitId, idleUnitId

    await r.step('book-and-checkout-one-unit-leaving-the-other-idle', async () => {
      if (!customerId || !utilProductId) return r.log('book-and-checkout-one-unit-leaving-the-other-idle', false, 'missing setup ids')

      const start = new Date(Date.now() - 5 * 86400000)
      const end = new Date()
      const bookingRes = await page.evaluate(async (p) => window.api.rental.createBooking(p), {
        customerId, startDateTime: start.toISOString(), endDateTime: end.toISOString(),
        items: [{ productId: utilProductId, rateBasis: 'DAY' }],
      })
      r.log('utilization-booking-created', !!bookingRes?.success, JSON.stringify(bookingRes?.error || ''))
      const bookingId = bookingRes?.data?.id
      busyUnitId = bookingRes?.data?.items?.[0]?.rentalUnitId
      idleUnitId = busyUnitId === unitAId ? unitBId : unitAId
      r.log('booking-claimed-one-of-our-two-units', busyUnitId === unitAId || busyUnitId === unitBId, JSON.stringify({ busyUnitId, unitAId, unitBId }))

      if (bookingId) {
        const coRes = await page.evaluate(async (id) => window.api.rental.checkoutBooking({ id }), bookingId)
        r.log('utilization-booking-checked-out', !!coRes?.success, JSON.stringify(coRes?.error || ''))
      }
    })

    await r.step('asset-utilization-report-computes-and-renders-correctly', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())

      const reportRes = await page.evaluate((p) => window.api.reports.assetUtilization(p), { dateFrom, dateTo })
      r.log('asset-utilization-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const rows = reportRes?.data?.rows ?? []
      const busyIdx = rows.findIndex((row) => row.rentalUnitId === busyUnitId)
      const idleIdx = rows.findIndex((row) => row.rentalUnitId === idleUnitId)
      r.log('both-our-units-present-in-report', busyIdx >= 0 && idleIdx >= 0, JSON.stringify({ busyIdx, idleIdx, busyRow: rows[busyIdx], idleRow: rows[idleIdx] }))
      r.log('busy-unit-has-nonzero-utilization', (rows[busyIdx]?.utilizationPercent ?? 0) > 0, JSON.stringify(rows[busyIdx]))
      r.log('idle-unit-has-zero-utilization', rows[idleIdx]?.utilizationPercent === 0, JSON.stringify(rows[idleIdx]))
      // Worst-earning-first sort: the idle (0%) row must rank at or before
      // the busy (>0%) row — a stable invariant regardless of whatever else
      // is in the shared dev DB.
      r.log('idle-unit-ranks-before-busy-unit', idleIdx >= 0 && busyIdx >= 0 && idleIdx <= busyIdx, JSON.stringify({ idleIdx, busyIdx }))
      r.log('idle-unit-count-includes-ours', (reportRes?.data?.summary?.idleUnitCount ?? 0) >= 1, JSON.stringify(reportRes?.data?.summary))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Asset Utilization Rate' }).first()
      r.log('asset-utilization-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('asset-utilization-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('asset-utilization-shows-both-our-units', bodyText.includes(`${TEST_PREFIX} Unit A`) && bodyText.includes(`${TEST_PREFIX} Unit B`), bodyText.slice(0, 4000))
        await h.shot(page, 'rental-asset-utilization')
      }
    })

    // ─── Phase 67 §9.1 item 4: Overdue Returns aging breakdown ──────────────
    let overdueBookingNumber

    await r.step('book-checkout-and-backdate-past-due-via-real-ui', async () => {
      const overdueProdRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Overdue Product`, productType: 'SERVICE', sellingPrice: 0, unit: 'NOS',
        isRentable: true, rentalTrackingType: 'UNIT', rentalRates: [{ basis: 'DAY', amount: 300 }],
      }), TEST_PREFIX)
      const overdueProductId = overdueProdRes?.data?.id
      if (!overdueProductId || !customerId) return r.log('book-checkout-and-backdate-past-due-via-real-ui', false, 'missing overdueProductId or customerId')

      const unitRes = await page.evaluate(async ({ prodId, prefix }) => window.api.rental.createUnit({
        productId: prodId, unitLabel: `${prefix} Overdue Unit`,
      }), { prodId: overdueProductId, prefix: TEST_PREFIX })
      const overdueUnitId = unitRes?.data?.id

      // Already-ended date range (10 days ago -> 6 days ago), valid at
      // creation time (end > start) — a booking that's simply never been
      // returned, exactly like a real overdue rental.
      const start = new Date(Date.now() - 10 * 86400000)
      const end = new Date(Date.now() - 6 * 86400000)
      const bookingRes = await page.evaluate(async (p) => window.api.rental.createBooking(p), {
        customerId, startDateTime: start.toISOString(), endDateTime: end.toISOString(),
        items: [{ productId: overdueProductId, rateBasis: 'DAY' }],
      })
      r.log('overdue-booking-created', !!bookingRes?.success, JSON.stringify(bookingRes?.error || ''))
      overdueBookingNumber = bookingRes?.data?.bookingNumber
      const bookingId = bookingRes?.data?.id

      if (bookingId) {
        const coRes = await page.evaluate(async (id) => window.api.rental.checkoutBooking({ id }), bookingId)
        r.log('overdue-booking-checked-out', !!coRes?.success, JSON.stringify(coRes?.error || ''))
      }
      r.log('overdue-unit-created', !!overdueUnitId)
    })

    await r.step('overdue-aging-report-computes-and-renders-correctly', async () => {
      const reportRes = await page.evaluate(() => window.api.reports.rentalStatus())
      r.log('rental-status-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const buckets = reportRes?.data?.agingBuckets ?? []
      const midBucket = buckets.find((b) => b.bucket === '4-7 days')
      // Lower bound, not exact — same shared-dev-DB convention this whole
      // arc uses. ~6 days elapsed since endDateTime lands reliably in
      // 4-7 days regardless of a few seconds/minutes of test execution drift.
      r.log('overdue-aging-bucket-includes-our-booking', (midBucket?.count ?? 0) >= 1, JSON.stringify(buckets))
      r.log('overdue-count-at-least-one', (reportRes?.data?.summary?.overdueCount ?? 0) >= 1, JSON.stringify(reportRes?.data?.summary))
      const row = (reportRes?.data?.rows ?? []).find((rr) => rr.bookingNumber === overdueBookingNumber)
      r.log('overdue-row-has-our-booking', !!row, JSON.stringify(row))
      r.log('overdue-row-days-overdue-in-range', !!row && row.daysOverdue >= 4 && row.daysOverdue <= 7, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Currently Rented / Overdue' }).first()
      r.log('rental-status-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('rental-status-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('rental-status-shows-aging-chart', bodyText.includes('Overdue Aging'))
        r.log('rental-status-shows-our-overdue-booking', !!overdueBookingNumber && bodyText.includes(overdueBookingNumber))
        await h.shot(page, 'rental-overdue-aging')
      }
    })

    // ─── AI intent for the new Asset Utilization Rate report ────────────────
    await r.step('ai-intent-routes-to-asset-utilization', async () => {
      const res = await page.evaluate(() => window.api.ai.query({ question: 'What is our asset utilization rate?' }))
      r.log('ai-asset-utilization-intent-routed-correctly', res?.data?.template === 'rental.assetUtilization', JSON.stringify({ template: res?.data?.template, answer: res?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'RENTAL') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (rentalTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(rentalTemplateRowBefore.enabledModules, rentalTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('RENTAL', JSON.stringify(['ai_assistant']))
      }
    })
    // Rental-specific cleanup FIRST, in FK-dependency order — RentalBooking.
    // customerId and RentalBookingItem/RentalUnit.productId are plain
    // (RESTRICT) foreign keys, so leftover rental rows would silently force
    // cleanupByNamePrefix's Customer/Product loops into their soft-delete
    // fallback below (leaking rows) instead of a real cleanup, same FK-
    // ordering gotcha as every other Phase 67 suite's own custom cleanup
    // block this session already documents.
    h.withDb((db) => {
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      const bookingIds = new Set()
      for (const pid of prodIds) {
        for (const row of db.prepare('SELECT DISTINCT bookingId FROM RentalBookingItem WHERE productId = ?').all(pid)) bookingIds.add(row.bookingId)
      }
      for (const bid of bookingIds) {
        db.prepare('DELETE FROM RentalBookingItem WHERE bookingId = ?').run(bid)
        try { db.prepare('DELETE FROM RentalBooking WHERE id = ?').run(bid) } catch { /* leave it */ }
      }
      const unitIds = db.prepare(`SELECT id FROM RentalUnit WHERE unitLabel LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const uid of unitIds) { try { db.prepare('DELETE FROM RentalUnit WHERE id = ?').run(uid) } catch { /* leave it */ } }
      console.log('rental 67 extra cleanup:', JSON.stringify({ bookings: bookingIds.size, units: unitIds.length }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRENTAL ASSET UTILIZATION / OVERDUE AGING: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
