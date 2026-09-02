/**
 * Suite 65 — Phase 64 Inventory & Costing Depth: live UI verification for
 * the highest-risk new integrations (real click-through, not just "the
 * screen didn't crash"): a kit sale exploding into real component stock
 * deductions, a two-location transfer with a real audit trail, and a
 * landed-cost allocation that genuinely raises a purchase's recorded unit
 * cost. Setup (products/customers/suppliers) goes through the real IPC
 * layer directly (window.api.*) — same convention suite 01 established —
 * so only the feature under test is driven via real UI clicks.
 */
const h = require('../harness')
const crypto = require('crypto')

const TEST_PREFIX = 'E2E Costing64'
const suffix = Date.now()
function newId() { return crypto.randomUUID() }

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const kitName = `${TEST_PREFIX} Diwali Hamper ${suffix}`
  const comp1Name = `${TEST_PREFIX} Candle ${suffix}`
  const comp2Name = `${TEST_PREFIX} Sweet Box ${suffix}`
  const customerName = `${TEST_PREFIX} Customer ${suffix}`
  const transferProductName = `${TEST_PREFIX} Transfer Widget ${suffix}`
  const locationName = `${TEST_PREFIX} Warehouse ${suffix}`
  const supplierName = `${TEST_PREFIX} Supplier ${suffix}`
  const poProductAName = `${TEST_PREFIX} PO Item A ${suffix}`
  const poProductBName = `${TEST_PREFIX} PO Item B ${suffix}`

  let page
  const productIds = {}
  let transferProductId = null
  let mainLocationId = null
  let newLocationId = null
  let poId = null
  let supplierId = null
  // Phase 64 gap-closure additions (2026-08-27).
  const valuationProductIds = []
  let rawMaterialId = null
  let jcProductId = null
  let jcOrderId = null
  const grnProductIds = []
  const createdGrnIds = []
  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    // ── Setup: seed products/customer via real IPC (not the feature under test) ──
    await r.step('seed-kit-components-and-customer', async () => {
      const comp1 = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 20, sellingPrice: 40, taxRate: 18, openingQuantity: 50
      }), comp1Name)
      const comp2 = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 60, sellingPrice: 120, taxRate: 18, openingQuantity: 50
      }), comp2Name)
      const kit = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 0, sellingPrice: 300, taxRate: 18, openingQuantity: 0
      }), kitName)
      const cust = await page.evaluate(async (name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}` }), customerName)
      productIds.comp1 = comp1?.data?.id
      productIds.comp2 = comp2?.data?.id
      productIds.kit = kit?.data?.id
      r.log('kit-components-and-customer-created', !!(productIds.comp1 && productIds.comp2 && productIds.kit && cust?.data?.id),
        JSON.stringify({ comp1: comp1?.error, comp2: comp2?.error, kit: kit?.error, cust: cust?.error }))
    })

    // ── Kit builder: turn the kit product into a real kit via the Products UI ──
    // (real DOM confirmed by reading ProductFormModal.tsx directly: the kit
    // section only renders in EDIT mode, is a plain checkbox with a long
    // label — not "This is a Kit" verbatim — each component row has its OWN
    // KitComponentProductPicker with placeholder "Search a product…", "Add
    // component" adds a row, and the save action is "Save Kit Components",
    // a separate save from the main product form.)
    await r.step('build-kit-via-real-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const row = page.locator('tr', { hasText: kitName })
      // MANUFACTURING business type has no KOT-toggle/variant buttons on this
      // row, so Edit (the only icon-only button with no aria-label) is first.
      await row.locator('button').first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      const kitCheckbox = modal.locator('input[type="checkbox"]').first()
      await kitCheckbox.check()
      await page.waitForTimeout(300)
      const pickers = modal.locator('input[placeholder="Search a product…"]')
      await pickers.nth(0).fill(comp1Name)
      await page.waitForTimeout(500)
      await modal.locator('button', { hasText: comp1Name }).first().click()
      await page.waitForTimeout(300)
      await modal.locator('button', { hasText: 'Add component' }).click()
      await page.waitForTimeout(300)
      await pickers.nth(1).fill(comp2Name)
      await page.waitForTimeout(500)
      await modal.locator('button', { hasText: comp2Name }).first().click()
      await page.waitForTimeout(300)
      // input[type="number"] alone also matches Cost Price/Selling Price/Tax
      // Rate/etc. from the main product form above this section — scope to
      // each kit row's own container (the only "div.flex.items-center.gap-2"
      // elements that also contain the product-picker input).
      const kitRowContainers = modal.locator('div.flex.items-center.gap-2:has(input[placeholder="Search a product…"])')
      r.log('kit-form-has-two-kit-rows', await kitRowContainers.count() === 2, `count=${await kitRowContainers.count()}`)
      await kitRowContainers.nth(0).locator('input[type="number"]').fill('2')
      await kitRowContainers.nth(1).locator('input[type="number"]').fill('1')
      await modal.locator('button', { hasText: 'Save Kit Components' }).click()
      await page.waitForTimeout(800)
      r.log('kit-builder-no-crash', !(await h.hasErrorBoundary(page)))
      await modal.locator('button[aria-label="Close"], button:has-text("Close"), button:has-text("Cancel")').first().click({ timeout: 3000 }).catch(() => {})
    })

    await r.step('kit-components-persisted', () => h.withDb((db) => {
      if (!productIds.kit) { r.log('skipped-no-kit-id', false); return }
      const row = db.prepare('SELECT * FROM Product WHERE id = ?').get(productIds.kit)
      r.log('kit-isKit-flag-set', row?.isKit === 1, JSON.stringify(row))
      const comps = db.prepare('SELECT * FROM KitComponent WHERE kitProductId = ?').all(productIds.kit)
      r.log('kit-has-two-components', comps.length === 2, JSON.stringify(comps))
    }))

    // ── Sell the kit via the real Billing UI — one clean line, real component deduction ──
    await r.step('sell-kit-via-real-ui', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill(kitName)
      await page.waitForTimeout(700)
      const productOption = page.locator('button:has-text("' + kitName + '")').first()
      r.log('kit-search-found-result', await productOption.count() > 0)
      await productOption.click()
      await page.waitForTimeout(400)
      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill(customerName)
      await page.waitForTimeout(700)
      await page.locator('button:has-text("' + customerName + '")').first().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Credit (Pay Later)', exact: true }).click()
      await page.waitForTimeout(300)
      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      r.log('kit-sale-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'kit-sale-complete')
    })

    await r.step('kit-sale-deducted-real-component-stock', () => h.withDb((db) => {
      if (!productIds.comp1 || !productIds.comp2) { r.log('skipped-no-component-ids', false); return }
      const inv1 = db.prepare('SELECT quantity FROM Inventory WHERE productId = ?').get(productIds.comp1)
      const inv2 = db.prepare('SELECT quantity FROM Inventory WHERE productId = ?').get(productIds.comp2)
      // Started at 50 each; kit line takes 2x comp1 + 1x comp2.
      r.log('component-1-stock-reduced-by-2', inv1?.quantity === 48, `qty=${inv1?.quantity}`)
      r.log('component-2-stock-reduced-by-1', inv2?.quantity === 49, `qty=${inv2?.quantity}`)
      const invItem = db.prepare(`
        SELECT ii.* FROM InvoiceItem ii JOIN "Invoice" i ON i.id = ii.invoiceId
        WHERE ii.productId = ? ORDER BY i.createdAt DESC LIMIT 1
      `).get(productIds.kit)
      r.log('invoice-shows-one-clean-kit-line', !!invItem && invItem.quantity === 1, JSON.stringify(invItem))
    }))

    // ── Locations: add a second location, transfer stock via the real UI ──
    await r.step('seed-transfer-product', async () => {
      const res = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 10, sellingPrice: 20, taxRate: 18, openingQuantity: 30
      }), transferProductName)
      transferProductId = res?.data?.id
      r.log('transfer-product-created', !!transferProductId, JSON.stringify(res?.error || ''))
    })

    await r.step('add-second-location-via-real-ui', async () => {
      await h.gotoHash(page, '#/locations')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Location' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('input').first().fill(locationName)
      await modal.locator('button', { hasText: 'Save' }).click()
      await page.waitForTimeout(800)
      r.log('location-modal-closed-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('second-location-persisted', () => h.withDb((db) => {
      const rows = db.prepare('SELECT * FROM Location ORDER BY createdAt ASC').all()
      const main = rows.find((l) => l.isDefault === 1)
      const created = rows.find((l) => l.name === locationName)
      mainLocationId = main?.id
      newLocationId = created?.id
      r.log('default-location-exists', !!main, JSON.stringify(main))
      r.log('new-location-persisted', !!created, JSON.stringify(created))
    }))

    await r.step('transfer-stock-via-real-ui', async () => {
      if (!newLocationId || !mainLocationId) { r.log('skipped-no-location-ids', false); return }
      await h.gotoHash(page, '#/locations')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'Transfer Stock' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const productSearch = modal.locator('input[placeholder*="Search" i]').first()
      await productSearch.fill(transferProductName)
      await page.waitForTimeout(500)
      await modal.locator('button', { hasText: transferProductName }).first().click()
      await page.waitForTimeout(300)
      const selects = modal.locator('select')
      r.log('transfer-form-has-two-location-selects', await selects.count() === 2, `count=${await selects.count()}`)
      await selects.nth(0).selectOption({ label: 'Main' })
      await selects.nth(1).selectOption({ label: locationName })
      const qtyInput = modal.locator('input[type="number"]').first()
      await qtyInput.fill('12')
      const selectedProductLabel = await modal.locator('input[placeholder*="Search" i]').first().inputValue()
      r.log('transfer-form-product-selected', selectedProductLabel.includes(transferProductName), `pickerValue="${selectedProductLabel}"`)
      const submitBtn = modal.locator('button', { hasText: 'Transfer Stock' }).last()
      r.log('transfer-submit-button-found', await submitBtn.count() === 1, `count=${await submitBtn.count()}`)
      r.log('transfer-submit-button-enabled', await submitBtn.isEnabled(), `disabled=${await submitBtn.isDisabled()}`)
      await h.shot(page, 'transfer-before-submit-click')
      await submitBtn.click({ force: true })
      await page.waitForTimeout(2500)
      await h.shot(page, 'transfer-after-submit-click')
      const modalStillOpen = await modal.count()
      r.log('modal-closed-after-submit', modalStillOpen === 0, `stillOpenCount=${modalStillOpen}`)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('transfer-success-toast-shown', /stock transferred/i.test(bodyText), bodyText.match(/(Could not|Select a product|Select both|Stock transferred|Transfer)[^\n]{0,60}/i)?.[0] ?? 'no toast text found')
      r.log('transfer-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('transfer-updated-both-locations-with-audit-trail', () => h.withDb((db) => {
      if (!transferProductId || !newLocationId) { r.log('skipped-no-ids', false); return }
      const stockRows = db.prepare('SELECT * FROM LocationStock WHERE productId = ?').all(transferProductId)
      const main = stockRows.find((s) => s.locationId === mainLocationId)
      const dest = stockRows.find((s) => s.locationId === newLocationId)
      r.log('main-location-reduced-by-12', main?.quantity === 18, JSON.stringify(main))
      r.log('dest-location-increased-by-12', dest?.quantity === 12, JSON.stringify(dest))
      const totalInv = db.prepare('SELECT quantity FROM Inventory WHERE productId = ?').get(transferProductId)
      r.log('aggregate-inventory-unchanged-by-transfer', totalInv?.quantity === 30, `qty=${totalInv?.quantity}`)
      const movements = db.prepare('SELECT * FROM InventoryMovement WHERE productId = ? ORDER BY createdAt DESC LIMIT 5').all(transferProductId)
      r.log('transfer-has-real-audit-trail', movements.length >= 2, `movementCount=${movements.length}`)
    }))

    // ── Landed cost: PO with 2 lines of different value, freight allocated proportionally ──
    await r.step('seed-po-supplier-and-products', async () => {
      const sup = await page.evaluate(async (name) => window.api.suppliers.create({ supplierName: name }), supplierName)
      supplierId = sup?.data?.id
      const pA = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 100, sellingPrice: 150, taxRate: 18, openingQuantity: 0
      }), poProductAName)
      const pB = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 50, sellingPrice: 80, taxRate: 18, openingQuantity: 0
      }), poProductBName)
      productIds.poA = pA?.data?.id
      productIds.poB = pB?.data?.id
      r.log('po-supplier-and-products-created', !!(supplierId && productIds.poA && productIds.poB))
    })

    await r.step('create-po-with-two-lines-via-real-api', async () => {
      // Line values: A = 10 units x ₹100 = ₹1000 (80% of order value), B = 5 x ₹50 = ₹250 (20%)
      const res = await page.evaluate(async ({ supplierId, poA, poB }) => window.api.purchaseOrders.create({
        supplierId,
        items: [
          { productId: poA, quantity: 10, unitCost: 100, taxRate: 18 },
          { productId: poB, quantity: 5, unitCost: 50, taxRate: 18 }
        ],
        isReverseCharge: false
      }), { supplierId, poA: productIds.poA, poB: productIds.poB })
      poId = res?.data?.id
      r.log('po-created', !!poId, JSON.stringify(res?.error || ''))
    })

    // NOT a modal — PurchaseOrderDetailScreen.tsx renders the "Add Landed
    // Cost" form as an inline card section (showAddLandedCost toggles a
    // <div> in the same page), confirmed by reading the component directly.
    await r.step('add-landed-cost-via-real-ui', async () => {
      if (!poId) { r.log('skipped-no-po-id', false); return }
      await h.gotoHash(page, `#/purchase-orders/${poId}`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Add Landed Cost' }).click()
      await page.waitForTimeout(400)
      const amountInput = page.locator('input[type="number"]').first()
      await amountInput.fill('1250') // ₹1000 to A (80%), ₹250 to B (20%) by value
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.waitForTimeout(800)
      r.log('landed-cost-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('landed-cost-persisted', () => h.withDb((db) => {
      if (!poId) { r.log('skipped-no-po-id', false); return }
      const row = db.prepare('SELECT * FROM LandedCostAllocation WHERE purchaseOrderId = ?').get(poId)
      r.log('landed-cost-row-exists', !!row && row.amount === 1250, JSON.stringify(row))
    }))

    await r.step('approve-and-receive-po-via-real-api', async () => {
      if (!poId) { r.log('skipped-no-po-id', false); return }
      const approveRes = await page.evaluate(async (id) => window.api.purchaseOrders.approve(id), poId)
      r.log('po-approved', !!approveRes?.success, JSON.stringify(approveRes?.error || ''))
      const receiveRes = await page.evaluate(async (id) => window.api.purchaseOrders.receive(id), poId)
      r.log('po-received', !!receiveRes?.success, JSON.stringify(receiveRes?.error || ''))
    })

    await r.step('landed-cost-genuinely-raised-recorded-unit-cost', () => h.withDb((db) => {
      if (!productIds.poA || !productIds.poB) { r.log('skipped-no-ids', false); return }
      const histA = db.prepare('SELECT * FROM ProductCostHistory WHERE productId = ? ORDER BY recordedAt DESC LIMIT 1').get(productIds.poA)
      const histB = db.prepare('SELECT * FROM ProductCostHistory WHERE productId = ? ORDER BY recordedAt DESC LIMIT 1').get(productIds.poB)
      // Base cost A=100, +₹1000 landed / 10 units = +100/unit => 200. Base B=50, +₹250/5 = +50/unit => 100.
      r.log('product-A-unit-cost-includes-landed-cost', !!histA && Math.abs(histA.unitCost - 200) < 1, JSON.stringify(histA))
      r.log('product-B-unit-cost-includes-landed-cost', !!histB && Math.abs(histB.unitCost - 100) < 1, JSON.stringify(histB))
    }))

    // ── Stock valuation method switching: STANDARD_COST override, then a
    // real FIFO newest-layers-first computation distinct from the
    // Inventory.averageCost a naive full-average would give. ──────────────
    let stdCostProductId, fifoProductId
    await r.step('standard-cost-valuation-override', async () => {
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 100, sellingPrice: 150, taxRate: 18, openingQuantity: 5,
      }), `${TEST_PREFIX} Valuation StdCost ${suffix}`)
      stdCostProductId = prodRes?.data?.id
      if (stdCostProductId) valuationProductIds.push(stdCostProductId)
      r.log('std-cost-product-created', !!stdCostProductId, JSON.stringify(prodRes?.error || ''))

      // products.update is a full-replace schema (productName/sellingPrice
      // etc. are all required, not a partial patch) -- fetch the current
      // row first and merge in the two fields under test.
      const currentRes = await page.evaluate((id) => window.api.products.get(id), stdCostProductId)
      const cur = currentRes?.data
      const updRes = await page.evaluate((p) => window.api.products.update(p), {
        id: stdCostProductId, productName: cur?.productName, productType: cur?.productType, unit: cur?.unit,
        costPrice: cur?.costPrice, sellingPrice: cur?.sellingPrice, taxRate: cur?.taxRate,
        reorderLevel: cur?.reorderLevel ?? 0, reorderQuantity: cur?.reorderQuantity ?? 0,
        valuationMethod: 'STANDARD_COST', standardCost: 250,
      })
      r.log('valuation-method-set-to-standard-cost', updRes?.data?.valuationMethod === 'STANDARD_COST', JSON.stringify(updRes?.error || ''))

      const afterRes = await page.evaluate(async () => window.api.reports.deadStockClearance({ days: 0 }))
      const afterRow = (afterRes?.data?.rows || []).find((row) => row.productName === `${TEST_PREFIX} Valuation StdCost ${suffix}`)
      // 250, NOT the 100 costPrice or whatever averageCost the opening
      // stock posted at -- proves the override genuinely takes effect,
      // not just that the field round-trips.
      r.log('standard-cost-override-reflected-in-report', !!afterRow && Math.abs(afterRow.unitCost - 250) < 0.01, JSON.stringify(afterRow))
    })

    await r.step('fifo-valuation-newest-layers-first', async () => {
      const fifoSupRes = await page.evaluate((name) => window.api.suppliers.create({ supplierName: name }), `${TEST_PREFIX} FIFO Vendor ${suffix}`)
      const fifoSupplierId = fifoSupRes?.data?.id

      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 40, sellingPrice: 100, taxRate: 0, valuationMethod: 'FIFO',
      }), `${TEST_PREFIX} Valuation FIFO ${suffix}`)
      fifoProductId = prodRes?.data?.id
      if (fifoProductId) valuationProductIds.push(fifoProductId)

      // Two purchases at different costs -- 5 units @ 50, then 5 units @ 70.
      // Bill.create only records ProductCostHistory (cost tracking for AP),
      // it deliberately does NOT touch Inventory.quantity (stock receipt is
      // a separate GRN/PO-receive flow) -- so on-hand stays 0 here and
      // must be set explicitly via a recount for the report to include it.
      await page.evaluate(({ supplierId, productId }) => window.api.bills.create({
        supplierId, items: [{ productId, quantity: 5, unitCost: 50, taxRate: 0 }],
      }), { supplierId: fifoSupplierId, productId: fifoProductId })
      await page.evaluate(({ supplierId, productId }) => window.api.bills.create({
        supplierId, items: [{ productId, quantity: 5, unitCost: 70, taxRate: 0 }],
      }), { supplierId: fifoSupplierId, productId: fifoProductId })

      await page.evaluate((pid) => window.api.inventory.adjustStock({
        productId: pid, quantity: 10, reason: 'E2E FIFO full-stock test', reasonCategory: 'RECOUNT',
      }), fifoProductId)

      // On-hand = 10 (both layers' full quantity) -- FIFO consumes BOTH
      // layers fully: (5*70 + 5*50) / 10 = 60.
      const fullRes = await page.evaluate(async () => window.api.reports.deadStockClearance({ days: 0 }))
      const fullRow = (fullRes?.data?.rows || []).find((row) => row.productName === `${TEST_PREFIX} Valuation FIFO ${suffix}`)
      r.log('fifo-full-stock-both-layers-blended-60', !!fullRow && Math.abs(fullRow.unitCost - 60) < 0.5, JSON.stringify(fullRow))

      // Recount down to 5 (simulating 5 units sold) -- FIFO now only draws
      // from the NEWEST layer (70), landing on a value the plain running
      // Inventory.averageCost (still ~60, untouched by a recount) does not.
      await page.evaluate((pid) => window.api.inventory.adjustStock({
        productId: pid, quantity: 5, reason: 'E2E FIFO layer test', reasonCategory: 'RECOUNT',
      }), fifoProductId)

      const afterRes = await page.evaluate(async () => window.api.reports.deadStockClearance({ days: 0 }))
      const afterRow = (afterRes?.data?.rows || []).find((row) => row.productName === `${TEST_PREFIX} Valuation FIFO ${suffix}`)
      r.log('fifo-recognizes-newest-layer-only-after-recount-70', !!afterRow && Math.abs(afterRow.unitCost - 70) < 0.5, JSON.stringify(afterRow))

      const invRow = h.withDb((db) => db.prepare('SELECT averageCost FROM Inventory WHERE productId = ?').get(fifoProductId))
      r.log('fifo-cost-genuinely-differs-from-plain-average', invRow && Math.abs(invRow.averageCost - 70) > 1, `averageCost=${invRow?.averageCost} fifoCost=70`)

      if (fifoSupplierId) h.withDb((db) => { try { db.prepare('DELETE FROM Supplier WHERE id = ?').run(fifoSupplierId) } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(fifoSupplierId) } })
    })

    // ── Job costing: itemized labor entries override a flat laborCost, and
    // overhead allocation applies once configured. ─────────────────────────
    await r.step('setup-bom-for-job-costing', async () => {
      const rmRes = await page.evaluate((prefix) => window.api.rawMaterials.create({
        name: `${prefix} JC Raw Material`, unit: 'KG', currentStock: 100, reorderLevel: 10, unitCost: 20,
      }), TEST_PREFIX)
      rawMaterialId = rmRes?.data?.id
      r.log('jc-raw-material-created', !!rawMaterialId, JSON.stringify(rmRes?.error || ''))

      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 80, sellingPrice: 200, taxRate: 18, openingQuantity: 0,
      }), `${TEST_PREFIX} JC Manufactured Item ${suffix}`)
      jcProductId = prodRes?.data?.id

      if (rawMaterialId && jcProductId) {
        const bomRes = await page.evaluate(({ productId, rawMaterialId }) => window.api.bom.upsert({
          productId, outputQty: 1, items: [{ rawMaterialId, quantityNeeded: 2 }],
        }), { productId: jcProductId, rawMaterialId })
        r.log('jc-bom-created', !!bomRes?.success, JSON.stringify(bomRes?.error || ''))
      }
    })

    await r.step('production-order-with-itemized-labor-overrides-flat-cost', async () => {
      if (!jcProductId) return r.log('production-order-with-itemized-labor-overrides-flat-cost', false, 'no jcProductId')
      const createRes = await page.evaluate((pid) => window.api.production.create({ productId: pid, plannedQty: 5 }), jcProductId)
      jcOrderId = createRes?.data?.id
      r.log('jc-production-order-created', !!jcOrderId, JSON.stringify(createRes?.error || ''))
      if (!jcOrderId) return

      const startRes = await page.evaluate((id) => window.api.production.start({ id }), jcOrderId)
      r.log('jc-production-order-started', !!startRes?.success, JSON.stringify(startRes?.error || ''))

      const l1 = await page.evaluate((id) => window.api.production.addLaborEntry({
        productionOrderId: id, workerName: 'E2E Worker A', hoursWorked: 4, ratePerHour: 100,
      }), jcOrderId)
      const l2 = await page.evaluate((id) => window.api.production.addLaborEntry({
        productionOrderId: id, workerName: 'E2E Worker B', hoursWorked: 2, ratePerHour: 150,
      }), jcOrderId)
      r.log('two-labor-entries-added', !!l1?.data?.id && !!l2?.data?.id, JSON.stringify({ l1: l1?.error, l2: l2?.error }))
      // 4*100 + 2*150 = 700

      // Overhead: PER_LABOR_HOUR at 50/hr, against 6 total itemized hours = 300.
      await page.evaluate(async () => window.api.businessProfile.update({ overheadAllocationBasis: 'PER_LABOR_HOUR', overheadAllocationRate: 50 }))

      // A flat laborCost is ALSO sent here, deliberately different (999) --
      // must be ignored once real itemized entries exist.
      const completeRes = await page.evaluate((id) => window.api.production.complete({ id, producedQty: 5, laborCost: 999 }), jcOrderId)
      r.log('jc-production-order-completed', !!completeRes?.success, JSON.stringify(completeRes?.error || ''))

      const orderRow = h.withDb((db) => db.prepare('SELECT laborCost, overheadCost FROM ProductionOrder WHERE id = ?').get(jcOrderId))
      r.log('itemized-labor-sum-wins-over-flat-700-not-999', orderRow && Math.abs(orderRow.laborCost - 700) < 0.01, JSON.stringify(orderRow))
      r.log('overhead-allocated-per-labor-hour-300', orderRow && Math.abs(orderRow.overheadCost - 300) < 0.01, JSON.stringify(orderRow))

      // Restore -- must not leave every future production completion in
      // this shared dev DB silently adding a 50/hr overhead charge.
      await page.evaluate(async () => window.api.businessProfile.update({ overheadAllocationBasis: null, overheadAllocationRate: 0 }))
    })

    // ── Floating/variable UoM at GRN receiving ──────────────────────────────
    await r.step('floating-uom-conversion-requires-pack-billing-enabled', async () => {
      const badRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'KG', costPrice: 10, sellingPrice: 15, taxRate: 0,
        sellByPack: false, floatingUnitConversion: true,
      }), `${TEST_PREFIX} Floating Bad ${suffix}`)
      r.log('floating-without-pack-billing-rejected', badRes?.success === false, JSON.stringify(badRes?.error))
    })

    await r.step('floating-uom-grn-uses-real-measured-quantity', async () => {
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'KG', costPrice: 10, sellingPrice: 15, taxRate: 0,
        sellByPack: true, packUnit: 'BAG', unitsPerPack: 50, floatingUnitConversion: true,
      }), `${TEST_PREFIX} Floating Rice ${suffix}`)
      const floatingProductId = prodRes?.data?.id
      if (floatingProductId) grnProductIds.push(floatingProductId)
      r.log('floating-product-created', !!floatingProductId, JSON.stringify(prodRes?.error || ''))

      const grnRes = await page.evaluate((productId) => window.api.logisticsGrn.create({
        supplierName: 'E2E Costing64 Floating Supplier',
        items: [{ productId, itemName: 'E2E Costing64 Rice Bag', receivedQty: 49.2, purchaseUnitQty: 1, unit: 'KG' }],
      }), floatingProductId)
      const grnId = grnRes?.data?.id
      if (grnId) createdGrnIds.push(grnId)
      r.log('floating-grn-created', !!grnId, JSON.stringify(grnRes?.error || ''))

      const grnDetail = await page.evaluate((id) => window.api.logisticsGrn.get(id), grnId)
      const item = (grnDetail?.data?.items || [])[0]
      // effectiveConversionFactor = receivedQty / purchaseUnitQty = 49.2/1 = 49.2
      // -- the REAL measured ratio, not the product's own nominal 50-per-bag.
      r.log('effective-conversion-factor-is-real-measured-ratio-not-nominal-50', !!item && Math.abs(item.effectiveConversionFactor - 49.2) < 0.01, JSON.stringify(item))

      const verifyRes = await page.evaluate((id) => window.api.logisticsGrn.update({ id, status: 'VERIFIED' }), grnId)
      r.log('floating-grn-verified', !!verifyRes?.success, JSON.stringify(verifyRes?.error || ''))
      const postRes = await page.evaluate((id) => window.api.logisticsGrn.post(id), grnId)
      r.log('floating-grn-posted', !!postRes?.success, JSON.stringify(postRes?.error || ''))

      const invRow = h.withDb((db) => db.prepare('SELECT quantity FROM Inventory WHERE productId = ?').get(floatingProductId))
      // Stock increases by the REAL 49.2 measured qty, not 50 (nominal
      // unitsPerPack) and not 1 (the bag count sent as purchaseUnitQty).
      r.log('stock-increases-by-real-measured-qty-not-nominal', invRow && Math.abs(invRow.quantity - 49.2) < 0.01, JSON.stringify(invRow))
    })
  } finally {
    let cleanup
    try {
      cleanup = h.withDb((db) => {
      const counts = {}
      const del = (table, where, ...args) => { try { counts[table] = (counts[table] || 0) + db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...args).changes } catch { /* table may not exist in this shape */ } }
      const allIds = [...Object.values(productIds), transferProductId].filter(Boolean)
      for (const pid of allIds) {
        del('KitComponent', 'kitProductId = ? OR componentProductId = ?', pid, pid)
        del('LocationStock', 'productId = ?', pid)
        del('InventoryMovement', 'productId = ?', pid)
        del('ProductCostHistory', 'productId = ?', pid)
        del('Inventory', 'productId = ?', pid)
      }
      const kitInv = db.prepare('SELECT id FROM "Invoice" WHERE customerId IN (SELECT id FROM Customer WHERE customerName = ?)').all(customerName)
      for (const inv of kitInv) {
        del('InvoiceItem', 'invoiceId = ?', inv.id)
        del('CustomerLedger', 'invoiceId = ?', inv.id)
        del('"Invoice"', 'id = ?', inv.id)
      }
      if (poId) {
        del('LandedCostAllocation', 'purchaseOrderId = ?', poId)
        del('PurchaseOrderItem', 'purchaseOrderId = ?', poId)
        del('"PurchaseOrder"', 'id = ?', poId)
      }
      for (const pid of allIds) {
        try { db.prepare('DELETE FROM Product WHERE id = ?').run(pid) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
      }
      if (newLocationId) del('Location', 'id = ?', newLocationId)
      const cust = db.prepare('SELECT id FROM Customer WHERE customerName = ?').get(customerName)
      if (cust) { try { db.prepare('DELETE FROM Customer WHERE id = ?').run(cust.id) } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cust.id) } }
      if (supplierId) { try { db.prepare('DELETE FROM Supplier WHERE id = ?').run(supplierId) } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(supplierId) } }

      // Phase 64 gap-closure cleanup (2026-08-27).
      db.prepare('UPDATE BusinessProfile SET overheadAllocationBasis = NULL, overheadAllocationRate = 0').run()
      for (const pid of valuationProductIds) {
        del('ProductCostHistory', 'productId = ?', pid)
        del('Inventory', 'productId = ?', pid)
        try { db.prepare('DELETE FROM Product WHERE id = ?').run(pid) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
      }
      if (jcOrderId) {
        del('ProductionLaborEntry', 'productionOrderId = ?', jcOrderId)
        del('ProductionMaterialUsage', 'productionOrderId = ?', jcOrderId)
        del('ProductionOrder', 'id = ?', jcOrderId)
      }
      if (jcProductId) {
        const bom = db.prepare('SELECT id FROM BillOfMaterial WHERE productId = ?').get(jcProductId)
        if (bom) { del('BillOfMaterialItem', 'bomId = ?', bom.id); del('BillOfMaterial', 'id = ?', bom.id) }
        del('Inventory', 'productId = ?', jcProductId)
        del('InventoryMovement', 'productId = ?', jcProductId)
        try { db.prepare('DELETE FROM Product WHERE id = ?').run(jcProductId) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(jcProductId) }
      }
      if (rawMaterialId) {
        del('RawMaterialMovement', 'rawMaterialId = ?', rawMaterialId)
        try { db.prepare('DELETE FROM RawMaterial WHERE id = ?').run(rawMaterialId) } catch { /* left in place if still referenced */ }
      }
      for (const gid of createdGrnIds) {
        del('GRNItem', 'grnId = ?', gid)
        del('GoodsReceiptNote', 'id = ?', gid)
      }
      for (const pid of grnProductIds) {
        del('InventoryMovement', 'productId = ?', pid)
        del('Inventory', 'productId = ?', pid)
        try { db.prepare('DELETE FROM Product WHERE id = ?').run(pid) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(pid) }
      }

      return counts
      })
    } catch (e) {
      cleanup = { error: String(e) }
    }
    console.log('cleanup:', JSON.stringify(cleanup))
    await h.closeApp(app)
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nINVENTORY & COSTING DEPTH (PHASE 64): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
