/**
 * Suite 105 — performance.handler.ts (Coaching Institute "Performances &
 * Recitals" screen — music/dance academy showcase events, not HR reviews
 * despite the broader-gap-list's initial mis-description) (broader-gap-list
 * closure, 2026-09-03). Zero coverage of create/update/delete. Batch +
 * student + enrollment set up via direct API (already covered live-UI in
 * suite 39) so this suite can focus on the actual gap.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Perf'

async function fillByLabel(scope, labelText, value) {
  await scope.locator('label', { hasText: labelText }).first().locator('xpath=following-sibling::*[self::input or self::textarea][1]').fill(value)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-coaching-institute', async () => {
      const sw = await h.switchBusinessType(page, 'Coaching / Tuition Institute')
      r.log('business-type-switched', sw.to === 'COACHING_INSTITUTE', JSON.stringify(sw))
    })

    let batchId, studentCustomerId
    await r.step('seed-batch-student-enrollment-via-api', async () => {
      const startDate = h.toLocalISODate(new Date())
      const batchRes = await page.evaluate(async ({ name, startDate }) => window.api.coachingBatch.create({
        batchName: name, subjectOrCourse: 'Carnatic Vocal', startDate, feePerMonth: 1500,
      }), { name: `${TEST_PREFIX} Batch ${Date.now()}`, startDate })
      batchId = batchRes?.data?.id
      r.log('batch-created', !!batchId, JSON.stringify(batchRes?.error || ''))

      const stuRes = await page.evaluate(async (name) => window.api.student.create({ customerName: name, classOrGrade: 'Class 8' }), `${TEST_PREFIX} Student ${Date.now()}`)
      studentCustomerId = stuRes?.data?.customerId
      r.log('student-created', !!studentCustomerId, JSON.stringify(stuRes?.error || ''))

      if (batchId && studentCustomerId) {
        const enrRes = await page.evaluate(({ bid, sid }) => window.api.enrollment.create({ batchId: bid, studentId: sid, effectiveFee: 1500 }), { bid: batchId, sid: studentCustomerId })
        r.log('enrollment-created', !!enrRes?.success, JSON.stringify(enrRes?.error || ''))
      }
    })

    let performanceId
    await r.step('create-performance-via-ui', async () => {
      await h.gotoHash(page, '#/coaching/performances')
      await page.waitForTimeout(700)
      r.log('performances-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Performance' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Batch').selectOption(batchId)
      await page.waitForTimeout(400)
      await fillByLabel(modal, 'Performance Name *', 'E2E Annual Recital')
      await fillByLabel(modal, 'Venue', 'E2E Test Auditorium')
      const studentCheckbox = modal.locator('label', { hasText: `${TEST_PREFIX} Student` }).locator('input[type="checkbox"]')
      if (await studentCheckbox.count()) await studentCheckbox.check()
      await modal.getByRole('button', { name: 'Add Performance', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('performance-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((bid) => window.api.performance.list({ batchId: bid }), batchId)
      const found = (listRes?.data || []).find((p) => p.performanceName === 'E2E Annual Recital')
      performanceId = found?.id
      r.log('performance-persisted', !!performanceId, JSON.stringify(found))
      r.log('performance-has-our-participant', found ? JSON.parse(found.participatingStudentIds).includes(studentCustomerId) : false, JSON.stringify(found?.participatingStudentIds))
    })

    await r.step('update-performance-via-ui', async () => {
      if (!performanceId) return r.log('update-performance-via-ui', false, 'no performanceId')
      const row = page.locator('p', { hasText: 'E2E Annual Recital' }).first().locator('xpath=ancestor::tr[1]')
      await row.locator('button').first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Venue', 'E2E Updated Auditorium')
      await modal.getByRole('button', { name: 'Update', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('performance-updated-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((bid) => window.api.performance.list({ batchId: bid }), batchId)
      const found = (listRes?.data || []).find((p) => p.id === performanceId)
      r.log('performance-venue-updated', found?.venue === 'E2E Updated Auditorium', JSON.stringify(found))
    })

    await r.step('delete-performance-via-ui', async () => {
      if (!performanceId) return r.log('delete-performance-via-ui', false, 'no performanceId')
      const row = page.locator('p', { hasText: 'E2E Annual Recital' }).first().locator('xpath=ancestor::tr[1]')
      await row.locator('button').last().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
      await page.waitForTimeout(1000)
      r.log('performance-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((bid) => window.api.performance.list({ batchId: bid }), batchId)
      const stillThere = (listRes?.data || []).some((p) => p.id === performanceId)
      r.log('performance-actually-gone', !stillThere)
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
      const batchIds = db.prepare("SELECT id FROM CoachingBatch WHERE batchName LIKE 'E2E Perf%'").all().map((r2) => r2.id)
      let perfs = 0, enrollments = 0, batches = 0
      for (const bid of batchIds) {
        perfs += db.prepare('DELETE FROM Performance WHERE batchId = ?').run(bid).changes
        enrollments += db.prepare('DELETE FROM CoachingBatchEnrollment WHERE batchId = ?').run(bid).changes
        try { batches += db.prepare('DELETE FROM CoachingBatch WHERE id = ?').run(bid).changes } catch { /* noop */ }
      }
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Perf%'").all().map((r2) => r2.id)
      let custs = 0
      for (const cid of custIds) {
        try { db.prepare('DELETE FROM StudentProfile WHERE customerId = ?').run(cid) } catch { /* noop */ }
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ perfs, enrollments, batches, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOACHING PERFORMANCES & RECITALS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
