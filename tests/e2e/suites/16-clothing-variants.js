/**
 * Suite 16 — Clothing/Footwear vertical (variant_tracking). Real UI-driven
 * size/colour variant creation via VariantManagementModal, inventory
 * sync-to-sum-of-variants, real Billing "Select Variant" picker, and the
 * insufficient-variant-stock rejection guard (VAR-010). See project memory
 * project_vertical_uat_research.md / project_final_testing_pass_2026_07_15.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cloth'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-clothing', async () => {
      const sw = await h.switchBusinessType(page, 'Clothing')
      r.log('business-type-switched-to-clothing', sw.to === 'CLOTHING', JSON.stringify(sw))
    })

    let productId

    await r.step('create-clothing-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Cloth TShirt',
        unit: 'PCS',
        sellingPrice: 500,
        costPrice: 250,
        taxRate: 5,
        productType: 'STANDARD',
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    await r.step('add-variants-via-real-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const searchBox = page.locator('input[placeholder="Search products…"]')
      await searchBox.fill('E2E Cloth TShirt')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: 'E2E Cloth TShirt' }).first()
      r.log('product-row-found', await row.count() > 0)
      await row.locator('button[title="Manage Variants"]').click()
      await page.waitForTimeout(500)

      const modal = h.topModal(page)
      const modalHeading = modal.locator('h2', { hasText: 'Manage Variants' })
      r.log('variant-modal-opened', await modalHeading.count() > 0)

      // First row (auto-present on open, once loading finishes)
      await modal.locator('p', { hasText: 'Loading' }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
      const rows = modal.locator('table tbody tr')
      await rows.nth(0).getByPlaceholder('M, L, 32…').fill('M')
      await rows.nth(0).getByPlaceholder('Black, Red…').fill('Blue')
      await rows.nth(0).locator('input[type="number"]').nth(1).fill('20') // Stock column

      await modal.getByRole('button', { name: 'Add Row' }).click()
      await page.waitForTimeout(300)
      await rows.nth(1).getByPlaceholder('M, L, 32…').fill('L')
      await rows.nth(1).getByPlaceholder('Black, Red…').fill('Red')
      await rows.nth(1).locator('input[type="number"]').nth(1).fill('15')

      await modal.getByRole('button', { name: 'Save Variants' }).click()
      await page.waitForTimeout(1200)
      r.log('variants-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'clothing-variants-saved')

      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = listRes?.data || []
      r.log('two-variants-created', variants.length === 2, `count=${variants.length}`)
      r.log('variant-m-blue-correct-stock', variants.some((v) => v.size === 'M' && v.color === 'Blue' && v.stockQty === 20))
      r.log('variant-l-red-correct-stock', variants.some((v) => v.size === 'L' && v.color === 'Red' && v.stockQty === 15))
    })

    await r.step('inventory-synced-to-sum-of-variants', async () => {
      const invRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.inventory?.quantity
      r.log('inventory-quantity-is-35', qty === 35, `quantity=${qty}`)
    })

    let customerId

    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Cloth Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id
    })

    let invoiceId

    await r.step('sell-one-variant-via-real-ui-select-variant-picker', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Cloth TShirt')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button:has-text("E2E Cloth TShirt")').first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(600)

      const pickerHeading = page.locator('h3', { hasText: 'Select Variant' })
      r.log('select-variant-modal-opened', await pickerHeading.count() > 0)
      await h.shot(page, 'clothing-select-variant-modal')

      const mBlueRow = page.locator('button', { hasText: 'M / Blue' }).first()
      r.log('variant-picker-shows-m-blue', await mBlueRow.count() > 0)
      await mBlueRow.click()
      await page.waitForTimeout(500)
      r.log('variant-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Cloth Buyer')
      await page.waitForTimeout(700)
      const custOption = page.locator('button:has-text("E2E Cloth Buyer")').first()
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

    await r.step('verify-variant-stock-deducted', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = listRes?.data || []
      const mBlue = variants.find((v) => v.size === 'M' && v.color === 'Blue')
      r.log('m-blue-stock-deducted-by-one', mBlue?.stockQty === 19, `stockQty=${mBlue?.stockQty}`)
    })

    await r.step('oversell-variant-correctly-rejected', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const lRed = (listRes?.data || []).find((v) => v.size === 'L' && v.color === 'Red')
      const saleRes = await page.evaluate(async ({ productId, customerId, variantId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH',
        items: [{ productId, variantId, quantity: 999, unitPrice: 500, taxRate: 5 }],
      }), { productId, customerId, variantId: lRed?.id })
      r.log('oversell-variant-rejected', saleRes?.success === false, JSON.stringify(saleRes?.error || saleRes))
    })

    await r.step('variant-stock-report-renders', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, div', { hasText: 'Variant Stock Report' }).first()
      r.log('variant-stock-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('variant-stock-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CLOTHING') {
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
      const rows = db.prepare("SELECT pv.id FROM ProductVariant pv JOIN Product p ON p.id = pv.productId WHERE p.productName LIKE 'E2E Cloth%'").all().map((r2) => r2.id)
      for (const vid of rows) {
        try { db.prepare('DELETE FROM ProductVariant WHERE id = ?').run(vid) } catch { /* leave it, harmless test row */ }
      }
      console.log('extra cleanup: variants', rows.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCLOTHING VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
