/**
 * Suite 124 — production.cancel/addLaborEntry/removeLaborEntry (broader-
 * gap-list Section C, money-critical, 2026-09-03). create/start/complete/
 * addLaborEntry were already exercised via API in suites 03/65/70, but the
 * whole ProductionOrdersScreen.tsx had never been driven via real UI --
 * this suite does the first full click-through, closing cancel/
 * removeLaborEntry (the two genuinely uncovered channels) along the way.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Production'

// Labor-entry fields are bare <label>+<input> siblings (no htmlFor), so
// getByLabel silently fails -- same convention as suite 101/117.
async function fillByLabel(scope, labelText, value) {
  await scope.locator('label', { hasText: labelText }).first().locator('xpath=following-sibling::*[self::input or self::textarea][1]').fill(value)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-manufacturing', async () => {
      const sw = await h.switchBusinessType(page, 'Manufacturing')
      r.log('business-type-switched', sw.to === 'MANUFACTURING', JSON.stringify(sw))
    })

    let productId, productName
    await r.step('seed-product-and-bom-to-manufacture', async () => {
      // createProductionOrder rejects with PO-004 unless the product has a
      // real, active BOM configured -- discovered live via a silent create
      // failure (the modal's own error toast wasn't checked closely enough
      // at first).
      const rmRes = await page.evaluate(async (name) => window.api.rawMaterials.create({
        name, unit: 'KG', currentStock: 500, reorderLevel: 10, unitCost: 20,
      }), `${TEST_PREFIX} Raw Material ${suffix}`)
      const rawMaterialId = rmRes?.data?.id
      r.log('raw-material-created', !!rawMaterialId, JSON.stringify(rmRes?.error || ''))

      productName = `${TEST_PREFIX} Widget ${suffix}`
      const prodRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', sellingPrice: 500, unit: 'NOS', openingQuantity: 0,
      }), productName)
      productId = prodRes?.data?.id
      r.log('product-created', !!productId, JSON.stringify(prodRes?.error || ''))

      if (rawMaterialId && productId) {
        const bomRes = await page.evaluate(({ pid, rid }) => window.api.bom.upsert({
          productId: pid, outputQty: 1, items: [{ rawMaterialId: rid, quantityNeeded: 2 }],
        }), { pid: productId, rid: rawMaterialId })
        r.log('bom-created', !!bomRes?.success, JSON.stringify(bomRes?.error || ''))
      }
    })

    let orderId, orderNumber
    await r.step('create-production-order-via-ui', async () => {
      await h.gotoHash(page, '#/manufacturing/production')
      await page.waitForTimeout(700)
      r.log('production-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Production Order' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder(/Search product/).fill(productName)
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: productName }).first().click()
      await page.waitForTimeout(300)
      await modal.getByPlaceholder(/units to produce/i).fill('10')
      await page.waitForTimeout(300)
      await modal.locator('button', { hasText: 'New Production Order' }).click()
      await page.waitForTimeout(1200)
      r.log('order-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.production.list({}))
      const orders = listRes?.data?.orders || []
      const order = orders.find((o) => o.productId === productId)
      orderId = order?.id
      orderNumber = order?.orderNumber
      r.log('order-persisted', !!orderId && order?.status === 'DRAFT' && Number(order?.plannedQty) === 10, JSON.stringify(order))
    })

    let laborEntryId
    await r.step('add-and-remove-labor-entry-via-ui', async () => {
      if (!orderId) return r.log('add-and-remove-labor-entry-via-ui', false, 'no orderId')
      await page.locator('span.font-mono', { hasText: orderNumber }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.locator('button', { hasText: '+ Add Labor Entry' }).click()
      await page.waitForTimeout(300)
      await fillByLabel(modal, 'Worker Name', `${TEST_PREFIX} Worker`)
      await fillByLabel(modal, 'Hours', '4')
      await fillByLabel(modal, 'Rate/Hour', '150')
      // A bare "Add" button also exists elsewhere in this modal (work-order
      // steps) -- scope to the labor form's own grid-cols-4 row.
      await modal.locator('div.grid.grid-cols-4 button', { hasText: 'Add', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('add-labor-no-crash', !(await h.hasErrorBoundary(page)))

      let orderRes = await page.evaluate((id) => window.api.production.get({ id }), orderId)
      let entries = orderRes?.data?.laborEntries || []
      const entry = entries.find((e) => e.workerName === `${TEST_PREFIX} Worker`)
      laborEntryId = entry?.id
      r.log('labor-entry-added', !!laborEntryId && Number(entry?.hoursWorked) === 4 && Number(entry?.amount) === 600, JSON.stringify(entry))

      if (laborEntryId) {
        const freshModal = h.topModal(page)
        await freshModal.locator('button', { hasText: 'Remove' }).click()
        await page.waitForTimeout(1000)
        r.log('remove-labor-no-crash', !(await h.hasErrorBoundary(page)))

        orderRes = await page.evaluate((id) => window.api.production.get({ id }), orderId)
        entries = orderRes?.data?.laborEntries || []
        r.log('labor-entry-actually-removed', !entries.some((e) => e.id === laborEntryId), JSON.stringify(entries))
      }
    })

    await r.step('start-production-via-ui', async () => {
      if (!orderId) return r.log('start-production-via-ui', false, 'no orderId')
      const modal = h.topModal(page)
      await modal.locator('button', { hasText: 'Start Production' }).click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Start Production', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('start-no-crash', !(await h.hasErrorBoundary(page)))

      const orderRes = await page.evaluate((id) => window.api.production.get({ id }), orderId)
      r.log('order-status-in-progress', orderRes?.data?.status === 'IN_PROGRESS', JSON.stringify(orderRes?.data?.status))
    })

    await r.step('cancel-production-order-via-ui', async () => {
      if (!orderId) return r.log('cancel-production-order-via-ui', false, 'no orderId')
      const modal = h.topModal(page)
      await modal.locator('button', { hasText: 'Cancel' }).last().click()
      await page.waitForTimeout(500)
      const cancelModal = h.topModal(page)
      await cancelModal.getByPlaceholder(/[Ww]hy/).fill(`${TEST_PREFIX} test cancellation`)
      await cancelModal.locator('button', { hasText: 'Cancel Order' }).click()
      await page.waitForTimeout(1200)
      r.log('cancel-no-crash', !(await h.hasErrorBoundary(page)))

      const orderRes = await page.evaluate((id) => window.api.production.get({ id }), orderId)
      r.log('order-status-cancelled', orderRes?.data?.status === 'CANCELLED', JSON.stringify(orderRes?.data))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'MANUFACTURING') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const orderIds = db.prepare(`SELECT po.id FROM ProductionOrder po JOIN Product p ON p.id = po.productId WHERE p.productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let labor = 0, orders = 0
      for (const oid of orderIds) {
        try { labor += db.prepare('DELETE FROM ProductionLaborEntry WHERE productionOrderId = ?').run(oid).changes } catch { /* noop */ }
        try { orders += db.prepare('DELETE FROM ProductionOrder WHERE id = ?').run(oid).changes } catch { /* noop */ }
      }
      // Product deletion cascades BillOfMaterial + BillOfMaterialItem, which
      // clears the RawMaterial's only referencing row -- delete Product
      // BEFORE RawMaterial, or RawMaterial's delete hits a live FK.
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let prods = 0
      for (const pid of prodIds) {
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      const rawIds = db.prepare(`SELECT id FROM RawMaterial WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let raws = 0
      for (const rid of rawIds) {
        db.prepare('DELETE FROM RawMaterialMovement WHERE rawMaterialId = ?').run(rid)
        try { raws += db.prepare('DELETE FROM RawMaterial WHERE id = ?').run(rid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ orders, labor, prods, raws }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPRODUCTION CANCEL/LABOR: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
