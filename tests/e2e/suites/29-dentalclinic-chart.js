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

    await r.step('set-recall-date-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Recall', exact: true }).click()
      await page.waitForTimeout(500)

      const dateInputs = page.locator('input[type="date"]')
      const lastVisit = new Date().toISOString().slice(0, 10)
      const nextRecall = new Date(Date.now() + 180 * 24 * 3600000).toISOString().slice(0, 10)
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
