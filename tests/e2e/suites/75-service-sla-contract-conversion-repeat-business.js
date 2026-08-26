/**
 * Suite 75 — Service vertical, Phase 67 §9.1 items 1-5: Ticket SLA timer
 * breach alert (Feature), Resolution Time by Category (Report), Recurring
 * Service Contract / AMC ledger (Feature), Repeat-Business Rate (Report),
 * and Quote-to-Job Conversion tracking (Feature). Service/Consultant/Repair
 * share one generic scaffold that pre-existing suites already cover for the
 * base Project/JobCard/Ticket flows — this suite reuses the API for that
 * baseline setup and focuses real UI interaction on the FIVE NEW
 * capabilities only, same convention every other Phase 67 suite this arc
 * has used.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E SVC75'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let svcTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-service-business', async () => {
      const sw = await h.switchBusinessType(page, 'Service Business / Agency / IT')
      r.log('business-type-switched', sw.to === 'SERVICE', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      svcTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('SERVICE')
      if (svcTemplateRowBefore) {
        const mods = new Set(JSON.parse(svcTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), svcTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'SERVICE', JSON.stringify(['ai_assistant']))
      }
    })

    // ─── Setup via API — real UI interaction is reserved for the NEW
    // capabilities under test, not the baseline scaffolding. ───────────────
    let customerId

    await r.step('setup-customer', async () => {
      const custRes = await page.evaluate(async (prefix) => window.api.customers.create({
        customerName: `${prefix} Customer`, phone: `9${String(Date.now()).slice(-9)}`,
      }), TEST_PREFIX)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    // ─── Phase 67 §9.1 item 1: Ticket SLA timer, created via real UI ───────
    let ticketId, ticketNumber
    await r.step('create-urgent-ticket-via-real-ui-and-verify-sla-due-at', async () => {
      await h.gotoHash(page, '#/service/tickets')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Service Ticket' }).first().click()
      await page.waitForTimeout(400)

      const modal = h.topModal(page)
      // Title and Category are the only two bare <input> elements in the
      // modal (Description is a <textarea>) — stable positional locators
      // regardless of how many <select> fields conditionally render.
      await modal.locator('input').nth(0).fill(`${TEST_PREFIX} Urgent Ticket`)
      await modal.locator('input').nth(1).fill(`${TEST_PREFIX} Cat`)
      await modal.getByLabel('Priority').selectOption('URGENT')
      await modal.getByLabel('Customer').selectOption({ label: `${TEST_PREFIX} Customer` })
      await modal.locator('button', { hasText: 'Create Ticket' }).click()
      await page.waitForTimeout(1000)
      r.log('ticket-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.tickets.list({}))
      const ticket = (listRes?.data?.tickets || []).find((t) => t.title === `${TEST_PREFIX} Urgent Ticket`)
      r.log('ticket-findable-via-api', !!ticket, JSON.stringify(ticket))
      ticketId = ticket?.id
      ticketNumber = ticket?.ticketNumber

      if (ticket) {
        const createdAt = new Date(ticket.createdAt).getTime()
        const dueAt = new Date(ticket.slaDueAt).getTime()
        const hoursDiff = (dueAt - createdAt) / (60 * 60 * 1000)
        r.log('urgent-ticket-sla-due-at-is-4-hours-out', Math.abs(hoursDiff - 4) < 0.05, JSON.stringify({ hoursDiff }))
        r.log('urgent-ticket-not-yet-breached', ticket.isSlaBreached === false)
      }
    })

    // ─── Simulate a real breach via direct DB write (same "simulate real
    // state" precedent this whole arc already uses for aging/overdue
    // scenarios), then verify the real UI surfaces it. ─────────────────────
    await r.step('backdate-sla-and-verify-ui-flags-breach', async () => {
      if (!ticketId) return r.log('backdate-sla-and-verify-ui-flags-breach', false, 'no ticket id')
      h.withDb((db) => {
        // DateTime columns in this SQLite DB are stored as epoch-ms
        // INTEGER, not ISO text — writing a toISOString() string here
        // silently breaks SQL-level comparisons even though a single-row
        // Prisma read stays lenient (same gotcha suite 15's own
        // vendorSlaDueDate backdate already documents).
        const pastDue = Date.now() - 60 * 60 * 1000
        db.prepare('UPDATE ServiceTicket SET slaDueAt = ? WHERE id = ?').run(pastDue, ticketId)
      })

      // Bounce through a different route first — re-navigating to the SAME
      // hash does not remount ServiceTicketsScreen, so its own load()
      // never re-runs and the component keeps serving the stale
      // pre-backdate ticket list from React state.
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/service/tickets')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('ticket-list-shows-sla-breached-badge', bodyText.includes('SLA Breached'), bodyText.slice(0, 1500))
      r.log('header-shows-past-sla-count', /\d+\s*ticket\(s\) past SLA/.test(bodyText), bodyText.slice(0, 300))
      await h.shot(page, 'service-sla-breach')

      // detail view
      await page.locator('button', { hasText: `${TEST_PREFIX} Urgent Ticket` }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const modalText = await modal.innerText().catch(() => '')
      r.log('detail-view-shows-sla-due-red', modalText.includes('SLA Due') && modalText.includes('SLA Breached'), modalText.slice(0, 800))
      await modal.locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(300)
    })

    // ─── Phase 67 §9.1 item 5: Quote-to-Job Conversion Tracking ────────────
    let acceptedQuotationId, acceptedQuotationNumber, draftQuotationId
    await r.step('setup-quotations-accepted-and-draft', async () => {
      const acceptedRes = await page.evaluate(async ({ prefix, customerId }) => {
        const created = await window.api.quotations.create({
          customerId, items: [{ productName: `${prefix} Consulting`, quantity: 1, unitPrice: 5000 }],
        })
        if (!created.success) return created
        return window.api.quotations.updateStatus({ id: created.data.id, status: 'ACCEPTED' })
      }, { prefix: TEST_PREFIX, customerId })
      r.log('accepted-quotation-created', !!acceptedRes?.success, JSON.stringify(acceptedRes?.error || ''))
      acceptedQuotationId = acceptedRes?.data?.id
      acceptedQuotationNumber = acceptedRes?.data?.quotationNumber

      const draftRes = await page.evaluate(async ({ prefix, customerId }) => window.api.quotations.create({
        customerId, items: [{ productName: `${prefix} Draft Estimate`, quantity: 1, unitPrice: 3000 }],
      }), { prefix: TEST_PREFIX, customerId })
      r.log('draft-quotation-created', !!draftRes?.success, JSON.stringify(draftRes?.error || ''))
      draftQuotationId = draftRes?.data?.id
    })

    await r.step('convert-accepted-quotation-to-ticket-via-real-ui', async () => {
      if (!acceptedQuotationId) return r.log('convert-accepted-quotation-to-ticket-via-real-ui', false, 'no accepted quotation')
      // Bounce through a different route so ServiceTicketsScreen remounts
      // and its load() picks up the quotation created via API just above —
      // same stale-state reasoning as the SLA-breach step's own bounce.
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/service/tickets')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'New Service Ticket' }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('input').nth(0).fill(`${TEST_PREFIX} Converted Ticket`)
      const quoteSelect = modal.getByLabel('Convert From Quotation')
      r.log('convert-from-quotation-dropdown-present', await quoteSelect.count() > 0)
      if (await quoteSelect.count()) {
        await quoteSelect.selectOption({ value: acceptedQuotationId })
      }
      await modal.locator('button', { hasText: 'Create Ticket' }).click()
      await page.waitForTimeout(1000)
      r.log('converted-ticket-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.tickets.list({}))
      const converted = (listRes?.data?.tickets || []).find((t) => t.title === `${TEST_PREFIX} Converted Ticket`)
      r.log('converted-ticket-links-quotation', converted?.quotationId === acceptedQuotationId, JSON.stringify(converted))

      await page.locator('button', { hasText: `${TEST_PREFIX} Converted Ticket` }).first().click()
      await page.waitForTimeout(400)
      const modal2 = h.topModal(page)
      const modalText = await modal2.innerText().catch(() => '')
      r.log('detail-view-shows-converted-from-quotation', modalText.includes('Converted From Quotation') && acceptedQuotationNumber && modalText.includes(acceptedQuotationNumber), modalText.slice(0, 800))
      await modal2.locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(300)
    })

    await r.step('quotation-conversion-guards-enforced-via-api', async () => {
      // Titled with TEST_PREFIX (even though these calls are expected to be
      // rejected and create nothing) so a latent guard bug can't leak an
      // untracked, unprefixed row past this suite's own cleanup.
      if (acceptedQuotationId) {
        const doubleRes = await page.evaluate((p) => window.api.tickets.create({ title: `${p.prefix} double convert attempt`, quotationId: p.qid }), { prefix: TEST_PREFIX, qid: acceptedQuotationId })
        r.log('double-conversion-rejected', doubleRes?.success === false && doubleRes?.error?.code === 'TKT-011', JSON.stringify(doubleRes?.error))
      }
      if (draftQuotationId) {
        const draftAttempt = await page.evaluate((p) => window.api.tickets.create({ title: `${p.prefix} draft convert attempt`, quotationId: p.qid }), { prefix: TEST_PREFIX, qid: draftQuotationId })
        r.log('non-accepted-quotation-rejected', draftAttempt?.success === false && draftAttempt?.error?.code === 'TKT-010', JSON.stringify(draftAttempt?.error))
      }

      const statsRes = await page.evaluate(() => window.api.tickets.getConversionStats())
      r.log('conversion-stats-api-succeeded', !!statsRes?.success, JSON.stringify(statsRes?.error || ''))
      r.log('conversion-stats-counts-our-conversion', (statsRes?.data?.convertedToTicket ?? 0) >= 1 && (statsRes?.data?.acceptedQuotations ?? 0) >= 1, JSON.stringify(statsRes?.data))
    })

    // ─── Resolve the urgent ticket for the resolution-time report below ────
    await r.step('resolve-the-urgent-ticket-via-real-ui', async () => {
      if (!ticketId) return r.log('resolve-the-urgent-ticket-via-real-ui', false, 'no ticket id')
      await h.gotoHash(page, '#/service/tickets')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Urgent Ticket` }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const resolvedBtn = modal.locator('button', { hasText: 'Resolved' }).first()
      r.log('resolved-action-present', await resolvedBtn.count() > 0)
      if (await resolvedBtn.count()) {
        await resolvedBtn.click()
        await page.waitForTimeout(800)
      }
      r.log('ticket-resolved-no-crash', !(await h.hasErrorBoundary(page)))
      await modal.locator('button', { hasText: '×' }).first().click().catch(() => {})
      await page.waitForTimeout(300)
    })

    // ─── Backdate a second, older ticket for the same customer so Repeat-
    // Business Rate has a real "repeat" data point this month. ─────────────
    let olderTicketId
    await r.step('create-a-backdated-older-ticket-for-repeat-business-signal', async () => {
      const res = await page.evaluate(async ({ prefix, customerId }) => window.api.tickets.create({
        title: `${prefix} Older Ticket`, customerId, priority: 'LOW',
      }), { prefix: TEST_PREFIX, customerId })
      olderTicketId = res?.data?.id
      r.log('older-ticket-created', !!olderTicketId, JSON.stringify(res?.error || ''))
      if (olderTicketId) {
        h.withDb((db) => {
          // Epoch-ms INTEGER, not ISO text — same DateTime-storage gotcha
          // as the SLA backdate above.
          const lastMonth = Date.now() - 30 * 86400000
          db.prepare('UPDATE ServiceTicket SET createdAt = ? WHERE id = ?').run(lastMonth, olderTicketId)
        })
      }
    })

    // ─── Phase 67 §9.1 item 2: Resolution Time by Category ─────────────────
    await r.step('resolution-time-by-category-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.serviceResolutionTime(p), { dateFrom, dateTo })
      r.log('resolution-time-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.category === `${TEST_PREFIX} Cat`)
      r.log('resolution-time-row-has-our-ticket', !!row && row.ticketCount >= 1 && row.avgHours >= 0, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Resolution Time by Category' }).first()
      r.log('resolution-time-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('resolution-time-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('resolution-time-shows-our-category', bodyText.includes(`${TEST_PREFIX} Cat`), bodyText.slice(0, 2000))
        await h.shot(page, 'service-resolution-time')
      }
    })

    // ─── Phase 67 §9.1 item 4: Repeat-Business Rate ─────────────────────────
    await r.step('repeat-business-rate-report-computes-and-renders', async () => {
      const dateFrom = h.toLocalISODate(new Date(new Date().setDate(1)))
      const dateTo = h.toLocalISODate(new Date())
      const reportRes = await page.evaluate((p) => window.api.reports.repeatBusinessRate(p), { dateFrom, dateTo })
      r.log('repeat-business-rate-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const thisMonth = new Date().toISOString().slice(0, 7)
      const row = (reportRes?.data?.rows || []).find((rr) => rr.month === thisMonth)
      r.log('repeat-business-rate-row-counts-our-repeat-customer', !!row && row.repeatCustomers >= 1, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Repeat-Business Rate' }).first()
      r.log('repeat-business-rate-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('repeat-business-rate-renders-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'service-repeat-business-rate')
      }
    })

    // ─── Phase 67 §9.1 item 3: Recurring Service Contract, real UI ─────────
    let contractId
    await r.step('run-a-service-contract-lifecycle-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/contracts')
      await page.waitForTimeout(700)
      r.log('service-contracts-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // ServiceContractsScreen's form is an inline <Card> panel, not a
      // `div.fixed.inset-0` overlay — interact with `page` directly, same
      // lesson Jewellery's GoldSavingsScreen suite already established.
      await page.locator('button', { hasText: 'New Contract' }).first().click()
      await page.waitForTimeout(500)

      const custSearch = page.locator('input[placeholder*="Search"]').first()
      await custSearch.fill(`${TEST_PREFIX} Customer`)
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Customer` }).first().click()
      await page.waitForTimeout(300)

      await page.locator('input[type="number"]').first().fill('12000')
      await page.waitForTimeout(200)

      await page.locator('button', { hasText: 'Create Contract' }).click()
      await page.waitForTimeout(1000)
      r.log('service-contract-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async (custId) => window.api.serviceContracts.list({ customerId: custId }), customerId)
      const contract = (listRes?.data || [])[0]
      r.log('contract-findable-via-api', !!contract, JSON.stringify(contract))
      contractId = contract?.id

      if (contractId) {
        await page.locator('button', { hasText: 'Generate Invoice' }).first().click()
        await page.waitForTimeout(500)
        await page.locator('button', { hasText: 'Generate Invoice' }).first().click()
        await page.waitForTimeout(1000)
        r.log('contract-invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))

        const afterRes = await page.evaluate(async (custId) => window.api.serviceContracts.list({ customerId: custId }), customerId)
        const afterContract = (afterRes?.data || []).find((c) => c.id === contractId)
        r.log('contract-shows-last-invoiced-period', !!afterContract?.lastInvoicedPeriod, JSON.stringify(afterContract))

        const doubleInvoiceRes = await page.evaluate((id) => window.api.serviceContracts.generateInvoice({ id }), contractId)
        r.log('double-invoice-same-period-rejected', doubleInvoiceRes?.success === false && doubleInvoiceRes?.error?.code === 'SCT-005', JSON.stringify(doubleInvoiceRes?.error))
      }
      await h.shot(page, 'service-contracts')
    })

    // ─── AI intents for all 5 new items ─────────────────────────────────────
    await r.step('ai-intents-route-correctly-for-service-items', async () => {
      const slaRes = await page.evaluate(() => window.api.ai.query({ question: 'Show me SLA breaches' }))
      r.log('ai-sla-breaches-intent-routed-correctly', slaRes?.data?.template === 'service.slaBreaches', JSON.stringify({ template: slaRes?.data?.template, answer: slaRes?.data?.answer }))

      const resTimeRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our resolution time by category?' }))
      r.log('ai-resolution-time-intent-routed-correctly', resTimeRes?.data?.template === 'service.resolutionTime', JSON.stringify({ template: resTimeRes?.data?.template, answer: resTimeRes?.data?.answer }))

      const contractRes = await page.evaluate(() => window.api.ai.query({ question: 'Give me a summary of our service contracts' }))
      r.log('ai-contract-summary-intent-routed-correctly', contractRes?.data?.template === 'service.contractSummary', JSON.stringify({ template: contractRes?.data?.template, answer: contractRes?.data?.answer }))

      const repeatRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our repeat business rate?' }))
      r.log('ai-repeat-business-intent-routed-correctly', repeatRes?.data?.template === 'service.repeatBusinessRate', JSON.stringify({ template: repeatRes?.data?.template, answer: repeatRes?.data?.answer }))

      const convRes = await page.evaluate(() => window.api.ai.query({ question: 'How is our quote to job conversion doing?' }))
      r.log('ai-quote-to-job-conversion-intent-routed-correctly', convRes?.data?.template === 'service.quoteToJobConversion', JSON.stringify({ template: convRes?.data?.template, answer: convRes?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'SERVICE') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (svcTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(svcTemplateRowBefore.enabledModules, svcTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('SERVICE', JSON.stringify(['ai_assistant']))
      }
    })
    // Service-specific cleanup FIRST, in FK-dependency order — before
    // cleanupByNamePrefix's generic Customer/Quotation/Invoice loops run,
    // matching every other Phase 67 suite's own custom-cleanup-before-
    // generic-cleanup convention this session established. ServiceTicket.
    // customerId has no onDelete clause (defaults to blocking behaviour in
    // SQLite), so a leftover ticket would silently force the generic
    // Customer loop's soft-delete fallback (leaking rows) — same class of
    // gotcha as "E2E Product Cleanup FK Gotcha".
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let ticketsRemoved = 0
      for (const cid of custIds) {
        const info = db.prepare('DELETE FROM ServiceTicket WHERE customerId = ?').run(cid)
        ticketsRemoved += info.changes
      }
      // Belt-and-suspenders: any ticket titled with our prefix but somehow
      // not linked to a prefix-matched customer (shouldn't happen, but
      // matches this session's own defensive-cleanup convention).
      const strayInfo = db.prepare(`DELETE FROM ServiceTicket WHERE title LIKE '${TEST_PREFIX}%'`).run()
      ticketsRemoved += strayInfo.changes
      console.log('service 67 extra cleanup:', JSON.stringify({ customers: custIds.length, ticketsRemoved }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSERVICE SLA/CONTRACT/CONVERSION/REPEAT-BUSINESS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
