/**
 * Suite 161 — the veg/non-veg diet-mark dot, extended to Kitchen Display /
 * KOTScreen / Billing cart+search (previously only the product-config form
 * and the customer-facing QR menu had it — see
 * project_veg_nonveg_food_type_2026_09.md's own "explicitly NOT built" note).
 * New this suite: DietMark shared component, restaurant.service.ts's
 * listKOTs() now returns foodType per item, wired into KOTScreen.tsx,
 * KitchenDisplayBoardScreen.tsx, resources/kitchen-display/index.html (LAN
 * board), and BillingScreen.tsx's search/browse/frequently-sold/cart.
 */
const h = require('../harness')
const { createTestProduct } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E161'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let originalModules = []
    await r.step('switch-to-restaurant-and-enable-kitchen-display-web', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))

      const tmpl = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tmpl?.data?.enabledModules || []
      if (!originalModules.includes('kitchen_display_web')) {
        const updRes = await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), [...originalModules, 'kitchen_display_web'])
        r.log('kitchen-display-web-module-enabled', !!updRes?.success, JSON.stringify(updRes?.error || ''))
      } else {
        r.log('kitchen-display-web-module-enabled', true, 'already enabled')
      }
    })

    let vegId, nonVegId
    await r.step('seed-veg-and-nonveg-products', async () => {
      const veg = await createTestProduct(page, { productName: `${TEST_PREFIX} Paneer Tikka ${suffix}`, sellingPrice: 200, costPrice: 100, foodType: 'VEG' })
      vegId = veg?.data?.id
      const nonVeg = await createTestProduct(page, { productName: `${TEST_PREFIX} Chicken Tikka ${suffix}`, sellingPrice: 250, costPrice: 130, foodType: 'NON_VEG' })
      nonVegId = nonVeg?.data?.id
      r.log('products-seeded', !!vegId && !!nonVegId, JSON.stringify({ veg: veg?.error, nonVeg: nonVeg?.error }))
    })

    await r.step('billing-search-shows-diet-marks', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      r.log('billing-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('input[placeholder="Search products…"]').fill(`${TEST_PREFIX} Paneer Tikka`)
      await page.waitForTimeout(700)
      const vegRow = page.locator('button', { hasText: `${TEST_PREFIX} Paneer Tikka` }).first()
      r.log('veg-row-has-diet-mark', await vegRow.locator('span[title="Veg"]').count() > 0)
      await vegRow.click()
      await page.waitForTimeout(400)

      await page.locator('input[placeholder="Search products…"]').fill(`${TEST_PREFIX} Chicken Tikka`)
      await page.waitForTimeout(700)
      const nonVegRow = page.locator('button', { hasText: `${TEST_PREFIX} Chicken Tikka` }).first()
      r.log('nonveg-row-has-diet-mark', await nonVegRow.locator('span[title="Non-Veg"]').count() > 0)
      await nonVegRow.click()
      await page.waitForTimeout(400)
      r.log('add-to-cart-no-crash', !(await h.hasErrorBoundary(page)))

      const vegCartLine = page.locator('div', { hasText: `${TEST_PREFIX} Paneer Tikka` }).filter({ has: page.locator('span[title="Veg"]') })
      r.log('cart-shows-veg-diet-mark', await vegCartLine.count() > 0)
      const nonVegCartLine = page.locator('div', { hasText: `${TEST_PREFIX} Chicken Tikka` }).filter({ has: page.locator('span[title="Non-Veg"]') })
      r.log('cart-shows-nonveg-diet-mark', await nonVegCartLine.count() > 0)
    })

    let tableId, kotId
    await r.step('kot-screen-shows-diet-marks', async () => {
      const tableRes = await page.evaluate(async (prefix) => window.api.restaurant.createTable({
        tableNumber: `${prefix}-T1`, tableName: `${prefix} Table 1`,
      }), TEST_PREFIX)
      tableId = tableRes?.data?.id

      const invRes = await page.evaluate(({ vegId, nonVegId }) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [
          { productId: vegId, quantity: 1, unitPrice: 200, taxRate: 5 },
          { productId: nonVegId, quantity: 1, unitPrice: 250, taxRate: 5 },
        ],
      }), { vegId, nonVegId })
      const invoiceId = invRes?.data?.id
      r.log('invoice-created', !!invoiceId, JSON.stringify(invRes?.error || ''))

      const kotRes = await page.evaluate(({ invId, tblId }) => window.api.restaurant.createKOT({ invoiceId: invId, tableId: tblId }), { invId: invoiceId, tblId: tableId })
      kotId = kotRes?.data?.id
      r.log('kot-created', !!kotId, JSON.stringify(kotRes?.error || ''))

      const listRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
      const kot = (listRes?.data || []).find((k) => k.id === kotId)
      const vegItem = kot?.items?.find((i) => i.productId === vegId)
      const nonVegItem = kot?.items?.find((i) => i.productId === nonVegId)
      r.log('listKOTs-returns-foodType', vegItem?.foodType === 'VEG' && nonVegItem?.foodType === 'NON_VEG', JSON.stringify({ vegItem, nonVegItem }))

      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(900)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const ticketCard = page.locator('div', { hasText: `${TEST_PREFIX} Paneer Tikka` }).filter({ has: page.locator('span[title="Veg"]') })
      r.log('kot-ticket-shows-veg-diet-mark', await ticketCard.count() > 0)
      const ticketCard2 = page.locator('div', { hasText: `${TEST_PREFIX} Chicken Tikka` }).filter({ has: page.locator('span[title="Non-Veg"]') })
      r.log('kot-ticket-shows-nonveg-diet-mark', await ticketCard2.count() > 0)
    })

    await r.step('kitchen-display-lan-board-shows-diet-marks', async () => {
      const statusRes = await page.evaluate(async () => window.api.restaurant.getKitchenDisplayStatus())
      const running = statusRes?.data?.running === true
      r.log('kitchen-display-server-status-checked', true, JSON.stringify({ running }))
      if (!running) return

      const port = statusRes.data.port
      const token = statusRes.data.token
      const boardRes = await fetch(`http://127.0.0.1:${port}/api/kitchen/${token}/board`).then((x) => x.json())
      const kot = (boardRes?.data || []).find((k) => k.id === kotId)
      const vegItem = kot?.items?.find((i) => i.productId === vegId)
      r.log('lan-board-json-includes-foodType', vegItem?.foodType === 'VEG', JSON.stringify(vegItem))

      const boardHtml = await fetch(`http://127.0.0.1:${port}/kitchen/${token}`).then((x) => x.text())
      r.log('lan-board-page-loads', boardHtml.includes('Kitchen Display'))
      r.log('lan-board-page-has-dietmark-css', boardHtml.includes('diet-mark') && boardHtml.includes('dietMarkHtml'))
    })

    await r.step('restore-modules-and-business-type', async () => {
      if (!originalModules.includes('kitchen_display_web')) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), originalModules)
      }
      if (originalBusinessType && originalBusinessType !== 'RESTAURANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let kots = 0, invs = 0, prods = 0, tables = 0
      try { kots = db.prepare(`DELETE FROM KOTItem WHERE kotId IN (SELECT id FROM KOT WHERE tableId IN (SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'))`).run().changes } catch { /* noop */ }
      try { db.prepare(`DELETE FROM KOT WHERE tableId IN (SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%')`).run() } catch { /* noop */ }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of prodIds) {
        const invIds = db.prepare('SELECT DISTINCT invoiceId FROM InvoiceItem WHERE productId = ?').all(id).map((row) => row.invoiceId)
        try { db.prepare('DELETE FROM InvoiceItem WHERE productId = ?').run(id) } catch { /* noop */ }
        for (const invId of invIds) {
          try { db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(invId) } catch { /* noop */ }
          try { invs += db.prepare('DELETE FROM Invoice WHERE id = ?').run(invId).changes } catch { /* noop */ }
        }
        try { db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Inventory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(id).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(id) }
      }
      try { tables = db.prepare(`DELETE FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      console.log('extra cleanup:', JSON.stringify({ kots, invs, prods, tables }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRESTAURANT DIET MARK: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
