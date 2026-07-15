/**
 * Suite 35 — Gym Studio vertical (memberships, batch_classes). Real
 * UI-driven membership plan + membership creation, invoicing, check-in, and
 * batch class creation + enrollment. session_packs/staff_commission are
 * generic infra already covered by suites 30/34. See
 * project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Gym'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-gym-studio', async () => {
      const sw = await h.switchBusinessType(page, 'Gym / Fitness Studio')
      r.log('business-type-switched', sw.to === 'GYM_STUDIO', JSON.stringify(sw))
    })

    await r.step('create-membership-plan-via-real-ui', async () => {
      await h.gotoHash(page, '#/gym/memberships')
      await page.waitForTimeout(700)
      r.log('memberships-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Default tab is "All Memberships" — "New Plan" only renders under the "Plans" tab.
      // Tabs.tsx uses role="tab" (proper ARIA tablist), not role="button".
      await page.getByRole('tab', { name: 'Plans', exact: true }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'New Plan' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('e.g. Monthly Unlimited').fill('E2E Gym Monthly Plan')
      const numberInputs = modal.locator('input[type="number"]')
      await numberInputs.nth(0).fill('30')
      await numberInputs.nth(1).fill('2000')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Save Plan' }).click()
      await page.waitForTimeout(1200)
      r.log('plan-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'gym-plan-created')
    })

    let planId

    await r.step('verify-plan-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.membershipPlan.list())
      const plans = listRes?.data || []
      const found = plans.find((p) => p.planName === 'E2E Gym Monthly Plan')
      planId = found?.id
      r.log('plan-findable-via-api', !!planId, JSON.stringify({ durationDays: found?.durationDays, price: found?.price }))
    })

    await r.step('create-membership-via-real-ui', async () => {
      await page.getByRole('tab', { name: 'All Memberships', exact: true }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'New Membership' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Gym Member')
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E Gym Member')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      await modal.getByLabel('Plan').selectOption(planId)
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Create Membership' }).click()
      await page.waitForTimeout(1200)
      r.log('membership-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'gym-membership-created')
    })

    let membershipId

    await r.step('verify-membership-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.membership.list({}))
      const memberships = listRes?.data || []
      const found = memberships.find((m) => m.planId === planId)
      membershipId = found?.id
      r.log('membership-findable-via-api', !!membershipId, JSON.stringify({ status: found?.status, endDate: found?.endDate }))
    })

    await r.step('generate-membership-invoice-via-real-ui', async () => {
      const genBtn = page.locator('button[title="Generate Invoice"]').first()
      r.log('generate-invoice-button-present', await genBtn.count() > 0)
      await genBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generated-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-via-api', async () => {
      if (!membershipId) return r.log('verify-invoice-via-api', false, 'no membershipId captured')
      const listRes = await page.evaluate(async () => window.api.membership.list({}))
      const memberships = listRes?.data || []
      const found = memberships.find((m) => m.id === membershipId)
      r.log('membership-has-invoice-id', !!found?.invoiceId, JSON.stringify(found?.invoiceId))
      if (found?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), found.invoiceId)
        const expectedTotal = 2000 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('check-in-member-via-real-ui', async () => {
      await page.getByRole('tab', { name: 'Quick Check-In' }).click()
      await page.waitForTimeout(500)
      const checkInBtn = page.getByRole('button', { name: 'Check In' }).first()
      r.log('check-in-button-present', await checkInBtn.count() > 0)
      if (await checkInBtn.count() > 0) {
        await checkInBtn.click()
        await page.waitForTimeout(1000)
        r.log('check-in-no-crash', !(await h.hasErrorBoundary(page)))
      }
    })

    let classId

    await r.step('create-batch-class-via-real-ui', async () => {
      await h.gotoHash(page, '#/gym/classes')
      await page.waitForTimeout(700)
      r.log('batch-classes-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Class' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('e.g. Morning Yoga').fill('E2E Gym Yoga Class')
      await modal.getByRole('button', { name: 'MON', exact: true }).click()
      await modal.getByRole('button', { name: 'WED', exact: true }).click()
      const timeInput = modal.locator('input[type="time"]')
      await timeInput.fill('07:00')
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(new Date().toISOString().slice(0, 10))
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Save Class' }).click()
      await page.waitForTimeout(1200)
      r.log('class-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'gym-class-created')
    })

    await r.step('verify-class-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.batchClass.list({}))
      const classes = listRes?.data || []
      const found = classes.find((c) => c.className === 'E2E Gym Yoga Class')
      classId = found?.id
      r.log('class-findable-via-api', !!classId, JSON.stringify({ scheduleDays: found?.scheduleDays, maxCapacity: found?.maxCapacity }))
      const days = found?.scheduleDays ? JSON.parse(found.scheduleDays) : []
      r.log('schedule-days-saved-correctly', days.includes('MON') && days.includes('WED'), JSON.stringify(days))
    })

    await r.step('enroll-member-in-class-via-real-ui', async () => {
      if (!classId) return r.log('enroll-member-in-class-via-real-ui', false, 'no classId captured')
      const enrollBtn = page.getByRole('button', { name: 'Enrollment' }).first()
      await enrollBtn.click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search member...').fill('E2E Gym Member')
      await page.waitForTimeout(700)
      const enrollLink = modal.getByRole('button', { name: 'Enroll' }).first()
      r.log('enroll-option-found', await enrollLink.count() > 0)
      await enrollLink.click()
      await page.waitForTimeout(1000)
      r.log('enrollment-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'GYM_STUDIO') {
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
      const memIds = db.prepare("SELECT mp.id AS id FROM Membership mp JOIN MembershipPlan p ON p.id = mp.planId WHERE p.planName LIKE 'E2E Gym%'").all().map((r2) => r2.id)
      for (const id of memIds) { try { db.prepare('DELETE FROM Membership WHERE id = ?').run(id) } catch { /* noop */ } }
      const planIds = db.prepare("SELECT id FROM MembershipPlan WHERE planName LIKE 'E2E Gym%'").all().map((r2) => r2.id)
      for (const id of planIds) { try { db.prepare('DELETE FROM MembershipPlan WHERE id = ?').run(id) } catch { /* noop */ } }
      const classIds = db.prepare("SELECT id FROM BatchClass WHERE className LIKE 'E2E Gym%'").all().map((r2) => r2.id)
      for (const id of classIds) {
        try { db.prepare('DELETE FROM BatchClassEnrollment WHERE batchClassId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM BatchClass WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: memberships', memIds.length, 'plans', planIds.length, 'classes', classIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nGYM STUDIO VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
