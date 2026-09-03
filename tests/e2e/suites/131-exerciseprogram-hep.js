/**
 * Suite 131 — exerciseProgram.upsert/markPrinted (whole file, zero prior
 * coverage) — broader-gap-list "Nested sub-feature gaps", 2026-09-03.
 * Gap-list mislabeled this "Gym" -- exercise-program.handler.ts is actually
 * the Physiotherapy Clinic's Home Exercise Program (HEP) feature, on
 * PhysioPatientScreen.tsx's "Exercise Program" tab.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E HEP'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-physio-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Physiotherapy Clinic')
      r.log('business-type-switched', sw.to === 'PHYSIO_CLINIC', JSON.stringify(sw))
    })

    let patientId
    const patientName = `${TEST_PREFIX} Patient ${suffix}`
    await r.step('create-patient', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), patientName)
      patientId = custRes?.data?.id
      r.log('patient-created', !!patientId, JSON.stringify(custRes?.error || ''))
    })

    await r.step('add-exercise-and-save-program-via-ui', async () => {
      await h.gotoHash(page, `#/physio/patient/${patientId}`)
      await page.waitForTimeout(800)
      r.log('physio-patient-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Exercise Program' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Add Exercise' }).click()
      await page.waitForTimeout(300)

      const exerciseName = `${TEST_PREFIX} Knee Extension`
      const row = page.locator('.space-y-3 > div', { has: page.getByPlaceholder('Exercise name (e.g. Knee extension)') }).first()
      await row.getByPlaceholder('Exercise name (e.g. Knee extension)').fill(exerciseName)
      await row.getByPlaceholder('How to perform (starting position, movement, tips)...').fill('Sit on chair, extend knee slowly, hold, lower.')
      const numInputs = row.locator('.grid.grid-cols-4 input')
      await numInputs.nth(0).fill('3')
      await numInputs.nth(1).fill('12')
      await numInputs.nth(2).fill('5s')
      await numInputs.nth(3).fill('2x/day')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Save Program' }).click()
      await page.waitForTimeout(1200)
      r.log('save-program-no-crash', !(await h.hasErrorBoundary(page)))

      const res = await page.evaluate((pid) => window.api.exerciseProgram.getActive({ patientId: pid }), patientId)
      const exercises = res?.data ? JSON.parse(res.data.exercises || '[]') : []
      const found = exercises.find((e) => e.name === exerciseName)
      r.log('program-persisted', !!res?.data?.id && !!found && found.sets === '3' && found.reps === '12', JSON.stringify(res?.data))
    })

    await r.step('print-hep-via-ui', async () => {
      const beforeRes = await page.evaluate((pid) => window.api.exerciseProgram.getActive({ patientId: pid }), patientId)
      r.log('not-yet-printed', !beforeRes?.data?.printedAt, JSON.stringify(beforeRes?.data))

      await page.getByRole('button', { name: 'Print HEP' }).click()
      await page.waitForTimeout(500)
      r.log('preview-modal-opens', await page.locator('p', { hasText: 'Home Exercise Program — Preview' }).count() > 0)

      // Not clicking the modal's real "Print" button -- it calls
      // window.print(), which opens Electron's native OS print dialog and
      // blocks the whole app/test run until manually dismissed. Close the
      // preview instead and call markPrinted directly (matches the
      // exerciseProgram.upsert flow above, which already proves the real
      // "Print HEP" UI trigger opens the correct preview).
      const modal = page.locator('div.fixed.inset-0.z-50').last()
      await modal.getByRole('button', { name: '✕' }).click()
      await page.waitForTimeout(400)

      const beforeId = beforeRes?.data?.id
      const markRes = await page.evaluate((id) => window.api.exerciseProgram.markPrinted({ id }), beforeId)
      r.log('mark-printed-api-succeeds', !!markRes?.success, JSON.stringify(markRes?.error || ''))

      const afterRes = await page.evaluate((pid) => window.api.exerciseProgram.getActive({ patientId: pid }), patientId)
      r.log('marked-printed', !!afterRes?.data?.printedAt, JSON.stringify(afterRes?.data))
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
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let programs = 0, custs = 0
      for (const cid of custIds) {
        try { programs += db.prepare('DELETE FROM ExerciseProgram WHERE patientId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ programs, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nEXERCISE PROGRAM (HEP): ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
