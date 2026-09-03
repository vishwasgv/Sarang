/**
 * Suite 123 — staffCommission.markPaid (broader-gap-list Section C, money-
 * critical, 2026-09-03). calculate fires automatically when an appointment
 * is marked Completed for a provider, with staff_commission module enabled
 * (AppointmentsScreen.tsx) -- already indirectly exercised elsewhere, but
 * markPaid itself (StaffCommissionScreen.tsx's bulk-select action) had zero
 * coverage of any kind.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E StaffComm'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-beauty-salon', async () => {
      const sw = await h.switchBusinessType(page, 'Beauty Salon')
      r.log('business-type-switched', sw.to === 'BEAUTY_SALON', JSON.stringify(sw))
    })

    let customerId, providerId
    await r.step('create-customer-and-provider', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Customer ${suffix}`)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))

      const joinDate = h.toLocalISODate(new Date())
      const empRes = await page.evaluate(({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `8${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Stylist ${suffix}`, joinDate })
      providerId = empRes?.data?.id
      r.log('provider-created', !!providerId, JSON.stringify(empRes?.error || ''))
    })

    let appointmentId
    const serviceTitle = `${TEST_PREFIX} Haircut Service ${suffix}`
    await r.step('complete-appointment-to-auto-calculate-commission', async () => {
      const today = h.toLocalISODate(new Date())
      const apptRes = await page.evaluate(({ customerId, providerId, today, serviceTitle }) => window.api.appointments.create({
        customerId, providerId, serviceTitle, scheduledDate: today, scheduledTime: '15:00', totalAmount: 1200,
      }), { customerId, providerId, today, serviceTitle })
      appointmentId = apptRes?.data?.id
      r.log('appointment-created-via-api', !!appointmentId, JSON.stringify(apptRes?.error || ''))
      if (!appointmentId) return

      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(700)
      const row = () => page.locator('p', { hasText: serviceTitle }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row().locator('button', { hasText: 'Mark Confirmed' }).click()
      await page.waitForTimeout(700)
      await row().locator('button', { hasText: 'Mark In Progress' }).click()
      await page.waitForTimeout(700)
      await row().locator('button', { hasText: 'Mark Completed' }).click()
      await page.waitForTimeout(1200)
      r.log('appointment-completed-no-crash', !(await h.hasErrorBoundary(page)))

      const commRes = await page.evaluate(() => window.api.staffCommission.listAll({}))
      const commissions = commRes?.data || []
      const found = commissions.find((c) => c.appointment?.id === appointmentId)
      r.log('commission-auto-calculated', !!found && Number(found.commissionAmount) === 120 && !found.isPaid, JSON.stringify(found))
    })

    await r.step('mark-commission-paid-via-ui', async () => {
      if (!appointmentId) return r.log('mark-commission-paid-via-ui', false, 'no appointmentId')
      await h.gotoHash(page, '#/commission')
      await page.waitForTimeout(700)
      r.log('staff-commission-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('tab', { name: 'All Records' }).click().catch(async () => {
        await page.locator('button', { hasText: 'All Records' }).click()
      })
      await page.waitForTimeout(500)

      const commRes = await page.evaluate(() => window.api.staffCommission.listAll({}))
      const commissions = commRes?.data || []
      const target = commissions.find((c) => c.appointment?.id === appointmentId)
      r.log('commission-record-found-for-marking', !!target, JSON.stringify(target?.id))
      if (!target) return

      const row = page.locator('tr', { hasText: serviceTitle }).first()
      await row.locator('input[type="checkbox"]').check()
      await page.waitForTimeout(300)
      await page.locator('button', { hasText: 'Mark 1 as Paid' }).click()
      await page.waitForTimeout(1200)
      r.log('mark-paid-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate(() => window.api.staffCommission.listAll({}))
      const after = (afterRes?.data || []).find((c) => c.id === target.id)
      r.log('commission-actually-marked-paid', after?.isPaid === true && !!after?.paidDate, JSON.stringify(after))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'BEAUTY_SALON') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let comms = 0, appts = 0, custs = 0
      for (const cid of custIds) {
        const apptIds = db.prepare('SELECT id FROM Appointment WHERE customerId = ?').all(cid).map((row) => row.id)
        for (const aid of apptIds) {
          try { comms += db.prepare('DELETE FROM StaffCommission WHERE appointmentId = ?').run(aid).changes } catch { /* noop */ }
        }
        try { appts += db.prepare('DELETE FROM Appointment WHERE customerId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let emps = 0
      for (const eid of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(eid).changes } catch { /* noop */ } }
      console.log('extra cleanup:', JSON.stringify({ comms, appts, custs, emps }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSTAFF COMMISSION MARK PAID: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
