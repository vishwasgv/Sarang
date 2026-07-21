/**
 * Suite 26 — Event Management vertical (event_bookings). Structurally
 * near-identical to ShootBooking (suite 25) — same edit-only finalAmount,
 * expanded-row-only Generate Invoice pattern, and CustomerPicker quick-add.
 * Also exercises the EVT-002 delete-guard-after-invoice regression (mirrors
 * SHT-002 on ShootBooking, per project_vertical_uat_research.md).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Evt'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-event-management', async () => {
      const sw = await h.switchBusinessType(page, 'Event Management')
      r.log('business-type-switched', sw.to === 'EVENT_MANAGEMENT', JSON.stringify(sw))
    })

    await r.step('create-event-via-real-ui', async () => {
      await h.gotoHash(page, '#/events/list')
      await page.waitForTimeout(700)
      r.log('events-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Event' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Evt Client')
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E Evt Client')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      await modal.getByPlaceholder('e.g. Sharma Wedding').fill('E2E Evt Test Wedding')
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(h.toLocalISODate(new Date(Date.now() + 30 * 24 * 3600000)))
      await modal.getByPlaceholder('e.g. The Grand Ballroom').fill('E2E Evt Test Venue')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Save Event' }).click()
      await page.waitForTimeout(1200)
      r.log('event-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'eventmgmt-event-created')
    })

    let eventId

    await r.step('verify-event-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.eventBooking.list({}))
      const events = listRes?.data || []
      const found = events.find((e) => e.eventName === 'E2E Evt Test Wedding')
      eventId = found?.id
      r.log('event-findable-via-api', !!eventId, JSON.stringify({ status: found?.status, venueName: found?.venueName }))
    })

    await r.step('set-final-amount-and-generate-invoice', async () => {
      if (!eventId) return r.log('set-final-amount-and-generate-invoice', false, 'no eventId captured')

      const editBtn = page.locator('button:has(svg.lucide-pencil)').first()
      await editBtn.click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('For invoicing').fill('80000')
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1200)
      r.log('final-amount-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const eventRow = page.locator('p', { hasText: 'E2E Evt Test Wedding' }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
      await eventRow.click()
      await page.waitForTimeout(500)

      const genInvBtn = page.locator('button', { hasText: 'Generate Invoice' }).first()
      r.log('generate-invoice-button-present', await genInvBtn.count() > 0)
      await genInvBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generation-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'eventmgmt-invoice-generated')
    })

    let invoiceId

    await r.step('verify-invoice-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.eventBooking.list({}))
      const events = listRes?.data || []
      const found = events.find((e) => e.id === eventId)
      invoiceId = found?.invoiceId
      r.log('event-has-invoice-id', !!invoiceId, JSON.stringify(invoiceId))
      if (invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        const expectedTotal = 80000 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('delete-guard-after-invoice-EVT-002', async () => {
      if (!eventId) return r.log('delete-guard-after-invoice-EVT-002', false, 'no eventId captured')
      const delRes = await page.evaluate((id) => window.api.eventBooking.delete(id), eventId)
      r.log('delete-after-invoice-correctly-rejected', delRes?.success === false && delRes?.error?.code === 'EVT-002', JSON.stringify(delRes?.error))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'EVENT_MANAGEMENT') {
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
      const ids = db.prepare("SELECT id FROM EventBooking WHERE eventName LIKE 'E2E Evt%'").all().map((r2) => r2.id)
      for (const id of ids) { try { db.prepare('DELETE FROM EventBooking WHERE id = ?').run(id) } catch { /* left in place — delete-guard is meant to hold post-invoice */ } }
      console.log('extra cleanup: events', ids.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nEVENT MANAGEMENT VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
