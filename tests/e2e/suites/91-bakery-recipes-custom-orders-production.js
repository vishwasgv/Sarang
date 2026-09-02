/**
 * Suite 91 — Bakery/Sweet Shop/Catering vertical (2026-09 §12). Zero prior
 * E2E coverage existed for this vertical before this suite. Covers recipe-
 * based ingredient deduction at sale time (no KOT), Custom Order Booking
 * with advance via the real i18n'd UI, catering bulk orders (reusing
 * Stationery's screen verbatim), the Shelf-Life/Wastage report, the Recipe
 * Margin re-gate, and the Pre-Order Production Sheet wow feature.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Bake'

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
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date()))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  const genBtn = page.locator('button:has-text("Generate Report")')
  if (await genBtn.count() > 0) await genBtn.click()
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

    await r.step('switch-to-bakery', async () => {
      // Warm up the industry-settings route first — a cold Vite-dev module
      // load for a route not yet visited this session can take longer than
      // the harness's own fixed 600ms wait inside switchBusinessType.
      await h.gotoHash(page, '#/settings/industry')
      await page.waitForTimeout(1500)
      const sw = await h.switchBusinessType(page, 'Bakery / Sweet Shop')
      r.log('business-type-switched', sw.to === 'BAKERY', JSON.stringify(sw))
    })

    let cakeId, flourId, customerId

    await r.step('create-products-recipe-and-customer', async () => {
      const flourRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Bake Flour', unit: 'KG', sellingPrice: 0, costPrice: 40, taxRate: 0,
        productType: 'STANDARD', openingQuantity: 100,
      }))
      flourId = flourRes?.data?.id
      r.log('flour-ingredient-created', !!flourId, JSON.stringify(flourRes?.error || ''))

      const cakeRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Bake Chocolate Cake', unit: 'PCS', sellingPrice: 500, costPrice: 200, taxRate: 5,
        productType: 'STANDARD', openingQuantity: 20,
      }))
      cakeId = cakeRes?.data?.id
      r.log('cake-product-created', !!cakeId, JSON.stringify(cakeRes?.error || ''))

      if (cakeId && flourId) {
        const recipeRes = await page.evaluate(({ productId, ingredientProductId }) => window.api.restaurant.upsertRecipe({
          productId, recipeName: 'E2E Bake Chocolate Cake Recipe', items: [{ ingredientProductId, quantity: 0.5 }],
        }), { productId: cakeId, ingredientProductId: flourId })
        r.log('recipe-created', !!recipeRes?.success, JSON.stringify(recipeRes?.error || ''))
      }

      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Bake Regular Customer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    await r.step('sale-deducts-ingredient-with-no-kot', async () => {
      if (!cakeId || !customerId || !flourId) return
      const stockBefore = await page.evaluate((id) => window.api.inventory.get(id), flourId)
      const invRes = await page.evaluate(({ prodId, custId }) => window.api.billing.createInvoice({
        customerId: custId, items: [{ productId: prodId, quantity: 2, unitPrice: 500 }], paymentMethod: 'CASH',
      }), { prodId: cakeId, custId: customerId })
      r.log('cake-sale-recorded', !!invRes?.success, JSON.stringify(invRes?.error || ''))
      await page.waitForTimeout(300)
      const stockAfter = await page.evaluate((id) => window.api.inventory.get(id), flourId)
      const before = stockBefore?.data?.quantity ?? stockBefore?.data?.inventory?.quantity
      const after = stockAfter?.data?.quantity ?? stockAfter?.data?.inventory?.quantity
      // 2 cakes x 0.5kg flour each = 1kg deducted, with no KOT involved at all.
      r.log('flour-stock-deducted-by-recipe', typeof before === 'number' && typeof after === 'number' && Math.abs((before - after) - 1) < 0.01, JSON.stringify({ before, after }))
    })

    let customOrderId

    await r.step('create-custom-order-via-real-i18nd-ui', async () => {
      await h.gotoHash(page, '#/bakery/custom-orders')
      await page.waitForTimeout(700)
      r.log('custom-orders-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('screen-title-visible', (await page.locator('body').innerText().catch(() => '')).includes('Custom Orders'))

      await page.locator('button:has-text("New Order")').click()
      await page.waitForTimeout(400)
      await page.getByPlaceholder('Search by name or phone...').fill('E2E Bake Regular Customer')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Bake Regular Customer' }).first().click()
      await page.waitForTimeout(300)

      await page.getByPlaceholder('Search product…').fill('E2E Bake Chocolate Cake')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'E2E Bake Chocolate Cake' }).first().click()
      await page.waitForTimeout(300)
      await page.locator('button:has-text("Add")').click()
      await page.waitForTimeout(300)

      // The item-draft row's Qty and Price number inputs come first in DOM
      // order; Advance Amount is the third number input on the form.
      const advanceInput = page.locator('input[type="number"]').nth(2)
      await advanceInput.fill('200')
      await page.locator('button:has-text("Book")').click()
      await page.waitForTimeout(1200)
      r.log('custom-order-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.customOrderBooking.list({}))
      const found = (listRes?.data || []).find((o) => o.customer?.customerName === 'E2E Bake Regular Customer')
      customOrderId = found?.id
      r.log('custom-order-findable-via-api', !!customOrderId, JSON.stringify(found?.advanceAmount))
    })

    await r.step('generate-invoice-from-custom-order', async () => {
      if (!customOrderId) return
      const res = await page.evaluate((id) => window.api.customOrderBooking.generateInvoice({ id }), customOrderId)
      r.log('custom-order-invoiced', !!res?.success, JSON.stringify(res?.error || ''))
      if (res?.data?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), res.data.invoiceId)
        r.log('advance-applied-as-payment', (invRes?.data?.paidAmount ?? 0) >= 200, JSON.stringify(invRes?.data?.paidAmount))
      }
    })

    await r.step('catering-bulk-order-reuses-stationery-screen', async () => {
      await h.gotoHash(page, '#/stationery/bulk-orders')
      await page.waitForTimeout(700)
      r.log('bulk-orders-screen-reachable-for-bakery', !(await h.hasErrorBoundary(page)))
    })

    await r.step('expiry-wastage-write-off-via-api', async () => {
      if (!flourId) return
      const res = await page.evaluate((prodId) => window.api.inventory.adjustStock({
        productId: prodId, quantity: 95, reason: 'E2E Bake expired flour write-off', reasonCategory: 'EXPIRY',
      }), flourId)
      r.log('expiry-adjustment-recorded', !!res?.success, JSON.stringify(res?.error || ''))
    })

    await r.step('shelf-life-wastage-report', () => checkReportTile(page, r, 'perishableWastage', 'Perishable Wastage', { needsDateRange: true }))
    await r.step('recipe-margin-report-regate', () => checkReportTile(page, r, 'foodCost', 'Food Cost', { needsDateRange: true }))
    await r.step('pre-order-production-sheet-report', () => checkReportTile(page, r, 'preOrderProductionSheet', 'Pre-Order Production Sheet', { needsDateRange: true }))

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
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE 'E2E Bake%'").all().map((row) => row.id)
      for (const id of prodIds) {
        try { db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(id) } catch { /* noop */ }
      }
      const recipeIds = db.prepare("SELECT id FROM Recipe WHERE recipeName LIKE 'E2E Bake%'").all().map((row) => row.id)
      for (const id of recipeIds) {
        try { db.prepare('DELETE FROM RecipeItem WHERE recipeId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Recipe WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const bookingIds = db.prepare("SELECT co.id FROM CustomOrderBooking co JOIN Customer c ON c.id = co.customerId WHERE c.customerName LIKE 'E2E Bake%'").all().map((row) => row.id)
      for (const id of bookingIds) {
        try { db.prepare('DELETE FROM CustomOrderBookingItem WHERE customOrderBookingId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM CustomOrderBooking WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: products/recipes/customOrderBookings', prodIds.length, recipeIds.length, bookingIds.length)
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBAKERY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
