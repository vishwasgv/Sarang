/**
 * Suite 129 — drivingPackage, drivingPackageEnrollment, and
 * learnerSkill.upsert (broader-gap-list "Nested sub-feature gaps" under
 * Section A, 2026-09-03). learnerProfile.upsert, drivingVehicle.create, and
 * drivingSession.create are already covered (suite 36); packages,
 * enrollments, and skill-mastery had zero coverage.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E DrvPkg'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-driving-school', async () => {
      const sw = await h.switchBusinessType(page, 'Driving School')
      r.log('business-type-switched', sw.to === 'DRIVING_SCHOOL', JSON.stringify(sw))
    })

    const learnerName = `${TEST_PREFIX} Learner ${suffix}`
    let learnerId
    await r.step('create-learner-and-profile-via-ui', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), learnerName)
      learnerId = custRes?.data?.id
      r.log('learner-customer-created', !!learnerId, JSON.stringify(custRes?.error || ''))

      await h.gotoHash(page, '#/driving/learners')
      await page.waitForTimeout(700)
      r.log('driving-school-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByPlaceholder('Search learner...').fill(learnerName)
      await page.waitForTimeout(500)
      await page.locator('button', { hasText: learnerName }).first().click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'Save Profile' }).click()
      await page.waitForTimeout(1200)
      r.log('profile-saved-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('update-skill-mastery-via-ui', async () => {
      if (!learnerId) return r.log('update-skill-mastery-via-ui', false, 'no learnerId')
      const skillRow = page.locator('div', { hasText: 'Skill Mastery' }).last()
      const firstSkillMastered = skillRow.locator('div.flex.items-center.justify-between.gap-3').first().locator('button', { hasText: 'Mastered' })
      await firstSkillMastered.click()
      await page.waitForTimeout(1000)
      r.log('skill-update-no-crash', !(await h.hasErrorBoundary(page)))

      const checklistRes = await page.evaluate((cid) => window.api.learnerSkill.checklist({ customerId: cid }), learnerId)
      const items = checklistRes?.data?.checklist || []
      r.log('skill-actually-updated', items[0]?.masteryLevel === 'MASTERED', JSON.stringify(items[0]))
    })

    const packageAName = `${TEST_PREFIX} Package A ${suffix}`
    let packageAId
    await r.step('create-and-edit-package-A-via-ui', async () => {
      await page.getByRole('tab', { name: 'Packages' }).click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: 'New Package' }).click()
      await page.waitForTimeout(500)
      let modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. 10-Lesson LMV Package').fill(packageAName)
      const numberInputs = modal.locator('input[type="number"]')
      await numberInputs.nth(0).fill('10')
      await numberInputs.nth(1).fill('5000')
      await modal.locator('button', { hasText: 'Save Package' }).click()
      await page.waitForTimeout(1000)
      r.log('package-A-created-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate(async () => window.api.drivingPackage.list())
      let pkgs = listRes?.data || []
      let pkgA = pkgs.find((p) => p.packageName === packageAName)
      packageAId = pkgA?.id
      r.log('package-A-persisted', !!packageAId && Number(pkgA?.price) === 5000, JSON.stringify(pkgA))
      if (!packageAId) return

      const card = page.locator('p', { hasText: packageAName }).first().locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]')
      await card.locator('button', { hasText: 'Edit' }).click()
      await page.waitForTimeout(500)
      modal = h.topModal(page)
      await modal.locator('input[type="number"]').nth(1).fill('6000')
      await modal.locator('button', { hasText: 'Save Package' }).click()
      await page.waitForTimeout(1000)
      r.log('package-A-update-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate(async () => window.api.drivingPackage.list())
      pkgs = listRes?.data || []
      pkgA = pkgs.find((p) => p.id === packageAId)
      r.log('package-A-update-persisted', Number(pkgA?.price) === 6000, JSON.stringify(pkgA))
    })

    let enrollmentAId
    async function enrollLearnerInPackage(packageId) {
      await page.getByRole('button', { name: 'Enroll Learner' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      // CustomerPicker's own state isn't reset when the modal reopens --
      // on the second enrollment for the same learner it's already shown
      // as selected (no search box rendered at all in that state).
      const searchInput = modal.getByPlaceholder('Search by name or phone...')
      if (await searchInput.count()) {
        await searchInput.fill(learnerName)
        await page.waitForTimeout(700)
        const existingMatch = modal.locator('div.absolute button', { hasText: learnerName })
        if (await existingMatch.count()) await existingMatch.first().click()
        else {
          const addNew = modal.locator('button', { hasText: 'Add new customer' })
          if (await addNew.count()) await addNew.click()
        }
        await page.waitForTimeout(300)
      }
      await modal.locator('select').selectOption(packageId)
      await page.waitForTimeout(300)
      await modal.locator('button', { hasText: 'Enroll Learner', exact: true }).click()
      await page.waitForTimeout(1200)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate(async (lid) => window.api.drivingPackageEnrollment.list({ learnerId: lid }), learnerId)
      const enrollments = listRes?.data || []
      const enrollment = enrollments.find((e) => e.packageId === packageId)
      return { id: enrollment?.id, noCrash, enrollment }
    }

    await r.step('enroll-learner-in-package-A-and-generate-invoice', async () => {
      if (!packageAId) return r.log('enroll-learner-in-package-A-and-generate-invoice', false, 'no packageAId')
      const res = await enrollLearnerInPackage(packageAId)
      enrollmentAId = res.id
      r.log('enrollment-A-created-no-crash', res.noCrash)
      r.log('enrollment-A-persisted', !!enrollmentAId && !res.enrollment?.invoiceId, JSON.stringify(res.enrollment))
      if (!enrollmentAId) return

      const row = page.locator('tr', { hasText: learnerName }).first()
      await row.locator('button[title="Generate Invoice"]').click()
      await page.waitForTimeout(1500)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async (lid) => window.api.drivingPackageEnrollment.list({ learnerId: lid }), learnerId)
      const enrollment = (listRes?.data || []).find((e) => e.id === enrollmentAId)
      r.log('invoice-generated', !!enrollment?.invoiceId, JSON.stringify(enrollment))
      if (enrollment?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), enrollment.invoiceId)
        r.log('invoice-total-matches-package-price', Math.abs((invRes?.data?.totalAmount ?? 0) - 6000) < 1 || Math.abs((invRes?.data?.totalAmount ?? 0) - 6000 * 1.18) < 1, JSON.stringify(invRes?.data?.totalAmount))
      }
    })

    const packageBName = `${TEST_PREFIX} Package B ${suffix}`
    let packageBId
    await r.step('create-package-B-enroll-delete-enrollment-delete-package', async () => {
      await page.getByRole('button', { name: 'New Package' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. 10-Lesson LMV Package').fill(packageBName)
      const numberInputs = modal.locator('input[type="number"]')
      await numberInputs.nth(0).fill('5')
      await numberInputs.nth(1).fill('2500')
      await modal.locator('button', { hasText: 'Save Package' }).click()
      await page.waitForTimeout(1000)

      const listRes = await page.evaluate(async () => window.api.drivingPackage.list())
      const pkgB = (listRes?.data || []).find((p) => p.packageName === packageBName)
      packageBId = pkgB?.id
      r.log('package-B-persisted', !!packageBId, JSON.stringify(pkgB))
      if (!packageBId) return

      const res = await enrollLearnerInPackage(packageBId)
      const enrollmentBId = res.id
      r.log('enrollment-B-created-no-crash', res.noCrash)
      r.log('enrollment-B-persisted', !!enrollmentBId, JSON.stringify(res.enrollment))
      if (!enrollmentBId) return

      const row = page.locator('tr', { hasText: learnerName }).filter({ hasText: packageBName }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      // Enrollment removal's own confirmLabel is "Remove", not "Delete"
      // (the package delete dialog below is the one that says "Delete").
      await confirmDialog.getByRole('button', { name: 'Remove', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('enrollment-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      let afterRes = await page.evaluate(async (lid) => window.api.drivingPackageEnrollment.list({ learnerId: lid }), learnerId)
      r.log('enrollment-B-actually-deleted', !(afterRes?.data || []).some((e) => e.id === enrollmentBId))

      const pkgCard = page.locator('p', { hasText: packageBName }).first().locator('xpath=ancestor::div[contains(@class,"space-y-2")][1]')
      await pkgCard.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      const pkgConfirmDialog = h.topModal(page)
      await pkgConfirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('package-B-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterPkgRes = await page.evaluate(async () => window.api.drivingPackage.list())
      r.log('package-B-actually-deleted', !(afterPkgRes?.data || []).some((p) => p.id === packageBId))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'DRIVING_SCHOOL') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let skills = 0, enrollments = 0, learnerProfiles = 0, custs = 0
      for (const cid of custIds) {
        skills += db.prepare('DELETE FROM LearnerSkillAssessment WHERE customerId = ?').run(cid).changes
        enrollments += db.prepare('DELETE FROM DrivingPackageEnrollment WHERE learnerId = ?').run(cid).changes
        learnerProfiles += db.prepare('DELETE FROM LearnerProfile WHERE customerId = ?').run(cid).changes
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const pkgIds = db.prepare(`SELECT id FROM DrivingPackage WHERE packageName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let packages = 0
      for (const pid of pkgIds) {
        db.prepare('DELETE FROM DrivingPackageEnrollment WHERE packageId = ?').run(pid)
        try { packages += db.prepare('DELETE FROM DrivingPackage WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ skills, enrollments, learnerProfiles, custs, packages }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDRIVING PACKAGE/ENROLLMENT/SKILL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
