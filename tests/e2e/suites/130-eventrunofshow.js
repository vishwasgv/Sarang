/**
 * Suite 130 — eventRunOfShow.* (whole file, zero prior coverage) — Event
 * Management vertical, broader-gap-list "Nested sub-feature gaps" under
 * Section A, 2026-09-03. create is already covered elsewhere for the
 * parent event (suite 26); the Run of Show timeline panel itself (distinct
 * from vendor booking) had zero coverage.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E RunShow'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-event-management', async () => {
      const sw = await h.switchBusinessType(page, 'Event Management')
      r.log('business-type-switched', sw.to === 'EVENT_MANAGEMENT', JSON.stringify(sw))
    })

    const eventName = `${TEST_PREFIX} Wedding ${suffix}`
    let eventId
    await r.step('create-event-via-ui', async () => {
      await h.gotoHash(page, '#/events/list')
      await page.waitForTimeout(700)
      r.log('events-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.getByRole('button', { name: 'New Event' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search by name or phone...').fill(`${TEST_PREFIX} Client ${suffix}`)
      await page.waitForTimeout(700)
      const addNew = modal.locator('button', { hasText: 'Add new customer' })
      if (await addNew.count()) {
        await addNew.click()
        await page.waitForTimeout(300)
        await modal.getByPlaceholder('Customer name *').fill(`${TEST_PREFIX} Client ${suffix}`)
        await modal.getByPlaceholder('Phone *').fill(`9${String(Date.now()).slice(-9)}`)
        await modal.getByRole('button', { name: 'Add & Select' }).click()
        await page.waitForTimeout(500)
      }
      await modal.getByPlaceholder('e.g. Sharma Wedding').fill(eventName)
      await modal.locator('input[type="date"]').first().fill(h.toLocalISODate(new Date(Date.now() + 30 * 24 * 3600000)))
      await modal.getByPlaceholder('e.g. The Grand Ballroom').fill(`${TEST_PREFIX} Venue`)
      await page.waitForTimeout(300)
      await modal.getByRole('button', { name: 'Save Event' }).click()
      await page.waitForTimeout(1200)
      r.log('event-created-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.eventBooking.list({}))
      const events = listRes?.data || []
      const found = events.find((e) => e.eventName === eventName)
      eventId = found?.id
      r.log('event-persisted', !!eventId, JSON.stringify(found))
    })

    let item1Id
    await r.step('add-and-toggle-run-of-show-item-via-ui', async () => {
      if (!eventId) return r.log('add-and-toggle-run-of-show-item-via-ui', false, 'no eventId')
      await page.locator('p', { hasText: eventName }).first().click()
      await page.waitForTimeout(500)
      r.log('event-expands-no-crash', !(await h.hasErrorBoundary(page)))

      const panel = page.locator('p', { hasText: 'Run of Show' }).first().locator('xpath=ancestor::div[contains(@class,"px-6") and contains(@class,"py-4")][1]')
      await panel.locator('input[type="time"]').fill('18:30')
      await panel.getByPlaceholder('Activity (e.g. Guests arrive)').fill(`${TEST_PREFIX} Guests Arrive`)
      await panel.getByPlaceholder('Responsible').fill(`${TEST_PREFIX} Coordinator`)
      await panel.locator('button', { hasText: 'Add to Timeline' }).click()
      await page.waitForTimeout(1000)
      r.log('item-add-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((id) => window.api.eventRunOfShow.list({ eventId: id }), eventId)
      let items = listRes?.data || []
      const item1 = items.find((i) => i.activity === `${TEST_PREFIX} Guests Arrive`)
      item1Id = item1?.id
      r.log('item-1-persisted', !!item1Id && item1?.responsibleParty === `${TEST_PREFIX} Coordinator` && !item1?.isDone, JSON.stringify(item1))
      if (!item1Id) return

      const freshPanel = page.locator('p', { hasText: 'Run of Show' }).first().locator('xpath=ancestor::div[contains(@class,"px-6") and contains(@class,"py-4")][1]')
      const itemRow = freshPanel.locator('div', { hasText: `${TEST_PREFIX} Guests Arrive` }).last()
      await itemRow.locator('input[type="checkbox"]').click()
      await page.waitForTimeout(1000)
      r.log('item-toggle-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.eventRunOfShow.list({ eventId: id }), eventId)
      items = listRes?.data || []
      const item1After = items.find((i) => i.id === item1Id)
      r.log('item-1-actually-toggled', item1After?.isDone === true, JSON.stringify(item1After))
    })

    let item2Id
    await r.step('add-and-delete-run-of-show-item-via-ui', async () => {
      if (!eventId) return r.log('add-and-delete-run-of-show-item-via-ui', false, 'no eventId')
      const panel = page.locator('p', { hasText: 'Run of Show' }).first().locator('xpath=ancestor::div[contains(@class,"px-6") and contains(@class,"py-4")][1]')
      await panel.locator('input[type="time"]').fill('19:00')
      await panel.getByPlaceholder('Activity (e.g. Guests arrive)').fill(`${TEST_PREFIX} Cake Cutting`)
      await panel.locator('button', { hasText: 'Add to Timeline' }).click()
      await page.waitForTimeout(1000)
      r.log('item-2-add-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((id) => window.api.eventRunOfShow.list({ eventId: id }), eventId)
      let items = listRes?.data || []
      const item2 = items.find((i) => i.activity === `${TEST_PREFIX} Cake Cutting`)
      item2Id = item2?.id
      r.log('item-2-persisted', !!item2Id, JSON.stringify(item2))
      if (!item2Id) return

      const freshPanel = page.locator('p', { hasText: 'Run of Show' }).first().locator('xpath=ancestor::div[contains(@class,"px-6") and contains(@class,"py-4")][1]')
      const itemRow = freshPanel.locator('div', { hasText: `${TEST_PREFIX} Cake Cutting` }).last()
      await itemRow.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(1000)
      r.log('item-2-delete-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((id) => window.api.eventRunOfShow.list({ eventId: id }), eventId)
      items = listRes?.data || []
      r.log('item-2-actually-deleted', !items.some((i) => i.id === item2Id), JSON.stringify(items))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'EVENT_MANAGEMENT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const eventIds = db.prepare(`SELECT id FROM EventBooking WHERE eventName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let items = 0, events = 0
      for (const eid of eventIds) {
        items += db.prepare('DELETE FROM EventRunOfShowItem WHERE eventId = ?').run(eid).changes
        try { events += db.prepare('DELETE FROM EventBooking WHERE id = ?').run(eid).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let custs = 0
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ events, items, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nEVENT RUN OF SHOW: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
