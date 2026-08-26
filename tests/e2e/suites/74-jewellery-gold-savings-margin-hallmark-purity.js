/**
 * Suite 74 — Jewellery vertical, Phase 67 §9.1 items 1-5: Gold savings
 * (chit) scheme ledger (Feature), Making-Charge vs. Metal-Value Margin
 * (Report), Hallmarking/HUID Compliance Register (Report), Metal Rate vs.
 * Sales Volume (Report), and Purity-Adjusted Exchange Analytics (Feature).
 * Pre-existing suite 10 already exhaustively covers the base
 * product/billing/exchange flow via the real UI — this suite reuses the
 * API for that baseline setup and focuses real UI interaction on the FIVE
 * NEW capabilities only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E JWL74'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let jewelTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-jewellery', async () => {
      const sw = await h.switchBusinessType(page, 'Jewellery')
      r.log('business-type-switched', sw.to === 'JEWELLERY', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      jewelTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('JEWELLERY')
      if (jewelTemplateRowBefore) {
        const mods = new Set(JSON.parse(jewelTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), jewelTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'JEWELLERY', JSON.stringify(['ai_assistant']))
      }
    })

    // ─── Setup via API — same convention this whole arc uses: real UI
    // interaction is reserved for the NEW capabilities under test, not the
    // baseline product/billing scaffolding suite 10 already covers. ───────
    let customerId, compliantProductId, nonCompliantProductId

    await r.step('setup-customer-rate-and-two-jewellery-products', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))

      const rateRes = await page.evaluate(() => window.api.metalRate.upsert({ metalType: 'GOLD', purity: '22K', ratePerGram: 6000 }))
      r.log('metal-rate-set', !!rateRes?.success, JSON.stringify(rateRes?.error || ''))

      const compliantRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Compliant Ring`, productType: 'STANDARD', sellingPrice: 0, unit: 'NOS', openingQuantity: 5,
        metalType: 'GOLD', purity: '22K', grossWeight: 10, stoneWeight: 1, makingChargeType: 'FIXED', makingChargeValue: 500,
        hallmarkNumber: 'HUID-E2E-001',
      }), TEST_PREFIX)
      compliantProductId = compliantRes?.data?.id
      r.log('compliant-product-created', !!compliantProductId, JSON.stringify(compliantRes?.error || ''))

      const nonCompliantRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Non-Compliant Chain`, productType: 'STANDARD', sellingPrice: 0, unit: 'NOS', openingQuantity: 5,
        metalType: 'GOLD', purity: '22K', grossWeight: 5, stoneWeight: 0, makingChargeType: 'FIXED', makingChargeValue: 200,
      }), TEST_PREFIX)
      nonCompliantProductId = nonCompliantRes?.data?.id
      r.log('non-compliant-product-created', !!nonCompliantProductId, JSON.stringify(nonCompliantRes?.error || ''))
    })

    let invoiceNumber
    await r.step('bill-the-compliant-jewellery-item-with-real-jewellery-snapshot-fields', async () => {
      if (!customerId || !compliantProductId) return r.log('bill-the-compliant-jewellery-item-with-real-jewellery-snapshot-fields', false, 'missing setup ids')
      // netWeight = 10 - 1 = 9; metalValue = 9 * 6000 = 54000; +500 making charge = 54500 total
      const invRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CASH',
        items: [{
          productId, quantity: 1, unitPrice: 54500,
          jewelleryMetalType: 'GOLD', jewelleryPurity: '22K', jewelleryNetWeight: 9, jewelleryRatePerGram: 6000,
          jewelleryMakingCharge: 500, jewelleryHallmarkNumber: 'HUID-E2E-001',
        }],
      }), { customerId, productId: compliantProductId })
      r.log('jewellery-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
      invoiceNumber = invRes?.data?.invoiceNumber
    })

    // ─── Phase 67 §9.1 item 2: Making-Charge vs. Metal-Value Margin ────────
    await r.step('making-charge-margin-report-computes-and-renders-correctly', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.makingChargeMargin(p), { dateFrom, dateTo })
      r.log('making-charge-margin-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.invoiceNumber === invoiceNumber)
      r.log('making-charge-margin-row-matches-our-invoice', !!row && row.metalValue === 54000 && row.makingCharge === 500, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Making-Charge vs. Metal-Value Margin' }).first()
      r.log('making-charge-margin-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('making-charge-margin-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('making-charge-margin-shows-our-invoice', !!invoiceNumber && bodyText.includes(invoiceNumber))
        await h.shot(page, 'jewellery-making-charge-margin')
      }
    })

    // ─── Phase 67 §9.1 item 3: Hallmarking/HUID Compliance Register ────────
    await r.step('hallmark-compliance-report-flags-the-non-compliant-item', async () => {
      const reportRes = await page.evaluate(() => window.api.reports.hallmarkCompliance())
      r.log('hallmark-compliance-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const rows = reportRes?.data?.rows || []
      const compliantRow = rows.find((rr) => rr.productId === compliantProductId)
      const nonCompliantRow = rows.find((rr) => rr.productId === nonCompliantProductId)
      r.log('compliant-product-flagged-compliant', compliantRow?.compliant === true, JSON.stringify(compliantRow))
      r.log('non-compliant-product-flagged-non-compliant', nonCompliantRow?.compliant === false, JSON.stringify(nonCompliantRow))
      const nonCompliantIdx = rows.findIndex((rr) => rr.productId === nonCompliantProductId)
      const compliantIdx = rows.findIndex((rr) => rr.productId === compliantProductId)
      r.log('non-compliant-item-ranks-before-compliant-in-worklist', nonCompliantIdx >= 0 && compliantIdx >= 0 && nonCompliantIdx <= compliantIdx, JSON.stringify({ nonCompliantIdx, compliantIdx }))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Hallmarking / HUID Compliance Register' }).first()
      r.log('hallmark-compliance-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        // Even a requiresDateRange:false report still needs an explicit
        // "Generate Report" click to trigger the actual fetch — the tile
        // click alone only selects it, same convention every report in
        // this codebase's own generateReport() E2E helper already uses.
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('hallmark-compliance-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('hallmark-compliance-shows-both-our-products', bodyText.includes('Compliant Ring') && bodyText.includes('Non-Compliant Chain'), bodyText.slice(0, 3000))
        await h.shot(page, 'jewellery-hallmark-compliance')
      }
    })

    // ─── Phase 67 §9.1 item 4: Metal Rate vs. Sales Volume ─────────────────
    await r.step('metal-rate-vs-sales-volume-auto-selects-gold-22k-and-renders-correctly', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.metalRateVsSalesVolume(p), { dateFrom, dateTo })
      r.log('metal-rate-vs-sales-volume-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      r.log('metal-rate-vs-sales-volume-auto-selected-gold-22k', reportRes?.data?.metalType === 'GOLD' && reportRes?.data?.purity === '22K', JSON.stringify({ metalType: reportRes?.data?.metalType, purity: reportRes?.data?.purity }))
      const thisMonth = new Date().toISOString().slice(0, 7)
      const row = (reportRes?.data?.rows || []).find((rr) => rr.month === thisMonth)
      r.log('metal-rate-vs-sales-volume-row-has-our-rate-and-weight', row?.avgRatePerGram === 6000 && row?.salesWeightGrams >= 9, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Metal Rate vs. Sales Volume' }).first()
      r.log('metal-rate-vs-sales-volume-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('metal-rate-vs-sales-volume-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('metal-rate-vs-sales-volume-shows-gold-22k', bodyText.includes('GOLD') && bodyText.includes('22K'))
        await h.shot(page, 'jewellery-metal-rate-vs-sales-volume')
      }
    })

    // ─── Phase 67 §9.1 item 5: Purity-Adjusted Exchange Analytics ──────────
    let exchangeId
    await r.step('record-a-22k-exchange-and-verify-pure-equivalent-weight-via-real-ui', async () => {
      const exRes = await page.evaluate(async (prefix) => window.api.metalExchange.create({
        customerName: `${prefix} Exchange Walkin`, metalType: 'GOLD', purity: '22K', grossWeight: 24, deductionWeight: 0,
      }), TEST_PREFIX)
      r.log('exchange-created', !!exRes?.success, JSON.stringify(exRes?.error || ''))
      exchangeId = exRes?.data?.id
      // netWeight 24 * 6000/g = 144000 value given

      await h.gotoHash(page, '#/jewellery/exchanges')
      await page.waitForTimeout(700)
      r.log('exchange-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      // 24g at 22K -> 22g pure-equivalent (24 * 22/24 = 22)
      r.log('exchange-screen-shows-pure-equivalent-weight', /22\.000/.test(bodyText), bodyText.slice(0, 2000))
      await h.shot(page, 'jewellery-exchange-pure-equivalent')

      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.purityAdjustedExchange(p), { dateFrom, dateTo })
      r.log('purity-adjusted-exchange-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.byMetal || []).find((rr) => rr.metalType === 'GOLD' && rr.purity === '22K')
      r.log('purity-adjusted-exchange-row-computed-correctly', row?.pureEquivalentGrams >= 22 && row?.rawWeightGrams >= 24, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Purity-Adjusted Exchange Analytics' }).first()
      r.log('purity-adjusted-exchange-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('purity-adjusted-exchange-renders-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'jewellery-purity-adjusted-exchange')
      }
    })

    // ─── Phase 67 §9.1 item 1: Gold Savings scheme ledger, real UI ─────────
    let schemeNumber
    await r.step('run-a-gold-savings-scheme-lifecycle-via-real-ui', async () => {
      await h.gotoHash(page, '#/jewellery/gold-savings')
      await page.waitForTimeout(700)
      r.log('gold-savings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Phase 67 §9.1 — GoldSavingsScreen's New Scheme / Add Installment /
      // Redeem panels are inline <Card> blocks in the normal page flow
      // (matching MetalExchangeScreen's own established pattern), NOT
      // `div.fixed.inset-0` overlay modals — h.topModal() would find
      // nothing here, so interact with `page` directly instead.
      await page.locator('button', { hasText: 'New Scheme' }).first().click()
      await page.waitForTimeout(500)

      const custSearch = page.locator('input[placeholder*="Search"]').first()
      await custSearch.fill(`${TEST_PREFIX} Customer`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Customer` }).first().click()
      await page.waitForTimeout(300)

      await page.locator('input[type="number"]').first().fill('5000')
      await page.waitForTimeout(200)

      await page.locator('button', { hasText: 'Create Scheme' }).click()
      await page.waitForTimeout(1000)
      r.log('gold-savings-scheme-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async (custId) => window.api.goldSavings.list({ customerId: custId }), customerId)
      const scheme = (listRes?.data || [])[0]
      r.log('scheme-findable-via-api', !!scheme, JSON.stringify(scheme))
      schemeNumber = scheme?.schemeNumber
      const schemeId = scheme?.id

      if (schemeId) {
        await page.locator('button', { hasText: 'Add Installment' }).first().click()
        await page.waitForTimeout(500)
        await page.locator('input[type="number"]').first().fill('5000')
        await page.locator('button', { hasText: 'Record' }).click()
        await page.waitForTimeout(1000)
        r.log('installment-recorded-no-crash', !(await h.hasErrorBoundary(page)))

        const afterInstallRes = await page.evaluate(async (id) => window.api.goldSavings.list({ customerId: id }), customerId)
        const afterScheme = (afterInstallRes?.data || []).find((s) => s.id === schemeId)
        r.log('scheme-total-deposited-reflects-installment', afterScheme?.totalDeposited === 5000, JSON.stringify(afterScheme))

        await page.locator('button', { hasText: 'Redeem' }).first().click()
        await page.waitForTimeout(500)
        // The Redeem panel renders ABOVE the schemes list in the JSX (same
        // order as MetalExchangeScreen's own linkTarget panel), so once
        // open there are two "Redeem"-labelled buttons: the panel's own
        // submit action (first in DOM order) and the still-visible
        // per-scheme list button (second) — `.first()` is the submit action.
        await page.locator('button', { hasText: 'Redeem' }).first().click()
        await page.waitForTimeout(1000)
        r.log('scheme-redeemed-no-crash', !(await h.hasErrorBoundary(page)))

        const afterRedeemRes = await page.evaluate(async (id) => window.api.goldSavings.list({ customerId: id }), customerId)
        const redeemedScheme = (afterRedeemRes?.data || []).find((s) => s.id === schemeId)
        r.log('scheme-status-is-redeemed', redeemedScheme?.status === 'REDEEMED', JSON.stringify(redeemedScheme))
        r.log('scheme-redeemed-amount-matches-deposit', redeemedScheme?.redeemedAmount === 5000, JSON.stringify(redeemedScheme))
      }
      await h.shot(page, 'jewellery-gold-savings')
    })

    // ─── AI intents for all 5 new items ─────────────────────────────────────
    await r.step('ai-intents-route-correctly-for-jewellery-items', async () => {
      const gsRes = await page.evaluate(() => window.api.ai.query({ question: 'How many gold savings schemes are active?' }))
      r.log('ai-gold-savings-intent-routed-correctly', gsRes?.data?.template === 'jewellery.goldSavingsSummary', JSON.stringify({ template: gsRes?.data?.template, answer: gsRes?.data?.answer }))

      const marginRes = await page.evaluate(() => window.api.ai.query({ question: 'Show me the making charge margin breakdown' }))
      r.log('ai-making-charge-margin-intent-routed-correctly', marginRes?.data?.template === 'jewellery.makingChargeMargin', JSON.stringify({ template: marginRes?.data?.template, answer: marginRes?.data?.answer }))

      const hallmarkRes = await page.evaluate(() => window.api.ai.query({ question: 'Show me our hallmark compliance register' }))
      r.log('ai-hallmark-compliance-intent-routed-correctly', hallmarkRes?.data?.template === 'jewellery.hallmarkCompliance', JSON.stringify({ template: hallmarkRes?.data?.template, answer: hallmarkRes?.data?.answer }))

      const rateVolRes = await page.evaluate(() => window.api.ai.query({ question: 'How does metal rate correlate with sales volume?' }))
      r.log('ai-metal-rate-vs-sales-volume-intent-routed-correctly', rateVolRes?.data?.template === 'jewellery.metalRateVsSalesVolume', JSON.stringify({ template: rateVolRes?.data?.template, answer: rateVolRes?.data?.answer }))

      const purityRes = await page.evaluate(() => window.api.ai.query({ question: 'Give me the purity-adjusted exchange analytics' }))
      r.log('ai-purity-adjusted-exchange-intent-routed-correctly', purityRes?.data?.template === 'jewellery.purityAdjustedExchange', JSON.stringify({ template: purityRes?.data?.template, answer: purityRes?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'JEWELLERY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (jewelTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(jewelTemplateRowBefore.enabledModules, jewelTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('JEWELLERY', JSON.stringify(['ai_assistant']))
      }
    })
    // Jewellery-specific cleanup FIRST, in FK-dependency order — before
    // cleanupByNamePrefix's generic Customer/Product loops run, matching
    // every other Phase 67 suite's own custom-cleanup-before-generic-cleanup
    // convention this session established.
    h.withDb((db) => {
      const schemeIds = db.prepare(`SELECT gs.id FROM GoldSavingsScheme gs JOIN Customer c ON c.id = gs.customerId WHERE c.customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of schemeIds) {
        db.prepare('DELETE FROM GoldSavingsInstallment WHERE schemeId = ?').run(id)
        try { db.prepare('DELETE FROM GoldSavingsScheme WHERE id = ?').run(id) } catch { /* leave it */ }
      }
      const exchangeIds = db.prepare(`SELECT id FROM MetalExchange WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of exchangeIds) { try { db.prepare('DELETE FROM MetalExchange WHERE id = ?').run(id) } catch { /* leave it */ } }
      db.prepare("DELETE FROM MetalRateHistory WHERE metalType = 'GOLD' AND purity = '22K'").run()
      db.prepare("DELETE FROM MetalRate WHERE metalType = 'GOLD' AND purity = '22K'").run()
      // Known gotcha (see memory: "E2E Product Cleanup FK Gotcha") — the
      // generic cleanupByNamePrefix helper doesn't clear LocationStock/
      // InventoryMovement before deleting Product, so our two
      // real-stock products (openingQuantity: 5, then sold) silently fall
      // back to a soft-delete and leak. Cleared here first so the hard
      // delete below actually succeeds.
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
      }
      console.log('jewellery 67 extra cleanup:', JSON.stringify({ schemes: schemeIds.length, exchanges: exchangeIds.length, products: prodIds.length }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nJEWELLERY GOLD SAVINGS/MARGIN/HALLMARK/PURITY: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
