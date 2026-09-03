/**
 * Suite 133 — shootAddOn.* + shootChecklist.* (whole files, zero prior
 * coverage) — broader-gap-list "Nested sub-feature gaps", 2026-09-03.
 * Photo Studio vertical, ShootsScreen.tsx's expanded-booking panels
 * (parent shootBooking.create/generateInvoice already covered suite 25).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Shoot133'

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

    const venue = `${TEST_PREFIX} Venue ${suffix}`
    const clientName = `${TEST_PREFIX} Client ${suffix}`
    await r.step('create-booking-via-ui', async () => {
      await h.gotoHash(page, '#/photo/shoots')
      await page.waitForTimeout(700)
      r.log('shoots-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Booking' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Search by name or phone...').fill(clientName)
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill(clientName)
        await modal.getByPlaceholder('Phone *').fill(`9${String(Date.now()).slice(-9)}`)
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }

      await modal.getByPlaceholder('Venue / address').fill(venue)
      await modal.locator('input[type="date"]').first().fill(h.toLocalISODate(new Date(Date.now() + 7 * 24 * 3600000)))
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Save Booking' }).click()
      await page.waitForTimeout(1200)
      r.log('booking-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    let bookingId
    await r.step('verify-booking-and-expand-row', async () => {
      const listRes = await page.evaluate(async () => window.api.shootBooking.list({}))
      const found = (listRes?.data || []).find((b) => b.shootLocation === venue)
      bookingId = found?.id
      r.log('booking-findable-via-api', !!bookingId, JSON.stringify({ id: bookingId }))

      const bookingRow = page.locator('p', { hasText: clientName }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
      await bookingRow.click()
      await page.waitForTimeout(500)
    })

    let checklistItemId
    const checklistLabel = `${TEST_PREFIX} 2nd Camera Body`
    await r.step('add-toggle-delete-checklist-item-via-ui', async () => {
      if (!bookingId) return r.log('add-toggle-delete-checklist-item-via-ui', false, 'no bookingId')
      const section = page.locator('p', { hasText: 'Equipment & Crew Checklist' }).locator('xpath=ancestor::div[contains(@class,"mt-4")][1]')
      await section.getByPlaceholder('e.g. 2nd camera body, 50mm lens...').fill(checklistLabel)
      await section.locator('button').last().click()
      await page.waitForTimeout(900)
      r.log('checklist-add-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((id) => window.api.shootChecklist.list({ shootBookingId: id }), bookingId)
      let item = (listRes?.data || []).find((i) => i.label === checklistLabel)
      checklistItemId = item?.id
      r.log('checklist-item-persisted', !!checklistItemId && item?.category === 'EQUIPMENT' && !item?.isDone, JSON.stringify(item))
      if (!checklistItemId) return

      const freshSection = page.locator('p', { hasText: 'Equipment & Crew Checklist' }).locator('xpath=ancestor::div[contains(@class,"mt-4")][1]')
      const row = freshSection.locator('div.flex.items-center.gap-2.text-xs', { hasText: checklistLabel }).first()
      await row.locator('input[type="checkbox"]').click()
      await page.waitForTimeout(800)
      r.log('checklist-toggle-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.shootChecklist.list({ shootBookingId: id }), bookingId)
      item = (listRes?.data || []).find((i) => i.id === checklistItemId)
      r.log('checklist-item-actually-toggled', item?.isDone === true, JSON.stringify(item))

      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(800)
      r.log('checklist-delete-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.shootChecklist.list({ shootBookingId: id }), bookingId)
      r.log('checklist-item-actually-deleted', !(listRes?.data || []).some((i) => i.id === checklistItemId), JSON.stringify(listRes?.data))
    })

    let addOnId
    const addOnDesc = `${TEST_PREFIX} Extra Prints`
    await r.step('add-and-delete-addon-via-ui', async () => {
      if (!bookingId) return r.log('add-and-delete-addon-via-ui', false, 'no bookingId')
      const section = page.locator('p', { hasText: 'Add-on Items' }).locator('xpath=ancestor::div[contains(@class,"mt-4")][1]')
      await section.getByPlaceholder('e.g. Extra prints (6x4)').fill(addOnDesc)
      const numInputs = section.locator('input[type="number"]')
      await numInputs.nth(0).fill('2')
      await numInputs.nth(1).fill('150')
      await page.waitForTimeout(200)
      await section.locator('button').last().click()
      await page.waitForTimeout(900)
      r.log('addon-add-no-crash', !(await h.hasErrorBoundary(page)))

      let totalRes = await page.evaluate((id) => window.api.shootAddOn.total({ shootBookingId: id }), bookingId)
      r.log('addon-total-correct', totalRes?.data?.total === 300, JSON.stringify(totalRes?.data))

      let listRes = await page.evaluate((id) => window.api.shootAddOn.list({ shootBookingId: id }), bookingId)
      const item = (listRes?.data || []).find((i) => i.description === addOnDesc)
      addOnId = item?.id
      r.log('addon-persisted', !!addOnId && item?.quantity === 2 && item?.unitPrice === 150, JSON.stringify(item))
      if (!addOnId) return

      const freshSection = page.locator('p', { hasText: 'Add-on Items' }).locator('xpath=ancestor::div[contains(@class,"mt-4")][1]')
      const row = freshSection.locator('div.flex.items-center.gap-2.text-xs', { hasText: addOnDesc }).first()
      await row.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(800)
      r.log('addon-delete-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.shootAddOn.list({ shootBookingId: id }), bookingId)
      r.log('addon-actually-deleted', !(listRes?.data || []).some((i) => i.id === addOnId), JSON.stringify(listRes?.data))
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
      const ids = db.prepare(`SELECT id FROM ShootBooking WHERE shootLocation LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let checklist = 0, addons = 0, bookings = 0
      for (const id of ids) {
        try { checklist += db.prepare('DELETE FROM ShootChecklistItem WHERE shootBookingId = ?').run(id).changes } catch { /* noop */ }
        try { addons += db.prepare('DELETE FROM ShootAddOnItem WHERE shootBookingId = ?').run(id).changes } catch { /* noop */ }
        try { bookings += db.prepare('DELETE FROM ShootBooking WHERE id = ?').run(id).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ checklist, addons, bookings, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nSHOOT ADDON/CHECKLIST: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
