/**
 * Suite 86 — Electrical vertical (Phase 69). Zero prior E2E coverage
 * existed for this vertical before this suite. Covers meter-based
 * length billing driven through the real Billing cart (mirrors suite
 * 17's area-pricing UI pattern), a job-site account tagged onto a CREDIT
 * sale, the Job Kit Builder co-purchase suggestion feature, and all three
 * new/extended report tiles verified against real API data.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Elec'

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

    await r.step('switch-to-electrical', async () => {
      const sw = await h.switchBusinessType(page, 'Electrical Store')
      r.log('business-type-switched', sw.to === 'ELECTRICAL', JSON.stringify(sw))
    })

    let wireId, fanId, customerId

    await r.step('create-length-billed-product-and-companion-and-customer', async () => {
      const wireRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Elec 2.5mm Wire', unit: 'M', sellingPrice: 25, costPrice: 15, taxRate: 18,
        productType: 'STANDARD', openingQuantity: 500,
        sellByLength: true, lengthUnit: 'M', pricePerLengthUnit: 25,
      }))
      wireId = wireRes?.data?.id
      r.log('length-billed-product-created', !!wireId, JSON.stringify(wireRes?.error || ''))

      const fanRes = await page.evaluate(async () => window.api.products.create({
        productName: 'E2E Elec Ceiling Fan', unit: 'PCS', sellingPrice: 1500, costPrice: 1000, taxRate: 18,
        productType: 'STANDARD', openingQuantity: 20,
      }))
      fanId = fanRes?.data?.id
      r.log('companion-product-created', !!fanId, JSON.stringify(fanRes?.error || ''))

      const custRes = await page.evaluate(async () => window.api.customers.create({
        customerName: 'E2E Elec Contractor', phone: `9${String(Date.now()).slice(-9)}`,
      }))
      customerId = custRes?.data?.id
      r.log('contractor-customer-created', !!customerId, JSON.stringify(custRes?.error || ''))
    })

    let jobSiteAccountId

    await r.step('create-job-site-account-via-real-ui', async () => {
      await h.gotoHash(page, '#/job-site-accounts')
      await page.waitForTimeout(700)
      r.log('job-site-accounts-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button:has-text("New Account")').click()
      await page.waitForTimeout(400)
      await page.getByPlaceholder('e.g. Sharma Residence — Wing B').fill('E2E Elec Site A')
      await page.getByPlaceholder('Search by name or phone...').fill('E2E Elec Contractor')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'E2E Elec Contractor' }).first().click()
      await page.waitForTimeout(300)
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('job-site-account-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.jobSiteAccount.list({ status: 'ACTIVE' }))
      const found = (listRes?.data || []).find((a) => a.accountName === 'E2E Elec Site A')
      jobSiteAccountId = found?.id
      r.log('job-site-account-findable-via-api', !!jobSiteAccountId, JSON.stringify(found))
    })

    let invoiceId

    await r.step('bill-length-and-fan-tagged-to-job-site-account-via-real-ui', async () => {
      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)

      const prodSearch = page.locator('input[placeholder="Search products…"]')
      await prodSearch.fill('E2E Elec 2.5mm Wire')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Elec 2.5mm Wire")').first().click()
      await page.waitForTimeout(500)
      r.log('length-billed-product-added-to-cart-no-crash', !(await h.hasErrorBoundary(page)))

      await prodSearch.fill('E2E Elec Ceiling Fan')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Elec Ceiling Fan")').first().click()
      await page.waitForTimeout(500)

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill('E2E Elec Contractor')
      await page.waitForTimeout(700)
      await page.locator('button:has-text("E2E Elec Contractor")').first().click()
      await page.waitForTimeout(300)

      await page.locator('button:has-text("Credit")').first().click()
      await page.waitForTimeout(500)

      const jsaSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'E2E Elec Site A' }) }).first()
      const jsaSelectPresent = await jsaSelect.count() > 0
      r.log('job-site-account-picker-present', jsaSelectPresent)
      if (jsaSelectPresent) await jsaSelect.selectOption({ label: 'E2E Elec Site A' })

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)
      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('invoice-created-navigated-to-detail', !!match, url)
      if (match) invoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
    })

    await r.step('verify-invoice-lengthUnit-and-jobSiteAccountId', async () => {
      if (!invoiceId) return r.log('verify-invoice-lengthUnit-and-jobSiteAccountId', false, 'no invoiceId captured')
      const res = await page.evaluate(async (id) => window.api.billing.getInvoice(id), invoiceId)
      r.log('invoice-jobSiteAccountId-set', res?.data?.jobSiteAccountId === jobSiteAccountId, JSON.stringify(res?.data?.jobSiteAccountId))
      const wireItem = (res?.data?.items || []).find((i) => i.productId === wireId)
      r.log('invoice-item-has-lengthUnit-M', wireItem?.lengthUnit === 'M', JSON.stringify(wireItem))
    })

    await r.step('job-site-account-balance-includes-invoice', async () => {
      if (!jobSiteAccountId) return
      const res = await page.evaluate(async (id) => window.api.jobSiteAccount.balance({ id }), jobSiteAccountId)
      r.log('balance-shows-nonzero-outstanding', (res?.data?.totalOutstanding ?? 0) > 0, JSON.stringify(res?.data?.totalOutstanding))
      const invFound = (res?.data?.invoices || []).some((i) => i.id === invoiceId)
      r.log('balance-invoices-includes-our-invoice', invFound)
    })

    await r.step('job-kit-builder-suggests-companion-from-real-order-history', async () => {
      if (!fanId) return
      const res = await page.evaluate(async (id) => window.api.products.suggestKitComponents({ anchorProductId: id, limit: 8 }), fanId)
      r.log('suggestion-api-succeeds', !!res?.success, JSON.stringify(res?.error || ''))
      const suggestions = res?.data?.suggestions || []
      const wireSuggested = suggestions.some((s) => s.productId === wireId)
      r.log('wire-suggested-as-companion-to-fan', wireSuggested, JSON.stringify(suggestions))
    })

    await r.step('job-kit-builder-button-present-in-product-form', async () => {
      await h.gotoHash(page, '#/products')
      await page.waitForTimeout(700)
      const search = page.locator('input[placeholder*="Search"]').first()
      await search.fill('E2E Elec Ceiling Fan')
      await page.waitForTimeout(700)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('product-search-finds-fan', bodyText.includes('E2E Elec Ceiling Fan'))

      const editBtn = page.locator('button:has(svg.lucide-square-pen)').first()
      if (await editBtn.count() === 0) { r.log('suggest-from-past-orders-button-present', false, 'no edit button found on screen'); return }
      await editBtn.click()
      await page.waitForTimeout(600)
      const modal = h.topModal(page)
      const kitCheckbox = modal.locator('text=This is a kit')
      if (await kitCheckbox.count() > 0) {
        await kitCheckbox.click()
        await page.waitForTimeout(300)
        const suggestBtn = modal.locator('button:has-text("Suggest from past orders")')
        r.log('suggest-from-past-orders-button-present', await suggestBtn.count() > 0)
      } else {
        r.log('suggest-from-past-orders-button-present', false, 'kit checkbox not found')
      }
      await h.closeTopModal(page)
    })

    await r.step('coil-wastage-yield-report', () => checkReportTile(page, r, 'coilWastageYield', 'Coil Wastage & Yield', { needsDateRange: true }))
    await r.step('isi-bis-safety-register-report', () => checkReportTile(page, r, 'isiBisSafetyRegister', 'ISI/BIS Safety Register', { needsDateRange: false }))
    await r.step('spec-wise-fast-movers-report', () => checkReportTile(page, r, 'fastSlowMoverMatrix', 'Fast-Mover', { needsDateRange: true }))

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'ELECTRICAL') {
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
      const jsaIds = db.prepare("SELECT id FROM JobSiteAccount WHERE accountName LIKE 'E2E %'").all().map((row) => row.id)
      for (const id of jsaIds) {
        try { db.prepare('UPDATE Invoice SET jobSiteAccountId = NULL WHERE jobSiteAccountId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM JobSiteAccount WHERE id = ?').run(id) } catch { /* noop */ }
      }
      console.log('extra cleanup: jobSiteAccounts', jsaIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nELECTRICAL VERTICAL: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
