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
      await page.getByLabel('Start Date').fill(h.toLocalISODate(new Date()))
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

    // ── Phase 67 §9.1 item 22.5 gap-closure (2026-08-27) — referring-doctor
    // outcome feedback loop, previously untested anywhere. ─────────────────
    let referringProviderId, receivingProviderId

    await r.step('create-referring-and-receiving-providers', async () => {
      const joinDate = h.toLocalISODate(new Date())
      const p1 = await page.evaluate((joinDate) => window.api.hr.createEmployee({
        fullName: 'E2E Physio Referring Doctor', phone: `8${String(Date.now()).slice(-9)}`, joinDate,
      }), joinDate)
      referringProviderId = p1?.data?.id
      const p2 = await page.evaluate((joinDate) => window.api.hr.createEmployee({
        fullName: 'E2E Physio Receiving Doctor', phone: `7${String(Date.now()).slice(-9)}`, joinDate,
      }), joinDate)
      receivingProviderId = p2?.data?.id
      r.log('providers-created', !!referringProviderId && !!receivingProviderId, JSON.stringify({ p1: p1?.error, p2: p2?.error }))
    })

    let originalNoteId

    await r.step('create-original-visit-note-and-refer-to-second-provider', async () => {
      const originalDate = h.toLocalISODate(new Date(Date.now() - 10 * 24 * 3600000))
      const apptRes = await page.evaluate(({ providerId, patientId, date }) => window.api.appointments.create({
        providerId, customerId: patientId, serviceTitle: 'E2E Physio Initial Consult', scheduledDate: date, scheduledTime: '09:00',
      }), { providerId: referringProviderId, patientId, date: originalDate })
      const originalApptId = apptRes?.data?.id
      r.log('original-appointment-created', !!originalApptId, JSON.stringify(apptRes?.error || ''))
      if (!originalApptId) return

      const noteRes = await page.evaluate(({ appointmentId, patientId }) => window.api.visitNotes.create({
        appointmentId, patientName: 'E2E Physio Patient', assessment: 'E2E Needs specialist physio referral',
      }), { appointmentId: originalApptId, patientId })
      originalNoteId = noteRes?.data?.id
      r.log('original-visit-note-created', !!originalNoteId, JSON.stringify(noteRes?.error || ''))
      if (!originalNoteId) return

      const referDate = h.toLocalISODate(new Date(Date.now() - 7 * 24 * 3600000))
      const referRes = await page.evaluate(({ visitNoteId, providerId, date }) => window.api.visitNotes.referToProvider({
        visitNoteId, providerId, serviceTitle: 'E2E Physio Specialist Referral', scheduledDate: date, scheduledTime: '10:00',
      }), { visitNoteId: originalNoteId, providerId: receivingProviderId, date: referDate })
      r.log('referral-appointment-created', !!referRes?.success, JSON.stringify(referRes?.error || ''))
    })

    await r.step('build-real-pain-functional-score-course-and-finalize', async () => {
      if (!originalNoteId) return r.log('build-real-pain-functional-score-course-and-finalize', false, 'no originalNoteId captured')

      const referralList = await page.evaluate((id) => window.api.visitNotes.listReferrals({ visitNoteId: id }), originalNoteId)
      const referredAppt = (referralList?.data || [])[0]
      r.log('referral-visible-before-finalize-null-outcome', !!referredAppt && referredAppt.outcomeSummary === null, JSON.stringify(referredAppt))

      // First session (the referral visit itself): pain 7, function 40.
      const note1Res = await page.evaluate(({ appointmentId, patientId }) => window.api.visitNotes.create({
        appointmentId, patientName: 'E2E Physio Patient', painScore: 7, functionalScore: 40, assessment: 'E2E Initial physio assessment',
      }), { appointmentId: referredAppt?.id, patientId })
      const note1Id = note1Res?.data?.id
      if (note1Id) await page.evaluate((id) => window.api.visitNotes.finalize({ id }), note1Id)
      r.log('first-session-note-created-and-finalized', !!note1Id, JSON.stringify(note1Res?.error || ''))

      // Later follow-up session, same patient: pain down to 3, function up to 75.
      const followUpDate = h.toLocalISODate(new Date())
      const followUpAppt = await page.evaluate(({ providerId, patientId, date }) => window.api.appointments.create({
        providerId, customerId: patientId, serviceTitle: 'E2E Physio Follow-up', scheduledDate: date, scheduledTime: '11:00',
      }), { providerId: receivingProviderId, patientId, date: followUpDate })
      const note2Res = await page.evaluate(({ appointmentId, patientId }) => window.api.visitNotes.create({
        appointmentId, patientName: 'E2E Physio Patient', painScore: 3, functionalScore: 75, assessment: 'E2E Marked improvement',
      }), { appointmentId: followUpAppt?.data?.id, patientId })
      const note2Id = note2Res?.data?.id
      if (note2Id) await page.evaluate((id) => window.api.visitNotes.finalize({ id }), note2Id)
      r.log('follow-up-session-note-created-and-finalized', !!note2Id, JSON.stringify(note2Res?.error || ''))
    })

    await r.step('referral-outcome-summary-shows-real-pain-function-trend', async () => {
      if (!originalNoteId) return r.log('referral-outcome-summary-shows-real-pain-function-trend', false, 'no originalNoteId captured')
      const res = await page.evaluate((id) => window.api.visitNotes.listReferrals({ visitNoteId: id }), originalNoteId)
      const referredAppt = (res?.data || [])[0]
      r.log('outcome-summary-shows-pain-trend-7-to-3', referredAppt?.outcomeSummary?.includes('Pain 7') && referredAppt?.outcomeSummary?.includes('3'), JSON.stringify(referredAppt?.outcomeSummary))
      r.log('outcome-summary-shows-function-trend-40-to-75', referredAppt?.outcomeSummary?.includes('40') && referredAppt?.outcomeSummary?.includes('75'), JSON.stringify(referredAppt?.outcomeSummary))
      r.log('outcome-summary-counts-two-sessions', referredAppt?.outcomeSummary?.includes('2 sessions'), JSON.stringify(referredAppt?.outcomeSummary))
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
    h.withDb((db) => {
      const noteIds = db.prepare("SELECT id FROM VisitNote WHERE patientName LIKE 'E2E Physio%'").all().map((r2) => r2.id)
      for (const id of noteIds) { try { db.prepare('DELETE FROM VisitNote WHERE id = ?').run(id) } catch { /* noop */ } }
      const apptIds = db.prepare("SELECT id FROM Appointment WHERE serviceTitle LIKE 'E2E Physio%'").all().map((r2) => r2.id)
      for (const id of apptIds) { try { db.prepare('DELETE FROM Appointment WHERE id = ?').run(id) } catch { /* noop */ } }
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Physio%'").all().map((r2) => r2.id)
      for (const eid of empIds) { try { db.prepare('DELETE FROM Employee WHERE id = ?').run(eid) } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(eid) } }
      console.log('extra cleanup: visitNotes', noteIds.length, 'appointments', apptIds.length, 'employees', empIds.length)
    })
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
