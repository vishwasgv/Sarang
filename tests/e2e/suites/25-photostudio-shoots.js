/**
 * Suite 25 — Photo Studio vertical (shoot_bookings). Real UI-driven booking
 * creation, then finalAmount set via Edit (create-time field is disabled/
 * absent — finalAmount is edit-only per ShootsScreen.tsx), then invoice
 * generation. See project_vertical_uat_research.md.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Photo'

// Phase 68 §9.1 — Photo Studio items 1/2/3/4/5 report-tile render sweep.
async function checkReportTile(page, r, tileId, tileLabel, { needsDateRange } = {}) {
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
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000)))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  await page.locator('button:has-text("Generate Report")').click()
  await page.waitForTimeout(1200)
  r.log(`${tileId}-renders-no-crash`, !(await h.hasErrorBoundary(page)))
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
      // h.toLocalISODate must be called out here -- page.evaluate's callback
      // runs in the browser context, where `h` doesn't exist.
      const proofsSentDate = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ id, proofsSentDate }) => window.api.deliveryTracker.upsert({ shootBookingId: id, proofsSentDate }), { id: bookingId, proofsSentDate })
      r.log('delivery-milestone-updated', !!res?.success, JSON.stringify(res?.error || ''))
    })

    await r.step('delivery-pipeline-report', () => checkReportTile(page, r, 'deliveryPipeline', 'Delivery Pipeline', { needsDateRange: false }))

    await r.step('delivery-pipeline-shows-our-booking-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.deliveryPipeline())
      const total = (res?.data?.stages || []).reduce((s, st) => s + st.count, 0)
      r.log('delivery-pipeline-has-nonzero-total', total >= 1, JSON.stringify(res?.data?.stages))
    })

    await r.step('shoot-type-revenue-mix-report', () => checkReportTile(page, r, 'shootTypeRevenueMix', 'Shoot-Type Revenue Mix', { needsDateRange: true }))

    await r.step('shoot-type-revenue-mix-includes-our-booking-via-api', async () => {
      const from = h.toLocalISODate(new Date(Date.now() - 45 * 24 * 3600000))
      const to = h.toLocalISODate(new Date())
      const res = await page.evaluate(({ from, to }) => window.api.reports.shootTypeRevenueMix({ dateFrom: from, dateTo: to }), { from, to })
      r.log('revenue-mix-has-nonzero-revenue', (res?.data?.summary?.totalRevenue ?? 0) >= 15000, JSON.stringify(res?.data?.summary))
    })

    await r.step('checkout-equipment-for-report', async () => {
      const assetRes = await page.evaluate((today) => window.api.fixedAssets.create({
        assetCode: `E2E-CAM-${Date.now()}`, assetName: 'E2E Photo Camera Body', purchaseDate: today, purchaseCost: 80000, usefulLifeMonths: 36,
      }), h.toLocalISODate(new Date()))
      const assetId = assetRes?.data?.id
      r.log('equipment-asset-created', !!assetId, JSON.stringify(assetRes?.error || ''))
      if (assetId) {
        const coRes = await page.evaluate(({ assetId, today }) => window.api.equipmentCheckout.checkOut({
          fixedAssetId: assetId, checkedOutDate: today,
        }), { assetId, today: h.toLocalISODate(new Date()) })
        r.log('equipment-checked-out', !!coRes?.data?.id, JSON.stringify(coRes?.error || ''))
      }
    })

    await r.step('equipment-checkout-report', () => checkReportTile(page, r, 'equipmentCheckout', 'Equipment Checkout', { needsDateRange: false }))

    await r.step('equipment-checkout-shows-our-camera-via-api', async () => {
      const res = await page.evaluate(async () => window.api.reports.equipmentCheckout())
      const rows = res?.data?.rows || []
      const found = rows.find((row) => row.assetName === 'E2E Photo Camera Body')
      r.log('equipment-checkout-includes-our-camera', !!found, JSON.stringify(found))
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
      for (const id of ids) {
        try { db.prepare('DELETE FROM DeliveryTracker WHERE shootBookingId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ShootBooking WHERE id = ?').run(id) } catch { /* noop */ }
      }
      const assetIds = db.prepare("SELECT id FROM FixedAsset WHERE assetName LIKE 'E2E Photo%'").all().map((r2) => r2.id)
      for (const aid of assetIds) {
        try { db.prepare('DELETE FROM EquipmentCheckout WHERE fixedAssetId = ?').run(aid) } catch { /* noop */ }
        try { db.prepare('DELETE FROM FixedAsset WHERE id = ?').run(aid) } catch { /* noop */ }
      }
      console.log('extra cleanup: bookings', ids.length, 'assets', assetIds.length)
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
