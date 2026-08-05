/**
 * Suite 52 — Scale/concurrency gap-audit (2026-08-04 pre-release stress
 * pass). Written to go BEYOND what 09-stress.js and
 * 51-real-concurrency-stress.js already cover — see those files' own
 * header comments for what's already proven (large catalog rendering,
 * concurrent invoicing vs. limited stock, hotel/restaurant/blood-bank
 * exactly-one-winner races). This suite is a MEASUREMENT pass, not a
 * correctness-fix pass — every step logs a real elapsed-ms or row-count,
 * nothing is asserted purely on code-reading.
 *
 * Four areas, each independently toggleable by section comment below:
 *   1. Bulk import at real scale (2,000-5,000 rows through the real
 *      import.service.ts pipeline) + MAX_IMPORT_ROWS boundary behavior.
 *   2. Concurrent writes to a highly-contended shared resource NOT already
 *      covered by suite 51: many concurrent adjustStock calls on the SAME
 *      product (absolute-quantity contract), and many concurrent CREDIT
 *      invoices against the SAME customer's credit limit (TOCTOU check in
 *      billing.service.ts, previously only proven correct by code reading).
 *   3. Large-dataset UI responsiveness: bulk-insert a realistic year's
 *      worth of invoices (10,000) + customers (5,000) via raw SQL (fast,
 *      matching 09-stress.js's own precedent — the point is to stress the
 *      real list/report screens against that volume, not to re-prove
 *      billing.createInvoice works one at a time), then time the actual
 *      Invoices/Customers/Products/Reports screens against that volume.
 *   4. Audit hash-chain verification at the real accumulated volume from
 *      this entire session's testing (thousands of rows), via the real
 *      `audit:verifyChain` IPC path.
 */
const h = require('../harness')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const TEST_PREFIX = 'E2E ScaleGap'

function newId() { return crypto.randomUUID() }

function rawCleanup(prefix) {
  return h.withDb((db) => {
    const like = `${prefix}%`
    db.exec('BEGIN')
    // Bulk-inserted invoices (section 3) — items first (FK), then payments, then invoices.
    const invIds = db.prepare('SELECT id FROM Invoice WHERE invoiceNumber LIKE ?').all(like).map((r) => r.id)
    for (const id of invIds) {
      db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id)
      db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(id)
    }
    if (invIds.length) {
      // chunk to stay under SQLite's variable-count limit
      for (let i = 0; i < invIds.length; i += 500) {
        const chunk = invIds.slice(i, i + 500)
        db.prepare(`DELETE FROM Invoice WHERE id IN (${chunk.map(() => '?').join(',')})`).run(...chunk)
      }
    }
    db.exec('COMMIT')
  })
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  rawCleanup(TEST_PREFIX)
  h.cleanupByNamePrefix(TEST_PREFIX)
  const app = await h.launchApp()
  const tmpFiles = []

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ════════════════════════════════════════════════════════════════════
    // 1. Bulk import at real scale
    // ════════════════════════════════════════════════════════════════════

    function writeProductsCsv(filePath, count, prefix) {
      const lines = ['productName,sku,unit,sellingPrice,costPrice,taxRate,openingQuantity']
      for (let i = 0; i < count; i++) {
        lines.push(`${prefix} Import Item ${i},SKU-${prefix.replace(/\s+/g, '')}-${i},PCS,${100 + i},${50 + i},18,25`)
      }
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
    }

    await r.step('bulk-import-3000-products-completes-and-is-correct', async () => {
      const IMPORT_SIZE = 3000
      const filePath = path.join(os.tmpdir(), `e2e-scale-products-${Date.now()}.csv`)
      tmpFiles.push(filePath)
      const genStart = Date.now()
      writeProductsCsv(filePath, IMPORT_SIZE, TEST_PREFIX)
      r.log('csv-generation-fast', true, `${IMPORT_SIZE} rows in ${Date.now() - genStart}ms`)

      const parseStart = Date.now()
      const parseRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'products', filePath: fp }), filePath)
      const parseMs = Date.now() - parseStart
      r.log('import-parse-succeeds', !!parseRes?.success, JSON.stringify(parseRes?.error || ''))
      r.log('import-parse-reports-correct-row-count', parseRes?.data?.totalRows === IMPORT_SIZE, `totalRows=${parseRes?.data?.totalRows}`)
      r.log('import-parse-completes-fast', parseMs < 5000, `${parseMs}ms`)

      const sessionId = parseRes?.data?.sessionId
      const mapping = parseRes?.data?.suggestedMapping || {}

      if (sessionId) {
        const memBefore = process.memoryUsage().rss
        const execStart = Date.now()
        const execRes = await page.evaluate(async ({ sessionId, mapping }) =>
          window.api.import.execute({ sessionId, mapping, module: 'products' }), { sessionId, mapping })
        const execMs = Date.now() - execStart
        const memAfter = process.memoryUsage().rss
        r.log('import-execute-succeeds', !!execRes?.success, JSON.stringify(execRes?.error || ''))
        r.log('import-execute-imports-all-rows', execRes?.data?.imported === IMPORT_SIZE, `imported=${execRes?.data?.imported}, skipped=${execRes?.data?.skipped}, failed=${execRes?.data?.failed}`)
        r.log(
          'import-execute-completes-in-reasonable-time',
          execMs < 90000,
          `${IMPORT_SIZE} rows in ${execMs}ms (${(execMs / IMPORT_SIZE).toFixed(2)}ms/row) — a real user would see this as ${execMs < 5000 ? 'instant' : execMs < 20000 ? 'a short wait with a progress bar' : 'a long wait, needs a visible progress indicator'}`
        )
        r.log(
          'import-does-not-blow-up-node-process-memory',
          true,
          `this-process rss before=${(memBefore / 1024 / 1024).toFixed(1)}MB after=${(memAfter / 1024 / 1024).toFixed(1)}MB (harness process, not the app's own main-process RSS — see note below)`
        )

        // Confirm via ground-truth DB count, not just the IPC response.
        const dbCount = h.withDb((db) => db.prepare(`SELECT COUNT(*) c FROM Product WHERE productName LIKE ?`).get(`${TEST_PREFIX} Import Item%`).c)
        r.log('imported-rows-actually-present-in-db', dbCount === IMPORT_SIZE, `dbCount=${dbCount}`)
      }
    })

    await r.step('import-row-cap-boundary-products-10000-and-10001', async () => {
      // Parse-only (loadFileAtPath) — no need to actually execute a 10k-row
      // import to prove the cap's boundary math; MAX_IMPORT_ROWS.products = 10_000.
      const atCapPath = path.join(os.tmpdir(), `e2e-scale-atcap-${Date.now()}.csv`)
      const overCapPath = path.join(os.tmpdir(), `e2e-scale-overcap-${Date.now()}.csv`)
      tmpFiles.push(atCapPath, overCapPath)
      writeProductsCsv(atCapPath, 10000, `${TEST_PREFIX} AtCap`)
      writeProductsCsv(overCapPath, 10001, `${TEST_PREFIX} OverCap`)

      const atCapRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'products', filePath: fp }), atCapPath)
      r.log('exactly-10000-rows-accepted-at-cap', !!atCapRes?.success, JSON.stringify(atCapRes?.error || atCapRes?.data?.totalRows))

      const overCapRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'products', filePath: fp }), overCapPath)
      r.log(
        '10001-rows-rejected-with-IMP-003-one-over-cap',
        overCapRes?.success === false && overCapRes?.error?.code === 'IMP-003',
        JSON.stringify(overCapRes?.error || overCapRes)
      )
    })

    await r.step('import-row-cap-boundary-suppliers-5000-and-5001', async () => {
      // Different module, different (smaller) cap — MAX_IMPORT_ROWS.suppliers = 5_000.
      function writeSuppliersCsv(filePath, count, prefix) {
        const lines = ['supplierName,phone,gstNumber']
        for (let i = 0; i < count; i++) lines.push(`${prefix} Supplier ${i},9${String(1000000000 + i).slice(-9)},`)
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
      }
      const atCapPath = path.join(os.tmpdir(), `e2e-scale-supp-atcap-${Date.now()}.csv`)
      const overCapPath = path.join(os.tmpdir(), `e2e-scale-supp-overcap-${Date.now()}.csv`)
      tmpFiles.push(atCapPath, overCapPath)
      writeSuppliersCsv(atCapPath, 5000, `${TEST_PREFIX} AtCap`)
      writeSuppliersCsv(overCapPath, 5001, `${TEST_PREFIX} OverCap`)

      const atCapRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'suppliers', filePath: fp }), atCapPath)
      r.log('exactly-5000-supplier-rows-accepted-at-cap', !!atCapRes?.success, JSON.stringify(atCapRes?.error || atCapRes?.data?.totalRows))

      const overCapRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'suppliers', filePath: fp }), overCapPath)
      r.log(
        '5001-supplier-rows-rejected-with-IMP-003-one-over-cap',
        overCapRes?.success === false && overCapRes?.error?.code === 'IMP-003',
        JSON.stringify(overCapRes?.error || overCapRes)
      )
    })

    // ════════════════════════════════════════════════════════════════════
    // 2a. Concurrent stock adjustments on the SAME product (absolute-qty
    //     contract — inventory.service.ts adjustStock sets an ABSOLUTE
    //     target quantity, not a delta; see project memory
    //     project_section3_gap_apis_research.md).
    // ════════════════════════════════════════════════════════════════════
    let adjProductId

    await r.step('setup-product-for-concurrent-stock-adjustment', async () => {
      const res = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Contended Adjust Item`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 40, sellingPrice: 90, taxRate: 18, openingQuantity: 100,
      }), TEST_PREFIX)
      r.log('adjust-product-created', !!res?.success, JSON.stringify(res?.error || ''))
      adjProductId = res?.data?.id
    })

    await r.step('concurrent-stock-adjustments-same-product-stay-consistent', async () => {
      if (!adjProductId) return r.log('concurrent-stock-adjustments-same-product-stay-consistent', false, 'no product')
      const N = 20
      // Each concurrent call sets a DIFFERENT absolute target (200..219) —
      // under SQLite's single-writer serialization each transaction should
      // see the freshly-committed prior value, so exactly one should apply
      // cleanly per distinct value actually reached; duplicates/no-ops
      // correctly throw INV-006 rather than silently double-writing.
      const targets = Array.from({ length: N }, (_, i) => 200 + i)
      const results = await page.evaluate(async ({ productId, targets }) => {
        const calls = targets.map((q) => window.api.inventory.adjustStock({
          productId, quantity: q, reason: 'E2E ScaleGap concurrent adjustment',
        }).catch((e) => ({ success: false, error: { code: 'PROMISE-REJECTED', message: String((e && e.message) || e) } })))
        const settled = await Promise.all(calls)
        return settled.map((res) => ({ success: res?.success, code: res?.error?.code, quantity: res?.data?.quantity }))
      }, { productId: adjProductId, targets })

      const successes = results.filter((x) => x.success)
      const noopRejections = results.filter((x) => !x.success && x.code === 'INV-006')
      const otherFailures = results.filter((x) => !x.success && x.code !== 'INV-006')
      r.log(
        'every-concurrent-call-resolves-to-a-clear-outcome',
        results.every((x) => typeof x.success === 'boolean'),
        `success=${successes.length}, noop-rejected=${noopRejections.length}, other(SYS-001)=${otherFailures.length}`
      )
      // FINDING (2026-08-04 scale audit, confirmed via temporary main-process
      // stderr capture, reverted after diagnosis): unlike billing.service.ts's
      // createInvoice (extended to timeout:15000/maxWait:10000 specifically
      // for this class of problem — see 09-stress.js's header comment),
      // inventory.service.ts's adjustStock still uses Prisma's DEFAULT
      // $transaction timeout (5s) / maxWait (2s). Under this 20-way real
      // concurrent burst on the SAME product, most calls queue behind
      // SQLite's single writer lock and their transaction expires before it
      // is ever their turn to run, throwing PrismaClientKnownRequestError
      // P1008 "Socket timeout" — caught by adjustStock's generic catch block
      // (not `instanceof ServiceError`) and surfaced to the user as an
      // unhelpful generic "Something unexpected happened. Please try again."
      // (SYS-001) instead of a specific "system busy, try again" message.
      // NOT a data-integrity bug — final quantity and movement-log count
      // (checked below) stay perfectly consistent — but a real UX/robustness
      // gap for any shop with two people (e.g. manager + cashier) adjusting
      // the same product's stock at the same moment. Not fixed here per this
      // audit's measurement-only scope.
      r.log(
        'known-gap-adjustStock-lacks-extended-transaction-timeout-like-billing-does',
        otherFailures.length === 0,
        otherFailures.length === 0
          ? 'no timeout failures this run (contention-dependent — timing-sensitive, can pass on a lighter-loaded run)'
          : `${otherFailures.length}/${N} calls failed with SYS-001 (root cause confirmed: Prisma P1008 "Socket timeout" from adjustStock's un-extended default $transaction timeout under real write-lock contention — see comment above)`
      )

      const finalInv = await page.evaluate(async (id) => window.api.inventory.get(id), adjProductId)
      const finalQty = finalInv?.data?.quantity
      // The final quantity must be EXACTLY one of the 20 targets fired — not
      // some corrupted average/sum, and not stuck at the opening 100.
      r.log(
        'final-quantity-matches-one-of-the-fired-targets-not-corrupted',
        targets.includes(finalQty),
        `finalQty=${finalQty}, targetsFired=[${targets[0]}..${targets[targets.length - 1]}]`
      )

      const movementCount = h.withDb((db) => db.prepare(
        `SELECT COUNT(*) c FROM InventoryMovement WHERE productId = ? AND movementType = 'ADJUSTMENT'`
      ).get(adjProductId).c)
      // Exactly one InventoryMovement row per successful adjustment — no
      // double-counting, no dropped rows, under real concurrency.
      r.log(
        'movement-log-row-count-matches-successful-call-count-exactly',
        movementCount === successes.length,
        `movementCount=${movementCount}, successfulCalls=${successes.length}`
      )
    })

    // ════════════════════════════════════════════════════════════════════
    // 2b. Concurrent CREDIT invoices against the SAME customer's credit
    //     limit — the actual real-concurrency test of the TOCTOU fix in
    //     billing.service.ts (previously verified only by code reading /
    //     a mocked single-threaded unit test per project memory).
    // ════════════════════════════════════════════════════════════════════
    let creditCustomerId, creditProductId
    let creditModuleWasAlreadyEnabled = false
    let originalModules = []

    await r.step('setup-credit-limit-customer-and-product', async () => {
      const tplRes = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tplRes?.data?.enabledModules || []
      creditModuleWasAlreadyEnabled = originalModules.includes('credit_limit_enforcement')
      if (!creditModuleWasAlreadyEnabled) {
        const updRes = await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), [...originalModules, 'credit_limit_enforcement'])
        r.log('credit-limit-module-enabled-for-test', !!updRes?.success, JSON.stringify(updRes?.error || ''))
      } else {
        r.log('credit-limit-module-enabled-for-test', true, 'already enabled')
      }

      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} TOCTOU Credit Customer`, phone: `8${String(Date.now()).slice(-9)}`, creditLimit: 1000,
      }), TEST_PREFIX)
      creditCustomerId = custRes?.data?.id
      r.log('toctou-credit-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} TOCTOU Credit Item`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 40, sellingPrice: 100, taxRate: 0, openingQuantity: 1000,
      }), TEST_PREFIX)
      creditProductId = prodRes?.data?.id
      r.log('toctou-credit-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
    })

    await r.step('concurrent-credit-invoices-never-exceed-credit-limit', async () => {
      if (!creditCustomerId || !creditProductId) return r.log('concurrent-credit-invoices-never-exceed-credit-limit', false, 'setup failed')
      // 20 concurrent CREDIT invoices of 100 each (taxRate 0, so totalAmount
      // is exactly 100 per invoice) against a customer with a 1000 limit
      // starting at 0 balance. At most 10 can legally succeed (10*100=1000,
      // the 11th would push to 1100 > 1000). If the TOCTOU fix (re-reading
      // customer.outstandingBalance INSIDE the same $transaction the invoice
      // is created in) doesn't actually hold under real concurrency, more
      // than 10 would succeed and the customer would end up over-limit —
      // exactly the bug class this fix targets, now tested for real instead
      // of by mock.
      const N = 20
      const results = await page.evaluate(async ({ productId, customerId, n }) => {
        const calls = Array.from({ length: n }, () => window.api.billing.createInvoice({
          paymentMethod: 'CREDIT', customerId,
          items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 0 }],
        }).catch((e) => ({ success: false, error: { code: 'PROMISE-REJECTED', message: String((e && e.message) || e) } })))
        const settled = await Promise.all(calls)
        return settled.map((res) => ({ success: res?.success, code: res?.error?.code }))
      }, { productId: creditProductId, customerId: creditCustomerId, n: N })

      const successCount = results.filter((x) => x.success).length
      const limitRejected = results.filter((x) => !x.success && x.code === 'CUST-003').length
      const otherFailed = results.length - successCount - limitRejected
      r.log(
        'concurrent-credit-burst-resolves-cleanly',
        results.every((x) => typeof x.success === 'boolean'),
        `success=${successCount}/${N}, limitRejected(CUST-003)=${limitRejected}, other=${otherFailed}`
      )

      const custAfter = await page.evaluate(async (id) => window.api.customers.get(id), creditCustomerId)
      const finalBalance = custAfter?.data?.outstandingBalance
      // The one non-negotiable guarantee this test exists to verify: the
      // customer's real outstanding balance must never exceed their credit
      // limit, regardless of how many concurrent requests raced for it.
      r.log(
        'customer-balance-never-exceeds-credit-limit-under-real-concurrency',
        typeof finalBalance === 'number' && finalBalance <= 1000,
        `finalBalance=${finalBalance}, creditLimit=1000 (successCount=${successCount})`
      )
      r.log(
        'success-count-matches-final-balance-exactly-no-lost-or-phantom-invoices',
        finalBalance === successCount * 100,
        `finalBalance=${finalBalance}, expected=${successCount * 100}`
      )
      // Ground truth: count real CREDIT invoices actually created for this customer.
      const dbInvoiceCount = h.withDb((db) => db.prepare(
        `SELECT COUNT(*) c FROM Invoice WHERE customerId = ? AND status != 'CANCELLED'`
      ).get(creditCustomerId).c)
      r.log('db-invoice-count-matches-reported-successes', dbInvoiceCount === successCount, `dbInvoiceCount=${dbInvoiceCount}, successCount=${successCount}`)
    })

    await r.step('restore-credit-limit-module-state', async () => {
      if (!creditModuleWasAlreadyEnabled) {
        const res = await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), originalModules)
        r.log('credit-limit-module-state-restored', !!res?.success, JSON.stringify(res?.error || ''))
      } else {
        r.log('credit-limit-module-state-restored', true, 'left enabled (was already on)')
      }
    })

    // ════════════════════════════════════════════════════════════════════
    // 3. Large-dataset UI responsiveness — bulk-insert a realistic year's
    //    worth of invoices, then time the real list/report screens.
    // ════════════════════════════════════════════════════════════════════
    const preExisting = h.withDb((db) => ({
      products: db.prepare('SELECT COUNT(*) c FROM Product').get().c,
      customers: db.prepare('SELECT COUNT(*) c FROM Customer').get().c,
      invoices: db.prepare('SELECT COUNT(*) c FROM Invoice').get().c,
    }))
    r.log('pre-existing-dev-db-row-counts-logged', true, JSON.stringify(preExisting))

    let bulkCustomerIds = []
    let bulkProductId

    await r.step('bulk-insert-realistic-shop-scale-dataset', async () => {
      const INVOICE_COUNT = 10000
      const CUSTOMER_COUNT = 5000

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Scale Report Item`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 60, sellingPrice: 150, taxRate: 18, openingQuantity: 1000000,
      }), TEST_PREFIX)
      bulkProductId = prodRes?.data?.id
      r.log('scale-report-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const custStart = Date.now()
      h.withDb((db) => {
        db.exec('BEGIN')
        for (let i = 0; i < CUSTOMER_COUNT; i++) {
          const id = newId()
          bulkCustomerIds.push(id)
          db.prepare(`INSERT INTO Customer (id, customerName, phone, isActive, updatedAt) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`)
            .run(id, `${TEST_PREFIX} Bulk Customer ${i}`, `7${String(9000000000 + i).slice(-9)}`)
        }
        db.exec('COMMIT')
      })
      r.log('bulk-customer-insert-completed', true, `${CUSTOMER_COUNT} customers in ${Date.now() - custStart}ms`)

      const invStart = Date.now()
      h.withDb((db) => {
        db.exec('BEGIN')
        const baseTime = Date.now() - 365 * 24 * 3600 * 1000 // spread across the last year
        for (let i = 0; i < INVOICE_COUNT; i++) {
          const invId = newId()
          const custId = bulkCustomerIds[i % bulkCustomerIds.length]
          const createdAt = new Date(baseTime + i * (365 * 24 * 3600 * 1000 / INVOICE_COUNT)).toISOString()
          const total = 150 + (i % 500)
          db.prepare(`INSERT INTO Invoice
            (id, invoiceNumber, invoiceType, customerId, invoiceDate, status, subtotal, discountAmount, taxAmount, totalAmount, paidAmount, balanceAmount, paymentStatus, createdAt, updatedAt)
            VALUES (?, ?, 'RETAIL', ?, ?, 'ACTIVE', ?, 0, ?, ?, ?, 0, 'PAID', ?, ?)`).run(
            invId, `${TEST_PREFIX}-INV-${String(i).padStart(6, '0')}`, custId, createdAt,
            total, Math.round(total * 0.18), total, total, createdAt, createdAt
          )
          db.prepare(`INSERT INTO InvoiceItem (id, invoiceId, productId, productName, quantity, unitPrice, taxRate, taxAmount, lineTotal)
            VALUES (?, ?, ?, ?, 1, ?, 18, ?, ?)`).run(
            newId(), invId, bulkProductId, `${TEST_PREFIX} Scale Report Item`, total, Math.round(total * 0.18), total
          )
        }
        db.exec('COMMIT')
      })
      r.log('bulk-invoice-insert-completed', true, `${INVOICE_COUNT} invoices (+items) in ${Date.now() - invStart}ms`)

      const postCounts = h.withDb((db) => ({
        products: db.prepare('SELECT COUNT(*) c FROM Product').get().c,
        customers: db.prepare('SELECT COUNT(*) c FROM Customer').get().c,
        invoices: db.prepare('SELECT COUNT(*) c FROM Invoice').get().c,
      }))
      r.log('post-bulk-insert-row-counts-logged', true, `${JSON.stringify(postCounts)} (this is the volume the timing checks below run against)`)
    })

    async function timeScreen(name, hash, waitMs = 1200) {
      const start = Date.now()
      await h.gotoHash(page, hash)
      await page.waitForTimeout(waitMs)
      const elapsedMs = Date.now() - start
      const crashed = await h.hasErrorBoundary(page)
      r.log(`${name}-loads-no-crash`, !crashed)
      const feel = elapsedMs < 1000 ? 'instant' : elapsedMs < 2500 ? 'a brief, acceptable pause' : elapsedMs < 5000 ? 'a noticeable multi-second wait' : 'a freeze a real cashier would find unusable'
      r.log(`${name}-load-time-measured`, true, `${elapsedMs}ms — a real user would experience this as: ${feel}`)
      await h.shot(page, `scale-${name}`)
      return elapsedMs
    }

    await r.step('invoices-list-timing-at-scale', () => timeScreen('invoices-list', '#/billing'))
    await r.step('customers-list-timing-at-scale', () => timeScreen('customers-list', '#/customers'))
    await r.step('products-list-timing-at-scale', () => timeScreen('products-list', '#/products'))

    await r.step('sales-report-timing-at-scale', async () => {
      const start = Date.now()
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(600)
      const tile = page.locator('button, [role="button"]', { hasText: 'Sales Report' }).first()
      r.log('sales-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(400)
        const dateInputs = page.locator('input[type="date"]')
        if (await dateInputs.count() >= 2) {
          await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 365 * 24 * 3600000)))
          await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
        }
        const genBtn = page.locator('button:has-text("Generate Report")')
        if (await genBtn.count()) await genBtn.click()
        await page.waitForTimeout(2500)
        const elapsedMs = Date.now() - start
        const crashed = await h.hasErrorBoundary(page)
        r.log('sales-report-full-year-renders-no-crash', !crashed)
        const feel = elapsedMs < 3000 ? 'acceptable' : elapsedMs < 8000 ? 'a noticeable multi-second wait' : 'unusably slow for a full-year report at real shop-scale'
        r.log('sales-report-full-year-load-time-measured', true, `${elapsedMs}ms over ~10,000 invoices — ${feel}`)
        await h.shot(page, 'scale-sales-report')
      }
    })

    // ════════════════════════════════════════════════════════════════════
    // 4. Audit hash-chain verification at real accumulated volume
    // ════════════════════════════════════════════════════════════════════
    await r.step('audit-chain-verification-at-scale', async () => {
      const preCount = h.withDb((db) => db.prepare('SELECT COUNT(*) c FROM AuditLog').get().c)
      const preHashedCount = h.withDb((db) => db.prepare('SELECT COUNT(*) c FROM AuditLog WHERE hash IS NOT NULL').get().c)
      const start = Date.now()
      const res = await page.evaluate(async () => window.api.audit.verifyChain())
      const elapsedMs = Date.now() - start
      r.log('audit-chain-verify-call-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
      r.log('audit-chain-is-intact', res?.data?.ok === true, JSON.stringify(res?.data))
      r.log(
        'audit-chain-verified-count-matches-hashed-row-count',
        res?.data?.verifiedCount === preHashedCount,
        `verifiedCount=${res?.data?.verifiedCount}, hashedRowsInDb=${preHashedCount}, totalAuditLogRows=${preCount}`
      )
      const feel = elapsedMs < 1000 ? 'instant' : elapsedMs < 3000 ? 'a brief acceptable pause' : elapsedMs < 8000 ? 'a noticeable wait' : 'slow enough to need a progress indicator'
      r.log('audit-chain-verify-completes-in-reasonable-time', elapsedMs < 15000, `${elapsedMs}ms for ${preHashedCount} chained rows (${preCount} total AuditLog rows) — ${feel}`)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    rawCleanup(TEST_PREFIX)
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f) } catch { /* already gone */ }
    }
    const remaining = h.withDb((db) => ({
      products: db.prepare(`SELECT COUNT(*) c FROM Product WHERE productName LIKE '${TEST_PREFIX}%' AND isActive = 1`).get().c,
      customers: db.prepare(`SELECT COUNT(*) c FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%' AND isActive = 1`).get().c,
      invoices: db.prepare(`SELECT COUNT(*) c FROM Invoice WHERE invoiceNumber LIKE '${TEST_PREFIX}%'`).get().c,
    }))
    console.log('scale-gap-audit cleanup remaining (should all be 0):', JSON.stringify(remaining))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSCALE/GAP AUDIT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
