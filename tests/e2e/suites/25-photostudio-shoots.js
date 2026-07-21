/**
 * Suite 25 — Photo Studio vertical (shoot_bookings). Real UI-driven booking
 * creation, then finalAmount set via Edit (create-time field is disabled/
 * absent — finalAmount is edit-only per ShootsScreen.tsx), then invoice
 * generation. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Photo'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-photo-studio', async () => {
      const sw = await h.switchBusinessType(page, 'Photography Studio')
      r.log('business-type-switched', sw.to === 'PHOTO_STUDIO', JSON.stringify(sw))
    })

    await r.step('create-booking-via-real-ui', async () => {
      await h.gotoHash(page, '#/photo/shoots')
      await page.waitForTimeout(700)
      r.log('shoots-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Booking' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill('E2E Photo Client')
      await page.waitForTimeout(700)
      // The "+" is a separate Plus icon, not text — the button's actual text
      // content is just "Add new customer".
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill('E2E Photo Client')
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      await modal.getByPlaceholder('Venue / address').fill('E2E Photo Test Venue')
      const dateInput = modal.locator('input[type="date"]').first()
      await dateInput.fill(h.toLocalISODate(new Date(Date.now() + 7 * 24 * 3600000)))
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Save Booking' }).click()
      await page.waitForTimeout(1200)
      r.log('booking-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'photostudio-booking-created')
    })

    let bookingId

    await r.step('verify-booking-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.shootBooking.list({}))
      const bookings = listRes?.data || []
      const found = bookings.find((b) => b.shootLocation === 'E2E Photo Test Venue')
      bookingId = found?.id
      r.log('booking-findable-via-api', !!bookingId, JSON.stringify({ status: found?.status, shootType: found?.shootType }))
    })

    await r.step('set-final-amount-via-edit-and-generate-invoice', async () => {
      if (!bookingId) return r.log('set-final-amount-via-edit-and-generate-invoice', false, 'no bookingId captured')

      const editBtn = page.locator('button:has(svg.lucide-pencil)').first()
      r.log('edit-button-present', await editBtn.count() > 0)
      await editBtn.click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const amountInput = modal.getByPlaceholder('For invoicing')
      await amountInput.fill('15000')
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1200)
      r.log('final-amount-saved-no-crash', !(await h.hasErrorBoundary(page)))

      // "Generate Invoice" only renders inside the row's expanded (clicked-open)
      // state, not the collapsed header — expand it first.
      const bookingRow = page.locator('p', { hasText: 'E2E Photo Client' }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
      await bookingRow.click()
      await page.waitForTimeout(500)

      const genInvBtn = page.locator('button', { hasText: 'Generate Invoice' }).first()
      r.log('generate-invoice-button-present-after-amount-set', await genInvBtn.count() > 0)
      await genInvBtn.click()
      await page.waitForTimeout(1500)
      r.log('invoice-generation-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'photostudio-invoice-generated')
    })

    await r.step('verify-invoice-via-api', async () => {
      const detailRes = await page.evaluate((id) => window.api.shootBooking.get(id), bookingId)
      const invoiceId = detailRes?.data?.invoiceId
      r.log('booking-has-invoice-id', !!invoiceId, JSON.stringify(invoiceId))
      if (invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), invoiceId)
        const expectedTotal = 15000 * 1.18
        r.log('invoice-total-correct', Math.abs((invRes?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${invRes?.data?.totalAmount}`)
      }
    })

    await r.step('delivery-milestone-tracker-works', async () => {
      const res = await page.evaluate((id) => window.api.deliveryTracker.upsert({ shootBookingId: id, proofsSentDate: h.toLocalISODate(new Date()) }), bookingId)
      r.log('delivery-milestone-updated', !!res?.success, JSON.stringify(res?.error || ''))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PHOTO_STUDIO') {
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
      const ids = db.prepare("SELECT id FROM ShootBooking WHERE shootLocation LIKE 'E2E Photo%'").all().map((r2) => r2.id)
      for (const id of ids) { try { db.prepare('DELETE FROM ShootBooking WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: bookings', ids.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPHOTO STUDIO VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
