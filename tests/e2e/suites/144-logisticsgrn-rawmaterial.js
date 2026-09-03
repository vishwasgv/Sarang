/**
 * Suite 144 — Section C medium CRUD gap: logisticsGrn.reverse/delete
 * (create/update/post/list/get already covered via real UI + API, suite
 * 03/65) + raw-material.handler.ts (update/delete/adjustStock/movements/
 * listBatches/receiveBatch — create/list already covered, but this whole
 * lifecycle was NEVER driven via real UI before, only ever called
 * directly via API as test setup).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Log144'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let productId
    const widgetName = `${TEST_PREFIX} Widget ${suffix}`
    await r.step('create-standard-product-for-grn', async () => {
      const res = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 0,
      }), widgetName)
      productId = res?.data?.id
      r.log('product-created', !!productId, JSON.stringify(res?.error || ''))
    })

    let grnId
    await r.step('create-verify-post-reverse-grn-via-ui', async () => {
      await h.gotoHash(page, '#/logistics/grn')
      await page.waitForTimeout(700)
      r.log('grn-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("+ New GRN")').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.locator('label', { hasText: 'Supplier Name *' }).locator('xpath=following-sibling::input').fill(`${TEST_PREFIX} Supplier`)
      await modal.locator('select').nth(2).selectOption({ label: widgetName })
      await page.waitForTimeout(300)
      await modal.getByPlaceholder('Rcvd').fill('20')
      await modal.getByPlaceholder('Cost (₹)').fill('50')
      await modal.locator('button:has-text("Create GRN")').click()
      await page.waitForTimeout(1300)
      r.log('grn-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.logisticsGrn.list({}))
      const items = listRes?.data?.items || listRes?.data?.grns || listRes?.data || []
      const created = Array.isArray(items) ? items.find((g) => g.supplierName === `${TEST_PREFIX} Supplier`) : null
      grnId = created?.id
      r.log('grn-findable-via-api', !!grnId, JSON.stringify({ grnId, status: created?.status }))
      if (!grnId) return

      await page.evaluate(async (id) => window.api.logisticsGrn.update({ id, status: 'VERIFIED' }), grnId)
      await page.evaluate(async (id) => window.api.logisticsGrn.post(id), grnId)

      const invBefore = await page.evaluate(async (pid) => window.api.inventory.get(pid), productId)
      r.log('inventory-reflects-post', invBefore?.data?.quantity === 20, `quantity=${invBefore?.data?.quantity}`)

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/logistics/grn')
      await page.waitForTimeout(700)

      const row = page.locator('div', { hasText: `${TEST_PREFIX} Supplier` }).filter({ has: page.getByRole('button', { name: 'Reverse' }) }).last()
      await row.getByRole('button', { name: 'Reverse' }).click()
      await page.waitForTimeout(400)
      await h.topModal(page).getByRole('button', { name: 'Reverse', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('reverse-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.logisticsGrn.get(id), grnId)
      r.log('grn-actually-reversed', getRes?.data?.status === 'REVERSED', JSON.stringify(getRes?.data?.status))

      const invAfter = await page.evaluate(async (pid) => window.api.inventory.get(pid), productId)
      r.log('inventory-decremented-after-reverse', invAfter?.data?.quantity === 0, `quantity=${invAfter?.data?.quantity}`)
    })

    await r.step('delete-draft-grn-via-ui', async () => {
      const createRes = await page.evaluate((name) => window.api.logisticsGrn.create({
        supplierName: name, items: [{ itemName: 'Loose miscellaneous item', receivedQty: 1 }],
      }), `${TEST_PREFIX} Draft Supplier`)
      const draftId = createRes?.data?.id
      r.log('draft-grn-seeded', !!draftId, JSON.stringify(createRes?.error || ''))
      if (!draftId) return

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/logistics/grn')
      await page.waitForTimeout(700)

      const row = page.locator('div', { hasText: `${TEST_PREFIX} Draft Supplier` }).filter({ has: page.getByRole('button', { name: 'Delete' }) }).last()
      await row.getByRole('button', { name: 'Delete' }).click()
      await page.waitForTimeout(400)
      await h.topModal(page).getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-draft-grn-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.logisticsGrn.list({}))
      const items = listRes?.data?.items || listRes?.data?.grns || listRes?.data || []
      r.log('draft-grn-actually-deleted', !(Array.isArray(items) ? items : []).some((g) => g.id === draftId), JSON.stringify(items?.length))
    })

    let rawMaterialId
    const materialName = `${TEST_PREFIX} Flour`
    await r.step('create-and-update-raw-material-via-ui', async () => {
      await h.gotoHash(page, '#/manufacturing/raw-materials')
      await page.waitForTimeout(700)
      r.log('raw-materials-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Material' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. Wheat Flour').fill(materialName)
      await modal.locator('input[type="number"]').nth(0).fill('50')
      await modal.locator('input[type="number"]').nth(1).fill('10')
      await modal.locator('input[type="number"]').nth(2).fill('25')
      await modal.getByRole('button', { name: 'Add Material', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('material-created-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate(async () => window.api.rawMaterials.list({}))
      let found = (listRes?.data?.materials || []).find((m) => m.name === materialName)
      rawMaterialId = found?.id
      r.log('material-persisted', !!rawMaterialId && found?.currentStock === 50, JSON.stringify(found))
      if (!rawMaterialId) return

      const row = page.locator('tr', { hasText: materialName }).first()
      await row.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.waitForTimeout(400)
      const editModal = h.topModal(page)
      // Unlike create, the edit form hides the opening-stock field
      // entirely, shifting reorderLevel to be the FIRST number input, not
      // the second.
      await editModal.locator('input[type="number"]').nth(0).fill('30')
      await editModal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(900)
      r.log('material-update-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate(async () => window.api.rawMaterials.list({}))
      found = (listRes?.data?.materials || []).find((m) => m.id === rawMaterialId)
      r.log('material-actually-updated', found?.reorderLevel === 30, JSON.stringify(found))
    })

    await r.step('adjust-stock-via-ui', async () => {
      if (!rawMaterialId) return r.log('adjust-stock-via-ui', false, 'no rawMaterialId')
      const row = page.locator('tr', { hasText: materialName }).first()
      await row.getByRole('button', { name: 'Adjust Stock' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Enter quantity').fill('15')
      await modal.getByRole('button', { name: 'Update Stock' }).click()
      await page.waitForTimeout(900)
      r.log('adjust-stock-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.rawMaterials.list({}))
      const found = (listRes?.data?.materials || []).find((m) => m.id === rawMaterialId)
      // PURCHASE (default selected type) adds to current stock: 50 + 15 = 65.
      r.log('stock-actually-adjusted', found?.currentStock === 65, JSON.stringify(found))
    })

    await r.step('view-movement-history-via-ui', async () => {
      if (!rawMaterialId) return r.log('view-movement-history-via-ui', false, 'no rawMaterialId')
      const row = page.locator('tr', { hasText: materialName }).first()
      await row.getByRole('button', { name: 'Movement History' }).click()
      await page.waitForTimeout(700)
      r.log('movement-history-no-crash', !(await h.hasErrorBoundary(page)))
      const modal = h.topModal(page)
      const bodyText = await modal.innerText().catch(() => '')
      r.log('movement-history-shows-purchase-entry', bodyText.includes('Purchase') || bodyText.includes('15'), bodyText.slice(0, 300))
      await modal.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(300)
    })

    await r.step('receive-batch-via-ui', async () => {
      if (!rawMaterialId) return r.log('receive-batch-via-ui', false, 'no rawMaterialId')
      const row = page.locator('tr', { hasText: materialName }).first()
      await row.getByRole('button', { name: 'Receive Lot' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const batchNumber = `${TEST_PREFIX}-LOT-1`
      await modal.getByPlaceholder('e.g. LOT-2026-01').fill(batchNumber)
      // Not a bare getByPlaceholder('0') -- substring matching (Playwright's
      // default) also matches the batchNumber field's own placeholder
      // "e.g. LOT-2026-01", which contains the character "0".
      await modal.getByPlaceholder('0', { exact: true }).fill('20')
      await modal.getByRole('button', { name: 'Receive Lot', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('receive-batch-no-crash', !(await h.hasErrorBoundary(page)))

      // batchNumber is normalized to uppercase server-side.
      const batchRes = await page.evaluate((id) => window.api.rawMaterials.listBatches({ rawMaterialId: id }), rawMaterialId)
      const found = (batchRes?.data || []).find((b) => b.batchNumber === batchNumber.toUpperCase())
      r.log('batch-actually-received', !!found && found.quantityReceived === 20, JSON.stringify(found))

      await modal.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(300)
    })

    let deletableMaterialId
    await r.step('delete-unused-raw-material-via-ui', async () => {
      const deletableName = `${TEST_PREFIX} Unused Sugar`
      const seedRes = await page.evaluate((name) => window.api.rawMaterials.create({
        name, unit: 'kg', currentStock: 5, reorderLevel: 1, unitCost: 40,
      }), deletableName)
      deletableMaterialId = seedRes?.data?.id
      r.log('deletable-material-seeded', !!deletableMaterialId, JSON.stringify(seedRes?.error || ''))
      if (!deletableMaterialId) return

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/manufacturing/raw-materials')
      await page.waitForTimeout(700)

      const row = page.locator('tr', { hasText: deletableName }).first()
      await row.getByRole('button', { name: 'Remove' }).click()
      await page.waitForTimeout(400)
      await h.topModal(page).getByRole('button', { name: 'Remove', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-material-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.rawMaterials.list({}))
      const found = (listRes?.data?.materials || []).find((m) => m.id === deletableMaterialId)
      r.log('material-actually-soft-deleted', found === undefined, JSON.stringify(found))
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let grns = 0, materials = 0, batches = 0, movements = 0, prods = 0
      const grnIds = db.prepare(`SELECT id FROM GoodsReceiptNote WHERE supplierName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const gid of grnIds) {
        try { db.prepare('DELETE FROM GoodsReceiptNoteItem WHERE grnId = ?').run(gid) } catch { /* noop */ }
        try { grns += db.prepare('DELETE FROM GoodsReceiptNote WHERE id = ?').run(gid).changes } catch { /* noop */ }
      }
      const matIds = db.prepare(`SELECT id FROM RawMaterial WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const mid of matIds) {
        try { batches += db.prepare('DELETE FROM RawMaterialBatch WHERE rawMaterialId = ?').run(mid).changes } catch { /* noop */ }
        try { movements += db.prepare('DELETE FROM RawMaterialMovement WHERE rawMaterialId = ?').run(mid).changes } catch { /* noop */ }
        try { materials += db.prepare('DELETE FROM RawMaterial WHERE id = ?').run(mid).changes } catch { /* noop */ }
      }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        // A GRN post (real or reversed) writes a ProductCostHistory row too
        // -- a FIFTH satellite table beyond the three the shared cleanup
        // gotcha already documents, easy to miss for a suite with its own
        // hand-rolled cleanup like this one.
        db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ grns, materials, batches, movements, prods }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLOGISTICS GRN / RAW MATERIAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
