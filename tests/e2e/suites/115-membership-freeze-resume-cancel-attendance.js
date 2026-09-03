/**
 * Suite 115 — membership.freeze/resume/update(cancel)/attendance
 * (broader-gap-list Section C, money-critical, 2026-09-03). create/
 * generateInvoice/checkIn are already covered (suite 35) -- this closes the
 * remaining four channels via one membership's real lifecycle: Freeze ->
 * Resume -> view Attendance History -> Cancel.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E GymFrz'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-gym-studio', async () => {
      const sw = await h.switchBusinessType(page, 'Gym / Fitness Studio')
      r.log('business-type-switched', sw.to === 'GYM_STUDIO', JSON.stringify(sw))
    })

    const planName = `${TEST_PREFIX} Plan ${suffix}`
    const memberName = `${TEST_PREFIX} Member ${suffix}`
    let planId, membershipId

    await r.step('create-plan-and-membership-via-ui', async () => {
      await h.gotoHash(page, '#/gym/memberships')
      await page.waitForTimeout(700)
      r.log('memberships-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('tab', { name: 'Plans', exact: true }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'New Plan' }).click()
      await page.waitForTimeout(500)
      let modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. Monthly Unlimited').fill(planName)
      const numberInputs = modal.locator('input[type="number"]')
      await numberInputs.nth(0).fill('30')
      await numberInputs.nth(1).fill('1500')
      await modal.getByRole('button', { name: 'Save Plan' }).click()
      await page.waitForTimeout(1200)

      const planListRes = await page.evaluate(async () => window.api.membershipPlan.list())
      planId = (planListRes?.data || []).find((p) => p.planName === planName)?.id
      r.log('plan-created-via-ui', !!planId)
      if (!planId) return

      await page.getByRole('tab', { name: 'All Memberships', exact: true }).click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'New Membership' }).click()
      await page.waitForTimeout(500)
      modal = h.topModal(page)
      await modal.getByPlaceholder('Search by name or phone...').fill(memberName)
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill(memberName)
        await modal.getByPlaceholder('Phone *').fill(`9${String(Date.now()).slice(-9)}`)
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }
      await modal.getByLabel('Plan').selectOption(planId)
      await modal.getByRole('button', { name: 'Create Membership' }).click()
      await page.waitForTimeout(1200)
      r.log('membership-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.membership.list({}))
      membershipId = (listRes?.data || []).find((m) => m.planId === planId)?.id
      r.log('membership-created-and-active', !!membershipId, JSON.stringify((listRes?.data || []).find((m) => m.planId === planId)))
    })

    await r.step('check-in-member-for-attendance-record', async () => {
      if (!membershipId) return r.log('check-in-member-for-attendance-record', false, 'no membershipId')
      await page.getByRole('tab', { name: 'Quick Check-In' }).click()
      await page.waitForTimeout(500)
      const checkInBtn = page.getByRole('button', { name: 'Check In' }).first()
      if (await checkInBtn.count()) {
        await checkInBtn.click()
        await page.waitForTimeout(1000)
      }
      r.log('check-in-no-crash', !(await h.hasErrorBoundary(page)))
    })

    async function memberRow() {
      await page.getByRole('tab', { name: 'All Memberships', exact: true }).click()
      await page.waitForTimeout(500)
      // statusFilter defaults to 'ACTIVE' (not "All Status", despite that
      // being the first <option>) -- a frozen/cancelled row silently drops
      // out of the default view. Force "All Status" before every lookup.
      await page.locator('select').filter({ has: page.locator('option', { hasText: 'All Status' }) }).selectOption('')
      await page.waitForTimeout(400)
      return page.locator('tr', { hasText: memberName }).first()
    }

    await r.step('freeze-membership-via-ui', async () => {
      if (!membershipId) return r.log('freeze-membership-via-ui', false, 'no membershipId')
      const row = await memberRow()
      await row.locator('button', { hasText: 'Freeze' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('textarea').first().fill(`${TEST_PREFIX} traveling for a month`)
      await modal.locator('button', { hasText: 'Freeze Membership' }).click()
      await page.waitForTimeout(1000)
      r.log('freeze-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.membership.list({}))
      const found = (listRes?.data || []).find((m) => m.id === membershipId)
      r.log('membership-status-frozen', found?.status === 'FROZEN', JSON.stringify(found))
    })

    await r.step('resume-membership-via-ui', async () => {
      if (!membershipId) return r.log('resume-membership-via-ui', false, 'no membershipId')
      const row = await memberRow()
      await row.locator('button', { hasText: 'Resume' }).click()
      await page.waitForTimeout(1000)
      r.log('resume-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.membership.list({}))
      const found = (listRes?.data || []).find((m) => m.id === membershipId)
      r.log('membership-status-active-again', found?.status === 'ACTIVE', JSON.stringify(found))
    })

    await r.step('view-attendance-history-via-ui', async () => {
      if (!membershipId) return r.log('view-attendance-history-via-ui', false, 'no membershipId')
      const row = await memberRow()
      await row.locator('button[title="Attendance history"]').click()
      await page.waitForTimeout(700)
      const modal = h.topModal(page)
      const modalText = await modal.innerText().catch(() => '')
      r.log('attendance-history-shows-checkin', !modalText.includes('No check-ins recorded yet'), modalText.slice(0, 500))
      await modal.locator('button svg.lucide-x').first().locator('xpath=..').click().catch(() => {})
      await page.waitForTimeout(400)
    })

    await r.step('cancel-membership-via-ui', async () => {
      if (!membershipId) return r.log('cancel-membership-via-ui', false, 'no membershipId')
      const row = await memberRow()
      await row.locator('button', { hasText: 'Cancel' }).click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Cancel Membership', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('cancel-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.membership.list({}))
      const found = (listRes?.data || []).find((m) => m.id === membershipId)
      r.log('membership-status-cancelled', found?.status === 'CANCELLED', JSON.stringify(found))
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
    h.withDb((db) => {
      const memIds = db.prepare(`SELECT mp.id AS id FROM Membership mp JOIN MembershipPlan p ON p.id = mp.planId WHERE p.planName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let attendance = 0, memberships = 0
      for (const id of memIds) {
        try { attendance += db.prepare('DELETE FROM MemberAttendance WHERE membershipId = ?').run(id).changes } catch { /* noop */ }
        try { memberships += db.prepare('DELETE FROM Membership WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      const planIds = db.prepare(`SELECT id FROM MembershipPlan WHERE planName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let plans = 0
      for (const id of planIds) { try { plans += db.prepare('DELETE FROM MembershipPlan WHERE id = ?').run(id).changes } catch { /* noop */ } }
      console.log('extra cleanup:', JSON.stringify({ memberships, attendance, plans }))
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nMEMBERSHIP FREEZE/RESUME/CANCEL/ATTENDANCE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
