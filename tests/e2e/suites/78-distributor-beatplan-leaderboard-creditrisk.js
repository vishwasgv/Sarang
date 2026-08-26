/**
 * Suite 78 — Distributor vertical, Phase 67 §9.1 items 2/3/5: Beat-Plan
 * Route Sequencing (Feature), Field-Rep Performance Leaderboard (Report),
 * and Auto Risk-Scored Retailer Credit (Feature). Item 4 (Scheme Cost vs.
 * Volume) was already closed in an earlier session (§3 of the completion
 * report); this suite closes the 3 remaining items and, with them, the
 * Distributor vertical.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E DST78'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let dstTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-distributor-business', async () => {
      const sw = await h.switchBusinessType(page, 'Distributor / Wholesale')
      r.log('business-type-switched', sw.to === 'DISTRIBUTOR', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      dstTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('DISTRIBUTOR')
      if (dstTemplateRowBefore) {
        const mods = new Set(JSON.parse(dstTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), dstTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'DISTRIBUTOR', JSON.stringify(['ai_assistant']))
      }
    })

    let customerAId, customerBId
    await r.step('setup-customers', async () => {
      const aRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer A`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerAId = aRes?.data?.id
      r.log('customer-a-created', !!customerAId, JSON.stringify(aRes?.error || ''))

      const bRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer B`, phone: `8${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerBId = bRes?.data?.id
      r.log('customer-b-created', !!customerBId, JSON.stringify(bRes?.error || ''))
    })

    // ─── Phase 67 §9.1 item 2: Beat-Plan Route Sequencing, real UI ─────────
    let beatId
    await r.step('create-beat-via-real-ui', async () => {
      await h.gotoHash(page, '#/distributor/beats')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Beat' }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const inputs = modal.locator('input')
      await inputs.nth(0).fill(`${TEST_PREFIX} North Route`)
      await inputs.nth(1).fill(`${TEST_PREFIX} Ravi`)
      await modal.locator('button', { hasText: 'Create' }).click()
      await page.waitForTimeout(1000)
      r.log('beat-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.distributor.listBeats())
      const beat = (listRes?.data || []).find((b) => b.name === `${TEST_PREFIX} North Route`)
      r.log('beat-findable-via-api', !!beat, JSON.stringify(beat))
      beatId = beat?.id
    })

    await r.step('add-and-reorder-stops-via-real-ui', async () => {
      if (!beatId) return r.log('add-and-reorder-stops-via-real-ui', false, 'no beat id')

      // Bounce through a different route so BeatPlansScreen remounts and
      // refetches — re-navigating to the SAME hash does not remount (same
      // gotcha this session already hit building Service/Repair's suites).
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/distributor/beats')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} North Route` }).first().click()
      await page.waitForTimeout(400)

      const select = page.locator('select').first()
      await select.selectOption({ label: `${TEST_PREFIX} Customer A` })
      await page.locator('button', { hasText: 'Add' }).first().click()
      await page.waitForTimeout(600)

      await select.selectOption({ label: `${TEST_PREFIX} Customer B` })
      await page.locator('button', { hasText: 'Add' }).first().click()
      await page.waitForTimeout(600)
      r.log('stops-added-no-crash', !(await h.hasErrorBoundary(page)))

      let beatRes = await page.evaluate(() => window.api.distributor.listBeats())
      let beat = (beatRes?.data || []).find((b) => b.name.includes('North Route'))
      r.log('stops-added-order-correct', beat?.stops?.[0]?.customerId === customerAId && beat?.stops?.[1]?.customerId === customerBId, JSON.stringify(beat?.stops))

      // Move Customer B (second stop) up — up-arrow buttons are the 2nd of
      // the 3 per-row action icons (up, down, remove).
      const rows = page.locator('ol li')
      await rows.nth(1).locator('button').nth(0).click()
      await page.waitForTimeout(600)

      beatRes = await page.evaluate(() => window.api.distributor.listBeats())
      beat = (beatRes?.data || []).find((b) => b.name.includes('North Route'))
      r.log('stop-reordered-via-real-ui', beat?.stops?.[0]?.customerId === customerBId && beat?.stops?.[1]?.customerId === customerAId, JSON.stringify(beat?.stops))
      await h.shot(page, 'distributor-beat-plan')
    })

    // ─── Phase 67 §9.1 item 3: Field-Rep Performance Leaderboard ───────────
    let productId
    await r.step('setup-product-and-two-pending-field-orders', async () => {
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Widget`, productType: 'STANDARD', sellingPrice: 500, unit: 'NOS', openingQuantity: 100,
      }), TEST_PREFIX)
      productId = prodRes?.data?.id
      r.log('product-created', !!productId, JSON.stringify(prodRes?.error || ''))

      if (productId && customerAId && customerBId) {
        h.withDb((db) => {
          const crypto = require('crypto')
          const reqAId = crypto.randomUUID()
          const reqBId = crypto.randomUUID()
          db.prepare('INSERT INTO FieldOrderRequest (id, repName, customerId, customerName, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
            .run(reqAId, `${TEST_PREFIX} Ravi`, customerAId, `${TEST_PREFIX} Customer A`, 'PENDING', Date.now())
          db.prepare('INSERT INTO FieldOrderRequestItem (id, requestId, productId, quantity) VALUES (?, ?, ?, ?)')
            .run(crypto.randomUUID(), reqAId, productId, 4)
          db.prepare('INSERT INTO FieldOrderRequest (id, repName, customerId, customerName, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
            .run(reqBId, `${TEST_PREFIX} Asha`, customerBId, `${TEST_PREFIX} Customer B`, 'PENDING', Date.now())
          db.prepare('INSERT INTO FieldOrderRequestItem (id, requestId, productId, quantity) VALUES (?, ?, ?, ?)')
            .run(crypto.randomUUID(), reqBId, productId, 1)
        })
        r.log('two-pending-field-orders-seeded', true)
      }
    })

    await r.step('accept-both-field-orders-via-real-ui', async () => {
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/distributor/field-orders')
      await page.waitForTimeout(700)

      for (let i = 0; i < 2; i++) {
        const acceptBtn = page.locator('button', { hasText: 'Accept' }).first()
        if (await acceptBtn.count()) {
          await acceptBtn.click()
          await page.waitForTimeout(400)
          const modal = h.topModal(page)
          await modal.locator('button', { hasText: 'Confirm & Bill' }).click()
          await page.waitForTimeout(1200)
        }
      }
      r.log('field-orders-accepted-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.distributor.listFieldOrderRequests({ status: 'ACCEPTED' }))
      const ours = (listRes?.data || []).filter((req) => req.repName?.startsWith(TEST_PREFIX))
      r.log('both-field-orders-accepted', ours.length === 2 && ours.every((req) => !!req.invoiceId), JSON.stringify(ours.map((o) => ({ repName: o.repName, invoiceId: o.invoiceId }))))
    })

    await r.step('field-rep-leaderboard-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.fieldRepLeaderboard(p), { dateFrom, dateTo })
      r.log('leaderboard-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))

      const raviRow = (reportRes?.data?.rows || []).find((rr) => rr.repName === `${TEST_PREFIX} Ravi`)
      const ashaRow = (reportRes?.data?.rows || []).find((rr) => rr.repName === `${TEST_PREFIX} Asha`)
      r.log('leaderboard-rows-have-orders-and-value', raviRow?.ordersBooked === 1 && raviRow?.totalValue > 0 && ashaRow?.ordersBooked === 1 && ashaRow?.totalValue > 0, JSON.stringify({ raviRow, ashaRow }))
      // Ravi's order was 4 units vs Asha's 1 unit, so Ravi's value is higher — best-first sort means Ravi ranks above Asha.
      const raviIdx = (reportRes?.data?.rows || []).findIndex((rr) => rr.repName === `${TEST_PREFIX} Ravi`)
      const ashaIdx = (reportRes?.data?.rows || []).findIndex((rr) => rr.repName === `${TEST_PREFIX} Asha`)
      r.log('leaderboard-sorted-best-first-by-value', raviIdx >= 0 && ashaIdx >= 0 && raviIdx < ashaIdx, JSON.stringify({ raviIdx, ashaIdx }))
      // Ravi's beat plan has Customer A and B as active stops (from the earlier step) and Ravi's own request visited Customer A — hit-rate should be 50%.
      r.log('leaderboard-hit-rate-computed-from-active-beat', raviRow?.plannedStops === 2 && raviRow?.hitRatePercent === 50, JSON.stringify(raviRow))
      // Asha has no active beat at all -> null, not 0%.
      r.log('leaderboard-null-hitrate-for-rep-with-no-beat', ashaRow?.plannedStops === null && ashaRow?.hitRatePercent === null, JSON.stringify(ashaRow))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Field-Rep Leaderboard' }).first()
      r.log('leaderboard-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('leaderboard-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('leaderboard-shows-our-rep', bodyText.includes(`${TEST_PREFIX} Ravi`), bodyText.slice(0, 2000))
        await h.shot(page, 'distributor-field-rep-leaderboard')
      }
    })

    // ─── Phase 67 §9.1 item 5: Auto Risk-Scored Retailer Credit ────────────
    let riskCustomerId
    await r.step('setup-high-risk-customer-with-overdue-invoice', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Risky Retailer`, phone: `7${String(Date.now()).slice(-9)}`, creditLimit: 1000,
      }), TEST_PREFIX)
      riskCustomerId = custRes?.data?.id
      r.log('risk-customer-created', !!riskCustomerId && custRes?.data?.creditLimit === 1000, JSON.stringify(custRes?.error || custRes?.data))

      if (riskCustomerId) {
        const overdueDueDate = h.toLocalISODate(new Date(Date.now() - 45 * 86400000))
        const invRes = await page.evaluate(async ({ customerId, dueDate, productId }) => window.api.billing.createInvoice({
          customerId, paymentMethod: 'CREDIT', dueDate,
          items: [{ productId, quantity: 1, unitPrice: 400, discountAmount: 0, taxRate: 0 }],
          globalDiscount: 0,
        }), { customerId: riskCustomerId, dueDate: overdueDueDate, productId })
        r.log('overdue-setup-invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))
      }
    })

    await r.step('credit-risk-tier-and-effective-limit-computed-correctly', async () => {
      if (!riskCustomerId) return r.log('credit-risk-tier-and-effective-limit-computed-correctly', false, 'no risk customer id')
      const riskRes = await page.evaluate((customerId) => window.api.distributor.getCustomerCreditRisk({ customerId }), riskCustomerId)
      r.log('credit-risk-api-succeeded', !!riskRes?.success, JSON.stringify(riskRes?.error || ''))
      // maxOverdueDays ~45 > 30 -> HIGH tier -> 0.5x multiplier -> effective limit 500.
      r.log('credit-risk-tier-is-high-with-halved-limit', riskRes?.data?.riskTier === 'HIGH' && riskRes?.data?.effectiveCreditLimit === 500, JSON.stringify(riskRes?.data))
    })

    await r.step('billing-enforcement-uses-risk-adjusted-limit-not-static-limit', async () => {
      if (!riskCustomerId || !productId) return r.log('billing-enforcement-uses-risk-adjusted-limit-not-static-limit', false, 'missing setup')
      // Outstanding is now 400 (from the setup invoice). A further 200
      // CREDIT sale projects to 600 — UNDER the static 1000 limit, but OVER
      // the risk-adjusted 500 effective limit. This is the real proof the
      // risk adjustment changes actual enforcement behaviour, not just a
      // cosmetic UI figure.
      const saleRes = await page.evaluate(async ({ customerId, productId }) => window.api.billing.createInvoice({
        customerId, paymentMethod: 'CREDIT',
        items: [{ productId, quantity: 1, unitPrice: 200, discountAmount: 0, taxRate: 0 }],
        globalDiscount: 0,
      }), { customerId: riskCustomerId, productId })
      r.log('over-risk-adjusted-limit-sale-blocked', saleRes?.success === false && saleRes?.error?.code === 'CUST-003', JSON.stringify(saleRes?.error))
      r.log('block-message-mentions-risk-adjustment', (saleRes?.error?.message || '').toLowerCase().includes('risk-adjusted'), saleRes?.error?.message)
    })

    await r.step('customer-detail-screen-shows-risk-tier-and-effective-limit', async () => {
      if (!riskCustomerId) return r.log('customer-detail-screen-shows-risk-tier-and-effective-limit', false, 'no risk customer id')
      await h.gotoHash(page, `#/customers/${riskCustomerId}`)
      await page.waitForTimeout(900)
      r.log('customer-detail-renders-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('customer-detail-shows-high-risk-badge', bodyText.includes('High Risk'), bodyText.slice(0, 2000))
      r.log('customer-detail-shows-effective-limit', bodyText.includes('500.00') || bodyText.includes('500'), bodyText.slice(0, 2000))
      await h.shot(page, 'distributor-customer-credit-risk')
    })

    // ─── AI intents for items 2/3/5 ─────────────────────────────────────────
    await r.step('ai-intents-route-correctly-for-distributor-items', async () => {
      const leaderboardRes = await page.evaluate(() => window.api.ai.query({ question: 'Which field rep has the best performance this month?' }))
      r.log('ai-leaderboard-intent-routed-correctly', leaderboardRes?.data?.template === 'distributor.fieldRepLeaderboard', JSON.stringify({ template: leaderboardRes?.data?.template, answer: leaderboardRes?.data?.answer }))

      const riskRes = await page.evaluate(() => window.api.ai.query({ question: 'Which retailers are high credit risk right now?' }))
      r.log('ai-creditrisk-intent-routed-correctly', riskRes?.data?.template === 'distributor.creditRiskOverview', JSON.stringify({ template: riskRes?.data?.template, answer: riskRes?.data?.answer }))
      r.log('ai-creditrisk-answer-mentions-our-customer', (riskRes?.data?.answer || '').includes('Risky Retailer') || (riskRes?.data?.answer || '').includes('HIGH'), riskRes?.data?.answer)
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'DISTRIBUTOR') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (dstTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(dstTemplateRowBefore.enabledModules, dstTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('DISTRIBUTOR', JSON.stringify(['ai_assistant']))
      }
    })
    // Distributor-specific cleanup FIRST, in FK-dependency order — before
    // cleanupByNamePrefix's generic Customer/Product loops run, matching
    // every other Phase 67 suite's own custom-cleanup-before-generic-
    // cleanup convention this session established.
    h.withDb((db) => {
      const beatIds = db.prepare(`SELECT id FROM DistributorBeat WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let stopsRemoved = 0
      for (const bid of beatIds) {
        const info = db.prepare('DELETE FROM DistributorBeatStop WHERE beatId = ?').run(bid)
        stopsRemoved += info.changes
      }
      const beatsInfo = db.prepare(`DELETE FROM DistributorBeat WHERE name LIKE '${TEST_PREFIX}%'`).run()

      const reqIds = db.prepare(`SELECT id FROM FieldOrderRequest WHERE repName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let itemsRemoved = 0
      for (const rid of reqIds) {
        const info = db.prepare('DELETE FROM FieldOrderRequestItem WHERE requestId = ?').run(rid)
        itemsRemoved += info.changes
      }
      const reqsInfo = db.prepare(`DELETE FROM FieldOrderRequest WHERE repName LIKE '${TEST_PREFIX}%'`).run()

      // Known "E2E Product Cleanup FK Gotcha" — LocationStock/
      // InventoryMovement must be cleared before a real-stock Product can
      // hard-delete, or the generic cleanup helper silently soft-deletes.
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
      }
      console.log('distributor 67 extra cleanup:', JSON.stringify({ beats: beatsInfo.changes, stopsRemoved, fieldOrderRequests: reqsInfo.changes, itemsRemoved, products: prodIds.length }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDISTRIBUTOR BEAT-PLAN/LEADERBOARD/CREDIT-RISK: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
