/**
 * Suite 40 — Restaurant vertical (restaurant_tables, kot, recipes). Real
 * UI-driven table creation + status, an invoice sent to the kitchen (Send to
 * Kitchen button on InvoiceDetailScreen — createKOT takes only invoiceId,
 * tableId is optional and not wired from that button), KOT status ladder
 * (PENDING -> IN_PROGRESS -> DONE), and End of Day daily close. Product +
 * invoice creation itself is generic infra already covered by suite 01, so
 * scoped via API here per the established "distinguishing feature only"
 * pattern. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Rest'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-restaurant', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant / Café / Food')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))
    })

    await r.step('create-table-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      r.log('tables-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // "Add Table" appears twice once the form opens (header trigger + form
      // submit) — .first()/.last() disambiguate.
      await page.getByRole('button', { name: 'Add Table' }).first().click()
      await page.waitForTimeout(300)
      await page.getByPlaceholder('Table number (e.g. T1)').fill('T-E2E9')
      await page.getByPlaceholder('Display name (optional)').fill('E2E Rest Table')
      await page.getByRole('button', { name: 'Add Table' }).last().click()
      await page.waitForTimeout(1000)
      r.log('table-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'restaurant-table-created')
    })

    let tableId

    await r.step('verify-table-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const tables = listRes?.data || []
      const found = tables.find((t) => t.tableNumber === 'T-E2E9')
      tableId = found?.id
      r.log('table-findable-via-api', !!tableId, JSON.stringify({ status: found?.status }))
    })

    await r.step('set-table-occupied-via-real-ui', async () => {
      const card = page.locator('div.rounded-xl', { hasText: 'E2E Rest Table' }).first()
      await card.getByRole('button', { name: 'Busy' }).click()
      await page.waitForTimeout(800)
      const res = await page.evaluate((id) => window.api.restaurant.listTables().then((r2) => r2.data.find((t) => t.id === id)), tableId)
      r.log('table-marked-occupied', res?.status === 'OCCUPIED', JSON.stringify(res?.status))
    })

    let productId
    let invoiceId

    await r.step('create-product-and-invoice-via-api', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Rest Butter Naan', productType: 'STANDARD', unit: 'PCS',
        costPrice: 20, sellingPrice: 60, taxRate: 5, openingQuantity: 100,
      }))
      productId = prodRes?.data?.id
      r.log('product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const invRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 2, unitPrice: 60, taxRate: 5 }],
      }), productId)
      invoiceId = invRes?.data?.id
      r.log('invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
    })

    await r.step('send-to-kitchen-via-real-ui', async () => {
      await h.gotoHash(page, `#/billing/${invoiceId}`)
      await page.waitForTimeout(800)
      const kotBtn = page.getByRole('button', { name: 'Send to Kitchen' })
      r.log('send-to-kitchen-button-present', await kotBtn.count() > 0)
      await kotBtn.click()
      await page.waitForTimeout(1200)
      r.log('kot-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'restaurant-sent-to-kitchen')
    })

    let kotId

    await r.step('verify-kot-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
      const kots = listRes?.data || []
      const found = kots.find((k) => k.invoice?.invoiceNumber && k.invoiceId === invoiceId)
        ?? kots.find((k) => k.invoiceId === invoiceId)
      kotId = found?.id
      r.log('kot-findable-via-api', !!kotId, JSON.stringify({ status: found?.status }))
    })

    await r.step('advance-kot-status-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(800)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Default filter is "Pending" — our fresh KOT should be visible there.
      const card = page.locator('div.rounded-xl', { hasText: 'E2E Rest Butter Naan' }).first()
      await card.getByRole('button', { name: 'Start Cooking' }).click()
      await page.waitForTimeout(1000)

      // Now switch to the "In Progress" filter to find it and mark done.
      await page.getByRole('button', { name: 'In Progress', exact: true }).click()
      await page.waitForTimeout(800)
      const card2 = page.locator('div.rounded-xl', { hasText: 'E2E Rest Butter Naan' }).first()
      await card2.getByRole('button', { name: 'Mark Done' }).click()
      await page.waitForTimeout(1000)
      r.log('kot-advanced-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-kot-done-via-api', async () => {
      if (!kotId) return r.log('verify-kot-done-via-api', false, 'no kotId captured')
      const listRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
      const kots = listRes?.data || []
      const found = kots.find((k) => k.id === kotId)
      r.log('kot-reached-done', found?.status === 'DONE', JSON.stringify(found?.status))
    })

    // ── Phase 67 §9.1 item — Dish-Wise Contribution Margin report. Gives
    // the already-sold "E2E Rest Butter Naan" (2 units @ ₹60, from earlier
    // in this suite) a real recipe AFTER the sale — the report is a live
    // aggregation over InvoiceItem + the recipe's CURRENT formula, not a
    // snapshot taken at sale time, so seeding the recipe now is realistic.
    let ghostId
    await r.step('seed-ingredient-and-recipe', () => h.withDb((db) => {
      ghostId = `e2e-ghee-${Date.now()}`
      // Real bug found live while building this step: SQLite's own
      // CURRENT_TIMESTAMP function produces a TEXT string ("YYYY-MM-DD
      // HH:MM:SS"), but every Prisma-native row in this app stores DateTime
      // columns as an INTEGER (epoch ms) — confirmed via a direct query
      // against real rows. A date-range filter (gte/lte a real Date)
      // silently excludes TEXT-stored rows instead of erroring, so this
      // went unnoticed until the waste-variance report's own date-filtered
      // query below exposed it. Always insert a real epoch-ms integer.
      const now = Date.now()
      db.prepare(`INSERT INTO Product (id, productName, productType, sellingPrice, costPrice, taxRate, isActive, valuationMethod, updatedAt)
        VALUES (?, 'E2E Rest Ghee', 'STANDARD', 0, 8, 0, 1, 'WEIGHTED_AVERAGE', ?)`).run(ghostId, now)
      db.prepare(`INSERT INTO Inventory (id, productId, quantity, averageCost, updatedAt) VALUES (?, ?, 100, 8, ?)`).run(`${ghostId}-inv`, ghostId, now)
      const recipeId = `${ghostId}-recipe`
      db.prepare(`INSERT INTO Recipe (id, productId, recipeName, createdAt) VALUES (?, ?, 'E2E Butter Naan Recipe', ?)`).run(recipeId, productId, now)
      db.prepare(`INSERT INTO RecipeItem (id, recipeId, ingredientProductId, quantity, createdAt) VALUES (?, ?, ?, 2, ?)`).run(`${recipeId}-item`, recipeId, ghostId, now)
    }))

    await r.step('dish-contribution-margin-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Dish-Wise Contribution Margin' }).first()
      r.log('dish-margin-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 24 * 3600000)))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('dish-margin-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('dish-margin-report-shows-our-dish', bodyText.includes('E2E Rest Butter Naan'))
      await h.shot(page, 'restaurant-dish-contribution-margin')
    })

    await r.step('dish-contribution-margin-report-computes-correctly-via-real-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 24 * 3600000))
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.dishContributionMargin({ dateFrom: from, dateTo: to }), { from, to })
      const row = (res?.data?.rows || []).find((rr) => rr.productId === productId)
      r.log('dish-margin-row-found', !!row, JSON.stringify(row))
      if (row) {
        // 2 units sold; ingredient cost = 2 (recipe qty) * 8 (ghee averageCost) = 16/unit -> 32 total.
        r.log('dish-margin-ingredient-cost-correct', row.ingredientCost === 32, `ingredientCost=${row.ingredientCost}`)
        r.log('dish-margin-quantity-correct', row.quantitySold === 2, `quantitySold=${row.quantitySold}`)
        r.log('dish-margin-equals-revenue-minus-cost', row.contributionMargin === row.revenue - row.ingredientCost, `margin=${row.contributionMargin} revenue=${row.revenue}`)
      }
    })

    // ── Phase 67 §9.1 item — Table Turnover by Hour report. The KOT
    // created earlier in this suite (send-to-kitchen-via-real-ui) has no
    // tableId — billing.createInvoice was called without a tableIds param,
    // so InvoiceDetailScreen's "Send to Kitchen" had nothing to bind. Bind
    // it now via DB (seeding a precondition, not the feature under test —
    // the real table-binding UI flow is already covered by suite 48) so
    // this KOT genuinely counts as a "table turn" for the report.
    let kotCreatedAt
    await r.step('bind-kot-to-table-for-turnover-test', () => h.withDb((db) => {
      db.prepare('UPDATE KOT SET tableId = ? WHERE invoiceId = ?').run(tableId, invoiceId)
      const row = db.prepare('SELECT createdAt FROM KOT WHERE invoiceId = ?').get(invoiceId)
      kotCreatedAt = row ? new Date(row.createdAt) : null
      r.log('kot-bound-to-table', !!row, JSON.stringify(row))
    }))

    await r.step('table-turnover-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Table Turnover by Hour' }).first()
      r.log('table-turnover-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 24 * 3600000)))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('table-turnover-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('table-turnover-report-shows-summary-cards', /Total Table Turns/i.test(bodyText))
      await h.shot(page, 'restaurant-table-turnover-heatmap')
    })

    await r.step('table-turnover-report-computes-correctly-via-real-api', async () => {
      if (!kotCreatedAt) { r.log('skipped-no-kot-timestamp', false); return }
      const from = h.toLocalISODate(new Date(Date.now() - 24 * 3600000))
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.tableTurnoverByHour({ dateFrom: from, dateTo: to }), { from, to })
      const cells = res?.data?.cells || []
      r.log('table-turnover-full-168-cell-grid', cells.length === 168, `cells=${cells.length}`)
      const expectedDay = kotCreatedAt.getDay()
      const expectedHour = kotCreatedAt.getHours()
      const cell = cells.find((c) => c.dayOfWeek === expectedDay && c.hour === expectedHour)
      r.log('table-turnover-real-kot-counted-in-correct-cell', !!cell && cell.count >= 1, JSON.stringify({ expectedDay, expectedHour, cell }))
      r.log('table-turnover-summary-totalTurns-at-least-one', (res?.data?.summary?.totalTurns ?? 0) >= 1, JSON.stringify(res?.data?.summary))
    })

    // ── Phase 67 §9.1 item — Recipe-vs-Actual Waste Variance report.
    // Ghee's recipe-IMPLIED usage is already real: 2 units of "Butter Naan"
    // sold earlier x 2 recipe qty = 4. Seed a real InventoryMovement (the
    // exact shape deductIngredients() itself creates — same
    // INGREDIENT_DEDUCTION_REMARKS_PREFIX tag restaurant.service.ts exports)
    // showing 6 actually drawn down, so the report's two independently-
    // sourced numbers genuinely differ — a real +2 overage, not a
    // fabricated one.
    await r.step('seed-actual-ingredient-drawdown-for-variance-test', () => h.withDb((db) => {
      // Real epoch-ms integer, not SQLite's CURRENT_TIMESTAMP — see the
      // seed-ingredient-and-recipe step's comment for why that matters here
      // specifically (this row IS date-range filtered by the report below).
      db.prepare(`INSERT INTO InventoryMovement (id, productId, movementType, quantity, remarks, createdAt)
        VALUES (?, ?, 'ADJUSTMENT', -6, 'Ingredient deduction for KOT — recipe: E2E Butter Naan Recipe', ?)`)
        .run(`${ghostId}-movement`, ghostId, Date.now())
      r.log('actual-movement-seeded', true)
    }))

    await r.step('recipe-waste-variance-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Recipe-vs-Actual Waste Variance' }).first()
      r.log('waste-variance-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 24 * 3600000)))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('waste-variance-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('waste-variance-report-shows-ghee', bodyText.includes('E2E Rest Ghee'))
      await h.shot(page, 'restaurant-recipe-waste-variance')
    })

    await r.step('recipe-waste-variance-report-computes-correctly-via-real-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 24 * 3600000))
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.recipeWasteVariance({ dateFrom: from, dateTo: to }), { from, to })
      const row = (res?.data?.rows || []).find((rr) => rr.ingredientProductId === ghostId)
      r.log('waste-variance-row-found', !!row, JSON.stringify(row))
      if (row) {
        r.log('waste-variance-implied-quantity-correct', row.impliedQuantity === 4, `implied=${row.impliedQuantity}`) // 2 recipe qty * 2 units sold
        r.log('waste-variance-actual-quantity-correct', row.actualQuantity === 6, `actual=${row.actualQuantity}`)
        r.log('waste-variance-equals-actual-minus-implied', row.varianceQuantity === 2, `variance=${row.varianceQuantity}`)
      }
    })

    await r.step('perform-daily-close-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'End of Day' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'End of Day' }).click()
      await page.waitForTimeout(1500)
      const bodyText = await page.locator('body').innerText()
      r.log('daily-close-completed', /Day closed/.test(bodyText), bodyText.slice(0, 200))
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE 'E2E Rest%'").all().map((r2) => r2.id)
      const invIds = prodIds.length === 0 ? [] : db.prepare(`SELECT DISTINCT i.id AS id FROM "Invoice" i JOIN InvoiceItem ii ON ii.invoiceId = i.id WHERE ii.productId IN (${prodIds.map(() => '?').join(',')})`).all(...prodIds).map((r2) => r2.id)
      for (const id of invIds) {
        try { db.prepare('DELETE FROM KOT WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM "Invoice" WHERE id = ?').run(id) } catch { /* noop */ }
      }
      // Recipe.productId has no FK to Product (see restaurant.service.ts's
      // own comment), so deleting the product wouldn't cascade this away —
      // clean it explicitly or it's orphaned test data forever.
      const recipeIds = db.prepare("SELECT id FROM Recipe WHERE recipeName LIKE 'E2E%'").all().map((r2) => r2.id)
      for (const id of recipeIds) {
        try { db.prepare('DELETE FROM RecipeItem WHERE recipeId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Recipe WHERE id = ?').run(id) } catch { /* noop */ }
      }
      // Real gotcha this project has hit before: deleting a Product with
      // InventoryMovement rows still pointing at it silently no-ops inside
      // the try/catch below (falls back to soft-delete) — clear those first.
      let movementsRemoved = 0
      for (const id of prodIds) { movementsRemoved += db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id).changes }
      for (const id of prodIds) { try { db.prepare('DELETE FROM Product WHERE id = ?').run(id) } catch { /* noop */ } }
      const tableIds = db.prepare("SELECT id FROM RestaurantTable WHERE tableNumber = 'T-E2E9'").all().map((r2) => r2.id)
      for (const id of tableIds) { try { db.prepare('DELETE FROM RestaurantTable WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: invoices', invIds.length, 'products', prodIds.length, 'recipes', recipeIds.length, 'movements', movementsRemoved, 'tables', tableIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRESTAURANT VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
