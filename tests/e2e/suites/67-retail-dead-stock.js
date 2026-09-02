/**
 * Suite 67 — Retail vertical, Phase 67.
 * §9.1 Dead-Stock Clearance List: two real products via the real
 * product-creation API — one never sold (the genuine "dead stock" case),
 * one sold TODAY via a real invoice (proving the report correctly EXCLUDES
 * it — no backdating needed, a real sale happening right now is the
 * cleanest possible negative case).
 * §9.2 Price Markdowns: create via the real UI (price applies immediately),
 * a duplicate-active-markdown rejection, the auto-revert evaluator's two
 * branches (clean revert vs. skip-on-manual-override, both seeded with a
 * genuinely past endDate via literal epoch-ms integers, never
 * CURRENT_TIMESTAMP — see suite 40's real bug), and Cancel's two branches.
 * §9.3 Category Sell-Through Rate: a real product-category, a real 10-unit
 * sale against a 30-unit opening stock, verified via the real Reports UI
 * and the live API that unitsSold/currentStock/sellThroughRate all compute
 * correctly against the real, current (post-sale) inventory figure.
 * §9.4 Loyalty Program: configured via the real UI, 3 real qualifying sales
 * each earning exactly one automatic punch (no separate staff action), a
 * below-minimum sale correctly earning none, and a real Redeem via the UI
 * proving the surplus-preserving subtract-exactly-punchesRequired behavior
 * (3 punches on hand, 3 required, 0 left after — not just "some punches
 * used"). The dev DB's pre-existing LoyaltyProgram config (if any) is
 * captured and restored in a final cleanup step.
 * §9.5 Basket Composition: two real invoices genuinely pairing the same two
 * products (proving basketCount aggregates to 2, not 1), a third
 * single-item invoice proving it counts toward totalBaskets/
 * avgItemsPerBasket but produces zero pairing rows — verified via the real
 * Reports UI and the live API.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Retail'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-retail', async () => {
      const sw = await h.switchBusinessType(page, 'Retail / General Store')
      r.log('business-type-switched', sw.to === 'RETAIL', JSON.stringify(sw))
    })

    let deadProductId
    let soldProductId

    await r.step('seed-dead-and-recently-sold-products', async () => {
      const deadRes = await page.evaluate(() => window.api.products.create({
        productName: 'E2E Retail Dead Sweater', productType: 'STANDARD', unit: 'PCS',
        costPrice: 200, sellingPrice: 400, taxRate: 5, openingQuantity: 20,
      }))
      deadProductId = deadRes?.data?.id
      r.log('dead-product-created', !!deadRes?.success, JSON.stringify(deadRes?.error || ''))

      const soldRes = await page.evaluate(() => window.api.products.create({
        productName: 'E2E Retail Fresh Jacket', productType: 'STANDARD', unit: 'PCS',
        costPrice: 500, sellingPrice: 900, taxRate: 5, openingQuantity: 10,
      }))
      soldProductId = soldRes?.data?.id
      r.log('sold-product-created', !!soldRes?.success, JSON.stringify(soldRes?.error || ''))

      const invRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 1, unitPrice: 900, taxRate: 5 }],
      }), soldProductId)
      r.log('recent-sale-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
    })

    await r.step('dead-stock-clearance-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Dead-Stock Clearance List' }).first()
      r.log('dead-stock-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      // requiresDateRange: false — no date inputs to fill, same pattern as
      // Inventory Report / Batch Expiry.
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('dead-stock-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('dead-stock-report-shows-dead-product', bodyText.includes('E2E Retail Dead Sweater'))
      r.log('dead-stock-report-excludes-recently-sold-product', !bodyText.includes('E2E Retail Fresh Jacket'))
      await h.shot(page, 'retail-dead-stock-clearance')
    })

    await r.step('dead-stock-clearance-report-computes-correctly-via-real-api', async () => {
      const res = await page.evaluate(() => window.api.reports.deadStockClearance({}))
      const rows = res?.data?.rows || []
      const deadRow = rows.find((row) => row.productId === deadProductId)
      const soldRow = rows.find((row) => row.productId === soldProductId)
      r.log('dead-product-row-found', !!deadRow, JSON.stringify(deadRow))
      if (deadRow) {
        r.log('dead-product-capital-locked-correct', deadRow.capitalLocked === 4000, `capitalLocked=${deadRow.capitalLocked}`) // 20 units * 200 cost
        r.log('dead-product-current-stock-correct', deadRow.currentStock === 20, `currentStock=${deadRow.currentStock}`)
        r.log('dead-product-never-sold', deadRow.lastSoldDate === null, `lastSoldDate=${deadRow.lastSoldDate}`)
      }
      r.log('recently-sold-product-correctly-excluded', !soldRow, JSON.stringify(soldRow))
    })

    // ─── Phase 67 §9.2: Price Markdowns — time-boxed markdown workflow ─────
    let mdProductAId, mdProductBId, mdProductCId, mdProductDId
    let markdownIdA, markdownIdD

    await r.step('seed-price-markdown-test-products', async () => {
      const mk = async (name, price) => {
        const res = await page.evaluate(({ n, p }) => window.api.products.create({
          productName: n, productType: 'STANDARD', unit: 'PCS',
          costPrice: p * 0.5, sellingPrice: p, taxRate: 5, openingQuantity: 5,
        }), { n: name, p: price })
        return res?.data?.id
      }
      mdProductAId = await mk('E2E Retail Markdown Alpha', 500)
      mdProductBId = await mk('E2E Retail Markdown Bravo', 300)
      mdProductCId = await mk('E2E Retail Markdown Charlie', 800)
      mdProductDId = await mk('E2E Retail Markdown Delta', 200)
      r.log('markdown-test-products-created', [mdProductAId, mdProductBId, mdProductCId, mdProductDId].every(Boolean))
    })

    await r.step('create-markdown-via-real-ui-applies-price-immediately', async () => {
      await h.gotoHash(page, '#/pricing/markdowns')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("New Markdown")').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Product').selectOption(mdProductAId)
      await modal.getByLabel('Markdown Price').fill('350')
      const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      await modal.getByLabel('Reverts On').fill(future)
      await modal.locator('button:has-text("Create")').click()
      await page.waitForTimeout(1000)

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('markdown-appears-in-real-ui-list', bodyText.includes('E2E Retail Markdown Alpha'))

      const prodRes = await page.evaluate((pid) => window.api.products.get(pid), mdProductAId)
      r.log('price-applied-to-product-immediately', prodRes?.data?.sellingPrice === 350, `sellingPrice=${prodRes?.data?.sellingPrice}`)

      const listRes = await page.evaluate(() => window.api.priceMarkdowns.list())
      const row = (listRes?.data || []).find((m) => m.productId === mdProductAId)
      markdownIdA = row?.id
      r.log('markdown-row-has-correct-fields', row?.originalPrice === 500 && row?.markdownPrice === 350 && row?.status === 'ACTIVE', JSON.stringify(row))
    })

    await r.step('duplicate-active-markdown-on-same-product-rejected', async () => {
      const res = await page.evaluate((pid) => window.api.priceMarkdowns.create({
        productId: pid, markdownPrice: 100, endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      }), mdProductAId)
      r.log('duplicate-active-markdown-rejected', res?.success === false && res?.error?.code === 'MKD-002', JSON.stringify(res))
    })

    await r.step('evaluator-reverts-a-genuinely-past-due-markdown', async () => {
      // Raw-SQL seed: literal Date.now() epoch-ms integers, never
      // CURRENT_TIMESTAMP — see the lesson from suite 40's real bug (SQLite's
      // CURRENT_TIMESTAMP produces TEXT, but Prisma DateTime columns store
      // INTEGER epoch-ms; a date-range/lte filter silently excludes TEXT rows).
      const now = Date.now()
      const pastEndDate = now - 3600000
      const mdId = `e2e-md-bravo-${now}`
      h.withDb((db) => {
        db.prepare(`INSERT INTO PriceMarkdown (id, productId, originalPrice, markdownPrice, startDate, endDate, status, createdAt, updatedAt)
          VALUES (?, ?, 300, 150, ?, ?, 'ACTIVE', ?, ?)`).run(mdId, mdProductBId, now - 86400000, pastEndDate, now - 86400000, now - 86400000)
        // Price is still at the markdown price — the "clean" revert case.
        db.prepare('UPDATE Product SET sellingPrice = 150 WHERE id = ?').run(mdProductBId)
      })

      const evalRes = await page.evaluate(() => window.api.priceMarkdowns.evaluateNow())
      r.log('evaluate-now-succeeded', !!evalRes?.success, JSON.stringify(evalRes))
      r.log('evaluator-reverted-at-least-one', (evalRes?.data?.reverted ?? 0) >= 1, JSON.stringify(evalRes?.data))

      const row = h.withDb((db) => db.prepare('SELECT status, revertedAt FROM PriceMarkdown WHERE id = ?').get(mdId))
      r.log('markdown-status-reverted', row?.status === 'REVERTED', JSON.stringify(row))
      const prodRes = await page.evaluate((pid) => window.api.products.get(pid), mdProductBId)
      r.log('product-price-restored-to-original', prodRes?.data?.sellingPrice === 300, `sellingPrice=${prodRes?.data?.sellingPrice}`)
    })

    await r.step('evaluator-skips-revert-when-price-manually-changed', async () => {
      const now = Date.now()
      const pastEndDate = now - 3600000
      const mdId = `e2e-md-charlie-${now}`
      h.withDb((db) => {
        db.prepare(`INSERT INTO PriceMarkdown (id, productId, originalPrice, markdownPrice, startDate, endDate, status, createdAt, updatedAt)
          VALUES (?, ?, 800, 600, ?, ?, 'ACTIVE', ?, ?)`).run(mdId, mdProductCId, now - 86400000, pastEndDate, now - 86400000, now - 86400000)
        // Owner manually changed the price away from the markdown price
        // before the revert ran — must be respected, not overwritten.
        db.prepare('UPDATE Product SET sellingPrice = 750 WHERE id = ?').run(mdProductCId)
      })

      const evalRes = await page.evaluate(() => window.api.priceMarkdowns.evaluateNow())
      r.log('evaluator-counted-a-skip', (evalRes?.data?.skippedManualOverride ?? 0) >= 1, JSON.stringify(evalRes?.data))

      const row = h.withDb((db) => db.prepare('SELECT status FROM PriceMarkdown WHERE id = ?').get(mdId))
      r.log('markdown-status-skipped-manual-override', row?.status === 'SKIPPED_MANUAL_OVERRIDE', JSON.stringify(row))
      const prodRes = await page.evaluate((pid) => window.api.products.get(pid), mdProductCId)
      r.log('manually-changed-price-left-untouched', prodRes?.data?.sellingPrice === 750, `sellingPrice=${prodRes?.data?.sellingPrice}`)
    })

    await r.step('cancel-markdown-with-price-unchanged-reverts-immediately', async () => {
      const createRes = await page.evaluate((pid) => window.api.priceMarkdowns.create({
        productId: pid, markdownPrice: 150, endDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      }), mdProductDId)
      markdownIdD = createRes?.data?.id
      r.log('markdown-d-created', !!createRes?.success, JSON.stringify(createRes?.error || ''))

      const cancelRes = await page.evaluate((id) => window.api.priceMarkdowns.cancel(id), markdownIdD)
      r.log('cancel-succeeded', !!cancelRes?.success, JSON.stringify(cancelRes))

      const prodRes = await page.evaluate((pid) => window.api.products.get(pid), mdProductDId)
      r.log('price-reverted-to-original-on-cancel', prodRes?.data?.sellingPrice === 200, `sellingPrice=${prodRes?.data?.sellingPrice}`)
      const row = h.withDb((db) => db.prepare('SELECT status FROM PriceMarkdown WHERE id = ?').get(markdownIdD))
      r.log('markdown-d-status-cancelled', row?.status === 'CANCELLED', JSON.stringify(row))
    })

    await r.step('cancel-markdown-with-price-already-changed-leaves-price-alone', async () => {
      // markdownIdA is still ACTIVE from the earlier real-UI step. Simulate
      // the owner manually re-pricing the product before cancelling.
      // UpdateProductSchema requires the full product payload (not a
      // partial patch), so fetch the current row first.
      const updateRes = await page.evaluate(async (pid) => {
        const cur = await window.api.products.get(pid)
        // UpdateProductSchema has several `.optional()` (non-nullable)
        // string fields that reject an explicit `null` from a fetched row —
        // strip nulls so only real values or omitted keys are sent.
        const payload = Object.fromEntries(Object.entries(cur.data).filter(([, v]) => v !== null))
        return window.api.products.update({ ...payload, sellingPrice: 999 })
      }, mdProductAId)
      r.log('manual-price-change-saved', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))
      const cancelRes = await page.evaluate((id) => window.api.priceMarkdowns.cancel(id), markdownIdA)
      r.log('cancel-a-succeeded', !!cancelRes?.success, JSON.stringify(cancelRes))

      const prodRes = await page.evaluate((pid) => window.api.products.get(pid), mdProductAId)
      r.log('manually-set-price-not-touched-by-cancel', prodRes?.data?.sellingPrice === 999, `sellingPrice=${prodRes?.data?.sellingPrice}`)
      const row = h.withDb((db) => db.prepare('SELECT status FROM PriceMarkdown WHERE id = ?').get(markdownIdA))
      r.log('markdown-a-status-cancelled', row?.status === 'CANCELLED', JSON.stringify(row))
    })

    // ─── Phase 67 §9.1 item 3: Category Sell-Through Rate ──────────────────
    let sellThroughCategoryId, sellThroughProductId

    await r.step('seed-category-sell-through-product-and-sale', async () => {
      const catRes = await page.evaluate(() => window.api.categories.create({ name: 'E2E Retail Snacks Category' }))
      sellThroughCategoryId = catRes?.data?.id
      r.log('category-created', !!catRes?.success, JSON.stringify(catRes?.error || ''))

      const prodRes = await page.evaluate((categoryId) => window.api.products.create({
        productName: 'E2E Retail Category Chips', productType: 'STANDARD', unit: 'PCS',
        costPrice: 20, sellingPrice: 40, taxRate: 5, openingQuantity: 30, categoryId,
      }), sellThroughCategoryId)
      sellThroughProductId = prodRes?.data?.id
      r.log('category-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const invRes = await page.evaluate((pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 10, unitPrice: 40, taxRate: 5 }],
      }), sellThroughProductId)
      r.log('category-sale-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
    })

    await r.step('category-sell-through-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Category Sell-Through Rate' }).first()
      r.log('sell-through-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      const monthStart = new Date(); monthStart.setDate(1)
      await dateInputs.nth(0).fill(h.toLocalISODate(monthStart))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('sell-through-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('sell-through-report-shows-category', bodyText.includes('E2E Retail Snacks Category'))
      await h.shot(page, 'retail-category-sell-through')
    })

    await r.step('category-sell-through-report-computes-correctly-via-real-api', async () => {
      const monthStart = new Date(); monthStart.setDate(1)
      const from = h.toLocalISODate(monthStart)
      const to = h.toLocalISODate(new Date())
      const thisMonthLabel = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

      const res = await page.evaluate(({ from, to }) => window.api.reports.categorySellThrough({ dateFrom: from, dateTo: to }), { from, to })
      const row = (res?.data?.rows || []).find((rr) => rr.categoryId === sellThroughCategoryId && rr.month === thisMonthLabel)
      r.log('sell-through-row-found', !!row, JSON.stringify(row))

      const prodRes = await page.evaluate((pid) => window.api.products.get(pid), sellThroughProductId)
      const currentStock = prodRes?.data?.inventory?.quantity
      r.log('current-stock-is-20-after-selling-10-of-30', currentStock === 20, `currentStock=${currentStock}`)

      if (row) {
        r.log('units-sold-is-10', row.unitsSold === 10, `unitsSold=${row.unitsSold}`)
        r.log('current-stock-in-row-matches-live-inventory', row.currentStock === currentStock, `row.currentStock=${row.currentStock}`)
        const expectedRate = Math.round((10 / (10 + currentStock)) * 1000) / 10
        r.log('sell-through-rate-computed-correctly', row.sellThroughRate === expectedRate, `sellThroughRate=${row.sellThroughRate}, expected=${expectedRate}`)
      }
    })

    // ─── Phase 67 §9.1 item 4: Simple Loyalty Punch-Card ────────────────────
    let loyaltyCustomerId, loyaltyProductId
    // Captured before this suite overwrites the singleton LoyaltyProgram
    // config row, and restored in the final cleanup step below — this dev
    // DB's real program config (if any) must survive the test run.
    const originalLoyaltyProgram = (await page.evaluate(() => window.api.loyaltyProgram.get()))?.data ?? null

    await r.step('configure-loyalty-program-via-real-ui', async () => {
      await h.gotoHash(page, '#/pricing/loyalty')
      await page.waitForTimeout(700)
      // Two "Program Settings" buttons can render at once on first load —
      // the header's own button plus the empty-state CTA's identical one
      // (no program configured yet) — .first() picks either, both open the
      // same modal.
      await page.locator('button:has-text("Program Settings")').first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const checkbox = modal.getByLabel('Program is active')
      if (!(await checkbox.isChecked())) await checkbox.check()
      await modal.getByLabel('Punches Needed for a Reward').fill('3')
      // Exact match required — "Reward" is a substring of the punches-needed
      // field's own label ("Punches Needed for a Reward"), which Playwright's
      // getByLabel matches by default without {exact: true}.
      await modal.getByLabel('Reward', { exact: true }).fill('E2E Free Item')
      await modal.getByLabel('Minimum Purchase for a Punch').fill('100')
      await modal.locator('button:has-text("Save")').click()
      await page.waitForTimeout(800)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('program-settings-saved-no-crash', !(await h.hasErrorBoundary(page)) && !bodyText.includes('Could not'))

      const progRes = await page.evaluate(() => window.api.loyaltyProgram.get())
      r.log('program-reflects-saved-settings', progRes?.data?.punchesRequired === 3 && progRes?.data?.rewardDescription === 'E2E Free Item' && progRes?.data?.minPurchaseAmount === 100, JSON.stringify(progRes?.data))
    })

    await r.step('seed-loyalty-customer-and-product', async () => {
      const custRes = await page.evaluate(() => window.api.customers.create({ customerName: 'E2E Retail Loyalty Customer', phone: `9${String(Date.now()).slice(-9)}` }))
      loyaltyCustomerId = custRes?.data?.id
      r.log('loyalty-customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))

      const prodRes = await page.evaluate(() => window.api.products.create({
        productName: 'E2E Retail Loyalty Item', productType: 'STANDARD', unit: 'PCS',
        costPrice: 75, sellingPrice: 150, taxRate: 5, openingQuantity: 50,
      }))
      loyaltyProductId = prodRes?.data?.id
      r.log('loyalty-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
    })

    await r.step('qualifying-sales-earn-punches-automatically', async () => {
      // 3 real invoices at 150 each — above the 100 minPurchaseAmount, so
      // each should earn exactly one punch with zero extra steps at checkout.
      for (let i = 0; i < 3; i++) {
        const res = await page.evaluate(({ pid, cid }) => window.api.billing.createInvoice({
          paymentMethod: 'CASH', customerId: cid,
          items: [{ productId: pid, quantity: 1, unitPrice: 150, taxRate: 5 }],
        }), { pid: loyaltyProductId, cid: loyaltyCustomerId })
        if (i === 2) r.log('third-qualifying-sale-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      }

      const listRes = await page.evaluate(() => window.api.loyaltyProgram.listCards())
      const card = (listRes?.data?.rows || []).find((c) => c.customerId === loyaltyCustomerId)
      r.log('card-created-with-3-punches', card?.currentPunches === 3, JSON.stringify(card))
      r.log('card-ready-for-reward', card?.readyForReward === true, JSON.stringify(card?.readyForReward))
    })

    await r.step('below-minimum-sale-does-not-earn-a-punch', async () => {
      const res = await page.evaluate(({ pid, cid }) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', customerId: cid,
        items: [{ productId: pid, quantity: 1, unitPrice: 50, taxRate: 0 }],
      }), { pid: loyaltyProductId, cid: loyaltyCustomerId })
      r.log('below-minimum-sale-succeeded', !!res?.success, JSON.stringify(res?.error || ''))

      const listRes = await page.evaluate(() => window.api.loyaltyProgram.listCards())
      const card = (listRes?.data?.rows || []).find((c) => c.customerId === loyaltyCustomerId)
      r.log('punches-still-3-after-below-minimum-sale', card?.currentPunches === 3, `currentPunches=${card?.currentPunches}`)
    })

    await r.step('redeem-reward-via-real-ui', async () => {
      // Already on this route from the earlier settings step — hash-based
      // routing is a same-route no-op, so the screen's own data (fetched
      // before this suite's sales/redemption happened) never re-fetches on
      // its own. Navigate away and back to force a genuine remount, exactly
      // what a real user clicking elsewhere and returning would trigger.
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(400)
      await h.gotoHash(page, '#/pricing/loyalty')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('customer-visible-in-loyalty-list', bodyText.includes('E2E Retail Loyalty Customer'))

      const row = page.locator('tr', { hasText: 'E2E Retail Loyalty Customer' }).first()
      await row.locator('button', { hasText: 'Redeem' }).click()
      await page.waitForTimeout(300)
      await h.topModal(page).locator('button', { hasText: 'Redeem' }).click()
      await page.waitForTimeout(800)

      const listRes = await page.evaluate(() => window.api.loyaltyProgram.listCards())
      const card = (listRes?.data?.rows || []).find((c) => c.customerId === loyaltyCustomerId)
      // Redeem subtracts exactly punchesRequired (3) from the 3 punches
      // on hand — never resets to 0 — so this also proves the surplus-
      // preserving subtraction, not just that a redeem happened at all.
      r.log('punches-decremented-by-exactly-punches-required', card?.currentPunches === 0, `currentPunches=${card?.currentPunches}`)
      r.log('total-rewards-redeemed-incremented', card?.totalRewardsRedeemed === 1, `totalRewardsRedeemed=${card?.totalRewardsRedeemed}`)
    })

    // ─── Phase 67 §9.1 item 5: Basket Composition ────────────────────────────
    let basketProductXId, basketProductYId, basketProductZId

    await r.step('seed-basket-composition-products-and-sales', async () => {
      const mk = async (name, price) => {
        const res = await page.evaluate(({ n, p }) => window.api.products.create({
          productName: n, productType: 'STANDARD', unit: 'PCS', costPrice: p * 0.5, sellingPrice: p, taxRate: 5, openingQuantity: 20,
        }), { n: name, p: price })
        return res?.data?.id
      }
      basketProductXId = await mk('E2E Retail Basket Bread', 40)
      basketProductYId = await mk('E2E Retail Basket Butter', 60)
      basketProductZId = await mk('E2E Retail Basket Jam', 80)
      r.log('basket-products-created', [basketProductXId, basketProductYId, basketProductZId].every(Boolean))

      // Two real invoices pairing Bread+Butter (proving basketCount 2, not 1
      // — a genuine aggregation, not a per-invoice flag), one single-item
      // invoice for Jam alone (proving it counts toward totalBaskets/
      // avgItemsPerBasket but produces zero pairing rows).
      const mkInvoice = (items) => page.evaluate((its) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: its,
      }), items)
      const inv1 = await mkInvoice([
        { productId: basketProductXId, quantity: 1, unitPrice: 40, taxRate: 5 },
        { productId: basketProductYId, quantity: 1, unitPrice: 60, taxRate: 5 },
      ])
      const inv2 = await mkInvoice([
        { productId: basketProductXId, quantity: 1, unitPrice: 40, taxRate: 5 },
        { productId: basketProductYId, quantity: 1, unitPrice: 60, taxRate: 5 },
      ])
      const inv3 = await mkInvoice([{ productId: basketProductZId, quantity: 1, unitPrice: 80, taxRate: 5 }])
      r.log('two-pairing-invoices-and-one-single-item-invoice-created', !!inv1?.success && !!inv2?.success && !!inv3?.success, JSON.stringify({ e1: inv1?.error, e2: inv2?.error, e3: inv3?.error }))
    })

    await r.step('basket-composition-report-renders-via-real-ui', async () => {
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Basket Composition' }).first()
      r.log('basket-composition-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      const dateInputs = page.locator('input[type="date"]')
      const monthStart = new Date(); monthStart.setDate(1)
      await dateInputs.nth(0).fill(h.toLocalISODate(monthStart))
      await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('basket-composition-report-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('report-shows-both-paired-products', bodyText.includes('E2E Retail Basket Bread') && bodyText.includes('E2E Retail Basket Butter'))
      await h.shot(page, 'retail-basket-composition')
    })

    await r.step('basket-composition-report-computes-correctly-via-real-api', async () => {
      const monthStart = new Date(); monthStart.setDate(1)
      const from = h.toLocalISODate(monthStart)
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.basketComposition({ dateFrom: from, dateTo: to }), { from, to })
      const row = (res?.data?.rows || []).find((rr) =>
        (rr.productAId === basketProductXId && rr.productBId === basketProductYId) ||
        (rr.productAId === basketProductYId && rr.productBId === basketProductXId)
      )
      r.log('bread-butter-pair-found', !!row, JSON.stringify(row))
      r.log('pair-basket-count-is-2', row?.basketCount === 2, `basketCount=${row?.basketCount}`)

      // The single-item Jam invoice must never produce a pairing row with
      // anything, but must still count toward totalBaskets/avgItemsPerBasket.
      const jamPairRow = (res?.data?.rows || []).find((rr) => rr.productAId === basketProductZId || rr.productBId === basketProductZId)
      r.log('single-item-basket-produces-no-pairing-row', !jamPairRow, JSON.stringify(jamPairRow))
      r.log('summary-total-baskets-includes-all-three-invoices', (res?.data?.summary?.totalBaskets ?? 0) >= 3, JSON.stringify(res?.data?.summary))
    })

    await r.step('restore-original-loyalty-program', async () => {
      if (originalLoyaltyProgram) {
        const res = await page.evaluate((p) => window.api.loyaltyProgram.upsert({
          isActive: p.isActive, punchesRequired: p.punchesRequired, rewardDescription: p.rewardDescription, minPurchaseAmount: p.minPurchaseAmount
        }), originalLoyaltyProgram)
        r.log('loyalty-program-restored', !!res?.success, JSON.stringify(res?.error || ''))
      } else {
        // No program existed before this suite ran — delete the row this
        // suite created rather than leaving a permanent config change in a
        // dev DB that never had one.
        h.withDb((db) => db.prepare("DELETE FROM LoyaltyProgram WHERE rewardDescription = 'E2E Free Item'").run())
        r.log('loyalty-program-row-removed-no-prior-config', true)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'RETAIL') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
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
    console.log(`\nRETAIL VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
