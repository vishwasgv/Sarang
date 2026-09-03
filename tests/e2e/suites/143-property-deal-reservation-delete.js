/**
 * Suite 143 — Section C medium CRUD gap: property.delete, propertyDeal.
 * delete (Real Estate, both had real UI triggers but zero prior coverage)
 * + reservations.delete (Restaurant). reservations.delete has NO UI
 * trigger anywhere in the renderer (confirmed via grep) -- a real product
 * gap (only Seat/No-show status transitions exist, not a hard delete) --
 * covered API-only. reservations.create/updateStatus/list/upcomingByTable
 * already covered via real UI (suite 48).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Prop143'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-real-estate', async () => {
      const sw = await h.switchBusinessType(page, 'Real Estate')
      r.log('business-type-switched', sw.to === 'REAL_ESTATE', JSON.stringify(sw))
    })

    let ownerId, buyerId, sellerId, propertyId
    const location = `${TEST_PREFIX} Address ${suffix}`
    await r.step('seed-clients-and-property', async () => {
      const ownerRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Owner ${suffix}`)
      ownerId = ownerRes?.data?.id
      const buyerRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Buyer ${suffix}`)
      buyerId = buyerRes?.data?.id
      const sellerRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `7${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Seller ${suffix}`)
      sellerId = sellerRes?.data?.id
      r.log('clients-created', !!ownerId && !!buyerId && !!sellerId)

      const propRes = await page.evaluate(({ loc, owner }) => window.api.property.create({
        propertyType: 'APARTMENT', listingType: 'SALE', location: loc, area: 1200, ownerClientId: owner, askingPrice: 6000000,
      }), { loc: location, owner: ownerId })
      propertyId = propRes?.data?.id
      r.log('property-created', !!propertyId, JSON.stringify(propRes?.error || ''))
    })

    let dealId
    await r.step('seed-deal-via-api', async () => {
      if (!propertyId) return r.log('seed-deal-via-api', false, 'no propertyId')
      const dealRes = await page.evaluate(({ pid, bid, sid }) => window.api.propertyDeal.create({
        propertyId: pid, buyerClientId: bid, sellerClientId: sid, dealValue: 6000000, brokeragePercent: 2,
      }), { pid: propertyId, bid: buyerId, sid: sellerId })
      dealId = dealRes?.data?.id
      r.log('deal-created', !!dealId, JSON.stringify(dealRes?.error || ''))
    })

    await r.step('delete-deal-via-ui', async () => {
      if (!propertyId || !dealId) return r.log('delete-deal-via-ui', false, 'missing prerequisites')
      await h.gotoHash(page, '#/realestate/properties')
      await page.waitForTimeout(700)
      r.log('properties-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('p', { hasText: location }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      await row.click()
      await page.waitForTimeout(600)

      const dealRow = page.locator('p', { hasText: `${TEST_PREFIX} Buyer ${suffix}` }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
      await dealRow.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-deal-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.propertyDeal.list({ propertyId: pid }), propertyId)
      r.log('deal-actually-deleted', !(listRes?.data || []).some((d) => d.id === dealId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('delete-property-via-ui', async () => {
      if (!propertyId) return r.log('delete-property-via-ui', false, 'no propertyId')
      const row = page.locator('p', { hasText: location }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      const header = row.locator('xpath=ancestor::div[contains(@class,"overflow-hidden")][1]')
      await header.locator('button:has(svg.lucide-x)').first().click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-property-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.property.list({}))
      r.log('property-actually-deleted', !(listRes?.data || []).some((p) => p.id === propertyId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('switch-to-restaurant', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant / Café / Food')
      r.log('business-type-switched-restaurant', sw.to === 'RESTAURANT', JSON.stringify(sw))
    })

    let reservationId
    await r.step('delete-reservation-api-only-no-ui-trigger', async () => {
      const soon = new Date(Date.now() + 3 * 3600000)
      const res = await page.evaluate(({ name, dt }) => window.api.reservations.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`, partySize: 2, reservedFor: dt,
      }), { name: `${TEST_PREFIX} Guest ${suffix}`, dt: h.fmtLocalDateTime(soon) })
      reservationId = res?.data?.id
      r.log('reservation-created', !!reservationId, JSON.stringify(res?.error || ''))
      if (!reservationId) return

      const delRes = await page.evaluate((id) => window.api.reservations.delete({ id }), reservationId)
      r.log('reservation-delete-api-succeeds', !!delRes?.success, JSON.stringify(delRes?.error || ''))

      const listRes = await page.evaluate(async () => window.api.reservations.list({}))
      r.log('reservation-actually-deleted', !(listRes?.data || []).some((rsv) => rsv.id === reservationId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'RESTAURANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let deals = 0, props = 0, reservations = 0, custs = 0
      const propIds = db.prepare(`SELECT id FROM Property WHERE location LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of propIds) {
        try { deals += db.prepare('DELETE FROM PropertyDeal WHERE propertyId = ?').run(pid).changes } catch { /* noop */ }
        try { db.prepare('DELETE FROM PropertyInquiry WHERE propertyId = ?').run(pid) } catch { /* noop */ }
        try { db.prepare('DELETE FROM PropertyPriceHistory WHERE propertyId = ?').run(pid) } catch { /* noop */ }
        try { props += db.prepare('DELETE FROM Property WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      try { reservations += db.prepare(`DELETE FROM Reservation WHERE customerName LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ deals, props, reservations, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPROPERTY/DEAL/RESERVATION DELETE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
