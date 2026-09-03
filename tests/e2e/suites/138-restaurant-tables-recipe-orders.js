/**
 * Suite 138 — Section C medium CRUD gap: industry.handler.ts restaurant
 * sub-namespace, reconfirmed 2026-09-03 against suites 07/40/48 (createTable/
 * updateTableStatus/updateKOTStatus/performDailyClose/acceptOrderRequest/
 * upsertRecipe/etc. already covered there via real UI -- several items the
 * gap-list flagged turned out to be false positives). Covers the genuinely
 * untested restaurant channels: assignWaiter, deleteTable, deleteRecipe,
 * sendTableOrder, checkoutTable, mergeTableIntoInvoice, generateTableQr,
 * getWifiConfig/setWifiConfig, rejectOrderRequest.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Rest138'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()
  // restaurant:setWifiConfig writes to a SINGLE global Setting row (one
  // shop-wide WiFi network, not per-test-run scoped) -- snapshot it now so
  // the real value (if any) can be restored in cleanup instead of just
  // deleted.
  const originalWifiSettings = h.withDb((db) => db.prepare(
    "SELECT id, settingKey, settingValue, settingType FROM Setting WHERE settingKey IN ('restaurant_wifi_ssid','restaurant_wifi_password','restaurant_wifi_open')"
  ).all())

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-restaurant-and-enable-qr-ordering', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant / Café / Food')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))

      const tmpl = await page.evaluate(async () => window.api.industry.getTemplate())
      const current = tmpl?.data?.enabledModules || []
      const withQr = current.includes('qr_table_ordering') ? current : [...current, 'qr_table_ordering']
      const updRes = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), withQr)
      r.log('qr-ordering-module-enabled', !!updRes?.success, JSON.stringify(updRes?.error || ''))
    })

    let waiterId
    let table1Id, table2Id, table3Id
    const table1Name = `${TEST_PREFIX} T1 ${suffix}`
    const table2Name = `${TEST_PREFIX} T2 ${suffix}`
    const table3Name = `${TEST_PREFIX} T3 ${suffix}`
    await r.step('seed-waiter-and-three-tables-via-api', async () => {
      const empRes = await page.evaluate(async ({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `8${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Waiter ${suffix}`, joinDate: h.toLocalISODate(new Date()) })
      waiterId = empRes?.data?.id
      r.log('waiter-created', !!waiterId, JSON.stringify(empRes?.error || ''))

      const t1 = await page.evaluate(({ num, name }) => window.api.restaurant.createTable({ tableNumber: num, tableName: name }), { num: `T138-1-${suffix}`, name: table1Name })
      const t2 = await page.evaluate(({ num, name }) => window.api.restaurant.createTable({ tableNumber: num, tableName: name }), { num: `T138-2-${suffix}`, name: table2Name })
      const t3 = await page.evaluate(({ num, name }) => window.api.restaurant.createTable({ tableNumber: num, tableName: name }), { num: `T138-3-${suffix}`, name: table3Name })
      table1Id = t1?.data?.id; table2Id = t2?.data?.id; table3Id = t3?.data?.id
      r.log('three-tables-created', !!table1Id && !!table2Id && !!table3Id)
    })

    let menuProductId
    await r.step('seed-menu-product', async () => {
      const prodRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 30, sellingPrice: 60, taxRate: 5, openingQuantity: 100,
      }), `${TEST_PREFIX} Menu Item ${suffix}`)
      menuProductId = prodRes?.data?.id
      r.log('menu-product-created', !!menuProductId, JSON.stringify(prodRes?.error || ''))
    })

    await r.step('assign-waiter-via-ui', async () => {
      if (!table1Id) return r.log('assign-waiter-via-ui', false, 'no table1Id')
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      r.log('tables-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const card = page.locator('div.rounded-xl', { hasText: table1Name }).first()
      await card.locator('select').selectOption(waiterId)
      await page.waitForTimeout(800)
      r.log('assign-waiter-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const found = (listRes?.data || []).find((t) => t.id === table1Id)
      r.log('waiter-actually-assigned', found?.waiterId === waiterId, JSON.stringify(found))
    })

    await r.step('save-wifi-config-and-generate-table-qr-via-ui', async () => {
      const wifiSsid = `${TEST_PREFIX}Wifi${suffix}`.slice(0, 32)
      const addWifiBtn = page.getByRole('button', { name: /Add WiFi|Edit/ }).first()
      await addWifiBtn.click()
      await page.waitForTimeout(300)
      await page.getByPlaceholder('Network name (SSID)').fill(wifiSsid)
      await page.getByPlaceholder('Password').fill('E2ETestPass123')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('wifi-save-no-crash', !(await h.hasErrorBoundary(page)))

      const wifiRes = await page.evaluate(() => window.api.restaurant.getWifiConfig())
      r.log('wifi-config-actually-saved', wifiRes?.data?.ssid === wifiSsid && wifiRes?.data?.hasPassword === true, JSON.stringify(wifiRes?.data))

      if (!table1Id) return r.log('generate-table-qr-via-ui', false, 'no table1Id')
      const card = page.locator('div.rounded-xl', { hasText: table1Name }).first()
      await card.locator('button[title="Print table QR code"]').click()
      await page.waitForTimeout(1000)
      const modal = h.topModal(page)
      r.log('table-qr-image-rendered', await modal.locator('img[alt="Table QR code"]').count() > 0)
      r.log('wifi-qr-image-rendered-alongside', await modal.locator('img[alt="WiFi QR code"]').count() > 0)
      await modal.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(300)
    })

    await r.step('send-table-order-via-ui', async () => {
      if (!table2Id) return r.log('send-table-order-via-ui', false, 'no table2Id')
      await h.gotoHash(page, `#/billing/new?tableId=${table2Id}&tableLabel=${encodeURIComponent(table2Name)}`)
      await page.waitForTimeout(700)
      r.log('billing-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill(`${TEST_PREFIX} Menu Item ${suffix}`)
      await page.waitForTimeout(700)
      const productOption = page.locator('button', { hasText: `${TEST_PREFIX} Menu Item ${suffix}` }).first()
      r.log('product-search-found-result', await productOption.count() > 0)
      await productOption.click()
      await page.waitForTimeout(400)

      await page.getByRole('button', { name: /Send to Kitchen/ }).click()
      await page.waitForTimeout(1200)
      r.log('send-to-kitchen-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const found = (listRes?.data || []).find((t) => t.id === table2Id)
      r.log('table2-has-open-kot', (found?.kots?.length ?? 0) >= 1 && !found?.currentInvoiceId, JSON.stringify(found))
    })

    let checkoutInvoiceId
    let customerId
    await r.step('checkout-table-via-ui', async () => {
      if (!table2Id) return r.log('checkout-table-via-ui', false, 'no table2Id')
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Diner ${suffix}`)
      customerId = custRes?.data?.id
      r.log('diner-customer-created', !!customerId)

      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      const card = page.locator('div.rounded-xl', { hasText: table2Name }).first()
      await card.getByRole('button', { name: 'View Order' }).click()
      await page.waitForTimeout(600)
      const modal = h.topModal(page)
      // CREDIT keeps the invoice unpaid/ACTIVE, so it stays mergeable for
      // the merge-table-into-invoice step right after.
      await modal.locator('select').selectOption('CREDIT')
      await page.waitForTimeout(300)
      const custSearch = modal.getByPlaceholder('Search by name or phone...')
      await custSearch.fill(`${TEST_PREFIX} Diner ${suffix}`)
      await page.waitForTimeout(700)
      await modal.locator('div.absolute button', { hasText: `${TEST_PREFIX} Diner ${suffix}` }).first().click()
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: /Checkout/ }).click()
      await page.waitForTimeout(1200)
      r.log('checkout-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const found = (listRes?.data || []).find((t) => t.id === table2Id)
      checkoutInvoiceId = found?.currentInvoiceId
      r.log('table2-checked-out-with-invoice', !!checkoutInvoiceId, JSON.stringify(found))
    })

    await r.step('merge-table-into-invoice-via-ui', async () => {
      if (!checkoutInvoiceId || !table3Id) return r.log('merge-table-into-invoice-via-ui', false, 'missing prerequisites')
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      const card = page.locator('div.rounded-xl', { hasText: table2Name }).first()
      await card.getByRole('button', { name: 'Merge In' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: new RegExp(table3Name) }).click()
      await page.waitForTimeout(900)
      r.log('merge-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const found = (listRes?.data || []).find((t) => t.id === table3Id)
      r.log('table3-actually-merged', found?.currentInvoiceId === checkoutInvoiceId, JSON.stringify(found))
    })

    let orderRequestId
    await r.step('reject-order-request-via-ui', async () => {
      const statusRes = await page.evaluate(() => window.api.restaurant.getQrOrderingStatus())
      const port = statusRes?.data?.port
      r.log('qr-server-running', statusRes?.data?.running === true, JSON.stringify(statusRes?.data))
      if (!port || !table1Id || !menuProductId) return r.log('reject-order-request-via-ui', false, 'missing prerequisites')

      const orderRes = await fetch(`http://127.0.0.1:${port}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: table1Id, items: [{ productId: menuProductId, quantity: 1 }] }),
      }).then((res) => res.json()).catch((e) => ({ success: false, error: String(e) }))
      r.log('order-request-submitted', !!orderRes?.success, JSON.stringify(orderRes))

      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(1000)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.restaurant.listOrderRequests({}))
      const requests = listRes?.data?.requests || listRes?.data || []
      const found = requests.find((req) => req.tableId === table1Id)
      orderRequestId = found?.id
      r.log('order-request-persisted', !!orderRequestId, JSON.stringify(found))
      if (!orderRequestId) return

      const requestRow = page.locator('div.rounded-xl', { hasText: table1Name }).filter({ has: page.getByRole('button', { name: 'Reject' }) }).first()
      await requestRow.getByRole('button', { name: 'Reject' }).click()
      await page.waitForTimeout(1000)
      r.log('reject-no-crash', !(await h.hasErrorBoundary(page)))

      // listOrderRequests({}) with no status filter returns every status,
      // not just PENDING (the UI panel itself only loads PENDING) -- check
      // the request's own status flipped, not that it vanished from the list.
      const afterRes = await page.evaluate(() => window.api.restaurant.listOrderRequests({}))
      const afterRequests = afterRes?.data?.requests || afterRes?.data || []
      const afterFound = afterRequests.find((req) => req.id === orderRequestId)
      r.log('order-request-actually-rejected', afterFound?.status === 'REJECTED', JSON.stringify(afterFound))
    })

    let recipeId
    const recipeName = `${TEST_PREFIX} Recipe ${suffix}`
    await r.step('delete-recipe-via-ui', async () => {
      const ingredientRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'GM', costPrice: 1, sellingPrice: 0, taxRate: 0, openingQuantity: 1000,
      }), `${TEST_PREFIX} Ingredient ${suffix}`)
      const ingredientId = ingredientRes?.data?.id
      r.log('ingredient-created', !!ingredientId, JSON.stringify(ingredientRes?.error || ''))

      const recipeRes = await page.evaluate(({ pid, name, iid }) => window.api.restaurant.upsertRecipe({
        productId: pid, recipeName: name, items: [{ ingredientProductId: iid, quantity: 10 }],
      }), { pid: menuProductId, name: recipeName, iid: ingredientId })
      recipeId = recipeRes?.data?.id
      r.log('recipe-seeded', !!recipeId, JSON.stringify(recipeRes?.error || ''))
      if (!recipeId) return

      await h.gotoHash(page, '#/restaurant/recipes')
      await page.waitForTimeout(700)
      r.log('recipes-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // The whole recipe row header is itself a <button> (invalid-but-
      // rendered nesting) wrapping the actual Edit/Delete icon buttons, so
      // `button:has(svg.lucide-trash2)` also matches that OUTER button (the
      // svg is still a descendant of it) -- .last() picks the innermost,
      // actual delete button.
      const row = page.locator('p', { hasText: recipeName }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
      await row.locator('button:has(svg.lucide-trash2)').last().click()
      await page.waitForTimeout(900)
      r.log('delete-recipe-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.restaurant.listRecipes())
      r.log('recipe-actually-deleted', !(listRes?.data || []).some((rec) => rec.id === recipeId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('delete-empty-table-via-ui', async () => {
      // table1 has no invoice/currentInvoiceId (its one order request was
      // rejected, never accepted into a real KOT) -- safe to delete.
      if (!table1Id) return r.log('delete-empty-table-via-ui', false, 'no table1Id')
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      const card = page.locator('div.rounded-xl', { hasText: table1Name }).first()
      await card.locator('button.text-slate-300.hover\\:text-danger').click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-table-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.restaurant.listTables())
      r.log('table1-actually-deleted', !(listRes?.data || []).some((t) => t.id === table1Id), JSON.stringify(listRes?.data?.length))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'RESTAURANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let invoices = 0, kots = 0, tables = 0, recipes = 0, prods = 0, emps = 0, custs = 0
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      const invIds = prodIds.length === 0 ? [] : db.prepare(`SELECT DISTINCT i.id AS id FROM "Invoice" i JOIN InvoiceItem ii ON ii.invoiceId = i.id WHERE ii.productId IN (${prodIds.map(() => '?').join(',')})`).all(...prodIds).map((row) => row.id)
      for (const id of invIds) {
        try { db.prepare('UPDATE RestaurantTable SET currentInvoiceId = NULL WHERE currentInvoiceId = ?').run(id) } catch { /* noop */ }
        try { kots += db.prepare('DELETE FROM KOT WHERE invoiceId = ?').run(id).changes } catch { /* noop */ }
        try { db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { invoices += db.prepare('DELETE FROM "Invoice" WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      try { kots += db.prepare(`SELECT id FROM KOT WHERE tableId IN (SELECT id FROM RestaurantTable WHERE tableName LIKE '${TEST_PREFIX}%')`).all().length } catch { /* noop */ }
      const tableIds = db.prepare(`SELECT id FROM RestaurantTable WHERE tableName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const tid of tableIds) {
        try { db.prepare('DELETE FROM KOT WHERE tableId = ?').run(tid) } catch { /* noop */ }
        try { db.prepare('DELETE FROM OrderRequest WHERE tableId = ?').run(tid) } catch { /* noop */ }
        try { tables += db.prepare('DELETE FROM RestaurantTable WHERE id = ?').run(tid).changes } catch { /* noop */ }
      }
      const recipeIds = db.prepare(`SELECT id FROM Recipe WHERE recipeName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of recipeIds) {
        try { db.prepare('DELETE FROM RecipeItem WHERE recipeId = ?').run(id) } catch { /* noop */ }
        try { recipes += db.prepare('DELETE FROM Recipe WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      for (const id of prodIds) { try { db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id) } catch { /* noop */ } }
      for (const id of prodIds) { try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      db.prepare("DELETE FROM Setting WHERE settingKey IN ('restaurant_wifi_ssid','restaurant_wifi_password','restaurant_wifi_open')").run()
      for (const row of originalWifiSettings) {
        db.prepare('INSERT INTO Setting (id, settingKey, settingValue, settingType, updatedAt) VALUES (?, ?, ?, ?, ?)')
          .run(row.id, row.settingKey, row.settingValue, row.settingType, Date.now())
      }
      console.log('extra cleanup:', JSON.stringify({ invoices, kots, tables, recipes, prods, emps, custs, wifiRestored: originalWifiSettings.length }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRESTAURANT TABLES/RECIPE/ORDERS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
