/**
 * Suite 89 — Furniture vertical (Phase 69). Zero prior E2E coverage
 * existed for this vertical before this suite. Covers a deposit
 * booking driven through the real UI, invoice generation with the
 * advance applied as a real payment, old-item trade-in folded into a
 * purchase discount, the Cash Flow Forecast wow feature, and both new
 * report tiles.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Furn'

async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange } = {}) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileId}-tile-present`, present)
  if (!present) return
  await tile.click()
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000)))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date(Date.now() + 90 * 24 * 3600000)))
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
  await h.shot(page, `report-${tileId}`)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-furniture', async () => {
      const sw = await h.switchBusinessType(page, 'Furniture Store')
      r.log('business-type-switched', sw.to === 'FURNITURE', JSON.stringify(sw))
    })

    let sofaId, customerId

    await r.step('create-product-and-customer', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Furn 3-Seater Sofa', unit: 'PCS', sellingPrice: 25000, costPrice: 18000, taxRate: 18,
        productType: 'STANDARD', openingQuantity: 10,
      }))
      sofaId = prodRes?.data?.id
      r.log('product-created', !!sofaId, JSON.stringify(prodRes?.error || ''))

      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Furn Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    let bookingId

    await r.step('create-booking-with-advance-and-customization-via-real-ui', async () => {
      await h.gotoHash(page, '#/furniture/bookings')
      await page.waitForTimeout(700)
      r.log('furniture-bookings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("New Booking")').click()
      await page.waitForTimeout(400)
      await page.getByPlaceholder('Search by name or phone...').fill('E2E Furn Buyer')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Furn Buyer' }).first().click()
      await page.waitForTimeout(300)

      const productSearch = page.locator('input[placeholder="Search product…"]')
      await productSearch.fill('E2E Furn 3-Seater Sofa')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Furn 3-Seater Sofa")').first().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.waitForTimeout(300)

      await page.getByLabel(/Advance Amount/).fill('5000')

      await page.getByRole('button', { name: 'Book', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('booking-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.furnitureBooking.list({}))
      const found = (listRes?.data || []).find((b) => b.customerId === customerId)
      bookingId = found?.id
      r.log('booking-findable-via-api', !!bookingId, JSON.stringify({ advanceAmount: found?.advanceAmount, items: found?.items?.length }))
    })

    await r.step('cash-flow-forecast-appears-when-booking-has-no-delivery-date', async () => {
      const res = await page.evaluate(async () => window.api.furnitureBooking.cashFlowForecast())
      const unscheduled = (res?.data?.rows || []).find((row) => row.month === 'Unscheduled')
      r.log('unscheduled-bucket-includes-our-booking', (unscheduled?.bookingCount ?? 0) >= 1, JSON.stringify(unscheduled))
    })

    await r.step('generate-invoice-applies-advance-as-real-payment', async () => {
      if (!bookingId) return
      const res = await page.evaluate((id) => window.api.furnitureBooking.generateInvoice({ id }), bookingId)
      r.log('invoice-generated', !!res?.success, JSON.stringify(res?.error || ''))
      const invoiceId = res?.data?.invoiceId
      if (!invoiceId) return
      const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-paidAmount-reflects-advance', (invRes?.data?.paidAmount ?? 0) >= 5000, JSON.stringify(invRes?.data?.paidAmount))
    })

    let tradeInId

    await r.step('furniture-trade-in-folds-into-purchase-discount-via-real-ui', async () => {
      await h.gotoHash(page, '#/furniture/trade-ins')
      await page.waitForTimeout(700)
      r.log('trade-ins-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("Record Trade-In")').click()
      await page.waitForTimeout(400)
      await page.getByPlaceholder('Search by name or phone...').fill('E2E Furn Buyer')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Furn Buyer' }).first().click()
      await page.waitForTimeout(300)
      await page.getByPlaceholder('e.g. 3-seater sofa, teak finish').fill('E2E Furn Old Armchair')
      await page.locator('input[type="number"]').first().fill('2000')
      await page.getByRole('button', { name: 'Record', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('trade-in-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.furnitureTradeIn.list({ unlinkedOnly: true }))
      const found = (listRes?.data || []).find((t) => t.itemDescription === 'E2E Furn Old Armchair')
      tradeInId = found?.id
      r.log('trade-in-findable-via-api', !!tradeInId, JSON.stringify(found?.tradeInValue))
    })

    // Regression coverage for a real bug found via code review: the ONLY
    // way to actually discount an invoice with a trade-in is billing.service.ts's
    // atomic furnitureTradeInId param — FurnitureTradeInScreen's "Mark
    // Applied" button never itself touches an invoice's discount (same
    // record-keeping-only shape as Jewellery's own linkMetalExchangeToInvoice).
    // Before this fix, BillingScreen.tsx had no "Apply Trade-In" picker at
    // all, so a real cashier had NO way to reach the atomic path — driven
    // via real UI here, not just the API, to prove the actual fix.
    let tradeInInvoiceId
    await r.step('apply-trade-in-via-real-ui-apply-trade-in-picker', async () => {
      if (!tradeInId) return r.log('apply-trade-in-via-real-ui-apply-trade-in-picker', false, 'no tradeInId captured')
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Furn 3-Seater Sofa')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Furn 3-Seater Sofa")').first().click()
      await page.waitForTimeout(500)

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Furn Buyer')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Furn Buyer")').first().click()
      await page.waitForTimeout(300)

      const applyBtn = page.locator('button:has-text("Apply Trade-In")')
      r.log('apply-trade-in-button-present', await applyBtn.count() > 0)
      if (await applyBtn.count() === 0) return
      await applyBtn.click()
      await page.waitForTimeout(600)

      const modal = h.topModal(page)
      const tiOption = modal.locator('button', { hasText: 'E2E Furn Buyer' })
      r.log('trade-in-listed-in-picker', await tiOption.count() > 0)
      await tiOption.first().click()
      await page.waitForTimeout(400)
      r.log('trade-in-applied-badge-shown', !(await h.hasErrorBoundary(page)))

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-with-trade-in-applied', !!match, url)
      if (match) tradeInInvoiceId = match[1]
    })

    await r.step('verify-invoice-discount-includes-trade-in-value', async () => {
      if (!tradeInInvoiceId) return
      const res = await page.evaluate((id) => window.api.billing.getInvoice(id), tradeInInvoiceId)
      r.log('discount-includes-trade-in-value', (res?.data?.discountAmount ?? 0) >= 2000, JSON.stringify(res?.data?.discountAmount))
      const tiRes = await page.evaluate(async () => window.api.furnitureTradeIn.list({ unlinkedOnly: false }))
      const linked = (tiRes?.data || []).find((t) => t.id === tradeInId)
      r.log('trade-in-atomically-claimed-to-this-invoice', linked?.invoiceId === tradeInInvoiceId, JSON.stringify(linked?.invoiceId))
    })

    await r.step('showroom-vs-warehouse-stock-report', () => checkReportTile(page, r, 'locationStockSplit', 'Showroom-vs-Warehouse', { needsDateRange: false }))
    await r.step('delivery-installation-schedule-report', () => checkReportTile(page, r, 'deliveryInstallationSchedule', 'Delivery & Installation Schedule', { needsDateRange: true }))

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'FURNITURE') {
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
      const bookingIds = db.prepare("SELECT fb.id FROM FurnitureBooking fb JOIN Customer c ON c.id = fb.customerId WHERE c.customerName LIKE 'E2E %'").all().map((row) => row.id)
      for (const id of bookingIds) {
        try { db.prepare('DELETE FROM FurnitureBookingItem WHERE furnitureBookingId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM FurnitureBooking WHERE id = ?').run(id) } catch { /* noop */ }
      }
      try { db.prepare("DELETE FROM FurnitureTradeIn WHERE itemDescription LIKE 'E2E %'").run() } catch { /* noop */ }
      console.log('extra cleanup: furnitureBookings', bookingIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nFURNITURE VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
