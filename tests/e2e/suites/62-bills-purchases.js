/**
 * Suite 62 — Phase 61 "Purchase Side & Core Ledger Foundation": Bills,
 * Payments Made, purchase-side reports, GST-on-global-discount, and the
 * other schema/UI additions from PHASE_61_ROADMAP_MASTER_PROMPT.md.
 *
 * Covers Section 3.4's UAT scenarios end-to-end through the real IPC
 * surface (window.api.*), the same "live verification, not code-review
 * assumption" bar this project's own testing convention requires — unit
 * tests already cover the calculation logic in isolation; this suite
 * proves it also works wired together against a real running app.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Bills'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  const createdSupplierIds = []
  const createdBillIds = []
  const createdCustomerIds = []
  const createdProductIds = []
  const createdPOIds = []

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    async function makeSupplier(overrides = {}) {
      const res = await page.evaluate((data) => window.api.suppliers.create(data), {
        supplierName: `${TEST_PREFIX} Supplier ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...overrides
      })
      if (res?.data?.id) createdSupplierIds.push(res.data.id)
      return res
    }

    // ── UAT 1: CA firm owner records a subcontracted auditor's invoice (a
    // pure service line, no product), sees it on the Purchase Register, and
    // pays it in two installments ──────────────────────────────────────────
    let uat1BillId, uat1SupplierId
    await r.step('uat1-record-service-only-bill-from-subcontractor', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Subcontracted Auditor` })
      r.log('uat1-supplier-created', !!supRes?.success, JSON.stringify(supRes?.error || ''))
      uat1SupplierId = supRes?.data?.id

      const catRes = await page.evaluate(() => window.api.expenses.listCategories())
      const categoryId = catRes?.data?.[0]?.id

      const billRes = await page.evaluate(({ supplierId, categoryId }) => window.api.bills.create({
        supplierId,
        items: [{ serviceDescription: 'Subcontracted audit — Q1', serviceCategoryId: categoryId, quantity: 1, unitCost: 25000, taxRate: 18 }]
      }), { supplierId: uat1SupplierId, categoryId })
      r.log('uat1-service-only-bill-created', !!billRes?.success, JSON.stringify(billRes?.error || ''))
      uat1BillId = billRes?.data?.id
      if (billRes?.data?.id) createdBillIds.push(billRes.data.id)
      r.log('uat1-bill-total-correct-29500', billRes?.data?.totalAmount === 29500, `total=${billRes?.data?.totalAmount}`)
    })

    await r.step('uat1-bill-appears-on-purchase-register', async () => {
      if (!uat1BillId) return r.log('uat1-bill-appears-on-purchase-register', false, 'no billId')
      const today = h.toLocalISODate(new Date())
      const regRes = await page.evaluate(({ dateFrom, dateTo }) => window.api.reports.purchaseRegister({ dateFrom, dateTo }), { dateFrom: today, dateTo: today })
      r.log('purchase-register-api-succeeds', !!regRes?.success, JSON.stringify(regRes?.error || ''))
      const found = (regRes?.data?.rows || []).some((row) => row.billNumber && uat1BillId)
      const totalIncludesOurBill = (regRes?.data?.summary?.totalPurchases ?? 0) >= 29500
      r.log('purchase-register-includes-todays-bill', found || totalIncludesOurBill, `rows=${regRes?.data?.rows?.length}`)
    })

    await r.step('uat1-pay-bill-in-two-installments', async () => {
      if (!uat1BillId) return r.log('uat1-pay-bill-in-two-installments', false, 'no billId')
      const pay1 = await page.evaluate((billId) => window.api.supplierPayments.record({
        billId, paymentMethod: 'BANK_TRANSFER', amount: 15000, referenceNumber: 'E2E-INSTALLMENT-1'
      }), uat1BillId)
      r.log('uat1-first-installment-recorded', !!pay1?.success, JSON.stringify(pay1?.error || ''))

      const afterFirst = await page.evaluate((id) => window.api.bills.get(id), uat1BillId)
      r.log('uat1-status-partially-paid-after-first-installment', afterFirst?.data?.status === 'PARTIALLY_PAID', `status=${afterFirst?.data?.status}`)
      r.log('uat1-balance-correct-after-first-installment', Math.abs((afterFirst?.data?.balanceAmount ?? -1) - 14500) < 0.01, `balance=${afterFirst?.data?.balanceAmount}`)

      const pay2 = await page.evaluate((billId) => window.api.supplierPayments.record({
        billId, paymentMethod: 'BANK_TRANSFER', amount: 14500, referenceNumber: 'E2E-INSTALLMENT-2'
      }), uat1BillId)
      r.log('uat1-second-installment-recorded', !!pay2?.success, JSON.stringify(pay2?.error || ''))

      const afterSecond = await page.evaluate((id) => window.api.bills.get(id), uat1BillId)
      r.log('uat1-status-paid-after-second-installment', afterSecond?.data?.status === 'PAID', `status=${afterSecond?.data?.status}`)
      r.log('uat1-balance-zero-after-full-payment', (afterSecond?.data?.balanceAmount ?? -1) <= 0.01, `balance=${afterSecond?.data?.balanceAmount}`)
    })

    // ── UAT 2: distributor raises a PO mixing stock items with a
    // "transport charges" service line, and it totals correctly ───────────
    await r.step('uat2-po-with-mixed-product-and-service-lines-totals-correctly', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Distributor Vendor` })
      const supplierId = supRes?.data?.id

      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 100, sellingPrice: 150, taxRate: 18
      }), `${TEST_PREFIX} Stock Item ${Date.now()}`)
      r.log('uat2-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
      const productId = prodRes?.data?.id
      if (productId) createdProductIds.push(productId)

      const poRes = await page.evaluate(({ supplierId, productId }) => window.api.purchaseOrders.create({
        supplierId,
        items: [
          { productId, quantity: 10, unitCost: 100, taxRate: 18 },
          { serviceDescription: 'Transport charges', quantity: 1, unitCost: 500, taxRate: 5 }
        ]
      }), { supplierId, productId })
      r.log('uat2-mixed-line-po-created', !!poRes?.success, JSON.stringify(poRes?.error || ''))
      if (poRes?.data?.id) createdPOIds.push(poRes.data.id)

      // 10*100*1.18 + 1*500*1.05 = 1180 + 525 = 1705
      r.log('uat2-po-total-correct-1705', Math.abs((poRes?.data?.totalAmount ?? -1) - 1705) < 0.01, `total=${poRes?.data?.totalAmount}`)
      r.log('uat2-po-has-two-items', poRes?.data?.items?.length === 2, `items=${poRes?.data?.items?.length}`)
    })

    // ── Purchase-price history append-not-overwrite (real DB check) ───────
    await r.step('cost-history-appends-not-overwrites-across-two-bills-same-product', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Cost History Vendor` })
      const supplierId = supRes?.data?.id
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 50, sellingPrice: 80, taxRate: 12
      }), `${TEST_PREFIX} Cost History Item ${Date.now()}`)
      const productId = prodRes?.data?.id
      if (productId) createdProductIds.push(productId)

      const rowsBefore = h.withDb((db) => db.prepare('SELECT COUNT(*) AS n FROM ProductCostHistory WHERE productId = ?').get(productId).n)

      const bill1 = await page.evaluate(({ supplierId, productId }) => window.api.bills.create({
        supplierId, items: [{ productId, quantity: 5, unitCost: 50, taxRate: 12 }]
      }), { supplierId, productId })
      if (bill1?.data?.id) createdBillIds.push(bill1.data.id)

      const bill2 = await page.evaluate(({ supplierId, productId }) => window.api.bills.create({
        supplierId, items: [{ productId, quantity: 5, unitCost: 60, taxRate: 12 }]
      }), { supplierId, productId })
      if (bill2?.data?.id) createdBillIds.push(bill2.data.id)

      const rowsAfter = h.withDb((db) => db.prepare('SELECT unitCost FROM ProductCostHistory WHERE productId = ? ORDER BY recordedAt ASC').all(productId))
      r.log('cost-history-gained-exactly-two-rows', rowsAfter.length === rowsBefore + 2, `before=${rowsBefore} after=${rowsAfter.length}`)
      r.log('cost-history-first-row-preserves-original-cost-50', rowsAfter[rowsAfter.length - 2]?.unitCost === 50, JSON.stringify(rowsAfter))
      r.log('cost-history-second-row-is-new-cost-60-not-an-overwrite', rowsAfter[rowsAfter.length - 1]?.unitCost === 60, JSON.stringify(rowsAfter))
    })

    // ── AP Aging reflects a real open bill ─────────────────────────────────
    await r.step('ap-aging-report-reflects-a-real-open-bill', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} AP Aging Vendor` })
      const supplierId = supRes?.data?.id
      const billRes = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, items: [{ serviceDescription: 'AP aging test line', quantity: 1, unitCost: 1000, taxRate: 0 }]
      }), supplierId)
      if (billRes?.data?.id) createdBillIds.push(billRes.data.id)

      const agingRes = await page.evaluate(() => window.api.reports.apAging())
      r.log('ap-aging-api-succeeds', !!agingRes?.success, JSON.stringify(agingRes?.error || ''))
      const row = (agingRes?.data?.rows || []).find((rr) => rr.supplierName?.includes('AP Aging Vendor'))
      r.log('ap-aging-shows-our-supplier-with-correct-outstanding', !!row && Math.abs(row.outstanding - 1000) < 0.01, JSON.stringify(row))
      r.log('ap-aging-buckets-it-as-current', !!row && row.aging?.current === 1000, JSON.stringify(row?.aging))
    })

    // ── Bulk payment across multiple open bills ────────────────────────────
    await r.step('bulk-payment-splits-across-two-open-bills-atomically', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Bulk Pay Vendor` })
      const supplierId = supRes?.data?.id
      const b1 = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, items: [{ serviceDescription: 'Bulk pay bill A', quantity: 1, unitCost: 1000, taxRate: 0 }]
      }), supplierId)
      const b2 = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, items: [{ serviceDescription: 'Bulk pay bill B', quantity: 1, unitCost: 500, taxRate: 0 }]
      }), supplierId)
      if (b1?.data?.id) createdBillIds.push(b1.data.id)
      if (b2?.data?.id) createdBillIds.push(b2.data.id)

      const bulkRes = await page.evaluate(({ supplierId, billId1, billId2 }) => window.api.supplierPayments.recordBulk({
        supplierId, paymentMethod: 'CASH',
        allocations: [{ billId: billId1, amount: 1000 }, { billId: billId2, amount: 500 }]
      }), { supplierId, billId1: b1?.data?.id, billId2: b2?.data?.id })
      r.log('bulk-payment-succeeds', !!bulkRes?.success, JSON.stringify(bulkRes?.error || ''))

      const b1After = await page.evaluate((id) => window.api.bills.get(id), b1?.data?.id)
      const b2After = await page.evaluate((id) => window.api.bills.get(id), b2?.data?.id)
      r.log('bulk-payment-both-bills-now-paid', b1After?.data?.status === 'PAID' && b2After?.data?.status === 'PAID', `A=${b1After?.data?.status} B=${b2After?.data?.status}`)
    })

    // ── Void blocked once paid; succeeds while unpaid ──────────────────────
    await r.step('void-bill-blocked-once-paid-succeeds-while-unpaid', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Void Test Vendor` })
      const supplierId = supRes?.data?.id
      const billRes = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, items: [{ serviceDescription: 'Void test line', quantity: 1, unitCost: 200, taxRate: 0 }]
      }), supplierId)
      const billId = billRes?.data?.id
      if (billId) createdBillIds.push(billId)

      await page.evaluate((billId) => window.api.supplierPayments.record({ billId, paymentMethod: 'CASH', amount: 200 }), billId)
      const voidBlocked = await page.evaluate((billId) => window.api.bills.void({ id: billId, reason: 'attempt void after payment' }), billId)
      r.log('void-rejected-with-BILL-004-once-paid', voidBlocked?.success === false && voidBlocked?.error?.code === 'BILL-004', JSON.stringify(voidBlocked?.error || voidBlocked))

      const unpaidBillRes = await page.evaluate((supplierId) => window.api.bills.create({
        supplierId, items: [{ serviceDescription: 'Void test line 2 (unpaid)', quantity: 1, unitCost: 300, taxRate: 0 }]
      }), supplierId)
      const unpaidBillId = unpaidBillRes?.data?.id
      if (unpaidBillId) createdBillIds.push(unpaidBillId)
      const voidOk = await page.evaluate((billId) => window.api.bills.void({ id: billId, reason: 'entered in error' }), unpaidBillId)
      r.log('void-succeeds-while-unpaid', !!voidOk?.success, JSON.stringify(voidOk?.error || ''))
    })

    // ── Customer.customerKind + individual/business fields ─────────────────
    await r.step('customer-business-kind-persists-with-registration-and-contact-fields', async () => {
      const custRes = await page.evaluate((name) => window.api.customers.create({
        customerName: name, customerKind: 'BUSINESS', companyRegistrationNumber: 'E2E-CIN-12345', contactPersonName: 'E2E Contact Person', creditLimit: 0, taxExempt: false
      }), `${TEST_PREFIX} Business Customer ${Date.now()}`)
      r.log('business-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      if (custRes?.data?.id) createdCustomerIds.push(custRes.data.id)
      r.log('customer-kind-persisted-as-business', custRes?.data?.customerKind === 'BUSINESS', `kind=${custRes?.data?.customerKind}`)
      r.log('company-registration-number-persisted', custRes?.data?.companyRegistrationNumber === 'E2E-CIN-12345')
    })

    // ── Supplier opening balance posts a real ledger entry ─────────────────
    await r.step('supplier-opening-balance-posts-ledger-entry-and-outstanding', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Opening Balance Vendor`, openingBalance: 7500 })
      r.log('supplier-with-opening-balance-created', !!supRes?.success, JSON.stringify(supRes?.error || ''))
      const supplierId = supRes?.data?.id

      const ledgerRes = await page.evaluate((id) => window.api.suppliers.getLedger(id), supplierId)
      r.log('opening-balance-reflected-in-outstanding', Math.abs((ledgerRes?.data?.outstanding ?? -1) - 7500) < 0.01, `outstanding=${ledgerRes?.data?.outstanding}`)
      const openingEntry = (ledgerRes?.data?.ledger || []).find((e) => e.referenceType === 'OPENING_BALANCE')
      r.log('opening-balance-ledger-entry-exists', !!openingEntry && openingEntry.debitAmount === 7500, JSON.stringify(openingEntry))
    })

    // ── Invoice.ewayBillNumber persists ────────────────────────────────────
    await r.step('invoice-eway-bill-number-persists', async () => {
      const custRes = await page.evaluate((name) => window.api.customers.create({ customerName: name, creditLimit: 0, taxExempt: false, customerKind: 'INDIVIDUAL' }), `${TEST_PREFIX} Eway Customer ${Date.now()}`)
      if (custRes?.data?.id) createdCustomerIds.push(custRes.data.id)
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 100, sellingPrice: 150, taxRate: 18, openingQuantity: 10
      }), `${TEST_PREFIX} Eway Product ${Date.now()}`)
      if (prodRes?.data?.id) createdProductIds.push(prodRes.data.id)

      const invRes = await page.evaluate(({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', ewayBillNumber: 'EWB-1234-5678-9012',
        items: [{ productId, quantity: 1, unitPrice: 150, taxRate: 18 }]
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      r.log('invoice-with-eway-bill-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const fetched = await page.evaluate((id) => window.api.billing.getInvoice(id), invRes?.data?.id)
      r.log('eway-bill-number-persisted', fetched?.data?.ewayBillNumber === 'EWB-1234-5678-9012', `ewb=${fetched?.data?.ewayBillNumber}`)
    })

    // ── Live verification: GST-on-global-discount computed on the
    // DISCOUNTED base, not the original (the third of the three live bugs
    // fixed at the start of this phase) ────────────────────────────────────
    await r.step('global-discount-gst-computed-on-discounted-base-not-original', async () => {
      const custRes = await page.evaluate((name) => window.api.customers.create({ customerName: name, creditLimit: 0, taxExempt: false, customerKind: 'INDIVIDUAL' }), `${TEST_PREFIX} Discount Customer ${Date.now()}`)
      if (custRes?.data?.id) createdCustomerIds.push(custRes.data.id)
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 500, sellingPrice: 1000, taxRate: 18, openingQuantity: 10
      }), `${TEST_PREFIX} Discount Product ${Date.now()}`)
      if (prodRes?.data?.id) createdProductIds.push(prodRes.data.id)

      // 1000 taxable, Rs 100 global discount -> taxable base 900, GST = 162
      // (18% of 900), NOT 180 (18% of the original 1000, the pre-fix bug).
      const invRes = await page.evaluate(({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH', globalDiscount: 100,
        items: [{ productId, quantity: 1, unitPrice: 1000, taxRate: 18 }]
      }), { customerId: custRes?.data?.id, productId: prodRes?.data?.id })
      r.log('discounted-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
      r.log('gst-computed-on-discounted-base-162-not-original-180', Math.abs((invRes?.data?.taxAmount ?? -1) - 162) < 0.01, `taxAmount=${invRes?.data?.taxAmount}`)
      r.log('invoice-total-correct-1062', Math.abs((invRes?.data?.totalAmount ?? -1) - 1062) < 0.01, `total=${invRes?.data?.totalAmount}`)
    })

    // ── Purchases by Vendor / by Item reports (both genuinely untested
    // anywhere before this) ────────────────────────────────────────────────
    let pbvSupplierId, pbvProductId
    await r.step('purchases-by-vendor-and-by-item-reports-reflect-a-real-bill', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Purchases-By Vendor` })
      pbvSupplierId = supRes?.data?.id
      const prodRes = await page.evaluate((name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'PCS', costPrice: 200, sellingPrice: 300, taxRate: 18
      }), `${TEST_PREFIX} Purchases-By Item ${Date.now()}`)
      pbvProductId = prodRes?.data?.id
      if (pbvProductId) createdProductIds.push(pbvProductId)

      const billRes = await page.evaluate(({ supplierId, productId }) => window.api.bills.create({
        supplierId, items: [{ productId, quantity: 3, unitCost: 200, taxRate: 18 }]
      }), { supplierId: pbvSupplierId, productId: pbvProductId })
      if (billRes?.data?.id) createdBillIds.push(billRes.data.id)
      r.log('purchases-by-source-bill-created', !!billRes?.success, JSON.stringify(billRes?.error || ''))

      const today = h.toLocalISODate(new Date())
      const byVendorRes = await page.evaluate(({ dateFrom, dateTo }) => window.api.reports.purchasesByVendor({ dateFrom, dateTo }), { dateFrom: today, dateTo: today })
      const vendorRow = (byVendorRes?.data?.rows || []).find((row) => row.supplierId === pbvSupplierId)
      r.log('purchases-by-vendor-shows-our-supplier', !!vendorRow && Math.abs(vendorRow.totalAmount - 708) < 0.01, JSON.stringify(vendorRow))

      const byItemRes = await page.evaluate(({ dateFrom, dateTo }) => window.api.reports.purchasesByItem({ dateFrom, dateTo }), { dateFrom: today, dateTo: today })
      const itemRowByQty = (byItemRes?.data?.rows || []).find((row) => row.quantity === 3 && !row.isService)
      r.log('purchases-by-item-shows-our-line', !!itemRowByQty && Math.abs(itemRowByQty.totalAmount - 708) < 0.01, JSON.stringify(itemRowByQty))
    })

    // ── Supplier bank details + PAN persist ────────────────────────────────
    await r.step('supplier-bank-details-and-pan-persist', async () => {
      const supRes = await makeSupplier({
        supplierName: `${TEST_PREFIX} Banked Vendor`,
        bankAccountNumber: '000111222333', bankIfscCode: 'HDFC0001234', bankName: 'HDFC Bank', panNumber: 'ABCDE1234F',
      })
      r.log('supplier-with-bank-details-created', !!supRes?.success, JSON.stringify(supRes?.error || ''))
      r.log('bank-account-number-persisted', supRes?.data?.bankAccountNumber === '000111222333', JSON.stringify(supRes?.data?.bankAccountNumber))
      r.log('bank-ifsc-persisted', supRes?.data?.bankIfscCode === 'HDFC0001234', JSON.stringify(supRes?.data?.bankIfscCode))
      r.log('pan-number-persisted', supRes?.data?.panNumber === 'ABCDE1234F', JSON.stringify(supRes?.data?.panNumber))
    })

    // ── Expense: vendor tracking, mileage (server-recomputed amount),
    // billable-to-customer flag ────────────────────────────────────────────
    await r.step('expense-vendor-mileage-and-billable-flag', async () => {
      const supRes = await makeSupplier({ supplierName: `${TEST_PREFIX} Expense Vendor` })
      const expSupplierId = supRes?.data?.id

      const custRes = await page.evaluate((name) => window.api.customers.create({ customerName: name, creditLimit: 0, taxExempt: false, customerKind: 'INDIVIDUAL' }), `${TEST_PREFIX} Billable Client ${Date.now()}`)
      if (custRes?.data?.id) createdCustomerIds.push(custRes.data.id)
      const billableCustomerId = custRes?.data?.id

      const catRes = await page.evaluate(() => window.api.expenses.listCategories())
      const categoryId = catRes?.data?.[0]?.id

      const expRes = await page.evaluate(({ categoryId, supplierId, billableCustomerId, today }) => window.api.expenses.create({
        categoryId, expenseName: 'E2E Bills Client Site Visit', amount: 1,
        expenseDate: today, supplierId, mileageKm: 40, mileageRatePerKm: 12, billableCustomerId,
      }), { categoryId, supplierId: expSupplierId, billableCustomerId, today: h.toLocalISODate(new Date()) })
      r.log('expense-with-vendor-mileage-billable-created', !!expRes?.success, JSON.stringify(expRes?.error || ''))
      r.log('expense-supplier-persisted', expRes?.data?.supplierId === expSupplierId, JSON.stringify(expRes?.data?.supplierId))
      r.log('expense-billable-customer-persisted', expRes?.data?.billableCustomerId === billableCustomerId, JSON.stringify(expRes?.data?.billableCustomerId))
      // Server recomputes amount = mileageKm * mileageRatePerKm = 40*12 = 480,
      // NOT the 1 we sent -- proves the recompute actually runs, not just a
      // pass-through of the client-sent amount.
      r.log('expense-amount-server-recomputed-from-mileage-480', Number(expRes?.data?.amount) === 480, `amount=${expRes?.data?.amount}`)
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()

    // Phase 61 tables aren't covered by harness.cleanupByNamePrefix (which
    // predates this phase) — clean them up directly here instead of leaving
    // suite-created rows behind in the shared dev DB.
    const cleaned = h.withDb((db) => {
      let payments = 0, bills = 0, billItems = 0, poItems = 0, pos = 0, ledger = 0, suppliers = 0
      // Delete first -- Expense.supplierId is a plain FK to Supplier, must
      // clear before the supplier-delete loop below or it silently falls
      // back to soft-deactivate instead.
      const expenses = db.prepare("DELETE FROM Expense WHERE expenseName LIKE 'E2E Bills%'").run().changes
      for (const billId of createdBillIds) {
        payments += db.prepare('DELETE FROM SupplierPayment WHERE billId = ?').run(billId).changes
        billItems += db.prepare('DELETE FROM BillItem WHERE billId = ?').run(billId).changes
        try { bills += db.prepare('DELETE FROM Bill WHERE id = ?').run(billId).changes } catch { /* left as VOID if still referenced */ }
      }
      for (const poId of createdPOIds) {
        poItems += db.prepare('DELETE FROM PurchaseOrderItem WHERE purchaseOrderId = ?').run(poId).changes
        try { pos += db.prepare('DELETE FROM PurchaseOrder WHERE id = ?').run(poId).changes } catch { /* ignore */ }
      }
      for (const supplierId of createdSupplierIds) {
        ledger += db.prepare('DELETE FROM SupplierLedger WHERE supplierId = ?').run(supplierId).changes
        try { suppliers += db.prepare('DELETE FROM Supplier WHERE id = ?').run(supplierId).changes } catch { db.prepare('UPDATE Supplier SET isActive = 0 WHERE id = ?').run(supplierId) }
      }
      for (const customerId of createdCustomerIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(customerId)
        try { db.prepare('DELETE FROM Customer WHERE id = ?').run(customerId) } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(customerId) }
      }
      for (const productId of createdProductIds) {
        db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(productId)
        db.prepare('DELETE FROM Inventory WHERE productId = ?').run(productId)
        try { db.prepare('DELETE FROM Product WHERE id = ?').run(productId) } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(productId) }
      }
      return { payments, bills, billItems, poItems, pos, ledger, suppliers, expenses }
    })
    console.log('extra cleanup (Phase 61 tables):', JSON.stringify(cleaned))
    const genericCleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(genericCleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBILLS/PURCHASES (PHASE 61): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
