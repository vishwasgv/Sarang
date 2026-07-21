/**
 * Suite 48 — Phase 58 §2 (2026-07-21): real table<->order binding for
 * restaurant dine-in orders (Start Order / View Bill / Merge In, auto-release
 * on full payment), real split-bill, and real Reservations (replacing the
 * old bare RESERVED status string). All driven through the real running UI,
 * not just the IPC API, per this project's standing live-UAT discipline.
 */
const h = require('../harness')
const { createTestCustomer } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E RestBind'

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

    let productAId, productBId
    let tableXId, tableYId, tableZId
    let customerId

    await r.step('create-products-and-tables-via-api', async () => {
      const cust = await createTestCustomer(page, { customerName: 'E2E RestBind Customer' })
      customerId = cust?.data?.id
      r.log('customer-created', !!cust?.success)
      const a = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E RestBind Butter Chicken', productType: 'STANDARD', unit: 'PCS',
        costPrice: 150, sellingPrice: 300, taxRate: 5, openingQuantity: 100,
      }))
      productAId = a?.data?.id
      const b = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E RestBind Naan', productType: 'STANDARD', unit: 'PCS',
        costPrice: 15, sellingPrice: 40, taxRate: 5, openingQuantity: 100,
      }))
      productBId = b?.data?.id
      r.log('products-created', !!a?.success && !!b?.success)

      const x = await page.evaluate(async () => window.api.restaurant.createTable({ tableNumber: 'E2E-BX', tableName: 'E2E RestBind X' }))
      tableXId = x?.data?.id
      const y = await page.evaluate(async () => window.api.restaurant.createTable({ tableNumber: 'E2E-BY', tableName: 'E2E RestBind Y' }))
      tableYId = y?.data?.id
      const z = await page.evaluate(async () => window.api.restaurant.createTable({ tableNumber: 'E2E-BZ', tableName: 'E2E RestBind Z' }))
      tableZId = z?.data?.id
      r.log('tables-created', !!tableXId && !!tableYId && !!tableZId)
    })

    let invoiceId

    await r.step('start-order-from-table-card-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      r.log('tables-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const cardX = page.locator('div.rounded-xl', { hasText: 'E2E RestBind X' }).first()
      await cardX.getByRole('button', { name: 'Start Order' }).click()
      await page.waitForTimeout(800)

      r.log('navigated-to-billing-with-table', page.url().includes('/billing/new') && page.url().includes('tableId='), page.url())

      const badge = page.locator('span', { hasText: 'E2E RestBind X' })
      r.log('table-badge-shown-on-billing-header', await badge.count() > 0)
    })

    await r.step('add-items-and-confirm-sale-via-real-ui', async () => {
      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill('E2E RestBind Butter Chicken')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E RestBind Butter Chicken")').first().click()
      await page.waitForTimeout(400)

      // CREDIT (pay later), not the default CASH — a CASH sale pays in full
      // in this same call and releases its table(s) immediately (see the
      // "releases the table immediately for a CASH order" behavior), which
      // would make the later Merge/Record-Payment steps below meaningless.
      // A real "running tab" that keeps the table occupied needs an order
      // that starts genuinely unpaid.
      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E RestBind Customer')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E RestBind Customer")').first().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Credit (Pay Later)', exact: true }).click()
      await page.waitForTimeout(300)

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)

      const match = page.url().match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, page.url())
      if (match) invoiceId = match[1]
      r.log('billing-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'restbind-order-started')
    })

    await r.step('verify-invoice-tableid-and-table-claimed-via-api', async () => {
      if (!invoiceId) return r.log('verify-invoice-tableid-and-table-claimed-via-api', false, 'no invoiceId captured')
      const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-has-tableid', invRes?.data?.tableId === tableXId, JSON.stringify(invRes?.data?.tableId))

      const tablesRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const tableX = (tablesRes?.data || []).find((t) => t.id === tableXId)
      r.log('table-x-claimed-and-occupied', tableX?.currentInvoiceId === invoiceId && tableX?.status === 'OCCUPIED', JSON.stringify({ currentInvoiceId: tableX?.currentInvoiceId, status: tableX?.status }))
    })

    await r.step('table-card-shows-view-bill-and-merge-in', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      const cardX = page.locator('div.rounded-xl', { hasText: 'E2E RestBind X' }).first()
      r.log('view-bill-button-present', await cardX.getByRole('button', { name: 'View Bill' }).count() > 0)
      r.log('merge-in-button-present', await cardX.getByRole('button', { name: 'Merge In' }).count() > 0)
      r.log('start-order-gone', await cardX.getByRole('button', { name: 'Start Order' }).count() === 0)
    })

    await r.step('merge-table-y-into-table-x-via-real-ui', async () => {
      const cardX = page.locator('div.rounded-xl', { hasText: 'E2E RestBind X' }).first()
      await cardX.getByRole('button', { name: 'Merge In' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: /E2E RestBind Y/ }).click()
      await page.waitForTimeout(1000)
      r.log('merge-no-crash', !(await h.hasErrorBoundary(page)))

      const tablesRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const tableY = (tablesRes?.data || []).find((t) => t.id === tableYId)
      r.log('table-y-merged-into-same-invoice', tableY?.currentInvoiceId === invoiceId && tableY?.status === 'OCCUPIED', JSON.stringify({ currentInvoiceId: tableY?.currentInvoiceId, status: tableY?.status }))
      await h.shot(page, 'restbind-table-merged')
    })

    await r.step('record-full-payment-releases-both-tables', async () => {
      await h.gotoHash(page, `#/billing/${invoiceId}`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Record Payment' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      // Amount field is pre-filled via placeholder with the exact balance —
      // leave it blank and let the placeholder value ship, matching the
      // component's own "amount || balance" submit fallback pattern used
      // elsewhere in this app... but recordPayment requires a real typed
      // value, so read the placeholder and fill it explicitly.
      const amountInput = modal.locator('input[type="number"]')
      const placeholderAmount = await amountInput.getAttribute('placeholder')
      await amountInput.fill(placeholderAmount || '0')
      await modal.getByRole('button', { name: 'Record Payment' }).click()
      await page.waitForTimeout(1200)
      r.log('payment-recorded-no-crash', !(await h.hasErrorBoundary(page)))

      const tablesRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const tableX = (tablesRes?.data || []).find((t) => t.id === tableXId)
      const tableY = (tablesRes?.data || []).find((t) => t.id === tableYId)
      r.log('both-tables-released-after-full-payment',
        tableX?.currentInvoiceId === null && tableX?.status === 'AVAILABLE' && tableY?.currentInvoiceId === null && tableY?.status === 'AVAILABLE',
        JSON.stringify({ tableX: { currentInvoiceId: tableX?.currentInvoiceId, status: tableX?.status }, tableY: { currentInvoiceId: tableY?.currentInvoiceId, status: tableY?.status } }))
    })

    let splitInvoiceId, splitItemAId, splitItemBId

    await r.step('create-invoice-for-split-via-api', async () => {
      // CREDIT — splitInvoice requires paidAmount === 0 (see billing.service.ts's
      // SPLIT-002 guard); a CASH sale would already be fully paid at creation.
      const invRes = await page.evaluate(async ({ pidA, pidB, custId }) => window.api.billing.createInvoice({
        paymentMethod: 'CREDIT',
        customerId: custId,
        items: [
          { productId: pidA, quantity: 2, unitPrice: 300, taxRate: 5 },
          { productId: pidB, quantity: 4, unitPrice: 40, taxRate: 5 },
        ],
      }), { pidA: productAId, pidB: productBId, custId: customerId })
      splitInvoiceId = invRes?.data?.id
      r.log('split-source-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const getRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), splitInvoiceId)
      const items = getRes?.data?.items || []
      splitItemAId = items.find((i) => i.quantity === 2)?.id
      splitItemBId = items.find((i) => i.quantity === 4)?.id
      r.log('split-source-items-found', !!splitItemAId && !!splitItemBId)
    })

    await r.step('split-bill-via-real-ui', async () => {
      await h.gotoHash(page, `#/billing/${splitInvoiceId}`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Split Bill' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      // Two checks by default. Row 1 (Butter Chicken, qty 2) currently has
      // its full quantity on Check 1 — move 1 unit to Check 2. Row 2 (Naan,
      // qty 4) — move 2 units to Check 2.
      const rows = modal.locator('tbody tr')
      const row1Check2 = rows.nth(0).locator('input[type="number"]').nth(1)
      await row1Check2.fill('1')
      const row1Check1 = rows.nth(0).locator('input[type="number"]').nth(0)
      await row1Check1.fill('1')

      const row2Check2 = rows.nth(1).locator('input[type="number"]').nth(1)
      await row2Check2.fill('2')
      const row2Check1 = rows.nth(1).locator('input[type="number"]').nth(0)
      await row2Check1.fill('2')

      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: /Split into 2 checks/ }).click()
      await page.waitForTimeout(1200)
      r.log('split-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'restbind-bill-split')
    })

    await r.step('verify-split-result-via-api', async () => {
      const origRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), splitInvoiceId)
      const orig = origRes?.data
      r.log('original-invoice-now-split-and-zeroed', orig?.status === 'SPLIT' && orig?.totalAmount === 0 && orig?.balanceAmount === 0, JSON.stringify({ status: orig?.status, totalAmount: orig?.totalAmount }))

      const listRes = await page.evaluate(async () => window.api.billing.listInvoices({}))
      const children = (listRes?.data?.invoices || listRes?.data || []).filter((i) => i.splitFromInvoiceId === splitInvoiceId)
      r.log('two-child-invoices-created', children.length === 2, JSON.stringify(children.map((c) => ({ id: c.id, totalAmount: c.totalAmount }))))
    })

    await r.step('reservations-add-and-seat-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Reservations' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Add Reservation' }).click()
      await page.waitForTimeout(300)

      const soon = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now — inside the upcoming-badge window
      await page.getByPlaceholder('Customer name').fill('E2E RestBind Guest')
      await page.getByPlaceholder('Phone').fill('9998887777')
      await page.getByPlaceholder('Party size').fill('4')
      await page.locator('input[type="datetime-local"]').fill(h.fmtLocalDateTime(soon))
      await page.locator('select').filter({ hasText: 'No table pre-assigned' }).selectOption({ label: 'E2E RestBind Z' })
      await page.getByRole('button', { name: 'Save Reservation' }).click()
      await page.waitForTimeout(1000)
      r.log('reservation-save-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText()
      r.log('reservation-appears-in-list', bodyText.includes('E2E RestBind Guest'))
      await h.shot(page, 'restbind-reservation-added')
    })

    let reservationId

    await r.step('verify-reservation-and-table-badge-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.reservations.list({ status: 'CONFIRMED' }))
      const found = (listRes?.data || []).find((r2) => r2.customerName === 'E2E RestBind Guest')
      reservationId = found?.id
      r.log('reservation-findable-via-api', !!reservationId && found.tableId === tableZId, JSON.stringify({ tableId: found?.tableId }))

      // Reload the table list view (badge reads a separate upcomingByTable call)
      await page.reload()
      await page.waitForTimeout(1200)
      await h.login(page)
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(1000)
      const bodyText = await page.locator('body').innerText()
      r.log('reserved-badge-shown-on-table-card', bodyText.includes('Reserved'))
    })

    await r.step('seat-reservation-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Reservations' }).click()
      await page.waitForTimeout(500)
      const row = page.locator('div.flex.items-center.justify-between.py-3', { hasText: 'E2E RestBind Guest' }).first()
      await row.getByRole('button', { name: 'Seat' }).click()
      await page.waitForTimeout(1000)
      r.log('seat-no-crash', !(await h.hasErrorBoundary(page)))

      const tablesRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const tableZ = (tablesRes?.data || []).find((t) => t.id === tableZId)
      r.log('table-z-occupied-after-seating', tableZ?.status === 'OCCUPIED', JSON.stringify(tableZ?.status))

      const rsvRes = await page.evaluate(async (id) => window.api.reservations.list({}), reservationId)
      const rsv = (rsvRes?.data || []).find((r2) => r2.id === reservationId)
      r.log('reservation-marked-seated', rsv?.status === 'SEATED', JSON.stringify(rsv?.status))
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
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE 'E2E RestBind%'").all().map((row) => row.id)
      const invIds = prodIds.length === 0 ? [] : db.prepare(`SELECT DISTINCT i.id AS id FROM "Invoice" i JOIN InvoiceItem ii ON ii.invoiceId = i.id WHERE ii.productId IN (${prodIds.map(() => '?').join(',')})`).all(...prodIds).map((row) => row.id)
      // Also sweep up any split-child invoices (their own items reference
      // the same productIds, so the query above already includes them —
      // this covers the case where an item's own invoiceId differs from
      // the parent's).
      for (const id of invIds) {
        try { db.prepare('DELETE FROM KOT WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id) } catch { /* noop */ }
      }
      for (const id of invIds) {
        try { db.prepare('DELETE FROM "Invoice" WHERE id = ?').run(id) } catch { /* noop */ }
      }
      for (const id of prodIds) { try { db.prepare('DELETE FROM Product WHERE id = ?').run(id) } catch { /* noop */ } }
      const tableIds = db.prepare("SELECT id FROM RestaurantTable WHERE tableNumber LIKE 'E2E-B%'").all().map((row) => row.id)
      for (const id of tableIds) { try { db.prepare('DELETE FROM RestaurantTable WHERE id = ?').run(id) } catch { /* noop */ } }
      const rsvIds = db.prepare("SELECT id FROM Reservation WHERE customerName LIKE 'E2E RestBind%'").all().map((row) => row.id)
      for (const id of rsvIds) { try { db.prepare('DELETE FROM Reservation WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: invoices', invIds.length, 'products', prodIds.length, 'tables', tableIds.length, 'reservations', rsvIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRESTAURANT TABLE BINDING: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
