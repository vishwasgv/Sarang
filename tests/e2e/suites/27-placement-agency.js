/**
 * Suite 27 — Placement Agency vertical (placement_agency). 3-entity chain:
 * hiring-company Customer -> JobOrder -> Candidate (independent) -> Placement
 * (auto-computes commission from JobOrder's commissionType/commissionValue x
 * offeredSalary). Real UI-driven throughout, inline Card panels not modals
 * — see project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Plc'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-placement-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Placement / Recruitment Agency')
      r.log('business-type-switched', sw.to === 'PLACEMENT_AGENCY', JSON.stringify(sw))
    })

    let hiringCompanyId

    await r.step('create-hiring-company', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Plc Hiring Co', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      hiringCompanyId = custRes?.data?.id
      r.log('hiring-company-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
    })

    await r.step('create-job-order-via-real-ui', async () => {
      await h.gotoHash(page, '#/placement/candidates')
      await page.waitForTimeout(700)
      r.log('placement-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Job Orders' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'New Job Order' }).click()
      await page.waitForTimeout(500)

      const panel = page.locator('div.shadow-sm').filter({ hasText: 'New Job Order' })
      await panel.getByLabel('Hiring Company').selectOption(hiringCompanyId)
      await panel.locator('input').first().fill('E2E Plc Backend Engineer')
      // Commission Type defaults to PERCENTAGE; set Commission % to 10.
      const commissionValueInput = panel.locator('input[type="number"]').last()
      await commissionValueInput.fill('10')
      await page.waitForTimeout(300)

      await panel.getByRole('button', { name: 'Save Job Order' }).click()
      await page.waitForTimeout(1200)
      r.log('job-order-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'placement-joborder-created')
    })

    let jobOrderId

    await r.step('verify-job-order-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.jobOrder.list({}))
      const orders = listRes?.data || []
      const found = orders.find((o) => o.jobTitle === 'E2E Plc Backend Engineer')
      jobOrderId = found?.id
      r.log('job-order-findable-via-api', !!jobOrderId, JSON.stringify({ commissionType: found?.commissionType, commissionValue: found?.commissionValue }))
    })

    await r.step('create-candidate-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Candidates' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'Add Candidate' }).click()
      await page.waitForTimeout(500)

      const panel = page.locator('div.shadow-sm').filter({ hasText: 'New Candidate' })
      await panel.locator('input').first().fill('E2E Plc Candidate')
      await page.waitForTimeout(300)

      await panel.getByRole('button', { name: 'Save Candidate' }).click()
      await page.waitForTimeout(1200)
      r.log('candidate-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'placement-candidate-created')
    })

    let candidateId

    await r.step('verify-candidate-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.candidate.list({}))
      const candidates = listRes?.data || []
      const found = candidates.find((c) => c.fullName === 'E2E Plc Candidate')
      candidateId = found?.id
      r.log('candidate-findable-via-api', !!candidateId, JSON.stringify({ status: found?.status }))
    })

    await r.step('create-placement-with-auto-computed-commission', async () => {
      if (!jobOrderId || !candidateId) return r.log('create-placement-with-auto-computed-commission', false, 'missing prerequisite id')

      await page.getByRole('button', { name: 'Placements' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'New Placement' }).click()
      await page.waitForTimeout(500)

      const panel = page.locator('div.shadow-sm').filter({ hasText: 'New Placement' })
      await panel.getByLabel('Candidate').selectOption(candidateId)
      await panel.getByLabel('Job Order').selectOption(jobOrderId)
      await page.waitForTimeout(300)

      const dateInput = panel.locator('input[type="date"]').first()
      await dateInput.fill(new Date().toISOString().slice(0, 10))

      // Offered Salary is the first number input, Commission Amount the second.
      const numberInputs = panel.locator('input[type="number"]')
      await numberInputs.first().fill('50000')
      await page.waitForTimeout(500)

      const commissionAmountValue = await numberInputs.nth(1).inputValue()
      r.log('commission-auto-computed-correctly', Number(commissionAmountValue) === 60000, `expected=60000 actual=${commissionAmountValue}`)
      await h.shot(page, 'placement-commission-autocomputed')

      await panel.getByRole('button', { name: 'Save Placement' }).click()
      await page.waitForTimeout(1200)
      r.log('placement-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let placementId

    await r.step('verify-placement-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.placement.list({}))
      const placements = listRes?.data || []
      const found = placements.find((p) => p.candidateId === candidateId && p.jobOrderId === jobOrderId)
      placementId = found?.id
      r.log('placement-findable-via-api', !!placementId, JSON.stringify({ commissionAmount: found?.commissionAmount, status: found?.status }))
      r.log('placement-commission-persisted-correctly', Number(found?.commissionAmount) === 60000, JSON.stringify(found?.commissionAmount))
    })

    await r.step('mark-joined-and-generate-invoice', async () => {
      if (!placementId) return r.log('mark-joined-and-generate-invoice', false, 'no placementId captured')

      const updRes = await page.evaluate((id) => window.api.placement.update({ id, status: 'JOINED' }), placementId)
      r.log('placement-marked-joined', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      const invRes = await page.evaluate((id) => window.api.placement.generateInvoice(id), placementId)
      r.log('placement-invoice-generated', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      if (invRes?.success) {
        const fullInv = await page.evaluate((id) => window.api.billing.getInvoice(id), invRes.data.invoiceId)
        const expectedTotal = 60000 * 1.18
        r.log('invoice-total-correct', Math.abs((fullInv?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${fullInv?.data?.totalAmount}`)
      }

      const retryRes = await page.evaluate((id) => window.api.placement.generateInvoice(id), placementId)
      r.log('double-invoicing-placement-rejected', retryRes?.success === false && retryRes?.error?.code === 'PLC-003', JSON.stringify(retryRes?.error))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PLACEMENT_AGENCY') {
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
      const plcIds = db.prepare("SELECT p.id FROM Placement p JOIN Candidate c ON c.id = p.candidateId WHERE c.fullName LIKE 'E2E Plc%'").all().map((r2) => r2.id)
      for (const id of plcIds) { try { db.prepare('DELETE FROM Placement WHERE id = ?').run(id) } catch { /* left in place — post-invoice, expected */ } }
      const joIds = db.prepare("SELECT id FROM JobOrder WHERE jobTitle LIKE 'E2E Plc%'").all().map((r2) => r2.id)
      for (const id of joIds) { try { db.prepare('DELETE FROM JobOrder WHERE id = ?').run(id) } catch { /* noop */ } }
      const candIds = db.prepare("SELECT id FROM Candidate WHERE fullName LIKE 'E2E Plc%'").all().map((r2) => r2.id)
      for (const id of candIds) { try { db.prepare('DELETE FROM Candidate WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: placements', plcIds.length, 'jobOrders', joIds.length, 'candidates', candIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPLACEMENT AGENCY VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
