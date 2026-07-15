/**
 * Suite 31 — Specialist Clinic vertical (specialist_referral, token_queue).
 * Real UI-driven visit-note creation and the real in-app "Refer to Another
 * Provider" action (books a genuine new Appointment, distinct from the
 * free-text "Referred By" inbound fields), plus the Token Queue walk-in
 * flow. Appointment booking itself is created via direct API (already
 * covered live-UI by suite 02) — this suite focuses on the distinguishing
 * feature. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Spec'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-specialist-clinic', async () => {
      const sw = await h.switchBusinessType(page, 'Specialist Clinic')
      r.log('business-type-switched', sw.to === 'SPECIALIST_CLINIC', JSON.stringify(sw))
    })

    let providerId, provider2Id, customerId, appointmentId

    await r.step('create-prerequisites', async () => {
      const p1Res = await page.evaluate(async () => window.api.hr.createEmployee({
        fullName: 'E2E Spec Provider One', phone: `9${String(Date.now()).slice(-9)}`, joinDate: new Date().toISOString().slice(0, 10),
      }))
      providerId = p1Res?.data?.id
      const p2Res = await page.evaluate(async () => window.api.hr.createEmployee({
        fullName: 'E2E Spec Provider Two', phone: `8${String(Date.now()).slice(-9)}`, joinDate: new Date().toISOString().slice(0, 10),
      }))
      provider2Id = p2Res?.data?.id
      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Spec Patient', phone: `7${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('prerequisites-created', !!providerId && !!provider2Id && !!customerId)

      const apptRes = await page.evaluate(async ({ providerId, customerId }) => window.api.appointments.create({
        providerId, customerId, serviceTitle: 'E2E Spec Consult',
        scheduledDate: new Date().toISOString().slice(0, 10), scheduledTime: '11:00', durationMinutes: 30,
      }), { providerId, customerId })
      appointmentId = apptRes?.data?.id
      r.log('appointment-created', !!appointmentId, JSON.stringify(apptRes?.error || ''))
    })

    await r.step('create-and-save-visit-note-via-real-ui', async () => {
      if (!appointmentId) return r.log('create-and-save-visit-note-via-real-ui', false, 'no appointmentId captured')
      await h.gotoHash(page, `#/clinical/visit/${appointmentId}`)
      await page.waitForTimeout(800)
      r.log('visit-note-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByPlaceholder('Full name').fill('E2E Spec Patient')
      await page.getByPlaceholder('Reason for visit').fill('E2E test chest pain complaint')
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: /Save Note/ }).click()
      await page.waitForTimeout(1200)
      r.log('note-saved-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'specialist-note-saved')
    })

    let visitNoteId

    await r.step('verify-note-via-api', async () => {
      const res = await page.evaluate((id) => window.api.visitNotes.get({ appointmentId: id }), appointmentId)
      visitNoteId = res?.data?.id
      r.log('note-findable-via-api', !!visitNoteId, JSON.stringify({ patientName: res?.data?.patientName, chiefComplaint: res?.data?.chiefComplaint }))
    })

    await r.step('refer-to-another-provider-via-real-ui', async () => {
      if (!visitNoteId) return r.log('refer-to-another-provider-via-real-ui', false, 'no visitNoteId captured')

      await page.getByRole('button', { name: '+ Refer to Provider' }).click()
      await page.waitForTimeout(500)

      const referSection = page.locator('div.rounded-2xl').filter({ hasText: 'Refer to Another Provider' })
      await referSection.locator('select').first().selectOption(provider2Id)
      const referDate = new Date(Date.now() + 3 * 24 * 3600000).toISOString().slice(0, 10)
      await referSection.locator('input[type="date"]').first().fill(referDate)
      await referSection.locator('input[type="time"]').first().fill('14:00')
      await page.waitForTimeout(300)

      await referSection.getByRole('button', { name: 'Book Referral' }).click()
      await page.waitForTimeout(1200)
      r.log('referral-booked-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'specialist-referral-booked')
    })

    await r.step('verify-referral-created-real-appointment', async () => {
      if (!visitNoteId) return r.log('verify-referral-created-real-appointment', false, 'no visitNoteId captured')
      const res = await page.evaluate((id) => window.api.visitNotes.listReferrals({ visitNoteId: id }), visitNoteId)
      const referrals = res?.data || []
      r.log('referral-findable-via-api', referrals.length > 0, JSON.stringify(referrals.length))

      if (referrals.length > 0) {
        // listReferralsForVisitNote() returns real Appointment rows directly
        // (id = the referred appointment's own id, provider = the picked one).
        r.log('referral-created-a-real-appointment-with-provider-two', referrals[0].provider?.id === provider2Id, JSON.stringify(referrals[0].provider))
        r.log('referral-service-title-defaulted-correctly', referrals[0].serviceTitle === 'Specialist Referral', JSON.stringify(referrals[0].serviceTitle))
      }
    })

    await r.step('token-queue-walk-in-via-real-ui', async () => {
      await h.gotoHash(page, '#/clinical/queue')
      await page.waitForTimeout(700)
      r.log('token-queue-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Walk-in' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Full name').fill('E2E Spec Walkin Patient')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Issue Token' }).click()
      await page.waitForTimeout(1200)
      r.log('token-issued-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'specialist-token-issued')
    })

    await r.step('verify-token-via-api', async () => {
      const res = await page.evaluate(async () => window.api.tokenQueue.today({}))
      const tokens = res?.data || []
      const found = tokens.find((t) => t.patientName === 'E2E Spec Walkin Patient')
      r.log('token-findable-via-api', !!found, JSON.stringify({ status: found?.status, tokenNumber: found?.tokenNumber }))
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Spec%'").all().map((r2) => r2.id)
      for (const eid of empIds) { try { db.prepare('DELETE FROM Employee WHERE id = ?').run(eid) } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(eid) } }
      const apptIds = db.prepare("SELECT id FROM Appointment WHERE serviceTitle LIKE 'E2E Spec%'").all().map((r2) => r2.id)
      for (const aid of apptIds) { try { db.prepare('DELETE FROM Appointment WHERE id = ?').run(aid) } catch { /* noop */ } }
      const tokenIds = db.prepare("SELECT id FROM TokenQueue WHERE patientName LIKE 'E2E Spec%'").all().map((r2) => r2.id)
      for (const tid of tokenIds) { try { db.prepare('DELETE FROM TokenQueue WHERE id = ?').run(tid) } catch { /* noop */ } }
      console.log('extra cleanup: employees', empIds.length, 'appointments', apptIds.length, 'tokens', tokenIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSPECIALIST CLINIC VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
