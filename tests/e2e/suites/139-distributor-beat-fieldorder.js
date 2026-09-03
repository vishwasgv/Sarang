/**
 * Suite 139 — Section C medium CRUD gap: industry.handler.ts distributor
 * sub-namespace, reconfirmed 2026-09-03 against suite 78 (createBeat/
 * addBeatStop/moveBeatStop/acceptFieldOrderRequest already covered there
 * via real UI -- gap-list's own summary was stale). Covers the genuinely
 * untested channels: updateBeat, deleteBeat, removeBeatStop,
 * getFieldOrderStatus, generateFieldOrderQr, regenerateFieldOrderToken,
 * rejectFieldOrderRequest. updateBeat has NO UI trigger anywhere in the
 * renderer (confirmed via grep) -- a real product gap (no way to rename a
 * beat, only create/delete) -- covered API-only.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E Dist139'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-distributor', async () => {
      const sw = await h.switchBusinessType(page, 'Distributor / Wholesale')
      r.log('business-type-switched', sw.to === 'DISTRIBUTOR', JSON.stringify(sw))
    })

    let customerId, beatId, stopId
    const beatName = `${TEST_PREFIX} Beat ${suffix}`
    await r.step('seed-beat-with-stop-via-api', async () => {
      const custRes = await page.evaluate(async (name) => window.api.customers.create({
        customerName: name, phone: `9${String(Date.now()).slice(-9)}`,
      }), `${TEST_PREFIX} Retailer ${suffix}`)
      customerId = custRes?.data?.id
      r.log('customer-created', !!customerId)

      const beatRes = await page.evaluate(({ name, rep }) => window.api.distributor.createBeat({
        name, repName: rep,
      }), { name: beatName, rep: `${TEST_PREFIX} Rep ${suffix}` })
      beatId = beatRes?.data?.id
      r.log('beat-created', !!beatId, JSON.stringify(beatRes?.error || ''))

      if (beatId && customerId) {
        const stopRes = await page.evaluate(({ bid, cid }) => window.api.distributor.addBeatStop({
          beatId: bid, customerId: cid,
        }), { bid: beatId, cid: customerId })
        stopId = stopRes?.data?.id
        r.log('stop-added', !!stopId, JSON.stringify(stopRes?.error || ''))
      }
    })

    await r.step('update-beat-api-only-no-ui-trigger', async () => {
      if (!beatId) return r.log('update-beat-api-only-no-ui-trigger', false, 'no beatId')
      const renamedBeatName = `${TEST_PREFIX} Renamed Beat`
      const updRes = await page.evaluate(({ id, name }) => window.api.distributor.updateBeat({
        id, name,
      }), { id: beatId, name: renamedBeatName })
      r.log('beat-update-api-succeeds', !!updRes?.success, JSON.stringify(updRes?.error || ''))

      const listRes = await page.evaluate(() => window.api.distributor.listBeats())
      const found = (listRes?.data || []).find((b) => b.id === beatId)
      r.log('beat-actually-updated', found?.name === renamedBeatName, JSON.stringify(found))
      // Restore the original name so the later UI steps (which locate the
      // beat by its ORIGINAL name) still find it.
      await page.evaluate(({ id, name }) => window.api.distributor.updateBeat({ id, name }), { id: beatId, name: beatName })
    })

    await r.step('remove-beat-stop-via-ui', async () => {
      if (!beatId || !stopId) return r.log('remove-beat-stop-via-ui', false, 'missing prerequisites')
      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/distributor/beats')
      await page.waitForTimeout(700)
      r.log('beats-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      await page.locator('button', { hasText: beatName }).first().click()
      await page.waitForTimeout(400)
      const row = page.locator('ol li', { hasText: `${TEST_PREFIX} Retailer ${suffix}` }).first()
      r.log('stop-row-present', await row.count() > 0)
      await row.locator('button').last().click()
      await page.waitForTimeout(900)
      r.log('remove-stop-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.distributor.listBeats())
      const found = (listRes?.data || []).find((b) => b.id === beatId)
      r.log('stop-actually-removed', !!found && found.stops.length === 0, JSON.stringify(found?.stops))
    })

    await r.step('delete-beat-via-ui', async () => {
      if (!beatId) return r.log('delete-beat-via-ui', false, 'no beatId')
      const card = page.locator('div.rounded-xl', { hasText: beatName }).first()
      await card.locator('button:has(svg.lucide-trash2)').click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('delete-beat-no-crash', !(await h.hasErrorBoundary(page)))

      const listRes = await page.evaluate(() => window.api.distributor.listBeats())
      r.log('beat-actually-deleted', !(listRes?.data || []).some((b) => b.id === beatId), JSON.stringify(listRes?.data?.length))
    })

    let originalToken
    await r.step('field-order-status-qr-and-regenerate-via-ui', async () => {
      await h.gotoHash(page, '#/distributor/field-orders')
      await page.waitForTimeout(1000)
      r.log('field-orders-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const statusRes = await page.evaluate(() => window.api.distributor.getFieldOrderStatus())
      r.log('field-order-server-running', statusRes?.data?.running === true, JSON.stringify(statusRes?.data))
      originalToken = statusRes?.data?.token

      await page.getByRole('button', { name: 'Show QR Code' }).click()
      await page.waitForTimeout(900)
      r.log('qr-image-rendered', await page.locator('img[alt="Field order QR code"]').count() > 0)

      await page.getByRole('button', { name: 'Regenerate Link' }).first().click()
      await page.waitForTimeout(400)
      const modal = h.topModal(page)
      await modal.getByRole('button', { name: 'Regenerate Link', exact: true }).click()
      await page.waitForTimeout(900)
      r.log('regenerate-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate(() => window.api.distributor.getFieldOrderStatus())
      r.log('token-actually-regenerated', !!afterRes?.data?.token && afterRes.data.token !== originalToken, JSON.stringify({ before: originalToken, after: afterRes?.data?.token }))
    })

    let fieldOrderRequestId
    let fieldOrderProductId
    await r.step('reject-field-order-request-via-ui', async () => {
      const prodRes = await page.evaluate(async (name) => window.api.products.create({
        productName: name, productType: 'STANDARD', unit: 'NOS', sellingPrice: 100, openingQuantity: 50,
      }), `${TEST_PREFIX} Product ${suffix}`)
      fieldOrderProductId = prodRes?.data?.id
      r.log('field-order-product-created', !!fieldOrderProductId, JSON.stringify(prodRes?.error || ''))

      const statusRes = await page.evaluate(() => window.api.distributor.getFieldOrderStatus())
      const port = statusRes?.data?.port
      const token = statusRes?.data?.token
      if (!port || !token || !fieldOrderProductId) return r.log('reject-field-order-request-via-ui', false, 'missing server prerequisites')

      const submitRes = await fetch(`http://127.0.0.1:${port}/api/field-order/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repName: `${TEST_PREFIX} Rep ${suffix}`, customerId, items: [{ productId: fieldOrderProductId, quantity: 1 }] }),
      }).then((res) => res.json()).catch((e) => ({ success: false, error: String(e) }))
      r.log('field-order-submitted', !!submitRes?.success, JSON.stringify(submitRes))

      await h.gotoHash(page, '#/dashboard')
      await page.waitForTimeout(300)
      await h.gotoHash(page, '#/distributor/field-orders')
      await page.waitForTimeout(1000)

      const listRes = await page.evaluate(() => window.api.distributor.listFieldOrderRequests({ status: 'PENDING' }))
      const found = (listRes?.data || []).find((req) => req.repName === `${TEST_PREFIX} Rep ${suffix}`)
      fieldOrderRequestId = found?.id
      r.log('field-order-request-persisted', !!fieldOrderRequestId, JSON.stringify(found))
      if (!fieldOrderRequestId) return

      const row = page.locator('div.rounded-xl', { hasText: `${TEST_PREFIX} Rep ${suffix}` }).first()
      await row.getByRole('button', { name: 'Reject' }).click()
      await page.waitForTimeout(900)
      r.log('reject-no-crash', !(await h.hasErrorBoundary(page)))

      const afterRes = await page.evaluate(() => window.api.distributor.listFieldOrderRequests({}))
      const afterFound = (afterRes?.data || []).find((req) => req.id === fieldOrderRequestId)
      r.log('field-order-request-actually-rejected', afterFound?.status === 'REJECTED', JSON.stringify(afterFound))
    })

    await r.step('restore-business-type', async () => {
      if (originalBusinessType && originalBusinessType !== 'DISTRIBUTOR') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let beats = 0, stops = 0, reqs = 0, reqItems = 0, custs = 0, prods = 0
      const beatIds = db.prepare(`SELECT id FROM DistributorBeat WHERE name LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const bid of beatIds) {
        try { stops += db.prepare('DELETE FROM DistributorBeatStop WHERE beatId = ?').run(bid).changes } catch { /* noop */ }
        try { beats += db.prepare('DELETE FROM DistributorBeat WHERE id = ?').run(bid).changes } catch { /* noop */ }
      }
      const reqIds = db.prepare(`SELECT id FROM FieldOrderRequest WHERE repName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const rid of reqIds) {
        try { reqItems += db.prepare('DELETE FROM FieldOrderRequestItem WHERE requestId = ?').run(rid).changes } catch { /* noop */ }
        try { reqs += db.prepare('DELETE FROM FieldOrderRequest WHERE id = ?').run(rid).changes } catch { /* noop */ }
      }
      const custIds = db.prepare(`SELECT id FROM Customer WHERE customerName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const cid of custIds) {
        db.prepare('DELETE FROM CustomerLedger WHERE customerId = ?').run(cid)
        try { custs += db.prepare('DELETE FROM Customer WHERE id = ?').run(cid).changes } catch { db.prepare('UPDATE Customer SET isActive = 0 WHERE id = ?').run(cid) }
      }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const pid of prodIds) {
        db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(pid)
        db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(pid)
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(pid).changes } catch { /* noop */ }
      }
      console.log('extra cleanup:', JSON.stringify({ beats, stops, reqs, reqItems, custs, prods }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nDISTRIBUTOR BEAT/FIELD-ORDER: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
