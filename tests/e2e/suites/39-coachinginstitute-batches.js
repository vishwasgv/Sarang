/**
 * Suite 39 — Coaching Institute vertical (student_profiles, coaching_batches,
 * coaching_batch_enrollments, coaching_fee_records). Real UI-driven chain:
 * Student -> Batch -> Enrollment -> Generate Fees -> Mark Paid (which
 * auto-creates the invoice on first PAID transition, no separate
 * generateInvoice method — see coaching-fee.service.ts). See
 * project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Coach'

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

    await r.step('create-student-via-real-ui', async () => {
      await h.gotoHash(page, '#/coaching/students')
      await page.waitForTimeout(700)
      r.log('students-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Student' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search existing customer by name or phone...').fill('E2E Coach Student')
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E Coach Student')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      await modal.getByPlaceholder('e.g. Class 10, JEE 2027').fill('Class 10')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Student', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('student-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'coaching-student-created')
    })

    let studentId, customerId

    await r.step('verify-student-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.student.list({}))
      const students = listRes?.data || []
      const found = students.find((s) => s.customer?.customerName === 'E2E Coach Student')
      studentId = found?.id
      // CoachingBatchEnrollment.studentId actually references Customer.id
      // (confirmed via BatchesScreen.tsx's Enroll dropdown, which is
      // populated from `student.list()`'s nested `.customer` objects, not
      // StudentProfile.id) — capture both, use customerId for enrollment.
      customerId = found?.customerId ?? found?.customer?.id
      r.log('student-findable-via-api', !!studentId, JSON.stringify({ classOrGrade: found?.classOrGrade }))
    })

    await r.step('create-batch-via-real-ui', async () => {
      await h.gotoHash(page, '#/coaching/batches')
      await page.waitForTimeout(700)
      r.log('batches-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Batch' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('e.g. JEE 2027 Morning Batch').fill('E2E Coach Batch')
      await modal.getByPlaceholder('e.g. Mathematics, Carnatic Vocal').fill('Mathematics')
      // "Fee / Month (₹) *" is a hand-rolled <label> (no htmlFor) — getByLabel
      // doesn't reach it. It's the 2nd type="number" input in the modal
      // (Max Capacity is the 1st).
      await modal.locator('input[type="number"]').nth(1).fill('2000')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Batch' }).click()
      await page.waitForTimeout(1200)
      r.log('batch-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'coaching-batch-created')
    })

    let batchId

    await r.step('verify-batch-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.coachingBatch.list({}))
      const batches = listRes?.data || []
      const found = batches.find((b) => b.batchName === 'E2E Coach Batch')
      batchId = found?.id
      r.log('batch-findable-via-api', !!batchId, JSON.stringify({ status: found?.status, feePerMonth: found?.feePerMonth }))
    })

    await r.step('enroll-student-via-real-ui', async () => {
      // Expand the batch row (chevron toggle button, first button in the row)
      // to reveal "Enroll Student". `.overflow-hidden` alone also matches
      // the sidebar nav wrapper (3 matches total) — scope to the Card's own
      // `rounded-xl` class too, which the sidebar doesn't have.
      const row = page.locator('div.rounded-xl.overflow-hidden', { hasText: 'E2E Coach Batch' }).first()
      await row.locator('button').first().click()
      await page.waitForTimeout(500)

      await row.getByRole('button', { name: 'Enroll Student' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const studentOptionText = await modal.getByLabel('Student').locator('option', { hasText: 'E2E Coach Student' }).first().textContent()
      await modal.getByLabel('Student').selectOption({ label: (studentOptionText || '').trim() })
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Enroll', exact: true }).click()
      await page.waitForTimeout(1200)
      r.log('enrollment-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'coaching-enrollment-created')
    })

    let enrollmentId

    await r.step('verify-enrollment-via-api', async () => {
      if (!batchId) return r.log('verify-enrollment-via-api', false, 'no batchId captured')
      const res = await page.evaluate((bid) => window.api.enrollment.listByBatch({ batchId: bid }), batchId)
      const enrs = res?.data || []
      const found = enrs.find((e) => e.studentId === customerId)
      enrollmentId = found?.id
      r.log('enrollment-findable-via-api', !!enrollmentId, JSON.stringify({ status: found?.status, effectiveFee: found?.effectiveFee }))
    })

    const feeMonth = new Date().toISOString().slice(0, 7)

    await r.step('generate-fees-via-real-ui', async () => {
      await h.gotoHash(page, '#/coaching/fees')
      await page.waitForTimeout(700)
      r.log('fees-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: /Generate Fees/ }).click()
      await page.waitForTimeout(1200)
      r.log('fees-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let feeRecordId

    await r.step('verify-fee-record-via-api', async () => {
      if (!enrollmentId) return r.log('verify-fee-record-via-api', false, 'no enrollmentId captured')
      const res = await page.evaluate(async () => window.api.coachingFee.list({}))
      const records = res?.data || []
      const found = records.find((f) => f.enrollmentId === enrollmentId)
      feeRecordId = found?.id
      r.log('fee-record-findable-via-api', !!feeRecordId, JSON.stringify({ status: found?.status, amountDue: found?.amountDue, feeMonth: found?.feeMonth }))
      void feeMonth
    })

    await r.step('mark-fee-paid-via-real-ui', async () => {
      const row = page.locator('tr', { hasText: 'E2E Coach Student' }).first()
      await row.locator('button[title="Mark Paid"]').click()
      await page.waitForTimeout(1200)
      r.log('fee-marked-paid-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!feeRecordId) return r.log('verify-invoice-via-api', false, 'no feeRecordId captured')
      const res = await page.evaluate(async () => window.api.coachingFee.list({}))
      const records = res?.data || []
      const found = records.find((f) => f.id === feeRecordId)
      r.log('fee-record-reached-paid', found?.status === 'PAID', JSON.stringify(found?.status))
      r.log('fee-record-has-invoice-id', !!found?.invoiceId, JSON.stringify(found?.invoiceId))
      if (found?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), found.invoiceId)
        const expectedTotal = 2000
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
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
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const feeIds = db.prepare("SELECT cfr.id AS id FROM CoachingFeeRecord cfr JOIN Customer c ON c.id = cfr.studentId WHERE c.customerName LIKE 'E2E Coach%'").all().map((r2) => r2.id)
      for (const id of feeIds) { try { db.prepare('DELETE FROM CoachingFeeRecord WHERE id = ?').run(id) } catch { /* noop */ } }
      const enrIds = db.prepare("SELECT cbe.id AS id FROM CoachingBatchEnrollment cbe JOIN Customer c ON c.id = cbe.studentId WHERE c.customerName LIKE 'E2E Coach%'").all().map((r2) => r2.id)
      for (const id of enrIds) { try { db.prepare('DELETE FROM CoachingBatchEnrollment WHERE id = ?').run(id) } catch { /* noop */ } }
      const batchIds = db.prepare("SELECT id FROM CoachingBatch WHERE batchName = 'E2E Coach Batch'").all().map((r2) => r2.id)
      for (const id of batchIds) { try { db.prepare('DELETE FROM CoachingBatch WHERE id = ?').run(id) } catch { /* noop */ } }
      const stuIds = db.prepare("SELECT sp.id AS id FROM StudentProfile sp JOIN Customer c ON c.id = sp.customerId WHERE c.customerName LIKE 'E2E Coach%'").all().map((r2) => r2.id)
      for (const id of stuIds) { try { db.prepare('DELETE FROM StudentProfile WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: feeRecords', feeIds.length, 'enrollments', enrIds.length, 'batches', batchIds.length, 'studentProfiles', stuIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCOACHING INSTITUTE VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
