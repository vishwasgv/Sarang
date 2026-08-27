/**
 * Suite 24 — Software Agency vertical (issues). Real UI-driven issue
 * creation via IssuesScreen, requiring a pre-existing ServiceProject (no
 * inline create on this screen). See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E SW'

// Phase 68 §9.1 — Software Agency items 1/4/5 report-tile render sweep.
async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange, expectNonEmpty, emptyStateText } = {}) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileId}-tile-present`, present)
  if (!present) return
  await tile.click()
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000)))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
  if (expectNonEmpty && emptyStateText) {
    const bodyText = await page.locator('body').innerText().catch(() => '')
    r.log(`${tileId}-shows-real-data`, !bodyText.includes(emptyStateText), 'expected our seeded data to flow through, not the empty-state message')
  }
  await h.shot(page, `report-${tileId}`)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-software-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Software / IT Agency')
      r.log('business-type-switched', sw.to === 'SOFTWARE_AGENCY', JSON.stringify(sw))
    })

    let clientId, projectId

    await r.step('create-client-and-project', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E SW Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      clientId = custRes?.data?.id
      r.log('client-created', !!custRes?.success)

      const projRes = await page.evaluate(async (cid) => window.api.serviceProject.create({
        clientId: cid, projectName: 'E2E SW Feature Build', projectType: 'FEATURE_DEVELOPMENT',
      }), clientId)
      projectId = projRes?.data?.id
      r.log('project-created', !!projRes?.success, JSON.stringify(projRes?.error || ''))
    })

    await r.step('create-issue-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/issues')
      await page.waitForTimeout(700)
      r.log('issues-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Issue' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Project').selectOption(projectId)
      // "Title *" is a hand-rolled <label> (no htmlFor) — target by position,
      // it's the first plain <input> after the Project <select>.
      await modal.locator('input').first().fill('E2E SW Login page crashes on submit')
      await modal.getByLabel('Priority').selectOption('HIGH')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Issue' }).click()
      await page.waitForTimeout(1200)
      r.log('issue-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'software-issue-created')
    })

    let issueId

    await r.step('verify-issue-via-api', async () => {
      const listRes = await page.evaluate(async (pid) => window.api.issue.list({ projectId: pid }), projectId)
      const issues = listRes?.data || []
      const found = issues.find((i) => i.title === 'E2E SW Login page crashes on submit')
      issueId = found?.id
      r.log('issue-findable-via-api', !!issueId, JSON.stringify({ priority: found?.priority, status: found?.status }))
      r.log('issue-priority-saved-correctly', found?.priority === 'HIGH')
      r.log('issue-defaults-to-open-status', found?.status === 'OPEN', JSON.stringify(found?.status))
    })

    await r.step('advance-issue-status-via-api', async () => {
      if (!issueId) return r.log('advance-issue-status-via-api', false, 'no issueId captured')
      const res = await page.evaluate((id) => window.api.issue.update({ id, status: 'IN_PROGRESS' }), issueId)
      r.log('issue-status-advanced', !!res?.success, JSON.stringify(res?.error || ''))
      r.log('issue-status-is-in-progress', res?.data?.status === 'IN_PROGRESS', JSON.stringify(res?.data?.status))
    })

    await r.step('issue-aging-report', () => checkReportTile(page, r, 'issueAging', 'Issue Aging', {
      needsDateRange: false, expectNonEmpty: true, emptyStateText: 'No open issues right now.',
    }))

    await r.step('log-time-entry-for-team-utilization', async () => {
      const joinDate = h.toLocalISODate(new Date())
      const empRes = await page.evaluate((joinDate) => window.api.hr.createEmployee({
        fullName: 'E2E SW Developer', phone: `8${String(Date.now()).slice(-9)}`, joinDate,
      }), joinDate)
      const employeeId = empRes?.data?.id
      r.log('developer-created', !!employeeId, JSON.stringify(empRes?.error || ''))
      if (employeeId) {
        const teRes = await page.evaluate(({ pid, eid, today }) => window.api.timeEntry.create({
          projectId: pid, employeeId: eid, date: today, description: 'E2E SW debugging work', hours: 3, ratePerHour: 800,
        }), { pid: projectId, eid: employeeId, today: h.toLocalISODate(new Date()) })
        r.log('project-time-entry-created', !!teRes?.data?.id, JSON.stringify(teRes?.error || ''))
      }
    })

    await r.step('team-utilization-report', () => checkReportTile(page, r, 'teamUtilization', 'Team Utilization', {
      needsDateRange: true, expectNonEmpty: true, emptyStateText: 'No hours logged against a project in this date range.',
    }))

    await r.step('team-utilization-shows-our-developer-via-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000))
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.teamUtilization({ dateFrom: from, dateTo: to }), { from, to })
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.employeeName === 'E2E SW Developer')
      r.log('team-utilization-includes-our-developer', !!found && Number(found.billableHours) === 3, JSON.stringify(found))
    })

    await r.step('create-completed-sprint-for-billing-report', async () => {
      const start = h.toLocalISODate(new Date(Date.now() - 14 * 24 * 3600000))
      const end = h.toLocalISODate(new Date())
      const sprintRes = await page.evaluate(({ pid, start, end }) => window.api.sprint.create({
        projectId: pid, name: 'E2E SW Sprint 1', startDate: start, endDate: end,
      }), { pid: projectId, start, end })
      const sprintId = sprintRes?.data?.id
      r.log('sprint-created', !!sprintId, JSON.stringify(sprintRes?.error || ''))
      if (sprintId) {
        const upd = await page.evaluate((id) => window.api.sprint.update({ id, status: 'COMPLETED' }), sprintId)
        r.log('sprint-marked-completed', upd?.data?.status === 'COMPLETED', JSON.stringify(upd?.error || ''))
      }
    })

    await r.step('sprint-billing-report', () => checkReportTile(page, r, 'sprintBilling', 'Sprint Billing', { needsDateRange: false }))

    await r.step('sprint-billing-shows-our-sprint-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.sprintBilling())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.sprintName === 'E2E SW Sprint 1')
      r.log('sprint-billing-includes-our-sprint', !!found, JSON.stringify(found))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'SOFTWARE_AGENCY') {
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
      const projIds = db.prepare("SELECT id FROM ServiceProject WHERE projectName LIKE 'E2E SW%'").all().map((r2) => r2.id)
      for (const id of projIds) {
        try { db.prepare('DELETE FROM Issue WHERE projectId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM TimeEntry WHERE projectId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Sprint WHERE projectId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E SW%'").all().map((r2) => r2.id)
      for (const eid of empIds) { try { db.prepare('DELETE FROM Employee WHERE id = ?').run(eid) } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(eid) } }
      console.log('extra cleanup: projects', projIds.length, 'employees', empIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSOFTWARE AGENCY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
