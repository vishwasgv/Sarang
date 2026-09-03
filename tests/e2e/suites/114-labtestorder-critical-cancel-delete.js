/**
 * Suite 114 — labTestOrders.cancel/delete/acknowledgeCritical (broader-gap-
 * list Section C, money-critical, 2026-09-03). create/markSampleCollected/
 * updateResult/finalizeReport/markDelivered/generateInvoice are already
 * covered (suite 32). update/addItem/removeItem have NO UI trigger anywhere
 * in the renderer -- only the create form's local item list uses them
 * (via the create payload itself, not these post-creation channels) --
 * covered here via direct API.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E LabCrit'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-diagnostic-lab', async () => {
      const sw = await h.switchBusinessType(page, 'Diagnostic & Pathology Lab')
      r.log('business-type-switched', sw.to === 'DIAGNOSTIC_LAB', JSON.stringify(sw))
    })

    async function createOrderViaUi(patientName) {
      await h.gotoHash(page, '#/lab/orders')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'New Order' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.locator('input').first().fill(patientName)
      await modal.getByPlaceholder('Test name').fill(`${TEST_PREFIX} Test`)
      await modal.locator('input[type="number"]').first().fill('400')
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Create Order' }).click()
      await page.waitForTimeout(1200)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate(() => window.api.labTestOrders.list({}))
      const orders = listRes?.data?.orders || listRes?.data || []
      const order = orders.find((o) => o.patientName === patientName)
      return { id: order?.id, noCrash, order }
    }

    async function openDetail(patientName) {
      await page.locator('button', { hasText: patientName }).first().click()
      await page.waitForTimeout(500)
      return h.topModal(page)
    }

    // ── Order A: critical result -> acknowledge ──────────────────────────────
    const patientA = `${TEST_PREFIX} Patient A ${suffix}`
    let orderAId
    await r.step('order-A-create-collect-enter-critical-result', async () => {
      const res = await createOrderViaUi(patientA)
      orderAId = res.id
      r.log('order-A-created-no-crash', res.noCrash)
      r.log('order-A-persisted', !!orderAId, JSON.stringify(res.order))
      if (!orderAId) return

      let modal = await openDetail(patientA)
      await modal.getByRole('button', { name: 'Collect Sample' }).click()
      await page.waitForTimeout(1000)

      modal = h.topModal(page)
      await modal.locator('button', { hasText: 'Enter Result' }).click()
      await page.waitForTimeout(400)
      await modal.getByPlaceholder('Parameter').fill('Potassium')
      await modal.getByPlaceholder('Value').fill('7.2')
      await modal.getByPlaceholder('Unit').fill('mmol/L')
      await modal.getByPlaceholder('Reference range').fill('3.5-5.0')
      await modal.locator('select').first().selectOption('CRITICAL')
      await modal.locator('button', { hasText: 'Save Result' }).click()
      await page.waitForTimeout(1000)
      r.log('critical-result-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const detailRes = await page.evaluate((id) => window.api.labTestOrders.get({ id }), orderAId)
      const item = (detailRes?.data?.items || [])[0]
      r.log('item-flagged-critical', item?.hasCriticalResult === true, JSON.stringify(item))
    })

    await r.step('order-A-acknowledge-critical-via-ui', async () => {
      if (!orderAId) return r.log('order-A-acknowledge-critical-via-ui', false, 'no orderAId')
      const modal = h.topModal(page)
      await modal.locator('button', { hasText: 'Record Doctor Notified' }).click()
      await page.waitForTimeout(300)
      await modal.locator('textarea').first().fill(`${TEST_PREFIX} Dr. Rao called and advised immediate dialysis referral`)
      await modal.locator('button', { hasText: 'Confirm Doctor Notified' }).click()
      await page.waitForTimeout(1000)
      r.log('acknowledge-no-crash', !(await h.hasErrorBoundary(page)))

      const detailRes = await page.evaluate((id) => window.api.labTestOrders.get({ id }), orderAId)
      const item = (detailRes?.data?.items || [])[0]
      r.log('critical-result-acknowledged', !!item?.criticalNotifiedAt, JSON.stringify(item))

      // Detail modal doesn't auto-close after this action -- close explicitly
      // so it doesn't obscure the header's "New Order" button for order B.
      await modal.locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(400)
    })

    // ── Order B: cancel ───────────────────────────────────────────────────────
    const patientB = `${TEST_PREFIX} Patient B ${suffix}`
    let orderBId
    await r.step('order-B-create-and-cancel-via-ui', async () => {
      const res = await createOrderViaUi(patientB)
      orderBId = res.id
      r.log('order-B-created-no-crash', res.noCrash)
      r.log('order-B-persisted', !!orderBId, JSON.stringify(res.order))
      if (!orderBId) return

      const modal = await openDetail(patientB)
      await modal.locator('button', { hasText: 'Cancel Order' }).click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Cancel Order', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('cancel-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.labTestOrders.list({}))
      const orders = listRes?.data?.orders || listRes?.data || []
      const order = orders.find((o) => o.id === orderBId)
      r.log('order-B-status-cancelled', order?.status === 'CANCELLED', JSON.stringify(order))

      // handleCancel refreshes the still-open detail modal rather than
      // closing it -- close explicitly before order C's create step.
      await h.topModal(page).locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(400)
    })

    // ── Order C: delete ────────────────────────────────────────────────────────
    const patientC = `${TEST_PREFIX} Patient C ${suffix}`
    let orderCId
    await r.step('order-C-create-and-delete-via-ui', async () => {
      const res = await createOrderViaUi(patientC)
      orderCId = res.id
      r.log('order-C-created-no-crash', res.noCrash)
      r.log('order-C-persisted', !!orderCId, JSON.stringify(res.order))
      if (!orderCId) return

      const modal = await openDetail(patientC)
      await modal.locator('button', { hasText: 'Delete Order' }).click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.labTestOrders.list({}))
      const orders = listRes?.data?.orders || listRes?.data || []
      r.log('order-C-actually-gone', !orders.some((o) => o.id === orderCId))
    })

    // ── update/addItem/removeItem: no UI trigger anywhere -- API-only ────────
    let orderDId
    await r.step('order-D-update-addItem-removeItem-via-api', async () => {
      const orderRes = await page.evaluate(async (name) => window.api.labTestOrders.create({
        patientName: name, items: [{ testName: `${name} Initial Test`, price: 300 }],
      }), `${TEST_PREFIX} Patient D ${suffix}`)
      orderDId = orderRes?.data?.id
      r.log('order-D-created-via-api', !!orderDId, JSON.stringify(orderRes?.error || ''))
      if (!orderDId) return

      const updRes = await page.evaluate((id) => window.api.labTestOrders.update({ id, referringNotes: 'E2E referring doctor note' }), orderDId)
      r.log('order-D-update-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))
      const afterUpdate = await page.evaluate((id) => window.api.labTestOrders.get({ id }), orderDId)
      r.log('order-D-update-persisted', afterUpdate?.data?.referringNotes === 'E2E referring doctor note', JSON.stringify(afterUpdate?.data?.referringNotes))

      const secondTestName = `${TEST_PREFIX} Second Test`
      const addRes = await page.evaluate(({ id, testName }) => window.api.labTestOrders.addItem({
        labTestOrderId: id, testName, price: 150,
      }), { id: orderDId, testName: secondTestName })
      r.log('order-D-addItem-succeeds', !!addRes?.success, JSON.stringify(addRes?.error || ''))

      const afterAdd = await page.evaluate((id) => window.api.labTestOrders.get({ id }), orderDId)
      const items = afterAdd?.data?.items || []
      r.log('order-D-item-added', items.length === 2 && items.some((i) => i.testName === secondTestName), JSON.stringify(items.map((i) => i.testName)))

      const addedItem = items.find((i) => i.testName === secondTestName)
      if (addedItem) {
        const remRes = await page.evaluate((itemId) => window.api.labTestOrders.removeItem({ itemId }), addedItem.id)
        r.log('order-D-removeItem-succeeds', !!remRes?.success, JSON.stringify(remRes?.error || ''))
        const afterRemove = await page.evaluate((id) => window.api.labTestOrders.get({ id }), orderDId)
        r.log('order-D-item-actually-removed', (afterRemove?.data?.items || []).length === 1, JSON.stringify(afterRemove?.data?.items?.map((i) => i.testName)))
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'DIAGNOSTIC_LAB') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const ids = db.prepare(`SELECT id FROM LabTestOrder WHERE patientName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let items = 0, orders = 0
      for (const id of ids) {
        try { items += db.prepare('DELETE FROM LabTestOrderItem WHERE labTestOrderId = ?').run(id).changes } catch { /* noop */ }
        try { orders += db.prepare('DELETE FROM LabTestOrder WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ orders, items }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nLAB TEST ORDER CRITICAL/CANCEL/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
