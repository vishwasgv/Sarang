/**
 * Suite 121 — timeEntry.update/delete/markBilled (broader-gap-list Section
 * C, money-critical, 2026-09-03). create/generateInvoice already covered
 * via real UI/API (suites 76, 19) but update/delete/markBilled had zero
 * coverage. Unlike most screens this session, TimeEntryScreen.tsx's row
 * delete fires directly on click -- no ConfirmDialog.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E TimeEntry121'

async function fillByLabel(scope, labelText, value) {
  await scope.locator('label', { hasText: labelText }).first().locator('xpath=following-sibling::*[self::input or self::textarea][1]').fill(value)
}

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-consultant', async () => {
      const sw = await h.switchBusinessType(page, 'Consultant / Freelancer')
      r.log('business-type-switched', sw.to === 'CONSULTANT', JSON.stringify(sw))
    })

    async function logHoursViaUi(description, hours) {
      await h.gotoHash(page, '#/professional/time-entries')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: 'Log Hours' }).first().click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Description', description)
      await fillByLabel(modal, 'Hours', String(hours))
      await modal.locator('button', { hasText: 'Log Hours' }).click()
      await page.waitForTimeout(1200)
      const noCrash = !(await h.hasErrorBoundary(page))

      const listRes = await page.evaluate(async () => window.api.timeEntry.list({}))
      const entries = listRes?.data || []
      const entry = entries.find((e) => e.description === description)
      return { id: entry?.id, noCrash, entry }
    }

    // ── Entry A: update + markBilled ─────────────────────────────────────────
    const descA = `${TEST_PREFIX} Entry A ${suffix}`
    let entryAId
    await r.step('entry-A-log-and-edit-via-ui', async () => {
      const res = await logHoursViaUi(descA, 5)
      entryAId = res.id
      r.log('entry-A-logged-no-crash', res.noCrash)
      r.log('entry-A-persisted', !!entryAId && Number(res.entry?.hours) === 5, JSON.stringify(res.entry))
      if (!entryAId) return

      const row = page.locator('tr', { hasText: descA }).first()
      await row.locator('button[title="Edit"]').click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await fillByLabel(modal, 'Hours', '6')
      await modal.locator('button', { hasText: 'Save Changes' }).click()
      await page.waitForTimeout(1000)
      r.log('entry-A-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.timeEntry.list({}))
      const entries = listRes?.data || []
      const found = entries.find((e) => e.id === entryAId)
      r.log('entry-A-update-persisted', Number(found?.hours) === 6, JSON.stringify(found))
    })

    await r.step('entry-A-mark-billed-via-ui', async () => {
      if (!entryAId) return r.log('entry-A-mark-billed-via-ui', false, 'no entryAId')
      const row = page.locator('tr', { hasText: descA }).first()
      await row.locator('button[title="Mark as Billed"]').click()
      await page.waitForTimeout(1000)
      r.log('mark-billed-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.timeEntry.list({}))
      const entries = listRes?.data || []
      const found = entries.find((e) => e.id === entryAId)
      r.log('entry-A-actually-billed', found?.isBilled === true, JSON.stringify(found))
    })

    // ── Entry B: delete (fires directly, no confirm dialog) ─────────────────
    const descB = `${TEST_PREFIX} Entry B ${suffix}`
    let entryBId
    await r.step('entry-B-log-and-delete-via-ui', async () => {
      const res = await logHoursViaUi(descB, 3)
      entryBId = res.id
      r.log('entry-B-logged-no-crash', res.noCrash)
      r.log('entry-B-persisted', !!entryBId, JSON.stringify(res.entry))
      if (!entryBId) return

      const row = page.locator('tr', { hasText: descB }).first()
      await row.locator('button[title="Delete"]').click()
      await page.waitForTimeout(1000)
      r.log('delete-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.timeEntry.list({}))
      const entries = listRes?.data || []
      r.log('entry-B-actually-gone', !entries.some((e) => e.id === entryBId))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CONSULTANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const removed = db.prepare(`DELETE FROM TimeEntry WHERE description LIKE '${TEST_PREFIX}%'`).run().changes
      console.log('extra cleanup:', JSON.stringify({ removed }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nTIME ENTRY UPDATE/DELETE/MARK-BILLED: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
