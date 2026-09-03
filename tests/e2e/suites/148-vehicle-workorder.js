/**
 * Suite 148 — Section C medium CRUD gap: vehicle.delete (updateStatus
 * already closed a prior batch, real product bug fixed there too) +
 * workOrders.upsert/updateStatus/logDowntime (list/listDowntime/
 * bottleneckFlag already covered via API, suites 70/93; the Work Steps
 * panel itself had never been driven via real UI before). Manufacturing
 * vertical for workOrders, generic (no business-type gate) for vehicle.
 * vehicle.delete has NO UI trigger anywhere in the renderer (confirmed
 * via grep) -- a real product gap (no way to remove a vehicle from the
 * fleet, only change its status) -- covered API-only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E VWO148'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let vehicleId
    const regNumber = `${TEST_PREFIX}-${suffix}`
    await r.step('delete-vehicle-api-only-no-ui-trigger', async () => {
      const res = await page.evaluate((reg) => window.api.vehicle.create({
        registrationNumber: reg, vehicleType: 'SEDAN', seatingCapacity: 4,
      }), regNumber)
      vehicleId = res?.data?.id
      r.log('vehicle-created', !!vehicleId, JSON.stringify(res?.error || ''))
      if (!vehicleId) return

      const delRes = await page.evaluate((id) => window.api.vehicle.delete({ id }), vehicleId)
      r.log('vehicle-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      const listRes = await page.evaluate(async () => window.api.vehicle.list())
      r.log('vehicle-actually-deleted', !(listRes?.data || []).some((v) => v.id === vehicleId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('switch-to-manufacturing', async () => {
      const sw = await h.switchBusinessType(page, 'Manufacturing')
      r.log('business-type-switched', sw.to === 'MANUFACTURING', JSON.stringify(sw))
    })

    let productId, productName
    await r.step('seed-product-and-bom-to-manufacture', async () => {
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
      r.log('order-persisted', !!orderId && order?.status === 'DRAFT', JSON.stringify(order))
    })

    await r.step('add-work-steps-via-ui', async () => {
      if (!orderId) return r.log('add-work-steps-via-ui', false, 'no orderId')
      await page.locator('span.font-mono', { hasText: orderNumber }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.locator('button', { hasText: '+ Add Steps' }).click()
      await page.waitForTimeout(400)
      const editor = h.topModal(page)
      const step1Name = `${TEST_PREFIX} Cut`
      const step2Name = `${TEST_PREFIX} Inspect`
      const rows = editor.locator('input[type="text"]')
      await rows.nth(0).fill(step1Name)
      await editor.locator('button', { hasText: '+ Add Step' }).click()
      await page.waitForTimeout(200)
      await editor.locator('input[type="text"]').nth(2).fill(step2Name)
      await editor.locator('input[type="checkbox"]').last().check()
      await page.waitForTimeout(200)
      await editor.getByRole('button', { name: 'Save Steps' }).click()
      await page.waitForTimeout(1000)
      r.log('save-steps-no-crash', !(await h.hasErrorBoundary(page)))

      const woRes = await page.evaluate((id) => window.api.workOrders.list({ productionOrderId: id }), orderId)
      const steps = woRes?.data || []
      const step1 = steps.find((s) => s.taskName === step1Name)
      const step2 = steps.find((s) => s.taskName === step2Name)
      r.log('steps-actually-saved', !!step1 && !!step2 && step2?.isQcStep === true, JSON.stringify(steps))
    })

    let step1Id
    await r.step('toggle-work-order-status-via-ui', async () => {
      if (!orderId) return r.log('toggle-work-order-status-via-ui', false, 'no orderId')
      const woRes = await page.evaluate((id) => window.api.workOrders.list({ productionOrderId: id }), orderId)
      const step1 = (woRes?.data || []).find((s) => s.taskName === `${TEST_PREFIX} Cut`)
      step1Id = step1?.id
      if (!step1Id) return r.log('toggle-work-order-status-via-ui', false, 'no step1Id')

      // Scoped to the row's own specific class combo, not a broad `div` +
      // hasText -- every ancestor up to the modal itself also "has" both
      // the text and the toggle button as descendants.
      const modal = h.topModal(page)
      const stepRow = modal.locator('div.flex.items-center.gap-3.p-3.rounded-xl.border.border-border.bg-surface', { hasText: `${TEST_PREFIX} Cut` }).first()
      await stepRow.locator('button.w-5.h-5').click()
      await page.waitForTimeout(900)
      r.log('toggle-status-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((id) => window.api.workOrders.list({ productionOrderId: id }), orderId)
      const afterStep1 = (afterRes?.data || []).find((s) => s.id === step1Id)
      r.log('work-order-status-actually-toggled', afterStep1?.status === 'DONE', JSON.stringify(afterStep1))
    })

    await r.step('start-production-and-log-downtime-via-ui', async () => {
      if (!orderId || !step1Id) return r.log('start-production-and-log-downtime-via-ui', false, 'missing prerequisites')
      const modal = h.topModal(page)
      await modal.locator('button', { hasText: 'Start Production' }).click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Start Production', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('start-no-crash', !(await h.hasErrorBoundary(page)))

      const orderRes = await page.evaluate((id) => window.api.production.get({ id }), orderId)
      r.log('order-status-in-progress', orderRes?.data?.status === 'IN_PROGRESS', JSON.stringify(orderRes?.data?.status))

      const freshModal = h.topModal(page)
      const stepRow = freshModal.locator('div.flex.items-center.gap-3.p-3.rounded-xl.border.border-border.bg-surface', { hasText: `${TEST_PREFIX} Cut` }).first()
      await stepRow.getByRole('button', { name: '+ Downtime' }).click()
      await page.waitForTimeout(400)
      const dtModal = h.topModal(page)
      await dtModal.getByPlaceholder('e.g. Machine breakdown, material shortage').fill(`${TEST_PREFIX} Power outage`)
      const minutesInput = dtModal.locator('input[type="number"]')
      await minutesInput.fill('25')
      await page.waitForTimeout(200)
      await dtModal.getByRole('button', { name: 'Log Downtime' }).click()
      await page.waitForTimeout(1000)
      r.log('log-downtime-no-crash', !(await h.hasErrorBoundary(page)))

      const dtRes = await page.evaluate((id) => window.api.workOrders.listDowntime({ workOrderId: id }), step1Id)
      const found = (dtRes?.data || []).find((d) => d.reason === `${TEST_PREFIX} Power outage`)
      r.log('downtime-actually-logged', !!found && found.minutes === 25, JSON.stringify(found))
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
      let downtime = 0, workOrders = 0, laborEntries = 0, orders = 0, prods = 0, rawMats = 0
      const orderIds = db.prepare(`SELECT id FROM ProductionOrder WHERE orderNumber IS NOT NULL AND productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')`).all().map((row) => row.id)
      for (const oid of orderIds) {
        const woIds = db.prepare('SELECT id FROM WorkOrder WHERE productionOrderId = ?').all(oid).map((row) => row.id)
        for (const wid of woIds) { try { downtime += db.prepare('DELETE FROM WorkOrderDowntimeEntry WHERE workOrderId = ?').run(wid).changes } catch { /* noop */ } }
        try { workOrders += db.prepare('DELETE FROM WorkOrder WHERE productionOrderId = ?').run(oid).changes } catch { /* noop */ }
        try { laborEntries += db.prepare('DELETE FROM ProductionLaborEntry WHERE productionOrderId = ?').run(oid).changes } catch { /* noop */ }
        try { orders += db.prepare('DELETE FROM ProductionOrder WHERE id = ?').run(oid).changes } catch { /* noop */ }
      }
      try { db.prepare(`DELETE FROM BillOfMaterialItem WHERE bomId IN (SELECT id FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'))`).run() } catch { /* noop */ }
      try { db.prepare(`DELETE FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')`).run() } catch { /* noop */ }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      const rmIds = db.prepare(`SELECT id FROM RawMaterial WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const rid of rmIds) {
        db.prepare('DELETE FROM RawMaterialMovement WHERE rawMaterialId = ?').run(rid)
        db.prepare('DELETE FROM RawMaterialBatch WHERE rawMaterialId = ?').run(rid)
        try { rawMats += db.prepare('DELETE FROM RawMaterial WHERE id = ?').run(rid).changes } catch { /* noop */ }
      }
      try { db.prepare(`DELETE FROM Vehicle WHERE registrationNumber LIKE '${TEST_PREFIX}%'`).run() } catch { /* noop */ }
      console.log('extra cleanup:', JSON.stringify({ downtime, workOrders, laborEntries, orders, prods, rawMats }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nVEHICLE / WORK ORDER: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
