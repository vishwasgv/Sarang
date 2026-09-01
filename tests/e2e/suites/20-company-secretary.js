/**
 * Suite 20 — Company Secretary vertical (compliance_tasks, roc_filings,
 * board_meetings). Real UI-driven creation of all 3 record types. Per
 * project_vertical_uat_research.md this vertical has a REAL structural gap
 * (no invoicing wired for any of the 3 models) — this suite documents that
 * gap explicitly rather than testing a billing flow that doesn't exist.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CS'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-company-secretary', async () => {
      const sw = await h.switchBusinessType(page, 'Company Secretary')
      r.log('business-type-switched', sw.to === 'COMPANY_SECRETARY', JSON.stringify(sw))
    })

    let clientId

    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E CS Client Pvt Ltd', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('client-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      clientId = custRes?.data?.id
    })

    // Created BEFORE any navigation to #/cs/roc-filings — that screen's
    // overdueMinutes state loads once on mount only (no tab-switch refetch),
    // so seeding this ahead of the FIRST real visit avoids a stale-mount
    // dance entirely, same as [[feedback_e2e_datetime_backdate_and_stale_hash_nav]].
    await r.step('seed-a-stale-unfinalized-board-meeting', async () => {
      const overdueMeetingDate = h.toLocalISODate(new Date(Date.now() - 40 * 24 * 3600000))
      const staleRes = await page.evaluate(({ cid, date }) => window.api.boardMeeting.create({
        clientId: cid, meetingType: 'BOARD', meetingDate: date, venue: 'E2E CS Overdue Venue',
      }), { cid: clientId, date: overdueMeetingDate })
      r.log('stale-meeting-created', !!staleRes?.success, JSON.stringify(staleRes?.error || ''))
    })

    await r.step('create-compliance-task-via-real-ui', async () => {
      await h.gotoHash(page, '#/ca-cs/compliance')
      await page.waitForTimeout(700)
      r.log('compliance-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Task' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client *').selectOption(clientId)
      await modal.getByPlaceholder('e.g. GSTR-3B Filing — July 2026').fill('E2E CS Annual Filing Task')
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(h.toLocalISODate(new Date(Date.now() + 30 * 24 * 3600000)))
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Task' }).click()
      await page.waitForTimeout(1200)
      r.log('compliance-task-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cs-compliance-task-created')
    })

    await r.step('verify-compliance-task-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.complianceTask.list({}))
      const tasks = listRes?.data || []
      const found = tasks.find((t) => t.title === 'E2E CS Annual Filing Task')
      r.log('compliance-task-findable-via-api', !!found, JSON.stringify({ status: found?.status, priority: found?.priority }))
    })

    await r.step('create-roc-filing-via-real-ui', async () => {
      await h.gotoHash(page, '#/cs/roc-filings')
      await page.waitForTimeout(700)
      r.log('roc-filings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client').selectOption(clientId)
      await modal.getByPlaceholder('e.g. 2025-26').fill('2026-27')
      await modal.getByPlaceholder('e.g. Annual Return for FY 2025-26').fill('E2E CS Annual Return')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(1200)
      r.log('roc-filing-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cs-roc-filing-created')
    })

    await r.step('verify-roc-filing-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.rocFiling.list({}))
      const filings = listRes?.data || []
      const found = filings.find((f) => f.purpose === 'E2E CS Annual Return')
      r.log('roc-filing-findable-via-api', !!found, JSON.stringify({ formType: found?.formType, status: found?.status }))
    })

    await r.step('create-board-meeting-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Board Meetings' }).click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Client').selectOption(clientId)
      const meetingDate = h.toLocalISODate(new Date(Date.now() + 14 * 24 * 3600000))
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(meetingDate)
      await modal.getByPlaceholder('e.g. Registered Office').fill('E2E CS Registered Office')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(1200)
      r.log('board-meeting-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'cs-board-meeting-created')
    })

    await r.step('verify-board-meeting-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.boardMeeting.list({}))
      const meetings = listRes?.data || []
      const found = meetings.find((m) => m.venue === 'E2E CS Registered Office')
      r.log('board-meeting-findable-via-api', !!found, JSON.stringify({ meetingType: found?.meetingType }))
    })

    // Phase 68 §9.1 — Company Secretary items 1/3/4/5, never given live E2E
    // coverage when Phase 68 itself was built (its own audit confirmed this
    // vertical had zero new report tiles, but these 3 worklist/summary
    // features are real UI, not report.service.ts entries — genuinely
    // untested before this pass).
    const now = new Date()
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    // Matches ROCFilingsScreen.tsx's own currentFinancialYear() format
    // EXACTLY — a 2-digit year suffix ("2026-27"), not 4 ("2026-2027"). A
    // mismatched format here would silently filter against the wrong FY
    // string and find nothing, even though the real feature works.
    const currentFY = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`
    // June 15 of the FY's start year — safely mid-range (FY runs Apr 1 -
    // Mar 31) regardless of which month "now" actually falls in. All
    // built via the LOCAL Date constructor (matching parseLocalDateStart's
    // own semantics), never a string-parse or raw UTC epoch add — same
    // "backdate via local Date arithmetic, not .toISOString()" rule as
    // every other date computation in this suite file.
    const agmLocalDate = new Date(fyStartYear, 5, 15)
    const agmDateStr = h.toLocalISODate(agmLocalDate)
    const expectedAoc4Due = h.toLocalISODate(new Date(fyStartYear, 5, 15 + 30))
    const expectedMgt7Due = h.toLocalISODate(new Date(fyStartYear, 5, 15 + 60))

    await r.step('generate-filings-from-agm-via-real-ui', async () => {
      const agmRes = await page.evaluate(({ cid, date }) => window.api.boardMeeting.create({
        clientId: cid, meetingType: 'AGM', meetingDate: date, venue: 'E2E CS AGM Venue',
      }), { cid: clientId, date: agmDateStr })
      r.log('agm-meeting-created', !!agmRes?.success, JSON.stringify(agmRes?.error || ''))

      await h.gotoHash(page, '#/cs/roc-filings')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Compliance Rollup' }).click()
      await page.waitForTimeout(800)

      const row = page.locator('tr', { hasText: 'E2E CS Client Pvt Ltd' }).first()
      const rowPresent = await row.count() > 0
      r.log('rollup-row-present-for-client', rowPresent)
      if (!rowPresent) return

      const genBtn = row.locator('button:has-text("Generate Filings")')
      const genBtnPresent = await genBtn.count() > 0
      r.log('generate-filings-button-present-agmHeld', genBtnPresent)
      if (!genBtnPresent) return
      await genBtn.click()
      await page.waitForTimeout(1000)
      r.log('generate-filings-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-agm-filings-created-with-correct-due-dates', async () => {
      const listRes = await page.evaluate(({ cid, fy }) => window.api.rocFiling.list({ clientId: cid, financialYear: fy }), { cid: clientId, fy: currentFY })
      const filings = listRes?.data || []
      const aoc4 = filings.find((f) => f.formType === 'AOC-4')
      // MGT-7 was already created for this exact client+FY by the earlier
      // 'create-roc-filing-via-real-ui' step (hardcoded financialYear
      // '2026-27', purpose 'E2E CS Annual Return') — generateFilingsFromAGM
      // correctly sees it already exists and does NOT create a duplicate
      // (existingTypes.has('MGT-7')), so only AOC-4 is freshly generated here.
      const mgt7 = filings.find((f) => f.formType === 'MGT-7' && f.purpose === 'E2E CS Annual Return')
      r.log('aoc4-filing-generated', !!aoc4, JSON.stringify(aoc4?.dueDate))
      r.log('mgt7-not-duplicated-preexisting-one-still-there', !!mgt7, JSON.stringify(mgt7?.dueDate))
      r.log('aoc4-due-date-is-agm-plus-30d', aoc4?.dueDate?.slice(0, 10) === expectedAoc4Due, `expected=${expectedAoc4Due} actual=${aoc4?.dueDate}`)
      r.log('agm-generation-created-exactly-one-new-filing-not-two', filings.filter((f) => f.formType === 'AOC-4' || f.formType === 'MGT-7').length === 2, JSON.stringify(filings.map((f) => f.formType)))
    })

    await r.step('generate-filings-again-is-idempotent', async () => {
      const res = await page.evaluate(({ cid, fy, date }) => window.api.rocFiling.generateFromAGM({ clientId: cid, agmDate: date, financialYear: fy }), { cid: clientId, fy: currentFY, date: agmDateStr })
      r.log('second-call-creates-zero-new-filings', res?.success && Array.isArray(res.data) && res.data.length === 0, JSON.stringify(res?.data))
    })

    await r.step('compliance-completion-summary-reflects-real-signals', async () => {
      const res = await page.evaluate((fy) => window.api.rocFiling.completionSummary({ financialYear: fy }), currentFY)
      r.log('completion-summary-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
      const row = (res?.data?.rows || []).find((row) => row.clientName === 'E2E CS Client Pvt Ltd')
      r.log('completion-summary-includes-our-client', !!row, JSON.stringify(row))
      // Signals: agmHeld=true, mgt7/aoc4 just created as PENDING (not FILED),
      // adt1 never created (NOT_STARTED) -> 1 of 4 signals done -> 25%.
      r.log('health-score-reflects-one-of-four-signals', row?.healthScorePercent === 25, row?.healthScorePercent)
      r.log('overall-completion-rate-is-a-number', typeof res?.data?.overallCompletionRatePercent === 'number', res?.data?.overallCompletionRatePercent)
    })

    await r.step('overdue-minutes-banner-flags-a-stale-unfinalized-meeting', async () => {
      const apiRes = await page.evaluate(async () => window.api.boardMeeting.overdueMinutes())
      const found = (apiRes?.data || []).find((row) => row.clientName === 'E2E CS Client Pvt Ltd' && row.daysOverdue > 0)
      r.log('overdue-minutes-api-flags-our-meeting', !!found, JSON.stringify(found))

      // The stale meeting was seeded before the screen's FIRST mount
      // (see 'seed-a-stale-unfinalized-board-meeting' above) — its
      // overdueMinutes state loads once on mount only, no tab-switch
      // refetch, so this only needs the tab click, not a remount dance.
      await page.getByRole('button', { name: 'Board Meetings' }).click()
      await page.waitForTimeout(800)
      // Chromium's innerText honors the label's own CSS text-transform:
      // uppercase, so "Minutes overdue" reads back as "MINUTES OVERDUE" —
      // same [[feedback_uppercase_css_innertext_gotcha]] as elsewhere;
      // match case-insensitively rather than the literal JSX source text.
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const bannerFound = /minutes overdue/i.test(bodyText) && bodyText.includes('E2E CS Client Pvt Ltd')
      const mIdx = bodyText.indexOf('Board Meeting')
      r.log('overdue-banner-visible-on-screen', bannerFound, bannerFound ? '' : bodyText.slice(mIdx, mIdx + 600))
    })

    await r.step('confirm-no-invoicing-path-exists-known-structural-gap', async () => {
      // Documented gap in project_vertical_uat_research.md: none of these 3
      // models have an invoiceId column or a generateInvoice IPC method.
      // Confirm the API surface genuinely has no such method (not a UI-only
      // omission) so this stays an accurate, current record of the gap.
      const apiSurface = await page.evaluate(() => ({
        complianceTaskKeys: Object.keys(window.api.complianceTask || {}),
        rocFilingKeys: Object.keys(window.api.rocFiling || {}),
        boardMeetingKeys: Object.keys(window.api.boardMeeting || {}),
      }))
      const noInvoiceMethod = (keys) => !keys.some((k) => /invoice/i.test(k))
      r.log('compliance-task-has-no-invoice-method', noInvoiceMethod(apiSurface.complianceTaskKeys), JSON.stringify(apiSurface.complianceTaskKeys))
      r.log('roc-filing-has-no-invoice-method', noInvoiceMethod(apiSurface.rocFilingKeys), JSON.stringify(apiSurface.rocFilingKeys))
      r.log('board-meeting-has-no-invoice-method', noInvoiceMethod(apiSurface.boardMeetingKeys), JSON.stringify(apiSurface.boardMeetingKeys))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'COMPANY_SECRETARY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const ctIds = db.prepare("SELECT id FROM ComplianceTask WHERE title LIKE 'E2E CS%'").all().map((r2) => r2.id)
      for (const id of ctIds) { try { db.prepare('DELETE FROM ComplianceTask WHERE id = ?').run(id) } catch { /* noop */ } }
      // The AGM-auto-generated AOC-4/MGT-7 filings' `purpose` text doesn't
      // carry the 'E2E CS' prefix (it's fixed, service-authored text) — also
      // sweep by clientId via the (still-present, possibly soft-deactivated)
      // test Customer row.
      const rocIds = db.prepare(`
        SELECT id FROM ROCFiling
        WHERE purpose LIKE 'E2E CS%'
           OR clientId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E CS%')
      `).all().map((r2) => r2.id)
      for (const id of rocIds) { try { db.prepare('DELETE FROM ROCFiling WHERE id = ?').run(id) } catch { /* noop */ } }
      const bmIds = db.prepare("SELECT id FROM BoardMeeting WHERE venue LIKE 'E2E CS%'").all().map((r2) => r2.id)
      for (const id of bmIds) { try { db.prepare('DELETE FROM BoardMeeting WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: complianceTasks', ctIds.length, 'rocFilings', rocIds.length, 'boardMeetings', bmIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOMPANY SECRETARY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
