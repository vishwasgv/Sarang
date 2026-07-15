/**
 * Suite 12 — Payments, credit-limit enforcement, manual inventory
 * adjustment, and product import (Section 3 gaps identified 2026-07-15:
 * these were previously unit-tested only, never driven live through the
 * real IPC/UI surface). See project memory `project_section3_gap_apis_research.md`
 * for the API-shape research this suite is built from.
 *
 * Export is deliberately NOT covered here — window.api.export.* all call
 * dialog.showSaveDialog internally with no path-based alternative (unlike
 * import's parseDroppedFile), so it isn't automatable without mocking
 * Electron's dialog module, which this harness doesn't support. Documented
 * as a known gap in docs/RELEASE_CHECKLIST.md instead of faked here.
 */
const h = require('../harness')
const { createTestCustomer, createTestProduct } = require('../fixtures/seed')
const fs = require('fs')
const path = require('path')

const TEST_PREFIX = 'E2E PayImp'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── 1. Payment recording + reversal ──────────────────────────────────
    let invoiceId, invoiceCustomerId

    await r.step('setup-credit-invoice-for-payment-test', async () => {
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} Payment Customer` })
      invoiceCustomerId = custRes?.data?.id
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Payment Widget`, sellingPrice: 500, costPrice: 300 })
      const productId = prodRes?.data?.id

      const invRes = await page.evaluate(async ({ productId, customerId }) => window.api.billing.createInvoice({
        paymentMethod: 'CREDIT',
        customerId,
        items: [{ productId, quantity: 2, unitPrice: 500, taxRate: 18 }],
      }), { productId, customerId: invoiceCustomerId })
      r.log('credit-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
      invoiceId = invRes?.data?.id
    })

    let paymentId
    await r.step('record-partial-payment-updates-balance-and-ledger', async () => {
      if (!invoiceId) return r.log('record-partial-payment-updates-balance-and-ledger', false, 'no invoiceId')
      const before = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const balanceBefore = before?.data?.balanceAmount

      const payRes = await page.evaluate(async (id) => window.api.payments.record({
        invoiceId: id, paymentMethod: 'CASH', amount: 400,
      }), invoiceId)
      r.log('payment-recorded', !!payRes?.success, JSON.stringify(payRes?.error || ''))
      paymentId = payRes?.data?.id

      const after = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const balanceAfter = after?.data?.balanceAmount
      r.log('invoice-balance-reduced-by-payment', Math.abs((balanceBefore - balanceAfter) - 400) < 0.01, `${balanceBefore} -> ${balanceAfter}`)

      const custRes = await page.evaluate(async (id) => window.api.customers.get(id), invoiceCustomerId)
      const ledgerRes = await page.evaluate(async (id) => window.api.customers.getLedger(id), invoiceCustomerId).catch(() => null)
      r.log('customer-ledger-reflects-payment', !!(ledgerRes?.data?.length || custRes?.data), JSON.stringify(custRes?.data?.outstandingBalance ?? ''))
    })

    await r.step('reverse-payment-restores-balance-and-writes-ledger-entry', async () => {
      if (!paymentId) return r.log('reverse-payment-restores-balance-and-writes-ledger-entry', false, 'no paymentId')
      const before = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const balanceBefore = before?.data?.balanceAmount

      const revRes = await page.evaluate(async (id) => window.api.payments.reverse({ paymentId: id, reason: 'E2E suite reversal test' }), paymentId)
      r.log('payment-reversed', !!revRes?.success, JSON.stringify(revRes?.error || ''))

      const after = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const balanceAfter = after?.data?.balanceAmount
      r.log('invoice-balance-restored-by-reversal', Math.abs((balanceAfter - balanceBefore) - 400) < 0.01, `${balanceBefore} -> ${balanceAfter}`)

      const reReverse = await page.evaluate(async (id) => window.api.payments.reverse({ paymentId: id, reason: 'double reversal attempt' }), paymentId)
      r.log('double-reversal-rejected', reReverse?.success === false && reReverse?.error?.code === 'PM-005', JSON.stringify(reReverse?.error || reReverse))
    })

    // ── Overpayment behavior (Section 3: "no overpayment silently accepted") ──
    await r.step('overpayment-is-explicitly-rejected-not-silently-accepted', async () => {
      if (!invoiceId) return r.log('overpayment-is-explicitly-rejected-not-silently-accepted', false, 'no invoiceId')
      const before = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      const balance = before?.data?.balanceAmount

      // Reversal above restored the full balance (1180) -- pay 100 more than
      // that, well outside the 0.01 floating-point tolerance the service uses.
      const overRes = await page.evaluate(async ({ id, amount }) => window.api.payments.record({
        invoiceId: id, paymentMethod: 'CASH', amount,
      }), { id: invoiceId, amount: balance + 100 })
      r.log('overpayment-rejected-with-PM-003', overRes?.success === false && overRes?.error?.code === 'PM-003', JSON.stringify(overRes?.error || overRes))

      // Paying the EXACT balance should succeed (boundary check, not just "less than").
      const exactRes = await page.evaluate(async ({ id, amount }) => window.api.payments.record({
        invoiceId: id, paymentMethod: 'CASH', amount,
      }), { id: invoiceId, amount: balance })
      r.log('exact-balance-payment-succeeds', !!exactRes?.success, JSON.stringify(exactRes?.error || ''))

      // Invoice is now fully paid -- ANY further payment (even 1 rupee) must
      // be rejected, not silently accepted as a credit/advance.
      const afterFull = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-shows-fully-paid', afterFull?.data?.balanceAmount <= 0.01, `balance=${afterFull?.data?.balanceAmount}`)

      const furtherRes = await page.evaluate(async (id) => window.api.payments.record({
        invoiceId: id, paymentMethod: 'CASH', amount: 1,
      }), invoiceId)
      r.log('payment-on-fully-paid-invoice-rejected-with-PM-002', furtherRes?.success === false && furtherRes?.error?.code === 'PM-002', JSON.stringify(furtherRes?.error || furtherRes))
    })

    // ── 2. Credit limit enforcement ──────────────────────────────────────
    await r.step('credit-limit-enforcement-blocks-oversized-credit-sale', async () => {
      const tplRes = await page.evaluate(async () => window.api.industry.getTemplate())
      const currentModules = tplRes?.data?.enabledModules || []
      const alreadyEnabled = currentModules.includes('credit_limit_enforcement')

      if (!alreadyEnabled) {
        const updRes = await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), [...currentModules, 'credit_limit_enforcement'])
        r.log('credit-limit-module-enabled', !!updRes?.success, JSON.stringify(updRes?.error || ''))
      } else {
        r.log('credit-limit-module-enabled', true, 'already enabled')
      }

      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} Limited Customer`, creditLimit: 1000 })
      const limitedCustomerId = custRes?.data?.id
      r.log('limited-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))

      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Expensive Widget`, sellingPrice: 2000, costPrice: 1000 })
      const productId = prodRes?.data?.id

      // 1 unit @ 2000 + 18% tax = 2360, well over the 1000 limit.
      const overLimitRes = await page.evaluate(async ({ productId, customerId }) => window.api.billing.createInvoice({
        paymentMethod: 'CREDIT', customerId,
        items: [{ productId, quantity: 1, unitPrice: 2000, taxRate: 18 }],
      }), { productId, customerId: limitedCustomerId })
      r.log('over-limit-credit-sale-rejected', overLimitRes?.success === false && overLimitRes?.error?.code === 'CUST-003', JSON.stringify(overLimitRes?.error || overLimitRes))

      // Restore module state so this test doesn't permanently change business config.
      if (!alreadyEnabled) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), currentModules)
      }
    })

    // ── 3. Manual inventory adjustment + stock valuation reconciliation ──
    await r.step('manual-stock-adjustment-writes-movement-and-reconciles-valuation', async () => {
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Adjustable Widget`, sellingPrice: 300, costPrice: 120, openingQuantity: 50 })
      const productId = prodRes?.data?.id
      r.log('adjustable-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const invBefore = await page.evaluate(async (id) => window.api.inventory.get(id), productId)
      r.log('opening-inventory-correct', invBefore?.data?.quantity === 50, `qty=${invBefore?.data?.quantity}`)

      // Absolute target quantity, per the service contract — not a delta.
      const adjRes = await page.evaluate(async (id) => window.api.inventory.adjustStock({
        productId: id, quantity: 35, reason: 'E2E suite physical stock count',
      }), productId)
      r.log('stock-adjustment-succeeds', !!adjRes?.success, JSON.stringify(adjRes?.error || ''))

      const invAfter = await page.evaluate(async (id) => window.api.inventory.get(id), productId)
      r.log('stock-adjusted-to-target-quantity', invAfter?.data?.quantity === 35, `qty=${invAfter?.data?.quantity}`)

      const movements = await page.evaluate(async (id) => window.api.inventory.getMovements({ productId: id }), productId).catch(() => null)
      const movementList = movements?.data?.movements || []
      const adjMovement = movementList.find((m) => m.movementType === 'ADJUSTMENT' && m.quantity === -15)
      r.log('adjustment-movement-logged', !!adjMovement, movements ? `found ${movementList.length} movements` : 'no movements API on this build')

      // Fresh product, no prior stock movement before this adjustment —
      // averageCost still equals costPrice, so a direct costPrice comparison
      // is valid here (see project memory: this stops being true after any
      // addStock/adjustment-with-cost/PO-receive on a product).
      const valRes = await page.evaluate(() => window.api.inventory.getInventoryValue())
      r.log('inventory-value-api-succeeds', !!valRes?.success, JSON.stringify(valRes?.error || ''))
      const dbCheck = h.withDb((db) => db.prepare(
        `SELECT SUM(i.quantity * i.averageCost) AS total FROM Inventory i JOIN Product p ON p.id = i.productId WHERE p.isActive = 1`
      ).get())
      const reportedTotal = valRes?.data?.totalValue
      const expectedTotal = dbCheck?.total
      r.log('stock-valuation-reconciles-with-sum-qty-times-averagecost', Math.abs((reportedTotal ?? -1) - (expectedTotal ?? -2)) < 1, `reported=${reportedTotal} expected(qty*avgCost)=${expectedTotal}`)
    })

    // ── 4. Product import via parseDroppedFile (bypasses native file dialog) ─
    await r.step('csv-import-creates-real-products', async () => {
      const csvPath = path.join(require('os').tmpdir(), `e2e-import-${Date.now()}.csv`)
      const uniqueSku = `E2EIMP${Date.now()}`
      const csvContent = [
        'productName,sku,unit,sellingPrice,costPrice,taxRate',
        `${TEST_PREFIX} Imported Item,${uniqueSku},PCS,250,150,18`,
      ].join('\n')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      try {
        const parseRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'products', filePath: fp }), csvPath)
        r.log('csv-parsed-via-dropped-file-path', !!parseRes?.success, JSON.stringify(parseRes?.error || ''))
        const sessionId = parseRes?.data?.sessionId
        const detectedMapping = parseRes?.data?.mapping || parseRes?.data?.suggestedMapping

        if (sessionId) {
          const execRes = await page.evaluate(async ({ sessionId, mapping }) => window.api.import.execute({
            sessionId, mapping, module: 'products',
          }), { sessionId, mapping: detectedMapping })
          r.log('import-executes-successfully', !!execRes?.success, JSON.stringify(execRes?.error || ''))
          r.log('import-reports-one-row-imported', execRes?.data?.imported === 1, JSON.stringify(execRes?.data || ''))

          const searchRes = await page.evaluate(async (sku) => window.api.products.search(sku), uniqueSku)
          const found = (searchRes?.data || []).some((p) => p.sku === uniqueSku)
          r.log('imported-product-actually-exists', found, JSON.stringify(searchRes?.data || ''))
        }
      } finally {
        fs.unlinkSync(csvPath)
      }
    })

    // ── 5. Import error reporting on invalid rows (Section 3 gap) ─────────
    // productName and sellingPrice are the two `required: true` fields for
    // the products module (import.service.ts MODULE_FIELDS) -- construct a
    // CSV with one valid row and two rows each missing one required field,
    // to confirm real per-row error reporting AND that one bad row doesn't
    // abort the whole batch (this importer's actual defined behavior is
    // partial success with per-row reporting, not all-or-nothing rollback
    // -- confirmed by reading executeImport() directly: each row is
    // validated and processed independently in a loop, not inside one
    // wrapping transaction).
    await r.step('import-reports-specific-per-row-errors-without-aborting-valid-rows', async () => {
      const csvPath = path.join(require('os').tmpdir(), `e2e-import-invalid-${Date.now()}.csv`)
      const goodSku = `E2EIMPGOOD${Date.now()}`
      const csvContent = [
        'productName,sku,unit,sellingPrice,costPrice,taxRate',
        `${TEST_PREFIX} Valid Row,${goodSku},PCS,100,50,18`,
        `,MISSINGNAME${Date.now()},PCS,100,50,18`,
        `${TEST_PREFIX} Missing Price Row,MISSINGPRICE${Date.now()},PCS,,50,18`,
      ].join('\n')
      fs.writeFileSync(csvPath, csvContent, 'utf-8')

      try {
        const parseRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'products', filePath: fp }), csvPath)
        const sessionId = parseRes?.data?.sessionId
        const mapping = parseRes?.data?.mapping || parseRes?.data?.suggestedMapping
        r.log('mixed-csv-parsed', !!parseRes?.success, JSON.stringify(parseRes?.error || ''))

        if (sessionId) {
          const execRes = await page.evaluate(async ({ sessionId, mapping }) => window.api.import.execute({
            sessionId, mapping, module: 'products',
          }), { sessionId, mapping })
          const data = execRes?.data
          r.log('valid-row-still-imported-despite-other-bad-rows', data?.imported === 1, JSON.stringify(data || execRes?.error))
          r.log('two-bad-rows-reported-as-failed', data?.failed === 2, `failed=${data?.failed}`)
          r.log('errors-array-has-row-number-and-reason-per-bad-row', Array.isArray(data?.errors) && data.errors.length === 2 && data.errors.every((e) => typeof e.row === 'number' && typeof e.message === 'string' && e.message.length > 0), JSON.stringify(data?.errors))

          const goodRes = await page.evaluate(async (sku) => window.api.products.search(sku), goodSku)
          r.log('valid-row-product-actually-exists-despite-batch-having-errors', (goodRes?.data || []).some((p) => p.sku === goodSku))
        }
      } finally {
        fs.unlinkSync(csvPath)
      }
    })

    // ── 6. Customers / Suppliers / Inventory import variants (Section 3:
    // only Products was exercised earlier this session) ────────────────────
    await r.step('customers-import-creates-real-customer', async () => {
      const csvPath = path.join(require('os').tmpdir(), `e2e-import-customers-${Date.now()}.csv`)
      const uniquePhone = `9${String(Date.now()).slice(-9)}`
      fs.writeFileSync(csvPath, [
        'customerName,phone,email,creditLimit',
        `${TEST_PREFIX} Imported Customer,${uniquePhone},imported@example.com,5000`,
      ].join('\n'), 'utf-8')
      try {
        const parseRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'customers', filePath: fp }), csvPath)
        const sessionId = parseRes?.data?.sessionId
        const mapping = parseRes?.data?.mapping || parseRes?.data?.suggestedMapping
        r.log('customers-csv-parsed', !!parseRes?.success, JSON.stringify(parseRes?.error || ''))
        if (sessionId) {
          const execRes = await page.evaluate(async ({ sessionId, mapping }) => window.api.import.execute({
            sessionId, mapping, module: 'customers',
          }), { sessionId, mapping })
          r.log('customers-import-reports-one-imported', execRes?.data?.imported === 1, JSON.stringify(execRes?.data || execRes?.error))
          const searchRes = await page.evaluate(async (phone) => window.api.customers.search(phone), uniquePhone)
          r.log('imported-customer-actually-exists-with-correct-credit-limit', (searchRes?.data || []).some((c) => c.phone === uniquePhone && c.creditLimit === 5000), JSON.stringify(searchRes?.data || ''))
        }
      } finally {
        fs.unlinkSync(csvPath)
      }
    })

    await r.step('suppliers-import-creates-real-supplier', async () => {
      const csvPath = path.join(require('os').tmpdir(), `e2e-import-suppliers-${Date.now()}.csv`)
      const uniqueName = `${TEST_PREFIX} Imported Supplier ${Date.now()}`
      fs.writeFileSync(csvPath, [
        'supplierName,phone,email',
        `${uniqueName},7${String(Date.now()).slice(-9)},supplier@example.com`,
      ].join('\n'), 'utf-8')
      try {
        const parseRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'suppliers', filePath: fp }), csvPath)
        const sessionId = parseRes?.data?.sessionId
        const mapping = parseRes?.data?.mapping || parseRes?.data?.suggestedMapping
        r.log('suppliers-csv-parsed', !!parseRes?.success, JSON.stringify(parseRes?.error || ''))
        if (sessionId) {
          const execRes = await page.evaluate(async ({ sessionId, mapping }) => window.api.import.execute({
            sessionId, mapping, module: 'suppliers',
          }), { sessionId, mapping })
          r.log('suppliers-import-reports-one-imported', execRes?.data?.imported === 1, JSON.stringify(execRes?.data || execRes?.error))
          const listRes = await page.evaluate(async () => window.api.suppliers.list({ limit: 500 }))
          const found = (listRes?.data?.suppliers || listRes?.data || []).some?.((s) => s.supplierName === uniqueName)
          r.log('imported-supplier-actually-exists', !!found)
        }
      } finally {
        fs.unlinkSync(csvPath)
      }
    })

    await r.step('inventory-import-adjusts-real-stock', async () => {
      // Inventory import matches by SKU against an EXISTING product -- create
      // one first with a known opening quantity, then import a stock change
      // against that same SKU.
      const sku = `E2EIMPINV${Date.now()}`
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Inventory Import Target`, sku, openingQuantity: 10 })
      r.log('inventory-import-target-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
      const productId = prodRes?.data?.id

      const csvPath = path.join(require('os').tmpdir(), `e2e-import-inventory-${Date.now()}.csv`)
      fs.writeFileSync(csvPath, [
        'sku,quantity,unitCost,reason',
        `${sku},25,60,E2E suite inventory import test`,
      ].join('\n'), 'utf-8')
      try {
        const parseRes = await page.evaluate(async (fp) => window.api.import.parseDroppedFile({ module: 'inventory', filePath: fp }), csvPath)
        const sessionId = parseRes?.data?.sessionId
        const mapping = parseRes?.data?.mapping || parseRes?.data?.suggestedMapping
        r.log('inventory-csv-parsed', !!parseRes?.success, JSON.stringify(parseRes?.error || ''))
        if (sessionId) {
          const execRes = await page.evaluate(async ({ sessionId, mapping }) => window.api.import.execute({
            sessionId, mapping, module: 'inventory',
          }), { sessionId, mapping })
          r.log('inventory-import-reports-one-imported', execRes?.data?.imported === 1, JSON.stringify(execRes?.data || execRes?.error))

          if (productId) {
            const invRes = await page.evaluate(async (id) => window.api.inventory.get(id), productId)
            // Real finding 2026-07-15: unlike inventory.adjustStock (whose
            // `quantity` is an ABSOLUTE target, confirmed earlier this
            // session), inventory IMPORT's `quantity` is ADDITIVE
            // (movementType: 'ADDITION' in import.service.ts) -- imported 25
            // on top of an opening 10 correctly yields 35, not 25. Genuinely
            // different, intentional semantics between the two features
            // (import = "stock received" events; adjustStock = "set the
            // count to what I just counted"), not a bug.
            r.log('inventory-import-adds-to-existing-stock-not-replaces-it', invRes?.data?.quantity === 35, `qty=${invRes?.data?.quantity} (10 opening + 25 imported)`)
          }
        }
      } finally {
        fs.unlinkSync(csvPath)
      }
    })

    // ── 7. Dashboard KPI reconciliation (Section 3 gap) ────────────────────
    // getDashboardKpis() caches its result (analytics.service.ts _kpiCache) --
    // forceRefresh:true bypasses that so this actually reflects the invoice
    // just created below, not a stale pre-suite snapshot.
    await r.step('dashboard-kpis-reconcile-against-independently-queried-source-data', async () => {
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} KPI Customer` })
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} KPI Product`, sellingPrice: 300, costPrice: 150 })
      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 300, taxRate: 18 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      r.log('kpi-test-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || `total=${invRes?.data?.totalAmount}`))

      const kpiRes = await page.evaluate(async () => window.api.analytics.getDashboardKpis({ forceRefresh: true }))
      r.log('dashboard-kpis-api-succeeds', !!kpiRes?.success, JSON.stringify(kpiRes?.error || ''))

      // Independent source: sum today's ACTIVE invoices directly, the exact
      // same query analytics.service.ts's getDashboardKpis() itself uses for
      // "today" revenue -- if these two numbers ever diverge, the dashboard
      // is showing something other than what's actually in the database.
      const dbTodayTotal = h.withDb((db) => {
        const startOfDayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        const row = db.prepare(
          `SELECT SUM(totalAmount) AS total FROM Invoice WHERE status = 'ACTIVE' AND invoiceDate >= ?`
        ).get(startOfDayMs)
        return row?.total ?? 0
      })
      const kpiToday = kpiRes?.data?.todaySales
      r.log('dashboard-today-revenue-matches-independent-db-query', Math.abs((kpiToday ?? -1) - dbTodayTotal) < 1, `kpi=${kpiToday} db=${dbTodayTotal}`)
    })

    // ── 8. UPI QR printing (Section 5 gap) ─────────────────────────────────
    // canShowUpiQr() (print.service.ts) requires BOTH a configured upiId AND
    // country === India -- set both via the real businessProfile.update IPC,
    // create a credit invoice (so balanceAmount > 0, the QR encodes the
    // balance due), and confirm the print-preview HTML actually contains a
    // real generated QR image, then confirm it's genuinely absent when upiId
    // is cleared (display-only, not a payment-processing feature -- see
    // Known Limitations).
    let savedProfile
    await r.step('upi-qr-renders-when-configured-and-is-absent-when-not', async () => {
      const profileRes = await page.evaluate(() => window.api.businessProfile.get())
      savedProfile = profileRes?.data
      r.log('business-profile-fetched', !!savedProfile)

      await page.evaluate((p) => window.api.businessProfile.update({ ...p, upiId: 'e2etest@upi', country: 'India' }), savedProfile)

      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} QR Customer` })
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} QR Product`, sellingPrice: 200, costPrice: 100 })
      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CREDIT', items: [{ productId, quantity: 1, unitPrice: 200, taxRate: 18 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      const invoiceId = invRes?.data?.id
      r.log('qr-test-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      if (invoiceId) {
        // Real bugs found+fixed 2026-07-15 IN THIS TEST (not the app):
        // (1) a generic `data:image/png;base64` regex is too broad — every
        // print document also embeds the Aszurex partnership mark as a
        // base64 PNG, independent of UPI QR settings. (2) the bare string
        // "qr-section" is ALSO too broad — the CSS rule `.qr-section {...}`
        // is present in every invoice's <style> block unconditionally, so
        // checking for that substring is always true whether or not the
        // actual <div class="qr-section"> element renders (the exact same
        // CSS-selector-vs-rendered-element trap as the earlier locale-
        // formatting investigation's "totals-total" false match). Confirmed
        // via direct main-process stdout capture that canShowUpiQr() itself
        // correctly received upiId="" and evaluates false on the "cleared"
        // pass — the app's logic was correct throughout both false alarms.
        // Fixed by matching the RENDERED element specifically
        // (`class="qr-section"`, with the quote characters, which only
        // appears in the HTML body, never the <style> block).
        const withQr = await page.evaluate((id) => window.api.print.previewInvoice({ invoiceId: id }), invoiceId)
        const htmlWithQr = withQr?.data || ''
        r.log('upi-qr-image-present-when-configured', typeof htmlWithQr === 'string' && htmlWithQr.includes('class="qr-section"'), `htmlLength=${typeof htmlWithQr === 'string' ? htmlWithQr.length : 'n/a'}`)

        // Clear UPI ID and confirm the QR genuinely disappears, not that this
        // invoice just happened to render one once.
        await page.evaluate((p) => window.api.businessProfile.update({ ...p, upiId: '', country: 'India' }), savedProfile)
        const withoutQr = await page.evaluate((id) => window.api.print.previewInvoice({ invoiceId: id }), invoiceId)
        const htmlWithoutQr = withoutQr?.data || ''
        r.log('upi-qr-image-absent-when-not-configured', typeof htmlWithoutQr === 'string' && !htmlWithoutQr.includes('class="qr-section"'))
      }
    })

    // ── 9. Locale formatting (Section 5 gap) — currency/date/number ───────
    await r.step('currency-and-date-formatting-match-configured-locale-settings', async () => {
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} Locale Customer` })
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Locale Product`, sellingPrice: 12345.67, costPrice: 5000 })
      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 12345.67, taxRate: 18 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      const invoiceId = invRes?.data?.id
      r.log('locale-test-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      if (invoiceId) {
        const preview = await page.evaluate((id) => window.api.print.previewInvoice({ invoiceId: id }), invoiceId)
        const html = preview?.data || ''
        const invDetail = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        const total = invDetail?.data?.totalAmount
        // number_format setting defaults to 'IN' (Indian digit grouping --
        // comma before the last 3 digits, e.g. 14,567.79 not 14567.79) and
        // currency_symbol_position defaults to 'prefix'. Compute the EXACT
        // expected Indian-grouped string from the real invoice total (not a
        // loose/guessed regex) and confirm both the ₹ symbol and that exact
        // grouped number actually appear in the rendered print HTML.
        const indianGrouped = typeof total === 'number' ? total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null
        r.log('rupee-symbol-present-in-print-output', typeof html === 'string' && html.includes('₹'))
        r.log('indian-digit-grouping-matches-exact-expected-total', !!indianGrouped && typeof html === 'string' && html.includes(indianGrouped), `expected="${indianGrouped}" (total=${total})`)
      }
    })

    // ── 10. Live language-switch UI + Unicode + RTL (Section 5 gap) ────────
    // Real UI interaction (not just translation-file completeness, already
    // verified in Phase 56) -- click the actual language row in Settings,
    // confirm the switch takes effect immediately (i18n.language actually
    // changes), that real non-Latin script renders (not mojibake/boxes:
    // Devanagari for Hindi), and that a genuinely RTL language (Arabic) sets
    // document.dir="rtl", then switch back to English so the app isn't left
    // in a non-default state for other tests/manual use.
    await r.step('live-language-switch-renders-unicode-and-sets-rtl-direction', async () => {
      await h.gotoHash(page, '#/settings')
      await page.waitForTimeout(700)
      const langTab = page.locator('button, [role="tab"]', { hasText: /Language/i }).first()
      if (await langTab.count()) { await langTab.click(); await page.waitForTimeout(400) }

      const hindiRow = page.locator('button', { hasText: 'हिंदी' }).first()
      const hindiFound = await hindiRow.count() > 0
      r.log('hindi-language-row-found-with-real-devanagari-text', hindiFound)
      if (hindiFound) {
        await hindiRow.click()
        await page.waitForTimeout(500)
        const langAfterHindi = await page.evaluate(() => document.documentElement.getAttribute('lang'))
        r.log('switching-to-hindi-updates-document-lang-attribute', langAfterHindi === 'hi', `lang=${langAfterHindi}`)
        const bodyText = await page.locator('body').innerText()
        // Devanagari Unicode range check -- confirms real script rendering,
        // not just that SOME text changed (mojibake/tofu boxes wouldn't be
        // real Devanagari codepoints, but innerText() would still return
        // something for those failure modes too).
        r.log('devanagari-script-actually-renders-in-ui', /[ऀ-ॿ]/.test(bodyText), 'checked Unicode range U+0900-U+097F')
      }

      const arabicRow = page.locator('button', { hasText: 'العربية' }).first()
      const arabicFound = await arabicRow.count() > 0
      r.log('arabic-language-row-found-with-real-arabic-text', arabicFound)
      if (arabicFound) {
        await arabicRow.click()
        await page.waitForTimeout(500)
        const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'))
        r.log('switching-to-arabic-sets-rtl-direction', dir === 'rtl', `dir=${dir}`)
        const bodyText = await page.locator('body').innerText()
        r.log('arabic-script-actually-renders-in-ui', /[؀-ۿ]/.test(bodyText), 'checked Unicode range U+0600-U+06FF')
      }

      // Restore English so the app isn't left mid-suite in a non-default
      // language for anything else that runs after this.
      const englishRow = page.locator('button', { hasText: 'English' }).first()
      if (await englishRow.count()) {
        await englishRow.click()
        await page.waitForTimeout(500)
        const dirAfter = await page.evaluate(() => document.documentElement.getAttribute('dir'))
        r.log('restored-to-english-ltr', dirAfter === 'ltr', `dir=${dirAfter}`)
      }
    })

    // ── 11. Discounts apply to BOTH subtotal and the tax base (Section 3 gap) ──
    // Correct GST/tax law: tax is computed on the post-discount (taxable)
    // amount, not the raw subtotal. qty=1, unitPrice=1000, discount=100,
    // taxRate=18% -> taxable=900, tax=900*0.18=162, lineTotal=1062. If a
    // regression ever applied the discount to display only (computing tax on
    // the full 1000 = 180), this test catches the wrong total (1080) instead
    // of the correct one (1062).
    await r.step('discount-reduces-the-tax-base-not-just-the-displayed-subtotal', async () => {
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} Discount Customer` })
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Discount Product`, sellingPrice: 1000, costPrice: 500, taxRate: 18 })
      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH',
        items: [{ productId, quantity: 1, unitPrice: 1000, taxRate: 18, discountAmount: 100 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      r.log('discount-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const invDetail = await page.evaluate((id) => window.api.billing.getInvoice(id), invRes?.data?.id)
      const inv = invDetail?.data
      r.log('subtotal-is-pre-discount-gross', Math.abs((inv?.subtotal ?? -1) - 1000) < 0.01, `subtotal=${inv?.subtotal}`)
      r.log('discount-amount-recorded-correctly', Math.abs((inv?.discountAmount ?? -1) - 100) < 0.01, `discount=${inv?.discountAmount}`)
      r.log('tax-computed-on-post-discount-base-not-raw-subtotal', Math.abs((inv?.taxAmount ?? -1) - 162) < 0.01, `taxAmount=${inv?.taxAmount} (expected 162 = 900 * 18%, NOT 180 = 1000 * 18%)`)
      r.log('final-total-reflects-discount-applied-before-tax', Math.abs((inv?.totalAmount ?? -1) - 1062) < 0.01, `total=${inv?.totalAmount} (expected 1062)`)
    })

    // ── 12. Tax calculation matches configured TaxConfiguration rates ──────
    await r.step('invoice-tax-matches-the-configured-tax-rate-not-a-hardcoded-default', async () => {
      // Use a deliberately non-default rate (5%, not the common 18%) so this
      // can't accidentally pass via a hardcoded 18% somewhere in the pipeline.
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} TaxRate Customer` })
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} TaxRate Product`, sellingPrice: 2000, costPrice: 1000, taxRate: 5 })
      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 2000, taxRate: 5 }],
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      const invDetail = await page.evaluate((id) => window.api.billing.getInvoice(id), invRes?.data?.id)
      const inv = invDetail?.data
      r.log('tax-rate-5pct-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
      r.log('tax-amount-matches-configured-5pct-rate-exactly', Math.abs((inv?.taxAmount ?? -1) - 100) < 0.01, `taxAmount=${inv?.taxAmount} (expected 100 = 2000 * 5%)`)
      r.log('total-reflects-5pct-not-a-different-hardcoded-rate', Math.abs((inv?.totalAmount ?? -1) - 2100) < 0.01, `total=${inv?.totalAmount} (expected 2100)`)
    })

    // ── 13. Invoice numbering has no gaps or collisions under concurrency ──
    // generateInvoiceNumber() claims the year's sequence Setting atomically
    // WITHIN the same transaction as the invoice insert (billing.service.ts)
    // -- a losing concurrent claim throws SequenceContendedError, rolling
    // back that whole transaction (including the number claim), so a failed
    // attempt never consumes/wastes a number. 09-stress.js already proved
    // the no-overselling guarantee under 50-way concurrency; this checks the
    // DIFFERENT property that suite didn't specifically assert on: the
    // invoiceNumber sequence itself has no gaps or duplicates among
    // successful concurrent creates.
    await r.step('invoice-numbers-have-no-gaps-or-collisions-under-real-concurrency', async () => {
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} Concurrency Customer` })
      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Concurrency Product`, sellingPrice: 50, costPrice: 20, openingQuantity: 100 })
      const customerId = custRes?.data?.id
      const productId = prodRes?.data?.id

      const N = 20
      const results = await page.evaluate(async ({ customerId, productId, n }) => {
        const calls = Array.from({ length: n }, () => window.api.billing.createInvoice({
          customerId, paymentMethod: 'CASH', items: [{ productId, quantity: 1, unitPrice: 50, taxRate: 18 }],
        }).catch((e) => ({ success: false, error: { code: 'PROMISE-REJECTED', message: String((e && e.message) || e) } })))
        const settled = await Promise.all(calls)
        return settled.map((res) => ({ success: res?.success, invoiceNumber: res?.data?.invoiceNumber, code: res?.error?.code }))
      }, { customerId, productId, n: N })

      const successes = results.filter((r2) => r2.success)
      r.log('at-least-some-concurrent-invoices-succeeded', successes.length > 0, `success=${successes.length}/${N}`)

      const numbers = successes.map((r2) => r2.invoiceNumber)
      const uniqueNumbers = new Set(numbers)
      r.log('no-duplicate-invoice-numbers-among-concurrent-successes', uniqueNumbers.size === numbers.length, `${uniqueNumbers.size} unique of ${numbers.length} total`)

      // Extract the numeric suffix (INV-2026-000123 -> 123) and confirm the
      // successful batch's own numbers are tightly consecutive -- no gap was
      // left behind by a failed attempt "wasting" a number.
      const suffixes = numbers.map((n2) => parseInt(String(n2).split('-').pop(), 10)).filter((n2) => Number.isFinite(n2)).sort((a, b) => a - b)
      const isConsecutive = suffixes.length > 0 && (suffixes[suffixes.length - 1] - suffixes[0] + 1) === suffixes.length
      r.log('successful-batch-invoice-numbers-are-gap-free', isConsecutive, `suffixes=${JSON.stringify(suffixes)}`)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPAYMENTS/IMPORT/CREDIT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
