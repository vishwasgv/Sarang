/**
 * Suite 71 — Agri Inputs vertical, Phase 67 §9.1 items 1-5: crop-season-
 * aligned credit terms (item 1), crop-linked product advisory (item 3),
 * seasonal credit exposure report (item 2), farmer-wise purchase &
 * repayment history report (item 4), and equipment AMC/service reminders
 * (item 5). Real UI-driven Billing crop-season linking + Browse-by-Crop,
 * both new Reports tiles, the Agri Dashboard's Equipment Service Due panel,
 * and all four new AI intents.
 */
const h = require('../harness')
const { createTestCustomer } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E Agri'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let agriTemplateRowBefore

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-agri-inputs', async () => {
      const sw = await h.switchBusinessType(page, 'Agricultural Inputs & Equipment')
      r.log('business-type-switched-to-agri-inputs', sw.to === 'AGRI_INPUTS', JSON.stringify(sw))
    })

    // ai_assistant is off by default for every business type — same gotcha
    // Footwear/Manufacturing already found. Enabled directly here and
    // restored exactly as found in cleanup.
    h.withDb((db) => {
      agriTemplateRowBefore = db.prepare('SELECT id, enabledModules FROM IndustryTemplateSetting WHERE businessType = ?').get('AGRI_INPUTS')
      if (agriTemplateRowBefore) {
        const mods = new Set(JSON.parse(agriTemplateRowBefore.enabledModules || '[]'))
        mods.add('ai_assistant')
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(JSON.stringify([...mods]), agriTemplateRowBefore.id)
      } else {
        db.prepare('INSERT INTO IndustryTemplateSetting (id, businessType, enabledModules, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run(require('crypto').randomUUID(), 'AGRI_INPUTS', JSON.stringify(['ai_assistant']))
      }
    })

    let customerId, plainProductId, cropProductId, equipmentProductId, serialId, cropSeasonId
    const cropName = `${TEST_PREFIX} Wheat`
    const seasonName = `${TEST_PREFIX} Harvest`
    const equipmentSerialNumber = `E2E-AGRI-${Date.now()}`

    await r.step('setup-customer-products-season', async () => {
      const custRes = await createTestCustomer(page, { customerName: `${TEST_PREFIX} Customer` })
      r.log('customer-created', !!custRes?.success, JSON.stringify(custRes?.error || ''))
      customerId = custRes?.data?.id

      const plainRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Plain Product`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 100, sellingPrice: 200, taxRate: 0, openingQuantity: 50,
      }), TEST_PREFIX)
      r.log('plain-product-created', !!plainRes?.success, JSON.stringify(plainRes?.error || ''))
      plainProductId = plainRes?.data?.id

      // Phase 67 §9.1 item 3 — crop-linked product, tagged via recommendedCrop.
      const cropRes = await page.evaluate(async ({ prefix, crop }) => window.api.products.create({
        productName: `${prefix} Urea Fertilizer`, productType: 'STANDARD', unit: 'BAG',
        costPrice: 300, sellingPrice: 500, taxRate: 0, openingQuantity: 30, recommendedCrop: crop,
      }), { prefix: TEST_PREFIX, crop: cropName })
      r.log('crop-tagged-product-created', !!cropRes?.success, JSON.stringify(cropRes?.error || ''))
      cropProductId = cropRes?.data?.id

      // Phase 67 §9.1 item 5 — equipment tracked by serial.
      const equipRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Power Sprayer`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 5000, sellingPrice: 8000, taxRate: 0, openingQuantity: 0,
      }), TEST_PREFIX)
      r.log('equipment-product-created', !!equipRes?.success, JSON.stringify(equipRes?.error || ''))
      equipmentProductId = equipRes?.data?.id

      if (equipmentProductId) {
        const serialRes = await page.evaluate(async ({ pid, sn }) => window.api.serials.create({
          productId: pid, serialNumber: sn, unitCost: 5000,
        }), { pid: equipmentProductId, sn: equipmentSerialNumber })
        r.log('equipment-serial-created', !!serialRes?.success, JSON.stringify(serialRes?.error || ''))
        serialId = serialRes?.data?.id
      }

      // Phase 67 §9.1 item 1 — a real harvest occurrence, not a flat day count.
      const seasonRes = await page.evaluate(async (name) => window.api.cropSeason.create({
        name, harvestMonth: 12, harvestDay: 25,
      }), seasonName)
      r.log('crop-season-created', !!seasonRes?.success, JSON.stringify(seasonRes?.error || ''))
      cropSeasonId = seasonRes?.data?.id
    })

    // ─── Phase 67 §9.1 item 1: crop-season-aligned credit terms, real UI ────
    let creditInvoiceId
    await r.step('create-credit-invoice-linked-to-crop-season-via-real-ui', async () => {
      if (!plainProductId || !customerId || !cropSeasonId) return r.log('create-credit-invoice-linked-to-crop-season-via-real-ui', false, 'missing setup data')

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(700)
      r.log('billing-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const searchInput = page.locator('input[placeholder="Search products…"]')
      await searchInput.fill(`${TEST_PREFIX} Plain Product`)
      await page.waitForTimeout(700)
      const productOption = page.locator('button', { hasText: `${TEST_PREFIX} Plain Product` }).first()
      r.log('plain-product-search-found-result', await productOption.count() > 0)
      if (await productOption.count()) await productOption.click()
      await page.waitForTimeout(400)

      const custSearch = page.locator('input[placeholder="Search customers…"]')
      await custSearch.fill(`${TEST_PREFIX} Customer`)
      await page.waitForTimeout(700)
      const custOption = page.locator('button', { hasText: `${TEST_PREFIX} Customer` }).first()
      r.log('customer-search-found-result', await custOption.count() > 0)
      if (await custOption.count()) await custOption.click()
      await page.waitForTimeout(300)

      await page.getByRole('button', { name: 'Credit (Pay Later)', exact: true }).click()
      await page.waitForTimeout(400)

      r.log('crop-season-dropdown-visible-for-agri-inputs-credit', await page.locator('text=Link to Crop Season').count() > 0)

      const seasonSelect = page.locator('select').filter({ has: page.locator(`option:has-text("${seasonName}")`) }).first()
      r.log('season-option-present-in-dropdown', await seasonSelect.count() > 0)
      if (await seasonSelect.count()) {
        await seasonSelect.selectOption({ label: seasonName })
        await page.waitForTimeout(500)
      }

      const bodyTextAfterSelect = await page.locator('body').innerText().catch(() => '')
      r.log('resolved-due-date-hint-shown', bodyTextAfterSelect.includes('next harvest occurrence'))

      await page.keyboard.press('F10')
      await page.waitForTimeout(1500)

      const url = page.url()
      const match = url.match(/#\/billing\/([a-zA-Z0-9]+)/)
      r.log('credit-invoice-created-navigated-to-detail', !!match, url)
      if (match) creditInvoiceId = match[1]
      r.log('billing-screen-no-crash-after-submit', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'agri-inputs-crop-season-credit-invoice')
    })

    await r.step('verify-invoice-due-date-computed-from-crop-season', async () => {
      if (!creditInvoiceId) return r.log('verify-invoice-due-date-computed-from-crop-season', false, 'no creditInvoiceId captured')
      const res = await page.evaluate(async (id) => window.api.billing.getInvoice(id), creditInvoiceId)
      const inv = res?.data
      r.log('invoice-fetch-success', !!res?.success)
      r.log('invoice-cropSeasonId-set', inv?.cropSeasonId === cropSeasonId, JSON.stringify({ got: inv?.cropSeasonId, expected: cropSeasonId }))
      const due = inv?.dueDate ? new Date(inv.dueDate) : null
      // Month/day must match the season's harvest occurrence (12/25),
      // regardless of which year billing.service.ts resolved it to.
      r.log('invoice-dueDate-matches-season-month-day', !!due && due.getMonth() === 11 && due.getDate() === 25, String(inv?.dueDate))
    })

    // ─── Phase 67 §9.1 item 3: crop-linked product advisory, real UI ───────
    await r.step('browse-by-crop-chip-adds-tagged-product-to-cart-via-real-ui', async () => {
      if (!cropProductId) return r.log('browse-by-crop-chip-adds-tagged-product-to-cart-via-real-ui', false, 'no cropProductId captured')

      await h.gotoHash(page, '#/billing/new')
      await page.waitForTimeout(800)

      r.log('browse-by-crop-section-visible', await page.locator('text=Browse by Crop').count() > 0)
      const cropChip = page.locator('button', { hasText: cropName }).first()
      r.log('crop-chip-present', await cropChip.count() > 0)
      if (await cropChip.count()) {
        await cropChip.click()
        await page.waitForTimeout(600)
        const productTile = page.locator('button', { hasText: `${TEST_PREFIX} Urea Fertilizer` }).first()
        r.log('crop-tagged-product-tile-shown', await productTile.count() > 0)
        if (await productTile.count()) {
          await productTile.click()
          await page.waitForTimeout(400)
        }
      }

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('cart-contains-crop-tagged-product', bodyText.includes('Urea Fertilizer'))
      r.log('billing-screen-no-crash-after-crop-browse', !(await h.hasErrorBoundary(page)))
      await h.shot(page, 'agri-inputs-browse-by-crop')
    })

    await r.step('crop-advisory-api-returns-tagged-product', async () => {
      const listRes = await page.evaluate(() => window.api.cropAdvisory.listCrops())
      r.log('crop-advisory-listCrops-succeeded', !!listRes?.success, JSON.stringify(listRes?.error || ''))
      r.log('crop-advisory-includes-our-crop', (listRes?.data || []).includes(cropName), JSON.stringify(listRes?.data))

      const productsRes = await page.evaluate((crop) => window.api.cropAdvisory.productsForCrop({ cropName: crop }), cropName)
      r.log('crop-advisory-productsForCrop-succeeded', !!productsRes?.success, JSON.stringify(productsRes?.error || ''))
      r.log('crop-advisory-products-includes-our-product', !!(productsRes?.data || []).find((p) => p.productId === cropProductId), JSON.stringify(productsRes?.data))
    })

    // ─── Phase 67 §9.1 item 2: Seasonal Credit Exposure ──────────────────────
    await r.step('seasonal-credit-exposure-report-computes-and-renders-correctly', async () => {
      const reportRes = await page.evaluate(() => window.api.reports.seasonalCreditExposure())
      r.log('seasonal-credit-exposure-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const seasonRow = (reportRes?.data?.bySeason || []).find((s) => s.seasonName === seasonName)
      r.log('seasonal-credit-exposure-includes-our-season', !!seasonRow, JSON.stringify(seasonRow))
      // Lower bound, not exact — the dev DB may carry other outstanding
      // credit invoices from earlier runs (same convention this whole arc uses).
      r.log('seasonal-credit-exposure-season-amount-at-least-our-invoice', (seasonRow?.outstandingAmount ?? 0) >= 200, JSON.stringify(seasonRow))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Seasonal Credit Exposure' }).first()
      r.log('seasonal-credit-exposure-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('seasonal-credit-exposure-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('seasonal-credit-exposure-shows-our-season', bodyText.includes(seasonName))
        await h.shot(page, 'agri-inputs-seasonal-credit-exposure')
      }
    })

    // ─── Phase 67 §9.1 item 4: Farmer-Wise Purchase & Repayment History ────
    await r.step('farmer-repayment-report-computes-and-renders-correctly', async () => {
      const reportRes = await page.evaluate(() => window.api.reports.farmerRepayment())
      r.log('farmer-repayment-api-succeeded', !!reportRes?.success, JSON.stringify(reportRes?.error || ''))
      const row = (reportRes?.data?.rows || []).find((rr) => rr.customerId === customerId)
      r.log('farmer-repayment-includes-our-customer', !!row, JSON.stringify(row))
      r.log('farmer-repayment-outstanding-at-least-our-invoice', (row?.outstandingBalance ?? 0) >= 200, JSON.stringify(row))

      await h.gotoHash(page, '#/reports')
      await page.waitForTimeout(700)
      const tile = page.locator('button', { hasText: 'Farmer-Wise Purchase & Repayment History' }).first()
      r.log('farmer-repayment-tile-present', await tile.count() > 0)
      if (await tile.count()) {
        await tile.click()
        await page.waitForTimeout(500)
        const genBtn = page.getByRole('button', { name: 'Generate Report' })
        if (await genBtn.count()) { await genBtn.click(); await page.waitForTimeout(1000) }
        r.log('farmer-repayment-renders-no-crash', !(await h.hasErrorBoundary(page)))
        const bodyText = await page.locator('body').innerText().catch(() => '')
        r.log('farmer-repayment-shows-our-customer', bodyText.includes(`${TEST_PREFIX} Customer`))
        await h.shot(page, 'agri-inputs-farmer-repayment')
      }
    })

    // ─── Phase 67 §9.1 item 5: equipment AMC/service reminders, real UI ────
    await r.step('set-equipment-service-date-and-see-it-flagged-via-real-ui', async () => {
      if (!serialId) return r.log('set-equipment-service-date-and-see-it-flagged-via-real-ui', false, 'no serialId captured')

      await h.gotoHash(page, '#/agri/dashboard')
      await page.waitForTimeout(800)
      r.log('agri-dashboard-loads-no-crash', !(await h.hasErrorBoundary(page)))
      r.log('equipment-service-due-panel-visible', await page.locator('text=Equipment Service Due').count() > 0)

      const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
      const serviceDueCard = page.locator('div', { hasText: 'Set a Service Date' }).last()
      const equipOptionLabel = `${TEST_PREFIX} Power Sprayer — ${equipmentSerialNumber}`
      const equipSelect = serviceDueCard.locator('select').first()
      r.log('equipment-select-present', await equipSelect.count() > 0)
      if (await equipSelect.count()) {
        await equipSelect.selectOption({ label: equipOptionLabel })
      }
      await serviceDueCard.locator('input[type="date"]').first().fill(soon)
      await serviceDueCard.locator('button', { hasText: 'Save' }).first().click()
      await page.waitForTimeout(800)
      r.log('service-date-saved-no-crash', !(await h.hasErrorBoundary(page)))

      const dueRes = await page.evaluate(() => window.api.serials.dueForService())
      const row = (dueRes?.data || []).find((rr) => rr.serialId === serialId)
      r.log('equipment-shows-as-due-for-service', !!row && row.dueForService === true, JSON.stringify(row))

      // Force a remount (navigate away and back) so the dashboard's own
      // initial-load effect refetches — the "Set a Service Date" save
      // handler only refreshes the API list state, not this screen's mount.
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(400)
      await h.gotoHash(page, '#/agri/dashboard')
      await page.waitForTimeout(1000)
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('equipment-service-due-panel-shows-our-unit', bodyText.includes('Power Sprayer'))
      await h.shot(page, 'agri-inputs-equipment-service-due')
    })

    await r.step('schedule-service-reminder-api-succeeds', async () => {
      if (!serialId) return r.log('schedule-service-reminder-api-succeeds', false, 'no serialId captured')
      const res = await page.evaluate((id) => window.api.serials.scheduleServiceReminder({ serialId: id }), serialId)
      r.log('schedule-service-reminder-succeeded', !!res?.success, JSON.stringify(res?.error || ''))
    })

    // ─── AI intents for all 4 new items ─────────────────────────────────────
    await r.step('ai-intents-route-correctly-for-all-four-new-items', async () => {
      const seasonalRes = await page.evaluate(() => window.api.ai.query({ question: 'What is our seasonal credit exposure?' }))
      r.log('ai-seasonal-credit-exposure-intent-routed-correctly', seasonalRes?.data?.template === 'agriInputs.seasonalCreditExposure', JSON.stringify({ template: seasonalRes?.data?.template, answer: seasonalRes?.data?.answer }))

      const farmerRes = await page.evaluate(() => window.api.ai.query({ question: 'Show me farmer repayment history' }))
      r.log('ai-farmer-repayment-intent-routed-correctly', farmerRes?.data?.template === 'agriInputs.farmerRepayment', JSON.stringify({ template: farmerRes?.data?.template, answer: farmerRes?.data?.answer }))

      const advisoryRes = await page.evaluate(() => window.api.ai.query({ question: 'Give me crop advisory recommendations' }))
      r.log('ai-crop-advisory-intent-routed-correctly', advisoryRes?.data?.template === 'agriInputs.cropAdvisory', JSON.stringify({ template: advisoryRes?.data?.template, answer: advisoryRes?.data?.answer }))

      const equipRes = await page.evaluate(() => window.api.ai.query({ question: 'Is any equipment due for service?' }))
      r.log('ai-equipment-service-due-intent-routed-correctly', equipRes?.data?.template === 'agriInputs.equipmentServiceDue', JSON.stringify({ template: equipRes?.data?.template, answer: equipRes?.data?.answer }))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'AGRI_INPUTS') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      if (agriTemplateRowBefore) {
        db.prepare('UPDATE IndustryTemplateSetting SET enabledModules = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(agriTemplateRowBefore.enabledModules, agriTemplateRowBefore.id)
      } else {
        db.prepare('DELETE FROM IndustryTemplateSetting WHERE businessType = ? AND enabledModules = ?').run('AGRI_INPUTS', JSON.stringify(['ai_assistant']))
      }
    })
    h.withDb((db) => {
      // Known gotcha (see memory: "E2E Product Cleanup FK Gotcha") — the
      // generic cleanupByNamePrefix helper doesn't clear LocationStock/
      // InventoryMovement before deleting Product, so a real-stock product
      // (openingQuantity > 0, which every product this suite creates has)
      // silently falls back to a soft-delete and leaks. Cleared here first
      // so the hard-delete below actually succeeds.
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
      }
    })
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      // CropSeason and ProductSerial aren't covered by the generic
      // cleanupByNamePrefix helper — ProductSerial cascades automatically
      // when its parent Product is hard-deleted above (onDelete: Cascade),
      // but CropSeason is an independent entity with its own name, cleaned
      // here explicitly.
      const seasonIds = db.prepare(`SELECT id FROM CropSeason WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const sid of seasonIds) {
        try { db.prepare('DELETE FROM CropSeason WHERE id = ?').run(sid) } catch { db.prepare('UPDATE CropSeason SET isActive = 0 WHERE id = ?').run(sid) }
      }
      console.log('agri inputs extra cleanup:', JSON.stringify({ cropSeasons: seasonIds.length }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nAGRI INPUTS CROP SEASON/EQUIPMENT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
