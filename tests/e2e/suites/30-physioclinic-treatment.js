/**
 * Suite 30 — Physio Clinic vertical (physio_notes, session_packs). Real
 * UI-driven treatment-phase creation and session-pack purchase +
 * invoicing via PhysioPatientScreen. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Physio'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-physio-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Physiotherapy Clinic')
      r.log('business-type-switched', sw.to === 'PHYSIO_CLINIC', JSON.stringify(sw))
    })

    let patientId

    await r.step('create-patient', async () => {
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Physio Patient', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      patientId = custRes?.data?.id
      r.log('patient-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
    })

    await r.step('create-treatment-phase-via-real-ui', async () => {
      await h.gotoHash(page, `#/physio/patient/${patientId}`)
      await page.waitForTimeout(800)
      r.log('physio-patient-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Treatment' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'New Phase' }).click()
      await page.waitForTimeout(400)

      await page.getByLabel('Phase Title').fill('E2E Physio Post-op Rehab')
      await page.getByLabel('Start Date').fill(new Date().toISOString().slice(0, 10))
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Save Phase' }).click()
      await page.waitForTimeout(1200)
      r.log('phase-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'physio-phase-created')
    })

    await r.step('verify-phase-via-api', async () => {
      const listRes = await page.evaluate((pid) => window.api.treatmentPhase.list({ patientId: pid }), patientId)
      const phases = listRes?.data || []
      const found = phases.find((p) => p.title === 'E2E Physio Post-op Rehab')
      r.log('phase-findable-via-api', !!found, JSON.stringify({ phase: found?.phase, status: found?.status }))
    })

    await r.step('buy-session-pack-via-real-ui', async () => {
      await page.getByRole('button', { name: 'Session Packs' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Buy Pack' }).click()
      await page.waitForTimeout(400)

      await page.getByLabel('Pack Name').fill('E2E Physio 10-Session Pack')
      // "Number of Sessions" and "Pack Price" are raw <label> (no htmlFor) —
      // both are the first two number inputs in this panel.
      const numberInputs = page.locator('input[type="number"]')
      await numberInputs.nth(0).fill('10')
      await numberInputs.nth(1).fill('5000')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Save Pack' }).click()
      await page.waitForTimeout(1200)
      r.log('pack-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'physio-pack-created')
    })

    let packId

    await r.step('verify-pack-via-api', async () => {
      const listRes = await page.evaluate((pid) => window.api.sessionPack.list({ customerId: pid }), patientId)
      const packs = listRes?.data || []
      const found = packs.find((p) => p.packName === 'E2E Physio 10-Session Pack')
      packId = found?.id
      r.log('pack-findable-via-api', !!packId, JSON.stringify({ totalSessions: found?.totalSessions, pricePerPack: found?.pricePerPack }))
    })

    await r.step('generate-pack-invoice-via-real-ui', async () => {
      if (!packId) return r.log('generate-pack-invoice-via-real-ui', false, 'no packId captured')
      const genBtn = page.locator('button[title="Generate Invoice"]').first()
      r.log('generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generation-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!packId) return r.log('verify-invoice-via-api', false, 'no packId captured')
      const listRes = await page.evaluate((pid) => window.api.sessionPack.list({ customerId: pid }), patientId)
      const packs = listRes?.data || []
      const found = packs.find((p) => p.id === packId)
      r.log('pack-has-invoice-id', !!found?.invoiceId, JSON.stringify(found?.invoiceId))
      if (found?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), found.invoiceId)
        const expectedTotal = 5000 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PHYSIO_CLINIC') {
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
    console.log(`\nPHYSIO CLINIC VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
