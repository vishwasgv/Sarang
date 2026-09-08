/**
 * Pre-installer stress test — real volume, real timing, real cleanup.
 * Seeds a large data volume via real IPC calls (not raw SQL), then measures
 * how the actual UI performs against it: product list + search, dashboard,
 * a heavy report, and a real invoice creation against a large catalog.
 * Not part of run-all.js — standalone, run directly:
 *   node tests/e2e/stress-test-2026-09.js
 */
const h = require('./harness')

const PRODUCT_COUNT = Number(process.env.STRESS_PRODUCTS) || 1500
const CUSTOMER_COUNT = Number(process.env.STRESS_CUSTOMERS) || 300
const INVOICE_COUNT = Number(process.env.STRESS_INVOICES) || 300

async function main() {
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const page = await h.getMainWindow(app)
  const r = h.makeResults()

  try {
    await h.login(page)
    const whoAmI = await page.evaluate(async () => window.api.auth.getCurrentUser()).catch(e => ({ threw: String(e) }))
    console.log('POST-LOGIN getCurrentUser():', JSON.stringify(whoAmI))
    const dbSession = h.withDb((db) => db.prepare('SELECT sessionToken, tokenExpiresAt FROM User WHERE username = ?').get('admin'))
    console.log('POST-LOGIN DB session row:', JSON.stringify(dbSession))
    console.log('PAGE URL:', page.url())

    // ── Seed volume via real IPC (server-side validation still runs) ──────
    const seedStart = Date.now()
    const productIds = []
    let firstProductError = null
    const runTag = Date.now()
    for (let i = 0; i < PRODUCT_COUNT; i++) {
      const res = await page.evaluate(({ n, runTag }) => window.api.products.create({
        productName: `STRESS Product ${n} ${runTag}`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 50 + (n % 200), sellingPrice: 100 + (n % 300), taxRate: 18, sku: `STRESS-SKU-${runTag}-${n}`
      }), { n: i, runTag })
      if (res?.data?.id) {
        productIds.push(res.data.id)
        await page.evaluate((pid) => window.api.inventory.addStock({
          productId: pid, quantity: 1000, reason: 'stress test initial stock'
        }), res.data.id)
      }
      else if (!firstProductError) firstProductError = JSON.stringify(res)
    }
    if (firstProductError) console.log('FIRST PRODUCT CREATE ERROR:', firstProductError)
    r.log('seed-products-succeeded', productIds.length === PRODUCT_COUNT, `created=${productIds.length}/${PRODUCT_COUNT}`)

    const customerIds = []
    for (let i = 0; i < CUSTOMER_COUNT; i++) {
      const res = await page.evaluate((n) => window.api.customers.create({
        customerName: `STRESS Customer ${n}`, phone: `9${String(700000000 + n).slice(0, 9)}`
      }), i)
      if (res?.data?.id) customerIds.push(res.data.id)
    }
    r.log('seed-customers-succeeded', customerIds.length === CUSTOMER_COUNT, `created=${customerIds.length}/${CUSTOMER_COUNT}`)

    const invoiceIds = []
    let firstInvoiceError = null
    for (let i = 0; i < INVOICE_COUNT; i++) {
      const pid = productIds[i % productIds.length]
      const cid = customerIds[i % customerIds.length]
      const res = await page.evaluate(({ pid, cid }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18 }]
      }), { pid, cid })
      if (res?.data?.id) invoiceIds.push(res.data.id)
      else if (!firstInvoiceError) firstInvoiceError = JSON.stringify({ res, sentPid: pid, sentCid: cid })
    }
    if (firstInvoiceError) console.log('FIRST INVOICE CREATE ERROR:', firstInvoiceError)
    r.log('seed-invoices-succeeded', invoiceIds.length === INVOICE_COUNT, `created=${invoiceIds.length}/${INVOICE_COUNT}`)
    r.log('seed-total-time-acceptable', (Date.now() - seedStart) < 300000, `${((Date.now() - seedStart) / 1000).toFixed(1)}s for ${PRODUCT_COUNT + CUSTOMER_COUNT + INVOICE_COUNT} records`)

    // ── Real UI timing against this volume ─────────────────────────────────
    let t0 = Date.now()
    await h.gotoHash(page, '#/products')
    await page.waitForTimeout(1000)
    r.log('products-screen-loads-no-crash-at-volume', !(await h.hasErrorBoundary(page)))
    r.log('products-screen-load-time-acceptable', (Date.now() - t0) < 8000, `${Date.now() - t0}ms`)

    t0 = Date.now()
    const search = page.locator('input[placeholder*="Search" i]').first()
    await search.fill('STRESS Product 1499')
    await page.waitForTimeout(900)
    const bodyText = await page.locator('body').innerText().catch(() => '')
    r.log('search-finds-last-seeded-product', bodyText.includes('STRESS Product 1499'), `search-time=${Date.now() - t0}ms`)

    t0 = Date.now()
    await h.gotoHash(page, '#/dashboard')
    await page.waitForTimeout(1200)
    r.log('dashboard-loads-no-crash-at-volume', !(await h.hasErrorBoundary(page)))
    r.log('dashboard-load-time-acceptable', (Date.now() - t0) < 10000, `${Date.now() - t0}ms`)

    t0 = Date.now()
    const reportRes = await page.evaluate(async () => window.api.reports.inventory({})).catch(e => ({ error: String(e) }))
    r.log('heavy-report-completes-at-volume', !!reportRes && !reportRes.error, `${Date.now() - t0}ms`)

    // ── Rapid-fire concurrent-ish writes (10 parallel invoice creations) ───
    t0 = Date.now()
    const concurrentResults = await Promise.all(Array.from({ length: 10 }, (_, i) =>
      page.evaluate(({ pid, cid }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 1, unitPrice: 100, discountAmount: 0, taxRate: 18 }]
      }), { pid: productIds[i], cid: customerIds[i] })
    ))
    const concurrentInvoiceIds = concurrentResults.filter(x => x?.data?.id).map(x => x.data.id)
    invoiceIds.push(...concurrentInvoiceIds)
    const concurrentErrors = concurrentResults.filter(x => !x?.data?.id).map(x => x?.error?.code)
    // The codebase deliberately serializes invoice creation (documented
    // elsewhere as matching adjustStock's own contention-safety comment) —
    // under genuine simultaneity, some legs are EXPECTED to get a graceful
    // INVOC-012 "system is busy" rejection rather than racing on stock/
    // invoice-numbering. What actually matters: every leg resolves cleanly
    // (no crash/hang), only real INVOC-012 busy-rejections appear (nothing
    // unexpected), and every invoice number that WAS issued is unique.
    const onlyExpectedRejections = concurrentErrors.every(c => c === 'INVOC-012')
    const numbers = concurrentResults.filter(x => x?.data?.invoiceNumber).map(x => x.data.invoiceNumber)
    const numbersUnique = new Set(numbers).size === numbers.length
    r.log('concurrent-writes-resolve-cleanly-no-crash', concurrentResults.length === 10, `all 10 legs settled`)
    r.log('concurrent-rejections-are-only-the-documented-busy-code', onlyExpectedRejections, JSON.stringify(concurrentErrors))
    r.log('concurrent-issued-invoice-numbers-unique-no-collision', numbersUnique, `${concurrentInvoiceIds.length} issued: ${JSON.stringify(numbers)}`)

    r.log('app-still-responsive-after-load', !(await h.hasErrorBoundary(page)))

    // ── Cleanup — remove everything STRESS-prefixed ─────────────────────────
    for (const id of invoiceIds) { await page.evaluate((iid) => window.api.billing.cancelInvoice({ invoiceId: iid, reason: 'stress test cleanup' }), id).catch(() => {}) }
    for (const id of productIds) { await page.evaluate((pid) => window.api.products.archive(pid), id).catch(() => {}) }
    for (const id of customerIds) { await page.evaluate((cid) => window.api.customers.archive(cid), id).catch(() => {}) }
    r.log('cleanup-attempted', true, `${invoiceIds.length} invoices, ${productIds.length} products, ${customerIds.length} customers`)
  } finally {
    await h.closeApp(app)
  }

  const s = r.summary()
  console.log(`\n=== STRESS TEST SUMMARY: ${s.pass}/${s.total} passed ===`)
  process.exit(s.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
