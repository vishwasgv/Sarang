/**
 * Suite 159 — the one item left un-struck in broader-gap-list.md after the
 * rest of the audit closed: shootBooking.delete (create/update/generateInvoice
 * already covered via real UI, suite 25). Photo Studio vertical.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E159'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-photo-studio', async () => {
      const sw = await h.switchBusinessType(page, 'Photography Studio')
      r.log('business-type-switched', sw.to === 'PHOTO_STUDIO', JSON.stringify(sw))
    })

    let clientId, booking1Id, booking2Id
    await r.step('seed-bookings-via-api', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Client ${suffix}`)
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))

      const b1 = await page.evaluate(({ clientId, shootDate, shootLocation }) => window.api.shootBooking.create({
        clientId, shootType: 'WEDDING', shootDate, shootLocation, estimatedDurationHours: 4,
      }), { clientId, shootDate: h.toLocalISODate(new Date(Date.now() + 7 * 24 * 3600000)), shootLocation: `${TEST_PREFIX} Venue Delete Me ${suffix}` })
      booking1Id = b1?.data?.id
      r.log('booking1-seeded', !!booking1Id, JSON.stringify(b1?.error || ''))

      const b2 = await page.evaluate(({ clientId, shootDate, shootLocation }) => window.api.shootBooking.create({
        clientId, shootType: 'PORTRAIT', shootDate, shootLocation, estimatedDurationHours: 2,
      }), { clientId, shootDate: h.toLocalISODate(new Date(Date.now() + 7 * 24 * 3600000)), shootLocation: `${TEST_PREFIX} Venue Invoiced ${suffix}` })
      booking2Id = b2?.data?.id
      r.log('booking2-seeded', !!booking2Id, JSON.stringify(b2?.error || ''))
    })

    await r.step('delete-booking-via-real-ui', async () => {
      await h.gotoHash(page, '#/photo/shoots')
      await page.waitForTimeout(700)
      r.log('shoots-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Scope by shootLocation, not client name -- both seeded bookings
      // share the same client, so a client-name match doesn't distinguish
      // which row is "Delete Me" vs "Invoiced" (hit live: .first() grabbed
      // the wrong booking and deleted the one meant for the next step).
      const row = page.locator('p', { hasText: `${TEST_PREFIX} Venue Delete Me ${suffix}` }).first()
        .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
      await row.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.shootBooking.list({}))
      const bookings = listRes?.data?.bookings || listRes?.data || []
      r.log('booking-actually-deleted', !bookings.some((b) => b.id === booking1Id), JSON.stringify(bookings?.length))
    })

    await r.step('delete-blocked-when-invoiced', async () => {
      if (!booking2Id) return r.log('delete-blocked-when-invoiced', false, 'no booking2Id')
      await page.evaluate((id) => window.api.shootBooking.update({ id, finalAmount: 15000 }), booking2Id)
      const invRes = await page.evaluate((id) => window.api.shootBooking.generateInvoice(id), booking2Id)
      r.log('booking2-invoiced', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const delRes = await page.evaluate((id) => window.api.shootBooking.delete(id), booking2Id)
      r.log('delete-blocked-with-SHT-002', delRes?.success === false && delRes?.error?.code === 'SHT-002', JSON.stringify(delRes?.error))

      const getRes = await page.evaluate((id) => window.api.shootBooking.get(id), booking2Id)
      r.log('invoiced-booking-still-present', !!getRes?.data?.id)
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
    h.withDb((db) => {
      let bookings = 0, custs = 0
      const bookingIds = db.prepare(`SELECT id FROM ShootBooking WHERE shootLocation LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of bookingIds) { try { bookings += db.prepare('DELETE FROM ShootBooking WHERE id = ?').run(id).changes } catch { /* noop, post-invoice, expected */ } }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ bookings, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSHOOT BOOKING DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
