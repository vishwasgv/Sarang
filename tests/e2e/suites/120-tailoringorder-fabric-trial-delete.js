/**
 * Suite 120 — tailoringOrder.delete/scheduleTrialAppointment/setFabric/
 * clearFabric (broader-gap-list Section C, money-critical, 2026-09-03).
 * create/update(status ladder)/generateInvoice are ALREADY covered via real
 * UI (suite 38) -- confirmed a FALSE POSITIVE for those. setFabric only has
 * a UI trigger when the order's "Fabric Supplied By" is SHOP (a create-form
 * field, defaults to CLIENT).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Tailor120'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-tailor-boutique', async () => {
      const sw = await h.switchBusinessType(page, 'Tailor / Boutique')
      r.log('business-type-switched', sw.to === 'TAILOR_BOUTIQUE', JSON.stringify(sw))
    })

    let fabricProductId, fabricProductName
    await r.step('seed-fabric-product', async () => {
      fabricProductName = `${TEST_PREFIX} Silk Fabric ${suffix}`
      const prodRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', sellingPrice: 300, unit: 'MTR', openingQuantity: 50,
      }), fabricProductName)
      fabricProductId = prodRes?.data?.id
      r.log('fabric-product-created', !!fabricProductId, JSON.stringify(prodRes?.error || ''))
    })

    async function createOrderViaUi(clientName, fabricSupplied) {
      await h.gotoHash(page, '#/tailor/orders')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'New Order' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search by name or phone...').fill(clientName)
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill(clientName)
        await modal.getByPlaceholder('Phone *').fill(`9${String(Date.now()).slice(-9)}`)
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }
      await modal.getByLabel('Garment Type').selectOption('SUIT')
      await modal.getByPlaceholder('0.00').fill('3000')
      if (fabricSupplied) await modal.getByLabel('Fabric Supplied By').selectOption(fabricSupplied)
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Create Order' }).click()
      await page.waitForTimeout(1200)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate(async () => window.api.tailoringOrder.list({}))
      const orders = listRes?.data || []
      const order = orders.find((o) => o.client?.customerName === clientName)
      return { id: order?.id, noCrash, order }
    }

    // ── Order A: setFabric -> clearFabric -> scheduleTrialAppointment ───────
    const clientA = `${TEST_PREFIX} Client A ${suffix}`
    let orderAId
    await r.step('order-A-create-with-shop-fabric-via-ui', async () => {
      const res = await createOrderViaUi(clientA, 'SHOP')
      orderAId = res.id
      r.log('order-A-created-no-crash', res.noCrash)
      r.log('order-A-persisted-shop-fabric', !!orderAId && res.order?.fabricSupplied === 'SHOP', JSON.stringify(res.order))
    })

    await r.step('order-A-set-fabric-via-ui', async () => {
      if (!orderAId) return r.log('order-A-set-fabric-via-ui', false, 'no orderAId')
      const row = page.locator('tr', { hasText: clientA }).first()
      const setFabricBtn = row.locator('button', { hasText: 'Set Fabric' })
      r.log('set-fabric-button-present', await setFabricBtn.count() > 0)
      await setFabricBtn.click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder(/Search/).fill(fabricProductName)
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: fabricProductName }).first().click()
      await page.waitForTimeout(300)
      await modal.locator('input[type="number"]').fill('3.5')
      await modal.locator('button', { hasText: 'Set Fabric' }).click()
      await page.waitForTimeout(1000)
      r.log('set-fabric-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tailoringOrder.list({}))
      const found = (listRes?.data || []).find((o) => o.id === orderAId)
      r.log('fabric-actually-set', found?.fabricProductId === fabricProductId && Number(found?.fabricQuantity) === 3.5, JSON.stringify(found))
    })

    await r.step('order-A-clear-fabric-via-ui', async () => {
      if (!orderAId) return r.log('order-A-clear-fabric-via-ui', false, 'no orderAId')
      const row = page.locator('tr', { hasText: clientA }).first()
      await row.locator('button[title="Clear fabric link (restores stock)"]').click()
      await page.waitForTimeout(1000)
      r.log('clear-fabric-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tailoringOrder.list({}))
      const found = (listRes?.data || []).find((o) => o.id === orderAId)
      r.log('fabric-actually-cleared', !found?.fabricProductId, JSON.stringify(found))
    })

    await r.step('order-A-schedule-trial-via-ui', async () => {
      if (!orderAId) return r.log('order-A-schedule-trial-via-ui', false, 'no orderAId')
      const row = page.locator('tr', { hasText: clientA }).first()
      const trialBtn = row.locator('button', { hasText: 'Schedule Trial' })
      r.log('schedule-trial-button-present', await trialBtn.count() > 0)
      await trialBtn.click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      const future = h.toLocalISODate(new Date(Date.now() + 3 * 24 * 3600000))
      await modal.locator('input[type="date"]').fill(future)
      await modal.locator('button', { hasText: 'Schedule', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('schedule-trial-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tailoringOrder.list({}))
      const found = (listRes?.data || []).find((o) => o.id === orderAId)
      r.log('trial-appointment-linked', !!found?.trialAppointmentId, JSON.stringify(found))
    })

    // ── Order B: delete ───────────────────────────────────────────────────────
    const clientB = `${TEST_PREFIX} Client B ${suffix}`
    let orderBId
    await r.step('order-B-create-and-delete-via-ui', async () => {
      const res = await createOrderViaUi(clientB, null)
      orderBId = res.id
      r.log('order-B-created-no-crash', res.noCrash)
      r.log('order-B-persisted', !!orderBId, JSON.stringify(res.order))
      if (!orderBId) return

      const row = page.locator('tr', { hasText: clientB }).first()
      await row.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.tailoringOrder.list({}))
      r.log('order-B-actually-gone', !(listRes?.data || []).some((o) => o.id === orderBId))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'TAILOR_BOUTIQUE') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      // scheduleTrialAppointment creates a real Appointment row too -- delete
      // it (and the order) BEFORE the customer, or the FK/name-based lookup
      // below would find nothing once the customer row is already gone.
      let orders = 0, custs = 0, appts = 0
      for (const cid of custIds) {
        try { appts += db.prepare('DELETE FROM Appointment WHERE customerId = ?').run(cid).changes } catch { /* noop */ }
        try { orders += db.prepare('DELETE FROM TailoringOrder WHERE clientId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let prods = 0
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ orders, custs, prods, appts }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTAILORING ORDER FABRIC/TRIAL/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
