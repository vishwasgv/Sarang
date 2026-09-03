/**
 * Suite 142 — Section C medium CRUD gaps: bulkListOrder.delete,
 * equipmentCheckout.return/delete, eventVendorBooking (whole file).
 * bulkListOrder.delete and equipmentCheckout.delete have NO UI trigger
 * anywhere in the renderer (confirmed via grep) -- real product gaps
 * (no way to remove a bulk-list order or a checkout record entirely) --
 * covered API-only. equipmentCheckout.return (Mark Returned button on
 * ShootsScreen.tsx) and the entire eventVendorBooking feature (create/
 * update-status/delete/recordFeedback/list on EventsScreen.tsx) had zero
 * prior coverage of any kind and are driven via real UI here.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Sec142'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ═══ bulkListOrder.delete (Stationery) ═══
    await r.step('switch-to-stationery', async () => {
      const sw = await h.switchBusinessType(page, 'Stationery / Book Store')
      r.log('business-type-switched', sw.to === 'STATIONERY', JSON.stringify(sw))
    })

    let bulkOrderId
    await r.step('seed-and-delete-bulk-list-order-api-only-no-ui-trigger', async () => {
      const res = await page.evaluate(({ name, custName }) => window.api.bulkListOrder.create({
        listName: name, customerName: custName, items: [{ itemLabel: 'Notebook 200pg', requestedQty: 5 }],
      }), { name: `${TEST_PREFIX} List ${suffix}`, custName: `${TEST_PREFIX} School ${suffix}` })
      bulkOrderId = res?.data?.id
      r.log('bulk-order-created', !!bulkOrderId, JSON.stringify(res?.error || ''))
      if (!bulkOrderId) return

      const delRes = await page.evaluate((id) => window.api.bulkListOrder.delete({ id }), bulkOrderId)
      r.log('bulk-order-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      const listRes = await page.evaluate(async () => window.api.bulkListOrder.list({}))
      r.log('bulk-order-actually-deleted', !(listRes?.data || []).some((o) => o.id === bulkOrderId), JSON.stringify(listRes?.data?.length))
    })

    // ═══ equipmentCheckout.return (UI) + delete (API-only) (Photo Studio) ═══
    await r.step('switch-to-photo-studio', async () => {
      const sw = await h.switchBusinessType(page, 'Photography Studio')
      r.log('business-type-switched-photo', sw.to === 'PHOTO_STUDIO', JSON.stringify(sw))
    })

    let bookingId, assetId, checkoutId
    const assetName = `${TEST_PREFIX} Camera ${suffix}`
    await r.step('seed-shoot-booking-asset-and-checkout', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Photo Client ${suffix}`)
      const clientId = custRes?.data?.id

      const bookingRes = await page.evaluate(({ cid, date }) => window.api.shootBooking.create({
        clientId: cid, shootDate: date, shootLocation: `${'E2E Sec142'} Venue`,
        shootType: 'PORTRAIT', estimatedDurationHours: 2,
      }), { cid: clientId, date: h.toLocalISODate(new Date(Date.now() + 5 * 24 * 3600000)) })
      bookingId = bookingRes?.data?.id
      r.log('shoot-booking-created', !!bookingId, JSON.stringify(bookingRes?.error || ''))

      const assetRes = await page.evaluate(({ name, today }) => window.api.fixedAssets.create({
        assetCode: `E2E-CAM-142-${Date.now()}`, assetName: name, purchaseDate: today, purchaseCost: 60000, usefulLifeMonths: 36,
      }), { name: assetName, today: h.toLocalISODate(new Date()) })
      assetId = assetRes?.data?.id
      r.log('asset-created', !!assetId, JSON.stringify(assetRes?.error || ''))

      if (assetId && bookingId) {
        const coRes = await page.evaluate(({ aid, bid, today }) => window.api.equipmentCheckout.checkOut({
          fixedAssetId: aid, shootBookingId: bid, checkedOutDate: today,
        }), { aid: assetId, bid: bookingId, today: h.toLocalISODate(new Date()) })
        checkoutId = coRes?.data?.id
        r.log('checkout-created', !!checkoutId, JSON.stringify(coRes?.error || ''))
      }
    })

    await r.step('mark-equipment-returned-via-ui', async () => {
      if (!bookingId || !checkoutId) return r.log('mark-equipment-returned-via-ui', false, 'missing prerequisites')
      await h.gotoHash(page, '#/photo/shoots')
      await page.waitForTimeout(700)
      r.log('shoots-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const bookingRow = page.locator('p', { hasText: `${TEST_PREFIX} Photo Client ${suffix}` }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
      await bookingRow.click()
      await page.waitForTimeout(500)

      const section = page.locator('p', { hasText: 'Equipment Checked Out' }).locator('xpath=ancestor::div[contains(@class,"mt-4")][1]')
      const row = section.locator('div.flex.items-center.gap-2.text-xs', { hasText: assetName }).first()
      await row.getByRole('button', { name: 'Mark Returned' }).click()
      await page.waitForTimeout(900)
      r.log('mark-returned-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.equipmentCheckout.list({ fixedAssetId: id }), assetId)
      const found = (getRes?.data || []).find((c) => c.id === checkoutId)
      r.log('checkout-actually-returned', !!found?.actualReturnDate, JSON.stringify(found))
    })

    await r.step('delete-equipment-checkout-api-only-no-ui-trigger', async () => {
      if (!checkoutId) return r.log('delete-equipment-checkout-api-only-no-ui-trigger', false, 'no checkoutId')
      const delRes = await page.evaluate((id) => window.api.equipmentCheckout.delete({ id }), checkoutId)
      r.log('checkout-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      const listRes = await page.evaluate((id) => window.api.equipmentCheckout.list({ fixedAssetId: id }), assetId)
      r.log('checkout-actually-deleted', !(listRes?.data || []).some((c) => c.id === checkoutId), JSON.stringify(listRes?.data))
    })

    // ═══ eventVendorBooking: whole file, zero prior coverage (Event Management) ═══
    await r.step('switch-to-event-management', async () => {
      const sw = await h.switchBusinessType(page, 'Event Management')
      r.log('business-type-switched-event', sw.to === 'EVENT_MANAGEMENT', JSON.stringify(sw))
    })

    let eventId, supplierId
    const eventName = `${TEST_PREFIX} Wedding ${suffix}`
    const vendorName = `${TEST_PREFIX} Catering Vendor ${suffix}`
    await r.step('seed-event-and-supplier-via-api', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Event Client ${suffix}`)
      const clientId = custRes?.data?.id

      const evRes = await page.evaluate(({ cid, name, date }) => window.api.eventBooking.create({
        clientId: cid, eventName: name, eventType: 'WEDDING', eventDate: date, venueName: `${'E2E Sec142'} Grand Hall`,
      }), { cid: clientId, name: eventName, date: h.toLocalISODate(new Date(Date.now() + 30 * 24 * 3600000)) })
      eventId = evRes?.data?.id
      r.log('event-created', !!eventId, JSON.stringify(evRes?.error || ''))

      const supRes = await page.evaluate(async (name) => window.api.suppliers.create({ supplierName: name }), vendorName)
      supplierId = supRes?.data?.id
      r.log('supplier-created', !!supplierId, JSON.stringify(supRes?.error || ''))
    })

    let vendorBookingId
    await r.step('add-vendor-booking-via-ui', async () => {
      if (!eventId || !supplierId) return r.log('add-vendor-booking-via-ui', false, 'missing prerequisites')
      await h.gotoHash(page, '#/events/list')
      await page.waitForTimeout(700)
      r.log('events-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const eventRow = page.locator('p', { hasText: eventName }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
      await eventRow.click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: '+ Add Vendor' }).click()
      await page.waitForTimeout(400)
      const form = page.locator('p', { hasText: 'Add Vendor' }).locator('xpath=ancestor::div[contains(@class,"border-t")][1]')
      await form.locator('select').first().selectOption({ label: vendorName })
      await form.getByPlaceholder('Quoted amount *').fill('25000')
      await page.waitForTimeout(200)
      await form.getByRole('button', { name: 'Add Vendor', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('add-vendor-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((id) => window.api.eventVendorBooking.list(id), eventId)
      const found = (listRes?.data || []).find((v) => v.vendor?.supplierName === vendorName)
      vendorBookingId = found?.id
      r.log('vendor-booking-persisted', !!vendorBookingId && found?.status === 'ENQUIRED' && found?.quotedAmount === 25000, JSON.stringify(found))
    })

    await r.step('update-vendor-status-and-rate-via-ui', async () => {
      if (!vendorBookingId) return r.log('update-vendor-status-and-rate-via-ui', false, 'no vendorBookingId')
      const row = page.locator('p', { hasText: vendorName }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      await row.locator('select').selectOption('CONFIRMED')
      await page.waitForTimeout(900)
      r.log('vendor-status-update-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((id) => window.api.eventVendorBooking.list(id), eventId)
      let found = (listRes?.data || []).find((v) => v.id === vendorBookingId)
      r.log('vendor-status-actually-updated', found?.status === 'CONFIRMED', JSON.stringify(found))

      const freshRow = page.locator('p', { hasText: vendorName }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      await freshRow.getByRole('button', { name: 'Rate' }).click()
      await page.waitForTimeout(400)
      await freshRow.locator('button', { hasText: '★' }).nth(3).click()
      await freshRow.getByPlaceholder('Feedback notes (optional)').fill(`${TEST_PREFIX} great service`)
      await freshRow.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('vendor-rate-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.eventVendorBooking.list(id), eventId)
      found = (listRes?.data || []).find((v) => v.id === vendorBookingId)
      r.log('vendor-rating-actually-recorded', found?.vendorRating === 4 && found?.vendorFeedback === `${TEST_PREFIX} great service`, JSON.stringify(found))
    })

    await r.step('remove-vendor-via-ui', async () => {
      if (!vendorBookingId) return r.log('remove-vendor-via-ui', false, 'no vendorBookingId')
      const row = page.locator('p', { hasText: vendorName }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      await row.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      // "Remove", not "Delete" -- a different ConfirmDialog instance than
      // the event-delete one on the same screen.
      await page.getByRole('button', { name: 'Remove', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('remove-vendor-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((id) => window.api.eventVendorBooking.list(id), eventId)
      r.log('vendor-booking-actually-removed', !(listRes?.data || []).some((v) => v.id === vendorBookingId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'EVENT_MANAGEMENT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let bulkOrders = 0, checkouts = 0, assets = 0, bookings = 0, vendorBookings = 0, events = 0, suppliers = 0, custs = 0
      try { bulkOrders += db.prepare(`DELETE FROM BulkListOrder WHERE listName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const assetIds = db.prepare(`SELECT id FROM FixedAsset WHERE assetName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const aid of assetIds) {
        try { checkouts += db.prepare('DELETE FROM EquipmentCheckout WHERE fixedAssetId = ?').run(aid).changes } catch { /* noop */ }
        try { assets += db.prepare('DELETE FROM FixedAsset WHERE id = ?').run(aid).changes } catch { /* noop */ }
      }
      const bookingIds = db.prepare(`SELECT id FROM ShootBooking WHERE shootLocation LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const bid of bookingIds) { try { bookings += db.prepare('DELETE FROM ShootBooking WHERE id = ?').run(bid).changes } catch { /* noop */ } }
      const eventIds = db.prepare(`SELECT id FROM EventBooking WHERE eventName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const eid of eventIds) {
        try { vendorBookings += db.prepare('DELETE FROM EventVendorBooking WHERE eventId = ?').run(eid).changes } catch { /* noop */ }
        try { events += db.prepare('DELETE FROM EventBooking WHERE id = ?').run(eid).changes } catch { /* noop */ }
      }
      try { suppliers += db.prepare(`DELETE FROM Supplier WHERE supplierName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ bulkOrders, checkouts, assets, bookings, vendorBookings, events, suppliers, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBULK-LIST/EQUIP-CHECKOUT/VENDOR-BOOKING: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
