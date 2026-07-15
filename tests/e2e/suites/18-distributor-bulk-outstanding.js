/**
 * Suite 18 — Distributor vertical (bulk_orders, outstanding_analytics).
 * Real UI-driven bulk order with volume-tier discount via BulkOrderScreen,
 * and a credit bulk order surfacing correctly on OutstandingAnalyticsScreen.
 * See project memory project_vertical_uat_research.md /
 * project_final_testing_pass_2026_07_15.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Dist'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-distributor', async () => {
      const sw = await h.switchBusinessType(page, 'Distributor')
      r.log('business-type-switched-to-distributor', sw.to === 'DISTRIBUTOR', JSON.stringify(sw))
    })

    let productId

    await r.step('create-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Dist Cement Bag',
        unit: 'PCS',
        sellingPrice: 50,
        costPrice: 35,
        taxRate: 18,
        productType: 'STANDARD',
        openingQuantity: 500,
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    let invoiceNumber

    await r.step('cash-bulk-order-with-volume-discount-via-real-ui', async () => {
      await h.gotoHash(page, '#/distributor/bulk-order')
      await page.waitForTimeout(700)
      r.log('bulk-order-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const prodSearch = page.getByPlaceholder('Search products by name or SKU…')
      await prodSearch.fill('E2E Dist Cement Bag')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button', { hasText: 'E2E Dist Cement Bag' }).first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(500)

      // Qty input in the item row: only one type=number input per row here (min="1").
      const qtyInput = page.locator('input[type="number"][min="1"]').first()
      await qtyInput.fill('10')
      await page.waitForTimeout(400)
      r.log('bulk-discount-badge-shows-5pct', await page.locator('text=5% bulk discount').count() > 0)
      await h.shot(page, 'distributor-bulk-order-qty10')

      await page.getByPlaceholder('e.g. PO-2026-001').fill('PO-TEST-001')
      await page.waitForTimeout(300)

      const submitBtn = page.getByRole('button', { name: 'Create Bulk Order' })
      await submitBtn.click()
      await page.waitForTimeout(1500)
      r.log('bulk-order-submitted-no-crash', !(await h.hasErrorBoundary(page)))

      const successHeading = page.locator('h3', { hasText: 'Bulk Order Created' })
      r.log('success-screen-shown', await successHeading.count() > 0)
      const bodyText = await page.locator('body').innerText()
      const match = bodyText.match(/Invoice\s+(\S+)\s+has been created/)
      invoiceNumber = match?.[1]
      r.log('invoice-number-captured', !!invoiceNumber, invoiceNumber || '')
      await h.shot(page, 'distributor-bulk-order-success')
    })

    await r.step('verify-invoice-total-and-notes-via-api', async () => {
      if (!invoiceNumber) return r.log('verify-invoice-total-and-notes-via-api', false, 'no invoiceNumber captured')
      const listRes = await page.evaluate(async (num) => window.api.billing.listInvoices({ search: num }), invoiceNumber)
      const invoices = listRes?.data?.invoices || []
      const created = invoices.find((inv) => inv.invoiceNumber === invoiceNumber)
      r.log('invoice-findable-via-api', !!created, JSON.stringify({ total: created?.totalAmount }))

      const expectedTotal = 10 * 50 * 0.95 * 1.18
      r.log('invoice-total-reflects-5pct-discount', created && Math.abs(created.totalAmount - expectedTotal) < 1, `expected=${expectedTotal} actual=${created?.totalAmount}`)

      const fullRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), created?.id)
      r.log('invoice-notes-has-bulk-order-ref-prefix', (fullRes?.data?.notes || '').includes('Bulk Order — Ref: PO-TEST-001'), fullRes?.data?.notes || '')
    })

    let creditCustomerId

    await r.step('credit-bulk-order-for-outstanding-analytics', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Dist Wholesale Client', phone: `9${String(Date.now()).slice(-9)}`, creditLimit: 100000,
      }))
      r.log('credit-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      creditCustomerId = custRes?.data?.id

      // Still on the success screen from the first order (same hash, so
      // re-navigating to it is a no-op — the SPA only resets via "New Order").
      const newOrderBtn = page.getByRole('button', { name: 'New Order' })
      if (await newOrderBtn.count()) {
        await newOrderBtn.click()
        await page.waitForTimeout(500)
      } else {
        await h.gotoHash(page, '#/distributor/bulk-order')
        await page.waitForTimeout(700)
      }

      const prodSearch = page.getByPlaceholder('Search products by name or SKU…')
      await prodSearch.fill('E2E Dist Cement Bag')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Dist Cement Bag' }).first().click()
      await page.waitForTimeout(500)

      const custSearch = page.getByPlaceholder('Search wholesale customer…')
      await custSearch.fill('E2E Dist Wholesale Client')
      await page.waitForTimeout(700)
      const custOption = page.locator('button', { hasText: 'E2E Dist Wholesale Client' }).first()
      r.log('wholesale-customer-search-found-result', await custOption.count() > 0)
      await custOption.click()
      await page.waitForTimeout(400)

      const paymentSelect = page.getByLabel('Payment Method')
      await paymentSelect.selectOption('CREDIT')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Create Bulk Order' }).click()
      await page.waitForTimeout(1500)
      r.log('credit-bulk-order-submitted-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('outstanding-analytics-shows-credit-order', async () => {
      await h.gotoHash(page, '#/distributor/outstanding')
      await page.waitForTimeout(1000)
      r.log('outstanding-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.customers.listOutstanding())
      const rows = listRes?.data || []
      const found = rows.find((c) => c.id === creditCustomerId)
      r.log('wholesale-client-appears-in-outstanding-list', !!found && found.outstandingBalance > 0, JSON.stringify({ balance: found?.outstandingBalance }))

      await h.shot(page, 'distributor-outstanding-analytics')
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'DISTRIBUTOR') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDISTRIBUTOR VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
