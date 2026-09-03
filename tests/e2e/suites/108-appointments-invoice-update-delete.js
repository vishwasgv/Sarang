/**
 * Suite 108 — appointments.generateInvoice/generateBatchInvoice/update/delete
 * (broader-gap-list Section C, money-critical, 2026-09-03). Appointment
 * booking + updateStatus are already covered (suite 02); this closes the
 * remaining four channels. update/delete have NO UI trigger anywhere in
 * the renderer -- only status transitions and the Checkout flow exist for
 * an end user, there is no way to edit appointment details (date/time/
 * service) or delete a mistaken booking from the real app today. Covered
 * here via direct API (same rigor as every other "no UI trigger" gap this
 * session), but this is a more consequential product gap than most of
 * those and worth flagging to the founder separately.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Appt'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)
    const originalBusinessType = h.getBusinessType()

    await r.step('switch-to-gp-clinic', async () => {
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'GP_CLINIC' }))
      r.log('business-type-switch-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
    })

    let serviceCatalogId
    await r.step('seed-service-catalog-entry', async () => {
      // generateInvoice rejects any appointment with neither a services JSON
      // blob nor a linked serviceCatalogId (APT-018) -- a real tax rate must
      // be resolvable, so every appointment below needs one.
      const res = await page.evaluate(async (name) => window.api.serviceCatalog.create({
        serviceName: name, basePrice: 500, taxRate: 0,
      }), `${TEST_PREFIX} Consultation`)
      serviceCatalogId = res?.data?.id
      r.log('service-catalog-seeded', !!serviceCatalogId, JSON.stringify(res?.error || ''))
    })

    async function createCustomer(customerName) {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}` }), customerName)
      return custRes?.data?.id
    }

    async function createCompletedAppointment(customerId, timeSlot) {
      const today = h.toLocalISODate(new Date())
      const apptRes = await page.evaluate(async ({ customerId, serviceCatalogId, today, timeSlot }) => window.api.appointments.create({
        customerId, serviceCatalogId, serviceTitle: 'E2E Appt Checkup', scheduledDate: today, scheduledTime: timeSlot, totalAmount: 500,
      }), { customerId, serviceCatalogId, today, timeSlot })
      const appointmentId = apptRes?.data?.id
      if (appointmentId) {
        await page.evaluate((id) => window.api.appointments.updateStatus({ id, status: 'COMPLETED' }), appointmentId)
      }
      return { customerId, appointmentId }
    }

    let appt1, appt2, appt3
    await r.step('seed-appointments', async () => {
      // Batch invoicing requires every selected appointment to share the
      // SAME customer (APT-025) -- appt2/appt3 reuse one customer, appt1
      // (the single-checkout test) gets its own.
      const customer1Id = await createCustomer(`${TEST_PREFIX} Client 1`)
      appt1 = await createCompletedAppointment(customer1Id, '10:00')
      const customer23Id = await createCustomer(`${TEST_PREFIX} Client 2`)
      appt2 = await createCompletedAppointment(customer23Id, '11:00')
      appt3 = await createCompletedAppointment(customer23Id, '11:30')
      r.log('three-completed-appointments-seeded', !!(appt1.appointmentId && appt2.appointmentId && appt3.appointmentId), JSON.stringify({ appt1, appt2, appt3 }))
    })

    await r.step('single-checkout-generates-invoice-via-ui', async () => {
      if (!appt1?.appointmentId) return r.log('single-checkout-generates-invoice-via-ui', false, 'no appt1')
      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(700)
      r.log('appointments-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('p', { hasText: `${TEST_PREFIX} Client 1` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row.locator('button[title="Checkout"]').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Complete Checkout' }).click()
      await page.waitForTimeout(1200)
      r.log('checkout-no-crash', !(await h.hasErrorBoundary(page)))

      const detail = await page.evaluate((id) => window.api.appointments.get({ id }), appt1.appointmentId)
      r.log('invoice-generated', !!detail?.data?.invoiceId, JSON.stringify(detail?.data?.invoiceId))
      if (detail?.data?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), detail.data.invoiceId)
        r.log('invoice-total-matches-service-amount', Math.abs((invRes?.data?.totalAmount ?? 0) - 500) < 1, JSON.stringify(invRes?.data?.totalAmount))
      }
    })

    await r.step('batch-checkout-generates-invoice-via-ui', async () => {
      if (!appt2?.appointmentId || !appt3?.appointmentId) return r.log('batch-checkout-generates-invoice-via-ui', false, 'missing appt2/appt3')
      await page.reload()
      await page.waitForTimeout(1500)
      await h.gotoHash(page, '#/appointments')
      await page.waitForTimeout(700)

      // Both appointments share the same customer (required for batch
      // invoicing -- APT-025), so their rows can't be told apart by
      // customer name -- use each one's own scheduled time instead.
      const row2 = page.locator('p', { hasText: '11:00' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row2.locator('input[type="checkbox"]').check()
      const row3 = page.locator('p', { hasText: '11:30' }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
      await row3.locator('input[type="checkbox"]').check()
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: /Generate Invoice \(2\)/ }).click()
      await page.waitForTimeout(1500)
      r.log('batch-checkout-no-crash', !(await h.hasErrorBoundary(page)))

      const d2 = await page.evaluate((id) => window.api.appointments.get({ id }), appt2.appointmentId)
      const d3 = await page.evaluate((id) => window.api.appointments.get({ id }), appt3.appointmentId)
      r.log('both-appointments-invoiced', !!d2?.data?.invoiceId && !!d3?.data?.invoiceId, JSON.stringify({ inv2: d2?.data?.invoiceId, inv3: d3?.data?.invoiceId }))
    })

    // update/delete: no UI trigger anywhere in the renderer -- API-only.
    let appt4
    await r.step('appointment-update-via-api', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({ customerName: name, phone: `9${String(Date.now()).slice(-9)}` }), `${TEST_PREFIX} Client 4`)
      const future = h.toLocalISODate(new Date(Date.now() + 5 * 24 * 3600000))
      const apptRes = await page.evaluate(async ({ customerId, future }) => window.api.appointments.create({
        customerId, serviceTitle: 'E2E Appt Original Title', scheduledDate: future, scheduledTime: '09:00', totalAmount: 300,
      }), { customerId: custRes?.data?.id, future })
      appt4 = apptRes?.data?.id
      r.log('appointment-4-created', !!appt4, JSON.stringify(apptRes?.error || ''))
      if (!appt4) return

      const updRes = await page.evaluate((id) => window.api.appointments.update({ id, serviceTitle: 'E2E Appt Updated Title', totalAmount: 450 }), appt4)
      r.log('appointment-update-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      const after = await page.evaluate((id) => window.api.appointments.get({ id }), appt4)
      r.log('appointment-fields-updated', after?.data?.serviceTitle === 'E2E Appt Updated Title' && after?.data?.totalAmount === 450, JSON.stringify(after?.data))
    })

    await r.step('appointment-delete-via-api', async () => {
      if (!appt4) return r.log('appointment-delete-via-api', false, 'no appt4')
      const delRes = await page.evaluate((id) => window.api.appointments.delete({ id }), appt4)
      r.log('appointment-delete-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      const after = await page.evaluate((id) => window.api.appointments.get({ id }), appt4)
      r.log('appointment-actually-gone', after?.success === false || !after?.data, JSON.stringify(after))
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
    h.withDb((db) => {
      const apptIds = db.prepare("SELECT id, customerId FROM Appointment WHERE customerName LIKE 'E2E Appt%' OR customerId IN (SELECT id FROM Customer WHERE customerName LIKE 'E2E Appt%')").all()
      let invoices = 0, invoiceItems = 0, appts = 0
      for (const a of apptIds) {
        const appt = db.prepare('SELECT invoiceId FROM Appointment WHERE id = ?').get(a.id)
        if (appt?.invoiceId) {
          invoiceItems += db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(appt.invoiceId).changes
          try { invoices += db.prepare('DELETE FROM Invoice WHERE id = ?').run(appt.invoiceId).changes } catch { /* noop */ }
        }
        try { appts += db.prepare('DELETE FROM Appointment WHERE id = ?').run(a.id).changes } catch { /* noop */ }
      }
      const custIds = db.prepare("SELECT id FROM Customer WHERE customerName LIKE 'E2E Appt%'").all().map((r2) => r2.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const services = db.prepare("DELETE FROM ServiceCatalog WHERE serviceName LIKE 'E2E Appt%'").run().changes
      console.log('extra cleanup:', JSON.stringify({ invoices, invoiceItems, appts, custs, services }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nAPPOINTMENTS INVOICE/UPDATE/DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
