/**
 * Suite 140 — Section C medium CRUD gap: custom-document.handler.ts,
 * reconfirmed 2026-09-03 against suite 68 (listTypes/createType/
 * createEntry/deleteEntry already covered there via real UI). Covers the
 * genuinely untested channels: customDocuments.updateType/updateEntry.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CD140'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    const typeName = `${TEST_PREFIX} Register ${Date.now()}`
    let typeId
    await r.step('seed-document-type-via-api', async () => {
      const res = await page.evaluate(async (name) => window.api.customDocuments.createType({ name }), typeName)
      typeId = res?.data?.id
      r.log('type-created', !!typeId, JSON.stringify(res?.error || ''))
    })

    await r.step('update-type-via-ui', async () => {
      if (!typeId) return r.log('update-type-via-ui', false, 'no typeId')
      await h.gotoHash(page, '#/custom-documents')
      await page.waitForTimeout(700)
      r.log('custom-documents-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: typeName }).first().click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Edit', exact: true }).click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      const renamedTypeName = `${TEST_PREFIX} Renamed Register`
      await modal.getByLabel('Document Name').fill(renamedTypeName)
      await modal.getByLabel('Description').fill(`${TEST_PREFIX} desc`)
      await modal.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('type-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(async () => window.api.customDocuments.listTypes())
      const found = (listRes?.data || []).find((t) => t.id === typeId)
      r.log('type-actually-updated', found?.name === renamedTypeName && found?.description === `${TEST_PREFIX} desc`, JSON.stringify(found))
    })

    let entryId
    await r.step('seed-entry-via-api', async () => {
      if (!typeId) return r.log('seed-entry-via-api', false, 'no typeId')
      const res = await page.evaluate(({ tid, note }) => window.api.customDocuments.createEntry({
        documentTypeId: tid, notes: note, customFields: {},
      }), { tid: typeId, note: `${TEST_PREFIX} original note` })
      entryId = res?.data?.id
      r.log('entry-created', !!entryId, JSON.stringify(res?.error || ''))
    })

    await r.step('update-entry-via-ui', async () => {
      if (!entryId) return r.log('update-entry-via-ui', false, 'no entryId')
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/custom-documents')
      await page.waitForTimeout(700)
      await page.locator('button', { hasText: `${TEST_PREFIX} Renamed Register` }).first().click()
      await page.waitForTimeout(500)

      const row = page.locator('tbody tr', { hasText: `${TEST_PREFIX} original note` }).first()
      await row.locator('button').first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByLabel('Notes').fill(`${TEST_PREFIX} updated note`)
      await modal.getByRole('button', { name: 'Save', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('entry-update-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((tid) => window.api.customDocuments.listEntries(tid), typeId)
      const found = (listRes?.data || []).find((e) => e.id === entryId)
      r.log('entry-actually-updated', found?.notes === `${TEST_PREFIX} updated note`, JSON.stringify(found))
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const typeIds = db.prepare(`SELECT id FROM CustomDocumentType WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let entries = 0, fieldDefs = 0, types = 0
      for (const tid of typeIds) {
        try { entries += db.prepare('DELETE FROM CustomDocumentEntry WHERE documentTypeId = ?').run(tid).changes } catch { /* noop */ }
        try { fieldDefs += db.prepare('DELETE FROM CustomFieldDefinition WHERE entityType = ?').run(`CUSTOM_DOCUMENT:${tid}`).changes } catch { /* noop */ }
        try { types += db.prepare('DELETE FROM CustomDocumentType WHERE id = ?').run(tid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ entries, fieldDefs, types }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCUSTOM DOCUMENT UPDATE: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
