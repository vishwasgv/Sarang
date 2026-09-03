/**
 * Suite 154 — Section C medium gap: 8 zero-coverage products.handler.ts
 * channels: archive, generateBarcode, bulkGenerateMissingBarcodes,
 * generateWeightLabel, upsertCustomerClassPrice, deleteCustomerClassPrice,
 * setKitComponents, clearKit. All real-UI-driven, spanning ProductsScreen,
 * ProductFormModal, SettingsScreen (Barcode & Loose Billing), PrintLabels-
 * Screen, and the Distributor Customer Pricing screen.
 */
const h = require('../harness')
const { createTestProduct } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E154'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const suffix = Date.now()

  let originalModules = []
  let originalLabelPrinter = ''

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let categoryId
    let archiveProdId, barcodeProdId, bulkProdId, weightProdId, kitProdId, comp1Id, comp2Id, pricingProdId
    await r.step('seed-products-via-api', async () => {
      // Seeded BEFORE barcode_generation is enabled below -- product.service's
      // createProduct auto-generates a barcode at creation time whenever that
      // module is already on, which would leave barcodeProdId/bulkProdId with
      // a barcode from the start and make both later "was missing, now
      // generated" assertions vacuous.
      // Products screen fetches only the first 50 (alphabetical) active
      // products and filters client-side -- a fresh test product can sort
      // past that cap and never appear in the search box no matter what's
      // typed. A dedicated category + the screen's own category filter pill
      // scopes the fetch down to just our rows, sidestepping the cap.
      const catRes = await page.evaluate(async (name) => window.api.categories.create({ name }), `${TEST_PREFIX} Cat ${suffix}`)
      categoryId = catRes?.data?.id

      const archive = await createTestProduct(page, { productName: `${TEST_PREFIX} Archive Me ${suffix}`, categoryId })
      archiveProdId = archive?.data?.id
      const barcode = await createTestProduct(page, { productName: `${TEST_PREFIX} Barcode Me ${suffix}`, categoryId })
      barcodeProdId = barcode?.data?.id
      const bulk = await createTestProduct(page, { productName: `${TEST_PREFIX} Bulk Missing ${suffix}`, categoryId })
      bulkProdId = bulk?.data?.id
      const weight = await createTestProduct(page, {
        productName: `${TEST_PREFIX} Loose Rice ${suffix}`, sellByWeight: true, weightUnit: 'kg', pricePerWeightUnit: 80, categoryId,
      })
      weightProdId = weight?.data?.id
      const kit = await createTestProduct(page, { productName: `${TEST_PREFIX} Diwali Hamper ${suffix}`, categoryId })
      kitProdId = kit?.data?.id
      const c1 = await createTestProduct(page, { productName: `${TEST_PREFIX} Component A ${suffix}`, categoryId })
      comp1Id = c1?.data?.id
      const c2 = await createTestProduct(page, { productName: `${TEST_PREFIX} Component B ${suffix}`, categoryId })
      comp2Id = c2?.data?.id
      const pricing = await createTestProduct(page, { productName: `${TEST_PREFIX} Distributor SKU ${suffix}`, categoryId })
      pricingProdId = pricing?.data?.id
      r.log('all-products-seeded', !!categoryId && [archiveProdId, barcodeProdId, bulkProdId, weightProdId, kitProdId, comp1Id, comp2Id, pricingProdId].every(Boolean))
    })

    await r.step('enable-barcode-modules-via-ui', async () => {
      // Raw window.api.industry.updateModules() persists to the DB but never
      // syncs the renderer's Zustand industry.store cache -- isModuleEnabled()
      // reads from that stale cache, so barcode-gated buttons (Generate
      // Barcode, Generate Missing Barcodes) silently never appear. Driving
      // the real Settings toggle switches goes through updateEnabledModules()
      // instead, which sets the store correctly, same as a real owner would.
      const tplRes = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tplRes?.data?.enabledModules || []

      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(600)
      await page.locator('button:has-text("Barcode & Loose Billing")').click()
      await page.waitForTimeout(500)

      for (const label of ['Barcode Generation & Scanning', 'Barcode Label Printing']) {
        const row = page.locator('div.flex.items-center.justify-between.px-5.py-4', { hasText: label })
        const sw = row.locator('button[role="switch"]')
        const checked = await sw.getAttribute('aria-checked')
        if (checked !== 'true') {
          await sw.click()
          await page.waitForTimeout(500)
        }
      }
      const tplAfter = await page.evaluate(async () => window.api.industry.getTemplate())
      const mods = tplAfter?.data?.enabledModules || []
      r.log('modules-enabled', mods.includes('barcode_generation') && mods.includes('barcode_printing'), JSON.stringify(mods))

      const setRes = await page.evaluate(async () => window.api.settings.get('label_printer_name'))
      originalLabelPrinter = setRes?.data ?? ''
      await page.evaluate(async () => window.api.settings.set({ key: 'label_printer_name', value: 'E2E154-Fake-Device' }))
    })

    await r.step('archive-product-via-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      r.log('products-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Exact-suffixed name, not just the prefix -- a leftover category from
      // an earlier failed run (same prefix, different suffix, not cleaned up
      // by a partial finally-block run) can otherwise collide and .first()
      // picks the wrong, empty category.
      await page.locator('button', { hasText: `${TEST_PREFIX} Cat ${suffix}` }).first().click()
      await page.waitForTimeout(500)

      const search = page.locator('input[placeholder*="Search"]').first()
      await search.fill(`${TEST_PREFIX} Archive Me`)
      await page.waitForTimeout(700)

      const row = page.locator('tr', { hasText: `${TEST_PREFIX} Archive Me` }).first()
      await row.locator('button:has(svg.lucide-archive)').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Archive Product', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('archive-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.products.get(id), archiveProdId)
      r.log('product-actually-archived', getRes?.data?.isActive === false, JSON.stringify(getRes?.data?.isActive))
    })

    await r.step('generate-barcode-via-ui', async () => {
      const before = await page.evaluate((id) => window.api.products.get(id), barcodeProdId)
      r.log('barcode-initially-missing', !before?.data?.barcode, JSON.stringify(before?.data?.barcode))

      const search = page.locator('input[placeholder*="Search"]').first()
      await search.fill(`${TEST_PREFIX} Barcode Me`)
      await page.waitForTimeout(700)

      const row = page.locator('tr', { hasText: `${TEST_PREFIX} Barcode Me` }).first()
      await row.locator('button:has(svg.lucide-square-pen)').click()
      await page.waitForTimeout(600)
      const modal = h.topModal(page)
      await modal.locator('button[title="Generate a barcode for this product"]').click()
      await page.waitForTimeout(900)
      r.log('generate-barcode-no-crash', !(await h.hasErrorBoundary(page)))
      await h.closeTopModal(page)
      await page.waitForTimeout(400)

      const getRes = await page.evaluate((id) => window.api.products.get(id), barcodeProdId)
      r.log('barcode-actually-generated', !!getRes?.data?.barcode, JSON.stringify(getRes?.data?.barcode))
    })

    await r.step('bulk-generate-missing-barcodes-via-ui', async () => {
      const before = await page.evaluate((id) => window.api.products.get(id), bulkProdId)
      r.log('bulk-target-initially-missing', !before?.data?.barcode, JSON.stringify(before?.data?.barcode))

      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(600)
      await page.locator('button:has-text("Barcode & Loose Billing")').click()
      await page.locator('text=Generate Missing Barcodes').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      r.log('settings-barcode-section-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("Generate Missing Barcodes")').click()
      await page.waitForTimeout(1200)
      r.log('bulk-generate-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.products.get(id), bulkProdId)
      r.log('bulk-target-actually-generated', !!getRes?.data?.barcode, JSON.stringify(getRes?.data?.barcode))
    })

    await r.step('weigh-and-print-label-via-ui', async () => {
      await h.gotoHash(page, '#/products/print-labels')
      await page.waitForTimeout(700)
      r.log('print-labels-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const search = page.getByPlaceholder('Search loose-billed products…')
      await search.fill(`${TEST_PREFIX} Loose Rice`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Loose Rice` }).first().click()
      await page.waitForTimeout(300)

      await page.getByLabel('Weight (grams)').fill('250')
      await page.waitForTimeout(200)
      // The batch-print button above renders as literal text "Print  Label"
      // (plural suffix collapses) whenever its own line count is 0 -- an
      // exact accessible-name collision with this section's own button.
      // Scope to this section specifically.
      const weighSection = page.locator('div.border-t', { hasText: 'Weigh & Print a Loose Item' })
      await weighSection.getByRole('button', { name: 'Print Label' }).click()
      await page.waitForTimeout(1500)
      r.log('weigh-and-print-no-crash', !(await h.hasErrorBoundary(page)))

      h.withDb((db) => {
        const row = db.prepare('SELECT * FROM LabelPrintLog WHERE productId = ? ORDER BY printedAt DESC').get(weightProdId)
        r.log('weight-label-actually-generated', !!row && row.weightGrams === 250, JSON.stringify(row))
      })
    })

    await r.step('set-kit-components-via-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      // Exact-suffixed name, not just the prefix -- a leftover category from
      // an earlier failed run (same prefix, different suffix, not cleaned up
      // by a partial finally-block run) can otherwise collide and .first()
      // picks the wrong, empty category.
      await page.locator('button', { hasText: `${TEST_PREFIX} Cat ${suffix}` }).first().click()
      await page.waitForTimeout(500)
      const search = page.locator('input[placeholder*="Search"]').first()
      await search.fill(`${TEST_PREFIX} Diwali Hamper`)
      await page.waitForTimeout(700)

      const row = page.locator('tr', { hasText: `${TEST_PREFIX} Diwali Hamper` }).first()
      await row.locator('button:has(svg.lucide-square-pen)').click()
      await page.waitForTimeout(600)
      const modal = h.topModal(page)

      await modal.locator('label', { hasText: 'This is a kit' }).click()
      await page.waitForTimeout(300)

      const rows = modal.locator('div.flex.items-center.gap-2', { has: page.getByPlaceholder('Search a product…') })
      const row1 = rows.nth(0)
      await row1.getByPlaceholder('Search a product…').fill(`${TEST_PREFIX} Component A`)
      await page.waitForTimeout(400)
      await modal.getByRole('button', { name: new RegExp(`${TEST_PREFIX} Component A`) }).click()
      await page.waitForTimeout(200)
      await row1.locator('input[type="number"]').fill('2')

      await modal.getByRole('button', { name: 'Add component' }).click()
      await page.waitForTimeout(300)
      const row2 = modal.locator('div.flex.items-center.gap-2', { has: page.getByPlaceholder('Search a product…') }).nth(1)
      await row2.getByPlaceholder('Search a product…').fill(`${TEST_PREFIX} Component B`)
      await page.waitForTimeout(400)
      await modal.getByRole('button', { name: new RegExp(`${TEST_PREFIX} Component B`) }).click()
      await page.waitForTimeout(200)
      await row2.locator('input[type="number"]').fill('3')

      await modal.getByRole('button', { name: 'Save Kit Components' }).click()
      await page.waitForTimeout(900)
      r.log('save-kit-components-no-crash', !(await h.hasErrorBoundary(page)))
      await h.closeTopModal(page)
      await page.waitForTimeout(400)

      const getRes = await page.evaluate((id) => window.api.products.get(id), kitProdId)
      r.log('product-actually-marked-as-kit', getRes?.data?.isKit === true, JSON.stringify(getRes?.data?.isKit))

      const compRes = await page.evaluate((id) => window.api.products.getKitComponents(id), kitProdId)
      const rowsData = compRes?.data || []
      const hasA = rowsData.some((c) => c.componentProductId === comp1Id && c.quantity === 2)
      const hasB = rowsData.some((c) => c.componentProductId === comp2Id && c.quantity === 3)
      r.log('kit-components-actually-saved', hasA && hasB, JSON.stringify(rowsData))
    })

    await r.step('clear-kit-via-ui', async () => {
      const search = page.locator('input[placeholder*="Search"]').first()
      await search.fill(`${TEST_PREFIX} Diwali Hamper`)
      await page.waitForTimeout(700)

      const row = page.locator('tr', { hasText: `${TEST_PREFIX} Diwali Hamper` }).first()
      await row.locator('button:has(svg.lucide-square-pen)').click()
      await page.waitForTimeout(600)
      const modal = h.topModal(page)

      // Re-opened in edit mode on an already-isKit product -- the kit panel
      // is pre-checked and pre-populated with both saved rows.
      const removeButtons = modal.locator('div.flex.items-center.gap-2', { has: page.getByPlaceholder('Search a product…') }).locator('button:has(svg.lucide-x)')
      const countBefore = await removeButtons.count()
      r.log('kit-rows-pre-populated', countBefore === 2, `count=${countBefore}`)
      for (let i = 0; i < countBefore; i++) {
        await modal.locator('div.flex.items-center.gap-2', { has: page.getByPlaceholder('Search a product…') }).locator('button:has(svg.lucide-x)').first().click()
        await page.waitForTimeout(150)
      }

      await modal.getByRole('button', { name: 'Save Kit Components' }).click()
      await page.waitForTimeout(900)
      r.log('clear-kit-no-crash', !(await h.hasErrorBoundary(page)))
      await h.closeTopModal(page)
      await page.waitForTimeout(400)

      const getRes = await page.evaluate((id) => window.api.products.get(id), kitProdId)
      r.log('product-actually-unkitted', getRes?.data?.isKit === false, JSON.stringify(getRes?.data?.isKit))

      const compRes = await page.evaluate((id) => window.api.products.getKitComponents(id), kitProdId)
      r.log('kit-components-actually-cleared', (compRes?.data || []).length === 0, JSON.stringify(compRes?.data))
    })

    let classPriceId
    await r.step('upsert-customer-class-price-via-ui', async () => {
      await h.gotoHash(page, '#/distributor/pricing')
      await page.waitForTimeout(700)
      r.log('customer-pricing-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByPlaceholder('Search product…').fill(`${TEST_PREFIX} Distributor SKU`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Distributor SKU` }).first().click()
      await page.waitForTimeout(200)

      await page.getByPlaceholder('Customer class, e.g. RETAILER').fill(`${TEST_PREFIX}CLASS`)
      await page.getByPlaceholder('Price').fill('120')
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Save Price' }).click()
      await page.waitForTimeout(900)
      r.log('upsert-class-price-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.products.listCustomerClassPrices())
      const found = (listRes?.data || []).find((cp) => cp.productId === pricingProdId && cp.customerClass === `${TEST_PREFIX}CLASS`)
      classPriceId = found?.id
      r.log('class-price-actually-saved', !!classPriceId && found?.price === 120, JSON.stringify(found))
    })

    await r.step('delete-customer-class-price-via-ui', async () => {
      if (!classPriceId) return r.log('delete-customer-class-price-via-ui', false, 'no classPriceId')
      const row = page.locator('div.grid.grid-cols-12', { hasText: `${TEST_PREFIX}CLASS` }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-class-price-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.products.listCustomerClassPrices())
      r.log('class-price-actually-deleted', !(listRes?.data || []).some((cp) => cp.id === classPriceId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('restore-module-and-label-printer-state', async () => {
      const updRes = await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), originalModules)
      r.log('modules-restored', !!updRes?.success, JSON.stringify(updRes?.error || ''))
      await page.evaluate(async (v) => window.api.settings.set({ key: 'label_printer_name', value: v }), originalLabelPrinter)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let cleared = 0, prods = 0
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of prodIds) {
        try { db.prepare('DELETE FROM CustomerClassPrice WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LabelPrintLog WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM KitComponent WHERE kitProductId = ? OR componentProductId = ?').run(id, id) } catch { /* noop */ }
        try { cleared += db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id).changes } catch { /* noop */ }
        try { db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Inventory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(id).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(id) }
      }
      let cats = 0
      const catIds = db.prepare(`SELECT id FROM ProductCategory WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of catIds) {
        try { db.prepare('UPDATE Product SET categoryId = NULL WHERE categoryId = ?').run(id) } catch { /* noop */ }
        try { cats += db.prepare('DELETE FROM ProductCategory WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ prodIds: prodIds.length, prods, cats }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPRODUCTS ARCHIVE/BARCODE/KIT/PRICING: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
