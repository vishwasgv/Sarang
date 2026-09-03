/**
 * Suite 147 — Section C medium CRUD gap: visitNotes.update/
 * savePrescriptionItems (create/finalize/referToProvider/listReferrals/
 * get already covered via real UI + API, suites 30/31). Specialist Clinic
 * vertical.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E VN147'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-specialist-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Specialist Clinic')
      r.log('business-type-switched', sw.to === 'SPECIALIST_CLINIC', JSON.stringify(sw))
    })

    let providerId, customerId, appointmentId
    await r.step('create-prerequisites', async () => {
      const joinDate = h.toLocalISODate(new Date())
      const provRes = await page.evaluate(({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `9${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Provider ${suffix}`, joinDate })
      providerId = provRes?.data?.id

      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Patient ${suffix}`)
      customerId = custRes?.data?.id
      r.log('prerequisites-created', !!providerId && !!customerId)

      const scheduledDate = h.toLocalISODate(new Date())
      const apptRes = await page.evaluate(({ providerId, customerId, scheduledDate }) => window.api.appointments.create({
        providerId, customerId, serviceTitle: 'E2E VN147 Consult', scheduledDate, scheduledTime: '11:00', durationMinutes: 30,
      }), { providerId, customerId, scheduledDate })
      appointmentId = apptRes?.data?.id
      r.log('appointment-created', !!appointmentId, JSON.stringify(apptRes?.error || ''))
    })

    await r.step('create-then-update-visit-note-via-ui', async () => {
      if (!appointmentId) return r.log('create-then-update-visit-note-via-ui', false, 'no appointmentId')
      await h.gotoHash(page, `#/clinical/visit/${appointmentId}`)
      await page.waitForTimeout(800)
      r.log('visit-note-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByPlaceholder('Full name').fill(`${TEST_PREFIX} Patient ${suffix}`)
      await page.getByPlaceholder('Reason for visit').fill(`${TEST_PREFIX} initial complaint`)
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: /Save Note/ }).click()
      await page.waitForTimeout(1200)
      r.log('note-created-no-crash', !(await h.hasErrorBoundary(page)))

      let getRes = await page.evaluate((id) => window.api.visitNotes.get({ appointmentId: id }), appointmentId)
      r.log('note-persisted', !!getRes?.data?.id && getRes?.data?.chiefComplaint === `${TEST_PREFIX} initial complaint`, JSON.stringify(getRes?.data))

      await page.getByPlaceholder('Reason for visit').fill(`${TEST_PREFIX} updated complaint`)
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: /Save Note/ }).click()
      await page.waitForTimeout(1200)
      r.log('note-update-no-crash', !(await h.hasErrorBoundary(page)))

      getRes = await page.evaluate((id) => window.api.visitNotes.get({ appointmentId: id }), appointmentId)
      r.log('note-actually-updated', getRes?.data?.chiefComplaint === `${TEST_PREFIX} updated complaint`, JSON.stringify(getRes?.data))
    })

    let visitNoteId
    await r.step('save-prescription-items-via-ui', async () => {
      const getRes = await page.evaluate((id) => window.api.visitNotes.get({ appointmentId: id }), appointmentId)
      visitNoteId = getRes?.data?.id
      if (!visitNoteId) return r.log('save-prescription-items-via-ui', false, 'no visitNoteId')

      await page.getByRole('button', { name: 'Add Drug' }).click()
      await page.waitForTimeout(300)
      const drugRow = page.locator('div.grid', { has: page.getByPlaceholder('e.g. Amoxicillin') }).last()
      await drugRow.getByPlaceholder('e.g. Amoxicillin').fill(`${TEST_PREFIX} Amoxicillin`)
      await drugRow.getByPlaceholder('500mg').fill('500mg')
      await drugRow.getByPlaceholder('1-0-1').fill('1-0-1')
      await drugRow.getByPlaceholder('5 days').fill('5 days')
      await page.waitForTimeout(200)

      await page.getByRole('button', { name: 'Save Prescription' }).click()
      await page.waitForTimeout(1000)
      r.log('save-prescription-no-crash', !(await h.hasErrorBoundary(page)))

      const rxRes = await page.evaluate((id) => window.api.visitNotes.listPrescriptionItems({ visitNoteId: id }), visitNoteId)
      const found = (rxRes?.data || []).find((it) => it.drugName === `${TEST_PREFIX} Amoxicillin`)
      r.log('prescription-item-actually-saved', !!found && found.dosage === '500mg' && found.frequency === '1-0-1', JSON.stringify(found))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'SPECIALIST_CLINIC') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let rxItems = 0, notes = 0, appts = 0, emps = 0, custs = 0
      const noteIds = db.prepare(`SELECT id FROM VisitNote WHERE chiefComplaint LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const nid of noteIds) {
        try { rxItems += db.prepare('DELETE FROM PrescriptionItem WHERE visitNoteId = ?').run(nid).changes } catch { /* noop */ }
        try { notes += db.prepare('DELETE FROM VisitNote WHERE id = ?').run(nid).changes } catch { /* noop */ }
      }
      try { appts += db.prepare(`DELETE FROM Appointment WHERE serviceTitle LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const eid of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(eid).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ rxItems, notes, appts, emps, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nVISIT NOTE UPDATE / PRESCRIPTION: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
