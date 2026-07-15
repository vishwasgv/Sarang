/**
 * Suite 40 — Restaurant vertical (restaurant_tables, kot, recipes). Real
 * UI-driven table creation + status, an invoice sent to the kitchen (Send to
 * Kitchen button on InvoiceDetailScreen — createKOT takes only invoiceId,
 * tableId is optional and not wired from that button), KOT status ladder
 * (PENDING -> IN_PROGRESS -> DONE), and End of Day daily close. Product +
 * invoice creation itself is generic infra already covered by suite 01, so
 * scoped via API here per the established "distinguishing feature only"
 * pattern. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Rest'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-restaurant', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant / Café / Food')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))
    })

    await r.step('create-table-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      r.log('tables-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // "Add Table" appears twice once the form opens (header trigger + form
      // submit) — .first()/.last() disambiguate.
      await page.getByRole('button', { name: 'Add Table' }).first().click()
      await page.waitForTimeout(300)
      await page.getByPlaceholder('Table number (e.g. T1)').fill('T-E2E9')
      await page.getByPlaceholder('Display name (optional)').fill('E2E Rest Table')
      await page.getByRole('button', { name: 'Add Table' }).last().click()
      await page.waitForTimeout(1000)
      r.log('table-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'restaurant-table-created')
    })

    let tableId

    await r.step('verify-table-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const tables = listRes?.data || []
      const found = tables.find((t) => t.tableNumber === 'T-E2E9')
      tableId = found?.id
      r.log('table-findable-via-api', !!tableId, JSON.stringify({ status: found?.status }))
    })

    await r.step('set-table-occupied-via-real-ui', async () => {
      const card = page.locator('div.rounded-xl', { hasText: 'E2E Rest Table' }).first()
      await card.getByRole('button', { name: 'Busy' }).click()
      await page.waitForTimeout(800)
      const res = await page.evaluate((id) => window.api.restaurant.listTables().then((r2) => r2.data.find((t) => t.id === id)), tableId)
      r.log('table-marked-occupied', res?.status === 'OCCUPIED', JSON.stringify(res?.status))
    })

    let productId
    let invoiceId

    await r.step('create-product-and-invoice-via-api', async () => {
      const prodRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Rest Butter Naan', productType: 'STANDARD', unit: 'PCS',
        costPrice: 20, sellingPrice: 60, taxRate: 5, openingQuantity: 100,
      }))
      productId = prodRes?.data?.id
      r.log('product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const invRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 2, unitPrice: 60, taxRate: 5 }],
      }), productId)
      invoiceId = invRes?.data?.id
      r.log('invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
    })

    await r.step('send-to-kitchen-via-real-ui', async () => {
      await h.gotoHash(page, `#/billing/${invoiceId}`)
      await page.waitForTimeout(800)
      const kotBtn = page.getByRole('button', { name: 'Send to Kitchen' })
      r.log('send-to-kitchen-button-present', await kotBtn.count() > 0)
      await kotBtn.click()
      await page.waitForTimeout(1200)
      r.log('kot-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'restaurant-sent-to-kitchen')
    })

    let kotId

    await r.step('verify-kot-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
      const kots = listRes?.data || []
      const found = kots.find((k) => k.invoice?.invoiceNumber && k.invoiceId === invoiceId)
        ?? kots.find((k) => k.invoiceId === invoiceId)
      kotId = found?.id
      r.log('kot-findable-via-api', !!kotId, JSON.stringify({ status: found?.status }))
    })

    await r.step('advance-kot-status-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(800)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Default filter is "Pending" — our fresh KOT should be visible there.
      const card = page.locator('div.rounded-xl', { hasText: 'E2E Rest Butter Naan' }).first()
      await card.getByRole('button', { name: 'Start Cooking' }).click()
      await page.waitForTimeout(1000)

      // Now switch to the "In Progress" filter to find it and mark done.
      await page.getByRole('button', { name: 'In Progress', exact: true }).click()
      await page.waitForTimeout(800)
      const card2 = page.locator('div.rounded-xl', { hasText: 'E2E Rest Butter Naan' }).first()
      await card2.getByRole('button', { name: 'Mark Done' }).click()
      await page.waitForTimeout(1000)
      r.log('kot-advanced-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-kot-done-via-api', async () => {
      if (!kotId) return r.log('verify-kot-done-via-api', false, 'no kotId captured')
      const listRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
      const kots = listRes?.data || []
      const found = kots.find((k) => k.id === kotId)
      r.log('kot-reached-done', found?.status === 'DONE', JSON.stringify(found?.status))
    })

    await r.step('perform-daily-close-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'End of Day' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'End of Day' }).click()
      await page.waitForTimeout(1500)
      const bodyText = await page.locator('body').innerText()
      r.log('daily-close-completed', /Day closed/.test(bodyText), bodyText.slice(0, 200))
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE 'E2E Rest%'").all().map((r2) => r2.id)
      const invIds = prodIds.length === 0 ? [] : db.prepare(`SELECT DISTINCT i.id AS id FROM "Invoice" i JOIN InvoiceItem ii ON ii.invoiceId = i.id WHERE ii.productId IN (${prodIds.map(() => '?').join(',')})`).all(...prodIds).map((r2) => r2.id)
      for (const id of invIds) {
        try { db.prepare('DELETE FROM KOT WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM "Invoice" WHERE id = ?').run(id) } catch { /* noop */ }
      }
      for (const id of prodIds) { try { db.prepare('DELETE FROM Product WHERE id = ?').run(id) } catch { /* noop */ } }
      const tableIds = db.prepare("SELECT id FROM RestaurantTable WHERE tableNumber = 'T-E2E9'").all().map((r2) => r2.id)
      for (const id of tableIds) { try { db.prepare('DELETE FROM RestaurantTable WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: invoices', invIds.length, 'products', prodIds.length, 'tables', tableIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRESTAURANT VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
