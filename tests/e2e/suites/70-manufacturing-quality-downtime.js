/**
 * Suite 70 — Manufacturing vertical, Phase 67 §9.1 items 1-5: machine/labour
 * downtime capture (item 1), true landed cost per finished unit report
 * (item 2), per-stage quality-rejection tracking (item 3), rejection rate
 * trend report (item 4), and the work-order lead-time bottleneck flag
 * (item 5). Real UI-driven work-order-step editing, QC quantity capture,
 * and downtime logging via ProductionOrdersScreen.tsx, plus both new
 * Reports tiles and all four new AI intents.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Mfg'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let mfgTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-manufacturing', async () => {
      const sw = await h.switchBusinessType(page, 'Manufacturing')
      r.log('business-type-switched-to-manufacturing', sw.to === 'MANUFACTURING', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type (opt-in via
    // Settings) — same gotcha Footwear item 3/4/5 already found. Enabled
    // directly here and restored exactly as found in cleanup, since this is
    // real shared dev-DB state.
    h.withDb((db) => {
      mfgTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('MANUFACTURING')
      if (mfgTemplateRowBefore) {
        const mods = new Set(JSON.parse(mfgTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), mfgTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'MANUFACTURING', JSON.stringify(['ai_assistant']))
      }
    })

    let rawMaterialId, productId

    await r.step('setup-raw-material-product-bom', async () => {
      const rmRes = await page.evaluate(async (prefix) => window.api.rawMaterials.create({
        name: `${prefix} Raw Material`, unit: 'KG', currentStock: 500, reorderLevel: 10, unitCost: 20,
      }), TEST_PREFIX)
      r.log('raw-material-created', !!rmRes?.success, JSON.stringify(rmRes?.error || ''))
      rawMaterialId = rmRes?.data?.id

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Gadget`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 80, sellingPrice: 150, taxRate: 18, openingQuantity: 0,
      }), TEST_PREFIX)
      r.log('product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
      productId = prodRes?.data?.id

      if (rawMaterialId && productId) {
        const bomRes = await page.evaluate(async ({ pid, rid }) => window.api.bom.upsert({
          productId: pid, outputQty: 1, items: [{ rawMaterialId: rid, quantityNeeded: 2 }],
        }), { pid: productId, rid: rawMaterialId })
        r.log('bom-created', !!bomRes?.success, JSON.stringify(bomRes?.error || ''))
      }
    })

    let orderId, orderNumber

    await r.step('create-and-start-production-order-via-api', async () => {
      if (!productId) return r.log('create-and-start-production-order-via-api', false, 'no productId captured')
      const createRes = await page.evaluate(async (pid) => window.api.production.create({ productId: pid, plannedQty: 10 }), productId)
      r.log('production-order-created', !!createRes?.success, JSON.stringify(createRes?.error || ''))
      orderId = createRes?.data?.id
      orderNumber = createRes?.data?.orderNumber

      if (orderId) {
        const startRes = await page.evaluate(async (id) => window.api.production.start({ id }), orderId)
        r.log('production-order-started', !!startRes?.success, JSON.stringify(startRes?.error || ''))
      }
    })

    // ─── Phase 67 §9.1 items 1+3: downtime capture + per-stage rejection ────
    let step1Id, step2Id

    await r.step('add-work-order-steps-via-real-ui-one-qc-checkpoint', async () => {
      if (!orderId) return r.log('add-work-order-steps-via-real-ui-one-qc-checkpoint', false, 'no orderId captured')

      await h.gotoHash(page, '#/manufacturing/production')
      await page.waitForTimeout(700)

      // The order card's onClick lives on the outer Card div, not a nested
      // button — clicking the order-number span inside it still bubbles up
      // and triggers openDetail() correctly.
      const orderCard = page.locator('span.font-mono', { hasText: orderNumber || '___no-match___' }).first()
      r.log('production-order-card-found-in-list', await orderCard.count() > 0)
      if (await orderCard.count()) await orderCard.click()
      await page.waitForTimeout(600)
      r.log('production-order-detail-opened-no-crash', !(await h.hasErrorBoundary(page)))

      const addStepsBtn = page.locator('button', { hasText: 'Add Steps' }).first()
      r.log('add-steps-button-present', await addStepsBtn.count() > 0)
      if (await addStepsBtn.count()) await addStepsBtn.click()
      await page.waitForTimeout(400)

      const modal = h.topModal(page)
      // Row 1 — ordinary step ("Mixing").
      await modal.getByPlaceholder('Step 1 name').fill('Mixing')
      // Add a second row and mark it as a QC checkpoint ("Final Inspection").
      await modal.locator('button', { hasText: 'Add Step' }).click()
      await page.waitForTimeout(200)
      await modal.getByPlaceholder('Step 2 name').fill('Final Inspection')
      const qcCheckbox = modal.locator('input[type="checkbox"]').last()
      await qcCheckbox.check()

      await modal.locator('button', { hasText: 'Save Steps' }).click()
      await page.waitForTimeout(1000)
      r.log('work-order-steps-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const woListRes = await page.evaluate(async (id) => window.api.workOrders.list({ productionOrderId: id }), orderId)
      const steps = woListRes?.data || []
      r.log('two-steps-created', steps.length === 2, JSON.stringify(steps.map((s) => ({ taskName: s.taskName, isQcStep: s.isQcStep }))))
      step1Id = steps.find((s) => s.taskName === 'Mixing')?.id
      step2Id = steps.find((s) => s.taskName === 'Final Inspection')?.id
      r.log('qc-step-correctly-flagged', !!steps.find((s) => s.taskName === 'Final Inspection' && s.isQcStep === true))
    })

    await r.step('log-downtime-on-a-step-via-real-ui', async () => {
      if (!step1Id) return r.log('log-downtime-on-a-step-via-real-ui', false, 'no step1Id captured')

      const downtimeBtn = page.locator('button', { hasText: '+ Downtime' }).first()
      r.log('downtime-button-present', await downtimeBtn.count() > 0)
      await downtimeBtn.click()
      await page.waitForTimeout(400)

      const modal = h.topModal(page)
      await modal.locator('input').nth(0).fill('Machine breakdown')
      await modal.locator('input[type="number"]').fill('45')
      await modal.locator('button', { hasText: 'Log Downtime' }).last().click()
      await page.waitForTimeout(800)
      r.log('downtime-logged-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async (id) => window.api.workOrders.listDowntime({ workOrderId: id }), step1Id)
      r.log('downtime-entry-persisted', !!listRes?.data?.find((e) => e.reason === 'Machine breakdown' && e.minutes === 45), JSON.stringify(listRes?.data))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('downtime-total-shown-on-step', bodyText.includes('45 min downtime logged'))
    })

    await r.step('mark-qc-step-done-with-rejection-quantity-via-real-ui', async () => {
      if (!step2Id) return r.log('mark-qc-step-done-with-rejection-quantity-via-real-ui', false, 'no step2Id captured')

      // The step row's status-toggle button is the FIRST button inside the
      // same row div as the step's own text — not a nested "hasText" match
      // on a button itself (the text lives in a sibling <p>, not the
      // button), same "don't match the wrong clickable ancestor" caution
      // this arc's own Button/Div Locator Gotcha memory already covers.
      const qcRow = page.locator('div.flex.items-center.gap-3', { hasText: 'Final Inspection' }).first()
      const toggleBtn = qcRow.locator('button').first()
      await toggleBtn.click()
      await page.waitForTimeout(500)

      const modal = h.topModal(page)
      r.log('qc-result-modal-opened', await modal.locator('text=Record QC Result').count() > 0)
      const numberInputs = modal.locator('input[type="number"]')
      await numberInputs.nth(0).fill('50') // qtyInspected
      await numberInputs.nth(1).fill('5')  // qtyRejected
      await modal.locator('button', { hasText: 'Pass' }).click()
      await page.waitForTimeout(800)
      r.log('qc-result-submitted-no-crash', !(await h.hasErrorBoundary(page)))

      const woListRes = await page.evaluate(async (id) => window.api.workOrders.list({ productionOrderId: id }), orderId)
      const qcStep = (woListRes?.data || []).find((s) => s.id === step2Id)
      r.log('qc-step-persisted-inspection-counts', qcStep?.qtyInspected === 50 && qcStep?.qtyRejected === 5, JSON.stringify(qcStep))
      r.log('qc-step-passed-overall-despite-some-rejects', qcStep?.qcResult === 'PASS')
    })

    await r.step('complete-production-order-via-api', async () => {
      if (!orderId) return r.log('complete-production-order-via-api', false, 'no orderId captured')
      const completeRes = await page.evaluate(async (id) => window.api.production.complete({ id, producedQty: 10, laborCost: 200 }), orderId)
      r.log('production-order-completed', !!completeRes?.success, JSON.stringify(completeRes?.error || ''))
    })

    // ─── Phase 67 §9.1 item 2: True Landed Cost per Finished Unit ───────────
    await r.step('landed-cost-per-unit-report-computes-and-renders-correctly', async () => {
      if (!productId) return r.log('landed-cost-per-unit-report-computes-and-renders-correctly', false, 'no productId captured')

      const now = new Date()
      const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      const reportRes = await page.evaluate((args) => window.api.reports.landedCostPerUnit(args), { dateFrom, dateTo })
      r.log('landed-cost-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.productId === productId)
      r.log('landed-cost-includes-our-product', !!row, JSON.stringify(row))
      if (row) {
        // Internal consistency, not a hardcoded exact number — material +
        // labour + overhead per unit must sum to the total per unit.
        r.log('landed-cost-math-is-consistent', Math.abs((row.materialCostPerUnit + row.laborCostPerUnit + row.overheadCostPerUnit) - row.totalCostPerUnit) < 0.01, JSON.stringify(row))
        // Labor cost was 200 for 10 units => 20/unit, exact and deterministic.
        r.log('landed-cost-labor-per-unit-is-exact', row.laborCostPerUnit === 20, JSON.stringify(row))
      }

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'True Landed Cost per Finished Unit' }).first()
      r.log('landed-cost-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('landed-cost-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('landed-cost-shows-our-product', bodyText.includes('E2E Mfg Gadget'))
        await h.shot(page, 'manufacturing-landed-cost-per-unit')
      }
    })

    // ─── Phase 67 §9.1 item 4: Rejection Rate Trend ──────────────────────────
    await r.step('rejection-rate-trend-report-computes-and-renders-correctly', async () => {
      const now = new Date()
      const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      const reportRes = await page.evaluate((args) => window.api.reports.rejectionRateTrend(args), { dateFrom, dateTo })
      r.log('rejection-trend-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const stage = (reportRes?.data?.byStage || []).find((s) => s.taskName === 'Final Inspection')
      r.log('rejection-trend-includes-our-qc-stage', !!stage, JSON.stringify(stage))
      // Lower bound, not exact — the dev DB may carry other QC steps from
      // earlier runs (same "consistency + lower bounds" convention this
      // whole arc has used for shared-scope reports).
      r.log('rejection-trend-stage-counts-at-least-our-inspection', (stage?.qtyInspected ?? 0) >= 50 && (stage?.qtyRejected ?? 0) >= 5)

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Rejection Rate Trend' }).first()
      r.log('rejection-trend-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('rejection-trend-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('rejection-trend-shows-our-stage', bodyText.includes('Final Inspection'))
        await h.shot(page, 'manufacturing-rejection-rate-trend')
      }
    })

    // ─── Phase 67 §9.1 item 5: work-order lead-time bottleneck flag ─────────
    await r.step('bottleneck-flag-computes-correctly-and-shows-as-a-banner', async () => {
      const flagRes = await page.evaluate(() => window.api.workOrders.bottleneckFlag({}))
      r.log('bottleneck-flag-api-succeeded', !!flagRes?.success, JSON.stringify(flagRes?.error || ''))
      r.log('bottleneck-flag-names-a-stage', !!flagRes?.data?.bottleneckStage, JSON.stringify(flagRes?.data))

      await h.gotoHash(page, '#/manufacturing/production')
      await page.waitForTimeout(900)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('bottleneck-banner-visible-on-production-orders-screen', bodyText.includes('slowest stage'), bodyText.slice(0, 400))
    })

    // ─── AI intents for all 4 new items ─────────────────────────────────────
    await r.step('ai-intents-route-correctly-for-all-four-new-items', async () => {
      const landedCostRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our landed cost per unit?' }))
      r.log('ai-landed-cost-intent-routed-correctly', landedCostRes?.data?.template === 'manufacturing.landedCostPerUnit', JSON.stringify({ template: landedCostRes?.data?.template, answer: landedCostRes?.data?.answer }))

      const rejectionRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our rejection rate?' }))
      r.log('ai-rejection-rate-intent-routed-correctly', rejectionRes?.data?.template === 'manufacturing.rejectionRateTrend', JSON.stringify({ template: rejectionRes?.data?.template, answer: rejectionRes?.data?.answer }))

      const downtimeRes = await page.evaluate(() => window.api.ai.query({ question: 'How much downtime did we have?' }))
      r.log('ai-downtime-intent-routed-correctly', downtimeRes?.data?.template === 'manufacturing.downtimeSummary', JSON.stringify({ template: downtimeRes?.data?.template, answer: downtimeRes?.data?.answer }))
      r.log('ai-downtime-answer-mentions-45-minutes', typeof downtimeRes?.data?.answer === 'string' && downtimeRes.data.answer.includes('45'), downtimeRes?.data?.answer)

      const bottleneckRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our bottleneck stage?' }))
      r.log('ai-bottleneck-intent-routed-correctly', bottleneckRes?.data?.template === 'manufacturing.bottleneckFlag', JSON.stringify({ template: bottleneckRes?.data?.template, answer: bottleneckRes?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'MANUFACTURING') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (mfgTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(mfgTemplateRowBefore.enabledModules, mfgTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('MANUFACTURING', JSON.stringify(['ai_assistant']))
      }
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      // Manual FK-ordered cleanup, same reasoning suite 03 already
      // established for this exact ProductionOrder/BOM/RawMaterial cluster
      // — none of this lives under the generic cleanupByNamePrefix helper.
      const orderIds = db.prepare(`SELECT id FROM ProductionOrder WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')`).all().map((row) => row.id)
      for (const oid of orderIds) {
        const woIds = db.prepare('SELECT id FROM WorkOrder WHERE productionOrderId = ?').all(oid).map((row) => row.id)
        for (const wid of woIds) {
          db.prepare('DELETE FROM WorkOrderDowntimeEntry WHERE workOrderId = ?').run(wid)
        }
        db.prepare('DELETE FROM WorkOrder WHERE productionOrderId = ?').run(oid)
        db.prepare('DELETE FROM ProductionMaterialUsage WHERE productionOrderId = ?').run(oid)
        db.prepare('DELETE FROM ProductionLaborEntry WHERE productionOrderId = ?').run(oid)
        try { db.prepare('DELETE FROM ProductionOrder WHERE id = ?').run(oid) } catch { /* leave it */ }
      }
      db.prepare(`DELETE FROM BillOfMaterialItem WHERE bomId IN (SELECT id FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'))`).run()
      db.prepare(`DELETE FROM BillOfMaterial WHERE productId IN (SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%')`).run()
      const rmIds = db.prepare(`SELECT id FROM RawMaterial WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const rid of rmIds) {
        try { db.prepare('DELETE FROM RawMaterial WHERE id = ?').run(rid) } catch { db.prepare('UPDATE RawMaterial SET isActive = 0 WHERE id = ?').run(rid) }
      }
      console.log('manufacturing extra cleanup:', JSON.stringify({ orders: orderIds.length, rawMaterials: rmIds.length }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nMANUFACTURING QUALITY/DOWNTIME: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
