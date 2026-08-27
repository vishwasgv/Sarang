/**
 * Suite 23 — Marketing Agency vertical (marketing_campaigns). Real UI-driven
 * project creation with the marketing-specific fields (only rendered when
 * business type is MARKETING_AGENCY), then milestone billing. See
 * project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Mktg'

// Phase 68 §9.1 — Marketing Agency items 1/3/4/5 report-tile render sweep.
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
      // campaignROI/channelPerformance both require projectType ===
      // 'MARKETING_CAMPAIGN' specifically -- the form defaults to 'GENERAL'.
      await modal.getByLabel('Type').selectOption('MARKETING_CAMPAIGN')
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

    await r.step('campaign-roi-report', () => checkReportTile(page, r, 'campaignROI', 'Campaign ROI', {
      needsDateRange: false, expectNonEmpty: true, emptyStateText: 'No marketing campaigns recorded yet.',
    }))

    await r.step('channel-performance-report', () => checkReportTile(page, r, 'channelPerformance', 'Channel Performance', {
      needsDateRange: false, expectNonEmpty: true, emptyStateText: 'No campaigns with a channel set yet.',
    }))

    await r.step('channel-performance-shows-google-ads-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.channelPerformance())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.channel === 'Google Ads')
      r.log('channel-performance-includes-google-ads', !!found && found.campaignCount >= 1, JSON.stringify(found))
    })

    let contentItemId

    await r.step('publish-content-calendar-item-for-deliverable-reports', async () => {
      const today = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ pid, today }) => window.api.contentCalendar.create({
        projectId: pid, scheduledDate: today, title: 'E2E Mktg Social Post', contentType: 'SOCIAL_POST',
      }), { pid: projectId, today })
      contentItemId = res?.data?.id
      r.log('content-calendar-item-created', !!contentItemId, JSON.stringify(res?.error || ''))
      if (contentItemId) {
        const upd = await page.evaluate((id) => window.api.contentCalendar.update({ id, status: 'PUBLISHED' }), contentItemId)
        r.log('content-calendar-item-published', upd?.data?.status === 'PUBLISHED', JSON.stringify(upd?.error || ''))
      }
    })

    await r.step('deliverable-status-pipeline-report', () => checkReportTile(page, r, 'deliverableStatusPipeline', 'Deliverable Status Pipeline', { needsDateRange: false }))

    await r.step('deliverable-status-pipeline-includes-our-item-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.deliverableStatusPipeline())
      const stages = res?.data?.stages || []
      const published = stages.find((s) => s.status === 'PUBLISHED')
      r.log('pipeline-shows-published-count', !!published && published.count >= 1, JSON.stringify(stages))
    })

    await r.step('create-retainer-for-work-delivered-report', async () => {
      const today = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ cid, today }) => window.api.retainer.create({
        clientId: cid, title: 'E2E Mktg Content Retainer', monthlyAmount: 15000, startDate: today,
      }), { cid: clientId, today })
      r.log('marketing-retainer-created', !!res?.data?.id, JSON.stringify(res?.error || ''))
    })

    await r.step('retainer-work-delivered-report', () => checkReportTile(page, r, 'retainerWorkDelivered', 'Retainer Work Delivered', { needsDateRange: false }))

    await r.step('retainer-work-delivered-shows-our-retainer-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.retainerWorkDelivered())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.title === 'E2E Mktg Content Retainer')
      r.log('work-delivered-shows-published-count-for-our-retainer', !!found && found.deliveredCount >= 1, JSON.stringify(found))
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
        try { db.prepare('DELETE FROM ContentCalendarItem WHERE projectId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const retIds = db.prepare("SELECT id FROM RetainerAgreement WHERE title LIKE 'E2E Mktg%'").all().map((r2) => r2.id)
      for (const id of retIds) { try { db.prepare('DELETE FROM RetainerAgreement WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: projects', projIds.length, 'retainers', retIds.length)
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
