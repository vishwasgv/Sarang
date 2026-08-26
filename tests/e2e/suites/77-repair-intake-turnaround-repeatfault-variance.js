/**
 * Suite 77 — Repair vertical, Phase 67 §9.1 items 1-5: Structured Intake
 * Checklist (Feature), Turnaround by Technician (Report), Repeat-Fault Flag
 * (Feature), Repair Category Volume Trend (Report), and Parts-Used-vs-
 * Quoted Variance (Feature). No pre-existing suite drives REPAIR at all —
 * this suite reuses the API for baseline job-card lifecycle setup (status
 * transitions, delivery) and focuses real UI interaction on the FIVE NEW
 * capabilities, closing out Phase 67's 3-vertical Legacy Generic Service
 * cluster (Service, Consultant, Repair).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E RPR77'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let rprTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-repair-business', async () => {
      const sw = await h.switchBusinessType(page, 'Repair Shop / Service Centre')
      r.log('business-type-switched', sw.to === 'REPAIR', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      rprTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('REPAIR')
      if (rprTemplateRowBefore) {
        const mods = new Set(JSON.parse(rprTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), rprTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'REPAIR', JSON.stringify(['ai_assistant']))
      }
    })

    let customerId, technicianUserId
    await r.step('setup-customer-and-technician', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))

      const usersRes = await page.evaluate(() => window.api.users.list())
      technicianUserId = (usersRes?.data || [])[0]?.id
      r.log('technician-user-available', !!technicianUserId)
    })

    // ─── Baseline: a FIRST job card, delivered and backdated via API, so
    // the SECOND job (created via real UI below) has a real prior delivery
    // to be flagged against. ─────────────────────────────────────────────
    let firstJobId
    await r.step('setup-a-prior-delivered-job-for-the-same-item', async () => {
      const createRes = await page.evaluate(async ({ prefix, customerId }) => window.api.jobCards.create({
        title: `${prefix} First Repair`, itemDescription: `${prefix} Laptop Screen`, customerId,
      }), { prefix: TEST_PREFIX, customerId })
      firstJobId = createRes?.data?.id
      r.log('first-job-created', !!firstJobId, JSON.stringify(createRes?.error || ''))

      if (firstJobId) {
        const deliverRes = await page.evaluate((id) => window.api.jobCards.update({ id, status: 'DELIVERED' }), firstJobId)
        r.log('first-job-delivered', !!deliverRes?.success, JSON.stringify(deliverRes?.error || ''))

        // Epoch-ms INTEGER, not ISO text — the known DateTime-storage
        // gotcha for direct-DB backdating in this SQLite database (see
        // memory: feedback_e2e_datetime_backdate_and_stale_hash_nav).
        h.withDb((db) => {
          const received = Date.now() - 10 * 86400000
          const delivered = Date.now() - 8 * 86400000
          db.prepare('UPDATE JobCard SET receivedDate = ?, deliveredDate = ? WHERE id = ?').run(received, delivered, firstJobId)
        })
      }
    })

    // ─── Phase 67 §9.1 item 1: Structured Intake Checklist, real UI ────────
    let secondJobId
    await r.step('create-second-job-via-real-ui-with-intake-checklist', async () => {
      await h.gotoHash(page, '#/service/job-cards')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Job Card' }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)

      // Most text inputs in this modal have no htmlFor/id label association
      // (only the <Select> fields do) — located positionally instead. Order
      // in the JSX: title(0), itemDescription(1), estCost(2), conditionOnArrival(3),
      // accessoriesReceived(4), category(5), quotedPartsTotal(6), expectedDate(7).
      const inputs = modal.locator('input')
      await inputs.nth(0).fill(`${TEST_PREFIX} Second Repair`)
      await inputs.nth(1).fill(`${TEST_PREFIX} Laptop Screen`) // same itemDescription as the first job
      await inputs.nth(3).fill('Cracked screen, minor scratches on the back panel')
      await inputs.nth(4).fill('Charger, original box')
      await inputs.nth(5).fill(`${TEST_PREFIX} Screen Repair`)
      await inputs.nth(6).fill('1500')
      await modal.getByLabel('Customer').selectOption({ label: `${TEST_PREFIX} Customer` })
      if (technicianUserId) {
        const assignSelect = modal.getByLabel('Assign To')
        if (await assignSelect.count()) await assignSelect.selectOption({ value: technicianUserId })
      }

      await modal.locator('button', { hasText: 'New Job Card' }).click()
      await page.waitForTimeout(1000)
      r.log('second-job-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.jobCards.list({}))
      const job = (listRes?.data?.jobCards || []).find((j) => j.title === `${TEST_PREFIX} Second Repair`)
      r.log('second-job-findable-via-api', !!job, JSON.stringify(job))
      secondJobId = job?.id
      r.log('intake-fields-persisted', job?.conditionOnArrival === 'Cracked screen, minor scratches on the back panel' && job?.accessoriesReceived === 'Charger, original box' && job?.category === `${TEST_PREFIX} Screen Repair` && job?.quotedPartsTotal === 1500, JSON.stringify(job))
    })

    // ─── Phase 67 §9.1 item 3: Repeat-Fault Flag ────────────────────────────
    await r.step('repeat-fault-flag-shown-on-list-and-detail', async () => {
      if (!secondJobId) return r.log('repeat-fault-flag-shown-on-list-and-detail', false, 'no second job id')
      const listRes = await page.evaluate(() => window.api.jobCards.list({}))
      const job = (listRes?.data?.jobCards || []).find((j) => j.id === secondJobId)
      r.log('repeat-fault-flagged-via-api', job?.isRepeatFault === true, JSON.stringify(job))

      // Bounce through a different route so JobCardsScreen remounts and
      // refetches — re-navigating to the SAME hash does not remount (same
      // gotcha this session already hit building Service's own suite).
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/service/job-cards')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('list-shows-repeat-fault-badge', bodyText.includes('Repeat Fault'), bodyText.slice(0, 1000))

      await page.locator('button', { hasText: `${TEST_PREFIX} Second Repair` }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const modalText = await modal.innerText().catch(() => '')
      r.log('detail-shows-repeat-fault-banner', modalText.includes('Repeat Fault') && modalText.includes('repeat fault'), modalText.slice(0, 1200))
      await h.shot(page, 'repair-repeat-fault')
    })

    // ─── Phase 67 §9.1 item 5: Parts-Used-vs-Quoted Variance ───────────────
    await r.step('add-real-parts-and-verify-variance-on-detail', async () => {
      if (!secondJobId) return r.log('add-real-parts-and-verify-variance-on-detail', false, 'no second job id')
      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Replacement Screen`, productType: 'STANDARD', sellingPrice: 2000, unit: 'NOS', openingQuantity: 5,
      }), TEST_PREFIX)
      const productId = prodRes?.data?.id
      r.log('part-product-created', !!productId, JSON.stringify(prodRes?.error || ''))

      // detail modal should already be open from the previous step; if not, open it.
      let modal = h.topModal(page)
      if (!(await modal.locator('button', { hasText: 'Add Part' }).count())) {
        await page.locator('button', { hasText: `${TEST_PREFIX} Second Repair` }).first().click()
        await page.waitForTimeout(400)
        modal = h.topModal(page)
      }
      const partSearch = modal.locator('input[placeholder*="Search"]').first()
      await partSearch.fill(`${TEST_PREFIX} Replacement Screen`)
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: `${TEST_PREFIX} Replacement Screen` }).first().click()
      await page.waitForTimeout(300)
      await modal.locator('button', { hasText: 'Add Part' }).click()
      await page.waitForTimeout(1000)
      r.log('part-added-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.jobCards.list({}))
      const job = (listRes?.data?.jobCards || []).find((j) => j.id === secondJobId)
      // quoted 1500, actual 1 x 2000 = 2000 -> variance +500 (over quote)
      r.log('parts-variance-computed-correctly', job?.actualPartsTotal === 2000 && job?.partsVariance === 500, JSON.stringify(job))

      // Close and reopen the detail modal fresh — a clean remount guards
      // against reading mid-render DOM right after the Add Part state
      // update, rather than assuming the still-open modal has already
      // settled.
      await modal.locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(400)
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/service/job-cards')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Second Repair` }).first().click()
      await page.waitForTimeout(600)
      const freshModal = h.topModal(page)
      const modalText = await freshModal.innerText().catch(() => '')
      r.log('detail-shows-parts-variance', /\+.*500|500.*\+/.test(modalText.replace(/\s/g, '')) || modalText.includes('Parts Variance'), modalText.slice(0, 1500))
      await h.shot(page, 'repair-parts-variance')
    })

    // ─── Advance the second job through to DELIVERED via real UI, so the
    // Turnaround by Technician report has a real row too. ──────────────────
    await r.step('advance-second-job-to-delivered-via-real-ui', async () => {
      if (!secondJobId) return r.log('advance-second-job-to-delivered-via-real-ui', false, 'no second job id')
      let modal = h.topModal(page)
      if (!(await modal.count())) {
        await page.locator('button', { hasText: `${TEST_PREFIX} Second Repair` }).first().click()
        await page.waitForTimeout(400)
        modal = h.topModal(page)
      }
      // RECEIVED -> DIAGNOSING -> IN_REPAIR -> READY -> DELIVERED
      for (const label of ['Diagnosing', 'In Repair', 'Ready', 'Delivered']) {
        const btn = modal.locator('button', { hasText: label }).last()
        if (await btn.count()) {
          await btn.click()
          await page.waitForTimeout(700)
        }
      }
      r.log('second-job-advanced-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.jobCards.list({}))
      const job = (listRes?.data?.jobCards || []).find((j) => j.id === secondJobId)
      r.log('second-job-delivered', job?.status === 'DELIVERED', JSON.stringify(job))
    })

    // ─── Phase 67 §9.1 item 2: Turnaround by Technician ─────────────────────
    await r.step('turnaround-by-technician-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.jobCardTurnaroundByTechnician(p), { dateFrom, dateTo })
      r.log('turnaround-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      r.log('turnaround-summary-has-delivered-jobs', (reportRes?.data?.summary?.totalDelivered ?? 0) >= 1, JSON.stringify(reportRes?.data?.summary))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Turnaround by Technician' }).first()
      r.log('turnaround-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('turnaround-renders-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'repair-turnaround-by-technician')
      }
    })

    // ─── Phase 67 §9.1 item 4: Repair Category Volume Trend ────────────────
    await r.step('category-volume-trend-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.repairCategoryVolumeTrend(p), { dateFrom, dateTo })
      r.log('category-trend-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.category === `${TEST_PREFIX} Screen Repair`)
      r.log('category-trend-row-has-our-category', !!row && row.count >= 1, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Repair Category Volume Trend' }).first()
      r.log('category-trend-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('category-trend-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('category-trend-shows-our-category', bodyText.includes(`${TEST_PREFIX} Screen Repair`), bodyText.slice(0, 2000))
        await h.shot(page, 'repair-category-volume-trend')
      }
    })

    // ─── AI intents for all 5 items (incl. the pre-existing repair.jobCards) ─
    await r.step('ai-intents-route-correctly-for-repair-items', async () => {
      const jcRes = await page.evaluate(() => window.api.ai.query({ question: 'How many job cards do we have?' }))
      r.log('ai-jobcards-intent-routed-correctly', jcRes?.data?.template === 'repair.jobCards', JSON.stringify({ template: jcRes?.data?.template, answer: jcRes?.data?.answer }))

      const turnRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our turnaround by technician?' }))
      r.log('ai-turnaround-intent-routed-correctly', turnRes?.data?.template === 'repair.turnaroundByTechnician', JSON.stringify({ template: turnRes?.data?.template, answer: turnRes?.data?.answer }))

      const repeatRes = await page.evaluate(() => window.api.ai.query({ question: 'Do we have any repeat faults?' }))
      r.log('ai-repeat-fault-intent-routed-correctly', repeatRes?.data?.template === 'repair.repeatFault', JSON.stringify({ template: repeatRes?.data?.template, answer: repeatRes?.data?.answer }))

      const catRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our repair category volume trend?' }))
      r.log('ai-category-trend-intent-routed-correctly', catRes?.data?.template === 'repair.categoryVolumeTrend', JSON.stringify({ template: catRes?.data?.template, answer: catRes?.data?.answer }))

      const varRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our parts variance?' }))
      r.log('ai-parts-variance-intent-routed-correctly', varRes?.data?.template === 'repair.partsVariance', JSON.stringify({ template: varRes?.data?.template, answer: varRes?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'REPAIR') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (rprTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(rprTemplateRowBefore.enabledModules, rprTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('REPAIR', JSON.stringify(['ai_assistant']))
      }
    })
    // Repair-specific cleanup FIRST, in FK-dependency order — before
    // cleanupByNamePrefix's generic Customer/Product loops run, matching
    // every other Phase 67 suite's own custom-cleanup-before-generic-
    // cleanup convention this session established.
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let jobsRemoved = 0; let partsRemoved = 0
      for (const cid of custIds) {
        const jobIds = db.prepare('SELECT id FROM JobCard WHERE customerId = ?').all(cid).map((row) => row.id)
        for (const jid of jobIds) {
          const pInfo = db.prepare('DELETE FROM JobCardPart WHERE jobCardId = ?').run(jid)
          partsRemoved += pInfo.changes
        }
        const jInfo = db.prepare('DELETE FROM JobCard WHERE customerId = ?').run(cid)
        jobsRemoved += jInfo.changes
      }
      const strayInfo = db.prepare(`DELETE FROM JobCard WHERE title LIKE '${TEST_PREFIX}%'`).run()
      jobsRemoved += strayInfo.changes
      // Known "E2E Product Cleanup FK Gotcha" — LocationStock/
      // InventoryMovement must be cleared before a real-stock Product can
      // hard-delete, or the generic cleanup helper silently soft-deletes.
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
      }
      console.log('repair 67 extra cleanup:', JSON.stringify({ customers: custIds.length, jobsRemoved, partsRemoved, products: prodIds.length }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nREPAIR INTAKE/TURNAROUND/REPEATFAULT/VARIANCE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
