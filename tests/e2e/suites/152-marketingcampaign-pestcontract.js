/**
 * Suite 152 — Section C medium CRUD gap: campaignPerformance.add/delete/
 * summary + contentCalendar.delete (create/update already covered, suite
 * 23) on ProjectsScreen.tsx (Marketing Agency), plus pestContract.update/
 * delete (create/list/generateInvoice already covered, suites 10/83) on
 * PestControlScreen.tsx (Pest Control Service). campaignPerformance.update
 * has NO UI trigger anywhere in the renderer -- confirmed via grep, a real
 * product gap (a logged performance entry can only be added/deleted, never
 * corrected) -- covered API-only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E152'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    // ── campaignPerformance / contentCalendar — Marketing Agency ───────────
    await r.step('switch-to-marketing-agency', async () => {
      const sw = await h.switchBusinessType(page, 'Marketing Agency')
      r.log('business-type-switched', sw.to === 'MARKETING_AGENCY', JSON.stringify(sw))
    })

    let clientId, projectId, projectName, clientName
    await r.step('seed-client-and-project', async () => {
      clientName = `${TEST_PREFIX} Client ${suffix}`
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), clientName)
      clientId = custRes?.data?.id

      projectName = `${TEST_PREFIX} Diwali Campaign ${suffix}`
      const projRes = await page.evaluate(({ cid, name }) => window.api.serviceProject.create({
        clientId: cid, projectName: name, projectType: 'MARKETING_CAMPAIGN',
      }), { cid: clientId, name: projectName })
      projectId = projRes?.data?.id
      r.log('client-and-project-created', !!clientId && !!projectId, JSON.stringify(projRes?.error || ''))
    })

    function projectRow() {
      return page.locator('span.font-medium', { hasText: projectName }).first().locator('xpath=ancestor::div[contains(@class,"gap-3")][1]')
    }

    let perfEntryId
    await r.step('add-and-delete-performance-entry-via-ui', async () => {
      if (!projectId) return r.log('add-and-delete-performance-entry-via-ui', false, 'no projectId')
      await h.gotoHash(page, '#/service/service-projects')
      await page.waitForTimeout(700)
      r.log('projects-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const row = projectRow()
      await row.locator('button[title="Performance"]').click()
      await page.waitForTimeout(500)
      r.log('performance-tab-opens-no-crash', !(await h.hasErrorBoundary(page)))

      const today = h.toLocalISODate(new Date())
      const lastMonth = h.toLocalISODate(new Date(Date.now() - 30 * 24 * 3600000))
      await page.locator('label', { hasText: 'Period Start' }).locator('xpath=following-sibling::input').fill(lastMonth)
      await page.locator('label', { hasText: 'Period End' }).locator('xpath=following-sibling::input').fill(today)
      await page.locator('label', { hasText: 'Impressions' }).locator('xpath=following-sibling::input').fill('5000')
      await page.locator('label', { hasText: 'Clicks' }).locator('xpath=following-sibling::input').fill('200')
      await page.locator('label', { hasText: 'Conversions' }).locator('xpath=following-sibling::input').fill('10')
      await page.locator('label', { hasText: 'Spend' }).locator('xpath=following-sibling::input').fill('3000')
      await page.getByRole('button', { name: 'Add Entry' }).click()
      await page.waitForTimeout(1000)
      r.log('performance-entry-add-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.campaignPerformance.list({ projectId: pid }), projectId)
      const found = (listRes?.data || [])[0]
      perfEntryId = found?.id
      r.log('performance-entry-persisted', !!perfEntryId && found?.impressions === 5000, JSON.stringify(found))
    })

    await r.step('performance-entry-update-api-only-no-ui-trigger', async () => {
      if (!perfEntryId) return r.log('performance-entry-update-api-only-no-ui-trigger', false, 'no perfEntryId')
      const res = await page.evaluate(({ id, prefix }) => window.api.campaignPerformance.update({
        id, impressions: 9000, notes: `${prefix} corrected`,
      }), { id: perfEntryId, prefix: TEST_PREFIX })
      r.log('performance-entry-update-succeeds', !!res?.success, JSON.stringify(res?.error || ''))

      const listRes = await page.evaluate((pid) => window.api.campaignPerformance.list({ projectId: pid }), projectId)
      const found = (listRes?.data || []).find((e) => e.id === perfEntryId)
      r.log('performance-entry-actually-updated', found?.impressions === 9000, JSON.stringify(found))
    })

    await r.step('view-performance-summary-via-ui', async () => {
      if (!projectId) return r.log('view-performance-summary-via-ui', false, 'no projectId')
      // "Print for Client" calls window.print() on a fresh window -- blocks
      // the whole Electron app -- so only open the summary view, never click it.
      await page.locator('button', { hasText: 'Client Summary' }).first().click()
      await page.waitForTimeout(800)
      r.log('performance-summary-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('performance-summary-shows-real-data', bodyText.includes('Campaign Performance Summary') && bodyText.includes('9,000'), 'expected the summary modal with our updated impressions total')
      await page.getByRole('button', { name: 'Close', exact: true }).click()
      await page.waitForTimeout(300)
    })

    await r.step('delete-performance-entry-via-ui', async () => {
      if (!perfEntryId) return r.log('delete-performance-entry-via-ui', false, 'no perfEntryId')
      // The table still shows the pre-update value (5000) -- the API-only
      // update above never triggered a UI reload -- so match on that.
      const perfRow = page.locator('tr', { hasText: '5000' }).first()
      await perfRow.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(1000)
      r.log('performance-entry-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.campaignPerformance.list({ projectId: pid }), projectId)
      r.log('performance-entry-actually-deleted', !(listRes?.data || []).some((e) => e.id === perfEntryId), JSON.stringify(listRes?.data))
    })

    let contentItemId
    const contentTitle = `${TEST_PREFIX} Diwali Post`
    await r.step('add-and-delete-content-item-via-ui', async () => {
      if (!projectId) return r.log('add-and-delete-content-item-via-ui', false, 'no projectId')
      const row = projectRow()
      await row.locator('button[title="Content Calendar"]').click()
      await page.waitForTimeout(500)
      r.log('content-tab-opens-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('label', { hasText: 'Date' }).locator('xpath=following-sibling::input').fill(h.toLocalISODate(new Date()))
      await page.locator('label', { hasText: 'Title' }).locator('xpath=following-sibling::input').fill(contentTitle)
      await page.getByRole('button', { name: 'Add Content' }).click()
      await page.waitForTimeout(1000)
      r.log('content-item-add-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((pid) => window.api.contentCalendar.list({ projectId: pid }), projectId)
      const found = (listRes?.data || []).find((c) => c.title === contentTitle)
      contentItemId = found?.id
      r.log('content-item-persisted', !!contentItemId, JSON.stringify(found))
      if (!contentItemId) return

      const contentRow = page.locator('div.flex.items-center.justify-between.gap-2.flex-wrap', { hasText: contentTitle }).first()
      await contentRow.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(1000)
      r.log('content-item-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((pid) => window.api.contentCalendar.list({ projectId: pid }), projectId)
      r.log('content-item-actually-deleted', !(afterRes?.data || []).some((c) => c.id === contentItemId), JSON.stringify(afterRes?.data))
    })

    // ── pestContract.update/delete — Pest Control Service ──────────────────
    await r.step('switch-to-pest-control', async () => {
      const sw = await h.switchBusinessType(page, 'Pest Control Service')
      r.log('business-type-switched-pest', sw.to === 'PEST_CONTROL', JSON.stringify(sw))
    })

    let pestClientId, pestContractId
    await r.step('seed-pest-client-and-contract', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `8${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Pest Client ${suffix}`)
      pestClientId = custRes?.data?.id

      const today = h.toLocalISODate(new Date())
      const contractRes = await page.evaluate(({ cid, today }) => window.api.pestContract.create({
        clientId: cid, propertyAddress: 'Flat 12B, Green Towers', startDate: today, contractValue: 6000,
      }), { cid: pestClientId, today })
      pestContractId = contractRes?.data?.id
      r.log('pest-contract-created', !!pestClientId && !!pestContractId, JSON.stringify(contractRes?.error || ''))
    })

    await r.step('update-pest-contract-via-ui', async () => {
      if (!pestContractId) return r.log('update-pest-contract-via-ui', false, 'no pestContractId')
      await h.gotoHash(page, '#/pest/contracts')
      await page.waitForTimeout(700)
      r.log('pest-contracts-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate((id) => window.api.pestContract.get(id), pestContractId)
      const contractNumber = getRes?.data?.contractNumber
      const row = page.locator('span.font-semibold', { hasText: contractNumber }).first().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.locator('button:has(svg.lucide-pencil)').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      const addressInput = modal.getByPlaceholder('Full address')
      await addressInput.fill('')
      await addressInput.fill('Flat 12B, Green Towers UPDATED')
      await modal.getByRole('button', { name: 'Update Contract' }).click()
      await page.waitForTimeout(1000)
      r.log('pest-contract-update-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate((id) => window.api.pestContract.get(id), pestContractId)
      r.log('pest-contract-actually-updated', afterRes?.data?.propertyAddress === 'Flat 12B, Green Towers UPDATED', JSON.stringify(afterRes?.data?.propertyAddress))
    })

    await r.step('delete-pest-contract-via-ui', async () => {
      if (!pestContractId) return r.log('delete-pest-contract-via-ui', false, 'no pestContractId')
      const getRes = await page.evaluate((id) => window.api.pestContract.get(id), pestContractId)
      const contractNumber = getRes?.data?.contractNumber
      const row = page.locator('span.font-semibold', { hasText: contractNumber }).first().locator('xpath=ancestor::div[contains(@class,"items-start")][1]')
      await row.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(400)
      const confirmDialog = h.topModal(page)
      await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('pest-contract-delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.pestContract.list({}))
      r.log('pest-contract-actually-deleted', !(listRes?.data || []).some((c) => c.id === pestContractId), JSON.stringify(listRes?.data?.length))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'PEST_CONTROL') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let entries = 0, contentItems = 0, projects = 0
      const projIds = db.prepare(`SELECT id FROM ServiceProject WHERE projectName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of projIds) {
        try { entries += db.prepare('DELETE FROM CampaignPerformanceEntry WHERE projectId = ?').run(pid).changes } catch { /* noop */ }
        try { contentItems += db.prepare('DELETE FROM ContentCalendarItem WHERE projectId = ?').run(pid).changes } catch { /* noop */ }
        try { projects += db.prepare('DELETE FROM ServiceProject WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }

      let pestContracts = 0
      try { pestContracts += db.prepare(`DELETE FROM PestServiceContract WHERE propertyAddress LIKE 'Flat 12B%'`).run().changes } catch { /* noop */ }

      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ entries, contentItems, projects, pestContracts, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nMARKETING CAMPAIGN / PEST CONTRACT: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
