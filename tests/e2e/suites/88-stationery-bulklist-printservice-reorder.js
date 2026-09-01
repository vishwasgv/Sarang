/**
 * Suite 88 — Stationery vertical (Phase 69). Zero prior E2E coverage
 * existed for this vertical before this suite. Covers a bulk-list order
 * driven through the real UI (create → match → bill in one shot), the
 * print/copy service quick-add on Billing, the Annual Reorder Reminder
 * wow feature, and both new report tiles.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Stat'

async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange } = {}) {
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
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 400 * 24 * 3600000)))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
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

    await r.step('switch-to-stationery', async () => {
      const sw = await h.switchBusinessType(page, 'Stationery / Book Store')
      r.log('business-type-switched', sw.to === 'STATIONERY', JSON.stringify(sw))
    })

    let notebookId, customerId

    await r.step('create-product-and-institution-customer', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Stat Notebook 200pg', unit: 'PCS', sellingPrice: 50, costPrice: 30, taxRate: 12,
        productType: 'STANDARD', openingQuantity: 500,
      }))
      notebookId = prodRes?.data?.id
      r.log('product-created', !!notebookId, JSON.stringify(prodRes?.error || ''))

      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Stat DPS School', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('institution-customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    let orderId

    await r.step('create-bulk-list-order-via-real-ui', async () => {
      await h.gotoHash(page, '#/stationery/bulk-orders')
      await page.waitForTimeout(700)
      r.log('bulk-list-orders-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("New Order")').click()
      await page.waitForTimeout(400)
      // Pick the real Customer record (not the free-text institution-name
      // field) — billing in CREDIT below requires a real customerId.
      await page.getByPlaceholder('Search by name or phone...').fill('E2E Stat DPS School')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Stat DPS School' }).first().click()
      await page.waitForTimeout(300)
      await page.getByPlaceholder('e.g. Grade 5 Booklist 2026-27').fill('E2E Stat Grade 5 Booklist')
      await page.getByPlaceholder('e.g. Notebook 200pg — 5 units').fill('Notebook 200pg')
      const qtyInputs = page.locator('input[type="number"]')
      await qtyInputs.first().fill('10')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('bulk-list-order-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.bulkListOrder.list({}))
      const found = (listRes?.data || []).find((o) => o.listName === 'E2E Stat Grade 5 Booklist')
      orderId = found?.id
      r.log('order-findable-via-api', !!orderId, JSON.stringify(found?.items?.length))
    })

    let matchedItemId

    await r.step('match-order-line-to-product-via-api', async () => {
      if (!orderId) return
      const orderRes = await page.evaluate(async (id) => window.api.bulkListOrder.list({}).then((res) => (res?.data || []).find((o) => o.id === id)), orderId)
      matchedItemId = orderRes?.items?.[0]?.id
      r.log('order-has-one-line', !!matchedItemId, JSON.stringify(orderRes?.items))
      if (!matchedItemId) return
      const matchRes = await page.evaluate(({ itemId, prodId }) => window.api.bulkListOrder.matchItem({ itemId, productId: prodId, unitPrice: 50 }), { itemId: matchedItemId, prodId: notebookId })
      r.log('item-matched', !!matchRes?.success, JSON.stringify(matchRes?.error || ''))
    })

    let billedInvoiceId

    await r.step('bill-order-in-one-shot-via-api', async () => {
      if (!orderId) return
      const billRes = await page.evaluate((id) => window.api.bulkListOrder.bill({ orderId: id, paymentMethod: 'CREDIT' }), orderId)
      r.log('order-billed', !!billRes?.success, JSON.stringify(billRes?.error || ''))
      billedInvoiceId = billRes?.data?.invoiceId
      if (billedInvoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), billedInvoiceId)
        r.log('invoice-total-matches-10x50', Math.abs((invRes?.data?.subtotal ?? 0) - 500) < 1, JSON.stringify(invRes?.data?.subtotal))
      }
    })

    await r.step('print-copy-service-quick-add-on-billing', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const serviceBtn = page.locator('button:has-text("Add Print / Copy Service")')
      r.log('print-copy-quick-add-button-present', await serviceBtn.count() > 0)
      if (await serviceBtn.count() === 0) return
      await serviceBtn.click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const numberInputs = modal.locator('input[type="number"]')
      await numberInputs.nth(0).fill('5') // quantity
      await numberInputs.nth(1).fill('2') // price/unit
      await modal.locator('button:has-text("Add to Cart")').click()
      await page.waitForTimeout(500)
      r.log('service-line-added-no-crash', !(await h.hasErrorBoundary(page)))
      const cartText = await page.locator('body').innerText().catch(() => '')
      r.log('cart-shows-print-service-line', cartText.includes('B&W Print'))
    })

    await r.step('annual-reorder-reminder-flags-old-institutional-order', async () => {
      // Backdate the order we just billed to simulate it being 12 months
      // old, then confirm the reminder surfaces it (via API and on-screen).
      h.withDb((db) => {
        const twelveMonthsAgo = Date.now() - 12 * 30 * 86400000
        try { db.prepare('UPDATE BulkListOrder SET createdAt = ? WHERE id = ?').run(twelveMonthsAgo, orderId) } catch { /* noop */ }
      })
      const res = await page.evaluate(async () => window.api.bulkListOrder.reorderReminders())
      const found = (res?.data || []).some((row) => row.institutionName === 'E2E Stat DPS School' && row.status === 'DUE_SOON')
      r.log('reorder-reminder-flags-dps-school-due-soon', found, JSON.stringify(res?.data))

      await h.gotoHash(page, '#/stationery/bulk-orders')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('reminder-card-visible-on-screen', bodyText.includes('Annual Reorder Reminders'))
    })

    await r.step('seasonal-demand-forecast-report', () => checkReportTile(page, r, 'seasonalDemandForecast', 'Seasonal Demand Forecast', { needsDateRange: false }))
    await r.step('institutional-order-history-report', () => checkReportTile(page, r, 'institutionalOrderHistory', 'Institutional Order History', { needsDateRange: true }))

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'STATIONERY') {
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
      const orderIds = db.prepare("SELECT id FROM BulkListOrder WHERE listName LIKE 'E2E %'").all().map((row) => row.id)
      for (const id of orderIds) {
        try { db.prepare('DELETE FROM BulkListOrderItem WHERE bulkListOrderId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM BulkListOrder WHERE id = ?').run(id) } catch { /* noop */ }
      }
      // The "B&W Print (per page)" service product is a reusable, lazily-created
      // singleton (same pattern as Tip / Service Charge) — deliberately not
      // cleaned up here, same as every suite that exercises the Tip button.
      console.log('extra cleanup: bulkListOrders', orderIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSTATIONERY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
