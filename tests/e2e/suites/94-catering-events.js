/**
 * Suite 94 — Catering Events (2026-09-02, Bakery/Sweet Shop/Catering
 * vertical, catering_events module). Zero prior E2E coverage existed for
 * this feature. Covers booking an event through the real i18n'd UI (menu
 * item, a multi-day meals/snacks row, per-role staffing cost), recording
 * the final bargained price (distinct from the original per-plate quote),
 * generating the eventual invoice with the advance applied, and the Event
 * Profitability report added afterward (found missing against the
 * original plan during a later audit pass — this report was never covered
 * here until now).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Cater'

// Same pattern as suite 93's own checkReportTile helper — kept local to
// each suite rather than shared, matching this codebase's existing
// convention for these small per-suite report-tile checks.
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
    await dateInputs.nth(0).fill(h.toLocalISODate(new Date()))
    await dateInputs.nth(1).fill(h.toLocalISODate(new Date()))
  }
  const genBtn = page.locator('button:has-text("Generate Report")')
  if (await genBtn.count() > 0) await genBtn.click()
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

    await r.step('switch-to-bakery', async () => {
      await h.gotoHash(page, '#/settings/industry')
      await page.waitForTimeout(1500)
      const sw = await h.switchBusinessType(page, 'Bakery / Sweet Shop')
      r.log('business-type-switched', sw.to === 'BAKERY', JSON.stringify(sw))
    })

    let dishId, customerId

    await r.step('create-product-and-customer', async () => {
      const dishRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Cater Paneer Tikka', unit: 'PLATE', sellingPrice: 250, costPrice: 100, taxRate: 5,
        productType: 'STANDARD', openingQuantity: 500,
      }))
      dishId = dishRes?.data?.id
      r.log('menu-dish-created', !!dishId, JSON.stringify(dishRes?.error || ''))

      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Cater Wedding Client', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    let eventId

    await r.step('book-catering-event-via-real-ui', async () => {
      await h.gotoHash(page, '#/bakery/catering-events')
      await page.waitForTimeout(700)
      r.log('catering-events-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('screen-title-visible', (await page.locator('body').innerText().catch(() => '')).includes('Catering Events'))

      await page.locator('button:has-text("New Event")').click()
      await page.waitForTimeout(400)

      await page.getByPlaceholder('Search by name or phone...').fill('E2E Cater Wedding Client')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Cater Wedding Client' }).first().click()
      await page.waitForTimeout(300)

      await page.getByLabel('Event Start Date').fill(h.toLocalISODate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)))
      await page.getByLabel('Attendee Count').fill('100')
      await page.getByLabel(/Price per Plate/).fill('500')
      await page.waitForTimeout(200)

      // Menu — one dish
      await page.getByPlaceholder('Search product…').fill('E2E Cater Paneer Tikka')
      await page.waitForTimeout(600)
      await page.locator('button', { hasText: 'E2E Cater Paneer Tikka' }).first().click()
      await page.waitForTimeout(300)
      await page.getByLabel('Qty').fill('100')
      await page.locator('button:has-text("Add")').first().click()
      await page.waitForTimeout(300)

      // A day of service — meals & snacks. Exact match required — "Date"
      // is otherwise a substring of "Event Start Date"/"Event End Date".
      await page.getByLabel('Date', { exact: true }).fill(h.toLocalISODate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)))
      await page.getByLabel(/Meals/).fill('2')
      await page.getByLabel(/Snacks/).fill('1')
      await page.locator('button:has-text("Add Day")').click()
      await page.waitForTimeout(300)

      // Staffing — cook and server, deliberately different rates (the
      // "individual different pay for cook, it's different for servers"
      // requirement this feature exists for)
      await page.getByLabel('Role').selectOption('COOK')
      await page.getByLabel(/Workers/).fill('2')
      await page.getByLabel(/Rate per Worker/).fill('1500')
      await page.locator('button:has-text("Add Staff")').click()
      await page.waitForTimeout(300)

      await page.getByLabel('Role').selectOption('SERVER')
      await page.getByLabel(/Workers/).fill('5')
      await page.getByLabel(/Rate per Worker/).fill('800')
      await page.locator('button:has-text("Add Staff")').click()
      await page.waitForTimeout(300)

      const bodyTextBeforeSubmit = await page.locator('body').innerText()
      r.log('staff-cost-total-shown-in-form', bodyTextBeforeSubmit.includes('7,000') || bodyTextBeforeSubmit.includes('7000'), 'expected 2×1500 + 5×800 = 7000')

      await page.getByLabel(/Advance Amount/).fill('10000')
      await page.locator('button:has-text("Book Event")').click()
      await page.waitForTimeout(1200)
      r.log('event-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.cateringEvent.list({}))
      const found = (listRes?.data || []).find((e) => e.customer?.customerName === 'E2E Cater Wedding Client')
      eventId = found?.id
      r.log('event-findable-via-api', !!eventId, JSON.stringify({ eventNumber: found?.eventNumber, attendeeCount: found?.attendeeCount }))
      r.log('event-number-sequence-formatted', !!found?.eventNumber && /^CAT-\d{5}$/.test(found.eventNumber), found?.eventNumber)
      r.log('menu-item-persisted', found?.menuItems?.length === 1 && found.menuItems[0].quantity === 100, JSON.stringify(found?.menuItems))
      r.log('day-persisted-with-meals-snacks', found?.days?.length === 1 && found.days[0].mealsCount === 2 && found.days[0].snacksCount === 1, JSON.stringify(found?.days))

      const cook = found?.staff?.find((s) => s.role === 'COOK')
      const server = found?.staff?.find((s) => s.role === 'SERVER')
      r.log('cook-staffing-cost-correct', cook?.workerCount === 2 && cook?.ratePerWorker === 1500 && cook?.amount === 3000, JSON.stringify(cook))
      r.log('server-staffing-cost-correct-and-different-rate', server?.workerCount === 5 && server?.ratePerWorker === 800 && server?.amount === 4000, JSON.stringify(server))
    })

    await r.step('record-final-negotiated-price-via-real-ui', async () => {
      if (!eventId) return r.log('record-final-negotiated-price-via-real-ui', false, 'no eventId captured')
      await h.gotoHash(page, '#/bakery/catering-events')
      await page.waitForTimeout(700)

      await page.locator('button:has-text("Record Final Price")').first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const priceInput = modal.locator('input[type="number"]')
      await priceInput.fill('45000')
      await modal.getByRole('button', { name: 'Save' }).click()
      await page.waitForTimeout(1000)
      r.log('final-price-recorded-no-crash', !(await h.hasErrorBoundary(page)))

      const res = await page.evaluate((id) => window.api.cateringEvent.get({ id }), eventId)
      r.log('final-negotiated-price-persisted-distinct-from-quote', res?.data?.finalNegotiatedPrice === 45000 && res?.data?.pricePerPlate === 500, JSON.stringify({ final: res?.data?.finalNegotiatedPrice, quoted: res?.data?.pricePerPlate }))
    })

    await r.step('generate-invoice-from-catering-event', async () => {
      if (!eventId) return
      const res = await page.evaluate((id) => window.api.cateringEvent.generateInvoice({ id }), eventId)
      r.log('event-invoiced', !!res?.success, JSON.stringify(res?.error || ''))
      if (res?.data?.invoiceId) {
        const invRes = await page.evaluate((id) => window.api.billing.getInvoice(id), res.data.invoiceId)
        // Billed at the final negotiated price (45000), not the original
        // per-plate quote (500 × 100 = 50000) — the whole point of the
        // distinct recordFinalNegotiatedPrice step above.
        r.log('invoice-billed-at-negotiated-price-not-original-quote', invRes?.data?.totalAmount === 45000, JSON.stringify(invRes?.data?.totalAmount))
        r.log('advance-applied-as-payment', (invRes?.data?.paidAmount ?? 0) >= 10000, JSON.stringify(invRes?.data?.paidAmount))
      }

      // A second invoice attempt for the same event must be rejected —
      // same claim-sentinel guarantee every other booking model in this
      // codebase has.
      const secondRes = await page.evaluate((id) => window.api.cateringEvent.generateInvoice({ id }), eventId)
      r.log('second-invoice-attempt-rejected', secondRes?.success === false, JSON.stringify(secondRes?.error))
    })

    await r.step('event-profitability-report', () => checkReportTile(page, r, 'eventProfitability', 'Event Profitability', { needsDateRange: true }))

    await r.step('event-profitability-data-correct-via-api', async () => {
      if (!eventId) return
      const today = h.toLocalISODate(new Date())
      const res = await page.evaluate((d) => window.api.reports.eventProfitability({ dateFrom: d, dateTo: d }), today)
      const row = (res?.data?.rows || []).find((rw) => rw.eventId === eventId)
      // revenue = finalNegotiatedPrice (45000), not the original per-plate
      // quote — same distinction the invoice-generation step above checks.
      // staffCost = cook(2*1500=3000) + server(5*800=4000) = 7000.
      // ingredientCostEstimate = menu qty(100) * product.costPrice(100) = 10000.
      // netProfit = 45000 - 7000 - 10000 = 28000.
      r.log('profitability-row-found', !!row, JSON.stringify(row))
      if (row) {
        r.log('profitability-revenue-is-negotiated-price', row.revenue === 45000, String(row.revenue))
        r.log('profitability-staff-cost-correct', row.staffCost === 7000, String(row.staffCost))
        r.log('profitability-ingredient-cost-correct', row.ingredientCostEstimate === 10000, String(row.ingredientCostEstimate))
        r.log('profitability-net-profit-correct', row.netProfit === 28000, String(row.netProfit))
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'BAKERY') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const eventIds = db.prepare("SELECT ce.id FROM CateringEvent ce JOIN Customer c ON c.id = ce.customerId WHERE c.customerName LIKE 'E2E Cater%'").all().map((row) => row.id)
      for (const id of eventIds) {
        try { db.prepare('DELETE FROM CateringEventMenuItem WHERE cateringEventId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM CateringEventDay WHERE cateringEventId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM CateringEventStaff WHERE cateringEventId = ?').run(id) } catch { /* noop */ }
      }
      // Invoice/Payment rows this suite's generateInvoice call created must
      // go before CateringEvent itself, and before h.cleanupByNamePrefix
      // (called separately below) tries to clean up the Customer/Product —
      // its own Invoice-delete is best-effort and would silently leave the
      // Invoice behind rather than block on this FK.
      const invoiceIds = db.prepare("SELECT invoiceId FROM CateringEvent WHERE id IN (" + eventIds.map(() => '?').join(',') + ") AND invoiceId IS NOT NULL").all(...eventIds).map((row) => row.invoiceId)
      for (const id of eventIds) {
        try { db.prepare('DELETE FROM CateringEvent WHERE id = ?').run(id) } catch { /* noop */ }
      }
      for (const id of invoiceIds) {
        try { db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM "Invoice" WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: cateringEvents/invoices', eventIds.length, invoiceIds.length)
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCATERING EVENTS: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
