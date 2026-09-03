/**
 * Suite 149 — Section C medium CRUD gap: project.handler.ts (projects:*),
 * the "bigger gap than it looks" the gap-list itself flagged -- ZERO
 * prior coverage of any kind, a whole separate feature from
 * service-project.handler.ts (ProjectsScreen.tsx under service-business/,
 * already covered suite 117) despite the near-identical name. This is
 * `src/renderer/src/modules/service/ui/ProjectsScreen.tsx` +
 * ProjectDetailScreen.tsx, projects.create/update/delete/generateInvoice
 * + projects.tasks.create/update/delete, no business-type gate.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Proj149'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let customerId
    const customerName = `${TEST_PREFIX} Customer ${suffix}`
    await r.step('seed-customer', async () => {
      const res = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), customerName)
      customerId = res?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(res?.error || ''))
    })

    const project1Title = `${TEST_PREFIX} Website Revamp ${suffix}`
    await r.step('create-project-via-ui', async () => {
      await h.gotoHash(page, '#/service/projects')
      await page.waitForTimeout(700)
      r.log('projects-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Project' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('label', { hasText: 'Project Title' }).locator('xpath=following-sibling::input').fill(project1Title)
      await modal.getByLabel('Customer').selectOption({ label: customerName })
      await modal.locator('label', { hasText: 'Amount' }).locator('xpath=following-sibling::input').fill('50000')
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'New Project', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('project-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let project1Id
    await r.step('verify-project-persisted', async () => {
      const listRes = await page.evaluate(async () => window.api.projects.list({}))
      const found = (listRes?.data?.projects || []).find((p) => p.title === project1Title)
      project1Id = found?.id
      r.log('project-persisted', !!project1Id && found?.customerId === customerId && found?.estimatedAmount === 50000, JSON.stringify(found))
    })

    await r.step('change-status-and-generate-invoice-via-ui', async () => {
      if (!project1Id) return r.log('change-status-and-generate-invoice-via-ui', false, 'no project1Id')
      const row = page.locator('button', { hasText: project1Title }).first()
      await row.click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('tab', { name: /In Progress/ }).click()
      await page.waitForTimeout(900)
      r.log('status-change-no-crash', !(await h.hasErrorBoundary(page)))

      let getRes = await page.evaluate((id) => window.api.projects.get({ id }), project1Id)
      r.log('status-actually-updated', getRes?.data?.status === 'IN_PROGRESS', JSON.stringify(getRes?.data?.status))

      await modal.getByRole('button', { name: 'Generate Invoice' }).click()
      await page.waitForTimeout(1200)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      getRes = await page.evaluate((id) => window.api.projects.get({ id }), project1Id)
      r.log('project-actually-invoiced', !!getRes?.data?.invoiceId, JSON.stringify(getRes?.data?.invoiceId))
      if (getRes?.data?.invoiceId) {
        // 50000 * 1.18 -- generateProjectInvoice routes through a
        // placeholder GST-taxed service product, same as every other
        // generateInvoice flow checked this session.
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), getRes.data.invoiceId)
        r.log('invoice-total-correct', invRes?.data?.totalAmount === 59000, `expected=59000 actual=${invRes?.data?.totalAmount}`)
      }

      await modal.getByRole('button', { name: /Open Project/ }).click()
      await page.waitForTimeout(900)
      r.log('detail-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let taskId
    const taskTitle = `${TEST_PREFIX} Design Homepage`
    await r.step('add-toggle-delete-task-via-ui', async () => {
      if (!project1Id) return r.log('add-toggle-delete-task-via-ui', false, 'no project1Id')
      // Only the TRIGGER button exists before this click -- unambiguous.
      await page.getByRole('button', { name: 'Add Task' }).click()
      await page.waitForTimeout(300)
      // After opening, both the trigger AND the form's own submit button
      // share the identical accessible name "Add Task" -- scope to the
      // form Card's own class combo to reach the right input/button.
      const form = page.locator('div.mb-3.space-y-3').first()
      await form.locator('input').first().fill(taskTitle)
      await page.waitForTimeout(200)
      await form.getByRole('button', { name: 'Add Task', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('add-task-no-crash', !(await h.hasErrorBoundary(page)))

      let taskRes = await page.evaluate((id) => window.api.projects.tasks.list({ projectId: id }), project1Id)
      let task = (taskRes?.data?.tasks || []).find((t) => t.title === taskTitle)
      taskId = task?.id
      r.log('task-persisted', !!taskId && task?.status !== 'DONE', JSON.stringify(task))
      if (!taskId) return

      const taskRow = page.locator('div.flex.items-start.gap-3', { hasText: taskTitle }).first()
      await taskRow.locator('button').first().click()
      await page.waitForTimeout(900)
      r.log('toggle-task-no-crash', !(await h.hasErrorBoundary(page)))

      taskRes = await page.evaluate((id) => window.api.projects.tasks.list({ projectId: id }), project1Id)
      task = (taskRes?.data?.tasks || []).find((t) => t.id === taskId)
      r.log('task-actually-toggled', task?.status === 'DONE', JSON.stringify(task))

      const freshRow = page.locator('div.flex.items-start.gap-3', { hasText: taskTitle }).first()
      await freshRow.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      await h.topModal(page).getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-task-no-crash', !(await h.hasErrorBoundary(page)))

      taskRes = await page.evaluate((id) => window.api.projects.tasks.list({ projectId: id }), project1Id)
      r.log('task-actually-deleted', !(taskRes?.data?.tasks || []).some((t) => t.id === taskId), JSON.stringify(taskRes?.data?.tasks))
    })

    let project2Id
    const project2Title = `${TEST_PREFIX} Throwaway Draft ${suffix}`
    await r.step('delete-project-via-ui', async () => {
      const res = await page.evaluate(({ title, cid }) => window.api.projects.create({
        title, customerId: cid,
      }), { title: project2Title, cid: customerId })
      project2Id = res?.data?.id
      r.log('project2-seeded', !!project2Id, JSON.stringify(res?.error || ''))
      if (!project2Id) return

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/service/projects')
      await page.waitForTimeout(700)

      const row = page.locator('button', { hasText: project2Title }).first()
      await row.click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Delete Project' }).click()
      await page.waitForTimeout(400)
      await h.topModal(page).getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-project-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.projects.list({}))
      r.log('project-actually-deleted', !(listRes?.data?.projects || []).some((p) => p.id === project2Id), JSON.stringify(listRes?.data?.projects?.length))
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let tasks = 0, logs = 0, projects = 0, custs = 0
      const projIds = db.prepare(`SELECT id FROM Project WHERE title LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of projIds) {
        try { tasks += db.prepare('DELETE FROM ProjectTask WHERE projectId = ?').run(pid).changes } catch { /* noop */ }
        try { logs += db.prepare('DELETE FROM WorkLog WHERE projectId = ?').run(pid).changes } catch { /* noop */ }
        try { projects += db.prepare('DELETE FROM Project WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ tasks, logs, projects, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPROJECTS / TASKS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
