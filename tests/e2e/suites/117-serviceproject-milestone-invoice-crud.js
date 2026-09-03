/**
 * Suite 117 — serviceProject.create/update/generateInvoice/delete +
 * milestone.create/update/delete/generateInvoice (broader-gap-list Section
 * C, money-critical, 2026-09-03). Both channel families live on the same
 * ProjectsScreen.tsx (Consultant/Architect/Civil Engineer/Software Agency/
 * Marketing Agency vertical) and were previously exercised ONLY via direct
 * API in every suite that touched them (10, 11, 24, 76, 80, 81) -- this is
 * the first real UI click-through of this screen. Sprints/campaign-
 * performance/content-calendar/timeEntry are separate, already-tracked gap
 * items and out of scope here.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E SvcProj'

// Most plain-text fields in this screen's modals are bare <label>+<input>
// siblings (no htmlFor/id), so getByLabel silently fails -- same convention
// as suite 101's ShipmentsScreen. Only the shared <Select> atom supports
// getByLabel directly.
async function fillByLabel(scope, labelText, value) {
  await scope.locator('label', { hasText: labelText }).first().locator('xpath=following-sibling::*[self::input or self::textarea][1]').fill(value)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-consultant', async () => {
      const sw = await h.switchBusinessType(page, 'Consultant / Freelancer')
      r.log('business-type-switched', sw.to === 'CONSULTANT', JSON.stringify(sw))
    })

    let clientId
    const clientName = `${TEST_PREFIX} Client ${suffix}`
    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), clientName)
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))
    })

    const projectName = `${TEST_PREFIX} Project ${suffix}`
    let projectId
    await r.step('create-project-via-ui', async () => {
      await h.gotoHash(page, '#/service/service-projects')
      await page.waitForTimeout(700)
      r.log('projects-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Project' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Client').selectOption({ label: clientName })
      await fillByLabel(modal, 'Project Name', projectName)
      await fillByLabel(modal, 'Total Contract Value', '5000')
      await modal.getByRole('button', { name: 'Create Project', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('project-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.serviceProject.list({}))
      const found = (listRes?.data || []).find((p) => p.projectName === projectName)
      projectId = found?.id
      r.log('project-persisted', !!projectId && found?.billingMethod === 'FIXED_COST' && Number(found?.totalContractValue) === 5000, JSON.stringify(found))
    })

    // The project name <span> sits 2 levels below the actual row div (which
    // carries the action buttons) -- walk up to the specific "gap-3 px-4
    // py-3" row div rather than a broad has:-filtered div (whose .last()
    // would land on the intermediate name/badge wrapper, not the row).
    function projectRow() {
      return page.locator('span.font-medium', { hasText: projectName }).first().locator('xpath=ancestor::div[contains(@class,"gap-3")][1]')
    }

    await r.step('edit-project-via-ui', async () => {
      if (!projectId) return r.log('edit-project-via-ui', false, 'no projectId')
      const row = projectRow()
      await row.locator('button:has(svg.lucide-pen)').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Stage (optional)', `${TEST_PREFIX} DISCOVERY`)
      await modal.getByRole('button', { name: 'Update Project' }).click()
      await page.waitForTimeout(1200)
      r.log('project-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.serviceProject.list({}))
      const found = (listRes?.data || []).find((p) => p.id === projectId)
      r.log('project-update-persisted', found?.stage === `${TEST_PREFIX} DISCOVERY`, JSON.stringify(found?.stage))
    })

    await r.step('expand-milestones-tab', async () => {
      const row = projectRow()
      await row.locator('button[title="Milestones"]').click()
      await page.waitForTimeout(500)
      r.log('milestones-tab-opens-no-crash', !(await h.hasErrorBoundary(page)))
    })

    const milestone1Name = `${TEST_PREFIX} Milestone 1 ${suffix}`
    let milestone1Id
    await r.step('milestone-1-create-and-update-via-ui', async () => {
      await page.locator('button', { hasText: 'Add' }).first().click()
      await page.waitForTimeout(500)
      let modal = h.topModal(page)
      await fillByLabel(modal, 'Milestone Name', milestone1Name)
      await fillByLabel(modal, 'Amount', '2000')
      await modal.getByRole('button', { name: 'Add Milestone' }).click()
      await page.waitForTimeout(1000)
      r.log('milestone-1-created-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((id) => window.api.milestone.list({ projectId: id }), projectId)
      let found = (listRes?.data || []).find((m) => m.milestoneName === milestone1Name)
      milestone1Id = found?.id
      r.log('milestone-1-persisted', !!milestone1Id && Number(found?.milestoneAmount) === 2000, JSON.stringify(found))
      if (!milestone1Id) return

      const row = page.locator('tr', { hasText: milestone1Name }).first()
      await row.locator('button:has(svg.lucide-pen)').click()
      await page.waitForTimeout(500)
      modal = h.topModal(page)
      await fillByLabel(modal, 'Amount', '2500')
      await modal.getByRole('button', { name: 'Update', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('milestone-1-update-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.milestone.list({ projectId: id }), projectId)
      found = (listRes?.data || []).find((m) => m.id === milestone1Id)
      r.log('milestone-1-update-persisted', Number(found?.milestoneAmount) === 2500, JSON.stringify(found))
    })

    await r.step('milestone-1-generate-invoice-via-ui', async () => {
      if (!milestone1Id) return r.log('milestone-1-generate-invoice-via-ui', false, 'no milestone1Id')
      const row = page.locator('tr', { hasText: milestone1Name }).first()
      const genBtn = row.locator('button[title="Generate Invoice"]')
      r.log('milestone-generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('milestone-generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((id) => window.api.milestone.list({ projectId: id }), projectId)
      const found = (listRes?.data || []).find((m) => m.id === milestone1Id)
      r.log('milestone-invoice-generated', !!found?.invoiceId, JSON.stringify(found))
      if (found?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), found.invoiceId)
        r.log('milestone-invoice-total-plus-gst', Math.abs((invRes?.data?.totalAmount ?? 0) - 2500 * 1.18) < 1, JSON.stringify(invRes?.data?.totalAmount))
      }
    })

    const milestone2Name = `${TEST_PREFIX} Milestone 2 ${suffix}`
    let milestone2Id
    await r.step('milestone-2-create-and-delete-via-ui', async () => {
      await page.locator('button', { hasText: 'Add' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Milestone Name', milestone2Name)
      await fillByLabel(modal, 'Amount', '800')
      await modal.getByRole('button', { name: 'Add Milestone' }).click()
      await page.waitForTimeout(1000)

      const listRes = await page.evaluate((id) => window.api.milestone.list({ projectId: id }), projectId)
      const found = (listRes?.data || []).find((m) => m.milestoneName === milestone2Name)
      milestone2Id = found?.id
      r.log('milestone-2-persisted', !!milestone2Id, JSON.stringify(found))
      if (!milestone2Id) return

      const row = page.locator('tr', { hasText: milestone2Name }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('milestone-2-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterDelete = await page.evaluate((id) => window.api.milestone.list({ projectId: id }), projectId)
      r.log('milestone-2-actually-gone', !(afterDelete?.data || []).some((m) => m.id === milestone2Id))
    })

    let projectInvoiceId
    await r.step('generate-project-invoice-via-ui', async () => {
      if (!projectId) return r.log('generate-project-invoice-via-ui', false, 'no projectId')
      const row = projectRow()
      const genBtn = row.locator('button[title="Generate Project Invoice"]')
      r.log('generate-project-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Generate Invoice', exact: true }).click()
      await page.waitForTimeout(1500)
      r.log('generate-project-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const custInvoices = await page.evaluate(async (cid) => window.api.billing.listInvoices({ customerId: cid }), clientId)
      const invoices = custInvoices?.data?.invoices || custInvoices?.data || []
      const fixedCostInvoice = invoices.find((inv) => inv.notes?.includes('Fixed Cost'))
      projectInvoiceId = fixedCostInvoice?.id
      r.log('project-invoice-generated', !!projectInvoiceId, JSON.stringify(fixedCostInvoice))
      if (projectInvoiceId) {
        r.log('project-invoice-total-plus-gst', Math.abs((fixedCostInvoice.totalAmount ?? 0) - 5000 * 1.18) < 1, JSON.stringify(fixedCostInvoice.totalAmount))
      }
    })

    await r.step('delete-project-via-ui', async () => {
      if (!projectId) return r.log('delete-project-via-ui', false, 'no projectId')
      const row = projectRow()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('project-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.serviceProject.list({}))
      r.log('project-actually-gone', !(listRes?.data || []).some((p) => p.id === projectId))
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
      const projectIds = db.prepare(`SELECT id FROM ServiceProject WHERE projectName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let milestones = 0, projects = 0
      for (const pid of projectIds) {
        try { milestones += db.prepare('DELETE FROM ServiceProjectMilestone WHERE projectId = ?').run(pid).changes } catch { /* noop */ }
        try { projects += db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      const clientIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of clientIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ projects, milestones, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSERVICE PROJECT + MILESTONE CRUD/INVOICE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
