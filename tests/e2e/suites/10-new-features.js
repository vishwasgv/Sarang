/**
 * Suite 10 — Live UAT for the 2026-07-12 fresh-audit build (Jewellery
 * vertical, tax exemption, Engagement/Pest Control recurring re-invoice
 * fix, Architect/Civil Engineer real depth). None of this is covered by
 * the pre-existing 00-09 suites, which predate this work.
 *
 * Jewellery pricing/exchange math and the Engagement/Pest period-keyed
 * claim logic are exercised via direct IPC calls (same pattern 02's
 * double-booking check uses) since they're business-logic correctness
 * checks, not UI-rendering checks. Product creation and the Billing-screen
 * add-to-cart pricing flow are driven through the real UI since that's the
 * actual path a jeweller uses and where a wiring bug would show up.
 */
const h = require('../harness')
const path = require('path')
const fs = require('fs')

const TEST_PREFIX = 'E2E New'
const DUMMY_FILE_PATH = path.join(__dirname, '..', '.tmp-e2e-dummy-attachment.txt')

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  fs.writeFileSync(DUMMY_FILE_PATH, 'E2E test design plan placeholder file.\n')
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    const originalBusinessType = h.getBusinessType()

    // ── Jewellery ──────────────────────────────────────────────────────────
    await r.step('switch-to-jewellery', async () => {
      const res = await h.switchBusinessType(page, 'Jewellery')
      r.log('business-type-switched-to-jewellery', res.changed, JSON.stringify(res))
    })

    await r.step('set-metal-rate', async () => {
      await h.gotoHash(page, '#/jewellery/metal-rates')
      await page.waitForTimeout(600)
      r.log('metal-rates-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      await page.getByRole('button', { name: 'Set Rate' }).click()
      await page.waitForTimeout(300)
      // Metal Type select defaults to GOLD already
      await page.getByLabel(/^Purity/).fill('22K')
      await page.getByLabel('Rate per Gram').fill('6000')
      await page.getByRole('button', { name: 'Save Rate' }).click()
      await page.waitForTimeout(800)
      r.log('metal-rate-saved-no-crash', !(await h.hasErrorBoundary(page)))
      const listRes = await page.evaluate(async () => window.api.metalRate.list())
      const saved = (listRes?.data || []).find((rr) => rr.metalType === 'GOLD' && rr.purity === '22K')
      r.log('metal-rate-findable-via-api', saved?.ratePerGram === 6000, JSON.stringify(saved))
    })

    let jewelProductId
    await r.step('create-jewellery-product-via-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(600)
      await page.getByRole('button', { name: 'Add Product' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Product Name *').fill(`${TEST_PREFIX} Gold Ring`)

      const metalSelect = modal.getByLabel('Metal Type')
      const hasMetalSelect = await metalSelect.count() > 0
      r.log('jewellery-fields-visible-on-form', hasMetalSelect)
      if (hasMetalSelect) {
        await metalSelect.selectOption('GOLD')
        await page.waitForTimeout(300)
        await modal.getByLabel('Purity *').fill('22K')
        await modal.getByLabel('Gross Weight (g) *').fill('10')
        await modal.getByLabel('Stone Weight (g)').fill('1')
        await page.waitForTimeout(300)
        const netWeightText = await modal.locator('text=/9\\.000/').count()
        r.log('net-weight-computed-in-form', netWeightText > 0)
        await modal.getByLabel('Making Charge Type').selectOption('FIXED')
        await page.waitForTimeout(200)
        await modal.getByLabel('Making Charge (fixed)').fill('500')
      }
      await modal.getByLabel('Opening Stock Quantity').fill('5')
      await modal.getByRole('button', { name: 'Add Product' }).click()
      await page.waitForTimeout(1000)
      r.log('jewellery-product-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.products.list({ search: 'E2E New Gold Ring', limit: 10 }))
      const items = listRes?.data?.products || listRes?.data?.items || []
      const created = items.find((p) => p.productName === `${TEST_PREFIX} Gold Ring`)
      jewelProductId = created?.id
      r.log('jewellery-product-findable-via-api', !!jewelProductId, JSON.stringify({ metalType: created?.metalType, netWeight: created?.netWeight }))
      r.log('jewellery-netWeight-persisted-correctly', created?.netWeight === 9, JSON.stringify(created?.netWeight))
    })

    let jewelCustomerId
    await r.step('bill-jewellery-item', async () => {
      if (!jewelProductId) return r.log('bill-jewellery-item', false, 'no jewelProductId')
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Jewel Client`, phone: `7${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      jewelCustomerId = custRes?.data?.id
      r.log('jewel-customer-created', !!jewelCustomerId)

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill('E2E New Gold Ring')
      await page.waitForTimeout(700)
      const result = page.locator('button', { hasText: `${TEST_PREFIX} Gold Ring` }).first()
      r.log('jewellery-product-found-in-billing-search', await result.count() > 0)
      await result.click()
      await page.waitForTimeout(1200) // allow async metal-rate price lookup to resolve

      // Expected: netWeight(9) * rate(6000) + makingCharge(500) = 54500
      const priceText = await page.locator('text=/54,?500/').count()
      r.log('jewellery-line-price-computed-from-metal-rate', priceText > 0)

      const qtyInput = page.locator('input[type="number"][min="0.001"]').first()
      const qtyDisabled = await qtyInput.isDisabled().catch(() => false)
      r.log('jewellery-quantity-locked-to-one', qtyDisabled)
      await h.shot(page, 'jewellery-cart-priced')

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill(`${TEST_PREFIX} Jewel Client`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Jewel Client` }).first().click()
      await page.waitForTimeout(300)

      const cashBtn = page.getByRole('button', { name: 'Cash', exact: true })
      if (await cashBtn.count()) await cashBtn.click()
      await page.waitForTimeout(300)

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      const submitted = !!match && match[1] !== 'new'
      r.log('jewellery-invoice-submitted', submitted, url)
      if (submitted) {
        const invRes = await page.evaluate(async (id) => window.api.billing.getInvoice(id), match[1])
        // netWeight(9) * rate(6000) + makingCharge(500) = 54500, no tax rate set on the product
        r.log('jewellery-invoice-total-matches-computed-price', Math.abs((invRes?.data?.totalAmount ?? 0) - 54500) < 1, String(invRes?.data?.totalAmount))
      } else {
        const bodyText = await page.locator('body').innerText().catch(() => '')
        const cartText = await page.locator('div.flex-1.overflow-y-auto, main').first().innerText().catch(() => bodyText)
        console.log('DEBUG jewellery submit failed. Contains "Cart" text:', bodyText.includes('cart') || bodyText.includes('Cart'))
        console.log('DEBUG jewellery submit failed. Toast-like keywords found:', ['Set Not', 'not set', 'required', 'Error', 'stock', 'Stock'].filter((k) => cartText.includes(k)))
        await h.shot(page, 'jewellery-submit-failed-debug')
      }
    })

    await r.step('cleanup-jewellery-metal-rate', async () => {
      // Leave no permanent GOLD/22K rate behind for the founder's real DB.
      h.withDb((db) => { db.prepare("DELETE FROM MetalRate WHERE metalType = 'GOLD' AND purity = '22K'").run() })
      r.log('metal-rate-cleanup-done', true)
    })

    await r.step('record-metal-exchange', async () => {
      await h.gotoHash(page, '#/jewellery/exchanges')
      await page.waitForTimeout(600)
      r.log('exchange-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      // Set a fresh rate first (cleaned up above) so the exchange computes a non-zero value.
      const setRes = await page.evaluate(async () => window.api.metalRate.upsert({ metalType: 'SILVER', purity: '925', ratePerGram: 80 }))
      r.log('exchange-test-rate-set', !!setRes?.success)

      const createRes = await page.evaluate(async (prefix) => window.api.metalExchange.create({
        customerName: `${prefix} Walkin`, metalType: 'SILVER', purity: '925', grossWeight: 10, deductionWeight: 1,
      }), TEST_PREFIX)
      // netWeight = 9, value = 9 * 80 = 720
      r.log('metal-exchange-value-computed-correctly', createRes?.data?.valueGiven === 720, JSON.stringify(createRes?.data))
      h.withDb((db) => { db.prepare("DELETE FROM MetalRate WHERE metalType = 'SILVER' AND purity = '925'").run() })
      if (createRes?.data?.id) h.withDb((db) => { db.prepare('DELETE FROM MetalExchange WHERE id = ?').run(createRes.data.id) })
    })

    await r.step('jewellery-dashboard-widget-and-report', async () => {
      const setRes = await page.evaluate(async () => window.api.metalRate.upsert({ metalType: 'GOLD', purity: '22K', ratePerGram: 6100 }))
      r.log('dashboard-test-rate-set', !!setRes?.success)

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(1800)
      r.log('dashboard-loads-no-crash-on-jewellery', !(await h.hasErrorBoundary(page)))
      const focusCard = page.locator('text=/Jewellery Focus/i')
      r.log('jewellery-focus-widget-present', await focusCard.count() > 0)
      // fmt() here is the Dashboard's abbreviated fmtMoney (K/L/Cr), not a
      // full formatCurrency — 6100 renders as "6.1K", not "6,100".
      const rateText = page.locator('text=/6\\.1K/')
      r.log('jewellery-focus-widget-shows-todays-rate', await rateText.count() > 0)

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Jewellery Report' }).first()
      r.log('jewellery-report-tile-present', await tile.count() > 0)
      if (await tile.count() > 0) {
        await tile.click()
        await page.waitForTimeout(500)
        const dateInputs = page.locator('input[type="date"]')
        const from = new Date(Date.now() - 30 * 24 * 3600000).toISOString().slice(0, 10)
        const to = new Date().toISOString().slice(0, 10)
        await dateInputs.nth(0).fill(from)
        await dateInputs.nth(1).fill(to)
        await page.locator('button:has-text("Generate Report")').click()
        await page.waitForTimeout(1200)
        r.log('jewellery-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const valuationText = page.locator('text=/Stock Valuation/i')
        r.log('jewellery-report-shows-stock-valuation-summary', await valuationText.count() > 0)
        await h.shot(page, 'jewellery-report')
      }

      h.withDb((db) => { db.prepare("DELETE FROM MetalRate WHERE metalType = 'GOLD' AND purity = '22K'").run() })
    })

    await r.step('restore-business-type-after-jewellery', async () => {
      if (originalBusinessType) {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored-after-jewellery', !!res?.success, originalBusinessType)
        await page.reload()
        await page.waitForTimeout(1500)
      }
    })

    // ── Tax exemption ────────────────────────────────────────────────────────
    let exemptCustomerId, taxedCustomerId
    await r.step('tax-exempt-customer-billed-at-zero-tax', async () => {
      const exemptRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Exempt Client`, phone: `6${String(Date.now()).slice(-9)}`,
        taxExempt: true, taxExemptReason: 'E2E reverse charge test',
      }), TEST_PREFIX)
      exemptCustomerId = exemptRes?.data?.id
      r.log('tax-exempt-customer-created', !!exemptCustomerId && exemptRes?.data?.taxExempt === true, JSON.stringify(exemptRes?.error || ''))

      const taxedRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Taxed Client`, phone: `5${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      taxedCustomerId = taxedRes?.data?.id

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Taxed Widget`, productType: 'STANDARD', sellingPrice: 1000, taxRate: 18, unit: 'NOS', openingQuantity: 100,
      }), TEST_PREFIX)
      const prodId = prodRes?.data?.id
      r.log('tax-test-product-created', !!prodId, JSON.stringify(prodRes?.error || ''))

      if (exemptCustomerId && taxedCustomerId && prodId) {
        const exemptInvoice = await page.evaluate(async ({ customerId, prodId }) => window.api.billing.createInvoice({
          customerId, paymentMethod: 'CASH', gstType: 'CGST_SGST', items: [{ productId: prodId, quantity: 1, unitPrice: 1000 }],
        }), { customerId: exemptCustomerId, prodId })
        const exemptTotal = exemptInvoice?.data?.totalAmount ?? exemptInvoice?.data?.grandTotal
        r.log('exempt-customer-invoice-has-zero-tax', exemptTotal === 1000, JSON.stringify({ total: exemptTotal, error: exemptInvoice?.error }))

        const taxedInvoice = await page.evaluate(async ({ customerId, prodId }) => window.api.billing.createInvoice({
          customerId, paymentMethod: 'CASH', gstType: 'CGST_SGST', items: [{ productId: prodId, quantity: 1, unitPrice: 1000 }],
        }), { customerId: taxedCustomerId, prodId })
        const taxedTotal = taxedInvoice?.data?.totalAmount ?? taxedInvoice?.data?.grandTotal
        r.log('normal-customer-invoice-has-tax-applied', taxedTotal === 1180, JSON.stringify({ total: taxedTotal, error: taxedInvoice?.error }))
      }
    })

    // ── Engagement recurring re-invoice (the original CA/CS permanent-block bug) ──
    let engagementId
    await r.step('engagement-recurring-invoice-not-permanently-blocked', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} CA Client`, phone: `4${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const clientId = custRes?.data?.id

      const engRes = await page.evaluate(async (clientId) => window.api.engagement.create({
        clientId, title: 'E2E New Retainer', engagementType: 'RETAINER', feeType: 'RETAINER_MONTHLY', feeAmount: 5000, billingDay: 1,
      }), clientId)
      engagementId = engRes?.data?.id
      r.log('engagement-created', !!engagementId, JSON.stringify(engRes?.error || ''))
      if (!engagementId) return

      const firstInvoice = await page.evaluate(async (id) => window.api.engagement.generateInvoice({ id, period: '2026-01' }), engagementId)
      r.log('first-period-invoice-generated', !!firstInvoice?.success, JSON.stringify(firstInvoice?.error || ''))

      const samePeriodRetry = await page.evaluate(async (id) => window.api.engagement.generateInvoice({ id, period: '2026-01' }), engagementId)
      r.log('same-period-retry-correctly-blocked', samePeriodRetry?.success === false && samePeriodRetry?.error?.code === 'EN29-008', JSON.stringify(samePeriodRetry?.error))

      // The bug this fixed: a naive one-shot "already invoiced" flag would permanently
      // block ALL future invoices. Confirm the NEXT period succeeds — this is the crux.
      const nextPeriodInvoice = await page.evaluate(async (id) => window.api.engagement.generateInvoice({ id, period: '2026-02' }), engagementId)
      r.log('next-period-invoice-not-permanently-blocked', !!nextPeriodInvoice?.success, JSON.stringify(nextPeriodInvoice?.error || ''))
    })

    // ── Pest Control contract recurring re-invoice ──────────────────────────
    let pestContractId
    await r.step('pest-contract-recurring-invoice-works', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Pest Client`, phone: `3${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const clientId = custRes?.data?.id

      const contractRes = await page.evaluate(async (clientId) => window.api.pestContract.create({
        clientId, propertyAddress: '123 E2E Test St', propertyType: 'RESIDENTIAL', pestTypes: ['COCKROACHES'],
        serviceFrequency: 'MONTHLY', startDate: '2026-01-01', contractValue: 2000, status: 'ACTIVE',
      }), clientId)
      pestContractId = contractRes?.data?.id
      r.log('pest-contract-created', !!pestContractId, JSON.stringify(contractRes?.error || ''))
      if (!pestContractId) return

      const firstInvoice = await page.evaluate(async (id) => window.api.pestContract.generateInvoice({ id, period: '2026-01' }), pestContractId)
      r.log('pest-first-period-invoice-generated', !!firstInvoice?.success, JSON.stringify(firstInvoice?.error || ''))

      const retry = await page.evaluate(async (id) => window.api.pestContract.generateInvoice({ id, period: '2026-01' }), pestContractId)
      r.log('pest-same-period-retry-correctly-blocked', retry?.success === false && retry?.error?.code === 'PCT-004', JSON.stringify(retry?.error))

      const nextPeriod = await page.evaluate(async (id) => window.api.pestContract.generateInvoice({ id, period: '2026-02' }), pestContractId)
      r.log('pest-next-period-invoice-succeeds', !!nextPeriod?.success, JSON.stringify(nextPeriod?.error || ''))
    })

    // ── Architect / Civil Engineer real depth ───────────────────────────────
    await r.step('architect-drawing-register-depth', async () => {
      const res = await h.switchBusinessType(page, 'Architect')
      r.log('business-type-switched-to-architect', res.changed, JSON.stringify(res))

      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Architect Client`, phone: `2${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const projRes = await page.evaluate(async ({ clientId, prefix }) => window.api.serviceProject.create({
        clientId, projectName: `${prefix} Villa Project`, projectType: 'ARCHITECTURE', status: 'ACTIVE',
      }), { clientId: custRes?.data?.id, prefix: TEST_PREFIX })
      const architectProjectId = projRes?.data?.id
      r.log('architect-test-project-created', !!architectProjectId, JSON.stringify(projRes?.error || ''))

      await h.gotoHash(page, '#/service/drawing-register')
      await page.waitForTimeout(700)
      r.log('drawing-register-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      if (architectProjectId) {
        await page.getByLabel('Project').selectOption(architectProjectId)
        await page.waitForTimeout(400)
        await page.getByRole('button', { name: /Add Drawing/i }).click()
        await page.waitForTimeout(400)
        await page.getByLabel('Drawing Number *').fill('DWG-001')
        await page.getByLabel('Title *').fill('Ground Floor Plan')
        await page.getByLabel('Revision').fill('B')
        await page.getByRole('button', { name: /^Save$/i }).click()
        await page.waitForTimeout(900)
        r.log('drawing-created-no-crash', !(await h.hasErrorBoundary(page)))

        const listRes = await page.evaluate(async (projectId) => window.api.drawingRevision.list({ projectId }), architectProjectId)
        const created = (listRes?.data || []).find((d) => d.drawingNumber === 'DWG-001')
        r.log('drawing-findable-via-api-with-correct-fields', created?.title === 'Ground Floor Plan' && created?.revisionNumber === 'B', JSON.stringify(created))

        // Fresh-audit fix (2026-07-12): design-plan file attachment. A native
        // OS file dialog can't be driven by Playwright, so this calls the
        // same IPC method the real "Attach file" button calls after a real
        // dialog pick — exercises the actual DRAWING_REVISION entity-type
        // wiring end-to-end (service + IPC + list-back).
        if (created?.id) {
          const attachRes = await page.evaluate(async ({ drawingId, filePath }) => window.api.documents.attach({
            sourcePath: filePath, fileName: 'floor-plan.txt', entityType: 'DRAWING_REVISION', entityId: drawingId,
          }), { drawingId: created.id, filePath: DUMMY_FILE_PATH })
          r.log('design-plan-file-attached-to-drawing', !!attachRes?.success, JSON.stringify(attachRes?.error || ''))
          const docsRes = await page.evaluate(async (drawingId) => window.api.documents.list({ entityType: 'DRAWING_REVISION', entityId: drawingId }), created.id)
          r.log('design-plan-file-listed-back-for-drawing', (docsRes?.data || []).some((d) => d.fileName === 'floor-plan.txt'), JSON.stringify(docsRes?.data))
          if (attachRes?.data?.id) await page.evaluate(async (docId) => window.api.documents.delete({ id: docId }), attachRes.data.id)
        }

        await h.gotoHash(page, '#/service/drawing-register')
        await page.waitForTimeout(500)
        const filesBtn = page.getByRole('button', { name: /Files/i }).first()
        if (await filesBtn.count() > 0) {
          await filesBtn.click()
          await page.waitForTimeout(400)
          r.log('drawing-files-panel-expands-no-crash', !(await h.hasErrorBoundary(page)))
        }
      }
    })

    await r.step('civil-engineer-site-visit-depth', async () => {
      const res = await h.switchBusinessType(page, 'Civil Engineer')
      r.log('business-type-switched-to-civil-engineer', res.changed, JSON.stringify(res))

      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Civil Client`, phone: `1${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      const projRes = await page.evaluate(async ({ clientId, prefix }) => window.api.serviceProject.create({
        clientId, projectName: `${prefix} Bridge Project`, projectType: 'CIVIL', status: 'ACTIVE',
      }), { clientId: custRes?.data?.id, prefix: TEST_PREFIX })
      const civilProjectId = projRes?.data?.id
      r.log('civil-test-project-created', !!civilProjectId, JSON.stringify(projRes?.error || ''))

      await h.gotoHash(page, '#/service/site-visits')
      await page.waitForTimeout(700)
      r.log('site-visits-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      if (civilProjectId) {
        await page.getByLabel('Project').selectOption(civilProjectId)
        await page.waitForTimeout(400)
        await page.getByRole('button', { name: /Log Visit/i }).click()
        await page.waitForTimeout(400)
        await page.getByLabel(/Visit Date/i).fill(new Date().toISOString().slice(0, 10))
        await page.getByLabel('Weather Conditions').fill('Clear, dry')
        await page.locator('textarea').fill('Foundation pour inspected — no issues.')
        await h.shot(page, 'site-visit-form-before-save')
        await page.getByRole('button', { name: /^Save$/i }).click()
        await page.waitForTimeout(900)
        r.log('site-visit-created-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'site-visit-after-save')

        const listRes = await page.evaluate(async (projectId) => window.api.siteVisit.list({ projectId }), civilProjectId)
        const created = (listRes?.data || [])[0]
        r.log('site-visit-findable-via-api-with-correct-fields', created?.weatherConditions === 'Clear, dry' && created?.findings?.includes('Foundation'), JSON.stringify({ listRes, created }))

        if (created?.id) {
          const attachRes = await page.evaluate(async ({ visitId, filePath }) => window.api.documents.attach({
            sourcePath: filePath, fileName: 'site-photo-notes.txt', entityType: 'SITE_VISIT', entityId: visitId,
          }), { visitId: created.id, filePath: DUMMY_FILE_PATH })
          r.log('design-plan-file-attached-to-site-visit', !!attachRes?.success, JSON.stringify(attachRes?.error || ''))
          const docsRes = await page.evaluate(async (visitId) => window.api.documents.list({ entityType: 'SITE_VISIT', entityId: visitId }), created.id)
          r.log('design-plan-file-listed-back-for-site-visit', (docsRes?.data || []).some((d) => d.fileName === 'site-photo-notes.txt'), JSON.stringify(docsRes?.data))
          if (attachRes?.data?.id) await page.evaluate(async (docId) => window.api.documents.delete({ id: docId }), attachRes.data.id)
        }
      }
    })

    await r.step('restore-business-type-final', async () => {
      if (originalBusinessType) {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored-final', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    try { fs.unlinkSync(DUMMY_FILE_PATH) } catch { /* already gone */ }
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const engIds = db.prepare("SELECT id FROM Engagement WHERE title LIKE 'E2E New%'").all().map((row) => row.id)
      for (const id of engIds) { try { db.prepare('DELETE FROM Engagement WHERE id = ?').run(id) } catch { /* ignore */ } }
      const pestIds = db.prepare("SELECT id FROM PestServiceContract WHERE propertyAddress LIKE '%E2E Test%'").all().map((row) => row.id)
      for (const id of pestIds) { try { db.prepare('DELETE FROM PestServiceContract WHERE id = ?').run(id) } catch { /* ignore */ } }
      const projIds = db.prepare("SELECT id FROM ServiceProject WHERE projectName LIKE 'E2E New%'").all().map((row) => row.id)
      for (const id of projIds) { try { db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(id) } catch { /* ignore */ } }
      db.prepare("DELETE FROM MetalRate WHERE purity IN ('22K', '925')").run()
      console.log('extra cleanup: engagements', engIds.length, 'pestContracts', pestIds.length, 'projects', projIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nNEW FEATURES: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
