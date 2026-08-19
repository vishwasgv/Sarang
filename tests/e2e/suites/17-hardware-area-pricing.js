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

      await page.getByPlaceholder('L').first().fill('10')
      await page.getByPlaceholder('W').first().fill('5')
      // Phase 67 §9.1 item 5: live margin preview — costPrice=60,
      // sellingPrice=100 -> (100-60)/100*100 = 40%. The cost-fetch itself is
      // async (fires on the calculator's own open click, above), so give it
      // a moment before checking the rendered text.
      await page.waitForTimeout(800)
      const areaCalcBodyText = await page.locator('body').innerText().catch(() => '')
      const marginTextFound = areaCalcBodyText.includes('Margin: 40%')
      r.log('area-calculator-shows-live-margin-preview', marginTextFound, marginTextFound ? 'found "Margin: 40%"' : (areaCalcBodyText.includes('Margin:') ? 'margin text present but wrong value' : 'no margin text found'))
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

    // ─── Phase 67 §9.1 item 3: Smart Carton-Break Reorder Trigger ──────────
    let cartonSupplierId, cartonProductId, cartonPOId

    await r.step('seed-carton-supplier-and-low-stock-pack-product', async () => {
      const supRes = await page.evaluate(() => window.api.suppliers.create({
        supplierName: 'E2E Hdwe Carton Supplier', phone: `8${String(Date.now()).slice(-9)}`,
      }))
      cartonSupplierId = supRes?.data?.id
      r.log('carton-supplier-created', !!supRes?.success, JSON.stringify(supRes?.error || ''))

      // 1 carton = 24 pieces. Opening stock of 30 = 1 full carton + 6 loose
      // pieces — genuinely below the 50-piece reorder level, so this is a
      // real due-for-reorder product, not a contrived edge case.
      const prodRes = await page.evaluate((supplierId) => window.api.products.create({
        productName: 'E2E Hdwe Screws Box', unit: 'PCS', productType: 'STANDARD',
        sellingPrice: 5, costPrice: 3, taxRate: 18, openingQuantity: 30,
        sellByPack: true, packUnit: 'BOX', unitsPerPack: 24,
        reorderLevel: 50, reorderQuantity: 40, defaultSupplierId: supplierId,
      }), cartonSupplierId)
      cartonProductId = prodRes?.data?.id
      r.log('carton-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
    })

    await r.step('reorder-po-rounds-up-to-whole-carton-via-real-api', async () => {
      const res = await page.evaluate(() => window.api.purchaseOrders.generateReorderDraftPOs())
      r.log('generate-reorder-pos-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      const created = res?.data?.created?.find((c) => c.supplierId === cartonSupplierId)
      r.log('po-created-for-carton-supplier', !!created, JSON.stringify(res?.data))
      cartonPOId = created?.poId

      if (cartonPOId) {
        const poRes = await page.evaluate((id) => window.api.purchaseOrders.get(id), cartonPOId)
        const item = poRes?.data?.items?.find((it) => it.productId === cartonProductId)
        // reorderQuantity 40 -> ceil(40/24)*24 = 48, never the raw 40 a
        // supplier selling whole cartons could not actually fulfil.
        r.log('drafted-quantity-rounded-up-to-carton-multiple', item?.quantity === 48, `quantity=${item?.quantity}`)
      }
    })

    await r.step('inventory-report-shows-carton-breakdown-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Inventory Report' }).first()
      r.log('inventory-report-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1000)
      r.log('inventory-report-renders-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      // 30 pieces = 1 full carton (24) + 6 loose — the exact floor-division
      // breakdown, shown alongside the flat 30 rather than replacing it.
      r.log('inventory-report-shows-carton-breakdown', bodyText.includes('1 cartons + 6 pcs'), bodyText.includes('E2E Hdwe Screws Box') ? 'product row present' : 'product row NOT present')
      await h.shot(page, 'hardware-inventory-carton-breakdown')
    })

    // ─── Phase 67 §9.1 item 4: Fast-Mover vs. Slow-Mover Matrix ────────────
    await r.step('seed-fast-and-slow-movers-and-verify-matrix-via-real-api', async () => {
      const custRes = await page.evaluate(() => window.api.customers.create({
        customerName: 'E2E Hdwe Mover Buyer', phone: `7${String(Date.now()).slice(-9)}`,
      }))
      const buyerId = custRes?.data?.id

      // Fast, high-margin: sells a lot, costs little relative to price.
      const fastRes = await page.evaluate(() => window.api.products.create({
        productName: 'E2E Hdwe Fast Mover', unit: 'PCS', productType: 'STANDARD',
        costPrice: 20, sellingPrice: 100, taxRate: 18, openingQuantity: 100,
      }))
      const fastId = fastRes?.data?.id

      // Slow, low-margin: sells little, costs nearly as much as it sells for.
      const slowRes = await page.evaluate(() => window.api.products.create({
        productName: 'E2E Hdwe Slow Mover', unit: 'PCS', productType: 'STANDARD',
        costPrice: 90, sellingPrice: 100, taxRate: 18, openingQuantity: 100,
      }))
      const slowId = slowRes?.data?.id

      const fastInv = await page.evaluate(({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 20, unitPrice: 100, taxRate: 18 }],
      }), { customerId: buyerId, productId: fastId })
      const slowInv = await page.evaluate(({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 2, unitPrice: 100, taxRate: 18 }],
      }), { customerId: buyerId, productId: slowId })
      r.log('fast-and-slow-mover-invoices-created', !!fastInv?.success && !!slowInv?.success, JSON.stringify({ fastErr: fastInv?.error, slowErr: slowInv?.error }))

      // Local calendar date, not toISOString()'s UTC one — this project has
      // hit the exact UTC-vs-local-midnight mismatch before (see
      // ai-aggregations.service.ts's own dated bug-fix comment), and this
      // machine's local timezone can differ from UTC by enough to land on a
      // different calendar day depending on time of day.
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const matrixRes = await page.evaluate(({ dateFrom, dateTo }) => window.api.reports.fastSlowMoverMatrix({ dateFrom, dateTo }), { dateFrom: today, dateTo: today })
      r.log('fast-slow-mover-matrix-api-succeeded', !!matrixRes?.success, JSON.stringify(matrixRes?.error || ''))

      const rows = matrixRes?.data?.rows ?? []
      const fastRow = rows.find((row) => row.productId === fastId)
      const slowRow = rows.find((row) => row.productId === slowId)
      r.log('both-test-products-present-in-real-report', !!fastRow && !!slowRow, `fastFound=${!!fastRow} slowFound=${!!slowRow} totalRows=${rows.length}`)
      // Independent of quadrant classification (which depends on whatever
      // else genuinely sold today in the shared dev DB) — these two
      // per-product figures are stable regardless of surrounding data.
      r.log('fast-mover-has-higher-velocity-than-slow-mover', !!fastRow && !!slowRow && fastRow.velocity > slowRow.velocity, `fast=${fastRow?.velocity} slow=${slowRow?.velocity}`)
      r.log('fast-mover-has-higher-margin-than-slow-mover', !!fastRow && !!slowRow && fastRow.marginPercent > slowRow.marginPercent, `fast=${fastRow?.marginPercent}% slow=${slowRow?.marginPercent}%`)
    })

    await r.step('fast-slow-mover-matrix-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Fast-Mover vs. Slow-Mover Matrix' }).first()
      r.log('fast-slow-mover-matrix-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1000)
      r.log('fast-slow-mover-matrix-renders-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('fast-slow-mover-matrix-shows-test-products', bodyText.includes('E2E Hdwe Fast Mover') && bodyText.includes('E2E Hdwe Slow Mover'))
      await h.shot(page, 'hardware-fast-slow-mover-matrix')
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
