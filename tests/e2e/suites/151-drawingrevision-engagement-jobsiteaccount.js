/**
 * Suite 151 — Section C medium CRUD gap: drawingRevision.delete (create/
 * update/issueNewRevision/orphanedSuperseded already covered via real UI,
 * suite 80), engagement.update (create/list/generateInvoice/delete already
 * covered, suites 10/82), jobSiteAccount.update (no UI trigger anywhere in
 * the renderer -- confirmed via grep, a real product gap: no way to rename
 * an account or edit its site address once created -- covered API-only)
 * + jobSiteAccount.close (list/balance already covered, suite 86).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E151'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── drawingRevision.delete — Architect, DrawingRegisterScreen ──────────
    await r.step('switch-to-architect', async () => {
      const sw = await h.switchBusinessType(page, 'Architect')
      r.log('business-type-switched', sw.to === 'ARCHITECT', JSON.stringify(sw))
    })

    let archProjectId, archProjectName, archClientName
    const drawingNumber = `${TEST_PREFIX}-DWG-01`
    await r.step('seed-architect-project-and-drawing', async () => {
      archClientName = `${TEST_PREFIX} Client ${suffix}`
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), archClientName)
      const clientId = custRes?.data?.id

      archProjectName = `${TEST_PREFIX} Villa Project ${suffix}`
      const projRes = await page.evaluate(({ cid, name }) => window.api.serviceProject.create({
        clientId: cid, projectName: name, projectType: 'RESIDENTIAL',
      }), { cid: clientId, name: archProjectName })
      archProjectId = projRes?.data?.id
      r.log('architect-project-created', !!clientId && !!archProjectId, JSON.stringify(projRes?.error || ''))

      if (archProjectId) {
        const drawRes = await page.evaluate(({ pid, num }) => window.api.drawingRevision.create({
          projectId: pid, drawingNumber: num, title: 'Ground Floor Plan',
        }), { pid: archProjectId, num: drawingNumber })
        r.log('drawing-revision-created', !!drawRes?.data?.id, JSON.stringify(drawRes?.error || ''))
      }
    })

    await r.step('delete-drawing-revision-via-ui', async () => {
      if (!archProjectId) return r.log('delete-drawing-revision-via-ui', false, 'no archProjectId')
      await h.gotoHash(page, '#/service/drawing-register')
      await page.waitForTimeout(700)
      r.log('drawing-register-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByLabel('Project').selectOption({ label: `${archProjectName} — ${archClientName}` })
      await page.waitForTimeout(500)

      const row = page.locator('span.font-semibold', { hasText: drawingNumber }).first().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('drawing-revision-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.drawingRevision.list({ projectId: pid }), archProjectId)
      r.log('drawing-revision-actually-deleted', !(listRes?.data || []).some((d) => d.drawingNumber === drawingNumber), JSON.stringify(listRes?.data))
    })

    // ── engagement.update — CA / Chartered Accountant, EngagementsScreen ───
    await r.step('switch-to-ca-firm', async () => {
      const sw = await h.switchBusinessType(page, 'CA / Chartered Accountant')
      r.log('business-type-switched-ca', sw.to === 'CA_FIRM', JSON.stringify(sw))
    })

    let engagementId
    const engTitle = `${TEST_PREFIX} Statutory Audit ${suffix}`
    await r.step('seed-ca-client-and-engagement', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} CA Client ${suffix}`)
      const clientId = custRes?.data?.id

      const engRes = await page.evaluate(({ cid, title }) => window.api.engagement.create({
        clientId: cid, title, engagementType: 'RETAINER', feeType: 'FIXED', feeAmount: 5000,
      }), { cid: clientId, title: engTitle })
      engagementId = engRes?.data?.id
      r.log('ca-engagement-created', !!clientId && !!engagementId, JSON.stringify(engRes?.error || ''))
    })

    await r.step('update-engagement-via-ui', async () => {
      if (!engagementId) return r.log('update-engagement-via-ui', false, 'no engagementId')
      await h.gotoHash(page, '#/ca-cs/engagements')
      await page.waitForTimeout(700)
      r.log('engagements-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('tr', { hasText: engTitle }).first()
      await row.locator('button[title="Edit"]').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.locator('label', { hasText: 'Fee Amount' }).locator('xpath=following-sibling::input').fill('7500')
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('engagement-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.engagement.list({}))
      const found = (listRes?.data || []).find((e) => e.id === engagementId)
      r.log('engagement-actually-updated', Number(found?.feeAmount) === 7500, JSON.stringify(found))
    })

    // ── jobSiteAccount.update (API-only, no UI) + .close (UI) — Electrical ──
    await r.step('switch-to-electrical', async () => {
      const sw = await h.switchBusinessType(page, 'Electrical Store')
      r.log('business-type-switched-elec', sw.to === 'ELECTRICAL', JSON.stringify(sw))
    })

    let jobSiteAccountId
    const accountName = `${TEST_PREFIX} Site Account ${suffix}`
    await r.step('seed-contractor-and-jobsiteaccount', async () => {
      const contractorRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `7${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Contractor ${suffix}`)
      const contractorId = contractorRes?.data?.id

      const acctRes = await page.evaluate(({ cid, name }) => window.api.jobSiteAccount.create({
        accountName: name, contractorId: cid,
      }), { cid: contractorId, name: accountName })
      jobSiteAccountId = acctRes?.data?.id
      r.log('jobsite-account-created', !!contractorId && !!jobSiteAccountId, JSON.stringify(acctRes?.error || ''))
    })

    await r.step('update-jobsiteaccount-api-only-no-ui-trigger', async () => {
      if (!jobSiteAccountId) return r.log('update-jobsiteaccount-api-only-no-ui-trigger', false, 'no jobSiteAccountId')
      const res = await page.evaluate((id) => window.api.jobSiteAccount.update({
        id, siteAddress: 'Updated Site Address, Block C',
      }), jobSiteAccountId)
      r.log('jobsiteaccount-update-succeeds', !!res?.success, JSON.stringify(res?.error || ''))

      const listRes = await page.evaluate(() => window.api.jobSiteAccount.list())
      const found = (listRes?.data || []).find((a) => a.id === jobSiteAccountId)
      r.log('jobsiteaccount-actually-updated', found?.siteAddress === 'Updated Site Address, Block C', JSON.stringify(found))
    })

    await r.step('close-jobsiteaccount-via-ui', async () => {
      if (!jobSiteAccountId) return r.log('close-jobsiteaccount-via-ui', false, 'no jobSiteAccountId')
      await h.gotoHash(page, '#/job-site-accounts')
      await page.waitForTimeout(700)
      r.log('jobsiteaccounts-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('span.font-semibold', { hasText: accountName }).first().locator('xpath=ancestor::button[1]')
      await row.click()
      await page.waitForTimeout(600)
      r.log('jobsiteaccount-expand-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Close Account' }).click()
      await page.waitForTimeout(1000)
      r.log('jobsiteaccount-close-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.jobSiteAccount.list())
      const found = (listRes?.data || []).find((a) => a.id === jobSiteAccountId)
      r.log('jobsiteaccount-actually-closed', found?.status === 'CLOSED', JSON.stringify(found?.status))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'ELECTRICAL') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let drawings = 0, archProjects = 0
      const projIds = db.prepare(`SELECT id FROM ServiceProject WHERE projectName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of projIds) {
        try { drawings += db.prepare('DELETE FROM DrawingRevision WHERE projectId = ?').run(pid).changes } catch { /* noop */ }
        try { archProjects += db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }

      let engagements = 0
      try { engagements += db.prepare(`DELETE FROM Engagement WHERE title LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }

      let jobSiteAccounts = 0
      try { jobSiteAccounts += db.prepare(`DELETE FROM JobSiteAccount WHERE accountName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }

      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ drawings, archProjects, engagements, jobSiteAccounts, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDRAWING REVISION / ENGAGEMENT / JOB SITE ACCOUNT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
