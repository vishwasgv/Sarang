/**
 * Suite 17 — Hardware vertical (area_pricing). Real UI-driven L×W area
 * calculator on the Billing cart line (no dedicated IPC — this is purely a
 * billing-screen convenience that sets cart quantity = length × width).
 * See project memory project_vertical_uat_research.md /
 * project_final_testing_pass_2026_07_15.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Hdwe'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-hardware', async () => {
      const sw = await h.switchBusinessType(page, 'Hardware')
      r.log('business-type-switched-to-hardware', sw.to === 'HARDWARE', JSON.stringify(sw))
    })

    let productId

    await r.step('create-area-priced-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Hdwe Glass Sheet',
        unit: 'SQFT',
        sellingPrice: 100,
        costPrice: 60,
        taxRate: 18,
        productType: 'STANDARD',
        openingQuantity: 1000,
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    let customerId

    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Hdwe Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id
    })

    let invoiceId

    await r.step('use-area-calculator-via-real-ui', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Hdwe Glass Sheet')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button:has-text("E2E Hdwe Glass Sheet")').first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(500)

      const areaBtn = page.locator('button[title="Area calculator (L × W)"]')
      r.log('area-calculator-button-present', await areaBtn.count() > 0)
      await areaBtn.click()
      await page.waitForTimeout(400)

      await page.getByPlaceholder('L').fill('10')
      await page.getByPlaceholder('W').fill('5')
      await page.waitForTimeout(300)
      await h.shot(page, 'hardware-area-calculator-open')

      const useBtn = page.getByRole('button', { name: 'Use 50 sq' })
      r.log('use-area-button-shows-computed-50', await useBtn.count() > 0)
      await useBtn.click()
      await page.waitForTimeout(500)
      r.log('area-applied-no-crash', !(await h.hasErrorBoundary(page)))

      const qtyInput = page.locator('input[type="number"][min="0.001"]').first()
      const qtyVal = await qtyInput.inputValue()
      r.log('cart-qty-set-to-computed-area', Number(qtyVal) === 50, `qty=${qtyVal}`)

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Hdwe Buyer')
      await page.waitForTimeout(700)
      const custOption = page.locator('button:has-text("E2E Hdwe Buyer")').first()
      await custOption.click()
      await page.waitForTimeout(300)

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-total-reflects-area-pricing', async () => {
      if (!invoiceId) return r.log('verify-invoice-total-reflects-area-pricing', false, 'no invoiceId captured')
      const res = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const expectedTotal = 50 * 100 * 1.18
      r.log('invoice-fetch-success', !!res?.success)
      r.log('invoice-total-matches-area-times-rate', Math.abs((res?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${res?.data?.totalAmount}`)
      r.log('invoice-customer-linked', res?.data?.customerId === customerId)
    })

    await r.step('inventory-deducted-by-area-quantity', async () => {
      const invRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.inventory?.quantity
      r.log('inventory-reduced-by-50', qty === 950, `quantity=${qty}`)
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'HARDWARE') {
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
    console.log(`\nHARDWARE VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
