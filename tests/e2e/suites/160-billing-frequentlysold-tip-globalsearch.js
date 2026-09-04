/**
 * Suite 160 — real gaps found while double-checking "are invoices/whatsapp/
 * reminders fully covered": billing.getFrequentlySoldProducts,
 * billing.getOrCreateTipProduct, and search:global (the CommandPalette,
 * Ctrl+K). billing.cancelInvoice/splitInvoice and getOrCreateServiceProduct
 * turned out to be false alarms (already covered via real UI in suites 01
 * and 88 respectively) -- confirmed via full-file grep before writing this.
 */
const h = require('../harness')
const { createTestProduct, createTestCustomer } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E160'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let freqProductId
    await r.step('frequently-sold-strip-shows-and-adds-real-product', async () => {
      const prodRes = await createTestProduct(page, {
        productName: `${TEST_PREFIX} Top Seller ${suffix}`, sellingPrice: 50, costPrice: 20, openingQuantity: 500000,
      })
      freqProductId = prodRes?.data?.id
      r.log('product-seeded', !!freqProductId, JSON.stringify(prodRes?.error || ''))

      // A huge single-line quantity guarantees this product outranks every
      // other product's accumulated quantity in this shared, years-old dev
      // DB (the ranking has no time window -- it's an all-time sum), making
      // the assertion deterministic regardless of what else is in the DB.
      const invRes = await page.evaluate((pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 200000, unitPrice: 50, taxRate: 0 }],
      }), freqProductId)
      r.log('bulk-invoice-created', !!invRes?.data?.id, JSON.stringify(invRes?.error || ''))

      const apiRes = await page.evaluate(async () => window.api.billing.getFrequentlySoldProducts({ limit: 10 }))
      const topProduct = apiRes?.data?.products?.[0]
      r.log('api-ranks-our-product-first', topProduct?.id === freqProductId, JSON.stringify(topProduct?.productName))

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(900)
      r.log('billing-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('frequently-sold-label-visible', bodyText.includes('Frequently Sold') || bodyText.toLowerCase().includes('frequently sold'))

      const chip = page.locator('button', { hasText: `${TEST_PREFIX} Top Seller ${suffix}` }).first()
      r.log('our-product-chip-present', await chip.count() > 0)
      if (await chip.count() > 0) {
        await chip.click()
        await page.waitForTimeout(400)
        const cartText = await page.locator('body').innerText().catch(() => '')
        r.log('clicking-chip-adds-to-cart', cartText.includes(`${TEST_PREFIX} Top Seller ${suffix}`) && !(await h.hasErrorBoundary(page)))
      }
    })

    await r.step('add-tip-via-real-ui', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      await page.getByRole('button', { name: /Add Tip/ }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('input[type="number"]').fill('55')
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: /Add to Cart/ }).click()
      await page.waitForTimeout(500)
      r.log('add-tip-no-crash', !(await h.hasErrorBoundary(page)))

      const cartText = await page.locator('body').innerText().catch(() => '')
      r.log('cart-shows-tip-line', cartText.includes('Tip / Service Charge') && cartText.includes('55'))

      const tipProdRes = await page.evaluate(async () => window.api.products.search('Tip / Service Charge'))
      const tipProduct = (tipProdRes?.data || []).find((p) => p.productName === 'Tip / Service Charge')
      r.log('tip-product-actually-exists', !!tipProduct && tipProduct.productType === 'SERVICE', JSON.stringify(tipProduct))
    })

    let searchCustId
    await r.step('global-search-via-ctrl-k', async () => {
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} Findable Customer ${suffix}` })
      searchCustId = custRes?.data?.id
      r.log('search-customer-seeded', !!searchCustId, JSON.stringify(custRes?.error || ''))

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(500)
      await page.keyboard.press('Control+k')
      await page.waitForTimeout(400)

      const dialog = page.locator('div[role="dialog"][aria-label="Global search"]')
      r.log('command-palette-opens', await dialog.count() > 0)

      await dialog.locator('input[aria-label="Search"]').fill(`${TEST_PREFIX} Findable Customer`)
      await page.waitForTimeout(700)

      const resultItem = dialog.locator('button', { hasText: `${TEST_PREFIX} Findable Customer ${suffix}` }).first()
      r.log('customer-result-found', await resultItem.count() > 0)
      if (await resultItem.count() > 0) {
        await resultItem.click()
        await page.waitForTimeout(700)
        r.log('clicking-result-navigates-no-crash', !(await h.hasErrorBoundary(page)))
        r.log('navigated-to-customer-page', page.url().includes(searchCustId))
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let invs = 0, prods = 0, custs = 0
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of prodIds) {
        // Find invoice IDs BEFORE deleting the InvoiceItem rows that
        // reference productId -- deleting them first, then trying to look
        // them up via the now-empty InvoiceItem table, silently no-ops.
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
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ invs, prods, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nFREQUENTLY SOLD / TIP / GLOBAL SEARCH: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
