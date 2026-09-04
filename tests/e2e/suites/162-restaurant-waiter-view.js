/**
 * Suite 162 — Waiter View: a waiter's own LAN-served "My Tables" board
 * (scan their personal QR from their phone) showing what's cooking, what's
 * ready to serve, and a way to take a new order directly to the kitchen.
 * New this suite: KOT.servedAt, restaurant.markKOTServed/listKOTsForWaiter/
 * listWaiterTables/createWaiterTableOrder/generateWaiterQr, new LAN routes
 * on kitchen-display-server.ts (/waiter/:token/:employeeId + 5 JSON
 * endpoints), resources/kitchen-display/waiter.html, a "Waiter View" QR
 * section on RestaurantTablesScreen.tsx, and a "Mark Served" button on
 * KOTScreen.tsx's own DONE tickets (same action, no phone needed).
 */
const h = require('../harness')
const { createTestProduct } = require('../fixtures/seed')

const TEST_PREFIX = 'E2E162'

async function run() {
  const r = h.makeResults()
  h.resetAdminPasswordForSuite()
  const app = await h.launchApp()
  const originalBusinessType = h.getBusinessType()
  const suffix = Date.now()

  try {
    const page = await h.getMainWindow(app)
    await h.login(page)

    let originalModules = []
    await r.step('switch-to-restaurant-and-enable-kitchen-display-web', async () => {
      const sw = await h.switchBusinessType(page, 'Restaurant')
      r.log('business-type-switched', sw.to === 'RESTAURANT', JSON.stringify(sw))

      const tmpl = await page.evaluate(async () => window.api.industry.getTemplate())
      originalModules = tmpl?.data?.enabledModules || []
      if (!originalModules.includes('kitchen_display_web')) {
        const updRes = await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), [...originalModules, 'kitchen_display_web'])
        r.log('kitchen-display-web-module-enabled', !!updRes?.success, JSON.stringify(updRes?.error || ''))
      } else {
        r.log('kitchen-display-web-module-enabled', true, 'already enabled')
      }
    })

    let waiterId, otherWaiterId, tableId, otherTableId, prodId
    await r.step('seed-waiter-tables-and-product', async () => {
      const empRes = await page.evaluate(async ({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `9${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} Waiter ${suffix}`, joinDate: h.toLocalISODate(new Date()) })
      waiterId = empRes?.data?.id
      const otherEmpRes = await page.evaluate(async ({ name, joinDate }) => window.api.hr.createEmployee({
        fullName: name, phone: `8${String(Date.now()).slice(-9)}`, joinDate,
      }), { name: `${TEST_PREFIX} OtherWaiter ${suffix}`, joinDate: h.toLocalISODate(new Date()) })
      otherWaiterId = otherEmpRes?.data?.id
      r.log('waiters-created', !!waiterId && !!otherWaiterId, JSON.stringify({ waiterId, otherWaiterId }))

      const tableRes = await page.evaluate(async (num) => window.api.restaurant.createTable({ tableNumber: num }), `${TEST_PREFIX}-T1-${suffix}`)
      tableId = tableRes?.data?.id
      const otherTableRes = await page.evaluate(async (num) => window.api.restaurant.createTable({ tableNumber: num }), `${TEST_PREFIX}-T2-${suffix}`)
      otherTableId = otherTableRes?.data?.id
      r.log('tables-created', !!tableId && !!otherTableId, JSON.stringify({ tableId, otherTableId }))

      await page.evaluate(({ tableId, waiterId }) => window.api.restaurant.assignWaiter({ tableId, waiterId }), { tableId, waiterId })
      await page.evaluate(({ tableId, waiterId }) => window.api.restaurant.assignWaiter({ tableId, waiterId }), { tableId: otherTableId, waiterId: otherWaiterId })

      const prodRes = await createTestProduct(page, { productName: `${TEST_PREFIX} Fried Rice ${suffix}`, sellingPrice: 120, costPrice: 60, taxRate: 5, foodType: 'VEG' })
      prodId = prodRes?.data?.id
      r.log('product-seeded', !!prodId, JSON.stringify(prodRes?.error || ''))
    })

    await r.step('generate-waiter-qr-via-real-ui', async () => {
      await h.gotoHash(page, '#/restaurant/tables')
      await page.waitForTimeout(900)
      r.log('tables-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      const bodyText = await page.locator('body').innerText().catch(() => '')
      r.log('waiter-view-section-visible', bodyText.includes('Waiter View'))

      await page.locator('button', { hasText: `${TEST_PREFIX} Waiter ${suffix}` }).first().click()
      await page.waitForTimeout(900)
      const modal = h.topModal(page)
      r.log('qr-modal-shows-image', await modal.locator('img[alt="Waiter QR code"]').count() > 0)
      const urlText = await modal.locator('p.break-all').innerText().catch(() => '')
      r.log('qr-modal-shows-capture-url', urlText.includes('/waiter/') && urlText.includes(waiterId), urlText)
      await modal.locator('button:has(svg.lucide-x)').click()
      await page.waitForTimeout(300)
    })

    let port, token
    await r.step('waiter-can-place-a-direct-order-via-lan', async () => {
      const statusRes = await page.evaluate(async () => window.api.restaurant.getKitchenDisplayStatus())
      r.log('kitchen-display-running', statusRes?.data?.running === true, JSON.stringify(statusRes?.data))
      if (!statusRes?.data?.running) return
      port = statusRes.data.port
      token = statusRes.data.token

      const pageHtml = await fetch(`http://127.0.0.1:${port}/waiter/${token}/${waiterId}`).then((x) => x.text())
      r.log('waiter-page-loads', pageHtml.includes('My Tables'))

      const tablesRes = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/tables`).then((x) => x.json())
      const myTables = tablesRes?.data || []
      r.log('waiter-tables-scoped-to-this-waiter', myTables.length === 1 && myTables[0].id === tableId, JSON.stringify(myTables))

      const menuRes = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/menu`).then((x) => x.json())
      const menuItem = (menuRes?.data || []).find((p) => p.id === prodId)
      r.log('waiter-menu-shows-our-product', !!menuItem && menuItem.foodType === 'VEG', JSON.stringify(menuItem))

      // Wrong-waiter's table must be rejected server-side, not just hidden client-side.
      const wrongTableOrderRes = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: otherTableId, items: [{ productId: prodId, quantity: 1 }] }),
      }).then((x) => x.json())
      r.log('order-for-someone-elses-table-rejected', wrongTableOrderRes?.success === false && wrongTableOrderRes?.error?.code === 'RST-067', JSON.stringify(wrongTableOrderRes?.error))

      const orderRes = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, items: [{ productId: prodId, quantity: 3 }] }),
      }).then((x) => x.json())
      r.log('direct-order-created', !!orderRes?.success, JSON.stringify(orderRes?.error || ''))

      // createKOT's own success response is the bare KOT row (no items
      // relation included) -- checked properly via the board fetch below,
      // which does include items with the server-resolved price/tax.
      const boardCheck = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/board`).then((x) => x.json())
      const kotItem = (boardCheck?.data || []).find((k) => k.id === orderRes?.data?.id)?.items?.[0]
      r.log('order-price-resolved-server-side', kotItem?.unitPriceSnapshot === 120 && kotItem?.taxRateSnapshot === 5, JSON.stringify(kotItem))
    })

    let kotId
    await r.step('waiter-board-shows-and-serves-the-order', async () => {
      if (!port) return r.log('waiter-board-shows-and-serves-the-order', false, 'kitchen display not running')

      const boardRes = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/board`).then((x) => x.json())
      const kot = (boardRes?.data || []).find((k) => k.table?.id === tableId || k.tableId === tableId)
      kotId = kot?.id
      r.log('waiter-board-shows-new-order', !!kotId && kot?.status === 'PENDING', JSON.stringify(kot))

      // Progress the ticket to DONE via the normal in-app path (a waiter's
      // own board never advances kitchen status, only serves once ready).
      await page.evaluate((id) => window.api.restaurant.updateKOTStatus({ kotId: id, status: 'IN_PROGRESS' }), kotId)
      await page.evaluate((id) => window.api.restaurant.updateKOTStatus({ kotId: id, status: 'DONE' }), kotId)

      const boardAfterDone = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/board`).then((x) => x.json())
      const readyKot = (boardAfterDone?.data || []).find((k) => k.id === kotId)
      r.log('board-shows-ready-to-serve', readyKot?.status === 'DONE', JSON.stringify(readyKot))

      const servedRes = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/served`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kotId }),
      }).then((x) => x.json())
      r.log('mark-served-succeeds', !!servedRes?.success && !!servedRes?.data?.servedAt, JSON.stringify(servedRes))

      const boardAfterServed = await fetch(`http://127.0.0.1:${port}/api/waiter/${token}/${waiterId}/board`).then((x) => x.json())
      r.log('served-ticket-drops-off-board', !(boardAfterServed?.data || []).some((k) => k.id === kotId), JSON.stringify(boardAfterServed?.data?.length))
    })

    await r.step('mark-served-blocked-before-done', async () => {
      const kotRes = await page.evaluate(({ pid, tid }) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 120, taxRate: 5 }],
      }).then((inv) => window.api.restaurant.createKOT({ invoiceId: inv.data.id, tableId: tid })), { pid: prodId, tid: tableId })
      const freshKotId = kotRes?.data?.id
      r.log('fresh-kot-created', !!freshKotId, JSON.stringify(kotRes?.error || ''))
      if (!freshKotId) return

      const blockedRes = await page.evaluate((id) => window.api.restaurant.markKOTServed({ kotId: id }), freshKotId)
      r.log('mark-served-blocked-when-not-done', blockedRes?.success === false && blockedRes?.error?.code === 'RST-061', JSON.stringify(blockedRes?.error))

      // clean up this extra fresh KOT/invoice directly, cancel it out
      await page.evaluate((id) => window.api.restaurant.updateKOTStatus({ kotId: id, status: 'CANCELLED' }), freshKotId)
    })

    await r.step('kot-screen-mark-served-button-via-real-ui', async () => {
      const kotRes = await page.evaluate(({ pid, tid }) => window.api.billing.createInvoice({
        paymentMethod: 'CASH', items: [{ productId: pid, quantity: 1, unitPrice: 120, taxRate: 5 }],
      }).then((inv) => window.api.restaurant.createKOT({ invoiceId: inv.data.id, tableId: tid })), { pid: prodId, tid: tableId })
      const kot2Id = kotRes?.data?.id
      await page.evaluate((id) => window.api.restaurant.updateKOTStatus({ kotId: id, status: 'IN_PROGRESS' }), kot2Id)
      await page.evaluate((id) => window.api.restaurant.updateKOTStatus({ kotId: id, status: 'DONE' }), kot2Id)

      await h.gotoHash(page, '#/restaurant/kot')
      await page.waitForTimeout(900)
      r.log('kot-screen-loads-no-crash', !(await h.hasErrorBoundary(page)))

      // Screen defaults to the "Pending" filter tab -- a DONE ticket is
      // invisible until switching to "Done".
      await page.getByRole('button', { name: 'Done', exact: true }).click()
      await page.waitForTimeout(500)

      const ticketCard = page.locator('div.rounded-xl.border-2', { hasText: `${TEST_PREFIX} Fried Rice` }).filter({ has: page.getByRole('button', { name: 'Mark Served' }) }).first()
      r.log('mark-served-button-present', await ticketCard.count() > 0)
      await ticketCard.getByRole('button', { name: 'Mark Served' }).click()
      await page.waitForTimeout(900)
      r.log('mark-served-click-no-crash', !(await h.hasErrorBoundary(page)))

      const getRes = await page.evaluate(async () => window.api.restaurant.listKOTs({}))
      const servedKot = (getRes?.data || []).find((k) => k.id === kot2Id)
      r.log('kot-actually-marked-served-in-app', !!servedKot?.servedAt, JSON.stringify(servedKot?.servedAt))
    })

    await r.step('restore-modules-and-business-type', async () => {
      if (!originalModules.includes('kitchen_display_web')) {
        await page.evaluate(async (mods) => window.api.industry.updateModules({ modules: mods }), originalModules)
      }
      if (originalBusinessType && originalBusinessType !== 'RESTAURANT') {
        const res = await page.evaluate(async (bt) => window.api.industry.changeBusinessType({ businessType: bt }), originalBusinessType)
        r.log('business-type-restored', !!res?.success, originalBusinessType)
      }
    })
  } finally {
    await h.closeApp(app)
    h.randomizeAdminPassword()
    h.withDb((db) => {
      let kots = 0, invs = 0, prods = 0, tables = 0, emps = 0
      try { kots = db.prepare(`DELETE FROM KOTItem WHERE kotId IN (SELECT id FROM KOT WHERE tableId IN (SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'))`).run().changes } catch { /* noop */ }
      const kotIds = db.prepare(`SELECT id, invoiceId FROM KOT WHERE tableId IN (SELECT id FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%')`).all()
      for (const k of kotIds) { try { db.prepare('DELETE FROM KOT WHERE id = ?').run(k.id) } catch { /* noop */ } }
      const prodIds = db.prepare(`SELECT id FROM Product WHERE productName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of prodIds) {
        const invIds = db.prepare('SELECT DISTINCT invoiceId FROM InvoiceItem WHERE productId = ?').all(id).map((row) => row.invoiceId)
        try { db.prepare('DELETE FROM InvoiceItem WHERE productId = ?').run(id) } catch { /* noop */ }
        for (const invId of invIds) {
          try { db.prepare('DELETE FROM Payment WHERE invoiceId = ?').run(invId) } catch { /* noop */ }
          try { invs += db.prepare('DELETE FROM Invoice WHERE id = ?').run(invId).changes } catch { /* noop */ }
        }
        try { db.prepare('DELETE FROM InventoryMovement WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM LocationStock WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM Inventory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { db.prepare('DELETE FROM ProductCostHistory WHERE productId = ?').run(id) } catch { /* noop */ }
        try { prods += db.prepare('DELETE FROM Product WHERE id = ?').run(id).changes } catch { db.prepare('UPDATE Product SET isActive = 0 WHERE id = ?').run(id) }
      }
      try { tables = db.prepare(`DELETE FROM RestaurantTable WHERE tableNumber LIKE '${TEST_PREFIX}%'`).run().changes } catch { /* noop */ }
      const empIds = db.prepare(`SELECT id FROM Employee WHERE fullName LIKE '${TEST_PREFIX}%'`).all().map((row) => row.id)
      for (const id of empIds) { try { emps += db.prepare('DELETE FROM Employee WHERE id = ?').run(id).changes } catch { /* noop */ } }
      console.log('extra cleanup:', JSON.stringify({ kots, invs, prods, tables, emps }))
    })
  }

  return r
}

if (require.main === module) {
  run().then((r) => {
    const s = r.summary()
    console.log(`\nRESTAURANT WAITER VIEW: ${s.pass}/${s.total} passed`)
    process.exit(s.fail > 0 ? 1 : 0)
  }).catch((e) => { console.error('FATAL', e); process.exit(1) })
}

module.exports = { run }
