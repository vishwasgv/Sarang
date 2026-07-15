/**
 * Suite 38 — Tailor Boutique vertical (tailoring_orders). Real UI-driven
 * order creation with a priced garment, status ladder advance
 * (RECEIVED -> IN_CUTTING -> IN_STITCHING -> TRIAL_SCHEDULED -> READY, 4
 * clicks since STATUS_NEXT skips ALTERATIONS), and invoicing (SAC 998821,
 * 5% GST). See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Tailor'

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
