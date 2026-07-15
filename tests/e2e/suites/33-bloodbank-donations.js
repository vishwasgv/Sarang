/**
 * Suite 33 — Blood Bank vertical (blood_bank). Real UI-driven full chain:
 * Donor -> Donation Record -> Screening PASSED (creates real stock) ->
 * Issue Units. PRODUCT-category vertical, not built on SERVICE_BASE_MODULES.
 * See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Blood'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-blood-bank', async () => {
      const sw = await h.switchBusinessType(page, 'Blood Bank')
      r.log('business-type-switched', sw.to === 'BLOOD_BANK', JSON.stringify(sw))
    })

    await r.step('register-donor-via-real-ui', async () => {
      await h.gotoHash(page, '#/blood-bank/donors')
      await page.waitForTimeout(700)
      r.log('donors-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Donor' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      // Full Name / Blood Group are raw <label>+<input|select>, no htmlFor —
      // Full Name is the first plain <input>, Blood Group the first <select>.
      await modal.locator('input').first().fill('E2E Blood Donor')
      await modal.locator('select').first().selectOption('O+')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Register Donor' }).click()
      await page.waitForTimeout(1200)
      r.log('donor-registered-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'bloodbank-donor-registered')
    })

    let donorId

    await r.step('verify-donor-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.bloodBank.listDonors({}))
      const donors = listRes?.data?.donors || []
      const found = donors.find((d) => d.fullName === 'E2E Blood Donor')
      donorId = found?.id
      r.log('donor-findable-via-api', !!donorId, JSON.stringify({ bloodGroup: found?.bloodGroup, donorCode: found?.donorCode }))
    })

    await r.step('record-donation-via-real-ui', async () => {
      if (!donorId) return r.log('record-donation-via-real-ui', false, 'no donorId captured')
      await h.gotoHash(page, '#/blood-bank/donations')
      await page.waitForTimeout(700)
      r.log('donations-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Record Donation' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.locator('select').first().selectOption(donorId)
      await page.waitForTimeout(300)
      // Blood group auto-fills from the picked donor; volume has a default.
      await modal.getByRole('button', { name: 'Record Donation' }).click()
      await page.waitForTimeout(1200)
      r.log('donation-recorded-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'bloodbank-donation-recorded')
    })

    let donationRecordId

    await r.step('verify-donation-via-api', async () => {
      const listRes = await page.evaluate(async (did) => window.api.bloodBank.listDonationRecords({ donorId: did }), donorId)
      const records = listRes?.data?.records || []
      const found = records[0]
      donationRecordId = found?.id
      r.log('donation-findable-via-api', !!donationRecordId, JSON.stringify({ screeningStatus: found?.screeningStatus, bloodGroup: found?.bloodGroup }))
      r.log('donation-blood-group-auto-filled-from-donor', found?.bloodGroup === 'O+', JSON.stringify(found?.bloodGroup))
      r.log('screening-status-starts-pending', found?.screeningStatus === 'PENDING', JSON.stringify(found?.screeningStatus))
    })

    await r.step('screen-donation-passed-via-real-ui', async () => {
      if (!donationRecordId) return r.log('screen-donation-passed-via-real-ui', false, 'no donationRecordId captured')

      await page.getByRole('button', { name: 'Record Screening' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByRole('button', { name: 'Passed' }).click()
      await page.waitForTimeout(1200)
      r.log('screening-passed-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'bloodbank-screening-passed')
    })

    await r.step('verify-stock-created-via-api', async () => {
      const stockRes = await page.evaluate(async () => window.api.bloodBank.getBloodStock())
      const units = stockRes?.data?.units || []
      const found = units.find((u) => u.donationRecordId === donationRecordId)
      r.log('donation-now-in-stock-after-passing-screening', !!found, JSON.stringify({ bloodGroup: found?.bloodGroup, isExpired: found?.isExpired }))
    })

    await r.step('issue-unit-via-real-ui', async () => {
      await h.gotoHash(page, '#/blood-bank/issue')
      await page.waitForTimeout(700)
      r.log('issue-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Issue Units' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.locator('input').first().fill('E2E Blood Recipient')
      const checkbox = modal.locator('input[type="checkbox"]').first()
      r.log('stock-unit-checkbox-present', await checkbox.count() > 0)
      await checkbox.check()
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Issue Units' }).click()
      await page.waitForTimeout(1200)
      r.log('units-issued-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'bloodbank-units-issued')
    })

    await r.step('verify-issue-and-unit-consumed-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.bloodBank.listIssues({}))
      const issues = listRes?.data?.issues || listRes?.data || []
      const found = issues.find((i) => i.recipientName === 'E2E Blood Recipient')
      r.log('issue-findable-via-api', !!found, JSON.stringify({ status: found?.status }))

      const stockRes = await page.evaluate(async () => window.api.bloodBank.getBloodStock())
      const units = stockRes?.data?.units || []
      const stillInStock = units.some((u) => u.donationRecordId === donationRecordId)
      r.log('issued-unit-removed-from-available-stock', !stillInStock)
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'BLOOD_BANK') {
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
      const issueIds = db.prepare("SELECT id FROM BloodIssue WHERE recipientName LIKE 'E2E Blood%'").all().map((r2) => r2.id)
      for (const id of issueIds) { try { db.prepare('DELETE FROM BloodIssue WHERE id = ?').run(id) } catch { /* noop */ } }
      const donorIds = db.prepare("SELECT id FROM Donor WHERE fullName LIKE 'E2E Blood%'").all().map((r2) => r2.id)
      for (const id of donorIds) {
        try { db.prepare('DELETE FROM DonationRecord WHERE donorId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Donor WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: issues', issueIds.length, 'donors', donorIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBLOOD BANK VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
