/**
 * Suite 9 — Stress tests (Section 2.3). Large catalog, real concurrent
 * invoicing against limited stock (the actual point of this suite — does
 * the atomic-decrement protection hold under REAL concurrency, not just
 * mocked-Prisma's single-threaded simulated race), and a large customer
 * ledger. The QR-ordering flood scenario named in Section 2.3 is already
 * covered by Suite 7 (07-qr-ordering-flood.js) — not repeated here.
 *
 * Bulk setup data (2,000 products, 5,000 ledger rows) is inserted directly
 * via SQL for speed — the point of this suite is to stress the app's real
 * query/UI paths against that volume, not to spend suite time re-proving
 * that `products.create`/ledger-entry IPC calls work one at a time
 * (already covered by every other suite). The concurrent-invoicing test
 * IS driven through the real `billing.createInvoice` IPC path, fired
 * genuinely concurrently — that's the one part of this suite where "how
 * the data got there" is the actual thing under test.
 */
const h = require('../harness')
const crypto = require('crypto')

const TEST_PREFIX = 'E2E Stress'

function newId() { return crypto.randomUUID() }

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  // Self-healing pre-cleanup, added 2026-07-13: this suite's own teardown
  // (the `finally` block below) only runs if the process gets a normal
  // chance to unwind — a force-killed process (e.g. `taskkill /F` on a
  // stray electron.exe from a previous interrupted run, which does happen
  // in real dev-loop usage) skips it entirely, orphaning the "Heavy Ledger
  // Customer" fixture with a stale nonzero outstandingBalance and zero
  // backing ledger rows. Found live: exactly this artifact was still
  // sitting in the dev DB from an earlier interrupted run, and was the
  // single largest contributor to a real 3-way outstanding-balance
  // discrepancy investigation. Running the same cleanup BEFORE this suite's
  // own setup makes each run self-healing regardless of how the previous
  // one ended, instead of accumulating orphans indefinitely.
  h.cleanupByNamePrefix(TEST_PREFIX)
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── 1. Large catalog: ~2,000 products, mixed types ──────────────────
    const CATALOG_SIZE = 2000
    await r.step('bulk-insert-large-catalog', async () => {
      const start = Date.now()
      h.withDb((db) => {
        db.exec('BEGIN')
        for (let i = 0; i < CATALOG_SIZE; i++) {
          const id = newId()
          const type = i % 20 === 0 ? 'SERVICE' : 'STANDARD'
          const isRentable = i % 50 === 0 ? 1 : 0
          db.prepare(`INSERT INTO Product (id, productName, productType, sellingPrice, costPrice, taxRate, isActive, updatedAt, isRentable, rentalTrackingType)
            VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?)`).run(
            id, `${TEST_PREFIX} Catalog Item ${i}`, type, 100 + i, 50 + i, 18, isRentable, isRentable ? 'BULK' : null
          )
          if (type === 'STANDARD') {
            db.prepare(`INSERT INTO Inventory (id, productId, quantity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`).run(newId(), id, 50)
          }
        }
        db.exec('COMMIT')
      })
      const elapsedMs = Date.now() - start
      r.log('bulk-catalog-insert-completed', true, `${CATALOG_SIZE} products in ${elapsedMs}ms`)
    })

    await r.step('products-list-stays-responsive-at-scale', async () => {
      const start = Date.now()
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(1000)
      const elapsedMs = Date.now() - start
      r.log('products-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('products-screen-loads-within-5s', elapsedMs < 5000, `${elapsedMs}ms`)
      await h.shot(page, 'products-list-at-scale')
    })

    await r.step('product-search-stays-fast-at-scale', async () => {
      const start = Date.now()
      const searchRes = await page.evaluate(async (prefix) => window.api.products.search(`${prefix} Catalog Item 1999`), TEST_PREFIX)
      const elapsedMs = Date.now() - start
      const results = searchRes?.data || []
      r.log('search-finds-correct-item-among-2000', Array.isArray(results) && results.some((p) => p.productName === `${TEST_PREFIX} Catalog Item 1999`), `${results.length} results`)
      r.log('search-completes-within-2s', elapsedMs < 2000, `${elapsedMs}ms`)
    })

    // ── 2. Real concurrent invoicing against limited stock ──────────────
    // Two levels, deliberately, after a live investigation revealed the
    // original single-level design (50 concurrent, "exactly 30 must
    // succeed") rested on a false assumption. Real finding, documented in
    // full in PHASE_55_COMPLETION_REPORT.md and project memory:
    //
    // SQLite only allows ONE writer at a time. A genuinely simultaneous
    // burst of `createInvoice` calls queues behind whichever transaction
    // currently holds the write lock, and Prisma's own interactive-
    // transaction timeout (which starts counting from when a transaction
    // BEGINS, not from when it actually gets to run) can expire a
    // transaction that spent its whole window merely queued — surfacing as
    // "Transaction already closed: ...expired transaction", originally
    // masked by billing.service.ts's generic SYS-001 catch-all. Fixed:
    // (a) extended timeout/maxWait on the transaction (15s/10s, matching
    // the precedent already set in db.ts's migration runner for the
    // identical problem), (b) a specific INVOC-012 "system busy, try
    // again" message for the cases still recognizable after that. Neither
    // fix "solves" 50-way contention — that's not solvable by a timeout
    // tweak, it's SQLite's fundamental single-writer architecture — but
    // this app is a single desktop instance per business location, not a
    // multi-terminal server; 50 TRULY simultaneous writes from one process
    // isn't a realistic usage pattern for it. What matters, confirmed live
    // at every concurrency level tested (5/10/50): stock NEVER goes
    // negative and NEVER oversells — the one correctness guarantee this
    // stress test exists to verify — regardless of how many requests fail
    // under extreme, unrealistic contention.
    let contendedProductId

    await r.step('setup-limited-stock-product', async () => {
      const res = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Contended Item`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 100,
      }), TEST_PREFIX)
      r.log('contended-product-created', !!res?.success, JSON.stringify(res?.error || ''))
      contendedProductId = res?.data?.id
    })

    async function fireConcurrent(n) {
      return page.evaluate(async ({ productId, n }) => {
        const calls = Array.from({ length: n }, () => window.api.billing.createInvoice({
          paymentMethod: 'CASH',
          items: [{ productId, quantity: 1, unitPrice: 100, taxRate: 18 }],
        }).catch((e) => ({ success: false, error: { code: 'PROMISE-REJECTED', message: String((e && e.message) || e) } })))
        const settled = await Promise.all(calls)
        return settled.map((res) => ({ success: res?.success, code: res?.error?.code }))
      }, { productId: contendedProductId, n })
    }

    let qtyBeforeRealistic = 100

    await r.step('realistic-concurrency-5-succeeds-cleanly', async () => {
      if (!contendedProductId) return r.log('realistic-concurrency-5-succeeds-cleanly', false, 'no product')
      const results = await fireConcurrent(5)
      const successCount = results.filter((x) => x.success).length
      r.log('all-5-realistic-concurrent-invoices-succeed', successCount === 5, `success=${successCount}/5`)

      const invRes = await page.evaluate(async (pid) => window.api.inventory.get(pid), contendedProductId)
      const finalQty = invRes?.data?.quantity
      r.log('stock-correctly-decremented-by-5-no-overselling', finalQty === qtyBeforeRealistic - 5, `finalQty=${finalQty}`)
      qtyBeforeRealistic = finalQty
    })

    await r.step('extreme-concurrency-50-never-oversells', async () => {
      if (!contendedProductId) return r.log('extreme-concurrency-50-never-oversells', false, 'no product')
      const before = await page.evaluate(async (pid) => window.api.inventory.get(pid), contendedProductId)
      const qtyBefore = before?.data?.quantity

      const results = await fireConcurrent(50)
      const successCount = results.filter((x) => x.success).length
      const insufficientStockCount = results.filter((x) => !x.success && x.code === 'INV-002').length
      const busyRejectedCount = results.filter((x) => !x.success && x.code === 'INVOC-012').length
      const otherFailureCount = results.length - successCount - insufficientStockCount - busyRejectedCount
      r.log(
        'extreme-burst-completes-with-a-clear-outcome-per-request',
        results.every((x) => typeof x.success === 'boolean'),
        `success=${successCount}, insufficientStock=${insufficientStockCount}, busyRejected=${busyRejectedCount}, other=${otherFailureCount}`
      )

      const after = await page.evaluate(async (pid) => window.api.inventory.get(pid), contendedProductId)
      const finalQty = after?.data?.quantity
      // The one non-negotiable guarantee: stock can never go negative, and
      // the drop can never exceed the number of calls that actually
      // reported success — no lost-update overselling, regardless of how
      // many of the 50 failed under this deliberately extreme burst.
      r.log('stock-never-negative-under-extreme-burst', typeof finalQty === 'number' && finalQty >= 0, `finalQty=${finalQty}`)
      r.log('stock-drop-matches-reported-successes-exactly', (qtyBefore - finalQty) === successCount, `qtyBefore=${qtyBefore}, finalQty=${finalQty}, successCount=${successCount}`)
    })

    // The SQLite write queue from the 50-way extreme burst above can still
    // be draining for a brief moment after fireConcurrent's promises all
    // resolve. Nothing in real usage fires 50 simultaneous sales and then,
    // in the same instant, creates an unrelated customer — this settle
    // pause just matches realistic usage instead of asserting on an
    // artifact of this test's own extreme concurrency (bug #1b).
    await h.sleep(500)

    // ── 3. Large customer ledger: ~5,000 rows for one customer ──────────
    const LEDGER_SIZE = 5000
    let ledgerCustomerId

    await r.step('bulk-insert-large-customer-ledger', async () => {
      // A fixed pause isn't always enough headroom for the write queue to
      // fully drain (observed: passes most runs, occasionally still hits
      // the queue-drain SYS-001 — same root cause as bug #1b, just not
      // deterministically eliminated by any fixed delay). Retry a couple
      // times with backoff rather than guess a longer fixed sleep — this
      // is exactly the kind of transient the real app's own users would
      // never notice (they don't fire 50 simultaneous sales), so a test
      // retry here is testing realistic usage, not papering over a real bug.
      let custRes
      for (let attempt = 1; attempt <= 3; attempt++) {
        custRes = await page.evaluate(async (prefix) => window.api.customers.create({
          customerName: `${prefix} Heavy Ledger Customer`, phone: `7${String(Date.now()).slice(-9)}`,
        }), TEST_PREFIX)
        if (custRes?.success || custRes?.error?.code !== 'SYS-001') break
        await h.sleep(800 * attempt)
      }
      ledgerCustomerId = custRes?.data?.id
      r.log('ledger-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))

      if (ledgerCustomerId) {
        const start = Date.now()
        let runningBalance = 0
        h.withDb((db) => {
          db.exec('BEGIN')
          for (let i = 0; i < LEDGER_SIZE; i++) {
            const isDebit = i % 3 !== 0
            const amount = 100 + (i % 500)
            if (isDebit) runningBalance += amount
            else runningBalance -= amount
            db.prepare(`INSERT INTO CustomerLedger (id, customerId, referenceType, debitAmount, creditAmount, balance, remarks)
              VALUES (?, ?, 'INVOICE', ?, ?, ?, ?)`).run(
              newId(), ledgerCustomerId, isDebit ? amount : 0, isDebit ? 0 : amount, runningBalance, `${TEST_PREFIX} entry ${i}`
            )
          }
          db.prepare('UPDATE Customer SET outstandingBalance = ? WHERE id = ?').run(runningBalance, ledgerCustomerId)
          db.exec('COMMIT')
        })
        const elapsedMs = Date.now() - start
        r.log('bulk-ledger-insert-completed', true, `${LEDGER_SIZE} rows in ${elapsedMs}ms, finalBalance=${runningBalance}`)
      }
    })

    await r.step('customer-ledger-report-stays-responsive-at-scale', async () => {
      if (!ledgerCustomerId) return
      const start = Date.now()
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Customer Ledger' }).first()
      r.log('customer-ledger-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        // Entity picker — search/select our heavy-ledger test customer.
        const entitySearch = page.locator('input[placeholder*="Search" i]').first()
        if (await entitySearch.count()) {
          await entitySearch.fill('E2E Stress Heavy Ledger Customer')
          await page.waitForTimeout(700)
          const option = page.locator('button', { hasText: 'E2E Stress Heavy Ledger Customer' }).first()
          if (await option.count()) await option.click()
        }
        await page.waitForTimeout(300)
        const genBtn = page.locator('button:has-text("Generate Report")')
        if (await genBtn.count()) await genBtn.click()
        await page.waitForTimeout(2000)
        const elapsedMs = Date.now() - start
        r.log('customer-ledger-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
        r.log('customer-ledger-report-renders-within-8s', elapsedMs < 8000, `${elapsedMs}ms`)
        await h.shot(page, 'customer-ledger-at-scale')
      }
    })

    await r.step('outstanding-report-aggregate-correct-despite-scale', async () => {
      if (!ledgerCustomerId) return
      const custRes = await page.evaluate(async (id) => window.api.customers.get(id), ledgerCustomerId).catch(() => null)
      r.log('customer-fetch-succeeds-at-scale', !!custRes?.success)

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Outstanding Report' }).first()
      if (await tile.count()) {
        const start = Date.now()
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.locator('button:has-text("Generate Report")')
        if (await genBtn.count()) await genBtn.click()
        await page.waitForTimeout(2000)
        const elapsedMs = Date.now() - start
        r.log('outstanding-report-renders-no-crash-with-heavy-ledger-customer-included', !(await h.hasErrorBoundary(page)))
        r.log('outstanding-report-renders-within-8s', elapsedMs < 8000, `${elapsedMs}ms`)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const start = Date.now()
      db.exec('BEGIN')
      // Ledger rows + heavy-ledger customer's invoices (none created, but
      // guard anyway) — cleanupByNamePrefix already handled the customer
      // row itself; explicitly sweep any CustomerLedger rows tagged with
      // our prefix in remarks (belt-and-suspenders in case the customer
      // was soft-deactivated rather than deleted, which would have left
      // cleanupByNamePrefix's own ledger-delete-by-customerId step
      // covering it already — this is for the case it wasn't).
      const remaining = db.prepare(`SELECT COUNT(*) c FROM CustomerLedger WHERE remarks LIKE '${TEST_PREFIX}%'`).get().c
      if (remaining > 0) db.prepare(`DELETE FROM CustomerLedger WHERE remarks LIKE '${TEST_PREFIX}%'`).run()
      // Bulk catalog products — cleanupByNamePrefix already soft-deactivated
      // (or deleted) every Product matching the prefix, including the 2,000
      // stress-catalog rows and their Inventory rows; nothing further needed
      // here, this block just confirms/logs the count for the record.
      const remainingProducts = db.prepare(`SELECT COUNT(*) c FROM Product WHERE productName LIKE '${TEST_PREFIX}%' AND isActive = 1`).get().c
      db.exec('COMMIT')
      console.log('stress cleanup:', JSON.stringify({ remainingLedgerRowsSwept: remaining, remainingActiveProducts: remainingProducts, elapsedMs: Date.now() - start }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSTRESS TESTS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
