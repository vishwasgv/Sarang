/**
 * Suite 3 — Logistics & manufacturing (Section 2.2 item 3). GRN lifecycle
 * (create ad-hoc → verify → post, confirming inventory actually updates),
 * and a Production Order lifecycle (raw material + BOM setup → create →
 * start → complete, confirming raw material stock is consumed).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Log'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let productId

    await r.step('create-standard-product-for-grn', async () => {
      const res = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} GRN Widget`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 0,
      }), TEST_PREFIX)
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    let grnId, grnNumber

    await r.step('create-verify-post-grn', async () => {
      await h.gotoHash(page, '#/logistics/grn')
      await page.waitForTimeout(700)
      r.log('grn-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("+ New GRN")').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      // The "Supplier Name *" <label> is a plain sibling of its <input>,
      // not htmlFor-linked — getByLabel doesn't find it. Locate via the
      // label's own text, then its following-sibling input.
      await modal.locator('label', { hasText: 'Supplier Name *' }).locator('xpath=following-sibling::input').fill(`${TEST_PREFIX} Supplier`)

      // The form's items array already starts with one empty row by
      // default (useState([{...EMPTY_ITEM}])) — no need to click "+ Add
      // Item" (that would add a SECOND, unwanted row).
      // Select order in the modal: [0]=Link to PO, [1]=Supplier, [2]=this
      // pre-existing item row's product select, [3]=its unit select —
      // targeting via nth(2), not a fragile hasText filter (a <select>
      // doesn't expose its <option> text to a `has-text` match the way it
      // does for buttons/divs).
      await modal.locator('select').nth(2).selectOption({ label: `${TEST_PREFIX} GRN Widget` })
      await page.waitForTimeout(300)
      await modal.getByPlaceholder('Rcvd').fill('20')
      await modal.getByPlaceholder('Cost (₹)').fill('50')

      await modal.locator('button:has-text("Create GRN")').click()
      await page.waitForTimeout(1300)
      r.log('grn-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'grn-created')

      const listRes = await page.evaluate(async () => window.api.logisticsGrn.list({}))
      const items = listRes?.data?.items || listRes?.data?.grns || listRes?.data || []
      const created = Array.isArray(items) ? items.find((g) => g.supplierName === `${TEST_PREFIX} Supplier`) : null
      grnId = created?.id
      grnNumber = created?.grnNumber
      r.log('grn-findable-via-api', !!grnId, JSON.stringify({ grnId, grnNumber, status: created?.status }))

      if (grnId) {
        const verifyRes = await page.evaluate(async (id) => window.api.logisticsGrn.update({ id, status: 'VERIFIED' }), grnId)
        r.log('grn-verified', !!verifyRes?.success, JSON.stringify(verifyRes?.error || ''))

        const postRes = await page.evaluate(async (id) => window.api.logisticsGrn.post(id), grnId)
        r.log('grn-posted', !!postRes?.success, JSON.stringify(postRes?.error || ''))
      }
    })

    await r.step('verify-inventory-updated-after-post', async () => {
      if (!productId) return r.log('verify-inventory-updated-after-post', false, 'no productId captured')
      const invRes = await page.evaluate(async (pid) => window.api.inventory.get(pid), productId).catch(() => null)
      const productRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.quantity ?? productRes?.data?.inventory?.quantity
      r.log('inventory-quantity-reflects-grn-receipt', qty === 20, `quantity=${qty}`)
    })

    let rawMaterialId, manufacturedProductId

    await r.step('setup-bom-for-production-order', async () => {
      const rmRes = await page.evaluate(async (prefix) => window.api.rawMaterials.create({
        name: `${prefix} Raw Material`, unit: 'KG', currentStock: 100, reorderLevel: 10, unitCost: 20,
      }), TEST_PREFIX)
      r.log('raw-material-created', !!rmRes?.success, JSON.stringify(rmRes?.error || ''))
      rawMaterialId = rmRes?.data?.id

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Manufactured Item`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 80, sellingPrice: 150, taxRate: 18, openingQuantity: 0,
      }), TEST_PREFIX)
      r.log('manufactured-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
      manufacturedProductId = prodRes?.data?.id

      if (rawMaterialId && manufacturedProductId) {
        const bomRes = await page.evaluate(async ({ productId, rawMaterialId }) => window.api.bom.upsert({
          productId, outputQty: 1, items: [{ rawMaterialId, quantityNeeded: 2 }],
        }), { productId: manufacturedProductId, rawMaterialId })
        r.log('bom-created', !!bomRes?.success, JSON.stringify(bomRes?.error || ''))
      }
    })

    let orderId

    await r.step('create-start-complete-production-order', async () => {
      await h.gotoHash(page, '#/manufacturing/production')
      await page.waitForTimeout(700)
      r.log('production-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("New Production Order")').first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search product by name or SKU…').fill(`${TEST_PREFIX} Manufactured Item`)
      await page.waitForTimeout(700)
      const productOption = modal.locator('button', { hasText: `${TEST_PREFIX} Manufactured Item` }).first()
      r.log('product-search-found-in-production-modal', await productOption.count() > 0)
      if (await productOption.count()) await productOption.click()
      await page.waitForTimeout(300)
      await modal.getByPlaceholder('Enter units to produce').fill('5')
      await modal.locator('button:has-text("New Production Order")').last().click()
      await page.waitForTimeout(1300)
      r.log('production-order-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.production.list({}))
      const orders = listRes?.data?.orders || []
      const created = Array.isArray(orders) ? orders.find((o) => o.productId === manufacturedProductId) : null
      orderId = created?.id
      r.log('production-order-findable-via-api', !!orderId, JSON.stringify({ orderId, status: created?.status }))

      if (orderId) {
        const startRes = await page.evaluate(async (id) => window.api.production.start({ id }), orderId)
        r.log('production-order-started', !!startRes?.success, JSON.stringify(startRes?.error || ''))

        const completeRes = await page.evaluate(async (id) => window.api.production.complete({ id, producedQty: 5 }), orderId)
        r.log('production-order-completed', !!completeRes?.success, JSON.stringify(completeRes?.error || ''))
      }
    })

    await r.step('verify-raw-material-consumed', async () => {
      if (!rawMaterialId) return r.log('verify-raw-material-consumed', false, 'no rawMaterialId captured')
      const rmListRes = await page.evaluate(async () => window.api.rawMaterials.list({})).catch(() => null)
      const rmItems = rmListRes?.data?.materials || []
      const rm = Array.isArray(rmItems) ? rmItems.find((m) => m.id === rawMaterialId) : null
      const stock = rm?.currentStock
      // 100 initial - (2 per unit * 5 produced) = 90
      r.log('raw-material-stock-reduced-by-production', stock === 90, `currentStock=${stock}`)
    })

    await r.step('logistics-analytics-renders', async () => {
      await h.gotoHash(page, '#/logistics/analytics')
      await page.waitForTimeout(800)
      r.log('logistics-analytics-loads-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'logistics-analytics')
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const grnIds = db.prepare(`SELECT id FROM GoodsReceiptNote WHERE supplierName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const gid of grnIds) {
        db.prepare('DELETE FROM GRNItem WHERE grnId = ?').run(gid)
        try { db.prepare('DELETE FROM GoodsReceiptNote WHERE id = ?').run(gid) } catch { /* leave it */ }
      }
      const rmIds = db.prepare(`SELECT id FROM RawMaterial WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      const orderIds = db.prepare(`SELECT id FROM ProductionOrder WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')`).all().map((row) => row.id)
      for (const oid of orderIds) {
        try { db.prepare('DELETE FROM ProductionOrder WHERE id = ?').run(oid) } catch { /* leave it */ }
      }
      db.prepare(`DELETE FROM BillOfMaterialItem WHERE bomId IN (SELECT id FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'))`).run()
      db.prepare(`DELETE FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')`).run()
      for (const rid of rmIds) {
        try { db.prepare('DELETE FROM RawMaterial WHERE id = ?').run(rid) } catch { db.prepare('UPDATE RawMaterial SET isActive = 0 WHERE id = ?').run(rid) }
      }
      console.log('logistics/mfg cleanup:', JSON.stringify({ grns: grnIds.length, rawMaterials: rmIds.length, orders: orderIds.length }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLOGISTICS & MANUFACTURING: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
