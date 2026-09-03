/**
 * Suite 126 — clientDocumentChecklist.* (whole file, zero prior coverage of
 * any kind) — CA Firm vertical, broader-gap-list "Nested sub-feature gaps"
 * under Section A, 2026-09-03. All 7 channels have real UI triggers on
 * ComplianceScreen.tsx's "Clients & Checklists" modal.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E CADoc'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-ca-firm', async () => {
      const res = await page.evaluate(async () => window.api.industry.changeBusinessType({ businessType: 'CA_FIRM' }))
      r.log('business-type-switched', !!res?.success, JSON.stringify(res?.error || ''))
      await page.reload()
      await page.waitForTimeout(1500)
    })

    const clientAName = `${TEST_PREFIX} Client A ${suffix}`
    const clientBName = `${TEST_PREFIX} Client B ${suffix}`
    let clientAId, clientBId
    await r.step('create-clients', async () => {
      const custA = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), clientAName)
      clientAId = custA?.data?.id
      r.log('client-A-created', !!clientAId, JSON.stringify(custA?.error || ''))

      const custB = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), clientBName)
      clientBId = custB?.data?.id
      r.log('client-B-created', !!clientBId, JSON.stringify(custB?.error || ''))
    })

    async function openClientChecklist(clientName) {
      await h.gotoHash(page, '#/ca-cs/compliance')
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: 'Clients & Checklists' }).click()
      await page.waitForTimeout(500)
      const modal = h.topModal(page)
      await modal.getByPlaceholder('Search clients...').fill(clientName)
      await page.waitForTimeout(500)
      await modal.locator('button', { hasText: clientName }).first().click()
      await page.waitForTimeout(400)
      return modal
    }

    // ── Client A: add (manual) -> update (toggle Collected) -> remove ───────
    let itemAId
    await r.step('client-A-add-toggle-remove-checklist-item-via-ui', async () => {
      if (!clientAId) return r.log('client-A-add-toggle-remove-checklist-item-via-ui', false, 'no clientAId')
      const modal = await openClientChecklist(clientAName)
      r.log('checklist-modal-opens-no-crash', !(await h.hasErrorBoundary(page)))

      // { hasText, exact: true } is silently ignored -- `.locator()`'s
      // filter options don't support `exact`, only getBy* methods do.
      // "Add Standard Checklist" also contains the substring "Add".
      await modal.getByRole('button', { name: 'Add', exact: true }).click()
      await page.waitForTimeout(1000)
      r.log('add-item-no-crash', !(await h.hasErrorBoundary(page)))

      let listRes = await page.evaluate((cid) => window.api.clientDocumentChecklist.list({ clientId: cid }), clientAId)
      let items = listRes?.data || []
      const item = items[0]
      itemAId = item?.id
      r.log('item-added', !!itemAId && item?.documentType === 'PAN' && item?.status === 'PENDING', JSON.stringify(item))
      if (!itemAId) return

      const freshModal = h.topModal(page)
      await freshModal.locator('button', { hasText: 'Pending' }).first().click()
      await page.waitForTimeout(1000)
      r.log('toggle-collected-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((cid) => window.api.clientDocumentChecklist.list({ clientId: cid }), clientAId)
      items = listRes?.data || []
      let found = items.find((x) => x.id === itemAId)
      r.log('item-actually-collected', found?.status === 'COLLECTED', JSON.stringify(found))

      // "PAN Card" also appears as an <option> inside the add-item <select>,
      // and a broad div+hasText .last() picks whichever matching div is
      // LAST in document order (the select's wrapper, not nesting-closest)
      // -- scope to the item row's own exact class combo instead.
      const freshModal2 = h.topModal(page)
      await freshModal2.locator('div.flex.items-center.justify-between.text-xs', { hasText: 'PAN Card' }).locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(1000)
      r.log('remove-item-no-crash', !(await h.hasErrorBoundary(page)))

      listRes = await page.evaluate((cid) => window.api.clientDocumentChecklist.list({ clientId: cid }), clientAId)
      items = listRes?.data || []
      r.log('item-actually-removed', !items.some((x) => x.id === itemAId), JSON.stringify(items))

      // Close the modal explicitly -- re-navigating to the same hash
      // doesn't remount, so it would otherwise stay open (and cover the
      // header's "Clients & Checklists" button) for the Client B step.
      await h.closeTopModal(page)
    })

    // ── Client B: seed standard checklist (bulk-add) -> backdate one item
    // -> stale worklist banner -> chase reminder ─────────────────────────────
    await r.step('client-B-seed-standard-checklist-via-ui', async () => {
      if (!clientBId) return r.log('client-B-seed-standard-checklist-via-ui', false, 'no clientBId')
      const modal = await openClientChecklist(clientBName)
      await modal.locator('button', { hasText: 'Add Standard Checklist' }).click()
      await page.waitForTimeout(1200)
      r.log('seed-standard-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate((cid) => window.api.clientDocumentChecklist.list({ clientId: cid }), clientBId)
      const items = listRes?.data || []
      r.log('standard-checklist-seeded', items.length >= 3, JSON.stringify(items.map((i) => i.documentType)))

      // Backdate one item well past the 7-day chase threshold so the stale
      // worklist banner (and its per-client "chase" trigger) actually shows it.
      if (items[0]) {
        h.withDb((db) => db.prepare('UPDATE ClientDocumentChecklistItem SET createdAt = ? WHERE id = ?').run(Date.now() - 10 * 86400000, items[0].id))
      }
      await h.closeTopModal(page)
    })

    await r.step('stale-worklist-banner-and-chase-reminder-via-ui', async () => {
      if (!clientBId) return r.log('stale-worklist-banner-and-chase-reminder-via-ui', false, 'no clientBId')
      // loadStaleClients only runs on mount -- bounce through a different
      // route so this screen remounts and refetches with the backdated row.
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/ca-cs/compliance')
      await page.waitForTimeout(900)

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('stale-banner-shows-client-B', bodyText.includes(clientBName), bodyText.slice(0, 1500))

      const chaseBtn = page.locator('button', { hasText: clientBName })
      r.log('chase-button-present', await chaseBtn.count() > 0)
      if (await chaseBtn.count() > 0) {
        await chaseBtn.first().click()
        await page.waitForTimeout(1200)
        r.log('chase-no-crash', !(await h.hasErrorBoundary(page)))

        const res = await page.evaluate((cid) => window.api.clientDocumentChecklist.chase({ clientId: cid }), clientBId)
        r.log('chase-reminder-builds-link', !!res?.success && !!res?.data?.whatsappLink, JSON.stringify(res?.data))
      }
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'CA_FIRM') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      let items = 0, custs = 0
      for (const cid of custIds) {
        items += db.prepare('DELETE FROM ClientDocumentChecklistItem WHERE clientId = ?').run(cid).changes
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      console.log('extra cleanup:', JSON.stringify({ items, custs }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nCLIENT DOCUMENT CHECKLIST: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
