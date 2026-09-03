/**
 * Suite 141 — Section C medium CRUD gap: custom-order-booking.handler.ts
 * (create already covered via real UI, suite 91) + catering-event.handler.ts
 * (ZERO prior coverage of any kind, whole file). customOrderBooking.
 * updateStatus/delete and cateringEvent.updateStatus/delete have NO UI
 * trigger anywhere in the renderer (confirmed via grep) -- real product
 * gaps (no way to mark an order delivered/cancelled or delete it once
 * booked) -- covered API-only. generateInvoice for both now driven via
 * real UI (was API-only in suite 91 for customOrderBooking).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E COB141'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-bakery', async () => {
      const sw = await h.switchBusinessType(page, 'Bakery / Sweet Shop')
      r.log('business-type-switched', sw.to === 'BAKERY', JSON.stringify(sw))
    })

    let customerId, productId
    await r.step('seed-customer-and-product', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Customer ${suffix}`)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId)

      const prodRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', sellingPrice: 500, costPrice: 200, openingQuantity: 50,
      }), `${TEST_PREFIX} Custom Cake ${suffix}`)
      productId = prodRes?.data?.id
      r.log('product-created', !!productId)
    })

    // ═══ customOrderBooking: generateInvoice via UI, updateStatus/delete API-only ═══
    let cobId1, cobId2, cobNumber1
    await r.step('seed-two-custom-order-bookings-via-api', async () => {
      const mk = () => page.evaluate(({ cid, pid }) => window.api.customOrderBooking.create({
        customerId: cid, items: [{ productId: pid, quantity: 1, unitPrice: 500 }],
      }), { cid: customerId, pid: productId })
      const res1 = await mk()
      const res2 = await mk()
      cobId1 = res1?.data?.id
      cobId2 = res2?.data?.id
      cobNumber1 = res1?.data?.bookingNumber
      r.log('two-orders-created', !!cobId1 && !!cobId2, JSON.stringify({ e1: res1?.error, e2: res2?.error }))
    })

    await r.step('generate-invoice-for-custom-order-via-ui', async () => {
      if (!cobId1) return r.log('generate-invoice-for-custom-order-via-ui', false, 'no cobId1')
      await h.gotoHash(page, '#/bakery/custom-orders')
      await page.waitForTimeout(700)
      r.log('custom-orders-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Not a bare `div` + hasText -- that matches every ancestor up to the
      // whole-screen container (which "has" a Generate Invoice button too,
      // from either seeded order), not just this row. Scope to the row's
      // own specific class combo.
      const row = page.locator('div.px-5.py-4.flex.items-start.gap-4', { hasText: cobNumber1 }).first()
      await row.getByRole('button', { name: 'Generate Invoice' }).click()
      await page.waitForTimeout(1200)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.customOrderBooking.list({}))
      const found = (listRes?.data || []).find((o) => o.id === cobId1)
      r.log('order-actually-invoiced', !!found?.invoiceId, JSON.stringify(found))
    })

    await r.step('update-status-and-delete-custom-order-api-only-no-ui-trigger', async () => {
      if (!cobId2) return r.log('update-status-and-delete-custom-order-api-only-no-ui-trigger', false, 'no cobId2')
      const updRes = await page.evaluate((id) => window.api.customOrderBooking.updateStatus({ id, status: 'CANCELLED' }), cobId2)
      r.log('order-status-update-api-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      let listRes = await page.evaluate(async () => window.api.customOrderBooking.list({}))
      let found = (listRes?.data || []).find((o) => o.id === cobId2)
      r.log('order-status-actually-updated', found?.status === 'CANCELLED', JSON.stringify(found))

      const delRes = await page.evaluate((id) => window.api.customOrderBooking.delete({ id }), cobId2)
      r.log('order-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      listRes = await page.evaluate(async () => window.api.customOrderBooking.list({}))
      r.log('order-actually-deleted', !(listRes?.data || []).some((o) => o.id === cobId2), JSON.stringify(listRes?.data?.length))
    })

    // ═══ cateringEvent: whole file, zero prior coverage ═══
    let catEventId
    const eventCustomerName = `${TEST_PREFIX} Catering Customer ${suffix}`
    await r.step('create-catering-event-via-ui', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), eventCustomerName)
      r.log('catering-customer-created', !!custRes?.data?.id)

      await h.gotoHash(page, '#/bakery/catering-events')
      await page.waitForTimeout(700)
      r.log('catering-events-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Event' }).click()
      await page.waitForTimeout(400)
      await page.getByPlaceholder('Search by name or phone...').fill(eventCustomerName)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: eventCustomerName }).first().click()
      await page.waitForTimeout(300)

      await page.getByLabel('Event Start Date').fill(h.toLocalISODate(new Date(Date.now() + 14 * 24 * 3600000)))
      await page.getByLabel('Attendee Count').fill('50')
      await page.getByLabel('Price per Plate (₹)').fill('300')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Book Event' }).click()
      await page.waitForTimeout(1200)
      r.log('catering-event-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.cateringEvent.list())
      const found = (listRes?.data || []).find((e) => e.customer?.customerName === eventCustomerName)
      catEventId = found?.id
      r.log('catering-event-persisted', !!catEventId, JSON.stringify({ attendeeCount: found?.attendeeCount, pricePerPlate: found?.pricePerPlate }))
    })

    await r.step('record-final-negotiated-price-via-ui', async () => {
      if (!catEventId) return r.log('record-final-negotiated-price-via-ui', false, 'no catEventId')
      const row = page.locator('div', { hasText: eventCustomerName }).filter({ has: page.getByRole('button', { name: 'Record Final Price' }) }).first()
      await row.getByRole('button', { name: 'Record Final Price' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Final Negotiated Price (₹)').fill('14000')
      await modal.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('record-price-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.cateringEvent.list())
      const found = (listRes?.data || []).find((e) => e.id === catEventId)
      r.log('final-price-actually-recorded', found?.finalNegotiatedPrice === 14000, JSON.stringify(found?.finalNegotiatedPrice))
    })

    await r.step('generate-invoice-for-catering-event-via-ui', async () => {
      if (!catEventId) return r.log('generate-invoice-for-catering-event-via-ui', false, 'no catEventId')
      const row = page.locator('div', { hasText: eventCustomerName }).filter({ has: page.getByRole('button', { name: 'Generate Invoice' }) }).first()
      await row.getByRole('button', { name: 'Generate Invoice' }).click()
      await page.waitForTimeout(1200)
      r.log('catering-generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.cateringEvent.list())
      const found = (listRes?.data || []).find((e) => e.id === catEventId)
      r.log('catering-event-actually-invoiced', !!found?.invoiceId, JSON.stringify(found))
      if (found?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), found.invoiceId)
        r.log('catering-invoice-total-uses-final-negotiated-price', invRes?.data?.totalAmount === 14000, `expected=14000 actual=${invRes?.data?.totalAmount}`)
      }
    })

    let catEventId2
    await r.step('update-status-and-delete-catering-event-api-only-no-ui-trigger', async () => {
      const res2 = await page.evaluate(({ cid, startDate }) => window.api.cateringEvent.create({
        customerId: cid, eventStartDate: startDate, attendeeCount: 20, pricePerPlate: 100,
      }), { cid: customerId, startDate: h.toLocalISODate(new Date(Date.now() + 14 * 24 * 3600000)) })
      catEventId2 = res2?.data?.id
      r.log('second-catering-event-created', !!catEventId2, JSON.stringify(res2?.error || ''))
      if (!catEventId2) return

      const updRes = await page.evaluate((id) => window.api.cateringEvent.updateStatus({ id, status: 'CANCELLED' }), catEventId2)
      r.log('catering-status-update-api-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      let listRes = await page.evaluate(() => window.api.cateringEvent.list())
      let found = (listRes?.data || []).find((e) => e.id === catEventId2)
      r.log('catering-status-actually-updated', found?.status === 'CANCELLED', JSON.stringify(found))

      const delRes = await page.evaluate((id) => window.api.cateringEvent.delete({ id }), catEventId2)
      r.log('catering-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      listRes = await page.evaluate(() => window.api.cateringEvent.list())
      r.log('catering-event-actually-deleted', !(listRes?.data || []).some((e) => e.id === catEventId2), JSON.stringify(listRes?.data?.length))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'BAKERY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let cobItems = 0, cobs = 0, catStaff = 0, catDays = 0, catMenu = 0, cats = 0, prods = 0, custs = 0
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      const cobIds = custIds.length ? db.prepare(`SELECT id FROM CustomOrderBooking WHERE customerId IN (${custIds.map(() => '?').join(',')})`).all(...custIds).map((row) => row.id) : []
      for (const id of cobIds) {
        try { cobItems += db.prepare('DELETE FROM CustomOrderBookingItem WHERE customOrderBookingId = ?').run(id).changes } catch { /* noop */ }
        try { cobs += db.prepare('DELETE FROM CustomOrderBooking WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      const catIds = custIds.length ? db.prepare(`SELECT id FROM CateringEvent WHERE customerId IN (${custIds.map(() => '?').join(',')})`).all(...custIds).map((row) => row.id) : []
      for (const id of catIds) {
        try { catStaff += db.prepare('DELETE FROM CateringEventStaff WHERE cateringEventId = ?').run(id).changes } catch { /* noop */ }
        try { catDays += db.prepare('DELETE FROM CateringEventDay WHERE cateringEventId = ?').run(id).changes } catch { /* noop */ }
        try { catMenu += db.prepare('DELETE FROM CateringEventMenuItem WHERE cateringEventId = ?').run(id).changes } catch { /* noop */ }
        try { cats += db.prepare('DELETE FROM CateringEvent WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ cobItems, cobs, catStaff, catDays, catMenu, cats, prods, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCUSTOM ORDER BOOKING / CATERING EVENT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
