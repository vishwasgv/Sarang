/**
 * Suite 166 — Group B pre-launch audit live verification: inventory,
 * products, customers, suppliers, sales-orders, locations, reports,
 * distributor. Real click-through + IPC-level verification against the live
 * dev DB (unit tests already cover pure logic in isolation) — this suite
 * specifically targets the risk areas the audit brief called out:
 *  - ProductsScreen's historical "only first 50 products, client-side-only
 *    search" gap (fixed this session — see ProductsScreen.tsx's own comment).
 *  - Archiving a product/customer/supplier that has real transaction history
 *    (must be BLOCKED, never silently allowed or silently corrupt data).
 *  - Negative-stock guard (adjustStock respects allow_negative_inventory).
 *  - Sales Order partial invoicing across two separate invoices (does NOT
 *    double-book or under-book stock).
 *  - Search matching nothing renders an empty state, not a crash.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Grp166'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  let page
  // Hoisted to function scope (not just the try block) — the finally block
  // below needs these for cleanup, and a try{}'s own let/const bindings are
  // NOT visible in the sibling finally{} block.
  let partialSoId = null
  const soInvoiceIds = []

  try {
    page = await h.getMainWindow(app)
    await h.login(page)

    // ── Breadth: every in-scope screen loads without crashing ─────────────
    const routes = [
      ['#/products', 'products'],
      ['#/products/print-labels', 'print-labels'],
      ['#/inventory', 'inventory'],
      ['#/inventory/movements', 'inventory-movements'],
      ['#/sales-orders', 'sales-orders'],
      ['#/locations', 'locations'],
      ['#/customers', 'customers'],
      ['#/suppliers', 'suppliers'],
      ['#/reports', 'reports'],
    ]
    for (const [route, label] of routes) {
      await r.step(`visit-${label}`, async () => {
        await h.gotoHash(page, route)
        await page.waitForTimeout(700)
        const crashed = await h.hasErrorBoundary(page)
        r.log(`${label}-loads-no-crash`, !crashed, crashed ? 'ErrorBoundary tripped' : '')
      })
    }

    // ── ProductsScreen 50-product cap regression check ─────────────────────
    // Seeds 55 products with names that sort AFTER "E2E Grp166 AAA-050" so the
    // 55th (alphabetically-last) would have been silently excluded from the
    // pre-fix products.list() call (no `limit`, defaulting to 50) and
    // therefore unsearchable/unreachable in the UI. Names are zero-padded so
    // string sort order matches numeric order.
    const seededProductIds = []
    await r.step('seed-55-products-for-search-cap-check', async () => {
      for (let i = 1; i <= 55; i++) {
        const n = String(i).padStart(3, '0')
        const res = await page.evaluate(async (name) => window.api.products.create({
          productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 10, sellingPrice: 20, taxRate: 0, openingQuantity: 5
        }), `E2E Grp166 AAA-${n}`)
        if (res?.data?.id) seededProductIds.push(res.data.id)
      }
      r.log('55-products-seeded', seededProductIds.length === 55, `created=${seededProductIds.length}`)
    })

    await r.step('products-list-api-total-reflects-all-55', async () => {
      const res = await page.evaluate(async () => window.api.products.list({ limit: 1000 }))
      const total = res?.data?.total ?? 0
      r.log('api-total-includes-at-least-55-new-products', total >= 55, `total=${total}`)
      const names = (res?.data?.products ?? []).map((p) => p.productName)
      r.log('api-result-includes-the-55th-product', names.includes('E2E Grp166 AAA-055'), '')
    })

    await r.step('products-screen-search-finds-the-55th-product-live', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(900)
      const searchBox = page.locator('input[placeholder]').first()
      await searchBox.fill('E2E Grp166 AAA-055')
      await page.waitForTimeout(500)
      const bodyText = await page.locator('body').innerText()
      r.log('55th-product-found-via-ui-search', bodyText.includes('E2E Grp166 AAA-055'),
        bodyText.includes('E2E Grp166 AAA-055') ? 'found' : 'NOT FOUND — would indicate the 50-cap regression is back')
      await searchBox.fill('')
      await page.waitForTimeout(300)
    })

    // ── Search matching nothing → empty state, not a crash ─────────────────
    await r.step('products-search-matching-nothing', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(500)
      const searchBox = page.locator('input[placeholder]').first()
      await searchBox.fill('ZzZ_no_such_product_ZzZ_998877')
      await page.waitForTimeout(500)
      const crashed = await h.hasErrorBoundary(page)
      r.log('empty-search-no-crash', !crashed)
      const bodyText = await page.locator('body').innerText()
      r.log('empty-search-shows-empty-state', /no product/i.test(bodyText) || /0 records/i.test(bodyText), bodyText.slice(0, 200))
      await searchBox.fill('')
      await page.waitForTimeout(300)
    })

    // ── Archive-blocked-on-real-transaction-history ─────────────────────────
    let historyProductId = null
    let historyCustomerId = null
    await r.step('setup-product-and-customer-with-real-invoice-history', async () => {
      const prod = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 10, sellingPrice: 50, taxRate: 0, openingQuantity: 20
      }), `${TEST_PREFIX} HistoryProduct ${suffix}`)
      historyProductId = prod?.data?.id
      const cust = await page.evaluate(async ({ name, phone }) => window.api.customers.create({
        customerName: name, phone
      }), { name: `${TEST_PREFIX} HistoryCustomer ${suffix}`, phone: `9${String(suffix).slice(-9)}` })
      historyCustomerId = cust?.data?.id
      r.log('history-product-and-customer-created', !!(historyProductId && historyCustomerId), '')

      const inv = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CREDIT',
        items: [{ productId, quantity: 1, unitPrice: 50, taxRate: 0 }]
      }), { customerId: historyCustomerId, productId: historyProductId })
      r.log('unpaid-invoice-created-against-both', inv?.success === true, JSON.stringify(inv?.error || ''))
    })

    await r.step('archiving-product-with-active-invoice-is-blocked', async () => {
      if (!historyProductId) return r.log('skipped-no-product-id', false)
      const res = await page.evaluate(async (id) => window.api.products.archive(id), historyProductId)
      r.log('archive-blocked-not-silently-allowed', res?.success === false, JSON.stringify(res?.error))
    })

    await r.step('archiving-customer-with-unpaid-invoice-is-blocked', async () => {
      if (!historyCustomerId) return r.log('skipped-no-customer-id', false)
      const res = await page.evaluate(async (id) => window.api.customers.archive(id), historyCustomerId)
      r.log('archive-blocked-not-silently-allowed', res?.success === false, JSON.stringify(res?.error))
    })

    // ── Negative stock guard ────────────────────────────────────────────────
    let negStockProductId = null
    await r.step('setup-product-for-negative-stock-check', async () => {
      const prod = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 10, sellingPrice: 20, taxRate: 0, openingQuantity: 5
      }), `${TEST_PREFIX} NegStock ${suffix}`)
      negStockProductId = prod?.data?.id
      r.log('negstock-product-created', !!negStockProductId, '')
    })

    await r.step('adjustStock-to-negative-blocked-when-flag-disabled', async () => {
      if (!negStockProductId) return r.log('skipped-no-product-id', false)
      h.withDb((db) => { db.prepare("UPDATE Setting SET settingValue = 'false' WHERE settingKey = 'allow_negative_inventory'").run() })
      const res = await page.evaluate(async (id) => window.api.inventory.adjustStock({
        productId: id, quantity: -3, reason: 'E2E166 negative test'
      }), negStockProductId)
      r.log('negative-adjust-blocked', res?.success === false, JSON.stringify(res?.error))
    })

    await r.step('adjustStock-to-negative-allowed-when-flag-enabled', async () => {
      if (!negStockProductId) return r.log('skipped-no-product-id', false)
      h.withDb((db) => { db.prepare("UPDATE Setting SET settingValue = 'true' WHERE settingKey = 'allow_negative_inventory'").run() })
      const res = await page.evaluate(async (id) => window.api.inventory.adjustStock({
        productId: id, quantity: -3, reason: 'E2E166 negative test allowed'
      }), negStockProductId)
      r.log('negative-adjust-allowed-with-flag-on', res?.success === true, JSON.stringify(res?.error))
      // Restore the safe default immediately — never leave this flipped in a
      // shared dev DB.
      h.withDb((db) => { db.prepare("UPDATE Setting SET settingValue = 'false' WHERE settingKey = 'allow_negative_inventory'").run() })
    })

    // ── Sales Order partial invoicing across two separate invoices ─────────
    // (partialSoId/soInvoiceIds are declared at function scope above, so the
    // finally block's cleanup can see them)
    let soCustomerId = null
    let soProductId = null
    await r.step('setup-partial-invoicing-scenario', async () => {
      const cust = await page.evaluate(async ({ name, phone }) => window.api.customers.create({
        customerName: name, phone
      }), { name: `${TEST_PREFIX} SOCustomer ${suffix}`, phone: `8${String(suffix).slice(-9)}` })
      soCustomerId = cust?.data?.id
      const prod = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 10, sellingPrice: 100, taxRate: 0, openingQuantity: 100
      }), `${TEST_PREFIX} SOProduct ${suffix}`)
      soProductId = prod?.data?.id
      const so = await page.evaluate(async ({ customerId, productId }) => window.api.salesOrders.create({
        customerId, items: [{ productId, quantity: 10, unitPrice: 100, taxRate: 0 }]
      }), { customerId: soCustomerId, productId: soProductId })
      partialSoId = so?.data?.id
      r.log('partial-so-setup-ok', !!(soCustomerId && soProductId && partialSoId), JSON.stringify(so?.error || ''))
      if (partialSoId) {
        const confirmRes = await page.evaluate(async (id) => window.api.salesOrders.confirm(id), partialSoId)
        r.log('partial-so-confirmed', confirmRes?.success === true, JSON.stringify(confirmRes?.error))
      }
    })

    await r.step('invoice-partial-quantity-first-pass', async () => {
      if (!partialSoId) return r.log('skipped-no-so-id', false)
      const so = await page.evaluate(async (id) => window.api.salesOrders.get(id), partialSoId)
      const lineId = so?.data?.items?.[0]?.id
      const res = await page.evaluate(async ({ soId, lineId }) => window.api.salesOrders.createInvoice({
        salesOrderId: soId, lines: [{ salesOrderItemId: lineId, quantity: 4 }]
      }), { soId: partialSoId, lineId })
      r.log('first-partial-invoice-created', res?.success === true, JSON.stringify(res?.error))
      if (res?.data?.id) soInvoiceIds.push(res.data.id)
    })

    await r.step('sales-order-status-partially-invoiced-after-first-pass', () => h.withDb((db) => {
      if (!partialSoId) return r.log('skipped-no-so-id', false)
      const row = db.prepare('SELECT * FROM SalesOrder WHERE id = ?').get(partialSoId)
      r.log('so-status-partially-invoiced', row?.status === 'PARTIALLY_INVOICED', `status=${row?.status}`)
      const item = db.prepare('SELECT * FROM SalesOrderItem WHERE salesOrderId = ?').get(partialSoId)
      r.log('invoicedQty-is-4-of-10', item?.invoicedQty === 4, `invoicedQty=${item?.invoicedQty}`)
      const inv = db.prepare('SELECT quantity FROM InventoryMovement WHERE referenceId IN (SELECT id FROM Invoice WHERE salesOrderId = ?) AND productId = ?').get(partialSoId, soProductId)
      r.log('stock-movement-reflects-only-4-not-10', inv?.quantity === -4, `movementQty=${inv?.quantity}`)
    }))

    await r.step('invoice-remaining-quantity-second-pass', async () => {
      if (!partialSoId) return r.log('skipped-no-so-id', false)
      const so = await page.evaluate(async (id) => window.api.salesOrders.get(id), partialSoId)
      const lineId = so?.data?.items?.[0]?.id
      const res = await page.evaluate(async ({ soId, lineId }) => window.api.salesOrders.createInvoice({
        salesOrderId: soId, lines: [{ salesOrderItemId: lineId, quantity: 6 }]
      }), { soId: partialSoId, lineId })
      r.log('second-invoice-created-for-remainder', res?.success === true, JSON.stringify(res?.error))
      if (res?.data?.id) soInvoiceIds.push(res.data.id)
    })

    await r.step('sales-order-fully-invoiced-after-second-pass-no-double-booking', () => h.withDb((db) => {
      if (!partialSoId) return r.log('skipped-no-so-id', false)
      const row = db.prepare('SELECT * FROM SalesOrder WHERE id = ?').get(partialSoId)
      r.log('so-status-fully-invoiced', row?.status === 'INVOICED', `status=${row?.status}`)
      const item = db.prepare('SELECT * FROM SalesOrderItem WHERE salesOrderId = ?').get(partialSoId)
      r.log('invoicedQty-is-exactly-10-not-more', item?.invoicedQty === 10, `invoicedQty=${item?.invoicedQty}`)
      const inv = db.prepare('SELECT quantity FROM Inventory WHERE productId = ?').get(soProductId)
      // Opened at 100, sold 10 total (4 + 6) — must land at exactly 90, never
      // double-decremented (80) or under-decremented (96/94).
      r.log('aggregate-stock-decremented-by-exactly-10-total', inv?.quantity === 90, `quantity=${inv?.quantity}`)
    }))

    await r.step('over-invoicing-beyond-remaining-is-rejected', async () => {
      if (!partialSoId) return r.log('skipped-no-so-id', false)
      const so = await page.evaluate(async (id) => window.api.salesOrders.get(id), partialSoId)
      const lineId = so?.data?.items?.[0]?.id
      const res = await page.evaluate(async ({ soId, lineId }) => window.api.salesOrders.createInvoice({
        salesOrderId: soId, lines: [{ salesOrderItemId: lineId, quantity: 1 }]
      }), { soId: partialSoId, lineId })
      // Order is already fully invoiced (SO-007) OR the specific line has 0
      // remaining (SO-009) — either is a correct rejection, never a silent
      // over-invoice.
      r.log('over-invoice-rejected', res?.success === false, JSON.stringify(res?.error))
    })

    // ── Sales order with 0 items rejected by validation ─────────────────────
    await r.step('sales-order-with-zero-items-rejected', async () => {
      if (!soCustomerId) return r.log('skipped-no-customer-id', false)
      const res = await page.evaluate(async (customerId) => window.api.salesOrders.create({
        customerId, items: []
      }), soCustomerId)
      r.log('zero-item-so-rejected', res?.success === false, JSON.stringify(res?.error))
    })

    // ── Reports reconciliation spot-check: inventory valuation ─────────────
    await r.step('inventory-valuation-report-reconciles-against-raw-data', async () => {
      const reportRes = await page.evaluate(async (id) => {
        const rep = await window.api.reports.inventory({})
        return rep
      })
      const row = reportRes?.data?.rows?.find((x) => x.productName === `${TEST_PREFIX} SOProduct ${suffix}`)
      const rawInv = h.withDb((db) => db.prepare('SELECT quantity, averageCost FROM Inventory WHERE productId = ?').get(soProductId))
      const expectedValue = rawInv ? Math.round(rawInv.quantity * rawInv.averageCost * 100) / 100 : null
      r.log('inventory-report-row-found', !!row, JSON.stringify(row))
      if (row && rawInv) {
        r.log('inventory-report-stock-matches-raw-quantity', row.currentStock === rawInv.quantity, `report=${row.currentStock} raw=${rawInv.quantity}`)
        r.log('inventory-report-value-matches-raw-computation', Math.abs(row.stockValue - expectedValue) < 0.01, `report=${row.stockValue} expected=${expectedValue}`)
      }
    })

    // ── Customer ledger report reconciliation ───────────────────────────────
    await r.step('customer-ledger-report-reconciles-against-raw-ledger', async () => {
      if (!soCustomerId) return r.log('skipped-no-customer-id', false)
      const rawBalance = h.withDb((db) => {
        const agg = db.prepare('SELECT SUM(debitAmount) as d, SUM(creditAmount) as c FROM CustomerLedger WHERE customerId = ?').get(soCustomerId)
        return (agg.d || 0) - (agg.c || 0)
      })
      const reportRes = await page.evaluate(async (customerId) => window.api.reports.customerLedger({ customerId }), soCustomerId)
      const closing = reportRes?.data?.closingBalance
      r.log('customer-ledger-report-closing-matches-raw-sum', Math.abs(closing - rawBalance) < 0.01, `report=${closing} raw=${rawBalance}`)
    })

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    h.withDb((db) => {
      db.exec("UPDATE Setting SET settingValue = 'false' WHERE settingKey = 'allow_negative_inventory'")
      for (const id of soInvoiceIds) {
        db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id)
        try { db.prepare('UPDATE Invoice SET salesOrderId = NULL WHERE id = ?').run(id) } catch { /* ignore */ }
        try { db.prepare('DELETE FROM Invoice WHERE id = ?').run(id) } catch { /* ignore */ }
      }
      if (partialSoId) {
        db.prepare('DELETE FROM SalesOrderItem WHERE salesOrderId = ?').run(partialSoId)
        try { db.prepare('DELETE FROM SalesOrder WHERE id = ?').run(partialSoId) } catch { /* ignore */ }
      }
    })
    const cleanup = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleanup))
    const cleanup2 = h.cleanupByNamePrefix('E2E Grp166 AAA-')
    console.log('search-cap-cleanup:', JSON.stringify(cleanup2))
    h.checkpointWal()
    h.randomizeAdminPassword()
    await h.closeApp(app)
  }

  const s = r.summary()
  console.log(`\nGROUP B INVENTORY/SALES AUDIT: ${s.pass}/${s.total} passed`)
  if (s.fail > 0) process.exitCode = 1
}

run().catch((e) => { console.error(e); process.exitCode = 1 })
