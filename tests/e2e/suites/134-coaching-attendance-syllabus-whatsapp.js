/**
 * Suite 134 — coachingAttendance.* (whole file) + syllabusTopic.* (whole
 * file) + coachingProgress.sendWhatsApp (broader-gap-list "Nested
 * sub-feature gaps", 2026-09-03). Coaching Institute vertical. Batch/
 * student/enrollment creation already covered via real UI (suite 39) --
 * seeded via API here to focus on the actually-untested channels.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Coach134'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-coaching-institute', async () => {
      const sw = await h.switchBusinessType(page, 'Coaching / Tuition Institute')
      r.log('business-type-switched', sw.to === 'COACHING_INSTITUTE', JSON.stringify(sw))
    })

    let customerId, batchId, enrollmentId
    const batchName = `${TEST_PREFIX} Batch ${suffix}`
    const studentName = `${TEST_PREFIX} Student ${suffix}`
    await r.step('seed-student-batch-enrollment-via-api', async () => {
      const stuRes = await page.evaluate(async ({ name, phone }) => window.api.student.create({
        customerName: name, classOrGrade: 'Class 10', phone,
      }), { name: studentName, phone: `9${String(Date.now()).slice(-9)}` })
      customerId = stuRes?.data?.customerId
      r.log('student-created', !!customerId, JSON.stringify(stuRes?.error || ''))

      const today = h.toLocalISODate(new Date())
      const batchRes = await page.evaluate(({ name, today }) => window.api.coachingBatch.create({
        batchName: name, subjectOrCourse: 'Mathematics', feePerMonth: 2000, startDate: today, status: 'ACTIVE',
      }), { name: batchName, today })
      batchId = batchRes?.data?.id
      r.log('batch-created', !!batchId, JSON.stringify(batchRes?.error || ''))

      if (customerId && batchId) {
        const enrRes = await page.evaluate(({ bid, sid }) => window.api.enrollment.create({
          batchId: bid, studentId: sid, effectiveFee: 2000,
        }), { bid: batchId, sid: customerId })
        enrollmentId = enrRes?.data?.id
        r.log('enrollment-created', !!enrollmentId, JSON.stringify(enrRes?.error || ''))
      }
    })

    let topicId
    const topicName = `${TEST_PREFIX} Algebra Basics`
    await r.step('add-toggle-delete-syllabus-topic-via-ui', async () => {
      if (!batchId) return r.log('add-toggle-delete-syllabus-topic-via-ui', false, 'no batchId')
      await h.gotoHash(page, '#/coaching/batches')
      await page.waitForTimeout(700)
      r.log('batches-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('div.rounded-xl.overflow-hidden', { hasText: batchName }).first()
      await row.locator('button').first().click()
      await page.waitForTimeout(500)
      await row.getByRole('button', { name: 'Syllabus' }).click()
      await page.waitForTimeout(500)

      await row.getByPlaceholder('Add a topic...').fill(topicName)
      await row.locator('button', { hasText: 'Add' }).click()
      await page.waitForTimeout(900)
      r.log('topic-add-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((bid) => window.api.syllabusTopic.list({ batchId: bid }), batchId)
      let topic = (listRes?.data || []).find((t) => t.topicName === topicName)
      topicId = topic?.id
      r.log('topic-persisted', !!topicId && topic?.status === 'PENDING', JSON.stringify(topic))
      if (!topicId) return

      const freshRow = page.locator('div.rounded-xl.overflow-hidden', { hasText: batchName }).first()
      const topicRow = freshRow.locator('div.flex.items-center.gap-2.group', { hasText: topicName }).first()
      await topicRow.locator('button').first().click()
      await page.waitForTimeout(800)
      r.log('topic-toggle-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((bid) => window.api.syllabusTopic.list({ batchId: bid }), batchId)
      topic = (listRes?.data || []).find((t) => t.id === topicId)
      r.log('topic-actually-toggled', topic?.status === 'COMPLETED', JSON.stringify(topic))

      const progressRes = await page.evaluate((bid) => window.api.syllabusTopic.progress({ batchId: bid }), batchId)
      r.log('syllabus-progress-reflects-completion', progressRes?.data?.completed >= 1, JSON.stringify(progressRes?.data))

      await topicRow.locator('button').last().click()
      await page.waitForTimeout(800)
      r.log('topic-delete-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((bid) => window.api.syllabusTopic.list({ batchId: bid }), batchId)
      r.log('topic-actually-deleted', !(listRes?.data || []).some((t) => t.id === topicId), JSON.stringify(listRes?.data))
    })

    await r.step('mark-attendance-via-ui', async () => {
      if (!batchId) return r.log('mark-attendance-via-ui', false, 'no batchId')
      await h.gotoHash(page, '#/coaching/attendance')
      await page.waitForTimeout(700)
      r.log('attendance-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const batchOptionText = await page.getByLabel('Batch').locator('option', { hasText: batchName }).first().textContent()
      await page.getByLabel('Batch').selectOption({ label: (batchOptionText || '').trim() })
      await page.waitForTimeout(700)

      const studentRow = page.locator('div.flex.items-center.gap-4', { hasText: studentName }).first()
      r.log('student-row-present', await studentRow.count() > 0)
      await studentRow.click()
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: /Save Attendance/ }).click()
      await page.waitForTimeout(1200)
      r.log('attendance-save-no-crash', !(await h.hasErrorBoundary(page)))

      const today = h.toLocalISODate(new Date())
      const getRes = await page.evaluate(({ bid, date }) => window.api.coachingAttendance.get({ batchId: bid, date }), { bid: batchId, date: today })
      const absentIds = getRes?.data ? JSON.parse(getRes.data.absentStudentIds) : []
      r.log('attendance-record-persisted-with-student-marked-absent', absentIds.includes(customerId), JSON.stringify(getRes?.data))

      const datesRes = await page.evaluate((bid) => window.api.coachingAttendance.listDates({ batchId: bid }), batchId)
      r.log('attendance-date-listed', (datesRes?.data || []).some((d) => new Date(d.attendanceDate).toISOString().slice(0, 10) === today), JSON.stringify(datesRes?.data))
    })

    await r.step('send-progress-report-whatsapp-via-ui', async () => {
      if (!enrollmentId) return r.log('send-progress-report-whatsapp-via-ui', false, 'no enrollmentId')
      await h.gotoHash(page, '#/coaching/students')
      await page.waitForTimeout(700)

      const row = page.locator('tr', { hasText: studentName }).first()
      r.log('student-row-present-on-students-screen', await row.count() > 0)
      await row.locator('button[title="Send report card via WhatsApp"]').click()
      await page.waitForTimeout(1000)
      r.log('send-whatsapp-no-crash', !(await h.hasErrorBoundary(page)))

      const sendRes = await page.evaluate((eid) => window.api.coachingProgress.sendWhatsApp({ enrollmentId: eid }), enrollmentId)
      r.log('send-whatsapp-api-succeeds-with-link', !!sendRes?.success && !!sendRes?.data?.link, JSON.stringify(sendRes?.data || sendRes?.error))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'COACHING_INSTITUTE') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const batchIds = db.prepare(`SELECT id FROM CoachingBatch WHERE batchName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let topics = 0, attendance = 0, enrs = 0, batches = 0
      for (const bid of batchIds) {
        try { topics += db.prepare('DELETE FROM SyllabusTopic WHERE batchId = ?').run(bid).changes } catch { /* noop */ }
        try { attendance += db.prepare('DELETE FROM CoachingBatchAttendance WHERE batchId = ?').run(bid).changes } catch { /* noop */ }
        try { enrs += db.prepare('DELETE FROM CoachingBatchEnrollment WHERE batchId = ?').run(bid).changes } catch { /* noop */ }
        try { batches += db.prepare('DELETE FROM CoachingBatch WHERE id = ?').run(bid).changes } catch { /* noop */ }
      }
      const stuIds = db.prepare(`SELECT sp.id AS id FROM StudentProfile sp JOIN Customer c ON c.id = sp.customerId WHERE c.customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let profiles = 0
      for (const id of stuIds) { try { profiles += db.prepare('DELETE FROM StudentProfile WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ topics, attendance, enrs, batches, profiles, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOACHING ATTENDANCE/SYLLABUS/WHATSAPP: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
