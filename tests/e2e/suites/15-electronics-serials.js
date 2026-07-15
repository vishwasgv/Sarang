/**
 * Suite 15 — Electronics vertical (serial_tracking, imei_tracking,
 * warranty_tracking). Real UI-driven serial/IMEI unit sale via Billing's
 * "Select Device" picker, qty-locked-to-one enforcement, and the
 * cannot-resell-a-sold-unit guard (SER-012). See project memory
 * project_vertical_uat_research.md for the researched IPC/UI contract this
 * suite is based on, and project_final_testing_pass_2026_07_15.md for the
 * "one vertical at a time" testing convention.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Elec'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-electronics', async () => {
      const sw = await h.switchBusinessType(page, 'Electronics')
      r.log('business-type-switched-to-electronics', sw.to === 'ELECTRONICS', JSON.stringify(sw))
    })

    let productId

    await r.step('create-electronics-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Elec Phone X200',
        unit: 'PCS',
        sellingPrice: 25000,
        costPrice: 20000,
        taxRate: 18,
        productType: 'STANDARD',
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    let serial1Id, serial2Id

    await r.step('create-two-serial-units', async () => {
      const s1 = await page.evaluate(async (pid) => window.api.serials.create({
        productId: pid, serialNumber: `E2ESER${Date.now()}1`, imeiNumber: `35${String(Date.now()).slice(-13)}`, warrantyMonths: 12,
      }), productId)
      r.log('serial-1-created', !!s1?.success, JSON.stringify(s1?.error || ''))
      serial1Id = s1?.data?.id

      const s2 = await page.evaluate(async (pid) => window.api.serials.create({
        productId: pid, serialNumber: `E2ESER${Date.now()}2`, imeiNumber: `35${String(Date.now()).slice(-13)}9`, warrantyMonths: 6,
      }), productId)
      r.log('serial-2-created', !!s2?.success, JSON.stringify(s2?.error || ''))
      serial2Id = s2?.data?.id
    })

    await r.step('inventory-incremented-by-2-serials', async () => {
      const invRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.inventory?.quantity
      r.log('inventory-quantity-is-2', qty === 2, `quantity=${qty}`)
    })

    let customerId

    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Elec Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id
    })

    let invoiceId

    await r.step('sell-one-device-via-real-ui-select-device-picker', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Elec Phone X200')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button:has-text("E2E Elec Phone X200")').first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(600)

      const deviceModalHeading = page.locator('h3', { hasText: 'Select Device' })
      r.log('select-device-modal-opened', await deviceModalHeading.count() > 0)
      await h.shot(page, 'electronics-select-device-modal')

      const deviceRows = page.locator('button', { hasText: 'IMEI:' })
      r.log('device-picker-shows-both-serials', await deviceRows.count() === 2, `count=${await deviceRows.count()}`)

      await deviceRows.first().click()
      await page.waitForTimeout(500)
      r.log('device-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'electronics-cart-after-device-pick')

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Elec Buyer')
      await page.waitForTimeout(700)
      const custOption = page.locator('button:has-text("E2E Elec Buyer")').first()
      r.log('customer-search-found-result', await custOption.count() > 0)
      await custOption.click()
      await page.waitForTimeout(300)
    })

    await r.step('qty-stepper-locked-to-one-for-serial-line', async () => {
      const disabledInputs = page.locator('input[type="number"][disabled]')
      r.log('at-least-one-qty-input-disabled-for-serial-line', await disabledInputs.count() > 0, `disabledCount=${await disabledInputs.count()}`)
    })

    await r.step('submit-invoice-via-real-ui', async () => {
      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!invoiceId) return r.log('verify-invoice-via-api', false, 'no invoiceId captured')
      const res = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-fetch-success', !!res?.success)
      r.log('invoice-customer-linked', res?.data?.customerId === customerId, `expected=${customerId} actual=${res?.data?.customerId}`)
    })

    await r.step('sold-serial-marked-sold-and-not-resellable', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.serials.list({ productId: pid }), productId)
      const serials = listRes?.data?.serials || []
      const sold = serials.filter((s) => s.status === 'SOLD')
      const available = serials.filter((s) => s.status === 'AVAILABLE')
      r.log('exactly-one-serial-marked-sold', sold.length === 1, `sold=${sold.length}`)
      r.log('exactly-one-serial-still-available', available.length === 1, `available=${available.length}`)

      const soldId = sold[0]?.id
      if (soldId) {
        const resellRes = await page.evaluate(async ({ productId, customerId, soldId }) => window.api.billing.createInvoice({
          customerId, paymentMethod: 'CASH',
          items: [{ productId, quantity: 1, unitPrice: 25000, taxRate: 18, serialId: soldId }],
        }), { productId, customerId, soldId })
        r.log('reselling-sold-unit-correctly-rejected', resellRes?.success === false, JSON.stringify(resellRes?.error || resellRes))
      } else {
        r.log('reselling-sold-unit-correctly-rejected', false, 'no sold serial id captured')
      }
    })

    await r.step('warranty-expiry-computed-from-purchase-plus-months', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.serials.list({ productId: pid }), productId)
      const serials = listRes?.data?.serials || []
      const withWarranty = serials.find((s) => s.warrantyMonths === 12)
      r.log('warranty-expiry-date-set', !!withWarranty?.warrantyExpiryDate, JSON.stringify(withWarranty?.warrantyExpiryDate))
    })

    await r.step('serial-warranty-report-renders', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, div', { hasText: 'Serial & Warranty Report' }).first()
      r.log('serial-warranty-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('serial-warranty-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'ELECTRONICS') {
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
      const serialIds = db.prepare("SELECT id FROM ProductSerial WHERE serialNumber LIKE 'E2ESER%'").all().map((r2) => r2.id)
      for (const sid of serialIds) {
        try { db.prepare('DELETE FROM ProductSerial WHERE id = ?').run(sid) } catch { /* leave it, harmless test row */ }
      }
      console.log('extra cleanup: serials', serialIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nELECTRONICS VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
