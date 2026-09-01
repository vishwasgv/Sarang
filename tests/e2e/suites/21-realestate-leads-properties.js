/**
 * Suite 21 — Real Estate vertical (leads, properties). Real UI-driven lead
 * and property-listing creation, then deal lifecycle (create -> mark
 * registered -> generate commission invoice) via direct IPC (the inline
 * "+ Add Deal" form uses plain <select>s, not the shared labeled atom — see
 * project_vertical_uat_research.md).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E RE'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-real-estate', async () => {
      const sw = await h.switchBusinessType(page, 'Real Estate')
      r.log('business-type-switched', sw.to === 'REAL_ESTATE', JSON.stringify(sw))
    })

    await r.step('create-lead-via-real-ui', async () => {
      await h.gotoHash(page, '#/service/leads')
      await page.waitForTimeout(700)
      r.log('leads-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Unscoped/non-exact match ambiguously hits the 5 per-column "+" buttons
      // too (title="Add lead as {status}" contains "Add lead" as a substring).
      await page.getByRole('button', { name: 'Add Lead', exact: true }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByPlaceholder('Contact full name').fill('E2E RE Prospective Buyer')
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Create Lead' }).click()
      await page.waitForTimeout(1200)
      r.log('lead-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'realestate-lead-created')
    })

    await r.step('verify-lead-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.lead.list({}))
      const leads = listRes?.data || []
      const found = leads.find((l) => l.fullName === 'E2E RE Prospective Buyer')
      r.log('lead-findable-via-api', !!found, JSON.stringify({ status: found?.status, source: found?.source }))
    })

    let ownerId, buyerId, sellerId

    await r.step('create-clients', async () => {
      const ownerRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E RE Owner', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      ownerId = ownerRes?.data?.id
      const buyerRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E RE Buyer', phone: `8${String(Date.now()).slice(-9)}`,
      }))
      buyerId = buyerRes?.data?.id
      const sellerRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E RE Seller', phone: `7${String(Date.now()).slice(-9)}`,
      }))
      sellerId = sellerRes?.data?.id
      r.log('all-clients-created', !!ownerId && !!buyerId && !!sellerId)
    })

    await r.step('create-property-listing-via-real-ui', async () => {
      await h.gotoHash(page, '#/realestate/properties')
      await page.waitForTimeout(700)
      r.log('properties-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'Add Listing' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)

      await modal.getByLabel('Owner').selectOption(ownerId)
      await modal.getByLabel('Listing Type').selectOption('SALE')
      await modal.getByPlaceholder('Full address / locality').fill('E2E RE Test Address, Mumbai')
      await modal.getByPlaceholder('1200').fill('1000')
      await modal.getByPlaceholder('5000000').fill('5000000')
      await page.waitForTimeout(300)

      await modal.getByRole('button', { name: 'Add Listing' }).click()
      await page.waitForTimeout(1200)
      r.log('property-created-no-crash', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'realestate-property-created')
    })

    let propertyId

    await r.step('verify-property-via-api', async () => {
      const listRes = await page.evaluate(async () => window.api.property.list({}))
      const properties = listRes?.data || []
      const found = properties.find((p) => p.location === 'E2E RE Test Address, Mumbai')
      propertyId = found?.id
      r.log('property-findable-via-api', !!propertyId, JSON.stringify({ area: found?.area, askingPrice: found?.askingPrice }))
    })

    // Phase 68 §9.1 — Real Estate item 5: property price-history tracking,
    // never given live E2E coverage when Phase 68 itself was built (its own
    // audit confirmed this vertical had zero new report tiles, but this
    // feature is a real schema addition + UI panel, genuinely untested
    // before this pass).
    await r.step('editing-asking-price-logs-price-history-via-real-ui', async () => {
      if (!propertyId) return r.log('editing-asking-price-logs-price-history-via-real-ui', false, 'no propertyId captured')

      const locationText = page.locator('p', { hasText: 'E2E RE Test Address, Mumbai' }).first()
      const row = locationText.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      await row.locator('button:has(svg.lucide-pencil)').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      const askingPriceDiv = modal.locator('div', { has: page.locator('label', { hasText: 'Asking Price' }) }).last()
      await askingPriceDiv.locator('input').fill('5500000')
      await page.waitForTimeout(200)
      await modal.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('first-price-edit-no-crash', !(await h.hasErrorBoundary(page)))

      await row.locator('button:has(svg.lucide-pencil)').click()
      await page.waitForTimeout(500)
      const modal2 = h.topModal(page)
      const askingPriceDiv2 = modal2.locator('div', { has: page.locator('label', { hasText: 'Asking Price' }) }).last()
      await askingPriceDiv2.locator('input').fill('6000000')
      await page.waitForTimeout(200)
      await modal2.getByRole('button', { name: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('second-price-edit-no-crash', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-price-history-recorded-two-changes', async () => {
      if (!propertyId) return
      const res = await page.evaluate((id) => window.api.property.priceHistory(id), propertyId)
      r.log('price-history-api-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
      const rows = res?.data || []
      r.log('price-history-has-two-rows', rows.length === 2, JSON.stringify(rows.map((r2) => r2.askingPrice)))
      // Each row logs the value the price was changed TO, not the prior
      // value — the original creation price (5,000,000) is never itself
      // logged since createProperty doesn't touch PropertyPriceHistory.
      const askingPrices = rows.map((r2) => Number(r2.askingPrice)).sort((a, b) => a - b)
      r.log('price-history-values-match-both-edits', askingPrices[0] === 5500000 && askingPrices[1] === 6000000, JSON.stringify(askingPrices))
    })

    await r.step('re-saving-without-a-price-change-does-not-log-a-spurious-row', async () => {
      if (!propertyId) return
      const res = await page.evaluate((id) => window.api.property.update({ id, notes: 'E2E RE no-op re-save' }), propertyId)
      r.log('no-op-update-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
      const historyRes = await page.evaluate((id) => window.api.property.priceHistory(id), propertyId)
      r.log('price-history-still-has-two-rows-not-three', (historyRes?.data || []).length === 2, JSON.stringify(historyRes?.data?.length))
    })

    await r.step('price-history-panel-visible-in-expanded-property-details', async () => {
      // The Price History panel only renders inside the EXPANDED row detail
      // view (loadPropertyDetails) — editing via the pencil icon never
      // itself expands the row, so expand it explicitly first.
      const locationText = page.locator('p', { hasText: 'E2E RE Test Address, Mumbai' }).first()
      await locationText.click()
      await page.waitForTimeout(1500)
      r.log('expand-no-error-boundary-crash', !(await h.hasErrorBoundary(page)))
      // Same [[feedback_uppercase_css_innertext_gotcha]] as elsewhere — the
      // label's own CSS text-transform:uppercase makes innerText read back
      // as "PRICE HISTORY", not the JSX source's "Price History".
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const found = /price history/i.test(bodyText)
      const idx = bodyText.indexOf('E2E RE Test Address')
      r.log('price-history-panel-visible-on-screen', found, found ? '' : bodyText.slice(idx, idx + 1200))
    })

    let dealId

    await r.step('create-deal-mark-registered-generate-invoice', async () => {
      if (!propertyId) return r.log('create-deal-mark-registered-generate-invoice', false, 'no propertyId captured')

      const dealRes = await page.evaluate(async ({ propertyId, buyerId, sellerId }) => window.api.propertyDeal.create({
        propertyId, buyerClientId: buyerId, sellerClientId: sellerId, dealValue: 4800000, brokeragePercent: 2,
      }), { propertyId, buyerId, sellerId })
      r.log('deal-created', !!dealRes?.success, JSON.stringify(dealRes?.error || ''))
      dealId = dealRes?.data?.id
      r.log('brokerage-amount-computed-correctly', dealRes?.data?.brokerageAmount === 96000 || Number(dealRes?.data?.brokerageAmount) === 96000, JSON.stringify(dealRes?.data?.brokerageAmount))

      const updateRes = await page.evaluate((id) => window.api.propertyDeal.update({ id, status: 'REGISTERED' }), dealId)
      r.log('deal-marked-registered', !!updateRes?.success, JSON.stringify(updateRes?.error || ''))

      // Note: generateCommissionInvoice() only gates on invoiceId==null (not
      // deal.status) — same pattern as shoot-booking.service.ts's
      // generateShootInvoice (checks finalAmount>0, not booking status).
      // The REGISTERED-only condition is a UI-only affordance (the button is
      // hidden until then), consistent across this cluster — not a server
      // guarantee to assert here.
      const invRes = await page.evaluate((id) => window.api.propertyDeal.generateInvoice(id), dealId)
      r.log('commission-invoice-generated-after-registered', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      if (invRes?.success) {
        const fullInv = await page.evaluate((id) => window.api.billing.getInvoice(id), invRes.data.invoiceId)
        const expectedTotal = 96000 * 1.18
        r.log('invoice-total-matches-brokerage-plus-gst', Math.abs((fullInv?.data?.totalAmount ?? 0) - expectedTotal) < 1, `expected=${expectedTotal} actual=${fullInv?.data?.totalAmount}`)
        r.log('invoice-billed-to-buyer', fullInv?.data?.customerId === buyerId, JSON.stringify(fullInv?.data?.customerId))
      }

      const retryRes = await page.evaluate((id) => window.api.propertyDeal.generateInvoice(id), dealId)
      r.log('double-invoicing-deal-rejected', retryRes?.success === false && retryRes?.error?.code === 'PROP-003', JSON.stringify(retryRes?.error))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'REAL_ESTATE') {
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
      const dealIds = db.prepare("SELECT pd.id FROM PropertyDeal pd JOIN Property p ON p.id = pd.propertyId WHERE p.location LIKE 'E2E RE%'").all().map((r2) => r2.id)
      for (const id of dealIds) { try { db.prepare('DELETE FROM PropertyDeal WHERE id = ?').run(id) } catch { /* noop */ } }
      const propIds = db.prepare("SELECT id FROM Property WHERE location LIKE 'E2E RE%'").all().map((r2) => r2.id)
      for (const id of propIds) { try { db.prepare('DELETE FROM Property WHERE id = ?').run(id) } catch { /* noop */ } }
      const leadIds = db.prepare("SELECT id FROM Lead WHERE fullName LIKE 'E2E RE%'").all().map((r2) => r2.id)
      for (const id of leadIds) { try { db.prepare('DELETE FROM Lead WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: deals', dealIds.length, 'properties', propIds.length, 'leads', leadIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nREAL ESTATE VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
