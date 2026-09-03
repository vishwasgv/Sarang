/**
 * Suite 127 — interviewRound.* (whole file, zero prior coverage of any
 * kind) — Placement Agency vertical, broader-gap-list "Nested sub-feature
 * gaps" under Section A, 2026-09-03. The panel only renders while EDITING
 * an existing candidate (editCand set) -- creating a new one doesn't show
 * it. candidate.create/jobOrder.create already covered via real UI (suite
 * 27); seeded here via API purely as setup.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E IntRound'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-placement-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Placement / Recruitment Agency')
      r.log('business-type-switched', sw.to === 'PLACEMENT_AGENCY', JSON.stringify(sw))
    })

    let hiringCompanyId, jobOrderId
    const jobTitle = `${TEST_PREFIX} Job Order ${suffix}`
    await r.step('seed-hiring-company-and-job-order', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Hiring Co ${suffix}`)
      hiringCompanyId = custRes?.data?.id
      r.log('hiring-company-created', !!hiringCompanyId, JSON.stringify(custRes?.error || ''))

      const joRes = await page.evaluate(({ hiringCompanyId, jobTitle }) => window.api.jobOrder.create({
        clientId: hiringCompanyId, jobTitle, commissionType: 'PERCENTAGE', commissionValue: 10,
      }), { hiringCompanyId, jobTitle })
      jobOrderId = joRes?.data?.id
      r.log('job-order-created', !!jobOrderId, JSON.stringify(joRes?.error || ''))
    })

    const candidateName = `${TEST_PREFIX} Candidate ${suffix}`
    let candidateId
    await r.step('seed-candidate', async () => {
      const candRes = await page.evaluate(async (name) => window.api.candidate.create({ fullName: name }), candidateName)
      candidateId = candRes?.data?.id
      r.log('candidate-created', !!candidateId, JSON.stringify(candRes?.error || ''))
    })

    await r.step('open-candidate-for-edit', async () => {
      if (!candidateId || !jobOrderId) return r.log('open-candidate-for-edit', false, 'missing prerequisite id')
      await h.gotoHash(page, '#/placement/candidates')
      await page.waitForTimeout(700)
      r.log('placement-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('p.font-semibold', { hasText: candidateName }).first().locator('xpath=ancestor::div[contains(@class,"justify-between") and contains(@class,"gap-3")][1]')
      // Pencil is imported directly here (not aliased as Edit2), so its
      // class is lucide-pencil, distinct from Edit2's lucide-pen.
      await row.locator('button:has(svg.lucide-pencil)').click()
      await page.waitForTimeout(800)
      const panelVisible = await page.locator('text=Interview Rounds').count() > 0
      r.log('interview-rounds-panel-visible', panelVisible)
    })

    let round1Id
    await r.step('add-round-1-and-update-status-via-ui', async () => {
      if (!candidateId) return r.log('add-round-1-and-update-status-via-ui', false, 'no candidateId')
      const panel = page.locator('div', { hasText: 'Interview Rounds' }).last()
      const jobOrderSelect = panel.locator('select').first()
      await jobOrderSelect.selectOption({ label: jobTitle })
      await page.waitForTimeout(300)
      await panel.locator('button', { hasText: 'Add Round' }).click()
      await page.waitForTimeout(1000)
      r.log('round-1-created-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((cid) => window.api.interviewRound.list({ candidateId: cid }), candidateId)
      let rounds = listRes?.data || []
      const round1 = rounds[0]
      round1Id = round1?.id
      r.log('round-1-persisted', !!round1Id && round1?.roundType === 'PHONE_SCREEN' && round1?.status === 'SCHEDULED', JSON.stringify(round1))
      if (!round1Id) return

      const freshPanel = page.locator('div', { hasText: 'Interview Rounds' }).last()
      // A broad div+hasText 'PHONE SCREEN' also matches the add-round
      // form's own type <select> (a closed <select>'s textContent includes
      // every <option>, not just the selected one) -- "Round 1" is unique
      // to the row itself, and its row div uses the bg-gray-50 class the
      // add-form area doesn't.
      const statusSelect = freshPanel.locator('div.bg-gray-50', { hasText: 'Round 1' }).locator('select')
      await statusSelect.selectOption('PASSED')
      await page.waitForTimeout(1000)
      r.log('round-1-status-update-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((cid) => window.api.interviewRound.list({ candidateId: cid }), candidateId)
      rounds = listRes?.data || []
      const round1After = rounds.find((x) => x.id === round1Id)
      r.log('round-1-status-actually-updated', round1After?.status === 'PASSED', JSON.stringify(round1After))
    })

    await r.step('save-round-1-feedback-via-ui', async () => {
      if (!round1Id) return r.log('save-round-1-feedback-via-ui', false, 'no round1Id')
      const panel = page.locator('div', { hasText: 'Interview Rounds' }).last()
      const feedbackInput = panel.getByPlaceholder('Client feedback for this round...')
      await feedbackInput.fill(`${TEST_PREFIX} Strong technical fundamentals`)
      await feedbackInput.blur()
      await page.waitForTimeout(1000)
      r.log('feedback-save-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.interviewRound.list({ candidateId: cid }), candidateId)
      const round1After = (listRes?.data || []).find((x) => x.id === round1Id)
      r.log('feedback-actually-saved', round1After?.clientFeedback === `${TEST_PREFIX} Strong technical fundamentals`, JSON.stringify(round1After?.clientFeedback))
    })

    let round2Id
    await r.step('add-round-2-and-delete-via-ui', async () => {
      if (!candidateId) return r.log('add-round-2-and-delete-via-ui', false, 'no candidateId')
      // By now Round 1's own row also has a <select> (status), which
      // shifts index-based selection -- scope to the add-form's own
      // grid-cols-4 container instead.
      const panel = page.locator('div', { hasText: 'Interview Rounds' }).last()
      const addForm = panel.locator('div.grid.grid-cols-4')
      const jobOrderSelect = addForm.locator('select').first()
      await jobOrderSelect.selectOption({ label: jobTitle })
      const roundTypeSelect = addForm.locator('select').nth(1)
      await roundTypeSelect.selectOption('TECHNICAL')
      await page.waitForTimeout(300)
      await panel.locator('button', { hasText: 'Add Round' }).click()
      await page.waitForTimeout(1000)
      r.log('round-2-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.interviewRound.list({ candidateId: cid }), candidateId)
      const rounds = listRes?.data || []
      const round2 = rounds.find((x) => x.id !== round1Id)
      round2Id = round2?.id
      r.log('round-2-persisted', !!round2Id && round2?.roundType === 'TECHNICAL', JSON.stringify(round2))
      if (!round2Id) return

      const freshPanel = page.locator('div', { hasText: 'Interview Rounds' }).last()
      await freshPanel.locator('div.bg-gray-50', { hasText: 'Round 2' }).locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(1000)
      r.log('round-2-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((cid) => window.api.interviewRound.list({ candidateId: cid }), candidateId)
      r.log('round-2-actually-deleted', !(afterRes?.data || []).some((x) => x.id === round2Id))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PLACEMENT_AGENCY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const candIds = db.prepare(`SELECT id FROM Candidate WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let rounds = 0, candidates = 0
      for (const cid of candIds) {
        rounds += db.prepare('DELETE FROM InterviewRound WHERE candidateId = ?').run(cid).changes
        try { candidates += db.prepare('DELETE FROM Candidate WHERE id = ?').run(cid).changes } catch { /* noop */ }
      }
      const joIds = db.prepare(`SELECT id FROM JobOrder WHERE jobTitle LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let jobOrders = 0
      for (const jid of joIds) { try { jobOrders += db.prepare('DELETE FROM JobOrder WHERE id = ?').run(jid).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ candidates, rounds, jobOrders, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nINTERVIEW ROUND: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
