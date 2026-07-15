/**
 * Suite 23 — Marketing Agency vertical (marketing_campaigns). Real UI-driven
 * project creation with the marketing-specific fields (only rendered when
 * business type is MARKETING_AGENCY), then milestone billing. See
 * project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Mktg'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-marketing-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Marketing Agency')
      r.log('business-type-switched', sw.to === 'MARKETING_AGENCY', JSON.stringify(sw))
    })

    let clientId

    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Mktg Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      r.log('client-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      clientId = custRes?.data?.id
    })

    await r.step('create-marketing-project-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/service-projects')
      await page.waitForTimeout(700)
      r.log('projects-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Project' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      // Only "Client" uses the labeled Select atom (getByLabel works). Project
      // Name/Target Channel/Deliverable Type/Ad Spend are hand-rolled
      // <label>+<input> with no htmlFor — getByLabel silently times out on
      // them. Project Name has no placeholder either (Stage does, and comes
      // after it) — target by DOM position: the first plain <input> in the
      // modal, since Client is a <select> not an <input>.
      await modal.getByLabel('Client').selectOption(clientId)
      await modal.locator('input').first().fill('E2E Mktg Q3 Campaign')
      await page.waitForTimeout(300)

      const marketingFieldsVisible = await modal.getByPlaceholder('e.g. Google Ads').count() > 0
      r.log('marketing-specific-fields-render-for-this-business-type', marketingFieldsVisible)

      if (marketingFieldsVisible) {
        await modal.getByPlaceholder('e.g. Google Ads').fill('Google Ads')
        await modal.getByPlaceholder('e.g. Campaign Launch').fill('Campaign Launch')
        // Ad Spend Budget is the 2nd number input (Total Contract Value is the 1st).
        await modal.locator('input[type="number"]').nth(1).fill('50000')
      }
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Project' }).click()
      await page.waitForTimeout(1200)
      r.log('project-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'marketing-project-created')
    })

    let projectId

    await r.step('verify-project-and-marketing-fields-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.serviceProject.list({}))
      const projects = listRes?.data || []
      const found = projects.find((p) => p.projectName === 'E2E Mktg Q3 Campaign')
      projectId = found?.id
      r.log('project-findable-via-api', !!projectId)
      r.log('target-channel-saved-correctly', found?.targetChannel === 'Google Ads', JSON.stringify(found?.targetChannel))
      r.log('deliverable-type-saved-correctly', found?.deliverableType === 'Campaign Launch', JSON.stringify(found?.deliverableType))
      r.log('ad-spend-budget-saved-correctly', Number(found?.adSpendBudget) === 50000, JSON.stringify(found?.adSpendBudget))
    })

    await r.step('add-milestone-and-generate-invoice-via-real-ui', async () => {
      if (!projectId) return r.log('add-milestone-and-generate-invoice-via-real-ui', false, 'no projectId captured')

      const milestonesTabBtn = page.locator('button[title="Milestones"]').first()
      await milestonesTabBtn.click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      // Same raw-label gotcha as the project form — "Milestone Name *" has no htmlFor.
      await modal.locator('input').first().fill('E2E Mktg Kickoff Milestone')
      const amountInput = modal.locator('input[type="number"]').first()
      await amountInput.fill('25000')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Milestone' }).click()
      await page.waitForTimeout(1200)
      r.log('milestone-added-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'marketing-milestone-added')

      const genInvBtn = page.locator('button[title="Generate Invoice"]').first()
      r.log('generate-invoice-button-present', await genInvBtn.count() > 0)
      await genInvBtn.click()
      await page.waitForTimeout(1500)
      r.log('milestone-invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-milestone-invoice-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.serviceProject.list({}))
      const projects = listRes?.data || []
      const found = projects.find((p) => p.id === projectId)
      const milestone = found?.milestones?.find((m) => m.milestoneName === 'E2E Mktg Kickoff Milestone')
      r.log('milestone-has-invoice-id', !!milestone?.invoiceId, JSON.stringify(milestone?.invoiceId))

      if (milestone?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), milestone.invoiceId)
        const expectedTotal = 25000 * 1.18
        r.log('milestone-invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'MARKETING_AGENCY') {
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
      const projIds = db.prepare("SELECT id FROM ServiceProject WHERE projectName LIKE 'E2E Mktg%'").all().map((r2) => r2.id)
      for (const id of projIds) {
        try { db.prepare('DELETE FROM ServiceProjectMilestone WHERE projectId = ?').run(id) } catch { /* noop */ }
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
    console.log(`\nMARKETING AGENCY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
