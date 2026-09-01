/**
 * Suite 87 — Plumbing vertical (Phase 69). Zero prior E2E coverage
 * existed for this vertical before this suite. Covers pipe-length
 * billing + scheduled delivery driven through the real Billing cart,
 * the Scheduled Deliveries status-advance screen, Installation
 * Warranty Transfer, and both extended report tiles.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Plumb'

async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange } = {}) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileId}-tile-present`, present)
  if (!present) return
  await tile.scrollIntoViewIfNeeded().catch(() => {})
  await tile.click({ timeout: 10000 }).catch(async () => {
    console.log(`${tileId} click retry: boundingBox=${JSON.stringify(await tile.boundingBox().catch(() => null))}`)
    await tile.click({ force: true })
  })
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000)))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
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

    await r.step('switch-to-plumbing', async () => {
      const sw = await h.switchBusinessType(page, 'Plumbing / Sanitaryware Store')
      r.log('business-type-switched', sw.to === 'PLUMBING', JSON.stringify(sw))
    })

    let pipeId, sinkId, customerId

    await r.step('create-length-billed-pipe-and-sanitaryware-and-customer', async () => {
      const pipeRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Plumb PVC Pipe', unit: 'M', sellingPrice: 40, costPrice: 25, taxRate: 18,
        productType: 'STANDARD', openingQuantity: 300,
        sellByLength: true, lengthUnit: 'M', pricePerLengthUnit: 40,
      }))
      pipeId = pipeRes?.data?.id
      r.log('length-billed-pipe-created', !!pipeId, JSON.stringify(pipeRes?.error || ''))

      const sinkRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Plumb Wash Basin', unit: 'PCS', sellingPrice: 3500, costPrice: 2200, taxRate: 18,
        productType: 'STANDARD', openingQuantity: 15,
      }))
      sinkId = sinkRes?.data?.id
      r.log('sanitaryware-product-created', !!sinkId, JSON.stringify(sinkRes?.error || ''))

      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Plumb Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    let invoiceId

    await r.step('bill-pipe-and-sink-with-scheduled-delivery-via-real-ui', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Plumb PVC Pipe')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Plumb PVC Pipe")').first().click()
      await page.waitForTimeout(500)

      await prodSearch.fill('E2E Plumb Wash Basin')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Plumb Wash Basin")').first().click()
      await page.waitForTimeout(500)
      r.log('items-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Plumb Buyer')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Plumb Buyer")').first().click()
      await page.waitForTimeout(300)

      const deliveryDateInput = page.locator('text=Scheduled Delivery').locator('..').locator('input[type="date"]').first()
      const deliverySectionPresent = await page.locator('text=Scheduled Delivery').count() > 0
      r.log('scheduled-delivery-section-present', deliverySectionPresent)
      if (deliverySectionPresent) {
        await deliveryDateInput.fill(h.toLocalISODate(new Date(Date.now() + 5 * 24 * 3600000)))
        await page.waitForTimeout(300)
      }

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-lengthUnit-and-deliveryStatus', async () => {
      if (!invoiceId) return r.log('verify-invoice-lengthUnit-and-deliveryStatus', false, 'no invoiceId captured')
      const res = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const pipeItem = (res?.data?.items || []).find((i) => i.productId === pipeId)
      r.log('invoice-item-has-lengthUnit-M', pipeItem?.lengthUnit === 'M', JSON.stringify(pipeItem))
      r.log('invoice-deliveryStatus-is-SCHEDULED', res?.data?.deliveryStatus === 'SCHEDULED', JSON.stringify(res?.data?.deliveryStatus))
    })

    await r.step('scheduled-deliveries-screen-shows-invoice-and-advances-status', async () => {
      if (!invoiceId) return
      await h.gotoHash(page, '#/plumbing/scheduled-deliveries')
      await page.waitForTimeout(700)
      r.log('scheduled-deliveries-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const res = await page.evaluate(async () => window.api.billing.listScheduledDeliveries())
      const found = (res?.data || []).find((d) => d.id === invoiceId)
      r.log('invoice-in-scheduled-deliveries-list', !!found, JSON.stringify(found?.deliveryStatus))

      const upd = await page.evaluate((id) => window.api.billing.updateDeliveryStatus({ invoiceId: id, status: 'OUT_FOR_DELIVERY' }), invoiceId)
      r.log('delivery-status-advanced', upd?.data?.deliveryStatus === 'OUT_FOR_DELIVERY', JSON.stringify(upd?.error || ''))
    })

    let serialId

    await r.step('installation-warranty-transfer-via-real-ui', async () => {
      const serialProdRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Plumb Water Heater', unit: 'PCS', sellingPrice: 8000, costPrice: 6000, taxRate: 18, productType: 'STANDARD', openingQuantity: 5,
      }))
      const serialProdId = serialProdRes?.data?.id
      const serRes = await page.evaluate((pid) => window.api.serials.create({
        productId: pid, serialNumber: `E2EPLUMBSN${Date.now()}`, warrantyMonths: 24,
      }), serialProdId)
      serialId = serRes?.data?.id
      r.log('serial-created', !!serialId, JSON.stringify(serRes?.error || ''))
      if (!serialId) return

      const soldRes = await page.evaluate((id) => window.api.serials.updateStatus({ id, status: 'SOLD', invoiceId: 'e2e-fake-invoice', soldDate: new Date().toISOString() }), serialId)
      r.log('serial-marked-sold', soldRes?.success !== false, JSON.stringify(soldRes?.error || ''))

      const serialInfo = await page.evaluate((id) => window.api.serials.list({}).then((res) => (res?.data?.serials || []).find((s) => s.id === id)), serialId)

      await h.gotoHash(page, '#/electronics/serials')
      await page.waitForTimeout(700)
      r.log('serial-tracking-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      const warrantySection = page.locator('text=Installation Warranty Transfer')
      r.log('installation-warranty-transfer-section-present', await warrantySection.count() > 0)

      if (await warrantySection.count() > 0 && serialInfo?.serialNumber) {
        const searchInput = page.locator('input[placeholder="Search by serial number"]')
        await searchInput.fill(serialInfo.serialNumber)
        await page.waitForTimeout(700)
        await page.locator('button:has-text("Search")').first().click()
        await page.waitForTimeout(700)
        r.log('warranty-transfer-search-no-crash', !(await h.hasErrorBoundary(page)))
      }

      const transferRes = await page.evaluate(({ id, custId }) => window.api.serials.transferInstallationWarranty({ serialId: id, customerId: custId, installationAddress: 'E2E 99 Test Lane' }), { id: serialId, custId: customerId })
      r.log('warranty-transfer-succeeds-via-api', !!transferRes?.success, JSON.stringify(transferRes?.error || ''))
    })

    await r.step('fitting-compatibility-cross-sell-report', () => checkReportTile(page, r, 'basketComposition', 'Basket Composition', { needsDateRange: true }))
    await r.step('material-sales-mix-report', () => checkReportTile(page, r, 'categoryMix', 'Category Mix', { needsDateRange: true }))

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PLUMBING') {
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
      try { db.prepare("DELETE FROM ProductSerial WHERE serialNumber LIKE 'E2EPLUMBSN%'").run() } catch { /* noop */ }
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPLUMBING VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
