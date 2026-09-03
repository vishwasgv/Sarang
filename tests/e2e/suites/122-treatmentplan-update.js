/**
 * Suite 122 — treatmentPlan.update (broader-gap-list Section C). create and
 * generateInvoice are ALREADY covered via real UI (suite 29) -- confirmed a
 * FALSE POSITIVE for those two. Only the "Edit plan" -> "Update Plan" flow
 * had zero coverage.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E DentalUpd'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-dental-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Dental Clinic')
      r.log('business-type-switched', sw.to === 'DENTAL_CLINIC', JSON.stringify(sw))
    })

    let patientId
    await r.step('create-patient', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Patient ${suffix}`)
      patientId = custRes?.data?.id
      r.log('patient-created', !!patientId, JSON.stringify(custRes?.error || ''))
    })

    const planTitle = `${TEST_PREFIX} Plan ${suffix}`
    let planId
    await r.step('create-treatment-plan-via-ui', async () => {
      await h.gotoHash(page, `#/dental/patient/${patientId}`)
      await page.waitForTimeout(800)
      r.log('dental-patient-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Treatment Plans' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'New Plan' }).click()
      await page.waitForTimeout(400)

      await page.getByPlaceholder('e.g. Phase 1 — Caries Control').fill(planTitle)
      await page.getByRole('button', { name: 'Add' }).click()
      await page.waitForTimeout(200)
      await page.locator('input[placeholder="Procedure name"]').fill('Scaling')
      await page.locator('input[type="number"]').nth(1).fill('1500')
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Create Plan' }).click()
      await page.waitForTimeout(1200)
      r.log('plan-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.treatmentPlan.list({ patientId: pid }), patientId)
      const plan = (listRes?.data || []).find((p) => p.title === planTitle)
      planId = plan?.id
      r.log('plan-persisted', !!planId, JSON.stringify(plan))
    })

    const updatedTitle = `${TEST_PREFIX} Plan Updated ${suffix}`
    await r.step('edit-treatment-plan-via-ui', async () => {
      if (!planId) return r.log('edit-treatment-plan-via-ui', false, 'no planId')
      await page.locator('button', { hasText: 'Edit plan' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('e.g. Phase 1 — Caries Control').fill(updatedTitle)
      await modal.locator('select').filter({ has: page.locator('option[value="ACCEPTED"]') }).selectOption('ACCEPTED')
      await modal.getByRole('button', { name: 'Add' }).click()
      await page.waitForTimeout(200)
      const procedureInputs = modal.locator('input[placeholder="Procedure name"]')
      await procedureInputs.last().fill('Fluoride Treatment')
      await modal.locator('input[type="number"]').last().fill('800')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Update Plan' }).click()
      await page.waitForTimeout(1200)
      r.log('plan-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.treatmentPlan.list({ patientId: pid }), patientId)
      const plan = (listRes?.data || []).find((p) => p.id === planId)
      const items = plan ? JSON.parse(plan.planItems) : []
      r.log('plan-update-persisted', plan?.title === updatedTitle && plan?.status === 'ACCEPTED', JSON.stringify(plan))
      r.log('plan-second-item-added', items.length === 2 && items.some((i) => i.procedure === 'Fluoride Treatment' && Number(i.estimatedCost) === 800), JSON.stringify(items))
      r.log('plan-total-recomputed', Number(plan?.totalEstimatedCost) === 2300, JSON.stringify(plan?.totalEstimatedCost))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'DENTAL_CLINIC') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let plans = 0, custs = 0
      for (const cid of custIds) {
        try { plans += db.prepare('DELETE FROM TreatmentPlan WHERE patientId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ plans, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTREATMENT PLAN UPDATE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
