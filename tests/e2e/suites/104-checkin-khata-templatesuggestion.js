/**
 * Suite 104 — three small, unrelated Section-A gaps closed together
 * (broader-gap-list closure, 2026-09-03):
 *  - customer-checkin.handler.ts (checkIn/checkOut/active/list) — real UI
 *    on CustomerCheckInScreen, gated behind the customer_checkin opt-in
 *    module (enabled here via the same industry:updateModules mechanism
 *    Settings' Business Features toggle uses, restored after).
 *  - khata-reminder.handler.ts:buildLink — real UI via the GROCERY-only
 *    "Khata Risk Tier" report's Send Reminder button. listCandidates has
 *    no UI trigger anywhere -- API-only.
 *  - template-suggestion.handler.ts (get/isDismissed/dismiss) — the real
 *    banner only renders for a GENERAL business after a week of matching
 *    usage signals, impractical to reproduce in an E2E run -- API-only
 *    coverage of the same real handler+service+DB round trip.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Chk'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── customerCheckIn: checkIn/checkOut/active/list via real UI ───────────
    let originalModules
    await r.step('enable-customer-checkin-module', async () => {
      const tpl = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tpl?.data?.enabledModules || []
      const withCheckin = [...new Set([...originalModules, 'customer_checkin'])]
      const res = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), withCheckin)
      r.log('customer-checkin-module-enabled', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
    })

    let checkinCustomerId
    await r.step('create-checkin-customer', async () => {
      const res = await page.evaluate(async (name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}` }), `${TEST_PREFIX} Visitor ${Date.now()}`)
      checkinCustomerId = res?.data?.id
      r.log('checkin-customer-created', !!checkinCustomerId, JSON.stringify(res?.error || ''))
    })

    let checkInId
    await r.step('check-in-via-ui', async () => {
      await h.gotoHash(page, '#/attendance/checkin')
      await page.waitForTimeout(700)
      r.log('checkin-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: /Check In$/ }).first().click()
      await page.waitForTimeout(400)
      const searchInput = page.getByPlaceholder('Search by name or phone...')
      await searchInput.fill('E2E Chk Visitor')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Chk Visitor' }).first().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: /Check In$/ }).last().click()
      await page.waitForTimeout(1000)
      r.log('check-in-no-crash', !(await h.hasErrorBoundary(page)))

      const activeRes = await page.evaluate(async () => window.api.customerCheckIn.active())
      const found = (activeRes?.data || []).find((c) => c.customerId === checkinCustomerId)
      checkInId = found?.id
      r.log('check-in-persisted-and-active', !!checkInId, JSON.stringify(found))
    })

    await r.step('check-out-via-ui', async () => {
      if (!checkInId) return r.log('check-out-via-ui', false, 'no checkInId')
      const row = page.locator('p', { hasText: 'E2E Chk Visitor' }).first().locator('xpath=ancestor::div[contains(@class,"flex items-center gap-4")][1]')
      await row.getByRole('button', { name: /Check Out/ }).click()
      await page.waitForTimeout(1000)
      r.log('check-out-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.customerCheckIn.list())
      const found = (listRes?.data || []).find((c) => c.id === checkInId)
      r.log('check-out-recorded', !!found?.checkOutTime, JSON.stringify(found))

      const activeAfter = await page.evaluate(async () => window.api.customerCheckIn.active())
      const stillActive = (activeAfter?.data || []).some((c) => c.id === checkInId)
      r.log('no-longer-in-active-list', !stillActive)
    })

    await r.step('restore-customer-checkin-module', async () => {
      const res = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), originalModules)
      r.log('customer-checkin-module-restored', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
    })

    // ── khataReminder.buildLink via real UI (Khata Risk Tier report) ────────
    const originalBusinessType = h.getBusinessType()
    let khataCustomerId, khataCustomerPhone

    await r.step('switch-to-grocery-and-seed-outstanding-customer', async () => {
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'GROCERY' }))
      r.log('business-type-switch-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)

      khataCustomerPhone = `9${String(Date.now()).slice(-9)}`
      const custRes = await page.evaluate(async ({ name, phone }) => window.api.customers.create({ customerName: name, phone }), { name: `${TEST_PREFIX} Khata Customer`, phone: khataCustomerPhone })
      khataCustomerId = custRes?.data?.id
      r.log('khata-customer-created', !!khataCustomerId, JSON.stringify(custRes?.error || ''))
      if (!khataCustomerId) return

      // The report only lists a customer with a real positive outstanding
      // balance (computeAgingRows skips anyone at/below zero) -- seeding a
      // ledger debit directly is the setup, not the gap under test.
      h.withDb((db) => db.prepare(
        "INSERT INTO CustomerLedger (id, customerId, referenceType, debitAmount, creditAmount, balance, createdAt) VALUES (?, ?, 'TEST', 5000, 0, 5000, ?)"
      ).run(`e2e-chk-ledger-${Date.now()}`, khataCustomerId, Date.now() - 100 * 24 * 3600000))
    })

    await r.step('send-khata-reminder-via-ui', async () => {
      if (!khataCustomerId) return r.log('send-khata-reminder-via-ui', false, 'no khataCustomerId')
      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button, [role="button"]', { hasText: 'Khata Risk Tier' }).first()
      r.log('khata-risk-tile-present', await tile.count() > 0)
      await tile.click()
      await page.waitForTimeout(500)
      await page.locator('button:has-text("Generate Report")').click()
      await page.waitForTimeout(1200)
      r.log('khata-risk-report-renders-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('td', { hasText: `${TEST_PREFIX} Khata Customer` }).first().locator('xpath=..')
      await row.getByRole('button', { name: 'Send Reminder' }).click()
      await page.waitForTimeout(1000)
      r.log('send-reminder-no-crash', !(await h.hasErrorBoundary(page)))

      // buildLink itself doesn't persist anything -- it's a pure link
      // builder (matches buildWhatsAppLink's own "records only" convention
      // elsewhere in this codebase) -- verify it via a direct call instead
      // of a DB row, same rigor as the reminder-link gaps closed earlier.
      const directRes = await page.evaluate((id) => window.api.khataReminder.buildLink({ customerId: id }), khataCustomerId)
      r.log('build-link-succeeds', !!directRes?.success && typeof directRes?.data === 'string' && directRes.data.startsWith('https://wa.me/'), JSON.stringify(directRes))
    })

    await r.step('khata-list-candidates-via-api', async () => {
      // No UI trigger anywhere in the renderer -- API-only coverage.
      const res = await page.evaluate(async () => window.api.khataReminder.listCandidates())
      r.log('list-candidates-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
      const found = (res?.data || []).some((c) => c.customerId === khataCustomerId || c.id === khataCustomerId)
      r.log('list-candidates-includes-our-customer', found, JSON.stringify(res?.data))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'GROCERY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })

    // ── templateSuggestion: get/isDismissed/dismiss via direct API ──────────
    // The real banner only renders for a GENERAL business after a week of
    // matching usage signals (a genuinely time-based heuristic) -- not
    // practically reproducible inside one E2E run. Exercises the same real
    // handler+service+DB round trip the banner's own click would.
    await r.step('template-suggestion-api-round-trip', async () => {
      const before = h.withDb((db) => db.prepare("SELECT settingValue FROM Setting WHERE settingKey = 'template_suggestion_dismissed'").get())

      const getRes = await page.evaluate(async () => window.api.templateSuggestion.get())
      r.log('get-succeeds', !!getRes?.success, JSON.stringify(getRes?.error || ''))

      const dismissRes = await page.evaluate(async () => window.api.templateSuggestion.dismiss())
      r.log('dismiss-succeeds', !!dismissRes?.success, JSON.stringify(dismissRes?.error || ''))

      const isDismissedRes = await page.evaluate(async () => window.api.templateSuggestion.isDismissed())
      r.log('is-dismissed-reflects-true', isDismissedRes?.success && isDismissedRes?.data === true, JSON.stringify(isDismissedRes))

      // Restore -- don't leave this shared dev DB's one-time nudge
      // permanently silenced by a test run.
      h.withDb((db) => {
        if (before?.settingValue !== undefined) {
          db.prepare("UPDATE Setting SET settingValue = ? WHERE settingKey = 'template_suggestion_dismissed'").run(before.settingValue)
        } else {
          db.prepare("DELETE FROM Setting WHERE settingKey = 'template_suggestion_dismissed'").run()
        }
      })
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Chk%'").all().map((r2) => r2.id)
      let ledger = 0, checkins = 0, custs = 0
      for (const cid of custIds) {
        ledger += db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid).changes
        checkins += db.prepare('DELETE FROM CustomerCheckIn WHERE customerId = ?').run(cid).changes
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ ledger, checkins, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCHECKIN/KHATA/TEMPLATE-SUGGESTION: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
