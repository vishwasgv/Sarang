/**
 * Suite 68 — General vertical, Phase 67 §9.1 item 1: "Which template fits
 * you?" wizard. GENERAL is the first-ever E2E-tested vertical this phase —
 * previously fully untouched. A GENERAL business at least a week old with
 * a genuine, threshold-clearing usage pattern gets a dismissible Dashboard
 * suggestion pointing at the template that fits.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Gen'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let originalCreatedAt
  let businessProfileId
  let cashTrendInvoiceId

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-general', async () => {
      // "General" alone is ambiguous — RETAIL's own tile label is "Retail /
      // General Store" and also contains the substring "General", so a
      // loose match picks whichever tile is first in DOM order (RETAIL).
      // "General Business" is GENERAL's exact, unique label.
      const sw = await h.switchBusinessType(page, 'General Business')
      r.log('business-type-switched-to-general', sw.to === 'GENERAL', JSON.stringify(sw))
    })

    await r.step('backdate-business-profile-and-seed-carton-products', async () => {
      // The suggestion is deliberately withheld for a business less than a
      // week old (see template-suggestion.service.ts's MIN_BUSINESS_AGE_DAYS)
      // — backdate the real BusinessProfile row so this suite can actually
      // exercise the "old enough" branch, not just the "too new" one.
      h.withDb((db) => {
        const row = db.prepare('SELECT id, createdAt FROM BusinessProfile LIMIT 1').get()
        businessProfileId = row.id
        originalCreatedAt = row.createdAt
        const eightDaysAgoMs = Date.now() - 8 * 86400000
        db.prepare('UPDATE BusinessProfile SET createdAt = ? WHERE id = ?').run(eightDaysAgoMs, row.id)
      })
      r.log('business-profile-backdated', true)

      let allCreated = true
      for (let i = 0; i < 3; i++) {
        const res = await page.evaluate((idx) => window.api.products.create({
          productName: `E2E Gen Carton Product ${idx}`, unit: 'PCS', productType: 'STANDARD',
          costPrice: 10, sellingPrice: 20, taxRate: 18, openingQuantity: 10,
          sellByPack: true, packUnit: 'BOX', unitsPerPack: 12,
        }), i)
        if (!res?.success) allCreated = false
      }
      r.log('three-carton-pack-products-created', allCreated)
    })

    // Reason-text fragments mirror en.json's dashboard.templateSuggestion.reason
    // keys — used to confirm the UI renders the SAME suggestion the API
    // returned, whichever one actually wins. Deliberately not asserting a
    // specific businessType: this reads the real shared dev DB, so whichever
    // signal has the most genuine rows (possibly accumulated by earlier
    // suites, e.g. restaurant KOT orders) legitimately outscores this
    // suite's own 3 freshly-seeded carton products — the scoring is working
    // correctly, not broken, when that happens.
    const REASON_TEXT_BY_SIGNAL = {
      cartonProducts: 'carton/pack billing',
      jewelleryProducts: 'metal-weight pricing',
      rentalProducts: 'marked as rentable',
      kotOrders: 'orders to the kitchen',
      repairJobs: 'repair or job tickets',
      appointments: 'appointments',
      variantOrLooseProducts: 'size/colour variants or loose-weight pricing'
    }
    let suggestedSignalKey

    await r.step('template-suggestion-api-returns-a-valid-suggestion', async () => {
      const res = await page.evaluate(() => window.api.templateSuggestion.get())
      r.log('template-suggestion-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      const d = res?.data
      suggestedSignalKey = d?.signalKey
      r.log('template-suggestion-has-valid-shape', !!d && typeof d.businessType === 'string' && typeof d.matchedCount === 'number' && d.matchedCount > 0 && d.signalKey in REASON_TEXT_BY_SIGNAL, JSON.stringify(d))
    })

    await r.step('dashboard-shows-suggestion-banner-via-real-ui', async () => {
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(1200)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('dashboard-shows-template-suggestion-title', bodyText.includes('Looking for a better fit?'))
      const expectedFragment = REASON_TEXT_BY_SIGNAL[suggestedSignalKey]
      r.log('dashboard-shows-matching-reason-text', !!expectedFragment && bodyText.includes(expectedFragment), `signal=${suggestedSignalKey} fragment="${expectedFragment}"`)
      await h.shot(page, 'general-template-suggestion-banner')
    })

    await r.step('explore-button-navigates-to-industry-settings', async () => {
      const exploreBtn = page.locator('button:has-text("Explore business templates")').first()
      r.log('explore-button-present', await exploreBtn.count() > 0)
      await exploreBtn.click()
      await page.waitForTimeout(700)
      r.log('navigated-to-industry-settings', page.url().includes('/settings/industry'), page.url())
    })

    await r.step('dismiss-suggestion-and-verify-it-never-shows-again', async () => {
      const beforeDismiss = await page.evaluate(() => window.api.templateSuggestion.isDismissed())
      r.log('not-dismissed-before-clicking', beforeDismiss?.success && beforeDismiss?.data === false, JSON.stringify(beforeDismiss))

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(1000)
      const dismissBtn = page.locator('button[title="Dismiss this suggestion"]').first()
      r.log('dismiss-button-present', await dismissBtn.count() > 0)
      await dismissBtn.click()
      await page.waitForTimeout(500)

      const bodyTextAfter = await page.locator('body').innerText().catch(() => '')
      r.log('banner-hidden-immediately-after-dismiss', !bodyTextAfter.includes('Looking for a better fit?'))

      const afterDismiss = await page.evaluate(() => window.api.templateSuggestion.isDismissed())
      r.log('dismissed-flag-persisted-via-real-api', afterDismiss?.success && afterDismiss?.data === true, JSON.stringify(afterDismiss))

      // Remount the whole screen (not just re-toggle the same route) to
      // prove the dismissal survives a real navigation, not just in-memory
      // component state from the click itself.
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(1000)
      const bodyTextAfterRemount = await page.locator('body').innerText().catch(() => '')
      r.log('banner-still-hidden-after-remount', !bodyTextAfterRemount.includes('Looking for a better fit?'))
    })

    // ─── Phase 67 §9.1 item 2: Custom Document Builder ─────────────────────
    await r.step('custom-documents-create-type-field-and-entry-via-real-ui', async () => {
      await h.gotoHash(page, '#/custom-documents')
      await page.waitForTimeout(700)

      // Create a new document type.
      const newTypeBtn = page.locator('button:has-text("New Document Type")').first()
      r.log('new-document-type-button-present', await newTypeBtn.count() > 0)
      await newTypeBtn.click()
      await page.waitForTimeout(300)
      await page.getByLabel('Document Name').fill('E2E Gen Visitor Register')
      await page.locator('button:has-text("Save")').last().click()
      await page.waitForTimeout(700)

      const bodyAfterType = await page.locator('body').innerText().catch(() => '')
      r.log('document-type-appears-in-list', bodyAfterType.includes('E2E Gen Visitor Register'))

      // Define a custom field for it via "Manage Fields".
      const manageFieldsBtn = page.locator('button:has-text("Manage Fields")').first()
      r.log('manage-fields-button-present', await manageFieldsBtn.count() > 0)
      await manageFieldsBtn.click()
      await page.waitForTimeout(300)
      await page.locator('button:has-text("New Field")').first().click()
      await page.waitForTimeout(300)
      await page.getByLabel('Field Name').fill('Visitor Name')
      await page.locator('button:has-text("Save")').last().click()
      await page.waitForTimeout(700)

      const bodyAfterField = await page.locator('body').innerText().catch(() => '')
      r.log('field-appears-in-manage-fields-list', bodyAfterField.includes('Visitor Name'))

      // Log a real entry using that field.
      const newEntryBtn = page.locator('button:has-text("New Entry")').first()
      r.log('new-entry-button-present', await newEntryBtn.count() > 0)
      await newEntryBtn.click()
      await page.waitForTimeout(500)
      const visitorNameInput = page.locator('label:has-text("Visitor Name")').locator('xpath=following-sibling::input').first()
      await visitorNameInput.fill('Jane Doe')
      await page.getByLabel('Notes').fill('E2E test visitor entry')
      await page.locator('button:has-text("Save")').last().click()
      await page.waitForTimeout(700)

      const bodyAfterEntry = await page.locator('body').innerText().catch(() => '')
      r.log('entry-appears-in-list-with-field-value', bodyAfterEntry.includes('Jane Doe') && bodyAfterEntry.includes('E2E test visitor entry'))
      await h.shot(page, 'general-custom-documents-entry')

      // Cross-check via the real API, independent of the UI.
      const typesRes = await page.evaluate(() => window.api.customDocuments.listTypes())
      const createdType = typesRes?.data?.find((t) => t.name === 'E2E Gen Visitor Register')
      r.log('document-type-genuinely-persisted-via-real-api', !!createdType, JSON.stringify(createdType))
      if (createdType) {
        const entriesRes = await page.evaluate((id) => window.api.customDocuments.listEntries(id), createdType.id)
        const entry = entriesRes?.data?.[0]
        r.log('entry-genuinely-persisted-with-custom-field-value', entry?.customFields && Object.values(entry.customFields).includes('Jane Doe'), JSON.stringify(entry))

        // Delete the entry via the real UI and confirm it's gone.
        if (entry) {
          const deleteBtn = page.locator('tbody tr').first().locator('button').last()
          await deleteBtn.click()
          await page.waitForTimeout(300)
          await page.locator('button:has-text("Delete")').last().click()
          await page.waitForTimeout(700)
          const entriesAfterDelete = await page.evaluate((id) => window.api.customDocuments.listEntries(id), createdType.id)
          r.log('entry-deleted-via-real-ui', (entriesAfterDelete?.data?.length ?? 1) === 0, JSON.stringify(entriesAfterDelete?.data))
        }
      }
    })

    // ─── Phase 67 §9.1 item 3: Category Mix Report ─────────────────────────
    let categoryMixCategoryId, categoryMixProductId

    await r.step('seed-category-mix-product-and-sale', async () => {
      const catRes = await page.evaluate(() => window.api.categories.create({ name: 'E2E Gen Mix Category' }))
      categoryMixCategoryId = catRes?.data?.id
      r.log('category-created', !!catRes?.success, JSON.stringify(catRes?.error || ''))

      const prodRes = await page.evaluate((categoryId) => window.api.products.create({
        productName: 'E2E Gen Mix Product', productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 5, openingQuantity: 20, categoryId,
      }), categoryMixCategoryId)
      categoryMixProductId = prodRes?.data?.id
      r.log('category-mix-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const invRes = await page.evaluate((pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 4, unitPrice: 100, taxRate: 5 }],
      }), categoryMixProductId)
      r.log('category-mix-sale-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
    })

    await r.step('category-mix-report-computes-correctly-via-real-api', async () => {
      const monthStart = new Date(); monthStart.setDate(1)
      const from = h.toLocalISODate(monthStart)
      const to = h.toLocalISODate(new Date())

      const res = await page.evaluate(({ from, to }) => window.api.reports.categoryMix({ dateFrom: from, dateTo: to }), { from, to })
      r.log('category-mix-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      const row = (res?.data?.rows || []).find((rr) => rr.categoryId === categoryMixCategoryId)
      r.log('category-mix-row-found', !!row, JSON.stringify(row))
      if (row) {
        r.log('units-sold-is-4', row.unitsSold === 4, `unitsSold=${row.unitsSold}`)
        // lineTotal (and so this report's revenue) includes the 5% tax rate
        // the invoice item was created with: 100 * 4 * 1.05 = 420, not the
        // pre-tax 400 — same convention as every other revenue-bearing report.
        r.log('revenue-is-420-tax-inclusive', row.revenue === 420, `revenue=${row.revenue}`)
      }
    })

    await r.step('category-mix-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Category Mix' }).first()
      r.log('category-mix-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      const monthStart = new Date(); monthStart.setDate(1)
      await dateInputs.nth(0).fill(h.toLocalISODate(monthStart))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('category-mix-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('category-mix-report-shows-category', bodyText.includes('E2E Gen Mix Category'))
      await h.shot(page, 'general-category-mix')
    })

    // ─── Phase 67 §9.1 item 4: Combined Cash Position Trend ────────────────
    let cashTrendProductId

    await r.step('cash-position-trend-computes-correctly-via-real-api', async () => {
      // Delta-based, not absolute-value-based — this reads the real shared
      // dev DB's GL, which already carries substantial activity from every
      // earlier suite this session (same honesty principle established in
      // this suite's very first step above for the template-suggestion
      // signal). Snapshot today's closing balance, seed one known real CASH
      // sale (taxRate 0, so totalAmount is exactly the sellingPrice with no
      // rounding), then confirm the closing balance moved by exactly that
      // much — robust regardless of whatever else already happened today.
      const today = h.toLocalISODate(new Date())

      const before = await page.evaluate(({ from, to }) => window.api.reports.cashPositionTrend({ dateFrom: from, dateTo: to }), { from: today, to: today })
      r.log('cash-position-trend-api-succeeded-before', !!before?.success, JSON.stringify(before?.error || ''))
      const closingBefore = before?.data?.closingBalance

      const prodRes = await page.evaluate(() => window.api.products.create({
        productName: 'E2E Gen Cash Trend Product', productType: 'STANDARD', unit: 'PCS',
        costPrice: 200, sellingPrice: 300, taxRate: 0, openingQuantity: 10,
      }))
      cashTrendProductId = prodRes?.data?.id
      r.log('cash-trend-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const invRes = await page.evaluate((pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 1, unitPrice: 300, taxRate: 0 }],
      }), cashTrendProductId)
      cashTrendInvoiceId = invRes?.data?.id
      r.log('cash-trend-sale-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const after = await page.evaluate(({ from, to }) => window.api.reports.cashPositionTrend({ dateFrom: from, dateTo: to }), { from: today, to: today })
      const closingAfter = after?.data?.closingBalance
      r.log('closing-balance-increased-by-exactly-the-cash-sale-amount', typeof closingBefore === 'number' && typeof closingAfter === 'number' && Math.round((closingAfter - closingBefore) * 100) / 100 === 300, `before=${closingBefore} after=${closingAfter}`)
    })

    await r.step('cash-position-trend-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Combined Cash Position Trend' }).first()
      r.log('cash-position-trend-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      const monthStart = new Date(); monthStart.setDate(1)
      await dateInputs.nth(0).fill(h.toLocalISODate(monthStart))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('cash-position-trend-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      // Case-insensitive — SummaryCards labels are CSS-uppercased, so
      // Chromium's own innerText() honors that transform (known gotcha,
      // not a rendering bug: a plain .includes('Closing Balance') would
      // spuriously fail against the literal 'CLOSING BALANCE' text).
      r.log('cash-position-trend-report-shows-closing-balance-label', bodyText.toLowerCase().includes('closing balance'))
      await h.shot(page, 'general-cash-position-trend')
    })

    // ─── Phase 67 §9.1 item 5: Universal Quote -> Order -> Invoice pipeline ─
    let pipelineCustomerId, pipelineProductId, pipelineQuotationId, pipelineSalesOrderId

    await r.step('convert-quotation-to-sales-order-via-real-api', async () => {
      const custRes = await page.evaluate(() => window.api.customers.create({
        customerName: 'E2E Gen Pipeline Customer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      pipelineCustomerId = custRes?.data?.id
      r.log('pipeline-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))

      const prodRes = await page.evaluate(() => window.api.products.create({
        productName: 'E2E Gen Pipeline Widget', productType: 'STANDARD', unit: 'PCS',
        costPrice: 50, sellingPrice: 100, taxRate: 18, openingQuantity: 10,
      }))
      pipelineProductId = prodRes?.data?.id
      r.log('pipeline-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const quoteRes = await page.evaluate(({ customerId, productId }) => window.api.quotations.create({
        customerId, items: [{ productId, productName: 'E2E Gen Pipeline Widget', quantity: 3, unitPrice: 100, discount: 10, taxRate: 18 }],
      }), { customerId: pipelineCustomerId, productId: pipelineProductId })
      pipelineQuotationId = quoteRes?.data?.id
      r.log('pipeline-quotation-created', !!quoteRes?.success, JSON.stringify(quoteRes?.error || ''))

      const soRes = await page.evaluate((id) => window.api.quotations.convertToSalesOrder(id), pipelineQuotationId)
      pipelineSalesOrderId = soRes?.data?.id
      r.log('quotation-converted-to-sales-order', !!soRes?.success, JSON.stringify(soRes?.error || ''))
      // 3 * 100 = 300 gross, 10% discount = 30 off -> 270 net, +18% tax = 318.60,
      // reproducing the quotation's own already-agreed total on the Sales Order.
      r.log('sales-order-total-matches-quotation-total', soRes?.data?.totalAmount === 318.6, `totalAmount=${soRes?.data?.totalAmount}`)
      r.log('sales-order-linked-back-to-quotation', soRes?.data?.quotationId === pipelineQuotationId, JSON.stringify(soRes?.data))

      // A second attempt must be refused — already converted.
      const repeatRes = await page.evaluate((id) => window.api.quotations.convertToSalesOrder(id), pipelineQuotationId)
      r.log('repeat-conversion-rejected', repeatRes?.success === false && repeatRes?.error?.code === 'QT-008', JSON.stringify(repeatRes?.error))
    })

    await r.step('pipeline-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/billing/quotations')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('quotations-list-shows-pipeline-customer', bodyText.includes('E2E Gen Pipeline Customer'))
      // Once converted, the row shows a link to the Sales Order, not the
      // Convert buttons — confirms QuotationsScreen genuinely re-fetched
      // and re-rendered the real converted state, not stale cached data.
      const soLink = page.locator('button', { hasText: /^SO-/ }).first()
      r.log('quotations-list-shows-sales-order-link', await soLink.count() > 0)
      if (await soLink.count() > 0) {
        await soLink.click()
        await page.waitForTimeout(700)
        r.log('navigated-to-sales-order-detail', page.url().includes('/sales-orders/'), page.url())
        const soBodyText = await page.locator('body').innerText().catch(() => '')
        r.log('sales-order-detail-notes-reference-the-quotation', soBodyText.includes('Converted from quotation'))
        await h.shot(page, 'general-quote-order-invoice-pipeline')
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'GENERAL') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    // Restore the real BusinessProfile.createdAt this suite backdated, and
    // clear the global dismissal flag it deliberately set — both are
    // shared, install-wide state, not per-test-prefix rows, so
    // cleanupByNamePrefix() below can't reach them.
    if (businessProfileId && originalCreatedAt !== undefined) {
      h.withDb((db) => {
        db.prepare('UPDATE BusinessProfile SET createdAt = ? WHERE id = ?').run(originalCreatedAt, businessProfileId)
        db.prepare("DELETE FROM Setting WHERE settingKey = 'template_suggestion_dismissed'").run()
      })
    }
    // cleanupByNamePrefix() below hard-deletes the Invoice row but has no
    // concept of JournalEntry at all (no name field to prefix-match on) —
    // same gotcha 66-cost-centres-budgets-payroll.js's own cleanup already
    // documented for its payroll Expense postings. Without this, the real
    // "Debit Cash & Bank" JournalEntry this suite's cash-position-trend sale
    // posted would orphan permanently (sourceId pointing at a since-deleted
    // Invoice), silently inflating the shared dev DB's Cash & Bank balance a
    // little more on every single run forever.
    if (cashTrendInvoiceId) {
      h.withDb((db) => {
        const je = db.prepare("SELECT id FROM JournalEntry WHERE sourceType = 'INVOICE' AND sourceId = ?").get(cashTrendInvoiceId)
        if (je) {
          db.prepare('DELETE FROM JournalEntryLine WHERE journalEntryId = ?').run(je.id)
          db.prepare('DELETE FROM JournalEntry WHERE id = ?').run(je.id)
        }
      })
    }
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nGENERAL VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
