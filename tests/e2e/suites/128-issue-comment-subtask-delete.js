/**
 * Suite 128 — issue.delete + issueComment.* + issueSubtask.* (whole files,
 * zero prior coverage) — Software/IT Agency vertical, broader-gap-list
 * "Nested sub-feature gaps" under Section A, 2026-09-03. create/update
 * (status change) already covered (suite 24); delete/comments/subtasks all
 * have real UI triggers on IssuesScreen.tsx's detail modal.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Issue128'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-software-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Software / IT Agency')
      r.log('business-type-switched', sw.to === 'SOFTWARE_AGENCY', JSON.stringify(sw))
    })

    let clientId, projectId
    await r.step('seed-client-and-project', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Client ${suffix}`)
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))

      const projRes = await page.evaluate(({ clientId, projectName }) => window.api.serviceProject.create({
        clientId, projectName, projectType: 'FEATURE_DEVELOPMENT',
      }), { clientId, projectName: `${TEST_PREFIX} Project ${suffix}` })
      projectId = projRes?.data?.id
      r.log('project-created', !!projectId, JSON.stringify(projRes?.error || ''))
    })

    async function createIssueViaUi(title) {
      await h.gotoHash(page, '#/service/issues')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'New Issue' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Project').selectOption(projectId)
      await modal.locator('input').first().fill(title)
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Create Issue' }).click()
      await page.waitForTimeout(1200)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate((pid) => window.api.issue.list({ projectId: pid }), projectId)
      const issues = listRes?.data || []
      const issue = issues.find((i) => i.title === title)
      return { id: issue?.id, noCrash }
    }

    // ── Issue A: subtask + comment CRUD ───────────────────────────────────────
    const titleA = `${TEST_PREFIX} Issue A ${suffix}`
    let issueAId
    await r.step('issue-A-create-and-open-detail', async () => {
      const res = await createIssueViaUi(titleA)
      issueAId = res.id
      r.log('issue-A-created-no-crash', res.noCrash)
      r.log('issue-A-persisted', !!issueAId)
      if (!issueAId) return

      await page.locator('button', { hasText: titleA }).first().click()
      await page.waitForTimeout(500)
      r.log('detail-modal-opens-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let subtaskId
    await r.step('add-toggle-delete-subtask-via-ui', async () => {
      if (!issueAId) return r.log('add-toggle-delete-subtask-via-ui', false, 'no issueAId')
      const modal = h.topModal(page)
      const subtaskInput = modal.getByPlaceholder('Add a subtask...')
      await subtaskInput.fill(`${TEST_PREFIX} Write unit tests`)
      await subtaskInput.press('Enter')
      await page.waitForTimeout(1000)
      r.log('subtask-add-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((id) => window.api.issueSubtask.list({ issueId: id }), issueAId)
      let subtasks = listRes?.data || []
      const subtask = subtasks[0]
      subtaskId = subtask?.id
      r.log('subtask-persisted', !!subtaskId && subtask?.isDone === false, JSON.stringify(subtask))
      if (!subtaskId) return

      const freshModal = h.topModal(page)
      const subtaskRow = freshModal.locator('div', { hasText: `${TEST_PREFIX} Write unit tests` }).last()
      // .check() throws "did not change its state" here -- it verifies the
      // DOM checked property immediately after clicking, but this is a
      // controlled input that only flips once the toggle API call resolves,
      // a hair slower than .check()'s own retry tolerates. Plain .click()
      // + wait (already followed by a DB-level assertion below) is reliable.
      await subtaskRow.locator('input[type="checkbox"]').click()
      await page.waitForTimeout(1000)
      r.log('subtask-toggle-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.issueSubtask.list({ issueId: id }), issueAId)
      subtasks = listRes?.data || []
      let found = subtasks.find((x) => x.id === subtaskId)
      r.log('subtask-actually-toggled', found?.isDone === true, JSON.stringify(found))

      const freshModal2 = h.topModal(page)
      const subtaskRow2 = freshModal2.locator('div', { hasText: `${TEST_PREFIX} Write unit tests` }).last()
      await subtaskRow2.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(1000)
      r.log('subtask-delete-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.issueSubtask.list({ issueId: id }), issueAId)
      subtasks = listRes?.data || []
      r.log('subtask-actually-deleted', !subtasks.some((x) => x.id === subtaskId), JSON.stringify(subtasks))
    })

    let commentId
    await r.step('add-and-delete-comment-via-ui', async () => {
      if (!issueAId) return r.log('add-and-delete-comment-via-ui', false, 'no issueAId')
      const modal = h.topModal(page)
      const commentText = `${TEST_PREFIX} Blocked on API access, following up with client`
      await modal.getByPlaceholder('Write a comment...').fill(commentText)
      await modal.locator('button:has(svg.lucide-send)').click()
      await page.waitForTimeout(1000)
      r.log('comment-add-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((id) => window.api.issueComment.list({ issueId: id }), issueAId)
      let comments = listRes?.data || []
      const comment = comments.find((c) => c.body === commentText)
      commentId = comment?.id
      r.log('comment-persisted', !!commentId, JSON.stringify(comment))
      if (!commentId) return

      const freshModal = h.topModal(page)
      const commentRow = freshModal.locator('div', { hasText: commentText }).last()
      await commentRow.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(1000)
      r.log('comment-delete-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.issueComment.list({ issueId: id }), issueAId)
      comments = listRes?.data || []
      r.log('comment-actually-deleted', !comments.some((c) => c.id === commentId), JSON.stringify(comments))

      await freshModal.locator('button:has(svg.lucide-x)').first().click().catch(() => {})
      await page.waitForTimeout(400)
    })

    // ── Issue B: delete ───────────────────────────────────────────────────────
    const titleB = `${TEST_PREFIX} Issue B ${suffix}`
    let issueBId
    await r.step('issue-B-create-and-delete-via-ui', async () => {
      const res = await createIssueViaUi(titleB)
      issueBId = res.id
      r.log('issue-B-created-no-crash', res.noCrash)
      r.log('issue-B-persisted', !!issueBId)
      if (!issueBId) return

      const row = page.locator('tr', { hasText: titleB }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('issue-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.issue.list({ projectId: pid }), projectId)
      const issues = listRes?.data || []
      r.log('issue-B-actually-deleted', !issues.some((i) => i.id === issueBId))
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
    h.withDb((db) => {
      const issueIds = db.prepare(`SELECT id FROM Issue WHERE title LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let subtasks = 0, comments = 0, issues = 0
      for (const iid of issueIds) {
        subtasks += db.prepare('DELETE FROM IssueSubtask WHERE issueId = ?').run(iid).changes
        comments += db.prepare('DELETE FROM IssueComment WHERE issueId = ?').run(iid).changes
        try { issues += db.prepare('DELETE FROM Issue WHERE id = ?').run(iid).changes } catch { /* noop */ }
      }
      const projIds = db.prepare(`SELECT id FROM ServiceProject WHERE projectName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let projects = 0
      for (const pid of projIds) { try { projects += db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(pid).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ issues, subtasks, comments, projects, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nISSUE COMMENT/SUBTASK/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
