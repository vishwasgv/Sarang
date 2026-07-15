/**
 * Suite 24 — Software Agency vertical (issues). Real UI-driven issue
 * creation via IssuesScreen, requiring a pre-existing ServiceProject (no
 * inline create on this screen). See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E SW'

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
        try { db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: projects', projIds.length)
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
