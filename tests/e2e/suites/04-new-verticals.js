/**
 * Suite 4 — New verticals (Section 2.2 item 4): Rental booking lifecycle,
 * Hybrid Business Operations module toggles, Agricultural Inputs
 * business-type switch smoke check.
 *
 * Rental selectors here are carried over verbatim from the extensive
 * manual live-UAT pass done earlier this project (32/32 checks passed,
 * including a real FK-constraint bug found and fixed in
 * RentalBooking.invoiceId) — see PHASE_54G_RENTAL_TECHNICAL_SPEC.md
 * Section 5 for that full writeup. This suite is the same flow, ported
 * onto the reusable harness instead of a one-off scratch script.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Vert'

function fmtLocal(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── Rental vertical ──────────────────────────────────────────────────
    await r.step('switch-to-rental', async () => {
      const sw = await h.switchBusinessType(page, 'Rental Business')
      r.log('business-type-switched-to-rental', sw.to === 'RENTAL', JSON.stringify(sw))
    })

    await r.step('create-rental-unit-product', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(600)
      await page.locator('button:has-text("Add Product")').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Product Name *').fill(`${TEST_PREFIX} Car`)
      await modal.getByLabel('Selling Price *').fill('2000')
      await modal.getByLabel('Cost Price *').fill('1500')
      await modal.locator('text=This item can be rented out').click()
      await page.waitForTimeout(300)
      await modal.getByLabel('Tracking Type *').selectOption('UNIT')
      await page.waitForTimeout(300)
      await modal.locator('button:has-text("+ Add Rate")').click()
      await page.waitForTimeout(150)
      await modal.locator('button:has-text("+ Add Rate")').click()
      await page.waitForTimeout(150)
      const firstRowRemove = modal.locator('div.flex.items-center.gap-2.mb-2').first().locator('button')
      await firstRowRemove.click()
      await page.waitForTimeout(150)
      await modal.locator('div.flex.items-center.gap-2.mb-2 input[type="number"]').first().fill('2000')
      await modal.locator('button:has-text("Add Product")').click()
      await page.waitForTimeout(1200)
      r.log('unit-product-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('create-rental-bulk-product', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(600)
      await page.locator('button:has-text("Add Product")').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByLabel('Product Name *').fill(`${TEST_PREFIX} Tent`)
      await modal.getByLabel('Selling Price *').fill('500')
      await modal.getByLabel('Cost Price *').fill('300')
      await modal.locator('text=This item can be rented out').click()
      await page.waitForTimeout(300)
      await modal.getByLabel('Tracking Type *').selectOption('BULK')
      await page.waitForTimeout(300)
      await modal.locator('button:has-text("+ Add Rate")').click()
      await page.waitForTimeout(150)
      await modal.locator('button:has-text("+ Add Rate")').click()
      await page.waitForTimeout(150)
      const firstRowRemove = modal.locator('div.flex.items-center.gap-2.mb-2').first().locator('button')
      await firstRowRemove.click()
      await page.waitForTimeout(150)
      await modal.locator('div.flex.items-center.gap-2.mb-2 input[type="number"]').first().fill('500')
      await modal.getByLabel('Opening Stock Quantity').fill('10')
      await modal.locator('button:has-text("Add Product")').click()
      await page.waitForTimeout(1200)
      r.log('bulk-product-created-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('create-rental-unit-and-customer', async () => {
      await h.gotoHash(page, '#/rental/units')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("Add Unit")').click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.locator('select').first().selectOption({ label: `${TEST_PREFIX} Car` })
      await modal.getByPlaceholder('e.g. KA01AB1234').fill(`${TEST_PREFIX}-CAR-01`)
      await modal.locator('button:has-text("Save")').click()
      await page.waitForTimeout(1000)
      r.log('rental-unit-created', !(await h.hasErrorBoundary(page)))
    })

    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600000)
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 3600000)

    await r.step('book-checkout-return-late-and-invoice', async () => {
      await h.gotoHash(page, '#/rental/bookings')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("New Booking")').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      const custSearch = modal.getByPlaceholder('Search by name or phone...')
      await custSearch.fill(`${TEST_PREFIX} Customer`)
      await page.waitForTimeout(900)
      const custOption = modal.locator('button', { hasText: `${TEST_PREFIX} Customer` }).first()
      if (await custOption.count() > 0 && await custOption.isVisible().catch(() => false)) {
        await custOption.click()
      } else {
        await modal.locator('button:has-text("Add new customer")').click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill(`${TEST_PREFIX} Customer`)
        await modal.getByPlaceholder('Phone (optional)').fill('9876511111')
        await modal.locator('button:has-text("Add & Select")').click()
        await page.waitForTimeout(700)
      }

      await modal.locator('select').first().selectOption({ label: `${TEST_PREFIX} Tent` })
      await page.waitForTimeout(500)
      const dtInputs = modal.locator('input[type="datetime-local"]')
      await dtInputs.nth(0).fill(fmtLocal(threeDaysAgo))
      await dtInputs.nth(1).fill(fmtLocal(oneDayAgo))
      await modal.locator('button:has-text("Create Booking")').click()
      await page.waitForTimeout(1300)
      r.log('booking-created-no-crash', !(await h.hasErrorBoundary(page)))

      await h.gotoHash(page, '#/rental/bookings')
      await page.waitForTimeout(600)
      const row = page.locator('tr', { hasText: `${TEST_PREFIX} Tent` }).first()
      await row.click()
      await page.waitForTimeout(500)
      const detail = h.topModal(page)
      await detail.locator('button:has-text("Check Out")').click()
      await page.waitForTimeout(1200)
      r.log('checked-out-no-crash', !(await h.hasErrorBoundary(page)))
      await h.closeTopModal(page)

      await page.waitForTimeout(400)
      const listText = await page.locator('body').innerText()
      r.log('overdue-badge-shown', /Overdue/i.test(listText))

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(600)
      const dashText = await page.locator('body').innerText()
      r.log('dashboard-shows-rental-overdue-alert', /overdue/i.test(dashText) && /rental/i.test(dashText))

      await h.gotoHash(page, '#/rental/bookings')
      await page.waitForTimeout(600)
      const row2 = page.locator('tr', { hasText: `${TEST_PREFIX} Tent` }).first()
      await row2.click()
      await page.waitForTimeout(500)
      const detail2 = h.topModal(page)
      await detail2.locator('button:has-text("Confirm Return")').click()
      await page.waitForTimeout(1300)
      const returnText = await detail2.innerText().catch(() => '')
      r.log('late-fee-shown-on-return', /Late Fee/.test(returnText))

      const genBtn = detail2.locator('button:has-text("Generate Invoice")')
      if (await genBtn.count()) {
        await genBtn.click()
        await page.waitForTimeout(1500)
        const afterText = await detail2.innerText().catch(() => '')
        r.log('invoice-generated', /Invoice generated for this booking/.test(afterText))
      } else {
        r.log('generate-invoice-button-present', false)
      }
    })

    // ── Hybrid Business Operations (toggle any module independent of business type) ──
    await r.step('hybrid-ops-toggle', async () => {
      await h.gotoHash(page, '#/settings');
      await page.waitForTimeout(500)
      const tab = page.locator('button:has-text("Additional Business Features")')
      r.log('additional-features-tab-present', await tab.count() > 0)
      if (await tab.count()) {
        await tab.first().click()
        await page.waitForTimeout(500)
        const bodyText = await page.locator('body').innerText()
        r.log('all-toggles-render', ['Returns Workflow', 'Area Pricing Calculator', 'Credit Limit Enforcement', 'Bulk Order Workflow', 'Outstanding Analytics'].every((t) => bodyText.includes(t)))
      }
    })

    // ── Agricultural Inputs — quick business-type switch smoke check ────
    await r.step('agri-inputs-switch-smoke-check', async () => {
      const sw = await h.switchBusinessType(page, 'Agricultural Inputs')
      r.log('switched-to-agri-inputs', sw.to === 'AGRI_INPUTS', JSON.stringify(sw))
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(600)
      r.log('agri-dashboard-no-crash', !(await h.hasErrorBoundary(page)))
    })
  } finally {
    if (originalBusinessType) {
      try {
        const page2 = (await app.windows())[0]
        if (page2) await page2.evaluate((bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
      } catch { /* app may already be closing */ }
    }
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const bookingIds = db.prepare("SELECT id, invoiceId FROM RentalBooking WHERE bookingNumber IN (SELECT bookingNumber FROM RentalBooking)").all()
      let removedBookings = 0, removedInvoices = 0
      for (const b of bookingIds) {
        const items = db.prepare('SELECT productId FROM RentalBookingItem WHERE bookingId = ?').all(b.id)
        const touchesTestProduct = items.some((it) => {
          const p = db.prepare('SELECT productName FROM Product WHERE id = ?').get(it.productId)
          return p && p.productName.startsWith(TEST_PREFIX)
        })
        if (!touchesTestProduct) continue
        db.prepare('DELETE FROM RentalBookingItem WHERE bookingId = ?').run(b.id)
        if (b.invoiceId) {
          db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(b.invoiceId)
          try { db.prepare('DELETE FROM Invoice WHERE id = ?').run(b.invoiceId); removedInvoices++ } catch { /* leave it */ }
        }
        db.prepare('DELETE FROM RentalBooking WHERE id = ?').run(b.id)
        removedBookings++
      }
      const unitIds = db.prepare(`SELECT id FROM RentalUnit WHERE unitLabel LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const uid of unitIds) db.prepare('DELETE FROM RentalUnit WHERE id = ?').run(uid)
      console.log('rental cleanup:', JSON.stringify({ removedBookings, removedInvoices, removedUnits: unitIds.length }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nNEW VERTICALS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
