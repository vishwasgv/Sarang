/**
 * Suite 2 — Service-business core (Phase 22 foundation + representative
 * exemplar). Appointment booking via the real UI (no-provider path),
 * double-booking rejection (via direct API against a real provider — the
 * UI's slot picker forecloses ever clicking a conflicting slot, so this is
 * exercised the same way the UI's own IPC call would be made), status
 * advancement, cancel.
 *
 * Scope note (deliberate, per PHASE_55_TECHNICAL_SPEC.md's "representative
 * exemplar" philosophy): this suite covers the Appointment engine itself,
 * shared by all 24 service verticals — it does NOT re-drive a full clinic
 * visit-note/vitals flow, Diagnostic Lab order lifecycle, or Blood Bank
 * donation flow, since those each already got a dedicated live-UAT pass at
 * ship time (Phases 50, 51 respectively) and re-testing them exhaustively
 * here has low marginal value versus the time cost. If a future session
 * wants that broader depth, add 02b/02c/02d suites following this file's
 * pattern rather than growing this one further.
 *
 * GP_CLINIC has no tile in IndustrySettingsScreen.tsx (a known,
 * pre-existing gap — most service verticals aren't listed there), so this
 * suite switches business type via the raw IPC call + a page.reload()
 * (the documented workaround for the resulting industry-store staleness),
 * not via harness.switchBusinessType (which only drives the real Settings
 * UI and requires a tile to exist).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Svc'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    const originalBusinessType = h.getBusinessType()

    await r.step('switch-to-beauty-salon', async () => {
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'GP_CLINIC' }))
      r.log('business-type-switch-api-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(600)
      r.log('appointments-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let providerId, appointmentId, appointmentNumber

    await r.step('create-provider-and-customer', async () => {
      const empRes = await page.evaluate(async () => window.api.hr.createEmployee({
        fullName: 'E2E Svc Provider', phone: `9${String(Date.now()).slice(-9)}`, joinDate: new Date().toISOString().slice(0, 10),
      }))
      r.log('provider-created', !!empRes?.success, JSON.stringify(empRes?.error || ''))
      providerId = empRes?.data?.id

      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Svc Client', phone: `8${String(Date.now()).slice(-9)}`,
      }))
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
    })

    await r.step('book-appointment-via-real-ui', async () => {
      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(600)
      await page.getByRole('button', { name: 'New Appointment' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const custSearch = modal.getByPlaceholder('Search existing client by name or phone...')
      await custSearch.fill('E2E Svc Client')
      await page.waitForTimeout(700)
      const custOption = modal.locator('button', { hasText: 'E2E Svc Client' }).first()
      r.log('client-search-found-result', await custOption.count() > 0)
      await custOption.click()
      await page.waitForTimeout(300)

      await modal.getByLabel('Service Title').fill('E2E Svc Haircut')
      // Deliberately leave Provider as "Any provider" — a freshly-created
      // Employee has no configured working hours, so the provider-specific
      // slot picker legitimately shows zero available slots (not a bug,
      // just untestable without also seeding shift config). "Any provider"
      // uses the plain native Time input instead, which has no such
      // dependency. The conflict-rejection path itself (which only runs
      // when a providerId IS set) is exercised separately below via direct
      // API calls against our own created provider.
      await page.waitForTimeout(300)

      const tomorrow = new Date(Date.now() + 24 * 3600000)
      const dateStr = tomorrow.toISOString().slice(0, 10)
      await modal.getByLabel('Date').fill(dateStr)
      await modal.getByLabel('Time').fill('10:00')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Book Appointment' }).click()
      await page.waitForTimeout(1300)
      r.log('appointment-booked-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'appointment-booked')

      const listRes = await page.evaluate(async () => window.api.appointments.list({}))
      const items = listRes?.data?.items || []
      const created = items.find((a) => a.customerName === 'E2E Svc Client' || a.clientName === 'E2E Svc Client' || a.customer?.customerName === 'E2E Svc Client')
      appointmentId = created?.id
      appointmentNumber = created?.appointmentNumber
      r.log('appointment-created-and-findable-via-api', !!appointmentId, JSON.stringify({ scheduledDate: created?.scheduledDate, scheduledTime: created?.scheduledTime }))
    })

    await r.step('double-booking-rejected-at-service-layer', async () => {
      if (!providerId) return r.log('double-booking-rejected-at-service-layer', false, 'no providerId captured')
      const tomorrow = new Date(Date.now() + 24 * 3600000)
      const scheduledDate = tomorrow.toISOString().slice(0, 10)
      // The conflict check only runs when a providerId is set (the UI path
      // above deliberately used "Any provider" to sidestep the
      // working-hours dependency) — exercise it directly via the same IPC
      // call the UI itself makes: book this provider once, then attempt an
      // identical second booking and confirm it's rejected.
      const firstRes = await page.evaluate(async ({ providerId, scheduledDate }) => window.api.appointments.create({
        providerId, customerName: 'E2E Svc Conflict Client 1', serviceTitle: 'E2E Svc Conflict Slot',
        scheduledDate, scheduledTime: '09:00', durationMinutes: 30,
      }), { providerId, scheduledDate })
      r.log('first-provider-booking-succeeded', !!firstRes?.success, JSON.stringify(firstRes?.error || ''))

      const conflictRes = await page.evaluate(async ({ providerId, scheduledDate }) => window.api.appointments.create({
        providerId, customerName: 'E2E Svc Conflict Client 2', serviceTitle: 'E2E Svc Conflict Slot',
        scheduledDate, scheduledTime: '09:00', durationMinutes: 30,
      }), { providerId, scheduledDate })
      r.log('conflicting-second-booking-correctly-rejected', conflictRes?.success === false && conflictRes?.error?.code === 'APT-CONFLICT', JSON.stringify(conflictRes?.error || conflictRes))
    })

    await r.step('advance-and-cancel-status', async () => {
      if (!appointmentId) return r.log('advance-and-cancel-status', false, 'no appointmentId captured')
      const advanceRes = await page.evaluate(async (id) => window.api.appointments.updateStatus({ id, status: 'CONFIRMED' }), appointmentId)
      r.log('status-advanced-to-confirmed', !!advanceRes?.success, JSON.stringify(advanceRes?.error || ''))

      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(600)
      // The screen defaults to TODAY (no date param in the hash route) but
      // this suite deliberately books "tomorrow" (see the comment above the
      // 1300ms-earlier booking step) — the appointment's row genuinely
      // isn't rendered until the view is advanced one day via the UI's own
      // "next day" control (no title/aria-label on it, so target by
      // position: prev-day chevron, "Today", next-day chevron).
      await page.locator('button', { hasText: 'Today' }).locator('xpath=following-sibling::button[1]').click()
      await page.waitForTimeout(600)

      // Scope to this specific appointment's row (by its unique customer
      // name), not the whole page body — a page-wide text match on
      // "Confirmed" is a false positive: the status-filter chip row above
      // the list renders the literal word "Confirmed" as a filter option
      // regardless of what's actually in the list.
      const row = page.locator('p', { hasText: 'E2E Svc Client' }).first().locator('xpath=../../../..')
      r.log('confirmed-badge-visible-in-list', await row.locator('text=Confirmed').count() > 0)

      const cancelBtn = row.locator('button[title="Cancel appointment"]')
      if (await cancelBtn.count()) {
        await cancelBtn.click()
        await page.waitForTimeout(1000)
        // getAppointmentsByDate deliberately excludes CANCELLED status
        // server-side (a day's schedule view shouldn't clutter with
        // cancelled slots) — the row disappearing from THIS list is the
        // correct, intended behavior, not something to assert a visible
        // "Cancelled" badge for. Verify the actual status via API instead.
        r.log('row-removed-from-day-view-after-cancel', await page.locator('p', { hasText: 'E2E Svc Client' }).count() === 0)
        const afterRes = await page.evaluate(async () => window.api.appointments.list({}))
        const afterAppt = afterRes?.data?.items?.find((a) => a.id === appointmentId)
        r.log('status-is-cancelled-via-api', afterAppt?.status === 'CANCELLED', JSON.stringify(afterAppt?.status))
      } else {
        r.log('cancel-button-present', false)
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'GP_CLINIC') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    // Employees/appointments aren't covered by cleanupByNamePrefix (that
    // helper only handles Customer/Product) — clean those separately.
    h.withDb((db) => {
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Svc%'").all().map((r2) => r2.id)
      for (const eid of empIds) {
        try { db.prepare('DELETE FROM Employee WHERE id = ?').run(eid) } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(eid) }
      }
      const apptIds = db.prepare("SELECT id FROM Appointment WHERE serviceTitle LIKE 'E2E Svc%' OR customerName LIKE 'E2E Svc%'").all().map((r2) => r2.id)
      for (const aid of apptIds) {
        try { db.prepare('DELETE FROM Appointment WHERE id = ?').run(aid) } catch { /* leave it, harmless test row */ }
      }
      console.log('extra cleanup: employees', empIds.length, 'appointments', apptIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSERVICE BUSINESS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
