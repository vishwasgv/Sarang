/**
 * Suite 29 — Dental Clinic vertical (dental_chart, dental_recall). Real
 * UI-driven tooth-condition update and recall-date setting via
 * DentalPatientScreen, navigated directly by patientId (= Customer id) —
 * the shared Appointment-booking flow that normally links to this screen is
 * already covered by suite 02, so this suite focuses on the actual
 * distinguishing feature. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Dental'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-dental-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Dental Clinic')
      r.log('business-type-switched', sw.to === 'DENTAL_CLINIC', JSON.stringify(sw))
    })

    let patientId

    await r.step('create-patient', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Dental Patient', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      patientId = custRes?.data?.id
      r.log('patient-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
    })

    await r.step('update-tooth-condition-via-real-ui', async () => {
      await h.gotoHash(page, `#/dental/patient/${patientId}`)
      await page.waitForTimeout(800)
      r.log('dental-patient-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Tooth Chart' }).click()
      await page.waitForTimeout(400)

      const tooth11 = page.locator('button[title^="Tooth 11"]')
      r.log('tooth-11-button-present', await tooth11.count() > 0)
      await tooth11.click()
      await page.waitForTimeout(400)

      await page.getByRole('button', { name: 'Caries', exact: true }).click()
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Buccal', exact: true }).click()
      await page.getByPlaceholder('Clinical notes for this tooth...').fill('E2E test cavity noted')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Update Tooth' }).click()
      await page.waitForTimeout(1000)
      r.log('tooth-updated-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dental-tooth-updated')
    })

    await r.step('verify-tooth-record-via-api', async () => {
      const res = await page.evaluate((pid) => window.api.toothRecord.getChart({ patientId: pid }), patientId)
      const records = res?.data || []
      const tooth11 = records.find((rec) => rec.toothNumber === 11)
      r.log('tooth-11-record-findable-via-api', !!tooth11, JSON.stringify({ condition: tooth11?.condition, notes: tooth11?.notes }))
      r.log('tooth-11-condition-is-caries', tooth11?.condition === 'CARIES', JSON.stringify(tooth11?.condition))
      const surfaces = tooth11?.surface ? JSON.parse(tooth11.surface) : []
      r.log('tooth-11-surface-includes-buccal', surfaces.includes('BUCCAL'), JSON.stringify(surfaces))
    })

    let treatmentPlanId

    await r.step('create-and-bill-treatment-plan-via-real-ui', async () => {
      // Phase 67 §9.1 items 21.1/21.2 — treatment-plan conversion tracking
      // (billing) + the Treatment Acceptance Rate report that depends on it.
      await page.getByRole('button', { name: 'Treatment Plans' }).click()
      await page.waitForTimeout(400)

      await page.getByRole('button', { name: 'New Plan' }).click()
      await page.waitForTimeout(400)

      await page.getByPlaceholder('e.g. Phase 1 — Caries Control').fill('E2E Dental Root Canal Plan')
      await page.locator('select').filter({ has: page.locator('option[value="ACCEPTED"]') }).selectOption('ACCEPTED')

      await page.getByRole('button', { name: 'Add' }).click()
      await page.waitForTimeout(200)
      await page.locator('input[placeholder="T#"]').fill('14')
      await page.locator('input[placeholder="Procedure name"]').fill('Root Canal')
      await page.locator('input[type="number"]').nth(1).fill('5000')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Create Plan' }).click()
      await page.waitForTimeout(1200)
      r.log('treatment-plan-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dental-treatment-plan-created')

      const listRes = await page.evaluate((pid) => window.api.treatmentPlan.list({ patientId: pid }), patientId)
      const plan = (listRes?.data || []).find((p) => p.title === 'E2E Dental Root Canal Plan')
      treatmentPlanId = plan?.id
      r.log('treatment-plan-findable-via-api', !!treatmentPlanId, JSON.stringify({ status: plan?.status, totalEstimatedCost: plan?.totalEstimatedCost }))
      r.log('treatment-plan-accepted-and-unbilled', plan?.status === 'ACCEPTED' && !plan?.invoiceId, JSON.stringify({ status: plan?.status, invoiceId: plan?.invoiceId }))

      if (treatmentPlanId) {
        const genBtn = page.getByRole('button', { name: 'Generate Invoice' })
        r.log('generate-invoice-button-visible-for-accepted-plan', await genBtn.isVisible().catch(() => false))
        await genBtn.click()
        await page.waitForTimeout(1200)
        r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))
        await h.shot(page, 'dental-treatment-plan-billed')
      }
    })

    await r.step('verify-treatment-plan-billed-via-api', async () => {
      if (!treatmentPlanId) return r.log('verify-treatment-plan-billed-via-api', false, 'no treatmentPlanId captured')
      const res = await page.evaluate((id) => window.api.treatmentPlan.get({ id }), treatmentPlanId)
      const invoiceId = res?.data?.invoiceId
      r.log('treatment-plan-invoiceId-set', !!invoiceId, JSON.stringify({ invoiceId }))

      if (invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        r.log('real-invoice-exists-for-correct-patient', invRes?.data?.customerId === patientId, JSON.stringify({ customerId: invRes?.data?.customerId, totalAmount: invRes?.data?.totalAmount }))
      }

      const billedBadgeVisible = await page.getByText('Billed', { exact: true }).isVisible().catch(() => false)
      r.log('billed-badge-visible-on-screen', billedBadgeVisible)

      // Phase 67 §9.1 item 21.2 — confirm the funnel report actually counts
      // this plan (proposed→accepted→billed), not just that billing worked.
      const rangeRes = await page.evaluate(async () => {
        const now = new Date()
        const from = new Date(now.getFullYear(), now.getMonth(), 1)
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return window.api.reports.treatmentAcceptanceRate({ dateFrom: fmt(from), dateTo: fmt(to) })
      })
      r.log('acceptance-rate-report-counts-this-plan', (rangeRes?.data?.summary?.billedCount ?? 0) >= 1, JSON.stringify(rangeRes?.data?.summary))
    })

    let firstNextRecallDate

    await r.step('view-tooth-chart-linked-treatment-timeline-via-real-ui', async () => {
      // Phase 67 §9.1 item 21.5 — merges ToothRecord condition history with
      // TreatmentPlan procedures that named the same tooth into one
      // timeline. Tooth #14 already has the Root Canal procedure from the
      // treatment plan above; give it a real condition entry too (via API,
      // the condition-update UI flow itself is already covered live for
      // tooth #11 earlier in this suite) so both entry TYPES genuinely
      // exist for the same tooth before checking the merged view.
      const condRes = await page.evaluate((pid) => window.api.toothRecord.upsert({
        patientId: pid, toothNumber: 14, condition: 'ROOT_CANAL', notes: 'E2E post-treatment note',
      }), patientId)
      r.log('tooth-14-condition-set-via-api', !!condRes?.success, JSON.stringify(condRes?.error || ''))

      await page.getByRole('button', { name: 'Tooth Chart' }).click()
      await page.waitForTimeout(400)
      const tooth14 = page.locator('button[title^="Tooth 14"]')
      await tooth14.click()
      await page.waitForTimeout(400)

      await page.getByRole('button', { name: 'History' }).click()
      await page.waitForTimeout(500)
      r.log('tooth-timeline-loads-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dental-tooth-timeline')

      const treatmentEntryVisible = await page.getByText('Treatment Planned').isVisible().catch(() => false)
      r.log('timeline-shows-treatment-entry-on-screen', treatmentEntryVisible)
      const rootCanalConditionVisible = await page.getByText('E2E post-treatment note').isVisible().catch(() => false)
      r.log('timeline-shows-condition-entry-on-screen', rootCanalConditionVisible)

      const timelineRes = await page.evaluate((pid) => window.api.toothRecord.getTimeline({ patientId: pid, toothNumber: 14 }), patientId)
      const entries = timelineRes?.data || []
      const hasCondition = entries.some((e) => e.type === 'CONDITION' && e.condition === 'ROOT_CANAL')
      const hasTreatment = entries.some((e) => e.type === 'TREATMENT' && e.procedure === 'Root Canal')
      r.log('timeline-api-includes-both-condition-and-treatment-entries', hasCondition && hasTreatment, JSON.stringify(entries.map((e) => e.type)))
    })

    await r.step('set-recall-date-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Recall', exact: true }).click()
      await page.waitForTimeout(500)

      const dateInputs = page.locator('input[type="date"]')
      const lastVisit = h.toLocalISODate(new Date())
      const nextRecall = h.toLocalISODate(new Date(Date.now() + 180 * 24 * 3600000))
      firstNextRecallDate = nextRecall
      await dateInputs.nth(0).fill(lastVisit)
      await dateInputs.nth(1).fill(nextRecall)
      await page.waitForTimeout(300)

      const saveBtn = page.getByRole('button', { name: /Set Recall Date|Update Recall/ })
      await saveBtn.click()
      await page.waitForTimeout(1000)
      r.log('recall-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dental-recall-set')
    })

    await r.step('verify-recall-via-api', async () => {
      const res = await page.evaluate((pid) => window.api.recall.get({ patientId: pid }), patientId)
      r.log('recall-fetch-success', !!res?.success)
      r.log('recall-next-date-set', !!res?.data?.nextRecallDate, JSON.stringify(res?.data?.nextRecallDate))
    })

    await r.step('close-out-recall-and-verify-compliance-via-real-ui', async () => {
      // Phase 67 §9.1 item 21.4 — Recall Compliance report. This SECOND
      // update to the SAME patient's recall closes out the period set in
      // the previous step — RecallRecord has no history of its own, so this
      // is the only moment a compliance snapshot can be captured. Returning
      // "today" (well before the 180-day-out due date just set) should log
      // onTime=true.
      const dateInputs = page.locator('input[type="date"]')
      const secondLastVisit = h.toLocalISODate(new Date())
      const secondNextRecall = h.toLocalISODate(new Date(Date.now() + 200 * 24 * 3600000))
      await dateInputs.nth(0).fill(secondLastVisit)
      await dateInputs.nth(1).fill(secondNextRecall)
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Update Recall' }).click()
      await page.waitForTimeout(1000)
      r.log('recall-closed-out-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'dental-recall-closed-out')

      // The compliance log's scheduledDate is the FIRST nextRecallDate
      // (~180 days out) — the range must cover that, not just "this month".
      const rangeRes = await page.evaluate(async (firstDue) => {
        const due = new Date(firstDue)
        const from = new Date(due); from.setDate(from.getDate() - 3)
        const to = new Date(due); to.setDate(to.getDate() + 3)
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return window.api.reports.dentalRecallCompliance({ dateFrom: fmt(from), dateTo: fmt(to) })
      }, firstNextRecallDate)
      r.log('recall-compliance-report-counts-this-closure', (rangeRes?.data?.totalRecallsClosed ?? 0) >= 1, JSON.stringify(rangeRes?.data))
      const hygieneRow = (rangeRes?.data?.byRecallType || []).find((r2) => r2.recallType === 'HYGIENE_6M')
      r.log('recall-compliance-includes-hygiene-6m-on-time', !!hygieneRow && hygieneRow.onTime >= 1, JSON.stringify(hygieneRow))
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDENTAL CLINIC VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
