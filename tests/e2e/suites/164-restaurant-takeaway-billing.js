/**
 * Suite 164 — explicit verification (real UI, not just API) that a
 * counter/takeaway sale (no table attached) still goes through the
 * ordinary Billing flow and gets FULLY BILLED, exactly like retail,
 * unaffected by this session's dine-in changes (running-tab/deferred
 * billing for tables, the Waiter View feature, the Token # feature).
 * By construction (`CreateKOTSchema` requires `invoiceId`), a takeaway
 * KOT can only ever be created from an ALREADY-EXISTING, already-paid
 * invoice via the "Send to Kitchen" button on the invoice screen — there
 * is no way to reach the Token # code path without billing happening
 * first. This suite proves that live, end to end, via real clicks.
 */
const h = require('../harness')
const { createTestProduct } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E164'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-restaurant', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))
    })

    let prodId
    await r.step('seed-product', async () => {
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Vada Pav ${suffix}`, sellingPrice: 40, costPrice: 15, taxRate: 5 })
      prodId = prodRes?.data?.id
      r.log('product-seeded', !!prodId, JSON.stringify(prodRes?.error || ''))
    })

    let invoiceId, invoiceNumber
    await r.step('takeaway-sale-billed-via-real-ui-no-table', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(900)
      r.log('billing-screen-no-table-loads', !(await h.hasErrorBoundary(page)))

      const bodyBefore = await page.locator('body').innerText().catch(() => '')
      r.log('no-send-to-kitchen-button-pre-cart', !bodyBefore.includes('Send to Kitchen'))

      const search = page.locator('input[placeholder^="Search products"]').first()
      const searchCount = await search.count()
      r.log('search-input-present', searchCount > 0)
      if (searchCount > 0) {
        await search.fill(`${TEST_PREFIX} Vada Pav ${suffix}`)
        await page.waitForTimeout(500)
        await search.press('Enter')
        await page.waitForTimeout(500)
      }

      const cartText = await page.locator('body').innerText().catch(() => '')
      r.log('product-added-to-cart', cartText.includes(`${TEST_PREFIX} Vada Pav ${suffix}`))

      const confirmBtn = page.getByRole('button', { name: /Confirm Sale/ }).first()
      const confirmCount = await confirmBtn.count()
      r.log('confirm-sale-button-present-not-send-to-kitchen', confirmCount > 0)
      if (confirmCount > 0) {
        await confirmBtn.click()
        await page.waitForTimeout(1200)
      }

      r.log('navigated-to-invoice-no-crash', !(await h.hasErrorBoundary(page)))
      const url = page.url()
      r.log('url-is-invoice-detail', /#\/billing\/[A-Za-z0-9]+$/.test(url), url)
      invoiceId = url.split('#/billing/')[1]

      const invBody = await page.locator('body').innerText().catch(() => '')
      r.log('invoice-shows-paid-status', /PAID/i.test(invBody))

      if (invoiceId) {
        const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
        invoiceNumber = invRes?.data?.invoiceNumber
        r.log('invoice-genuinely-paid-server-side', invRes?.data?.paymentStatus === 'PAID' && invRes?.data?.balanceAmount === 0,
          JSON.stringify({ status: invRes?.data?.paymentStatus, balance: invRes?.data?.balanceAmount, tableId: invRes?.data?.tableId }))
        r.log('invoice-has-no-table', invRes?.data?.tableId == null)
      }
    })

    let kotId
    await r.step('send-billed-takeaway-order-to-kitchen-via-real-ui', async () => {
      const sendBtn = page.getByRole('button', { name: /Send to Kitchen/ }).first()
      const sendCount = await sendBtn.count()
      r.log('send-to-kitchen-button-present-on-paid-invoice', sendCount > 0)
      if (sendCount > 0) {
        await sendBtn.click()
        await page.waitForTimeout(1200)
      }
      r.log('send-to-kitchen-no-crash', !(await h.hasErrorBoundary(page)))

      const invBody = await page.locator('body').innerText().catch(() => '')
      r.log('kot-status-shown-on-invoice', /KOT:/i.test(invBody))

      if (invoiceId) {
        const listRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
        const kot = (listRes?.data || []).find((k) => k.invoiceId === invoiceId)
        kotId = kot?.id
        r.log('kot-created-with-token-number-and-linked-to-paid-invoice', !!kot && typeof kot.tokenNumber === 'number' && kot.tableId == null,
          JSON.stringify({ tokenNumber: kot?.tokenNumber, tableId: kot?.tableId, invoiceId: kot?.invoiceId }))
      }
    })

    await r.step('kot-screen-shows-token-for-the-billed-takeaway-order', async () => {
      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(900)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('kot-screen-shows-token-text', /Token #\d+/.test(bodyText))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'RESTAURANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let kots = 0, invs = 0, prods = 0
      const kotIds = db.prepare(`SELECT id FROM KOT WHERE invoiceId IN (SELECT id FROM Invoice WHERE id IN (SELECT invoiceId FROM InvoiceItem WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')))`).all().map((row) => row.id)
      for (const id of kotIds) { try { kots += db.prepare('DELETE FROM KOT WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of prodIds) {
        const invIds = db.prepare('SELECT DISTINCT invoiceId FROM InvoiceItem WHERE productId = ?').all(id).map((row) => row.invoiceId)
        try { db.prepare('DELETE FROM InvoiceItem WHERE productId = ?').run(id) } catch { /* noop */ }
        for (const invId of invIds) {
          try { db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(invId) } catch { /* noop */ }
          try { invs += db.prepare('DELETE FROM Invoice WHERE id = ?').run(invId).changes } catch { /* noop */ }
        }
        try { db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Inventory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(id).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(id) }
      }
      console.log('extra cleanup:', JSON.stringify({ kots, invs, prods }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTAKEAWAY BILLING: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
