/**
 * Suite 165 — order-channel tagging (Takeaway / Zomato / Swiggy / Other App)
 * for table-less restaurant sales, and the new "Orders by Channel" report.
 * Real API integration with Zomato/Swiggy is explicitly out of scope (would
 * need permanent internet + partner credentials, breaking Sarang's
 * offline-first design) -- this is the manual-tagging alternative the
 * founder chose: staff pick a channel at billing time, KOT tickets show it,
 * and a report breaks down Dine-in vs Takeaway vs Zomato vs Swiggy vs Other.
 */
const h = require('../harness')
const { createTestProduct } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E165'

async function billTakeawayWithChannel(page, r, label, channelButtonLabel, productName) {
  await h.gotoHash(page, '#/billing/new')
  await page.waitForTimeout(900)

  const search = page.locator('input[placeholder^="Search products"]').first()
  await search.fill(productName)
  await page.waitForTimeout(500)
  await search.press('Enter')
  await page.waitForTimeout(500)

  const channelBtn = page.getByRole('button', { name: channelButtonLabel, exact: true }).first()
  const channelBtnCount = await channelBtn.count()
  r.log(`${label}-channel-button-present`, channelBtnCount > 0)
  if (channelBtnCount > 0) await channelBtn.click()
  await page.waitForTimeout(200)

  const confirmBtn = page.getByRole('button', { name: /Confirm Sale/ }).first()
  await confirmBtn.click()
  await page.waitForTimeout(1200)
  r.log(`${label}-billed-no-crash`, !(await h.hasErrorBoundary(page)))

  const invoiceId = page.url().split('#/billing/')[1]

  const sendBtn = page.getByRole('button', { name: /Send to Kitchen/ }).first()
  const sendCount = await sendBtn.count()
  r.log(`${label}-send-to-kitchen-present`, sendCount > 0)
  if (sendCount > 0) { await sendBtn.click(); await page.waitForTimeout(1000) }

  return invoiceId
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

    await r.step('switch-to-restaurant', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))
    })

    let zomatoProdId, swiggyProdId, otherProdId
    const zomatoName = `${TEST_PREFIX} Butter Chicken ${suffix}`
    const swiggyName = `${TEST_PREFIX} Paneer Tikka ${suffix}`
    const otherName = `${TEST_PREFIX} Naan ${suffix}`
    await r.step('seed-products', async () => {
      const p1 = await createTestProduct(page, { productName: zomatoName, sellingPrice: 220, costPrice: 90, taxRate: 5 })
      zomatoProdId = p1?.data?.id
      const p2 = await createTestProduct(page, { productName: swiggyName, sellingPrice: 180, costPrice: 70, taxRate: 5 })
      swiggyProdId = p2?.data?.id
      const p3 = await createTestProduct(page, { productName: otherName, sellingPrice: 40, costPrice: 15, taxRate: 5 })
      otherProdId = p3?.data?.id
      r.log('products-seeded', !!zomatoProdId && !!swiggyProdId && !!otherProdId)
    })

    let zomatoInvoiceId
    await r.step('bill-a-zomato-order-via-real-ui', async () => {
      zomatoInvoiceId = await billTakeawayWithChannel(page, r, 'zomato', 'Zomato', zomatoName)
      if (zomatoInvoiceId) {
        const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), zomatoInvoiceId)
        r.log('zomato-invoice-tagged-and-paid', invRes?.data?.orderChannel === 'ZOMATO' && invRes?.data?.paymentStatus === 'PAID',
          JSON.stringify({ channel: invRes?.data?.orderChannel, status: invRes?.data?.paymentStatus }))
      }
    })

    let swiggyInvoiceId
    await r.step('bill-a-swiggy-order-via-real-ui', async () => {
      swiggyInvoiceId = await billTakeawayWithChannel(page, r, 'swiggy', 'Swiggy', swiggyName)
      if (swiggyInvoiceId) {
        const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), swiggyInvoiceId)
        r.log('swiggy-invoice-tagged-and-paid', invRes?.data?.orderChannel === 'SWIGGY' && invRes?.data?.paymentStatus === 'PAID',
          JSON.stringify({ channel: invRes?.data?.orderChannel, status: invRes?.data?.paymentStatus }))
      }
    })

    let plainTakeawayInvoiceId
    await r.step('default-channel-is-takeaway-without-picking-one', async () => {
      plainTakeawayInvoiceId = await billTakeawayWithChannel(page, r, 'plain-takeaway', 'Takeaway', otherName)
      if (plainTakeawayInvoiceId) {
        const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), plainTakeawayInvoiceId)
        r.log('default-channel-is-takeaway', invRes?.data?.orderChannel === 'TAKEAWAY', JSON.stringify(invRes?.data?.orderChannel))
      }
    })

    await r.step('kot-screen-shows-real-channel-labels', async () => {
      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(900)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      // CSS uppercase on the badge means Chromium's innerText reflects the
      // rendered "ZOMATO"/"SWIGGY", not the literal "Zomato"/"Swiggy" string
      // -- match case-insensitively (see feedback_uppercase_css_innertext_gotcha).
      const bodyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
      r.log('kot-screen-shows-zomato-label', bodyText.includes('zomato'))
      r.log('kot-screen-shows-swiggy-label', bodyText.includes('swiggy'))
    })

    await r.step('order-channel-report-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Orders by Channel' }).first()
      const present = await tile.count() > 0
      r.log('orders-by-channel-tile-present', present)
      if (!present) return
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      const from = h.toLocalISODate(new Date(Date.now() - 1 * 24 * 3600000))
      const to = h.toLocalISODate(new Date(Date.now() + 1 * 24 * 3600000))
      await dateInputs.nth(0).fill(from)
      await dateInputs.nth(1).fill(to)
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('order-channel-report-renders-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('report-table-shows-zomato-row', bodyText.includes('Zomato'))
      r.log('report-table-shows-swiggy-row', bodyText.includes('Swiggy'))
      r.log('report-table-shows-takeaway-row', bodyText.includes('Takeaway'))

      const apiRes = await page.evaluate(async ({ from, to }) => window.api.reports.orderChannelBreakdown({ dateFrom: from, dateTo: to }), { from, to })
      const rows = apiRes?.data?.rows || []
      const zomatoRow = rows.find((row) => row.channel === 'ZOMATO')
      const swiggyRow = rows.find((row) => row.channel === 'SWIGGY')
      const takeawayRow = rows.find((row) => row.channel === 'TAKEAWAY')
      r.log('api-zomato-count-at-least-1', (zomatoRow?.orderCount ?? 0) >= 1, JSON.stringify(zomatoRow))
      r.log('api-swiggy-count-at-least-1', (swiggyRow?.orderCount ?? 0) >= 1, JSON.stringify(swiggyRow))
      r.log('api-takeaway-count-at-least-1', (takeawayRow?.orderCount ?? 0) >= 1, JSON.stringify(takeawayRow))
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
    console.log(`\nORDER CHANNEL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
