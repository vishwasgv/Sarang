/**
 * Suite 14 — Pharmacy vertical (batch_tracking, expiry_tracking), the first
 * of the ~27 verticals identified during the 2026-07-15 "final testing pass"
 * as having only generic smoke coverage. Real UI-driven batch creation via
 * BatchManagementScreen, expiry-alert surfacing, and the expired-batch
 * sale-block guard (BATCH-004) — see project memory
 * project_final_testing_pass_2026_07_15.md for the full vertical-gap list
 * and the "one vertical at a time" testing convention this file follows.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Pharm'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-pharmacy', async () => {
      const sw = await h.switchBusinessType(page, 'Pharmacy')
      r.log('business-type-switched-to-pharmacy', sw.to === 'PHARMACY', JSON.stringify(sw))
    })

    let productId

    await r.step('create-pharmacy-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Pharm Paracetamol 500mg',
        unit: 'PCS',
        sellingPrice: 20,
        costPrice: 10,
        taxRate: 12,
        productType: 'STANDARD',
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    let batchId

    await r.step('add-batch-via-real-ui', async () => {
      await h.gotoHash(page, '#/pharmacy/batches')
      await page.waitForTimeout(700)
      r.log('batch-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Batch' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const prodSearch = modal.getByPlaceholder('Search product by name or SKU…')
      await prodSearch.fill('E2E Pharm Paracetamol')
      await page.waitForTimeout(700)
      const prodOption = modal.locator('button', { hasText: 'E2E Pharm Paracetamol' }).first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(300)

      // Playwright's getByPlaceholder does substring matching by default —
      // "e.g. BT-2026-001" contains "0", so an unscoped getByPlaceholder('0')
      // ambiguously matches the Batch Number field too (and matches it FIRST
      // in DOM order, silently overwriting it instead of the real Quantity
      // field). Use exact matching to target Quantity unambiguously.
      await modal.getByPlaceholder('e.g. BT-2026-001').fill('E2E-BATCH-001')
      await modal.getByPlaceholder('0', { exact: true }).fill('50')

      const expiry = h.toLocalISODate(new Date(Date.now() + 90 * 24 * 3600000))
      const dateInputs = modal.locator('input[type="date"]')
      await dateInputs.first().fill(expiry)
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Batch' }).click()
      await page.waitForTimeout(1200)
      r.log('batch-added-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'pharmacy-batch-added')

      const listRes = await page.evaluate(async (pid) => window.api.batches.list({ productId: pid }), productId)
      const items = listRes?.data?.batches || []
      const created = items.find((b) => b.batchNumber === 'E2E-BATCH-001')
      batchId = created?.id
      r.log('batch-created-and-findable-via-api', !!batchId, JSON.stringify({ quantityReceived: created?.quantityReceived, expiryDate: created?.expiryDate }))
    })

    await r.step('inventory-incremented-by-batch-receipt', async () => {
      if (!productId) return r.log('inventory-incremented-by-batch-receipt', false, 'no productId')
      const invRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.inventory?.quantity
      r.log('inventory-quantity-matches-batch-receipt', qty === 50, `quantity=${qty}`)
    })

    let expiredBatchId

    await r.step('expired-batch-sale-blocked', async () => {
      // Create a second batch that's already expired, then attempt to sell
      // past the non-expired batch's stock so FIFO is forced to draw from it.
      const expiredDate = h.toLocalISODate(new Date(Date.now() - 5 * 24 * 3600000))
      const expiredRes = await page.evaluate(async ({ productId, expiredDate }) => window.api.batches.create({
        productId, batchNumber: 'E2E-BATCH-EXPIRED', expiryDate: expiredDate, quantityReceived: 10,
      }), { productId, expiredDate })
      r.log('expired-batch-created', !!expiredRes?.success, JSON.stringify(expiredRes?.error || ''))
      expiredBatchId = expiredRes?.data?.id

      // Sell more than the good batch's 50 units so FIFO must reach into the expired one.
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Pharm Buyer', phone: `7${String(Date.now()).slice(-9)}`,
      }))
      const customerId = custRes?.data?.id

      const saleRes = await page.evaluate(async ({ productId, customerId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH',
        items: [{ productId, quantity: 55, unitPrice: 20, taxRate: 12 }],
      }), { productId, customerId })
      r.log('oversell-into-expired-batch-correctly-rejected', saleRes?.success === false, JSON.stringify(saleRes?.error || saleRes))
    })

    await r.step('normal-sale-within-good-batch-succeeds', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Pharm Buyer 2', phone: `6${String(Date.now()).slice(-9)}`,
      }))
      const customerId = custRes?.data?.id
      const saleRes = await page.evaluate(async ({ productId, customerId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH',
        items: [{ productId, quantity: 5, unitPrice: 20, taxRate: 12 }],
      }), { productId, customerId })
      r.log('sale-within-good-batch-stock-succeeds', !!saleRes?.success, JSON.stringify(saleRes?.error || ''))
    })

    await r.step('expiry-alerts-surface-both-batches', async () => {
      const alertRes = await page.evaluate(async () => window.api.batches.expiryAlerts({ withinDays: 120 }))
      const expiring = alertRes?.data?.expiring || []
      const expired = alertRes?.data?.expired || []
      r.log('good-batch-in-expiring-list', expiring.some((b) => b.batchNumber === 'E2E-BATCH-001'), `expiringCount=${expiring.length}`)
      r.log('expired-batch-in-expired-list', expired.some((b) => b.batchNumber === 'E2E-BATCH-EXPIRED'), `expiredCount=${expired.length}`)
    })

    await r.step('batch-expiry-report-renders', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, div', { hasText: 'Batch & Expiry Report' }).first()
      r.log('batch-expiry-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('batch-expiry-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PHARMACY') {
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
      const batchIds = db.prepare("SELECT id FROM ProductBatch WHERE batchNumber LIKE 'E2E-BATCH%'").all().map((r2) => r2.id)
      for (const bid of batchIds) {
        try { db.prepare('DELETE FROM ProductBatch WHERE id = ?').run(bid) } catch { /* leave it, harmless test row */ }
      }
      console.log('extra cleanup: batches', batchIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPHARMACY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
