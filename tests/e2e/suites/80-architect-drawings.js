/**
 * Suite 80 — Architect vertical (drawing_register, service_projects stage
 * tracking). Zero prior E2E coverage for this vertical existed before this
 * suite (only a basic create+file-attach smoke test lives in suite 10).
 * Covers the genuinely untested Phase 68 §9.1 depth: revision issuance,
 * the approval workflow (incl. the DR-007 signer-name guard), orphaned-
 * superseded detection, project-stage progression, and both new report
 * tiles (drawingApprovalCycleTime, projectStageProgress).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Arch'

async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange } = {}) {
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

    await r.step('switch-to-architect', async () => {
      const sw = await h.switchBusinessType(page, 'Architect')
      r.log('business-type-switched', sw.to === 'ARCHITECT', JSON.stringify(sw))
    })

    let clientId, projectId

    await r.step('create-client-and-project', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Arch Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))

      const projRes = await page.evaluate(async (cid) => window.api.serviceProject.create({
        clientId: cid, projectName: 'E2E Arch Villa Project', projectType: 'ARCHITECTURE', status: 'ACTIVE', stage: 'CONCEPT',
      }), clientId)
      projectId = projRes?.data?.id
      r.log('project-created-with-initial-stage', !!projectId && projRes?.data?.stage === 'CONCEPT', JSON.stringify(projRes?.error || ''))
    })

    let firstDrawingId, secondDrawingId

    await r.step('create-drawing-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/drawing-register')
      await page.waitForTimeout(700)
      r.log('drawing-register-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByLabel('Project').selectOption(projectId)
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: /Add Drawing/i }).click()
      await page.waitForTimeout(400)
      await page.getByLabel('Drawing Number *').fill('E2E-DWG-001')
      await page.getByLabel('Title *').fill('E2E Ground Floor Plan')
      await page.getByLabel('Revision').fill('A')
      await page.getByLabel('Issued Date').fill(h.toLocalISODate(new Date(Date.now() - 10 * 24 * 3600000)))
      await page.getByRole('button', { name: /^Save$/i }).click()
      await page.waitForTimeout(1000)
      r.log('drawing-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'architect-drawing-created')

      const listRes = await page.evaluate((pid) => window.api.drawingRevision.list({ projectId: pid }), projectId)
      const found = (listRes?.data || []).find((d) => d.drawingNumber === 'E2E-DWG-001')
      firstDrawingId = found?.id
      r.log('drawing-findable-via-api', !!firstDrawingId, JSON.stringify(found))
    })

    await r.step('approval-without-signer-name-rejected', async () => {
      if (!firstDrawingId) return r.log('approval-without-signer-name-rejected', false, 'no firstDrawingId captured')
      const res = await page.evaluate((id) => window.api.drawingRevision.update({ id, status: 'APPROVED' }), firstDrawingId)
      r.log('approval-blocked-without-signer-DR-007', res?.success === false && res?.error?.code === 'DR-007', JSON.stringify(res?.error))
    })

    await r.step('approve-drawing-via-real-ui', async () => {
      if (!firstDrawingId) return
      const row = page.locator('div.px-5.py-4.flex.items-start.gap-4', { hasText: 'E2E-DWG-001' }).first()
      const statusSelect = row.locator('select')
      await statusSelect.selectOption('APPROVED')
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Approved By *').fill('E2E Test Signer')
      await modal.getByRole('button', { name: 'Approve' }).click()
      await page.waitForTimeout(1000)
      r.log('approval-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.drawingRevision.list({ projectId: pid }), projectId)
      const found = (listRes?.data || []).find((d) => d.id === firstDrawingId)
      r.log('drawing-approved-with-date-and-signer', found?.status === 'APPROVED' && !!found?.approvedDate && found?.approvedByName === 'E2E Test Signer', JSON.stringify(found))
    })

    await r.step('drawing-approval-cycle-time-report', () => checkReportTile(page, r, 'drawingApprovalCycleTime', 'Drawing Approval Cycle Time', { needsDateRange: false }))

    await r.step('drawing-approval-cycle-time-shows-our-drawing-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.drawingApprovalCycleTime())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.drawingNumber === 'E2E-DWG-001')
      r.log('approval-cycle-report-includes-our-drawing', !!found && found.daysToApprove >= 0, JSON.stringify(found))
    })

    await r.step('issue-new-revision-via-ipc', async () => {
      // Revision-issuance UI is already exercised generically elsewhere;
      // this suite's new value is the Phase 68 report data + the
      // supersede/orphan bookkeeping, so drive it directly via the
      // documented IPC shape.
      if (!firstDrawingId) return
      const res = await page.evaluate((prevId) => window.api.drawingRevision.issueNewRevision({
        previousRevisionId: prevId, revisionNumber: 'B', title: 'E2E Ground Floor Plan (Rev B)',
      }), firstDrawingId)
      secondDrawingId = res?.data?.id
      r.log('new-revision-issued', !!secondDrawingId, JSON.stringify(res?.error || ''))

      const listRes = await page.evaluate((pid) => window.api.drawingRevision.list({ projectId: pid }), projectId)
      const rows = listRes?.data || []
      const prev = rows.find((d) => d.id === firstDrawingId)
      r.log('previous-revision-flipped-to-superseded', prev?.status === 'SUPERSEDED', JSON.stringify(prev?.status))

      const retry = await page.evaluate((prevId) => window.api.drawingRevision.issueNewRevision({ previousRevisionId: prevId, revisionNumber: 'C' }), firstDrawingId)
      r.log('reissuing-already-superseded-blocked-DR-010', retry?.success === false && retry?.error?.code === 'DR-010', JSON.stringify(retry?.error))
    })

    await r.step('manually-superseded-drawing-flagged-orphaned', async () => {
      // A drawing manually flipped to SUPERSEDED (not via issueNewRevision)
      // has no real replacement -- Architect item 5's orphan detector.
      const projRes2 = await page.evaluate(async (cid) => window.api.serviceProject.create({
        clientId: cid, projectName: 'E2E Arch Orphan Project', projectType: 'ARCHITECTURE', status: 'ACTIVE',
      }), clientId)
      const orphanProjectId = projRes2?.data?.id
      const drawRes = await page.evaluate((pid) => window.api.drawingRevision.create({
        projectId: pid, drawingNumber: 'E2E-DWG-ORPHAN', title: 'E2E Orphan Drawing',
      }), orphanProjectId)
      const orphanDrawingId = drawRes?.data?.id
      if (orphanDrawingId) {
        await page.evaluate((id) => window.api.drawingRevision.update({ id, status: 'SUPERSEDED' }), orphanDrawingId)
        const orphanedRes = await page.evaluate((pid) => window.api.drawingRevision.orphanedSuperseded({ projectId: pid }), orphanProjectId)
        const flagged = (orphanedRes?.data || []).some((d) => d.id === orphanDrawingId)
        r.log('manually-superseded-drawing-flagged', flagged, JSON.stringify(orphanedRes?.data))
      }
    })

    await r.step('advance-project-stage', async () => {
      const before = await page.evaluate((pid) => window.api.serviceProject.get({ id: pid }), projectId)
      const stageUpdatedAtBefore = before?.data?.stageUpdatedAt
      const res = await page.evaluate((pid) => window.api.serviceProject.update({ id: pid, stage: 'DRAWINGS' }), projectId)
      r.log('stage-advanced', res?.data?.stage === 'DRAWINGS', JSON.stringify(res?.error || ''))
      r.log('stageUpdatedAt-changed-on-real-transition', res?.data?.stageUpdatedAt !== stageUpdatedAtBefore, JSON.stringify({ before: stageUpdatedAtBefore, after: res?.data?.stageUpdatedAt }))

      const noop = await page.evaluate((pid) => window.api.serviceProject.update({ id: pid, stage: 'DRAWINGS' }), projectId)
      r.log('stageUpdatedAt-unchanged-on-noop-resave', noop?.data?.stageUpdatedAt === res?.data?.stageUpdatedAt, JSON.stringify(noop?.data?.stageUpdatedAt))
    })

    await r.step('project-stage-progress-report', () => checkReportTile(page, r, 'projectStageProgress', 'Project Stage Progress', { needsDateRange: false }))

    await r.step('project-stage-progress-shows-our-project-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.projectStageProgress())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.projectId === projectId)
      r.log('stage-report-includes-our-project-with-percent', !!found && found.stage === 'DRAWINGS' && found.stageProgressPercent !== null, JSON.stringify(found))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'ARCHITECT') {
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
      const drawIds = db.prepare("SELECT id FROM DrawingRevision WHERE drawingNumber LIKE 'E2E-DWG%'").all().map((r2) => r2.id)
      for (const id of drawIds) { try { db.prepare('DELETE FROM DrawingRevision WHERE id = ?').run(id) } catch { /* noop */ } }
      const projIds = db.prepare("SELECT id FROM ServiceProject WHERE projectName LIKE 'E2E Arch%'").all().map((r2) => r2.id)
      for (const id of projIds) { try { db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: drawings', drawIds.length, 'projects', projIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nARCHITECT VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
