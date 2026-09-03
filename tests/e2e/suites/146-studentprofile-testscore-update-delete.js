/**
 * Suite 146 — Section C medium CRUD gap: student.update/delete +
 * studentTestScore.update/delete (create/list already covered via real UI,
 * suite 39). Coaching Institute vertical.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Stu146'

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

    let studentId, studentCustomerId
    const studentName = `${TEST_PREFIX} Student ${suffix}`
    await r.step('seed-student-via-api', async () => {
      const res = await page.evaluate(async (name) => window.api.student.create({
        customerName: name, classOrGrade: 'Class 9',
      }), studentName)
      studentId = res?.data?.id
      studentCustomerId = res?.data?.customerId
      r.log('student-created', !!studentId, JSON.stringify(res?.error || ''))
    })

    await r.step('update-student-via-ui', async () => {
      if (!studentId) return r.log('update-student-via-ui', false, 'no studentId')
      await h.gotoHash(page, '#/coaching/students')
      await page.waitForTimeout(700)
      r.log('students-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('tr', { hasText: studentName }).first()
      await row.locator('button[title="Edit"]').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. Class 10, JEE 2027').fill('Class 10')
      await modal.getByPlaceholder('School or college name').fill(`${TEST_PREFIX} High School`)
      await modal.getByRole('button', { name: 'Update Student' }).click()
      await page.waitForTimeout(900)
      r.log('student-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.student.list({}))
      const found = (listRes?.data || []).find((s) => s.id === studentId)
      r.log('student-actually-updated', found?.classOrGrade === 'Class 10' && found?.schoolName === `${TEST_PREFIX} High School`, JSON.stringify(found))
    })

    let batchId, enrollmentId
    await r.step('seed-batch-and-enrollment-via-api', async () => {
      const batchRes = await page.evaluate(({ name, today }) => window.api.coachingBatch.create({
        batchName: name, subjectOrCourse: 'Science', feePerMonth: 1500, startDate: today, status: 'ACTIVE',
      }), { name: `${TEST_PREFIX} Batch ${suffix}`, today: h.toLocalISODate(new Date()) })
      batchId = batchRes?.data?.id
      r.log('batch-created', !!batchId, JSON.stringify(batchRes?.error || ''))

      if (batchId && studentCustomerId) {
        const enrRes = await page.evaluate(({ bid, sid }) => window.api.enrollment.create({
          batchId: bid, studentId: sid, effectiveFee: 1500,
        }), { bid: batchId, sid: studentCustomerId })
        enrollmentId = enrRes?.data?.id
        r.log('enrollment-created', !!enrollmentId, JSON.stringify(enrRes?.error || ''))
      }
    })

    let testScoreId
    const testName = `${TEST_PREFIX} Unit Test`
    await r.step('seed-test-score-via-api', async () => {
      if (!enrollmentId) return r.log('seed-test-score-via-api', false, 'no enrollmentId')
      const res = await page.evaluate(({ eid, name, today }) => window.api.studentTestScore.create({
        enrollmentId: eid, testName: name, marksObtained: 30, maxMarks: 50, testDate: today,
      }), { eid: enrollmentId, name: testName, today: h.toLocalISODate(new Date()) })
      testScoreId = res?.data?.id
      r.log('test-score-created', !!testScoreId, JSON.stringify(res?.error || ''))
    })

    await r.step('update-test-score-via-ui', async () => {
      if (!testScoreId) return r.log('update-test-score-via-ui', false, 'no testScoreId')
      await h.gotoHash(page, '#/coaching/test-scores')
      await page.waitForTimeout(700)
      r.log('test-scores-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('tr', { hasText: testName }).first()
      await row.locator('button:has(svg.lucide-pen)').click()
      await page.waitForTimeout(400)
      r.log('edit-form-opens-no-crash', !(await h.hasErrorBoundary(page)))
      const modal = h.topModal(page)
      const marksInput = modal.locator('input[type="number"]').nth(0)
      await marksInput.fill('45')
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Update', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('test-score-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.studentTestScore.list({}))
      const found = (listRes?.data || []).find((s) => s.id === testScoreId)
      r.log('test-score-actually-updated', found?.marksObtained === 45, JSON.stringify(found))
    })

    await r.step('delete-test-score-via-ui', async () => {
      if (!testScoreId) return r.log('delete-test-score-via-ui', false, 'no testScoreId')
      const row = page.locator('tr', { hasText: testName }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('test-score-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.studentTestScore.list({}))
      r.log('test-score-actually-deleted', !(listRes?.data || []).some((s) => s.id === testScoreId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('delete-student-via-ui', async () => {
      if (!studentId) return r.log('delete-student-via-ui', false, 'no studentId')
      await h.gotoHash(page, '#/coaching/students')
      await page.waitForTimeout(700)

      const row = page.locator('tr', { hasText: studentName }).first()
      await row.locator('button[title="Remove"]').click()
      await page.waitForTimeout(400)
      // Not page-wide -- the row's own icon-only trigger button also has
      // accessible name "Remove" (via its title attribute), colliding with
      // the confirm dialog's button of the same name.
      await h.topModal(page).getByRole('button', { name: 'Remove', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('student-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.student.list({}))
      r.log('student-actually-deleted', !(listRes?.data || []).some((s) => s.id === studentId), JSON.stringify(listRes?.data?.length))
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
      let testScores = 0, enrs = 0, batches = 0, profiles = 0, custs = 0
      try { testScores += db.prepare(`SELECT sts.id AS id FROM StudentTestScore sts JOIN CoachingBatchEnrollment cbe ON cbe.id = sts.enrollmentId JOIN CoachingBatch cb ON cb.id = cbe.batchId WHERE cb.batchName LIKE '${TEST_PREFIX}%'`).all().length } catch { /* noop */ }
      const batchIds = db.prepare(`SELECT id FROM CoachingBatch WHERE batchName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const bid of batchIds) {
        const enrIds = db.prepare('SELECT id FROM CoachingBatchEnrollment WHERE batchId = ?').all(bid).map((row) => row.id)
        for (const eid of enrIds) { try { db.prepare('DELETE FROM StudentTestScore WHERE enrollmentId = ?').run(eid) } catch { /* noop */ } }
        try { enrs += db.prepare('DELETE FROM CoachingBatchEnrollment WHERE batchId = ?').run(bid).changes } catch { /* noop */ }
        try { batches += db.prepare('DELETE FROM CoachingBatch WHERE id = ?').run(bid).changes } catch { /* noop */ }
      }
      const stuIds = db.prepare(`SELECT sp.id AS id FROM StudentProfile sp JOIN Customer c ON c.id = sp.customerId WHERE c.customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of stuIds) { try { profiles += db.prepare('DELETE FROM StudentProfile WHERE id = ?').run(id).changes } catch { /* noop */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ testScores, enrs, batches, profiles, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSTUDENT PROFILE / TEST SCORE UPDATE-DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
