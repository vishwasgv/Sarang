/**
 * Suite 79 — Pharmacy vertical, Phase 67 §9.1 items 1 and 5: Schedule H1/X
 * Narcotic Register (Feature + Report) and Expiry-Aware Reorder Suppression
 * (Feature). Items 3/4 (Doctor-Wise Prescription Volume, Expiry-Risk Value)
 * were already closed in an earlier session (§2), and item 2 (doctor-linked
 * sale capture) was found already fully built via the pre-existing
 * prescription-capture mechanism this vertical already had — this suite
 * closes the 2 genuinely remaining items and, with them, the Pharmacy
 * vertical and Phase 67's entire 23-vertical scope.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E PHM79'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let phmTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-pharmacy-business', async () => {
      const sw = await h.switchBusinessType(page, 'Pharmacy')
      r.log('business-type-switched', sw.to === 'PHARMACY', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      phmTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('PHARMACY')
      if (phmTemplateRowBefore) {
        const mods = new Set(JSON.parse(phmTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), phmTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'PHARMACY', JSON.stringify(['ai_assistant']))
      }
    })

    // ─── Phase 67 §9.1 item 1: Schedule H1/X Narcotic Register, real UI ────
    let productId
    await r.step('setup-prescription-product-via-api', async () => {
      const res = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Alprazolam 0.5mg`, unit: 'PCS', sellingPrice: 30, costPrice: 15, taxRate: 12,
        productType: 'STANDARD', isPrescriptionRequired: true, openingQuantity: 10,
      }), TEST_PREFIX)
      productId = res?.data?.id
      r.log('product-created', !!productId, JSON.stringify(res?.error || ''))
    })

    await r.step('check-scheduleh1x-checkbox-via-real-ui-nested-reveal', async () => {
      if (!productId) return r.log('check-scheduleh1x-checkbox-via-real-ui-nested-reveal', false, 'no product id')
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const searchBox = page.getByPlaceholder(/search/i).first()
      if (await searchBox.count()) { await searchBox.fill(`${TEST_PREFIX} Alprazolam`); await page.waitForTimeout(600) }

      const row = page.locator('tr', { hasText: `${TEST_PREFIX} Alprazolam` }).first()
      r.log('product-row-found', await row.count() > 0)
      await row.locator('button').first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      // Product was created with isPrescriptionRequired: true, so the
      // nested Schedule H1/X checkbox should already be visible (it's only
      // shown once Prescription Required is checked) without us having to
      // check the parent box ourselves first — that conditional reveal is
      // exactly the real UI behaviour this step verifies.
      const h1xCheckbox = modal.getByLabel(/Schedule H1\/X/i)
      r.log('scheduleh1x-nested-checkbox-visible-when-rx-already-checked', await h1xCheckbox.count() > 0)
      if (await h1xCheckbox.count()) await h1xCheckbox.check()

      await modal.locator('button', { hasText: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('modal-closed-after-successful-save', await modal.count() === 0)
      r.log('product-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.products.get(id), productId)
      r.log('scheduleh1x-flag-persisted', getRes?.data?.isScheduleH1X === true, JSON.stringify(getRes?.data))
    })

    let customerId
    await r.step('sell-scheduleh1x-product-via-real-billing-ui', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const search = page.getByPlaceholder('Search products…').first()
      await search.fill(`${TEST_PREFIX} Alprazolam`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Alprazolam` }).first().click()
      await page.waitForTimeout(500)

      // Adding a prescription-required product opens the Rx-detail modal (see BillingScreen.tsx's own isPrescriptionRequired branch).
      const rxModal = h.topModal(page)
      r.log('rx-modal-opened-for-prescription-product', await rxModal.count() > 0)
      await rxModal.locator('input').nth(0).fill(`${TEST_PREFIX} Patient`)
      await rxModal.locator('input').nth(1).fill(`${TEST_PREFIX} Dr. Rao`)
      await rxModal.locator('button', { hasText: 'Add to Cart' }).first().click()
      await page.waitForTimeout(500)
      r.log('rx-item-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))

      const custSearch = page.getByPlaceholder('Search customers…').first()
      if (await custSearch.count()) {
        await custSearch.fill(`${TEST_PREFIX} Customer`)
        await page.waitForTimeout(600)
        await page.locator('button', { hasText: `${TEST_PREFIX} Customer` }).first().click()
        await page.waitForTimeout(300)
      }

      const cashBtn = page.locator('button', { hasText: 'Cash' }).first()
      if (await cashBtn.count()) await cashBtn.click()
      await page.locator('button', { hasText: 'Confirm Sale' }).first().click()
      await page.waitForTimeout(1500)
      r.log('sale-completed-no-crash', !(await h.hasErrorBoundary(page)))

      const invRes = await page.evaluate((custId) => window.api.billing.listInvoices({ customerId: custId }), customerId)
      r.log('invoice-actually-created', (invRes?.data?.total ?? 0) >= 1, JSON.stringify(invRes?.data))
    })

    await r.step('scheduleh1x-register-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.scheduleH1XRegister(p), { dateFrom, dateTo })
      r.log('scheduleh1x-register-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.productName === `${TEST_PREFIX} Alprazolam 0.5mg`)
      r.log('scheduleh1x-register-row-has-our-sale', !!row && row.patientName === `${TEST_PREFIX} Patient` && row.doctorName === `${TEST_PREFIX} Dr. Rao`, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Schedule H1/X Register' }).first()
      r.log('scheduleh1x-register-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('scheduleh1x-register-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('scheduleh1x-register-shows-our-sale', bodyText.includes(`${TEST_PREFIX} Alprazolam`), bodyText.slice(0, 2000))
        await h.shot(page, 'pharmacy-scheduleh1x-register')
      }
    })

    await r.step('ai-intent-routes-scheduleh1xregister-correctly', async () => {
      const res = await page.evaluate(() => window.api.ai.query({ question: 'Show me the narcotic register for this month' }))
      r.log('ai-scheduleh1x-intent-routed-correctly', res?.data?.template === 'pharmacy.scheduleH1XRegister', JSON.stringify({ template: res?.data?.template, answer: res?.data?.answer }))
    })

    // ─── Phase 67 §9.1 item 5: Expiry-Aware Reorder Suppression ────────────
    let expiringProductId, supplierId
    await r.step('setup-near-expiry-low-velocity-product', async () => {
      const supRes = await page.evaluate(async (prefix) => window.api.suppliers.create({
        supplierName: `${prefix} Supplier`, phone: `8${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      supplierId = supRes?.data?.id
      r.log('supplier-created', !!supplierId, JSON.stringify(supRes?.error || ''))

      const prodRes = await page.evaluate(async ({ prefix, supplierId }) => window.api.products.create({
        productName: `${prefix} Cough Syrup 100ml`, unit: 'PCS', sellingPrice: 80, costPrice: 40, taxRate: 12,
        productType: 'STANDARD', reorderLevel: 20, reorderQuantity: 30, defaultSupplierId: supplierId, openingQuantity: 5,
      }), { prefix: TEST_PREFIX, supplierId })
      expiringProductId = prodRes?.data?.id
      r.log('near-expiry-product-created-below-reorder-level', !!expiringProductId, JSON.stringify(prodRes?.error || ''))

      if (expiringProductId) {
        const batchRes = await page.evaluate(async ({ productId, expiryDate }) => window.api.batches.create({
          productId, batchNumber: 'B-EXP-01', expiryDate, quantityReceived: 15, unitCost: 40,
        }), { productId: expiringProductId, expiryDate: h.toLocalISODate(new Date(Date.now() + 10 * 86400000)) })
        r.log('near-expiry-batch-created', !!batchRes?.success, JSON.stringify(batchRes?.error || ''))
        // No sales recorded for this product at all -> zero velocity, so the
        // 15 near-expiry units can never plausibly sell through in 10 days.
      }
    })

    await r.step('reorder-generation-suppresses-the-near-expiry-low-velocity-product-via-real-ui', async () => {
      if (!expiringProductId) return r.log('reorder-generation-suppresses-the-near-expiry-low-velocity-product-via-real-ui', false, 'no product id')
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/inventory')
      await page.waitForTimeout(700)

      const genBtn = page.locator('button', { hasText: 'Generate Reorder POs' }).first()
      r.log('generate-reorder-button-present', await genBtn.count() > 0)
      if (await genBtn.count()) {
        await genBtn.click()
        await page.waitForTimeout(1500)
        r.log('reorder-generation-no-crash', !(await h.hasErrorBoundary(page)))
      }

      // Confirm via the API directly too (deterministic, not dependent on toast timing).
      const reorderRes = await page.evaluate(() => window.api.purchaseOrders.generateReorderDraftPOs())
      const suppressed = (reorderRes?.data?.suppressedExpiringStock || []).find((s) => s.productId === expiringProductId)
      r.log('product-suppressed-from-reorder', !!suppressed && suppressed.recentDailyVelocity === 0, JSON.stringify(suppressed))
      const createdForThisProduct = (reorderRes?.data?.created || []).some((c) => c.supplierId === supplierId)
      r.log('no-po-created-for-suppressed-product-supplier', !createdForThisProduct, JSON.stringify(reorderRes?.data?.created))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PHARMACY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (phmTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(phmTemplateRowBefore.enabledModules, phmTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('PHARMACY', JSON.stringify(['ai_assistant']))
      }
    })
    // Pharmacy-specific cleanup FIRST, in FK-dependency order — before
    // cleanupByNamePrefix's generic Customer/Product/Supplier loops run,
    // matching every other Phase 67 suite's own custom-cleanup-before-
    // generic-cleanup convention this session established.
    h.withDb((db) => {
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let batchesRemoved = 0
      for (const pid of prodIds) {
        const info = db.prepare('DELETE FROM ProductBatch WHERE productId = ?').run(pid)
        batchesRemoved += info.changes
        // Known "E2E Product Cleanup FK Gotcha" — LocationStock/
        // InventoryMovement must be cleared before a real-stock Product can
        // hard-delete, or the generic cleanup helper silently soft-deletes.
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
      }
      console.log('pharmacy 67 extra cleanup:', JSON.stringify({ products: prodIds.length, batchesRemoved }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPHARMACY SCHEDULE-H1X/REORDER-SUPPRESSION: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
