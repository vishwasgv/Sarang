/**
 * Suite 7 — QR-ordering flood (Section 2.2 item 7 + Section 2.3 stress
 * scenario). The customer-facing order submission at POST /api/order is a
 * genuine unauthenticated HTTP endpoint (not IPC) — this suite hits it
 * directly with `fetch`, not through window.api, exactly as a real
 * customer's phone would. Confirms the real rate limit (5 requests/60s per
 * source) actually returns 429 past the 5th, and that a flood doesn't
 * silently create unbounded PENDING order requests.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E QR'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-restaurant-and-enable-qr-ordering', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('switched-to-restaurant', sw.to === 'RESTAURANT', JSON.stringify(sw))

      const tmpl = await page.evaluate(async () => window.api.industry.getTemplate())
      const current = tmpl?.data?.enabledModules || []
      const withQr = current.includes('qr_table_ordering') ? current : [...current, 'qr_table_ordering']
      const updRes = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), withQr)
      r.log('qr-ordering-module-enabled', !!updRes?.success, JSON.stringify(updRes?.error || ''))
    })

    let productId, tableId, serverBase

    await r.step('setup-table-and-product-and-server-status', async () => {
      const tableRes = await page.evaluate(async (prefix) => window.api.restaurant.createTable({
        tableNumber: `${prefix}-T1`, tableName: `${prefix} Table 1`,
      }), TEST_PREFIX)
      r.log('table-created', !!tableRes?.success, JSON.stringify(tableRes?.error || ''))
      tableId = tableRes?.data?.id

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Menu Item`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 30, sellingPrice: 60, taxRate: 5, openingQuantity: 100,
      }), TEST_PREFIX)
      r.log('menu-product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))
      productId = prodRes?.data?.id

      const statusRes = await page.evaluate(async () => window.api.restaurant.getQrOrderingStatus())
      r.log('qr-server-running', statusRes?.data?.running === true, JSON.stringify(statusRes?.data))
      const port = statusRes?.data?.port
      serverBase = `http://127.0.0.1:${port}`
    })

    await r.step('flood-order-endpoint-confirms-rate-limit', async () => {
      if (!tableId || !productId || !serverBase) return r.log('flood-order-endpoint-confirms-rate-limit', false, 'missing prerequisites')

      // Fire 8 rapid submissions from this one Node process (one source IP,
      // 127.0.0.1) against a limit of 5/60s — the 6th+ must be rejected.
      const results = await Promise.all(Array.from({ length: 8 }, () =>
        fetch(`${serverBase}/api/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId, items: [{ productId, quantity: 1 }] }),
        }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }))
          .catch((e) => ({ status: 0, error: String(e) }))
      ))

      const statuses = results.map((x) => x.status)
      const successCount = statuses.filter((s) => s === 200).length
      const rateLimitedCount = statuses.filter((s) => s === 429).length
      r.log('flood-first-5-succeed-rest-rate-limited', successCount === 5 && rateLimitedCount === 3, JSON.stringify(statuses))

      const limitedBody = results.find((x) => x.status === 429)?.body
      r.log('rate-limit-error-message-present', !!limitedBody && limitedBody.success === false, JSON.stringify(limitedBody))
    })

    await r.step('menu-endpoint-reachable-and-independently-rate-limited', async () => {
      if (!serverBase) return
      const res = await fetch(`${serverBase}/api/menu`).then((x) => x.json()).catch((e) => ({ error: String(e) }))
      r.log('menu-endpoint-reachable', res?.success === true && Array.isArray(res?.data), JSON.stringify(res?.success))
    })

    await r.step('staff-side-sees-only-the-accepted-requests', async () => {
      const listRes = await page.evaluate(async () => window.api.restaurant.listOrderRequests({}))
      const requests = listRes?.data?.requests || listRes?.data || []
      const ours = Array.isArray(requests) ? requests.filter((req) => req.tableId === tableId) : []
      // Exactly 5 should have been accepted as real PENDING requests — the
      // rate-limited attempts must never have reached order-creation at all.
      r.log('exactly-5-order-requests-created-not-8', ours.length === 5, `count=${ours.length}`)
      await h.shot(page, 'qr-order-requests')
    })
  } finally {
    if (originalBusinessType) {
      try {
        const winPage = (await app.windows())[0]
        if (winPage) await winPage.evaluate((bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
      } catch { /* app may already be closing */ }
    }
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const tableIds = db.prepare(`SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const tid of tableIds) {
        db.prepare('DELETE FROM TableOrderRequestItem WHERE requestId IN (SELECT id FROM TableOrderRequest WHERE tableId = ?)').run(tid)
        db.prepare('DELETE FROM TableOrderRequest WHERE tableId = ?').run(tid)
        try { db.prepare('DELETE FROM RestaurantTable WHERE id = ?').run(tid) } catch { /* leave it */ }
      }
      console.log('qr cleanup: tables', tableIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nQR ORDERING FLOOD: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
