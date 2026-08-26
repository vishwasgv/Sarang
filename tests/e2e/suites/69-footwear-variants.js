/**
 * Suite 69 — Footwear vertical, item 1 (Phase 67 §9.1): half-size/width
 * matrix, Footwear's own real differentiator from Clothing's plain
 * size×colour variant tracking. First-ever E2E coverage of this vertical.
 * Real UI-driven size×width×colour variant creation via
 * VariantManagementModal's 3rd matrix dimension, real Billing "Select
 * Variant" picker showing width, printed-label text, and the Returns/
 * Exchange screens all carrying width through a variant's own identity.
 */
const h = require('../harness')
const crypto = require('crypto')

const TEST_PREFIX = 'E2E Foot'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let footwearTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-footwear', async () => {
      const sw = await h.switchBusinessType(page, 'Footwear')
      r.log('business-type-switched-to-footwear', sw.to === 'FOOTWEAR', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type (opt-in via
    // Settings) — enable it directly so the item 3 AI-intent step below can
    // exercise the real ai:query IPC path, same seeding approach
    // uat-70-templates.js already established for this exact gotcha. Saved
    // so it can be restored exactly as found in the finally block below,
    // since IndustryTemplateSetting is real shared dev-DB state.
    h.withDb((db) => {
      footwearTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('FOOTWEAR')
      if (footwearTemplateRowBefore) {
        const mods = new Set(JSON.parse(footwearTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), footwearTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(crypto.randomUUID(), 'FOOTWEAR', JSON.stringify(['ai_assistant']))
      }
    })

    let productId

    await r.step('create-footwear-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Foot Trail Runner',
        unit: 'PCS',
        sellingPrice: 3000,
        costPrice: 1800,
        taxRate: 12,
        productType: 'STANDARD',
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    await r.step('generate-size-width-colour-matrix-via-real-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const searchBox = page.locator('input[placeholder="Search products…"]')
      await searchBox.fill('E2E Foot Trail Runner')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: 'E2E Foot Trail Runner' }).first()
      r.log('product-row-found', await row.count() > 0)
      await row.locator('button[title="Manage Variants"]').click()
      await page.waitForTimeout(500)

      const modal = h.topModal(page)
      const modalHeading = modal.locator('h2', { hasText: 'Manage Variants' })
      r.log('variant-modal-opened', await modalHeading.count() > 0)
      await modal.locator('p', { hasText: 'Loading' }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})

      // Footwear-specific: a real 3rd Width column + matrix-generator input,
      // never shown for Clothing.
      const widthHeader = modal.locator('th', { hasText: 'Width' })
      r.log('width-column-present-for-footwear', await widthHeader.count() > 0)
      // Real E2E locator bug found+fixed here: getByPlaceholder does a
      // substring match by default, so 'Regular, Wide' also matches the
      // per-row width input's own 'Regular, Wide…' placeholder (present
      // from the modal's initial blank row, before Generate is even
      // clicked) — { exact: true } picks only the matrix generator's own
      // field.
      const widthMatrixInput = modal.getByPlaceholder('Regular, Wide', { exact: true })
      r.log('width-matrix-input-present-for-footwear', await widthMatrixInput.count() > 0)

      await modal.getByPlaceholder('S, M, L, XL').fill('8, 9')
      await widthMatrixInput.fill('Regular, Wide')
      await modal.getByPlaceholder('Black, Red, Blue').fill('Black')
      await modal.getByRole('button', { name: 'Generate' }).click()
      await page.waitForTimeout(400)
      r.log('matrix-generated-no-crash', !(await h.hasErrorBoundary(page)))

      // 2 sizes x 2 widths x 1 colour = 4 combinations. Fill in real stock
      // quantities for each generated row before saving.
      const rows = modal.locator('table tbody tr')
      const rowCount = await rows.count()
      r.log('matrix-generated-4-rows', rowCount === 4, `rowCount=${rowCount}`)
      for (let i = 0; i < rowCount; i++) {
        await rows.nth(i).locator('input[type="number"]').nth(1).fill(String(10 + i))
      }

      await modal.getByRole('button', { name: 'Save Variants' }).click()
      await page.waitForTimeout(1200)
      r.log('variants-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'footwear-variants-saved')

      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = listRes?.data || []
      r.log('four-variants-created', variants.length === 4, `count=${variants.length}`)
      const size8Regular = variants.find((v) => v.size === '8' && v.width === 'Regular' && v.color === 'Black')
      const size8Wide = variants.find((v) => v.size === '8' && v.width === 'Wide' && v.color === 'Black')
      r.log('size-8-regular-and-wide-both-exist-as-distinct-variants', !!size8Regular && !!size8Wide && size8Regular.id !== size8Wide.id, JSON.stringify({ size8Regular, size8Wide }))
      r.log('width-persisted-correctly-on-a-real-variant', size8Wide?.width === 'Wide', JSON.stringify(size8Wide))
    })

    await r.step('variant-summary-includes-widths', async () => {
      const sumRes = await page.evaluate(async (pid) => window.api.variants.summary({ productId: pid }), productId)
      const widths = (sumRes?.data?.widths || []).slice().sort()
      r.log('summary-widths-api-succeeded', !!sumRes?.success, JSON.stringify(sumRes?.error || ''))
      r.log('summary-widths-includes-regular-and-wide', JSON.stringify(widths) === JSON.stringify(['Regular', 'Wide']), JSON.stringify(widths))
    })

    let customerId

    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Foot Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id
    })

    let invoiceId
    let size8WideVariantId

    await r.step('sell-a-specific-width-variant-via-real-ui-select-variant-picker', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Foot Trail Runner')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button:has-text("E2E Foot Trail Runner")').first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(600)

      const pickerHeading = page.locator('h3', { hasText: 'Select Variant' })
      r.log('select-variant-modal-opened', await pickerHeading.count() > 0)
      await h.shot(page, 'footwear-select-variant-modal')

      // The real differentiator under test: the picker must show width
      // alongside size and colour, not just "8 / Black" — two same-size,
      // same-colour, different-width variants would otherwise be
      // indistinguishable to the cashier at the point of sale.
      const size8WideRow = page.locator('button', { hasText: '8 / Wide / Black' }).first()
      r.log('variant-picker-shows-size-width-colour', await size8WideRow.count() > 0)
      await size8WideRow.click()
      await page.waitForTimeout(500)
      r.log('variant-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Foot Buyer')
      await page.waitForTimeout(700)
      const custOption = page.locator('button:has-text("E2E Foot Buyer")').first()
      await custOption.click()
      await page.waitForTimeout(300)

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))

      const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
      const line = (invRes?.data?.items || [])[0]
      size8WideVariantId = line?.variantId
      r.log('invoice-line-carries-width-in-variantInfo', line?.variantInfo === '8 / Wide / Black', JSON.stringify(line))
    })

    await r.step('verify-only-the-sold-width-variant-stock-deducted', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = listRes?.data || []
      const size8Wide = variants.find((v) => v.size === '8' && v.width === 'Wide' && v.color === 'Black')
      const size8Regular = variants.find((v) => v.size === '8' && v.width === 'Regular' && v.color === 'Black')
      // Generation order was (8,Regular), (8,Wide), (9,Regular), (9,Wide) —
      // stock was seeded 10,11,12,13 respectively, so 8/Wide started at 11
      // and 8/Regular started at 10.
      r.log('sold-width-variant-stock-deducted-by-one', size8Wide?.stockQty === 10, `stockQty=${size8Wide?.stockQty}`)
      r.log('same-size-different-width-untouched', size8Regular?.stockQty === 10, `stockQty=${size8Regular?.stockQty}`)
    })

    await r.step('exchange-workflow-carries-width-in-the-linked-invoice', async () => {
      if (!productId || !customerId || !invoiceId || !size8WideVariantId) return r.log('exchange-workflow-carries-width-in-the-linked-invoice', false, 'missing prerequisite ids')

      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const size9Wide = (variantsRes?.data || []).find((v) => v.size === '9' && v.width === 'Wide' && v.color === 'Black')

      const exchangeRes = await page.evaluate(({ originalInvoiceId, pid, oldVariantId, newVariantId }) => window.api.exchange.create({
        originalInvoiceId, oldProductId: pid, oldVariantId, quantity: 1, newVariantId,
        reason: 'E2E footwear width exchange', paymentMethod: 'CASH',
      }), { originalInvoiceId: invoiceId, pid: productId, oldVariantId: size8WideVariantId, newVariantId: size9Wide?.id })
      r.log('footwear-exchange-api-succeeded', !!exchangeRes?.success, JSON.stringify(exchangeRes?.error || ''))

      const newInvRes = await page.evaluate((id) => window.api.billing.getInvoice(id), exchangeRes?.data?.newInvoiceId)
      const newLine = (newInvRes?.data?.items || [])[0]
      r.log('exchange-new-invoice-line-carries-width', newLine?.variantInfo === '9 / Wide / Black', JSON.stringify(newLine))
    })

    await r.step('print-label-includes-width', async () => {
      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const size9Regular = (variantsRes?.data || []).find((v) => v.size === '9' && v.width === 'Regular' && v.color === 'Black')
      if (!size9Regular) return r.log('print-label-includes-width', false, 'size 9/Regular/Black variant not found')

      const barcodeRes = await page.evaluate((variantId) => window.api.variants.generateBarcode({ variantId }), size9Regular.id)
      r.log('label-variant-barcode-generated', !!barcodeRes?.success, JSON.stringify(barcodeRes?.error || ''))

      const previewRes = await page.evaluate(({ pid, variantId }) => window.api.print.previewLabels({
        items: [{ productId: pid, variantId, copies: 1 }],
        outputMode: 'A4_SHEET',
        fields: { showPrice: true, showBarcode: true, showName: true }
      }), { pid: productId, variantId: size9Regular.id })
      r.log('label-preview-api-succeeded', !!previewRes?.success, JSON.stringify(previewRes?.error || ''))
      const html = previewRes?.data || ''
      r.log('printed-label-html-includes-width', html.includes('9 / Regular / Black') || (html.includes('9') && html.includes('Regular') && html.includes('Black')), html.length)
    })

    // ─── Phase 67 §9.1 item 2: Brand-Wise Margin & Return-Rate Report ───────
    await r.step('brand-margin-return-rate-report-computes-and-renders-correctly', async () => {
      if (!productId || !customerId) return r.log('brand-margin-return-rate-report-computes-and-renders-correctly', false, 'no productId/customerId captured')

      const supRes = await page.evaluate(() => window.api.suppliers.create({
        supplierName: 'E2E Foot Vendor', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('brand-margin-vendor-created', !!supRes?.success, JSON.stringify(supRes?.error || ''))
      const supplierId = supRes?.data?.id

      const updateRes = await page.evaluate(({ pid, sid }) => window.api.products.update({
        id: pid, productName: 'E2E Foot Trail Runner', unit: 'PCS', sellingPrice: 3000, costPrice: 1800, taxRate: 12, productType: 'STANDARD', defaultSupplierId: sid,
      }), { pid: productId, sid: supplierId })
      r.log('brand-margin-product-vendor-assigned', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))

      // RULE I007 (product.service.ts): this product was created with no
      // opening quantity, so Inventory.averageCost stays 0 forever until a
      // real GRN/purchase — same gotcha Clothing item 5 already found.
      // Seed a real cost basis directly so COGS/margin aren't degenerately 0.
      h.withDb((db) => db.prepare('UPDATE Inventory SET averageCost = 1800 WHERE productId = ?').run(productId))

      // A fresh, deterministic sale-then-partial-return specifically for
      // this item: 4 units sold, 1 returned -> a real 25% return rate.
      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const size9Regular = (variantsRes?.data || []).find((v) => v.size === '9' && v.width === 'Regular' && v.color === 'Black')
      const saleRes = await page.evaluate(({ pid, cid, variantId }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH',
        items: [{ productId: pid, variantId, quantity: 4, unitPrice: 3000, taxRate: 12 }],
      }), { pid: productId, cid: customerId, variantId: size9Regular?.id })
      r.log('brand-margin-fresh-sale-created', !!saleRes?.success, JSON.stringify(saleRes?.error || ''))

      const returnRes = await page.evaluate(({ originalInvoiceId, pid, variantId }) => window.api.returns.create({
        originalInvoiceId,
        items: [{ productId: pid, variantId, quantity: 1 }],
        reason: 'E2E footwear brand-margin return',
      }), { originalInvoiceId: saleRes?.data?.id, pid: productId, variantId: size9Regular?.id })
      r.log('brand-margin-partial-return-created', !!returnRes?.success, JSON.stringify(returnRes?.error || ''))

      const now = new Date()
      const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      const reportRes = await page.evaluate((args) => window.api.reports.brandMarginReturnRate(args), { dateFrom, dateTo })
      r.log('brand-margin-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.supplierId === supplierId)
      r.log('brand-margin-includes-our-vendor-this-month', !!row, JSON.stringify(row))
      if (row) {
        // Internal consistency, not hardcoded absolute numbers — the
        // report re-derives from CURRENT Product.defaultSupplierId at
        // query time (not a sale-time snapshot), so it also picks up this
        // product's earlier sale/exchange activity from earlier steps in
        // this same suite run this month, not just this step's own 4
        // sold/1 returned. Same "assert consistency + lower bounds, not
        // exact totals" approach Clothing item 5's own test already
        // established for the identical reason.
        r.log('brand-margin-math-is-consistent', Math.abs(row.revenue - row.cogs - row.margin) < 0.01, JSON.stringify(row))
        r.log('brand-margin-percent-matches-margin-over-revenue', row.revenue === 0 ? row.marginPercent === 0 : Math.abs(row.marginPercent - Math.round((row.margin / row.revenue) * 1000) / 10) < 0.2, JSON.stringify(row))
        // This step's own 4-sold/1-returned activity is definitely in
        // there, at minimum.
        r.log('brand-margin-includes-the-fresh-sale-and-return', row.unitsSold >= 4 && row.unitsReturned >= 1, JSON.stringify(row))
        r.log('brand-margin-return-rate-percent-matches-its-own-units', row.unitsSold > 0 ? Math.abs(row.returnRatePercent - Math.round((row.unitsReturned / row.unitsSold) * 1000) / 10) < 0.2 : row.returnRatePercent === 0, JSON.stringify(row))
      }

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Brand-Wise Margin & Return-Rate' }).first()
      r.log('brand-margin-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('brand-margin-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('brand-margin-shows-vendor-name', bodyText.includes('E2E Foot Vendor'))
        await h.shot(page, 'footwear-brand-margin-return-rate-report')
      }
    })

    // ─── Phase 67 §9.1 item 3: Trial-Pair Counter Workflow ──────────────────
    await r.step('trial-session-recorded-and-purchased-pair-added-to-cart-via-real-ui', async () => {
      if (!productId || !customerId) return r.log('trial-session-recorded-and-purchased-pair-added-to-cart-via-real-ui', false, 'no productId/customerId captured')

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Foot Trail Runner')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button:has-text("E2E Foot Trail Runner")').first()
      await prodOption.click()
      await page.waitForTimeout(600)

      const trialToggle = page.locator('button', { hasText: 'Track Trial' })
      r.log('trial-toggle-present-for-footwear', await trialToggle.count() > 0)
      await trialToggle.click()
      await page.waitForTimeout(300)
      r.log('trial-mode-heading-shown', await page.locator('h3', { hasText: 'Record Trial Session' }).count() > 0)

      // Mark two pairs as tried — the real workflow under test: tapping a
      // tile in trial mode toggles it as "tried", it does NOT add to cart
      // (stock is never touched at try-on time, only at actual sale).
      const size9Regular = page.locator('button', { hasText: '9 / Regular / Black' }).first()
      const size9Wide = page.locator('button', { hasText: '9 / Wide / Black' }).first()
      await size9Regular.click()
      await page.waitForTimeout(150)
      await size9Wide.click()
      await page.waitForTimeout(150)
      r.log('two-tried-count-shown', await page.locator('text=2 pairs marked as tried on').count() > 0)

      const stockBeforePurchase = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const wideBefore = (stockBeforePurchase?.data || []).find((v) => v.size === '9' && v.width === 'Wide' && v.color === 'Black')

      const purchasedBtn = page.locator('button', { hasText: 'Purchased: 9 / Wide / Black' }).first()
      r.log('purchased-action-button-present', await purchasedBtn.count() > 0)
      await purchasedBtn.click()
      await page.waitForTimeout(700)
      r.log('trial-purchase-no-crash', !(await h.hasErrorBoundary(page)))

      // The purchased pair must land in the cart via the SAME addToCartDirect
      // path every other picker selection uses — verified by the picker
      // modal closing and a real cart line appearing, not a parallel one-off.
      const cartLine = page.locator('text=9 / Wide / Black').first()
      r.log('purchased-pair-lands-in-cart', await cartLine.count() > 0)

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Foot Buyer')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Foot Buyer")').first().click()
      await page.waitForTimeout(300)
      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      r.log('trial-purchase-invoice-submitted-no-crash', !(await h.hasErrorBoundary(page)))

      const trialRows = h.withDb((db) => db.prepare(
        "SELECT * FROM TrialSession WHERE productId = ? ORDER BY createdAt DESC"
      ).all(productId))
      const converted = trialRows.find((tr) => tr.purchasedVariantId === wideBefore?.id)
      r.log('trial-session-row-persisted-with-purchase', !!converted, JSON.stringify(converted))
      r.log('trial-session-tried-list-includes-both-pairs', (() => {
        try {
          const ids = JSON.parse(converted?.triedVariantIds || '[]')
          return ids.length === 2
        } catch { return false }
      })())
    })

    await r.step('trial-session-recorded-with-no-purchase', async () => {
      if (!productId) return r.log('trial-session-recorded-with-no-purchase', false, 'no productId captured')

      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = variantsRes?.data || []
      const [va, vb] = variants
      const res = await page.evaluate(({ pid, ids }) => window.api.trialSession.record({
        productId: pid, triedVariantIds: ids, purchasedVariantId: null,
      }), { pid: productId, ids: [va?.id, vb?.id] })
      r.log('no-purchase-trial-session-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      r.log('no-purchase-trial-session-has-null-purchased-variant', res?.data?.purchasedVariantId === null, JSON.stringify(res?.data))
    })

    await r.step('trial-conversion-summary-and-ai-intent-reflect-recorded-sessions', async () => {
      const summaryRes = await page.evaluate(() => window.api.trialSession.conversionSummary())
      r.log('trial-conversion-summary-api-succeeded', !!summaryRes?.success, JSON.stringify(summaryRes?.error || ''))
      const d = summaryRes?.data
      // Internal consistency + lower bounds, same approach as the brand-
      // margin report step above — this suite's own trial sessions from the
      // two steps just above are definitely counted, at minimum.
      r.log('trial-summary-counts-at-least-our-two-sessions', (d?.totalSessions ?? 0) >= 2, JSON.stringify(d))
      r.log('trial-summary-counts-at-least-one-conversion', (d?.convertedSessions ?? 0) >= 1, JSON.stringify(d))
      r.log('trial-summary-conversion-rate-is-consistent', d ? Math.abs(d.conversionRatePercent - Math.round((d.convertedSessions / d.totalSessions) * 10000) / 100) < 0.1 : false, JSON.stringify(d))

      const aiRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our trial conversion rate?' }))
      r.log('ai-trial-conversion-intent-routed-correctly', aiRes?.data?.template === 'footwear.trialConversionRate', JSON.stringify({ template: aiRes?.data?.template, answer: aiRes?.data?.answer }))
      r.log('ai-trial-conversion-answer-mentions-percent', typeof aiRes?.data?.answer === 'string' && aiRes.data.answer.includes('%'), aiRes?.data?.answer)
    })

    // ─── Phase 67 §9.1 item 4: Size Availability Heatmap Report ─────────────
    await r.step('size-availability-heatmap-computes-and-renders-correctly', async () => {
      if (!productId) return r.log('size-availability-heatmap-computes-and-renders-correctly', false, 'no productId captured')

      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = variantsRes?.data || []
      const size8Regular = variants.find((v) => v.size === '8' && v.width === 'Regular' && v.color === 'Black')
      const size8Wide = variants.find((v) => v.size === '8' && v.width === 'Wide' && v.color === 'Black')
      const size9Regular = variants.find((v) => v.size === '9' && v.width === 'Regular' && v.color === 'Black')
      const size9Wide = variants.find((v) => v.size === '9' && v.width === 'Wide' && v.color === 'Black')

      // Deterministic stock levels set directly, rather than relying on
      // whatever this product's stock happens to be after earlier steps in
      // this same suite run — same reasoning as the RULE I007 averageCost
      // seeding pattern established for report tests earlier in this file.
      h.withDb((db) => {
        db.prepare('UPDATE ProductVariant SET stockQty = 0 WHERE id = ?').run(size8Regular?.id)
        db.prepare('UPDATE ProductVariant SET stockQty = 0 WHERE id = ?').run(size8Wide?.id)
        db.prepare('UPDATE ProductVariant SET stockQty = 2 WHERE id = ?').run(size9Regular?.id)
        db.prepare('UPDATE ProductVariant SET stockQty = 50 WHERE id = ?').run(size9Wide?.id)
      })

      const reportRes = await page.evaluate((args) => window.api.reports.sizeAvailabilityHeatmap(args), { lowStockThreshold: 3 })
      r.log('size-availability-heatmap-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const cells = reportRes?.data?.cells || []
      const cellByKey = new Map(cells.map((c) => [`${c.style}|${c.size}`, c]))
      const c8 = cellByKey.get('E2E Foot Trail Runner|8')
      const c9 = cellByKey.get('E2E Foot Trail Runner|9')
      // Both width variants share a size cell — stock is summed across
      // colour/width, so size 8 = 0+0 = fully OUT, size 9 = 2+50 = 52,
      // comfortably above the 3-unit threshold, so IN despite one of its
      // own width variants being individually low.
      r.log('size-8-cell-is-out-of-stock', c8?.status === 'OUT' && c8?.stockQty === 0, JSON.stringify(c8))
      r.log('size-9-cell-is-in-stock-summed-across-widths', c9?.status === 'IN' && c9?.stockQty === 52, JSON.stringify(c9))
      r.log('this-style-is-flagged-as-having-a-gap', reportRes?.data?.summary?.outOfStockCells >= 1, JSON.stringify(reportRes?.data?.summary))

      const aiRes = await page.evaluate(() => window.api.ai.query({ question: 'Which sizes are out of stock?' }))
      r.log('ai-size-availability-intent-routed-correctly', aiRes?.data?.template === 'footwear.sizeAvailabilityHeatmap', JSON.stringify({ template: aiRes?.data?.template, answer: aiRes?.data?.answer }))
      r.log('ai-size-availability-answer-mentions-our-style', typeof aiRes?.data?.answer === 'string' && aiRes.data.answer.includes('E2E Foot Trail Runner'), aiRes?.data?.answer)

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Size Availability Heatmap' }).first()
      r.log('size-availability-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('size-availability-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('size-availability-shows-our-style', bodyText.includes('E2E Foot Trail Runner'))
        await h.shot(page, 'footwear-size-availability-heatmap')
      }
    })

    // ─── Phase 67 §9.1 item 5: Seasonal Reorder Calendar ────────────────────
    const SEASON_IN = 'E2E Foot Monsoon'
    const SEASON_REORDER = 'E2E Foot Sports'

    await r.step('seasonal-cycle-created-via-real-ui-manage-seasons-panel', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Seasonal Reorder Calendar' }).first()
      r.log('seasonal-calendar-tile-present', await tile.count() > 0)
      if (!(await tile.count())) return

      await tile.click()
      await page.waitForTimeout(500)
      const genBtn = page.getByRole('button', { name: 'Generate Report' })
      if (await genBtn.count()) {
        await genBtn.click()
        await page.waitForTimeout(800)
      }

      const manageBtn = page.locator('button', { hasText: 'Manage Seasons' }).first()
      r.log('manage-seasons-button-present', await manageBtn.count() > 0)
      await manageBtn.click()
      await page.waitForTimeout(400)

      // An IN_SEASON window computed relative to the REAL date this suite
      // happens to run on — today's own month/day through 3 days later — so
      // the assertion below is correct on any run date, not just when the
      // suite happens to execute during an actual monsoon month.
      const today = new Date()
      const in3 = new Date(today.getTime() + 3 * 86400000)

      const nameInput = page.locator('input[placeholder="e.g. Monsoon"]')
      await nameInput.fill(SEASON_IN)
      // Scoped to the specific grid containing the name input, not just any
      // `.grid` element on the page (Tailwind's grid utility is common
      // throughout the app) — has: filters to the one true match.
      const managerGrid = page.locator('div.grid', { has: nameInput })
      const selects = managerGrid.locator('select')
      await selects.nth(0).selectOption(String(today.getMonth() + 1))
      await selects.nth(1).selectOption(String(in3.getMonth() + 1))
      const numberInputs = managerGrid.locator('input[type="number"]')
      await numberInputs.nth(0).fill(String(today.getDate()))
      await numberInputs.nth(1).fill(String(in3.getDate()))
      await numberInputs.nth(2).fill('0') // leadTimeDays — irrelevant while already in-season
      await managerGrid.locator('button', { hasText: 'Add' }).first().click()
      await page.waitForTimeout(800)
      r.log('seasonal-cycle-add-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('seasonal-cycle-appears-in-manager-list', bodyText.includes(SEASON_IN))
      await h.shot(page, 'footwear-seasonal-reorder-calendar')
    })

    await r.step('seasonal-reorder-calendar-computes-statuses-and-low-stock-correctly', async () => {
      if (!productId) return r.log('seasonal-reorder-calendar-computes-statuses-and-low-stock-correctly', false, 'no productId captured')

      // A second cycle, created via the API this time (the UI-driven path
      // for creating one is already covered by the step above) — its
      // window starts 10 days out with a 15-day lead time, so REORDER_NOW
      // is correct on any real run date without depending on it.
      const today = new Date()
      const plus10 = new Date(today.getTime() + 10 * 86400000)
      const plus13 = new Date(today.getTime() + 13 * 86400000)
      const createRes = await page.evaluate((args) => window.api.seasonalCycle.create(args), {
        name: SEASON_REORDER,
        startMonth: plus10.getMonth() + 1, startDay: plus10.getDate(),
        endMonth: plus13.getMonth() + 1, endDay: plus13.getDate(),
        leadTimeDays: 15,
      })
      r.log('reorder-now-cycle-created-via-api', !!createRes?.success, JSON.stringify(createRes?.error || ''))

      // Tag the test product into the IN_SEASON cycle and force its stock
      // low, deterministically, rather than relying on whatever earlier
      // steps in this run happened to leave it at.
      const updateRes = await page.evaluate(({ pid, season }) => window.api.products.update({
        id: pid, productName: 'E2E Foot Trail Runner', unit: 'PCS', sellingPrice: 3000, costPrice: 1800, taxRate: 12, productType: 'STANDARD', season,
      }), { pid: productId, season: SEASON_IN })
      r.log('product-tagged-with-season', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))

      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      h.withDb((db) => {
        for (const v of (variantsRes?.data || [])) {
          db.prepare('UPDATE ProductVariant SET stockQty = 1 WHERE id = ?').run(v.id)
        }
      })

      const calRes = await page.evaluate(() => window.api.seasonalCycle.calendar({}))
      r.log('seasonal-calendar-api-succeeded', !!calRes?.success, JSON.stringify(calRes?.error || ''))
      const entries = calRes?.data || []
      const inSeasonEntry = entries.find((e) => e.name === SEASON_IN)
      const reorderNowEntry = entries.find((e) => e.name === SEASON_REORDER)

      r.log('in-season-cycle-status-is-in-season', inSeasonEntry?.status === 'IN_SEASON', JSON.stringify(inSeasonEntry))
      r.log('reorder-now-cycle-status-is-reorder-now', reorderNowEntry?.status === 'REORDER_NOW', JSON.stringify(reorderNowEntry))
      r.log('in-season-cycle-tags-our-product', !!inSeasonEntry?.products?.find((p) => p.productName === 'E2E Foot Trail Runner'), JSON.stringify(inSeasonEntry?.products))
      r.log('in-season-cycle-flags-our-product-as-low-stock', !!inSeasonEntry?.products?.find((p) => p.productName === 'E2E Foot Trail Runner' && p.lowOrOutOfStock === true), JSON.stringify(inSeasonEntry?.products))
      // Ordering: REORDER_NOW ranks ahead of IN_SEASON in the sorted array.
      const reorderIdx = entries.findIndex((e) => e.name === SEASON_REORDER)
      const inSeasonIdx = entries.findIndex((e) => e.name === SEASON_IN)
      r.log('reorder-now-sorted-ahead-of-in-season', reorderIdx >= 0 && inSeasonIdx >= 0 && reorderIdx < inSeasonIdx, JSON.stringify({ reorderIdx, inSeasonIdx }))

      const aiRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our seasonal reorder status?' }))
      r.log('ai-seasonal-reorder-intent-routed-correctly', aiRes?.data?.template === 'footwear.seasonalReorderStatus', JSON.stringify({ template: aiRes?.data?.template, answer: aiRes?.data?.answer }))
      r.log('ai-seasonal-reorder-answer-mentions-the-reorder-now-cycle', typeof aiRes?.data?.answer === 'string' && aiRes.data.answer.includes(SEASON_REORDER), aiRes?.data?.answer)
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'FOOTWEAR') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (footwearTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(footwearTemplateRowBefore.enabledModules, footwearTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('FOOTWEAR', JSON.stringify(['ai_assistant']))
      }
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      // Same gotcha this suite already found for ProductVariant: node:sqlite
      // enforces foreign keys by default, so cleanupByNamePrefix's own
      // `DELETE FROM Product` throws (blocked by these child rows) and
      // silently falls back to soft-delete (isActive=0) instead — the
      // Product row itself is never actually removed, so a plain
      // Product-cascade never fires and these rows would otherwise leak
      // and accumulate across every future suite run.
      const trialRows = db.prepare("SELECT ts.id FROM TrialSession ts JOIN Product p ON p.id = ts.productId WHERE p.productName LIKE 'E2E Foot%'").all().map((r2) => r2.id)
      for (const tid of trialRows) {
        try { db.prepare('DELETE FROM TrialSession WHERE id = ?').run(tid) } catch { /* leave it, harmless test row */ }
      }
      console.log('extra cleanup: trial sessions', trialRows.length)

      const rows = db.prepare("SELECT pv.id FROM ProductVariant pv JOIN Product p ON p.id = pv.productId WHERE p.productName LIKE 'E2E Foot%'").all().map((r2) => r2.id)
      for (const vid of rows) {
        try { db.prepare('DELETE FROM ProductVariant WHERE id = ?').run(vid) } catch { /* leave it, harmless test row */ }
      }
      console.log('extra cleanup: variants', rows.length)

      // SeasonalCycle rows this suite creates — genuinely disposable test
      // config, not shared real user data, so hard-deleted directly rather
      // than going through the service's own soft-delete.
      const cycleIds = db.prepare("SELECT id FROM SeasonalCycle WHERE name LIKE 'E2E Foot%'").all().map((r2) => r2.id)
      for (const cid of cycleIds) {
        try { db.prepare('DELETE FROM SeasonalCycle WHERE id = ?').run(cid) } catch { /* leave it, harmless test row */ }
      }
      console.log('extra cleanup: seasonal cycles', cycleIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nFOOTWEAR VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
