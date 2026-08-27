/**
 * Suite 32 — Diagnostic Lab vertical (lab_orders). Real UI-driven full
 * status lifecycle: ORDERED -> Collect Sample -> Enter Result -> Finalize
 * Report -> Mark Delivered -> Generate Invoice. See
 * project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Lab'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-diagnostic-lab', async () => {
      const sw = await h.switchBusinessType(page, 'Diagnostic & Pathology Lab')
      r.log('business-type-switched', sw.to === 'DIAGNOSTIC_LAB', JSON.stringify(sw))
    })

    let customerId

    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Lab Patient', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
    })

    await r.step('create-lab-order-via-real-ui', async () => {
      await h.gotoHash(page, '#/lab/orders')
      await page.waitForTimeout(700)
      r.log('lab-orders-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Order' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      // Patient Name is the first plain <input> (no placeholder, no htmlFor).
      await modal.locator('input').first().fill('E2E Lab Patient')
      await modal.getByLabel('Customer (optional — needed to invoice this order)').selectOption(customerId)
      await modal.getByPlaceholder('Test name').fill('E2E Complete Blood Count')
      await modal.locator('input[type="number"]').first().fill('500')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Order' }).click()
      await page.waitForTimeout(1200)
      r.log('order-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'lab-order-created')
    })

    await r.step('open-order-detail', async () => {
      const row = page.locator('button', { hasText: 'E2E Lab Patient' }).first()
      r.log('order-row-visible', await row.count() > 0)
      await row.click()
      await page.waitForTimeout(600)
      r.log('detail-modal-opens-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('collect-sample', async () => {
      await page.getByRole('button', { name: 'Collect Sample' }).click()
      await page.waitForTimeout(1000)
      r.log('sample-collected-no-crash', !(await h.hasErrorBoundary(page)))
      const badge = page.locator('text=Sample Collected')
      r.log('status-badge-shows-sample-collected', await badge.count() > 0)
    })

    await r.step('enter-result-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Enter Result' }).click()
      await page.waitForTimeout(500)

      await page.getByPlaceholder('Parameter').fill('Hemoglobin')
      await page.getByPlaceholder('Value').fill('13.5')
      await page.getByPlaceholder('Unit').fill('g/dL')
      await page.getByPlaceholder('Reference range').fill('13-17')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Save Result' }).click()
      await page.waitForTimeout(1000)
      r.log('result-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'lab-result-entered')
    })

    await r.step('finalize-and-deliver', async () => {
      const finalizeBtn = page.getByRole('button', { name: 'Finalize Report' })
      r.log('finalize-button-enabled-after-result-entered', await finalizeBtn.count() > 0)
      await finalizeBtn.click()
      await page.waitForTimeout(1000)
      r.log('finalized-no-crash', !(await h.hasErrorBoundary(page)))

      const deliverBtn = page.getByRole('button', { name: 'Mark Delivered' })
      r.log('mark-delivered-button-present-after-reported', await deliverBtn.count() > 0)
      await deliverBtn.click()
      await page.waitForTimeout(1000)
      r.log('delivered-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let orderId

    await r.step('verify-order-status-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.labTestOrders.list({}))
      const orders = listRes?.data?.orders || listRes?.data || []
      const found = orders.find((o) => o.patientName === 'E2E Lab Patient')
      orderId = found?.id
      r.log('order-status-is-delivered', found?.status === 'DELIVERED', JSON.stringify(found?.status))
    })

    await r.step('generate-invoice-via-real-ui', async () => {
      const genInvBtn = page.getByRole('button', { name: 'Generate Invoice' })
      r.log('generate-invoice-button-present', await genInvBtn.count() > 0)
      await genInvBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generation-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!orderId) return r.log('verify-invoice-via-api', false, 'no orderId captured')
      const detailRes = await page.evaluate((id) => window.api.labTestOrders.get({ id }), orderId)
      const invoiceId = detailRes?.data?.invoiceId
      r.log('order-has-invoice-id', !!invoiceId, JSON.stringify(invoiceId))
      if (invoiceId) {
        // Custom (non-catalog) test items correctly get taxRate=0 by design
        // — generateLabTestOrderInvoice() only looks up a tax rate when the
        // item has a serviceCatalogId; a free-text test has no known SAC/GST
        // treatment to apply. Expected total is the raw price, untaxed.
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        const expectedTotal = 500
        r.log('invoice-total-correct-untaxed-for-custom-test', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    // ── Phase 67 §9.1 item 23.1 gap-closure (2026-08-27) — target TAT
    // snapshot + TAT compliance report, previously untested. Needs a real
    // ServiceCatalog-linked order (targetTATHours only denormalizes onto an
    // item when serviceCatalogId is set) and real elapsed time between
    // sample collection and result -- backdate sampleCollectedAt directly
    // rather than waiting real hours. ─────────────────────────────────────
    let catalogId

    await r.step('create-service-catalog-entry-with-target-tat', async () => {
      const res = await page.evaluate(async () => window.api.serviceCatalog.create({
        serviceName: 'E2E CBC Catalog Test', basePrice: 500, targetTATHours: 24,
      }))
      catalogId = res?.data?.id
      r.log('catalog-entry-with-target-tat-created', !!catalogId && res?.data?.targetTATHours === 24, JSON.stringify(res?.error || ''))
    })

    async function createBackdatedTATOrder(patientName, hoursAgo) {
      const orderRes = await page.evaluate(({ customerId, patientName, catalogId }) => window.api.labTestOrders.create({
        customerId, patientName, items: [{ serviceCatalogId: catalogId, testName: 'E2E CBC Catalog Test', price: 500 }],
      }), { customerId, patientName, catalogId })
      const orderId = orderRes?.data?.id
      if (!orderId) return { orderId: null, itemId: null }

      const collectRes = await page.evaluate((id) => window.api.labTestOrders.markSampleCollected({ id }), orderId)
      void collectRes

      // Backdate sampleCollectedAt so the eventual result entry (right now)
      // produces a real, specific elapsed TAT -- epoch-ms, not an ISO
      // string (this project's DateTime columns store epoch-ms).
      h.withDb((db) => db.prepare('UPDATE LabTestOrder SET sampleCollectedAt = ? WHERE id = ?').run(Date.now() - hoursAgo * 3600 * 1000, orderId))

      const orderDetail = await page.evaluate((id) => window.api.labTestOrders.get({ id }), orderId)
      const itemId = orderDetail?.data?.items?.[0]?.id
      return { orderId, itemId }
    }

    let lateOrderId, onTimeOrderId

    await r.step('create-late-order-actual-tat-exceeds-target', async () => {
      if (!catalogId) return r.log('create-late-order-actual-tat-exceeds-target', false, 'no catalogId captured')
      const { orderId, itemId } = await createBackdatedTATOrder('E2E Lab TAT Late Patient', 48)
      lateOrderId = orderId
      r.log('late-order-and-item-created', !!orderId && !!itemId, JSON.stringify({ orderId, itemId }))
      if (itemId) {
        const res = await page.evaluate((itemId) => window.api.labTestOrders.updateResult({
          itemId, resultParameters: [{ parameter: 'Hemoglobin', value: '13.5', unit: 'g/dL' }],
        }), itemId)
        r.log('late-order-result-entered', !!res?.success, JSON.stringify(res?.error || ''))
      }
    })

    await r.step('create-on-time-order-actual-tat-within-target', async () => {
      if (!catalogId) return r.log('create-on-time-order-actual-tat-within-target', false, 'no catalogId captured')
      const { orderId, itemId } = await createBackdatedTATOrder('E2E Lab TAT OnTime Patient', 2)
      onTimeOrderId = orderId
      r.log('on-time-order-and-item-created', !!orderId && !!itemId, JSON.stringify({ orderId, itemId }))
      if (itemId) {
        const res = await page.evaluate((itemId) => window.api.labTestOrders.updateResult({
          itemId, resultParameters: [{ parameter: 'Hemoglobin', value: '13.2', unit: 'g/dL' }],
        }), itemId)
        r.log('on-time-order-result-entered', !!res?.success, JSON.stringify(res?.error || ''))
      }
    })

    await r.step('lab-tat-report-shows-one-late-one-on-time', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 3 * 24 * 3600000))
      const to = h.toLocalISODate(new Date(Date.now() + 1 * 24 * 3600000))
      const res = await page.evaluate(({ from, to }) => window.api.reports.labTAT({ dateFrom: from, dateTo: to }), { from, to })
      const row = (res?.data?.rows || []).find((rr) => rr.testName === 'E2E CBC Catalog Test')
      r.log('tat-report-includes-our-test', !!row, JSON.stringify(row))
      r.log('tat-report-target-hours-snapshotted-correctly', row?.targetTATHours === 24, JSON.stringify(row?.targetTATHours))
      r.log('tat-report-shows-exactly-one-late-one-on-time', row?.onTimeCount === 1 && row?.lateCount === 1, JSON.stringify({ onTime: row?.onTimeCount, late: row?.lateCount }))
      r.log('tat-report-on-time-percent-is-50', row?.onTimePercent === 50, JSON.stringify(row?.onTimePercent))
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const ids = db.prepare("SELECT id FROM LabTestOrder WHERE patientName LIKE 'E2E Lab%'").all().map((r2) => r2.id)
      for (const id of ids) {
        try { db.prepare('DELETE FROM LabTestOrderItem WHERE labTestOrderId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LabTestOrder WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const catalogIds = db.prepare("SELECT id FROM ServiceCatalog WHERE serviceName LIKE 'E2E CBC%'").all().map((r2) => r2.id)
      for (const id of catalogIds) { try { db.prepare('DELETE FROM ServiceCatalog WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: labOrders', ids.length, 'serviceCatalog', catalogIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDIAGNOSTIC LAB VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
