/**
 * Suite 72 — Blood Bank vertical, Phase 67 §9.1 items 1, 3, 4, 5: donor
 * cooldown auto-reminder (item 1), camp/drive scheduling with donor-turnout
 * tracking (item 3), donation-to-issue cycle time report (item 4), and
 * emergency fast-match search (item 5). Item 2 (Blood-group stock level
 * report) already existed pre-Phase-67 and is untouched. Real UI-driven
 * Donor Registry recall filter, a brand-new Camps screen, both the Reports
 * tile and Billing-Issue fast-match panel, plus all three new AI intents.
 * Suite 33 already exhaustively covers the base donor -> donation ->
 * screening -> issue chain — this suite reuses the API for that baseline
 * setup and focuses real UI interaction on the NEW capabilities only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E BB67'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let bbTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-blood-bank', async () => {
      const sw = await h.switchBusinessType(page, 'Blood Bank')
      r.log('business-type-switched', sw.to === 'BLOOD_BANK', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // every other Phase 67 suite this session already found.
    h.withDb((db) => {
      bbTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('BLOOD_BANK')
      if (bbTemplateRowBefore) {
        const mods = new Set(JSON.parse(bbTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), bbTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'BLOOD_BANK', JSON.stringify(['ai_assistant']))
      }
    })

    // ─── Setup via API — same baseline suite 33 already proves works ───────
    let donorId, cycleDonorId, cycleDonationId

    await r.step('setup-donors-via-api', async () => {
      const donorRes = await page.evaluate(async (prefix) => window.api.bloodBank.createDonor({
        fullName: `${prefix} Donor`, phone: '9876543210', bloodGroup: 'O-',
      }), TEST_PREFIX)
      r.log('recall-donor-created', !!donorRes?.success, JSON.stringify(donorRes?.error || ''))
      donorId = donorRes?.data?.id

      const cycleDonorRes = await page.evaluate(async (prefix) => window.api.bloodBank.createDonor({
        fullName: `${prefix} Cycle Donor`, bloodGroup: 'O-',
      }), TEST_PREFIX)
      cycleDonorId = cycleDonorRes?.data?.id
    })

    // ─── Phase 67 §9.1 item 1: donor cooldown auto-reminder ─────────────────
    await r.step('backdate-donor-past-cooldown-and-check-recall-due-via-real-ui', async () => {
      if (!donorId) return r.log('backdate-donor-past-cooldown-and-check-recall-due-via-real-ui', false, 'no donorId captured')

      // Simulate a donor whose 90-day whole-blood cooldown already ended —
      // 100 days since their last donation.
      h.withDb((db) => {
        const past = new Date(Date.now() - 100 * 86400000).toISOString()
        db.prepare('UPDATE Donor SET lastDonationDate = ?, lastDonationComponentType = ? WHERE id = ?').run(past, 'WHOLE_BLOOD', donorId)
      })

      const dueRes = await page.evaluate(() => window.api.bloodBank.listDonorsDueForRecall())
      r.log('recall-due-api-succeeded', !!dueRes?.success, JSON.stringify(dueRes?.error || ''))
      r.log('recall-due-includes-our-donor', !!(dueRes?.data || []).find((d) => d.id === donorId), JSON.stringify(dueRes?.data?.map((d) => d.fullName)))

      await h.gotoHash(page, '#/blood-bank/donors')
      await page.waitForTimeout(700)
      r.log('donors-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const recallBtn = page.locator('button', { hasText: 'Recall Due' }).first()
      r.log('recall-due-button-present', await recallBtn.count() > 0)
      if (await recallBtn.count()) {
        await recallBtn.click()
        await page.waitForTimeout(500)
      }
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('recall-due-filter-shows-our-donor', bodyText.includes(`${TEST_PREFIX} Donor`))
      await h.shot(page, 'bloodbank-recall-due')
    })

    // ─── Phase 67 §9.1 item 3: camp/drive scheduling + turnout ──────────────
    const campName = `${TEST_PREFIX} Camp`
    let campId

    await r.step('schedule-camp-via-real-ui', async () => {
      await h.gotoHash(page, '#/blood-bank/camps')
      await page.waitForTimeout(700)
      r.log('camps-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: 'Schedule Camp' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.locator('input').first().fill(campName)
      const dateStr = new Date().toISOString().slice(0, 10)
      await modal.locator('input[type="date"]').fill(dateStr)

      await modal.locator('button', { hasText: 'Schedule Camp' }).last().click()
      await page.waitForTimeout(1000)
      r.log('camp-scheduled-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.bloodBank.listDonationCamps())
      const found = (listRes?.data || []).find((c) => c.campName === campName)
      r.log('camp-findable-via-api', !!found, JSON.stringify(found))
      campId = found?.id
      await h.shot(page, 'bloodbank-camp-scheduled')
    })

    await r.step('record-donation-linked-to-camp-via-real-ui', async () => {
      if (!donorId || !campId) return r.log('record-donation-linked-to-camp-via-real-ui', false, 'missing donorId or campId')

      await h.gotoHash(page, '#/blood-bank/donations')
      await page.waitForTimeout(700)

      await page.locator('button', { hasText: 'Record Donation' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.locator('select').first().selectOption(donorId)
      await page.waitForTimeout(200)
      // Select order in the form: Donor(0), Blood Group(1), Component Type(2),
      // Donation Camp(3) — the camp picker was added last, after both.
      await modal.locator('select').nth(3).selectOption(campId)
      await page.waitForTimeout(200)

      await modal.locator('button', { hasText: 'Record Donation' }).last().click()
      await page.waitForTimeout(1000)
      r.log('camp-linked-donation-recorded-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async (did) => window.api.bloodBank.listDonationRecords({ donorId: did }), donorId)
      const record = (listRes?.data?.records || [])[0]
      r.log('donation-record-has-campId-set', record?.camp?.campName === campName, JSON.stringify(record?.camp))
    })

    await r.step('camp-turnout-reflects-the-linked-donation', async () => {
      const listRes = await page.evaluate(() => window.api.bloodBank.listDonationCamps())
      const found = (listRes?.data || []).find((c) => c.id === campId)
      r.log('camp-turnout-count-is-one', found?._count?.donations === 1, JSON.stringify(found))

      await h.gotoHash(page, '#/blood-bank/camps')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('camps-screen-shows-turnout-for-our-camp', bodyText.includes(campName))
    })

    // ─── Phase 67 §9.1 item 4: Donation-to-Issue Cycle Time ─────────────────
    await r.step('create-and-issue-a-backdated-unit-for-cycle-time', async () => {
      if (!cycleDonorId) return r.log('create-and-issue-a-backdated-unit-for-cycle-time', false, 'no cycleDonorId captured')

      const donationRes = await page.evaluate(async (did) => window.api.bloodBank.createDonationRecord({
        donorId: did, bloodGroup: 'O-', componentType: 'PACKED_RBC',
      }), cycleDonorId)
      cycleDonationId = donationRes?.data?.id
      r.log('cycle-donation-created', !!cycleDonationId, JSON.stringify(donationRes?.error || ''))
      if (!cycleDonationId) return

      // Backdate collection 6 days before screening, so this unit has a real,
      // deterministic donation-to-issue gap once it's issued below.
      h.withDb((db) => {
        const past = new Date(Date.now() - 6 * 86400000).toISOString()
        db.prepare('UPDATE DonationRecord SET collectionDate = ? WHERE id = ?').run(past, cycleDonationId)
      })

      const screenRes = await page.evaluate(async (id) => window.api.bloodBank.updateScreeningStatus({ id, screeningStatus: 'PASSED' }), cycleDonationId)
      r.log('cycle-unit-screening-passed', !!screenRes?.success, JSON.stringify(screenRes?.error || ''))

      const issueRes = await page.evaluate(async (id) => window.api.bloodBank.createIssue({
        recipientName: `${'E2E BB67'} Cycle Recipient`, donationRecordIds: [id],
      }), cycleDonationId)
      r.log('cycle-unit-issued', !!issueRes?.success, JSON.stringify(issueRes?.error || ''))
    })

    await r.step('donation-to-issue-cycle-time-report-computes-and-renders-correctly', async () => {
      const reportRes = await page.evaluate(() => window.api.reports.donationToIssueCycleTime())
      r.log('cycle-time-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.byComponent || []).find((c) => c.componentType === 'PACKED_RBC')
      r.log('cycle-time-includes-packed-rbc', !!row, JSON.stringify(row))
      // Lower bound, not exact — the dev DB may carry other issued PACKED_RBC
      // units from earlier runs (same convention this whole arc uses for
      // shared-scope reports). Our own unit alone guarantees at least ~6 days.
      r.log('cycle-time-reflects-our-backdated-unit', (row?.maxDays ?? 0) >= 5.9)

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Donation-to-Issue Cycle Time' }).first()
      r.log('cycle-time-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('cycle-time-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('cycle-time-shows-packed-rbc', bodyText.includes('PACKED RBC') || bodyText.includes('PACKED_RBC'))
        await h.shot(page, 'bloodbank-donation-to-issue-cycle-time')
      }
    })

    // ─── Phase 67 §9.1 item 5: emergency fast-match search ──────────────────
    let fastMatchDonationId

    await r.step('fast-match-search-finds-and-selects-a-compatible-unit-via-real-ui', async () => {
      const donorRes = await page.evaluate(async (prefix) => window.api.bloodBank.createDonor({
        fullName: `${prefix} FastMatch Donor`, bloodGroup: 'O-',
      }), TEST_PREFIX)
      const fmDonorId = donorRes?.data?.id
      if (!fmDonorId) return r.log('fast-match-search-finds-and-selects-a-compatible-unit-via-real-ui', false, 'no fmDonorId captured')

      const donationRes = await page.evaluate(async (did) => window.api.bloodBank.createDonationRecord({
        donorId: did, bloodGroup: 'O-', componentType: 'PACKED_RBC',
      }), fmDonorId)
      fastMatchDonationId = donationRes?.data?.id
      await page.evaluate(async (id) => window.api.bloodBank.updateScreeningStatus({ id, screeningStatus: 'PASSED' }), fastMatchDonationId)

      const apiRes = await page.evaluate(() => window.api.bloodBank.fastMatchSearch({ recipientBloodGroup: 'A+', componentType: 'PACKED_RBC', quantity: 1 }))
      r.log('fast-match-api-succeeded', !!apiRes?.success, JSON.stringify(apiRes?.error || ''))
      r.log('fast-match-api-finds-compatible-O-neg-unit', !!(apiRes?.data?.matched || []).find((u) => u.donationRecordId === fastMatchDonationId), JSON.stringify(apiRes?.data))

      await h.gotoHash(page, '#/blood-bank/issue')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Issue Units' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.locator('select').first().selectOption('A+')
      await modal.locator('select').nth(1).selectOption('PACKED_RBC')
      await modal.locator('input[type="number"]').first().fill('1')
      await modal.locator('button', { hasText: 'Find & Select' }).click()
      await page.waitForTimeout(800)
      r.log('fast-match-ui-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await modal.innerText().catch(() => '')
      r.log('fast-match-ui-shows-fulfilled-result', bodyText.includes('Matched all'))

      const checkedBoxes = await modal.locator('input[type="checkbox"]:checked').count()
      r.log('fast-match-auto-selected-a-unit-checkbox', checkedBoxes >= 1)
      await h.shot(page, 'bloodbank-fast-match')
    })

    // ─── AI intents for all 3 new items ─────────────────────────────────────
    await r.step('ai-intents-route-correctly-for-all-three-new-items', async () => {
      const recallRes = await page.evaluate(() => window.api.ai.query({ question: 'Which donors are eligible to donate again?' }))
      r.log('ai-recall-intent-routed-correctly', recallRes?.data?.template === 'bloodBank.donorsDueForRecall', JSON.stringify({ template: recallRes?.data?.template, answer: recallRes?.data?.answer }))

      const turnoutRes = await page.evaluate(() => window.api.ai.query({ question: 'Show me camp turnout' }))
      r.log('ai-camp-turnout-intent-routed-correctly', turnoutRes?.data?.template === 'bloodBank.campTurnout', JSON.stringify({ template: turnoutRes?.data?.template, answer: turnoutRes?.data?.answer }))

      const cycleRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our donation to issue cycle time?' }))
      r.log('ai-cycle-time-intent-routed-correctly', cycleRes?.data?.template === 'bloodBank.donationToIssueCycleTime', JSON.stringify({ template: cycleRes?.data?.template, answer: cycleRes?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'BLOOD_BANK') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (bbTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(bbTemplateRowBefore.enabledModules, bbTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('BLOOD_BANK', JSON.stringify(['ai_assistant']))
      }
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      // Same FK-ordered cleanup class suite 33 already established: a
      // screening-PASSED donation creates a real ProductBatch keyed on
      // donationNumber, and BloodIssue/BloodIssueItem reference the
      // DonationRecord too — all deleted in dependency order before the
      // DonationRecord and Donor rows themselves, or a next run's recomputed
      // "DON-<yyyymm>-0001" sequence collides with an orphaned leftover.
      const issueIds = db.prepare(`SELECT id FROM BloodIssue WHERE recipientName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of issueIds) {
        db.prepare('DELETE FROM BloodIssueItem WHERE bloodIssueId = ?').run(id)
        try { db.prepare('DELETE FROM BloodIssue WHERE id = ?').run(id) } catch { /* leave it */ }
      }
      const donorIds = db.prepare(`SELECT id FROM Donor WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let batchesRemoved = 0
      for (const id of donorIds) {
        const batchIds = db.prepare('SELECT productBatchId FROM DonationRecord WHERE donorId = ? AND productBatchId IS NOT NULL').all(id).map((row) => row.productBatchId)
        try { db.prepare('DELETE FROM DonationRecord WHERE donorId = ?').run(id) } catch { /* leave it */ }
        for (const batchId of batchIds) {
          try { db.prepare('DELETE FROM ProductBatch WHERE id = ?').run(batchId); batchesRemoved++ } catch { /* leave it */ }
        }
        try { db.prepare('DELETE FROM Donor WHERE id = ?').run(id) } catch { /* leave it */ }
      }
      const campIds = db.prepare(`SELECT id FROM DonationCamp WHERE campName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of campIds) { try { db.prepare('DELETE FROM DonationCamp WHERE id = ?').run(id) } catch { /* leave it */ } }
      console.log('blood bank 67 extra cleanup:', JSON.stringify({ issues: issueIds.length, donors: donorIds.length, batches: batchesRemoved, camps: campIds.length }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBLOOD BANK RECALL/CAMPS/CYCLE-TIME/FAST-MATCH: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
