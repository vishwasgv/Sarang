/**
 * Suite 76 — Consultant vertical, Phase 67 §9.1 items 1-5: Engagement-Letter
 * -> Project Auto-Conversion (Feature), Utilization Rate (Report), Retainer
 * Burn-Down Tracker (Feature — reuses INDEPENDENT_CONSULTANT's own pre-built
 * Retainers/Time Tracking infrastructure, newly enabled for this vertical),
 * Client Profitability (Report), and Proposal Win-Rate Tracking (Feature).
 * No pre-existing suite drives the legacy generic CONSULTANT business type
 * at all — this suite reuses the API for baseline setup (work-log hours,
 * invoicing) and focuses real UI interaction on the FIVE NEW capabilities.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CNS76'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let cnsTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-consultant-business', async () => {
      const sw = await h.switchBusinessType(page, 'Consultant / Freelancer')
      r.log('business-type-switched', sw.to === 'CONSULTANT', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      cnsTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('CONSULTANT')
      if (cnsTemplateRowBefore) {
        const mods = new Set(JSON.parse(cnsTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), cnsTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'CONSULTANT', JSON.stringify(['ai_assistant']))
      }
    })

    let customerId
    await r.step('setup-customer', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    // ─── Phase 67 §9.1 item 1: Engagement-Letter -> Project Conversion ─────
    let acceptedQuotationId, acceptedQuotationNumber, draftQuotationId, projectId
    await r.step('setup-quotations-accepted-and-draft', async () => {
      const acceptedRes = await page.evaluate(async ({ prefix, customerId }) => {
        const created = await window.api.quotations.create({
          customerId, items: [{ productName: `${prefix} Engagement`, quantity: 1, unitPrice: 60000 }],
        })
        if (!created.success) return created
        return window.api.quotations.updateStatus({ id: created.data.id, status: 'ACCEPTED' })
      }, { prefix: TEST_PREFIX, customerId })
      r.log('accepted-quotation-created', !!acceptedRes?.success, JSON.stringify(acceptedRes?.error || ''))
      acceptedQuotationId = acceptedRes?.data?.id
      acceptedQuotationNumber = acceptedRes?.data?.quotationNumber

      const draftRes = await page.evaluate(async ({ prefix, customerId }) => window.api.quotations.create({
        customerId, items: [{ productName: `${prefix} Draft Estimate`, quantity: 1, unitPrice: 20000 }],
      }), { prefix: TEST_PREFIX, customerId })
      r.log('draft-quotation-created', !!draftRes?.success, JSON.stringify(draftRes?.error || ''))
      draftQuotationId = draftRes?.data?.id
    })

    await r.step('convert-accepted-quotation-to-project-via-real-ui', async () => {
      if (!acceptedQuotationId) return r.log('convert-accepted-quotation-to-project-via-real-ui', false, 'no accepted quotation')
      await h.gotoHash(page, '#/service/projects')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Project' }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('input').nth(0).fill(`${TEST_PREFIX} Engagement Project`)
      await modal.getByLabel('Customer').selectOption({ label: `${TEST_PREFIX} Customer` })
      const quoteSelect = modal.getByLabel('Convert From Quotation')
      r.log('convert-from-quotation-dropdown-present', await quoteSelect.count() > 0)
      if (await quoteSelect.count()) {
        await quoteSelect.selectOption({ value: acceptedQuotationId })
      }
      // The header button, modal title, AND submit button all share the
      // same i18n key ('service.newProjectModal' = "New Project") — the
      // submit button is the only one of those three that is a <button>
      // element inside the modal.
      await modal.locator('button', { hasText: 'New Project' }).click()
      await page.waitForTimeout(1000)
      r.log('project-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.projects.list({}))
      const project = (listRes?.data?.projects || []).find((p) => p.title === `${TEST_PREFIX} Engagement Project`)
      r.log('project-links-quotation', project?.quotationId === acceptedQuotationId, JSON.stringify(project))
      projectId = project?.id

      if (projectId) {
        // Bounce through a different route so ProjectsScreen remounts and
        // its own load() refetches fresh state (see memory: gotoHash to the
        // SAME hash doesn't remount, same gotcha this session already hit
        // building Service's own suite).
        await h.gotoHash(page, '#/dashboard')
        await page.waitForTimeout(300)
        await h.gotoHash(page, '#/service/projects')
        await page.waitForTimeout(700)
        await page.locator('button', { hasText: `${TEST_PREFIX} Engagement Project` }).first().click()
        await page.waitForTimeout(400)
        const modal2 = h.topModal(page)
        const modalText = await modal2.innerText().catch(() => '')
        r.log('detail-view-shows-converted-from-quotation', modalText.includes('Converted From Quotation') && acceptedQuotationNumber && modalText.includes(acceptedQuotationNumber), modalText.slice(0, 800))
        await modal2.locator('button', { hasText: '×' }).first().click().catch(() => {})
        await page.waitForTimeout(300)
      }
    })

    await r.step('quotation-conversion-guards-enforced-via-api', async () => {
      if (acceptedQuotationId) {
        const doubleRes = await page.evaluate((p) => window.api.projects.create({ title: `${p.prefix} double convert attempt`, quotationId: p.qid }), { prefix: TEST_PREFIX, qid: acceptedQuotationId })
        r.log('double-conversion-rejected', doubleRes?.success === false && doubleRes?.error?.code === 'PRJ-011', JSON.stringify(doubleRes?.error))
      }
      if (draftQuotationId) {
        const draftAttempt = await page.evaluate((p) => window.api.projects.create({ title: `${p.prefix} draft convert attempt`, quotationId: p.qid }), { prefix: TEST_PREFIX, qid: draftQuotationId })
        r.log('non-accepted-quotation-rejected', draftAttempt?.success === false && draftAttempt?.error?.code === 'PRJ-010', JSON.stringify(draftAttempt?.error))
      }

      const statsRes = await page.evaluate(() => window.api.projects.getProposalWinRateStats())
      r.log('win-rate-stats-api-succeeded', !!statsRes?.success, JSON.stringify(statsRes?.error || ''))
      r.log('win-rate-stats-counts-our-proposals', (statsRes?.data?.totalProposals ?? 0) >= 2, JSON.stringify(statsRes?.data))
    })

    // ─── Phase 67 §9.1 item 5: Proposal Win-Rate, real UI header stat ──────
    await r.step('projects-header-shows-proposal-win-rate', async () => {
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/service/projects')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('header-shows-proposal-win-rate-text', /\d+(\.\d+)?%\s*proposal win rate/i.test(bodyText), bodyText.slice(0, 400))
      await h.shot(page, 'consultant-projects-win-rate')
    })

    // ─── Log billable work against the project (baseline via API — Work
    // Tracking itself is pre-existing, not part of this phase's new items;
    // real UI is reserved for the genuinely new capabilities). ─────────────
    await r.step('log-billable-and-non-billable-work-then-invoice-the-project', async () => {
      if (!projectId) return r.log('log-billable-and-non-billable-work-then-invoice-the-project', false, 'no project id')
      const log1 = await page.evaluate((pid) => window.api.workLogs.create({
        projectId: pid, title: 'Strategy workshop', hours: 8, billable: true,
      }), projectId)
      const log2 = await page.evaluate((pid) => window.api.workLogs.create({
        projectId: pid, title: 'Internal admin', hours: 2, billable: false,
      }), projectId)
      r.log('worklogs-created', !!log1?.success && !!log2?.success, JSON.stringify({ e1: log1?.error, e2: log2?.error }))

      const invRes = await page.evaluate((pid) => window.api.projects.update({ id: pid, estimatedAmount: 60000 }), projectId)
      r.log('project-amount-set', !!invRes?.success, JSON.stringify(invRes?.error || ''))
      const genRes = await page.evaluate((pid) => window.api.projects.generateInvoice({ id: pid }), projectId)
      r.log('project-invoiced', !!genRes?.success, JSON.stringify(genRes?.error || ''))
    })

    // ─── Phase 67 §9.1 item 2: Utilization Rate ─────────────────────────────
    await r.step('utilization-rate-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.consultantUtilization(p), { dateFrom, dateTo })
      r.log('utilization-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.billableHours >= 8)
      r.log('utilization-row-has-our-hours', !!row, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Utilization Rate' }).first()
      r.log('utilization-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('utilization-renders-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'consultant-utilization')
      }
    })

    // ─── Phase 67 §9.1 item 4: Client Profitability ─────────────────────────
    await r.step('client-profitability-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.clientProfitability(p), { dateFrom, dateTo })
      r.log('client-profitability-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.customerName === `${TEST_PREFIX} Customer`)
      // revenue is the real invoice total, which includes GST on top of the
      // 60000 estimatedAmount — assert it's at least that, not an exact
      // tax-inclusive figure this test shouldn't need to hardcode.
      r.log('client-profitability-row-has-our-revenue-and-hours', (row?.revenue ?? 0) >= 60000 && row?.hoursSpent === 10, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Client Profitability' }).first()
      r.log('client-profitability-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('client-profitability-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('client-profitability-shows-our-customer', bodyText.includes(`${TEST_PREFIX} Customer`), bodyText.slice(0, 1500))
        await h.shot(page, 'consultant-client-profitability')
      }
    })

    // ─── Phase 67 §9.1 item 3: Retainer Burn-Down Tracker, real UI ─────────
    let retainerId
    await r.step('run-a-retainer-lifecycle-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/retainers')
      await page.waitForTimeout(700)
      r.log('retainers-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'New Retainer' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const custSearch = modal.locator('input[placeholder*="Search"]').first()
      await custSearch.fill(`${TEST_PREFIX} Customer`)
      await page.waitForTimeout(700)
      await modal.locator('button', { hasText: `${TEST_PREFIX} Customer` }).first().click()
      await page.waitForTimeout(300)

      // Title input has no accessible label — located via its own
      // placeholder text instead.
      await modal.locator('input[placeholder="e.g. Monthly Marketing Retainer"]').fill(`${TEST_PREFIX} Retainer`)

      await modal.getByLabel('Type').selectOption('HOURLY_BUCKET')
      await page.waitForTimeout(200)
      const monthlyAmountInput = modal.locator('label', { hasText: 'Monthly Amount' }).locator('xpath=following-sibling::input').first()
      await monthlyAmountInput.fill('15000')
      const hoursInput = modal.locator('label', { hasText: 'Hours / Month' }).locator('xpath=following-sibling::input').first()
      await hoursInput.fill('20')
      const startDateInput = modal.locator('label', { hasText: 'Start Date' }).locator('xpath=following-sibling::input').first()
      await startDateInput.fill(h.toLocalISODate(new Date()))

      await modal.locator('button', { hasText: 'Create Retainer' }).click()
      await page.waitForTimeout(1000)
      r.log('retainer-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async (custId) => window.api.retainer.list({ clientId: custId }), customerId)
      const retainer = (listRes?.data || [])[0]
      r.log('retainer-findable-via-api', !!retainer, JSON.stringify(retainer))
      retainerId = retainer?.id

      if (retainerId) {
        await h.gotoHash(page, '#/professional/time-entries')
        await page.waitForTimeout(700)
        r.log('time-entries-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

        await page.locator('button', { hasText: 'Log Hours' }).first().click()
        await page.waitForTimeout(500)
        const teModal = h.topModal(page)
        const retainerSelect = teModal.getByLabel('Retainer (Hourly Bucket)')
        r.log('retainer-select-present-in-time-entry-form', await retainerSelect.count() > 0)
        if (await retainerSelect.count()) await retainerSelect.selectOption({ value: retainerId })
        await teModal.locator('input[placeholder*="Site visit"]').fill(`${TEST_PREFIX} Retainer work`)
        await teModal.locator('input[placeholder="e.g. 2.5"]').fill('12')
        await teModal.locator('button', { hasText: 'Log Hours' }).click()
        await page.waitForTimeout(1000)
        r.log('time-entry-logged-no-crash', !(await h.hasErrorBoundary(page)))

        const usageRes = await page.evaluate((id) => window.api.retainer.getHoursUsage({ id }), retainerId)
        r.log('retainer-hours-usage-reflects-logged-time', usageRes?.data?.hoursUsed === 12, JSON.stringify(usageRes?.data))

        await h.gotoHash(page, '#/dashboard')
        await page.waitForTimeout(300)
        await h.gotoHash(page, '#/service/retainers')
        await page.waitForTimeout(700)
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('retainer-list-shows-burn-down-bar-text', bodyText.includes('12.0h') && bodyText.includes('20h'), bodyText.slice(0, 1500))
        await h.shot(page, 'consultant-retainer-burndown')
      }
    })

    // ─── AI intents for all 5 new items ─────────────────────────────────────
    await r.step('ai-intents-route-correctly-for-consultant-items', async () => {
      const engRes = await page.evaluate(() => window.api.ai.query({ question: 'How many engagement letters converted to projects?' }))
      r.log('ai-engagement-conversion-intent-routed-correctly', engRes?.data?.template === 'consultant.engagementConversion', JSON.stringify({ template: engRes?.data?.template, answer: engRes?.data?.answer }))

      const utilRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our utilization rate?' }))
      r.log('ai-utilization-intent-routed-correctly', utilRes?.data?.template === 'consultant.utilization', JSON.stringify({ template: utilRes?.data?.template, answer: utilRes?.data?.answer }))

      const burnRes = await page.evaluate(() => window.api.ai.query({ question: 'Show me retainer hours usage' }))
      r.log('ai-retainer-burndown-intent-routed-correctly', burnRes?.data?.template === 'consultant.retainerBurnDown', JSON.stringify({ template: burnRes?.data?.template, answer: burnRes?.data?.answer }))

      const profitRes = await page.evaluate(() => window.api.ai.query({ question: 'Which client is least profitable?' }))
      r.log('ai-client-profitability-intent-routed-correctly', profitRes?.data?.template === 'consultant.clientProfitability', JSON.stringify({ template: profitRes?.data?.template, answer: profitRes?.data?.answer }))

      const winRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our proposal win rate?' }))
      r.log('ai-proposal-win-rate-intent-routed-correctly', winRes?.data?.template === 'consultant.proposalWinRate', JSON.stringify({ template: winRes?.data?.template, answer: winRes?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CONSULTANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (cnsTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(cnsTemplateRowBefore.enabledModules, cnsTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('CONSULTANT', JSON.stringify(['ai_assistant']))
      }
    })
    // Consultant-specific cleanup FIRST, in FK-dependency order — before
    // cleanupByNamePrefix's generic Customer/Quotation/Invoice loops run,
    // matching every other Phase 67 suite's own custom-cleanup-before-
    // generic-cleanup convention this session established.
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let projectsRemoved = 0; let retainersRemoved = 0; let timeEntriesRemoved = 0
      for (const cid of custIds) {
        const retainerIds = db.prepare('SELECT id FROM RetainerAgreement WHERE clientId = ?').all(cid).map((row) => row.id)
        for (const rid of retainerIds) {
          const info = db.prepare('DELETE FROM TimeEntry WHERE retainerId = ?').run(rid)
          timeEntriesRemoved += info.changes
        }
        const rInfo = db.prepare('DELETE FROM RetainerAgreement WHERE clientId = ?').run(cid)
        retainersRemoved += rInfo.changes
        // Project.customerId has no onDelete clause (blocks deletion), and
        // WorkLog cascades from Project automatically — clear Project first
        // so the generic Customer cleanup below doesn't get forced into its
        // soft-delete fallback.
        const pInfo = db.prepare('DELETE FROM Project WHERE customerId = ?').run(cid)
        projectsRemoved += pInfo.changes
      }
      const strayInfo = db.prepare(`DELETE FROM Project WHERE title LIKE '${TEST_PREFIX}%'`).run()
      projectsRemoved += strayInfo.changes
      console.log('consultant 67 extra cleanup:', JSON.stringify({ customers: custIds.length, projectsRemoved, retainersRemoved, timeEntriesRemoved }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCONSULTANT ENGAGEMENT/UTILIZATION/RETAINER/PROFITABILITY: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
