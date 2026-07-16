/**
 * Suite 48 — Kitchen Display: second monitor (Feature A) + phone/laptop LAN
 * board (Feature B), additive to KOT printing (see kot_printer_name in
 * suite... printer settings aren't separately e2e'd — covered by typecheck +
 * unit tests). Both features drive the exact same restaurantService.listKOTs
 * / updateKOTStatus used by the in-app KOTScreen (suite 40 already covers
 * that UI path in depth) — this suite's job is proving the two NEW surfaces
 * (a second BrowserWindow, and a second LAN HTTP server on port 8421,
 * isolated from the qr-order-server on 8420 — see suite 07 for that one)
 * actually reach the real service logic, not a parallel/fake implementation.
 */
const h = require('../harness')

const TEST_PREFIX = 'E2E KDS'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  let originalModules = []

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    await r.step('switch-to-restaurant-and-enable-kitchen-display-web', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('switched-to-restaurant', sw.to === 'RESTAURANT', JSON.stringify(sw))

      const tmpl = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tmpl?.data?.enabledModules || []
      const withKds = originalModules.includes('kitchen_display_web') ? originalModules : [...originalModules, 'kitchen_display_web']
      const updRes = await page.evaluate(async (modules) => window.api.industry.updateModules({ modules }), withKds)
      r.log('kitchen-display-web-module-enabled', !!updRes?.success, JSON.stringify(updRes?.error || ''))
    })

    let tableId, productId, invoiceId, kotId, serverBase, token

    await r.step('setup-table-product-invoice-kot-via-api', async () => {
      const tableRes = await page.evaluate(async (prefix) => window.api.restaurant.createTable({
        tableNumber: `${prefix}-T1`, tableName: `${prefix} Table 1`,
      }), TEST_PREFIX)
      tableId = tableRes?.data?.id
      r.log('table-created', !!tableRes?.success, JSON.stringify(tableRes?.error || ''))

      const prodRes = await page.evaluate(async (prefix) => window.api.products.create({
        productName: `${prefix} Fried Rice`, productType: 'STANDARD', unit: 'PCS',
        costPrice: 30, sellingPrice: 90, taxRate: 5, openingQuantity: 100,
      }), TEST_PREFIX)
      productId = prodRes?.data?.id
      r.log('product-created', !!prodRes?.success, JSON.stringify(prodRes?.error || ''))

      const invRes = await page.evaluate(async (pid) => window.api.billing.createInvoice({
        paymentMethod: 'CASH',
        items: [{ productId: pid, quantity: 1, unitPrice: 90, taxRate: 5 }],
      }), productId)
      invoiceId = invRes?.data?.id
      r.log('invoice-created', !!invRes?.success, JSON.stringify(invRes?.error || ''))

      const kotRes = await page.evaluate(async ({ invId, tblId }) => window.api.restaurant.createKOT({ invoiceId: invId, tableId: tblId }), { invId: invoiceId, tblId: tableId })
      kotId = kotRes?.data?.id
      r.log('kot-created', !!kotRes?.success, JSON.stringify(kotRes?.error || ''))

      const statusRes = await page.evaluate(async () => window.api.restaurant.getKitchenDisplayStatus())
      r.log('kitchen-display-server-running', statusRes?.data?.running === true && !!statusRes?.data?.token, JSON.stringify(statusRes?.data))
      serverBase = statusRes?.data?.lanUrls?.[0] ? `http://127.0.0.1:${statusRes.data.port}` : null
      token = statusRes?.data?.token
    })

    await r.step('lan-board-page-and-api-reachable-with-correct-token', async () => {
      if (!serverBase || !token) return r.log('lan-board-page-and-api-reachable-with-correct-token', false, 'missing prerequisites')

      const pageRes = await fetch(`${serverBase}/kitchen/${token}`)
      const pageBody = await pageRes.text()
      r.log('board-page-200-with-correct-token', pageRes.status === 200 && /Kitchen Display/.test(pageBody), `status=${pageRes.status}`)

      const boardRes = await fetch(`${serverBase}/api/kitchen/${token}/board`).then((x) => x.json())
      const found = (boardRes?.data || []).find((k) => k.id === kotId)
      r.log('board-api-returns-our-kot', boardRes?.success === true && !!found, JSON.stringify({ success: boardRes?.success, found: !!found }))
    })

    await r.step('wrong-token-rejected-on-both-routes', async () => {
      if (!serverBase) return

      const pageRes = await fetch(`${serverBase}/kitchen/not-the-real-token`)
      r.log('board-page-404-with-wrong-token', pageRes.status === 404, `status=${pageRes.status}`)

      const apiRes = await fetch(`${serverBase}/api/kitchen/not-the-real-token/board`)
      r.log('board-api-403-with-wrong-token', apiRes.status === 403, `status=${apiRes.status}`)
    })

    await r.step('lan-status-post-drives-the-real-service-not-a-stub', async () => {
      if (!serverBase || !token || !kotId) return r.log('lan-status-post-drives-the-real-service-not-a-stub', false, 'missing prerequisites')

      const advance1 = await fetch(`${serverBase}/api/kitchen/${token}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kotId, status: 'IN_PROGRESS' }),
      }).then((x) => x.json())
      r.log('lan-advance-to-in-progress-succeeds', advance1?.success === true && advance1?.data?.status === 'IN_PROGRESS', JSON.stringify(advance1))

      const advance2 = await fetch(`${serverBase}/api/kitchen/${token}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kotId, status: 'DONE' }),
      }).then((x) => x.json())
      r.log('lan-advance-to-done-succeeds', advance2?.success === true && advance2?.data?.status === 'DONE', JSON.stringify(advance2))

      // updateKOTStatus's real side effect (not something a fake/echo
      // endpoint would reproduce): DONE frees the table once no other
      // active ticket uses it — proves this LAN write reached the actual
      // restaurantService.updateKOTStatus, same as every other KOT-advancing
      // surface (KOTScreen, second-monitor board), not a parallel code path.
      const tablesRes = await page.evaluate(async () => window.api.restaurant.listTables())
      const table = (tablesRes?.data || []).find((t) => t.id === tableId)
      r.log('table-freed-by-lan-driven-done', table?.status === 'AVAILABLE', JSON.stringify(table?.status))
    })

    await r.step('generate-qr-and-regenerate-token-invalidates-old-one', async () => {
      const qrRes = await page.evaluate(async () => window.api.restaurant.generateKitchenDisplayQr())
      r.log('qr-generated', qrRes?.success === true && typeof qrRes?.data?.qrDataUrl === 'string', JSON.stringify(qrRes?.success))

      const regenRes = await page.evaluate(async () => window.api.restaurant.regenerateKitchenDisplayToken())
      const newToken = regenRes?.data?.token
      r.log('token-regenerated', !!newToken && newToken !== token, JSON.stringify({ changed: newToken !== token }))

      if (serverBase && token) {
        const oldTokenRes = await fetch(`${serverBase}/api/kitchen/${token}/board`)
        r.log('old-token-rejected-after-regenerate', oldTokenRes.status === 403, `status=${oldTokenRes.status}`)
      }
      // The board GET rate-limit test below deliberately exhausts this same
      // IP's GET bucket — run it last so it can't make an earlier check in
      // this same 60s window observe 429 instead of the status it's really
      // testing for.
    })

    await r.step('board-get-endpoint-is-rate-limited', async () => {
      if (!serverBase || !token) return
      // Cap is 30/min for GET — 35 rapid requests from one source must
      // produce at least one 429, proving the limiter is actually wired to
      // this server's routes (not just qr-order-server.ts's).
      const statuses = await Promise.all(Array.from({ length: 35 }, () =>
        fetch(`${serverBase}/api/kitchen/${token}/board`).then((x) => x.status).catch(() => 0)
      ))
      r.log('board-endpoint-rate-limited-past-cap', statuses.includes(429), JSON.stringify(statuses.filter((s) => s !== 200)))
    })

    await r.step('second-monitor-window-ipc-lifecycle', async () => {
      const listRes = await page.evaluate(async () => window.api.kitchenDisplay.listDisplays())
      r.log('list-displays-succeeds', listRes?.success === true && Array.isArray(listRes?.data), JSON.stringify(listRes?.data))

      const statusBefore = await page.evaluate(async () => window.api.kitchenDisplay.getStatus())
      r.log('window-closed-initially', statusBefore?.data?.open === false, JSON.stringify(statusBefore?.data))

      // No displayId passed — falls back to the first non-primary display,
      // or the primary if this machine only has one (true in most CI/dev
      // environments; real multi-monitor placement still needs a one-time
      // manual check on actual hardware per the plan's stated caveat).
      const openRes = await page.evaluate(async () => window.api.kitchenDisplay.open())
      r.log('open-kitchen-display-window-succeeds', openRes?.success === true, JSON.stringify(openRes?.error || ''))
      await page.waitForTimeout(1500)

      const statusAfter = await page.evaluate(async () => window.api.kitchenDisplay.getStatus())
      r.log('window-reports-open-after-open-call', statusAfter?.data?.open === true, JSON.stringify(statusAfter?.data))

      const closeRes = await page.evaluate(async () => window.api.kitchenDisplay.close())
      r.log('close-kitchen-display-window-succeeds', closeRes?.success === true, JSON.stringify(closeRes?.error || ''))
      await page.waitForTimeout(500)

      const statusFinal = await page.evaluate(async () => window.api.kitchenDisplay.getStatus())
      r.log('window-reports-closed-after-close-call', statusFinal?.data?.open === false, JSON.stringify(statusFinal?.data))
    })

    await r.step('kitchen-display-route-renders-real-kot-data', async () => {
      // Drive the main window's own webContents to the board route directly
      // — proves the #/kitchen-display screen itself (not just the IPC
      // plumbing above) renders without crashing and shows live data, the
      // same component the second-monitor window loads.
      await h.gotoHash(page, '#/kitchen-display')
      await page.waitForTimeout(1000)
      r.log('kitchen-display-route-loads-no-crash', !(await h.hasErrorBoundary(page)))
      const bodyText = await page.locator('body').innerText()
      r.log('kitchen-display-heading-present', /Kitchen Display/.test(bodyText), bodyText.slice(0, 120))
      await h.shot(page, 'kitchen-display-board')
      // Our ticket is DONE by this point (from the earlier step) — Recently
      // Done column should still surface it.
      r.log('kitchen-display-shows-recently-done-ticket', bodyText.includes(`${TEST_PREFIX} Table 1`) || bodyText.includes(`${TEST_PREFIX} Fried Rice`), bodyText.slice(0, 200))
      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(500)
    })
  } finally {
    if (originalBusinessType) {
      try {
        const winPage = (await app.windows())[0]
        if (winPage) {
          if (originalModules.length) await winPage.evaluate((modules) => window.api.industry.updateModules({ modules }), originalModules)
          await winPage.evaluate((bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        }
      } catch { /* app may already be closing */ }
    }
    await h.closeApp(app)
    h.randomizeAdminPassword()
    const cleaned = h.cleanupByNamePrefix(TEST_PREFIX)
    console.log('cleanup:', JSON.stringify(cleaned))
    h.withDb((db) => {
      const prodIds = db.prepare("SELECT id FROM Product WHERE productName LIKE 'E2E KDS%'").all().map((row) => row.id)
      const invIds = prodIds.length === 0 ? [] : db.prepare(`SELECT DISTINCT i.id AS id FROM "Invoice" i JOIN InvoiceItem ii ON ii.invoiceId = i.id WHERE ii.productId IN (${prodIds.map(() => '?').join(',')})`).all(...prodIds).map((row) => row.id)
      for (const id of invIds) {
        try { db.prepare('DELETE FROM KOT WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM InvoiceItem WHERE invoiceId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM "Invoice" WHERE id = ?').run(id) } catch { /* noop */ }
      }
      for (const id of prodIds) { try { db.prepare('DELETE FROM Product WHERE id = ?').run(id) } catch { /* noop */ } }
      const tableIds = db.prepare(`SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of tableIds) { try { db.prepare('DELETE FROM RestaurantTable WHERE id = ?').run(id) } catch { /* noop */ } }
      console.log('extra cleanup: invoices', invIds.length, 'products', prodIds.length, 'tables', tableIds.length)
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nKITCHEN DISPLAY: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
