/**
 * Suite 137 — Section C medium CRUD gap: blood-bank.handler.ts
 * updateDonor/deactivateDonor/sendDonorRecall/createDonationCamp/
 * cancelIssue/generateIssueInvoice, reconfirmed 2026-09-03 against suites
 * 33/72 (createDonor/createIssue/etc. already covered there).
 * deactivateDonor has NO UI trigger anywhere in the renderer (confirmed
 * via grep) -- a real product gap (only "defer" exists in the UI, not a
 * hard deactivate) -- covered API-only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E BB137'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-blood-bank', async () => {
      const sw = await h.switchBusinessType(page, 'Blood Bank')
      r.log('business-type-switched', sw.to === 'BLOOD_BANK', JSON.stringify(sw))
    })

    let donorId
    const donorName = `${TEST_PREFIX} Donor ${suffix}`
    await r.step('seed-donor-via-api', async () => {
      const res = await page.evaluate(async (name) => window.api.bloodBank.createDonor({
        fullName: name, bloodGroup: 'O+', phone: `9${String(Date.now()).slice(-9)}`,
      }), donorName)
      donorId = res?.data?.id
      r.log('donor-created', !!donorId, JSON.stringify(res?.error || ''))
    })

    await r.step('send-recall-mark-deferred-clear-deferral-via-ui', async () => {
      if (!donorId) return r.log('send-recall-mark-deferred-clear-deferral-via-ui', false, 'no donorId')
      await h.gotoHash(page, '#/blood-bank/donors')
      await page.waitForTimeout(700)
      r.log('donors-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: donorName }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Send Recall Reminder' }).click()
      await page.waitForTimeout(900)
      r.log('recall-no-crash', !(await h.hasErrorBoundary(page)))

      await modal.getByRole('button', { name: 'Mark Deferred' }).click()
      await page.waitForTimeout(400)
      const deferModal = h.topModal(page)
      await deferModal.getByPlaceholder('e.g. Low hemoglobin, reactive screening test…').fill(`${TEST_PREFIX} low hemoglobin`)
      await deferModal.getByRole('button', { name: 'Mark Deferred' }).click()
      await page.waitForTimeout(900)
      r.log('mark-deferred-no-crash', !(await h.hasErrorBoundary(page)))

      let getRes = await page.evaluate((id) => window.api.bloodBank.getDonor({ id }), donorId)
      r.log('donor-actually-deferred', getRes?.data?.isDeferred === true && getRes?.data?.deferralReason === `${TEST_PREFIX} low hemoglobin`, JSON.stringify(getRes?.data))

      await modal.getByRole('button', { name: 'Clear Deferral' }).click()
      await page.waitForTimeout(900)
      r.log('clear-deferral-no-crash', !(await h.hasErrorBoundary(page)))

      getRes = await page.evaluate((id) => window.api.bloodBank.getDonor({ id }), donorId)
      r.log('donor-actually-cleared', getRes?.data?.isDeferred === false, JSON.stringify(getRes?.data))
    })

    await r.step('deactivate-donor-api-only-no-ui-trigger', async () => {
      if (!donorId) return r.log('deactivate-donor-api-only-no-ui-trigger', false, 'no donorId')
      const res = await page.evaluate((id) => window.api.bloodBank.deactivateDonor({ id }), donorId)
      r.log('deactivate-donor-api-succeeds', !!res?.success, JSON.stringify(res?.error || ''))

      const getRes = await page.evaluate((id) => window.api.bloodBank.getDonor({ id }), donorId)
      r.log('donor-actually-deactivated', getRes?.data?.isActive === false, JSON.stringify(getRes?.data))
    })

    const campName = `${TEST_PREFIX} Community Drive ${suffix}`
    await r.step('schedule-donation-camp-via-ui', async () => {
      await h.gotoHash(page, '#/blood-bank/camps')
      await page.waitForTimeout(700)
      r.log('camps-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Schedule Camp' }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('e.g. Community Center Drive').fill(campName)
      await modal.locator('input[type="date"]').fill(h.toLocalISODate(new Date(Date.now() + 10 * 24 * 3600000)))
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Schedule Camp' }).click()
      await page.waitForTimeout(900)
      r.log('camp-schedule-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.bloodBank.listDonationCamps())
      const found = (listRes?.data || []).find((c) => c.campName === campName)
      r.log('camp-persisted', !!found, JSON.stringify(found))
    })

    let invoiceDonorId, invoiceDonationId, invoiceIssueId, customerId
    let cancelDonorId, cancelDonationId, cancelIssueId
    await r.step('seed-two-issuable-units-and-a-customer', async () => {
      const d1 = await page.evaluate(async (name) => window.api.bloodBank.createDonor({ fullName: name, bloodGroup: 'A+' }), `${TEST_PREFIX} Invoice Donor ${suffix}`)
      invoiceDonorId = d1?.data?.id
      const d2 = await page.evaluate(async (name) => window.api.bloodBank.createDonor({ fullName: name, bloodGroup: 'A+' }), `${TEST_PREFIX} Cancel Donor ${suffix}`)
      cancelDonorId = d2?.data?.id
      r.log('two-donors-created', !!invoiceDonorId && !!cancelDonorId)

      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Recipient Customer ${suffix}`)
      customerId = custRes?.data?.id
      r.log('recipient-customer-created', !!customerId)

      const don1 = await page.evaluate(async (did) => window.api.bloodBank.createDonationRecord({
        donorId: did, bloodGroup: 'A+', componentType: 'PACKED_RBC',
      }), invoiceDonorId)
      invoiceDonationId = don1?.data?.id
      const don2 = await page.evaluate(async (did) => window.api.bloodBank.createDonationRecord({
        donorId: did, bloodGroup: 'A+', componentType: 'PACKED_RBC',
      }), cancelDonorId)
      cancelDonationId = don2?.data?.id
      r.log('two-donation-records-created', !!invoiceDonationId && !!cancelDonationId)

      const screen1 = await page.evaluate((id) => window.api.bloodBank.updateScreeningStatus({ id, screeningStatus: 'PASSED' }), invoiceDonationId)
      const screen2 = await page.evaluate((id) => window.api.bloodBank.updateScreeningStatus({ id, screeningStatus: 'PASSED' }), cancelDonationId)
      r.log('both-units-screened-passed', !!screen1?.success && !!screen2?.success, JSON.stringify({ e1: screen1?.error, e2: screen2?.error }))

      const issue1 = await page.evaluate(({ cid, did, name }) => window.api.bloodBank.createIssue({
        customerId: cid, recipientName: name, donationRecordIds: [did], price: 1500,
      }), { cid: customerId, did: invoiceDonationId, name: `${TEST_PREFIX} Invoice Recipient` })
      invoiceIssueId = issue1?.data?.id
      r.log('invoice-issue-created', !!invoiceIssueId, JSON.stringify(issue1?.error || ''))

      const issue2 = await page.evaluate(({ did, name }) => window.api.bloodBank.createIssue({
        recipientName: name, donationRecordIds: [did], price: 1500,
      }), { did: cancelDonationId, name: `${TEST_PREFIX} Cancel Recipient` })
      cancelIssueId = issue2?.data?.id
      r.log('cancel-issue-created', !!cancelIssueId, JSON.stringify(issue2?.error || ''))
    })

    await r.step('generate-issue-invoice-via-ui', async () => {
      if (!invoiceIssueId) return r.log('generate-issue-invoice-via-ui', false, 'no invoiceIssueId')
      await h.gotoHash(page, '#/blood-bank/issue')
      await page.waitForTimeout(700)
      r.log('issue-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: new RegExp(`${TEST_PREFIX} Invoice Recipient`) }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Generate Invoice' }).click()
      await page.waitForTimeout(1200)
      r.log('generate-invoice-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.bloodBank.getIssue({ id }), invoiceIssueId)
      r.log('issue-actually-has-invoice-id', !!getRes?.data?.invoiceId, JSON.stringify(getRes?.data))
      if (getRes?.data?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), getRes.data.invoiceId)
        r.log('invoice-total-correct', invRes?.data?.totalAmount === 1500, `expected=1500 actual=${invRes?.data?.totalAmount}`)
      }
      // Detail modal doesn't auto-close after Generate Invoice, and
      // gotoHash() to the same hash in the next step won't remount the
      // screen to reset it -- close explicitly or it blocks the next click.
      await modal.locator('button', { hasText: '×' }).click()
      await page.waitForTimeout(300)
    })

    await r.step('cancel-issue-via-ui', async () => {
      if (!cancelIssueId) return r.log('cancel-issue-via-ui', false, 'no cancelIssueId')
      await h.gotoHash(page, '#/blood-bank/issue')
      await page.waitForTimeout(700)

      await page.getByRole('button', { name: new RegExp(`${TEST_PREFIX} Cancel Recipient`) }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Cancel Issue' }).click()
      await page.waitForTimeout(400)
      // Not page-wide -- the detail modal's own trigger button underneath
      // has the identical exact text "Cancel Issue" too. Scope to the
      // topmost (confirm) overlay.
      await h.topModal(page).getByRole('button', { name: 'Cancel Issue', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('cancel-issue-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.bloodBank.getIssue({ id }), cancelIssueId)
      r.log('issue-actually-cancelled', getRes?.data?.status === 'CANCELLED', JSON.stringify(getRes?.data))

      const donRes = await page.evaluate((id) => window.api.bloodBank.listDonationRecords({ donorId: id }), cancelDonorId)
      const record = (donRes?.data?.records || []).find((d) => d.id === cancelDonationId)
      r.log('unit-returned-to-stock', record?.isIssued === false, JSON.stringify(record))
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
    h.withDb((db) => {
      let issues = 0, donations = 0, donors = 0, camps = 0, custs = 0
      const donorIds = db.prepare(`SELECT id FROM Donor WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const did of donorIds) {
        const recIds = db.prepare('SELECT id FROM DonationRecord WHERE donorId = ?').all(did).map((row) => row.id)
        for (const rid of recIds) {
          try { db.prepare('DELETE FROM BloodIssueItem WHERE donationRecordId = ?').run(rid) } catch { /* noop */ }
        }
      }
      const issueIds = db.prepare(`SELECT id FROM BloodIssue WHERE recipientName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const iid of issueIds) {
        try { db.prepare('DELETE FROM BloodIssueItem WHERE bloodIssueId = ?').run(iid) } catch { /* noop */ }
        try { issues += db.prepare('DELETE FROM BloodIssue WHERE id = ?').run(iid).changes } catch { /* noop */ }
      }
      for (const did of donorIds) {
        // updateScreeningStatus('PASSED') creates a ProductBatch keyed on
        // (productId, batchNumber=donationNumber) for the synthetic "Blood
        // Unit" product -- batchNumber is deterministic
        // (DON-YYYYMM-NNNN), so an orphaned batch from a prior run collides
        // with the next run's freshly-restarted sequence and makes every
        // unit "not available to issue". Must be cleared alongside the
        // DonationRecord, not left behind.
        const donationNumbers = db.prepare('SELECT donationNumber FROM DonationRecord WHERE donorId = ?').all(did).map((row) => row.donationNumber)
        for (const num of donationNumbers) {
          try { db.prepare('DELETE FROM ProductBatch WHERE batchNumber = ?').run(num) } catch { /* noop */ }
        }
        try { donations += db.prepare('DELETE FROM DonationRecord WHERE donorId = ?').run(did).changes } catch { /* noop */ }
        try { donors += db.prepare('DELETE FROM Donor WHERE id = ?').run(did).changes } catch { /* noop */ }
      }
      try { camps += db.prepare(`DELETE FROM DonationCamp WHERE campName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ issues, donations, donors, camps, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBLOOD BANK DONOR/CAMP/ISSUE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
