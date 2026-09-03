/**
 * Suite 16 — Clothing/Footwear vertical (variant_tracking). Real UI-driven
 * size/colour variant creation via VariantManagementModal, inventory
 * sync-to-sum-of-variants, real Billing "Select Variant" picker, and the
 * insufficient-variant-stock rejection guard (VAR-010). See project memory
 * project_vertical_uat_research.md / project_final_testing_pass_2026_07_15.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cloth'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-clothing', async () => {
      const sw = await h.switchBusinessType(page, 'Clothing')
      r.log('business-type-switched-to-clothing', sw.to === 'CLOTHING', JSON.stringify(sw))
    })

    let productId

    await r.step('create-clothing-product', async () => {
      const res = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Cloth TShirt',
        unit: 'PCS',
        sellingPrice: 500,
        costPrice: 250,
        taxRate: 5,
        productType: 'STANDARD',
      }))
      r.log('product-created', !!res?.success, JSON.stringify(res?.error || ''))
      productId = res?.data?.id
    })

    await r.step('add-variants-via-real-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const searchBox = page.locator('input[placeholder="Search products…"]')
      await searchBox.fill('E2E Cloth TShirt')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: 'E2E Cloth TShirt' }).first()
      r.log('product-row-found', await row.count() > 0)
      await row.locator('button[title="Manage Variants"]').click()
      await page.waitForTimeout(500)

      const modal = h.topModal(page)
      const modalHeading = modal.locator('h2', { hasText: 'Manage Variants' })
      r.log('variant-modal-opened', await modalHeading.count() > 0)

      // First row (auto-present on open, once loading finishes)
      await modal.locator('p', { hasText: 'Loading' }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
      const rows = modal.locator('table tbody tr')
      await rows.nth(0).getByPlaceholder('M, L, 32…').fill('M')
      await rows.nth(0).getByPlaceholder('Black, Red…').fill('Blue')
      await rows.nth(0).locator('input[type="number"]').nth(1).fill('20') // Stock column

      await modal.getByRole('button', { name: 'Add Row' }).click()
      await page.waitForTimeout(300)
      await rows.nth(1).getByPlaceholder('M, L, 32…').fill('L')
      await rows.nth(1).getByPlaceholder('Black, Red…').fill('Red')
      await rows.nth(1).locator('input[type="number"]').nth(1).fill('15')

      await modal.getByRole('button', { name: 'Save Variants' }).click()
      await page.waitForTimeout(1200)
      r.log('variants-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'clothing-variants-saved')

      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = listRes?.data || []
      r.log('two-variants-created', variants.length === 2, `count=${variants.length}`)
      r.log('variant-m-blue-correct-stock', variants.some((v) => v.size === 'M' && v.color === 'Blue' && v.stockQty === 20))
      r.log('variant-l-red-correct-stock', variants.some((v) => v.size === 'L' && v.color === 'Red' && v.stockQty === 15))
    })

    await r.step('inventory-synced-to-sum-of-variants', async () => {
      const invRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.inventory?.quantity
      r.log('inventory-quantity-is-35', qty === 35, `quantity=${qty}`)
    })

    let customerId

    await r.step('create-customer', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Cloth Buyer', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id
    })

    let invoiceId

    await r.step('sell-one-variant-via-real-ui-select-variant-picker', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Cloth TShirt')
      await page.waitForTimeout(700)
      const prodOption = page.locator('button:has-text("E2E Cloth TShirt")').first()
      r.log('product-search-found-result', await prodOption.count() > 0)
      await prodOption.click()
      await page.waitForTimeout(600)

      const pickerHeading = page.locator('h3', { hasText: 'Select Variant' })
      r.log('select-variant-modal-opened', await pickerHeading.count() > 0)
      await h.shot(page, 'clothing-select-variant-modal')

      const mBlueRow = page.locator('button', { hasText: 'M / Blue' }).first()
      r.log('variant-picker-shows-m-blue', await mBlueRow.count() > 0)
      await mBlueRow.click()
      await page.waitForTimeout(500)
      r.log('variant-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Cloth Buyer')
      await page.waitForTimeout(700)
      const custOption = page.locator('button:has-text("E2E Cloth Buyer")').first()
      await custOption.click()
      await page.waitForTimeout(300)

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-variant-stock-deducted', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const variants = listRes?.data || []
      const mBlue = variants.find((v) => v.size === 'M' && v.color === 'Blue')
      r.log('m-blue-stock-deducted-by-one', mBlue?.stockQty === 19, `stockQty=${mBlue?.stockQty}`)
    })

    await r.step('oversell-variant-correctly-rejected', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const lRed = (listRes?.data || []).find((v) => v.size === 'L' && v.color === 'Red')
      const saleRes = await page.evaluate(async ({ productId, customerId, variantId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH',
        items: [{ productId, variantId, quantity: 999, unitPrice: 500, taxRate: 5 }],
      }), { productId, customerId, variantId: lRed?.id })
      r.log('oversell-variant-rejected', saleRes?.success === false, JSON.stringify(saleRes?.error || saleRes))
    })

    await r.step('return-one-variant-restores-its-own-stock', async () => {
      // Real bug fix 2026-07-16: returns previously restored only the parent
      // Inventory.quantity total, never the specific ProductVariant.stockQty
      // it was sold from. Verifies the fix end-to-end through the real UI's
      // IPC surface (not just the unit-test mock) — sell was M/Blue, so
      // returning it must bump M/Blue specifically, leaving L/Red untouched.
      const beforeRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const beforeVariants = beforeRes?.data || []
      const mBlueBefore = beforeVariants.find((v) => v.size === 'M' && v.color === 'Blue')
      const lRedBefore = beforeVariants.find((v) => v.size === 'L' && v.color === 'Red')
      r.log('pre-return-m-blue-stock-is-19', mBlueBefore?.stockQty === 19, `stockQty=${mBlueBefore?.stockQty}`)

      const returnRes = await page.evaluate(async ({ originalInvoiceId, productId, variantId }) => window.api.returns.create({
        originalInvoiceId,
        items: [{ productId, variantId, quantity: 1 }],
        reason: 'E2E wrong size return',
      }), { originalInvoiceId: invoiceId, productId, variantId: mBlueBefore?.id })
      r.log('return-created-successfully', returnRes?.success === true, JSON.stringify(returnRes?.error || ''))

      const afterRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const afterVariants = afterRes?.data || []
      const mBlueAfter = afterVariants.find((v) => v.size === 'M' && v.color === 'Blue')
      const lRedAfter = afterVariants.find((v) => v.size === 'L' && v.color === 'Red')
      r.log('m-blue-stock-restored-to-20', mBlueAfter?.stockQty === 20, `stockQty=${mBlueAfter?.stockQty}`)
      r.log('l-red-stock-untouched-by-other-variant-return', lRedAfter?.stockQty === lRedBefore?.stockQty, `before=${lRedBefore?.stockQty} after=${lRedAfter?.stockQty}`)

      const invRes = await page.evaluate(async (pid) => window.api.products.get(pid), productId)
      const qty = invRes?.data?.inventory?.quantity
      r.log('aggregate-inventory-restored-to-35', qty === 35, `quantity=${qty}`)
    })

    await r.step('variant-stock-report-renders', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      // Real E2E test-authoring bug fixed here (found+documented in the
      // Electronics suite, see feedback_button_div_locator_gotcha): a
      // combined 'button, div' locator matches the tile's own non-clickable
      // parent category-group div first (its concatenated text also
      // contains the label), so .first() silently clicks the wrong element.
      const tile = page.locator('button', { hasText: 'Variant Stock Report' }).first()
      r.log('variant-stock-report-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('variant-stock-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      }
    })

    // ─── Phase 67 §9.1 item 1: Season/Collection Sell-Through Report ────────
    await r.step('season-sell-through-report-computes-and-renders-correctly', async () => {
      if (!productId || !customerId) return r.log('season-sell-through-report-computes-and-renders-correctly', false, 'no productId/customerId captured')

      const updateRes = await page.evaluate((pid) => window.api.products.update({
        id: pid, productName: 'E2E Cloth TShirt', unit: 'PCS', sellingPrice: 500, costPrice: 250, taxRate: 5, productType: 'STANDARD', season: 'Summer 2026',
      }), productId)
      r.log('product-season-set', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))

      // A fresh, unreturned sale (L/Red, untouched by the earlier M/Blue
      // return above) so the season report has a real, clean, non-zero
      // number to verify — independent of the already-returned M/Blue line.
      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const lRed = (variantsRes?.data || []).find((v) => v.size === 'L' && v.color === 'Red')
      const saleRes = await page.evaluate(({ pid, cid, variantId }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH',
        items: [{ productId: pid, variantId, quantity: 2, unitPrice: 500, taxRate: 5 }],
      }), { pid: productId, cid: customerId, variantId: lRed?.id })
      r.log('extra-unreturned-sale-created', !!saleRes?.success, JSON.stringify(saleRes?.error || ''))

      const now = new Date()
      const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const reportRes = await page.evaluate((args) => window.api.reports.seasonSellThrough(args), { dateFrom, dateTo })
      r.log('season-sell-through-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.month === month && rr.season === 'Summer 2026')
      r.log('season-sell-through-includes-our-season-this-month', !!row, JSON.stringify(row))
      if (row) {
        // Net this month: +1 (initial M/Blue sale) -1 (its return) +2 (fresh L/Red sale) = 2
        r.log('season-sell-through-units-sold-is-2', row.unitsSold === 2, `unitsSold=${row.unitsSold}`)
        r.log('season-sell-through-current-stock-is-33', row.currentStock === 33, `currentStock=${row.currentStock}`)
        r.log('season-sell-through-rate-computed-correctly', row.sellThroughRate === Math.round((2 / (2 + 33)) * 1000) / 10, `sellThroughRate=${row.sellThroughRate}`)
      }

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Season/Collection Sell-Through' }).first()
      r.log('season-sell-through-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('season-sell-through-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('season-sell-through-shows-season-name', bodyText.includes('Summer 2026'))
        await h.shot(page, 'clothing-season-sell-through-report')
      }
    })

    // ─── Phase 67 §9.1 item 2: Size-Curve Reorder Suggestion ────────────────
    await r.step('size-curve-reorder-suggestion-computes-and-renders-correctly', async () => {
      if (!productId) return r.log('size-curve-reorder-suggestion-computes-and-renders-correctly', false, 'no productId captured')

      // At this point in the suite: M/Blue has net 0 sales (1 sale - 1
      // return, from earlier steps), L/Red has 2 fresh unreturned sales
      // (from the season-sell-through step) — a clean, deterministic case
      // where the ENTIRE suggested quantity should weight toward L/Red.
      const suggestRes = await page.evaluate((pid) => window.api.variants.sizeCurveReorderSuggestion({ productId: pid, totalReorderQty: 30 }), productId)
      r.log('size-curve-suggestion-api-succeeded', !!suggestRes?.success, JSON.stringify(suggestRes?.error || ''))
      const rows = suggestRes?.data?.rows || []
      const mBlueRow = rows.find((rr) => rr.size === 'M' && rr.color === 'Blue')
      const lRedRow = rows.find((rr) => rr.size === 'L' && rr.color === 'Red')
      r.log('size-curve-suggests-zero-for-m-blue-no-net-sales', mBlueRow?.suggestedQuantity === 0, JSON.stringify(mBlueRow))
      r.log('size-curve-suggests-all-30-for-l-red-only-seller', lRedRow?.suggestedQuantity === 30, JSON.stringify(lRedRow))
      r.log('size-curve-total-sums-to-30', rows.reduce((s, rr) => s + rr.suggestedQuantity, 0) === 30)

      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const searchBox = page.locator('input[placeholder="Search products…"]')
      await searchBox.fill('E2E Cloth TShirt')
      await page.waitForTimeout(600)
      const prodRow = page.locator('tr', { hasText: 'E2E Cloth TShirt' }).first()
      r.log('product-row-found-for-suggestion', await prodRow.count() > 0)
      await prodRow.locator('button[title="Manage Variants"]').click()
      await page.waitForTimeout(500)

      const modal = h.topModal(page)
      const toggleBtn = modal.locator('button', { hasText: 'Suggested Reorder Split' })
      r.log('reorder-suggestion-toggle-present', await toggleBtn.count() > 0)
      await toggleBtn.click()
      await page.waitForTimeout(300)

      const qtyInput = modal.getByPlaceholder("Uses this product's own reorder quantity if left blank")
      await qtyInput.fill('30')
      const suggestBtn = modal.locator('button', { hasText: 'Suggest Split' })
      await suggestBtn.click()
      await page.waitForTimeout(700)
      r.log('reorder-suggestion-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const modalText = await modal.innerText().catch(() => '')
      r.log('reorder-suggestion-shows-suggested-quantity-30', modalText.includes('30'))
      await h.shot(page, 'clothing-size-curve-reorder-suggestion')

      await modal.locator('button', { hasText: 'Cancel' }).click().catch(() => {})
    })

    // ─── Phase 67 §9.1 item 3: Size × Style Heatmap Report ──────────────────
    await r.step('size-style-heatmap-computes-and-renders-correctly', async () => {
      if (!productId) return r.log('size-style-heatmap-computes-and-renders-correctly', false, 'no productId captured')

      const now = new Date()
      const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      const reportRes = await page.evaluate((args) => window.api.reports.sizeStyleHeatmap(args), { dateFrom, dateTo })
      r.log('size-style-heatmap-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const cells = reportRes?.data?.cells || []
      const mCell = cells.find((c) => c.style === 'E2E Cloth TShirt' && c.size === 'M')
      const lCell = cells.find((c) => c.style === 'E2E Cloth TShirt' && c.size === 'L')
      // M/Blue nets to 0 this month (1 sale - 1 return from earlier steps);
      // L/Red has the 2 fresh unreturned sales from item 1's own step.
      r.log('heatmap-shows-zero-for-m-blue-net-zero-sales', mCell?.unitsSold === 0, JSON.stringify(mCell))
      r.log('heatmap-shows-2-for-l-red', lCell?.unitsSold === 2, JSON.stringify(lCell))
      r.log('heatmap-sizes-include-both-m-and-l', (reportRes?.data?.sizes || []).includes('M') && (reportRes?.data?.sizes || []).includes('L'))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Size × Style Heatmap' }).first()
      r.log('size-style-heatmap-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('size-style-heatmap-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('size-style-heatmap-shows-style-name', bodyText.includes('E2E Cloth TShirt'))
        await h.shot(page, 'clothing-size-style-heatmap')
      }
    })

    // ─── Phase 67 §9.1 item 4: Size/Color Exchange Workflow ─────────────────
    await r.step('size-color-exchange-via-real-api-restocks-old-decrements-new-nets-zero', async () => {
      if (!productId || !customerId) return r.log('size-color-exchange-via-real-api-restocks-old-decrements-new-nets-zero', false, 'no productId/customerId captured')

      const beforeRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const beforeVariants = beforeRes?.data || []
      const mBlueBefore = beforeVariants.find((v) => v.size === 'M' && v.color === 'Blue')
      const lRedBefore = beforeVariants.find((v) => v.size === 'L' && v.color === 'Red')

      // A fresh, not-yet-returned/-exchanged sale — the earlier M/Blue line
      // on the suite's original invoice was already fully returned in an
      // earlier step, so exchanging against it again would correctly be
      // rejected by the same already-returned guard a plain double-return
      // would hit.
      const saleRes = await page.evaluate(({ pid, cid, variantId }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH',
        items: [{ productId: pid, variantId, quantity: 1, unitPrice: 500, taxRate: 5 }],
      }), { pid: productId, cid: customerId, variantId: lRedBefore?.id })
      r.log('exchange-source-sale-created', !!saleRes?.success, JSON.stringify(saleRes?.error || ''))
      const sourceInvoiceId = saleRes?.data?.id

      const exchangeRes = await page.evaluate(({ originalInvoiceId, pid, oldVariantId, newVariantId }) => window.api.exchange.create({
        originalInvoiceId, oldProductId: pid, oldVariantId, quantity: 1, newVariantId,
        reason: 'E2E API exchange — wrong size', paymentMethod: 'CASH',
      }), { originalInvoiceId: sourceInvoiceId, pid: productId, oldVariantId: lRedBefore?.id, newVariantId: mBlueBefore?.id })
      r.log('exchange-api-succeeded', !!exchangeRes?.success, JSON.stringify(exchangeRes?.error || ''))
      r.log('exchange-return-invoice-number-prefixed-ret', !!exchangeRes?.data?.returnInvoiceNumber?.startsWith('RET-'), JSON.stringify(exchangeRes?.data))
      r.log('exchange-new-invoice-number-present', !!exchangeRes?.data?.newInvoiceNumber)
      // Same base price (500) and tax rate (5%) for both M/Blue and L/Red —
      // no additionalPrice difference configured on either variant — so the
      // exchange should net to exactly zero.
      r.log('exchange-net-amount-due-is-zero-same-price', exchangeRes?.data?.netAmountDue === 0, `netAmountDue=${exchangeRes?.data?.netAmountDue}`)

      const afterRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const afterVariants = afterRes?.data || []
      const mBlueAfter = afterVariants.find((v) => v.size === 'M' && v.color === 'Blue')
      const lRedAfter = afterVariants.find((v) => v.size === 'L' && v.color === 'Red')
      r.log('old-variant-l-red-restored', lRedAfter?.stockQty === lRedBefore?.stockQty, `before=${lRedBefore?.stockQty} after=${lRedAfter?.stockQty}`)
      r.log('new-variant-m-blue-decremented-by-one', mBlueAfter?.stockQty === (mBlueBefore?.stockQty ?? 0) - 1, `before=${mBlueBefore?.stockQty} after=${mBlueAfter?.stockQty}`)

      // The linked new invoice really does carry exchangeReturnId back to
      // the real return invoice created above — verified via a real DB read
      // rather than trusting the API response alone.
      if (exchangeRes?.data?.newInvoiceId) {
        const linked = h.withDb((db) => db.prepare('SELECT exchangeReturnId FROM Invoice WHERE id = ?').get(exchangeRes.data.newInvoiceId))
        r.log('new-invoice-linked-to-return-invoice-in-db', linked?.exchangeReturnId === exchangeRes?.data?.returnInvoiceId, JSON.stringify(linked))
      }

      // A second exchange attempt against the SAME already-exchanged line
      // must be rejected — the shared already-returned-away guard
      // (getReturnedAwayQuantities) must see the exchange's own RETURN leg,
      // not just plain Returns.
      const dupeRes = await page.evaluate(({ originalInvoiceId, pid, oldVariantId, newVariantId }) => window.api.exchange.create({
        originalInvoiceId, oldProductId: pid, oldVariantId, quantity: 1, newVariantId,
        reason: 'E2E duplicate exchange attempt', paymentMethod: 'CASH',
      }), { originalInvoiceId: sourceInvoiceId, pid: productId, oldVariantId: lRedBefore?.id, newVariantId: mBlueBefore?.id })
      r.log('duplicate-exchange-on-same-line-rejected', dupeRes?.success === false && dupeRes?.error?.code === 'RET-007', JSON.stringify(dupeRes?.error))
    })

    await r.step('size-color-exchange-via-real-ui-returns-screen', async () => {
      if (!productId || !customerId) return r.log('size-color-exchange-via-real-ui-returns-screen', false, 'no productId/customerId captured')

      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const lRed = (variantsRes?.data || []).find((v) => v.size === 'L' && v.color === 'Red')
      const mBlueBefore = (variantsRes?.data || []).find((v) => v.size === 'M' && v.color === 'Blue')

      const saleRes = await page.evaluate(({ pid, cid, variantId }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH',
        items: [{ productId: pid, variantId, quantity: 1, unitPrice: 500, taxRate: 5 }],
      }), { pid: productId, cid: customerId, variantId: lRed?.id })
      r.log('ui-exchange-source-sale-created', !!saleRes?.success, JSON.stringify(saleRes?.error || ''))
      const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), saleRes?.data?.id)
      const sourceInvoiceNumber = invRes?.data?.invoiceNumber
      r.log('ui-exchange-source-invoice-number-resolved', !!sourceInvoiceNumber)

      await h.gotoHash(page, '#/returns')
      await page.waitForTimeout(700)
      // Real E2E test-authoring bug found+fixed here: getByRole('button',
      // { name: 'Search' }) resolves to TWO elements on this screen — the
      // app's own global header search (Ctrl+K) AND this screen's own
      // Search button, both accessible-named "Search". Pressing Enter in
      // the invoice-number input (wired to the same handleSearch()) avoids
      // the ambiguity entirely rather than trying to scope the locator.
      const invoiceNumberInput = page.locator('input[placeholder="e.g. INV-00042"]')
      await invoiceNumberInput.fill(sourceInvoiceNumber || '')
      await invoiceNumberInput.press('Enter')
      await page.waitForTimeout(700)

      const exchangeBtn = page.locator('button', { hasText: 'Exchange' }).first()
      r.log('exchange-button-present-on-variant-row', await exchangeBtn.count() > 0)
      await exchangeBtn.click()
      await page.waitForTimeout(500)
      await h.shot(page, 'clothing-exchange-panel-open')

      const variantSelect = page.locator('select').filter({ has: page.locator(`option[value="${mBlueBefore?.id}"]`) })
      await variantSelect.selectOption(mBlueBefore?.id)
      const reasonBox = page.getByPlaceholder('e.g. Wrong size, customer wants a different colour')
      await reasonBox.fill('E2E UI exchange — customer wants M/Blue instead')

      const confirmBtn = page.locator('button', { hasText: 'Confirm Exchange' })
      await confirmBtn.click()
      await page.waitForTimeout(1200)
      r.log('ui-exchange-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('ui-exchange-success-banner-shown', /Exchange Processed/i.test(bodyText), bodyText.slice(0, 400))
      await h.shot(page, 'clothing-exchange-success')

      const afterRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const mBlueAfter = (afterRes?.data || []).find((v) => v.size === 'M' && v.color === 'Blue')
      r.log('ui-exchange-new-variant-decremented', mBlueAfter?.stockQty === (mBlueBefore?.stockQty ?? 0) - 1, `before=${mBlueBefore?.stockQty} after=${mBlueAfter?.stockQty}`)
    })

    // ─── Phase 67 §9.1 item 5: Margin by Brand/Vendor Report ────────────────
    await r.step('vendor-margin-report-computes-and-renders-correctly', async () => {
      if (!productId || !customerId) return r.log('vendor-margin-report-computes-and-renders-correctly', false, 'no productId/customerId captured')

      const supRes = await page.evaluate(() => window.api.suppliers.create({
        supplierName: 'E2E Cloth Vendor', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('vendor-margin-supplier-created', !!supRes?.success, JSON.stringify(supRes?.error || ''))
      const supplierId = supRes?.data?.id

      const updateRes = await page.evaluate(({ pid, sid }) => window.api.products.update({
        id: pid, productName: 'E2E Cloth TShirt', unit: 'PCS', sellingPrice: 500, costPrice: 250, taxRate: 5, productType: 'STANDARD', season: 'Summer 2026', defaultSupplierId: sid,
      }), { pid: productId, sid: supplierId })
      r.log('vendor-margin-product-vendor-assigned', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))

      // RULE I007 (product.service.ts): a product created with zero opening
      // quantity deliberately keeps Inventory.averageCost at 0 forever,
      // until a real GRN/purchase establishes it — this test product was
      // created with no opening quantity, so getProductCostsBatch() would
      // otherwise correctly (per that same rule) resolve its cost as 0, not
      // costPrice. Seed a real averageCost directly, same "simulate real
      // state via direct DB write" precedent the RMA SLA item established,
      // so this step can verify actual non-zero margin math end-to-end.
      h.withDb((db) => db.prepare('UPDATE Inventory SET averageCost = 250 WHERE productId = ?').run(productId))

      // A fresh, deterministic sale specifically for this item: 3 units of
      // L/Red at the product's own real price/cost (500 sell, 250 cost) —
      // independent of every other sale/return/exchange this suite has
      // already made against this product this month.
      const variantsRes = await page.evaluate((pid) => window.api.variants.list({ productId: pid }), productId)
      const lRed = (variantsRes?.data || []).find((v) => v.size === 'L' && v.color === 'Red')
      const saleRes = await page.evaluate(({ pid, cid, variantId }) => window.api.billing.createInvoice({
        customerId: cid, paymentMethod: 'CASH',
        items: [{ productId: pid, variantId, quantity: 3, unitPrice: 500, taxRate: 5 }],
      }), { pid: productId, cid: customerId, variantId: lRed?.id })
      r.log('vendor-margin-extra-sale-created', !!saleRes?.success, JSON.stringify(saleRes?.error || ''))

      const now = new Date()
      const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      const reportRes = await page.evaluate((args) => window.api.reports.vendorMargin(args), { dateFrom, dateTo })
      r.log('vendor-margin-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.supplierId === supplierId)
      r.log('vendor-margin-includes-our-vendor-this-month', !!row, JSON.stringify(row))
      if (row) {
        // Internal consistency, not a hardcoded absolute number — this
        // product has accumulated many other sales/returns/exchanges
        // earlier in this same suite run this month, so the exact revenue
        // figure isn't independently predictable, but the math must hold.
        r.log('vendor-margin-math-is-consistent', Math.abs(row.revenue - row.cogs - row.margin) < 0.01, JSON.stringify(row))
        r.log('vendor-margin-percent-matches-margin-over-revenue', row.revenue === 0 ? row.marginPercent === 0 : Math.abs(row.marginPercent - Math.round((row.margin / row.revenue) * 1000) / 10) < 0.2, JSON.stringify(row))
        // The 3-unit sale we just made is definitely in there: at minimum
        // 3*500=1500 revenue and 3*250=750 cost were just added (cost basis
        // seeded to a real 250/unit above, per RULE I007's own convention).
        r.log('vendor-margin-includes-the-fresh-sale', row.revenue >= 1500 && row.cogs >= 750, JSON.stringify(row))
        r.log('vendor-margin-is-not-a-degenerate-zero-cost-row', row.cogs > 0, JSON.stringify(row))
      }

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Margin by Brand/Vendor' }).first()
      r.log('vendor-margin-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) {
          await genBtn.click()
          await page.waitForTimeout(1000)
        }
        r.log('vendor-margin-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('vendor-margin-shows-vendor-name', bodyText.includes('E2E Cloth Vendor'))
        await h.shot(page, 'clothing-vendor-margin-report')
      }
    })

    // variants.delete — deleted via the same IPC call the real UI's Trash2 +
    // Save flow uses, not re-driven through the UI a second time: ~48 stale
    // products already share this exact name (see finally{} below), so a
    // second name-search can't reliably re-find our specific row.
    await r.step('add-then-delete-a-third-variant-via-real-ui', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const searchBox = page.locator('input[placeholder="Search products…"]')
      await searchBox.fill('E2E Cloth TShirt')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: 'E2E Cloth TShirt' }).first()
      await row.locator('button[title="Manage Variants"]').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.locator('p', { hasText: 'Loading' }).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})

      await modal.getByRole('button', { name: 'Add Row' }).click()
      await page.waitForTimeout(300)
      const newRow = modal.locator('table tbody tr').last()
      await newRow.getByPlaceholder('M, L, 32…').fill('XL')
      await newRow.getByPlaceholder('Black, Red…').fill('Green')
      await newRow.locator('input[type="number"]').nth(1).fill('5')
      await modal.getByRole('button', { name: 'Save Variants' }).click()
      await page.waitForTimeout(1000)
      r.log('third-variant-add-no-crash', !(await h.hasErrorBoundary(page)))

      const afterAdd = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const xlGreen = (afterAdd?.data || []).find((v) => v.size === 'XL' && v.color === 'Green')
      r.log('third-variant-created', !!xlGreen, JSON.stringify(xlGreen))
      if (!xlGreen) return

      const deleteRes = await page.evaluate(async (id) => window.api.variants.delete({ id }), xlGreen.id)
      r.log('third-variant-delete-api-succeeds', !!deleteRes?.success, JSON.stringify(deleteRes?.error || ''))

      const afterDelete = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const stillThere = (afterDelete?.data || []).find((v) => v.size === 'XL' && v.color === 'Green')
      r.log('third-variant-actually-deleted', !stillThere, JSON.stringify(afterDelete?.data))
      r.log('original-two-variants-untouched', (afterDelete?.data || []).length === 2, `count=${afterDelete?.data?.length}`)
    })

    // variants.adjustStock has no UI trigger anywhere in the renderer — API-only coverage.
    await r.step('adjust-variant-stock-via-real-api', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const mBlue = (listRes?.data || []).find((v) => v.size === 'M' && v.color === 'Blue')
      r.log('m-blue-variant-found-for-adjust-test', !!mBlue, JSON.stringify(mBlue))
      if (!mBlue) return

      const beforeQty = mBlue.stockQty
      const adjustRes = await page.evaluate(async (variantId) => window.api.variants.adjustStock({
        variantId, quantityDelta: 3,
      }), mBlue.id)
      r.log('adjust-stock-api-succeeds', !!adjustRes?.success, JSON.stringify(adjustRes?.error || ''))

      const afterRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const mBlueAfter = (afterRes?.data || []).find((v) => v.size === 'M' && v.color === 'Blue')
      r.log('variant-stock-increased-by-3', mBlueAfter?.stockQty === beforeQty + 3, `before=${beforeQty} after=${mBlueAfter?.stockQty}`)
    })

    await r.step('bulk-generate-missing-barcodes-via-real-ui', async () => {
      await h.gotoHash(page, '#/products/print-labels')
      await page.waitForTimeout(700)
      r.log('print-labels-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const beforeRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
      const missingBefore = (beforeRes?.data || []).filter((v) => !v.barcode).length
      r.log('captured-missing-barcode-count-before', true, `missing=${missingBefore}`)

      // Searching and clicking a variant-tracked product opens the variant
      // picker panel (PrintLabelsScreen.tsx's addLine()) rather than adding
      // a line directly — "Generate missing barcodes for these variants"
      // only renders inside that panel, and only when at least one variant
      // still lacks a barcode.
      const searchBox = page.getByPlaceholder('Search or scan a product to add…')
      await searchBox.fill('E2E Cloth TShirt')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'E2E Cloth TShirt' }).first().click()
      await page.waitForTimeout(400)

      const genBtn = page.locator('button', { hasText: 'Generate missing barcodes for these variants' })
      const genVisible = await genBtn.count() > 0
      r.log('generate-missing-barcodes-button-visible', genVisible, `missingBefore=${missingBefore}`)
      if (genVisible) {
        await genBtn.click()
        await page.waitForTimeout(1000)
        r.log('bulk-generate-no-crash', !(await h.hasErrorBoundary(page)))

        const afterRes = await page.evaluate(async (pid) => window.api.variants.list({ productId: pid }), productId)
        const missingAfter = (afterRes?.data || []).filter((v) => !v.barcode).length
        r.log('all-missing-barcodes-now-filled', missingAfter === 0, `missingAfter=${missingAfter}`)
      } else {
        // Every variant already has a barcode (e.g. a prior run in this
        // same dev DB already generated them) — nothing to exercise, and
        // that's the CORRECT state for the button to be absent in.
        r.log('bulk-generate-no-crash', missingBefore === 0, `missingBefore=${missingBefore}`)
        r.log('all-missing-barcodes-now-filled', missingBefore === 0, `missingBefore=${missingBefore}`)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CLOTHING') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    // Variants must be deleted before cleanupByNamePrefix's Product delete,
    // or the FK forces a silent soft-delete (isActive=0) that leaves a
    // same-named zombie row forever — this had piled up ~48 stale rows.
    const variantsRemoved = h.withDb((db) => {
      const rows = db.prepare("SELECT pv.id FROM ProductVariant pv JOIN Product p ON p.id = pv.productId WHERE p.productName LIKE 'E2E Cloth%'").all().map((r2) => r2.id)
      for (const vid of rows) {
        try { db.prepare('DELETE FROM ProductVariant WHERE id = ?').run(vid) } catch { /* leave it, harmless test row */ }
      }
      return rows.length
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    console.log('extra cleanup: variants', variantsRemoved)
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCLOTHING VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
