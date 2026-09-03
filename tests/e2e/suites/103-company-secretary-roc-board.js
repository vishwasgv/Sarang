/**
 * Suite 103 — Company Secretary vertical: rocFiling (Section B gap,
 * update/delete specifically) + boardMeeting/boardResolution
 * (Section A whole-namespace gap) (broader-gap-list closure, 2026-09-03).
 * All three live on one combined screen, ROCFilingsScreen.tsx (three tabs:
 * ROC Filings, Board Meetings, Compliance Rollup).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CS'
const suffix = Date.now()

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    const originalBusinessType = h.getBusinessType()

    await r.step('switch-to-company-secretary', async () => {
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'COMPANY_SECRETARY' }))
      r.log('business-type-switch-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
      await h.gotoHash(page, '#/cs/roc-filings')
      await page.waitForTimeout(700)
      r.log('roc-filings-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let clientId
    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}` }), `${TEST_PREFIX} Client ${suffix}`)
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
      await h.gotoHash(page, '#/cs/roc-filings')
      await page.waitForTimeout(700)
    })

    // ── ROC Filings: create/update (Section B gap), delete ──────────────────
    let filingAId
    await r.step('filing-A-create-and-update-via-ui', async () => {
      await page.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(400)
      let modal = h.topModal(page)
      await modal.getByLabel('Client').selectOption(clientId)
      await modal.getByLabel('Form Type').selectOption('MGT-7')
      await modal.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(1000)
      r.log('filing-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.rocFiling.list({}))
      const found = (listRes?.data || []).find((f) => f.clientId === clientId && f.formType === 'MGT-7')
      filingAId = found?.id
      r.log('filing-A-persisted', !!filingAId, JSON.stringify(found))
      if (!filingAId) return

      const row = page.locator('td', { hasText: `${TEST_PREFIX} Client ${suffix}` }).first().locator('xpath=..')
      await row.locator('button').first().click()
      await page.waitForTimeout(400)
      modal = h.topModal(page)
      await modal.getByLabel('Status').selectOption('FILED')
      await page.waitForTimeout(200)
      const srnInput = modal.locator('label', { hasText: 'SRN (MCA)' }).locator('xpath=following-sibling::input[1]')
      await srnInput.fill('SRN123456789')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('filing-A-updated-no-crash', !(await h.hasErrorBoundary(page)))

      const afterUpdate = await page.evaluate(async () => window.api.rocFiling.list({}))
      const foundUpd = (afterUpdate?.data || []).find((f) => f.id === filingAId)
      r.log('filing-A-status-and-srn-updated', foundUpd?.status === 'FILED' && foundUpd?.srn === 'SRN123456789', JSON.stringify(foundUpd))
    })

    await r.step('filing-B-create-and-delete-via-ui', async () => {
      await page.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Client').selectOption(clientId)
      await modal.getByLabel('Form Type').selectOption('AOC-4')
      await modal.getByRole('button', { name: 'Add Filing' }).click()
      await page.waitForTimeout(1000)

      const listRes = await page.evaluate(async () => window.api.rocFiling.list({}))
      const found = (listRes?.data || []).find((f) => f.clientId === clientId && f.formType === 'AOC-4')
      r.log('filing-B-persisted', !!found)
      if (!found) return

      // Sort order (status asc, dueDate asc, createdAt desc) doesn't
      // guarantee B's row lands last -- filter on the AOC-4 form type text
      // (unique to B) instead of relying on row position.
      const row = page.locator('tr').filter({ hasText: `${TEST_PREFIX} Client ${suffix}` }).filter({ hasText: 'AOC-4' })
      r.log('filing-B-row-found', await row.count() === 1)
      await row.locator('button').last().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('filing-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.rocFiling.list({}))
      const stillThere = (afterDelete?.data || []).some((f) => f.id === found.id)
      r.log('filing-B-actually-gone', !stillThere)
    })

    // ── Board Meetings: create, inline toggle (update), resolutions, delete ─
    let meetingAId
    await r.step('meeting-A-create-via-ui', async () => {
      await page.locator('button', { hasText: 'Board Meetings' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Client').selectOption(clientId)
      const dateInput = modal.locator('label', { hasText: 'Meeting Date *' }).locator('xpath=following-sibling::input[1]')
      await dateInput.fill(h.toLocalISODate(new Date(Date.now() + 7 * 24 * 3600000)))
      await modal.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(1000)
      r.log('meeting-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.boardMeeting.list({}))
      const found = (listRes?.data || []).find((m) => m.clientId === clientId)
      meetingAId = found?.id
      r.log('meeting-A-persisted', !!meetingAId, JSON.stringify(found))
    })

    await r.step('meeting-A-toggle-flags-via-ui', async () => {
      if (!meetingAId) return r.log('meeting-A-toggle-flags-via-ui', false, 'no meetingAId')
      const row = page.locator('td', { hasText: `${TEST_PREFIX} Client ${suffix}` }).first().locator('xpath=..')
      await row.getByRole('button', { name: /Pending$/ }).first().click()
      await page.waitForTimeout(800)
      r.log('toggle-no-crash', !(await h.hasErrorBoundary(page)))

      const afterToggle = await page.evaluate(async () => window.api.boardMeeting.list({}))
      const found = (afterToggle?.data || []).find((m) => m.id === meetingAId)
      r.log('notices-sent-toggled-true', found?.noticesSent === true, JSON.stringify(found))
    })

    let resolutionId
    await r.step('add-and-delete-resolution-via-ui', async () => {
      if (!meetingAId) return r.log('add-and-delete-resolution-via-ui', false, 'no meetingAId')
      const row = page.locator('td', { hasText: `${TEST_PREFIX} Client ${suffix}` }).first().locator('xpath=..')
      await row.locator('button[title="Resolutions"]').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.locator('label', { hasText: 'Resolution No.' }).locator('xpath=following-sibling::input[1]').fill('1')
      const textArea = modal.locator('label', { hasText: 'Resolution Text' }).locator('xpath=following-sibling::textarea[1]')
      await textArea.fill('RESOLVED THAT the E2E test resolution is hereby approved.')
      await modal.getByRole('button', { name: 'Add Resolution' }).click()
      await page.waitForTimeout(1000)
      r.log('resolution-added-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((id) => window.api.boardResolution.list({ boardMeetingId: id }), meetingAId)
      const found = (listRes?.data || []).find((res) => res.resolutionText.includes('E2E test resolution'))
      resolutionId = found?.id
      r.log('resolution-persisted', !!resolutionId, JSON.stringify(found))
      if (!resolutionId) return

      // boardResolution.update has no UI trigger anywhere in the renderer -- API-only coverage.
      const updRes = await page.evaluate((id) => window.api.boardResolution.update({ id, resolutionText: 'RESOLVED THAT the E2E test resolution was amended.' }), resolutionId)
      r.log('resolution-update-via-api-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      await modal.locator('button:has(svg.lucide-trash2)').first().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('resolution-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate((id) => window.api.boardResolution.list({ boardMeetingId: id }), meetingAId)
      const stillThere = (afterDelete?.data || []).some((res) => res.id === resolutionId)
      r.log('resolution-actually-gone', !stillThere)

      // Deleting a resolution only updates the in-modal list -- the
      // Resolutions modal itself stays open (only its own X button closes
      // it), and would otherwise silently block every later click on this
      // screen behind its overlay.
      await h.topModal(page).locator('button:has(svg.lucide-x)').first().click()
      await page.waitForTimeout(400)
    })

    await r.step('overdue-minutes-report-no-crash', async () => {
      const res = await page.evaluate(async () => window.api.boardMeeting.overdueMinutes())
      r.log('overdue-minutes-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
    })

    await r.step('meeting-B-create-and-delete-via-ui', async () => {
      await page.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Client').selectOption(clientId)
      // AGM instead of the default BOARD type -- gives a stable, distinct
      // text marker to filter on below (list order is meetingDate desc, not
      // creation order, so a position-based "last row" locator would be
      // fragile/wrong here).
      await modal.getByLabel('Meeting Type').selectOption('AGM')
      const dateInput = modal.locator('label', { hasText: 'Meeting Date *' }).locator('xpath=following-sibling::input[1]')
      await dateInput.fill(h.toLocalISODate(new Date(Date.now() + 14 * 24 * 3600000)))
      await modal.getByRole('button', { name: 'Add Meeting' }).click()
      await page.waitForTimeout(1000)

      const listRes = await page.evaluate(async () => window.api.boardMeeting.list({}))
      const found = (listRes?.data || []).filter((m) => m.clientId === clientId).find((m) => m.id !== meetingAId)
      r.log('meeting-B-persisted', !!found, JSON.stringify(found))
      if (!found) return

      const row = page.locator('tr').filter({ hasText: `${TEST_PREFIX} Client ${suffix}` }).filter({ hasText: 'AGM' })
      r.log('meeting-B-row-found', await row.count() === 1)
      await row.locator('button').last().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('meeting-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate(async () => window.api.boardMeeting.list({}))
      const stillThere = (afterDelete?.data || []).some((m) => m.id === found.id)
      r.log('meeting-B-actually-gone', !stillThere)
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
    h.withDb((db) => {
      const meetingIds = db.prepare("SELECT bm.id FROM BoardMeeting bm JOIN Customer c ON c.id = bm.clientId WHERE c.customerName LIKE 'E2E CS%'").all().map((r2) => r2.id)
      let resolutions = 0, meetings = 0
      for (const mid of meetingIds) {
        resolutions += db.prepare('DELETE FROM BoardResolution WHERE boardMeetingId = ?').run(mid).changes
        try { meetings += db.prepare('DELETE FROM BoardMeeting WHERE id = ?').run(mid).changes } catch { /* noop */ }
      }
      const filings = db.prepare("DELETE FROM ROCFiling WHERE clientId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E CS%')").run().changes
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E CS%'").all().map((r2) => r2.id)
      let custs = 0
      for (const cid of custIds) {
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ resolutions, meetings, filings, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOMPANY SECRETARY (ROC/BOARD): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
