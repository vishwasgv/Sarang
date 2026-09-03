/**
 * Suite 34 — Beauty Salon vertical (multi_service_booking, staff_commission).
 * session_packs is generic infra already covered by suite 30 (Physio Clinic)
 * — not re-tested here. Real UI-driven multi-service appointment booking,
 * plus staff_commission's auto-trigger-on-COMPLETED (no create UI exists
 * for it by design). See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Salon'

// Phase 68 §9.1 — Beauty Salon items 1-4 report-tile render sweep.
async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange, expectNonEmpty, emptyStateText } = {}) {
  await h.gotoHash(page, '#/reports')
  await page.waitForTimeout(700)
  const tile = page.locator('button, [role="button"]', { hasText: tileLabel }).first()
  const present = await tile.count() > 0
  r.log(`${tileId}-tile-present`, present)
  if (!present) return
  await tile.click()
  await page.waitForTimeout(500)
  if (needsDateRange) {
    const dateInputs = page.locator('input[type="date"]')
    const from = h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000))
    const to = h.toLocalISODate(new Date())
    await dateInputs.nth(0).fill(from)
    await dateInputs.nth(1).fill(to)
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
  if (expectNonEmpty && emptyStateText) {
    const bodyText = await page.locator('body').innerText().catch(() => '')
    r.log(`${tileId}-shows-real-data`, !bodyText.includes(emptyStateText), 'expected our seeded data to flow through, not the empty-state message')
  }
  await h.shot(page, `report-${tileId}`)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-beauty-salon', async () => {
      const sw = await h.switchBusinessType(page, 'Beauty Salon')
      r.log('business-type-switched', sw.to === 'BEAUTY_SALON', JSON.stringify(sw))
    })

    await r.step('create-service-catalog-entries', async () => {
      const s1 = await page.evaluate(async () => window.api.serviceCatalog.create({
        serviceName: 'E2E Salon Haircut', durationMinutes: 30, basePrice: 300, taxRate: 18,
      }))
      const s2 = await page.evaluate(async () => window.api.serviceCatalog.create({
        serviceName: 'E2E Salon Hair Spa', durationMinutes: 45, basePrice: 800, taxRate: 18,
      }))
      r.log('service-catalog-entries-created', !!s1?.success && !!s2?.success)
    })

    await r.step('book-multi-service-appointment-via-real-ui', async () => {
      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'New Appointment' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const servicesSelect = modal.locator('select').first()
      await servicesSelect.selectOption({ label: 'E2E Salon Haircut — ₹300' })
      await page.waitForTimeout(300)
      // Re-query: adding a service re-renders the "+ Add service..." select fresh.
      await modal.locator('select').first().selectOption({ label: 'E2E Salon Hair Spa — ₹800' })
      await page.waitForTimeout(300)

      const totalText = modal.locator('text=Total: ₹1100')
      r.log('multi-service-total-computed-correctly', await totalText.count() > 0)

      const custSearch = modal.getByPlaceholder('Search existing client by name or phone...')
      await custSearch.fill('E2E Salon Client')
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E Salon Client')
        await modal.getByPlaceholder('Phone *').fill('9876500034')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      const tomorrow = h.toLocalISODate(new Date(Date.now() + 24 * 3600000))
      await modal.getByLabel('Date').fill(tomorrow)
      await modal.getByLabel('Time').fill('11:00')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Book Appointment' }).click()
      await page.waitForTimeout(1300)
      r.log('multi-service-appointment-booked-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'salon-multiservice-booked')
    })

    await r.step('verify-multi-service-appointment-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.appointments.list({}))
      const items = listRes?.data?.items || []
      const found = items.find((a) => (a.customerName === 'E2E Salon Client' || a.customer?.customerName === 'E2E Salon Client'))
      r.log('appointment-findable-via-api', !!found, JSON.stringify({ totalAmount: found?.totalAmount, services: found?.services }))
      r.log('appointment-total-reflects-both-services', Number(found?.totalAmount) === 1100, JSON.stringify(found?.totalAmount))
      const svcList = found?.services ? JSON.parse(found.services) : []
      r.log('appointment-services-field-lists-both', svcList.length === 2, JSON.stringify(svcList.map((s) => s.name)))
    })

    let providerId, commissionAppointmentId

    await r.step('staff-commission-auto-triggers-on-completed', async () => {
      // h.toLocalISODate must be called out here -- page.evaluate's callback
      // runs in the browser context, where `h` doesn't exist.
      const joinDate = h.toLocalISODate(new Date())
      const provRes = await page.evaluate(async (joinDate) => window.api.hr.createEmployee({
        fullName: 'E2E Salon Stylist', phone: `9${String(Date.now()).slice(-9)}`, joinDate,
      }), joinDate)
      providerId = provRes?.data?.id

      const scheduledDate = h.toLocalISODate(new Date())
      const apptRes = await page.evaluate(async ({ pid, scheduledDate }) => window.api.appointments.create({
        providerId: pid, customerName: 'E2E Salon Commission Client', serviceTitle: 'E2E Salon Manicure',
        scheduledDate, scheduledTime: '15:00', durationMinutes: 30,
        totalAmount: 500,
      }), { pid: providerId, scheduledDate })
      commissionAppointmentId = apptRes?.data?.id
      r.log('commission-test-appointment-created', !!commissionAppointmentId, JSON.stringify(apptRes?.error || ''))

      // Advance through the real UI's status buttons (staff_commission's
      // auto-calculate trigger lives in this screen's click handler, not the
      // backend service — a direct updateStatus() API call would silently
      // skip it, so this must go through the real UI). The Mark button is a
      // sibling of the customer-name <p>, not a descendant reachable by a
      // fixed xpath climb from it — scope by the Card's own className
      // instead, which the JSX confirms wraps both.
      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(700)
      // The screen fetches by getByDate(formatDate(selectedDate)), where
      // selectedDate defaults to `new Date()` at component-mount time — if a
      // UTC day boundary was crossed between creating the appointment above
      // and this navigation (this session has been running long enough to
      // risk that), the initial view can miss it. Explicitly click "Today"
      // to force selectedDate to a freshly-evaluated now before searching.
      await page.getByRole('button', { name: 'Today' }).click()
      await page.waitForTimeout(700)
      const row = page.locator('div.flex.items-start.gap-4').filter({ hasText: 'E2E Salon Commission Client' })
      r.log('commission-appointment-row-visible', await row.count() > 0)
      for (let i = 0; i < 3; i++) {
        const advanceBtn = row.locator('button', { hasText: 'Mark' })
        if (await advanceBtn.count() === 0) break
        await advanceBtn.first().click()
        await page.waitForTimeout(800)
      }
      r.log('status-advanced-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-commission-record-via-api', async () => {
      if (!commissionAppointmentId) return r.log('verify-commission-record-via-api', false, 'no commissionAppointmentId captured')
      const apptRes = await page.evaluate((id) => window.api.appointments.get({ id }), commissionAppointmentId)
      r.log('appointment-reached-completed', apptRes?.data?.status === 'COMPLETED', JSON.stringify(apptRes?.data?.status))

      const listRes = await page.evaluate(async () => window.api.staffCommission.listAll({}))
      const records = listRes?.data || []
      const found = records.find((c) => c.appointmentId === commissionAppointmentId)
      r.log('commission-record-auto-created', !!found, JSON.stringify({ commissionAmount: found?.commissionAmount, staffId: found?.staffId }))
    })

    await r.step('seed-repeat-client-data', async () => {
      // generateStylistRepeatClientReport requires a real customerId (not just
      // a free-text customerName) plus 2+ COMPLETED appointments with the SAME
      // provider+customer to count as a "repeat" — the commission-flow
      // appointment above uses a bare customerName, so it can never show up
      // here. Build genuine repeat-client data directly via the API (the
      // status-transition UI path is already covered by the commission test
      // above; this step is purely about feeding the report real data).
      const custRes = await page.evaluate(async () => window.api.customers.create({ customerName: 'E2E Salon Repeat Client', phone: `9${String(Date.now()).slice(-9)}` }))
      const custId = custRes?.data?.id
      r.log('repeat-client-customer-created', !!custId, JSON.stringify(custRes?.error || ''))

      const today = h.toLocalISODate(new Date())
      let firstId, secondId
      if (custId && providerId) {
        const a1 = await page.evaluate(async ({ pid, cid, today }) => window.api.appointments.create({
          providerId: pid, customerId: cid, serviceTitle: 'E2E Salon Repeat Visit 1', scheduledDate: today, scheduledTime: '09:00', totalAmount: 400,
        }), { pid: providerId, cid: custId, today })
        const a2 = await page.evaluate(async ({ pid, cid, today }) => window.api.appointments.create({
          providerId: pid, customerId: cid, serviceTitle: 'E2E Salon Repeat Visit 2', scheduledDate: today, scheduledTime: '10:00', totalAmount: 400,
        }), { pid: providerId, cid: custId, today })
        firstId = a1?.data?.id; secondId = a2?.data?.id
        r.log('repeat-appointments-created', !!firstId && !!secondId, JSON.stringify({ err1: a1?.error, err2: a2?.error }))
        if (firstId) await page.evaluate((id) => window.api.appointments.updateStatus({ id, status: 'COMPLETED' }), firstId)
        if (secondId) await page.evaluate((id) => window.api.appointments.updateStatus({ id, status: 'COMPLETED' }), secondId)
      }
    })

    await r.step('stylist-repeat-client-report', () => checkReportTile(page, r, 'stylistRepeatClient', 'Stylist Repeat-Client Rate', {
      needsDateRange: true, expectNonEmpty: true, emptyStateText: 'No completed appointments with an assigned stylist in this date range.',
    }))

    await r.step('retail-attach-rate-report', () => checkReportTile(page, r, 'retailAttachRate', 'Retail Attach Rate', { needsDateRange: true }))

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'BEAUTY_SALON') {
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
      const empIds = db.prepare("SELECT id FROM Employee WHERE fullName LIKE 'E2E Salon%'").all().map((r2) => r2.id)
      for (const eid of empIds) { try { db.prepare('DELETE FROM Employee WHERE id = ?').run(eid) } catch { db.prepare('UPDATE Employee SET isActive = 0 WHERE id = ?').run(eid) } }
      const apptIds = db.prepare("SELECT id FROM Appointment WHERE serviceTitle LIKE 'E2E Salon%' OR customerName LIKE 'E2E Salon%'").all().map((r2) => r2.id)
      for (const aid of apptIds) { try { db.prepare('DELETE FROM Appointment WHERE id = ?').run(aid) } catch { /* noop */ } }
      const catIds = db.prepare("SELECT id FROM ServiceCatalog WHERE serviceName LIKE 'E2E Salon%'").all().map((r2) => r2.id)
      for (const cid of catIds) { try { db.prepare('DELETE FROM ServiceCatalog WHERE id = ?').run(cid) } catch { /* noop */ } }
      console.log('extra cleanup: employees', empIds.length, 'appointments', apptIds.length, 'catalog', catIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nBEAUTY SALON VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
