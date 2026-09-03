/**
 * Suite 135 — propertyInquiry.* + propertySiteVisit.* (whole files, zero
 * prior coverage) — broader-gap-list "Nested sub-feature gaps", 2026-09-03.
 * Real Estate vertical, PropertiesScreen.tsx's expanded-property panel
 * (parent property.create already covered suite 21).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Prop135'

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

    let ownerId, buyerId, propertyId
    const location = `${TEST_PREFIX} Address ${suffix}`
    const buyerName = `${TEST_PREFIX} Buyer ${suffix}`
    await r.step('seed-clients-and-property-via-api', async () => {
      const ownerRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Owner ${suffix}`)
      ownerId = ownerRes?.data?.id
      const buyerRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), buyerName)
      buyerId = buyerRes?.data?.id
      r.log('clients-created', !!ownerId && !!buyerId)

      const propRes = await page.evaluate(({ loc, owner }) => window.api.property.create({
        propertyType: 'APARTMENT', listingType: 'SALE', location: loc, area: 1000, ownerClientId: owner, askingPrice: 5000000,
      }), { loc: location, owner: ownerId })
      propertyId = propRes?.data?.id
      r.log('property-created', !!propertyId, JSON.stringify(propRes?.error || ''))
    })

    let inquiryId
    await r.step('add-inquiry-via-ui', async () => {
      if (!propertyId) return r.log('add-inquiry-via-ui', false, 'no propertyId')
      await h.gotoHash(page, '#/realestate/properties')
      await page.waitForTimeout(700)
      r.log('properties-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = page.locator('p', { hasText: location }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      await row.click()
      // Not a bare `hasText: 'Inquiries ('` -- the KPI strip at the top of
      // the screen has its own "New Inquiries (7d)" card, which also
      // contains that substring and appears EARLIER in the DOM, so .first()
      // picks the wrong element. Anchor the match to the column header's
      // own exact leading text via regex instead.
      const inquiriesHeading = /^Inquiries \(/
      await page.locator('p', { hasText: inquiriesHeading }).first().waitFor({ state: 'visible', timeout: 10000 })

      const inquiriesCol = page.locator('p', { hasText: inquiriesHeading }).first().locator('xpath=ancestor::div[1]')
      await inquiriesCol.getByRole('button', { name: '+ Add', exact: true }).click()
      await page.waitForTimeout(400)
      const form = page.locator('div', { hasText: 'Add Inquiry' }).filter({ has: page.locator('select') }).last()
      const buyerOptionText = await form.locator('select').locator('option', { hasText: buyerName }).first().textContent()
      await form.locator('select').selectOption({ label: (buyerOptionText || '').trim() })
      await form.locator('input[type="text"]').fill(`${TEST_PREFIX} looking for 2BHK`)
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Add Inquiry', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('inquiry-add-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.propertyInquiry.list(pid), propertyId)
      const found = (listRes?.data || []).find((i) => i.buyerClientId === buyerId)
      inquiryId = found?.id
      r.log('inquiry-persisted', !!inquiryId && found?.status === 'SHORTLISTED', JSON.stringify(found))
    })

    await r.step('update-inquiry-status-via-ui', async () => {
      if (!inquiryId) return r.log('update-inquiry-status-via-ui', false, 'no inquiryId')
      const row = page.locator('p', { hasText: location }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      // Not a bare `div` + hasText -- the interactive controls (select,
      // Visits/delete buttons) live in a SIBLING div to the one containing
      // the buyer name, so a broad hasText match's .last() lands on an
      // inner div that has the name but not the controls. Scope to the
      // inquiry card's own specific class combo instead.
      const inquiryRow = row.locator('xpath=following-sibling::div[1]').locator('div.bg-white.border.border-gray-100.rounded-lg', { hasText: buyerName }).last()
      await inquiryRow.locator('select').selectOption('NEGOTIATION')
      await page.waitForTimeout(900)
      r.log('status-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.propertyInquiry.list(pid), propertyId)
      const found = (listRes?.data || []).find((i) => i.id === inquiryId)
      r.log('status-actually-updated', found?.status === 'NEGOTIATION', JSON.stringify(found))
    })

    let visit1Id, visit2Id
    await r.step('schedule-complete-and-cancel-site-visits-via-ui', async () => {
      if (!inquiryId) return r.log('schedule-complete-and-cancel-site-visits-via-ui', false, 'no inquiryId')
      const row = page.locator('p', { hasText: location }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      // Not a bare `div` + hasText -- the interactive controls (select,
      // Visits/delete buttons) live in a SIBLING div to the one containing
      // the buyer name, so a broad hasText match's .last() lands on an
      // inner div that has the name but not the controls. Scope to the
      // inquiry card's own specific class combo instead.
      const inquiryRow = row.locator('xpath=following-sibling::div[1]').locator('div.bg-white.border.border-gray-100.rounded-lg', { hasText: buyerName }).last()
      await inquiryRow.getByRole('button', { name: 'Visits' }).click()
      await page.waitForTimeout(500)

      const visitDate1 = h.toLocalISODate(new Date(Date.now() + 3 * 24 * 3600000))
      await inquiryRow.locator('input[type="date"]').fill(visitDate1)
      await inquiryRow.getByRole('button', { name: 'Schedule' }).click()
      await page.waitForTimeout(1000)
      r.log('visit-1-schedule-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((iid) => window.api.propertySiteVisit.list({ inquiryId: iid }), inquiryId)
      let visit1 = (listRes?.data || [])[0]
      visit1Id = visit1?.id
      r.log('visit-1-persisted', !!visit1Id && visit1?.status === 'SCHEDULED', JSON.stringify(visit1))

      const inqAfterSchedule = await page.evaluate((pid) => window.api.propertyInquiry.list(pid), propertyId)
      const inqRow = (inqAfterSchedule?.data || []).find((i) => i.id === inquiryId)
      r.log('inquiry-status-auto-flipped-to-site-visit-scheduled', inqRow?.status === 'SITE_VISIT_SCHEDULED', JSON.stringify(inqRow))

      if (visit1Id) {
        await inquiryRow.getByRole('button', { name: 'Complete' }).click()
        await page.waitForTimeout(400)
        const modal = h.topModal(page)
        await modal.locator('select').selectOption('HIGH')
        await modal.getByPlaceholder('What did the buyer say about the property…').fill(`${TEST_PREFIX} very interested`)
        await page.waitForTimeout(200)
        await modal.getByRole('button', { name: 'Save Feedback' }).click()
        await page.waitForTimeout(1000)
        r.log('visit-1-complete-no-crash', !(await h.hasErrorBoundary(page)))

        listRes = await page.evaluate((iid) => window.api.propertySiteVisit.list({ inquiryId: iid }), inquiryId)
        visit1 = (listRes?.data || []).find((v) => v.id === visit1Id)
        r.log('visit-1-actually-completed', visit1?.status === 'COMPLETED' && visit1?.interestLevel === 'HIGH', JSON.stringify(visit1))
      }

      const visitDate2 = h.toLocalISODate(new Date(Date.now() + 5 * 24 * 3600000))
      await inquiryRow.locator('input[type="date"]').fill(visitDate2)
      await inquiryRow.getByRole('button', { name: 'Schedule' }).click()
      await page.waitForTimeout(1000)
      r.log('visit-2-schedule-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((iid) => window.api.propertySiteVisit.list({ inquiryId: iid }), inquiryId)
      const visit2 = (listRes?.data || []).find((v) => v.status === 'SCHEDULED')
      visit2Id = visit2?.id
      r.log('visit-2-persisted', !!visit2Id, JSON.stringify(visit2))

      if (visit2Id) {
        await inquiryRow.getByRole('button', { name: 'Cancel' }).click()
        await page.waitForTimeout(1000)
        r.log('visit-2-cancel-no-crash', !(await h.hasErrorBoundary(page)))

        listRes = await page.evaluate((iid) => window.api.propertySiteVisit.list({ inquiryId: iid }), inquiryId)
        const found = (listRes?.data || []).find((v) => v.id === visit2Id)
        r.log('visit-2-actually-cancelled', found?.status === 'CANCELLED', JSON.stringify(found))
      }
    })

    await r.step('delete-inquiry-via-ui', async () => {
      if (!inquiryId) return r.log('delete-inquiry-via-ui', false, 'no inquiryId')
      const row = page.locator('p', { hasText: location }).first().locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
      // Not a bare `div` + hasText -- the interactive controls (select,
      // Visits/delete buttons) live in a SIBLING div to the one containing
      // the buyer name, so a broad hasText match's .last() lands on an
      // inner div that has the name but not the controls. Scope to the
      // inquiry card's own specific class combo instead.
      const inquiryRow = row.locator('xpath=following-sibling::div[1]').locator('div.bg-white.border.border-gray-100.rounded-lg', { hasText: buyerName }).last()
      await inquiryRow.locator('button:has(svg.lucide-x)').first().click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.propertyInquiry.list(pid), propertyId)
      r.log('inquiry-actually-deleted', !(listRes?.data || []).some((i) => i.id === inquiryId), JSON.stringify(listRes?.data))
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
    h.withDb((db) => {
      const propIds = db.prepare(`SELECT id FROM Property WHERE location LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let visits = 0, inquiries = 0, props = 0
      for (const pid of propIds) {
        const inqIds = db.prepare('SELECT id FROM PropertyInquiry WHERE propertyId = ?').all(pid).map((row) => row.id)
        for (const iid of inqIds) {
          try { visits += db.prepare('DELETE FROM PropertySiteVisit WHERE inquiryId = ?').run(iid).changes } catch { /* noop */ }
        }
        try { inquiries += db.prepare('DELETE FROM PropertyInquiry WHERE propertyId = ?').run(pid).changes } catch { /* noop */ }
        try { props += db.prepare('DELETE FROM Property WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ visits, inquiries, props, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nPROPERTY INQUIRY/SITE VISIT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
