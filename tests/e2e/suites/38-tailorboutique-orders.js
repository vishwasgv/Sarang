/**
 * Suite 38 — Tailor Boutique vertical (tailoring_orders). Real UI-driven
 * order creation with a priced garment, status ladder advance
 * (RECEIVED -> IN_CUTTING -> IN_STITCHING -> TRIAL_SCHEDULED -> READY, 4
 * clicks since STATUS_NEXT skips ALTERATIONS), and invoicing (SAC 998821,
 * 5% GST). See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Tailor'

// Phase 68 §9.1 — Tailor/Boutique items 2/3/4 report-tile render sweep.
async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange, expectNonEmpty, emptyStateText } = {}) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileId}-tile-present`, present)
  if (!present) return
  await tile.click()
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000)))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
  if (expectNonEmpty && emptyStateText) {
    const bodyText = await page.locator('body').innerText().catch(() => '')
    r.log(`${tileId}-shows-real-data`, !bodyText.includes(emptyStateText), 'expected our seeded data to flow through, not the empty-state message')
  }
  await h.shot(page, `report-${tileId}`)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-tailor-boutique', async () => {
      const sw = await h.switchBusinessType(page, 'Tailor / Boutique')
      r.log('business-type-switched', sw.to === 'TAILOR_BOUTIQUE', JSON.stringify(sw))
    })

    await r.step('create-order-via-real-ui', async () => {
      await h.gotoHash(page, '#/tailor/orders')
      await page.waitForTimeout(700)
      r.log('tailor-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Order' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Tailor Client')
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E Tailor Client')
        await modal.getByPlaceholder('Phone *').fill('9876500038')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      await modal.getByLabel('Garment Type').selectOption('SUIT')
      // "Unit Price" is a hand-rolled <label> (no htmlFor) unlike the
      // Select atom fields above — getByLabel doesn't reach it. Target via
      // its "0.00" placeholder instead (the only such field in this modal).
      await modal.getByPlaceholder('0.00').fill('4000')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Order' }).click()
      await page.waitForTimeout(1200)
      r.log('order-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'tailor-order-created')
    })

    let orderId

    await r.step('verify-order-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.tailoringOrder.list({}))
      const orders = listRes?.data || []
      const found = orders.find((o) => o.client?.customerName === 'E2E Tailor Client')
      orderId = found?.id
      r.log('order-findable-via-api', !!orderId, JSON.stringify({ status: found?.status, totalAmount: found?.totalAmount }))
    })

    await r.step('advance-status-to-ready-via-real-ui', async () => {
      // RECEIVED -> IN_CUTTING -> IN_STITCHING -> TRIAL_SCHEDULED -> READY
      // (4 clicks; STATUS_NEXT sends TRIAL_SCHEDULED straight to READY,
      // skipping ALTERATIONS, per the source).
      for (let i = 0; i < 4; i++) {
        const advanceBtn = page.locator('button', { hasText: '→' })
        if (await advanceBtn.count() === 0) break
        await advanceBtn.first().click()
        await page.waitForTimeout(800)
      }
      const res = await page.evaluate((id) => window.api.tailoringOrder.get(id), orderId)
      r.log('order-reached-ready', res?.data?.status === 'READY', JSON.stringify(res?.data?.status))
    })

    await r.step('generate-invoice-via-real-ui', async () => {
      const genBtn = page.getByRole('button', { name: 'Invoice' })
      r.log('invoice-button-present-at-ready', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!orderId) return r.log('verify-invoice-via-api', false, 'no orderId captured')
      const res = await page.evaluate((id) => window.api.tailoringOrder.get(id), orderId)
      const invoiceId = res?.data?.invoiceId
      r.log('order-has-invoice-id', !!invoiceId, JSON.stringify(invoiceId))
      if (invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        const expectedTotal = 4000 * 1.05
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('create-fitting-stage-and-delivered-orders-for-remaining-reports', async () => {
      // The primary order above advances straight to READY (STATUS_NEXT
      // skips ALTERATIONS) so it can never sit at TRIAL_SCHEDULED, and it's
      // never DELIVERED -- both needed states for two of the three
      // remaining report tiles. Build them directly via API.
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Tailor Fitting Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      const fittingClientId = custRes?.data?.id
      r.log('fitting-client-created', !!fittingClientId, JSON.stringify(custRes?.error || ''))

      if (fittingClientId) {
        const fitRes = await page.evaluate((cid) => window.api.tailoringOrder.create({
          clientId: cid, garmentType: 'BLOUSE', unitPrice: 1500,
        }), fittingClientId)
        const fittingOrderId = fitRes?.data?.id
        r.log('fitting-order-created', !!fittingOrderId, JSON.stringify(fitRes?.error || ''))
        if (fittingOrderId) {
          const upd = await page.evaluate((id) => window.api.tailoringOrder.update({ id, status: 'TRIAL_SCHEDULED' }), fittingOrderId)
          r.log('fitting-order-at-trial-scheduled', upd?.data?.status === 'TRIAL_SCHEDULED', JSON.stringify(upd?.error || ''))
        }

        const delRes = await page.evaluate((cid) => window.api.tailoringOrder.create({
          clientId: cid, garmentType: 'SAREE_BLOUSE', unitPrice: 3000, fabricDescription: 'E2E Silk Brocade',
        }), fittingClientId)
        const deliveredOrderId = delRes?.data?.id
        r.log('delivered-order-created', !!deliveredOrderId, JSON.stringify(delRes?.error || ''))
        if (deliveredOrderId) {
          const today = h.toLocalISODate(new Date())
          const upd = await page.evaluate(({ id, today }) => window.api.tailoringOrder.update({ id, status: 'DELIVERED', deliveredDate: today }), { id: deliveredOrderId, today })
          r.log('order-marked-delivered', upd?.data?.status === 'DELIVERED', JSON.stringify(upd?.error || ''))
        }
      }
    })

    await r.step('order-turnaround-report', () => checkReportTile(page, r, 'orderTurnaround', 'Order Turnaround Time', {
      needsDateRange: true, expectNonEmpty: true, emptyStateText: 'No orders delivered in this date range.',
    }))

    await r.step('order-turnaround-shows-our-delivered-order-via-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000))
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.orderTurnaround({ dateFrom: from, dateTo: to }), { from, to })
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.customerName === 'E2E Tailor Fitting Client')
      r.log('turnaround-report-includes-delivered-order', !!found, JSON.stringify(found))
    })

    await r.step('fitting-stage-tracker-report', () => checkReportTile(page, r, 'fittingStageTracker', 'Fitting-Stage Tracker', {
      needsDateRange: false, expectNonEmpty: true, emptyStateText: 'No orders currently at Trial or Alterations.',
    }))

    await r.step('fitting-stage-tracker-shows-our-order-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.fittingStageTracker())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.customerName === 'E2E Tailor Fitting Client' && row.status === 'TRIAL_SCHEDULED')
      r.log('fitting-tracker-includes-our-order', !!found, JSON.stringify(found))
    })

    await r.step('fabric-popularity-report', () => checkReportTile(page, r, 'fabricPopularity', 'Fabric / Design Popularity', {
      needsDateRange: true, expectNonEmpty: true, emptyStateText: 'No orders with a fabric/design noted in this date range.',
    }))

    await r.step('fabric-popularity-shows-our-fabric-via-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000))
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.fabricPopularity({ dateFrom: from, dateTo: to }), { from, to })
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.fabricDescription === 'E2E Silk Brocade')
      r.log('fabric-popularity-includes-our-fabric', !!found, JSON.stringify(found))
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const ids = db.prepare("SELECT to2.id AS id FROM TailoringOrder to2 JOIN Customer c ON c.id = to2.clientId WHERE c.customerName LIKE 'E2E Tailor%'").all().map((r2) => r2.id)
      for (const id of ids) { try { db.prepare('DELETE FROM TailoringOrder WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: orders', ids.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTAILOR BOUTIQUE VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
