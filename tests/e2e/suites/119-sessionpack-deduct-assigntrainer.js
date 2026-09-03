/**
 * Suite 119 — sessionPack.deduct/assignTrainer (broader-gap-list Section C,
 * money-critical, 2026-09-03). create/generateInvoice are ALREADY covered
 * via real UI (suite 30) -- confirmed a FALSE POSITIVE for those two.
 * deduct fires automatically when an appointment is marked COMPLETED for a
 * customer with an active pack (AppointmentsScreen.tsx); assignTrainer has
 * its own reassign <select> on PhysioPatientScreen.tsx's pack row.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E PhysioPack'

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

    let patientId, trainerId
    const patientName = `${TEST_PREFIX} Patient ${suffix}`
    await r.step('create-patient-and-trainer', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), patientName)
      patientId = custRes?.data?.id
      r.log('patient-created', !!patientId, JSON.stringify(custRes?.error || ''))

      const joinDate = h.toLocalISODate(new Date())
      const empRes = await page.evaluate(({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `8${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Trainer ${suffix}`, joinDate })
      trainerId = empRes?.data?.id
      r.log('trainer-created', !!trainerId, JSON.stringify(empRes?.error || ''))
    })

    let packId
    await r.step('buy-session-pack-via-ui', async () => {
      await h.gotoHash(page, `#/physio/patient/${patientId}`)
      await page.waitForTimeout(800)
      r.log('physio-patient-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Session Packs' }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Buy Pack' }).click()
      await page.waitForTimeout(400)

      await page.getByLabel('Pack Name').fill(`${TEST_PREFIX} 5-Session Pack`)
      const numberInputs = page.locator('input[type="number"]')
      await numberInputs.nth(0).fill('5')
      await numberInputs.nth(1).fill('2500')
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Save Pack' }).click()
      await page.waitForTimeout(1200)
      r.log('pack-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.sessionPack.list({ customerId: pid }), patientId)
      const found = (listRes?.data || []).find((p) => p.packName === `${TEST_PREFIX} 5-Session Pack`)
      packId = found?.id
      r.log('pack-persisted', !!packId, JSON.stringify(found))
    })

    await r.step('assign-trainer-via-ui', async () => {
      if (!packId) return r.log('assign-trainer-via-ui', false, 'no packId')
      // The pack name also appears in a separate "active pack" summary
      // banner above the list (same text, no ancestor with action buttons)
      // -- scope to the list row's own <p className="... truncate"> to
      // avoid matching the banner's identical-text <p> instead.
      const row = page.locator('p.truncate', { hasText: `${TEST_PREFIX} 5-Session Pack` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      const trainerSelect = row.locator('select')
      r.log('trainer-select-present', await trainerSelect.count() > 0)
      await trainerSelect.selectOption(trainerId)
      await page.waitForTimeout(1000)
      r.log('assign-trainer-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.sessionPack.list({ customerId: pid }), patientId)
      const found = (listRes?.data || []).find((p) => p.id === packId)
      r.log('trainer-actually-assigned', found?.assignedTrainerId === trainerId, JSON.stringify(found))
    })

    await r.step('complete-appointment-and-verify-session-deducted', async () => {
      if (!packId) return r.log('complete-appointment-and-verify-session-deducted', false, 'no packId')
      const today = h.toLocalISODate(new Date())
      const serviceTitle = `${TEST_PREFIX} Session Visit`
      const apptRes = await page.evaluate(({ customerId, today, serviceTitle }) => window.api.appointments.create({
        customerId, serviceTitle, scheduledDate: today, scheduledTime: '14:00',
      }), { customerId: patientId, today, serviceTitle })
      const appointmentId = apptRes?.data?.id
      r.log('appointment-created-via-api', !!appointmentId, JSON.stringify(apptRes?.error || ''))
      if (!appointmentId) return

      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(700)
      const row = () => page.locator('p', { hasText: `${TEST_PREFIX} Session Visit` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row().locator('button', { hasText: 'Mark Confirmed' }).click()
      await page.waitForTimeout(700)
      await row().locator('button', { hasText: 'Mark In Progress' }).click()
      await page.waitForTimeout(700)
      await row().locator('button', { hasText: 'Mark Completed' }).click()
      await page.waitForTimeout(1200)
      r.log('appointment-completed-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.sessionPack.list({ customerId: pid }), patientId)
      const found = (listRes?.data || []).find((p) => p.id === packId)
      r.log('session-deducted', found?.usedSessions === 1, JSON.stringify(found))

      const logsRes = await page.evaluate((id) => window.api.sessionPack.logs({ clientSessionPackId: id }), packId)
      const logged = (logsRes?.data || []).some((l) => l.appointmentId === appointmentId)
      r.log('session-log-references-completed-appointment', logged, JSON.stringify(logsRes?.data))
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
      let logs = 0, packs = 0, appts = 0, custs = 0
      for (const cid of custIds) {
        const packIds = db.prepare('SELECT id FROM ClientSessionPack WHERE customerId = ?').all(cid).map((row) => row.id)
        for (const pid of packIds) {
          try { logs += db.prepare('DELETE FROM SessionLog WHERE clientSessionPackId = ?').run(pid).changes } catch { /* noop */ }
          try { packs += db.prepare('DELETE FROM ClientSessionPack WHERE id = ?').run(pid).changes } catch { /* noop */ }
        }
        try { appts += db.prepare('DELETE FROM Appointment WHERE customerId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let emps = 0
      for (const eid of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(eid).changes } catch { /* noop */ } }
      console.log('extra cleanup:', JSON.stringify({ logs, packs, appts, custs, emps }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSESSION PACK DEDUCT/ASSIGN-TRAINER: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
