/**
 * Suite 132 — measurementRecord.* (whole file: list/get/create/update/
 * delete, zero prior coverage) — broader-gap-list "Nested sub-feature
 * gaps", 2026-09-03. Tailor/Boutique vertical, "Measurements" tab on
 * TailoringScreen.tsx (parent tailoringOrder.* already covered elsewhere).
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Measure'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-tailor-boutique', async () => {
      const sw = await h.switchBusinessType(page, 'Tailor / Boutique')
      r.log('business-type-switched', sw.to === 'TAILOR_BOUTIQUE', JSON.stringify(sw))
    })

    let clientId
    const clientName = `${TEST_PREFIX} Client ${suffix}`
    await r.step('create-client', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), clientName)
      clientId = custRes?.data?.id
      r.log('client-created', !!clientId, JSON.stringify(custRes?.error || ''))
    })

    await r.step('pick-client-on-measurements-tab', async () => {
      await h.gotoHash(page, '#/tailor/orders')
      await page.waitForTimeout(700)
      r.log('tailoring-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('tab', { name: 'Measurements' }).click()
      await page.waitForTimeout(400)

      const searchInput = page.getByPlaceholder('Search by name or phone...')
      await searchInput.fill(clientName)
      await page.waitForTimeout(700)
      const match = page.locator('div.absolute button', { hasText: clientName })
      r.log('client-search-result-found', await match.count() > 0)
      await match.first().click()
      await page.waitForTimeout(500)
    })

    let recordId
    await r.step('create-measurement-record-via-ui', async () => {
      await page.getByRole('button', { name: 'Add Measurement' }).click()
      await page.waitForTimeout(400)

      const modal = h.topModal(page)
      await modal.locator('xpath=.//label[text()="Chest"]/following-sibling::input[1]').fill('38.5')
      await modal.locator('xpath=.//label[text()="Waist"]/following-sibling::input[1]').fill('32')
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Save Measurements' }).click()
      await page.waitForTimeout(1000)
      r.log('create-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.measurementRecord.list(cid), clientId)
      const found = (listRes?.data || []).find((m) => m.chest === 38.5)
      recordId = found?.id
      r.log('record-persisted', !!recordId && found?.waist === 32, JSON.stringify(found))
    })

    await r.step('update-measurement-record-via-ui', async () => {
      if (!recordId) return r.log('update-measurement-record-via-ui', false, 'no recordId')
      const row = page.locator('div.flex.items-center.justify-between.mb-3', { hasText: 'Recorded:' }).last()
      await row.locator('button:has(svg.lucide-pencil)').click()
      await page.waitForTimeout(400)

      const modal = h.topModal(page)
      await modal.locator('xpath=.//label[text()="Chest"]/following-sibling::input[1]').fill('40')
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Update' }).click()
      await page.waitForTimeout(1000)
      r.log('update-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.measurementRecord.get(id), recordId)
      r.log('record-actually-updated', getRes?.data?.chest === 40, JSON.stringify(getRes?.data))
    })

    await r.step('delete-measurement-record-via-ui', async () => {
      if (!recordId) return r.log('delete-measurement-record-via-ui', false, 'no recordId')
      const row = page.locator('div.flex.items-center.justify-between.mb-3', { hasText: 'Recorded:' }).last()
      await row.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.measurementRecord.list(cid), clientId)
      r.log('record-actually-deleted', !(listRes?.data || []).some((m) => m.id === recordId), JSON.stringify(listRes?.data))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'TAILOR_BOUTIQUE') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let records = 0, custs = 0
      for (const cid of custIds) {
        try { records += db.prepare('DELETE FROM MeasurementRecord WHERE clientId = ?').run(cid).changes } catch { /* noop */ }
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ records, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nMEASUREMENT RECORD: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
